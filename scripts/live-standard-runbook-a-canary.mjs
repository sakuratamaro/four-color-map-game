import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live Runbook A canary users/rooms without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("FAIL  Runbook A canary exceeded its 90-second safety timeout.");
  process.exit(1);
}, 90_000);

const configSource = fs.readFileSync(path.join(root, "online", "supabase-config.js"), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) {
  console.error("FAIL  Public Supabase configuration is incomplete.");
  process.exit(1);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[0-9A-F]{6}$/;
const CANARY_NAMES = Object.freeze({ A: "RunbookA-Canary-A", B: "RunbookA-Canary-B" });
const LOADOUT = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});

const checks = [];
let activeStage = "bootstrap";

class CanaryFailure extends Error {
  constructor(stage, detail = "CHECK_FAILED") {
    super(stage);
    this.name = "CanaryFailure";
    this.detail = detail;
  }
}

function safeCode(result) {
  const candidate = result?.data?.error?.code || result?.data?.code;
  return typeof candidate === "string" && /^[A-Z0-9_]{1,64}$/.test(candidate) ? candidate : "UNKNOWN";
}

function check(name, condition, result = null) {
  if (!condition) {
    const status = Number.isInteger(result?.status) ? `HTTP_${result.status}` : "CHECK_FAILED";
    throw new CanaryFailure(name, result ? `${status}_${safeCode(result)}` : status);
  }
  checks.push(name);
}

async function request(pathname, { token, body, authorization } = {}) {
  const response = await fetch(`${url}${pathname}`, {
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

async function anonymous(label) {
  activeStage = `anonymous ${label}`;
  const result = await request("/auth/v1/signup", {
    authorization: `Bearer ${publishableKey}`,
    body: {},
  });
  check(`anonymous ${label}`, result.ok
    && UUID_PATTERN.test(String(result.data?.user?.id))
    && typeof result.data?.access_token === "string", result);
  return { token: result.data.access_token };
}

async function rpc(session, name, body) {
  return request(`/rest/v1/rpc/${name}`, { token: session.token, body });
}

async function edge(session, body) {
  return request("/functions/v1/standard-game-action", { token: session.token, body });
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function action(expectedVersion, type, payload = {}) {
  return { id: crypto.randomUUID(), expectedVersion, type, payload };
}

function openingMacros(publicState) {
  const bounds = publicState?.playableBounds;
  const requiredSize = publicState?.requiredSize;
  check("opening geometry available", bounds
    && Number.isSafeInteger(bounds.macroWidth)
    && Number.isSafeInteger(bounds.minRow)
    && Number.isSafeInteger(bounds.minCol)
    && Number.isSafeInteger(bounds.maxCol)
    && Number.isSafeInteger(requiredSize)
    && requiredSize > 0
    && bounds.minCol + requiredSize - 1 <= bounds.maxCol);
  return Array.from(
    { length: requiredSize },
    (_, offset) => bounds.minRow * bounds.macroWidth + bounds.minCol + offset,
  );
}

function assertSafeSnapshot(label, snapshot, expectedStatus) {
  check(`${label} snapshot schema`, snapshot?.snapshot_schema_version === 2);
  check(`${label} snapshot status`, snapshot?.room?.status === expectedStatus);
  check(`${label} snapshot membership`, snapshot?.members?.length === 2
    && snapshot.members.map((member) => member.seat).join("") === "AB");
  const serialized = JSON.stringify(snapshot);
  for (const forbidden of ["authoritative_state", "profile_a_state", "profile_b_state", "setup_a", "setup_b"]) {
    check(`${label} snapshot hides ${forbidden}`, !serialized.includes(forbidden));
  }
}

async function run() {
  activeStage = "anonymous sessions";
  const [playerA, playerB, outsider] = await Promise.all([
    anonymous("A"),
    anonymous("B"),
    anonymous("outsider"),
  ]);

  activeStage = "profiles";
  const profileAResult = await edge(playerA, { operation: "profile", expectedRevision: 0, displayName: CANARY_NAMES.A, profileState: {} });
  const profileBResult = await edge(playerB, { operation: "profile", expectedRevision: 0, displayName: CANARY_NAMES.B, profileState: {} });
  check("profile A", profileAResult.ok && Number(profileAResult.data?.revision) === 1, profileAResult);
  check("profile B", profileBResult.ok && Number(profileBResult.data?.revision) === 1, profileBResult);

  activeStage = "room creation";
  const createdResult = await rpc(playerA, "fcg_standard_create_room", { p_display_name: CANARY_NAMES.A });
  const created = firstRow(createdResult.data);
  check("private room created", createdResult.ok
    && UUID_PATTERN.test(String(created?.room_id))
    && ROOM_CODE_PATTERN.test(String(created?.room_code))
    && created?.seat === "A", createdResult);

  activeStage = "room join";
  const joinedResult = await rpc(playerB, "fcg_standard_join_room", {
    p_room_code: created.room_code,
    p_display_name: CANARY_NAMES.B,
  });
  const joined = firstRow(joinedResult.data);
  check("player B joined", joinedResult.ok
    && joined?.room_id === created.room_id
    && joined?.seat === "B"
    && joined?.game_mode === "standard_v5", joinedResult);

  activeStage = "outsider rejection";
  const [outsiderSnapshot, outsiderEdge] = await Promise.all([
    rpc(outsider, "fcg_standard_room_snapshot_v2", {
      p_room_id: created.room_id,
      p_known_profile_revision: null,
    }),
    edge(outsider, { operation: "initialize", roomId: created.room_id }),
  ]);
  check("outsider snapshot rejected", !outsiderSnapshot.ok, outsiderSnapshot);
  check("outsider Edge access rejected", !outsiderEdge.ok
    && [403, 404].includes(outsiderEdge.status), outsiderEdge);

  activeStage = "initial setup";
  const [setupAResult, setupBResult] = await Promise.all([
    edge(playerA, {
      operation: "setup", roomId: created.room_id, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT,
    }),
    edge(playerB, {
      operation: "setup", roomId: created.room_id, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT,
    }),
  ]);
  check("setup A", setupAResult.ok && Number(setupAResult.data?.setupRevision) === 1, setupAResult);
  check("setup B", setupBResult.ok && Number(setupBResult.data?.setupRevision) === 1, setupBResult);

  activeStage = "initialization";
  const initializedA = await edge(playerA, { operation: "initialize", roomId: created.room_id });
  check("match initialized", initializedA.ok
    && initializedA.data?.room?.status === "playing"
    && initializedA.data?.room?.publicState?.status === "ACTIVE", initializedA);
  const initializedB = await edge(playerB, { operation: "initialize", roomId: created.room_id });
  check("player B projection", initializedB.ok
    && initializedB.data?.room?.seat === "B"
    && initializedB.data?.room?.version === initializedA.data?.room?.version, initializedB);

  const initialPublicState = initializedA.data.room.publicState;
  const activePlayer = initialPublicState.active === "A" ? playerA : playerB;
  check("active seat projected", initialPublicState.active === "A" || initialPublicState.active === "B");

  activeStage = "regular opening action";
  const openingResult = await edge(activePlayer, {
    operation: "action",
    roomId: created.room_id,
    action: action(initializedA.data.room.version, "CREATE_REGION", {
      sourceMacros: openingMacros(initialPublicState),
    }),
  });
  check("regular opening action", openingResult.ok
    && openingResult.data?.room?.publicState?.phase === "COLOR"
    && openingResult.data?.room?.version === initializedA.data.room.version + 1, openingResult);

  activeStage = "surrender";
  const postOpeningState = openingResult.data.room.publicState;
  const surrenderingPlayer = postOpeningState.active === "A" ? playerA : playerB;
  check("post-opening active seat projected", postOpeningState.active === "A" || postOpeningState.active === "B");
  const finishedResult = await edge(surrenderingPlayer, {
    operation: "action",
    roomId: created.room_id,
    action: action(openingResult.data.room.version, "SURRENDER"),
  });
  check("surrender finished match", finishedResult.ok
    && finishedResult.data?.room?.status === "finished"
    && finishedResult.data?.room?.publicState?.status === "FINISHED"
    && finishedResult.data?.room?.publicState?.terminalReason === "SURRENDER", finishedResult);
  const finishedVersion = finishedResult.data.room.version;
  const firstMatchId = finishedResult.data.room.publicState.matchId;

  activeStage = "finished snapshots";
  const [snapshotAResult, snapshotBResult] = await Promise.all([
    rpc(playerA, "fcg_standard_room_snapshot_v2", {
      p_room_id: created.room_id,
      p_known_profile_revision: null,
    }),
    rpc(playerB, "fcg_standard_room_snapshot_v2", {
      p_room_id: created.room_id,
      p_known_profile_revision: null,
    }),
  ]);
  check("finished snapshot A response", snapshotAResult.ok, snapshotAResult);
  check("finished snapshot B response", snapshotBResult.ok, snapshotBResult);
  const snapshotA = firstRow(snapshotAResult.data);
  const snapshotB = firstRow(snapshotBResult.data);
  assertSafeSnapshot("A", snapshotA, "finished");
  assertSafeSnapshot("B", snapshotB, "finished");
  check("finished snapshots agree", snapshotA.snapshot_version === finishedVersion
    && snapshotB.snapshot_version === finishedVersion
    && snapshotA.room.public_state?.terminalReason === "SURRENDER"
    && snapshotB.room.public_state?.terminalReason === "SURRENDER");
  check("finished private projections are seat-scoped", snapshotA.view?.seat === "A"
    && snapshotB.view?.seat === "B"
    && snapshotA.view?.version === finishedVersion
    && snapshotB.view?.version === finishedVersion);

  activeStage = "rematch handshake";
  const rematchAResult = await rpc(playerA, "fcg_standard_request_rematch", {
    p_room_id: created.room_id,
    p_expected_version: finishedVersion,
    p_action_id: crypto.randomUUID(),
  });
  const rematchA = firstRow(rematchAResult.data);
  check("first rematch vote waits", rematchAResult.ok
    && rematchA?.room_status === "finished"
    && rematchA?.ready_to_setup === false, rematchAResult);
  const rematchBResult = await rpc(playerB, "fcg_standard_request_rematch", {
    p_room_id: created.room_id,
    p_expected_version: finishedVersion,
    p_action_id: crypto.randomUUID(),
  });
  const rematchB = firstRow(rematchBResult.data);
  check("second rematch vote resets room", rematchBResult.ok
    && rematchB?.room_status === "ready"
    && rematchB?.ready_to_setup === true
    && rematchB?.room_version === finishedVersion + 1, rematchBResult);

  activeStage = "rematch setup";
  const [rematchSetupA, rematchSetupB] = await Promise.all([
    edge(playerA, {
      operation: "setup", roomId: created.room_id, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT,
    }),
    edge(playerB, {
      operation: "setup", roomId: created.room_id, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT,
    }),
  ]);
  check("rematch setup A", rematchSetupA.ok && Number(rematchSetupA.data?.setupRevision) === 1, rematchSetupA);
  check("rematch setup B", rematchSetupB.ok && Number(rematchSetupB.data?.setupRevision) === 1, rematchSetupB);

  activeStage = "rematch initialization";
  const rematchInitialized = await edge(playerA, { operation: "initialize", roomId: created.room_id });
  check("rematch established", rematchInitialized.ok
    && rematchInitialized.data?.room?.status === "playing"
    && rematchInitialized.data?.room?.version === finishedVersion + 1
    && rematchInitialized.data?.room?.publicState?.status === "ACTIVE"
    && rematchInitialized.data?.room?.publicState?.matchId !== firstMatchId, rematchInitialized);

  for (const name of checks) console.log(`PASS  ${name}`);
  console.log(`SUMMARY ${checks.length}/${checks.length} Runbook A live checks passed`);
}

try {
  await run();
} catch (error) {
  const detail = error instanceof CanaryFailure
    ? error.detail
    : error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "REQUEST_TIMEOUT"
      : "UNEXPECTED_FAILURE";
  console.error(`FAIL  ${activeStage} (${detail})`);
  process.exitCode = 1;
} finally {
  clearTimeout(hardTimeout);
}
