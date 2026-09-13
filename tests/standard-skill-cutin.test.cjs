"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const api = require("../standard-online-v5/skill-cutin.js");
function input(version, extra={}) {
  return { roomId:"room",seat:"A",visible:true,ownColors:["red","blue"],...extra,
    state:{matchId:"match",version,status:"ACTIVE",regions:{R1:{micro:[1,2],color:"red"}},requiredSize:2,
      lastPublicTrace:{eventId:`match:${version}`,version,type:"USE_SKILL",actor:"B"},...(extra.state||{})} };
}
const snap=x=>api.snapshot(x);
function fakeStore() { const values=new Map();return { getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}; }
const locks={request:async (_name,_options,run)=>run()};

test("UDL065 readability uses a single 1800 ms duration",()=>{
  assert.equal(api.DISPLAY_MS,1800);
});

test("UDL065 results describe only measured viewer palette, seals and public area changes",()=>{
  const cases=[
    [{ownColors:["red","blue","green"]},"あなたの持ち色が3色に増えた"],
    [{ownColors:["red"]},"あなたの持ち色が1色に減った"],
    [{ownColors:["green","yellow"]},"あなたの持ち色が入れ替わった"],
    [{state:{publicEffects:{A:{seals:{red:1}}}}},"あなたの持ち色の封印が1色増えた"],
    [{state:{requiredSize:3}},"作るエリアが3マスになった"],
    [{state:{regions:{R1:{micro:[1],color:"red"},R2:{micro:[2],color:null}}}},"エリアが1つ増えた"],
    [{state:{regions:{R1:{micro:[1,2,3],color:"red"}}}},"エリアの形が変わった"],
  ];
  for(const [extra,detail] of cases){
    const after=input(2,extra);
    assert.equal(api.describe(snap(input(1)),snap(after),after).detail,detail);
  }
  const sealed=input(1,{state:{publicEffects:{A:{seals:{red:2}}}}}),after=input(2);
  assert.equal(api.describe(snap(sealed),snap(after),after).detail,"あなたの持ち色の封印が1色減った");
});

test("UDL065 palette ordering, duplicates and hidden effects never invent a result",()=>{
  const after=input(2,{ownColors:["blue","red","red","not-a-color"],
    state:{publicEffects:{B:{seals:{green:1}}},players:{B:{hand:["secret"],privatePalette:["yellow"]}}}});
  const event=api.describe(snap(input(1)),snap(after),after);
  assert.equal(event.detail,"スキルを使用");assert.equal(event.destination,null);
  assert.doesNotMatch(JSON.stringify(snap(after)),/secret|privatePalette|hand/);
});

test("UDL065 public recolor only names a color that actually changed in the named region",()=>{
  const before=input(1);
  const after=input(2,{state:{regions:{R1:{micro:[1,2],color:"green"}},
    lastPublicTrace:{eventId:"match:2",version:2,type:"LEGAL_RECOLOR",actor:"B",regionId:"R1",color:"green"}}});
  let event=api.describe(snap(before),snap(after),after);
  assert.equal(event.title,"スキルを使用");assert.equal(event.detail,"エリアが緑に塗り替わった");
  after.state.lastPublicTrace.color="yellow";
  event=api.describe(snap(before),snap(after),after);
  assert.equal(event.detail,"エリアの色が変わった");assert.doesNotMatch(event.detail,/黄/);
  after.state.regions=before.state.regions;
  assert.equal(api.describe(snap(before),snap(after),after).detail,"スキルを使用");
});

test("UDL065 seal replacement and decrease in area count are observations, not hidden skill names",()=>{
  const before=input(1,{state:{publicEffects:{A:{seals:{red:1}}}}});
  const after=input(2,{state:{publicEffects:{A:{seals:{blue:1}}}}});
  assert.equal(api.describe(snap(before),snap(after),after).detail,"あなたの持ち色の封印が変わった");
  const fewer=input(2,{state:{regions:{}}});
  assert.equal(api.describe(snap(input(1)),snap(fewer),fewer).detail,"エリアが1つ減った");
});

test("UDL065 new skill, malformed skill and changed scope still interrupt the displayed event",async()=>{
  for(const after of [input(3),input(3,{state:{lastPublicTrace:{...input(3).state.lastPublicTrace,secret:true}}}),
    input(3,{roomId:"other",state:{lastPublicTrace:null}})]){
    let clears=0,shows=0;
    const observer=api.createObserver({storage:fakeStore(),locks,clear(){clears++;},show(){shows++;}});
    await observer.observe(input(1));await observer.observe(input(2));const previous=clears;
    await observer.observe(after);assert.equal(clears,previous+1);
    assert.equal(shows,api.traceFor(after.state)&&after.roomId==="room"?2:1);
  }
});

test("UDL065 ordinary consecutive updates keep a displayed card but cancel a delayed claim",async()=>{
  let visible=false,count=0;
  const options={storage:fakeStore(),locks,show(){visible=true;count++;},clear(){visible=false;}};
  const observer=api.createObserver(options);
  await observer.observe(input(1));await observer.observe(input(2));
  await observer.observe(input(3,{state:{lastPublicTrace:null}}));
  assert.equal(visible,true);assert.equal(count,1);
  await observer.observe(input(5,{state:{lastPublicTrace:null}}));
  assert.equal(visible,false,"a version gap must still interrupt");
  let finish;
  const delayed=api.createObserver({...options,storage:fakeStore(),
    locks:{request:(_name,_opts,run)=>new Promise(resolve=>{finish=()=>resolve(run());})}});
  await delayed.observe(input(1));const pending=delayed.observe(input(2));
  await delayed.observe(input(3,{state:{lastPublicTrace:null}}));
  finish();assert.equal(await pending,false);assert.equal(count,1);assert.equal(visible,false);
});
test("UDL065 exact public trace rejects private details, malformed identities and false skill claims",()=>{
  assert.ok(api.traceFor(input(2).state));
  for (const patch of [{eventId:"wrong"},{version:1},{actor:"C"},{skill:"hiddenSkill"},{type:"FAILURE"},{regionId:"R1"}])
    assert.equal(api.traceFor({...input(2).state,lastPublicTrace:{...input(2).state.lastPublicTrace,...patch}}),null);
  assert.ok(api.traceFor(input(2,{state:{lastPublicTrace:{eventId:"match:2",version:2,type:"LEGAL_RECOLOR",actor:"A",regionId:"R1",color:"red"}}}).state));
});
test("UDL065 opponent generic usage reveals no skill, hidden palette or fictitious effect",()=>{
  const before=input(1),after=input(2,{ack:{eventId:"match:2",scope:"room:match:A",name:"secret",noOp:false}});
  const event=api.describe(snap(before),snap(after),after);
  assert.equal(event.title,"スキルを使用");assert.equal(event.destination,null);assert.equal(event.actor,"opponent");
  assert.doesNotMatch(JSON.stringify(event),/secret|red|blue/);
});
test("UDL065 own exact ACK names the card and no-op never animates an effect",()=>{
  const after=input(2,{state:{lastPublicTrace:{eventId:"match:2",version:2,type:"USE_SKILL",actor:"A"}},
    ack:{eventId:"match:2",scope:"room:match:A",name:"持ち色汚染",noOp:true},ownColors:["green"]});
  const event=api.describe(snap(input(1)),snap(after),after);
  assert.equal(event.title,"持ち色汚染");assert.equal(event.detail,"空振り");assert.equal(event.destination,null);
  after.ack.scope="another:match:A";
  assert.equal(api.describe(snap(input(1)),snap(after),after).title,"スキルを使用");
});
test("UDL065 reacts only to observed own colour/seal or public geometry changes",()=>{
  for(const [extra,destination] of [[{ownColors:["green"]},"palette"],[{state:{publicEffects:{A:{seals:{red:1}}}}},"palette"],
    [{state:{regions:{R1:{color:"red",micro:[1,2,3]}}}},"board"],[{state:{requiredSize:3}},"board"]]){
    const after=input(2,extra);assert.equal(api.describe(snap(input(1)),snap(after),after).destination,destination);
  }
  const hidden=input(2,{state:{publicEffects:{B:{seals:{red:1}}},players:{B:{privatePalette:["green"]}}}});
  assert.equal(api.describe(snap(input(1)),snap(hidden),hidden).destination,null);
});
test("UDL065 no initial, stale, gap, background, other match, terminal or modal replay",()=>{
  const base=snap(input(1));
  for(const after of [input(1),input(0),input(3),input(2,{visible:false}),input(2,{roomId:"other"}),
    input(2,{blocked:true}),input(2,{state:{status:"FINISHED"}})])assert.equal(api.describe(base,snap(after),after),null);
  assert.equal(api.describe(null,snap(input(2)),input(2)),null);
  assert.equal(api.describe(snap(input(1,{visible:false})),snap(input(2)),input(2)),null);
});
test("UDL065 durable locked claims dedupe tabs and fail closed without storage/locks",async()=>{
  const storage=fakeStore(),event={eventId:"match:2",scope:"room:match:A"};
  assert.deepEqual(await Promise.all([api.claim(event,storage,locks),api.claim(event,storage,locks)]),[true,false]);
  assert.equal(await api.claim(event,storage,null),false);
  assert.equal(await api.claim(event,{getItem(){throw Error("blocked");}},locks),false);
  assert.equal(await api.claim(event,{getItem:()=>null,setItem(){}},locks),false);
});
test("UDL065 observer never replays after re-render, reload, hidden/return or missing versions",async()=>{
  const shown=[],storage=fakeStore(),observer=api.createObserver({storage,locks,show:e=>shown.push(e),clear(){}});
  await observer.observe(input(1));await observer.observe(input(2));await observer.observe(input(2));
  assert.equal(shown.length,1);
  const reloaded=api.createObserver({storage,locks,show:e=>shown.push(e),clear(){}});
  await reloaded.observe(input(2));await reloaded.observe(input(3,{visible:false}));
  await reloaded.observe(input(3));await reloaded.observe(input(4));
  // Same-version return re-establishes baseline without replay; future live skill still appears.
  assert.equal(shown.length,2);
  await reloaded.observe(input(5));assert.equal(shown.length,3);
  await reloaded.observe(input(9));assert.equal(shown.length,3);
});
test("UDL065 navigation/terminal interrupts a delayed claim before display",async()=>{
  const pending=[],slowLocks={request:(_name,_opts,run)=>new Promise(resolve=>pending.push(()=>resolve(run())))};
  const shown=[],observer=api.createObserver({storage:fakeStore(),locks:slowLocks,show:e=>shown.push(e),clear(){}});
  await observer.observe(input(1));const work=observer.observe(input(2));observer.interrupt();pending.shift()();await work;
  assert.equal(shown.length,0);
});

test("UDL065 same-version blocking stops a visible event and never replays on close",async()=>{
  let visible=false,spoken="",count=0;
  const observer=api.createObserver({storage:fakeStore(),locks,show(){visible=true;spoken="skill";count++;},clear(){visible=false;spoken="";}});
  await observer.observe(input(1));await observer.observe(input(2));
  assert.equal(visible,true);await observer.observe(input(2,{blocked:true}));
  assert.equal(visible,false);assert.equal(spoken,"");
  await observer.observe(input(2));assert.equal(count,1);assert.equal(visible,false);
  await observer.observe(input(3));assert.equal(count,2);
});
test("UDL065 same-version blocking invalidates a pending claim even after dialog closes",async()=>{
  let finish,shown=0,spoken="";
  const delayed={request:(_name,_opts,run)=>new Promise(resolve=>{finish=()=>resolve(run());})};
  const observer=api.createObserver({storage:fakeStore(),locks:delayed,show(){shown++;spoken="skill";},clear(){spoken="";}});
  await observer.observe(input(1));const work=observer.observe(input(2));
  await observer.observe(input(2,{blocked:true}));await observer.observe(input(2));
  finish();assert.equal(await work,false);assert.equal(shown,0);assert.equal(spoken,"");
});
test("UDL065 final live presentation guard suppresses delayed events without requiring a new snapshot",async()=>{
  for(const throws of [false,true]){
    let finish,ready=true,shown=0;
    const delayed={request:(_name,_opts,run)=>new Promise(resolve=>{finish=()=>resolve(run());})};
    const observer=api.createObserver({storage:fakeStore(),locks:delayed,show(){shown++;},clear(){},
      canShow(){if(throws)throw Error("unavailable");return ready;}});
    await observer.observe(input(1));const work=observer.observe(input(2));ready=false;
    finish();assert.equal(await work,false);assert.equal(shown,0);
    ready=true;await observer.observe(input(2));assert.equal(shown,0);
  }
});
