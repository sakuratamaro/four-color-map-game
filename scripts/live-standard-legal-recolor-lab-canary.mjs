import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live legal-recolor LAB users/rooms without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("FAIL  Legal-recolor LAB canary exceeded its 90-second safety timeout.");
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
const LAB_RULE_SET = "STANDARD_V5_LEGAL_RECOLOR_LAB_V1";
const CANARY_NAMES = Object.freeze({ A: "LegalRecolor-LAB-A", B: "LegalRecolor-LAB-B" });
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
    throw new CanaryFailure(name, `${name.replaceAll(" ", "_")}_${result ? `${status}_${safeCode(result)}` : status}`);
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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

async function run() {
  activeStage = "anonymous sessions";
  const [playerA, playerB] = await Promise.all([anonymous("A"), anonymous("B")]);
  const players = { A: playerA, B: playerB };

  activeStage = "profiles";
  const [profileAResult, profileBResult] = await Promise.all([
    edge(playerA, { operation: "profile", expectedRevision: 0, displayName: CANARY_NAMES.A, profileState: {} }),
    edge(playerB, { operation: "profile", expectedRevision: 0, displayName: CANARY_NAMES.B, profileState: {} }),
  ]);
  check("profile A", profileAResult.ok && Number(profileAResult.data?.revision) === 1, profileAResult);
  check("profile B", profileBResult.ok && Number(profileBResult.data?.revision) === 1, profileBResult);
  const initialProfiles = { A: profileAResult.data.profileState, B: profileBResult.data.profileState };

  activeStage = "private room";
  const createdResult = await rpc(playerA, "fcg_standard_create_room", { p_display_name: CANARY_NAMES.A });
  const created = firstRow(createdResult.data);
  check("private room created", createdResult.ok
    && UUID_PATTERN.test(String(created?.room_id))
    && ROOM_CODE_PATTERN.test(String(created?.room_code))
    && created?.seat === "A", createdResult);
  const joinedResult = await rpc(playerB, "fcg_standard_join_room", {
    p_room_code: created.room_code,
    p_display_name: CANARY_NAMES.B,
  });
  const joined = firstRow(joinedResult.data);
  check("player B joined", joinedResult.ok
    && joined?.room_id === created.room_id
    && joined?.seat === "B"
    && joined?.game_mode === "standard_v5", joinedResult);

  activeStage = "mutual LAB setup";
  const [setupAResult, setupBResult] = await Promise.all([
    edge(playerA, {
      operation: "setup", roomId: created.room_id, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT, labMode: true,
    }),
    edge(playerB, {
      operation: "setup", roomId: created.room_id, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT, labMode: true,
    }),
  ]);
  check("LAB setup A", setupAResult.ok
    && Number(setupAResult.data?.setupRevision) === 1
    && setupAResult.data?.labMode === true, setupAResult);
  check("LAB setup B", setupBResult.ok
    && Number(setupBResult.data?.setupRevision) === 1
    && setupBResult.data?.labMode === true, setupBResult);

  activeStage = "LAB initialization";
  const initializedA = await edge(playerA, { operation: "initialize", roomId: created.room_id });
  const initializedB = await edge(playerB, { operation: "initialize", roomId: created.room_id });
  check("LAB match initialized", initializedA.ok
    && initializedA.data?.room?.status === "playing"
    && initializedA.data?.room?.publicState?.status === "ACTIVE"
    && initializedA.data?.room?.publicState?.labRuleSetId === LAB_RULE_SET, initializedA);
  check("symmetric experimental loan", initializedA.data?.room?.privateState?.hand?.legalRecolor === 1
    && initializedB.data?.room?.privateState?.hand?.legalRecolor === 1);
  check("ordinary six-card loadouts preserved", !JSON.stringify(initializedA.data.room.privateState.loadout).includes("legalRecolor")
    && !JSON.stringify(initializedB.data.room.privateState.loadout).includes("legalRecolor"));

  const initialPublicState = initializedA.data.room.publicState;
  const creatorSeat = initialPublicState.active;
  check("opening active seat projected", creatorSeat === "A" || creatorSeat === "B");
  const colorerSeat = creatorSeat === "A" ? "B" : "A";

  activeStage = "opening region";
  const openingResult = await edge(players[creatorSeat], {
    operation: "action",
    roomId: created.room_id,
    action: action(initializedA.data.room.version, "CREATE_REGION", {
      sourceMacros: openingMacros(initialPublicState),
    }),
  });
  check("opening region created", openingResult.ok
    && openingResult.data?.room?.version === initializedA.data.room.version + 1
    && openingResult.data?.room?.publicState?.phase === "COLOR"
    && openingResult.data?.room?.publicState?.active === colorerSeat, openingResult);

  activeStage = "opening color";
  const colorerProjection = await edge(players[colorerSeat], { operation: "initialize", roomId: created.room_id });
  const paint = colorerProjection.data?.room?.privateState?.basicPalette?.[0];
  check("colorer private palette projected", colorerProjection.ok && typeof paint === "string", colorerProjection);
  const colorResult = await edge(players[colorerSeat], {
    operation: "action",
    roomId: created.room_id,
    action: action(openingResult.data.room.version, "COLOR_REGION", { color: paint }),
  });
  check("opening region colored", colorResult.ok
    && colorResult.data?.room?.publicState?.phase === "WORK"
    && colorResult.data?.room?.publicState?.active === colorerSeat
    && colorResult.data?.room?.privateState?.hand?.legalRecolor === 1, colorResult);
  const colorBefore = colorResult.data.room.publicState.regions?.R1?.color;
  check("colored target available", typeof colorBefore === "string");

  activeStage = "legal recolor";
  const recolorResult = await edge(players[colorerSeat], {
    operation: "action",
    roomId: created.room_id,
    action: action(colorResult.data.room.version, "USE_SKILL", { skill: "legalRecolor", regionId: "R1" }),
  });
  const recolored = recolorResult.data?.room?.publicState;
  const trace = recolored?.lastPublicTrace;
  check("legal recolor resolved", recolorResult.ok
    && recolorResult.data?.room?.version === colorResult.data.room.version + 1
    && recolored?.phase === "WORK"
    && recolored?.active === creatorSeat
    && recolorResult.data?.room?.privateState?.hand?.legalRecolor === 0, recolorResult);
  check("server chose a different legal color", typeof recolored?.regions?.R1?.color === "string"
    && recolored.regions.R1.color !== colorBefore);
  check("minimal public recolor trace", trace?.type === "LEGAL_RECOLOR"
    && trace.actor === colorerSeat
    && trace.regionId === "R1"
    && trace.color === recolored.regions.R1.color
    && !JSON.stringify(trace).includes("legalRecolor"));

  activeStage = "terminal cleanup";
  const finishedResult = await edge(players[creatorSeat], {
    operation: "action",
    roomId: created.room_id,
    action: action(recolorResult.data.room.version, "SURRENDER"),
  });
  check("LAB room finished", finishedResult.ok
    && finishedResult.data?.room?.status === "finished"
    && finishedResult.data?.room?.publicState?.status === "FINISHED"
    && finishedResult.data?.room?.publicState?.terminalReason === "SURRENDER", finishedResult);

  activeStage = "progression isolation";
  const [profileAAfter, profileBAfter] = await Promise.all([
    edge(playerA, { operation: "profile", expectedRevision: 0, displayName: CANARY_NAMES.A, profileState: {} }),
    edge(playerB, { operation: "profile", expectedRevision: 0, displayName: CANARY_NAMES.B, profileState: {} }),
  ]);
  check("LAB profile A unchanged", profileAAfter.ok
    && Number(profileAAfter.data?.revision) === Number(profileAResult.data.revision)
    && sameJson(profileAAfter.data?.profileState, initialProfiles.A), profileAAfter);
  check("LAB profile B unchanged", profileBAfter.ok
    && Number(profileBAfter.data?.revision) === Number(profileBResult.data.revision)
    && sameJson(profileBAfter.data?.profileState, initialProfiles.B), profileBAfter);

  for (const name of checks) console.log(`PASS  ${name}`);
  console.log(`SUMMARY ${checks.length}/${checks.length} legal-recolor LAB live checks passed`);
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
