"use strict";
// Read-only local check against the declared Git base; no network or live calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { loadEngine, fixture, plain, root } = require("../tests/helpers/public-skill-fixture.cjs");
const registry = require("../standard-online-v5/standard-skill-registry.generated.js");
const args = process.argv.slice(2), base = args[0]?.slice(7);
assert.ok(args.length === 1 && args[0].startsWith("--base=") && /^[0-9a-f]{40}$/.test(base || ""), "One exact --base=SHA is required");
const readBase = file => execFileSync("git", ["-c", "safe.directory=" + root.replaceAll("\\", "/"), "show", base + ":" + file],
  { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 15000 });
const hash = text => createHash("sha256").update(text).digest("hex");
const bundlePath = "supabase/functions/standard-game-action/standard-engine.bundle.js", cutinPath = "standard-online-v5/skill-cutin.js";
const oldSource = readBase(bundlePath), newSource = fs.readFileSync(path.join(root, bundlePath), "utf8");
const oldEngine = loadEngine(oldSource), newEngine = loadEngine(newSource);
function viewer(source) { const ctx = vm.createContext({}); vm.runInContext(source, ctx, { timeout: 10000 }); return ctx.FourColorSkillCutin; }
const oldCutinSource = readBase(cutinPath), oldViewer = viewer(oldCutinSource), newViewer = require("../standard-online-v5/skill-cutin.js");
const cases = [];
const variations = [...["work", "palette", "miss", "recolor"].map(scenario => ({ scenario })),
  ...["5.0.0-alpha.1", "5.0.0-alpha.2", "5.0.0-alpha.3", "5.0.0-alpha.4"].map(engineVersion => ({ scenario: "work", engineVersion }))];
for (const actor of ["A", "B"]) for (const variation of variations) {
  const input = fixture(oldEngine, { actor, ...variation });
  const before = plain(input), oldResult = plain(oldEngine.apply(input)), newResult = plain(newEngine.apply(input));
  assert.equal(oldResult.ok, true); assert.equal(newResult.ok, true);
  const withoutName = plain(newResult); delete withoutName.publicState.lastPublicSkill;
  assert.deepEqual(withoutName, oldResult, "Only the public annotation may differ");
  assert.deepEqual(input, before, "Both executions leave input unchanged");
  assert.equal(oldEngine.validateState(newResult.state), true);
  const resume = state => ({ ...input, state, rngSnapshot: newResult.rngSnapshot, expectedVersion: 1,
    action: { type: "SURRENDER", payload: {} } });
  assert.deepEqual(plain(oldEngine.apply(resume(newResult.state))), plain(newEngine.apply(resume(oldResult.state))));
  const baseline = { roomId: "room", seat: "A", visible: true, ownColors: input.state.basicPalettes.A,
    skillRegistry: registry, state: plain(oldEngine.project(input.state, false, input.labMode).publicState) };
  const combinations = [];
  for (const [serverName, result] of [["old", oldResult], ["new", newResult]]) for (const [viewerName, ui] of [["old", oldViewer], ["new", newViewer]]) {
    const after = { ...baseline, state: result.publicState };
    const event = ui.describe(ui.snapshot(baseline), ui.snapshot(after), after);
    const expected = serverName === "new" && viewerName === "new" ? registry.skills[input.action.payload.skill].displayName : "スキルを使用";
    assert.equal(event?.title, expected, serverName + "/" + viewerName);
    assert.equal(event.eventId, input.state.matchId + ":1");
    combinations.push({ server: serverName, viewer: viewerName, title: event.title });
  }
  cases.push({ actor, scenario: variation.scenario, engineVersion: input.state.engineVersion,
    sameStateRngPrivateAndEffects: true, alternatingWorkersCompatible: true, combinations });
}
console.log(JSON.stringify({ ok: true, base, scope: "isolated actual fixed-base engines and viewer modules; not live or physical acceptance",
  oldBundleSha256: hash(oldSource), newBundleSha256: hash(newSource), oldCutinSha256: hash(oldCutinSource),
  newCutinSha256: hash(fs.readFileSync(path.join(root, cutinPath), "utf8")), cases }, null, 2));
