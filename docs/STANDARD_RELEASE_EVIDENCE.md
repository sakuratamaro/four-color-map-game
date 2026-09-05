# Standard公開候補 証拠台帳

更新日: 2026-09-06

この文書は「コードがある」と「公開環境で確認した」を混同しないための台帳である。`VERIFIED` は同じ行に再現可能な根拠がある場合だけ使用する。token、API key、user ID、個人情報は記録しない。

状態は、根拠を確認済みの `VERIFIED`、公開環境まで確認した `PUBLIC_VERIFIED`、外部条件待ちの `BLOCKED`、明示承認待ちの `PENDING_APPROVAL`、作業待ちの `PENDING`、未実施の `NOT_RUN` を区別して記録する。

## 現在のゲート

| ゲート | 状態 | 現在の根拠 | 次の証拠 |
| --- | --- | --- | --- |
| 採否棚卸し | VERIFIED | `ONLINE_COMPLETION_INVENTORY.md`。旧Expo試作と現行Web Standardを分離済み | 公開後に状態列だけ更新 |
| 製品コード・生成元 | VERIFIED | `standard/`、build scripts、生成済みEdge bundleが統合ブランチに存在 | 最終公開commitを記録 |
| ローカル製品試験 | VERIFIED | `ecafdd1`。全non-browser、Standard Edge browser 52/52、focused Edge 2/2、Chrome 2/2、ローカルresponsive 4/4、接触静的25/25、静的＋Edge bundle 38/38が合格。3独立レビューはP0/P1なし | 物理二端末canary |
| 次期UX候補のローカル検査 | VERIFIED | `codex/standard-release-command@1673ff8`。profile安定化、初回対戦導線、Quick Half Shift、status正規化、Realtime/poll復旧を含む非browser製品試験91ファイル522/522。browser workflow/harness静的11/11合格 | Pages反映後のpreflightと二端末受入 |
| 初回導線・接続表示の次期候補 | VERIFIED | `9d42784`。初回starter作成＋profile同期を一操作化し、全5タブで単一接続statusを常時表示。空名write 0、room外offline復帰、390px下部nav非干渉を契約化。静的39/39、非browser 89ファイル513/513、Windows Chrome/Edge各18/18合格 | 物理二端末受入 |
| Windows実browser CI | VERIFIED | GitHub Actions run `33973264978`。製品`ecafdd1`のChrome job `101325424357`、Edge job `101325424224`がともに成功 | 公開URLで同じ主要導線を二端末受入 |
| 現行公開Pages | PUBLIC_VERIFIED | 公開基点`3e2b959`、Pages run `33973971235`成功。公開URLでStandard asset v21、戦術trace marker、5タブ、匿名認証、console error 0を確認 | 別々の二端末で最終受入 |
| 初回公開前DB境界（履歴） | VERIFIED | 旧snapshotは匿名権限拒否。snapshot v2と野良募集が未存在だった初回baseline | 現行境界は適用migrationとlive canaryを参照 |
| migration 006–013静的検査 | VERIFIED | migration別security/transaction testsと読み取り専用44項目SQL | 実DBで全行`ok=true` |
| Dashboard Advisor・使用量baseline | PENDING | 2026-09-05 16:23 JSTのT0を`STANDARD_OBSERVATION_T0_20260905.json`へPARTIAL記録。API/Edge/Realtime/Query/Advisor 17項目を観測、Databaseグラフ等20項目はDashboard取得不能でPENDING。Health alert 2件継続 | T+24hで同じ24時間filterを再採取し、Database欠落値とalert状態を再確認 |
| migration 006–013＋後続001–007本番適用 | PUBLIC_VERIFIED | 15本を個別適用。現行の読み取り専用検証SQLは66項目すべてtrue。開始前取りやめlive canary 33/33、active/unknown/nonterminal残留0 | 物理二端末最終受入 |
| Edge Function更新 | PUBLIC_VERIFIED | deployment 15へ`lastPublicTrace`対応engine bundleだけを更新。SQL変更なし。Runbook A 44/44で確定CREATE trace、部外者拒否、seat別private境界、再戦を確認し、基本Edge canaryも7/7 | 物理端末で対戦traceの体感を確認 |
| 即時Standard CPU開始 | PUBLIC_VERIFIED | migration `202609050002`とEdge deployment 9。製品`cc96350`、公開`a4c6490`、DB 47項目、Edge基本6/6、即時CPU 7/7、Windows run `33931963065`、Pages run `33932159043`合格。公開UIでCPU初手まで確認 | 物理端末で一試合完走・再読込・同じCPUとの再戦を確認 |
| CPU完走後の次戦導線 | PUBLIC_VERIFIED | `29c6958`。同じCPUとの同room再戦を維持し、終了結果から別CPU選択へ進める。live即時CPU完走・再戦canary 25/25、Windows Chrome/Edge成功、Pages反映済み | 物理端末で別CPU選択と再戦を体感確認 |
| CPU報酬からガチャへの直行 | PUBLIC_VERIFIED | `e36dfcc`＋`193a0e6`。保存済み通常CPU精算だけにCTAを出し、抽選せずLv.1ガチャへ移動。対人・未精算・debugを拒否し、390×844で券・抽選操作・focus・再読込を確認 | 物理端末でCPU一局からガチャまでの体感を確認 |
| GitHub main・Pages更新 | PUBLIC_VERIFIED | 公開product baseline `3e2b959d6cc89ce4e7a76f0a773225bffd0116a8`。Standard browser gate `33973264978`、Pages `33973971235`成功。後続mainは証拠台帳だけを更新し、公開asset v21の必須markerは不変 | 二端末受入後に最終状態を記録 |
| 合言葉対戦canary | VERIFIED | deployment 15で`live-standard-runbook-a-canary.mjs --confirm-live` 44/44合格。確定CREATEの公開trace shapeも検査 | 実ブラウザ再読込と二端末最終受入 |
| 確定接触feedback・戦術trace | PUBLIC_VERIFIED | `ecafdd1`。選択/poll/reload/replay/重複非発火、2→3累積、4色終局優先、reduced-motion、最終1回読み上げ、CREATE/COLOR/USE_SKILL allowlistを自動検査。Edge 15と公開v21で確認 | 二端末で読みやすさとテンポを体感確認 |
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
| `193a0e6` T0 16:23 JST | 24hグラフ取得不能。current CPU 2% / RAM 66% / disk 17% / connections 16/60、7日cardはCompute/CPU peak 99% | 1,006 | Postgres changes 148 / peak PENDING | PENDING | PENDING | PENDING | Data API 56 / 3,437 = 1.629328% |

## 2026-09-05 15:34 JST 6枚セットアップ即時確定公開

- `e0f4f98`で、スマホの6枚選択画面に既存の準備ボタンを固定表示した。スターター6枚は最初から選択済みであることと準備OKを同じ領域に表示し、無効な構成と送信中は従来どおり確定不可にした。二重の操作要素や新しいAPI経路は追加していない。
- ローカルはUI静的31/31、390×844の6枚選択browser、提出→初手引き継ぎbrowserが合格した。準備APIは1回だけ、下部navとの非重複、横overflowなしを検査した。
- 390×844の実画面で不要な内部scrollbarを除去し、公開URLの新規匿名profileから、うっかりユズ選択、固定CTA表示、準備送信、実対戦開始まで確認した。
- `c0b4f77`で、すでに強化済みだったbrowser timeout、復帰対象モード、CPU契約ジョブへ静的テストの期待値を同期した。製品資産は変更していない。
- `origin/main`と`codex/standard-release-command`を`c0b4f77`へforceなしでfast-forwardした。Pages run `33949936952`、Standard browser gate `33950043659`は成功し、同ゲートのChrome/Edge両jobが合格した。
- 物理的に別々の二端末を使う対人/CPU完走、途中再読込、再戦、永続化と、公開後24時間の使用量比較は引き続き`NOT_RUN` / `PENDING`である。

## 2026-09-05 16:08 JST CPU報酬からガチャへの直行公開

- `e36dfcc`で、保存済みの通常CPU戦結果だけに「獲得したLv.1券でガチャへ」を表示した。対人戦、未精算CPU戦、debug無制限戦では表示せず、結果を閉じても従来の同CPU再戦と別CPU選択を維持する。
- CTAは抽選を実行せず、保留中ガチャactionを上書きせずにLv.1ガチャ欄へ移動する。移動後は抽選ボタンではなく見出しへfocusし、Enter/Spaceのkeyupによる誤抽選を避ける。
- 390×844の実ブラウザで、結果モーダルと両操作の全体可視、横overflowなし、finished room保持、ガチャ呼出0、明示的な「1枚引く」後だけ呼出1、再読込後の券保持を確認した。対人・未精算・debugの否定条件も確認した。
- 独立レビューで紙吹雪がモーダルの不要な内部scrollを生むP2を発見し、`193a0e6`でclipした。実測は`clientHeight=504 / scrollHeight=504`、両操作はviewport内。静的42/42、ローカルEdge重点1/1、独立レビューP0/P1なし。
- Standard browser gate `33951596007`はChrome/Edge成功、Pages run `33951598229`も成功。公開URLでasset v14、報酬CTA、保存済みCPU条件、無抽選遷移、紙吹雪clip、focus CSSを確認し、candidate preflightも`ok:true`だった。DB、migration、Edge Functionは変更していない。
- 物理的に別々の二端末による対人/CPU完走、途中再読込、再戦、報酬からガチャまでの体感確認と、T0/T+24時間の使用量比較は引き続き`NOT_RUN` / `PENDING`である。

## 2026-09-05 16:23 JST 公開後T0観測

- Supabase Dashboardをread-onlyで確認し、すべて「Last 24 hours」へ合わせたData API 3,437 requests、Response Errors 56件（1.629328%）、Edge Function 1,006 invocations、Realtime Postgres Changes 148 eventsを記録した。
- Query Performanceは24時間filterではなく`pg_stat_statements`のreset以降の累積であるため別集計にした。`realtime.list_changes`は68,723 calls、DB総時間79%、mean 19ms、max 3,837ms。旧直接read形の`fcg_room_members`は6,759 calls、`fcg_rooms`は5,639 callsで、T+24hは累積差分として比較する。
- Security Advisorはerrors 0、warnings 19、suggestions 15。Performance Advisorはerrors 0、warnings 0、suggestions 11。Health Advisorは`DatabaseStorageCapacityExhausted`と`HostOutOfDiskSpace`の2件を「currently firing」と表示した。
- Infrastructure currentはCPU 2%、disk 17%、RAM 66%、connections 16/60。7日cardはCompute/CPU peak 99%、memory 64%、disk IO 1%。Databaseの24時間CPU、IO、connections、diskグラフはDashboard自身が取得不能を返したため、推測せず20 metricを`PENDING/null`にした。
- 入力`STANDARD_DASHBOARD_T0_20260905.json`と正規化出力`STANDARD_OBSERVATION_T0_20260905.json`を保存した。公開preflightは`ok:true`、repository HEAD・公開asset・Pages commit/run・Edge deployment 13を分離し、物理二端末は`NOT_RUN/PENDING/automated:false`のままである。
- 課金、Compute/Disk変更、Advisor reset、SQL、DB/Edge更新は行っていない。T+24hより先に、`realtime.list_changes`の累積負荷が現行Standard由来か既存/プラットフォーム由来かをread-onlyで切り分ける。

## 2026-09-05 17:51 JST 野良成立の安全な対戦引継ぎ公開・資源診断

- 3担当の監査を統合し、野良募集を待ちながらクイズまたはガチャを使った際、対戦成立を見落として相手を待たせる導線を次の最優先改善とした。
- `1e856f9`で、権威的なroom同期後だけ成立を一度通知し、通常待機中はsetupへ自動移動する。クイズ回答・開始RPC・ガチャが進行中なら、同じaction IDの結果または安全な再送状態まで待つ。各問の正誤は650ms以上表示し、次問時計を開始しない。
- クイズ時計の休止状態を通知表示から分離した。手動Battleタブによる待機境界の迂回を拒否し、対戦中、終了、退出、missing room中も残り時間を消費しない。実際にQuizタブを開いた時だけ再開する。active public roomだけを対象にし、合言葉、CPU、終了済みpublic、stale roomは通常復帰する。
- 初回の独立レビューで、別タブpending quiz、手動Battle迂回、休止中render、退出・終了・missing、非public reloadの競合を順に検出した。全件を再現testへ固定した後、最終独立レビューは残存P0-P2なしで承認した。
- ローカルはStandard online browser 38/38、静的・client・診断境界64/64が合格。正式製品連続試験は変更外の接触演出browser群が共有hostの30秒起動timeoutを再発し、単独再試行も同じhost症状だったため公開判定から分離した。変更対象の全browserは完走し、クリーンなWindows gate `33956185495`でChrome/Edgeとも成功した。
- `origin/main`を`c4535a4`から`1e856f9`へforceなしでfast-forwardした。Pages run `33956373181`は成功。公開HTML/app/styleはasset v15と安全引継ぎmarkerを返し、candidate preflightは`ok:true`だった。
- `ebe5f19`でread-only資源診断SQLと結果を保存した。DBは15,297,683 bytes、最大ゲームrelationは327,680 bytes、blocked connectionとidle-in-transactionは0、Realtime replication slotは2/2 active、slot別最大WAL lagは16,776,968 bytes。保持候補は24時間超room 11件、7日超ticket/quiz/limitと30日超receiptは0件だった。
- slot別lag合計は同一WAL区間を二重計上し得るため実ディスク量とみなさない。単発snapshotだけでslot追従も断定しない。ゲーム表肥大をStorage alertの主因とする証拠はなく、cleanup、課金、Compute/Disk変更、Advisor reset、DB/Edge更新は行っていない。T+24hで最大lagとDashboard指標を比較する。
- 物理二端末の野良成立引継ぎ、完走、途中再読込、再戦は`NOT_RUN/PENDING`のままである。

## 2026-09-05 18:50 JST CPU報酬ガチャから6枚再編成への循環公開

- 3担当を実装、否定境界監査、公開baselineへ分け、保存済み通常CPU戦の報酬CTAから明示的にLv.1ガチャを引いた場合だけ、獲得カードの名前・レアリティ・効果と「6枚を選び直して同じCPUと再戦」を表示する導線を`dab28e5`で追加した。対人、未精算CPU、debug、独立ガチャには表示しない。
- continuationはroom ID・version・match ID・finished CPU・FINISHED state・debug無効をすべて照合し、成功結果をsessionStorageから復元する際も継続情報とカード形状をallowlist正規化する。獲得カードは所持数だけ反映し、自動選択せず、既存のserver-authoritativeな`cpu-rematch`を一度だけ呼んで6枚選択へ戻す。
- 未解決`pendingGacha`中は新しい1枚／全枚抽選を封鎖し、失敗やreload後も同じaction IDの再確認だけを許可した。結果見出しfocus、先頭3枚までの有限aria要約、全件list/listitem、390×844で固定下部navより上にCTAが収まることを回帰固定した。
- 最終focused静的は90/90、P2仕上げ後のEdge重点3/3・Chrome重点2/2、直前全Edge 38/38。独立最終レビューはP0/P1/P2なし。正式root連続試験は変更外の接触演出browser群でtier 0–3後に既知の約32秒host timeoutが再発したため、候補判定は変更対象browserとクリーンなWindows gateへ分離した。
- Standard browser gate `33958531045`はChrome/Edge両job成功。`origin/main`を`b4b4d69`から`dab28e5`へforceなしでfast-forwardし、Pages run `33958727024`も成功した。
- 公開URLはasset v16、新しい結果・再戦DOM、匿名ログイン完了、console warning/error 0を確認した。通常の独立ガチャ画面では結果・再戦・再確認が非表示で、candidate preflightは`ok:true`。DB、migration、Edge Function、SQLは変更していない。
- 物理的に別々の二端末による対人/CPU完走、途中再読込、報酬→ガチャ→6枚再編成→再戦の体感確認と、T0から24時間後の使用量比較は引き続き`NOT_RUN` / `PENDING`である。

## 2026-09-05 20:05 JST 終局説明・Quick保存・ロビー・クイズ改善公開

- CPU「せっかちレン」の早い決着をengineまで再現し、黄色/緑の封印により青しか残らない盤面では`NO_LEGAL_COLOR`が正しい終局であることを確定した。`33bc870`で、敗者本人にだけ本人private paletteと公開盤面/sealから算出した内訳を常設表示し、勝者側へ相手private値が漏れないこと、finished後に待機/CPU思考/retryが残らないこと、reload後も同じ結果を表示しCPU actionを再送しないことをbrowser回帰へ固定した。
- 公開Quickの`invalid region macros`停止は、Half Shiftが10x10 playable bounds外の12x12 worldへ合法移動した後、save codecだけが旧境界で拒否していたことが根因だった。`5b850c8`で12x12 worldを許可しつつ、`sourceMacros`をmicro footprintから厳密導出し、四近傍連結と重複/範囲外を拒否した。旧v1の合法Half Shift saveは読込時に正規化し、次操作へ継続できる。独立レビュー後24/24合格。
- `00d198f`で980px帯ロビーを2列＋野良全幅へ整え、通常ガチャの重複取得サマリーを除去した。`881bd17`で全クイズに日本語mission、形式label、1–3段階の考え方を加え、server確定回答に基づくreload-safe 2/4/6 streakを表示した。報酬計算は変更していない。
- 統合後の変更対象非browserは123/123、Edge実browser 4/4、Chrome終局重点1/1が合格した。長い全製品runnerは変更外の接触演出browser群の後に共有host timeoutが連鎖したため、製品失敗とはみなさず、変更対象suiteとクリーンなWindows gateを公開判定に用いた。
- candidate `881bd17`を`codex/standard-release-command`へpushし、Standard browser gate `33961455909`のChrome/Edge両jobが成功した。`origin/main`を`44ee630`から`881bd17`へforceなしでfast-forwardし、Pages run `33961706817`も成功した。
- Supabase project `qkcuhludisairpgzhryl`の`standard-game-action`はindex.tsだけをdeployment 14へ更新した。DB/SQL migration、secret、billingは変更していない。更新後canaryは匿名認証、JWT欠落/改変拒否、profile、cosmetic catalog、CPU 10人、10問すべてのmission/formatLabel/thinkingStepsを7/7で確認した。
- 公開candidate preflightは`ok:true`。Standardはasset v18と終局/クイズmarker、Quickは`save-codec.js?v=20260905-2`を返した。Chromeの公開Standard/Quick実画面はwarning/error 0で、既存CPU roomのreload継続も確認した。
- 次の最優先は、server上のactive roomを残してローカル表示だけ破棄できる導線の修正である。room外6枚editor、CPU選択local-only、明示開始のimmutable二段sagaまで監査済み。物理二端末受入とT+24h観測は`NOT_RUN/PENDING`のままである。

## 2026-09-05 21:56 JST active-room排他・room外6枚編成・明示CPU開始公開

- `03c5628`でCardsからroomを作らず6枚を保存できるようにし、CPU選択はlocal-only、最終確認だけが`cpu-start`と`setup`の不変IDを持つ二段sagaを実行するようにした。`stage`、確定`roomId`、終了済みCPU戦の`replaceRoomId`を保存し、start応答喪失はstart 2/setup 1、setup応答喪失はstart 1/setup 2で同じIDを再送する。
- create/join/recruit/find/direct CPU/stale dialog/final commit/startup復旧を中央guardで保護した。active room、draft/saga、ticket、find pending、別のfinished roomが競合する場合は新規RPC 0で所有中状態へ戻る。active中の「画面だけ閉じる」はroomIdと同期を保持し、Homeの復帰CTAから同じ試合へ戻る。
- migration `202609050006_standard_single_active_room.sql`を適用し、member insert/updateとroom再活性化の最終DB境界でactor単位のactive Standard roomを1件に制限した。対象room `FOR SHARE`、actor advisory lock、再活性化時のUUID順lockでinactive insertとの競合も直列化する。
- 適用前preflightは重複actor 1件だった。10時間以上更新なし・1人waiting・setup/action/view/match stateすべて0の未使用private-code roomだけを厳密条件で`abandoned`へ変更し、既存CPU roomは保存した。削除はしていない。再preflightは0、適用後candidate verificationは61/61、rollback-only DB canaryは二重member/再活性化を拒否し残留0だった。
- ローカルfull browser 46/46、関連非browser 80/80、Windows run `33966896517`のChrome `101308503116` / Edge `101308503120`が成功。`origin/main`をforceなしで`03c5628`へfast-forwardし、Pages run `33967367304`も成功した。
- 公開HTML/app/styleはasset v19と新markerをHTTP 200で返し、candidate preflightは`ok:true`。Chromeで既存CPU戦が対戦中のまま復元され、screen-only close後にHome CTAから同じ第2手へ戻ることを確認した。Edge deploymentは14のままで変更していない。
- 物理的に別々の二端末による対人完走・reload・再戦とT+24h資源比較は引き続き`NOT_RUN/PENDING`。waiting/readyの正式な無報酬abandonは次便でserver-authoritativeに追加する。

## 2026-09-05 23:00 JST 開始前取りやめ公開

- `5c072ae`で、waiting/readyだけを無報酬で`abandoned`へ進める認証付きRPCと、同一room/version/action IDを応答喪失・reload後も再送するUIを追加した。playingは既存のexactly-once SURRENDERだけ、finishedは結果・再戦のまま分離した。
- 独立レビューでCPU setup sagaとの競合を見つけ、同一roomの`stage=setup`だけを取りやめ成功時に破棄した。ローカルEdge 50/50と競合fixture、Windows run `33969830340`のChrome `101316251520` / Edge `101316251312`が合格した。
- migration `202609050007_standard_pregame_abandon.sql`を本番へ単独適用した。適用後の`db-ready` preflightは`ok:true`、読み取り専用candidate verificationは66/66 true。初回canaryは既存join RPCのHTTP 200汎用失敗行をHTTP errorと誤認して停止したが、roomはterminal、active残留0だった。検査を既存`ERROR_JOIN_FAILED`契約へ修正後、33/33、profile不変、active/unknown/nonterminal残留0で合格した。
- `origin/main`をforceなしで`426dc41`へfast-forwardし、Pages run `33970429997`が成功した。公開candidate preflightは`ok:true`。公開asset v20/client v15を読み込み、保存済みplaying CPU roomが継続し、開始前取りやめは出ず「画面だけ閉じる」と「敗北として投了する」が分離されることを確認した。
- Edge bundle/deployment 14、secret、billing、削除、cleanup scheduleは変更していない。物理二端末受入とT+24h資源比較は引き続き`NOT_RUN/PENDING`。

## 2026-09-06 00:11 JST 確定接触feedback・公開戦術trace公開

- 製品commit `ecafdd1`で、選択中には接触数や合法色を予告せず、確定CREATEの新規eventだけを一度表示する累積feedbackを追加した。通常2色は2、通常3色は2→3、4色接触は終局結果の2→3→4へ一本化した。reduced-motionは最終静止tier、視覚overlayは`aria-hidden`、読み上げは最終結果1回だけである。
- `publicState.lastPublicTrace`はCREATE/COLOR/USE_SKILL別の厳密allowlistとし、表示は「直前の手→盤面変化→次の判断」に限定した。手札、palette、skill identity/target/payload、非公開state、確定前oracle、raw region idは出さない。legacy stateはtraceなしで継続でき、現行versionの偽造traceは拒否する。
- ローカル全検査とStandard online Edge 52/52、focused Edge 2/2、Chrome 2/2、responsive 4/4が合格。3担当の独立最終レビューは全員GO、P0/P1なし。Windows gate `33973264978`はEdge `101325424224`、Chrome `101325424357`が成功した。
- Supabase `standard-game-action`はengine bundleだけをdeployment 15へ更新した。SQL/migration、secret、billing、削除、cleanup scheduleは変更していない。更新後Runbook Aは44/44で確定CREATE traceを本番projectionから確認し、基本Edge canaryも7/7だった。
- `origin/main`をforceなしで`3e2b959`へfast-forwardした。Pages run `33973971235`は成功。公開HTML/app/styleはHTTP 200、asset v21、戦術trace marker、四色終局文言を返し、candidate preflightは`ok:true`。公開ブラウザは5タブ、匿名認証、console error 0を確認した。
- 自動検査と公開反映は完了したが、物理的に別々の二端末による対人/CPU完走、途中再読込、再戦と、T+24h資源比較は`NOT_RUN/PENDING`のままである。

## 公開識別子

| 項目 | 値 |
| --- | --- |
| browser harness diagnostics commit | `6fc23a5` |
| Windows browser CI commit | `d8dac1b` |
| final browser-verified candidate | `3e2b959`（製品commit `ecafdd1`。確定接触feedbackと公開戦術trace、開始前取りやめ等を累積） |
| Windows browser CI run | `33973264978` / Chrome `101325424357` Success / Edge `101325424224` Success |
| 初回candidate code baseline（履歴） | `0e02176`（Edge deployment 8 sourceは`c3cf372`） |
| applied migrations | `202609030006`–`202609030013`, `202609050001`–`202609050007` |
| `standard-game-action` version | deployment 15（2026-09-06 00:06 JST頃、公開戦術trace対応engine bundle） |
| Pages Actions run | `33973971235` / Success / `3e2b959` |
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
| 6枚セットアップ即時確定 | PASS | 2026-09-05 | `e0f4f98`。390×844でCTAが初期表示内かつ下部navより上、6/6・各2枚だけ有効、準備送信1回。公開匿名profile→CPU選択→実対戦開始まで確認 |
| 6枚CTA Windows browser gate | PASS | 2026-09-05 | run `33950043659`。Windows 2025のChrome/Edge両jobが成功 |
| CPU報酬→ガチャ Windows browser gate | PASS | 2026-09-05 | run `33951596007`。Chrome/Edge両job成功。保存済みCPU精算、否定条件、390×844、無抽選遷移、再読込後の券消費を検査 |
| CPU報酬→ガチャ Pages・公開asset | PASS | 2026-09-05 | `193a0e6`、Pages run `33951598229`。公開asset v14、CTA、保存済みCPU条件、無抽選遷移、紙吹雪clip、focus CSSを確認 |
| 野良成立引継ぎ Windows browser gate | PASS | 2026-09-05 | run `33956185495`。Windows 2025のChrome/Edge両job成功。回答中・開始中・別タブ・ガチャ・reload分類・休止保持を含む38 browser test |
| 野良成立引継ぎ Pages・公開asset | PASS | 2026-09-05 | `1e856f9`、Pages run `33956373181`。公開asset v15、安全引継ぎDOM/app/style marker、candidate preflight `ok:true` |
| CPU報酬ガチャ→6枚再編成 Windows gate | PASS | 2026-09-05 | run `33958531045`。Windows 2025のChrome/Edge両job成功。pending同一ID、CPU報酬結果、reload、390×844、同CPU再戦、否定境界を検査 |
| CPU報酬ガチャ→6枚再編成 Pages・公開asset | PASS | 2026-09-05 | `dab28e5`、Pages run `33958727024`。公開asset v16、新DOM、匿名接続、console warning/error 0、通常ガチャ否定境界、candidate preflight `ok:true` |
| 終局・Quick保存・ロビー・クイズ Windows gate | PASS | 2026-09-05 | `881bd17`、run `33961455909`。Windows 2025のChrome/Edge両job成功。終局private境界/reload、Quick保存、980pxロビー、ガチャ、クイズhint/feedbackを包含 |
| クイズ体験 Edge canary | PASS | 2026-09-05 | deployment 14。基本認証/公開境界に加え、新規匿名quizの10問すべてでmission、formatLabel、thinkingStepsを確認し7/7 |
| `881bd17` Pages・公開asset | PASS | 2026-09-05 | Pages run `33961706817`。Standard asset v18、Quick save codec v20260905-2、candidate preflight `ok:true`、公開Chrome Standard/Quick warning/error 0 |
| active-room排他・明示CPU開始 Windows gate | PASS | 2026-09-05 | `03c5628`、run `33966896517`。Chrome/Edge両job成功。全入口guard、応答喪失saga、finished置換、390/980pxを含む46 browser test |
| migration 006・DB排他canary | PASS | 2026-09-05 | duplicate preflight 0、candidate verification 61/61。二重memberとinactive room再活性化を実DBで拒否し、rollback後residue 0 |
| `03c5628` Pages・公開asset | PASS | 2026-09-05 | Pages `33967367304`。Standard asset v19、candidate preflight `ok:true`、既存CPU戦のreload・screen-only close・同じ試合への復帰を公開Chromeで確認 |
| 開始前取りやめ DB・live canary | PASS | 2026-09-05 | migration `202609050007`。candidate verification 66/66、live 33/33。waiting/ready、冪等再送、部外者拒否、playing拒否、profile不変、terminal残留、active/unknown/nonterminal 0を確認 |
| `426dc41` Pages・公開asset | PASS | 2026-09-05 | Pages `33970429997`。Standard asset v20/client v15、candidate preflight `ok:true`、保存済みplaying CPU戦の継続とscreen-only close／投了／開始前取りやめの分離を公開ブラウザーで確認 |
| 確定接触feedback・戦術trace Windows gate | PASS | 2026-09-06 | `ecafdd1`、run `33973264978`。Chrome `101325424357`、Edge `101325424224`が成功。確定event限定、累積tier、reduced-motion、terminal優先、390/980px、公開allowlistを検査 |
| Edge deployment 15 tactical trace | PASS | 2026-09-06 | Runbook A 44/44。確定CREATEのtype/actor/version/eventId/sourceMacroCount/contactColorCountを本番projectionで確認し、部外者拒否・seat別private境界・再戦も合格。基本Edge 7/7 |
| `3e2b959` Pages・公開asset | PASS | 2026-09-06 | Pages `33973971235`。Standard asset v21、HTML/app/style HTTP 200、戦術traceと四色終局marker、candidate preflight `ok:true`、公開5タブ・匿名認証・console error 0 |
| 二端末最終受入 | NOT_RUN | PENDING | PENDING |

## 残存リスク

- Dashboard T0は17項目を取得したが、Database 24hグラフ等20項目はDashboard取得不能でPARTIAL。資源逼迫alert 2件と7日Compute/CPU peak 99%があるため、負荷由来を切り分けるまで新しい高負荷経路を追加しない。
- profile作成安定化はCの逐次16件で500/429なしを確認した。高並列作成そのものはAuth上限を消費するため再試験せず、再発時はEdge/DBログと資源警告を関連調査する。
- Cのstatus正規化は本番関数定義、既存ticket整合、live canary 210/210まで確認済み。今後もIPあたり30 anonymous sign-ins/時を守り、同じ認証窓で重いcanaryを再試行しない。
- 現行公開`3e2b959`（製品`ecafdd1`）はPagesへ反映済み。自動browser、公開asset、Edge/DB保護境界の合格と、未実施の物理二端末受入を混同しない。
- Edgeのper-isolate濫用抑止は分散レート制限ではない。公開後の計測で必要性が出た場合だけprovider側制限を検討する。
- 10人CPUの合法性・決定性は自動検証済みだが、人間が感じる個性と楽しさは代表3人の実プレイ後も定性的判断として残る。
- cleanup実削除や定期化は許可済みだが、exact IDと復元手段を確認するまで実行しない。課金設定変更は必要性と金額を特定してから扱う。
