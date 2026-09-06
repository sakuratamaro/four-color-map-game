const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const commentary = require("../standard-online-v5/cpu-commentary.js");
const roster = require("../standard/standard-cpu-roster.js");
const match = require("../standard/standard-match.js");

function activeState(overrides = {}) {
  const matchId = overrides.matchId || "match-commentary";
  const version = overrides.version || 8;
  return {
    matchId,
    version,
    status: "ACTIVE",
    winner: null,
    terminalReason: null,
    lastPublicTrace: {
      eventId: `${matchId}:${version}`,
      version,
      type: "USE_SKILL",
      actor: "B",
    },
    ...overrides,
  };
}

function finishedState({ winner = "B", terminalReason = "NO_LEGAL_COLOR", contactColorCount = 4, version = 12 } = {}) {
  const matchId = "match-finished";
  return {
    matchId,
    version,
    status: "FINISHED",
    winner,
    terminalReason,
    pending: contactColorCount === null ? null : "R8",
    lastPublicTrace: contactColorCount === null ? null : {
      eventId: `${matchId}:${version}`,
      version,
      type: "CREATE_REGION",
      actor: winner,
      regionId: "R8",
      sourceMacroCount: 2,
      contactColorCount,
    },
  };
}

test("CPU commentary roster stays aligned with all ten playable CPU characters", () => {
  assert.deepEqual(commentary.CPU_CHARACTER_IDS, Object.keys(roster.CPU_CHARACTERS));
  assert.deepEqual(commentary.TERMINAL_REASONS, match.TERMINAL_REASONS);
  assert.equal(commentary.CPU_CHARACTER_IDS.length, 10);
  assert.equal(Object.isFrozen(commentary.CPU_VOICES), true);
  for (const id of commentary.CPU_CHARACTER_IDS) {
    const voice = commentary.CPU_VOICES[id];
    for (const key of ["ambient", "skill", "pressure", "threatened", "opponentSkill", "win", "loss", "noColorLoss"]) {
      assert.ok(voice[key]?.length, `${id}.${key}`);
    }
  }
});

test("CPU no-color surrender keeps SURRENDER as the result and explains its public COLOR context", () => {
  const state = finishedState({ winner: "A", terminalReason: "SURRENDER", contactColorCount: 3, version: 12 });
  state.lastPublicTrace.version = 11;
  state.lastPublicTrace.eventId = `${state.matchId}:11`;
  const kurogane = commentary.chooseCpuCommentary({ characterId: "kurogane", publicState: state });
  assert.equal(kurogane.reason, "SURRENDER");
  assert.match(kurogane.text, /まさか合法色がない……だと……！？/);
  assert.match(kurogane.text, /自分で投了/);

  const yuzu = commentary.chooseCpuCommentary({ characterId: "yuzu", publicState: state });
  assert.match(yuzu.text, /ミスったー！！/);

  const ordinary = commentary.chooseCpuCommentary({
    characterId: "kurogane",
    publicState: finishedState({ winner: "A", terminalReason: "SURRENDER", contactColorCount: null, version: 12 }),
  });
  assert.doesNotMatch(ordinary.text, /合法色/);
});

test("notable confirmed actions select character-specific lines without gameplay RNG", () => {
  const skillState = activeState();
  const rei = commentary.chooseCpuCommentary({ characterId: "rei", publicState: skillState });
  assert.equal(rei.kind, "skill");
  assert.match(rei.text, /スキルの恐ろしさ/);
  assert.equal(rei.announce, true);

  const pressured = activeState({
    lastPublicTrace: {
      eventId: "match-commentary:8", version: 8, type: "CREATE_REGION", actor: "A",
      regionId: "R6", sourceMacroCount: 3, contactColorCount: 3,
    },
  });
  const ren = commentary.chooseCpuCommentary({ characterId: "ren", publicState: pressured });
  assert.equal(ren.kind, "threatened");
  assert.match(ren.text, /しまった/);

  const attack = activeState({
    lastPublicTrace: {
      eventId: "match-commentary:8", version: 8, type: "CREATE_REGION", actor: "B",
      regionId: "R7", sourceMacroCount: 2, contactColorCount: 4,
    },
  });
  const kurogane = commentary.chooseCpuCommentary({ characterId: "kurogane", publicState: attack });
  assert.equal(kurogane.kind, "pressure");
  assert.match(kurogane.text, /美技に酔いな/);
  assert.deepEqual(commentary.chooseCpuCommentary({ characterId: "kurogane", publicState: attack }), kurogane);
});

test("terminal lines state the public reason for both CPU wins and losses", () => {
  const cpuWin = commentary.chooseCpuCommentary({ characterId: "rei", publicState: finishedState() });
  assert.equal(cpuWin.kind, "terminal-win");
  assert.match(cpuWin.text, /勝ち筋にも.*理由/);
  assert.match(cpuWin.text, /四色に接するエリア.*あなたの塗れる色/);

  const cpuLoss = commentary.chooseCpuCommentary({
    characterId: "kurogane",
    publicState: finishedState({ winner: "A", contactColorCount: 3 }),
  });
  assert.equal(cpuLoss.kind, "terminal-loss");
  assert.match(cpuLoss.text, /見事なエリア選択.*完敗/);
  assert.match(cpuLoss.text, /三色に接するエリア.*こちらの塗れる色/);

  const reasonSignals = {
    SURRENDER: /投了/,
    BOARD_LOCK: /これ以上エリアを作れない盤面/,
    ILLEGAL_COLOR: /接色禁止違反/,
    SEALED_OUT: /色封じ.*0色/,
    NO_LEGAL_COLOR: /塗れる色/,
  };
  for (const winner of ["A", "B"]) {
    for (const [terminalReason, pattern] of Object.entries(reasonSignals)) {
      const line = commentary.chooseCpuCommentary({
        characterId: "aoi",
        publicState: finishedState({ winner, terminalReason, contactColorCount: terminalReason === "NO_LEGAL_COLOR" ? 4 : null }),
      });
      assert.match(line.text, pattern, `${winner}/${terminalReason}`);
      assert.equal(line.priority, "terminal");
      assert.equal(line.reason, terminalReason);
    }
  }
});

test("every character keeps a distinct voice at the same terminal event", () => {
  const lines = commentary.CPU_CHARACTER_IDS.map((characterId) => commentary.chooseCpuCommentary({
    characterId,
    publicState: finishedState({ winner: "A", contactColorCount: 4 }),
  }).text);
  assert.equal(new Set(lines).size, commentary.CPU_CHARACTER_IDS.length);
});

test("event identity, visibility, and cooldown suppress duplicate or noisy active lines", () => {
  const state = activeState();
  const first = commentary.chooseCpuCommentary({ characterId: "rei", publicState: state });
  assert.equal(commentary.chooseCpuCommentary({ characterId: "rei", publicState: state, presentedEventIds: [first.eventId] }), null);
  assert.equal(commentary.chooseCpuCommentary({ characterId: "rei", publicState: state, visible: false }), null);
  assert.equal(commentary.chooseCpuCommentary({ characterId: "rei", publicState: state, lastPresented: { matchId: state.matchId, version: 6 } }), null);
  assert.ok(commentary.chooseCpuCommentary({ characterId: "rei", publicState: state, lastPresented: { matchId: state.matchId, version: 4 } }));
  assert.ok(commentary.chooseCpuCommentary({ characterId: "rei", publicState: state, lastPresented: { matchId: "previous-match", version: 30 } }));

  const terminal = finishedState({ version: 9 });
  assert.ok(commentary.chooseCpuCommentary({ characterId: "rei", publicState: terminal, lastPresented: { matchId: terminal.matchId, version: 8 } }));
});

test("strict public trace allowlist rejects stale, malformed, or enriched events", () => {
  const state = activeState();
  assert.ok(commentary.validPublicTrace(state));
  assert.equal(commentary.validPublicTrace({ ...state, lastPublicTrace: { ...state.lastPublicTrace, skill: "disruptChoiceThree" } }), null);
  assert.equal(commentary.validPublicTrace({ ...state, lastPublicTrace: { ...state.lastPublicTrace, version: 7 } }), null);
  assert.equal(commentary.validPublicTrace({ ...state, lastPublicTrace: { ...state.lastPublicTrace, eventId: "forged" } }), null);
  assert.equal(commentary.validPublicTrace({ ...state, matchId: undefined, lastPublicTrace: { ...state.lastPublicTrace, eventId: "undefined:8" } }), null);
  assert.equal(commentary.validPublicTrace({ ...state, matchId: "" }), null);
  for (const version of [0, -1]) {
    const invalidVersion = {
      ...state,
      version,
      lastPublicTrace: { ...state.lastPublicTrace, version, eventId: `${state.matchId}:${version}` },
    };
    assert.equal(commentary.validPublicTrace(invalidVersion), null);
    assert.equal(commentary.chooseCpuCommentary({ characterId: "rei", publicState: { ...finishedState(), version } }), null);
  }
  assert.equal(commentary.chooseCpuCommentary({ characterId: "unknown", publicState: state }), null);
});

test("no-color cause names a contact tier only for the winning current CREATE event", () => {
  const grounded = finishedState({ winner: "B", contactColorCount: 2 });
  assert.match(commentary.chooseCpuCommentary({ characterId: "rei", publicState: grounded }).text, /二色に接するエリアを渡し/);
  const seatACpu = finishedState({ winner: "A", contactColorCount: 3 });
  assert.match(commentary.chooseCpuCommentary({ characterId: "rei", cpuSeat: "A", publicState: seatACpu }).text, /三色に接するエリアを渡し/);

  const mismatches = [
    { ...grounded, pending: "R9" },
    { ...grounded, lastPublicTrace: { ...grounded.lastPublicTrace, actor: "A" } },
    {
      ...grounded,
      lastPublicTrace: { eventId: `${grounded.matchId}:${grounded.version}`, version: grounded.version, type: "COLOR_REGION", actor: "B", regionId: "R8", color: "red" },
    },
    { ...grounded, lastPublicTrace: null },
  ];
  for (const state of mismatches) {
    const line = commentary.chooseCpuCommentary({ characterId: "rei", publicState: state });
    assert.match(line.text, /公開盤面で、あなたの塗れる色がなくなりました/);
    assert.doesNotMatch(line.text, /色に接するエリアを渡し/);
  }
});

test("selector does not read private match fields", () => {
  const state = activeState();
  for (const key of ["hands", "loadouts", "basicPalettes", "bonusColors", "privateEffects"]) {
    Object.defineProperty(state, key, { enumerable: false, get() { throw new Error(`PRIVATE_READ:${key}`); } });
  }
  assert.doesNotThrow(() => commentary.chooseCpuCommentary({ characterId: "shion", publicState: state }));

  const publicKeys = new Set(["matchId", "version", "status", "winner", "terminalReason", "lastPublicTrace", "pending"]);
  const traceKeys = new Set(["eventId", "version", "type", "actor"]);
  const strictTrace = new Proxy(state.lastPublicTrace, {
    get(target, key, receiver) {
      if (typeof key === "string" && !traceKeys.has(key)) throw new Error(`NON_PUBLIC_TRACE_READ:${key}`);
      return Reflect.get(target, key, receiver);
    },
  });
  const strictState = new Proxy({ ...state, lastPublicTrace: strictTrace }, {
    get(target, key, receiver) {
      if (typeof key === "string" && !publicKeys.has(key)) throw new Error(`NON_PUBLIC_STATE_READ:${key}`);
      return Reflect.get(target, key, receiver);
    },
  });
  assert.doesNotThrow(() => commentary.chooseCpuCommentary({ characterId: "shion", publicState: strictState }));

  const source = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "cpu-commentary.js"), "utf8");
  for (const forbidden of ["basicPalettes", "bonusColors", "privateEffects", "ownPrivateState", "actionScore"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
  assert.doesNotMatch(source, /Math\.random|crypto/);
});
