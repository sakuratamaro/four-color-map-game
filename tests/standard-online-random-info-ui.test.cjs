"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");

test("game-facing labels replace internal version, phase, room, and setup revision labels", () => {
  assert.match(html, /第 <b id="versionText">1<\/b> 手/);
  assert.doesNotMatch(html, />version\s*</i);
  assert.match(app, /const PHASE_LABEL = \{/);
  assert.match(app, /const ROOM_STATUS_LABEL = \{/);
  assert.match(app, /publicState\.turn/);
  assert.match(app, /あなたの6枚セットは確認済みです/);
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

test("skill information buttons are separate, readable, and cover all 19 Standard skills", () => {
  const descriptionBlock = app.slice(app.indexOf("const SKILL_DESCRIPTION"), app.indexOf("const RANDOM_SKILLS"));
  const describedIds = [...descriptionBlock.matchAll(/^\s{2}([a-z][A-Za-z0-9]+):\s*"/gm)].map((match) => match[1]);
  assert.equal(describedIds.length, 19);
  assert.equal(new Set(describedIds).size, 19);
  assert.match(html, /id="skillInfoDialog"/);
  assert.match(html, /id="skillInfoBody"/);
  assert.match(app, /button\("ⓘ", \(\) => openSkillInfo\(skill\), "skill-info-button"\)/);
  assert.match(app, /setAttribute\("aria-label", `\$\{meta\.name\}の説明`\)/);
  assert.match(app, /RANDOM_SKILLS\.has\(skill\)/);
  assert.doesNotMatch(app, /innerHTML/);
});

