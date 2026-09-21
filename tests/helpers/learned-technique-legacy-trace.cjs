"use strict";

// Fixed ordinary-card trace, used to pin byte-for-byte pre-pilot behavior.
module.exports = function legacyTrace(engine, match, engineVersion, seed) {
  const rngStreams = engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  const loadout = { color: ["colorPrism", "colorRandomBorrow"], area: ["areaDiePlus", "areaResize"], disrupt: ["disruptChoiceOne", "disruptRandomTwo"] };
  let state = match.createStandardMatch({ matchId: "legacy-trace-" + seed, firstSeat: "A", engineVersion,
    loadouts: { A: loadout, B: loadout } }, rngStreams);
  const transcript = [];
  function record() {
    transcript.push({ state, publicState: match.projectStandardPublicState(state),
      privateA: match.projectStandardPrivateState(state, "A"), privateB: match.projectStandardPrivateState(state, "B"),
      save: match.encodeStandardMatch(state, engine.snapshotRngDomains(rngStreams, match.REQUIRED_RNG_STREAMS)) });
  }
  function act(type, payload) {
    const result = match.applyStandardAction({ state, actor: state.active, expectedVersion: state.version, action: { type, payload }, rngStreams });
    if (!result.ok) throw new Error(result.code);
    state = result.state;
    record();
  }
  record();
  const firstSize = state.requiredSize;
  act("CREATE_REGION", { sourceMacros: Array.from({ length: firstSize }, (_, i) => 13 + i) });
  act("USE_SKILL", { skill: "colorPrism" });
  act("COLOR_REGION", { color: "blue" });
  act("USE_SKILL", { skill: "areaDiePlus" });
  act("CREATE_REGION", { sourceMacros: Array.from({ length: state.requiredSize }, (_, i) => 13 + firstSize + i) });
  act("COLOR_REGION", { color: state.basicPalettes.A.find((color) => color !== "blue") });
  return transcript;
};
