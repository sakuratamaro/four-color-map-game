"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"standard-online-v5/app.js"),"utf8");
const html=fs.readFileSync(path.join(root,"standard-online-v5/index.html"),"utf8");
test("UDL062 normal connection and recovery copy uses outcomes, not transport identifiers",()=>{
  assert.doesNotMatch(app+html,/匿名セッション|匿名ログイン済み|同じ(?:処理|操作|回答|抽選|売却|準備)ID|端末ユーザー/);
  for(const text of ["接続済み","ゲームに接続できました。","前回の操作結果を確認","前回の準備結果を確認","前回の再戦申請を確認","前回の回答を確認"])
    assert.ok((app+html).includes(text),text);
  assert.match(app,/戦績を確認しています。マイページでも確認できます。/);
  assert.match(app,/通信環境を確認して、ページを開き直してください。/);
  assert.match(app,/console\.error\(error\)/);
});
test("UDL062 keeps optional diagnostics, critical notices and existing retry entrypoints",()=>{
  assert.match(html,/<details class="sync-details">\s*<summary>接続の詳細（調査用）<\/summary>/);
  for(const id of ["publicProjection","privateProjection","paletteImpactNotice","cardSaleRetry","retryAction","connectionBadge","connectionMessage"])
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  for(const key of ["setupActionId","rematchActionId","COSMETIC_PENDING_KEY","GACHA_PENDING_KEY","pendingAnswer","client.ensureSession()"])
    assert.ok(app.includes(key),key);
  assert.match(html,/同じ色が辺で接しないように塗りましょう。直前の操作は「直前の一手」で確認できます。/);
  assert.doesNotMatch(html,/隣接色の数や塗れる色の答えは表示しません/);
});
