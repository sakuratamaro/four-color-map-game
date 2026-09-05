"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const evidence = fs.readFileSync(path.join(__dirname, "..", "docs", "STANDARD_RELEASE_EVIDENCE.md"), "utf8");
const runbook = fs.readFileSync(path.join(__dirname, "..", "docs", "STANDARD_PUBLIC_RELEASE_RUNBOOK.md"), "utf8");

test("release evidence ledger keeps local, public, approval, and blocked states distinct", () => {
  for (const state of ["VERIFIED", "PUBLIC_VERIFIED", "BLOCKED", "PENDING_APPROVAL", "PENDING", "NOT_RUN"]) assert.match(evidence, new RegExp(state));
  for (const gate of ["採否棚卸し", "ローカル製品試験", "Dashboard Advisor", "migration 006–013", "202609060001–002本番適用", "Edge Function更新", "GitHub main・Pages更新", "390px盤面", "別々の二端末による最終受入"]) {
    assert.match(evidence, new RegExp(gate));
  }
  assert.match(evidence, /token、API key、user ID、個人情報は記録しない/);
});

test("current public identity is internally consistent while T+24 keeps its release baseline", () => {
  const currentGates = evidence.match(/## 現在のゲート[\s\S]+?## 2026-09-04/)?.[0] || "";
  const publicIdentity = evidence.match(/## 公開識別子[\s\S]+?## Canary結果/)?.[0] || "";
  const currentRelease = evidence.match(/## 2026-09-06 05時台 JST 390px盤面ファースト公開[\s\S]+?## 公開識別子/)?.[0] || "";
  for (const section of [currentGates, publicIdentity, currentRelease]) {
    assert.match(section, /2a1d2ef/);
    assert.match(section, /33987952352/);
    assert.match(section, /33988962006/);
  }
  assert.match(currentGates, /app v24\/client\+intents v17\/style v23/);
  assert.match(publicIdentity, /Edge attempt 1 `badge-ready` timeout, failed-job attempt 2 Success/);
  assert.match(currentRelease, /DB migration、Edge deployment 17、RPC、ルール、報酬、在庫、戦績、秘密情報、課金、削除、cleanupは変更していない/);
  assert.match(currentRelease, /物理二端末受入とT\+24資源比較は`PENDING`/);
  assert.match(runbook, /publicAssetCommit=3fb3ef8/);
  assert.match(runbook, /physicalTwoDeviceAcceptance.*executionState: NOT_RUN.*gateState: PENDING.*automated:false/);
});

test("release evidence ledger covers every product and load acceptance family", () => {
  for (const evidenceFamily of [
    "合言葉対戦canary",
    "経済・進行・見た目canary",
    "野良対戦canary",
    "CPU canary",
    "軽量化・負荷",
    "cleanup preview",
    "full/delta bytes",
    "p50",
    "p95",
    "error rate",
  ]) assert.match(evidence, new RegExp(evidenceFamily));
  assert.match(evidence, /実削除は別承認/);
});
