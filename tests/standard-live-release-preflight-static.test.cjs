"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-release-preflight.mjs"), "utf8");
const candidateApp = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");
const candidateHtml = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "index.html"), "utf8");
const candidateIntents = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "standard-online-skill-intents.js"), "utf8");

test("release preflight is read-only, secret-free, finite, and stage-aware", () => {
  assert.match(source, /publishableKey/);
  assert.doesNotMatch(source, /serviceRole|service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /auth\/v1\/(?:signup|admin)|anonymous\(\)/);
  assert.doesNotMatch(source, /create_room|join_room|cpu-accept|quiz-start|gacha|cosmetic-action/);
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
  assert.match(source, /hasCandidateAssetGeneration/);
  assert.match(source, /baseline:\s*\{[^}]*matchmakingAvailabilityDb:\s*false[^}]*waitingOpponentUi:\s*false\s*\}/);
  assert.match(source, /"db-ready":\s*\{[^}]*matchmakingAvailabilityDb:\s*true[^}]*waitingOpponentUi:\s*false\s*\}/);
  assert.match(source, /candidate:\s*\{[^}]*matchmakingAvailabilityDb:\s*true[^}]*waitingOpponentUi:\s*true[^}]*alpha3SkillCategoryUi:\s*true[^}]*alpha4ColoredCornerBloomUi:\s*true[^}]*registryRarityUi:\s*true[^}]*candidateAssetGenerationUi:\s*true\s*\}/);
  assert.match(source, /ACTIVE_ROOM_RECOVERY_PHASE_MISMATCH/);
  assert.match(source, /LEGAL_RECOLOR_LAB_UI_PHASE_MISMATCH/);
  assert.match(source, /SETUP_LOAD_V3_PHASE_MISMATCH/);
  assert.match(source, /INITIALIZE_ROOM_V3_PHASE_MISMATCH/);
  assert.match(source, /MATCHMAKING_AVAILABILITY_PHASE_MISMATCH/);
  assert.match(source, /WAITING_OPPONENT_UI_PHASE_MISMATCH/);
  assert.match(source, /ALPHA3_SKILL_CATEGORY_UI_PHASE_MISMATCH/);
  assert.match(source, /ALPHA4_COLORED_CORNER_BLOOM_UI_PHASE_MISMATCH/);
  assert.match(source, /REGISTRY_RARITY_UI_PHASE_MISMATCH/);
  assert.match(source, /app\.text\.includes\('★\$\{meta\.rarity\}'\)/);
  assert.match(source, /CANDIDATE_ASSET_GENERATION_UI_PHASE_MISMATCH/);
  assert.match(source, /app\.js\?v=20260907-48/);
  assert.match(source, /style\.css\?v=20260907-43/);
  assert.match(source, /standard-online-skill-intents\.js\?v=20260907-20/);
  assert.match(source, /standard-skill-registry\.generated\.js\?v=20260907-1/);
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
  assert.equal(candidateHtml.includes("app.js?v=20260907-48"), true);
  assert.equal(candidateHtml.includes("style.css?v=20260907-43"), true);
  assert.equal(candidateHtml.includes("standard-online-skill-intents.js?v=20260907-20"), true);
  assert.equal(candidateHtml.includes("standard-skill-registry.generated.js?v=20260907-1"), true);
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
