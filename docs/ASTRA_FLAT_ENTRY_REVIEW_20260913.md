# フラット入口：固定候補の公開レビュー

CANON_RECEIPT version=shared-canon-v1.1 base=3b1d4e65197c476686b7b8a13c49f97ffd591e68 request=UDL-20260907-023,ADD-20260912-ENTRY-FLAT-THREE-BUTTONS specs=docs/SHARED_CANON.md,docs/UI_FLAT_ENTRANCE_20260912.md tests=tests/standard-online-browser.test.cjs,tests/standard-online-ui-static.test.cjs worktree=.codex-worktrees/ui-flat-entry-20260912

## 独立した今回の対象
- SUBJECT_SHA: 9515f9bed9536dc2c44b71817129abb9c86ef24f
- BASE_SHA: 3b1d4e65197c476686b7b8a13c49f97ffd591e68
- Canon: shared-canon-v1.1
- Feature specification: UDL-023-entrance-v2
- Specification blob: 630964f0af6956ff544d0209ba55209f6ba7d317
- Review kind: game_production_release_approval
- Scope: Pages_only; DB change set []; Edge change set [].
- Dedicated branch: codex/ui-flat-entry-20260912; clean/pushed. このUI候補のmain/PagesはNOT_RUN。
- [全10ファイル差分](https://github.com/sakuratamaro/four-color-map-game/compare/3b1d4e65197c476686b7b8a13c49f97ffd591e68...9515f9bed9536dc2c44b71817129abb9c86ef24f)
- [固定仕様](https://github.com/sakuratamaro/four-color-map-game/blob/9515f9bed9536dc2c44b71817129abb9c86ef24f/docs/UI_FLAT_ENTRANCE_20260912.md)

v13の本人発言bbb2137d-8aaa-4432-ab40-0938b5a4cde2に対応する後続入口便です。旧023の公開履歴は保持し、新しい3ボタン横並び受入と区別します。065を先にmain/Pagesへ公開した後の独立したUIレビューです。旧062の024限定受入や第三062プロフィールを再開しません。

## 製品変更
HTML/CSSのみ。CPU/人の入れ子枠、説明バッジ、追加見出しを外し、CPU・友だち・だれとでもの3ボタンを同じ階層で並べます。既存IDと操作handlerは不変、accessible nameは対戦の意味を保持。lobbyTitleのfocusは下線で示し、黄色い囲みを除去。390/768/1280pxで1行3列。ui-diet.css v20260912-3。app39、engine、DB、Edge、カード、画像、経済は変更なし。

10 text files、77 additions/46 deletions。既存Windows workflowの専用ブランチallowlistと固定テストを追加するだけで権限/main-triggerを広げません。旧仕様は後発v2の置換部分を明記します。

## 実行済み証拠
- static66/66 PASS517.4646ms、拡張93/93 PASS899.7482ms。全非browser913件再実行とは主張しません。
- installed Chrome10/10 PASS76.8066014s、Edge15/15 PASS129.3888086s。入口3幅/keyboard/無自動room作成、CPU6枚、公開検索success/error、quiznoticefocus、全5件065、Edge追加でCPU lost-response/途中復帰等。
- 新候補固有の[Windows34699225793](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34699225793) SUCCESS14:38:50Z。Chrome103567909286:586/586契約+137/137browser。Edge103567909535:586/586契約+79/79lifecycle+137/137browser。全skip0、3builder PASS。旧3b1の結果の流用ではありません。
- ローカルChrome390/768/1280画像は実視認済み。3つの同列ボタン、読める文字、追加説明/黄色枠なし。画像は共有GitHubに追加していません。物理端末NOT_RUN。
- docs/UI_FLAT_ENTRANCE_LOCAL_20260912.md が詳細証拠。

## このUIの公開後計画（未実行）
承認後、fresh main祖先確認→同一9515のforceなしmain/Pages→fresh preflightおよびHTML/app39/ui-diet CSS3の厳密byte一致。別の試験プロフィール1件、対局0件、180秒の一度限りのnavigation canary。3幅のfriend/public選択、CPU一覧10人を開いてEscape、focus、reloadを確認し、募集検索/対局開始/quiz/gacha/購入/削除はしません。

scripts/live-standard-flat-entry-canary.cjs は既存read-only request policyを再利用し、全ての不許可通信を送信前に拒否。ブラウザーを閉じた後に保存profileState・revision、許可通信、consoleの3判定を全て保存します。既知の応答envelopeのdisplayName問題は別REGとして情報項目に残し、永続profileStateの厳密比較は弱めません。5/5 local harness guards PASS、実本番NOT_RUN。

## 先行065の公開報告と判定依頼（別対象）
実承認026への対応：3b1はmain公開済み、[Pages34701307182](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34701307182) SUCCESS、fresh preflightok:true、4asset厳密byte一致。許可の1プロフィール/1CPUを一度実行し、本人cutin1、相手generic cutin2、所持カード消費1、focus/pointer透過、実盤面変化への反応を観測。総CPU7/本人6、試験対局は終局、削除なし。

総合結果はFAILであり、完成に書き換えません。[固定された失敗JSON](https://github.com/sakuratamaro/four-color-map-game/blob/845a43ce510bb86ef8004a2917d9819efdacaa90/docs/SKILL_CUTIN_LIVE_20260913.json) SHA256E968514192E44454C1C612288426050BC0D64D324BDCDD94D3C4683605C31237。最後のno unapproved browser operationで失敗。console判定は後続にあり未記録。再読込の1280画像はloading画面のため、直後0eventというraw値だけでhydration後の再演抑止を証明済みにしません。

Source diagnosis: 起動時のcosmetic-catalogは既存読取APIですが、この065 harnessの許可集合に欠落していました。失敗実行は拒否したoperation名を保存しておらず、この原因はsource-backed diagnosisで実リクエストの観測確定とは区別します。

今回の証拠差分ではハーネスだけを修正：既存readOnlyRequestを再利用しcosmetic-catalog等だけを無消費の読み取りとして許可、書込み上限24CPU/9本人と他対局拒否は保持。reloadは接続完了+matchCard+board canvasを待ち、過去event IDとの重複だけを検査して真の新イベントを失敗扱いにしません。最終3判定とconsole/拒否operation数を失敗時も保存。7/7局所テストPASS638.5208ms（stub readinessでありlive再試験ではありません）。修正ハーネスSHA2567347293FDB0113A09D03F542BC5A4CF1614FF55601B5730FA4E9AB0664AC28BC。製品3b1は不変です。

065は追加プロフィールなしの限定受入が可能か、修正ハーネスによる一度限りの追加試験が必要か、出典付きで判定してください。追加試験許可が出るまでは実行しません。元065レビュー予算は3回消費・終了、期限をリセットせず、この報告のための別ポーリングは作りません。今回の独立9515レビューだけに新しい有限予算を設定します。

このUIのDECISION/SUBJECT_SHA/BLOCKERS/NOTESと、065公開後報告への区別された判定をお願いします。図鑑066はローカル準備中、CPU画像/強化/投了などの残りv13項目も未完です。
