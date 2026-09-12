# Standard公開候補 証拠台帳

## 2026-09-12 UDL060 結果のそばから次へ

PUBLIC_VERIFIED `b81a1d52e8230d41ec9e69610d89bafc86d1d84e`。実Astra016でUDL-060-result-v1.1/blob54cd9c8a945fcc84dff1354733fad6a32cc5624aを承認、DB/Edge[]。Windows34659862518最終両SUCCESS、fresh main d6から通常push、同SHA Pages34662217796 SUCCESS。公開preflightと4asset byte一致、実Chrome390/1280の37/37と最終画像3枚目視PASS。移動時draw/rematch/write0、最後のserver room/profile/history/tickets/revision不変。物理端末・実対人はNOT_RUN。全履歴と限界は `docs/UI_RESULT_RELEASE_20260912.md`。

初回Edge帯選択timeoutは同SHAの一度の失敗job再実行でPASS、原因未確定の観察REG-20260912-EDGE-BAND-01を保持。初回live harnessの読み取りRPC分類・終局再確認方法の失敗も保存し、harnessのみ修正した追加1回で完了。計試験profile2/CPU2、削除0。061/062は別の未公開候補として続行し、060の承認を流用しない。

## 2026-09-12 UDL023 対戦入口の整理

PUBLIC_VERIFIED `93c05c7c68576b28a126588d0716f0f56c015531`。実Astra承認012、Windows34636944139 Chrome/Edge成功、fresh main a26からforceなしで公開、同SHA Pages34638574408 SUCCESS。3assets厳密byte一致をprofile作成前に確認、公開preflight PASS。実公開Chrome28/28（390/768/1280、route・CPU一覧・keyboard・reload）、390/1280実画像目視PASS、物理NOT_RUN。実募集/検索write・対局・quiz・gacha0。最終1件＋初期harness失敗2件で試験profile計3、削除なし。旧a9はCI失敗で未公開、012へ承認取り直し済み。全試行・hash・限界は `docs/UI_ENTRANCE_RELEASE_20260912.md` と `docs/UI_ENTRANCE_LIVE_20260912.json`。UI目標は継続し、次便052/054/063へ進む。レビュー待機は閉じ、既存heartbeat PAUSED。

## 2026-09-11 UDL-059 クイズ報酬券レベルの引継ぎ

実Astra承認008（response bbc180c1-1cdb-4754-b53b-71eec1e11895）、候補/本番main `f8713d7006da0619b9c356d53a472754833fb910`、Windows34559185018 SUCCESS、main再照合・通常push後にPages34562271949 SUCCESS。仕様UDL-059-quiz-v1/blob d548792499924e84709957750dabdd5106d9f99a、Pages_only、DB/Edge各[]。公開HTML/app v20260911-27は候補Git blobと全byte一致、candidate preflight ok:true。

2026-09-11T04:36:58.527Z、実公開Chrome 390px/1280pxでクイズ10問→確定報酬Lv1→ガチャLv1→明示1回抽選→再読込の22/22 PASS。表示/率/券消費一致、遷移抽選0、二重finish/draw 0、console/page error 0。ローカル847/847・重点Chrome/Edge各5/5と実本番証拠を分離する。保存Lv2・残0・未決着の組合せは候補browser gate、物理端末NOT_RUN。

失敗3試行も保存した。初回はprofile hydration待ちを追加、2回目はクイズ中timeout、3回目は回答10件200・採点409（エラーコード未採取）。既存5秒未満完了ガードを保持し回答間隔700msとした4回目が成功。ゲームコード/DB/Edgeの変更による解消ではない。計4試験プロフィール、対局作成0、削除0。詳しい全試行・hash・範囲は `docs/REWARD_GACHA_RELEASE_20260911.md` と `docs/REWARD_GACHA_LIVE_20260911.json`。UDL-059のみPUBLIC_VERIFIED。返答待ちautomationはPAUSED実読戻し済みで、文書整理や他の未完改修を公開条件に追加していない。

## 2026-09-11 UDL-052 属性識別slice公開

候補/main `ce6fab535235d7aff90d0bc846bbfb648c9a56e4`、Astra実承認007（a5e21358）、Windows34533968562成功後、Pages34554265788成功。公開HTML/app/intentsは候補Git blobとbyte一致。candidate preflight `ok:true`。2026-09-11T02:26:27.225Z、許可された新規CPU1対局で公開Chrome390/1280px・reload・基本色/おまけ残数・状態非変更の30/30 PASS。console 0、試験対局は通常投了で終了、削除なし。詳しいhashと範囲は `docs/PALETTE_ROLE_RELEASE_20260911.md`。

属性識別だけPUBLIC_VERIFIED。重複/封印/残0の組合せは候補browser gateの証拠であり、liveで全組合せ実測済みではない。位置固定・4色案・UDL054・物理二端末は未完。DB/Edge変更なし。

## 2026-09-11 UDL-055 本番試験追補

ユーザーの試験プロフィール・対局作成の明示許可を受け、`scripts/live-standard-terminal-setup-canary.cjs --confirm-live` を実行。2026-09-10T21:31:08.208Zに20/20 PASS。公開対象はmain/Pages `5c03e6c`、実Chrome 390×844、新規匿名プロフィール1件とユズCPU対局1件のみ。通常のsetup/initialize/CPU進行/投了を使用し、対局はfinished・SURRENDERで終了確認済み。プロフィールと終局記録は削除せず保持した。

cold restore、reload、新規tabでrandom setupのshow呼出し0、overlay非表示、同じroomと終局理由を確認。元tabへの復帰でもoverlay非表示。復元中のゲームwrite 0、pageerror 0、前後のserver room・profile（報酬/履歴を含む）完全一致。秘密値、room/user/action IDは出力・保存しない。これは実本番API＋ブラウザーの確認であり、物理2端末・触感、長時間background、明示再戦のlive実測を代替しない。今回の配備変更・DB構造変更・既存プレイヤー変更は0。

更新日: 2026-09-10

この文書は「コードがある」と「公開環境で確認した」を混同しないための台帳である。`VERIFIED` は同じ行に再現可能な根拠がある場合だけ使用する。token、API key、user ID、個人情報は記録しない。

状態は、根拠を確認済みの `VERIFIED`、公開環境まで確認した `PUBLIC_VERIFIED`、外部条件待ちの `BLOCKED`、明示承認待ちの `PENDING_APPROVAL`、作業待ちの `PENDING`、未実施の `NOT_RUN` を区別して記録する。

## 2026-09-10 UDL-055 終局復帰の開始告知抑止

- 公開候補/main: `5c03e6c2d0e94c843776ea7eae0d7bbe2917a174`。製品修正 `2e5e1d0`、後続は公開preflightのcache期待値1行だけ。基準main `2f855cc` 不変、clean、祖先関係を公開直前に確認してforceなしでfast-forwardした。
- 受入正本: [UDL-055-v1](https://github.com/sakuratamaro/four-color-map-game/blob/5c03e6c2d0e94c843776ea7eae0d7bbe2917a174/docs/TERMINAL_SETUP_NOTICE_FIX_20260910.md)、blob `f6d3c85f7d30e599f1ea1682516a5776fbc24899`。元ユーザー `bbb21a1e-346f-438d-8f41-2ecdcb75bf37`、ChatGPT受入 `927e69f3-5491-4ab3-9af8-4476a4dc1fb8`。このCodexの後続ユーザー本番反映指示を公開権限とし、APPROVE_DOCSを流用していない。
- 実ChatGPTの新SHAに対するAPPROVE_RELEASE: `f9602351-1660-443a-ae7e-ad23f6bcf468`、依頼 `00d476cf-0f55-4ffb-b55f-5a3777322ecc`。Pages-only、DB/Edge各 `[]`。旧SHAへの承認は別に保存し、流用しなかった。
- clean候補の非browser製品回帰 **859/859 PASS、skip 0**。focused Chrome/Edge各 **5/5 PASS、skip 0**（browser4件＋runtime1件）。3 builder後生成物差分0。同期show→hide、終了済みreload、新tab、背景復帰、演出中の終局、明示CPU再戦、profile/結果/room保持を検証。
- Windows [34488809507](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34488809507): Chrome `102909875803`、Edge `102909876053`ともSUCCESS。旧Windows `34488482619`は古いcache期待値で失敗、削除せず保持。ローカル途中の古いharness契約・runbook marker・dirty candidate試験失敗は修正/clean化後に再確認した。
- Pages [34490277366](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34490277366): 同一SHAでSUCCESS。通常公開URLのHTTP GETだけでHTMLとapp v25を取得し、候補Git blobと全byte一致した。
- 公開 `index.html`: 36,139 bytes / SHA-256 `53f24229ad03a2337933c284eae916747463be9920482b1f790740608c015b2a`。
- 公開 `app.js?v=20260910-25`: 321,691 bytes / SHA-256 `c0a4ae72426b2c01bad53cbd2375af502c733b199b0471b74e65d48ecc8f9b85`。
- **PAGES_ASSET_VERIFIED**。実本番対局・物理二端末は **NOT_RUN**。試験profile/CPU room作成を伴うlive canary案はauto-reviewがPages-only範囲外として拒否し、ファイル作成・実行とも行われなかった（予定scriptの不存在確認済み）。認証・profile・room・actionを使わないGET-only照合へ切替えた。本番データ作成の追加試験には別の明示許可が必要。UDL状態はMERGED＋Pages成功/配信証拠を分記し、実機受入まで推測で完了にしない。
- 今回DB、Edge配備、migration、RNG、報酬・ルール、既存対局、dirty root、他worktreeは変更していない。旧未公開便や共有正本文書一式をmainへ混入させていない。

## 現在のゲート

| ゲート | 状態 | 現在の根拠 | 次の証拠 |
| --- | --- | --- | --- |
| 採否棚卸し | VERIFIED | `ONLINE_COMPLETION_INVENTORY.md`。旧Expo試作と現行Web Standardを分離済み | 公開後に状態列だけ更新 |
| 製品コード・生成元 | PUBLIC_VERIFIED | alpha.4 engine製品`90e718b`とdirect-cell UI `26a4161`をmainへ適用。Local/Edge bundleは決定的再生成、配備済みEdge deployment 24 sourceはLF正規化後に候補と一致 | 次回engine変更時に再生成一致を確認 |
| alpha.3カテゴリ制限 | PUBLIC_VERIFIED | source `d627cd5`、統合`d3cb130`、起動修正`549e716`。候補59 pathはblob 59/59同値。独立focused 232/232、Chrome/Edge全browser各77/77・skip 0、正式実browser各79/79・skip 0。Windows `34048695008`成功、Pages `34051979716`、Edge deployment 23、公開canary 7/7＋COLOR追補263/263＋23/23＋108/108。互換rollback `3f4548d`はGitHub保全済み | 物理二端末受入 |
| alpha.4彩色済みエリア角膨張 | PUBLIC_VERIFIED | engine製品`90e718b`、direct-cell UI `26a4161`。カード→公開microcell→即発動とし、旧mode/番号候補/別確定UIを撤去。focused非browser 138/138、ローカル実Edge/Chrome各6/6、Windows `34065224136`、Pages `34065705946`、公開candidate preflight `ok:true`、app v42/style v40/intents v19、390px overflow 0、console 0、独立再監査P0/P1/P2なし。対象外通信0、preparedOutgoing継続とpointer lock、retry同一性、server不成立後の44px再選択を確認。現行の互換rollbackは`codex/standard-alpha4-current-compat-rollback-20260908@531adb2`。Edge deployment 24の基本7/7＋COLOR 225/225、配備ZIP SHA一致。DB、migration、RPC、secret変更なし | 物理二端末受入 |
| ローカル製品試験 | VERIFIED | 音便focused unit/static/workflow/bundle 96/96・skip 0、独立再監査P0/P1なし。Web Locks 2ページ競合はローカルEdge/Chrome各2/2、同一ID一意出力・異ID保持・3ページ目duplicateを確認 | 物理端末で音量・振動感と救済判断、Lv5の体感確認 |
| Shift select候補 | SUPERSEDED | `24caae8`→`d9b6fe9`→`1557ff1`。失敗run `34026276754` / `34027199050`で旧fixtureとretry payloadを修正し、run `34027488186`はChrome/Edge成功。ただしユーザー決定は盤面tap指定のためmain/Pagesへ昇格せず、`8944572`で製品差分をrevert | UDL-20260906-001として盤面操作UXを再設計 |
| Shift盤面選択 | PUBLIC_VERIFIED | 製品`ad49a41`、main `4b2ea3d`、公開HEAD `ddfb0a7`。select/数値入力を廃止し、行・列→盤面tap/keyboard、自然語方向、取消無送信、再送identity、no-oracleを維持。Windows `34041850645`はChrome/Edge成功、独立各3/3・skip 0。Pages `34043472457`成功、公開asset SHA一致、390px overflow 0、console 0、preflight `ok:true` | 物理端末でShift操作感を最終受入 |
| 次期UX候補のローカル検査 | VERIFIED | `codex/standard-release-command@1673ff8`。profile安定化、初回対戦導線、Quick Half Shift、status正規化、Realtime/poll復旧を含む非browser製品試験91ファイル522/522。browser workflow/harness静的11/11合格 | Pages反映後のpreflightと二端末受入 |
| 初回導線・接続表示の次期候補 | VERIFIED | `9d42784`。初回starter作成＋profile同期を一操作化し、全5タブで単一接続statusを常時表示。空名write 0、room外offline復帰、390px下部nav非干渉を契約化。静的39/39、非browser 89ファイル513/513、Windows Chrome/Edge各18/18合格 | 物理二端末受入 |
| Windows実browser CI | VERIFIED | alpha.3候補`549e716`のrun `34048695008`はChrome成功、Edgeの既存feedback複数タブ競合が初回のみ失敗し、同一commitの再実行`101529617681`が成功。favicon追補後の終了処理はBrowserServer所有へ強化。追随漏れの静的契約だけが停止させたrun `34053352498`を保持し、修正`23f56af`のrun `34053724009`はChrome `101541739097`／Edge `101541739242`、各79/79・skip 0、CPU契約457/457、helper 4/4で成功 | 公開URLで同じ主要導線を二端末受入 |
| 現行公開Pages | PUBLIC_VERIFIED | 公開HEAD `3ddac0c`、Pages run `34424023010`成功。公開URLでapp v20、progression CSS v1、candidate preflight `ok:true`。Chrome 390×844はCPU戦績10人／2列／portrait ready 10/10、長名・page horizontal overflow 0、console warning/error 0 | 別々の二端末でカテゴリ制限、Shift、角膨張、音量・振動感を最終受入 |
| 初回公開前DB境界（履歴） | VERIFIED | 旧snapshotは匿名権限拒否。snapshot v2と野良募集が未存在だった初回baseline | 現行境界は適用migrationとlive canaryを参照 |
| migration 006–013静的検査 | VERIFIED | migration別security/transaction testsと読み取り専用44項目SQL | 実DBで全行`ok=true` |
| Dashboard Advisor・使用量baseline | WATCH_RESOURCE_ALERT | 既存2件のplatform resource alertは継続。一方、2026-09-07の24h DashboardはCPU 2%、RAM 63%、disk 17%、disk IO 1%、接続peak 20/60、DB 30.5MB、WAL 128MB、API error 0.07%。同時read-only SQLはDB 16.7MB、接続18/60、blocked/idle-in-transaction 0、slot 2/2 active、最大retained WAL 16.77MB。DB契約72/72、Edge 24のpreflight/canaryも全成功で、実枯渇や新規悪化の根拠はない | 同じ指標とalert名を継続監視。新規alert、inactive slot、blocked接続、429/5xx悪化だけをHOLDへ昇格し、推測cleanup・課金・Compute変更はしない |
| migration 006–013＋後続001–007＋202609060001–003本番適用 | PUBLIC_VERIFIED | additive availability RPCまで適用。現行の読み取り専用検証SQLは72/72すべてtrue。availabilityはauthenticatedのみ、匿名preflightではprotected | 物理二端末最終受入 |
| Edge Function更新 | VERIFIED | deployment 24へalpha.4の`index.ts` 1,182行と生成済みbundle 3,803行を同時反映。配備後ZIPのSHA-256はindex `526f8d653859f529c5d062aab3e2669b1ba7ad2c7011ca0643beabeaaa71941b`、bundle `4ae11f822d5450e0876ed4c4c205a2912eaeea4fd99042b47a1839d1b36e2841`で候補と一致。phase-less preflight `ok:true`、基本7/7、COLOR応答225/225。新規room alpha.4、公開/private境界、同カテゴリ拒否write-free、CPU有限進行、terminal cleanupを実測 | Pages公開後のcandidate preflightと公開browser確認 |
| 即時Standard CPU開始 | PUBLIC_VERIFIED | migration `202609050002`とEdge deployment 9。製品`cc96350`、公開`a4c6490`、DB 47項目、Edge基本6/6、即時CPU 7/7、Windows run `33931963065`、Pages run `33932159043`合格。公開UIでCPU初手まで確認 | 物理端末で一試合完走・再読込・同じCPUとの再戦を確認 |
| CPU完走後の次戦導線 | PUBLIC_VERIFIED | `29c6958`。同じCPUとの同room再戦を維持し、終了結果から別CPU選択へ進める。live即時CPU完走・再戦canary 25/25、Windows Chrome/Edge成功、Pages反映済み | 物理端末で別CPU選択と再戦を体感確認 |
| CPU報酬からガチャへの直行 | PUBLIC_VERIFIED | `e36dfcc`＋`193a0e6`。保存済み通常CPU精算だけにCTAを出し、抽選せずLv.1ガチャへ移動。対人・未精算・debugを拒否し、390×844で券・抽選操作・focus・再読込を確認 | 物理端末でCPU一局からガチャまでの体感を確認 |
| CPU完了報酬の実所持突合 | PUBLIC_VERIFIED | 公開`4318793`（製品`65f23c9`、本番canary `eb629e5`）。Edge index/bundleのbyte・SHA一致、基本7/7、CPU敗北の券付与・profile delta・完全reload・終局action再送18/18、関連113/113、390px focused Chrome/Edge各1/1。Windows `34385103929` attempt 2とPages `34387630198`成功。公開CPU戦で券`15→16`、ガチャ`×16`、1枚抽選後とreload後`×15`、獲得結果維持を確認 | 物理端末で報酬からガチャまでの体感を確認 |
| GitHub main・Pages更新 | PUBLIC_VERIFIED | `3d84294→4318793`をforceなしでmainへfast-forwardし、Pages `34387630198`成功。公開asset app v10/style v6、candidate preflight `ok:true`、390px overflow 0、console 0 | 二端末受入後にカテゴリ制限、Shift、物理音量・振動感を記録 |
| server-side active-room復帰 | PUBLIC_VERIFIED | private/public/CPUを有限8列で本人にだけ返し、厳格な1行だけ採用。raw sentinel/UUID非表示、background focus非奪取、CPU/matchmaking saga優先、復帰時の新room/setup送信0をbrowser回帰とlive 10/10で確認 | 物理端末でlocal identity喪失後の復帰を体感確認 |
| 塗り直し・乱 LAB | PUBLIC_VERIFIED | `ad53bb4` / 公開`3fb3ef8`。private-code human双方同意、debug排他、固定ruleset、server-only乱数、1人1回貸与、通常19枚/6枚/CPU/野良/戦績/報酬/在庫非変更。DB 70/70、Edge 23/23、Windows/Pages/公開preflight合格 | 二端末LAB一局 |
| 合言葉対戦canary | VERIFIED | deployment 15で`live-standard-runbook-a-canary.mjs --confirm-live` 44/44合格。確定CREATEの公開trace shapeも検査 | 実ブラウザ再読込と二端末最終受入 |
| 確定接触feedback・戦術trace | PUBLIC_VERIFIED | `ecafdd1`。選択/poll/reload/replay/重複非発火、2→3累積、4色終局優先、reduced-motion、最終1回読み上げ、CREATE/COLOR/USE_SKILL allowlistを自動検査。Edge 15と公開v21で確認 | 二端末で読みやすさとテンポを体感確認 |
| 経済・進行・見た目canary | VERIFIED | deployment 8でRunbook B 93/93合格 | 実ブラウザで報酬演出と操作感を確認 |
| 野良対戦canary | VERIFIED | status正規化後、C 210/210合格。16 profile、完走、同時finder、取消競合、10同時claim、再検索、秘密非公開を確認 | 実ブラウザで二端末最終受入 |
| CPU canary | PUBLIC_VERIFIED | Runbook D 107/107に加え、クロガネv2新規room、同一action再送、公開情報だけの合法CPU手2回、投了、同CPU再戦を本番で合格 | 実端末でCPU個性と待ち時間の体感を確認 |
| 軽量化・負荷 | VERIFIED | full/delta bytesは1815→991。Realtime購読をroom UPDATE 1本へ限定し、live smoke 2/2でmember受信と第三者0件を確認。Quick pollは5/10秒＋hidden停止 | 公開後のRPC数、p50/p95、エラー率、使用量前後 |
| cleanup preview | PENDING | 関数はローカルのみ。削除・定期化なし | dry-run分類別件数、処理時間。実削除は別承認 |
| cleanup実削除・定期化 | PENDING | 実行権限は付与済みだがpreview件数とcascade先を未確認 | exact ID、影響範囲、復元手段を先に記録してから実行 |
| 別々の二端末による最終受入 | PENDING | 旧公開版の過去証拠だけ | 最新URLで対人/CPU完走、復帰、新試合、全永続化 |

## 2026-09-07 Shift盤面選択公開

- `ad49a41`（main `4b2ea3d`、公開HEAD `ddfb0a7`）で、Half Shift／Triple Shiftの数値入力・selectを廃止し、行・列を選んで盤面の対象帯をtapまたはkeyboardで決め、方向だけを左／右・上／下から選ぶ操作へ統一した。
- Halfは全playable帯、Tripleは外周を理由付きで拒否する。中央を黄色実線、隣接帯を紫破線で示し、取消はwrite-free、確定前は無送信、保存失敗時は同じzero-based payloadとaction IDだけを再送する。
- clean releaseとCI候補は同一tree。ローカルfocused 115/115・skip 0、独立Chrome/Edge各3/3・skip 0、Windows run `34041850645`の両jobとEdge local lifecycleが成功した。
- Pages run `34043472457`でstyle v38、feedback v2、app v39、local bundle v3を公開した。全主要assetはHTTP 200かつ監査SHA-256一致、390pxのhorizontal overflow 0、console error 0、candidate preflight `ok:true`を確認した。frontend/Pages限定で、Edge deployment 22、SQL、migration、RPC、engine bundleは変更していない。

## 2026-09-07 alpha.3カテゴリ制限 公開

- source `d627cd5`は同一seatの連続action-control windowで同じusage categoryを1回に制限する。accepted miss/no-opはカードとinventoryを減らさずcategory枠だけを使い、reject、cancel、persistence failureはstate、RNG、receipt、枠を変えない。alpha.1/2はwindowなし・同カテゴリ連続可を維持する。
- `colorBonusRefill`は+2・上限4だが、通常19枚catalog、6枚loadout、gachaには追加せず、実験貸与または既存fixed CPU loadoutで実際にhandへ入った場合だけ使う。Hard CPUの補充charge 2とshape skill charge 100もhandにあるskillだけへ適用し、category制限を迂回しない。
- `b01c43e`起点のclean release床へ`d3cb130`として適用した。候補59 pathはsourceとblob 59/59同値。起動修正後のLocal bundle SHA-256は`697AA71D8962323025B0D6179D455684C444EB56876711376DED3B497FBB1B74`、Edge bundleは`D6810705473E8761D24BA4871F1A45D407B636B4A88596DD8951536D018897E5`で、二巡再生成後も差分なし。
- source側の非Playwrightは751/751。独立監査はfocused 232/232、Chrome/Edge全browser各77/77・skip 0、カテゴリ専用390pxケース両browser合格、bundle source包含Local 26/26・Edge 10/10、メモリ内再生成byte一致を確認し、P0/P1なし。独立監査時点のP2だったliveカテゴリ使用→同カテゴリrejectは、公開後追補canaryで解消した。物理二端末は`NOT_RUN`のまま受入へ残す。
- 初回Windows候補run `34047107560`はChrome job成功、Edge jobはlocal lifecycle 27件が開始後表示待ちで失敗し15分上限で中止した。原因は`standard-match-start.js`が追加した`standard-cpu.js`をLocal bundle builderへ収載しておらず、ブラウザ起動時に`Unknown module: standard/standard-cpu.js`で停止したこと。builderへ唯一不足していた依存を追加し、全相対JS依存の閉包検査を固定した。あわせてlocal lifecycle 2本が`STANDARD_BROWSER=edge`でもChromeを優先し得た配線を固定allowlistへ修正した。修正後の実Edge/Chrome local lifecycleは各79/79・skip 0、静的契約は33/33・skip 0。修正`549e716`のWindows run `34048695008`はChrome成功、Edgeの既存feedback複数タブ競合が一度だけ失敗した後、同一commitのfailed-job再実行`101529617681`が成功した。
- Edgeの新規engine versionはrequest body由来でなく内部定数からだけ指定する。同じalpha.3対応bundleを保持して新規作成だけalpha.2へ戻す互換rollbackを`codex/standard-alpha3-compat-rollback-20260907@3f4548d`としてGitHubへ保全した。Edge handler、alpha.2作成、alpha.3継続、bundle無差分は63/63・skip 0。active alpha.3 roomが0になる前に旧deployment 22へ単純復帰しない。SQL、migration、RPC、secret変更はない。
- `549e716`をforceなしでmainへfast-forwardし、Pages run `34049734628`を成功させてからEdge deployment 23へ2ファイルを同時反映した。配備ZIPのindexはLF正規化後、bundleはバイト単位で候補と一致。基本7/7、COLOR 105/105、LAB 23/23、実時間90秒/180秒を含むCPU 108/108、Runbook A 44/44、公開preflight `ok:true`、更新前後のactive alpha.3 room 0を確認した。
- 公開後追補では通常CPU roomと通常6枚setupだけを使い、test-only状態注入なしで`disruptRandomOne`をaccepted→同じA WORK窓で`disruptChoiceOne`を送った。Edge 23は`SKILL_CATEGORY_ALREADY_USED_IN_WINDOW`で拒否し、再initialize後もversion、public/private projection、残る選択カードが完全不変だった。privacy allowlist、旧宣言退役、有限CPU進行、投了cleanupを含め263/263合格し、識別子は記録していない。
- 公開390px Edgeは横overflow 0、Enterで対戦tabへ移動、主要asset HTTP 200・SHA一致。ブラウザが要求するsite faviconだけが404だったため、四色の埋め込みSVGを`df56432`で追加し、静的50/50とWindows browser gate `34050740206`を通してPages `34051979716`へ反映した。初回Edgeは製品assertion後のbrowser-close timeout 2件だけで77/79、同一commit再実行`101535815013`は79/79成功。公開再確認はfavicon有効、HTTP 4xx/5xx 0、console warning/error 0。ゲーム・DB・Edge挙動は変更していない。
- 終了処理timeoutの再発防止は`ab3b83a`で公式BrowserServerを所有し、正常closeの20秒timeoutだけ公式`kill()`へ退避、kill失敗は基盤FAIL、製品assertion失敗との同時発生はAggregateErrorで両方保持する。helper unitは4分岐を固定した。初回run `34053352498`は旧`chromium.launch()`／直接`browser.close()`を要求する静的契約2件だけが両jobを停止したため、`23f56af`で`launchServer`／`connect`／helper委譲へ追随。run `34053724009`はChrome/EdgeともCPU契約457/457、実browser 79/79・skip 0、helper 4/4で成功した。今回は通常closeで完走し、timeout→kill fallback発火は0だった。

## 2026-09-07 alpha.4 Edge先行公開

- 製品`90e718b`、証拠追補`98428f8`、最終focus待機修正`f51118d`をclean release床へ統合した。Windows最終run `34060194268`はEdge job `101559227353`、Chrome job `101559227427`が成功。先行run `34059442721`のEdgeだけが`requestAnimationFrame`前にfocusを読む試験競合で失敗し、製品の複数候補非推測契約を変えず、対象focusを明示的に待つ回帰へ修正した。
- Edge公開証跡だけを追補したrun `34061794436`はChrome成功、Edge 79/80で、同じ試験のmacro確定後だけが盤面focusの`requestAnimationFrame`前に即時判定された。製品コードは不変のまま、続くEscapeも正しい`boardKeydown`へ送るため盤面focus成立を待つ契約を追加した。修正後focusedは実Edge 3/3、Chrome 2/2、全teardown成功。失敗runは削除せず最終gateと分離する。
- 配備直前のread-only診断はDB 16,682,131 bytes、接続18/60、active 2、blocked/idle-in-transaction 0、replication slot 2/2 active、最大retained WAL 16,774,904 bytes。Dashboard 24hはCPU 2%、RAM 63%、disk 17%、disk IO 1%、接続peak 20/60、DB 30.5MB、WAL 128MB。既存2件のresource alertは`WATCH_RESOURCE_ALERT`とし、新規悪化や実枯渇を示す指標がないためHOLDにはしなかった。
- `standard_candidate_verify.sql`は72/72 true。`supabase_migrations.schema_migrations`の記録末尾は`202609020006`だったが、後続RPC・trigger・権限を含む実DB契約は全件存在し、本便でSQL、migration、RPC、secret、JWT設定、cleanupを変更していない。履歴表と手動適用実体のずれは運用上の追跡事項として残す。
- Dashboard editorで`index.ts`を全選択・消去して候補1,182行へ置換し、生成済み`standard-engine.bundle.js`も同様に3,803行へ置換した。配備前後に両ファイルの`5.0.0-alpha.4`が各1/1、配備後に変更印消失を確認し、同一操作でEdge deployment 24へ反映した。配備後にDashboardからZIPを読み戻し、SHA-256はindex `526f8d653859f529c5d062aab3e2669b1ba7ad2c7011ca0643beabeaaa71941b`、bundle `4ae11f822d5450e0876ed4c4c205a2912eaeea4fd99042b47a1839d1b36e2841`で候補と完全一致した。
- 旧Pages alpha.3のままphase-less preflightは`ok:true`。基本Edge canary 7/7、COLOR応答canary 225/225が成功し、新規room alpha.4、全段階の公開/private境界、退役宣言write-free、同カテゴリ2枚目拒否write-free、CPU actionの1回進行と有限性、投了cleanupを本番実測した。彩色済み角膨張そのものは通常loadoutに含まれないためlive実測と過大記録せず、生成bundle契約とChrome/Edge実browser CIを根拠にする。
- 互換rollbackは`codex/standard-alpha4-compat-rollback-20260907@4d2f6ff`としてGitHubへ保全した。alpha.4対応bundleを残したまま新規matchだけalpha.3へ戻せる。active alpha.4 roomが存在し得るため、旧deployment 23への単純復帰は行わない。自動・公開ゲート後に残るのは物理二端末受入である。
- ユーザー決定に合わせ、`26a4161`で用途切替・候補一覧・別確定を撤去し、全versionをカード→exact microcell→即発動へ統一した。alpha.4の彩色済みcellは新payload、選択済みoutgoing内の空きcellは旧payload、対象外・重複・prepared中の通常pointerは通信0。prepared形状は次のCREATEまで正本維持し、retryableは同一IDだけ、server nonretryable不成立後は44px zoomを保って別cellを選べる。
- focused非browser 138/138、390pxローカル実Edge/Chrome各6/6、独立再監査P0/P1/P2なし。正式Windows run `34065224136`はChrome/Edgeとも成功し、`26a4161`をforceなしでmainへfast-forwardした。Pages run `34065705946`成功後、公開candidate preflight `ok:true`、app v42/style v40/intents v19、390×844 horizontal overflow 0、console warning/error 0を確認した。frontend/docs/tests限定でEdge deployment 24、DB、migration、RPC、secretは変更していない。

## 2026-09-06 基本効果音・スマホ振動公開

- `4e71ebc`＋`9be6b90`（公開HEAD `767805b`）で、確定接触2–4色、手番到来、勝敗へ短い合成音と対応端末の振動を追加した。音・振動は別々の明示設定で初期OFF、trusted gesture後だけ音声を解禁し、reduced-motionとは独立する。
- 初回独立監査でlocalStorage read-merge-writeの同時タブ競合を20/20再現して公開を止め、Web Locksのorigin-wide exclusive claimへ修正した。同一IDは代表1タブだけ、異IDはlost updateなし。ロック/保存失敗時は重複を許さず演出を抑止し、OFF時は予約音停止と`vibrate(0)`を行う。
- focused 96/96・skip 0、Windows run `34039704692`のChrome job `101504106864`とEdge job `101504106747`が成功し、新feedback試験は各2/2・skip 0。Pages `34040260269`でstyle v37、feedback v2、app v38を公開し、初期OFF、ON保存・再読込、OFF復帰、asset HTTP 200、candidate preflight `ok:true`を確認した。
- frontend/Pages限定便であり、Edge deployment 22、migration tail `202609060003`、SQL、RPC、engine bundle、報酬、在庫は変更していない。物理スマホの音量・振動感は`PENDING`で、自動検証から推定しない。

## 2026-09-06 自動敗北廃止・Lv5難化公開

- `d06f34d`（公開HEAD `df9f01b`）で、alpha.2の`DECLARE_NO_COLOR`を`NO_COLOR_DECLARATION_RETIRED`としてwrite-free退役した。人間は救済を確認してから明示投了、CPUは有効な救済を先に使い、打開不能時だけ既存`SURRENDER`を送る。旧alpha.1 room/replayは従来契約を維持する。
- Lv5は全10テンプレートを52–62秒の多段推論へ更新し、server-authoritative prompt/採点、再送、報酬を維持した。CPU10人の公開理由別敗北台詞も先行公開し、画像は素材台帳とfallbackを備えた独立P1便へ分離した。
- clean releaseのtreeはcandidate CI `34034746623`と一致し、Chrome/Edge両jobが成功。Pages `34035229549`でapp/style v36、client v19、skill-intents v17、CPU commentary v2を公開し、宣言ボタンなし、投了導線、390px横overflow 0、console 0を確認した。
- Dashboardで候補2ファイルを貼付後にclipboardで読み戻し完全一致を確認してEdge deployment 22へ反映した。基本7/7、専用COLOR応答113/113、candidate preflight `ok:true`。宣言退役write-free、CPU 1手進行と有限性、全段階private key非露出、canary room終了を本番確認した。
- migration tailは`202609060003`のまま。SQL、RPC、secret、JWT設定、報酬、在庫、cleanup scheduleは変更していない。物理二端末受入だけを`PENDING`で維持する。

## 2026-09-06 共通COLOR応答窓公開

- `9b7d8f4`で、新規matchをengine `5.0.0-alpha.2`へ上げ、COLOR進入時の自動敗北を共通応答窓へ置換した。人間は通常彩色、COLOR救済スキル、server-authoritative `DECLARE_NO_COLOR`、投了を選べる。CPUは有効な救済を先に使い、残る色スキルを使い切ってから申告する。既存alpha.1 roomとreplayは旧挙動を維持する。
- ローカルは131 test file、962/962合格、fail/cancel/skip 0。local/Edge bundleは再生成前後のSHA不変。rules/privacy、UX/accessibility、repository/releaseの3担当は最終GO、P0/P1なし。
- Windows run `34022065339`はChrome job `101456337426`とEdge job `101456337486`が成功。`origin/main`を`98098d5`から`9b7d8f4`へforceなしでfast-forwardし、Pages run `34022540907`のbuild `101457627136`、report `101457693170`、deploy `101457693195`が成功した。公開HTML/app/styleはHTTP 200、app/style v35、COLOR応答DOM、390×844、console warning/error 0を確認した。
- Pages先行中のEdge deployment 20実CPU戦では、alpha.1/version 6で合法色ありの誤申告を`COLOR_AVAILABLE`として拒否し、公開projection・本人private projection・profileが完全不変、details閉鎖、応答見出しfocus、続く通常彩色が`COLOR_REGION`／version 7／WORKとして成功した。検証roomはversion 8のSURRENDERで終了した。
- Dashboardでは候補`index.ts` 1,171行/SHA-256 `908d84258bec279df5166c60d41d40bd0717ac423e1e574de63b378cc4383d10`とbundle 3,484行/SHA-256 `056236fed7cf9b197c5fc9fc53bc0b3f70b47a6689046f311a8c68cf69af50b1`を貼付後に読み戻し完全一致確認し、単一操作でdeployment 21へ反映した。基本Edge 7/7、専用COLOR 164/164、candidate preflight `ok:true`。新規alpha.2、誤申告write-free、CPU有限進行、全段階のprivate key非露出、canary room終了を確認した。
- migration tailは`202609060003`のまま。SQL、RPC、secret、JWT設定、報酬、在庫、cleanup scheduleは変更していない。T+24観測は後述の`WATCH_PARTIAL`まで完了し、物理二端末受入だけを`PENDING`で維持する。

## 2026-09-06 角膨張・エラー可視化・盤面outline整理公開

- `86ddcc0`で、角膨張を数値入力から盤面の「渡すエリア→基準マス」へ変更し、金/水色の履歴outlineと凡例を撤去した。`10555d8`はasset version契約、`69cd67d`は390pxの長文toast余白を修正した。独立UX監査がその後もsetup/成立済みconnection、複数マス候補、keyboardの盤面復帰というP1を止め、`75791fb`で上部safe-area配置、44px盤面focus、必要数未満だけの緑候補、2マスkeyboard完走回帰まで追加した。
- 影響static/quizは56/56、focused Chrome/Edgeは各2/2。Windows run `34017288334`はChrome job `101443203494`、Edge job `101443203230`とも成功し、online browserは各73件、Edgeの追加lifecycleも成功した。repository/release、rules/privacy、UX/accessibilityの3担当は最終GO、P0/P1なし。
- 先行run `34016075931`は古いasset期待、`34016221487`は3行toastと接続表示の7px交差で失敗した。`34016798886`は成功したが独立UX監査後に候補から外した。失敗とsuperseded gateを削除せず、最終candidateと混同しない。
- `origin/main`を`b8032b5`から`75791fb`へforceなしでfast-forwardし、Pages run `34017695831`のbuild/report/deployが成功。キャッシュ回避付き公開HTML/app/styleはHTTP 200でapp/style v34、client v18、skill-intents v17、CPU commentary v1、盤面focus/candidate/toast marker、履歴凡例不在を返した。candidate preflightは`ok:true`、公開Chromeのwarning/errorは0。
- DB、migration、RPC、engine、生成bundle、Edge deployment 20は変更していない。長いaggregate runnerで再現した既存`standard-v5` contact-pressure tier4のhandover待ちは別のルール課題として保持し、このUI便の成功数へ含めない。
- ルール監査では、COLOR進入時の自動終局が正当な救済スキルを塞ぐP1を確認した。次便は全員共通のCOLOR応答窓（通常彩色／救済スキル／server-authoritative no-color宣言／投了）へ分離し、非公開手札の有無を公開stateへ漏らさない。物理二端末受入とT+24観測は引き続き`PENDING`。

## 2026-09-06 待機相手通知・CPU実況・クイズhitbox公開

- `1eecb0a`で、相手が待っている事実だけを知らせる認証済みavailability RPC、30秒pollと最大300秒backoff、固定quiz hitbox、10人の公開情報限定CPU実況を統合した。本人の募集、対人room、hidden/offline、対戦タブ外の実況再演を除外している。
- Windows run `34013907089`はChrome job `101434303395`、Edge job `101434303579`とも成功。online browserは各71件、CI同一unitは233/233。先行run `34011228302`–`34012625370`で見つかったhover、短画面のscroll余地、接続待機上限、既focus時の暗黙scroll差を製品・試験境界へ分けて修正した。
- migration `202609060003_standard_matchmaking_availability.sql`をEdge変更なしで適用。直後の`--expect=db-ready`は`ok:true`。初回72行検証は、内部JOINの`room.id`を返却列と誤認する検証SQLの偽陽性1件で停止し、返却型へ限定した検査へ修正後は`total_checks=72`、`passed_checks=72`、`all_ok=true`。RPC本体の再変更はない。
- `origin/main`を`d730fa8`から`1eecb0a`へforceなしでfast-forwardし、Pages run `34014339235`が成功。`--expect=candidate`は`ok:true`、公開HTMLはapp v32/client v18/skill-intents v17/CPU commentary v1/style v31を配信している。
- 公開390×844ではbattle下端余白168px、接続表示と下部navの間隔16px、横overflowなし、console warning/error 0。別々の二端末による対人/CPU完走とT+24h観測は実施しておらず、引き続き`PENDING`である。

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

## 2026-09-06 18:12 JST 公開後T+24h観測

- 2026-09-05 18:03:05–09-06 18:03:05 JSTの同一24時間窓でDashboardを確認し、`STANDARD_DASHBOARD_T_PLUS_24_20260906.json`と`STANDARD_OBSERVATION_T_PLUS_24_20260906.json`へ保存した。releaseは公開asset/Pages commit `9b7d8f4`、Pages run `34022540907`、Edge deployment 21、migration tail `202609060003`をrepository HEAD `d5c77ac`と分離した。公開candidate preflightは`ok:true`。
- 観測できたのは37 metric中15件。overviewはCPU 2%、RAM 62%、disk 17%、disk IO 1%、接続peak 20/60、Realtime Postgres Changes 428、Security Advisor errors 0・warnings 22・suggestions 16。Data API、API Gateway、Edge Functions、Performance/Health Advisorの一部はDashboardが値を返さず、22件を`PENDING/null`のまま保存した。
- Query Performanceは累積値として、`realtime.list_changes` 165,607 calls、81.9%、mean 11ms、max 6,379ms。T0差はcalls +96,884、share +2.9 point、mean -8ms、max +2,542msだが、24時間区間性能とは呼ばない。旧直接read形の`fcg_room_members` 6,759 calls、`fcg_rooms` 5,639 callsはT0から増加0。
- 同時点のread-only資源診断はDB 16,403,603 bytes（T0比+1,105,920 bytes）、最大ゲームrelation `public.fcg_standard_profiles` 507,904 bytes、接続total 24・active 2・blocked 0・idle-in-transaction 0・Realtime 7。publicationは`public.fcg_rooms`のみ、slotは2/2 active、inactive 0、最大WAL lag 56 bytes。最大dead tupleは78、保持候補は24時間超room 14件（+3）、その他8分類0。
- 公開preflight成功、Advisor error 0、blocked/idle 0、inactive slot 0、publication変化なしのためHOLD条件はない。一方で資源警告banner継続、`realtime.list_changes`累積負荷、Dashboard欠落22件を残すため判定は`WATCH_PARTIAL`。cleanup、課金、Compute/Disk、Advisor reset、DB/Edge設定は変更していない。物理二端末受入は`NOT_RUN/PENDING/automated:false`を維持する。

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

## 2026-09-06 01:24 JST server-side active-room復帰公開

- 製品commit `5acee05`で、ローカルroom identityを失っても本人の生存Standard roomを読み直せる`fcg_standard_active_room()`を追加した。返却はroom ID、seat、status/version、access/opponent/CPU種別、本人setup revisionの有限8列だけで、authenticated本人・未失効active room・最大2行に制限する。0行、複数行、malformedは状態を変えずfail closedする。
- client/UXは`STANDARD_ALREADY_IN_ROOM`等を有限な`ACTIVE_ROOM_CONFLICT`へ正規化し、private-code、public queue、CPUごとの日本語案内で同じroomへ戻る。private code、raw DB detail、相手private stateは表示しない。明示操作時だけ見出しへfocusし、boot/focus/storage起点では奪わない。CPU start、matchmaking ticket/findのlost-response sagaは汎用復帰より優先する。
- ローカル全Edge browser 56/56、新規復帰シナリオEdge/Chrome各3/3、focused契約94/94が合格。Windows gate `33976873376`はEdge `101335024647`、Chrome `101335024735`が`ffdf8e5`で成功した。後続`8f49fff`と`958a4da`は公開検証器だけの変更で、静的3/3と実動canaryに合格した。
- additive migration `202609060001_standard_active_room_recovery.sql`を本番へ適用し、candidate verification 68/68 true、duplicate active actor 0を確認した。`db-ready` preflightも`ok:true`。secret、billing、削除、cleanup、ゲームルール、報酬、engine bundleは変更していない。
- `standard-game-action` indexをdeployment 16へ更新した。基本Edge canaryは7/7、強化した即時CPU canaryは10/10で、本人のCPU roomだけが1行返り、別actionのCPU開始が`recovered_existing`で同じroomを返し、active roomが1件のままであることを確認した。
- `origin/main`をforceなしで`958a4da`へfast-forwardし、Pages run `33977699993`が成功した。公開candidate preflightは`ok:true`。公開HTML/app/clientはapp v22/client v16、RPC、有限エラー、private/public/CPUの復帰案内markerを返し、実ブラウザは5タブと匿名認証を表示した。
- 物理的に別々の二端末による対人/CPU完走、途中再読込、再戦と、T+24h資源比較は引き続き`NOT_RUN/PENDING`であり、自動検証から推定しない。

## 2026-09-06 03:38 JST 「塗り直し・乱」LAB公開

- 製品commit `ad53bb4`で、private-code human対戦の双方同意時だけ1回ずつ貸与する`legalRecolor` LABを追加した。通常19枚・6枚loadout、CPU、野良、ガチャ、在庫、戦績、報酬は変更せず、debugと排他、固定ruleset、server-only乱数、有限public traceを強制する。
- ローカルは非browser公式110ファイル失敗0、Edge/Chrome online browser各60/60、responsive各4/4、lifecycle 76/76、bundle再生成差分0。独立3担当のレビューで公開ゲート3件とmarker誤検知1件を公開前に修正し、最終P0/P1なし。Windows gate `33984108011`はChrome `101354410490`、Edge `101354410705`が`3fb3ef8`で成功した。
- additive migration `202609060002_standard_setup_revision_guard.sql`を適用し、candidate verification 70/70 true。`fcg_standard_server_load_room_v3`と8引数initializeを保護probeする`db-ready` preflightも`ok:true`。Edge sourceと生成bundleを同時にdeployment 17へ更新した。
- deployment 17の基本Edge canaryは7/7、LAB専用canaryは23/23。双方同意、通常6枚維持、対称1回貸与、作成・着色・server-random合法塗り直し、minimal trace、投了終了、両profileのrevision/state不変を本番で確認した。
- `origin/main`を`bae2182`から`3fb3ef8`へforceなしでfast-forwardし、Pages run `33984536803`が47秒で成功。公開candidate preflightは`ok:true`。公開assetはapp v23/client+intents v17/style v22、匿名ログインと5タブを表示し、captured console warning/errorは0。
- 物理的に別々の二端末による対人/CPU完走、途中再読込、再戦と、T+24h資源比較は引き続き`NOT_RUN/PENDING`。Supabase dashboardには既存resource warningがあり、課金・Compute/Disk・cleanupは変更していない。

## 2026-09-06 05時台 JST 390px盤面ファースト公開

- 製品commit `2a1d2ef`で、対戦開始時の情報順を手番ガイド→盤面→主操作→ランダム結果へ変更し、420px以下だけ密度を調整した。390×844実測で明示開始はガイド202–317px、盤面325–653px、操作661–706px、接続712–756px、下部nav 764–836px。reloadはガイド146–261px、盤面269–597px、操作605–650pxで、横overflowはない。
- 明示開始は`matchTitle`へfocusして一度整列し、boot/reloadはfocusを奪わず一度だけ整列する。pointer/keyboard/clickに加えてpassive wheelを操作revisionへ含め、待機中に利用者が動かした後の強制scrollを抑止する。poll/background/ready/finished、reduced-motionを独立回帰した。
- 独立監査は、途中案で色操作feedbackが固定nav下へ落ちる配置とwheel境界欠落をP1として検出した。ランダム結果を確定操作直後・palette直前へ置き直し、action errorは511–598px、setup errorは658–745pxへ収めた。最終P0/P1なし。
- ローカルはStandard Online browser 60/60、responsive 4/4、関連staticと重点開始/reload/wheel/errorが成功した。正式browser harnessの古い30件固定を全top-level browser testの明示timeout意味検証へ置換し、CI unit列へ収載した。
- Windows gate `33987952352`はChromeがattempt 1で成功。Edge attempt 1は変更外のCPU復帰fixtureで`badge-ready`が15秒を超え59/60となったが、同fixtureをローカルEdgeで3回連続成功後、同一commitのfailed-job attempt 2が6分32秒で成功した。製品assertの再現失敗はない。
- `origin/main`をforceなしで`2a1d2ef`へfast-forwardし、Pages run `33988962006`が46秒で成功。公開HTMLはapp v24/client+intents v17/style v23と新DOM順をHTTP 200で返し、candidate preflightはLAB UI、active-room、v3-load、8引数initializeの保護境界を含め`ok:true`。
- DB migration、Edge deployment 17、RPC、ルール、報酬、在庫、戦績、秘密情報、課金、削除、cleanupは変更していない。物理二端末受入とT+24資源比較は`PENDING`のまま、自動検証から推定しない。

## 2026-09-06 06時台 JST 最新手スポットライト公開

- 製品commit `e811d93`で、厳格な`validPublicTrace`にregionがあるCREATE/COLOR/LEGAL_RECOLORだけを金破線、ACTIVE/COLORの公開pendingだけを水色実線で盤面外周へ表示した。暗色haloとCSS換算3px超を保証し、白い選択・塗り直し枠を最上位に保つ。USE_SKILL、未知region、private state、合法色計算から対象を推測しない。
- 同一matchの相手手番から自分手番へ進んだ新versionだけ、盤面と手番案内を900ms以内で一度beat表示する。初回hydrate、reload、同一version、version rollback、poll/reconnect、background復帰、contact/random演出、terminalでは再演せず、reduced-motionは静止表示。既存turn guideのlive statusへ一本化し二重読み上げを避けた。
- 390×844では凡例をcanvas外30px帯へ置き、WORKはboard 269–567px、凡例571–601px、確定操作609–654px、COLORは色ボタン611–660px、接続712–756px、下部nav764–836px。横overflowなし。凡例非表示の初手は従来の328px盤面を維持する。
- ローカルはStandard Online browser 62/62、responsive 4/4、静的50/50、CI条件のChrome/Edge重点各2/2が成功。独立UX・公開情報監査は、描画順、線幅、二重live、背景抑止、接触競合、非表示tabのcanvas倍率、凡例遮蔽を検出・修正後、最終P0/P1なし。
- 初回Windows run `33992219065`はChrome/Edgeとも61/62で、凡例非表示の初手にも34pxを予約したことによるreload viewport待機timeoutを検出した。`afc89af`で非表示時の予約を解除し、run `33992923690`はChrome/Edgeとも成功した。
- `origin/main`をforceなしで`afc89af`へfast-forwardし、Pages run `33993298423`が成功。公開URLはHTTP 200、app v25/client+intents v17/style v24、金破線・水色実線・board-stage markerを返し、candidate preflightは公開UIと全保護RPCを含め`ok:true`。
- DB migration、Edge deployment 17、RPC、ゲームルール、報酬、在庫、戦績、秘密情報、課金、削除、cleanupは変更していない。物理二端末受入とT+24資源比較は`NOT_RUN/PENDING`のまま、自動検証から推定しない。

## 2026-09-06 08時台 JST 盤面選択アシスト公開

- `645df6e`で任意200% zoom、44px以上のmacro、drag-to-pan/tap分離、矢印＋Space/Enter/Escape、edge-connected候補を追加した。候補線は盤面の接続だけを示し、合法手oracleにはしない。`3380ddb`、`7156578`、`e1e78f6`、`72040b8`で390pxの初手clearance、固定接続表示、zoom非遮蔽、reload時のbrowser scroll restorationを順に修正した。
- UX、rules/privacy、repository/releaseの既存3タスクへ独立監査を再割当した。盤面overlayボタンがmacroを遮る案とmobile gridの3段化を棄却し、最終判定は全てGO、P0/P1なし。公式non-browser 204/204、静的＋quiz 51/51、focus Chrome/Edge各2/2が成功した。
- Windows runs `33996927953`、`33997445395`、`33998002235`は初手可視性、`33999028771`はbrowser依存のrestored scrollを検出した。失敗履歴を保持して修正し、`72040b8`のrun `33999760232`はChrome/Edge各64件すべて成功した。
- `origin/main`をforceなしで`72040b8`へfast-forwardし、Pages run `34000125784`が42秒で成功。公開URLはapp v28/client+intents v17/style v26、turn-guide内zoom、live status外配置、正しいtitleを返した。
- 公開匿名CPU有限受入は、65秒時点で待機継続、111秒時点で明示同意UI、同意前CPU非開始、10人のCPU、6枚setup、合法手とスキル、途中reload、投了、Lv.1券+1、同CPU再戦、PvP/CPU戦績分離、ガチャ券11→13→12、カード22→23、再読込後永続化まで確認した。これは物理的に別々の二端末による対人受入の代替ではない。
- DB migration、Edge deployment 17、RPC、ゲームルール、報酬、在庫、保存形式は変更していない。物理二端末受入とT+24資源比較は`NOT_RUN/PENDING`のまま、自動検証から推定しない。

## 2026-09-06 10時台 JST クイズ明確化・進捗表示公開

- `0cc9c79`で二次方程式を「小さい方の解」と明記し、online quizへACK済み回答だけの「採点済み履歴」、常に未確定と分かる券見込み、3ミス救済理由、上位条件の到達不能表示を追加した。`a4b9917`はWindows checkoutのLF/CRLF差を吸収するgenerator runtime抽出修正と回帰試験を加えた。
- ローカルはtargeted 27/27、CPU/static unit 212/212、Edge browser 65/65、最終quadratic scroll Chrome/Edge各1/1が成功。rules/privacy、UX/accessibility、repository/releaseの3担当は全てGO、P0/P1なし。長いaggregate runnerで見つかった既存contact-pressure tier4期待のずれはこの便へ混ぜず、現行candidate gateの製品assertionは全件成功した。
- 初回Windows run `34003126498`は、fresh checkoutのCRLFによりgenerator runtime testの型宣言除去が失敗した。失敗を保持したままLF/CRLF双方を契約化し、`a4b9917`のrun `34003307900`でChrome job `101405916579`とEdge job `101405916474`がともに成功した。
- Supabase Dashboard editorの初回操作は既存内容へ追記され、deployment 19が`createClient`二重定義のworker boot errorになった。DB writeへ到達する前の起動失敗であり、両ファイルを全選択・消去して候補の正規単一内容へ置換し、deployment 20へ修復した。これは旧版へのrollbackではない。20では基本Edge canary 7/7とRunbook B 234/234が成功し、10問の答え秘匿、各問即時採点、同一回答再送、完全レビュー、報酬一回性を確認した。
- `origin/main`をforceなしで`679897a`から`a4b9917`へfast-forwardし、Pages run `34004028751`が成功。公開HTMLはapp v29/client+intents v17/style v27を返し、実ブラウザで「採点済み履歴」「見込み（未確定）」「3ミス時の救済」、回答後のACK反映、十問後の確定保存を確認した。
- DB migration、RPC、engine bundle生成結果、ゲームルール、報酬tier、在庫、秘密情報、課金、削除、cleanup scheduleは変更していない。物理二端末受入とT+24資源比較は`NOT_RUN/PENDING`のまま、自動検証から推定しない。

## 2026-09-07 23時台 JST Lv3/4強化・Lv5解答時間延長公開

- 製品commit `af1d899`を最新`origin/main@0e78842`へ再構成した`a0eeca7`で、Lv3/4各10テンプレートを複数段計算へ強化した。差の累乗、根号和、階乗比、非1始点sigma、括弧式、ドーナツ面積、微分・積分、共同作業、将来年齢、係数付き二次方程式、条件付き組合せ、等差和、2行列式の積、切り抜き台形、中空円柱、三次微分、二段階待ち行列、遅延追走をserver側で生成する。onlineは行列式積と図形の内側・切り抜きを構造表示する。
- Lv5の問題内容は維持し、全10問の`timeLimitSeconds`を120秒へ延長した。これはユーザーが秒数を指定した決定ではなく、難度監査を踏まえた初期実装値である。Lv1は25/30/35秒、Lv2は32/35/38/40/48秒の既存契約を変更していない。
- ローカルfocusedは23/23、正式契約は482/482、Edge lifecycleは79/79、online browserはEdge/Chrome各83/83でskip 0。正式Windows gate `34130696248`はChrome job `101769837494`、Edge job `101769837137`が成功した。先行run `34130002367`は一時CI branch追加とworkflow不変条件の不一致だけで両jobが失敗し、製品差分ではないことをログで特定した。一時CI commitはmainへ統合していない。
- Supabase Edge deployment 25へ`index.ts`と`standard-engine.bundle.js`を同時配備した。配備後ZIPを読戻し、候補とSHA-256がそれぞれ`A80C7FB6773764DA291E82FC82086DAC497148317E77D6F78EBB8EC7B2833BE1`、`4AE11F822D5450E0876ED4C4C205A2912EAEEA4FD99042B47A1839D1B36E2841`で完全一致した。
- live quiz canaryは匿名profile 1件でLv1–5を各10問開始し、全50問の正解非漏えい、レベル別時間、Lv3/4全問`thinkingSteps >= 2`、Lv5全問120秒・3段階を確認して各sessionを終了した。実生成例はLv3が`7! ÷ 5!`、二つの括弧式、11年後の親子年齢合計、Lv4が三角形切り抜き台形、`det(A)det(B)`、三次式の微分だった。最初の即時終了試行は5秒未満を拒否する既存`QUIZ_TOO_FAST`でHTTP 409となり、5.2秒待機後の正規終了へ修正した。
- `origin/main`をforceなしで`a0eeca7`へfast-forwardし、Pages run `34133326144`が成功。公開HTMLはapp47/style42 markerを返し、`--expect=candidate` preflightはHTTP 200、全UI marker、保護RPCを含め`ok:true`、公開Chromeのconsole warning/errorは0だった。DB、migration、RPC、secret、報酬tier、在庫、戦績、cleanup scheduleは変更していない。物理二端末受入は`NOT_RUN/PENDING`のままである。

## 2026-09-08 ひとふくらみ・本人選択時接触演出の公開復旧

- 製品commit `bf3cb90`を最新mainへ再構成した`844f563`で、`areaMicroBloom`の`source-macros`盤面対象指定、合法なauthoritative送信、候補なし／不正対象の安全な日本語エラーを復旧した。接触演出はrequired-sizeを完成した本人のlocal選択だけに限定し、相手・CPU・公開trace・poll・reloadでは再生しない。
- focused非browserは129/129、実Edge/Chrome各3/3、source engineと生成bundleのdiff 0。Windows run `34137623118`はChrome成功、Edge初回だけ既存feedback競合と角膨張focusのflake 2件を保持し、各ケースのEdge 3連続再試験とfailed job `101796202440`の再実行で最終成功した。一時CI allowlist commit `5f69abe`はmainへ統合していない。
- `origin/main`をforceなしで`844f563`へfast-forwardし、Pages run `34139833503`が成功。公開HTMLはapp48/client21/style42、candidate preflightは`ok:true`。DB、migration、RPC、Edge Function、SQLは変更していない。
- 公開CPU戦で人間UIから「ひとふくらみ」→盤面2マス→「この対象で使う」を送信し、hand 0、preparedOutgoing、`T3 Player A used micro bloom ...`の公開logを確認した。無効候補はカード・手番非消費の日本語案内となった。CPUが作った2色接触traceでは演出0、人間がmacro 66→54→53の3マスを完成すると「二色接触！」が1回だけ表示され、完全reload後は表示・読み上げとも0だった。

## 2026-09-08 Standard最終統合公開

- 最終候補`codex/standard-final-release-20260908@1a6d048204d2c97d19520d5312aebd1230481b7f`は、公開直前の`origin/main@d8343f0984959809b110581a3afebf6b2f69ae32`をancestorとするforce-free fast-forwardであることを再確認した。同候補の正式Standard Browser Gate #95、run `34216209689`はChrome job `102028443273`とEdge job `102028443554`がともにSuccess。成功後だけ`origin/main`を`1a6d048204d2c97d19520d5312aebd1230481b7f`へforceなしでfast-forwardした。
- GitHub Pages #102、run `34217230267`はbuild job `102031750497`、deploy job `102031882937`、report-build-status job `102031882968`がすべてSuccess。github-pages deployment `6325911334`はSHA `1a6d048204d2c97d19520d5312aebd1230481b7f`としてSuccessになった。公開HTMLはonline app `20260908-8`、style `20260908-5`、client `20260907-21`、skill intents `20260907-20`、CPU portraits `20260908-1`、basic feedback `20260908-2`、Local bundle `20260908-2-87f722259e50`を参照し、`live-standard-release-preflight.mjs --expect=candidate`は`ok:true`だった。
- cache-bust付き公開HTTP応答と候補worktreeのバイト列をSHA-256で比較し、次の11 assetがすべてHTTP 200かつ完全一致した。

  | 公開asset | SHA-256 |
  | --- | --- |
  | `standard-online-v5/index.html` | `cc420c7f6b0ab4dae43c4e18d0d2e29671b9fc163390e28dd99f023a3833035c` |
  | `standard-online-v5/style.css` | `3b3085b18b97a3215b376babf46ea68b4c41667fd856c6d8169968b143f1b86a` |
  | `standard-online-v5/standard-online-client.js` | `f087dcf27f895aab8b11fcd8a89326476bfd6807b4041dc6279fc0ad3c29b572` |
  | `standard-online-v5/standard-online-skill-intents.js` | `d5c28a73a6f0b4dbd0676cb076347b8122cceb4d9b7bcefba19915680b54b6cb` |
  | `standard-online-v5/cpu-portraits.js` | `37d0f301a37ce7d4c10e0b9235b6650b2c40af365ad0037c9c07266f38bf49a7` |
  | `standard-online-v5/cpu-commentary.js` | `ea3b6d675f70fbbaf50ba427fe57916c59b5f4d7eb82f783b5cb69001617d898` |
  | `standard-online-v5/basic-feedback.js` | `7ae5e17eb24ff6339573bef32dced39834ab48def5e001f140b043a136771f03` |
  | `standard-online-v5/app.js` | `090fff09b9487a2105f24746c849708c8623985261ef114ec3d2501657e76f62` |
  | `standard-online-v5/standard-skill-registry.generated.js` | `5a9f10f6f5e8afb29c0297f42081eb38a9e8b3885788880ee13b13a1da36202e` |
  | `standard-v5/index.html` | `6504f26e0e8c0f3145df78d1b666a97eeca204cf25e4b8c6494a2dc44dd13373` |
  | `standard-v5/app.bundle.js` | `87f722259e50b407d99ef1bd877f3d13687c1ad82e9a9c2d017cc2d62c40daee` |

- 同じ公開便のSupabase証拠は、読み取り専用DB契約72/72 true、配備後Dashboard source readbackの`standard-game-action/index.ts` SHA-256 `a80c7fb6773764da291e82fc82086dac497148317e77d6f78ebb8ec7b2833be1`、`standard-engine.bundle.js` SHA-256 `6220c7eb72266ae1e3ad2f770429c891192b905b99dd83f9bd491d5113dac673`であり、両方が候補と一致した。JWT検証ON、基本canary 7/7、COLOR専用canary 263/263がSuccess。cleanup後のactive roomは便の前から存在する`playing` alpha.4の1件だけで、検証用roomは残していない。Supabase control planeのEdge deployment ID/versionは未観測であり、Dashboard source readbackとlive canaryから架空の番号を推定しない。DB migration、RPC、secret、cleanup scheduleは変更していない。
- alpha.4互換rollbackの現行保全先は`codex/standard-alpha4-current-compat-rollback-20260908@531adb2e413bee86b05d41f9c557bf7103f22094`。旧`4d2f6ff`は履歴証拠であり、現行候補のrollbackには使わない。active alpha.4 roomが0になる前にalpha.4非対応sourceへ戻さない。

## 公開識別子

| 項目 | 値 |
| --- | --- |
| browser harness diagnostics commit | `844f563` |
| Windows browser CI commit | `844f563`（製品treeはgate head `5f69abe`と一致。一時CI trigger/test commitはmainへ非統合） |
| final browser-verified candidate | `844f563`（Lv3/4複数段化・Lv5全問120秒へ、ひとふくらみ復旧と本人選択時だけの接触演出を累積） |
| Windows browser CI run | `34137623118` / Chrome Success / Edge rerun job `101796202440` Success（初回Edgeの既存flake 2件を保持） |
| 角膨張・エラー表示の累積baseline（履歴） | `75791fb` / Windows `34017288334` / Chrome job `101443203494` Success / Edge job `101443203230` Success / Pages `34017695831` |
| 初回candidate code baseline（履歴） | `0e02176`（Edge deployment 8 sourceは`c3cf372`） |
| applied migrations | `202609030006`–`202609030013`, `202609050001`–`202609050007`, `202609060001`–`202609060003` |
| `standard-game-action` version | deployment 25（2026-09-07 23時台JST、Lv3/4強化・Lv5全問120秒。配備後2ファイルSHA-256一致） |
| Pages Actions run | `34139833503` / Success / `844f563` |
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
| active-room復帰 Windows gate | PASS | 2026-09-06 | `ffdf8e5`、run `33976873376`。Chrome `101335024735`、Edge `101335024647`が成功。private/public/CPU boot復帰、stale create競合、CPU saga優先、390px、focus境界を含む56 browser test |
| active-room復帰 DB・Edge canary | PASS | 2026-09-06 | migration `202609060001`、candidate 68/68。deployment 16で基本Edge 7/7、即時CPU復帰10/10。同一room返却、2室目なし、active row 1を確認 |
| `958a4da` Pages・公開asset | PASS | 2026-09-06 | Pages `33977699993`。app v22/client v16、candidate preflight `ok:true`、RPC・有限エラー・private/public/CPU案内marker、公開5タブ・匿名認証を確認 |
| legal-recolor LAB DB・Edge canary | PASS | 2026-09-06 | migration `202609060002`、candidate 70/70。deployment 17で基本7/7＋LAB 23/23。双方同意、server-random recolor、minimal trace、terminal cleanup、profile不変を確認 |
| legal-recolor LAB Windows gate | PASS | 2026-09-06 | `3fb3ef8`、run `33984108011`。Chrome `101354410490`、Edge `101354410705`が成功。強化したpreflight/verification staticもCI収載 |
| `3fb3ef8` Pages・公開asset | PASS | 2026-09-06 | Pages `33984536803`。app v23/client+intents v17/style v22、candidate preflight `ok:true`、新DB保護probe、LAB複合marker、公開匿名画面、console warning/error 0 |
| 390px盤面導線 Windows gate | PASS | 2026-09-06 | `2a1d2ef`、run `33987952352`。Chrome attempt 1成功。Edge attempt 1の既存badge待機timeout後、failed-job attempt 2成功。同ケースはローカルEdge3連続成功 |
| `2a1d2ef` Pages・公開asset | PASS | 2026-09-06 | Pages `33988962006`。app v24/client+intents v17/style v23、新DOM順をHTTP 200で確認。LAB/active-room/v3-load/8引数initializeを含むcandidate preflight `ok:true` |
| 最新手スポットライト Windows gate | PASS | 2026-09-06 | `afc89af`、run `33992923690`。Windows 2025のChrome/Edge両job成功。公開region境界、同一region二重線、390px、非表示tab、手番beat、background/reload/contact/reduced-motionを含む62 browser test |
| `afc89af` Pages・公開asset | PASS | 2026-09-06 | Pages `33993298423`。app v25/client+intents v17/style v24、金破線・水色実線・board-stage markerをHTTP 200で確認。LAB/active-room/v3-load/8引数initializeを含むcandidate preflight `ok:true` |
| 盤面選択アシスト Windows gate | PASS | 2026-09-06 | `72040b8`、run `33999760232`。Windows 2025のChrome/Edge各64件成功。200% zoom、44px macro、pointer/keyboard、candidate cue、390px非交差、reload整列を検査。先行4 runsの失敗履歴を保持 |
| `72040b8` Pages・公開asset | PASS | 2026-09-06 | Pages `34000125784`。app v28/client+intents v17/style v26、turn-guide内zoom、status role分離、正しいtitleを公開DOMで確認 |
| 公開匿名CPU有限受入 | PASS | 2026-09-06 | 明示CPU同意前の非開始、10人、うっかりユズとの6枚setup・合法CPU手・途中reload・投了終局・精算報酬・同CPU再戦、PvP/CPU戦績分離、ガチャ券とカードの再読込永続化、private palette非漏えいを確認 |
| クイズ明確化 Windows gate | PASS | 2026-09-06 | `a4b9917`、run `34003307900`。Chrome job `101405916579`、Edge job `101405916474`成功。先行`34003126498`のCRLF抽出失敗をLF/CRLF回帰で修正 |
| クイズ明確化 Edge canary | PASS | 2026-09-06 | deployment 19のeditor追記によるboot errorをdeployment 20の正規単一内容で修復。基本7/7、Runbook B 234/234で10問即時採点、再送、完全レビュー、報酬一回性を確認 |
| `a4b9917` Pages・公開asset | PASS | 2026-09-06 | Pages `34004028751`。app v29/client+intents v17/style v27。公開実ブラウザでACK済み履歴、未確定見込み、3ミス救済、十問後の確定保存を確認 |
| Lv3/4強化・Lv5延長 Edge canary | PASS | 2026-09-07 | deployment 25。Lv1–5各10問、正解非漏えい、Lv1/2既存時間、Lv3/4全問2段階以上、Lv5全問120秒・3段階を実測し、配備後2ファイルの候補SHA-256一致を確認 |
| `a0eeca7` Pages・公開asset | PASS | 2026-09-07 | Pages `34133326144`。公開app47/style42、candidate preflight `ok:true`、Chrome console warning/error 0。Windows `34130696248`はChrome/Edge成功 |
| `844f563` ひとふくらみ・本人選択時接触演出 | PASS | 2026-09-08 | Windows `34137623118`、Pages `34139833503`、公開app48/client21/style42、candidate preflight `ok:true`。公開CPU戦でひとふくらみ送信成功、本人「二色接触！」1回、CPU・完全reload 0 |
| `21b58c6` original CPU portrait atlas | PASS | 2026-09-08 | Windows `34142743062`はChrome `101808117594`、Edge `101808117342`成功。Pages `34165800064`。公開app/style/portraits `20260908-1`、client21、candidate preflight `ok:true`。既存CPU戦で`yuzu:normal`、`portraitStatus=ready`、34×34、fallback非表示、console 0。第三者portrait commit群はHOLDのままmain不採用 |
| `345c472` クイズbutton全体の衝突移動 | PASS | 2026-09-08 | Windows `34166855484`はChrome `101879510377` 6分54秒、Edge `101879510182` 9分10秒で成功。Pages `34167465748`。公開app/style `20260908-2`、client21、portraits v1、candidate preflight `ok:true`。公開desktopで6 buttonが各9.1–12.0px移動、bounds内、overlap 0、hover/focus中2.2秒座標不変、回答1回保存、console 0。390px/reduced-motionは正式実browserで確認し、live 390pxとは主張しない |
| `4cefe9f` 基本palette torn snapshot拒否 | PASS | 2026-09-09 | 専用branch `codex/standard-palette-green-release-candidate-20260908`へexact SHAをpush。unit 51/51、focused Chrome/Edge各1/1、Windows run `34354740441`のChrome `102476448386`・Edge `102476448811`が成功。`3e453a2→4cefe9f`をforceなしでmainへfast-forwardし、Pages `34355861649`のbuild/report/deploy成功とcandidate preflight `ok:true`を確認。公開通常CPUで緑・赤がCPU手番、次COLOR、reload後の次COLORまで`基本色・回数無制限`、黄は残1。390×844で横overflow 0、console warning/error 0。synthetic tornはformal gateだけで、公開環境では捏造していない |
| `4508fb4` クイズ選択肢compact巡回 | PASS | 2026-09-10 | 専用branch `codex/quiz-density-release-candidate-20260909`へexact SHAをpush。static/physics 74/74、focused Chrome/Edge各1/1。Windows `34379857918`はChrome成功、Edge attempt 1の既存reduced-motion timing失敗を同一SHAの局所Edge 1/1後にfailed job再実行しattempt 2成功。`6b9133f→4508fb4`をforceなしでmainへfast-forwardし、Pages `34382383719`とcandidate preflight `ok:true`を確認。公開PCは占有率4.7%、5秒で全6個154–228px移動、390pxは占有率18.3%、10秒で全6個172–256px移動・全6個帯入替。両幅でbounds内・overlap 0、390px横overflow 0、中央hit後paused＋全disabled、server ACK後に一回だけ次問へ進行、console warning/error 0。DB、Edge、問題生成、時間、採点、報酬変更なし |
| `4318793` CPU完了報酬の実所持突合 | PASS | 2026-09-10 | 専用branch `codex/reward-persistence-release-20260910`へexact SHAをpush。関連95/95、focused Chrome/Edge各1/1。Windows `34385103929`はChrome成功、Edge attempt 1の既存`badge-ready` timeoutを同一SHAの局所Edge 1/1後にfailed job再実行しattempt 2成功。`3d84294→4318793`をforceなしでmainへfast-forwardし、Pages `34387630198`とcandidate preflight `ok:true`を確認。公開390px通常CPU戦で終局`15→16`、ガチャ`×16`、1枚抽選後とreload後`×15`、獲得カード「色封じ・乱」を確認。overflow 0、console warning/error 0。DB、Edge、RPC、engine、報酬量、ガチャ率変更なし |
| `eac26ed` 持ち色変更の変更元枠→変更先色UI | PASS | 2026-09-10 | 専用branch `codex/palette-change-release-20260910`へ最新main起点で再構成。static/runbook 83/83、対象Chrome/Edge各1/1、既存reduced-motion待機修正後の局所Chrome/Edge各1/1、workflow/harness 11/11。最終Windows `34394919317`はChrome/Edgeとも成功。先行`34390627632`の既存badge/reduced-motion raceと`34393139988`のEdge 15分cancel（81/82、fail 0）は保持し、告知文待機と有限20分枠で修正した。`a4f9bf4→eac26ed`をforceなしでmainへfast-forwardし、Pages `34396124927`、candidate preflight `ok:true`。公開app v14/style v9、390px overflow 0、console warning/error 0。公開プロフィールは当該カード0枚のため本番actionは作らず、送信・取消・重複色・効果後表示は正式browser証拠として分離。DB、Edge、RPC、engine、rule、inventory変更なし |
| `21c1e23` COLOR長文案内撤去 | PASS | 2026-09-10 | 保全済み`ae06452`／`608962e`の同一patchから製品差分だけを最新main起点branch `codex/color-guidance-trim-release-20260910`へ再構成。Local bundle再生成差分0、static/runbook 94/94、対象390px Chrome/Edge各4/4。Windows `34397743592`は初回Edge成功、Chromeの変更外hidden new-match fixtureが`badge-ready` timeout。同一SHAの局所Chrome 1/1後、failed-job attempt 2でChromeも成功。`21b4b57→21c1e23`をforceなしでmainへfast-forwardし、Pages `34400264017`、candidate preflight `ok:true`。公開online/localは長文heading・旧guide 0、通常色・色操作カード・明示投了を保持、390px overflow 0、console warning/error 0。Local bundle v3 hash一致。DB、Edge、RPC、engine、rule、reward変更なし |
| `816f51e` 封印中の元色保持 | PASS | 2026-09-10 | 保全済み差分から製品変更だけを最新main起点branch `codex/sealed-color-release-20260910`へ再構成。static/runbook 83/83、対象Chrome/Edge各1/1。正式browserで未封印→封印後の赤が同一surface／border・opacity 1、全4色の固有値、基本／おまけ／残0、鍵／disabled、stale action 0、skill target不変、keyboard、390px、相手private非漏えいを確認。Windows `34402078335`はChrome/Edge成功。`1b39b69→816f51e`をforceなしでmainへfast-forwardし、Pages `34403138912`、candidate preflight `ok:true`。公開app v14/style v10、390px overflow 0、CSSOMで4色固有変数とsealed opacity 1を確認。実封印対局は作らずbehaviorを正式browser証拠として分離。DB、Edge、RPC、engine、rule、palette projection変更なし |
| `4a8cb28` 0マス時の全開始候補 | PASS | 2026-09-10 | 保全済み差分から製品変更だけを最新main起点branch `codex/all-start-release-20260910`へ再構成。static/runbook 83/83、対象Chrome/Edge各1/1。正式browserで通常5候補／skill 8候補を集合一致、重複・範囲外・選択数・action通信はいずれも0。pointer／keyboard、focus、選択後の接続候補切替、取消、手番外none、390px、最大盤面1280px／1秒未満を確認。Windows `34404697454`はChrome/Edge成功。`efaa185→4a8cb28`をforceなしでmainへfast-forwardし、Pages `34405690053`、candidate preflight `ok:true`。公開app v15/style v10、全候補／自動選択なし案内、390px overflow 0。実CREATE手番は作らずbehaviorを正式browser証拠として分離。DB、Edge、RPC、engine、rule変更なし |
| `3dea0ed` 各セル選択直後の接触演出 | PASS | 2026-09-10 | 保全済み差分から製品変更だけを最新main起点branch `codex/per-cell-contact-release-20260910`へ再構成。static/runbook 84/84、対象Chrome/Edge各1/1。正式browserで1マス目2色→2マス目3色→3マス目4色を即時提示、同数再提示0、閾値低下clear、再上昇一回、pointer／keyboard、reduced-motion、aria-live、390px、action 0、CPU／相手／poll／reload／public trace／skill target発火0を確認。初回Windows `34406783091`は旧完成時-only静的契約2件で両job失敗。製品不変で契約更新し、正式stepローカル505/505後の`34407352376`はChrome/Edge成功。`5fc8a3b→3dea0ed`をforceなしでmainへfast-forwardし、Pages `34408261449`、candidate preflight `ok:true`／`hasPerCellContactFeedback:true`。公開app v16/style v10、演出DOM、390px overflow 0。実CREATE手番は作らずbehaviorを正式browser証拠として分離。DB、Edge、RPC、engine、rule変更なし |
| `d566d62` 初期パレットとprivate変更履歴 | PASS | 2026-09-10 | 最新main `edb3114`起点branch `codex/palette-semantics-release-20260910`へ再構成。関連Node 208/208、生成bundle再生成差分0、対象390px Chrome/Edge各1/1、Windows `34409912079`は両browser成功。Dashboard配備前後ZIPで`index.ts` SHA-256 `a80c7fb6773764da291e82fc82086dac497148317e77d6f78ebb8ec7b2833be1`、engine bundle `c27379921ba8e373bf8baef4377706ef9ecd91442d985d79d10eb0e9600631a4`が候補とbyte完全一致し、JWT verification ON、変更fileはengine bundleだけ。基本Edge 7/7、初期3色distinct・seat別private投影・public key非露出を追加したRunbook A 47/47で`VERIFIED_WITH_DASHBOARD_SOURCE_READBACK`。CLI未導入のためcontrol-plane id/versionはPENDING。`edb3114→d566d62`をforceなしでmainへfast-forwardし、Pages `34412053587`、candidate preflight `ok:true`。公開app v17/style v11、旧対局は「初期値の記録に未対応です」fallback、変更なし履歴、390px overflow 0。新規対局のprivate初期値はlive canary、変更通知・最大12件履歴・reload・一回性は正式browser／unitで証拠分離。DB、migration、RPC、secret、reward変更なし |
| `2cce7af` コスメ残高不足の事前抑止 | PASS | 2026-09-10 | 最新main `b2aa19c`起点branch `codex/cosmetics-affordability-release-20260910`で製品`f26f78a`を作成。client/static 122/122、対象Chrome/Edge各3/3で既存売却、購入・装備・取消・reloadと新しい不足導線を確認。不足590／価格600は`あと10コイン`＋disabledでEnterでもquote 0、保存済みカード売却後590→600をcosmetic projectionへ即時同期して`購入して装備`を有効化した。`INSUFFICIENT_COINS`はprivate messageを捨てた日本語allowlist。Windows `34413975251`はChrome/Edge成功。`b2aa19c→2cce7af`をforceなしでmainへfast-forwardし、Pages `34414800548`、candidate preflight `ok:true`。公開app v18/client v20260910-1、0コインで有料5件が`あと600／900／500／850／350コイン`かつ全disabled、390px overflow 0。公開データに売却や購入は作らず、境界動作は正式browser証拠として分離。DB、Edge、価格、所持判定、receipt変更なし |
| `4bed50f` エリア二分の盤面直接指定 | PASS | 2026-09-10 | 最新main `27d3c5c`起点branch `codex/region-split-direct-release-20260910`で、Online／Localともカード→紫枠の通常macro 1マス→即発動へ変更し、R番号・内部microcell・別確定buttonを撤去。対象外通信0、pointer／Enter／Spaceの二重activation 0、取消／reload write 0、応答不明時の同一action ID再送、旧room互換、server-authoritative/no-oracleを固定した。static 91/91、非browser 506/506、CPU browser 1/1、Chrome local lifecycle 76/76、対象Online Chrome/Edge各1/1。Windows `34420468878`はChrome/Edge成功。`27d3c5c→4bed50f`をforceなしでmainへfast-forwardし、Pages `34421134839`、candidate preflight `ok:true`／`hasRegionSplitDirectTarget:true`。公開app v19、Local bundle v5 SHA-256 `e2eaa264973b6bcedc8a4b4a810395e4072c174617b2047073b11faedd14d960`。公開390pxの保存済みCPU戦で実所有カードを開き、紫枠2マス、盤面focus、別確定0、取消だけ、overflow 0、console warning/error 0を確認。既存対局を変更する本番発動は行わず、正式browserの保存・再送証拠と分離。DB、Edge、RPC、engine、rule、inventory変更なし |
| `3ddac0c` CPU別戦績10人のコンパクト一覧 | PASS | 2026-09-10 | 最新main `efef5a3`起点branch `codex/cpu-records-compact-release-20260910`で、未対戦を含む全10人を常時表示し、既存portrait、名前、勝敗、合計をcompact listへ変更。desktop 5列、761–900px 3列、760px以下2列とし、各recordの`listitem`読み上げ名、長名折返し、interactive descendant 0、閲覧時追加通信0を固定した。static 87/87、対象Chrome/Edge各1/1、clean deployment proof 10/10。Windows `34423102769`はChrome/Edge成功。`efef5a3→3ddac0c`をforceなしでmainへfast-forwardし、Pages `34424023010`、candidate preflight `ok:true`／`hasCompactCpuRecords:true`。公開Chrome 390×844で10人、2列、portrait ready 10/10、保存済み実戦績と0戦を併記、最長名を含むcard／page overflow 0、console warning/error 0を確認。DB、Edge、RPC、戦績集計、対戦通信変更なし |
| `e50044a` CPU封印skillの局面判断 | PASS | 2026-09-10 | 最新main `b79bf29`起点branch `codex/cpu-seal-timing-release-20260910`で、直後の公開応答候補が3色以上なら封印を温存し、2色以下からさらに減らせる時だけ高評価にした。turn 1、対象色／空振り色、random結果のpotential扱い、opponent private noise不変、10人の合法性・決定性、authoritative acceptedを固定。関連99/99、formal self-play＋彩色済み角膨張10/10、実CPU browser 1/1、Edge proof 10/10。Windows `34426581125`は変更外クイズtimingのChrome attempt 1失敗を局所1/1後のfailed-job attempt 2で解消しChrome/Edge成功。Dashboard配備後全文はLF正規化で候補と完全一致し、index SHA-256 `a80c7fb6773764da291e82fc82086dac497148317e77d6f78ebb8ec7b2833be1`、Edge bundle `ffd11ac23830f711a270c7837d0d543b3d4f4462abfa78771e8489eb7fb89b8d`、JWT ON。基本7/7、CPU live 107/107。`b79bf29→e50044a`をforceなしでmainへfast-forwardし、Pages `34428346200`、candidate preflight `ok:true`／`hasCpuSealTimingPolicy:true`、公開Chrome app v20・console warning/error 0。Local bundle v6 SHA-256 `5888f3df390d0a6bba228c52146fdcc22029ea87f05d58345f28c63570b02091`。DB、migration、RPC、rules、報酬変更なし |
| `c36bd18` クイズ全体＋Lv別正答率 | PASS | 2026-09-10 | 製品`a60aee3`、専用branch `codex/quiz-accuracy-release-20260910`。旧成績を推定せずmigration後のserver確定回答だけを`trackedAnswered`／`trackedCorrect`へ累積し、全体＋Lv.1〜5を常時表示。関連143/143、save 7/7、clean proof 10/10、対象browser 1/1、Windows `34432093814`はChrome/Edge成功。migration SHA-256 `bb85eed5a2f3c98fc37b8625a41b7a86df226441ceb86b8d52dd2da5201b82c8`をDashboardで全文一致後に一度だけ適用し、配備後DB契約true。既存Edge bundle `ffd11ac2…9b8d`は不変。全体Runbook Bはaccuracy段階後の変更外売却期待で停止したためPASS扱いせず、focused mode `89b2976`＋cold restore `c36bd18`で本番47/47。`05bf50c→c36bd18`をforceなしでmainへfast-forwardし、Pages `34433653551`、preflight `ok:true`／accuracy true。公開Chrome app v21／progression v2、390×844、6件・2列、card/page overflow 0、注記、console 0。移行後精算前の全6件`—`／`0/0問正解`を正しい表示として確認 |
| `ca97731` 対戦報酬経済 | PUBLISHED_CHROME_LIVE_PENDING | 2026-09-10 | 製品`a937d9a`、専用branch `codex/reward-economy-release-20260910`。PvP敗北Lv1×1／勝利Lv2×1をrolling 60分10報酬試合へ制限し、CPU敗北Lv1×1、勝利をユズLv1×2、標準5人Lv2×1、上級3人Lv2×2、クロガネLv3×2へ段階化。初回Windows `34438198940`はLocal bundleの新dependency欠落を生成物一致gateで検出し、builder・bundle・cache・依存回帰を`ca97731`で修正。重点118/118＋Local 78/78、実Chrome responsive 4/4、CPU報酬導線1/1、再生成SHA不変。Windows `34438667550`はChrome/Edge成功。Edge version 29、id `514ad7d3-b56a-4334-aa70-5a066648bf03`、JWT ON、ezbr `7b22eb2a…8ae1`。CLI post-downloadはindex `a80c7fb6…be1`／bundle `1ed7a11e…ecb6`を候補とbyte完全一致し、基本7/7＋CPU報酬永続化18/18、proof `VERIFIED`。`af6a269→ca97731`をforceなしでmainへfast-forwardし、Pages `34440101131`、candidate preflight `ok:true`／`hasMatchRewardEconomy:true`。公開Chromeの390px実見とconsole確認だけPENDINGのため`PUBLIC_VERIFIED`には未昇格。DB、migration、RPC、secret、課金設定変更なし |
| `4b84e52` CPU台詞／地の文分離 | PUBLISHED_CHROME_LIVE_PENDING | 2026-09-10 | 旧製品`e117677`を`origin/main@901f71e`から専用branch `codex/cpu-dialogue-release-20260910`へ再統合。終局のキャラ台詞と地の文を別DOMにし、公開eventだけを使う。実Chrome全回帰で、人間側の`NO_LEGAL_COLOR`詳細がCPU勝利文で上書きされる回帰を検出し、`NO_LEGAL_COLOR`／`SEALED_OUT`の詳細を優先する条件を追加後、対象static 61/61、終局実Chrome 2/2、CI同一基盤517/517、生成物差分0。検証merge `2317eac`と製品commitはtree `c33d48c421854db754192e05700e217dffa166bd`で一致し、Windows `34443155947`のChrome／Edgeが成功。`901f71e→4b84e52`をforceなしでmainへfast-forwardし、Pages `34443914778`のbuild／report／deploy成功、candidate preflight `ok:true`。online app v23、CPU commentary `20260910-1`。DB、migration、RPC、Edge、rule、reward変更なし。公開Chrome 390px実見とconsole確認だけPENDING |
| `7d69d34` CPU選択前portrait | PUBLISHED_CHROME_LIVE_PENDING | 2026-09-10 | 旧製品`20956d5`を最新main `3d27acc`起点の専用branch `codex/cpu-roster-portrait-release-20260910`へ再統合。CPU選択dialogの10候補へ選択前から通常portraitを表示し、既存の見出しを読み上げ名として画像をdecorativeに保つ。static 92/92、CI同一基盤518/518、対象実Chrome 1/1でportrait ready 10/10・fallback 0、生成物再構築差分0。検証merge `e726b36`と製品commitはtree `9a95e0d5847e4866da3d842da483a29443ce6470`で一致し、Windows `34444981630`のChrome／Edge成功。`3d27acc→7d69d34`をforceなしでmainへfast-forwardし、同一SHAのPages `34445753305`成功、candidate preflight `ok:true`／`hasCpuPortraits:true`／asset generation true。online app v24、style v12。DB、migration、RPC、Edge、engine、rule、reward、対戦通信変更なし。公開Chrome 390px実見とconsole確認だけPENDING |
| 角膨張・エラー表示 Windows gate | PASS | 2026-09-06 | `75791fb`、run `34017288334`。Chrome `101443203494`、Edge `101443203230`が各73件成功。2マスkeyboard、connected cue、setup/成立済みconnectionと3行toastの遷移中/後非交差を検査 |
| `75791fb` Pages・公開asset | PASS | 2026-09-06 | Pages `34017695831`。app/style v34、client v18、intents v17、CPU commentary v1、HTML/app/style HTTP 200、新marker、履歴凡例不在、candidate preflight `ok:true`、公開Chrome warning/error 0。DB/Edge変更なし |
| 二端末最終受入 | NOT_RUN | PENDING | PENDING |

## 残存リスク

- Dashboard T0は17項目を取得したが、Database 24hグラフ等20項目はDashboard取得不能でPARTIAL。資源逼迫alert 2件と7日Compute/CPU peak 99%があるため、負荷由来を切り分けるまで新しい高負荷経路を追加しない。
- profile作成安定化はCの逐次16件で500/429なしを確認した。高並列作成そのものはAuth上限を消費するため再試験せず、再発時はEdge/DBログと資源警告を関連調査する。
- Cのstatus正規化は本番関数定義、既存ticket整合、live canary 210/210まで確認済み。今後もIPあたり30 anonymous sign-ins/時を守り、同じ認証窓で重いcanaryを再試行しない。
- 現行公開製品`7d69d34`は、`ca97731`の保存済み`matchReward`を正本にする報酬経済と`4b84e52`のCPU台詞／地の文分離を維持し、CPU選択前から10人の通常portraitを配信する。公開画面はapp v24／style v12／CPU commentary `20260910-1`／progression CSS v2、Local bundle v8。Edge version 29は既存のCLI control-plane・source byte一致・基本7/7・報酬18/18で`VERIFIED`のまま、Windows `34444981630`、Pages `34445753305`、candidate preflight `ok:true`。再起動後のChrome拡張接続が未復旧のため公開Chrome 390px実見とconsole確認だけPENDINGで、完了済みと混同しない。物理二端末受入、実振動端末の体感確認は別残件である。
- deployment 19はDashboard editorの追記によるworker boot errorで、正規単一内容のdeployment 20へ修復済み。20の基本7/7とRunbook B 234/234後に公開した。失敗履歴は消さず、今後のDashboard編集は全選択・消去後の行数照合を必須とする。
- Edgeのper-isolate濫用抑止は分散レート制限ではない。公開後の計測で必要性が出た場合だけprovider側制限を検討する。
- 10人CPUの合法性・決定性は自動検証済みだが、人間が感じる個性と楽しさは代表3人の実プレイ後も定性的判断として残る。
- cleanup実削除や定期化は許可済みだが、exact IDと復元手段を確認するまで実行しない。課金設定変更は必要性と金額を特定してから扱う。
