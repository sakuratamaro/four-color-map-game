# v4/v5/v6 additive intake

CANON_RECEIPT version=shared-canon-v1.1 base=ce6fab535235d7aff90d0bc846bbfb648c9a56e4 request=UDL-051,034,037,029,057,058,059 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md tests=tests/governance-shared-canon.test.cjs

既存司令塔の通常作業として受領。共有正本は既存repository `sakuratamaro/four-color-map-game` の既存UDL・仕様・tests・公開証拠。未mainの今回文書は既存 `codex/dev-brain-current-20260910` branchでレビュー可能とし、ZIPや別タスクを新しい正本にしない。差分整理・移行ゴール・常駐基盤を再開始しない。

## 独立に確認した梱包整合性

| Package | Manifest files | Records | 前版からの増分 |
|---|---:|---:|---|
| v4 | 24/24一致 | 20 | v3の17件不変＋3件 |
| v5 | 27/27一致 | 25 | v4の20件不変＋5件 |
| v6 | 32/32一致 | 28 | v5の25件不変＋3件 |

SHA-256、全追加ID、出典・受入・既存試験との対応は `BRAIN_V4_V6_INTAKE_20260911.json`。全parent hash一致、未列挙fileなし、ID重複・削除・旧record変更なし。ZIP同梱Pythonは実行せず、展開上書きもしない。JSON/YAML意味一致は未再実行。これは梱包検証でありゲーム試験ではない。

別添CPU_GENDER_BALANCE_HANDOFF.mdはv3以後の内包文書とbyte一致（741c5ece…8318）、CPU_AURORA_SPLIT_CORNER_HANDOFF.mdはv5/v6とbyte一致（01e3f47b…c983）。二重取込しない。v4/v6の元発言IDは未取得、ZIP内原文・locator・hashを保持。v5は保存済み実user `bbb215c4-69f9-4ed7-90b6-d9acf1e3ed9f`、Astra設計 `9553a070-9041-4e82-9705-9f467955e341` に照合。元ID不明を架空値で埋めない。画像から対局・残手札・券Lvを実測したとは扱わない。

## 差分の行き先

- CPUの浪費抑制・救済・最強/最弱・前向きな二つ名・再確認の5 aliasは既存UDL-051へ統合。5名の呼称はAstra設計として採用し、v3の名前不変を二つ名部分だけ置換。各Lv男女1:1・シオンLv5/レイLv4・顔/固有ID/履歴保持。正式設定確認と実効強度試験は未完。
- クイズの瞬間整列はUDL-034、二分の使い方はUDL-037を新受入でREOPEN。過去の公開実績を削除しない。
- 角膨張はUDL-029の再要求。現mainにはmacro payloadが存在するが、micro選択/説明と2112px zoomも残る。旧候補を丸ごとmergeせず、不足UIを現在のmainから再構成する。
- 条件付きの公開スキル履歴をUDL-057、オーロラの適用/視認性をUDL-058、報酬ガチャの券Lv引継ぎをUDL-059として採番。同等の既存行を調べ、効果音、本人private履歴、購入不足、報酬永続化/数量とは別要件と判断した。

## 現行コードとの小さな切り分け

`ce6fab5`の `goToGacha` はLv指定に対応し、CPU結果ボタンは保存報酬Lvを渡している。一方、`quizGoGacha` は無引数で、結果の `lastQuizResult.reward.ticketLevel` を渡していない。不足したクイズ入口を独立Pages sliceの次対象とする。未決着ガチャの同じactionId/券Lv/枚数を保護し、報酬量・率を変更しない。

CPU救済は未所持・候補漏れ・対象/順序評価を分ける。持ち色変更→二分の例を同カテゴリ制限に反して実現しない。無通知の裏付与禁止を、別件の事前チャージ設計撤回へ読み替えない。オーロラの未適用と見えにくさは未判定。新受入の既存テストpathを対応付けただけで、自動テスト実装・実行済みとはしない。

独立して承認済みのパレット `ce6fab5` は本取込を待たずmain/Pagesへ公開し、実本番30/30で確認済み。資料の旧pending表示へ戻さない。今回の新要望はまだ公開済みではなく、ZIP自体はAPPROVE_RELEASEではない。既存review waitはPAUSEDを維持する。

取込後検証: `node --test tests/governance-shared-canon.test.cjs tests/standard-decision-reconciliation.test.cjs` は17/17 PASS・skip0。新alias11件の唯一性/出典/既存UDL/試験path、旧28件snapshot保持、公開slice範囲、実承認004/005/007の個別SHA/base/spec/scope、否定ケースを検証した。これは文書と接続の検証であり、新CPU等のゲーム受入合格ではない。次の059は通常作業への引継ぎで、まだ実装開始済みとはしない。
