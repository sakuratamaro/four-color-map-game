"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const client = fs.readFileSync(path.join(root, "standard-online-v5", "standard-online-client.js"), "utf8");
const intents = fs.readFileSync(path.join(root, "standard-online-v5", "standard-online-skill-intents.js"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");

test("Micro Bloom keeps or accepts a connected board selection and submits the canonical intent", () => {
  assert.match(intents, /areaMicroBloom: "source-macros"/);
  assert.match(app, /\["corner-bloom", "source-macros"\]\.includes\(kind\)/);
  assert.match(app, /\["source-macros", "corner-bloom", "band-shift", "region-split"\]\.includes\(targetDraft\.kind\)/);
  assert.match(app, /targetDraft\?\.kind === "source-macros"\) return toggleBoardMacro\(state, macro\)/);
  assert.match(app, /targetDraft\.kind === "source-macros"\) useTarget\.disabled = selectedMacros\.size !== state\.requiredSize/);
  assert.match(app, /skillIntents\.buildSkillPayload\(targetDraft\.skill, input\)/);
  assert.match(intents, /kind === "source-macros"[^\n]+sourceMacros: macros\(input\.sourceMacros\)/);
});

test("Micro Bloom rejection is actionable and the Edge handler returns authoritative rule codes", () => {
  assert.match(client, /NO_MICRO_BLOOM_CANDIDATE: "選んだエリアには、ひとふくらみで斜めのエリアへ接続できる角がありません/);
  assert.match(client, /INVALID_OUTGOING_SELECTION: "渡すエリアの選択を確認できませんでした/);
  assert.match(edge, /if \(applied\.ok !== true\) return json\(400, \{ error: \{ code: applied\.code \|\| "RULE_REJECTED"/);
});
