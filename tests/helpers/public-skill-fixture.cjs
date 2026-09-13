"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const plain = value => JSON.parse(JSON.stringify(value));
function loadEngine(source = fs.readFileSync(path.join(root, "supabase/functions/standard-game-action/standard-engine.bundle.js"), "utf8")) {
  const context = vm.createContext({});
  vm.runInContext(source, context, { filename: "standard-engine.bundle.js", timeout: 10_000 });
  return context.FourColorStandardServerEngine;
}
function fixture(api, { actor = "A", engineVersion = api.ENGINE_VERSION, scenario = "work" } = {}) {
  const loadout = { color: ["colorPaletteChange", "colorRandomBorrow"], area: ["areaDiePlus", "areaResize"],
    disrupt: ["disruptPaletteChoice", "disruptChoiceOne"] };
  const labMode = scenario === "recolor";
  const created = api.create({ matchId: "public-skill-fixture", loadouts: { A: loadout, B: loadout },
    seed: 100, firstSeat: actor, engineVersion, labMode });
  const state = plain(created.state), other = actor === "A" ? "B" : "A";
  state.requiredSize = state.baseRequiredSize = state.rolledSize = 1;
  let action = { type: "USE_SKILL", payload: { skill: "areaDiePlus" } };
  if (scenario === "miss") {
    state.phase = "WORK";
    state.basicPalettes[other] = ["red", "red"]; state.bonusColors[other] = "red";
    action = { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "red" } };
  } else if (["palette", "borrow-reject"].includes(scenario)) {
    const { macroWidth: width, microScale: scale } = state.playableBounds, macro = width + 1;
    const micro = Array.from({ length: scale * scale }, (_, i) =>
      (scale + Math.floor(i / scale)) * width * scale + scale + i % scale);
    state.phase = "COLOR"; state.pending = "R1";
    state.regions = { R1: { id: "R1", micro, sourceMacros: [macro], controllers: [other], color: null, isPending: true } };
    const color = ["red", "blue", "green", "yellow"].find(value => !state.basicPalettes[actor].includes(value) && value !== state.bonusColors[actor]);
    action = scenario === "palette" ? { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 0, color } }
      : { type: "USE_SKILL", payload: { skill: "colorRandomBorrow" } };
  } else if (scenario === "recolor") {
    state.phase = "WORK";
    state.regions = {
      R1: { id: "R1", micro: [48], sourceMacros: [], controllers: [actor], color: "red", isPending: false },
      R2: { id: "R2", micro: [49], sourceMacros: [], controllers: [other], color: "blue", isPending: false },
    };
    action = { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } };
  } else if (scenario === "surrender") action = { type: "SURRENDER", payload: {} };
  api.validateState(state);
  return { state, rngSnapshot: plain(created.rngSnapshot), actor, action, expectedVersion: state.version, labMode };
}
module.exports = { loadEngine, fixture, plain, root };
