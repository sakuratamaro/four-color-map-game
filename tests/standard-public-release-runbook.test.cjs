"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runbook = fs.readFileSync(path.join(__dirname, "..", "docs", "STANDARD_PUBLIC_RELEASE_RUNBOOK.md"), "utf8");
const onlineIndex = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "index.html"), "utf8");
const localIndex = fs.readFileSync(path.join(__dirname, "..", "standard-v5", "index.html"), "utf8");
// Freeze only the two superseded cache labels in main70e's historical release lanes.
// Current UI generation is checked independently below; no old approval is reused.
const pilotOnlineIndex = onlineIndex.replace("app.js?v=20260923-1", "app.js?v=20260921-2")
  .replace("cpu-portraits.js?v=20260913-2", "cpu-portraits.js?v=20260908-1");
const followupOnlineIndex = pilotOnlineIndex.replace("app.js?v=20260921-2", "app.js?v=20260915-8")
  .replace("style.css?v=20260921-1", "style.css?v=20260915-8");
const priorOnlineIndex = followupOnlineIndex.replace("app.js?v=20260915-8", "app.js?v=20260913-44")
  .replace("style.css?v=20260915-8", "style.css?v=20260910-12");

function assetReference(source, pattern, label) {
  const reference = source.match(pattern)?.[1];
  assert.ok(reference, `${label} asset reference missing from its authoritative index`);
  return reference;
}

test("UDL033 current-base artwork lane is separate from frozen pilot and source approvals", () => {
  const section=runbook.slice(runbook.indexOf("## 2026-09-23 CPU画像"),runbook.indexOf("## 2026-09-21 CPU試練"));
  for(const value of ["UDL-033-wataokiba-public-ui-v2","b07da70259c776554cb6057a48db49307bd7925f",
    "21cc31af8ee4ca70f22c25e220c608a0d44d38d5","Pages_only","元PNG20枚","35GET","8固定未認証負例POST",
    "047/060","新候補固有のWindows","真正Astra","NOT_RUN"])assert.ok(section.includes(value),value);
  for(const marker of ["app.js?v=20260923-1","cpu-portraits.js?v=20260913-2","cpu-artwork.css?v=20260913-1"]){
    assert.ok(section.includes(marker),marker);assert.ok(onlineIndex.includes(marker),marker);
  }
});

test("frozen parent UI lane retains its original assets and release boundary", () => {
  const section=runbook.slice(runbook.indexOf("## 2026-09-15 独立UIダイエット便"),runbook.indexOf("更新日:"));
  for(const phrase of ["UI_PLAY_SURFACE_20260912.md", "v1.5", "70e691b6f8f1d808476e80990d20df7862bfb782",
    "codex/ui-diet-release-20260915", "DB/Edge/管理設定は各 `[]`", "own Windows", "新しい実Astra承認",
    "同SHA Pages", "全byte一致", "有限45分", "過去のlive試行枠は流用しない", "NOT_RUN", "旧052を流用したmain上書きは禁止"])
    assert.ok(section.includes(phrase),phrase);
  for(const asset of ["app.js?v=20260915-5", "style.css?v=20260915-5", "play-surface.css?v=20260915-3"])
    assert.ok(section.includes(asset), asset);
});

test("frozen UI follow-up retains own review, parent publication and exact original assets", () => {
  const section=runbook.slice(runbook.indexOf("## 2026-09-15 UI後続便"),runbook.indexOf("## 2026-09-15 独立UIダイエット便"));
  for(const phrase of ["UI_FOLLOWUP_RELEASE_20260915.md", "UDL-052-060-followup-v1", "v1.6",
    "98d23900f1b8cac25f73740dfe8ae31674268cb9", "codex/ui-followup-release-20260915",
    "DB/Edge/管理設定は各 `[]`", "own Windows", "新しい実Astra承認", "先行98dの実公開", "旧053を流用しない",
    "同SHA Pages", "全byte一致", "有限45分", "過去のlive試行枠は流用しない", "NOT_RUN", "未予約・未実行"])
    assert.ok(section.includes(phrase),phrase);
  for(const pattern of [/src="(app\.js\?v=[^"]+)"/,/href="(style\.css\?v=[^"]+)"/,/href="(play-surface\.css\?v=[^"]+)"/])
    assert.ok(section.includes(assetReference(followupOnlineIndex,pattern,"frozen follow-up asset")));
  const app=fs.readFileSync(path.join(__dirname,"..","standard-online-v5","app.js"),"utf8");
  assert.ok(section.includes(assetReference(app,/import[^\n]+"\.\/(play-surface-model\.js\?v=[^"]+)"/,"current follow-up model")));
});

test("UDL065 named-skill lane binds Edge-first compatibility and forbids borrowing a consumed live trial", () => {
  const section = runbook.slice(runbook.indexOf("### UDL-065: 使用済みスキル名の公開表示"), runbook.indexOf("### UDL-065: v14カットイン可読性・実結果説明"));
  for (const phrase of ["UDL-065-public-skill-v1", "DB/管理設定は各 `[]`", "standard-engine.bundle.js", "index.ts",
    "互換Edge → 完全2file読戻し → Pages", "CPU039とUI040", "040の消費済み試行を再使用しない", "NOT_RUN"]) assert.ok(section.includes(phrase), phrase);
  for (const pattern of [/src="(app\.js\?v=[^"]+)"/, /src="(skill-cutin\.js\?v=[^"]+)"/, /href="(skill-cutin\.css\?v=[^"]+)"/])
    assert.ok(section.includes(assetReference(priorOnlineIndex, pattern, "frozen main70e named-skill lane")));

});

test("UDL023 v14 is a separate Pages-only successor with explicit actions and no live authority", () => {
  const section = runbook.slice(runbook.indexOf("### UDL-023: v14公開対戦の二操作"), runbook.indexOf("### UDL-065: 使用済みスキル名の公開表示"));
  for (const phrase of ["UDL-023-public-actions-v1", "70e691b6f8f1d808476e80990d20df7862bfb782", "Pages_only",
    "DB/Edge/管理設定は各 `[]`", "真正Astra判定", "recruitだけ", "findだけ", "同一ID再送",
    "実ユーザーへのfind/recruit", "ここでは許可しない", "NOT_RUN"]) assert.ok(section.includes(phrase), phrase);
  // The approved parent lane is historical evidence, not the successor's asset versions.
  for (const marker of ["app.js?v=20260913-48", "ui-diet.css?v=20260913-4"])
    assert.ok(section.includes(marker));
});

test("UDL060 terminal hierarchy binds its own asset versions and keeps release gates separate", () => {
  const section = runbook.slice(runbook.indexOf("この候補の厳密asset marker"), runbook.indexOf("入口UIのv13後続便"));
  for (const phrase of ["UDL-060-terminal-v2", "docs/UI_TERMINAL_HIERARCHY_20260914.md", "最大3操作",
    "旧pending申請の復旧", "独自Windowsゲート", "真正Astraレビュー", "fresh mainと配信byte確認",
    "CPU/DB/Edge/経済は変更しない", "公開確認は未実行"])
    assert.ok(section.includes(phrase), phrase);
  // The reviewed terminal parent keeps app v1; the new gacha lane checks the current app.
  assert.ok(section.includes("app.js?v=20260914-1"));
  for (const pattern of [/href="(terminal-result\.css\?v=[^"]+)"/])
    assert.ok(section.includes(assetReference(onlineIndex, pattern, "terminal hierarchy lane")));
  const app = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");
  // Fixed parent evidence is not rewritten for the later trial result model.
  assert.ok(section.includes("result-continuation.js?v=20260914-1"));
});

test("CPU progression UI binds current assets without rewriting parent publication evidence", () => {
  const section = runbook.slice(runbook.indexOf("## 2026-09-21 CPU試練・伝授技"), runbook.indexOf("## 2026-09-20 UI導線統合候補"));
  for (const pattern of [/src="(app\.js\?v=[^"]+)"/, /href="(style\.css\?v=[^"]+)"/, /src="(standard-online-client\.js\?v=[^"]+)"/])
    assert.ok(section.includes(assetReference(pilotOnlineIndex, pattern, "frozen pilot UI")));
  const app = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");
  for (const pattern of [/from "\.\/(result-continuation\.js\?v=[^"]+)"/, /from "\.\/(cpu-progression-model\.js\?v=[^"]+)"/])
    assert.ok(section.includes(assetReference(app, pattern, "pilot model")));
  assert.match(section, /default OFF/); assert.match(section, /do not establish publication/);
});

test("quiz parent keeps its frozen markers and terminal dependencies without live writes", () => {
  const section = runbook.slice(runbook.indexOf("クイズ入口の後続候補"), runbook.indexOf("この候補の厳密asset marker"));
  for (const text of ["UDL-062-quiz-entry-v1.1", "docs/QUIZ_LEVEL_START_20260914.md", "親70e→b9→87→df62", "fresh maindf62", "3asset厳密byte一致", "DIRECT_QUIZ_ENTRY_REQUIRED", "追加liveはこの手順では許可しない", "旧承認を新クイズ候補へ流用せず"])
    assert.ok(section.includes(text), text);
  for (const marker of ["app.js?v=20260914-2", "style.css?v=20260914-2"]) assert.ok(section.includes(marker));
});

test("gacha parent keeps its frozen assets and exact quiz parent without new live authority", () => {
  const section = runbook.slice(runbook.indexOf("ガチャ入口の後続候補"), runbook.indexOf("クイズ入口の後続候補"));
  for (const text of ["UDL-062-gacha-entry-v1", "docs/GACHA_ENTRY_DIET_20260914.md", "03bc21f6ba927f71ce05efc438827d547993b21c",
    "親70e→b9→87→df62→03bc", "fresh main03bc", "4asset厳密byte一致", "GACHA_ENTRY_DIET_REQUIRED", "DIRECT_QUIZ_ENTRY_REQUIRED",
    "新候補固有", "Windows", "真正Astraレビュー", "100枚上限", "busy/pending/Lv/actionId/count/reload/retry",
    "DB/Edge/管理設定は各 `[]`", "確率・報酬・経済変更なし", "liveはこの手順では許可しない", "親049承認", "具体的保留を迂回しない"])
    assert.ok(section.includes(text), text);
  for (const marker of ["app.js?v=20260914-6", "style.css?v=20260914-3", "standard-skill-registry.generated.js?v=20260914-2"])
    assert.ok(section.includes(marker));
});

test("frozen card action recovery retains its own assets and every local-only parent hold", () => {
  const section = runbook.slice(runbook.indexOf("カード操作の復帰導線"), runbook.indexOf("プロフィール圧縮のローカル後続候補"));
  for (const text of ["UDL-062-action-recovery-v1.1", "docs/BLOCKED_ACTION_RECOVERY_20260914.md", "c6b8ef5ca1df84aad182bf140304affee6595f68",
    "親70e→b9→87→df62→03bc→af1472d→45e6940→c6b8ef5", "fresh main一致", "5asset厳密byte一致", "CARD_ACTION_RECOVERY_REQUIRED", "action-recovery.js全文一致", "COMPACT_PROFILE_REQUIRED", "HOME_RULES_REQUIRED",
    "移動だけでのgame/economy write 0", "CPU/準備/売却pending ID保持", "ローカル限定", "未push", "独自Windows", "真正Astra",
    "Homeの元CI失敗", "親Pages保留", "新CI/取得/レビュー送受信/本番/追加liveはこのスライスでは許可しない", "旧予算や21cc/8dd9/GOV保留を迂回しない"])
    assert.ok(section.includes(text), text);
  for (const marker of ["app.js?v=20260914-9", "progression.css?v=20260914-1", "ui-diet.css?v=20260914-2"])
    assert.ok(section.includes(marker), "frozen recovery asset: " + marker);
  const app = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");
  assert.ok(section.includes(assetReference(app, /from "\.\/(action-recovery\.js\?v=[^"]+)"/, "card action recovery model")));
});

test("Home rules lane binds the exact gacha parent and own assets without inheriting approval", () => {
  const section = runbook.slice(runbook.indexOf("ホーム設定・ルールの後続候補"), runbook.indexOf("ガチャ入口の後続候補"));
  for (const text of ["UDL-062-068-home-rules-v1.1", "docs/HOME_RULES_DIET_20260914.md", "af1472d10044431be01665e122ea126da9b458a9",
    "親70e→b9→87→df62→03bc→af1472d", "fresh mainaf1472d", "3asset厳密byte一致", "HOME_RULES_REQUIRED", "GACHA_ENTRY_DIET_REQUIRED", "DIRECT_QUIZ_ENTRY_REQUIRED",
    "Windowsログ", "真正Astraレビュー", "DB/Edge/管理設定は各 `[]`", "初回プロフィール", "対戦復帰・成立通知",
    "pending/busy", "Lv/actionId/count", "34787425617 attempt1", "Chrome171/172 FAIL", "原因未特定", "checkpoint1695064", "診断・再試行枠をリセットしない",
    "liveはこの手順では許可しない", "具体的保留を迂回せず", "古い承認や閉じたPages/CI/review枠を流用しない"])
    assert.ok(section.includes(text), text);
  // Home45 remains frozen; old d9's failed Windows gate is not cleared by this successor.
  for (const marker of ["app.js?v=20260914-7", "ui-diet.css?v=20260914-1"])
    assert.ok(section.includes(marker));
});

test("compact profile keeps failed Home gate separate and binds only its own assets", () => {
  const section = runbook.slice(runbook.indexOf("プロフィール圧縮のローカル後続候補"), runbook.indexOf("ホーム設定・ルールの後続候補"));
  for (const text of ["UDL-062-profile-compact-v1.1", "docs/PROFILE_COMPACT_20260914.md", "45e69401e735c2aad01b9471c4c202ddd365381f",
    "親HomeのWindows失敗", "新CIの作成・予算リセットは許可しない", "固有WindowsはNOT_RUN", "真正Astraレビュー", "fresh main",
    "親70e→b9→87→df62→03bc→af1472d→45e6940", "pending/busy", "Lv/actionId/count", "checkpoint1695064", "旧profile3b97",
    "3asset厳密byte一致", "COMPACT_PROFILE_REQUIRED", "HOME_RULES_REQUIRED", "DB/Edge/管理設定は各 `[]`", "追加liveは許可しない", "プロフィールAPI変更なし"])
    assert.ok(section.includes(text), text);
  // Profilec6 remains a fixed parent; the recovery successor has its own current-asset contract.
  for (const marker of ["app.js?v=20260914-8", "ui-diet.css?v=20260914-2"])
    assert.ok(section.includes(marker));
});

test("frozen alpha.4 release lane deploys the compatible Edge before Pages and preserves active rooms", () => {
  const releaseSection = runbook.slice(runbook.indexOf("### alpha.4彩色済みエリア角膨張便"), runbook.indexOf("### alpha.3カテゴリ制限便"));
  const edge = releaseSection.indexOf("alpha.4対応Edge");
  const canary = releaseSection.indexOf("live canary", edge);
  const pages = releaseSection.indexOf("Pages候補asset", canary);
  assert.ok(edge >= 0 && canary > edge && pages > canary);
  const candidateAssets = [
    assetReference(priorOnlineIndex, /src="(app\.js\?v=[^"]+)"/, "frozen main70e online app"),
    assetReference(priorOnlineIndex, /href="(style\.css\?v=[^"]+)"/, "frozen main70e online style"),
    assetReference(onlineIndex, /src="(standard-online-skill-intents\.js\?v=[^"]+)"/, "online skill intents"),
    "standard-online-client.js?v=20260910-1", // Fixed parent; pilot is checked separately.
    assetReference(pilotOnlineIndex, /src="(cpu-portraits\.js\?v=[^"]+)"/, "frozen CPU portraits"),
    "app.bundle.js?v=20260913-9-4f66b9b284ba", // Exact published parent, not the later pilot bundle.
  ];
  for (const asset of candidateAssets) assert.match(releaseSection, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const phrase of [
    "origin/main@63972b6", "5.0.0-alpha.3", "active alpha.4 room", "index.ts", "standard-engine.bundle.js",
    "DB、migration、RPC、secret、cleanup scheduleは変更しない", "通常loadoutに角膨張がないlive run", "actual browser",
    "active alpha.4 roomが0になる前にalpha.4非対応Edgeへ単純復帰しない", "Pagesだけをdeployment直前に記録したPages baselineへ戻し",
  ]) assert.match(releaseSection, new RegExp(phrase.replaceAll(".", "\\.")));
});

test("current alpha.3 release lane is Pages-first and preserves active rooms through a compatible rollback", () => {
  const releaseSection = runbook.slice(runbook.indexOf("### alpha.3カテゴリ制限便"), runbook.indexOf("### 完了履歴: 合法色なし宣言廃止便"));
  const pages = releaseSection.indexOf("Pages app v40/intents v18/local bundle v4");
  const edge22 = releaseSection.indexOf("Edge deployment 22上の互換smoke", pages);
  const alpha3Edge = releaseSection.indexOf("alpha.3対応Edge", edge22);
  const canary = releaseSection.indexOf("専用canary", alpha3Edge);
  assert.ok(pages >= 0 && edge22 > pages && alpha3Edge > edge22 && canary > alpha3Edge);
  for (const phrase of [
    "b01c43e", "4b2ea3d", "3f4548d", "codex/standard-alpha3-compat-rollback-20260907", "migration tail `202609060003`", "NEW_STANDARD_MATCH_ENGINE_VERSION",
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
  assert.match(runbook, /最新便はquiz finish DB関数と表示だけを変更/);
  assert.match(runbook, /`202609100001_standard_quiz_accuracy\.sql`をSQL Editorで一度だけ適用/);
  assert.match(runbook, /migration tail `202609060003`/);
  assert.match(runbook, /202609060003`適用後にPagesを戻す場合も、旧クライアントから未使用のavailability関数と索引は保持/);
  assert.match(runbook, /202609050006.*適用直前[\s\S]+duplicate_active_actor_state[\s\S]+重複件数が0/);
  assert.match(runbook, /0でなければ `202609050006` を適用せず/);
});

test("release runbook proves the actual Edge deployment independently from the Pages artifact", () => {
  const proofSection = runbook.slice(runbook.indexOf("## Edge deployment同一性証明ゲート"), runbook.indexOf("## EdgeとPagesの順序"));
  for (const phrase of [
    "repository artifactの公開copy", "live Edge確認", "functions list", "functions download standard-game-action --use-api",
    "functions deploy standard-game-action", "status=ACTIVE", "verify_jwt=true", "ezbr_sha256",
    "NOT_EXPOSED_BY_CLI", "standard-engine.bundle.js", "全byte一致", "UTF-8 LF正規化比較", "15分以内",
    "deploy log → projects → functions metadata → download readback → canary", "SOURCE_VERIFIED_CANARY_PENDING",
    "gateState=VERIFIED", "--canary-log", "active room件数",
  ]) assert.match(proofSection, new RegExp(phrase.replaceAll(".", "\\.")));
  assert.match(proofSection, /id \+ version/);
  assert.match(proofSection, /--project-ref qkcuhludisairpgzhryl/);
  assert.match(proofSection, /--use-api/);
  assert.match(proofSection, /--stage=source/);
  assert.match(proofSection, /--stage=release/);
  assert.match(proofSection, /--expect-version <deployment-version>/);
  assert.match(proofSection, /--deploy-log/);
  assert.match(proofSection, /--download-log/);
  assert.match(proofSection, /live-standard-edge-canary\.mjs --confirm-live/);
  assert.match(proofSection, /CLIが未導入、未認証.*`BLOCKED`/);
  assert.match(proofSection, /function名を省略した一括deploy.*使わない/);
  assert.match(proofSection, /access token.*service role.*証拠へ出さない/);
  assert.match(proofSection, /CLI未認証時のsigned-in Dashboard ZIP fallback/);
  assert.match(proofSection, /VERIFIED_WITH_DASHBOARD_SOURCE_READBACK/);
  assert.match(proofSection, /CONTROL_PLANE_ID_NOT_OBSERVED/);
  assert.match(proofSection, /--metadata-mode=dashboard/);
  assert.match(proofSection, /baseline\/standard-game-action/);
  assert.match(proofSection, /post\/standard-game-action/);
  assert.match(proofSection, /--baseline-download-log/);
  assert.match(proofSection, /version\/idが必要な監査ではこの制約を`PENDING`/);
  assert.match(proofSection, /alpha\.4 active roomが0になる前にalpha\.4非対応sourceへ戻さない/);
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
