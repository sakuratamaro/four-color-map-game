"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const modulePromise = import(pathToFileURL(path.join(__dirname, "../standard-online-v5/action-recovery.js")).href);
const ready = { roomId: "current", roomLoaded: true, roomStatus: "ready", setupRevision: 1, hasSurplus: true, hasSellable: true };

test("UDL062 recovery separates prepared, playing and finished destinations without changing input", async () => {
  const { cardActionRecovery } = await modulePromise;
  for (const [roomStatus, target, label] of [["waiting","setup","準備に戻る"],["ready","setup","準備に戻る"],["playing","match","対戦に戻る"],["finished","result","対戦結果へ"]]) {
    const input = { ...ready, roomStatus }, before = JSON.stringify(input), result = cardActionRecovery(input);
    assert.equal(result.sale.target, target); assert.equal(result.sale.label, label); assert.equal(result.sale.locked, true);
    assert.equal(result.loadout.target, target); assert.equal(result.loadout.label, label);
    assert.equal(JSON.stringify(input), before); assert.ok(Object.isFrozen(result.sale));
  }
});
test("UDL062 recovery never invents a loaded destination from an unknown or mismatched room", async () => {
  const { cardActionRecovery } = await modulePromise;
  for (const change of [{roomLoaded:false},{roomStatus:null},{roomStatus:"abandoned"},{roomStatus:"unknown"}]) {
    const result = cardActionRecovery({...ready,...change});
    assert.equal(result.sale.target,null); assert.equal(result.loadout.target,null);
    assert.equal(result.sale.locked,true); assert.equal(result.loadout.disabled,true);
  }
});
test("UDL062 sale unknown-result and in-flight states outrank room recovery and inventory hints", async () => {
  const { cardActionRecovery } = await modulePromise;
  for (const roomStatus of ["ready","playing","finished"]) {
    const pending = cardActionRecovery({...ready,roomStatus,salePending:true}).sale;
    assert.equal(pending.kind,"pending"); assert.equal(pending.target,null);
    assert.equal(pending.message,"前回の売却結果を確認してください。");
    const busy = cardActionRecovery({...ready,roomStatus,saleBusy:true,salePending:true}).sale;
    assert.equal(busy.message,null); assert.equal(busy.locked,true);
  }
});
test("UDL062 no-surplus and protected-only surplus have specific reasons and no fake button", async () => {
  const { cardActionRecovery } = await modulePromise;
  const last = cardActionRecovery({}).sale, protectedOnly=cardActionRecovery({hasSurplus:true}).sale;
  assert.match(last.message,/各1枚/); assert.match(protectedOnly.message,/保護/);
  assert.equal(last.target,null); assert.equal(protectedOnly.target,null);
  assert.equal(cardActionRecovery({hasSurplus:true,hasSellable:true}).sale.kind,"idle");
});
test("UDL062 unprepared waiting room keeps the existing sale permission", async () => {
  const { cardActionRecovery } = await modulePromise;
  const result = cardActionRecovery({...ready,roomStatus:"waiting",setupRevision:0});
  assert.equal(result.sale.locked,false); assert.equal(result.sale.target,null);
  assert.equal(result.loadout.target,"setup");
});
test("UDL062 CPU draft and pending setup recovery preserve an explicit review destination", async () => {
  const { cardActionRecovery } = await modulePromise;
  for (const pendingCpuStart of [false,true]) {
    const result = cardActionRecovery({cpuDraftOwnsEntry:true,pendingCpuStart,hasSurplus:true,hasSellable:true});
    assert.equal(result.loadout.target,"setup"); assert.match(result.loadout.label,/CPU戦/);
    assert.equal(result.sale.locked,pendingCpuStart);
  }
  assert.match(cardActionRecovery({...ready,pendingSetup:true}).loadout.message,/前回の準備結果/);
  const unconfirmed = cardActionRecovery({...ready,roomStatus:"waiting",setupRevision:0,pendingSetup:true});
  assert.equal(unconfirmed.sale.locked,true);
  assert.equal(unconfirmed.sale.target,"setup");
  assert.match(unconfirmed.sale.message,/準備結果/);
});
test("UDL062 roomless editor and a current-state recomputation do not retain a previous destination", async () => {
  const { cardActionRecovery } = await modulePromise;
  assert.equal(cardActionRecovery(ready).sale.target,"setup");
  const result=cardActionRecovery({hasSurplus:true,hasSellable:true});
  assert.equal(result.loadout.target,null);assert.equal(result.loadout.disabled,false);
  assert.equal(result.sale.target,null);assert.equal(result.sale.locked,false);
});
test("UDL062 recovery integration is current-state navigation only and leaves sale confirmation intact", () => {
  const app=fs.readFileSync(path.join(__dirname,"../standard-online-v5/app.js"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"../standard-online-v5/index.html"),"utf8");
  const start=app.indexOf("function navigateCardRecovery("), end=app.indexOf("\nfunction ",start+1), navigation=app.slice(start,end);
  assert.ok(start>=0,"current-state recovery navigation is connected");
  assert.match(navigation,/currentCardActionRecovery\(\)\[action\]/);
  assert.match(navigation,/refreshRoom: false/);
  assert.doesNotMatch(navigation,/client\.(?:initialize|submitSetup|sellCards|takeCpuTurn|createRoom|clearRoom)|clearCardSaleDraft|closeDisplayedRoom|submitSetup\(|cpuEntryDraft = null|commitOnlineCardSale/);
  assert.match(html,/id="cardSaleRecovery"[^>]*type="button"/);
  assert.match(html,/id="loadoutRecoveryStatus"/);
  assert.match(html,/id="cardSaleCommit"[^>]*>この内容で売る/);
  assert.match(html,/id="cardSaleRetry"[^>]*>前回の売却結果を確認/);
});

test("UDL062 candidate preflight rejects missing recovery assets or disconnected navigation", async () => {
  const { hasCardActionRecovery } = await import(pathToFileURL(path.join(__dirname, "../scripts/standard-release-preflight-contracts.mjs")).href);
  const app = fs.readFileSync(path.join(__dirname, "../standard-online-v5/app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../standard-online-v5/index.html"), "utf8");
  assert.equal(hasCardActionRecovery(html, app), true);
  for (const token of ['id="cardSaleRecovery"', 'id="cardSaleCommit"', 'progression.css?v=20260914-1']) {
    assert.equal(hasCardActionRecovery(html.replace(token, "missing"), app), false);
  }
  for (const token of ['navigateCardRecovery("sale")', 'navigateCardRecovery("loadout")', 'refreshRoom: false', 'action-recovery.js?v=20260914-1']) {
    assert.equal(hasCardActionRecovery(html, app.replace(token, "missing")), false);
  }
  const preflight = fs.readFileSync(path.join(__dirname, "../scripts/live-standard-release-preflight.mjs"), "utf8");
  assert.match(preflight, /hasCardActionRecovery, true, "CARD_ACTION_RECOVERY_REQUIRED"/);
  assert.match(preflight, /for \(const file of \["terminal-result.css", "result-continuation.js", "action-recovery.js"\]\)/);
  assert.match(preflight, /assert.equal\(response.text, fs.readFileSync/);
  assert.match(preflight, /\["progression.css", progressionCss\]/);
  for (const contract of ["CARD_ACTION_RECOVERY_REQUIRED", "HOME_RULES_REQUIRED", "COMPACT_PROFILE_REQUIRED"])
    assert.ok(preflight.includes(contract), contract);
});

test("UDL062 integrated recovery selects all three UI contracts without adding a release route", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/standard-browser-gate.yml"), "utf8");
  for (const file of ["standard-action-recovery", "standard-home-rules", "standard-profile-compact"])
    assert.equal(workflow.split(`          tests/${file}.test.cjs`).length, 2, file);
  assert.doesNotMatch(workflow, /codex\/blocked-action-recovery-20260914|codex\/profile-compact-20260914/);
  assert.match(workflow, /permissions:\r?\n  contents: read/);
});
