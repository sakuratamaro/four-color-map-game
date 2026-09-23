import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasCardActionRecovery } from "./standard-release-preflight-contracts.mjs";
import { LOCAL_STANDARD_BUNDLE_MARKER, hasApprovedEdgeGachaOdds, hasApprovedGachaOddsUi, hasBoardFirstCandidateGuidance, hasCompactCpuRecords, hasCompactProfile, hasCpuSealTimingPolicy, hasDeferredCurseLocalBundle, hasDirectQuizEntry, hasGachaEntryDiet, hasHomeRules, hasMatchRewardEconomy, hasPerCellContactFeedback, hasQuizAccuracyRecords, hasRegionSplitDirectTarget, hasWholeButtonQuizPhysics } from "./standard-release-preflight-contracts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configSource = fs.readFileSync(path.join(root, "online", "supabase-config.js"), "utf8");
const supabaseUrl = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
const publicUrl = "https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const localStandardUrl = new URL("../standard-v5/", publicUrl).href;
const publicEdgeBundleUrl = new URL("../supabase/functions/standard-game-action/standard-engine.bundle.js", publicUrl).href;
const expectedPhase = process.argv.find((argument) => argument.startsWith("--expect="))?.slice("--expect=".length) || null;
const zeroUuid = "00000000-0000-0000-0000-000000000000";
const candidateAssetMarkers = Object.freeze({
app: "app.js?v=20260923-1",
  homeStyle: "ui-diet.css?v=20260914-2",
  terminalStyle: "terminal-result.css?v=20260914-1",
  commentary: "cpu-commentary.js?v=20260910-1",
  style: "style.css?v=20260921-1",
  playStyle: "play-surface.css?v=20260915-5",
  client: "standard-online-client.js?v=20260914-1",
  intents: "standard-online-skill-intents.js?v=20260911-21",
  registry: "standard-skill-registry.generated.js?v=20260914-2",
  portraits: "cpu-portraits.js?v=20260913-2",
  artworkStyle: "cpu-artwork.css?v=20260913-1",
  feedback: "basic-feedback.js?v=20260908-2",
  cutin: "skill-cutin.js?v=20260913-2",
  cutinStyle: "skill-cutin.css?v=20260913-1",
});

assert.ok(supabaseUrl && publishableKey, "PUBLIC_SUPABASE_CONFIG_REQUIRED");
assert.ok(expectedPhase === null || ["baseline", "db-ready", "candidate"].includes(expectedPhase), "INVALID_EXPECTED_PHASE");

async function getText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, `PUBLIC_FETCH_FAILED_${response.status}`);
  return { status: response.status, text: await response.text() };
}

async function getOptionalText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (response.status === 404) return { status: response.status, text: "" };
  assert.equal(response.ok, true, `PUBLIC_FETCH_FAILED_${response.status}`);
  return { status: response.status, text: await response.text() };
}

async function getOptionalBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (response.status === 404) return { status: response.status, bytes: new Uint8Array() };
  assert.equal(response.ok, true, `PUBLIC_FETCH_FAILED_${response.status}`);
  return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || String.fromCharCode(...bytes.slice(1, 4)) !== "PNG") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function probeProtectedRpc(name, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && data?.code === "42501") return "protected";
  if (response.status === 404 && data?.code === "PGRST202") return "absent";
  throw new Error(`UNEXPECTED_RPC_PROBE_${name}_${response.status}_${String(data?.code || "UNKNOWN")}`);
}

const [page, app, resultModel, progressionCss, intents, registry, portraits, portraitManifest, localStandardPage, localStandardBundle, publicEdgeBundle, snapshotV1, snapshotV2, matchmaking, matchmakingAvailability, pregameAbandon, activeRoom, setupLoadV3, initializeRoomV3] = await Promise.all([
  getText(publicUrl),
  getText(`${publicUrl}app.js`),
  getOptionalText(`${publicUrl}result-continuation.js`),
  getText(`${publicUrl}progression.css`),
  getText(`${publicUrl}standard-online-skill-intents.js`),
  getText(`${publicUrl}standard-skill-registry.generated.js`),
  getOptionalText(`${publicUrl}cpu-portraits.js`),
  getOptionalText(`${publicUrl}assets/cpu-portraits/wataokiba/manifest.json`),
  getText(localStandardUrl),
  getText(`${localStandardUrl}${LOCAL_STANDARD_BUNDLE_MARKER}`),
  getOptionalText(publicEdgeBundleUrl),
  probeProtectedRpc("fcg_standard_room_snapshot", { p_room_id: zeroUuid }),
  probeProtectedRpc("fcg_standard_room_snapshot_v2", { p_room_id: zeroUuid, p_known_profile_revision: null }),
  probeProtectedRpc("fcg_standard_matchmaking_recruit", { p_display_name: "preflight", p_ticket_id: zeroUuid }),
  probeProtectedRpc("fcg_standard_matchmaking_availability", {}),
  probeProtectedRpc("fcg_standard_abandon_room", { p_room_id: zeroUuid, p_expected_version: 0, p_action_id: zeroUuid }),
  probeProtectedRpc("fcg_standard_active_room", {}),
  probeProtectedRpc("fcg_standard_server_load_room_v3", {
    p_room_id: zeroUuid,
    p_actor_id: zeroUuid,
  }),
  probeProtectedRpc("fcg_standard_server_initialize_room", {
    p_room_id: zeroUuid,
    p_expected_version: 0,
    p_setup_a_revision: 1,
    p_setup_b_revision: 1,
    p_authoritative_state: {},
    p_public_state: {},
    p_private_a: {},
    p_private_b: {},
  }),
]);

const homeCss = await getOptionalText(`${publicUrl}ui-diet.css`);
// Only the fixed local manifest chooses image URLs, after exact remote equality.
const localPortraitManifest = fs.readFileSync(path.join(root, "standard-online-v5/assets/cpu-portraits/wataokiba/manifest.json"), "utf8");
const portraitManifestMatches = portraitManifest.status === 200 && portraitManifest.text === localPortraitManifest;
const portraitImages = portraitManifestMatches ? await Promise.all(JSON.parse(localPortraitManifest).files.flatMap(row =>
  Object.values(row.assets).map(async asset => {
    assert.match(asset.file, /^[a-z]+-(normal|loss)\.png$/);
    const fetched = await getOptionalBytes(`${publicUrl}assets/cpu-portraits/wataokiba/${asset.file}`);
    const dimensions = pngDimensions(fetched.bytes);
    return { file: asset.file, bytesMatch: fetched.status === 200 && fetched.bytes.length === asset.bytes
      && crypto.createHash("sha256").update(fetched.bytes).digest("hex") === asset.sha256
      && dimensions?.width === asset.width && dimensions?.height === asset.height };
  }))) : [];

const result = {
  ok: true,
  expectedPhase,
  publicPage: {
    status: page.status,
    title: page.text.match(/<title>([^<]+)<\/title>/)?.[1] || "",
    hasPublicMatchmaking: /recruitOpponent|対戦相手を募集/.test(app.text),
    hasCpuRoster: /cpu-roster|CPU一覧/.test(app.text),
    hasCosmetics: /cosmetic-catalog|見た目/.test(app.text),
    hasPregameAbandon: /client\.abandonRoom|開始前の対戦を取りやめる/.test(app.text),
    hasActiveRoomRecovery: /client\.recoverActiveRoom|recoverServerActiveRoom/.test(app.text),
    hasLegalRecolorLab: app.text.includes('$("legalRecolorLabMode")')
      && app.text.includes('const LEGAL_RECOLOR_LAB_RULE_SET_ID = "STANDARD_V5_LEGAL_RECOLOR_LAB_V1"')
      && /client\.submitSetup\([\s\S]{0,500}labMode/.test(app.text),
    hasWaitingOpponentNotice: page.text.includes('id="waitingOpponentNotice"')
      && app.text.includes("scheduleMatchmakingAvailability")
      && app.text.includes('activateAppTab("battle")'),
    hasAlpha3SkillCategoryWindow: app.text.includes("skillCategoryWindow")
      && app.text.includes("SKILL_CATEGORY_ALREADY_USED_IN_WINDOW")
      && app.text.includes("colorBonusRefill"),
    hasAlpha4ColoredCornerBloom: app.text.includes('state?.engineVersion === "5.0.0-alpha.4"')
      && app.text.includes("function activateCornerBloomCell(state, micro)")
      && app.text.includes("regionAtMicro(state, micro, { eligibleOnly: true })")
      && app.text.includes('sendAction("USE_SKILL", payload)')
      && intents.text.includes('const colored = Object.hasOwn(input, "regionId")')
      && intents.text.includes('Object.freeze({ skill, regionId: regionId(input.regionId), macro: integer(input.macro) })'),
    hasAlpha5ColoredCornerBloom: app.text.includes('state?.engineVersion === "5.0.0-alpha.4" || state?.engineVersion === "5.0.0-alpha.5"'),
    hasRegistryRarityUi: registry.text.includes('"areaCornerBloom"')
      && registry.text.includes('"rarity": 4')
      && app.text.includes('STANDARD_SKILL_REGISTRY.skills')
      && app.text.includes('★${meta.rarity}')
      && app.text.includes('rarity.textContent = `★${targetMeta.rarity}`'),
    hasCpuPortraits: page.text.includes(candidateAssetMarkers.portraits)
      && portraits.text.includes('const VERSION = "standard-cpu-portraits-v3"')
      && page.text.includes(candidateAssetMarkers.artworkStyle)
      && portraitManifestMatches && portraitImages.length === 20
      && portraitImages.every(asset => asset.bytesMatch),
    hasWholeButtonQuizPhysics: hasWholeButtonQuizPhysics(page.text, app.text),
    hasDirectQuizEntry: hasDirectQuizEntry(page.text, app.text),
    hasGachaEntryDiet: hasGachaEntryDiet(page.text, app.text),
    hasCardActionRecovery: hasCardActionRecovery(page.text, app.text),
    hasHomeRules: hasHomeRules(page.text, app.text, homeCss.text),
    hasCompactProfile: hasCompactProfile(page.text, app.text, homeCss.text),
    hasBoardFirstCandidateGuidance: hasBoardFirstCandidateGuidance(page.text, app.text),
    hasPerCellContactFeedback: hasPerCellContactFeedback(app.text),
    hasApprovedGachaOddsUi: hasApprovedGachaOddsUi(page.text, app.text, registry.text),
    hasApprovedEdgeGachaOdds: publicEdgeBundle.status === 200 && hasApprovedEdgeGachaOdds(publicEdgeBundle.text),
    hasDeferredCurseLocalBundle: hasDeferredCurseLocalBundle(localStandardPage.text, localStandardBundle.text),
    hasRegionSplitDirectTarget: hasRegionSplitDirectTarget(app.text, localStandardBundle.text),
    hasCompactCpuRecords: hasCompactCpuRecords(page.text, app.text, progressionCss.text),
    hasQuizAccuracyRecords: hasQuizAccuracyRecords(page.text, app.text, progressionCss.text),
    hasCpuSealTimingPolicy: publicEdgeBundle.status === 200 && hasCpuSealTimingPolicy(publicEdgeBundle.text),
    hasMatchRewardEconomy: publicEdgeBundle.status === 200 && hasMatchRewardEconomy(page.text, app.text, publicEdgeBundle.text, resultModel.text),
    hasCandidateAssetGeneration: page.text.includes(candidateAssetMarkers.app)
      && page.text.includes(candidateAssetMarkers.homeStyle)
      && page.text.includes(candidateAssetMarkers.commentary)
      && page.text.includes(candidateAssetMarkers.style)
      && page.text.includes(candidateAssetMarkers.playStyle)
      && page.text.includes(candidateAssetMarkers.client)
      && page.text.includes(candidateAssetMarkers.intents)
      && page.text.includes(candidateAssetMarkers.registry)
      && page.text.includes(candidateAssetMarkers.portraits)
      && page.text.includes(candidateAssetMarkers.artworkStyle)
      && page.text.includes(candidateAssetMarkers.feedback)
      && page.text.includes(candidateAssetMarkers.cutin)
      && page.text.includes(candidateAssetMarkers.cutinStyle),
  },
  database: { snapshotV1, snapshotV2, matchmaking, matchmakingAvailability, pregameAbandon, activeRoom, setupLoadV3, initializeRoomV3 },
};

const phaseExpectations = {
  baseline: { pregameAbandonUi: true, pregameAbandonDb: true, activeRoomUi: true, activeRoomDb: true, setupRevisionGuardDb: true, legalRecolorLabUi: true, matchmakingAvailabilityDb: false, waitingOpponentUi: false },
  "db-ready": { pregameAbandonUi: true, pregameAbandonDb: true, activeRoomUi: true, activeRoomDb: true, setupRevisionGuardDb: true, legalRecolorLabUi: true, matchmakingAvailabilityDb: true, waitingOpponentUi: false },
  candidate: { pregameAbandonUi: true, pregameAbandonDb: true, activeRoomUi: true, activeRoomDb: true, setupRevisionGuardDb: true, legalRecolorLabUi: true, matchmakingAvailabilityDb: true, waitingOpponentUi: true, alpha3SkillCategoryUi: true, alpha4ColoredCornerBloomUi: true, registryRarityUi: true, cpuPortraitsUi: true, wholeButtonQuizPhysicsUi: true, boardFirstCandidateGuidanceUi: true, perCellContactFeedbackUi: true, approvedGachaOddsUi: true, approvedEdgeGachaOdds: true, deferredCurseLocalBundle: true, regionSplitDirectTargetUi: true, compactCpuRecordsUi: true, quizAccuracyRecordsUi: true, cpuSealTimingPolicy: true, matchRewardEconomy: true, candidateAssetGenerationUi: true },
};

if (expectedPhase) {
  const expected = phaseExpectations[expectedPhase];
  assert.equal(result.database.snapshotV1, "protected", "SNAPSHOT_V1_BASELINE_MISSING");
  assert.equal(result.database.snapshotV2, "protected", "SNAPSHOT_V2_BASELINE_MISSING");
  assert.equal(result.database.matchmaking, "protected", "MATCHMAKING_BASELINE_MISSING");
  assert.equal(result.database.matchmakingAvailability, expected.matchmakingAvailabilityDb ? "protected" : "absent", "MATCHMAKING_AVAILABILITY_PHASE_MISMATCH");
  assert.equal(result.database.pregameAbandon, expected.pregameAbandonDb ? "protected" : "absent", "PREGAME_ABANDON_PHASE_MISMATCH");
  assert.equal(result.database.activeRoom, expected.activeRoomDb ? "protected" : "absent", "ACTIVE_ROOM_RECOVERY_PHASE_MISMATCH");
  assert.equal(result.database.setupLoadV3, expected.setupRevisionGuardDb ? "protected" : "absent", "SETUP_LOAD_V3_PHASE_MISMATCH");
  assert.equal(result.database.initializeRoomV3, expected.setupRevisionGuardDb ? "protected" : "absent", "INITIALIZE_ROOM_V3_PHASE_MISMATCH");
  for (const key of ["hasPublicMatchmaking", "hasCpuRoster", "hasCosmetics"]) {
    assert.equal(result.publicPage[key], true, `PUBLIC_BASELINE_UI_MISSING_${key}`);
  }
  assert.equal(result.publicPage.hasPregameAbandon, expected.pregameAbandonUi, "PREGAME_ABANDON_UI_PHASE_MISMATCH");
  assert.equal(result.publicPage.hasActiveRoomRecovery, expected.activeRoomUi, "ACTIVE_ROOM_RECOVERY_UI_PHASE_MISMATCH");
  assert.equal(result.publicPage.hasLegalRecolorLab, expected.legalRecolorLabUi, "LEGAL_RECOLOR_LAB_UI_PHASE_MISMATCH");
  assert.equal(result.publicPage.hasWaitingOpponentNotice, expected.waitingOpponentUi, "WAITING_OPPONENT_UI_PHASE_MISMATCH");
  if (expectedPhase === "candidate") {
    assert.equal(result.publicPage.hasDirectQuizEntry, true, "DIRECT_QUIZ_ENTRY_REQUIRED");
    assert.equal(result.publicPage.hasGachaEntryDiet, true, "GACHA_ENTRY_DIET_REQUIRED");
    assert.equal(result.publicPage.hasCardActionRecovery, true, "CARD_ACTION_RECOVERY_REQUIRED");
    assert.equal(result.publicPage.hasHomeRules, true, "HOME_RULES_REQUIRED");
    assert.equal(result.publicPage.hasCompactProfile, true, "COMPACT_PROFILE_REQUIRED");
    for (const [file, response] of [["index.html", page], ["app.js", app], ["ui-diet.css", homeCss], ["progression.css", progressionCss]]) {
      assert.equal(response.text, fs.readFileSync(path.join(root, "standard-online-v5", file), "utf8"), `HOME_RULES_ASSET_EXACT_${file}`);
    }
    assert.ok(app.text.includes('result-continuation.js?v=20260914-2'), "TERMINAL_RESULT_MODEL_GENERATION_REQUIRED");
    assert.ok(app.text.includes('cpu-progression-model.js?v=20260914-1'), "CPU_PROGRESSION_MODEL_GENERATION_REQUIRED");
    for (const file of ["terminal-result.css", "result-continuation.js", "action-recovery.js", "cpu-progression-model.js"]) {
      const response = file === "result-continuation.js" ? resultModel : await getText(`${publicUrl}${file}`);
      assert.equal(response.text, fs.readFileSync(path.join(root, "standard-online-v5", file), "utf8"), `TERMINAL_RESULT_ASSET_EXACT_${file}`);
    }
    assert.equal(result.publicPage.hasAlpha3SkillCategoryWindow, expected.alpha3SkillCategoryUi, "ALPHA3_SKILL_CATEGORY_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasAlpha4ColoredCornerBloom, expected.alpha4ColoredCornerBloomUi, "ALPHA4_COLORED_CORNER_BLOOM_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasAlpha5ColoredCornerBloom, true, "ALPHA5_COLORED_CORNER_BLOOM_UI_REQUIRED");
    assert.equal(result.publicPage.hasRegistryRarityUi, expected.registryRarityUi, "REGISTRY_RARITY_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasCpuPortraits, expected.cpuPortraitsUi, "CPU_PORTRAITS_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasWholeButtonQuizPhysics, expected.wholeButtonQuizPhysicsUi, "WHOLE_BUTTON_QUIZ_PHYSICS_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasBoardFirstCandidateGuidance, expected.boardFirstCandidateGuidanceUi, "BOARD_FIRST_CANDIDATE_GUIDANCE_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasPerCellContactFeedback, expected.perCellContactFeedbackUi, "PER_CELL_CONTACT_FEEDBACK_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasApprovedGachaOddsUi, expected.approvedGachaOddsUi, "APPROVED_GACHA_ODDS_UI_PHASE_MISMATCH");
    assert.equal(result.publicPage.hasApprovedEdgeGachaOdds, expected.approvedEdgeGachaOdds, "APPROVED_GACHA_ODDS_EDGE_BUNDLE_MISMATCH");
    assert.equal(result.publicPage.hasDeferredCurseLocalBundle, expected.deferredCurseLocalBundle, "DEFERRED_CURSE_LOCAL_BUNDLE_MISMATCH");
    assert.equal(result.publicPage.hasRegionSplitDirectTarget, expected.regionSplitDirectTargetUi, "REGION_SPLIT_DIRECT_TARGET_UI_MISMATCH");
    assert.equal(result.publicPage.hasCompactCpuRecords, expected.compactCpuRecordsUi, "COMPACT_CPU_RECORDS_UI_MISMATCH");
    assert.equal(result.publicPage.hasQuizAccuracyRecords, expected.quizAccuracyRecordsUi, "QUIZ_ACCURACY_RECORDS_UI_MISMATCH");
    assert.equal(result.publicPage.hasCpuSealTimingPolicy, expected.cpuSealTimingPolicy, "CPU_SEAL_TIMING_POLICY_MISMATCH");
    assert.equal(result.publicPage.hasMatchRewardEconomy, expected.matchRewardEconomy, "MATCH_REWARD_ECONOMY_MISMATCH");
    assert.equal(result.publicPage.hasCandidateAssetGeneration, expected.candidateAssetGenerationUi, "CANDIDATE_ASSET_GENERATION_UI_PHASE_MISMATCH");
  }
}

console.log(JSON.stringify(result));
