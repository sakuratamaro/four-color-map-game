const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "standard-online-v5");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

test("online Standard presents the accepted two, three, and four-color contact tiers", () => {
  for (const text of ["二色接触！", "三色圧力!!", "四色包囲!!!"]) assert.match(app, new RegExp(text));
  for (const tier of [2, 3, 4]) assert.match(css, new RegExp(`contact-pressure-${tier}`));
  for (const id of ["contactReveal", "contactRevealCard", "contactRevealTitle", "contactRevealDetail"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("contact feedback occurs as soon as a complete area is selected", () => {
  assert.match(app, /function selectedContactColorCount\(state, macros = selectedMacros\)/);
  assert.match(app, /selectedMacros\.size === state\.requiredSize\) showContactReveal\(selectedContactColorCount\(state\)\)/);
  assert.doesNotMatch(app, /showContactReveal\(response\.result\?\.contactColorCount\)/);
});

test("contact feedback is pointer inert, bounded, and reduced-motion safe", () => {
  assert.match(css, /\.contact-reveal\{[^}]*pointer-events:none/);
  assert.match(app, /}, 900\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /clearContactReveal\(\);\s*const mySeat/);
});
