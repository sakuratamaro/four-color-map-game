"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit actual-browser gate */ }

const root = path.join(__dirname, "..");
const moduleIds = [
  "standard/standard-engine.js",
  "standard/standard-skill-registry.js",
  "standard/standard-skill-handlers.js",
  "standard/standard-skill-dispatcher.js",
  "standard/standard-match.js",
  "standard/standard-cpu.js",
  "scripts/standard-cpu-selfplay.cjs",
];

function browserExecutable() {
  return [
    process.env.PLAYWRIGHT_BROWSER_EXECUTABLE,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    chromium?.executablePath(),
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function browserBundle() {
  const modules = moduleIds.map((id) => `${JSON.stringify(id)}:function(require,module,exports){\n${fs.readFileSync(path.join(root, id), "utf8")}\n}`).join(",\n");
  return `"use strict";(()=>{const modules={${modules}};const cache={};function normalize(parts){const out=[];for(const part of parts){if(!part||part===".")continue;if(part==="..")out.pop();else out.push(part);}return out.join("/");}function load(id){if(cache[id])return cache[id].exports;if(!modules[id])throw new Error("Unknown module: "+id);const module={exports:{}};cache[id]=module;const base=id.split("/").slice(0,-1);const localRequire=(request)=>load(request.startsWith(".")?normalize([...base,...request.split("/")]):request);modules[id](localRequire,module,module.exports);return module.exports;}globalThis.__standardCpuBrowser={cpu:load("standard/standard-cpu.js"),selfplay:load("scripts/standard-cpu-selfplay.cjs")};})();`;
}

test("actual Edge reproduces canonical CPU skill, interaction, dominance, and privacy gates", { timeout: 60000 }, async (t) => {
  assert.ok(chromium, "Playwright is required");
  const executablePath = browserExecutable();
  assert.ok(executablePath, "Edge or Chromium is required");
  const browser = await chromium.launch({ headless: true, executablePath });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.setContent("<!doctype html><html><body><main>Standard CPU browser gate</main></body></html>");
  await page.addScriptTag({ content: browserBundle() });

  const result = await page.evaluate(() => {
    const { selfplay } = globalThis.__standardCpuBrowser;
    const skill = selfplay.simulateCanonicalSkillMatrix({ seedsPerSkill: 1, seed: 12000, level: "hard" });
    const interaction = selfplay.simulateCanonicalInteractionMatrix({ seed: 16000, level: "hard" });
    const loadout = selfplay.canonicalLoadoutFor("disruptForcedPalette");
    const left = selfplay.playGame({ seed: 13001, firstSeat: "B", levelA: "hard", levelB: "hard", loadoutA: loadout, loadoutB: loadout, privateNoise: "EDGE-LEFT" });
    const right = selfplay.playGame({ seed: 13001, firstSeat: "B", levelA: "hard", levelB: "hard", loadoutA: loadout, loadoutB: loadout, privateNoise: "EDGE-RIGHT" });
    return {
      skill: { games: skill.games, completed: skill.completed, rejectedActions: skill.rejectedActions, illegalTerminals: skill.illegalTerminals, used: Object.keys(skill.skillUseCounts).length, maxUseShare: skill.maxUseShare },
      interaction: { loadouts: interaction.loadouts, games: interaction.games, completed: interaction.completed, rejectedActions: interaction.rejectedActions, illegalTerminals: interaction.illegalTerminals, coveredPairs: interaction.coveredPairs, expectedPairs: interaction.expectedPairs, used: Object.keys(interaction.skillUseCounts).length, maxUseShare: interaction.maxUseShare },
      privateTraceEqual: JSON.stringify(left) === JSON.stringify(right),
      privateLeak: JSON.stringify({ left, right }).includes("EDGE-LEFT") || JSON.stringify({ left, right }).includes("EDGE-RIGHT"),
    };
  });

  assert.deepEqual(result.skill, { games: 19, completed: 19, rejectedActions: 0, illegalTerminals: 0, used: 19, maxUseShare: result.skill.maxUseShare });
  assert.ok(result.skill.maxUseShare < 0.2);
  assert.deepEqual(result.interaction, { loadouts: 31, games: 31, completed: 31, rejectedActions: 0, illegalTerminals: 0, coveredPairs: 171, expectedPairs: 171, used: 19, maxUseShare: result.interaction.maxUseShare });
  assert.ok(result.interaction.maxUseShare < 0.2);
  assert.equal(result.privateTraceEqual, true);
  assert.equal(result.privateLeak, false);
  assert.deepEqual(pageErrors, []);
});
