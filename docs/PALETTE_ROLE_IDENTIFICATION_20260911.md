# UDL-052: パレット属性識別の小改修

仕様版: UDL-052-roles-v1。基準: main@5c03e6c2d0e94c843776ea7eae0d7bbe2917a174。

`CANON_RECEIPT version=shared-canon-v1.1 base=5c03e6c2d0e94c843776ea7eae0d7bbe2917a174 request=UDL-20260910-052 specs=docs/REQUEST_ADDENDUM_20260910_PALETTE.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md tests=tests/standard-online-skill-intents.test.cjs,tests/standard-online-browser.test.cjs`

正本入口と受領資料は当面codex/dev-brain-current-20260910の固定文書版を参照。既存Codex司令塔が単独で実装する。出典はChatGPT「改修ロールバック防止策」user 03751588-f991-4bd6-84bf-578e76949808、設計指示c76043e6-e84e-4d14-9795-5f51fd0d5f7a、続行指示77551f6f-4d00-402e-9c71-96f8923b094c。d53ac7bのAPPROVE_DOCSはゲーム公開承認ではない。

## 受入と非変更範囲

- coherentな自席private snapshotから基本枠数・おまけ属性・残回数を独立表示する。赤が基本かつおまけなら両方、基本2枠が赤なら基本色×2。
- おまけ残0でも基本色なら使用可能。おまけのみ残0は不可。一時色の可用性と封印の禁止を従来どおり維持する。
- 既存の色別ボタン数・順序・配置方式は不変。4色固定方式の採否や固定位置というUDL-052全体の残件はこの便で完了扱いにしない。
- slot指定、authoritative消費順、隣接合法性の先回り表示禁止、相手private秘匿、同version projectionを維持する。
- CPU・報酬・ガチャ・engine bundle・DB・Edgeは変更しない。公開は新候補の実レビューとWindows/Pagesゲートを別途必要とする。

## 検証

関数の重複数・残0・入力非変更は周辺を含め10/10 PASS。実ブラウザーはChrome/Edge各3/3 PASS（新規900px/390px、aria名、両役割、封印、一時色、public非漏えい、表示のみでaction 0、既存torn projection、封印／操作制御）。最初の新規画面試験は手数欄をversionとして待ったfixture不備で失敗し、turn/versionの整合後に両ブラウザーで再合格した。製品の合法性や待機条件は緩めていない。

builder3本を実行し生成物差分0。845件の非browser選択試験では、新cache世代に追随する検証用期待値と、clean HEADが必要なsource検証fixtureが失敗したため、期待値を明示更新しcommit後に再検証する。失敗履歴は製品合格として数えない。候補はapp v20260911-26 / intents v20260911-21。Windowsゲート・新候補レビュー・main/Pages公開はこの文書時点で未実施。
