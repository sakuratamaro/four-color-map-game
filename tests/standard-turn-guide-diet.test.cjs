"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.join(__dirname, "../standard-online-v5");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8") + fs.readFileSync(path.join(root, "play-surface.css"), "utf8");
const part = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));
const phases = app.match(/const PHASE_LABEL = \{[\s\S]*?\};/)[0];
const guideSource = part("function phaseLabelFor(", "function isColorSealed(");
const basicGuardSource = part("function renderBasicActions(", '  const palette = $("paletteControls");') + "}";

function view({ selected = [], busy = false, pending = null, target = null, seat = "A", cpu = false, prepared = false } = {}) {
  const nodes = new Map(), visible = {}, events = [];
  const node = id => {
    if (!nodes.has(id)) {
      let text = "";
      nodes.set(id, { dataset: {}, disabled: false, writes: 0,
        get textContent() { return text; }, set textContent(value) { text = value; this.writes++; } });
    }
    return nodes.get(id);
  };
  const scope = { $: node, targetDraft: target, actionBusy: busy, pendingAction: pending,
    roomModel: { room: { opponent_kind: cpu ? "cpu" : "human" }, view: { seat } },
    visibleOutgoingMacros: () => selected, preparedOutgoingSourceMacros: () => prepared ? selected : [],
    show: (id, value) => { visible[id] = value; }, sendAction: () => events.push("forbidden") };
  vm.createContext(scope); vm.runInContext(phases + "\n" + guideSource + "\n" + basicGuardSource, scope);
  return { scope, nodes, visible, events, node };
}
const state = (phase = "WORK", active = "A", status = "ACTIVE") => ({ phase, active, status, requiredSize: 2, turn: 3 });

test("UDL054/062 normal action has one short live guide and the one existing give control immediately before board", () => {
  const surface = html.slice(html.indexOf('id="playSurface"'), html.indexOf('id="actionStatus"'));
  assert.equal((surface.match(/id="turnGuide"/g) || []).length, 1);
  assert.equal((html.match(/id="submitRegion"/g) || []).length, 1);
  assert.match(surface, /id="turnGuide"[\s\S]*id="turnGuideTitle" role="status" aria-live="polite" aria-atomic="true"[\s\S]*id="regionControls"[\s\S]*id="selectionCount"[\s\S]*id="submitRegion"[\s\S]*<\/section>[\s\S]*id="boardViewport"/);
  assert.doesNotMatch(html, /id="(?:phaseText|turnGuideStep|turnGuideDetail|toggleBoardZoom|playViewportHint|matchSetupDetails|rolledSizeValue|basicPaletteValue|bonusColorValue)"/);
  assert.doesNotMatch(guideSource, /あなたが作る|が塗る|白い枠|下のボタン|自動選択では|startCandidateMacros|legalColors|private_state/);
  assert.match(css, /\.turn-guide\{[^}]*border:1px solid #facc15/);
});

test("UDL054/062 custom zoom is absent without disabling browser/OS zoom or macro/micro keyboard input", () => {
  assert.doesNotMatch(app, /boardZoomed|setBoardZoom|scrollBoardMacroIntoView|toggleBoardZoom/);
  assert.doesNotMatch(css, /is-zoomed|board-zoom-toggle|width:2112px|touch-action:none/);
  assert.match(css, /\.board-viewport #board\{[^}]*touch-action:pan-x pan-y pinch-zoom/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale|minimum-scale/);
  assert.match(app, /ensureBoardKeyboardMicro\(state\)/);
  assert.match(app, /activateCornerBloomCell\(state, micro\)/);
  assert.match(app, /moved <= 10 && scrolled <= 4\) boardPointer\(event\)/);
});

test("UDL054/062 incomplete and ready states use short instructions with no selection or transmission side effect", () => {
  for (const phase of ["CREATE_FIRST", "WORK"]) for (const selected of [[], [13], [13, 14]]) {
    const v = view({ selected }), s = state(phase), before = JSON.stringify(s);
    v.scope.renderBasicActions(s, {});
    assert.equal(v.node("turnGuideTitle").textContent, selected.length === 2 ? "選択したエリアを渡してください" : "相手に渡すエリアを選択してください");
    assert.equal(v.node("selectionCount").textContent, `${selected.length} / 2マス`);
    assert.equal(v.node("submitRegion").disabled, selected.length !== 2);
    assert.equal(v.visible.turnGuide, true); assert.equal(v.visible.regionControls, true);
    assert.equal(JSON.stringify(s), before); assert.deepEqual(v.events, []);
  }
});

test("UDL054/062 busy or pending recovery wins over complete selection and cannot submit", () => {
  for (const flags of [{ busy: true }, { pending: { actionId: "old-intent" } }, { busy: true, pending: {} }]) {
    const v = view({ selected: [13, 14], ...flags }); v.scope.renderBasicActions(state(), {});
    assert.equal(v.node("turnGuideTitle").textContent, flags.busy ? "操作を送信中です" : "前回の操作結果を確認してください");
    assert.equal(v.node("submitRegion").disabled, true); assert.equal(v.node("clearSelection").disabled, true);
    assert.deepEqual(v.events, []);
  }
});

test("UDL054/062 prepared selection stays locked; foreign/terminal/skill states do not expose ordinary give controls", () => {
  const prepared = view({ selected: [13, 14], prepared: true }); prepared.scope.renderBasicActions(state(), {});
  assert.equal(prepared.node("clearSelection").disabled, true); assert.equal(prepared.node("submitRegion").disabled, false);
  for (const [flags, s] of [[{}, state("WORK", "B")], [{ target: { kind: "corner-bloom" } }, state()], [{}, state("COLOR")], [{}, state("GAME_OVER", "A", "FINISHED")]]) {
    const v = view({ selected: [13, 14], ...flags }); v.scope.renderBasicActions(s, {});
    assert.equal(v.visible.regionControls, false); assert.equal(v.node("submitRegion").disabled, true);
    if (flags.target || s.status === "FINISHED") assert.equal(v.visible.turnGuide, false);
    assert.deepEqual(v.events, []);
  }
});

test("UDL054/062 other-seat guide names the current actor and repeated polls do not rewrite live text", () => {
  for (const cpu of [false, true]) for (const phase of ["CREATE_FIRST", "WORK", "COLOR"]) {
    const v = view({ cpu }); v.scope.renderTurnGuide(state(phase, "B"));
    assert.ok(v.node("turnGuideTitle").textContent.startsWith(cpu ? "CPUが" : "相手が"));
    v.scope.renderTurnGuide(state(phase, "B")); assert.equal(v.node("turnGuideTitle").writes, 1);
  }
});

test("UDL054/062 only duplicate settings DOM is removed; own history, random reveal and current palette remain", () => {
  for (const id of ["paletteHistoryPanel", "initialPaletteValue", "paletteHistoryList", "randomReveal", "randomRevealTitle", "randomRevealDetail", "paletteControls"]) assert.ok(html.includes(`id="${id}"`));
  assert.match(app, /renderPaletteHistory\(publicState, privateState\);\s*revealRandomSetup\(publicState, privateState\)/);
  assert.doesNotMatch(app, /renderRandomSummary|rolledSizeValue|basicPaletteValue|bonusColorValue/);
  assert.match(app, /paletteRoleSlots\(privateState/);
});

test("UDL054/062 viewport fit measures guide, notice, above-board controls and palette without double-counting", () => {
  const rects = { boardViewport: { top: 130, bottom: 450, height: 320 }, colorResponse: { top: 460, bottom: 570, height: 110 },
    regionControls: { top: 48, bottom: 92, height: 44 }, paletteImpactNotice: { top: 98, bottom: 122, height: 24 }, turnGuide: { top: 20, bottom: 92, height: 72 } };
  let fitted;
  const scope = { activeAppTab: "battle", innerHeight: 844, battleViewportInsets: () => ({ top: 80, bottom: 96 }),
    $: id => id === "matchCard" ? { classList: { contains: () => false } } : id === "playSurface" ? { style: { setProperty: (key, value) => { assert.equal(key, "--play-board-max"); fitted = value; } } } : { getBoundingClientRect: () => rects[id] } };
  vm.createContext(scope); vm.runInContext(part("function fitPlaySurface()", "function schedulePlaySurfaceFit()"), scope);
  scope.fitPlaySurface(); assert.equal(fitted, "430px");
  scope.innerHeight = 390; scope.fitPlaySurface(); assert.equal(fitted, "280px");
  scope.activeAppTab = "home"; fitted = null; scope.fitPlaySurface(); assert.equal(fitted, null);
});
