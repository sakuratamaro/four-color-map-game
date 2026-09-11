"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const intents = require("../standard-online-v5/standard-online-skill-intents.js");
const model = import(pathToFileURL(path.join(__dirname, "../standard-online-v5/play-surface-model.js")).href);

test("UDL052 same-color base and bonus remain three independent resource roles", async () => {
  const { paletteRoleSlots } = await model;
  const slots = paletteRoleSlots({ basicPalette: ["red", "red"], bonusColor: "red", bonusUsesRemaining: 0 });
  assert.deepEqual(slots.map(s => s.role), ["basic1", "basic2", "bonus", "remaining"]);
  assert.deepEqual(slots.slice(0, 3).map(s => [s.color, s.mark, s.selectable]),
    [["red", "∞", true], ["red", "∞", true], ["red", "❌", false]]);
  assert.deepEqual(slots[3].options.map(s => s.color), ["blue", "yellow", "green"]);
});

test("UDL052 exhausted bonus can still be selected through an independent temporary grant", async () => {
  const { paletteRoleSlots } = await model;
  const own = { basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 0,
    privateEffects: { temporaryColors: ["yellow", "green"] } };
  const slots = paletteRoleSlots(own, {}, "green");
  assert.equal(slots[2].mark, "❌");
  assert.deepEqual(slots[3].options.map(s => [s.color, s.mark, s.selectable]), [["yellow", "1", true], ["green", "1", true]]);
  assert.equal(slots[3].color, "green");
  assert.equal(paletteRoleSlots(own, { green: 1 }, "green")[3].mark, "🔒");
  assert.equal(paletteRoleSlots(own, { green: 1 }, "green")[3].selectable, false);
});

test("UDL052 all role options preserve the existing available color set across 6144 projections", async () => {
  const { PALETTE_COLORS: colors, paletteRoleSlots } = await model;
  let checked = 0;
  for (const a of colors) for (const b of colors) for (const bonusColor of colors)
    for (const bonusUsesRemaining of [0, 1, 4]) for (let mask = 0; mask < 16; mask++)
      for (const prism of [false, true]) {
        const own = { basicPalette: [a, b], bonusColor, bonusUsesRemaining,
          privateEffects: { prism, temporaryColors: colors.filter((_, i) => mask & (1 << i)) } };
        const before = JSON.stringify(own), slots = paletteRoleSlots(own);
        const available = [...new Set([...slots.slice(0, 3), ...slots[3].options].filter(s => s.selectable).map(s => s.color))].sort();
        assert.deepEqual(available, [...intents.availableColorChoices(own)].sort());
        assert.equal(JSON.stringify(own), before);
        assert.equal(slots.length, 4);
        checked++;
      }
  assert.equal(checked, 6144);
});

test("UDL052 role model never receives board adjacency and keeps missing colors unavailable", async () => {
  const { paletteRoleSlots } = await model;
  assert.ok(paletteRoleSlots(null).every(s => !s.available && s.mark === "❌"));
  const own = { basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 1 };
  assert.equal(paletteRoleSlots(own, { red: 2 })[0].mark, "🔒");
  assert.equal(paletteRoleSlots({ ...own, adjacentColors: ["red", "blue", "yellow", "green"] })[0].mark, "∞");
});

test("UDL063 used hand slots retain authoritative loadout order with loans separate", async () => {
  const { stableHandSlots } = await model;
  const known = Object.fromEntries(["c1", "c2", "a1", "a2", "d1", "d2", "loan"].map(id => [id, {}]));
  const loadout = { color: ["c1", "c2"], area: ["a1", "a2"], disrupt: ["d1", "d2"] };
  const before = stableHandSlots({ loadout, hand: { a2: 1, c1: 1, loan: 1 } }, known);
  const after = stableHandSlots({ loadout, hand: { loan: 0, c1: 0, a2: 1 } }, known);
  assert.deepEqual(after.map(s => s.skill), before.map(s => s.skill));
  assert.deepEqual(after.slice(0, 6).map(s => s.skill), ["c1", "c2", "a1", "a2", "d1", "d2"]);
  assert.equal(after[0].used, true);
  assert.equal(after[3].used, false);
  assert.equal(after[6].extra, true);
  assert.deepEqual(stableHandSlots({ hand: { unknown: 1 } }, known), []);
});
