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
  for (let sequence = 1; sequence <= 7; sequence += 1) {
    const marker = `20260905${String(sequence).padStart(4, "0")}`;
    const position = runbook.indexOf(marker, previous + 1);
    assert.ok(position > previous, marker);
    previous = position;
  }
  for (let sequence = 1; sequence <= 2; sequence += 1) {
    const marker = `20260906${String(sequence).padStart(4, "0")}`;
    const position = runbook.indexOf(marker, previous + 1);
    assert.ok(position > previous, marker);
    previous = position;
  }
  const edge = runbook.indexOf("DB 17本とcandidate verification 70/70を確認する");
  const pages = runbook.indexOf("StandardオンラインPagesを公開");
  assert.ok(edge > previous && pages > edge);
  assert.match(runbook, /PagesをDBより先に公開しない/);
  assert.match(runbook, /現行本番は`node scripts\/live-standard-release-preflight\.mjs --expect=candidate`/);
  assert.match(runbook, /--expect=baseline`は初回段階公開の履歴用/);
  assert.match(runbook, /202609060002`適用後の本番には実行しない/);
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
  assert.match(runbook, /live-standard-legal-recolor-lab-canary\.mjs --confirm-live/);
  assert.match(runbook, /index\.ts.*standard-engine\.bundle\.js.*同じdeployment/);
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
  assert.match(runbook, /2026-09-06 16:23 JST`以降/);
  assert.match(runbook, /STANDARD_OBSERVATION_T0_20260905\.json/);
  assert.match(runbook, /publicAssetCommit=3fb3ef8/);
  assert.match(runbook, /pagesCommit.*pagesRun.*T\+24実行時点のmain HEAD/);
  assert.match(runbook, /古い組を流用しない/);
  assert.match(runbook, /固定37 metric/);
  assert.match(runbook, /HOLD\/INVESTIGATE/);
});

test("current physical acceptance card covers normal PvP, CPU, LAB, reload, rematch, persistence, and privacy", () => {
  for (const phrase of ["物理二端末10分実行カード", "同一ブラウザーの2タブでは代用しない", "通常の合言葉対戦", "即時CPU", "双方LAB ON", "片側だけ再読込", "actionが二重反映されない", "LAB分の戦績・券・在庫・履歴", "private情報"]) {
    assert.match(runbook, new RegExp(phrase));
  }
});
