"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const handlerPath = path.join(__dirname, "..", "supabase", "functions", "game-action", "index.ts");
const source = fs.readFileSync(handlerPath, "utf8");
const config = fs.readFileSync(path.join(__dirname, "..", "supabase", "config.toml"), "utf8");
const browserEnginePath = path.join(__dirname, "..", "online", "quick-engine.js");
const deployEnginePath = path.join(
  __dirname,
  "..",
  "supabase",
  "functions",
  "game-action",
  "quick-engine.js",
);

test("Edge handler derives identity from verified bearer JWT", () => {
  assert.match(config, /\[functions\.game-action\][\s\S]*verify_jwt\s*=\s*true/);
  assert.match(source, /authClient\.auth\.getUser\(\)/);
  assert.match(source, /p_actor_id:\s*authData\.user\.id/);
  assert.doesNotMatch(source, /body\.(userId|actorId)/);
});

test("Edge handler imports the shared quick engine instead of accepting final client state", () => {
  assert.match(source, /import "\.\/quick-engine\.js"/);
  assert.equal(
    fs.readFileSync(deployEnginePath, "utf8").replace(/\r\n/g, "\n").trimEnd(),
    fs.readFileSync(browserEnginePath, "utf8").replace(/\r\n/g, "\n").trimEnd(),
    "dashboard-deployable engine copy must stay source-identical to the browser engine",
  );
  assert.match(source, /FourColorQuickEngine\.applyAction/);
  assert.doesNotMatch(source, /body\.(state|publicState|privateState)/);
});

test("Edge handler reads service credentials only from managed environment", () => {
  assert.match(source, /const serviceRoleKey = requiredEnvironment\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(source, /const value = Deno\.env\.get\(name\)/);
  assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9._-]+/);
  assert.doesNotMatch(source, /serviceRoleKey\s*=\s*["'][^"']+["']/);
});

test("Edge handler sends versioned UUID actions through atomic commit RPC", () => {
  assert.match(source, /fcg_server_commit_action/);
  assert.match(source, /p_action_id:\s*action\.id/);
  assert.match(source, /p_expected_version:\s*action\.expectedVersion/);
});
