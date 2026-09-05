import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create a live immediate-CPU room without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("FAIL  Immediate-CPU canary exceeded its 60-second safety timeout.");
  process.exit(1);
}, 60_000);

const configSource = await readFile(new URL("../online/supabase-config.js", import.meta.url), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const checks = [];

function safeCode(result) {
  const candidate = result?.data?.error?.code || result?.data?.code;
  return typeof candidate === "string" && /^[A-Z0-9_]{1,64}$/.test(candidate) ? candidate : "UNKNOWN";
}

function check(name, condition, result = null) {
  if (!condition) {
    const detail = result ? `HTTP_${result.status}_${safeCode(result)}` : "CHECK_FAILED";
    throw new Error(`${name}: ${detail}`);
  }
  checks.push(name);
}

async function request(path, { token, body, authorization } = {}) {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publishableKey,
      ...(authorization !== undefined
        ? { authorization }
        : token
          ? { authorization: `Bearer ${token}` }
          : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}

const endpoint = "/functions/v1/standard-game-action";
const signup = await request("/auth/v1/signup", {
  authorization: `Bearer ${publishableKey}`,
  body: {},
});
check("anonymous sign-in", signup.ok && typeof signup.data?.access_token === "string", signup);
const token = signup.data.access_token;

const profile = await request(endpoint, {
  token,
  body: { operation: "profile", expectedRevision: 0, displayName: "ImmediateCPUCanary", profileState: {} },
});
check("profile creation", profile.ok && Number(profile.data?.revision) === 1, profile);

const invalid = await request(endpoint, {
  token,
  body: { operation: "cpu-start", actionId: randomUUID(), characterId: "not-a-character", confirmed: true },
});
check("unknown character rejected", invalid.status === 400 && safeCode(invalid) === "UNKNOWN_CPU_CHARACTER", invalid);

const actionId = randomUUID();
const first = await request(endpoint, {
  token,
  body: { operation: "cpu-start", actionId, characterId: "yuzu", confirmed: true },
});
check("immediate CPU room created", first.ok
  && first.data?.matchmakingStatus === "matched"
  && first.data?.startStatus === "created"
  && first.data?.seat === "A"
  && first.data?.opponentKind === "cpu"
  && first.data?.characterId === "yuzu"
  && first.data?.duplicate === false
  && UUID_PATTERN.test(String(first.data?.roomId)), first);

const replay = await request(endpoint, {
  token,
  body: { operation: "cpu-start", actionId, characterId: "yuzu", confirmed: true },
});
check("lost-response retry is idempotent", replay.ok
  && replay.data?.roomId === first.data.roomId
  && replay.data?.startStatus === "duplicate"
  && replay.data?.duplicate === true, replay);

const collision = await request(endpoint, {
  token,
  body: { operation: "cpu-start", actionId, characterId: "ren", confirmed: true },
});
check("changed retry is rejected", collision.status === 409 && safeCode(collision) === "IDEMPOTENCY_KEY_REUSE", collision);

const snapshot = await request("/rest/v1/rpc/fcg_standard_room_snapshot_v2", {
  token,
  body: { p_room_id: first.data.roomId, p_known_profile_revision: null },
});
const room = Array.isArray(snapshot.data) ? snapshot.data[0] : snapshot.data;
const cpuMember = room?.members?.find((member) => member?.is_cpu === true);
check("room snapshot exposes selected CPU", snapshot.ok
  && room?.room?.opponent_kind === "cpu"
  && room?.room?.cpu_character_id === "yuzu"
  && cpuMember?.seat === "B"
  && cpuMember?.display_name === "うっかりユズ", snapshot);

const activeRoom = await request("/rest/v1/rpc/fcg_standard_active_room", {
  token,
  body: {},
});
const activeRows = Array.isArray(activeRoom.data) ? activeRoom.data : [];
check("active-room recovery returns only the caller's CPU room", activeRoom.ok
  && activeRows.length === 1
  && activeRows[0]?.room_id === first.data.roomId
  && activeRows[0]?.seat === "A"
  && ["waiting", "ready", "playing"].includes(activeRows[0]?.room_status)
  && activeRows[0]?.access_mode === "cpu"
  && activeRows[0]?.opponent_kind === "cpu"
  && activeRows[0]?.cpu_character_id === "yuzu"
  && Number(activeRows[0]?.setup_revision) === 0, activeRoom);

const recovered = await request(endpoint, {
  token,
  body: { operation: "cpu-start", actionId: randomUUID(), characterId: "ren", confirmed: true },
});
check("second CPU start recovers the existing room", recovered.ok
  && recovered.data?.roomId === first.data.roomId
  && recovered.data?.startStatus === "recovered_existing"
  && recovered.data?.characterId === "yuzu"
  && recovered.data?.duplicate === false, recovered);

const activeRoomAfterRecovery = await request("/rest/v1/rpc/fcg_standard_active_room", {
  token,
  body: {},
});
const activeRowsAfterRecovery = Array.isArray(activeRoomAfterRecovery.data) ? activeRoomAfterRecovery.data : [];
check("recovery does not create a second active room", activeRoomAfterRecovery.ok
  && activeRowsAfterRecovery.length === 1
  && activeRowsAfterRecovery[0]?.room_id === first.data.roomId, activeRoomAfterRecovery);

for (const name of checks) console.log(`PASS  ${name}`);
console.log(`SUMMARY ${checks.length}/${checks.length} immediate-CPU checks passed`);
clearTimeout(hardTimeout);
