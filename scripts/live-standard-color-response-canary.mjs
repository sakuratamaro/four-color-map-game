import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create a live COLOR-response canary room without --confirm-live.");
  process.exit(2);
}

const EXPECTED_ENGINE_VERSION = "5.0.0-alpha.2";
const MAX_DRIVER_STEPS = 24;
const MAX_CONSECUTIVE_CPU_STEPS = 8;
const REQUEST_TIMEOUT_MS = 20_000;
const hardAbortController = new AbortController();
const hardTimeout = setTimeout(() => {
  activeStage = "hard timeout";
  hardAbortController.abort(new DOMException("COLOR-response canary exceeded its 180-second safety timeout.", "TimeoutError"));
}, 180_000);

const require = createRequire(import.meta.url);
const cpu = require("../standard/standard-cpu.js");
const configSource = fs.readFileSync(path.join(root, "online", "supabase-config.js"), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOADOUT = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});
const PUBLIC_PRIVACY_FORBIDDEN_KEYS = Object.freeze([
  "hand", "loadout", "basicPalette", "bonusColor", "bonusUsesRemaining", "privateEffects",
  "hands", "basicPalettes", "bonusColors", "authoritative_state",
  "profile_a_state", "profile_b_state", "setup_a", "setup_b",
]);

const checks = [];
let activeStage = "bootstrap";
let cleanupTarget = null;

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

async function request(pathname, { token, body, authorization, cleanup = false } = {}) {
  const response = await fetch(`${url}${pathname}`, {
    method: "POST",
    signal: cleanup
      ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      : AbortSignal.any([AbortSignal.timeout(REQUEST_TIMEOUT_MS), hardAbortController.signal]),
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

async function edge(session, body, options = {}) {
  return request("/functions/v1/standard-game-action", { token: session.token, body, ...options });
}

async function rpc(session, name, body, options = {}) {
  return request(`/rest/v1/rpc/${name}`, { token: session.token, body, ...options });
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function action(expectedVersion, type, payload = {}, id = randomUUID()) {
  return { id, expectedVersion, type, payload };
}

function assertPublicPrivacy(label, publicState) {
  check(`${label} public state object`, publicState && typeof publicState === "object" && !Array.isArray(publicState));
  const serialized = JSON.stringify(publicState);
  for (const key of PUBLIC_PRIVACY_FORBIDDEN_KEYS) {
    check(`${label} hides ${key}`, !serialized.includes(`"${key}"`));
  }
}

function chooseHumanAction(room) {
  const publicState = room?.publicState;
  const ownPrivateState = room?.privateState;
  check("human private projection", ownPrivateState?.seat === "A");
  const observation = cpu.makeObservation({ publicState, ownPrivateState, difficulty: "hard" });
  const candidates = cpu.enumerateCpuActions(observation);
  const wantedType = publicState.phase === "COLOR" ? "COLOR_REGION" : "CREATE_REGION";
  const selected = candidates.find((candidate) => candidate.type === wantedType);
  check(`human ${wantedType} candidate`, Boolean(selected));
  return { type: selected.type, payload: selected.payload };
}

async function refreshRoom(session, roomId) {
  const result = await edge(session, { operation: "initialize", roomId });
  check("room refresh", result.ok && result.data?.room && Number.isSafeInteger(Number(result.data.room.version)), result);
  return result.data.room;
}

async function finishCpuRoom(session, roomId, reportChecks) {
  for (let step = 0; step < MAX_CONSECUTIVE_CPU_STEPS + 2; step += 1) {
    const refreshed = await edge(session, { operation: "initialize", roomId }, { cleanup: true });
    if (!refreshed.ok || !refreshed.data?.room) {
      const snapshotResult = await rpc(session, "fcg_standard_room_snapshot_v2", {
        p_room_id: roomId,
        p_known_profile_revision: null,
      }, { cleanup: true });
      const snapshot = firstRow(snapshotResult.data);
      const version = Number(snapshot?.snapshot_version);
      if (!snapshotResult.ok || !Number.isSafeInteger(version)) return false;
      const abandoned = await rpc(session, "fcg_standard_abandon_room", {
        p_room_id: roomId,
        p_expected_version: version,
        p_action_id: randomUUID(),
      }, { cleanup: true });
      return abandoned.ok;
    }
    const room = refreshed.data.room;
    if (room.status === "finished" || room.publicState?.status === "FINISHED") return true;
    if (room.status !== "playing") {
      const snapshot = firstRow((await rpc(session, "fcg_standard_room_snapshot_v2", {
        p_room_id: roomId,
        p_known_profile_revision: null,
      }, { cleanup: true })).data);
      const version = Number(snapshot?.snapshot_version);
      if (!Number.isSafeInteger(version)) return false;
      const abandoned = await rpc(session, "fcg_standard_abandon_room", {
        p_room_id: roomId,
        p_expected_version: version,
        p_action_id: randomUUID(),
      }, { cleanup: true });
      return abandoned.ok;
    }
    if (room.publicState?.active === "B") {
      const cpuResult = await edge(session, { operation: "cpu-action", roomId, expectedVersion: room.version }, { cleanup: true });
      if (!cpuResult.ok || Number(cpuResult.data?.room?.version) !== room.version + 1) return false;
      continue;
    }
    const surrendered = await edge(session, {
      operation: "action",
      roomId,
      action: action(room.version, "SURRENDER"),
    }, { cleanup: true });
    const finished = surrendered.ok
      && surrendered.data?.room?.status === "finished"
      && surrendered.data?.room?.publicState?.terminalReason === "SURRENDER";
    if (reportChecks) check("cleanup surrender finishes canary room", finished, surrendered);
    return finished;
  }
  return false;
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
    displayName: "ColorResponseCanary",
    profileState: {},
  });
  check("canary profile", profile.ok && Number(profile.data?.revision) === 1, profile);

  activeStage = "CPU room";
  const started = await edge(session, {
    operation: "cpu-start",
    actionId: randomUUID(),
    characterId: "yuzu",
    confirmed: true,
  });
  check("CPU room created", started.ok
    && started.data?.startStatus === "created"
    && UUID_PATTERN.test(String(started.data?.roomId)), started);
  const roomId = started.data.roomId;
  cleanupTarget = { session, roomId };

  const setup = await edge(session, {
    operation: "setup",
    roomId,
    expectedSetupRevision: 0,
    setupActionId: randomUUID(),
    loadout: LOADOUT,
  });
  check("human setup", setup.ok && Number(setup.data?.setupRevision) === 1, setup);

  activeStage = "initialize alpha.2 room";
  let room = await refreshRoom(session, roomId);
  check("new room uses alpha.2", room.status === "playing"
    && room.publicState?.engineVersion === EXPECTED_ENGINE_VERSION, { status: 200, data: room });
  assertPublicPrivacy("initial", room.publicState);

  let retiredDeclarationChecked = false;
  let cpuSteps = 0;
  let consecutiveCpuSteps = 0;
  let maxConsecutiveCpuSteps = 0;

  for (let step = 0; step < MAX_DRIVER_STEPS && !(retiredDeclarationChecked && cpuSteps > 0 && room.publicState?.active === "A"); step += 1) {
    activeStage = `driver step ${step + 1}`;
    assertPublicPrivacy(`step ${step + 1}`, room.publicState);
    if (room.publicState?.status === "FINISHED") break;

    if (room.publicState?.active === "B") {
      const beforeVersion = room.version;
      const cpuResult = await edge(session, { operation: "cpu-action", roomId, expectedVersion: beforeVersion });
      check("CPU action advances exactly once", cpuResult.ok
        && Number(cpuResult.data?.room?.version) === beforeVersion + 1, cpuResult);
      room = cpuResult.data.room;
      cpuSteps += 1;
      consecutiveCpuSteps += 1;
      maxConsecutiveCpuSteps = Math.max(maxConsecutiveCpuSteps, consecutiveCpuSteps);
      check("CPU loop remains bounded", maxConsecutiveCpuSteps <= MAX_CONSECUTIVE_CPU_STEPS);
      continue;
    }

    consecutiveCpuSteps = 0;
    if (room.publicState?.active !== "A") throw new CanaryFailure("driver active seat", "INVALID_ACTIVE_SEAT");
    if (room.publicState.phase === "COLOR" && !retiredDeclarationChecked) {
      const beforeVersion = room.version;
      const beforePublic = JSON.stringify(room.publicState);
      const beforePrivate = JSON.stringify(room.privateState);
      const declarationId = randomUUID();
      const rejected = await edge(session, {
        operation: "action",
        roomId,
        action: action(beforeVersion, "DECLARE_NO_COLOR", {}, declarationId),
      });
      check("alpha.2 no-color declaration is retired", !rejected.ok
        && rejected.status === 400
        && rejected.data?.error?.code === "NO_COLOR_DECLARATION_RETIRED", rejected);
      room = await refreshRoom(session, roomId);
      check("retired declaration is write-free", room.version === beforeVersion
        && JSON.stringify(room.publicState) === beforePublic
        && JSON.stringify(room.privateState) === beforePrivate);
      retiredDeclarationChecked = true;
    }

    const selected = chooseHumanAction(room);
    const humanResult = await edge(session, {
      operation: "action",
      roomId,
      action: action(room.version, selected.type, selected.payload),
    });
    check("human driver action", humanResult.ok
      && Number(humanResult.data?.room?.version) === room.version + 1, humanResult);
    room = humanResult.data.room;
  }

  check("retired declaration path reached", retiredDeclarationChecked);
  check("bounded CPU path reached", cpuSteps > 0 && maxConsecutiveCpuSteps <= MAX_CONSECUTIVE_CPU_STEPS);
  assertPublicPrivacy("final playing", room.publicState);

  activeStage = "cleanup";
  check("finite cleanup", await finishCpuRoom(session, roomId, true));
  cleanupTarget = null;

  for (const name of checks) console.log(`PASS  ${name}`);
  console.log(`SUMMARY ${checks.length}/${checks.length} COLOR-response live checks passed`);
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
  if (cleanupTarget) {
    try {
      await finishCpuRoom(cleanupTarget.session, cleanupTarget.roomId, false);
    } catch {
      // Best-effort cleanup is bounded; preserve the original failure.
    }
  }
  clearTimeout(hardTimeout);
}
