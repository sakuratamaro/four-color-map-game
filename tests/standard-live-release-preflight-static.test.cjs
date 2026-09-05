"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-release-preflight.mjs"), "utf8");
const candidateApp = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");

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
  assert.match(source, /fcg_standard_abandon_room/);
  assert.match(source, /fcg_standard_active_room/);
  assert.match(source, /fcg_standard_server_load_room_v3/);
  assert.match(source, /p_setup_a_revision:\s*1/);
  assert.match(source, /p_setup_b_revision:\s*1/);
  assert.match(source, /hasPregameAbandon/);
  assert.match(source, /hasActiveRoomRecovery/);
  assert.match(source, /hasLegalRecolorLab/);
  assert.match(source, /baseline:\s*\{[^}]*setupRevisionGuardDb:\s*false[^}]*legalRecolorLabUi:\s*false\s*\}/);
  assert.match(source, /"db-ready":\s*\{[^}]*setupRevisionGuardDb:\s*true[^}]*legalRecolorLabUi:\s*false\s*\}/);
  assert.match(source, /candidate:\s*\{[^}]*setupRevisionGuardDb:\s*true[^}]*legalRecolorLabUi:\s*true\s*\}/);
  assert.match(source, /ACTIVE_ROOM_RECOVERY_PHASE_MISMATCH/);
  assert.match(source, /LEGAL_RECOLOR_LAB_UI_PHASE_MISMATCH/);
  assert.match(source, /SETUP_LOAD_V3_PHASE_MISMATCH/);
  assert.match(source, /INITIALIZE_ROOM_V3_PHASE_MISMATCH/);
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
