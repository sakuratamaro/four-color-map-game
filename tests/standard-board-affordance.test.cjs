"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const match = require("../standard/standard-match.js");
const { halfShiftScenario, acceptedShapes } = require("./helpers/board-affordance-fixture.cjs");
const app = fs.readFileSync(path.join(__dirname, "../standard-online-v5/app.js"), "utf8");
const geometry = app.slice(app.indexOf("function playableMacro("), app.indexOf("function boardMacroDescription("));
const rendering = app.slice(app.indexOf("const BOARD_AFFORDANCE ="), app.indexOf("function phaseLabelFor("));
const colors = { red: "#ef4444", blue: "#3b82f6", yellow: "#eab308", green: "#22c55e" };

function renderFixture(state, { selected = [], candidates = [0, 2], focus = false, focusMacro = 1,
  target = null, interactive = true, displayWidth = 390 } = {}) {
  const records = [], stack = [];
  const ctx = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, dash: [],
    save() { stack.push([this.fillStyle, this.strokeStyle, this.lineWidth, this.dash]); },
    restore() { [this.fillStyle, this.strokeStyle, this.lineWidth, this.dash] = stack.pop(); },
    setLineDash(value) { this.dash = value; },
    fillRect(x, y, width, height) { records.push({ kind: "fill", x, y, width, height, color: this.fillStyle }); },
    strokeRect(x, y, width, height) { records.push({ kind: "stroke", x, y, width, height, color: this.strokeStyle, lineWidth: this.lineWidth, dash: [...this.dash] }); },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, fillText() {},
  };
  const canvas = { width: 960, height: 960, dataset: {}, attributes: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ width: displayWidth }), setAttribute(key, value) { this.attributes[key] = value; } };
  ctx.canvas = canvas;
  const sandbox = { targetDraft: target, selectedMacros: new Set(selected), COLOR_HEX: colors,
    document: { activeElement: focus ? canvas : null }, $: () => canvas,
    boardSelectionAvailable: () => interactive, syncBoardSelectionAssist: () => interactive,
    visibleOutgoingMacros: () => selected, cornerBloomCellTargetActive: () => target?.kind === "corner-bloom",
    cornerBloomSelectableMicros: () => [0, 2], ensureBoardKeyboardMicro: () => 0,
    ensureBoardKeyboardMacro: () => focusMacro, eligibleRecolorRegions: () => [] };
  vm.createContext(sandbox);
  vm.runInContext(geometry + "\n" + rendering, sandbox, { timeout: 1000 });
  sandbox.startCandidateMacros = () => selected.length ? new Set() : new Set(candidates);
  sandbox.connectedCandidateMacros = () => selected.length ? new Set(candidates) : new Set();
  const before = JSON.stringify(state);
  sandbox.renderBoard(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual([...sandbox.selectedMacros], selected);
  const tones = vm.runInContext("BOARD_AFFORDANCE", sandbox);
  const microWidth = state.playableBounds.macroWidth * state.playableBounds.microScale, cell = canvas.width / microWidth;
  const sample = micro => {
    const x = ((micro % microWidth) + .5) * cell, y = (Math.floor(micro / microWidth) + .5) * cell;
    let color;
    for (const r of records) {
      if (r.kind === "fill" && x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height) color = r.color;
      if (r.kind === "stroke") {
        const half = r.lineWidth / 2;
        const outer = x >= r.x - half && x <= r.x + r.width + half && y >= r.y - half && y <= r.y + r.height + half;
        const inner = x > r.x + half && x < r.x + r.width - half && y > r.y + half && y < r.y + r.height - half;
        if (outer && !inner) color = r.color;
      }
    }
    return color;
  };
  return { tones, records, canvas, sample };
}

function board() {
  return { status: "ACTIVE", phase: "WORK", active: "A", requiredSize: 2, version: 1,
    playableBounds: { macroWidth: 4, microScale: 2, minCol: 0, minRow: 0, maxCol: 2, maxRow: 2 },
    regions: Object.fromEntries([0, 2, 4, 16].map((micro, index) => ["R" + index,
      { id: "R" + index, color: Object.keys(colors)[index], micro: [micro], sourceMacros: [], isPending: false }])) };
}

test("UDL039 all constant board affordance tones are neutral with distinct ordered brightness", () => {
  const { tones } = renderFixture(board());
  for (const value of Object.values(tones)) assert.match(value, /^#([\da-f]{2})\1\1$/i);
  const value = key => parseInt(tones[key].slice(1, 3), 16);
  assert.ok(value("outside") < value("empty") && value("empty") < value("candidate") && value("candidate") < value("selected"));
  assert.doesNotMatch(rendering, /#38bdf8|#86efac|#f0abfc|#c084fc|#facc15|#ffffff38/);
});

test("UDL039 candidates fill only free parts and never turn all blank macros into candidates", () => {
  const { sample, tones, canvas } = renderFixture(board());
  assert.equal(sample(1), tones.candidate);
  assert.equal(sample(3), tones.empty);
  assert.equal(sample(18), tones.empty);
  assert.equal(sample(7), tones.outside);
  assert.equal(canvas.dataset.startCandidateMacros, "0,2");
  assert.match(canvas.attributes["aria-label"], /明るい灰色.*全候補2か所/);
});

test("UDL039 selected free portions are white while connected candidates remain gray; clearing restores start state", () => {
  const selected = renderFixture(board(), { selected: [1], candidates: [0, 2] });
  assert.equal(selected.sample(3), selected.tones.selected);
  assert.equal(selected.sample(1), selected.tones.candidate);
  assert.equal(selected.canvas.dataset.connectedGuidedMacros, "0,2");
  assert.equal(selected.canvas.dataset.startCandidateMacros, undefined);
  const cleared = renderFixture(board(), { candidates: [0, 1, 2] });
  assert.equal(cleared.sample(3), cleared.tones.candidate);
  assert.equal(cleared.canvas.dataset.connectedGuidedMacros, undefined);
});

test("UDL039 red blue yellow and green remain exact beneath selection and neutral keyboard boundaries", () => {
  for (const focus of [false, true]) {
    const { sample, records } = renderFixture(board(), { selected: [1], focus });
    for (const [index, micro] of [0, 2, 4, 16].entries()) assert.equal(sample(micro), Object.values(colors)[index]);
    assert.ok(records.filter(r => r.kind === "stroke").every(r => r.dash.length === 0));
  }
});

test("UDL039 Half/Triple Shift band selection uses neutral outlines without a colored fill over painted regions", () => {
  for (const skill of ["areaHalfShift", "areaTripleShift"]) {
    const { sample, records, tones } = renderFixture(board(), { target: { kind: "band-shift", skill, input: { axis: "ROW", index: 1 } } });
    for (const [index, micro] of [0, 2, 4, 16].entries()) assert.equal(sample(micro), Object.values(colors)[index]);
    assert.ok(records.some(r => r.kind === "stroke" && r.color === tones.selected));
    assert.ok(records.filter(r => r.kind === "stroke").every(r => r.dash.length === 0 && Object.values(tones).includes(r.color)));
  }
});

test("UDL039 corner-target outlines and focus are neutral and retain the actual micro-cell color", () => {
  const { records, sample, tones } = renderFixture(board(), { target: { kind: "corner-bloom" }, focus: true });
  assert.ok(records.some(r => r.kind === "stroke" && r.color === tones.target));
  assert.equal(sample(0), colors.red);
  assert.equal(sample(2), colors.blue);
  assert.ok(records.filter(r => r.kind === "stroke").every(r => r.dash.length === 0));
});

test("UDL039 inactive board does not show selectable gray cells", () => {
  const { sample, tones, canvas } = renderFixture(board(), { interactive: false });
  assert.equal(sample(1), tones.empty);
  assert.equal(canvas.dataset.selectionGuidance, "none");
});

test("UDL039 actual partly occupied Half Shift macros preserve every painted micro center at 280px and 390px", () => {
  const scenario = halfShiftScenario(), state = { ...scenario.after, requiredSize: 2 };
  const shapes = acceptedShapes(state, scenario.rng), selected = shapes[0].sourceMacros;
  const candidates = [...new Set(shapes.flatMap(shape => shape.sourceMacros))].filter(cell => !selected.includes(cell));
  for (const displayWidth of [280, 390]) {
    const result = renderFixture(match.projectStandardPublicState(state), { selected, candidates, focus: true, focusMacro: selected[0], displayWidth });
    for (const region of Object.values(state.regions)) for (const micro of region.micro) assert.equal(result.sample(micro), colors[region.color], `width${displayWidth} micro${micro}`);
    for (const micro of shapes[0].micro) assert.equal(result.sample(micro), result.tones.selected);
  }
});
