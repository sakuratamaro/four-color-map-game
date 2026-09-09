import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live CPU reward canary data without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("FAIL  CPU reward persistence canary exceeded its 90-second safety timeout.");
  process.exit(1);
}, 90_000);

const configSource = await readFile(new URL("../online/supabase-config.js", import.meta.url), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const endpoint = "/functions/v1/standard-game-action";
const loadout = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});
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

async function request(path, { token, body, method = "POST" } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publishableKey,
      ...(token ? { authorization: `Bearer ${token}` } : { authorization: `Bearer ${publishableKey}` }),
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}

async function edge(token, body) {
  return request(endpoint, { token, body });
}

async function snapshot(token, roomId, knownProfileRevision) {
  const result = await request("/rest/v1/rpc/fcg_standard_room_snapshot_v2", {
    token,
    body: { p_room_id: roomId, p_known_profile_revision: knownProfileRevision },
  });
  return { result, value: Array.isArray(result.data) ? result.data[0] : result.data };
}

const signup = await request("/auth/v1/signup", { body: {} });
check("anonymous sign-in", signup.ok && typeof signup.data?.access_token === "string", signup);
const token = signup.data.access_token;
const userId = signup.data.user?.id;
check("anonymous user id", typeof userId === "string" && /^[0-9a-f-]{36}$/i.test(userId), signup);

const createdProfile = await edge(token, {
  operation: "profile",
  expectedRevision: 0,
  displayName: "RewardCanary",
  profileState: {},
});
check("profile creation", createdProfile.ok && Number(createdProfile.data?.revision) === 1, createdProfile);
const priorRevision = Number(createdProfile.data.revision);
const priorTickets = Number(createdProfile.data.profileState?.gachaTickets?.["1"] || 0);

const started = await edge(token, {
  operation: "cpu-start",
  actionId: randomUUID(),
  characterId: "yuzu",
  confirmed: true,
});
check("CPU room created", started.ok && started.data?.startStatus === "created" && started.data?.opponentKind === "cpu", started);
const roomId = started.data.roomId;

const setup = await edge(token, {
  operation: "setup",
  roomId,
  expectedSetupRevision: 0,
  setupActionId: randomUUID(),
  loadout,
});
check("CPU setup committed", setup.ok && Number(setup.data?.setupRevision) === 1, setup);

const initialized = await edge(token, { operation: "initialize", roomId });
check("CPU match initialized", initialized.ok && initialized.data?.room?.status === "playing", initialized);
let room = initialized.data.room;
let cpuActions = 0;
while (room.publicState?.status === "ACTIVE" && room.publicState.active === "B" && cpuActions < 12) {
  const cpuResult = await edge(token, { operation: "cpu-action", roomId, expectedVersion: room.version });
  check(`CPU yielded action ${cpuActions + 1}`, cpuResult.ok && cpuResult.data?.room?.version === room.version + 1, cpuResult);
  room = cpuResult.data.room;
  cpuActions += 1;
}
check("human turn reached", room.publicState?.status === "ACTIVE" && room.publicState.active === "A");

const surrenderAction = { id: randomUUID(), expectedVersion: room.version, type: "SURRENDER", payload: {} };
const finished = await edge(token, { operation: "action", roomId, action: surrenderAction });
check("CPU match finished", finished.ok && finished.data?.room?.status === "finished"
  && finished.data?.room?.publicState?.winner === "B", finished);

const delta = await snapshot(token, roomId, priorRevision);
const settledProfile = delta.value?.profile?.profile_state;
const settledRevision = Number(delta.value?.profile_revision);
check("finished snapshot returns profile delta", delta.result.ok && settledRevision === priorRevision + 1
  && delta.value?.profile?.revision === settledRevision, delta.result);
check("CPU loss history persisted", settledProfile?.matchHistory?.[0]?.matchId === finished.data.room.publicState.matchId
  && settledProfile.matchHistory[0].onlineOpponentKind === "cpu"
  && settledProfile.matchHistory[0].result === "LOSS");
check("CPU completion ticket persisted", Number(settledProfile?.gachaTickets?.["1"] || 0) === priorTickets + 1);

const unchanged = await snapshot(token, roomId, settledRevision);
check("unchanged snapshot omits profile body", unchanged.result.ok
  && Number(unchanged.value?.profile_revision) === settledRevision
  && unchanged.value?.profile === null, unchanged.result);

const reloadProfile = await request(`/rest/v1/fcg_standard_profiles?select=revision,profile_state&user_id=eq.${userId}`, {
  token,
  method: "GET",
});
const reloaded = Array.isArray(reloadProfile.data) ? reloadProfile.data[0] : null;
check("full reload reads settled revision", reloadProfile.ok && Number(reloaded?.revision) === settledRevision, reloadProfile);
check("full reload keeps completion ticket", Number(reloaded?.profile_state?.gachaTickets?.["1"] || 0) === priorTickets + 1);

const replay = await edge(token, { operation: "action", roomId, action: surrenderAction });
check("terminal action replay is idempotent", replay.ok && replay.data?.duplicate === true, replay);
const afterReplay = await request(`/rest/v1/fcg_standard_profiles?select=revision,profile_state&user_id=eq.${userId}`, {
  token,
  method: "GET",
});
const replayedProfile = Array.isArray(afterReplay.data) ? afterReplay.data[0] : null;
check("replay does not increment revision", afterReplay.ok && Number(replayedProfile?.revision) === settledRevision, afterReplay);
check("replay does not duplicate ticket", Number(replayedProfile?.profile_state?.gachaTickets?.["1"] || 0) === priorTickets + 1);

for (const name of checks) console.log(`PASS  ${name}`);
console.log(`SUMMARY ${checks.length}/${checks.length} CPU reward persistence checks passed`);
clearTimeout(hardTimeout);
