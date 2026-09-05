"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runbook = fs.readFileSync(path.join(__dirname, "..", "docs", "STANDARD_PUBLIC_RELEASE_RUNBOOK.md"), "utf8");

test("release runbook fixes migration-before-Edge-before-Pages order", () => {
  let previous = -1;
  for (let sequence = 6; sequence <= 13; sequence += 1) {
    const marker = `20260903${String(sequence).padStart(4, "0")}`;
    const position = runbook.indexOf(marker, previous + 1);
    assert.ok(position > previous, marker);
    previous = position;
  }
  for (let sequence = 1; sequence <= 6; sequence += 1) {
    const marker = `20260905${String(sequence).padStart(4, "0")}`;
    const position = runbook.indexOf(marker, previous + 1);
    assert.ok(position > previous, marker);
    previous = position;
  }
  const edge = runbook.indexOf("DB 14本の確認が終わってから");
  const pages = runbook.indexOf("StandardオンラインPagesを公開");
  assert.ok(edge > previous && pages > edge);
  assert.match(runbook, /PagesをDBより先に公開しない/);
  assert.match(runbook, /202609050006.*適用直前[\s\S]+duplicate_active_actor_state[\s\S]+重複件数が0/);
  assert.match(runbook, /0でなければ `202609050006` を適用せず/);
});

test("release gates cover human, CPU, persistence, privacy, load, and safe rollback", () => {
  for (const phrase of ["別々の二端末", "実時間90秒", "180秒", "10件同時確保", "同じCPUとの再戦", "profile=null", "p50", "p95", "private漏えい"]) {
    assert.match(runbook, new RegExp(phrase));
  }
  assert.match(runbook, /p_dry_run=true/);
  assert.match(runbook, /その場で表や列をDROPしない/);
  assert.match(runbook, /Edge canary失敗時はPagesを公開せず/);
});

test("release runbook records honest T0 and T+24h observations without automating physical acceptance", () => {
  assert.match(runbook, /capture-standard-release-observation\.mjs --label=T0/);
  assert.match(runbook, /capture-standard-release-observation\.mjs --label=T\+24h/);
  assert.match(runbook, /64 KiB/);
  assert.match(runbook, /PENDING.*null/);
  assert.match(runbook, /repository HEAD.*公開asset commit.*Pages commit\/run/);
  assert.match(runbook, /executionState: NOT_RUN/);
  assert.match(runbook, /gateState: PENDING/);
  assert.match(runbook, /automated:false/);
});
