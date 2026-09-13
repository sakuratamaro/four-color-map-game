"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {dialogueFor,makeIntent,isCurrentIntent}=require("../standard-online-v5/surrender-confirmation.js");
test("UDL067 native safe-first dialog and its scoped focus style load before app41",()=>{
  const fs=require("node:fs"),path=require("node:path"),root=path.join(__dirname,"../standard-online-v5");
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),css=fs.readFileSync(path.join(root,"surrender-confirmation.css"),"utf8");
  assert.ok(html.indexOf('surrender-confirmation.js?v=20260913-1')<html.indexOf('app.js?v=20260913-44'));
  assert.ok(html.includes('surrender-confirmation.css?v=20260913-1'));
  const dialog=html.slice(html.indexOf('<dialog id="surrenderDialog"'),html.indexOf('<dialog id="abandonRoomDialog"'));
  assert.match(dialog,/aria-labelledby="surrenderTitle" aria-describedby="surrenderSpeaker surrenderDescription"/);
  assert.match(dialog,/id="cancelSurrender"[^>]+autofocus>対戦を続ける/);
  assert.ok(dialog.indexOf('id="cancelSurrender"')<dialog.indexOf('id="confirmSurrender"'));
  assert.match(css,/#surrenderDialog button:focus-visible \{ outline: 3px solid #67e8f9; outline-offset: 3px; \}/);
});
function context() { return {connected:true,activeTab:"battle",busy:false,pending:null,clientRoomId:"room",
  model:{room:{id:"room",status:"playing",version:7,opponent_kind:"cpu",cpu_character_id:"yuzu",
    public_state:{status:"ACTIVE",active:"A",version:4,matchId:"match"}},view:{seat:"A",version:7}}}; }
test("UDL067 fixed voice follows each exact existing CPU id, never appearance or list position",()=>{
  const ids=["yuzu","ren","minato","koharu","aoi","kai","tsubasa","shion","rei","kurogane"];
  const lines=ids.map(id=>dialogueFor("cpu",id));
  assert.equal(new Set(lines.map(x=>x.line)).size,10);
  for(const [index,id] of ids.entries()){
    assert.equal(lines[index].characterId,id);assert.deepEqual(dialogueFor("cpu",id),lines[index]);
    assert.ok(Object.isFrozen(lines[index]));assert.ok(lines[index].line.length<80);
  }
  for(const id of [null,undefined,0,"YUZU","unknown","constructor","__proto__"]){
    const line=dialogueFor("cpu",id);assert.equal(line.characterId,null);assert.equal(line.line,dialogueFor("human","yuzu").line);
  }
});
test("UDL067 intent retains public match identity only and is stable for an identical snapshot",()=>{
  const c=context();Object.defineProperty(c.model,"privateState",{get(){throw Error("private state must not be read");}});
  const intent=makeIntent(c);assert.ok(Object.isFrozen(intent));
  assert.deepEqual(intent,{roomId:"room",matchId:"match",seat:"A",roomVersion:7,viewVersion:7,stateVersion:4,opponentKind:"cpu",characterId:"yuzu"});
  assert.equal(isCurrentIntent(intent,c),true);assert.equal(isCurrentIntent(null,c),false);
});
test("UDL067 cannot open or confirm disconnected, inactive, busy, pending or terminal surrender",()=>{
  const mutators=[c=>c.connected=false,c=>c.activeTab="cards",c=>c.busy=true,c=>c.pending={id:"pending"},
    c=>c.clientRoomId="another",c=>c.model.room.status="finished",c=>c.model.room.public_state.status="FINISHED",
    c=>c.model.view.seat="B",c=>c.model.view.seat="spectator",c=>c.model.room.public_state.active="B",
    c=>c.model.room.version=-1,c=>c.model.room.version="7",c=>c.model.room.public_state.version=NaN,
    c=>c.model.room.id="",c=>c.model.room.public_state.matchId="",c=>c.model.view.version++,c=>c.model=null];
  const prior=makeIntent(context());
  for(const mutate of mutators){const c=context();mutate(c);assert.equal(makeIntent(c),null);assert.equal(isCurrentIntent(prior,c),false);}
  assert.equal(makeIntent(),null);
});
test("UDL067 old consent is invalidated by any public scope or version change",()=>{
  const mutators=[c=>{c.clientRoomId="new";c.model.room.id="new";},c=>{c.model.room.version++;c.model.view.version++;},
    c=>c.model.room.public_state.version++,c=>c.model.room.public_state.matchId="new",
    c=>{c.model.view.seat="B";c.model.room.public_state.active="B";},
    c=>c.model.room.cpu_character_id="ren",c=>c.model.room.opponent_kind="human"];
  const prior=makeIntent(context());for(const mutate of mutators){const c=context();mutate(c);assert.ok(makeIntent(c));assert.equal(isCurrentIntent(prior,c),false);}
});
