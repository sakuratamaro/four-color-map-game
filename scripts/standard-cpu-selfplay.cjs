"use strict";

const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const cpu = require("../standard/standard-cpu.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("../standard/standard-skill-registry.js");

function playGame({ seed, firstSeat = "A", levelA = "normal", levelB = "normal", legalRecolor = true, loadoutA = null, loadoutB = null, privateNoise = null, maxActions = 400 }) {
  const rng = createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  const loadouts = loadoutA || loadoutB
    ? { A: loadoutA || {}, B: loadoutB || {} }
    : (legalRecolor ? { A: { experimental: ["legalRecolor"] }, B: { experimental: ["legalRecolor"] } } : { A: {}, B: {} });
  let state = match.createStandardMatch({
    matchId: `selfplay-${seed}-${firstSeat}`,
    firstSeat,
    loadouts,
  }, rng);
  const levels = { A: levelA, B: levelB };
  let acceptedActions = 0;
  let rejectedActions = 0;
  let rejectedCode = null;
  let rejectedAction = null;
  const actionCounts = {};
  const skillUseCounts = {};
  const skillOpportunityCounts = {};
  const actionTrace = [];
  while (state.status === "ACTIVE" && acceptedActions < maxActions) {
    const seat = state.active;
    if (privateNoise !== null) {
      const opponent = seat === "A" ? "B" : "A";
      state.privateEffects[opponent].cpuAuditNoise = { token: String(privateNoise), turn: state.turn };
    }
    const observation = cpu.makeObservation({
      publicState: match.projectStandardPublicState(state),
      ownPrivateState: match.projectStandardPrivateState(state, seat),
      difficulty: levels[seat],
    });
    const candidates = cpu.enumerateCpuActions(observation);
    for (const skill of new Set(candidates.filter((candidate) => candidate.type === "USE_SKILL").map((candidate) => candidate.payload.skill))) {
      skillOpportunityCounts[skill] = (skillOpportunityCounts[skill] || 0) + 1;
    }
    const action = cpu.chooseCpuAction({
      observation,
      random: () => rng[`cpu-${seat}`].next(),
      tieBreakRandom: () => rng["cpu-tie-break"].next(),
    });
    if (!action) break;
    actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;
    const result = match.applyStandardAction({ state, actor: seat, action, expectedVersion: state.version, rngStreams: rng });
    if (!result.ok) {
      rejectedActions += 1;
      rejectedCode = result.code;
      rejectedAction = action;
      break;
    }
    if (action.type === "USE_SKILL") skillUseCounts[action.payload.skill] = (skillUseCounts[action.payload.skill] || 0) + 1;
    actionTrace.push({ seat, type: action.type, payload: action.payload });
    state = result.state;
    acceptedActions += 1;
  }
  return {
    seed,
    firstSeat,
    levelA,
    levelB,
    winner: state.winner,
    terminalReason: state.terminalReason,
    completed: state.status === "FINISHED",
    acceptedActions,
    rejectedActions,
    rejectedCode,
    rejectedAction,
    actionCounts,
    skillUseCounts,
    skillOpportunityCounts,
    actionTrace,
    skillsUsed: state.skillsUsed,
    regions: Object.keys(state.regions).length,
  };
}

function canonicalLoadoutFor(skillId) {
  const definition = STANDARD_SKILLS[skillId];
  if (!definition?.v49Catalogued) throw new TypeError("INVALID_CANONICAL_SKILL");
  return Object.fromEntries(["color", "area", "disrupt"].map((category) => {
    const ids = V49_SKILL_IDS.filter((id) => STANDARD_SKILLS[id].category === category);
    const primary = category === definition.category ? skillId : ids[0];
    const partner = ids[(ids.indexOf(primary) + 1) % ids.length];
    return [category, [primary, partner]];
  }));
}

function pairKey(left, right) {
  return [left, right].sort().join("|");
}

function combinations(ids) {
  const result = [];
  for (let left = 0; left < ids.length; left += 1) for (let right = left + 1; right < ids.length; right += 1) result.push([ids[left], ids[right]]);
  return result;
}

function canonicalInteractionLoadouts() {
  const categoryPairs = Object.fromEntries(["color", "area", "disrupt"].map((category) => {
    const ids = V49_SKILL_IDS.filter((id) => STANDARD_SKILLS[id].category === category);
    return [category, combinations(ids)];
  }));
  const candidates = [];
  for (const color of categoryPairs.color) for (const area of categoryPairs.area) for (const disrupt of categoryPairs.disrupt) {
    const ids = [...color, ...area, ...disrupt];
    candidates.push({
      loadout: { color: [...color], area: [...area], disrupt: [...disrupt] },
      pairs: new Set(combinations(ids).map(([left, right]) => pairKey(left, right))),
      key: ids.join("|"),
    });
  }
  const uncovered = new Set(combinations(V49_SKILL_IDS).map(([left, right]) => pairKey(left, right)));
  const selected = [];
  while (uncovered.size) {
    let best = null;
    let score = -1;
    for (const candidate of candidates) {
      let nextScore = 0;
      for (const pair of candidate.pairs) if (uncovered.has(pair)) nextScore += 1;
      if (nextScore > score || (nextScore === score && candidate.key < best.key)) {
        best = candidate;
        score = nextScore;
      }
    }
    if (!best || score <= 0) throw new Error("CANONICAL_INTERACTION_COVERAGE_STALLED");
    selected.push(best.loadout);
    for (const pair of best.pairs) uncovered.delete(pair);
  }
  return selected;
}

function simulateCanonicalInteractionMatrix({ seed = 16000, level = "hard" } = {}) {
  const loadouts = canonicalInteractionLoadouts();
  const games = loadouts.map((loadout, index) => playGame({
    seed: seed + index,
    firstSeat: index % 2 ? "B" : "A",
    levelA: level,
    levelB: level,
    loadoutA: loadout,
    loadoutB: loadout,
  }));
  const coveredPairs = new Set();
  const skillUseCounts = {};
  const skillOpportunityCounts = {};
  for (const [index, game] of games.entries()) {
    const ids = Object.values(loadouts[index]).flat();
    for (const [left, right] of combinations(ids)) coveredPairs.add(pairKey(left, right));
    for (const [id, count] of Object.entries(game.skillUseCounts)) skillUseCounts[id] = (skillUseCounts[id] || 0) + count;
    for (const [id, count] of Object.entries(game.skillOpportunityCounts)) skillOpportunityCounts[id] = (skillOpportunityCounts[id] || 0) + count;
  }
  const totalUses = Object.values(skillUseCounts).reduce((sum, count) => sum + count, 0);
  return {
    loadouts: loadouts.length,
    games: games.length,
    completed: games.filter((game) => game.completed).length,
    rejectedActions: games.reduce((sum, game) => sum + game.rejectedActions, 0),
    illegalTerminals: games.filter((game) => game.terminalReason === "ILLEGAL_COLOR").length,
    coveredPairs: coveredPairs.size,
    expectedPairs: combinations(V49_SKILL_IDS).length,
    skillUseCounts,
    skillOpportunityCounts,
    totalUses,
    maxUseShare: totalUses ? Math.max(...Object.values(skillUseCounts)) / totalUses : 0,
  };
}

function simulateCanonicalSkillMatrix({ seedsPerSkill = 1, seed = 9000, level = "hard" } = {}) {
  const games = [];
  const bySkill = {};
  const skillUseCounts = {};
  const skillOpportunityCounts = {};
  for (const [skillIndex, skillId] of V49_SKILL_IDS.entries()) {
    const loadout = canonicalLoadoutFor(skillId);
    const targetGames = [];
    for (let run = 0; run < seedsPerSkill; run += 1) {
      const game = playGame({
        seed: seed + skillIndex * seedsPerSkill + run,
        firstSeat: run % 2 ? "B" : "A",
        levelA: level,
        levelB: level,
        loadoutA: loadout,
        loadoutB: loadout,
      });
      games.push(game);
      targetGames.push(game);
      for (const [id, count] of Object.entries(game.skillUseCounts)) skillUseCounts[id] = (skillUseCounts[id] || 0) + count;
      for (const [id, count] of Object.entries(game.skillOpportunityCounts)) skillOpportunityCounts[id] = (skillOpportunityCounts[id] || 0) + count;
    }
    bySkill[skillId] = {
      games: targetGames.length,
      completed: targetGames.filter((game) => game.completed).length,
      rejectedActions: targetGames.reduce((sum, game) => sum + game.rejectedActions, 0),
      opportunities: targetGames.reduce((sum, game) => sum + (game.skillOpportunityCounts[skillId] || 0), 0),
      uses: targetGames.reduce((sum, game) => sum + (game.skillUseCounts[skillId] || 0), 0),
    };
  }
  const totalUses = Object.values(skillUseCounts).reduce((sum, count) => sum + count, 0);
  const maxUseCount = Math.max(0, ...Object.values(skillUseCounts));
  return {
    seedsPerSkill,
    games: games.length,
    completed: games.filter((game) => game.completed).length,
    rejectedActions: games.reduce((sum, game) => sum + game.rejectedActions, 0),
    illegalTerminals: games.filter((game) => game.terminalReason === "ILLEGAL_COLOR").length,
    bySkill,
    skillUseCounts,
    skillOpportunityCounts,
    totalUses,
    maxUseShare: totalUses ? maxUseCount / totalUses : 0,
  };
}

function simulatePaired({ pairs = 100, seed = 1, levelFirst = "normal", levelSecond = "normal", legalRecolor = true }) {
  const games = [];
  let firstPolicyWins = 0;
  let secondPolicyWins = 0;
  let firstMoverWins = 0;
  for (let pair = 0; pair < pairs; pair += 1) {
    const game1 = playGame({ seed: seed + pair * 2, firstSeat: "A", levelA: levelFirst, levelB: levelSecond, legalRecolor });
    const game2 = playGame({ seed: seed + pair * 2 + 1, firstSeat: "B", levelA: levelFirst, levelB: levelSecond, legalRecolor });
    games.push(game1, game2);
    if (game1.winner === "A") firstPolicyWins += 1; else if (game1.winner === "B") secondPolicyWins += 1;
    if (game2.winner === "A") firstPolicyWins += 1; else if (game2.winner === "B") secondPolicyWins += 1;
    if (game1.winner === game1.firstSeat) firstMoverWins += 1;
    if (game2.winner === game2.firstSeat) firstMoverWins += 1;
  }
  const completed = games.filter((game) => game.completed).length;
  const illegalTerminals = games.filter((game) => game.terminalReason === "ILLEGAL_COLOR").length;
  const rejectedActions = games.reduce((sum, game) => sum + game.rejectedActions, 0);
  const meanActions = games.reduce((sum, game) => sum + game.acceptedActions, 0) / Math.max(1, games.length);
  const skillUses = games.reduce((sum, game) => sum + game.skillsUsed.A + game.skillsUsed.B, 0);
  return {
    pairs,
    games: games.length,
    completed,
    illegalTerminals,
    rejectedActions,
    firstPolicyWins,
    secondPolicyWins,
    firstMoverWins,
    firstMoverWinRate: firstMoverWins / Math.max(1, games.length),
    meanActions,
    skillUses,
    skillUsePerGame: skillUses / Math.max(1, games.length),
    terminalReasons: Object.fromEntries([...new Set(games.map((game) => game.terminalReason))].sort().map((reason) => [reason, games.filter((game) => game.terminalReason === reason).length])),
  };
}

if (require.main === module) {
  const pairs = Number(process.argv[2] || 100);
  process.stdout.write(JSON.stringify(simulatePaired({ pairs, seed: 5000 }), null, 2) + "\n");
}

module.exports = { canonicalInteractionLoadouts, canonicalLoadoutFor, playGame, simulateCanonicalInteractionMatrix, simulateCanonicalSkillMatrix, simulatePaired };
