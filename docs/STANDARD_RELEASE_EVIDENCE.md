# Standard公開候補 証拠台帳

更新日: 2026-09-05

この文書は「コードがある」と「公開環境で確認した」を混同しないための台帳である。`VERIFIED` は同じ行に再現可能な根拠がある場合だけ使用する。token、API key、user ID、個人情報は記録しない。

状態は、根拠を確認済みの `VERIFIED`、公開環境まで確認した `PUBLIC_VERIFIED`、外部条件待ちの `BLOCKED`、明示承認待ちの `PENDING_APPROVAL`、作業待ちの `PENDING`、未実施の `NOT_RUN` を区別して記録する。

## 現在のゲート

| ゲート | 状態 | 現在の根拠 | 次の証拠 |
| --- | --- | --- | --- |
| 採否棚卸し | VERIFIED | `ONLINE_COMPLETION_INVENTORY.md`。旧Expo試作と現行Web Standardを分離済み | 公開後に状態列だけ更新 |
| 製品コード・生成元 | VERIFIED | `standard/`、build scripts、生成済みEdge bundleが統合ブランチに存在 | 最終公開commitを記録 |
| ローカル製品試験 | VERIFIED | クロガネv2候補で非browser Standard 544/544、重点89/89、オンラインbrowser 31/31、CPU browser Chrome/Edge各1/1 | 物理二端末canary |
| 次期UX候補のローカル検査 | VERIFIED | `codex/standard-release-command@1673ff8`。profile安定化、初回対戦導線、Quick Half Shift、status正規化、Realtime/poll復旧を含む非browser製品試験91ファイル522/522。browser workflow/harness静的11/11合格 | Pages反映後のpreflightと二端末受入 |
| 初回導線・接続表示の次期候補 | VERIFIED | `9d42784`。初回starter作成＋profile同期を一操作化し、全5タブで単一接続statusを常時表示。空名write 0、room外offline復帰、390px下部nav非干渉を契約化。静的39/39、非browser 89ファイル513/513、Windows Chrome/Edge各18/18合格 | 物理二端末受入 |
| Windows実browser CI | VERIFIED | GitHub Actions run `33947039777`。Chrome job `101254916881`、Edge job `101254916818`がともに成功 | 公開URLで同じ主要導線を二端末受入 |
| 現行公開Pages | PUBLIC_VERIFIED | 公開ゲーム資産基点`a3425a4`、Pages run `33947644765`成功。公開URL HTTP 200、公開時刻とasset/bundle一致、実ブラウザconsole warning/error 0。後続の記録専用commitは資産不変 | 別々の二端末で最終受入 |
| 初回公開前DB境界（履歴） | VERIFIED | 旧snapshotは匿名権限拒否。snapshot v2と野良募集が未存在だった初回baseline | 現行境界は適用migrationとlive canaryを参照 |
| migration 006–013静的検査 | VERIFIED | migration別security/transaction testsと読み取り専用44項目SQL | 実DBで全行`ok=true` |
| Dashboard Advisor・使用量baseline | BLOCKED | 変更前baselineは取得不能。22:55 JSTの現況はHealthyだがHealth Advisorにinfra alert 2件。Security指摘なし、Performance error/warning 0 | 24時間後に同じ指標とRealtime負荷を再採取 |
| migration 006–013＋後続001–005本番適用 | PUBLIC_VERIFIED | 13本を個別適用。現行の読み取り専用検証SQLは56項目すべてtrue。status C 210/210、クイズ新旧canary、クロガネv2 canary合格 | 物理二端末最終受入 |
| Edge Function更新 | PUBLIC_VERIFIED | migration `202609050005`適用後にクロガネv2対応Edgeを更新。新規匿名roomでv2受理、別canaryで合法CPU手・決着・再戦まで合格 | 物理端末でクロガネの手強さを体感確認 |
| 即時Standard CPU開始 | PUBLIC_VERIFIED | migration `202609050002`とEdge deployment 9。製品`cc96350`、公開`a4c6490`、DB 47項目、Edge基本6/6、即時CPU 7/7、Windows run `33931963065`、Pages run `33932159043`合格。公開UIでCPU初手まで確認 | 物理端末で一試合完走・再読込・同じCPUとの再戦を確認 |
| CPU完走後の次戦導線 | PUBLIC_VERIFIED | `29c6958`。同じCPUとの同room再戦を維持し、終了結果から別CPU選択へ進める。live即時CPU完走・再戦canary 25/25、Windows Chrome/Edge成功、Pages反映済み | 物理端末で別CPU選択と再戦を体感確認 |
| GitHub main・Pages更新 | PUBLIC_VERIFIED | 公開ゲーム資産基点`a3425a4d459214e5274e20497af21f35a312099d`。Standard browser gate `33947039777`、Pages `33947644765`成功。公開asset/bundleは当該SHAとSHA-256一致 | 二端末受入後に最終状態を記録 |
| 合言葉対戦canary | VERIFIED | deployment 8で`live-standard-runbook-a-canary.mjs --confirm-live` 43/43合格 | 実ブラウザ再読込と二端末最終受入 |
| 経済・進行・見た目canary | VERIFIED | deployment 8でRunbook B 93/93合格 | 実ブラウザで報酬演出と操作感を確認 |
| 野良対戦canary | VERIFIED | status正規化後、C 210/210合格。16 profile、完走、同時finder、取消競合、10同時claim、再検索、秘密非公開を確認 | 実ブラウザで二端末最終受入 |
| CPU canary | PUBLIC_VERIFIED | Runbook D 107/107に加え、クロガネv2新規room、同一action再送、公開情報だけの合法CPU手2回、投了、同CPU再戦を本番で合格 | 実端末でCPU個性と待ち時間の体感を確認 |
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
- 実Playwright依存15ファイルをコード上で分離した非browser全体はCI契約追加後91ファイル520/520、114.8秒で合格した。先行した広すぎる選択では実browser試験を誤って含め、長時間実行後に接触演出のtier 4などが40秒超でtimeoutしたため中断。接触演出単独でも同じ遅延を確認し、browser gateは合格へ変更していない。中断後に見つかった今回開始のChrome 1 processは停止操作前に自然終了し、既存processは変更していない。
- `d8dac1b`を基点に、GitHub公式Windows 2025 runner上のChrome/Edgeだけを対象にした実browser gateを追加した。権限は`contents: read`のみ、checkout認証情報を非保持、Actionは公式release commit SHAへ固定、Playwright install scriptを無効化し、Supabase・secret・deploy・Pages処理を含めない。GitHub AppはPR作成を403で拒否したため、push triggerは`codex/standard-release-command`だけに限定し、`main`では起動しない。
- GitHub Actions run `33920847775`（`1673ff8`）で、Chrome 16/16（36.5秒）とEdge 16/16（41.8秒）がともに合格した。先行runの失敗を、hidden connection badge、room hydration競合、結果overlayの同一ページ再描画消失、タブ導線、移動し続けるquiz click target、Edge終了猶予へ分解して修正した。最終版は結果overlayの同一ページ保持とreload後one-shot抑止も実browserで確認し、共有CSS・Supabase設定変更でも同gateが起動する。
- `origin/main`を`dc5452a`から`43c36ad`へforceなしでfast-forwardし、Pages run `33921530679`が成功した。キャッシュ回避付き公開HTML/app/styleは全てHTTP 200で、5タブ、same-page結果保持、`赤・青`区切り、hitboxを動かさないquiz発光の固有markerを確認した。`live-standard-release-preflight.mjs --expect=candidate`も公開UI、snapshot v1/v2、野良募集の保護境界を含め`ok:true`だった。
- 公開実画面の390px監査で、対戦タブ再読込後もsessionは成立している一方、接続statusがhome限定で不可視になることを再現した。`9d42784`で既存statusを複製せず全5タブ共通にし、home以外は下部navを避ける固定ピルへ縮小した。room未参加時のonline/offlineもstatusへ反映する。
- 同監査と独立導線レビューで、fresh playerが名前作成後に技術用語の「オンライン同期」をもう一度押す二段確定を最大の離脱点と判定した。初回だけ一操作でstarter保存とprofile同期まで進め、空名ではlocal/server write 0、同期はin-flight guardで1回、自動room/matchmaking/CPU開始0を維持した。静的39/39、実Edgeの初回導線と全タブ/offline/mobile重点2/2、非browser 89ファイル513/513が合格した。全製品runnerは変更外のlocal Standard接触演出browser群で共有hostの長時間timeoutが再発したため中断し、次の判定は専用Windows Chrome/Edge gateへ分離する。
- Windows browser run `33924037233`でChrome/Edge各18/18が合格したため、`origin/main`を`43c36ad`から`dfbec10`へforceなしでfast-forwardした。Pages run `33924181589`はbuild/report/deploy全job成功。キャッシュ回避付き公開marker 5/5、candidate preflight `ok:true`、公開390px対戦画面で固定statusと下部navの非干渉を確認した。

## 2026-09-05 07:45 JST 初手ガイド公開

- 3タスクの独立監査を統合し、即時CPU導入よりも、6枚確定から最初の領域受渡しまでの迷いを減らす案内を優先した。DB、Edge、ゲームルール、合法手判定は変更していない。
- `7eab2f1`で、準備操作を「確認」から「準備完了」へ統一し、対戦中は選択、受渡し、彩色、相手待ち、送信中、再送を同じ公開状態から案内するようにした。相手手番のphase表示、送信ボタン、盤面pointerも実際の操作条件と一致させた。
- 非browser製品試験514/514、ローカルEdge 19/19、ローカルChrome 19/19が合格した。新規実browser検査は盤面1マス選択、STEP 1からSTEP 2への遷移、`CREATE_REGION` intent 1件を確認した。
- Windows browser run `33926224196`のattempt 1はChrome 19/19、Edge 18/19。Edgeの最初のtestが`BROWSER_STAGE_TIMEOUT page-ready`で起動時だけ失敗し、残る18件と新規初手検査は合格した。コードを変更せず失敗jobを再実行したattempt 2でChrome/Edge各19/19となり、一過性のEdge起動遅延と判定した。
- `origin/main`を`a84dd7a`から`7eab2f1`へforceなしでfast-forwardした。Pages run `33926672851`は成功し、公開HTML、app.js、style.cssの新marker 6/6、candidate preflight `ok:true`を確認した。
- 公開実画面の390×844監査は横overflowなし。接続badge下端756px、下部nav上端764pxで8px空き、初手ガイドの520px以下用ruleが配信済みだった。物理二端末の作成・参加・完走・再読込・再戦は引き続き`NOT_RUN`である。

## 2026-09-05 08:26 JST CPU勝利表示・6枚セット公開

- 夫婦テストの「CPU戦に勝っても勝利数が増えないように見える」をP0として追跡した。保存先は対人用`stats.wins`ではなくCPU専用`cpuStats.wins`であり、Edge、transaction RPC、snapshot delta、cold loadに静的欠落は見つからなかった。既存Runbook Dは人間側の敗北だけを確認しており、人間側CPU勝利の統合検査が抜けていた。
- `8c0d31f`で、人間のCPU勝利が`cpuStats.wins`とキャラ別winsへ一度だけ入り、対人winsを変えず、同一match再適用を拒むbundle回帰を追加した。オンラインbrowser mockではprofile revision更新後だけ勝利overlayへ`CPU戦 勝利 1`を表示し、local hydration、再読込後の1維持、action再送0を確認した。保存済みmatch historyが確認できない場合は楽観的に保存済みと表示せず「同期しています」とする。
- 6枚セットをカード単位のnative checkboxを保ったカード型toggleへ変更した。各カードに`持ち込む／持ち込まない`、全体`n/6`、カテゴリ別`n/2`、不足枚数、準備OKを表示し、不完全時は確定不可。同カテゴリ3枚目は選択せず、先に1枚外す理由をlive regionへ通知する。
- 390×844のkeyboard browser回帰で、6→5→6枚、確定buttonのdisabled/enabled、3枚目の拒否理由、focus維持、横overflowなしを確認した。ローカル重点51/51、Edge 21/21、Chrome 21/21が合格した。
- `fda261d`でapp/style URLにrelease revisionを付け、古い資産cacheを回避した。Windows run `33929432778`はChrome/Edge各21/21、Pages run `33929435963`は成功。公開HTML/appは説明、summary、終局戦績、asset revision、選択state、上限理由のmarker 7/7を返し、candidate preflightも`ok:true`だった。
- 公開DBを使う「人間がCPUへ勝利」のlive canaryは勝利を有限時間内に保証する既存手段がなく`NOT_RUN`。DB/Edge変更は行っていない。物理二端末のCPU勝利・再読込と、合言葉対戦完走・再戦は引き続き最終受入項目である。

## 2026-09-05 09:10 JST 即時Standard CPU候補

- 最初の対戦までの待ち時間を最大の離脱点と判定し、ホームの主CTAとStandardロビーから10人のCPUを直接選べるようにした。通信なしのQuick練習は「別ルール」と明示し、既存の合言葉・野良・90秒CPU案内は維持した。
- `202609050002_standard_immediate_cpu.sql`はprivate receipt、actor lock、検索ticketとの競合解決、active room復帰、server由来CPU profile/loadoutを一つのservice-only RPCに閉じた。DB候補検証47項目はすべてtrue。
- Edge deployment 9へ`cpu-start`を追加した。公開APIで基本境界6/6に続き、作成・lost-response再送・入力変更拒否・snapshot上のCPU身元を7/7確認した。
- ローカルは関連契約50/50、非browser製品試験523/523、実Chrome/Edge各23/23が合格した。全107ファイル連続実行は変更外の接触演出browser群で共有環境の時間切れが再発したため、公開判定は専用Windows browser gateへ分離した。
- GitHub Actions run `33931963065`はWindows 2025上のChrome/Edge両ジョブが成功し、候補`cc96350`の独立browser gateを通過した。
- `origin/main`を`f5aaf33`から`a4c6490`へforceなしでfast-forwardし、Pages run `33932159043`は成功した。キャッシュ回避付き公開4資産はHTTP 200、新markerは全件一致し、candidate preflightも`ok:true`だった。
- 公開実画面のホーム主CTAから10人のCPU一覧を開き、「うっかりユズ」を選択して6枚準備へ即時遷移した。準備完了後はCPUの初手がサーバーで確定し、人間の第2手で色選択が可能になるところまで確認した。

## 2026-09-05 09:49 JST 初戦引き継ぎ・CPU次戦循環公開

- 3担当の監査を統合し、`29c6958`で二つの離脱点を改善した。6枚提出後は、その操作自身が`ready`から`playing`への遷移を観測した場合だけ、ランダム結果の表示後に「Standard対戦スタート」へ一度移動する。reload、poll、background更新はfocusを奪わない。
- CPU戦の終了結果に「別のCPUを選んで新しく対戦」を追加した。選択成功まで旧結果を保持し、取消時は結果へ戻る。新規開始は既存のserver-authoritativeな`cpu-start`だけを使い、合言葉、野良、90秒CPUフォールバック、同じCPUとの再戦を変更していない。
- 新しいlive canaryは匿名1ユーザー、120秒hard timeoutで、即時CPU開始、6枚setup、初期化、CPU合法手、人間投了、敗北精算、履歴、同じCPUとの同room再戦、新match再初期化、private snapshotを25/25、5.84秒で確認した。
- 非browser全体528/528、ローカル実Chrome/Edge各25/25が合格した。Windows run `33933769885`のattempt 1はChrome成功、Edgeは全test body通過後の`browser-close`だけが10秒timeout。コードを変えず失敗jobを再実行し、attempt 2でEdge成功を確認した。
- `origin/main`を`8a71d1f`から`29c6958`へforceなしでfast-forwardした。Pages run `33934125859`はbuild/deployとも成功。公開HTML/app/styleの新版markerは全一致し、candidate preflightは`ok:true`だった。
- 公開実画面をcache-bust再読込し、既存の「公開確認」対うっかりユズ戦が維持されたまま、「Standard対戦スタート」、人間の第2手、接続同期、5タブが表示されることを確認した。検証用戦績を増やさないため公開画面上での投了は行っていない。
- 公開直後のSupabase現況はCPU 2%、RAM 64%、disk 16%、connections 14/60。直前のCPU 2%、RAM 63%、disk 16%、connections 13/60から即時の異常増加は見られない。24時間比較は未実施。

## 2026-09-05 14:40 JST 役割・クイズ・報酬・クロガネv2公開

- `2d5e6bc`で対戦中の役割を「あなたが作る → CPUが塗る」と明示し、`604e932`で彩色前にも封印中の色を表示した。
- `c9a2ad5`で部分領域とデバッグ対戦のP0を修正し、setup/action結果を操作直下へ保持して、応答不明時だけ同じactionを再送できるようにした。migration `202609050003`とEdgeを先行適用し、Runbook A 43/43、Windows browser run `33940381350`、Pages run `33940876572`を合格させた。`db45ebc`は製品変更ではなく、Edge CI終了猶予だけのtest-only修正である。
- `d5590af`でクイズ問題表示を整え、Windows run `33941666286`とPages run `33942307414`が成功した。
- `2f06504`で各問直後の正誤と全10問の答え合わせを追加した。migration `202609050004`とEdgeを先行適用し、新方式と旧一括方式の両canary、Windows run `33943348061`、Pages run `33943980517`、公開実ブラウザ10問完走を合格させた。390px横overflow 0、console warning/error 0、報酬券5→6を確認した。
- `640ec98`でCPU戦の保存済み完了報酬を明示し、`colorPaletteChange`の基本色・おまけ色・残り回数の関係を説明した。再読込を含む券2→3、対人精算とCPU未精算の否定条件、ローカルChrome/Edgeを合格させ、Windows run `33944794035`とPages run `33944924097`が成功した。
- `a3425a4`でクロガネだけを`standard-character-roster-v1:kurogane-lookahead-v2`へ更新した。相手へ渡す領域が生む公開上の選択肢を先読みし、ゼロ色封鎖を最優先にしつつ、自分の基本色と最後のおまけ色を考慮する。他9人と旧クロガネroomの固定再生は変更していない。
- migration `202609050005`は旧policyを再生用に保持し、新規クロガネroomだけをv2にする。deployをまたぐ同一開始actionのlost-response再送は、全入力が同一でpolicyだけが旧v1のfingerprintと一致する場合に限定した。実DBの関数、権限、旧/new policy境界は全確認項目trueだった。
- クロガネv2のローカル検証は非browser Standard 544/544、重点89/89、オンラインbrowser 31/31、CPU browser Chrome/Edge各1/1。生成bundleは再生成SHAと一致した。独立レビューで見つかった色選択の優先度幅とdeploy跨ぎ再送の二点を修正後、P0/P1なしとした。
- Edge更新後の本番canaryは、新規匿名profile、クロガネv2 room、同一開始action再送、公開情報だけによる合法CPU手2回、人間投了、同じCPUとの再戦まで合格した。独立canaryもCPU roster 10人、v2 policy、profile、`cpu-start`新規room受理を合格した。
- `standard_candidate_verify.sql`をmigration `202609050005`まで拡張し、本番SQL Editorで読み取り実行した。非公開表、列、RLS/ACL、関数、クイズ制約、クロガネ旧/new helperを含む56項目は失敗0、`all_ok=true`だった。
- `origin/main`を`640ec98`から`a3425a4d459214e5274e20497af21f35a312099d`へforceなしでfast-forwardした。Standard browser gate `33947039777`はChrome/Edge成功、Pages `33947644765`はbuild/deploy/report成功。公開URLはHTTP 200、Last-Modifiedは2026-09-05 14:36 JST、公開rosterとEdge bundleは当該SHAの内容とSHA-256一致、実ブラウザconsole warning/error 0だった。
- 自動検証はすべて公開合格だが、物理的に別々の二端末を使う対人/CPU完走、復帰、再戦と、24時間後の使用量比較は引き続き`NOT_RUN` / `PENDING`として分離する。

## 公開前後メトリクス

値が取得できなかった項目を空欄のまま`VERIFIED`にしない。

| 時点 | Database | Edge invocations | Realtime messages / peak | Egress | p50 | p95 | error rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 変更前 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| canary後 | CPU 1% / RAM 59% / disk 16% / peak conns 15/60 | 251 requests | 5.3% warnings | PENDING | PENDING | PENDING | API 0.46% errors |
| `29c6958`公開直後 | CPU 2% / RAM 64% / disk 16% / connections 14/60 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## 公開識別子

| 項目 | 値 |
| --- | --- |
| browser harness diagnostics commit | `6fc23a5` |
| Windows browser CI commit | `d8dac1b` |
| final browser-verified candidate | `a3425a4`（クロガネ公開情報lookahead v2） |
| Windows browser CI run | `33947039777` / Chrome Success / Edge Success |
| 初回candidate code baseline（履歴） | `0e02176`（Edge deployment 8 sourceは`c3cf372`） |
| applied migrations | `202609030006`–`202609030013`, `202609050001`–`202609050005` |
| `standard-game-action` version | クロガネv2対応deployment（2026-09-05 14:34 JST更新） |
| Pages Actions run | `33947644765` / Success / `a3425a4` |
| public URL | `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/` |

## Canary結果

各項目は`PASS`、`FAIL`、`NOT_RUN`のいずれかとし、失敗を空欄で消さない。

| 区分 | 結果 | 時刻 | 有限な証拠 |
| --- | --- | --- | --- |
| Edge認証・基本公開 | PASS | 2026-09-05 | deployment 9で匿名sign-in、JWT欠落/改変拒否、profile、cosmetic catalog、CPU roster 10人の6/6 |
| 即時Standard CPU開始 | PASS | 2026-09-05 | deployment 9。匿名profile、未知CPU拒否、部屋作成、同一action再送、入力変更拒否、snapshot上のCPU身元を7/7確認 |
| 即時CPU完走・同CPU再戦 | PASS | 2026-09-05 | live canary 25/25、5.84秒。setup、初期化、CPU合法手、投了、精算、履歴、同room再戦、新match再初期化、private snapshotを確認 |
| A 合言葉・A/B/C・snapshot delta | PASS | 2026-09-05 | 自動live canary 43/43。A/B参加、C拒否、setup、初期化、一手、投了、seat別finished snapshot、再戦再初期化 |
| B クイズ・ガチャ・売却・精算・トロフィー・見た目 | PASS | 2026-09-05 | 自動live canary 93/93。exactly-once、復元、購入/装備を確認。fullPaint trophyはtransaction testで補完 |
| C 野良・競合・完走 | PASS | 2026-09-05 03:13 JST | 自動live canary 210/210。16 profile、完走、2 finder、cancel/find、10 claim、再検索、秘密非公開を確認 |
| D CPU同意・10人・代表3人・再戦 | PASS | 2026-09-05 | 自動live canary 107/107。実時間90/180秒、代表3人完走、復帰、統計、同じCPU再戦、対人検索競合を確認 |
| Windows実browser主要導線 | PASS | 2026-09-05 | run `33929432778`。Chrome 21/21、Edge 21/21。CPU勝利戦績表示、390pxの6枚選択、初回一操作、初手、全タブstatus、復帰、再戦、クイズ、ガチャ、売却、見た目、野良、CPUを確認 |
| 即時CPU Windows browser gate | PASS | 2026-09-05 | run `33931963065`。Windows 2025のChrome/Edge両ジョブ成功。ホーム導線、390px選択、pending再送、既存90秒案内を確認 |
| 初戦引き継ぎ・CPU次戦 Windows gate | PASS | 2026-09-05 | run `33933769885`。Chrome成功。Edge attempt 1はbrowser-closeだけtimeout、失敗job再実行のattempt 2成功。ローカル両browser各25/25 |
| クロガネv2 Windows gate | PASS | 2026-09-05 | run `33947039777`。Windows 2025のChrome job `101254916881`、Edge job `101254916818`がともに成功 |
| Pages公開後preflight | PASS | 2026-09-05 | `main=a4c6490`、Pages run `33932159043`、公開4資産HTTP 200、新marker全件一致、DB保護境界を含むcandidate preflight合格 |
| 初戦引き継ぎ Pages公開後preflight | PASS | 2026-09-05 | `main=29c6958`、Pages run `33934125859`、新版marker全一致、DB保護境界を含むcandidate preflight合格。公開実画面の既存CPU戦も維持 |
| クロガネv2 Pages・公開asset | PASS | 2026-09-05 | `main=a3425a4`、Pages run `33947644765`。公開URL HTTP 200、roster/bundleのSHA-256が候補と一致し、実ブラウザconsole warning/error 0 |
| 公開UI即時CPU開始 | PASS | 2026-09-05 | ホーム主CTA→10人一覧→うっかりユズ→6枚準備→準備完了→CPU初手→人間第2手を実画面で確認 |
| クロガネv2 live canary | PASS | 2026-09-05 | 新規匿名、v2 policy、同一開始action再送、公開情報だけによる合法CPU手2回、投了、同CPU再戦。独立canaryでも新規v2 room受理を確認 |
| 二端末最終受入 | NOT_RUN | PENDING | PENDING |

## 残存リスク

- Dashboardの詳細なAdvisor/使用量baselineは未取得。画面上では資源逼迫警告が継続しているため、公開範囲を広げる前後で使用量を追跡する。
- profile作成安定化はCの逐次16件で500/429なしを確認した。高並列作成そのものはAuth上限を消費するため再試験せず、再発時はEdge/DBログと資源警告を関連調査する。
- Cのstatus正規化は本番関数定義、既存ticket整合、live canary 210/210まで確認済み。今後もIPあたり30 anonymous sign-ins/時を守り、同じ認証窓で重いcanaryを再試行しない。
- 現行製品`a3425a4`は同commitのままPagesへ反映済み。自動browser、公開asset、Edge/DB canary合格と、未実施の物理二端末受入を混同しない。
- Edgeのper-isolate濫用抑止は分散レート制限ではない。公開後の計測で必要性が出た場合だけprovider側制限を検討する。
- 10人CPUの合法性・決定性は自動検証済みだが、人間が感じる個性と楽しさは代表3人の実プレイ後も定性的判断として残る。
- cleanup実削除や定期化は許可済みだが、exact IDと復元手段を確認するまで実行しない。課金設定変更は必要性と金額を特定してから扱う。
