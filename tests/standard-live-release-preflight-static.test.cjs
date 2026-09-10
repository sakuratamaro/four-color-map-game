"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-release-preflight.mjs"), "utf8");
const candidateApp = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");
const candidateHtml = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "index.html"), "utf8");
const candidateIntents = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "standard-online-skill-intents.js"), "utf8");
const candidateEdgeBundle = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "standard-game-action", "standard-engine.bundle.js"), "utf8");
const candidateLocalHtml = fs.readFileSync(path.join(__dirname, "..", "standard-v5", "index.html"), "utf8");
const candidateLocalBundle = fs.readFileSync(path.join(__dirname, "..", "standard-v5", "app.bundle.js"), "utf8");
const candidateProgressionCss = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "progression.css"), "utf8");
const contractsPromise = import(pathToFileURL(path.join(__dirname, "..", "scripts", "standard-release-preflight-contracts.mjs")).href);

test("release preflight is read-only, secret-free, finite, and stage-aware", () => {
  assert.match(source, /publishableKey/);
  assert.doesNotMatch(source, /serviceRole|service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /auth\/v1\/(?:signup|admin)|anonymous\(\)/);
  assert.doesNotMatch(source, /operation:\s*"(?:create_room|join_room|cpu-accept|quiz-start|gacha|cosmetic-action)"/);
  assert.match(source, /00000000-0000-0000-0000-000000000000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
  for (const phase of ["baseline", "db-ready", "candidate"]) assert.match(source, new RegExp(`"${phase}"`));
  assert.match(source, /fcg_standard_room_snapshot_v2/);
  assert.match(source, /fcg_standard_matchmaking_recruit/);
  assert.match(source, /fcg_standard_matchmaking_availability/);
  assert.match(source, /fcg_standard_abandon_room/);
  assert.match(source, /fcg_standard_active_room/);
  assert.match(source, /fcg_standard_server_load_room_v3/);
  assert.match(source, /p_setup_a_revision:\s*1/);
  assert.match(source, /p_setup_b_revision:\s*1/);
  assert.match(source, /hasPregameAbandon/);
  assert.match(source, /hasActiveRoomRecovery/);
  assert.match(source, /hasLegalRecolorLab/);
  assert.match(source, /hasWaitingOpponentNotice/);
  assert.match(source, /hasAlpha3SkillCategoryWindow/);
  assert.match(source, /hasAlpha4ColoredCornerBloom/);
  assert.match(source, /hasRegistryRarityUi/);
  assert.match(source, /hasCpuPortraits/);
  assert.match(source, /hasWholeButtonQuizPhysics/);
  assert.match(source, /hasBoardFirstCandidateGuidance/);
  assert.match(source, /hasPerCellContactFeedback/);
  assert.match(source, /hasApprovedGachaOddsUi/);
  assert.match(source, /hasApprovedEdgeGachaOdds/);
  assert.match(source, /hasDeferredCurseLocalBundle/);
  assert.match(source, /hasRegionSplitDirectTarget/);
  assert.match(source, /hasCompactCpuRecords/);
  assert.match(source, /hasQuizAccuracyRecords/);
  assert.match(source, /hasCpuSealTimingPolicy/);
  assert.match(source, /hasMatchRewardEconomy/);
  assert.match(source, /hasCandidateAssetGeneration/);
  assert.match(source, /baseline:\s*\{[^}]*matchmakingAvailabilityDb:\s*false[^}]*waitingOpponentUi:\s*false\s*\}/);
  assert.match(source, /"db-ready":\s*\{[^}]*matchmakingAvailabilityDb:\s*true[^}]*waitingOpponentUi:\s*false\s*\}/);
  assert.match(source, /candidate:\s*\{[^}]*matchmakingAvailabilityDb:\s*true[^}]*waitingOpponentUi:\s*true[^}]*alpha3SkillCategoryUi:\s*true[^}]*alpha4ColoredCornerBloomUi:\s*true[^}]*registryRarityUi:\s*true[^}]*cpuPortraitsUi:\s*true[^}]*wholeButtonQuizPhysicsUi:\s*true[^}]*boardFirstCandidateGuidanceUi:\s*true[^}]*perCellContactFeedbackUi:\s*true[^}]*approvedGachaOddsUi:\s*true[^}]*approvedEdgeGachaOdds:\s*true[^}]*deferredCurseLocalBundle:\s*true[^}]*regionSplitDirectTargetUi:\s*true[^}]*compactCpuRecordsUi:\s*true[^}]*quizAccuracyRecordsUi:\s*true[^}]*cpuSealTimingPolicy:\s*true[^}]*matchRewardEconomy:\s*true[^}]*candidateAssetGenerationUi:\s*true\s*\}/);
  assert.match(source, /ACTIVE_ROOM_RECOVERY_PHASE_MISMATCH/);
  assert.match(source, /LEGAL_RECOLOR_LAB_UI_PHASE_MISMATCH/);
  assert.match(source, /SETUP_LOAD_V3_PHASE_MISMATCH/);
  assert.match(source, /INITIALIZE_ROOM_V3_PHASE_MISMATCH/);
  assert.match(source, /MATCHMAKING_AVAILABILITY_PHASE_MISMATCH/);
  assert.match(source, /WAITING_OPPONENT_UI_PHASE_MISMATCH/);
  assert.match(source, /ALPHA3_SKILL_CATEGORY_UI_PHASE_MISMATCH/);
  assert.match(source, /ALPHA4_COLORED_CORNER_BLOOM_UI_PHASE_MISMATCH/);
  assert.match(source, /REGISTRY_RARITY_UI_PHASE_MISMATCH/);
  assert.match(source, /CPU_PORTRAITS_UI_PHASE_MISMATCH/);
  assert.match(source, /WHOLE_BUTTON_QUIZ_PHYSICS_UI_PHASE_MISMATCH/);
  assert.match(source, /BOARD_FIRST_CANDIDATE_GUIDANCE_UI_PHASE_MISMATCH/);
  assert.match(source, /PER_CELL_CONTACT_FEEDBACK_UI_PHASE_MISMATCH/);
  assert.match(source, /APPROVED_GACHA_ODDS_UI_PHASE_MISMATCH/);
  assert.match(source, /APPROVED_GACHA_ODDS_EDGE_BUNDLE_MISMATCH/);
  assert.match(source, /DEFERRED_CURSE_LOCAL_BUNDLE_MISMATCH/);
  assert.match(source, /REGION_SPLIT_DIRECT_TARGET_UI_MISMATCH/);
  assert.match(source, /COMPACT_CPU_RECORDS_UI_MISMATCH/);
  assert.match(source, /QUIZ_ACCURACY_RECORDS_UI_MISMATCH/);
  assert.match(source, /CPU_SEAL_TIMING_POLICY_MISMATCH/);
  assert.match(source, /MATCH_REWARD_ECONOMY_MISMATCH/);
  assert.match(source, /app\.text\.includes\('★\$\{meta\.rarity\}'\)/);
  assert.match(source, /CANDIDATE_ASSET_GENERATION_UI_PHASE_MISMATCH/);
  assert.match(source, /app\.js\?v=20260910-25/);
  assert.match(source, /cpu-commentary\.js\?v=20260910-1/);
  assert.match(source, /progression\.css/);
  assert.match(source, /style\.css\?v=20260910-12/);
  assert.match(source, /standard-online-client\.js\?v=20260910-1/);
  assert.match(source, /standard-online-skill-intents\.js\?v=20260907-20/);
  assert.match(source, /standard-skill-registry\.generated\.js\?v=20260907-1/);
  assert.match(source, /cpu-portraits\.js\?v=20260908-1/);
  assert.match(source, /basic-feedback\.js\?v=20260908-2/);
  assert.match(source, /getOptionalBytes\(`\$\{publicUrl\}assets\/cpu-portraits\/cpu-portrait-atlas\.png`\)/);
  assert.match(source, /getOptionalText\(publicEdgeBundleUrl\)/);
  assert.match(source, /standard-engine\.bundle\.js/);
  assert.match(source, /portraitAtlas\.bytes\.length > 500_000/);
  assert.match(source, /portraitAtlasDimensions\?\.width === 1448/);
  assert.match(source, /portraitAtlasDimensions\?\.height === 1086/);
  assert.match(source, /skillCategoryWindow/);
  assert.match(source, /SKILL_CATEGORY_ALREADY_USED_IN_WINDOW/);
  assert.match(source, /colorBonusRefill/);
  assert.match(source, /\$\(\"legalRecolorLabMode\"\)/);
  assert.match(source, /STANDARD_V5_LEGAL_RECOLOR_LAB_V1/);
  assert.match(source, /client\\\.submitSetup/);
  assert.match(source, /SNAPSHOT_V2_BASELINE_MISSING/);
  assert.match(source, /PUBLIC_BASELINE_UI_MISSING/);
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:publishableKey|authorization)/);
});

test("candidate preflight rejects a stale local Standard bundle marker or missing deferred curse code", async () => {
  const { LOCAL_STANDARD_BUNDLE_MARKER, LOCAL_STANDARD_BUNDLE_SHA256, hasDeferredCurseLocalBundle } = await contractsPromise;
  assert.equal(LOCAL_STANDARD_BUNDLE_MARKER, "app.bundle.js?v=20260910-8-79935a0310f2");
  assert.equal(LOCAL_STANDARD_BUNDLE_SHA256, "79935a0310f241c072c18a4387e275076c403415a8128094b078a61e1d71dc17");
  assert.equal(hasDeferredCurseLocalBundle(candidateLocalHtml, candidateLocalBundle), true);
  assert.equal(hasDeferredCurseLocalBundle(candidateLocalHtml.replace(LOCAL_STANDARD_BUNDLE_MARKER, "app.bundle.js?v=20260907-5"), candidateLocalBundle), false);
  assert.equal(hasDeferredCurseLocalBundle(candidateLocalHtml, candidateLocalBundle.replace("consumeDeferredCurseBacklashAfterColor(next, actor);", "void next;")), false);
  assert.equal(hasDeferredCurseLocalBundle(candidateLocalHtml, `${candidateLocalBundle}\n`), false);
});

test("candidate preflight requires direct Region Split targeting in online and local Standard", async () => {
  const { hasRegionSplitDirectTarget } = await contractsPromise;
  assert.equal(hasRegionSplitDirectTarget(candidateApp, candidateLocalBundle), true);
  assert.equal(hasRegionSplitDirectTarget(candidateApp.replace("function activateRegionSplitMacro(state, macro)", "function chooseRegionSplitId(state, macro)"), candidateLocalBundle), false);
  assert.equal(hasRegionSplitDirectTarget(candidateApp.replace("盤面の1マスだけで選べます。", "エリアIDを選んでください。"), candidateLocalBundle), false);
  assert.equal(hasRegionSplitDirectTarget(`${candidateApp}\ntargetChoice(id, "regionId", id);`, candidateLocalBundle), false);
  assert.equal(hasRegionSplitDirectTarget(candidateApp, `${candidateLocalBundle}\nエリア二分を確定`), false);
});

test("candidate preflight requires the complete ten-character compact CPU record list", async () => {
  const { hasCompactCpuRecords } = await contractsPromise;
  assert.equal(hasCompactCpuRecords(candidateHtml, candidateApp, candidateProgressionCss), true);
  assert.equal(hasCompactCpuRecords(candidateHtml.replace("10人全員の勝敗です。", "対戦済みCPUの勝敗です。"), candidateApp, candidateProgressionCss), false);
  assert.equal(hasCompactCpuRecords(candidateHtml, candidateApp.replace("Object.keys(CPU_NAMES)", "Object.keys(characterStats)"), candidateProgressionCss), false);
  assert.equal(hasCompactCpuRecords(candidateHtml, candidateApp.replace('item.setAttribute("aria-label", `${nameText}、${wins}勝 ${losses}敗、合計${matches}戦`)', "void item"), candidateProgressionCss), false);
  assert.equal(hasCompactCpuRecords(candidateHtml, candidateApp, candidateProgressionCss.replace(".cpu-character-records { grid-template-columns: repeat(2, minmax(0, 1fr)); }", ".cpu-character-records { grid-template-columns: 1fr; }")), false);
});

test("candidate preflight requires exact tracked quiz accuracy UI", async () => {
  const { hasQuizAccuracyRecords } = await contractsPromise;
  assert.equal(hasQuizAccuracyRecords(candidateHtml, candidateApp, candidateProgressionCss), true);
  assert.equal(hasQuizAccuracyRecords(candidateHtml.replace("記録開始以降", "過去すべて"), candidateApp, candidateProgressionCss), false);
  assert.equal(hasQuizAccuracyRecords(candidateHtml, candidateApp.replace("record?.trackedCorrect", "record?.bestCorrect"), candidateProgressionCss), false);
  assert.equal(hasQuizAccuracyRecords(candidateHtml, candidateApp.replace("level <= 5", "level <= 4"), candidateProgressionCss), false);
});

test("candidate preflight accepts only whole-button AABB physics with abortable listener cleanup", async () => {
  const { hasWholeButtonQuizPhysics } = await contractsPromise;
  assert.equal(hasWholeButtonQuizPhysics(candidateHtml, candidateApp), true);
  for (const oldApp of [
    candidateApp.replace("function advanceQuizOptionPhysics(items, arenaWidth, arenaHeight, dt)", "function advanceLegacyQuizMotion(items, arenaWidth, arenaHeight, dt)"),
    candidateApp.replace("if (overlapX <= 0 || overlapY <= 0) continue;", "if (overlapX <= 0) continue;"),
    candidateApp.replace("motion.listenerController?.abort();", "motion.listenerController = null;"),
    candidateApp.replace("const speed = 56 + index % 3 * 5;", "const speed = 19 + index % 3 * 3;"),
    candidateApp.replace("arena?.querySelector('button[data-quiz-option]:hover')", 'arena?.matches(":hover")'),
  ]) assert.equal(hasWholeButtonQuizPhysics(candidateHtml, oldApp), false);
  assert.equal(hasWholeButtonQuizPhysics(candidateHtml.replace('id="quizOptions"', 'id="legacyQuizOptions"'), candidateApp), false);
});

test("candidate preflight rejects missing all-start-candidate guidance or stale connected guidance", async () => {
  const { hasBoardFirstCandidateGuidance } = await contractsPromise;
  assert.equal(hasBoardFirstCandidateGuidance(candidateHtml, candidateApp), true);
  assert.equal(hasBoardFirstCandidateGuidance(candidateHtml.replace("必要数まで完成できる全候補", "選択開始位置"), candidateApp), false);
  assert.equal(hasBoardFirstCandidateGuidance(candidateHtml, candidateApp.replace("function startCandidateMacros(state)", "function oldCandidateMacros(state)")), false);
  assert.equal(hasBoardFirstCandidateGuidance(candidateHtml, candidateApp.replace("canvas.dataset.startCandidateMacros", "canvas.dataset.oneStartCandidate")), false);
  assert.equal(hasBoardFirstCandidateGuidance(candidateHtml, candidateApp.replace('color: "#86efac", cssWidth: 2.5, cssDash: [5, 4]', 'color: "#38bdf8", cssWidth: 3, cssDash: [3, 3]')), false);
});

test("candidate preflight rejects completed-selection-only contact feedback", async () => {
  const { hasPerCellContactFeedback } = await contractsPromise;
  assert.equal(hasPerCellContactFeedback(candidateApp), true);
  assert.equal(hasPerCellContactFeedback(candidateApp.replace(
    "function presentSelectedContactChange(state, previousMacros, nextMacros = selectedMacros)",
    "function presentSelectedContact(state, nextMacros = selectedMacros)",
  )), false);
  assert.equal(hasPerCellContactFeedback(candidateApp.replace(
    "if (contactColorCount < 2 || contactColorCount <= previousContactColorCount) return;",
    "if (sourceMacros.length !== state.requiredSize || contactColorCount < 2) return;",
  )), false);
});

test("candidate preflight rejects missing or stale Lv.1-5 gacha UI odds", async () => {
  const { hasApprovedGachaOddsUi } = await contractsPromise;
  assert.equal(hasApprovedGachaOddsUi(candidateHtml, candidateApp), true);
  const oldOddsApp = candidateApp.replace(
    "1: Object.freeze({ 1: 65, 2: 29, 3: 5, 4: 0.9, 5: 0.1 })",
    "1: Object.freeze({ 1: 64, 2: 30, 3: 5, 4: 0.9, 5: 0.1 })",
  );
  assert.equal(hasApprovedGachaOddsUi(candidateHtml, oldOddsApp), false);
  assert.equal(hasApprovedGachaOddsUi(candidateHtml.replace('id="gachaOdds"', 'id="legacyGachaOdds"'), candidateApp), false);
  assert.equal(hasApprovedGachaOddsUi(candidateHtml.replace("★1 65%", "★1 64%"), candidateApp), false);
});

test("candidate preflight rejects an old public Edge bundle odds table", async () => {
  const { APPROVED_GACHA_ODDS, hasApprovedEdgeGachaOdds } = await contractsPromise;
  assert.equal(hasApprovedEdgeGachaOdds(candidateEdgeBundle), true);
  const oldMarker = APPROVED_GACHA_ODDS.edgeMarker.replace('"5":0.1', '"5":0.2');
  const oldBundle = candidateEdgeBundle.replace(APPROVED_GACHA_ODDS.edgeMarker, oldMarker);
  assert.notEqual(oldBundle, candidateEdgeBundle);
  assert.equal(hasApprovedEdgeGachaOdds(oldBundle), false);
  assert.equal(hasApprovedEdgeGachaOdds("const gachaOdds = {}; GACHA_ODDS:gachaOdds"), false);
});

test("candidate preflight requires the public-only CPU seal timing policy", async () => {
  const { hasCpuSealTimingPolicy } = await contractsPromise;
  assert.equal(hasCpuSealTimingPolicy(candidateEdgeBundle), true);
  assert.equal(hasCpuSealTimingPolicy(candidateEdgeBundle.replace("best.before <= 2", "best.before <= 3")), false);
  assert.equal(hasCpuSealTimingPolicy(candidateEdgeBundle.replace("const applySealTiming = !legacyKurogane;", "const applySealTiming = true;")), false);
});

test("candidate preflight requires the complete match reward economy", async () => {
  const { hasMatchRewardEconomy } = await contractsPromise;
  assert.equal(hasMatchRewardEconomy(candidateHtml, candidateApp, candidateEdgeBundle), true);
  assert.equal(hasMatchRewardEconomy(candidateHtml, candidateApp, candidateEdgeBundle.replace("const PVP_REWARD_LIMIT = 10;", "const PVP_REWARD_LIMIT = 11;")), false);
  assert.equal(hasMatchRewardEconomy(candidateHtml, candidateApp, candidateEdgeBundle.replace("Date.parse(entry.endedAt) > cutoff", "Date.parse(entry.endedAt) >= cutoff")), false);
  assert.equal(hasMatchRewardEconomy(candidateHtml.replace("対人勝利はLv.2", "対人勝利はLv.1"), candidateApp, candidateEdgeBundle), false);
});

test("candidate app satisfies the complete legal-recolor LAB release marker", () => {
  const detected = candidateApp.includes('$("legalRecolorLabMode")')
    && candidateApp.includes('const LEGAL_RECOLOR_LAB_RULE_SET_ID = "STANDARD_V5_LEGAL_RECOLOR_LAB_V1"')
    && /client\.submitSetup\([\s\S]{0,500}labMode/.test(candidateApp);
  assert.equal(detected, true);
});

test("candidate app satisfies the waiting-opponent release marker", () => {
  const detected = candidateHtml.includes('id="waitingOpponentNotice"')
    && candidateApp.includes("scheduleMatchmakingAvailability")
    && candidateApp.includes('activateAppTab("battle")');
  assert.equal(detected, true);
});

test("candidate page and app satisfy the alpha.4 cache generation marker", () => {
  assert.equal(candidateHtml.includes("app.js?v=20260910-25"), true);
  assert.equal(candidateHtml.includes("cpu-commentary.js?v=20260910-1"), true);
  assert.equal(candidateHtml.includes("style.css?v=20260910-12"), true);
  assert.equal(candidateHtml.includes("standard-online-client.js?v=20260910-1"), true);
  assert.equal(candidateHtml.includes("standard-online-skill-intents.js?v=20260907-20"), true);
  assert.equal(candidateHtml.includes("standard-skill-registry.generated.js?v=20260907-1"), true);
  assert.equal(candidateHtml.includes("cpu-portraits.js?v=20260908-1"), true);
  assert.equal(candidateHtml.includes("basic-feedback.js?v=20260908-2"), true);
  assert.equal(candidateApp.includes("skillCategoryWindow"), true);
  assert.equal(candidateApp.includes("SKILL_CATEGORY_ALREADY_USED_IN_WINDOW"), true);
  assert.equal(candidateApp.includes("colorBonusRefill"), true);
  assert.equal(candidateApp.includes('state?.engineVersion === "5.0.0-alpha.4"'), true);
  assert.equal(candidateApp.includes("function activateCornerBloomCell(state, micro)"), true);
  assert.equal(candidateApp.includes("regionAtMicro(state, micro, { eligibleOnly: true })"), true);
  assert.equal(candidateApp.includes('sendAction("USE_SKILL", payload)'), true);
  assert.equal(candidateIntents.includes('const colored = Object.hasOwn(input, "regionId")'), true);
  assert.equal(candidateIntents.includes('Object.freeze({ skill, regionId: regionId(input.regionId), macro: integer(input.macro) })'), true);
});
