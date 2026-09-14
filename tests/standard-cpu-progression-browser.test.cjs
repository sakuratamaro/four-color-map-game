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
async function startOrdinary(page,f) {
  await page.getByRole("button",{name:"対戦",exact:true}).click();
  await page.locator("#startStandardCpuLobby").click();
  await page.getByRole("button",{name:"せっかちレンを選んで6枚を確認",exact:true}).click();
  for(const category of Object.keys(loadout)) {
    const checked=page.locator(`input[name="loadout-${category}"]:checked`);
    while(await checked.count()) await checked.first().uncheck();
    for(const id of loadout[category]) await page.locator(`input[name="loadout-${category}"][value="${id}"]`).check();
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
