"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const cpu=require("../standard/standard-cpu.js"),roster=require("../standard/standard-cpu-roster.js"),match=require("../standard/standard-match.js");
const {trace,other}=require("./helpers/cpu-palette-fixtures.cjs");
const sandbox={console};sandbox.globalThis=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../supabase/functions/standard-game-action/standard-engine.bundle.js"),"utf8"),sandbox);
const api=sandbox.FourColorStandardServerEngine,plain=v=>JSON.parse(JSON.stringify(v));
const policy=id=>roster.PALETTE_EFFICIENCY_POLICY_VERSION+":"+id;
function create(id,seat,version,{loadout=roster.CPU_CHARACTERS[id].loadout,cpuSeat=seat,...extra}={}){
  return plain(api.create({matchId:"kurogane-100-fixture",loadouts:{A:loadout,B:loadout},seed:42051,firstSeat:other(seat),
    cpuSeat,cpuCharacterId:id,cpuPolicyVersion:version,...extra}));
}
test("direct-user100: only new Kurogane starts with100 palette charges; other cards, seats and generations are preserved",()=>{
  assert.equal(roster.KUROGANE_PALETTE_CHANGE_CHARGES,100);
  for(const seat of ["A","B"])for(const id of Object.keys(roster.CPU_CHARACTERS)){
    const old=create(id,seat,roster.CPU_CHARACTERS[id].policyVersion),next=create(id,seat,policy(id));
    const expected=plain(old.state);if(id==="kurogane")expected.hands[seat].colorPaletteChange=100;
    assert.deepEqual(next.state,expected,id+"/"+seat);
    assert.deepEqual(next.rngSnapshot,old.rngSnapshot);assert.deepEqual(next.publicState,old.publicState);
    assert.deepEqual(next.state.hands[other(seat)],old.state.hands[other(seat)]);
    match.validateStandardState(next.state);
  }
});
test("old21 versions, unspecified policy, PvP/spoofed identity and non-equipped palette cards never receive100",()=>{
  for(const entry of require("./fixtures/cpu-palette-legacy-traces.json").policies){
    const made=create(entry.character,"B",entry.policy);
    assert.ok((made.state.hands.B.colorPaletteChange||0)<=1,entry.policy);
  }
  for(const [id,version,extra] of [
    ["kurogane",null,{}],["kurogane",policy("rei"),{}],["rei",policy("kurogane"),{}],
    ["kurogane",policy("kurogane"),{cpuSeat:null}],
    ["kurogane",policy("kurogane"),{loadout:roster.CPU_CHARACTERS.ren.loadout}]
  ]){
    const made=create(id,"B",version,extra);
    assert.ok((made.state.hands.B.colorPaletteChange||0)<=1);
  }
});
test("Kurogane keeps favorite palette choices across84 authored observations, while still retaining F3 rescue",()=>{
  assert.deepEqual(trace(policy("kurogane"),"kurogane"),trace(roster.CPU_CHARACTERS.kurogane.policyVersion,"kurogane"));
});
test("real accepted play consumes100 to99 to98 across windows; one window cannot chain changes or refill on restore",()=>{
  for(const seat of ["A","B"]){
    let current=create("kurogane",seat,policy("kurogane"));
    const choose=actor=>{
      const view=api.project(current.state),own=actor==="A"?view.privateA:view.privateB;
      return plain(api.chooseCpuAction({publicState:view.publicState,ownPrivateState:own,characterId:"kurogane",policyVersion:policy("kurogane"),seed:42051}));
    };
    const ordinary=actor=>{
      const view=api.project(current.state),own=actor==="A"?view.privateA:view.privateB;
      return cpu.enumerateCpuActions(cpu.makeObservation({publicState:plain(view.publicState),ownPrivateState:plain(own),difficulty:"hard"}))
        .find(a=>a.type===(current.state.phase==="COLOR"?"COLOR_REGION":"CREATE_REGION"));
    };
    const step=(actor,action)=>{
      assert.ok(action,"authored ordinary action exists");
      const before=plain(current.state),result=plain(api.apply({state:current.state,rngSnapshot:current.rngSnapshot,actor,action,expectedVersion:current.state.version}));
      assert.equal(result.ok,true,action.type+"/"+result.code);assert.deepEqual(current.state,before);
      current=result;
    };
    step(other(seat),ordinary(other(seat)));
    for(const remaining of [99,98]){
      assert.equal(current.state.active,seat);assert.equal(current.state.phase,"COLOR");
      const action=choose(seat);assert.equal(action.payload.skill,"colorPaletteChange");
      step(seat,action);assert.equal(current.state.hands[seat].colorPaletteChange,remaining);
      const rejected=plain(api.apply({state:current.state,rngSnapshot:current.rngSnapshot,actor:seat,action,expectedVersion:current.state.version}));
      assert.equal(rejected.ok,false);assert.equal(rejected.code,"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
      current=plain(current);match.validateStandardState(current.state);
      const restored=api.project(current.state);assert.equal((seat==="A"?restored.privateA:restored.privateB).hand.colorPaletteChange,remaining);
      const paint=choose(seat);assert.equal(paint.type,"COLOR_REGION");step(seat,paint);
      assert.equal(current.state.hands[seat].colorPaletteChange,remaining);
      if(remaining===99){step(seat,ordinary(seat));step(other(seat),ordinary(other(seat)));step(other(seat),ordinary(other(seat)));}
    }
  }
});
test("zero charge and used category still block Kurogane's preferred skill",()=>{
  const {fixture,choose}=require("./helpers/cpu-palette-fixtures.cjs");
  for(const kind of ["empty","used"]){
    const state=fixture();state.hands.A.colorPaletteChange=kind==="empty"?0:100;
    if(kind==="used")state.skillCategoryWindow.categories=["color"];
    const action=choose(state,"A","kurogane",policy("kurogane"));assert.equal(action.type,"COLOR_REGION",kind);
  }
});
