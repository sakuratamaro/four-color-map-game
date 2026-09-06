# Standard公開版 段階リリース手順

更新日: 2026-09-07

状態: 現行運用。migration `202609030006`–`202609030013`、`202609050001`–`202609050007`、`202609060001`–`202609060003`、Edge deployment 22、Pages product `4b2ea3d`、証拠・保全台帳を含むmain/Pages `b01c43e`（online app v39、style v38、skill intents v17、local bundle v3）は適用済み。次候補は、同一seatの連続action-control windowで同じusage categoryを1回に制限する`5.0.0-alpha.3`、実験貸与のおまけ色補充、Hard CPUの有限な追加charge、online app v40、skill intents v18、local bundle v4、次Edge deploymentである。旧対局 `5.0.0-alpha.1`/`5.0.0-alpha.2`の互換は維持する。今便はDB変更なしで、下記のalpha.3 Pages先行・互換rollback手順を守る。実行直前にはmain HEAD、Pages run、Edge deployment、migration tailを現物から再取得する。

実行中の状態、数値、識別子、失敗は `docs/STANDARD_RELEASE_EVIDENCE.md` に追記する。根拠のない項目を`VERIFIED`や`PASS`へ変更しない。

## 完了の定義

migrationやコードの配置だけでは完了にしない。最新の公開URLと別々の二端末で、合言葉対戦と野良対戦を最後まで行い、再読込、再戦、新しい試合を確認する。さらに実時間90秒待機後に明示同意したCPU戦を完走し、報酬、ガチャ、カード、対人/CPU別戦績、トロフィー、見た目が再読込後も保持されること、private情報が漏れないこと、軽量化の呼出数とbytesを実測して初めて公開完了とする。

現行版では、これにprivate-code human双方同意のLAB一局を加える。通常6枚とは別の「塗り直し・乱」が各1回だけ貸与され、片側再読込後も使用回数が増殖せず、LAB前後で戦績・券・在庫・履歴が変わらないことを物理二端末で確認する。自動canary 23/23はAPI契約の証拠であり、物理端末の操作感を代替しない。

## 現行版の物理二端末10分実行カード

PC＋スマートフォンまたはPC 2台を使い、同一ブラウザーの2タブでは代用しない。合言葉やuser IDは証拠へ残さない。

1. 両端末で通常URLを強制再読込し、オンライン表示と5タブを確認する。別名profileを用意し、対人/CPU戦績、Lv.1券、所持カード数を開始前に記録する。
2. 通常の合言葉対戦をLAB/debug OFFで開始する。色2・エリア2・妨害2の6枚を双方が確定し、A/Bそれぞれの作成・彩色で「あなたが作る／あなたが塗る」が反転することを確認する。
3. 手番途中に片側だけ再読込し、同じroom・盤面・手番へ戻り、actionが二重反映されないことを確認する。投了後は両端末の勝敗一致、双方の再戦同意、6枚再選択、次局開始を確認する。
4. 即時CPUを1人選び、1往復後に再読込して同じCPU・盤面へ戻る。終局後のCPU戦績、Lv.1券、ガチャ1枚、所持数、同CPU再戦の6枚再選択を確認する。公開matchmakingの90秒/180秒CPU提案は別の実時間項目として省略しない。
5. 新しい合言葉roomで双方LAB ON・debug OFFにし、各1回の貸与を確認する。通常手の後に塗り直し、片側再読込、投了まで行い、使用回数が復活せず、LAB分の戦績・券・在庫・履歴が増えないことを確認する。
6. 両端末を再度強制再読込し、通常対人/CPUの戦績・券・ガチャ獲得カードだけが永続化され、相手の所持カード本文や非公開戦績が見えないことを確認する。

別roomへの移動、A/Bの手番・勝敗不一致、盤面消失、action/報酬の二重反映、LABの複数回使用やprogression混入、private情報表示は一件でも即FAILとする。端末A/B、各開始・終了時刻、対人/CPU/LABの開始・終局、途中再読込、再戦、前後の件数だけを記録する。

## 変更前の読取り確認

1. `node scripts/run-standard-product-tests.mjs` でroot直下の正式製品試験が全件合格することを確認する。引数なしの `node --test` は入れ子の旧Expo/Jest試作まで探索するため使用しない。
2. 対象Supabase project refが `qkcuhludisairpgzhryl` であることを画面上で再確認する。
3. Git作業ツリーがcleanで、公開候補commitが記録済みであることを確認する。
4. 現行Pages commit、現行 `standard-game-action` version、適用済み関数を記録する。
5. Security Advisor、Performance Advisor、API/Database/Edge使用量の変更前snapshotを保存する。
6. 今便はDB変更なし。migration tail `202609060003`、Edge deployment 22、公開product `4b2ea3d`、main/Pages `b01c43e`の現況を確認し、候補CI後と各公開段階で`node scripts/live-standard-release-preflight.mjs --expect=candidate`を使う。過去便の`baseline`／`db-ready`は再利用せず、公開assetとEdge versionを別々に記録する。

確認結果が想定と違う場合は適用を止め、現物に合わせて手順を更新する。

Dashboardのbaselineを取得できない場合は理由を証拠台帳へ`BLOCKED`として残し、取得できるようになるまでmigration適用へ進まない。

公開後の低負荷観測に使うT0も、Dashboardの「直近24時間」を秘密情報なしの入力JSONへ転記して次で取得する。入力は64 KiB以下、top-levelは`capturedAt`、`window`、`release`、`metrics`だけとし、token、service role key、Authorization、接続文字列、user/room/action ID、メールアドレスを含めない。スクリプト自身はsign-inも書込みもせず、既存の公開`candidate` preflightを呼び、正規化JSON 1件だけをstdoutへ出す。

`node scripts/capture-standard-release-observation.mjs --label=T0 --input=standard-dashboard-t0.json > standard-observation-t0.json`

現行公開候補の初回実測は`docs/STANDARD_DASHBOARD_T0_20260905.json`と正規化済み`docs/STANDARD_OBSERVATION_T0_20260905.json`に保存する。後者が`PARTIAL`の場合は、欠落値を推測で埋めず`pendingPaths`をT+24hでも再取得する。

Storage/CPU警報の原因切り分けには`supabase/verification/standard_resource_diagnostic.sql`をSQL Editorへ完全置換して実行する。このSQLは単一の`WITH ... SELECT`だけで、行ID、ユーザーID、SQL本文、secretを返さず、publication、replication slot別WAL lag、relation size、dead tuple概算、接続集計、保持境界超過件数だけを返す。slot別lagの合計は同じWAL区間を重複計上し得るため実ディスク量とみなさず、最大値をT+24hの同条件snapshotと比較する。単発値だけでslot追従、CPU原因、Storage alert解消を断定しない。

入力の観測値は、たとえば`metrics["database.cpu_pct"] = { "state": "OBSERVED", "value": 0, "source": "dashboard.database" }`とする。固定metric名・単位・集計方法・許可sourceはスクリプト内のallowlistを正本とし、値を取れないmetricは入力から省略してよい。Query Performanceは24時間filterではなく`pg_stat_statements`のreset以降の累積なので、`query.*`は専用の`pg_stat_statements_cumulative*`集計とwarningで区別する。AdvisorはSecurity/Performanceのerror・warning・suggestionを別metricにし、severityを合算しない。

`release.repositoryHead`、`release.publicAssetCommit`、`release.pagesCommit`、`release.pagesRun`は別の識別子である。repository HEADを公開済みとみなさず、未取得の観測metricやEdge deploymentは`0`に置換せず`PENDING` / `null`のまま残す。観測値`0`は有効な`OBSERVED`として保持する。

## DB適用順序

SQL Editorでは内容を全置換し、次を1ファイルずつ順番に実行する。複数migrationを一度に貼らない。

1. `202609030006_standard_online_card_sale.sql`
2. `202609030007_standard_public_matchmaking.sql`
3. `202609030008_standard_cpu_opponents.sql`
4. `202609030009_standard_cpu_rematch.sql`
5. `202609030010_standard_online_cosmetics.sql`
6. `202609030011_standard_member_appearance.sql`
7. `202609030012_batched_cleanup.sql`
8. `202609030013_standard_snapshot_profile_delta.sql`
9. `202609050001_standard_matchmaking_status_contract.sql`
10. `202609050002_standard_immediate_cpu.sql`
11. `202609050003_standard_debug_room_access.sql`
12. `202609050004_standard_quiz_answer_feedback.sql`
13. `202609050005_standard_kurogane_lookahead.sql`
14. `202609050006_standard_single_active_room.sql`
15. `202609050007_standard_pregame_abandon.sql`
16. `202609060001_standard_active_room_recovery.sql`
17. `202609060002_standard_setup_revision_guard.sql`
18. `202609060003_standard_matchmaking_availability.sql`

各実行直後に、そのmigrationが追加する表、関数、列、ACLを `to_regclass`、`to_regprocedure`、`information_schema.columns`、`proacl` で確認する。`SECURITY DEFINER` 関数は空の `search_path`、ブラウザー用RPCは `authenticated` のみ、サーバー用RPCは `service_role` のみであることを確認してから次へ進む。

`202609050006` の適用直前に、`standard_candidate_verify.sql` の `duplicate_active_actor_state` と同じ読み取りクエリを実行し、同一actorが所属する有効なStandard roomの重複件数が0であることを必須preflightとして記録する。0でなければ `202609050006` を適用せず、既存roomを自動削除・終了せずに個別調査する。

18本すべての適用後、`supabase/verification/standard_candidate_verify.sql` をSQL Editorで実行する。現行SQLは72行を返し、読み取りだけで非公開テーブル、追加列、重要関数、RLS/ACL、制約、トリガー、索引、appearance backfill、クイズ回答、クロガネpolicy、開始前取りやめ、active-room復帰、v3 room load、8引数initialize、待機相手availability、同一actorの有効Standard room重複を検査する。`single active Standard room per actor preflight` の `duplicate_actor_count` は引き続き必ず0でなければならない。既存重複は自動削除せず、0でない場合はEdge/Pages適用を止めて個別調査する。全72行の `ok` が `true` でなければEdge/Pages更新へ進まない。

`202609030012` の適用時にはcleanupを実行しない。定期実行も作らない。`202609030013` の既存プロフィールappearance backfill件数と所要時間を記録し、失敗または長時間ロックならEdge/Pagesへ進まない。

## EdgeとPagesの順序

### alpha.3カテゴリ制限便

この便は `Pages app v40/intents v18/local bundle v4 → Edge deployment 22上の互換smoke → alpha.3対応Edge → 専用canary` の順にする。新Pagesは`skillCategoryWindow`欠落を旧対局として扱うためalpha.1/2 Edgeと互換である。新Edgeを先にして旧cacheのUIへalpha.3対局を渡す時間を作らない。

1. `b01c43e`起点のclean release床へ候補だけを適用し、両builderを2回実行して2回目差分ゼロ、全非browser製品試験、Windows Chrome/Edge CI、対象実browser testのskip 0を確認する。SQL、migration、secret、CPU肖像が差分へ混ざっていないことも確認する。
2. alpha.3対応bundleを保持したまま新規対局だけをalpha.2へ戻せる互換rollbackを事前作成する。保全済みbranchは`codex/standard-alpha3-compat-rollback-20260907`、commitは`3f4548d`。候補の`NEW_STANDARD_MATCH_ENGINE_VERSION`だけを`5.0.0-alpha.2`へ変え、request bodyから変更できないこと、alpha.2新規stateにwindowがないこと、既存alpha.3 stateを読んで継続できることを63/63・skip 0で確認済み。deploy直前にmain候補との親子関係と2ファイル差分を再確認する。
3. deploy直前にmain/Pages `b01c43e`、product `4b2ea3d`、Edge deployment 22、migration tail `202609060003`を現物で再確認する。activeなalpha.3 room数をread-onlyで記録し、room IDやuser IDは証拠へ残さない。
4. mainを候補へforceなしでfast-forwardしPagesを先行公開する。公開HTMLでonline app v40、skill intents v18、local bundle v4、HTTP 200、候補SHA、390px横overflowなし、keyboard操作、console warning/error 0を確認する。
5. Edge deployment 22のまま新Pagesで通常対局をsmokeし、旧alpha.2 roomでカテゴリ表示が誤って出ず、通常操作が継続できることを確認する。
6. `index.ts`と再生成済み`standard-engine.bundle.js`を追記せず全置換し、同じEdge deploymentへ同時反映する。反映後は両ファイルを読み戻して候補とバイト同値確認する。SQL、migration、secret、cleanupは変更しない。
7. 基本Edge canary、更新済み`live-standard-color-response-canary.mjs --confirm-live`、LAB canary、CPU有限進行を実行する。新roomの`5.0.0-alpha.3`、公開windowのactor/category有限性、private非漏えい、alpha.1/2継続、category rejectのwrite-free、別category許可、handoff reset、replay非二重消費を自動試験とlive実測に分けて記録する。公開APIへtest-only状態注入は追加しない。有限保証できないall-three no-opのlive実測は`NOT_RUN`とし、server bundleの決定的試験とactual browser mockを根拠にする。
8. Edge公開後のactive alpha.3 room数と公開preflightを再取得する。カテゴリ使用済み表示、同category button無効化、別category利用可、accepted no-op案内とcard/profile/inventory不変、Localの補充+2・上限4、通常19枚/6枚/gachaへの補充カード非混入を確認する。物理二端末は自動結果からPASS推定しない。

Pages先行段階の失敗はPagesを`b01c43e`相当へ戻し、Edge deployment 22は変更しない。Edge公開後の失敗は、まず事前保全した互換rollbackをdeployして新規alpha.3作成を停止し、既存alpha.3 roomを読めることを確認する。その後Pagesを`b01c43e`相当へ戻す。active alpha.3 roomが0になる前にEdge deployment 22へ単純復帰しない。DB rollback、DROP、migration逆適用は行わない。

### 完了履歴: 合法色なし宣言廃止便のPages先行例外

この便は `Pages v36 → Edge deployment 22（実際の次成功versionを記録）→ 専用COLOR canary` の順にする。Pages v36は`DECLARE_NO_COLOR`を送らず、救済カード導線と明示的な`SURRENDER`だけを使うため、現行Edge deployment 21とも互換である。反対に新Edgeを先にすると、キャッシュに残るPages v35が旧宣言を送り、`NO_COLOR_DECLARATION_RETIRED`を扱えない非対称が生じる。

1. 公開候補commitで両builderを実行し生成物差分がゼロ、全製品試験、Windows Chrome/Edge CIが成功していることを確認する。
2. mainをfast-forwardし、online app/style v36とCPU commentary v2をPagesへ先行公開する。公開commit/run、HTTP 200、asset version、console warning/errorを記録する。
3. Edge deployment 21のまま実対局でCOLOR応答UIを開く。宣言ボタンがなく、救済カード導線と明示的な投了が動作し、version、profile、handが一度だけ更新されることを確認する。
4. `index.ts`と再生成済み`standard-engine.bundle.js`を追記せず全置換し、同じEdge deploymentへ同時反映する。次の成功versionは22を期待するが、失敗saveが番号を消費した場合は実際の成功versionと失敗履歴を記録する。
5. 基本Edge canaryに加えて`node scripts/live-standard-color-response-canary.mjs --confirm-live`を実行する。このlive canaryでは、新roomが`5.0.0-alpha.2`、旧宣言が`NO_COLOR_DECLARATION_RETIRED`でwrite-free拒否されること、CPUが有限手で進むこと、public snapshotに`hand`、`loadout`、palette、救済所持情報がないこと、canary roomの終了を確認する。旧`5.0.0-alpha.1`の継続、救済カード後の彩色、blocked COLORからの明示的`SURRENDER`と同一action再送はengine/unit/browser gateで別に確認し、live canaryの実測結果として過大記録しない。
6. `node scripts/live-standard-release-preflight.mjs --expect=candidate`と通常URLの新しいブラウザーで最終確認する。

失敗時はEdgeをdeployment 21へ先に戻す。Pages v36はdeployment 21と互換なので残せる。Pagesもv35へ戻す場合は、必ずEdge 21復旧後に行う。

### 通常のDB・Edge・Pages変更

1. DB 18本とcandidate verification 72/72を確認する。
2. Pagesを更新する前に `node scripts/live-standard-release-preflight.mjs --expect=db-ready` を実行する。v3 room load、8引数initialize、availability RPCが`protected`で、待機相手UIが未反映ならfalseであることを確認する。
3. JWT検証が有効なこと、managed service-role secretの参照だけで値を表示していないことを確認する。
4. Edge変更がある場合は`index.ts`と生成済み`standard-engine.bundle.js`を同じdeploymentへ反映し、双方を候補とバイト同値確認する。片方だけを更新しない。
5. `node scripts/live-standard-edge-canary.mjs --confirm-live`と、LAB変更時は`node scripts/live-standard-legal-recolor-lab-canary.mjs --confirm-live`を実行する。後者はterminal cleanupと両profile不変まで合格させる。必要な機能専用canaryだけを追加し、同じ認証窓で重い全canaryを無目的に再実行しない。
6. Edgeが正常なまま、StandardオンラインPagesを公開する。
7. Pagesの公開commitとrun成功を確認し、`node scripts/live-standard-release-preflight.mjs --expect=candidate` とキャッシュをまたぐ通常URLの新しいブラウザーで確認する。availability RPCと待機相手UIがともに有効、公開asset version、匿名接続、console warning/errorも記録する。

新クライアントは `fcg_standard_room_snapshot_v2(uuid,bigint)` を必須とするため、PagesをDBより先に公開しない。

## 段階canary

### A. 合言葉対戦

- 二端末A/Bで作成、参加、6枚選択、初期化、通常手、スキル、終局、両者再読込、再戦を確認する。
- CREATE/COLORの交代ごとに、両端末の役割表示が自分視点の「あなたが作る／あなたが塗る」へ正しく反転することを確認する。
- 片側だけデバッグ対戦を選ぶとsetupエラーが操作直下に残り、両側で一致させた場合だけ開始できることを確認する。応答が不明なときは新しい操作を作らず同じactionを再送する。
- 封印された色が彩色前から鍵付き・選択不可で、再読込後も維持され、封印されていない色は使用できることを確認する。
- 持ち色変更の説明と実動作が「基本色2枠は無制限、おまけ色は残り回数を新しい色へ引き継ぐ」と一致することを一例確認する。
- 第三者Cのsnapshotと直接table更新が拒否されることを確認する。
- snapshot v2の同revision応答で `profile=null`、profile revision更新時だけ本文が返ることを確認する。

### B. 経済・進行・見た目

- クイズ10問の報酬が一度だけ、ガチャの券消費/付与が一度だけ保存される。
- ガチャ結果確認不能時は新しい1枚／全枚抽選が無効になり、reload後も保存済みの同じaction IDだけを「同じ抽選を再確認」で再送する。成功後は名前・レアリティ・効果を読み上げ可能な有限要約と一覧で確認できる。
- 各問は回答確定前に正解を公開せず、`quiz-answer`直後に正誤と正解を表示し、同じ回答actionの再送は同じ結果を返す。二重回答は進行を増やさない。
- 10問終了後の答え合わせに、問題、自分の回答、正解、解説が10件あり、再読込後も報酬が二重付与されないことを確認する。旧一括`quiz-finish`経路の互換性も有限canaryで残す。
- カード売却の通常/要確認/取消/応答不明再送/対戦中ロックを確認する。
- 見た目の有料購入/無料装備/取消/同一ID再送/別端末復元を確認する。
- 相手に名札と称号だけが見え、相手のプロフィール本文、所持カード、非公開戦績が含まれないことを確認する。

### C. 野良対戦

- Aが「対戦相手を募集」、Bが「今入れる試合を探す」で1室だけ成立し、画面にも応答にも合言葉が出ない。
- Aが募集待機中にクイズ回答とガチャをそれぞれ開始し、成立時に同じ回答／抽選actionが一度だけ確定してからsetupへ移ることを確認する。正誤表示を飛ばさず、次問時計を開始せず、手動Battleタブで待機境界を迂回できないことも確認する。
- 対戦中は途中クイズの残り時間が減らず、終了・退出・missing room後もQuizタブを明示的に開くまで裏で回答を送らない。合言葉、CPU、終了済みpublic、stale roomのreloadでは通常のクイズへ復帰する。
- 取消と検索の競合、2人同時検索、10件同時確保で二重ticket/seat/roomがない。
- 二端末で1試合を完走し、再読込と新しい野良対戦を確認する。

### D. CPU

- 実時間90秒まではCPU承諾がサーバーで拒否され、自動開始しない。
- 90秒案内を一度見送り、180秒で再案内される。
- 10人の一覧、得意、苦手、お気に入り、固定名が表示される。
- 人間参加とCPU承諾を同時に行い、必ず一方だけが成立する。
- 代表3人で開始、合法なCPU手、終局、CPU別戦績、再読込、同じCPUとの再戦を確認する。CPU表示は常時残す。
- CPU戦の精算済み結果だけに「完了報酬：Lv.1ガチャ券 +1」が表示され、再読込後も券が保持されることを確認する。未精算CPU戦と対人戦へは表示しない。
- 保存済み通常CPU報酬から明示的にLv.1ガチャを実行した時だけ、結果後に同じCPUとの6枚再選択CTAが出る。結果reload後も同一room/version/matchだけ復元し、二重操作はCPU再戦1回、獲得カードは所持数へ反映するが自動選択しない。対人、debug、独立ガチャではCTAを出さない。
- 新規クロガネroomは`standard-character-roster-v1:kurogane-lookahead-v2`で最低2手の合法手を行う。旧v1 roomは進行を維持し、成功した再戦だけv2へ更新する。
- deployをまたぐ開始action再送は、全入力が同一でpolicyだけが旧v1のfingerprintと一致する場合だけ回復し、characterやloadoutの変更は拒否する。

## 軽量化・負荷の合格条件

- `scripts/live-standard-room-snapshot-smoke.mjs --confirm-live` で完全snapshotより同revision差分snapshotのbytesが小さい。
- Realtime正常時は重複通知がsingle-flightへまとまり、playing中の救済pollは15秒間隔で1 RPC、hidden/offline中は停止する。
- 旧4 SELECT方式に戻っていない。30分2人対戦の救済通信見込みは5,760 SELECTから240 RPCで、実測値には操作起因の通知分を別記する。
- 正常な最速CPU進行と二端末操作がEdgeの濫用抑止に触れず、明示的な過剰canaryだけが429になる。
- DB/Edgeのp50、p95、エラー率、Database/Edge/Realtime使用量を変更前後で記録し、悪化時は公開範囲を広げない。

T+24hはT0の正規化JSONをbaselineとして必須指定し、同じ「直近24時間」Dashboard入力を比較する。T0は`2026-09-05 16:23 JST`なので、T+24観測は`2026-09-06 16:23 JST`以降にだけ完了扱いできる。

`node scripts/capture-standard-release-observation.mjs --label=T+24h --input=docs/STANDARD_DASHBOARD_T_PLUS_24_20260906.json --baseline=docs/STANDARD_OBSERVATION_T0_20260905.json > docs/STANDARD_OBSERVATION_T_PLUS_24_20260906.json`

2026-09-06のT+24入力は`publicAssetCommit=9b7d8f4`、`pagesCommit=9b7d8f4`、`pagesRun=34022540907`、`edgeDeployment=21`、`migrationTail=202609060003`として実測済み。repository HEAD `d5c77ac`とは分離して記録する。次回観測でも公開asset、Pages commit/run、Edge、migration tailをその時点で別々に再取得し、古い組を流用しない。Dashboardの全画面を同じ`Last 24 hours`にし、実表示のwindow from/toを転記する。固定37 metricすべてを再取得し、取れない値は推測せず省略して`PENDING`にする。Query Performanceは累積値であり24時間区間値と呼ばない。`calls`がT0より小さい場合は改善ではなくreset/statement identity変化として比較無効にする。

同じ時点で`supabase/verification/standard_resource_diagnostic.sql`をread-onlyで再実行し、DB bytes、publication集合、slot数/active/max WAL lag、接続、relation/dead tuple、保持候補をT0と比較する。relationは順位ではなくschema+relationで対応付け、slot別lag合計を実ディスク量とみなさない。新規health alert、Advisor error、blocked/idle-in-transaction、inactive slot、publication変化、429/5xx、接続上限接近、明確なp95/error/使用量悪化は`HOLD/INVESTIGATE`。既存alertや単発増加だけなら`WATCH`とし、cleanup・課金・Compute/Disk変更へ直結させない。

T0から24時間未満で実行した場合は`CAPTURE_INTERVAL_UNDER_24_HOURS` warningを残し、24時間観測を完了扱いにしない。windowが24時間から1分超ずれた場合も無効とする。固定allowlist外のmetric、未知top-level、秘密キー/秘密らしい値、64 KiB超の入力は拒否され、拒否時に公開preflightは起動しない。欠落metricと比較不能値は`PENDING` / `null`のままにする。この自動観測は物理二端末を操作できないため、出力の`physicalTwoDeviceAcceptance`は常に`executionState: NOT_RUN`、`gateState: PENDING`、`automated:false`であり、段階canary A–Dの人間確認をPASSへ変更しない。

## cleanupの承認ゲート

初期候補は、room 24時間、ticket/quiz 7日、profile-scoped receipt 30日の保持とする。まず `p_dry_run=true`、`p_batch_size=100` で分類別件数だけ確認する。実削除は対象件数、cascade先、復元不能であることを別途説明して承認を得た後に1バッチだけ行い、処理時間と残数を再確認する。定期化はさらに別の承認とする。

## 失敗時

- DBは追加的migrationのため、その場で表や列をDROPしない。
- `202609060003`適用後にPagesを戻す場合も、旧クライアントから未使用のavailability関数と索引は保持し、緊急時にDROPしない。Edgeはこの便で変更しない。
- alpha.3便のEdge失敗時は事前保全した互換rollbackを先にdeployし、新規alpha.3作成を停止する。既存alpha.3 roomを読めることとactive件数を確認し、0になる前にEdge deployment 22へ単純復帰しない。
- 合法色なし宣言廃止便のEdge canary失敗時はEdgeをdeployment 21へ先に戻し、互換性のあるPages v36は残す。Pagesもv35へ戻す場合はEdge 21復旧後に行う。
- Pages canary失敗時は既知の公開commitへ戻し、追加DBは未使用のまま残す。
- 二重精算、private漏えい、相手の誤表示、ルーム二重成立が1件でもあれば野良/CPU導線を公開しない。
- 復旧後も、失敗内容、影響範囲、確認済みデータ、未確認事項を記録する。

## 証拠として残すもの

- 公開commit、Pages run、Edge version、適用migration一覧。
- A/B/Cの有限なpass/fail結果。token、service key、個人情報は残さない。
- 対人/CPUの開始・終局version、再読込、再戦、新試合、進行/見た目revision。
- snapshot完全/差分bytes、API呼出数、p50/p95、エラー率、使用量画面の変更前後。
- T0/T+24hの正規化観測JSON。repository HEAD、公開asset commit、Pages commit/runを別々に記録し、未取得値と24時間未満warningを削除しない。
- cleanupはpreview結果だけ。実削除を承認・実行した場合のみ件数と保持境界。
