"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const app = fs.readFileSync(path.join(__dirname, "../standard-online-v5/app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../standard-online-v5/play-surface.css"), "utf8");
const renderSource = app.slice(app.indexOf("function renderSkills("), app.indexOf("function beginSkill("));
const targetHeader = app.slice(app.indexOf("function renderSkillTarget("), app.indexOf('  const controls = document.createElement("div");', app.indexOf("function renderSkillTarget("))) + "}";
const state = (extra = {}) => ({ status: "ACTIVE", active: "A", phase: "WORK", version: 1, matchId: "match", ...extra });

function fixture({ slots = [{ skill: "areaCornerBloom", count: 1, used: false, extra: false, index: 0 }], busy = false, pending = null } = {}) {
  const calls = [], nodes = new Map();
  const element = tag => ({ tag, children: [], dataset: {}, attributes: {}, disabled: false, className: "", ownText: "",
    append(...values) { this.children.push(...values); }, appendChild(value) { this.children.push(value); return value; },
    contains(value) { return value != null && (this === value || this.children.some(child => typeof child === "object" && child.contains(value))); },
    querySelectorAll(selector) {
      assert.equal(selector, "button[data-skill]:not(:disabled)");
      const descendants = node => node.children.flatMap(child => typeof child === "object" ? [child, ...descendants(child)] : []);
      return descendants(this).filter(child => child.tag === "button" && child.dataset.skill !== undefined && !child.disabled);
    },
    focus(options) { if (!this.disabled) { document.activeElement = this; this.focusOptions = options; } },
    replaceChildren(...values) {
      if (this.contains(document.activeElement) && document.activeElement !== this) document.activeElement = null;
      this.children = values; this.ownText = "";
    },
    setAttribute(key, value) { this.attributes[key] = value; },
    set textContent(value) { this.ownText = value; this.children = []; },
    get textContent() { return this.ownText + this.children.map(x => typeof x === "string" ? x : x.textContent).join(""); } });
  const node = id => { if (!nodes.has(id)) nodes.set(id, element("div")); return nodes.get(id); };
  const document = { createElement: element, activeElement: null };
  const scope = { document, $: node, roomModel: { view: { seat: "A" }, room: { id: "room" } },
    stableHandSlots: () => slots, SKILL_META: {
      areaCornerBloom: { name: "角膨張", rarity: 2, category: "area" },
      colorBonusRefill: { name: "おまけ補充", rarity: 1, category: "color" },
      legalRecolor: { name: "適正塗り直し", rarity: 5, category: "color" } },
    CATEGORY_LABEL: { area: "エリア" }, actionBusy: busy, pendingAction: pending, targetDraft: null, selectedMacros: new Set(),
    renderTechnique() {}, renderSkillTarget() {}, show() {},
    beginSkill: skill => calls.push({ kind: "activate", skill }),
    openSkillInfo: skill => calls.push({ kind: "info", skill }),
    button(text, callback, className) { const n = element("button"); n.textContent = text; n.onclick = callback; n.className = className; return n; } };
  vm.createContext(scope); vm.runInContext(renderSource, scope);
  return { scope, calls, node, render: (s = state(), privateState = {}) => { scope.renderSkills(s, privateState); return node("skillControls").children.filter(x => x.className?.includes("skill-entry")); } };
}

test("UDL063 hides only ordinary visual x1 and retains rarity, used, repeated and debug counts", () => {
  for (const [slot, s, expected] of [
    [{ count: 1 }, {}, "★2"], [{ count: 3 }, {}, "★2\n×3"],
    [{ count: 0, used: true }, {}, "★2\n使用済み"], [{ count: 1 }, { debugUnlimitedSkills: true }, "★2\n∞"],
  ]) {
    const f = fixture({ slots: [{ skill: "areaCornerBloom", used: false, extra: false, index: 0, ...slot }] });
    const action = f.render(state(s))[0].children[0];
    assert.equal(action.children[1].textContent, expected);
    assert.match(action.attributes["aria-label"], /角膨張/);
    assert.deepEqual(f.calls, []);
  }
});

test("UDL063 extra and LAB cards keep their visible special count rather than inheriting normal x1 removal", () => {
  for (const skill of ["areaCornerBloom", "legalRecolor"]) {
    const f = fixture({ slots: [{ skill, count: 1, used: false, extra: true, index: 6 }] });
    const entry = f.render()[0];
    assert.match(entry.children[0].textContent, /×1/);
    assert.match(entry.className, /is-extra/);
    assert.equal(entry.children[1].disabled, false);
  }
});

test("UDL063 compact hand preserves action guards while every unavailable card retains an independent description", () => {
  const cases = [{ s: state({ active: "B" }) }, { s: state({ status: "FINISHED" }) }, { s: state({ phase: "COLOR" }) },
    { s: state({ skillCategoryWindow: { categories: ["area"] } }) }, { busy: true }, { pending: { id: "old-action" } },
    { slots: [{ skill: "areaCornerBloom", count: 0, used: true, extra: false, index: 0 }] },
    { slots: [{ skill: "colorBonusRefill", count: 1, used: false, extra: false, index: 0 }], s: state({ phase: "COLOR" }), privateState: { bonusUsesRemaining: 4 } }];
  for (const config of cases) {
    const f = fixture(config), entry = f.render(config.s, config.privateState)[0], [action, info] = entry.children;
    assert.equal(action.disabled, true, JSON.stringify(config));
    assert.equal(info.disabled, false);
    info.onclick(); assert.deepEqual(f.calls, [{ kind: "info", skill: config.slots?.[0].skill || "areaCornerBloom" }]);
    assert.equal(action.disabled, true);
  }
});

test("UDL063 card activation and info remain separate; the existing activation path is still one beginSkill call", () => {
  const f = fixture(), [action, info] = f.render()[0].children;
  assert.equal(action.disabled, false);
  info.onclick(); assert.deepEqual(f.calls, [{ kind: "info", skill: "areaCornerBloom" }]);
  action.onclick(); assert.deepEqual(f.calls, [{ kind: "info", skill: "areaCornerBloom" }, { kind: "activate", skill: "areaCornerBloom" }]);
  assert.match(renderSource, /button\("", \(\) => beginSkill\(skill\), "skill"\)/);
});

test("UDL063 same-version hand refresh restores only the focused enabled card without activation", () => {
  for (const mode of ["enabled", "disabled", "removed", "outside"]) {
    const f = fixture(), oldAction = f.render()[0].children[0];
    const focused = mode === "outside" ? f.node("outside") : oldAction;
    focused.focus();
    if (mode === "removed") f.scope.stableHandSlots = () => [];
    const entries = f.render(mode === "disabled" ? state({ active: "B" }) : state());
    const nextAction = entries[0]?.children[0];
    if (mode === "enabled") {
      assert.notEqual(nextAction, oldAction);
      assert.equal(f.scope.document.activeElement, nextAction);
      assert.equal(nextAction.focusOptions.preventScroll, true);
    } else {
      assert.equal(f.scope.document.activeElement, mode === "outside" ? focused : null, mode);
      if (mode === "disabled") assert.equal(nextAction.disabled, true);
    }
    assert.deepEqual(f.calls, []);
  }
});

test("UDL063 target-panel description captures the selected skill without modifying selection, target, or actions", () => {
  const f = fixture(); vm.runInContext(targetHeader, f.scope);
  f.scope.targetDraft = { skill: "areaCornerBloom", kind: "corner-bloom", input: { macro: 7 } };
  const before = JSON.stringify(f.scope.targetDraft);
  f.scope.renderSkillTarget(state(), {});
  const heading = f.node("skillTargetControls").children[0], info = heading.children[2];
  assert.equal(info.textContent, "説明");
  assert.equal(info.attributes["aria-label"], "角膨張の説明");
  info.onclick(); assert.equal(JSON.stringify(f.scope.targetDraft), before);
  assert.equal(f.scope.selectedMacros.size, 0);
  assert.deepEqual(f.calls, [{ kind: "info", skill: "areaCornerBloom" }]);
});

test("UDL063 hand CSS removes the full-width information row but retains readable names,44px controls and separate loan rows", () => {
  assert.match(css, /#skillControls \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /#skillControls \.skill-entry \{ position: relative; display: block;/);
  assert.match(css, /#skillControls \.skill-info-button \{ position: absolute;[^}]*width: 44px; height: 44px/);
  assert.match(css, /grid-template-rows: auto 44px/);
  assert.match(css, /padding-right: 44px/);
  assert.match(css, /\.skill-target-info-button \{ min-width: 44px; min-height: 44px/);
  assert.match(css, /#skillControls \.is-extra \{ display: grid/);
  assert.doesNotMatch(css, /line-clamp|text-overflow: ellipsis/);
  assert.match(app, /const info = button\("説明", \(\) => openSkillInfo\(targetSkill\)/);
});
