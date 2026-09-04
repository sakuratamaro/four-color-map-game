import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live Runbook D CPU canary data without --confirm-live.");
  process.exit(2);
}

const CPU_FIRST_OFFER_MS = 90_000;
const CPU_SECOND_OFFER_MS = 180_000;
const CHECKPOINT_GRACE_MS = 1_000;
const REQUEST_TIMEOUT_MS = 20_000;
const HARD_TIMEOUT_MS = 600_000;
const hardTimeout = setTimeout(() => {
  console.error("FAIL  Runbook D CPU canary exceeded its finite safety timeout.");
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
const EXPECTED_CPU_NAMES = Object.freeze({
  yuzu: "うっかりユズ",
  ren: "せっかちレン",
  minato: "見習いミナト",
  koharu: "読み違いコハル",
  aoi: "慎重派アオイ",
  kai: "勝負師カイ",
  tsubasa: "仕掛け屋ツバサ",
  shion: "観察役シオン",
  rei: "カード博士レイ",
  kurogane: "四色のクロガネ",
});
const REPRESENTATIVE_CPU_IDS = Object.freeze(["yuzu", "shion", "kurogane"]);
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
  return { id: randomUUID(), expectedVersion, type, payload };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createProfile(session, displayName, label) {
  activeStage = `profile ${label}`;
  const result = await edge(session, {
    operation: "profile",
    expectedRevision: 0,
    displayName,
    profileState: {},
  });
  check(`profile ${label}`, result.ok
    && Number(result.data?.revision) === 1
    && result.data?.profileState
    && typeof result.data.profileState === "object", result);
  return result.data.profileState;
}

async function recruit(session, displayName, label) {
  activeStage = `recruit ${label}`;
  const ticketId = randomUUID();
  const result = await rpc(session, "fcg_standard_matchmaking_recruit", {
    p_ticket_id: ticketId,
    p_display_name: displayName,
  });
  const row = firstRow(result.data);
  check(`recruit ${label}`, result.ok
    && row?.ticket_id === ticketId
    && row?.matchmaking_status === "searching"
    && Number.isFinite(Date.parse(row?.wait_started_at))
    && Number.isFinite(Date.parse(row?.server_time)), result);
  return { session, ticketId, observedAt: performance.now(), label };
}

async function waitForTicketAge(ticket, minimumAgeMs) {
  const targetAgeMs = minimumAgeMs + CHECKPOINT_GRACE_MS;
  while (true) {
    const localAgeMs = performance.now() - ticket.observedAt;
    const waitMs = Math.min(45_000, Math.max(0, targetAgeMs - localAgeMs));
    if (waitMs > 0) await sleep(waitMs);
    activeStage = `wait checkpoint ${ticket.label}`;
    const result = await rpc(ticket.session, "fcg_standard_matchmaking_status", {
      p_ticket_id: ticket.ticketId,
    });
    const row = firstRow(result.data);
    check(`search remains explicit ${ticket.label}`, result.ok
      && row?.matchmaking_status === "searching"
      && Number.isFinite(Date.parse(row?.wait_started_at))
      && Number.isFinite(Date.parse(row?.server_time)), result);
    const serverAgeMs = Date.parse(row.server_time) - Date.parse(row.wait_started_at);
    if (serverAgeMs >= minimumAgeMs && performance.now() - ticket.observedAt >= minimumAgeMs) return row;
    await sleep(Math.max(CHECKPOINT_GRACE_MS, minimumAgeMs - serverAgeMs + CHECKPOINT_GRACE_MS));
  }
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

function cpuMember(snapshot) {
  return snapshot?.members?.find((member) => member?.is_cpu === true);
}

function checkCpuVisible(label, snapshot, characterId) {
  const member = cpuMember(snapshot);
  check(`CPU identity visible ${label}`, snapshot?.room?.opponent_kind === "cpu"
    && snapshot.room.cpu_character_id === characterId
    && member?.seat === "B"
    && member?.display_name === EXPECTED_CPU_NAMES[characterId]);
}

async function roomSnapshot(session, roomId, label) {
  const result = await rpc(session, "fcg_standard_room_snapshot_v2", {
    p_room_id: roomId,
    p_known_profile_revision: null,
  });
  check(`snapshot ${label}`, result.ok, result);
  return firstRow(result.data);
}

async function runRepresentativeMatch(entry, index) {
  const label = `representative ${index + 1}`;
  activeStage = `setup ${label}`;
  const setup = await edge(entry.session, {
    operation: "setup",
    roomId: entry.roomId,
    expectedSetupRevision: 0,
    setupActionId: randomUUID(),
    loadout: LOADOUT,
  });
  check(`setup ${label}`, setup.ok && Number(setup.data?.setupRevision) === 1, setup);

  activeStage = `initialize ${label}`;
  const initialized = await edge(entry.session, { operation: "initialize", roomId: entry.roomId });
  check(`initialized ${label}`, initialized.ok
    && initialized.data?.room?.status === "playing"
    && initialized.data?.room?.publicState?.status === "ACTIVE", initialized);
  let room = initialized.data.room;
  const firstMatchId = room.publicState.matchId;

  if (room.publicState.active === "A") {
    activeStage = `human opening ${label}`;
    const created = await edge(entry.session, {
      operation: "action",
      roomId: entry.roomId,
      action: action(room.version, "CREATE_REGION", { sourceMacros: openingMacros(room.publicState) }),
    });
    check(`human opening created ${label}`, created.ok
      && created.data?.room?.publicState?.phase === "COLOR", created);
    room = created.data.room;
  }

  activeStage = `CPU turn ${label}`;
  let cpuActionCount = 0;
  while (room.publicState?.status === "ACTIVE" && room.publicState.active === "B" && cpuActionCount < 12) {
    const beforeVersion = room.version;
    const result = await edge(entry.session, {
      operation: "cpu-action",
      roomId: entry.roomId,
      expectedVersion: beforeVersion,
    });
    check(`legal CPU action ${label}`, result.ok
      && result.data?.room?.version === beforeVersion + 1, result);
    room = result.data.room;
    cpuActionCount += 1;
  }
  check(`CPU yielded after legal play ${label}`, cpuActionCount > 0
    && cpuActionCount < 12
    && room.publicState?.status === "ACTIVE"
    && room.publicState.active === "A");

  activeStage = `recovery snapshot ${label}`;
  const recovered = await roomSnapshot(entry.session, entry.roomId, `${label} recovery`);
  check(`recovery resumed match ${label}`, recovered?.room?.status === "playing"
    && recovered?.room?.version === room.version
    && recovered?.view?.seat === "A"
    && recovered?.view?.version === room.version);
  checkCpuVisible(`${label} recovery`, recovered, entry.characterId);

  activeStage = `finish ${label}`;
  const finishedResult = await edge(entry.session, {
    operation: "action",
    roomId: entry.roomId,
    action: action(recovered.room.version, "SURRENDER"),
  });
  check(`finished ${label}`, finishedResult.ok
    && finishedResult.data?.room?.status === "finished"
    && finishedResult.data?.room?.publicState?.terminalReason === "SURRENDER"
    && finishedResult.data?.room?.publicState?.winner === "B", finishedResult);
  const finishedVersion = finishedResult.data.room.version;

  const finished = await roomSnapshot(entry.session, entry.roomId, `${label} finished`);
  checkCpuVisible(`${label} finished`, finished, entry.characterId);
  const profile = finished?.profile?.profile_state;
  const priorCpuLosses = Number(entry.initialProfile?.cpuStats?.losses || 0);
  const priorMatches = Number(entry.initialProfile?.cpuCharacterStats?.[entry.characterId]?.matches || 0);
  check(`CPU aggregate stats updated ${label}`, profile?.cpuStats?.losses === priorCpuLosses + 1);
  check(`CPU character stats updated ${label}`, profile?.cpuCharacterStats?.[entry.characterId]?.matches === priorMatches + 1
    && profile.cpuCharacterStats[entry.characterId].losses >= 1);
  check(`CPU history updated ${label}`, profile?.matchHistory?.[0]?.onlineOpponentKind === "cpu"
    && profile.matchHistory[0].cpuCharacterId === entry.characterId
    && profile.matchHistory[0].terminalReason === "SURRENDER");

  activeStage = `CPU rematch ${label}`;
  const rematch = await edge(entry.session, {
    operation: "cpu-rematch",
    roomId: entry.roomId,
    expectedVersion: finishedVersion,
    actionId: randomUUID(),
  });
  check(`same CPU rematch reset ${label}`, rematch.ok
    && rematch.data?.roomStatus === "ready"
    && rematch.data?.roomVersion === finishedVersion + 1
    && rematch.data?.readyToSetup === true, rematch);
  const ready = await roomSnapshot(entry.session, entry.roomId, `${label} rematch ready`);
  checkCpuVisible(`${label} rematch ready`, ready, entry.characterId);

  const rematchSetup = await edge(entry.session, {
    operation: "setup",
    roomId: entry.roomId,
    expectedSetupRevision: 0,
    setupActionId: randomUUID(),
    loadout: LOADOUT,
  });
  check(`rematch setup ${label}`, rematchSetup.ok
    && Number(rematchSetup.data?.setupRevision) === 1, rematchSetup);
  const rematchInitialized = await edge(entry.session, {
    operation: "initialize",
    roomId: entry.roomId,
  });
  check(`same CPU rematch established ${label}`, rematchInitialized.ok
    && rematchInitialized.data?.room?.status === "playing"
    && rematchInitialized.data?.room?.publicState?.matchId !== firstMatchId, rematchInitialized);
  const replayed = await roomSnapshot(entry.session, entry.roomId, `${label} rematch playing`);
  checkCpuVisible(`${label} rematch playing`, replayed, entry.characterId);
}

async function run() {
  activeStage = "anonymous sessions";
  const [raceHost, challenger, ...representatives] = await Promise.all([
    anonymous("race host"),
    anonymous("challenger"),
    anonymous("representative 1"),
    anonymous("representative 2"),
    anonymous("representative 3"),
  ]);

  activeStage = "profiles";
  const profileNames = [
    "RunbookD-Canary-Race",
    "RunbookD-Canary-H",
    "RunbookD-Canary-1",
    "RunbookD-Canary-2",
    "RunbookD-Canary-3",
  ];
  const profileStates = [];
  profileStates.push(await createProfile(raceHost, profileNames[0], "race host"));
  profileStates.push(await createProfile(challenger, profileNames[1], "challenger"));
  for (const [index, session] of representatives.entries()) {
    profileStates.push(await createProfile(session, profileNames[index + 2], `representative ${index + 1}`));
  }

  activeStage = "CPU roster";
  const rosterResult = await edge(representatives[0], { operation: "cpu-roster" });
  const roster = rosterResult.data?.characters;
  check("CPU roster version", rosterResult.ok
    && rosterResult.data?.rosterVersion === "standard-character-roster-v1", rosterResult);
  check("CPU roster has ten fixed identities", Array.isArray(roster)
    && roster.length === 10
    && new Set(roster.map((character) => character?.id)).size === 10
    && new Set(roster.map((character) => character?.name)).size === 10
    && roster.every((character) => EXPECTED_CPU_NAMES[character.id] === character.name));
  check("CPU roster exposes personality guidance", roster.every((character) =>
    typeof character.strength === "string" && character.strength.length > 0
    && typeof character.weakness === "string" && character.weakness.length > 0
    && Array.isArray(character.favorites) && character.favorites.length === 2));

  // The race ticket is recruited first so it is the sole remaining public candidate at 180 seconds.
  const raceTicket = await recruit(raceHost, profileNames[0], "race host");
  const representativeTickets = await Promise.all(representatives.map((session, index) =>
    recruit(session, profileNames[index + 2], `representative ${index + 1}`)));

  activeStage = "early CPU rejection";
  const early = await edge(representatives[0], {
    operation: "cpu-accept",
    ticketId: representativeTickets[0].ticketId,
    characterId: REPRESENTATIVE_CPU_IDS[0],
  });
  check("CPU consent rejected before real 90 seconds", !early.ok
    && early.status === 409
    && safeCode(early) === "CPU_CONSENT_TOO_EARLY", early);

  activeStage = "real 90-second checkpoint";
  await Promise.all([
    waitForTicketAge(raceTicket, CPU_FIRST_OFFER_MS),
    ...representativeTickets.map((ticket) => waitForTicketAge(ticket, CPU_FIRST_OFFER_MS)),
  ]);
  check("first CPU offer reached in real time", representativeTickets.every((ticket) =>
    performance.now() - ticket.observedAt >= CPU_FIRST_OFFER_MS));

  activeStage = "explicit representative consent";
  const acceptedResults = await Promise.all(representativeTickets.map((ticket, index) => edge(ticket.session, {
    operation: "cpu-accept",
    ticketId: ticket.ticketId,
    characterId: REPRESENTATIVE_CPU_IDS[index],
  })));
  const accepted = acceptedResults.map((result, index) => {
    check(`explicit CPU consent representative ${index + 1}`, result.ok
      && result.data?.matchmakingStatus === "matched"
      && UUID_PATTERN.test(String(result.data?.roomId))
      && result.data?.seat === "A"
      && result.data?.characterId === REPRESENTATIVE_CPU_IDS[index], result);
    return {
      session: representatives[index],
      roomId: result.data.roomId,
      characterId: REPRESENTATIVE_CPU_IDS[index],
      initialProfile: profileStates[index + 2],
    };
  });

  // Keep the declined first offer alive while the three representative matches complete.
  const secondOfferPromise = waitForTicketAge(raceTicket, CPU_SECOND_OFFER_MS);
  const [matchesOutcome, secondOfferOutcome] = await Promise.allSettled([
    Promise.all(accepted.map(runRepresentativeMatch)),
    secondOfferPromise,
  ]);
  if (matchesOutcome.status === "rejected") throw matchesOutcome.reason;
  if (secondOfferOutcome.status === "rejected") throw secondOfferOutcome.reason;
  const secondOffer = secondOfferOutcome.value;
  check("second CPU offer reached in real 180 seconds", secondOffer?.matchmaking_status === "searching"
    && performance.now() - raceTicket.observedAt >= CPU_SECOND_OFFER_MS);

  activeStage = "human versus CPU resolution race";
  const [cpuRaceResult, humanRaceResult] = await Promise.all([
    edge(raceHost, {
      operation: "cpu-accept",
      ticketId: raceTicket.ticketId,
      characterId: REPRESENTATIVE_CPU_IDS[0],
    }),
    rpc(challenger, "fcg_standard_matchmaking_find", {
      p_action_id: randomUUID(),
      p_display_name: profileNames[1],
    }),
  ]);
  const humanRace = firstRow(humanRaceResult.data);
  const cpuWon = cpuRaceResult.ok && cpuRaceResult.data?.matchmakingStatus === "matched";
  const humanWon = humanRaceResult.ok && humanRace?.matchmaking_status === "matched";
  check("human and CPU race has exactly one winner", Number(cpuWon) + Number(humanWon) === 1);
  check("resolved ticket cannot create a second room", cpuWon
    ? !humanWon && (!humanRaceResult.ok || humanRace?.matchmaking_status === "none_available")
    : humanWon && !cpuWon);

  const winningRoomId = cpuWon ? cpuRaceResult.data.roomId : humanRace.room_id;
  const raceSnapshot = await roomSnapshot(raceHost, winningRoomId, "resolution race");
  check("resolution race projection matches winner", cpuWon
    ? raceSnapshot?.room?.opponent_kind === "cpu" && raceSnapshot.room.access_mode === "cpu"
    : raceSnapshot?.room?.opponent_kind === "human" && raceSnapshot.room.access_mode === "public_queue");

  for (const name of checks) console.log(`PASS  ${name}`);
  console.log(`SUMMARY ${checks.length}/${checks.length} Runbook D live checks passed`);
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
