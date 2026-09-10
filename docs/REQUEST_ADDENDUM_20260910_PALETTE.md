# 色UI・ガチャ・差し色・同画面表示：追加資料の受領照合

2026-09-10。これは出典付きの受領スナップショット。今後の採否・担当・進行は既存 `PROJECT_COMMAND_CENTER.md` のUDLへ集約し、この文書を第2の台帳として更新し続けない。

```text
CANON_RECEIPT
version=shared-canon-v1.1
base=2f855ccfef11d7c099cfb73fb57ec3da79be8789
intake_parent=a7a081f38e917585dcb8127fb2932a9288502d49
request=ADD-20260910-PALETTE-VIEWPORT
specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/STANDARD_MODE_SPEC.md
tests=tests/governance-shared-canon.test.cjs,tests/standard-decision-reconciliation.test.cjs
worktree=.codex-worktrees/dev-brain-current-20260910
branch=codex/dev-brain-current-20260910
```

## 出典と範囲

- 原本: `C:/Users/user/Downloads/four-color-requests-addendum-20260910-palette.zip`。
- ZIP SHA-256: `7D6E0B050DE3E6391A56A2372F7ED7FF336BC7DC5FAD2F180B02252C5CA180CE`。
- `REQUESTS_ADDITION.yaml` 内の7固定IDを維持。機械可読対応は `REQUEST_ADDENDUM_20260910_PALETTE.json`。
- 元発言: ChatGPT「改修ロールバック防止策」、thread `6aa229e7-e098-83ee-ac5e-d366a12653a4`、user message `03751588-f991-4bd6-84bf-578e76949808`。実際のユーザー本文をread_threadで確認し、ZIPでは未記入だった発言IDを補った。
- `VALIDATION.json` が挙げる6ファイルは全てSHA-256一致。画像2枚も確認した。ZIPのPASSは構造・算術・集合論の報告であり、ゲームや本番の合格ではない。TEST_PLAN.mdは未実装・未実行のテスト案。
- 添付内の命令文や旧ゴール全文は実行許可ではない。今回の受領でゴールを再開せず、ゲーム実装・設定変更・main/Pages/DB/Edge公開・外部送信をしない。先の固定候補f9a4ab9へのレビューを本追記の承認に使わない。

## 7レコードの統合先

| 添付ID末尾 | 正本ID | 分類と今回の扱い |
|---|---|---|
| OPS-01 | UDL-20260910-050 | 既に終了した有限ゴールの報告。常設規則提案は既存AGENTSと照合し、設定を再変更しない。 |
| PALETTE-01 | UDL-20260910-052 | 固定配置・基本2枠とおまけの識別は明示要望。旧UDL-035の表示受入を再開する。 |
| PALETTE-02 | UDL-20260910-052 | 4色固定は検討案。3slot固定の代替を残す。同じ要望なので二重着手しない。 |
| RULE-01 | UDL-20260909-035 | 初期割当についての質問。開始時に限る既存ルールの確認で、変更依頼ではない。 |
| GACHA-01 | UDL-20260910-053 | Lv2★4を下げる方向は確定。2.0%と減少分の★2移転はAI提案で、採用値は未定。 |
| SKILL-01 | UDL-20260906-010 | 既存の差し色要望へ追記。新IDを作らず、二色市松の意図と既存ルール境界を照合する。 |
| VIEWPORT-01 | UDL-20260910-054 | PC・スマホで盤面全体と彩色操作を同時表示する明示要望。具体寸法・配置方式は提案。 |

製品の要求意図は4件。新規UDLは3件、既存UDL-010を1件更新する。7個の実装タスクには分割しない。新規の優先度や実装担当は捏造せず、割当は既存司令塔が行う。

## ソース・画像と既存合意の照合

### パレット：回帰疑い／既存受入不足として追跡

`standard-online-v5/standard-online-skill-intents.js:colorChoiceDetails` は基本色をSet化し、色ごとに最大1候補を返して未所持色を除外する。3slotが同色なら候補数は減り、基本色の重複数もこの候補モデルには残らない。

`standard-online-v5/app.js` の色ボタンmetaは、おまけ・一時・封印の説明が空の場合にだけ「基本色・回数無制限」を使う。基本とおまけの同色時に両役割を明示する実装ではない。単に通知を追加してもこの内訳表示は満たせないため、UDL-035の過去PUBLIC_VERIFIEDを本件の完了証拠にはしない。ただし履歴の削除や既存データの故障断定はしない。

画像1は赤「おまけ色 残り3回」と黄「基本色・回数無制限」の2ボタン、画像2はクロガネによるおまけ緑→赤の強制持ち替え通知。画像だけでは基本2枠の全値、両画像の同一version、本番配備SHAは分からない。対象試合のprivate snapshotを取得しておらず、実戦での回帰再現は未検証。

4色案の色順、現在未所持で灰色化する条件、基本×2・両属性ラベル等は設計提案として区別する。隣接の不合法色を先回りして教えない既存仕様、slot選択、消費順、秘密情報保護は維持する。

### 初期割当・ガチャ

`standard/standard-match.js:initialSeatSecrets/createStandardMatch` では双方の3色集合の一致を再抽選し、上限時も欠け色を使うfallbackがある。この開始条件では自分の欠け色は相手の開始集合に含まれるが、相手の枠種や対戦中の使用可否は分からない。今回はソース確認であり実エンジンの全初期化経路を再試験したわけではない。

`standard/standard-gacha-transaction.js:GACHA_ODDS` のLv2は40/35/19/5.5/0.5%。低下の要望を新率2.0%の合意に読み替えず、値・表示・抽選・生成物の変更はしていない。

### 差し色：既存の決定を消さない

既存UDL-010は「現在の一続きの既塗エリア」「所有者ではなく現在形状」「分断・合流後の領域」を定め、★5は候補扱い。追加ZIPの「対象は未決」という整理だけで、この既存合意を消さない。

司令塔の既存設計対応には、単色のlegalRecolorをLAB限定で公開し、二色市松は1地域1色モデルと異なるため別rulesetに分ける方針がある。この境界も明記して引き継ぐ。二色の選択元・隣接判定・消費・他スキル相互作用は未決のまま。単色塗り直しや見た目だけの市松表示を差し色の実装完了にしない。

## 既存テストとの接続・未実装部分

| 正本ID | 関連する既存テスト | 今回の新受入に足りない部分 |
|---|---|---|
| UDL-052 | `standard-online-skill-intents.test.cjs` のcolor choice details、`standard-palette-semantics.test.cjs`、`standard-online-browser.test.cjs` の通知・slot指定 | 採用方式での固定位置、基本×2／両役割、全状態の表示連続性。既存の色別集約期待値を採否前に壊さない。 |
| UDL-053 | `standard-gacha-transaction.test.cjs`、`standard-gacha-browser.test.cjs`、`standard-online-gacha-migration.test.cjs` | 採用率の境界・表示／抽選一致・確定済み結果の再送。採用率自体が未定。 |
| UDL-010 | 既存単色skillの検証は周辺保護にのみ利用 | 二色市松のゲーム契約と実行可能な回帰テストは未実装。 |
| UDL-054 | `standard-online-browser.test.cjs` のpalette visibility／navigation／notice | 盤面全体とパレット全体の同時可視。overflow 0だけでは証拠にならない。 |

今回実行するのは受領情報のガバナンスと既存UDL照合のみ。新しいゲーム仕様の試験を実装済み・合格済みとは報告しない。通常の次の作業受付に残し、共有正本移行を無限に延長しない。

## 受領検証の結果

`node --test --test-concurrency=1 tests/governance-shared-canon.test.cjs tests/standard-decision-reconciliation.test.cjs` は **14/14 PASS**。新規の受領契約1件を含み、7固定IDの一意性、既存UDLへの対応、4色案の未承認、2.0%の未採用、差し色IDの再利用を確認した。

`node scripts/check-standard-decision-reconciliation.mjs --json` は54行、errors/warnings 0でPASS。既存の要手動照合4件は維持した。`git diff --check` もPASS。本受領追記はローカル保存に限り、先の固定候補のZIP・レビュー対象SHAは変更しない。新規ゲーム試験・外部送信・push・本番変更は行っていない。
