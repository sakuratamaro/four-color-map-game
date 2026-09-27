"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const w = require("../standard/standard-skill-workshop.js");
const registry = require("../standard/standard-skill-registry.js");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
let counter = 0;
const request = (s, type, payload) => ({ id: `test-${++counter}`, actor: s.state.active, expectedVersion: s.state.version, type, payload });
function use(s, skill, regionIds = [], color) { return w.apply(s, request(s, "USE_SKILL", { skill, regionIds, color })); }
function ordinary(s, type, payload) { return w.apply(s, request(s, type, payload)); }
function accepted(result) { assert.equal(result.ok, true, result.code); w.validate(result.session); return result.session; }
const take = (id) => w.create({ scenario: id });
const snapshots = (s) => JSON.stringify(s);

test("eleven trials and free play all validate without adding ordinary cards or touching economy", () => {
  assert.equal(w.IDS.length, 11);
  for (const id of [...w.IDS, "free"]) {
    const s = w.create({ scenario: id }); assert.equal(w.validate(s), true);
    assert.deepEqual(s.charges.A, s.charges.B);
    for (const key of w.IDS) assert.equal(registry.STANDARD_SKILLS[key], undefined);
    assert.equal(s.profile, undefined);
    assert.equal(s.state.ruleSetId, w.RULE_SET);
  }
  assert.notEqual(w.SAVE_KEY, match.SAVE_KEY);
});
test("weather retains geometry, transfers the coloring duty, and ordinary coloring continues", () => {
  const before = take("labWeather"), bytes = snapshots(before);
  const next = accepted(use(before, "labWeather", ["R1"]));
  assert.equal(snapshots(before), bytes);
  assert.deepEqual(next.state.regions.R1.micro, before.state.regions.R1.micro);
  assert.deepEqual(next.state.regions.R1.controllers, before.state.regions.R1.controllers);
  assert.equal(next.state.regions.R1.color, null);
  assert.deepEqual([next.state.pending, next.state.active, next.state.phase], ["R1", "B", "COLOR"]);
  assert.equal(next.charges.A.labWeather, 0);
  const colored = accepted(ordinary(next, "COLOR_REGION", { color: "red" }));
  assert.equal(colored.state.phase, "WORK"); assert.equal(colored.state.active, "B");
  assert.equal(colored.state.regions.R1.color, "red");
});
test("random blanking is seeded, symmetric, and draws exactly once on success", () => {
  const a = take("labWhiteout"), b = take("labWhiteout");
  const first = accepted(use(a, "labWhiteout")), second = accepted(use(b, "labWhiteout"));
  assert.equal(first.state.pending, second.state.pending);
  assert.equal(first.rngSnapshot["skill-effect"], (a.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
  for (const key of Object.keys(a.rngSnapshot).filter(key => key !== "skill-effect")) assert.equal(first.rngSnapshot[key], a.rngSnapshot[key]);
});
test("random blanking with no candidate consumes no state, card, version or RNG", () => {
  const s = take("labWhiteout"); s.state.regions = {};
  const before = snapshots(s), result = use(s, "labWhiteout");
  assert.equal(result.code, "NO_ELIGIBLE_REGION"); assert.equal(result.session, s); assert.equal(snapshots(s), before);
});
test("swap is atomic, nonadjacent and preserves region IDs and geometry", () => {
  const s = take("labSwap"), next = accepted(use(s, "labSwap", ["R1", "R3"]));
  assert.deepEqual(Object.keys(next.state.regions), Object.keys(s.state.regions));
  assert.equal(next.state.regions.R1.color, "green"); assert.equal(next.state.regions.R3.color, "red");
  assert.deepEqual(next.state.regions.R1.micro, s.state.regions.R1.micro);
  assert.equal(use(s, "labSwap", ["R1", "R2"]).code, "SWAP_REQUIRES_NONADJACENT");
  assert.equal(use(s, "labSwap", ["R1", "R1"]).code, "INVALID_TARGETS");
});
test("rotation uses selection order and validates all colors simultaneously", () => {
  const s = take("labRotate");
  const next = accepted(use(s, "labRotate", ["R1", "R2", "R3"]));
  assert.deepEqual(Object.values(next.state.regions).map(r => r.color), ["green", "red", "blue"]);
  assert.equal(use(s, "labRotate", ["R1", "R3", "R2"]).code, "ROTATION_REQUIRES_CHAIN");
});
test("illegal atomic rotation rolls back every changed target and its charge", () => {
  const s = take("labRotate");
  // Red adjacent only to the middle blue region would collide after rotating red there.
  s.state.regions.R4 = { id: "R4", color: "red", controllers: ["B"], isPending: false, sourceMacros: [16], micro: [16].flatMap(m => Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4)) };
  w.validate(s); const before = snapshots(s);
  assert.equal(use(s, "labRotate", ["R1", "R2", "R3"]).code, "RECOLOR_ADJACENCY_CONFLICT");
  assert.equal(snapshots(s), before);
});
test("demolition frees cells and a normal designation can reuse exactly that location", () => {
  const s = take("labDemolish");
  const next = accepted(use(s, "labDemolish", ["R1"]));
  assert.equal(next.state.regions.R1, undefined); assert.equal(next.state.pending, null);
  const created = accepted(ordinary(next, "CREATE_REGION", { sourceMacros: [26, 27] }));
  assert.equal(created.state.phase, "COLOR");
  assert.deepEqual(created.state.regions[created.state.pending].sourceMacros, [26,27]);
});
test("received designation cancellation preserves seals and die stream and gives the creator the same size", () => {
  const s = take("labCancelRegion"); const next = accepted(use(s, "labCancelRegion", ["R2"]));
  assert.equal(next.state.regions.R2, undefined);
  assert.deepEqual([next.state.active, next.state.phase, next.state.requiredSize, next.state.pending], ["B", "WORK", 2, null]);
  assert.deepEqual(next.rngSnapshot, s.rngSnapshot); assert.deepEqual(next.state.publicEffects, s.state.publicEffects);
  assert.equal(use(s, "labCancelRegion", ["R1"]).code, "RECEIVED_REGION_REQUIRED");
});
test("checker is one two-color region, not two new regions or a cosmetic-only pattern", () => {
  const s = take("labChecker"); const next = accepted(use(s, "labChecker", ["R1"], "yellow"));
  assert.deepEqual(w.colors(next.state.regions.R1), ["red", "yellow"]);
  assert.equal(Object.keys(next.state.regions).length, 3);
  assert.deepEqual(next.state.regions.R1.micro, s.state.regions.R1.micro);
  assert.equal(use(s, "labChecker", ["R1"], "blue").code, "RECOLOR_ADJACENCY_CONFLICT");
  assert.equal(use(s, "labChecker", ["R1"], "red").code, "INVALID_SECOND_COLOR");
});
test("ordinary coloring obeys the checker accent and an illegal paint consumes no successful-paint roll", () => {
  let s = accepted(use(take("labChecker"), "labChecker", ["R1"], "green"));
  s = accepted(ordinary(s, "CREATE_REGION", { sourceMacros: [38,39] }));
  const before = snapshots(s.rngSnapshot), next = accepted(ordinary(s, "COLOR_REGION", { color: "green" }));
  assert.equal(next.state.status, "FINISHED"); assert.equal(next.state.terminalReason, "ILLEGAL_COLOR");
  assert.equal(next.state.winner, "A"); assert.equal(snapshots(next.rngSnapshot), before);
  assert.equal(next.state.regions[next.state.pending].color, null);
});
test("delayed recolor waits for opponent successful color, survives save, draws once, and cannot fire twice", () => {
  let s = accepted(use(take("labRecolorNext"), "labRecolorNext", ["R1"]));
  assert.equal(s.scheduled.length, 1);
  const initial = s.rngSnapshot["skill-effect"];
  s = w.decode(w.encode(s));
  s = accepted(ordinary(s, "CREATE_REGION", { sourceMacros: [42,43] }));
  assert.equal(s.scheduled.length, 1);
  const req = request(s, "COLOR_REGION", { color: "blue" });
  const next = accepted(w.apply(s, req));
  assert.equal(next.scheduled.length, 0); assert.notEqual(next.state.regions.R1.color, "red");
  assert.equal(next.rngSnapshot["skill-effect"], (initial + 0x6d2b79f5) >>> 0);
  const replay = w.apply(next, req); assert.equal(replay.code, "IDEMPOTENT_REPLAY"); assert.equal(replay.session, next);
});
test("delayed recolor does not fire on a failed paint or surrender", () => {
  for (const type of ["COLOR_REGION", "SURRENDER"]) {
    let s = accepted(use(take("labRecolorNext"), "labRecolorNext", ["R1"]));
    s = accepted(ordinary(s, "CREATE_REGION", { sourceMacros: [42,43] }));
    const next = accepted(ordinary(s, type, { color: "green" }));
    assert.equal(next.state.status, "FINISHED"); assert.equal(next.scheduled.length, 0);
    assert.equal(next.state.regions.R1.color, "red"); assert.equal(next.rngSnapshot["skill-effect"], s.rngSnapshot["skill-effect"]);
  }
});
test("delayed target change is a public no-op with no random draw or refund", () => {
  let s = accepted(use(take("labRecolorNext"), "labRecolorNext", ["R1"]));
  s.state.regions.R1.color = "yellow";
  s = accepted(ordinary(s, "CREATE_REGION", { sourceMacros: [42,43] }));
  const next = accepted(ordinary(s, "COLOR_REGION", { color: "blue" }));
  assert.equal(next.state.regions.R1.color, "yellow"); assert.match(next.lastEvent, /不発/);
  assert.equal(next.charges.A.labRecolorNext, 0); assert.equal(next.rngSnapshot["skill-effect"], s.rngSnapshot["skill-effect"]);
});
test("unseal and bonus refill each resolve and consume their own color category", () => {
  const a = accepted(use(take("labUnseal"), "labUnseal", [], "blue"));
  assert.equal(a.state.publicEffects.A.seals.blue, 0);
  assert.equal(use(a, "labRefillUnseal").code, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  assert.equal(accepted(ordinary(a, "COLOR_REGION", { color: "blue" })).state.phase, "WORK");
  const b = accepted(use(take("labRefillUnseal"), "labRefillUnseal"));
  assert.equal(b.state.bonusUsesRemaining.A, 1); assert.equal(b.state.publicEffects.A.seals.green, 0);
  assert.equal(accepted(ordinary(b, "COLOR_REGION", { color: "green" })).state.bonusUsesRemaining.A, 0);
});
test("disrupt-only silence preserves rescue and expires at the actual end of the opponent window", () => {
  let s = accepted(use(take("labSilence"), "labSilence"));
  assert.equal(s.silence.B, "QUEUED");
  s = accepted(ordinary(s, "CREATE_REGION", { sourceMacros: [42,43] }));
  assert.equal(s.silence.B, "ACTIVE");
  s.state.publicEffects.B.seals.blue = 2;
  s = accepted(use(s, "labUnseal", [], "blue"));
  s = accepted(ordinary(s, "COLOR_REGION", { color: "blue" }));
  assert.equal(use(s, "labDemolish", ["R1"]).code, "DISRUPT_CATEGORY_SILENCED");
  // Pick a connected region for the seeded normal die size.
  s = accepted(ordinary(s, "CREATE_REGION", { sourceMacros: Array.from({length:s.state.requiredSize},(_,i)=>54+i) }));
  assert.equal(s.silence.B, "NONE");
});
test("every invalid target is atomic and version, actor, action-ID collision checks fail closed", () => {
  for (const id of w.IDS.filter(id => w.CARDS[id].targets)) {
    const s = take(id), before = snapshots(s); assert.equal(use(s,id,["missing"]).ok,false); assert.equal(snapshots(s),before);
  }
  const s = take("labSwap"), req = request(s,"USE_SKILL",{skill:"labSwap",regionIds:["R1","R3"]});
  assert.equal(w.apply(s,{...req,expectedVersion:99}).code,"VERSION_CONFLICT");
  assert.equal(w.apply(s,{...req,actor:"B"}).code,"NOT_YOUR_TURN");
  const next=accepted(w.apply(s,req));
  assert.equal(w.apply(next,{...req,payload:{skill:"labRotate"}}).code,"ACTION_ID_COLLISION");
  assert.equal(w.apply(next,req).session,next);
});
test("pending, reservation and same-turn created shapes cannot be blanked", () => {
  const s=take("labWeather"); s.createdTurn.R1=s.state.turn;
  assert.equal(use(s,"labWeather",["R1"]).code,"INELIGIBLE_REGION");
  const pending=take("labCancelRegion");
  assert.equal(use(pending,"labWeather",["R2"]).code,"WRONG_PHASE");
});
test("corrupt saves and foreign rulesets never get silently accepted", () => {
  const s=take("labChecker");
  for(const mutate of [x=>{x.ruleSetId="STANDARD_V5";},x=>{x.charges.A.labChecker=-1;},x=>{x.state.regions.R1.labColors=["red","red"];},x=>{x.rngSnapshot={};},x=>{x.state.regions.R1.micro=[];},x=>{x.scheduled=[{actor:"Z"}];}]) {
    const bad=structuredClone(s); mutate(bad); assert.throws(()=>w.decode(JSON.stringify(bad)));
  }
  assert.deepEqual(w.decode(w.encode(s)),s);
});
test("standalone browser bundle exposes the same trial engine and no online transport", () => {
  const sandbox={}; sandbox.globalThis=sandbox;
  const bundle=fs.readFileSync(path.join(__dirname,"../skill-workshop/engine.bundle.js"),"utf8");
  vm.runInNewContext(bundle,sandbox);
  assert.equal(sandbox.FourColorSkillWorkshop.IDS.length,11);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.FourColorSkillWorkshop.create())),w.create());
  const app=fs.readFileSync(path.join(__dirname,"../skill-workshop/app.js"),"utf8");
  assert.doesNotMatch(app,/fetch\(|supabase|WebSocket|XMLHttpRequest/);
});
