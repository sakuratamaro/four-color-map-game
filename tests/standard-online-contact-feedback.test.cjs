const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "standard-online-v5");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

test("online Standard presents cumulative two, three, and four-color contact tiers", () => {
  for (const text of ["二色接触！", "三色圧力!!", "四色包囲!!!"]) assert.match(app, new RegExp(text));
  for (const tier of [2, 3, 4]) assert.match(css, new RegExp(`contact-pressure-${tier}`));
  for (const id of ["contactReveal", "contactRevealCard", "contactRevealSteps", "contactRevealTitle", "contactRevealDetail", "contactRevealAnnouncement"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /Array\.from\(\{ length: contactColorCount - 1 \}[^\n]+index \+ 2/);
  assert.match(app, /setTimeout\(\(\) => presentStage\(stageIndex \+ 1\), 200\)/);
  assert.match(app, /}, 700\)/);
});

test("contact feedback observes only new committed public contact events", () => {
  assert.match(app, /function observeCommittedContact\(state\)/);
  assert.match(app, /trace\.eventId === observedTraceEventId/);
  assert.match(app, /trace\.type === "CREATE_REGION" && trace\.contactColorCount >= 2\) showContactReveal\(trace\.contactColorCount\)/);
  assert.match(app, /observeCommittedContact\(publicState\)/);
  assert.doesNotMatch(app, /function selectedContactColorCount/);
  assert.doesNotMatch(app, /showContactReveal\(selectedContactColorCount/);
  assert.doesNotMatch(app, /showContactReveal\(response\.result/);
});

test("contact feedback is pointer inert, final-announcement-only, and reduced-motion safe", () => {
  assert.match(css, /\.contact-reveal,\.contact-reveal \*\{pointer-events:none\}/);
  assert.match(html, /id="contactReveal"[^>]+aria-hidden="true"/);
  assert.doesNotMatch(html, /id="contactReveal"[^>]+role="status"/);
  assert.match(html, /id="contactRevealAnnouncement"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(app, /const stages = reducedMotion \? \[contactColorCount\]/);
  assert.match(app, /stageIndex < stages\.length - 1/);
  assert.match(app, /contactRevealAnnouncement"\)\.textContent = `\$\{reveal\.title\} \$\{reveal\.detail\}`/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /clearContactReveal\(\);\s*const mySeat/);
});

test("public tactical trace uses a three-step, public-only presentation", () => {
  for (const text of ["直前の一手", "直前の手", "盤面変化", "次の判断"]) assert.match(html, new RegExp(text));
  for (const id of ["tacticalTrace", "tacticalTraceAction", "tacticalTraceChange", "tacticalTraceNext"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /function renderTacticalTrace\(state\)/);
  const renderer = app.match(/function renderTacticalTrace\(state\)[\s\S]*?\n\}/)?.[0] || "";
  for (const forbidden of ["basicPalette", "bonusColor", "availableColors", "privateState"]) assert.doesNotMatch(renderer, new RegExp(forbidden));
  assert.match(css, /@media\(max-width:520px\)\{\.tactical-trace\{padding:9px\}[\s\S]*?\.tactical-trace-flow\{grid-template-columns:1fr/);
});
