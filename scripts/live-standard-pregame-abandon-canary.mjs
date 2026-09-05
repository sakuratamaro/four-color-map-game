import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live pregame-abandon canary rooms without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("FAIL  Pregame-abandon canary exceeded its 90-second safety timeout.");
  process.exit(1);
}, 90_000);

const configSource = await readFile(new URL("../online/supabase-config.js", import.meta.url), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[0-9A-F]{6}$/;
const LOADOUT = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});
const checks = [];
const anonymousActors = [];
const trackedRooms = [];
const ACTIVE_ROOM_STATUSES = new Set(["waiting", "ready", "playing"]);
const TERMINAL_ROOM_STATUSES = new Set(["abandoned", "finished"]);

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

async function request(path, { token, body, method = "POST", authorization } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publishableKey,
      ...(authorization !== undefined
        ? { authorization }
        : token
          ? { authorization: `Bearer ${token}` }
          : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}

function firstRow(value) { return Array.isArray(value) ? value[0] : value; }
async function rpc(session, name, body) { return request(`/rest/v1/rpc/${name}`, { token: session.token, body }); }
async function edge(session, body) { return request("/functions/v1/standard-game-action", { token: session.token, body }); }

async function anonymous(label) {
  const result = await request("/auth/v1/signup", { authorization: `Bearer ${publishableKey}`, body: {} });
  check(`anonymous ${label}`, result.ok && UUID_PATTERN.test(String(result.data?.user?.id))
    && typeof result.data?.access_token === "string", result);
  const session = { token: result.data.access_token, userId: result.data.user.id, label, profileCreated: false };
  anonymousActors.push(session);
  return session;
}

async function createProfile(session, displayName) {
  const result = await edge(session, { operation: "profile", expectedRevision: 0, displayName, profileState: {} });
  check(`profile ${displayName}`, result.ok && Number(result.data?.revision) === 1, result);
  session.profileCreated = true;
}

async function readProfile(session) {
  const path = `/rest/v1/fcg_standard_profiles?select=revision%2Cprofile_state&user_id=eq.${session.userId}`;
  const result = await request(path, { token: session.token, method: "GET" });
  const row = firstRow(result.data);
  check("profile read", result.ok && Number.isSafeInteger(Number(row?.revision)) && row?.profile_state, result);
  return row;
}

async function createRoom(session, displayName, label) {
  const result = await rpc(session, "fcg_standard_create_room", { p_display_name: displayName });
  const row = firstRow(result.data);
  let tracker = null;
  if (UUID_PATTERN.test(String(row?.room_id))) {
    tracker = {
      label,
      roomId: row.room_id,
      sessionsBySeat: { A: session },
      cleanupAbandonActions: new Map(),
      cleanupSurrenderActions: new Map(),
    };
    trackedRooms.push(tracker);
  }
  check("room created", result.ok && UUID_PATTERN.test(String(row?.room_id))
    && ROOM_CODE_PATTERN.test(String(row?.room_code)) && row?.room_status === "waiting", result);
  return { ...row, tracker };
}

async function joinRoom(session, roomCode, displayName, tracker) {
  const result = await rpc(session, "fcg_standard_join_room", { p_room_code: roomCode, p_display_name: displayName });
  if (result.ok && tracker) tracker.sessionsBySeat.B = session;
  check("room joined", result.ok && firstRow(result.data)?.room_status === "ready", result);
  return firstRow(result.data);
}

async function abandon(session, roomId, expectedVersion, actionId = randomUUID()) {
  return rpc(session, "fcg_standard_abandon_room", {
    p_room_id: roomId,
    p_expected_version: expectedVersion,
    p_action_id: actionId,
  });
}

async function snapshot(session, roomId) {
  const result = await rpc(session, "fcg_standard_room_snapshot_v2", {
    p_room_id: roomId,
    p_known_profile_revision: null,
  });
  check("member snapshot", result.ok, result);
  return firstRow(result.data);
}

async function rawSnapshot(session, roomId) {
  const result = await rpc(session, "fcg_standard_room_snapshot_v2", {
    p_room_id: roomId,
    p_known_profile_revision: null,
  });
  return { result, snapshot: result.ok ? firstRow(result.data) : null };
}

function cleanupAction(map, version) {
  if (!map.has(version)) map.set(version, randomUUID());
  return map.get(version);
}

async function bestEffortTerminalizeRoom(tracker) {
  const fallbackSession = tracker.sessionsBySeat.A || tracker.sessionsBySeat.B;
  const errors = [];
  let latest = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const read = await rawSnapshot(fallbackSession, tracker.roomId);
      if (!read.result.ok || !read.snapshot?.room) {
        errors.push(`snapshot:${read.result.status}:${safeCode(read.result)}`);
        continue;
      }
      latest = read.snapshot;
      const status = latest.room.status;
      const version = Number(latest.room.version);
      if (!ACTIVE_ROOM_STATUSES.has(status)) break;
      if (!Number.isSafeInteger(version) || version < 0) {
        errors.push("snapshot:invalid-version");
        break;
      }
      if (status === "waiting" || status === "ready") {
        const actionId = cleanupAction(tracker.cleanupAbandonActions, version);
        const result = await abandon(fallbackSession, tracker.roomId, version, actionId);
        if (!result.ok) errors.push(`abandon:${result.status}:${safeCode(result)}`);
      } else {
        const activeSeat = latest.room.public_state?.active;
        const activeSession = tracker.sessionsBySeat[activeSeat];
        if (!activeSession) {
          errors.push(`surrender:missing-active-seat:${String(activeSeat || "unknown")}`);
          break;
        }
        const actionId = cleanupAction(tracker.cleanupSurrenderActions, version);
        const result = await edge(activeSession, {
          operation: "action",
          roomId: tracker.roomId,
          action: { id: actionId, expectedVersion: version, type: "SURRENDER", payload: {} },
        });
        if (!result.ok) errors.push(`surrender:${result.status}:${safeCode(result)}`);
      }
    } catch (error) {
      errors.push(`transport:${String(error?.name || "Error")}`);
    }
  }

  let finalConfirmed = false;
  try {
    const finalRead = await rawSnapshot(fallbackSession, tracker.roomId);
    if (finalRead.result.ok && finalRead.snapshot?.room) {
      latest = finalRead.snapshot;
      finalConfirmed = true;
    }
    else errors.push(`final-snapshot:${finalRead.result.status}:${safeCode(finalRead.result)}`);
  } catch (error) {
    errors.push(`final-snapshot-transport:${String(error?.name || "Error")}`);
  }
  return {
    label: tracker.label,
    roomId: tracker.roomId,
    status: finalConfirmed ? latest.room.status : "unknown",
    expiresAt: latest?.room?.expires_at || null,
    errors,
  };
}

async function runCanary() {
const [playerA, playerB, outsider] = await Promise.all([
  anonymous("A"), anonymous("B"), anonymous("outsider"),
]);
await Promise.all([
  createProfile(playerA, "AbandonCanary-A"),
  createProfile(playerB, "AbandonCanary-B"),
  createProfile(outsider, "AbandonCanary-X"),
]);
const profilesBefore = await Promise.all([readProfile(playerA), readProfile(playerB)]);

const waitingRoom = await createRoom(playerA, "AbandonCanary-A", "waiting-abandon");
const waitingActionId = randomUUID();
const waitingApplied = await abandon(playerA, waitingRoom.room_id, 0, waitingActionId);
const waitingRow = firstRow(waitingApplied.data);
check("waiting room abandoned", waitingApplied.ok && waitingRow?.room_status === "abandoned"
  && waitingRow?.room_version === 1 && waitingRow?.abandon_result === "applied" && waitingRow?.duplicate === false, waitingApplied);
const waitingReplay = await abandon(playerA, waitingRoom.room_id, 0, waitingActionId);
const waitingReplayRow = firstRow(waitingReplay.data);
check("waiting abandon replay", waitingReplay.ok && waitingReplayRow?.room_version === 1
  && waitingReplayRow?.abandon_result === "applied" && waitingReplayRow?.duplicate === true, waitingReplay);
const waitingSnapshot = await snapshot(playerA, waitingRoom.room_id);
check("waiting history retained", waitingSnapshot?.room?.status === "abandoned" && waitingSnapshot?.members?.length === 1);
const staleJoin = await rpc(playerB, "fcg_standard_join_room", {
  p_room_code: waitingRoom.room_code,
  p_display_name: "AbandonCanary-B",
});
check("abandoned invite rejected", !staleJoin.ok, staleJoin);

const readyRoom = await createRoom(playerA, "AbandonCanary-A", "ready-guest-abandon");
await joinRoom(playerB, readyRoom.room_code, "AbandonCanary-B", readyRoom.tracker);
const outsiderAttempt = await abandon(outsider, readyRoom.room_id, 0);
check("outsider abandon rejected", !outsiderAttempt.ok && [403, 404].includes(outsiderAttempt.status), outsiderAttempt);
const readyApplied = await abandon(playerB, readyRoom.room_id, 0);
const readyRow = firstRow(readyApplied.data);
check("guest can abandon ready room", readyApplied.ok && readyRow?.room_status === "abandoned"
  && readyRow?.room_version === 1 && readyRow?.abandon_result === "applied", readyApplied);
const hostNoOpAction = randomUUID();
const hostNoOp = await abandon(playerA, readyRoom.room_id, 0, hostNoOpAction);
const hostNoOpRow = firstRow(hostNoOp.data);
check("other member converges", hostNoOp.ok && hostNoOpRow?.room_version === 1
  && hostNoOpRow?.abandon_result === "already_abandoned" && hostNoOpRow?.duplicate === false, hostNoOp);
const hostNoOpReplay = await abandon(playerA, readyRoom.room_id, 0, hostNoOpAction);
check("other member replay", hostNoOpReplay.ok && firstRow(hostNoOpReplay.data)?.duplicate === true, hostNoOpReplay);
const [readySnapshotA, readySnapshotB] = await Promise.all([
  snapshot(playerA, readyRoom.room_id), snapshot(playerB, readyRoom.room_id),
]);
check("both members observe abandoned", readySnapshotA?.room?.status === "abandoned"
  && readySnapshotB?.room?.status === "abandoned"
  && readySnapshotA?.members?.length === 2 && readySnapshotB?.members?.length === 2);
const profilesAfterPregameAbandon = await Promise.all([readProfile(playerA), readProfile(playerB)]);
check("pregame abandon leaves profiles unchanged",
  JSON.stringify(profilesAfterPregameAbandon) === JSON.stringify(profilesBefore));

const playingRoom = await createRoom(playerA, "AbandonCanary-A", "playing-surrender");
await joinRoom(playerB, playingRoom.room_code, "AbandonCanary-B", playingRoom.tracker);
const [setupA, setupB] = await Promise.all([
  edge(playerA, { operation: "setup", roomId: playingRoom.room_id, expectedSetupRevision: 0, setupActionId: randomUUID(), loadout: LOADOUT }),
  edge(playerB, { operation: "setup", roomId: playingRoom.room_id, expectedSetupRevision: 0, setupActionId: randomUUID(), loadout: LOADOUT }),
]);
check("playing setup A", setupA.ok && Number(setupA.data?.setupRevision) === 1, setupA);
check("playing setup B", setupB.ok && Number(setupB.data?.setupRevision) === 1, setupB);
const initialized = await edge(playerA, { operation: "initialize", roomId: playingRoom.room_id });
check("room reached playing", initialized.ok && initialized.data?.room?.status === "playing", initialized);
const playingVersion = initialized.data.room.version;
const forbidden = await abandon(playerA, playingRoom.room_id, playingVersion);
check("playing abandon rejected", !forbidden.ok && safeCode(forbidden) === "55000", forbidden);
const activeSession = initialized.data.room.publicState.active === "A" ? playerA : playerB;
const surrendered = await edge(activeSession, {
  operation: "action",
  roomId: playingRoom.room_id,
  action: { id: randomUUID(), expectedVersion: playingVersion, type: "SURRENDER", payload: {} },
});
check("playing room uses surrender", surrendered.ok && surrendered.data?.room?.status === "finished"
  && surrendered.data?.room?.publicState?.terminalReason === "SURRENDER", surrendered);

for (const name of checks) console.log(`PASS  ${name}`);
console.log(`SUMMARY ${checks.length}/${checks.length} pregame-abandon checks passed`);
}

let mainError = null;
try {
  await runCanary();
} catch (error) {
  mainError = error;
} finally {
  const roomReports = await Promise.all(trackedRooms.map(bestEffortTerminalizeRoom));
  const activeResidue = roomReports.filter((room) => ACTIVE_ROOM_STATUSES.has(room.status));
  const unknownResidue = roomReports.filter((room) => room.status === "unknown");
  const nonTerminalResidue = roomReports.filter((room) => !TERMINAL_ROOM_STATUSES.has(room.status));
  const cleanupErrors = roomReports.flatMap((room) => room.errors.map((error) => `${room.roomId}:${error}`));
  console.log(`RESIDUE ${JSON.stringify({
    activeRoomCount: activeResidue.length,
    unknownRoomCount: unknownResidue.length,
    nonTerminalRoomCount: nonTerminalResidue.length,
    terminalRooms: roomReports.map(({ label, roomId, status, expiresAt }) => ({ label, roomId, status, expiresAt })),
    anonymousProfiles: anonymousActors.map(({ label, profileCreated }) => ({
      label,
      status: profileCreated ? "retained" : "not-confirmed",
    })),
    cleanupErrors,
  })}`);
  if (nonTerminalResidue.length) {
    const residueError = new Error(`ACTIVE_CANARY_RESIDUE_${activeResidue.length}_UNKNOWN_${unknownResidue.length}_NONTERMINAL_${nonTerminalResidue.length}`);
    mainError = mainError
      ? new AggregateError([mainError, residueError], "PREGAME_ABANDON_CANARY_FAILED_WITH_RESIDUE")
      : residueError;
  }
  clearTimeout(hardTimeout);
}

if (mainError) throw mainError;
