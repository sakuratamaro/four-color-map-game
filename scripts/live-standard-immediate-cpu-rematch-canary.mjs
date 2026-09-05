import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live immediate-CPU flow canary data without --confirm-live.");
  process.exit(2);
}

const REQUEST_TIMEOUT_MS = 20_000;
const HARD_TIMEOUT_MS = 120_000;
const CHARACTER_ID = "yuzu";
const CHARACTER_NAME = "うっかりユズ";
const LOADOUT = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});

const hardTimeout = setTimeout(() => {
  console.error("FAIL  Immediate-CPU flow canary exceeded its finite safety timeout.");
  process.exit(1);
}, HARD_TIMEOUT_MS);

const configSource = fs.readFileSync(path.join(root, "online", "supabase-config.js"), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) {
  console.error("FAIL  Public Supabase configuration is incomplete.");
  process.exit(1);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

async function edge(session, body) {
  return request("/functions/v1/standard-game-action", { token: session.token, body });
}

async function rpc(session, name, body) {
  return request(`/rest/v1/rpc/${name}`, { token: session.token, body });
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function action(expectedVersion, type, payload = {}) {
  return { id: randomUUID(), expectedVersion, type, payload };
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

async function snapshot(session, roomId, label) {
  activeStage = `snapshot ${label}`;
  const result = await rpc(session, "fcg_standard_room_snapshot_v2", {
    p_room_id: roomId,
    p_known_profile_revision: null,
  });
  check(`snapshot ${label}`, result.ok, result);
  return firstRow(result.data);
}

function checkCpuIdentity(label, room) {
  const cpuMember = room?.members?.find((member) => member?.is_cpu === true);
  check(`same CPU identity ${label}`, room?.room?.opponent_kind === "cpu"
    && room.room.cpu_character_id === CHARACTER_ID
    && cpuMember?.seat === "B"
    && cpuMember?.display_name === CHARACTER_NAME);
}

async function run() {
  activeStage = "anonymous sign-in";
  const signup = await request("/auth/v1/signup", {
    authorization: `Bearer ${publishableKey}`,
    body: {},
  });
  check("anonymous sign-in", signup.ok
    && UUID_PATTERN.test(String(signup.data?.user?.id))
    && typeof signup.data?.access_token === "string", signup);
  const session = { token: signup.data.access_token };

  activeStage = "profile";
  const profile = await edge(session, {
    operation: "profile",
    expectedRevision: 0,
    displayName: "CPUFlowCanary-0905",
    profileState: {},
  });
  check("canary profile created", profile.ok
    && Number(profile.data?.revision) === 1
    && typeof profile.data?.profileState === "object", profile);
  const initialCpuLosses = Number(profile.data.profileState?.cpuStats?.losses || 0);

  activeStage = "immediate CPU start";
  const started = await edge(session, {
    operation: "cpu-start",
    actionId: randomUUID(),
    characterId: CHARACTER_ID,
    confirmed: true,
  });
  check("immediate CPU room created", started.ok
    && started.data?.matchmakingStatus === "matched"
    && started.data?.startStatus === "created"
    && started.data?.seat === "A"
    && started.data?.opponentKind === "cpu"
    && started.data?.characterId === CHARACTER_ID
    && UUID_PATTERN.test(String(started.data?.roomId)), started);
  const roomId = started.data.roomId;

  const ready = await snapshot(session, roomId, "initial ready");
  check("initial room ready", ready?.room?.status === "ready" && ready?.view === null);
  checkCpuIdentity("initial ready", ready);

  activeStage = "initial setup";
  const setup = await edge(session, {
    operation: "setup",
    roomId,
    expectedSetupRevision: 0,
    setupActionId: randomUUID(),
    loadout: LOADOUT,
  });
  check("initial setup accepted", setup.ok && Number(setup.data?.setupRevision) === 1, setup);

  activeStage = "initial initialize";
  const initialized = await edge(session, { operation: "initialize", roomId });
  check("initial match initialized", initialized.ok
    && initialized.data?.room?.status === "playing"
    && initialized.data?.room?.publicState?.status === "ACTIVE", initialized);
  let room = initialized.data.room;
  const firstMatchId = room.publicState.matchId;

  if (room.publicState.active === "A") {
    activeStage = "human opening";
    const opened = await edge(session, {
      operation: "action",
      roomId,
      action: action(room.version, "CREATE_REGION", { sourceMacros: openingMacros(room.publicState) }),
    });
    check("human opening accepted", opened.ok
      && opened.data?.room?.publicState?.phase === "COLOR", opened);
    room = opened.data.room;
  }

  activeStage = "CPU legal turn";
  let cpuActionCount = 0;
  while (room.publicState?.status === "ACTIVE" && room.publicState.active === "B" && cpuActionCount < 12) {
    const beforeVersion = room.version;
    const moved = await edge(session, {
      operation: "cpu-action",
      roomId,
      expectedVersion: beforeVersion,
    });
    check("CPU legal action accepted", moved.ok
      && moved.data?.room?.version === beforeVersion + 1, moved);
    room = moved.data.room;
    cpuActionCount += 1;
  }
  check("CPU yielded to human", cpuActionCount > 0
    && cpuActionCount < 12
    && room.publicState?.status === "ACTIVE"
    && room.publicState.active === "A");

  activeStage = "finish first match";
  const surrendered = await edge(session, {
    operation: "action",
    roomId,
    action: action(room.version, "SURRENDER"),
  });
  check("first match finished", surrendered.ok
    && surrendered.data?.room?.status === "finished"
    && surrendered.data?.room?.publicState?.status === "FINISHED"
    && surrendered.data?.room?.publicState?.winner === "B"
    && surrendered.data?.room?.publicState?.terminalReason === "SURRENDER", surrendered);
  const finishedVersion = surrendered.data.room.version;

  const finished = await snapshot(session, roomId, "finished result");
  checkCpuIdentity("finished result", finished);
  check("finished result projected", finished?.room?.status === "finished"
    && finished?.room?.winner_seat === "B"
    && finished?.room?.public_state?.terminalReason === "SURRENDER");
  const settledProfile = finished?.profile?.profile_state;
  check("CPU loss settlement persisted", settledProfile?.cpuStats?.losses === initialCpuLosses + 1
    && settledProfile?.matchHistory?.[0]?.matchId === firstMatchId
    && settledProfile.matchHistory[0].result === "LOSS"
    && settledProfile.matchHistory[0].onlineOpponentKind === "cpu"
    && settledProfile.matchHistory[0].cpuCharacterId === CHARACTER_ID);

  activeStage = "same CPU rematch";
  const rematch = await edge(session, {
    operation: "cpu-rematch",
    roomId,
    expectedVersion: finishedVersion,
    actionId: randomUUID(),
  });
  check("same CPU rematch requested", rematch.ok
    && rematch.data?.roomStatus === "ready"
    && rematch.data?.roomVersion === finishedVersion + 1
    && rematch.data?.readyToSetup === true, rematch);

  const rematchReady = await snapshot(session, roomId, "rematch ready");
  check("same room reused for rematch", rematchReady?.room?.id === roomId
    && rematchReady?.room?.status === "ready"
    && rematchReady?.room?.version === finishedVersion + 1);
  checkCpuIdentity("rematch ready", rematchReady);

  activeStage = "rematch setup";
  const rematchSetup = await edge(session, {
    operation: "setup",
    roomId,
    expectedSetupRevision: 0,
    setupActionId: randomUUID(),
    loadout: LOADOUT,
  });
  check("rematch setup accepted", rematchSetup.ok
    && Number(rematchSetup.data?.setupRevision) === 1, rematchSetup);

  activeStage = "rematch initialize";
  const reinitialized = await edge(session, { operation: "initialize", roomId });
  check("same CPU rematch reinitialized", reinitialized.ok
    && reinitialized.data?.room?.status === "playing"
    && reinitialized.data?.room?.publicState?.status === "ACTIVE"
    && reinitialized.data?.room?.publicState?.matchId !== firstMatchId, reinitialized);
  const rematchPlaying = await snapshot(session, roomId, "rematch playing");
  checkCpuIdentity("rematch playing", rematchPlaying);
  check("rematch projection is playable", rematchPlaying?.room?.status === "playing"
    && rematchPlaying?.view?.seat === "A"
    && rematchPlaying?.view?.version === rematchPlaying?.room?.version);

  for (const name of checks) console.log(`PASS  ${name}`);
  console.log(`SUMMARY ${checks.length}/${checks.length} immediate-CPU flow checks passed`);
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
