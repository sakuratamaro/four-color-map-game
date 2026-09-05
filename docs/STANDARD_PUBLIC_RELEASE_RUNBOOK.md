# Standard公開版 段階リリース手順

更新日: 2026-09-05

状態: 現行運用。migration `202609030006`–`202609030013`と`202609050001`–`202609050005`、対応Edge、Pagesは適用済み。新しい変更もDB→Edge→Pagesの順序と有限なcanaryを守る。

実行中の状態、数値、識別子、失敗は `docs/STANDARD_RELEASE_EVIDENCE.md` に追記する。根拠のない項目を`VERIFIED`や`PASS`へ変更しない。

## 完了の定義

migrationやコードの配置だけでは完了にしない。最新の公開URLと別々の二端末で、合言葉対戦と野良対戦を最後まで行い、再読込、再戦、新しい試合を確認する。さらに実時間90秒待機後に明示同意したCPU戦を完走し、報酬、ガチャ、カード、対人/CPU別戦績、トロフィー、見た目が再読込後も保持されること、private情報が漏れないこと、軽量化の呼出数とbytesを実測して初めて公開完了とする。

## 変更前の読取り確認

1. `node scripts/run-standard-product-tests.mjs` でroot直下の正式製品試験が全件合格することを確認する。引数なしの `node --test` は入れ子の旧Expo/Jest試作まで探索するため使用しない。
2. 対象Supabase project refが `qkcuhludisairpgzhryl` であることを画面上で再確認する。
3. Git作業ツリーがcleanで、公開候補commitが記録済みであることを確認する。
4. 現行Pages commit、現行 `standard-game-action` version、適用済み関数を記録する。
5. Security Advisor、Performance Advisor、API/Database/Edge使用量の変更前snapshotを保存する。
6. `node scripts/live-standard-release-preflight.mjs --expect=baseline` で公開UIが旧版、`fcg_standard_room_snapshot(uuid)` が権限保護付きで存在し、snapshot v2と野良募集RPCが未適用であることを秘密鍵なし・書込みなしで確認する。さらにSQL Editorの `to_regclass` / `to_regprocedure` で新規表とservice-only関数も確認する。

確認結果が想定と違う場合は適用を止め、現物に合わせて手順を更新する。

Dashboardのbaselineを取得できない場合は理由を証拠台帳へ`BLOCKED`として残し、取得できるようになるまでmigration適用へ進まない。

公開後の低負荷観測に使うT0も、Dashboardの「直近24時間」を秘密情報なしの入力JSONへ転記して次で取得する。入力は64 KiB以下、top-levelは`capturedAt`、`window`、`release`、`metrics`だけとし、token、service role key、Authorization、接続文字列、user/room/action ID、メールアドレスを含めない。スクリプト自身はsign-inも書込みもせず、既存の公開`candidate` preflightを呼び、正規化JSON 1件だけをstdoutへ出す。

`node scripts/capture-standard-release-observation.mjs --label=T0 --input=standard-dashboard-t0.json > standard-observation-t0.json`

現行公開候補の初回実測は`docs/STANDARD_DASHBOARD_T0_20260905.json`と正規化済み`docs/STANDARD_OBSERVATION_T0_20260905.json`に保存する。後者が`PARTIAL`の場合は、欠落値を推測で埋めず`pendingPaths`をT+24hでも再取得する。

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

各実行直後に、そのmigrationが追加する表、関数、列、ACLを `to_regclass`、`to_regprocedure`、`information_schema.columns`、`proacl` で確認する。`SECURITY DEFINER` 関数は空の `search_path`、ブラウザー用RPCは `authenticated` のみ、サーバー用RPCは `service_role` のみであることを確認してから次へ進む。

13本すべての適用後、`supabase/verification/standard_candidate_verify.sql` をSQL Editorで実行する。これは読み取りだけを行い、非公開テーブル、追加列、重要関数、RLS/ACL、制約、トリガー、索引、appearance backfill不一致、クイズ回答RPC、クロガネ旧/new policy境界を一覧化する。全行の `ok` が `true` でなければEdge更新へ進まない。

`202609030012` の適用時にはcleanupを実行しない。定期実行も作らない。`202609030013` の既存プロフィールappearance backfill件数と所要時間を記録し、失敗または長時間ロックならEdge/Pagesへ進まない。

## EdgeとPagesの順序

1. DB 13本の確認が終わってから `standard-game-action` を更新する。
2. Pagesを更新する前に `node scripts/live-standard-release-preflight.mjs --expect=db-ready` を実行し、新RPCが権限保護付きで存在する一方、公開UIはまだ旧版であることを確認する。
3. JWT検証が有効なこと、managed service-role secretの参照だけで値を表示していないことを確認する。
4. Edgeへ、欠落JWT、改変JWT、正規JWT、プロフィール読取り、見た目catalog、CPU rosterの小さなcanaryを行う。
5. Edgeが正常なまま、StandardオンラインPagesを公開する。
6. Pagesの公開commitとbuild成功を確認し、`node scripts/live-standard-release-preflight.mjs --expect=candidate` とキャッシュをまたぐ通常URLの新しいブラウザーで確認する。

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
- 各問は回答確定前に正解を公開せず、`quiz-answer`直後に正誤と正解を表示し、同じ回答actionの再送は同じ結果を返す。二重回答は進行を増やさない。
- 10問終了後の答え合わせに、問題、自分の回答、正解、解説が10件あり、再読込後も報酬が二重付与されないことを確認する。旧一括`quiz-finish`経路の互換性も有限canaryで残す。
- カード売却の通常/要確認/取消/応答不明再送/対戦中ロックを確認する。
- 見た目の有料購入/無料装備/取消/同一ID再送/別端末復元を確認する。
- 相手に名札と称号だけが見え、相手のプロフィール本文、所持カード、非公開戦績が含まれないことを確認する。

### C. 野良対戦

- Aが「対戦相手を募集」、Bが「今入れる試合を探す」で1室だけ成立し、画面にも応答にも合言葉が出ない。
- 取消と検索の競合、2人同時検索、10件同時確保で二重ticket/seat/roomがない。
- 二端末で1試合を完走し、再読込と新しい野良対戦を確認する。

### D. CPU

- 実時間90秒まではCPU承諾がサーバーで拒否され、自動開始しない。
- 90秒案内を一度見送り、180秒で再案内される。
- 10人の一覧、得意、苦手、お気に入り、固定名が表示される。
- 人間参加とCPU承諾を同時に行い、必ず一方だけが成立する。
- 代表3人で開始、合法なCPU手、終局、CPU別戦績、再読込、同じCPUとの再戦を確認する。CPU表示は常時残す。
- CPU戦の精算済み結果だけに「完了報酬：Lv.1ガチャ券 +1」が表示され、再読込後も券が保持されることを確認する。未精算CPU戦と対人戦へは表示しない。
- 新規クロガネroomは`standard-character-roster-v1:kurogane-lookahead-v2`で最低2手の合法手を行う。旧v1 roomは進行を維持し、成功した再戦だけv2へ更新する。
- deployをまたぐ開始action再送は、全入力が同一でpolicyだけが旧v1のfingerprintと一致する場合だけ回復し、characterやloadoutの変更は拒否する。

## 軽量化・負荷の合格条件

- `scripts/live-standard-room-snapshot-smoke.mjs --confirm-live` で完全snapshotより同revision差分snapshotのbytesが小さい。
- Realtime正常時は重複通知がsingle-flightへまとまり、playing中の救済pollは15秒間隔で1 RPC、hidden/offline中は停止する。
- 旧4 SELECT方式に戻っていない。30分2人対戦の救済通信見込みは5,760 SELECTから240 RPCで、実測値には操作起因の通知分を別記する。
- 正常な最速CPU進行と二端末操作がEdgeの濫用抑止に触れず、明示的な過剰canaryだけが429になる。
- DB/Edgeのp50、p95、エラー率、Database/Edge/Realtime使用量を変更前後で記録し、悪化時は公開範囲を広げない。

T+24hはT0の正規化JSONをbaselineとして必須指定し、同じ「直近24時間」Dashboard入力を比較する。

`node scripts/capture-standard-release-observation.mjs --label=T+24h --input=standard-dashboard-t-plus-24.json --baseline=standard-observation-t0.json > standard-observation-t-plus-24.json`

T0から24時間未満で実行した場合は`CAPTURE_INTERVAL_UNDER_24_HOURS` warningを残し、24時間観測を完了扱いにしない。固定allowlist外のmetric、未知top-level、秘密キー/秘密らしい値、64 KiB超の入力は拒否され、拒否時に公開preflightは起動しない。欠落metricと比較不能値は`PENDING` / `null`のままにする。この自動観測は物理二端末を操作できないため、出力の`physicalTwoDeviceAcceptance`は常に`executionState: NOT_RUN`、`gateState: PENDING`、`automated:false`であり、段階canary A–Dの人間確認をPASSへ変更しない。

## cleanupの承認ゲート

初期候補は、room 24時間、ticket/quiz 7日、profile-scoped receipt 30日の保持とする。まず `p_dry_run=true`、`p_batch_size=100` で分類別件数だけ確認する。実削除は対象件数、cascade先、復元不能であることを別途説明して承認を得た後に1バッチだけ行い、処理時間と残数を再確認する。定期化はさらに別の承認とする。

## 失敗時

- DBは追加的migrationのため、その場で表や列をDROPしない。
- Edge canary失敗時はPagesを公開せず、直前のEdge versionへ戻す。
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
