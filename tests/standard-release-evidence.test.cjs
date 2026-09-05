"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const evidence = fs.readFileSync(path.join(__dirname, "..", "docs", "STANDARD_RELEASE_EVIDENCE.md"), "utf8");

test("release evidence ledger keeps local, public, approval, and blocked states distinct", () => {
  for (const state of ["VERIFIED", "PUBLIC_VERIFIED", "BLOCKED", "PENDING_APPROVAL", "PENDING", "NOT_RUN"]) assert.match(evidence, new RegExp(state));
  for (const gate of ["採否棚卸し", "ローカル製品試験", "Dashboard Advisor", "migration 006–013＋後続001–007本番適用", "Edge Function更新", "GitHub main・Pages更新", "別々の二端末による最終受入"]) {
    assert.match(evidence, new RegExp(gate));
  }
  assert.match(evidence, /token、API key、user ID、個人情報は記録しない/);
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
