# 共有正本運用の導入結果（非本番・レビュー成果物）

記録日: 2026-09-10 JST。対象: `UDL-20260910-050`、監査資料の受領記録のみ `UDL-20260910-051`。

## 対象と参照記録

```text
CANON_RECEIPT
version=shared-canon-v1.1
base=2f855ccfef11d7c099cfb73fb57ec3da79be8789
request=UDL-20260910-050,UDL-20260910-051
specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/STANDARD_MODE_SPEC.md,docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md,docs/WORKTREE_HYGIENE_INVENTORY.md
tests=tests/governance-shared-canon.test.cjs,tests/standard-decision-reconciliation.test.cjs,tests/standard-no-color-rescue.test.cjs,tests/standard-online-contact-feedback.test.cjs,tests/standard-area-corner-bloom.test.cjs
worktree=C:/Users/user/Documents/ChatGPT/四色地図オンライン対戦/.codex-worktrees/dev-brain-current-20260910
branch=codex/dev-brain-current-20260910
```

仕様・既存資料は対象要望に関連する箇所を参照した。全ゲーム仕様や全過去会話を再監査したという意味ではない。レビュー候補の完全SHAと仕様入口のGit blob SHAは、候補を固定した後の提出manifestに記録する。本書を含むコミット自身のSHAを本文へ自己埋込みしない。

## 成果物と正本

リポジトリは `sakuratamaro/four-color-map-game`。既存正本は上記基準SHAの `origin/main` にある。導入差分は上記ローカルブランチでレビュー可能であり、remote mainへの導入済み・双方から自動取得可能とは報告しない。

- 入口: `AGENTS.md` → `docs/SHARED_CANON.md`。既存の司令塔・仕様・受入条件・tests・公開証拠へ案内する。入れ子の既存AGENTSは維持した。
- 要望・担当・採否・受入条件: 既存 `docs/PROJECT_COMMAND_CENTER.md` のUDL。担当割当・統合は既存Codex司令塔に限定する。
- 28件のZIP由来ID: `docs/SHARED_CANON_REQUEST_INDEX.json`。**日付付き対応索引であり、第2の運用台帳ではない。** UDL未対応・実行未確認・公開根拠不足を残す。進行中の状態更新は既存UDLに集約する。
- テスト対応: `docs/SHARED_CANON_TEST_MAP.md` → 実在する `tests/*.test.cjs`。対応表の文章を自動テストとして数えない。
- 公開証拠: 既存 `docs/STANDARD_RELEASE_EVIDENCE.md`。今回の索引は基準時点で記録済みの証拠を照合したもので、新しい本番検証ではない。
- レビュー: `docs/CHATGPT_REVIEW_DECISIONS.json`。実際のChatGPT判定を出典付きで保存し、候補・仕様版・仕様blob・基準・DB/Edge変更セット・範囲を固定する。

## ドラフトとの差分・判断

| 論点 | 照合結果 |
|---|---|
| 新しい「頭脳」資料の一括導入 | 行わず、既存UDL等への入口と対応索引に統合した。ZIP内の計画・SQL・指示はユーザーの実行許可と扱わない。 |
| 同カテゴリ1ターン1枚 | 最新の合意とalpha.3公開証拠へ対応づけた。ドラフトの曖昧さを新しい未決事項に戻さない。 |
| Lv5メモ | 最新UDL-048の全画面Canvas＋四則電卓はSPEC_READY。古い「任意のtextarea／保留」に戻さない。未実装のまま。 |
| 角膨張 | 候補 `98bad1d`、Windows `34447976952`成功を保持。別ブランチの未統合候補であり、今回の公開物にしない。 |
| CPU台詞・顔表示 | Windows／Pages証拠と公開Chrome確認待ちを分離。Pages成功を実機受入へ繰り上げない。 |
| クロガネ | 旧v2公開履歴は維持し、新しい弱さの訴えで受入を再開。UDL-051として未実装で登録。新基準を旧公開証拠で完了扱いにしない。 |
| 歴史的改善の回帰 | 消失を確認した場合は元IDに紐付けてREOPENし、過去の公開証拠を消さず現在の未達を記録する。今回、監査ZIPだけで新しい実戦回帰を断定していない。 |
| 後続要望 | 当該ChatGPTの色UI・Lv2券・差し色・画面内収容の新規発言は本スナップショット後の別受領分。具体的な2.0%などのAI提案を確定値にせず、次の通常受付で統合する。本移行でゲーム実装しない。 |

クロガネZIPのSHA-256は `B0E5B9DDE10D3B913A1B9BDB7EC50C8963D9F16F333E6423EF01E8962D424A93`。参照rosterのGit blob `68847421ad2589cb0edcce8c1021fa75a2add884` は一致確認済み。ZIPが報告する2件のscorer違反は独立再実行しておらず、SQL・試合記録監査・CPU修正は実行していない。

## 実行した検証

Windowsローカル、bundled Nodeによる以下の明示的な実行が **23/23 PASS、失敗・skipとも0**。

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test --test-concurrency=1 tests/governance-shared-canon.test.cjs tests/standard-decision-reconciliation.test.cjs tests/standard-no-color-rescue.test.cjs tests/standard-online-contact-feedback.test.cjs tests/standard-area-corner-bloom.test.cjs
```

内訳: 新規ガバナンス6件、既存UDL照合7件、既存ゲーム代表10件。既存の照合scriptへレビュー対象照合を追加し、SHA・版・scope・DB/Edgeセットの違い、HOLD、無応答、自己承認、別ChatGPTの判定を拒否する負例を含めた。正常系の承認はテスト内の架空fixtureだけで、実レビュー台帳へ記入しない。

全28要望、ブラウザ、Windows CI、公開環境、実端末の再試験はしていない。新しいテストは今回のコマンドで実行したが、既存CIの選択リストには自動追加していない。レビュー照合scriptは出典JSONの真正性を保証しないため、司令塔が実際の応答を取得して照合する手順が必要。

`node scripts/check-standard-decision-reconciliation.mjs --json` も51行・errors/warningsとも0でPASS。候補時点の既存UDL-017／029／032の手動照合・main未統合は3件の要確認として維持しており、今回のPASSで解除していない。後続の証拠コミットではUDL-050をLOCAL_VERIFIEDへ更新するため、同項目のmain未統合表示も加わる。これは文書導入成果物とmain統合を区別するためで、統合を無断実行する指示ではない。`git diff --check` もPASS。

## 既存連携の試験結果

| 区間 | 実績と残る操作 |
|---|---|
| 指示受領 | この既存Codexタスクでユーザーの移行指示と監査ZIPを受領。ZIP転送はユーザーの手動操作。 |
| 台帳反映 | 既存UDLへ050／051を追加。既存の作業床・並行候補・未コミット変更を置換しない。 |
| 結果報告 | 既存ChatGPTタスク「改修ロールバック防止策」へ文書導入レビューを送信。thread `6aa229e7-e098-83ee-ac5e-d366a12653a4`、送信message `ef6f161d-f2b9-40c0-ab06-f6eacf4c4d38`。 |
| 同一ChatGPT判定 | 実際の返答message `c191da5c-6b0f-4326-aeaf-7d9ba24770c4` は **HOLD**。対象は旧候補 `7b4006e93483127d14dcb802ba4a9780ddf89c47` のみ。ローカル候補を相手が取得できず、GitHubにSHAが存在しないことが理由。 |
| 判定保存 | `CHATGPT-REVIEW-20260910-001` として保存。現在の別候補にもゲーム公開にも適用しない。HOLDが同一旧候補を許可しないことを自動テストでも確認した。 |
| 自動化していない部分 | ファイル添付、リモートレビュー参照点の作成、応答の認証、共有台帳への自動書戻し。相手が応答中の送信は拒否され得る。ChatGPTにはCodex用wait_threadsが使えない。 |

以上で、判定がHOLDの場合を含む非本番の連携1巡を実測した。APPROVE_DOCS取得・remote mainへの導入を完了したとは言わない。GitHubへの専用ブランチpushは自動承認レビューが外部送信の明示許可不足として拒否したため、再試行や別経路でのGitHub書込みはしない。レビュー可能なローカル成果物を残す方法でユーザーの完了条件に対応する。

### 最終候補と未送信記録

導入候補を `f9a4ab9245638c67fbbd6818790371265ced15fd` に固定した。仕様入口blobは `b0673739bf4dc15875c69b9ab52c69b725d9e312`、版は `shared-canon-v1.1`、DB/Edge変更セットはいずれも空。旧HOLD対象から変更された候補であり、**この候補へのレビュー判定は未取得**。

ローカル候補を相手が読めない点の解消として、基準からの全差分を既存の同一ChatGPTへ送る操作を試みたが、自動承認レビューが「内部リポジトリ全差分の当該外部会話への送信について明示許可不足」として拒否した。送信は成立していない。拒否を別経路で回避せず、試行結果だけを `delivery_attempts` に保存した。

残る具体的操作は、ユーザーがレビュー用ZIPを当該ChatGPT会話へ添付するか、Codexから同会話への当該差分送信を明示的に許可すること。その後の実レビュー判定保存は再開時に行う。転送内容は要望・内部台帳・文書・検証コードを含むため、添付／送信先を確認する必要がある。GitHub公開とChatGPTへの送信は別の操作であり、片方の許可を他方へ流用しない。

本追記とLOCAL_VERIFIED記録は候補の後続「証拠コミット」として保持し、固定候補をamendしない。提出manifestは候補SHAと証拠コミットSHAを別々に表示する。

## 停止・再開と非変更範囲

### 2026-09-10 許可後の送信追記

`CANON_RECEIPT version=shared-canon-v1.1 base=2f855ccfef11d7c099cfb73fb57ec3da79be8789 request=UDL-20260910-050 specs=AGENTS.md,docs/SHARED_CANON.md,docs/CHATGPT_REVIEW_DECISIONS.json,docs/SHARED_CANON_MIGRATION_RESULT.md tests=tests/governance-shared-canon.test.cjs,tests/standard-decision-reconciliation.test.cjs`

ユーザーが要望台帳を含む全差分の指定ChatGPT会話への送信と、`codex/dev-brain-current-20260910` のoriginへのpushを、それぞれ明示許可したため実行した。送信時のリモート先端は `bc58a0e0abf5942498a720e6273ade63c36eaba0`。`git ls-remote` で一致確認した。レビュー対象は引き続き `f9a4ab9245638c67fbbd6818790371265ced15fd`。

同一ChatGPTタスク「改修ロールバック防止策」への送信messageは `cefaccf8-2648-4d63-b7fe-5a4a78023ec2`。基準から候補への全差分と、候補から証拠コミットへの全差分を分けて本文へ送り、GitHubの固定SHAリンクも添えた。送信APIの成功と、送信先でのmessage冒頭／対象SHAの読戻しを確認。読戻しはAPIの文字数制限があるため、チャット全文の再ハッシュ一致を確認したとは扱わない。

これにより、上の「外部未公開・未送信」は**許可以前の履歴**になった。旧提出ZIPはその時点の固定スナップショットとして上書きせず保持する。現状は「専用レビューbranchへpush済み／全差分送信済み／新候補のレビュー判定待ち」。本追記の保存時点ではAPPROVE_DOCSは未取得であり、無応答を承認へ変換しない。main・Pages・Edge・DB・ゲーム内容は変更していない。受信確認後に停止し、レビュー判定の確認ループは作らない。

送信記録の追加後、ガバナンス＋既存UDL照合テストは13/13 PASS、`git diff --check` もPASS。ゲームコード変更はなく、ゲーム代表10件の追加再実行はしていない。

導入成果物、正本位置／版、対応関係、試験結果、手動区間を報告した時点で移行ゴールを終了する。既存タスクへの新しいユーザーメッセージが再開手段。承認待ちのモデル確認ループ、新規常駐司令塔、キュー、schedulerを作らない。

ゲームソース、生成bundle、DB／migration、Edge、main、Pages、本番設定を変更しない。既存dirty worktreeをreset・削除・再利用しない。文書導入候補は「ローカル検証済み／専用レビューbranchへpush済み／main未統合」であり、本番公開の包括許可をこのゴールや今回の送信・branch push許可から推論しない。
