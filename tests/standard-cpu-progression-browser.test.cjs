"use strict";
const assert=require("node:assert/strict"),test=require("node:test");
const {withProgressionPage,browserName,winningEdgeScript,stage}=require("./helpers/cpu-progression-browser.cjs");
const {ordinarySealScript}=require("./helpers/cpu-progression-runtime.cjs");
const {clickCanvasFraction}=require("./helpers/canvas-native-pointer.cjs");
const loadout={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
async function waitVersion(page,roomId,version) {
  await page.waitForFunction(({roomId,version})=>globalThis.__pilotLastSnapshot?.room?.id===roomId&&Number(globalThis.__pilotLastSnapshot.room.version)===version,{roomId,version},{timeout:25000});
}
async function clickMacros(page,macros,width) {
  for(const macro of macros) await clickCanvasFraction(page.locator("#board"),{x:(macro%width+0.5)/width,y:(Math.floor(macro/width)+0.5)/width});
}
async function playerAction(page,f,roomId,turn) {
  await waitVersion(page,roomId,turn.version);
  const current=(await f.authority(roomId)).state;
  assert.equal(current.version,turn.version);assert.equal(current.active,"A");
  stage("native-action-"+turn.version+"-"+turn.action.type);
  const {type,payload}=turn.action;
  if(type==="COLOR_REGION") {
    const button=page.locator(`#paletteControls button[data-color="${payload.color}"]:not([disabled])`);
    if(await button.count()===0&&await page.locator(`#remainingColorSelect option[value="${payload.color}"]:not([disabled])`).count())
      await page.locator("#remainingColorSelect").selectOption(payload.color);
    await button.first().click();
  } else if(type==="CREATE_REGION") {
    if(!current.preparedOutgoing?.sourceMacros?.length) {
      await page.locator("#clearSelection").click();
      await clickMacros(page,payload.sourceMacros,current.playableBounds.macroWidth);
    }
    await page.locator("#submitRegion:not([disabled])").click();
  } else if(type==="USE_SKILL") {
    if(payload.skill==="techUnsealOne") {
      await page.locator("#useTechnique:not([disabled])").click();
      await page.locator(`[data-technique-color="${payload.color}"]:not([disabled])`).click();
    } else {
      await page.locator(`#skillControls button[data-skill="${payload.skill}"]:not([disabled])`).click();
      const entries=Object.entries(payload).filter(([key])=>key!=="skill");
      if(entries.length) {
        for(const [key,value]of entries) {
          if(key==="sourceMacros") await clickMacros(page,value,current.playableBounds.macroWidth);
          else await page.locator(`#skillTargetControls [data-target-key="${key}"][data-target-value="${value}"]`).click();
        }
        await page.locator("#skillTargetControls").getByRole("button",{name:"この対象で使う",exact:true}).click();
      }
    }
  } else throw new Error("Unsupported native player action "+type);
}
async function playTrace(page,f,roomId,trace) {
  for(const turn of trace) if(turn.seat==="A") await playerAction(page,f,roomId,turn);
}
async function startOrdinary(page,f,selectedLoadout=loadout) {
  await page.getByRole("button",{name:"対戦",exact:true}).click();
  await page.locator("#startStandardCpuLobby").click();
  await page.getByRole("button",{name:"せっかちレンを選んで6枚を確認",exact:true}).click();
  for(const category of Object.keys(loadout)) {
    const checked=page.locator(`input[name="loadout-${category}"]:checked`);
    while(await checked.count()) await checked.first().uncheck();
    for(const id of selectedLoadout[category]) await page.locator(`input[name="loadout-${category}"][value="${id}"]`).check();
  }
  await page.locator("#submitSetup:not([disabled])").click();
  await page.locator("#techniqueControls:not(.hidden)").waitFor();
  return f.roomId();
}
test(`${browserName} AC064 native UI -> actual worker/SQL trial WIN, equip, ordinary use, reload and next game`,{timeout:300000},async()=>{
  await withProgressionPage(async(page,f)=>{
    const before=await f.profile();
    await page.getByRole("button",{name:"対戦",exact:true}).click();
    await page.locator("#startStandardCpuLobby").click();
    const details=page.locator(".cpu-trial-details");await details.locator("summary").click();
    assert.match(await details.innerText(),/貸与する6枚/);
    assert.equal(f.calls.filter(c=>c.body?.operation==="cpu-trial-start").length,0);
    f.drop("cpu-trial-start");
    await details.locator("button[data-trial-start]").click();
    await page.locator("#resumeTrialStart:not([disabled]):not(.hidden)").waitFor();
    await page.locator("#closeCpuRoster").click();await page.reload();
    await page.getByRole("button",{name:"ホーム",exact:true}).click();
    assert.equal(f.calls.filter(c=>c.body?.operation==="cpu-trial-start").length,1,"reload never creates another trial");
    await page.locator("#resumeTrialStart").click();
    await page.locator("#useTechnique:not([disabled])").waitFor();
    const trialRoom=await f.roomId(),initial=await f.authority(trialRoom);
    const starts=f.calls.filter(c=>c.body?.operation==="cpu-trial-start");assert.equal(starts.length,2);assert.deepEqual(starts[0].body,starts[1].body);
    assert.equal((await f.snapshot(trialRoom)).standard_cpu_trial_start_receipts.length,1);
    const trace=winningEdgeScript(initial,trialRoom);
    await playTrace(page,f,trialRoom,trace);
    await page.locator("#terminalOverlay:not(.hidden)").waitFor({timeout:30000});
    await page.waitForFunction(()=>globalThis.__pilotLastSnapshot?.room?.status==="finished");
    const won=await f.snapshot(trialRoom);
    assert.equal(won.room.winner_seat,"A");assert.equal(won.standard_learned_techniques.length,1);assert.equal(won.standard_cpu_trial_clears.length,1);
    for(const key of ["coins","inventory","gachaTickets","cpuStats","cpuCharacterStats"]) assert.deepEqual(won.profile.profile_state[key],before.profile_state[key],key);
    assert.match(await page.locator("#terminalProgressText").innerText(),/解封/);
    assert.equal(await page.locator("#terminalGoGacha").isHidden(),true);
    await page.locator("#terminalGoLobby").click();
    await page.getByRole("button",{name:"マイページ",exact:true}).click();
    f.drop("technique-equip");
    await page.locator("#equipTechnique:not([disabled])").click();
    await page.locator("#resumeTechniqueEquip:not([disabled]):not(.hidden)").waitFor();
    await page.getByRole("button",{name:"ホーム",exact:true}).click();await page.reload();
    await page.getByRole("button",{name:"ホーム",exact:true}).click();
    assert.equal(f.calls.filter(c=>c.body?.operation==="technique-equip").length,1,"reload never silently equips");
    await page.locator("#resumeTechniqueEquip").click();
    await page.getByRole("button",{name:"マイページ",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector("#techniqueEquipmentSummary").textContent.includes("装備中"));
    const equips=f.calls.filter(c=>c.body?.operation==="technique-equip");assert.equal(equips.length,2);assert.deepEqual(equips[0].body,equips[1].body);
    assert.equal((await f.profile()).profile_state.equippedTechniqueId,"techUnsealOne");
    stage("trial-learn-equip-complete");
    const ordinaryRoom=await startOrdinary(page,f);assert.notEqual(ordinaryRoom,trialRoom);
    let ordinary=await f.authority(ordinaryRoom);assert.equal(ordinary.state.techniques.A.usesRemaining,1);assert.equal(ordinary.state.techniques.B,null);
    const publicRow=await f.serial(async()=>(await f.runtime.db.query("select cpu_policy_version from public.fcg_rooms where id=$1",[ordinaryRoom])).rows[0]);
    const seal=ordinarySealScript(ordinary,ordinaryRoom,publicRow.cpu_policy_version);
    await playTrace(page,f,ordinaryRoom,seal.trace);
    const useVersion=ordinary.state.version+seal.trace.length;
    await waitVersion(page,ordinaryRoom,useVersion);
    await playerAction(page,f,ordinaryRoom,{version:useVersion,action:{type:"USE_SKILL",payload:{skill:"techUnsealOne",color:seal.color}}});
    await page.waitForFunction(()=>document.querySelector("#useTechnique").textContent.includes("×0"));
    ordinary=await f.authority(ordinaryRoom);assert.equal(ordinary.state.techniques.A.usesRemaining,0);
    await page.reload();await page.getByRole("button",{name:"対戦",exact:true}).click();
    await page.locator("#techniqueControls:not(.hidden)").waitFor();
    assert.match(await page.locator("#useTechnique").innerText(),/×0/);assert.equal(await page.locator("#useTechnique").isDisabled(),true);
    assert.equal((await f.authority(ordinaryRoom)).state.techniques.A.usesRemaining,0);
    await page.locator("#colorSurrender:not([disabled])").click();await page.locator("#confirmSurrender").click();
    await page.locator("#terminalOverlay:not(.hidden)").waitFor();await page.locator("#terminalGoLobby").click();
    const nextRoom=await startOrdinary(page,f);
    assert.notEqual(nextRoom,ordinaryRoom);assert.equal((await f.authority(nextRoom)).state.techniques.A.usesRemaining,1);
    assert.equal((await f.authority(ordinaryRoom)).state.techniques.A.usesRemaining,0);
    assert.equal((await f.snapshot(trialRoom)).standard_learned_techniques.length,1);
    assert.equal(await page.locator("#skillControls .skill-entry").count(),6);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.ok(f.calls.some(c=>c.body?.operation==="cpu-action"),"Real CPU worker turns execute");
    assert.equal(f.calls.some(c=>["gacha","card-sale","quiz-start"].includes(c.body?.operation)),false);
  });
});

const {randomUUID}=require("node:crypto");
const {api}=require("./helpers/cpu-progression-runtime.cjs");
const {plain}=require("./helpers/public-skill-fixture.cjs");

// This is an isolated board-position fixture, not a production shortcut.
// Ownership is earned by legal trial actions through the actual worker/SQL;
// equipment and ordinary initialization use the real UI. Never replace just
// engineVersion: the immutable learned snapshot must be created by the worker.
async function prepareLearnedCornerPosition(page,f) {
  await f.serial(async()=>{
    const p=await f.runtime.profile(f.id);
    p.profile_state.inventory.areaCornerBloom=1;
    await f.runtime.db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb,revision=revision+1 where user_id=$1",[f.id,JSON.stringify(p.profile_state)]);
    const started=await f.worker.post({operation:"cpu-trial-start",actionId:randomUUID(),trialId:"ren-unseal",trialVersion:1,confirmed:true});
    assert.equal(started.status,200,JSON.stringify(started.body));
    const trialRoom=started.body.roomId;
    for(const turn of winningEdgeScript(await f.runtime.authority(trialRoom),trialRoom)) {
      const body=turn.seat==="B"?{operation:"cpu-action",roomId:trialRoom,expectedVersion:turn.version}
        :{operation:"action",roomId:trialRoom,action:{...turn.action,id:randomUUID(),expectedVersion:turn.version}};
      const result=await f.worker.post(body);
      assert.equal(result.status,200,JSON.stringify(result.body));
    }
    const won=await f.runtime.snapshot(f.id,trialRoom);
    assert.equal(won.room.winner_seat,"A");
    assert.equal(won.standard_learned_techniques.length,1);
  });
  await page.reload();
  await page.getByRole("button",{name:"マイページ",exact:true}).click();
  await page.locator("#equipTechnique:not([disabled])").click();
  await page.waitForFunction(()=>document.querySelector("#techniqueEquipmentSummary").textContent.includes("装備中"));
  assert.equal((await f.profile()).profile_state.equippedTechniqueId,"techUnsealOne");
  const ordinaryRoom=await startOrdinary(page,f,{...loadout,area:["areaCornerBloom","areaDiePlus"]});
  const position=await f.serial(async()=>{
    const current=plain(await f.runtime.authority(ordinaryRoom));
    assert.equal(current.state.engineVersion,"5.0.0-alpha.5");
    assert.deepEqual(current.state.techniqueRule,{id:"CPU_LEARNED_V1",playerSeat:"A"});
    assert.deepEqual(current.state.techniques.A,{id:"techUnsealOne",definitionVersion:"unseal-v1",source:"LEARNED",usesRemaining:1});
    const snapshot=plain(current.state.techniques);
    const {macroWidth:width,microScale:scale}=current.state.playableBounds,macro=width*2+2;
    const micro=Array.from({length:scale*scale},(_,i)=>(2*scale+Math.floor(i/scale))*width*scale+2*scale+i%scale);
    Object.assign(current.state,{active:"A",phase:"WORK",pending:null,reserved:null,preparedOutgoing:null,
      requiredSize:1,baseRequiredSize:1,rolledSize:1,skillCategoryWindow:{actor:"A",categories:[]},
      regions:{R1:{id:"R1",micro,sourceMacros:[macro],controllers:["B"],color:"red",isPending:false}}});
    api.validateState(current.state);
    assert.deepEqual(current.state.techniques,snapshot,"board fixture preserves real acquired snapshot");
    const probe=plain(api.apply({...current,actor:"A",expectedVersion:current.state.version,
      action:{type:"USE_SKILL",payload:{skill:"areaCornerBloom",regionId:"R1",macro}}}));
    assert.equal(probe.ok,true,probe.code);
    await f.runtime.db.query("update fcg_private.authoritative_matches set state=$2::jsonb where room_id=$1",[ordinaryRoom,JSON.stringify(current)]);
    await f.runtime.db.query("update public.fcg_rooms set public_state=$2::jsonb where id=$1",[ordinaryRoom,JSON.stringify(api.publicState(current.state))]);
    for(const seat of ["A","B"]) await f.runtime.db.query("update public.fcg_player_views set private_state=$3::jsonb where room_id=$1 and seat=$2",[ordinaryRoom,seat,JSON.stringify(api.privateState(current.state,seat))]);
    return {roomId:ordinaryRoom,current,macro,micro:micro[0],microWidth:width*scale,expected:probe};
  });
  await page.reload();
  await page.getByRole("button",{name:"対戦",exact:true}).click();
  await waitVersion(page,ordinaryRoom,position.current.state.version);
  await page.locator('#skillControls button[data-skill="areaCornerBloom"]:not([disabled])').waitFor();
  return position;
}
for(const gesture of ["pointer","Enter","Space","lost-ACK-retry"]) {
  test(`${browserName} alpha5 learned snapshot colored corner bloom: ${gesture} real worker/SQL preserves technique`,{timeout:180000},async()=>{
    await withProgressionPage(async(page,f)=>{
      const p=await prepareLearnedCornerPosition(page,f),before=await f.snapshot(p.roomId);
      const actionCalls=()=>f.calls.filter(c=>c.body?.operation==="action"&&c.body.action?.payload?.skill==="areaCornerBloom");
      const skill=page.locator('#skillControls button[data-skill="areaCornerBloom"]'),board=page.locator("#board");
      await skill.click();
      await page.waitForFunction(()=>document.activeElement?.id==="board");
      // Empty, unselected cells stay invalid and Escape cancels without a write.
      await clickCanvasFraction(board,{x:0.5/p.microWidth,y:0.5/p.microWidth});
      await page.locator('#skillTargetControls .skill-target-feedback[data-tone="error"]').waitFor();
      assert.equal(actionCalls().length,0);
      assert.deepEqual((await f.authority(p.roomId)).state,p.current.state);
      await page.keyboard.press("Escape");
      assert.equal(await skill.evaluate(el=>el===document.activeElement),true);
      // A same-version realtime refresh may race the cancellation focus handoff.
      // Exercise it deterministically without another action or a forced focus.
      await page.evaluate(()=>{ globalThis.__pilotLastSnapshot=null; globalThis.__pilotNotifyRealtime(); });
      await waitVersion(page,p.roomId,p.current.state.version);
      await page.waitForFunction(()=>document.activeElement?.dataset.skill==="areaCornerBloom",null,{timeout:2000});
      assert.equal(actionCalls().length,0);
      await skill.focus();await page.keyboard.press("Enter");
      await page.waitForFunction(()=>document.activeElement?.id==="board");
      // The real snapshot must drive candidate frames and accessible description.
      assert.match(await page.locator("#boardKeyboardStatus").textContent(),/赤の彩色済みエリア/);
      assert.equal(await page.locator("#skillTargetControls").getByRole("button",{name:"この対象で使う",exact:true}).count(),0);
      if(gesture==="lost-ACK-retry")f.drop("action");
      if(gesture==="pointer"||gesture==="lost-ACK-retry") {
        await clickCanvasFraction(board,{x:(p.micro%p.microWidth+0.5)/p.microWidth,y:(Math.floor(p.micro/p.microWidth)+0.5)/p.microWidth});
      } else await page.keyboard.press(gesture);
      if(gesture==="lost-ACK-retry") {
        await page.locator("#retryAction:not(.hidden):not([disabled])").waitFor();
        assert.equal(actionCalls().length,1);
        await page.locator("#retryAction").click();
      }
      await waitVersion(page,p.roomId,p.current.state.version+1);
      await page.waitForFunction(()=>document.querySelector("#actionStatus").textContent.includes("操作を保存しました"));
      const calls=actionCalls(),after=await f.snapshot(p.roomId),state=after.authority.state;
      assert.equal(calls.length,gesture==="lost-ACK-retry"?2:1);
      assert.deepEqual(calls[0].body.action.payload,{skill:"areaCornerBloom",regionId:"R1",macro:p.macro});
      assert.equal(calls[0].body.action.type,"USE_SKILL");
      if(calls.length===2)assert.deepEqual(calls[1].body,calls[0].body,"one pending identity is replayed");
      assert.equal(state.version,p.current.state.version+1);
      assert.deepEqual(state.regions,p.expected.state.regions,"actual worker accepted the real engine expansion");
      assert.equal(state.hands.A.areaCornerBloom,0);
      assert.deepEqual(state.skillCategoryWindow,{actor:"A",categories:["area"]});
      assert.deepEqual(state.techniques,p.current.state.techniques);
      assert.equal(state.skillsUsed.A,p.current.state.skillsUsed.A+1);
      assert.deepEqual(after.authority.rngSnapshot,p.current.rngSnapshot);
      assert.equal(after.receipts,before.receipts+1,"one committed mutation even after lost ACK");
      assert.equal(after.profile.profile_state.inventory.areaCornerBloom,before.profile.profile_state.inventory.areaCornerBloom-1);
      assert.deepEqual(after.profile.profile_state.learnedTechniques,before.profile.profile_state.learnedTechniques);
      assert.equal(after.profile.profile_state.equippedTechniqueId,"techUnsealOne");
      await page.reload();await page.getByRole("button",{name:"対戦",exact:true}).click();
      await waitVersion(page,p.roomId,state.version);
      assert.equal((await f.authority(p.roomId)).state.techniques.A.usesRemaining,1);
      assert.equal((await f.authority(p.roomId)).state.hands.A.areaCornerBloom,0);
    },{timeout:150000});
  });
}
