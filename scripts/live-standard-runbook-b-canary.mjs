import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live Runbook B canary users/rooms without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("FAIL  Runbook B canary exceeded its 180-second safety timeout.");
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
const ROOM_CODE_PATTERN = /^[0-9A-F]{6}$/;
const CANARY_NAMES = Object.freeze({ A: "RunbookB-Canary-A", B: "RunbookB-Canary-B" });
const LOADOUT = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});
const SALE_LOCK_SKILL = "areaMicroBloom";
const PAID_COSMETIC = "nameplateGold";
const FREE_COSMETIC = "nameplateDefault";

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

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inventoryTotal(profile) {
  return Object.values(profile?.inventory || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function forbiddenQuizKey(value) {
  if (Array.isArray(value)) return value.some(forbiddenQuizKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    ["answer", "answerid", "answerids", "correct", "correctid", "iscorrect"].includes(key.toLowerCase())
      || forbiddenQuizKey(child));
}

function numericParts(value) {
  return String(value ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
}

function solveQuestion(question) {
  const values = numericParts(question?.math?.value);
  let answer;
  if (question.templateId === "add") answer = values[0] + values[1];
  else if (question.templateId === "subtract") answer = values[0] - values[1];
  else if (question.templateId === "multiply") answer = values[0] * values[1];
  else if (question.templateId === "divide") answer = Number(question.math?.numerator) / Number(question.math?.denominator);
  else if (question.templateId === "missing") answer = values[1] - values[0];
  else if (question.templateId === "rectangle-area") answer = values[0] * values[1];
  else if (question.templateId === "rectangle-perimeter") answer = 2 * (values[0] + values[1]);
  else if (question.templateId === "cube-volume") answer = Number(question.math?.base) ** Number(question.math?.exponent);
  else throw new CanaryFailure("quiz public-math solver", "UNSUPPORTED_TEMPLATE");
  const option = question.options?.find((candidate) => Number(candidate?.label) === answer);
  if (!option || typeof option.id !== "string") throw new CanaryFailure("quiz public-math solver", "ANSWER_NOT_DERIVABLE");
  return option.id;
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

async function readProfile(session, displayName) {
  const result = await edge(session, { operation: "profile", expectedRevision: 0, displayName, profileState: {} });
  check(`profile restore ${displayName.at(-1)}`, result.ok
    && Number.isSafeInteger(Number(result.data?.revision))
    && result.data?.profileState && typeof result.data.profileState === "object", result);
  return { revision: Number(result.data.revision), profile: result.data.profileState };
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function action(expectedVersion, type, payload = {}) {
  return { id: crypto.randomUUID(), expectedVersion, type, payload };
}

async function runQuizRound(player, current, round, verifyReplay) {
  activeStage = `quiz ${round}`;
  const startActionId = crypto.randomUUID();
  const startedAt = Date.now();
  const startBody = { operation: "quiz-start", actionId: startActionId, selectedLevel: 1 };
  const started = await edge(player, startBody);
  check(`quiz ${round} starts`, started.ok && started.data?.duplicate === false
    && UUID_PATTERN.test(String(started.data?.sessionId))
    && Array.isArray(started.data?.questions) && started.data.questions.length === 10, started);
  if (verifyReplay) {
    const replayedStart = await edge(player, startBody);
    check(`quiz ${round} start replays`, replayedStart.ok && replayedStart.data?.duplicate === true
      && replayedStart.data?.sessionId === started.data.sessionId
      && same(replayedStart.data?.questions, started.data.questions), replayedStart);
  }
  check(`quiz ${round} answer key stays private`, !forbiddenQuizKey(started.data.questions));
  const answers = started.data.questions.map(solveQuestion);
  const remainingWait = Math.max(0, 5_200 - (Date.now() - startedAt));
  if (remainingWait > 0) await new Promise((resolve) => setTimeout(resolve, remainingWait));

  const finishBody = {
    operation: "quiz-finish",
    sessionId: started.data.sessionId,
    actionId: crypto.randomUUID(),
    answers,
  };
  const finished = await edge(player, finishBody);
  check(`quiz ${round} settles`, finished.ok && finished.data?.duplicate === false
    && finished.data?.correct === 10 && finished.data?.wrong === 0
    && finished.data?.reward?.ticketLevel === 1 && finished.data?.reward?.draws === 10, finished);
  if (verifyReplay) {
    const replayedFinish = await edge(player, finishBody);
    check(`quiz ${round} settlement replays`, replayedFinish.ok && replayedFinish.data?.duplicate === true
      && replayedFinish.data?.revision === finished.data?.revision
      && same(replayedFinish.data?.profileState, finished.data?.profileState)
      && same(replayedFinish.data?.reward, finished.data?.reward), replayedFinish);
  }
  const previousTickets = Number(current.profile.gachaTickets?.["1"] || 0);
  const nextRecord = finished.data.profileState?.quizRecords?.["1"];
  const previousAttempts = Number(current.profile.quizRecords?.["1"]?.attempts || 0);
  check(`quiz ${round} reward applies once`, Number(finished.data.revision) === current.revision + 1
    && Number(finished.data.profileState?.gachaTickets?.["1"] || 0) === previousTickets + 10
    && Number(nextRecord?.attempts) === previousAttempts + 1);
  return { revision: Number(finished.data.revision), profile: finished.data.profileState };
}

async function commitSale(player, current, { skillId, count, requireConfirmationCheck = false, verifyReplay = true }) {
  const quoted = await edge(player, { operation: "card-sale-quote", expectedRevision: current.revision, skillId, count });
  check("sale quote", quoted.ok && Number(quoted.data?.revision) === current.revision, quoted);
  const saleBody = {
    operation: "card-sale", expectedRevision: current.revision, actionId: crypto.randomUUID(), skillId, count,
    confirmed: quoted.data.quote?.requiresConfirmation === true,
  };
  if (requireConfirmationCheck) {
    const unconfirmedBody = { ...saleBody, confirmed: false };
    const rejected = await edge(player, unconfirmedBody);
    check("confirmation-required sale rejects before commit", rejected.status === 409
      && safeCode(rejected) === "SALE_CONFIRMATION_REQUIRED", rejected);
    const unchanged = await readProfile(player, CANARY_NAMES.A);
    check("rejected sale changes nothing", unchanged.revision === current.revision && same(unchanged.profile, current.profile));
  }
  const sold = await edge(player, saleBody);
  check("sale commits", sold.ok && sold.data?.duplicate === false, sold);
  if (verifyReplay) {
    const replayed = await edge(player, saleBody);
    check("sale replays", replayed.ok && replayed.data?.duplicate === true
      && replayed.data?.revision === sold.data?.revision
      && same(replayed.data?.profileState, sold.data?.profileState)
      && same(replayed.data?.quote, sold.data?.quote), replayed);
  }
  check("sale economy applies once", Number(sold.data.revision) === current.revision + 1
    && Number(sold.data.profileState?.inventory?.[skillId]) === Number(current.profile.inventory?.[skillId]) - count
    && Number(sold.data.profileState?.coins) === Number(current.profile.coins) + Number(sold.data.quote?.earnedCoins));
  return { revision: Number(sold.data.revision), profile: sold.data.profileState };
}

async function commitCosmetic(player, current, cosmeticId, { purchaseRequired, price }) {
  const quoted = await edge(player, { operation: "cosmetic-quote", cosmeticId });
  check(`cosmetic quote ${cosmeticId}`, quoted.ok
    && Number(quoted.data?.revision) === current.revision
    && quoted.data?.quote?.purchaseRequired === purchaseRequired
    && Number(quoted.data?.quote?.price) === price, quoted);
  const cosmeticBody = { operation: "cosmetic-action", expectedRevision: current.revision, actionId: crypto.randomUUID(), cosmeticId };
  const applied = await edge(player, cosmeticBody);
  const replayed = await edge(player, cosmeticBody);
  check(`cosmetic ${cosmeticId} commits`, applied.ok && applied.data?.duplicate === false, applied);
  check(`cosmetic ${cosmeticId} replays`, replayed.ok && replayed.data?.duplicate === true
    && replayed.data?.revision === applied.data?.revision
    && same(replayed.data?.profileState, applied.data?.profileState)
    && same(replayed.data?.cosmetics, applied.data?.cosmetics), replayed);
  check(`cosmetic ${cosmeticId} applies once`, Number(applied.data.revision) === current.revision + 1
    && Number(applied.data.profileState?.coins) === Number(current.profile.coins) - price
    && applied.data.profileState?.equipped?.nameplate === cosmeticId);
  return { revision: Number(applied.data.revision), profile: applied.data.profileState, cosmetics: applied.data.cosmetics };
}

function assertSurrenderSettlement(label, before, after, won, matchId) {
  const history = after.profile.matchHistory || [];
  check(`${label} settlement revision once`, after.revision === before.revision + 1);
  check(`${label} history records match once`, history.length === before.profile.matchHistory.length + 1
    && history.filter((entry) => entry.matchId === matchId).length === 1
    && history[0]?.terminalReason === "SURRENDER"
    && history[0]?.result === (won ? "WIN" : "LOSS"));
  check(`${label} stats settle once`, Number(after.profile.stats?.wins) === Number(before.profile.stats?.wins) + (won ? 1 : 0)
    && Number(after.profile.stats?.losses) === Number(before.profile.stats?.losses) + (won ? 0 : 1));
  check(`${label} settlement ticket once`, Number(after.profile.gachaTickets?.["1"] || 0)
    === Number(before.profile.gachaTickets?.["1"] || 0) + 1);
  check(`${label} surrender trophy state is stable`, same(after.profile.trophies, before.profile.trophies)
    && same(after.profile.trophyDates, before.profile.trophyDates));
}

async function run() {
  activeStage = "anonymous sessions";
  const [playerA, playerB] = await Promise.all([anonymous("A"), anonymous("B")]);

  activeStage = "profiles";
  let profileA = await readProfile(playerA, CANARY_NAMES.A);
  let profileB = await readProfile(playerB, CANARY_NAMES.B);
  check("starter profiles", profileA.revision === 1 && profileB.revision === 1
    && Number(profileA.profile.gachaTickets?.["1"]) === 3);

  for (let round = 1; round <= 3; round += 1) profileA = await runQuizRound(playerA, profileA, round, round === 1);

  activeStage = "gacha";
  const gachaCount = Number(profileA.profile.gachaTickets?.["1"] || 0);
  const beforeGacha = profileA;
  const gachaBody = { operation: "gacha", expectedRevision: profileA.revision, actionId: crypto.randomUUID(), ticketLevel: 1, count: gachaCount };
  const gacha = await edge(playerA, gachaBody);
  const replayedGacha = await edge(playerA, gachaBody);
  check("gacha commits", gacha.ok && gacha.data?.duplicate === false && gacha.data?.draws?.length === gachaCount, gacha);
  check("gacha replays", replayedGacha.ok && replayedGacha.data?.duplicate === true
    && replayedGacha.data?.revision === gacha.data?.revision
    && same(replayedGacha.data?.draws, gacha.data?.draws)
    && same(replayedGacha.data?.profileState, gacha.data?.profileState), replayedGacha);
  check("gacha ticket and inventory apply once", Number(gacha.data.revision) === beforeGacha.revision + 1
    && Number(gacha.data.profileState?.gachaTickets?.["1"] || 0) === 0
    && inventoryTotal(gacha.data.profileState) === inventoryTotal(beforeGacha.profile) + gachaCount);
  profileA = { revision: Number(gacha.data.revision), profile: gacha.data.profileState };

  activeStage = "sale cancellation";
  const cancelQuote = await edge(playerA, {
    operation: "card-sale-quote", expectedRevision: profileA.revision, skillId: "disruptChoiceOne", count: 1,
  });
  check("sale cancellation quote succeeds", cancelQuote.ok, cancelQuote);
  const afterCancel = await readProfile(playerA, CANARY_NAMES.A);
  check("sale cancellation changes nothing", afterCancel.revision === profileA.revision && same(afterCancel.profile, profileA.profile));

  activeStage = "normal sale";
  profileA = await commitSale(playerA, profileA, { skillId: "colorChoiceBorrow", count: 1 });

  activeStage = "confirmed sales";
  let confirmationChecked = false;
  let salePasses = 0;
  while (Number(profileA.profile.coins) < 350 && salePasses < 64) {
    const candidate = Object.entries(profileA.profile.inventory)
      .find(([skillId, count]) => skillId !== SALE_LOCK_SKILL
        && profileA.profile.protectedSkills?.[skillId] !== true && Number(count) > 1);
    check("sale inventory can fund paid cosmetic", Boolean(candidate));
    const [skillId, owned] = candidate;
    profileA = await commitSale(playerA, profileA, {
      skillId, count: Number(owned) - 1, requireConfirmationCheck: !confirmationChecked,
      verifyReplay: !confirmationChecked,
    });
    confirmationChecked = true;
    salePasses += 1;
  }
  check("confirmation path covered", confirmationChecked);
  check("sales reach the paid cosmetic threshold", Number(profileA.profile.coins) >= 350);

  activeStage = "cosmetic cancellation";
  const paidQuote = await edge(playerA, { operation: "cosmetic-quote", cosmeticId: PAID_COSMETIC });
  check("paid cosmetic quote", paidQuote.ok && paidQuote.data?.quote?.purchaseRequired === true
    && Number(paidQuote.data?.quote?.price) === 350, paidQuote);
  const afterCosmeticCancel = await readProfile(playerA, CANARY_NAMES.A);
  check("cosmetic cancellation changes nothing", afterCosmeticCancel.revision === profileA.revision
    && same(afterCosmeticCancel.profile, profileA.profile));

  activeStage = "paid cosmetic";
  let cosmeticResult = await commitCosmetic(playerA, profileA, PAID_COSMETIC, { purchaseRequired: true, price: 350 });
  profileA = { revision: cosmeticResult.revision, profile: cosmeticResult.profile };
  check("paid cosmetic is owned once", profileA.profile.cosmeticsOwned.filter((id) => id === PAID_COSMETIC).length === 1);

  activeStage = "free cosmetic equipment";
  cosmeticResult = await commitCosmetic(playerA, profileA, FREE_COSMETIC, { purchaseRequired: false, price: 0 });
  profileA = { revision: cosmeticResult.revision, profile: cosmeticResult.profile };
  cosmeticResult = await commitCosmetic(playerA, profileA, PAID_COSMETIC, { purchaseRequired: false, price: 0 });
  profileA = { revision: cosmeticResult.revision, profile: cosmeticResult.profile };

  activeStage = "cold cosmetic restore";
  const restoredPlayerA = { token: playerA.token };
  const coldProfile = await readProfile(restoredPlayerA, CANARY_NAMES.A);
  const coldCatalog = await edge(restoredPlayerA, { operation: "cosmetic-catalog" });
  check("profile restores on a fresh client", coldProfile.revision === profileA.revision && same(coldProfile.profile, profileA.profile));
  check("cosmetic restores on a fresh client", coldCatalog.ok
    && coldCatalog.data?.revision === profileA.revision
    && coldCatalog.data?.cosmetics?.equipped?.nameplate === PAID_COSMETIC
    && Number(coldCatalog.data?.cosmetics?.coins) === Number(profileA.profile.coins), coldCatalog);

  activeStage = "room creation";
  const createdResult = await rpc(playerA, "fcg_standard_create_room", { p_display_name: CANARY_NAMES.A });
  const created = firstRow(createdResult.data);
  check("private room created", createdResult.ok && UUID_PATTERN.test(String(created?.room_id))
    && ROOM_CODE_PATTERN.test(String(created?.room_code)) && created?.seat === "A", createdResult);
  const joinedResult = await rpc(playerB, "fcg_standard_join_room", {
    p_room_code: created.room_code, p_display_name: CANARY_NAMES.B,
  });
  const joined = firstRow(joinedResult.data);
  check("player B joined", joinedResult.ok && joined?.room_id === created.room_id && joined?.seat === "B", joinedResult);

  activeStage = "room setup";
  const [setupA, setupB] = await Promise.all([
    edge(playerA, { operation: "setup", roomId: created.room_id, expectedSetupRevision: 0, setupActionId: crypto.randomUUID(), loadout: LOADOUT }),
    edge(playerB, { operation: "setup", roomId: created.room_id, expectedSetupRevision: 0, setupActionId: crypto.randomUUID(), loadout: LOADOUT }),
  ]);
  check("setup A", setupA.ok && Number(setupA.data?.setupRevision) === 1, setupA);
  check("setup B", setupB.ok && Number(setupB.data?.setupRevision) === 1, setupB);
  const initialized = await edge(playerA, { operation: "initialize", roomId: created.room_id });
  check("match initialized", initialized.ok && initialized.data?.room?.status === "playing", initialized);

  activeStage = "opponent appearance privacy";
  const snapshotBResult = await rpc(playerB, "fcg_standard_room_snapshot_v2", {
    p_room_id: created.room_id, p_known_profile_revision: null,
  });
  const snapshotB = firstRow(snapshotBResult.data);
  const opponentA = snapshotB?.members?.find((member) => member.seat === "A");
  const opponentText = JSON.stringify(opponentA || {});
  check("opponent appearance is allowlisted", snapshotBResult.ok
    && opponentA?.appearance?.nameplate === PAID_COSMETIC
    && same(Object.keys(opponentA?.appearance || {}).sort(), ["board", "effect", "nameplate", "title"]));
  for (const forbidden of ["profile_state", "inventory", "quizRecords", "gachaTickets", "coins", "stats", "trophies", "cosmeticsOwned"]) {
    check(`opponent member hides ${forbidden}`, !opponentText.includes(forbidden));
  }

  activeStage = "sale match lock";
  const lockedSale = await edge(playerA, {
    operation: "card-sale", expectedRevision: profileA.revision, actionId: crypto.randomUUID(),
    skillId: SALE_LOCK_SKILL, count: 1, confirmed: false,
  });
  check("sale is locked during a match", lockedSale.status === 409 && safeCode(lockedSale) === "CARD_SALE_MATCH_LOCKED", lockedSale);
  const afterLockedSale = await readProfile(playerA, CANARY_NAMES.A);
  check("locked sale changes nothing", afterLockedSale.revision === profileA.revision && same(afterLockedSale.profile, profileA.profile));

  activeStage = "surrender settlement";
  profileA = afterLockedSale;
  profileB = await readProfile(playerB, CANARY_NAMES.B);
  const publicState = initialized.data.room.publicState;
  const surrenderingSeat = publicState.active;
  check("active seat projected", surrenderingSeat === "A" || surrenderingSeat === "B");
  const surrenderingPlayer = surrenderingSeat === "A" ? playerA : playerB;
  const surrenderAction = action(initialized.data.room.version, "SURRENDER");
  const surrenderBody = { operation: "action", roomId: created.room_id, action: surrenderAction };
  const finished = await edge(surrenderingPlayer, surrenderBody);
  const replayedFinish = await edge(surrenderingPlayer, surrenderBody);
  check("surrender finishes match", finished.ok && finished.data?.duplicate === false
    && finished.data?.room?.status === "finished"
    && finished.data?.room?.publicState?.terminalReason === "SURRENDER", finished);
  check("surrender action replays", replayedFinish.ok && replayedFinish.data?.duplicate === true
    && replayedFinish.data?.room?.version === finished.data?.room?.version, replayedFinish);

  const [settledA, settledB] = await Promise.all([
    readProfile({ token: playerA.token }, CANARY_NAMES.A),
    readProfile({ token: playerB.token }, CANARY_NAMES.B),
  ]);
  const winnerSeat = surrenderingSeat === "A" ? "B" : "A";
  const matchId = finished.data.room.publicState.matchId;
  assertSurrenderSettlement("A", profileA, settledA, winnerSeat === "A", matchId);
  assertSurrenderSettlement("B", profileB, settledB, winnerSeat === "B", matchId);

  activeStage = "snapshot profile restore";
  const fullSnapshotResult = await rpc({ token: playerA.token }, "fcg_standard_room_snapshot_v2", {
    p_room_id: created.room_id, p_known_profile_revision: null,
  });
  const fullSnapshot = firstRow(fullSnapshotResult.data);
  check("finished snapshot restores own progression", fullSnapshotResult.ok
    && fullSnapshot?.profile?.revision === settledA.revision
    && same(fullSnapshot?.profile?.profile_state, settledA.profile), fullSnapshotResult);
  const deltaSnapshotResult = await rpc({ token: playerA.token }, "fcg_standard_room_snapshot_v2", {
    p_room_id: created.room_id, p_known_profile_revision: settledA.revision,
  });
  const deltaSnapshot = firstRow(deltaSnapshotResult.data);
  check("known profile revision omits duplicate body", deltaSnapshotResult.ok
    && deltaSnapshot?.profile_revision === settledA.revision && deltaSnapshot?.profile === null, deltaSnapshotResult);

  for (const name of checks) console.log(`PASS  ${name}`);
  console.log("NOT_COVERED  New fullPaint trophy unlock requires a complete-map win; transaction tests cover that boundary.");
  console.log(`SUMMARY ${checks.length}/${checks.length} Runbook B live checks passed`);
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
