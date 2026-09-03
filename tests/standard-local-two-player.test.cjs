"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const { LocalTwoPlayerController, clearPrivateDom } = require("../standard/local-two-player-controller.js");

function setup(seed = 61) {
  const rng = createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({ matchId: `local-${seed}`, firstSeat: "A" }, rng);
  state.privateEffects.A.sentinel = "A-ONLY";
  state.privateEffects.B.sentinel = "B-ONLY";
  const events = [];
  const controller = new LocalTwoPlayerController({
    state,
    rngStreams: rng,
    clearPrivate: () => events.push(["clear-private"]),
    renderPublic: (projection) => events.push(["render-public", projection]),
    renderPrivate: (projection) => events.push(["render-private", projection]),
    showHandover: (view) => events.push(["show-handover", view]),
    hideHandover: () => events.push(["hide-handover"]),
  });
  return { controller, events };
}

test("start removes private UI before rendering public state and handover", () => {
  const { controller, events } = setup();
  controller.start();
  assert.deepEqual(events.map(([type]) => type), ["clear-private", "render-public", "show-handover"]);
  assert.equal(events[1][1].privateEffects, undefined);
  assert.deepEqual(events[2][1], { seat: "A", phase: "CREATE_FIRST" });
});

test("reveal renders only the active seat private projection", () => {
  const { controller, events } = setup(62);
  controller.start();
  controller.revealCurrentSeat();
  const privateEvent = events.find(([type]) => type === "render-private");
  assert.equal(privateEvent[1].seat, "A");
  assert.equal(privateEvent[1].privateEffects.sentinel, "A-ONLY");
  assert.equal(JSON.stringify(privateEvent[1]).includes("B-ONLY"), false);
});

test("CREATE_REGION clears A secrets before B handover, then B colors and keeps WORK", () => {
  const { controller, events } = setup(63);
  controller.start();
  controller.revealCurrentSeat();
  events.length = 0;
  const sourceMacros = Array.from({ length: controller.state.requiredSize }, (_, index) => 13 + index);
  const created = controller.dispatch({ type: "CREATE_REGION", payload: { sourceMacros } });
  assert.equal(created.ok, true);
  assert.equal(controller.state.active, "B");
  assert.deepEqual(events.map(([type]) => type), ["clear-private", "render-public", "show-handover"]);
  assert.deepEqual(events[2][1], { seat: "B", phase: "COLOR" });

  events.length = 0;
  controller.revealCurrentSeat();
  const color = controller.state.basicPalettes.B[0];
  const colored = controller.dispatch({ type: "COLOR_REGION", payload: { color } });
  assert.equal(colored.ok, true);
  assert.equal(controller.state.active, "B");
  assert.equal(controller.state.phase, "WORK");
  assert.deepEqual(events.map(([type]) => type), ["hide-handover", "render-public", "render-private", "render-public", "render-private"]);
});

test("actions are refused until the active seat explicitly reveals", () => {
  const { controller } = setup(64);
  controller.start();
  const result = controller.dispatch({ type: "SURRENDER" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "PRIVATE_VIEW_NOT_REVEALED");
  assert.equal(controller.state.version, 0);
});

test("automated dispatch never renders a CPU private projection", () => {
  const { controller, events } = setup(65);
  controller.start();
  events.length = 0;
  const sourceMacros = Array.from({ length: controller.state.requiredSize }, (_, index) => 13 + index);
  const result = controller.dispatchAutomated("A", { type: "CREATE_REGION", payload: { sourceMacros } });
  assert.equal(result.ok, true);
  assert.equal(events.some(([type]) => type === "render-private"), false);
  assert.deepEqual(events.map(([type]) => type), ["clear-private", "render-public", "show-handover"]);
  assert.equal(JSON.stringify(events).includes("A-ONLY"), false);
  assert.equal(JSON.stringify(events).includes("B-ONLY"), false);
});

test("clearPrivateDom destroys descendants and secret-bearing attributes", () => {
  const removed = [];
  const root = {
    attributes: [{ name: "title" }, { name: "aria-label" }, { name: "data-secret" }, { name: "class" }],
    replaceChildren: () => removed.push("children"),
    removeAttribute: (name) => removed.push(name),
  };
  clearPrivateDom(root);
  assert.deepEqual(removed, ["children", "title", "aria-label", "data-secret"]);
});

test("local handover controller contains no human legality oracle wording", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "standard", "local-two-player-controller.js"), "utf8");
  assert.doesNotMatch(source, /接色注意|合法色|安全色|隣接色一覧|safe.?color/i);
});
