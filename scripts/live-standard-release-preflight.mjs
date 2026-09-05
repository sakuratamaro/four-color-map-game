import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configSource = fs.readFileSync(path.join(root, "online", "supabase-config.js"), "utf8");
const supabaseUrl = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
const publicUrl = "https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const expectedPhase = process.argv.find((argument) => argument.startsWith("--expect="))?.slice("--expect=".length) || null;
const zeroUuid = "00000000-0000-0000-0000-000000000000";

assert.ok(supabaseUrl && publishableKey, "PUBLIC_SUPABASE_CONFIG_REQUIRED");
assert.ok(expectedPhase === null || ["baseline", "db-ready", "candidate"].includes(expectedPhase), "INVALID_EXPECTED_PHASE");

async function getText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, `PUBLIC_FETCH_FAILED_${response.status}`);
  return { status: response.status, text: await response.text() };
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

const [page, app, snapshotV1, snapshotV2, matchmaking, pregameAbandon, activeRoom, setupLoadV3, initializeRoomV3] = await Promise.all([
  getText(publicUrl),
  getText(`${publicUrl}app.js`),
  probeProtectedRpc("fcg_standard_room_snapshot", { p_room_id: zeroUuid }),
  probeProtectedRpc("fcg_standard_room_snapshot_v2", { p_room_id: zeroUuid, p_known_profile_revision: null }),
  probeProtectedRpc("fcg_standard_matchmaking_recruit", { p_display_name: "preflight", p_ticket_id: zeroUuid }),
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
  },
  database: { snapshotV1, snapshotV2, matchmaking, pregameAbandon, activeRoom, setupLoadV3, initializeRoomV3 },
};

const phaseExpectations = {
  baseline: { pregameAbandonUi: true, pregameAbandonDb: true, activeRoomUi: true, activeRoomDb: true, setupRevisionGuardDb: false, legalRecolorLabUi: false },
  "db-ready": { pregameAbandonUi: true, pregameAbandonDb: true, activeRoomUi: true, activeRoomDb: true, setupRevisionGuardDb: true, legalRecolorLabUi: false },
  candidate: { pregameAbandonUi: true, pregameAbandonDb: true, activeRoomUi: true, activeRoomDb: true, setupRevisionGuardDb: true, legalRecolorLabUi: true },
};

if (expectedPhase) {
  const expected = phaseExpectations[expectedPhase];
  assert.equal(result.database.snapshotV1, "protected", "SNAPSHOT_V1_BASELINE_MISSING");
  assert.equal(result.database.snapshotV2, "protected", "SNAPSHOT_V2_BASELINE_MISSING");
  assert.equal(result.database.matchmaking, "protected", "MATCHMAKING_BASELINE_MISSING");
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
}

console.log(JSON.stringify(result));
