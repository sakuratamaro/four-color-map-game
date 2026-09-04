# Standard公開候補 証拠台帳

更新日: 2026-09-05

この文書は「コードがある」と「公開環境で確認した」を混同しないための台帳である。`VERIFIED` は同じ行に再現可能な根拠がある場合だけ使用する。token、API key、user ID、個人情報は記録しない。

状態は、根拠を確認済みの `VERIFIED`、外部条件待ちの `BLOCKED`、明示承認待ちの `PENDING_APPROVAL`、作業待ちの `PENDING`、未実施の `NOT_RUN` を区別して記録する。

## 現在のゲート

| ゲート | 状態 | 現在の根拠 | 次の証拠 |
| --- | --- | --- | --- |
| 採否棚卸し | VERIFIED | `ONLINE_COMPLETION_INVENTORY.md`。旧Expo試作と現行Web Standardを分離済み | 公開後に状態列だけ更新 |
| 製品コード・生成元 | VERIFIED | `standard/`、build scripts、生成済みEdge bundleが統合ブランチに存在 | 最終公開commitを記録 |
| ローカル製品試験 | VERIFIED | 2026-09-04、専用runnerで665件合格、失敗0、769.2秒 | 公開後のcandidate preflightと実端末canary |
| 次期UX候補のローカル検査 | VERIFIED | `codex/standard-release-command`。profile安定化、初回対戦導線、Quick Half Shift、status正規化、Realtime/poll復旧を含む非browser製品試験90ファイル515/515。固定Edge/Chrome harnessは段階ログ・有限timeoutを含む静的5/5合格 | process-tree停止可能な環境で実browser gateを再実行 |
| 公開Pages候補 | VERIFIED | 2026-09-04 22:46 JST、HTTP 200、Standard Online title、野良、CPU、見た目をcandidate preflightで確認 | A〜Dの公開UI canary |
| 公開前DB境界 | VERIFIED | 旧snapshotは匿名権限拒否。snapshot v2と野良募集は`PGRST202`で未存在 | migration後のdb-ready preflight |
| migration 006–013静的検査 | VERIFIED | migration別security/transaction testsと読み取り専用44項目SQL | 実DBで全行`ok=true` |
| Dashboard Advisor・使用量baseline | BLOCKED | 変更前baselineは取得不能。22:55 JSTの現況はHealthyだがHealth Advisorにinfra alert 2件。Security指摘なし、Performance error/warning 0 | 24時間後に同じ指標とRealtime負荷を再採取 |
| migration 006–013本番適用＋status正規化 | VERIFIED | 8本に加え`202609050001`を個別実行。status関数の保護契約を全項目確認し、C canary 210/210合格 | 実ブラウザと二端末最終受入 |
| Edge Function更新 | VERIFIED | deployment 8、JWT検証ON。2026-09-05の`live-standard-edge-canary.mjs --confirm-live`は6/6合格 | 公開UI経由の完全canary |
| GitHub main・Pages更新 | VERIFIED | remote `main=dc5452a`、Pages run `33814089903`成功（46秒）、公開candidate preflight合格 | A〜Dの公開UI canary |
| 合言葉対戦canary | VERIFIED | deployment 8で`live-standard-runbook-a-canary.mjs --confirm-live` 43/43合格 | 実ブラウザ再読込と二端末最終受入 |
| 経済・進行・見た目canary | VERIFIED | deployment 8でRunbook B 93/93合格 | 実ブラウザで報酬演出と操作感を確認 |
| 野良対戦canary | VERIFIED | status正規化後、C 210/210合格。16 profile、完走、同時finder、取消競合、10同時claim、再検索、秘密非公開を確認 | 実ブラウザで二端末最終受入 |
| CPU canary | VERIFIED | deployment 8でRunbook D 107/107合格 | 実端末でCPU個性と待ち時間の体感を確認 |
| 軽量化・負荷 | VERIFIED | full/delta bytesは1815→991。Realtime購読をroom UPDATE 1本へ限定し、live smoke 2/2でmember受信と第三者0件を確認。Quick pollは5/10秒＋hidden停止 | 公開後のRPC数、p50/p95、エラー率、使用量前後 |
| cleanup preview | PENDING | 関数はローカルのみ。削除・定期化なし | dry-run分類別件数、処理時間。実削除は別承認 |
| cleanup実削除・定期化 | PENDING | 実行権限は付与済みだがpreview件数とcascade先を未確認 | exact ID、影響範囲、復元手段を先に記録してから実行 |
| 別々の二端末による最終受入 | PENDING | 旧公開版の過去証拠だけ | 最新URLで対人/CPU完走、復帰、新試合、全永続化 |

## 2026-09-04 22:46 JST 再検証

- GitHub remote `main` は `dc5452a`。不要な再pushは行っていない。
- GitHub Pages `pages-build-deployment #16`、run `33814089903` は `dc5452a` から46秒で成功。buildにNode.js 20廃止予定のwarningが1件あり、公開結果には影響していない。
- `live-standard-release-preflight.mjs --expect=candidate` は、公開UI、snapshot v1/v2、野良募集の保護境界を含め合格。
- `live-standard-edge-canary.mjs --confirm-live` は匿名認証、JWT欠落・改変拒否、profile、見た目catalog、CPU rosterの6/6合格。
- `live-standard-room-snapshot-smoke.mjs --confirm-live` はA/B snapshot、部外者拒否、同revision profile省略に合格。full 1815 bytes、delta 991 bytes。
- `live-standard-runbook-a-canary.mjs --confirm-live` は、合言葉部屋作成、A/B参加、部外者のRPC/Edge拒否、setup、初期化、一手、投了、A/B別snapshot、再戦成立を43/43で完走した。初回はprofile作成でHTTP 500、直後の既存Edge canaryは6/6、同runbook再実行は43/43合格だったため、一時障害として記録し再発監視する。
- Playwrightを同梱ランタイムへ接続した再検証で、証拠台帳2/2、接触演出43/43、Standard Online実ブラウザ14/14が合格。全体連続実行で発生したreduced-motion 1件と後続browser timeoutは、対象ファイル単独で再現せず全件合格したため、実行環境負荷によるflakeとして分離した。
- Dashboard現況はHealthy、CPU 1%、RAM 59%、disk 16%、disk IO 1%、peak connections 15/60。live接続画面では11/60、active query 0、idle in transaction 0、blocked query 0。
- 過去24時間の表示はPostgREST 439 requests、Edge Functions 251 requests、API Gateway 0.46% errors、Realtime 5.3% warnings。API詳細は反映待ちでp50/p95とegressを取得できなかった。
- Query Performanceでは`realtime.list_changes`が累積DB時間の78.3%、27,456 calls、mean 40 ms、max 3,837 ms。旧直接readの`fcg_room_members` 6,759 callsと`fcg_rooms` 5,639 callsは各0.3%で、candidate公開後に減少傾向を再確認する。
- Security Advisorは表示上のissue 0。Performance Advisorはerrors 0、warnings 0、info 10。Health Advisorだけが`DatabaseStorageCapacityExhausted`と`HostOutOfDiskSpace`のinfra alert 2件を継続表示している。

## 2026-09-05 次期UX候補の統合検証

- `87604e6`で5タブ、クイズの時間・ヒント・問題表現、接触/終局演出、合言葉デバッグ対戦を司令塔ブランチへ統合した。
- `34cb36b`で、デバッグ対戦をサービス側で読み込んだ`private_code`かつhuman roomだけに制限し、野良/CPUへのAPI直指定を403 `DEBUG_MODE_NOT_ALLOWED`で拒否するようにした。
- 同commitで、通常の領域受渡しとsplit返却のCOLOR進入時に`NO_LEGAL_COLOR` / `SEALED_OUT`を元操作と同じversionで自動終局させ、Online UIからプレイヤー向け宣言を除去した。内部アクションとCPU互換は維持した。
- 非browser製品テスト84ファイル487/487、重点テスト125/125、構文検査、生成bundle整合、`git diff --check`が合格した。
- 共有環境では親commitと候補の双方でPlaywright起動が停止した。`8b595c9`で起動を15秒に制限し、部分起動でもcontext/browser/HTTP接続/serverを解放する検査基盤へ修正した。製品browser gate自体は環境復旧後に再実行する。
- `e0c1f15`でRunbook B〜Dの有限なlive canaryを追加した。過去のC初回は16件の同時profile準備でHTTP 500、逐次化直後の再実行は匿名認証のHTTP 429で停止した。
- HTTP 500の静的診断では、異なるuser行のDB競合より、新規profileの`load → commit → 再load`によりcommit成功後の再load失敗まで500にしていた経路が最有力だった。再loadを削除して2 RPCへ減らし、接続・資源・timeout系の有限なupstream codeを503 `SERVER_BUSY`へ変換した。ログはstageと英数字codeだけを残し、message、ID、tokenを記録しない。独立レビューでP0/P1指摘なし。deployment 8反映後、C準備の逐次16 profileが500/429なしで完了した。
- 初回ユーザーがホームの「対戦を始める」から対戦タブへ進んだ場合も、その場でprofile作成・同期を完了し、同期後に同じ画面のロビーへ移れるようにした。同期操作が合言葉作成、野良募集、CPU同意を自動実行しないことを静的契約化した。独立レビューで見つかった既存profile/room復帰時の表示残りは、全renderで同期状態を再評価して修正し、復帰ブラウザ契約を追加した。非browser製品試験は追加後501/501合格。実browser検査は共有起動環境の30秒timeoutで未完のため、公開済みとは扱わない。
- 01:50 JST以降、candidate Edgeをdeployment 8としてJWT検証ONで反映し、追加probeなしでsmall 6/6、A 43/43、B 93/93を直列合格した。Cは16 anonymous/profileを500/429なしで準備し実マッチも成立したが、recruiter statusだけが内部`claimed`を返したため停止した。Dは同じ窓の残り5枠で107/107合格した。
- C停止の原因は`fcg_standard_matchmaking_status`だけが内部state `claimed`を公開し、client/canary契約の`matched`と不一致だったこと。既存claimed 3件にmissing room/owner不整合が0件と確認後、`202609050001`を本番へ適用した。関数保護9項目とclaimed正規化、適用前後の3件不変を読み取り検証した。Edge deployment 8は原因と無関係なためrollbackしていない。
- `a113abb`で、publicationから除外済みのmember/private view購読をやめ、Standard/Quickともroom UPDATE 1本だけにした。missing roomは保存接続を解除してロビーへ戻し、通信障害では保持する。Quickはhidden中poll停止、復帰即refresh、playing 5秒/待機10秒へ変更。重点52/52、独立監査75/75、非browser全体507/507合格。
- `c40b2af`でbrowser harnessを固定Edge/Chrome allowlistへ拡張し静的3/3合格。bundled Playwrightは解決できたが、Chrome対象1件も30秒超過し、この共有hostの実browser gateは未合格。再試行・全16件・既存process killは行っておらず、新規残留processも0。
- 03:13 JST、status正規化後のRunbook Cは210/210合格。16人のprofile、野良対戦完走、同時finderの一意成立、cancel/find競合、10同時claim、終了後の再検索、room code/hash非公開をliveで確認した。
- Realtime smoke初回はmember eventを固定2秒で打ち切り失敗した。publicationが`fcg_rooms`だけでjoinがroomを更新することを読み取り確認し、35秒hard timeout内でmemberを最大8秒待って第三者を追加2秒監視する形へ修正。再実行は2/2合格し、専用canary room 2件だけをexact IDで削除、残存0件を確認した。
- Git worktreeを29床から3床へ集約した。clean旧作業床22個はHEAD・branch・dirty=0を個別確認して`--force`なしで削除した。UI/phase2/soloの3床は全tracked差分がCRLFだけ、staged/untracked/秘密候補0、salvageから到達可能と二重確認して改行差分だけを破棄した。RC4はdirty全21ファイルがrootとバイト単位で同一、staged 0、branch保全済みと二重確認して重複床だけを削除した。正史の祖先でない`1f823b2`は`codex/archive-standard-release-1f823b2`としてGitHubへ保全した。
- `6fc23a5`でbrowser harnessのserver、launch、context、page、navigation、badge、test body、teardownへ固定stage markerと有限timeoutを追加し、静的5/5合格。診断ではlocal serverとChrome process生成までは通過し、最初の未確認境界をPlaywrightのlaunch handshakeへ絞った。OS側が終了APIを拒む共有hostでは実browserを再試行しない。
- `1bddae0`でdirty床からQuickの入力乱数独立性、合法色なし宣言、`SEALED_OUT` / `BOARD_LOCK`到達性の回帰試験3件だけを選択回収し、Quick重点12/12合格。古いQuickの未検証JWT decodeは認証境界を後退させるため不採用とした。
- 実Playwright依存15ファイルをコード上で分離した非browser全体は90ファイル515/515、132.1秒で合格した。先行した広すぎる選択では実browser試験を誤って含め、長時間実行後に接触演出のtier 4などが40秒超でtimeoutしたため中断。接触演出単独でも同じ遅延を確認し、browser gateは合格へ変更していない。中断後に見つかった今回開始のChrome 1 processは停止操作前に自然終了し、既存processは変更していない。

## 公開前後メトリクス

値が取得できなかった項目を空欄のまま`VERIFIED`にしない。

| 時点 | Database | Edge invocations | Realtime messages / peak | Egress | p50 | p95 | error rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 変更前 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| canary後 | CPU 1% / RAM 59% / disk 16% / peak conns 15/60 | 251 requests | 5.3% warnings | PENDING | PENDING | PENDING | API 0.46% errors |

## 公開識別子

| 項目 | 値 |
| --- | --- |
| browser harness diagnostics commit | `6fc23a5` |
| candidate code commit | `0e02176`（Edge deployment 8 sourceは`c3cf372`） |
| applied migrations | `202609030006`–`202609030013`, `202609050001` |
| `standard-game-action` version | deployment 8 |
| Pages Actions run | `33814089903` / Success / `dc5452a` / 46s |
| public URL | `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/` |

## Canary結果

各項目は`PASS`、`FAIL`、`NOT_RUN`のいずれかとし、失敗を空欄で消さない。

| 区分 | 結果 | 時刻 | 有限な証拠 |
| --- | --- | --- | --- |
| Edge認証・基本公開 | PASS | 2026-09-05 | deployment 8で匿名sign-in、JWT欠落/改変拒否、profile、cosmetic catalog、CPU roster 10人の6/6 |
| A 合言葉・A/B/C・snapshot delta | PASS | 2026-09-05 | 自動live canary 43/43。A/B参加、C拒否、setup、初期化、一手、投了、seat別finished snapshot、再戦再初期化 |
| B クイズ・ガチャ・売却・精算・トロフィー・見た目 | PASS | 2026-09-05 | 自動live canary 93/93。exactly-once、復元、購入/装備を確認。fullPaint trophyはtransaction testで補完 |
| C 野良・競合・完走 | PASS | 2026-09-05 03:13 JST | 自動live canary 210/210。16 profile、完走、2 finder、cancel/find、10 claim、再検索、秘密非公開を確認 |
| D CPU同意・10人・代表3人・再戦 | PASS | 2026-09-05 | 自動live canary 107/107。実時間90/180秒、代表3人完走、復帰、統計、同じCPU再戦、対人検索競合を確認 |
| 二端末最終受入 | NOT_RUN | PENDING | PENDING |

## 残存リスク

- Dashboardの詳細なAdvisor/使用量baselineは未取得。画面上では資源逼迫警告が継続しているため、公開範囲を広げる前後で使用量を追跡する。
- profile作成安定化はCの逐次16件で500/429なしを確認した。高並列作成そのものはAuth上限を消費するため再試験せず、再発時はEdge/DBログと資源警告を関連調査する。
- Cのstatus正規化は本番関数定義、既存ticket整合、live canary 210/210まで確認済み。今後もIPあたり30 anonymous sign-ins/時を守り、同じ認証窓で重いcanaryを再試行しない。
- 次期UX候補はEdge/DBへ一部反映済みだが、Pagesはまだ`main=dc5452a`。公開済みPagesと統合候補を混同しない。
- Edgeのper-isolate濫用抑止は分散レート制限ではない。公開後の計測で必要性が出た場合だけprovider側制限を検討する。
- 10人CPUの合法性・決定性は自動検証済みだが、人間が感じる個性と楽しさは代表3人の実プレイ後も定性的判断として残る。
- cleanup実削除や定期化は許可済みだが、exact IDと復元手段を確認するまで実行しない。課金設定変更は必要性と金額を特定してから扱う。
