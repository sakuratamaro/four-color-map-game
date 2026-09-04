import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live Runbook C canary users/rooms without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("FAIL  Runbook C canary exceeded its 180-second safety timeout.");
  process.exit(1);
}, 180_000);

const configSource = fs.readFileSync(path.join(root, "online", "supabase-config.js"), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) {
  console.error("FAIL  Public Supabase configuration is incomplete.");
  process.exit(1);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOADOUT = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});
const LABELS = Object.freeze([
  "A", "B", "C", "D", "E", "F", "G",
  "H", "I", "J", "K", "L", "M", "N", "O", "P",
]);

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
  activeStage = "anonymous sessions";
  const result = await request("/auth/v1/signup", {
    authorization: `Bearer ${publishableKey}`,
    body: {},
  });
  check(`anonymous ${label}`, result.ok
    && UUID_PATTERN.test(String(result.data?.user?.id))
    && typeof result.data?.access_token === "string", result);
  return { token: result.data.access_token, name: `RunbookC-${label}` };
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

function publicPayload(label, result) {
  const row = firstRow(result.data);
  check(`${label} response`, result.ok && row && typeof row === "object", result);
  const serialized = JSON.stringify(row);
  for (const forbidden of ["room_code", "roomCode", "code_hash", "codeHash"]) {
    check(`${label} hides ${forbidden}`, !serialized.includes(forbidden));
  }
  return row;
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

async function recruit(session) {
  const ticketId = crypto.randomUUID();
  const result = await rpc(session, "fcg_standard_matchmaking_recruit", {
    p_ticket_id: ticketId,
    p_display_name: session.name,
  });
  const row = publicPayload("recruit", result);
  check("recruit ticket accepted", row.ticket_id === ticketId
    && ["searching", "matched"].includes(row.matchmaking_status)
    && (row.room_id === null || UUID_PATTERN.test(String(row.room_id))), result);
  return row;
}

async function find(session) {
  const result = await rpc(session, "fcg_standard_matchmaking_find", {
    p_action_id: crypto.randomUUID(),
    p_display_name: session.name,
  });
  const row = publicPayload("find", result);
  check("find status valid", ["matched", "none_available"].includes(row.matchmaking_status), result);
  check("find shape valid", row.matchmaking_status === "matched"
    ? UUID_PATTERN.test(String(row.room_id)) && row.seat === "B"
    : row.room_id === null && row.seat === null, result);
  return row;
}

async function status(session, ticketId) {
  const result = await rpc(session, "fcg_standard_matchmaking_status", { p_ticket_id: ticketId });
  return publicPayload("status", result);
}

async function completePublicMatch(playerA, playerB, roomId) {
  activeStage = "public match setup";
  const [setupA, setupB] = await Promise.all([
    edge(playerA, {
      operation: "setup", roomId, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT,
    }),
    edge(playerB, {
      operation: "setup", roomId, expectedSetupRevision: 0,
      setupActionId: crypto.randomUUID(), loadout: LOADOUT,
    }),
  ]);
  check("public setup A", setupA.ok && Number(setupA.data?.setupRevision) === 1, setupA);
  check("public setup B", setupB.ok && Number(setupB.data?.setupRevision) === 1, setupB);

  activeStage = "public match initialization";
  const initializedA = await edge(playerA, { operation: "initialize", roomId });
  check("public match initialized", initializedA.ok
    && initializedA.data?.room?.status === "playing"
    && initializedA.data?.room?.publicState?.status === "ACTIVE", initializedA);
  const initializedB = await edge(playerB, { operation: "initialize", roomId });
  check("public player B projection", initializedB.ok
    && initializedB.data?.room?.seat === "B"
    && initializedB.data?.room?.version === initializedA.data?.room?.version, initializedB);
  publicPayload("public initialization", initializedA);

  const initialState = initializedA.data.room.publicState;
  const activePlayer = initialState.active === "A" ? playerA : playerB;
  check("public active seat projected", initialState.active === "A" || initialState.active === "B");

  activeStage = "public match opening";
  const opening = await edge(activePlayer, {
    operation: "action",
    roomId,
    action: action(initializedA.data.room.version, "CREATE_REGION", {
      sourceMacros: openingMacros(initialState),
    }),
  });
  check("public opening action", opening.ok
    && opening.data?.room?.publicState?.phase === "COLOR"
    && opening.data?.room?.version === initializedA.data.room.version + 1, opening);

  activeStage = "public match finish";
  const postOpening = opening.data.room.publicState;
  const surrenderingPlayer = postOpening.active === "A" ? playerA : playerB;
  const finished = await edge(surrenderingPlayer, {
    operation: "action",
    roomId,
    action: action(opening.data.room.version, "SURRENDER"),
  });
  check("public match finished", finished.ok
    && finished.data?.room?.status === "finished"
    && finished.data?.room?.publicState?.status === "FINISHED"
    && finished.data?.room?.publicState?.terminalReason === "SURRENDER", finished);

  activeStage = "public finished reload snapshots";
  const [snapshotAResult, snapshotBResult] = await Promise.all([
    rpc(playerA, "fcg_standard_room_snapshot_v2", { p_room_id: roomId, p_known_profile_revision: null }),
    rpc(playerB, "fcg_standard_room_snapshot_v2", { p_room_id: roomId, p_known_profile_revision: null }),
  ]);
  const snapshotA = publicPayload("finished reload snapshot A", snapshotAResult);
  const snapshotB = publicPayload("finished reload snapshot B", snapshotBResult);
  check("public reload snapshots agree", snapshotA.room?.status === "finished"
    && snapshotB.room?.status === "finished"
    && snapshotA.room?.access_mode === "public_queue"
    && snapshotB.room?.access_mode === "public_queue"
    && snapshotA.snapshot_version === snapshotB.snapshot_version);
}

async function run() {
  const sessions = Object.fromEntries(await Promise.all(
    LABELS.map(async (label) => [label, await anonymous(label)]),
  ));

  activeStage = "profiles";
  const profileResults = [];
  for (const label of LABELS) {
    profileResults.push(await edge(sessions[label], {
      operation: "profile",
      expectedRevision: 0,
      displayName: sessions[label].name,
      profileState: {},
    }));
  }
  profileResults.forEach((result, index) => {
    check(`profile ${LABELS[index]}`, result.ok && Number(result.data?.revision) === 1, result);
  });

  activeStage = "initial public matchmaking";
  const initialTicket = await recruit(sessions.A);
  check("initial recruit searching", initialTicket.matchmaking_status === "searching");
  const initialFind = await find(sessions.B);
  check("initial public match found", initialFind.matchmaking_status === "matched");
  const initialRecruiterStatus = await status(sessions.A, initialTicket.ticket_id);
  check("initial recruiter matched once", initialRecruiterStatus.matchmaking_status === "matched"
    && initialRecruiterStatus.room_id === initialFind.room_id
    && initialRecruiterStatus.seat === "A");
  await completePublicMatch(sessions.A, sessions.B, initialFind.room_id);

  activeStage = "two simultaneous finders";
  const doubleTicket = await recruit(sessions.C);
  check("double-finder recruit searching", doubleTicket.matchmaking_status === "searching");
  const doubleResults = await Promise.all([find(sessions.D), find(sessions.E)]);
  const doubleMatches = doubleResults.filter((row) => row.matchmaking_status === "matched");
  const doubleMisses = doubleResults.filter((row) => row.matchmaking_status === "none_available");
  check("two finders create one match", doubleMatches.length === 1 && doubleMisses.length === 1);
  const doubleStatus = await status(sessions.C, doubleTicket.ticket_id);
  check("double-finder recruiter has one room", doubleStatus.matchmaking_status === "matched"
    && doubleStatus.room_id === doubleMatches[0].room_id);

  activeStage = "cancel versus find race";
  const raceTicket = await recruit(sessions.F);
  check("race recruit searching", raceTicket.matchmaking_status === "searching");
  const [cancelResult, raceFind] = await Promise.all([
    rpc(sessions.F, "fcg_standard_matchmaking_cancel", { p_ticket_id: raceTicket.ticket_id }),
    find(sessions.G),
  ]);
  const cancelled = publicPayload("cancel", cancelResult);
  const cancelWon = cancelled.matchmaking_status === "cancelled"
    && cancelled.room_id === null
    && raceFind.matchmaking_status === "none_available";
  const findWon = cancelled.matchmaking_status === "matched"
    && raceFind.matchmaking_status === "matched"
    && cancelled.room_id === raceFind.room_id;
  check("cancel-find race has one valid outcome", cancelWon || findWon);

  activeStage = "post-finish recruit";
  const newTicket = await recruit(sessions.A);
  check("finished player can recruit again", newTicket.matchmaking_status === "searching");

  activeStage = "ten simultaneous claims";
  const claimantLabels = ["B", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
  const bulkResults = await Promise.all(claimantLabels.map((label) => find(sessions[label])));
  const bulkMatches = bulkResults.filter((row) => row.matchmaking_status === "matched");
  const bulkMisses = bulkResults.filter((row) => row.matchmaking_status === "none_available");
  check("ten claims create one match", bulkMatches.length === 1 && bulkMisses.length === 9);
  check("new match is not prior match", bulkMatches[0].room_id !== initialFind.room_id);
  const newStatus = await status(sessions.A, newTicket.ticket_id);
  check("new recruiter has exactly one room", newStatus.matchmaking_status === "matched"
    && newStatus.room_id === bulkMatches[0].room_id
    && newStatus.seat === "A");

  for (const name of checks) console.log(`PASS  ${name}`);
  console.log(`SUMMARY ${checks.length}/${checks.length} Runbook C live checks passed`);
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
