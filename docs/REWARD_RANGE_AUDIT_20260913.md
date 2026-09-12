# UDL-046 v14報酬範囲の独立照合（部分完了）

CANON_RECEIPT version=shared-canon-v1.1 base=d9ce111d7d97019d55b3e90842602001e045ea04 request=UDL-20260909-046,ADD-20260913-MATCH-REWARD-RANGE-AUDIT specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/CPU_TIERS_INTAKE_20260911.md tests=tests/standard-match-reward.test.cjs,tests/standard-online-engine-bundle.test.cjs

2026-09-13 JST。既存司令塔による読取とローカル検証のみ。成果物は共有branch codex/dev-brain-current-20260910 の本ファイル。正本の要望はPROJECT_COMMAND_CENTER.mdのUDL-046のまま。クロガネ100回候補9590を変更せず、報酬改定・公開・本番profile/room作成は行わない。

## 結果

現行固定値をコード・実テストで独立確認した。記憶されている抽選範囲と異なるが、当該範囲を実装後に失った証拠は今回見つかっていない。一方、現在の固定値をユーザーが個別に採用した元の発言も、今回確認したリポジトリ履歴では特定できていない。コードに合わせて矛盾を解消せず、**CODE_VERIFIED / ADOPTION_SOURCE_GAP** として残す。

| 対象 | v14本人が照合を求めた記憶値 | 現在の定義・実行結果 |
| --- | --- | --- |
| PvP勝利 | Lv3〜5券、2〜4枚 | Lv2券×1枚 |
| PvP敗北 | Lv1〜3券、1〜3枚 | Lv1券×1枚 |
| CPU勝利 | CPUのLvと同じ券Lv、2〜4枚 | ユズLv1×2、レン/ミナト/コハル/アオイ/カイLv2×1、ツバサ/シオン/レイLv2×2、クロガネLv3×2 |
| CPU敗北 | Lv1券、1〜3枚 | 全10人Lv1券×1枚 |

PvPはrolling 60分で報酬対象10試合まで。上限後も戦績は記録するが券は付与しない。固定v2は券Lv・枚数の抽選を行わない。表示の正本は保存済みmatchRewardであり、未実装の希望値をUIだけへ表示しない。

## 出典と履歴

- v14本人の照合依頼は実ChatGPT user bbb2135e-cfd1-4da8-845b-9e3d07d8b29a。全文照合・hashはBRAIN_V14_DELTA_INTAKE_20260913.jsonに保存済み。これは数値改定の採用ではない。
- 旧台帳6b9133fe189b15593719eb46c1f933bf0b4a8d0cのUDL-046は「具体分布は未確定」「最終分布は別決定」と記録。
- a937d9afa37514c67bfe68a3bd3c41086f98a755は2026-09-10 13:27:12 JSTに現在のstandard-match-reward-v2を追加した実装commit。
- 後続台帳901f71eは固定分布の採用・ca97731の公開を記録し、決定元を2026-09-09監査＋2026-09-10自律公開許可としている。この台帳記載と、個々の数値に対する本人の元発言は区別する。元の個別採用message IDは未特定。
- standard/standard-match-reward.jsのGit blobはa937d9a、公開基準d9ce111、候補9590a42の3地点で全て ca80916218a6b2855b946bdd14ac9a2b05730941。同ファイル履歴の変更commitはa937d9aのみ。この範囲で報酬モジュールの巻き戻りは検出しなかった。リポジトリ外の全会話を検索済みという意味ではない。
- STANDARD_RELEASE_EVIDENCE.mdのca97731記録はWindows34438667550、Edge29全文一致、基本7/7＋報酬18/18、Pages34440101131を記録する。これは過去の保存証拠であり、今回の本番再試験ではない。公開Chrome実見PENDINGの履歴は昇格しない。
- CPU_TIERS_INTAKE_20260911.mdのLv1〜5各2人は別の設計・後続実装スライス。思考lookaheadDepthや報酬bandを正式CPU Lvへ読み替えない。旧受領にも券Lv/枚数の変更を含めない旨がある。

## 今回の実行証拠

候補9590a4212d69185fc93df31b552d9bd870d5a9a3の既存2ファイルを変更せず実行した。

```text
node --test tests/standard-match-reward.test.cjs tests/standard-online-engine-bundle.test.cjs
26/26 PASS; fail/cancelled/skipped/todo 0; duration_ms 520.6248
```

5件の報酬unitと21件の実bundle契約。勝敗別・全CPU敗北・4報酬帯、60分境界・10試合制限、過去履歴の非推定、単回適用・overflow、実bundle精算の既存試験を含む。これは26件のローカル試験であり、実本番・物理端末・新報酬方式を検証したものではない。

## 残件

過去の数値提案/採用の本人出典と、将来のCPU Lv設定との関係を既存会話・台帳で照合する。未採用範囲の一様分布、枚数とLvの独立性、複数枚のLv混在等を推定しない。改定が必要ならUDL-046の独立経済候補として設計・正確な実レビュー・互換性/永続化/再送テストを経る。アストラ先生のCPUレビュー生成中に、この別件の再送・割込みはしない。
