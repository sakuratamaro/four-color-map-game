"use strict";

// UDL-051 bounded, offline baseline diagnosis. Does not modify product sources,
// contact a service, replay a historical user match, or establish CPU strength.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");

function diagnose(sourceRoot) {
  const engine = require(path.join(sourceRoot, "standard/standard-engine.js"));
  const match = require(path.join(sourceRoot, "standard/standard-match.js"));
  const cpu = require(path.join(sourceRoot, "standard/standard-cpu.js"));
  const roster = require(path.join(sourceRoot, "standard/standard-cpu-roster.js"));
  const character = roster.CPU_CHARACTERS.kurogane;
  const started = performance.now();
  const streams = (seed) => engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  const observation = (state, seat) => ({
    publicState: match.projectStandardPublicState(state),
    ownPrivateState: match.projectStandardPrivateState(state, seat),
  });
  const candidates = (state, seat) => cpu.enumerateCpuActions(cpu.makeObservation({ ...observation(state, seat), difficulty: "hard" }));
  const choose = (state, seat, personality = character) => roster.chooseCharacterAction({
    ...observation(state, seat), characterId: personality.id,
    policyVersion: personality.policyVersion, random: () => 0, tieBreakRandom: () => 0,
  });
  function apply(state, seat, action, rng) {
    const result = match.applyStandardAction({ state, actor: seat, action, expectedVersion: state.version, rngStreams: rng });
    assert.equal(result.ok, true, `${action.type}/${action.payload?.skill || ""}: ${result.code}`);
    return result.state;
  }
  function create(seed, firstSeat, personality = character) {
    return match.createStandardMatch({ matchId: `cpu-offline-${seed}`, firstSeat,
      loadouts: { A: personality.loadout, B: personality.loadout } }, streams(seed));
  }
  function privacyCheck(state, seat, personality = character) {
    const other = seat === "A" ? "B" : "A";
    const poisoned = structuredClone(state);
    poisoned.hands[other] = { colorPrism: 999 };
    poisoned.privateEffects[other] = { offlineAuditPoison: "must-not-affect-choice" };
    assert.deepEqual(choose(state, seat, personality), choose(poisoned, seat, personality));
    return true;
  }

  // F1 is reached by an actual accepted opening, not an invented candidate list.
  const firstRng = streams(42051);
  const first = create(42051, "B");
  const opening = candidates(first, "B").find((action) => action.type === "CREATE_REGION");
  assert.ok(opening);
  const colorState = apply(first, "B", opening, firstRng);
  assert.equal(colorState.phase, "COLOR");
  const legalColors = candidates(colorState, "A").filter((action) => action.type === "COLOR_REGION");
  assert.ok(legalColors.length > 0);
  const selectedColor = choose(colorState, "A");
  const changedColor = apply(colorState, "A", selectedColor, streams(42051));
  const beforePalette = match.projectStandardPrivateState(colorState, "A").basicPalette;
  const afterPalette = match.projectStandardPrivateState(changedColor, "A").basicPalette;
  const findings = [{
    id: "F1", fixture: "accepted deterministic opening; isolated unblocked incoming region",
    selected: { type: selectedColor.type, payload: selectedColor.payload },
    legalColorCount: legalColors.length,
    selectedAccepted: true,
    legalColorAccepted: Boolean(apply(colorState, "A", legalColors[0], streams(42051))),
    beforePalette, afterPalette,
    distinctBasicColorsBefore: new Set(beforePalette).size,
    distinctBasicColorsAfter: new Set(afterPalette).size,
    reproduced: selectedColor.type === "USE_SKILL" && selectedColor.payload.skill === "colorPaletteChange",
    privacyUnchanged: privacyCheck(colorState, "A"),
  }];

  // F2 uses an explicitly authored position. Both alternative sequences are
  // checked by the real engine; this is not claimed to be a recorded match.
  const work = create(42052, "A");
  work.phase = "WORK";
  work.turn = 1;
  work.requiredSize = work.rolledSize = work.baseRequiredSize = 1;
  work.hands.A = { disruptChoiceThree: 1 };
  const bounds = work.playableBounds;
  const macroWidth = bounds.macroWidth;
  const scale = bounds.microScale;
  const microWidth = macroWidth * scale;
  function region(id, macro, color) {
    const row = Math.floor(macro / macroWidth), col = macro % macroWidth;
    const micro = [];
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) micro.push((row * scale + dy) * microWidth + col * scale + dx);
    return { id, micro, sourceMacros: [macro], controllers: ["B"], color, isPending: false };
  }
  work.regions = { R1: region("R1", 1, "red"), R2: region("R2", macroWidth, "blue"), R3: region("R3", macroWidth + 2, "yellow") };
  const options = (state, action) => cpu.immediateOpponentColorOptions(cpu.makeObservation({ ...observation(state, "A"), difficulty: "hard" }), action);
  const workActions = candidates(work, "A");
  const tacticalSeals = workActions.filter((action) => action.type === "USE_SKILL" && action.metrics.sealOpportunity === 1);
  const selectedWork = choose(work, "A");
  apply(work, "A", selectedWork, streams(42052));
  const seal = tacticalSeals.find((action) => action.payload.color === "green");
  assert.ok(seal, "real enumeration should include a tactical green seal");
  const sealed = apply(work, "A", seal, streams(42052));
  const createAfterSeal = candidates(sealed, "A").find((action) => action.type === "CREATE_REGION" && options(sealed, action).length === 0);
  assert.ok(createAfterSeal, "seal should allow a region with no ordinary public color reply");
  apply(sealed, "A", createAfterSeal, streams(42053));
  findings.push({
    id: "F2", fixture: "authored WORK position with three colored neighbors; not historical replay",
    selected: { type: selectedWork.type, payload: selectedWork.payload },
    selectedAccepted: true,
    selectedOrdinaryReplyColors: selectedWork.type === "CREATE_REGION" ? options(work, selectedWork) : null,
    tacticalSeal: { payload: seal.payload, metrics: seal.metrics },
    sealAndCreateAccepted: true,
    createAfterSeal: createAfterSeal.payload,
    ordinaryReplyColorsAfterSeal: options(sealed, createAfterSeal),
    reproduced: selectedWork.type === "CREATE_REGION" && options(work, selectedWork).length > 0,
    privacyUnchanged: privacyCheck(work, "A"),
    limitation: "Zero ordinary public colors is not proof of victory; opponent rescue cards are private and not inspected.",
  });
  // v7's asymmetric split hypothesis: the remaining side is not equivalent to
  // its complement, because only the selected side must be colored by us.
  for (const mirrored of [false, true]) {
    const splitPersonality = roster.CPU_CHARACTERS.rei;
    const splitState = create(42054, "A", splitPersonality);
    splitState.phase = "COLOR";
    splitState.turn = 1;
    splitState.pending = "R3";
    splitState.reserved = null;
    splitState.basicPalettes.A = ["red", "blue"];
    splitState.bonusColors.A = "yellow";
    splitState.bonusUsesRemaining.A = 0;
    splitState.hands.A = { colorRegionSplit: 1 };
    const left = macroWidth + 1, right = macroWidth + 2;
    const red = mirrored ? 2 : 1;
    const blue = mirrored ? macroWidth + 3 : macroWidth;
    splitState.regions = {
      R1: region("R1", red, "red"), R2: region("R2", blue, "blue"),
      R3: { id: "R3", micro: [...region("", left, null).micro, ...region("", right, null).micro],
        sourceMacros: [left, right], controllers: ["B"], color: null, isPending: true },
    };
    match.validateStandardState(splitState);
    const selected = choose(splitState, "A", splitPersonality);
    const actualCandidates = candidates(splitState, "A");
    const safeMacro = mirrored ? left : right;
    const acceptedSplit = apply(splitState, "A", { type: "USE_SKILL", payload: {
      skill: "colorRegionSplit", regionId: "R3", sourceMacros: [safeMacro],
    } }, streams(42054));
    const reserved = acceptedSplit.reserved;
    const safeColor = candidates(acceptedSplit, "A").find((action) => action.type === "COLOR_REGION");
    assert.ok(safeColor, "the previously omitted split side can be legally colored");
    const returned = apply(acceptedSplit, "A", safeColor, streams(42055));
    assert.equal(returned.active, "B");
    assert.equal(returned.pending, reserved);
    assert.equal(returned.phase, "COLOR");
    findings.push({ id: mirrored ? "F3_MIRROR_CONTROL" : "F3_SPLIT_ORIENTATION",
      characterId: splitPersonality.id,
      fixture: "authored valid state, isolated split card, blocked basic colors and bonus0",
      selected: { type: selected.type, payload: selected.payload },
      safeMacro, enumeratedSafeSide: actualCandidates.some((action) => action.payload?.skill === "colorRegionSplit" && action.payload.sourceMacros.includes(safeMacro)),
      splitThenColorThenOpponentReturnAccepted: true,
      reproduced: !mirrored && selected.type === "SURRENDER",
      mirrorControlPassed: mirrored ? selected.type === "USE_SKILL" && selected.payload.skill === "colorRegionSplit" : null,
      privacyUnchanged: privacyCheck(splitState, "A", splitPersonality),
    });
  }
  const sourceFiles = ["standard/standard-cpu-roster.js", "standard/standard-cpu.js", "standard/standard-match.js"];
  return {
    scope: "offline authoritative enumeration/action-acceptance diagnosis, not benchmark or live verification",
    sourceRoot, policyVersion: character.policyVersion,
    sourceGitBlobs: Object.fromEntries(sourceFiles.map((file) => {
      const bytes = fs.readFileSync(path.join(sourceRoot, file));
      return [file, crypto.createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex")];
    })),
    elapsedMs: Math.round(performance.now() - started),
    findings,
    reproducedCount: findings.filter((finding) => finding.reproduced).length,
  };
}

if (require.main === module) {
  const sourceArg = process.argv.slice(2).find((arg) => arg.startsWith("--source="));
  const sourceRoot = path.resolve(sourceArg ? sourceArg.slice(9) : path.join(__dirname, ".."));
  try {
    const result = diagnose(sourceRoot);
    console.log(JSON.stringify(result, null, 2));
    if (process.argv.includes("--assert-fixed") && result.reproducedCount > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`DIAGNOSIS_NOT_COMPLETED: ${error.stack}`);
    process.exitCode = 2;
  }
}
module.exports = { diagnose };
