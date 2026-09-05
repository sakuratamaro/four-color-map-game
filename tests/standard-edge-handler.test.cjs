"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");
const config = fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8");

test("Standard Edge handler requires a gateway-verified JWT and ignores caller identity", () => {
  assert.match(config, /\[functions\.standard-game-action\][\s\S]*verify_jwt\s*=\s*true/i);
  assert.match(source, /actorIdFromGatewayVerifiedJwt\(authorization\)/);
  assert.match(source, /typeof payload\.sub === "string" && UUID_PATTERN\.test\(payload\.sub\)/);
  assert.doesNotMatch(source, /body\.(?:userId|actorId|seat)/);
  assert.doesNotMatch(source, /SUPABASE_ANON_KEY/);
});

test("only the generated authoritative bundle creates and applies state", () => {
  assert.match(source, /import "\.\/standard-engine\.bundle\.js"/);
  assert.match(source, /FourColorStandardServerEngine\.create\(/);
  assert.match(source, /FourColorStandardServerEngine\.apply\(/);
  assert.match(source, /FourColorStandardServerEngine\.applyProfiles\(/);
  assert.doesNotMatch(source, /body\.(?:state|publicState|privateState)/);
});

test("profile sync ignores caller progression and preserves the server-authoritative state", () => {
  assert.match(source, /operation === "profile"/);
  const load = source.indexOf('service.rpc("fcg_standard_server_load_profile"');
  const existingReturn = source.indexOf("if (existing) {", load);
  const starter = source.indexOf("FourColorStandardServerEngine.createStarterProfile", load);
  const commit = source.indexOf('service.rpc("fcg_standard_server_commit_profile"');
  assert.ok(load >= 0 && existingReturn > load && starter > existingReturn && commit > starter);
  assert.match(source.slice(existingReturn, starter), /profileState: existing\.profile_state/);
  assert.match(source, /const committedState = globalThis\.FourColorStandardServerEngine\.createStarterProfile\(displayName as string\)/);
  assert.doesNotMatch(source, /p_profile_state:\s*profileState/);
  assert.match(source, /fcg_standard_server_commit_profile/);
  assert.match(source, /p_user_id: actorId/);
  assert.match(source, /p_expected_revision: 0/);
  assert.match(source, /p_profile_state: committedState/);
  const profileBranch = source.slice(source.indexOf('if (operation === "profile")'), source.indexOf('if (operation === "gacha")'));
  assert.match(profileBranch, /return json\(200, \{ revision: firstRow\(data\) \?\? data, profileState: committedState, displayName \}\)/);
  assert.equal((profileBranch.match(/fcg_standard_server_load_profile/g) || []).length, 1);
});

test("gacha uses a server seed and commits through an idempotent receipt boundary", () => {
  assert.match(source, /operation === "gacha"/);
  assert.match(source, /actionId[^\n]+UUID_PATTERN\.test\(actionId\)/);
  assert.match(source, /ticketLevel[^\n]+< 1[^\n]+> 5/);
  assert.match(source, /count[^\n]+< 1[^\n]+> 100/);
  assert.match(source, /FourColorStandardServerEngine\.drawGacha\(\{[\s\S]+profile: profile\.profile_state[\s\S]+seed: secureSeed\(\)/);
  assert.match(source, /fingerprint\(\{ actorId, ticketLevel, count \}\)/);
  const replay = source.indexOf('service.rpc("fcg_standard_server_replay_gacha"');
  const draw = source.indexOf("FourColorStandardServerEngine.drawGacha({");
  assert.ok(replay >= 0 && draw > replay);
  assert.match(source, /replay\?\.found === true[\s\S]+duplicate: true/i);
  assert.match(source, /fcg_standard_server_commit_gacha/);
  for (const field of ["p_user_id", "p_expected_revision", "p_action_id", "p_action_fingerprint", "p_profile_state", "p_action_result"]) {
    assert.match(source, new RegExp(`${field}:`));
  }
  assert.match(source, /duplicate: committed\?\.duplicate === true/);
  assert.match(source, /draws: \(committed\?\.action_result as JsonObject\)\?\.draws \|\| drawn\.draws/);
});

test("card sale quotes and commits only a server-derived profile through a receipt boundary", () => {
  assert.match(source, /operation === "card-sale-quote" \|\| operation === "card-sale"/);
  assert.match(source, /FourColorStandardServerEngine\.quoteCardSale\(\{/);
  assert.match(source, /FourColorStandardServerEngine\.sellCards\(\{/);
  assert.match(source, /fingerprint\(\{ actorId, skillId, count, confirmed \}\)/);
  const replay = source.indexOf('service.rpc("fcg_standard_server_replay_card_sale"');
  const sell = source.indexOf("FourColorStandardServerEngine.sellCards({");
  assert.ok(replay >= 0 && sell > replay);
  assert.match(source, /SALE_CONFIRMATION_REQUIRED/);
  assert.match(source, /fcg_standard_server_commit_card_sale/);
  assert.match(source, /p_profile_state: sold\.profile/);
  assert.match(source, /profileState: current\?\.profile_state/);
  const branch = source.slice(source.indexOf('if (operation === "card-sale-quote"'), source.indexOf('if (operation === "quiz-start"'));
  assert.doesNotMatch(branch, /body\.(?:profileState|earnedCoins|remaining)/);
});

test("cosmetic catalog, quote, and action are server-derived and idempotent", () => {
  const branch = source.slice(source.indexOf('if (operation === "cosmetic-catalog"'), source.indexOf('if (operation === "quiz-start"'));
  assert.match(branch, /FourColorStandardServerEngine\.getCosmetics/);
  assert.match(branch, /FourColorStandardServerEngine\.quoteCosmetic/);
  assert.match(branch, /FourColorStandardServerEngine\.applyCosmetic/);
  assert.match(branch, /fingerprint\(\{ actorId, cosmeticId \}\)/);
  const replay = branch.indexOf('service.rpc("fcg_standard_server_replay_cosmetic"');
  const apply = branch.indexOf("FourColorStandardServerEngine.applyCosmetic");
  assert.ok(replay >= 0 && apply > replay);
  assert.match(branch, /service\.rpc\("fcg_standard_server_commit_cosmetic"/);
  assert.match(branch, /p_profile_state: applied\.profile/);
  assert.doesNotMatch(branch, /body\.(?:profile|profileState|price|coins|equipped|owned)/);
});

test("setup loads the authenticated profile and issues a server-bounded quote", () => {
  assert.match(source, /operation === "setup"/);
  assert.match(source, /service\.rpc\("fcg_standard_server_load_profile",\s*\{[\s\S]+p_user_id: actorId/);
  assert.doesNotMatch(source, /from\("fcg_standard_profiles"\)/);
  assert.match(source, /const profile = firstRow\(profileData\)/);
  assert.match(source, /FourColorStandardServerEngine\.validateSeatLoadout/);
  assert.match(source, /Date\.now\(\) \+ 5 \* 60 \* 1000/);
  assert.match(source, /fingerprint\(\{ roomId, actorId, profileRevision: profile\.revision, loadout, debugMode \}\)/);
  assert.match(source, /fcg_standard_server_submit_loadout/);
  assert.match(source, /p_actor_id: actorId/);
});

test("debug setup is authorized from the service-loaded room only", () => {
  const setup = source.slice(source.indexOf('if (operation === "setup")'), source.indexOf('stage = "load-room"'));
  assert.match(source, /service\.rpc\("fcg_standard_server_load_room_v2",\s*\{\s*p_room_id: roomId,\s*p_actor_id: actorId\s*\}\)/);
  assert.match(setup, /if \(debugMode\) \{[\s\S]+const setupRoom = await load\(\)/);
  assert.match(setup, /setupRoom\.access_mode !== "private_code" \|\| setupRoom\.opponent_kind === "cpu"/);
  assert.match(setup, /code: "DEBUG_MODE_NOT_ALLOWED"/);
  assert.doesNotMatch(setup, /body\.(?:accessMode|access_mode|opponentKind|opponent_kind)/);
});

test("initialization uses service-loaded loadouts and profiles with a server seed", () => {
  assert.match(source, /fcg_standard_server_load_room/);
  assert.match(source, /loadouts: \{ A: playableLoadout\(room\.setup_a[^;]+B: playableLoadout\(room\.setup_b/i);
  assert.match(source, /profiles: \{ A: room\.profile_a_state[^;]+B: room\.profile_b_state/i);
  assert.match(source, /seed: secureSeed\(\)/);
  assert.match(source, /fcg_standard_server_initialize_room/);
});

test("CPU roster and consent derive identity, profile, and loadout only on the server", () => {
  assert.match(source, /operation === "cpu-roster"/);
  assert.match(source, /FourColorStandardServerEngine\.getCpuRoster\(\)/);
  const accept = source.slice(source.indexOf('if (operation === "cpu-accept")'), source.indexOf('if (operation === "profile")'));
  assert.match(accept, /FourColorStandardServerEngine\.createCpuProfile\(characterId\)/);
  assert.match(accept, /service\.rpc\("fcg_standard_server_accept_cpu"/);
  assert.match(accept, /p_profile_state: cpu\.profile/);
  assert.match(accept, /p_loadout: cpu\.loadout/);
  assert.match(accept, /p_policy_version: cpu\.policyVersion/);
  assert.doesNotMatch(accept, /body\.(?:profile|profileState|loadout|policyVersion|cpuUserId)/);
});

test("immediate CPU start is explicit, idempotent, and server-derived", () => {
  assert.match(source, /"cpu-start": \["match", 240\]/);
  const branch = source.slice(source.indexOf('if (operation === "cpu-start")'), source.indexOf('if (operation === "cpu-accept")'));
  assert.match(branch, /body\.confirmed !== true/);
  assert.match(branch, /actionId[^\n]+UUID_PATTERN\.test\(actionId\)/);
  assert.match(branch, /FourColorStandardServerEngine\.createCpuProfile\(characterId\)/);
  assert.match(branch, /service\.rpc\("fcg_standard_server_start_cpu"/);
  assert.match(branch, /p_user_id: actorId/);
  assert.match(branch, /p_action_id: actionId/);
  assert.match(branch, /p_cpu_user_id: crypto\.randomUUID\(\)/);
  assert.match(branch, /p_cpu_profile_state: cpu\.profile/);
  assert.match(branch, /p_cpu_loadout: cpu\.loadout/);
  assert.doesNotMatch(branch, /body\.(?:userId|actorId|profile|profileState|loadout|policyVersion|cpuUserId|displayName)/);
});

test("one CPU action is deterministic, sees only public plus its own private view, and commits separately", () => {
  const branch = source.slice(source.indexOf('if (operation === "cpu-action")'), source.indexOf("const action = body.action as JsonObject"));
  assert.match(branch, /seat !== "A" \|\| room\.opponent_kind !== "cpu"/);
  assert.match(branch, /p_actor_id: room\.cpu_user_id/);
  assert.match(branch, /FourColorStandardServerEngine\.chooseCpuAction\(\{[\s\S]+publicState: cpuRoom\.action_public_state[\s\S]+ownPrivateState: cpuRoom\.actor_private_state/i);
  const choice = branch.slice(branch.indexOf("FourColorStandardServerEngine.chooseCpuAction"), branch.indexOf("const action: JsonObject"));
  assert.match(choice, /policyVersion: room\.cpu_policy_version/);
  assert.doesNotMatch(choice, /private_a|privateA|profile_a_state/i);
  assert.doesNotMatch(choice, /authoritative_state|rngSnapshot|private_b|profile_b_state/i);
  assert.match(branch, /deterministicCpuIdentity\(roomId, expectedVersion/);
  assert.match(branch, /FourColorStandardServerEngine\.applyCpuProfiles/);
  assert.match(branch, /service\.rpc\("fcg_standard_server_commit_action"/);
  assert.match(branch, /p_actor_id: room\.cpu_user_id/);
  assert.doesNotMatch(branch, /body\.(?:action|type|payload|seed|privateState|publicState)/);
});

test("CPU rematch rebuilds the same character profile and loadout on the server", () => {
  const branch = source.slice(source.indexOf('if (operation === "cpu-rematch")'), source.indexOf('if (operation === "initialize")'));
  assert.match(branch, /seat !== "A" \|\| room\.opponent_kind !== "cpu" \|\| room\.room_status !== "finished"/);
  assert.match(branch, /FourColorStandardServerEngine\.createCpuProfile\(room\.cpu_character_id as string\)/);
  assert.match(branch, /service\.rpc\("fcg_standard_server_request_cpu_rematch"/);
  assert.match(branch, /p_cpu_profile_state: cpu\.profile/);
  assert.match(branch, /p_cpu_loadout: cpu\.loadout/);
  assert.match(branch, /p_policy_version: cpu\.policyVersion/);
  assert.doesNotMatch(branch, /body\.(?:characterId|profile|profileState|loadout|policyVersion)/);
});

test("human actions in CPU rooms use CPU-separated settlement", () => {
  assert.match(source, /room\.opponent_kind === "cpu"[\s\S]+FourColorStandardServerEngine\.applyCpuProfiles\([\s\S]+characterId: room\.cpu_character_id as string/);
});

test("each rematch generation receives a distinct match id and versioned projections", () => {
  assert.match(source, /const initialVersion = Number\(room\.room_version\)/);
  assert.match(source, /matchId: `\$\{roomId\}:\$\{initialVersion\}`/);
  assert.match(source, /const initialState = \{ \.\.\.\(created\.state as JsonObject\), version: initialVersion \}/);
  assert.match(source, /p_authoritative_state: \{ state: initialState, rngSnapshot: created\.rngSnapshot \}/);
  assert.match(source, /const initialProjection = globalThis\.FourColorStandardServerEngine\.project\(initialState, debugMode\)/);
  assert.match(source, /p_public_state: initialProjection\.publicState/);
  assert.match(source, /p_private_a: initialProjection\.privateA/);
  assert.match(source, /p_private_b: initialProjection\.privateB/);
});

test("action retries preflight the immutable fingerprint before engine application", () => {
  const replay = source.indexOf('service.rpc("fcg_standard_server_replay_action"');
  const apply = source.indexOf("FourColorStandardServerEngine.apply({");
  assert.ok(replay >= 0 && apply > replay);
  assert.match(source, /fingerprint\(\{ roomId, actorId, action \}\)/);
  assert.match(source, /replay\?\.found === true[\s\S]+duplicate: true/i);
});

test("one Standard commit carries match, projections, profile effects, and settlement", () => {
  assert.match(source, /fcg_standard_server_commit_action/);
  for (const field of [
    "p_action_fingerprint",
    "p_authoritative_state",
    "p_public_state",
    "p_private_a",
    "p_private_b",
    "p_profile_a_expected_revision",
    "p_profile_a_state",
    "p_profile_b_expected_revision",
    "p_profile_b_state",
    "p_finished",
    "p_winner_seat",
  ]) assert.match(source, new RegExp(`${field}:`));
  assert.match(source, /safeResult = \{ code: applied\.code, contactColorCount: applied\.contactColorCount, terminalReason: applied\.terminalReason \}/);
});

test("handler keeps credentials in managed environment and diagnostics finite", () => {
  assert.match(source, /requiredEnvironment\("SUPABASE_URL"\)/);
  assert.match(source, /requiredEnvironment\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9._-]+/);
  assert.match(source, /console\.error\("standard-game-action failed", safe\.code, "stage", stage, "upstream", safeUpstreamCode\(error\) \|\| "NONE"\)/);
  assert.doesNotMatch(source, /console\.(?:error|log)\([^\n]*(?:authorization|serviceRoleKey|request\.json|candidate\.message|error\.stack)/i);
});

test("Edge operations have a bounded, low-overhead per-isolate abuse brake", () => {
  assert.match(source, /const RATE_WINDOW_MS = 60_000/);
  assert.match(source, /const RATE_ENTRY_LIMIT = 4096/);
  assert.match(source, /const rateEntries = new Map/);
  assert.match(source, /entry\.count > limit/);
  assert.match(source, /while \(rateEntries\.size > RATE_ENTRY_LIMIT\)/);
  assert.match(source, /if \(rateLimited\(actorId, String\(operation\)\)\)/);
  assert.match(source, /code: "RATE_LIMITED"/);
  assert.doesNotMatch(source, /rateEntries[^\n]+(?:token|authorization|profile|room)/i);
});

test("database conflicts map to finite public errors", () => {
  assert.match(source, /candidate\?\.code === "PT409"/);
  assert.match(source, /candidate\?\.code === "23505"/);
  assert.match(source, /candidate\?\.code === "42501"/);
  assert.match(source, /\^PGRST00\[0-3\]\$/);
  assert.match(source, /\^08\[A-Z0-9\]\{3\}\$/);
  for (const code of ["53100", "53200", "53300", "55P03", "57014", "57P03"]) assert.match(source, new RegExp(`"${code}"`));
  assert.match(source, /function safeUpstreamCode/);
  assert.match(source, /\^\(\?:PGRST\\d\{3\}\|\[A-Z0-9\]\{5\}\)\$/);
  assert.match(source, /code: "IDEMPOTENCY_KEY_REUSE"/);
  assert.match(source, /code: "SERVER_BUSY"/);
});
