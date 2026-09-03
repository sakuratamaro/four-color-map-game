const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const handler = fs.readFileSync(path.join(root, "supabase/functions/standard-game-action/index.ts"), "utf8");

test("existing Standard profiles are returned without a stale bootstrap commit", () => {
  const existingGuard = handler.indexOf("if (existing) {");
  const commitStage = handler.indexOf('stage = "commit-profile";');

  assert.ok(existingGuard >= 0, "existing profile recovery guard is missing");
  assert.ok(existingGuard < commitStage, "existing profile must return before the profile CAS commit");
  assert.match(handler, /revision:\s*existing\.revision/);
  assert.match(handler, /profileState:\s*existing\.profile_state/);
  assert.match(handler, /displayName:\s*existing\.display_name/);
  assert.match(handler, /p_expected_revision:\s*0/);
});
