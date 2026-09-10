"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");
const registry = require("../standard-online-v5/standard-skill-registry.generated.js");

test("game-facing labels replace internal version, phase, room, and setup revision labels", () => {
  assert.match(html, /第 <b id="versionText">1<\/b> 手/);
  assert.doesNotMatch(html, />version\s*</i);
  assert.match(app, /const PHASE_LABEL = \{/);
  assert.match(app, /const ROOM_STATUS_LABEL = \{/);
  assert.match(app, /publicState\.turn/);
  assert.match(app, /あなたは準備完了です。相手の準備を待っています。/);
  assert.doesNotMatch(app, /setup revision/);
});

test("random setup reveal uses only public state and the current player's private projection", () => {
  for (const id of ["randomSummaryTitle", "rolledSizeValue", "basicPaletteValue", "bonusColorValue", "randomReveal", "randomRevealTitle", "randomRevealDetail"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /renderRandomSummary\(publicState, privateState\)/);
  assert.match(app, /publicState\.rolledSize/);
  assert.match(app, /privateState\.basicPalette/);
  assert.match(app, /privateState\.bonusColor/);
  assert.match(app, /privateState\.bonusUsesRemaining/);
  assert.match(app, /sessionStorage\.setItem\(key, "shown"\)/);
  assert.doesNotMatch(app, /basicPalettes\[["']?[AB]/);
  assert.match(css, /@keyframes dice-tumble/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("skill information buttons cover all 19 Standard skills plus two separate experimental loans", () => {
  const catalogIds = registry.v49SkillIds;
  const experimentalIds = Object.values(registry.skills).filter((definition) => definition.experimental).map((definition) => definition.id);
  const descriptionBlock = app.slice(app.indexOf("const SKILL_DESCRIPTION"), app.indexOf("const RANDOM_SKILLS"));
  const describedIds = [...descriptionBlock.matchAll(/^\s{2}([a-z][A-Za-z0-9]+):\s*"/gm)].map((match) => match[1]);
  assert.equal(catalogIds.length, 19);
  assert.equal(new Set(catalogIds).size, 19);
  assert.deepEqual(experimentalIds, ["colorBonusRefill", "legalRecolor"]);
  assert.deepEqual([...describedIds].sort(), [...catalogIds, ...experimentalIds].sort());
  assert.match(html, /id="skillInfoDialog"/);
  assert.match(html, /id="skillInfoBody"/);
  assert.match(app, /button\("ⓘ", \(\) => openSkillInfo\(skill\), "skill-info-button"\)/);
  assert.match(app, /setAttribute\("aria-label", `\$\{meta\.name\}の説明`\)/);
  assert.match(app, /RANDOM_SKILLS\.has\(skill\)/);
  assert.match(app, /★\$\{meta\.rarity\}/);
  assert.match(app, /rarity\.textContent = `★\$\{targetMeta\.rarity\}`/);
  assert.doesNotMatch(app, /innerHTML/);
});

test("UDL-055 terminal and unhydrated setup gates cancel presentation before consulting session storage", () => {
  const source = app.slice(app.indexOf("function clearRandomSetupReveal()"), app.indexOf("function openSkillInfo("));
  assert.ok(source.includes("function canRevealRandomSetup("));
  const state = { matchId: "match-1", status: "ACTIVE", phase: "CREATE_FIRST" };
  for (const fixture of [
    { roomModel: null, publicState: state },
    { roomModel: { room: { id: "other-room", status: "playing" } }, publicState: state },
    { roomModel: { room: { id: "room-1", status: "ready" } }, publicState: state },
    { roomModel: { room: { id: "room-1", status: "finished" } }, publicState: state },
    { roomModel: { room: { id: "room-1", status: "playing" } }, publicState: { ...state, status: "FINISHED" } },
    { roomModel: { room: { id: "room-1", status: "playing" } }, publicState: { ...state, phase: "GAME_OVER" } },
    { roomModel: { room: { id: "room-1", status: "playing" } }, publicState: null },
  ]) {
    const calls = [];
    const context = vm.createContext({
      ...fixture, client: { snapshot: () => ({ roomId: "room-1" }) },
      randomRevealTimer: 42,
      clearTimeout: (id) => calls.push(["cancel", id]),
      show: (id, visible) => calls.push([id, visible]),
      sessionStorage: { getItem: () => assert.fail("terminal/pending state must win before the shown receipt") },
    });
    vm.runInContext(`${source}\nrevealRandomSetup(publicState, {});`, context);
    assert.deepEqual(calls, [["cancel", 42], ["randomReveal", false]]);
    assert.equal(context.randomRevealTimer, null);
  }
  assert.match(app, /if \(!canRevealRandomSetup\(roomModel\?\.room\?\.public_state\)\) clearRandomSetupReveal\(\);/);
});
