"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
const spec = fs.readFileSync(path.join(root, "docs", "STANDARD_MODE_SPEC.md"), "utf8");
const matrix = fs.readFileSync(path.join(root, "docs", "STANDARD_MODE_SKILL_MATRIX.md"), "utf8");
const blanking = fs.readFileSync(path.join(root, "docs", "BLANKING_SKILL_DESIGN.md"), "utf8");

function v49SkillKeys() {
  const start = source.indexOf("const SKILLS={");
  const end = source.indexOf("\n};", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return [...source.slice(start, end).matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]+):\{/gm)]
    .map((match) => match[1]);
}

test("standard specification freezes the solo RC1 boundary and independent save key", () => {
  assert.match(spec, /source commit `484768b`/);
  assert.match(spec, /evidence commit `764ff96`/);
  assert.match(spec, /5286986169586D4CE30A33D043E55540E0DA251ABA7AE2A053F46B55B9C1F3C7/);
  assert.match(spec, /fourColorMapGame\.standard\.v5\.save/);
  assert.match(spec, /must not import Supabase or reuse\/overwrite the solo RC1 save/i);
});

test("skill matrix accounts for every v4.9 skill exactly once", () => {
  const keys = v49SkillKeys();
  assert.equal(keys.length, 19);
  for (const key of keys) {
    const occurrences = matrix.split("\n").filter((line) => line.startsWith(`| \`${key}\` |`)).length;
    assert.equal(occurrences, 1, `${key} must have exactly one catalog row`);
  }
});

test("standard palette and loadout facts match the v4.9 source", () => {
  assert.match(source, /PALETTE_SIZE:3/);
  assert.match(source, /LOADOUT_PER_CATEGORY:2/);
  assert.match(source, /LIMITED_USE_POOL:\[1,1,2,2,3,4\]/);
  assert.match(spec, /P\(1\)=1\/3, P\(2\)=1\/3, P\(3\)=1\/6, P\(4\)=1\/6/);
  assert.match(matrix, /six total/i);
});

test("blanking is explicitly design-only", () => {
  assert.match(blanking, /`implemented: false`/);
  assert.match(spec, /Blanking remains unimplemented/);
  assert.doesNotMatch(matrix, /\| `[^`]*blank[^`]*` \|[^\n]*Phase S2/i);
});
