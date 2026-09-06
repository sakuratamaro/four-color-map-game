"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runbook = fs.readFileSync(path.join(__dirname, "..", "docs", "STANDARD_PUBLIC_RELEASE_RUNBOOK.md"), "utf8");

test("current alpha.3 release lane is Pages-first and preserves active rooms through a compatible rollback", () => {
  const releaseSection = runbook.slice(runbook.indexOf("### alpha.3カテゴリ制限便"), runbook.indexOf("### 完了履歴: 合法色なし宣言廃止便"));
  const pages = releaseSection.indexOf("Pages app v40/intents v18/local bundle v4");
  const edge22 = releaseSection.indexOf("Edge deployment 22上の互換smoke", pages);
  const alpha3Edge = releaseSection.indexOf("alpha.3対応Edge", edge22);
  const canary = releaseSection.indexOf("専用canary", alpha3Edge);
  assert.ok(pages >= 0 && edge22 > pages && alpha3Edge > edge22 && canary > alpha3Edge);
  for (const phrase of [
    "b01c43e", "4b2ea3d", "migration tail `202609060003`", "NEW_STANDARD_MATCH_ENGINE_VERSION",
    "5.0.0-alpha.2", "5.0.0-alpha.3", "request bodyから変更できない", "activeなalpha.3 room数",
    "app v40", "skill intents v18", "local bundle v4", "test-only状態注入は追加しない",
    "all-three no-op", "NOT_RUN", "active alpha.3 roomが0になる前にEdge deployment 22へ単純復帰しない",
  ]) assert.match(releaseSection, new RegExp(phrase.replaceAll(".", "\\.")));
});

test("release runbook fixes migration history and the retired-declaration Pages-first exception", () => {
  const migrationSection = runbook.slice(runbook.indexOf("## DB適用順序"), runbook.indexOf("## EdgeとPagesの順序"));
  const releaseSection = runbook.slice(runbook.indexOf("## EdgeとPagesの順序"), runbook.indexOf("## 段階canary"));
  let previous = -1;
  for (let sequence = 6; sequence <= 13; sequence += 1) {
    const marker = `20260903${String(sequence).padStart(4, "0")}`;
    const position = migrationSection.indexOf(marker, previous + 1);
    assert.ok(position > previous, marker);
    previous = position;
  }
  for (let sequence = 1; sequence <= 7; sequence += 1) {
    const marker = `20260905${String(sequence).padStart(4, "0")}`;
    const position = migrationSection.indexOf(marker, previous + 1);
    assert.ok(position > previous, marker);
    previous = position;
  }
  for (let sequence = 1; sequence <= 3; sequence += 1) {
    const marker = `20260906${String(sequence).padStart(4, "0")}`;
    const position = migrationSection.indexOf(marker, previous + 1);
    assert.ok(position > previous, marker);
    previous = position;
  }
  const database = releaseSection.indexOf("DB 18本とcandidate verification 72/72を確認する");
  const pages = releaseSection.indexOf("StandardオンラインPagesを公開");
  assert.ok(database >= 0 && pages > database);
  const pagesV36 = releaseSection.indexOf("Pages v36");
  const edge22 = releaseSection.indexOf("Edge deployment 22", pagesV36);
  const colorCanary = releaseSection.indexOf("専用COLOR canary", edge22);
  assert.ok(pagesV36 >= 0 && edge22 > pagesV36 && colorCanary > edge22);
  for (const phrase of ["5.0.0-alpha.1", "5.0.0-alpha.2", "NO_COLOR_DECLARATION_RETIRED", "--expect=candidate", "index.ts", "standard-engine.bundle.js", "Edgeをdeployment 21へ先に戻す"]) {
    assert.match(releaseSection, new RegExp(phrase.replaceAll(".", "\\.")));
  }
  assert.match(runbook, /PagesをDBより先に公開しない/);
  assert.match(runbook, /今便はDB変更なし/);
  assert.match(runbook, /migration tail `202609060003`/);
  assert.match(runbook, /202609060003`適用後にPagesを戻す場合も、旧クライアントから未使用のavailability関数と索引は保持/);
  assert.match(runbook, /202609050006.*適用直前[\s\S]+duplicate_active_actor_state[\s\S]+重複件数が0/);
  assert.match(runbook, /0でなければ `202609050006` を適用せず/);
});

test("release gates cover human, CPU, persistence, privacy, load, and safe rollback", () => {
  for (const phrase of ["別々の二端末", "実時間90秒", "180秒", "10件同時確保", "同じCPUとの再戦", "profile=null", "p50", "p95", "private漏えい"]) {
    assert.match(runbook, new RegExp(phrase));
  }
  assert.match(runbook, /p_dry_run=true/);
  assert.match(runbook, /その場で表や列をDROPしない/);
  assert.match(runbook, /Edge canary失敗時はEdgeをdeployment 21へ先に戻し/);
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
  assert.match(runbook, /publicAssetCommit=9b7d8f4/);
  assert.match(runbook, /pagesCommit=9b7d8f4/);
  assert.match(runbook, /pagesRun=34022540907/);
  assert.match(runbook, /repository HEAD `d5c77ac`とは分離/);
  assert.match(runbook, /古い組を流用しない/);
  assert.match(runbook, /固定37 metric/);
  assert.match(runbook, /HOLD\/INVESTIGATE/);
});

test("current physical acceptance card covers normal PvP, CPU, LAB, reload, rematch, persistence, and privacy", () => {
  for (const phrase of ["物理二端末10分実行カード", "同一ブラウザーの2タブでは代用しない", "通常の合言葉対戦", "即時CPU", "双方LAB ON", "片側だけ再読込", "actionが二重反映されない", "LAB分の戦績・券・在庫・履歴", "private情報"]) {
    assert.match(runbook, new RegExp(phrase));
  }
});
