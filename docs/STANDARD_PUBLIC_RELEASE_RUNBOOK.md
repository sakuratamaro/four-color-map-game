# Standard公開版 段階リリース手順

更新日: 2026-09-10

状態: 現行運用。migration `202609030006`–`202609030013`、`202609050001`–`202609050007`、`202609060001`–`202609060003`、`202609100001`、Edge deployment 25相当のsource、Pages product `c36bd18`（online app v21、style v11、progression v2、skill intents v20、local bundle v7）は適用済み。`5.0.0-alpha.4`の既存互換とrollback保全を維持する。最新便はquiz finish DB関数と表示だけを変更し、Edge source、engine、対戦ルール、報酬量、ガチャ率は変更していない。次便も実行直前にmain HEAD、Pages run、Edge source、migration tailを現物から再取得する。

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
6. 現行alpha.3便はDB変更なしで完了。migration tail `202609060003`、Edge deployment 23、公開product `df56432`を基準にする。alpha.4のEdge先行段階では旧Pagesが正常なためpreflightをphase指定なしで実行し、`--expect=candidate`はPages公開後だけ使う。過去便の`baseline`／`db-ready`は再利用せず、公開assetとEdge versionを別々に記録する。

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

## Edge deployment同一性証明ゲート

Pagesの `supabase/functions/standard-game-action/standard-engine.bundle.js` はrepository artifactの公開copyであり、Supabase Edgeで実際に稼働中のsourceを読み戻した証拠ではない。Pages側のodds markerが合格しても、それだけを「live Edge確認」「deployment同値」と記録しない。Edgeの公開判定は、次の3層が同じrelease attemptで揃った場合だけ`VERIFIED`にする。

1. Supabase control plane: `functions list`で対象project ref、function `id`、`version`、`status=ACTIVE`、`verify_jwt=true`を取得する。`id + version`をdeployment識別子とする。利用中のCLI JSONが`ezbr_sha256`も返す場合だけplatform bundle識別子として記録し、返さない場合は`NOT_EXPOSED_BY_CLI`のままにして架空値を補わない。いずれの場合もplatform bundle hashをsource fileのSHAと同じ値だとはみなさない。
2. 保存済みsource: deploy後に新しい一時directoryへ`functions download standard-game-action --use-api`し、候補clean HEADの`index.ts`と`standard-engine.bundle.js`を含む全file setと各SHA-256を比較する。生成済みbundleは全byte一致を必須にする。CLI downloadが`index.ts`のCRLFだけをLFへ正規化した場合に限り、raw SHA/bytesを両方記録したうえでUTF-8 LF正規化比較を許す。内容差、bundleの改行差、追加fileは拒否する。deploy前に取得したdownload、Dashboard editor表示、Pages copyを使い回さない。
3. live挙動: 同じdeploymentに対して基本Edge canaryと、その便で変更した機能の最小専用canaryを実行する。source一致だけでboot・JWT・依存先・実応答の正常性を推定せず、canary成功だけで保存済みsource一致を推定しない。

CLIは公式の`functions list/download/deploy --project-ref ... --use-api`経路を使う。`--debug`を付けず、access token、Authorization header、service role、接続文字列をterminal logや証拠へ出さない。CLIが未導入、未認証、または`projects list`で対象refを一意に確認できない場合、control planeの`id + version`確認は`BLOCKED`であり、Dashboardの目視値やPages copy単独では代替しない。例外は後段のbaseline/post ZIP、freshness順序、live canaryをすべて満たすsigned-in Dashboard fallbackだけで、その場合もcontrol planeの`id + version`は`PENDING`のまま残す。read-only preflightは次の順にする。

```powershell
Get-Command supabase
supabase --version
supabase --output json projects list
supabase --output json functions list --project-ref qkcuhludisairpgzhryl
```

rawのprojects/functions JSONはcommitや共有をせず、一時directory内だけに置く。証拠として共有するのは、後述のverifierが出すallowlist済みJSONだけにする。deploy直前には現行`id + version + ezbr_sha256`と、別のbaseline一時directoryへdownloadした2 source SHAを記録する。

deployは候補のclean worktree rootからfunction名を明示して1件だけ行う。function名を省略した一括deploy、`--no-verify-jwt`、`--debug`、Dashboard editorへの追記は使わない。次はリリース時にだけ実行する本番mutationであり、通常のread-only監査では実行しない。

```powershell
$projectRef = "qkcuhludisairpgzhryl"
$candidateCommit = git rev-parse HEAD
$proofRoot = Join-Path ([IO.Path]::GetTempPath()) ("fcg-standard-edge-proof-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path (Join-Path $proofRoot "supabase") -Force
Copy-Item -LiteralPath "supabase/config.toml" -Destination (Join-Path $proofRoot "supabase/config.toml")
supabase --workdir . functions deploy standard-game-action --project-ref $projectRef --use-api 2>&1 | Tee-Object -FilePath (Join-Path $proofRoot "deploy.log")
supabase --output json projects list | Out-File -LiteralPath (Join-Path $proofRoot "projects.json") -Encoding utf8
supabase --output json --workdir $proofRoot functions list --project-ref $projectRef | Out-File -LiteralPath (Join-Path $proofRoot "functions.json") -Encoding utf8
supabase --workdir $proofRoot functions download standard-game-action --project-ref $projectRef --use-api 2>&1 | Tee-Object -FilePath (Join-Path $proofRoot "download.log")
```

post-deployの`functions.json`とDashboardのversion表示を照合し、実際の新versionを`<deployment-version>`へ入れる。まずsourceだけを検証すると、成功しても状態は意図的に`SOURCE_VERIFIED_CANARY_PENDING`となる。

```powershell
node scripts/verify-standard-edge-deployment-proof.mjs --stage=source --candidate-commit $candidateCommit --project-ref $projectRef --expect-version <deployment-version> --projects-json (Join-Path $proofRoot "projects.json") --functions-json (Join-Path $proofRoot "functions.json") --downloaded-function-dir (Join-Path $proofRoot "supabase/functions/standard-game-action") --download-log (Join-Path $proofRoot "download.log")
```

次に、同じversionがACTIVEのまま基本canaryを実行する。変更機能に専用canaryがある場合は別logへ追加し、verifierへ`--canary-log`を複数渡す。canaryは明示的にlive dataを作るため、実行承認、有限timeout、terminal cleanupを従来どおり必須にする。

```powershell
node scripts/live-standard-edge-canary.mjs --confirm-live 2>&1 | Tee-Object -FilePath (Join-Path $proofRoot "basic-canary.log")
node scripts/verify-standard-edge-deployment-proof.mjs --stage=release --candidate-commit $candidateCommit --project-ref $projectRef --expect-version <deployment-version> --projects-json (Join-Path $proofRoot "projects.json") --functions-json (Join-Path $proofRoot "functions.json") --downloaded-function-dir (Join-Path $proofRoot "supabase/functions/standard-game-action") --download-log (Join-Path $proofRoot "download.log") --deploy-log (Join-Path $proofRoot "deploy.log") --canary-log (Join-Path $proofRoot "basic-canary.log")
```

verifierは候補worktreeがcleanで指定commitと一致すること、認証済みproject ref、ACTIVE deployment metadata、JWT設定、downloadされた全sourceの一致、deploy logとcanary logに秘密値やFAILがないことを検査する。証拠fileは15分以内で、`deploy log → projects → functions metadata → download readback → canary`のmtime順でなければ拒否する。これにより前便のJSON、download directory、canary logの使い回しを防ぐ。標準出力はsource本文やtokenを含まない正規化JSON 1件だけである。`gateState=VERIFIED`、意図した`id + version`、各fileの比較方式とcandidate/download SHA、全canaryの`checks=total`を保存してからPages段階へ進む。

### CLI未認証時のsigned-in Dashboard ZIP fallback

CLIが未導入または未認証でも、既にサインイン済みの正しいSupabase Dashboardから`standard-game-action`の`Download as ZIP`を取得できる場合は、source readbackだけを安全に代替できる。ただしDashboard ZIPにはcontrol planeの`id`、`version`、`ezbr_sha256`が含まれないため、それらを推測しない。この経路の成功状態は`VERIFIED_WITH_DASHBOARD_SOURCE_READBACK`であり、CLI metadataを含む`VERIFIED`とは区別する。後からCLIが使える場合は同じdeploymentを`functions list`で再取得して完全な識別子を追補する。

1. deploy前にCode画面のproject refとfunction名、2 files、JWT verification有効を目視し、`Download as ZIP`を新しいbaseline一時directoryへ展開する。展開完了直後にfunction名と取得完了時刻だけの`baseline-download.log`を作る。
2. Dashboard editorでは`index.ts`と`standard-engine.bundle.js`を全置換して同時saveし、成功表示直後に時刻だけのsecret-free deploy logを作る。追記貼付、片fileだけのsaveはしない。
3. 更新表示、2 files、JWT verificationを再確認してsecret-free `dashboard.json`へ転記し、同じ画面から別の新しいpost-deploy ZIPをdownload・展開する。展開完了直後にfunction名と取得完了時刻だけの`post-download.log`を作る。deploy前ZIPや以前のZIPをrenameして使い回さない。
4. `--metadata-mode=dashboard`でbaseline/post ZIPを比較し、候補source一致を確認する。`index.ts`のCRLF/LFだけは両raw SHAを残して正規化比較できるが、生成bundleは必ずbyte exactとする。
5. 同じfunctionへlive canaryを実行して最終proofを作る。baseline ZIP、deploy log、dashboard metadata、post ZIP、canaryはすべて15分以内かつこの順でなければ失敗する。

`dashboard.json`は次のallowlistだけにし、project名、user情報、token、URL query、Authorization、secretを含めない。`updatedLabel`は画面に表示された相対時刻またはtimestampをそのまま記録する。

```json
{"projectRef":"qkcuhludisairpgzhryl","function":"standard-game-action","fileCount":2,"verifyJwt":true,"updatedLabel":"updated moments ago"}
```

```powershell
node scripts/verify-standard-edge-deployment-proof.mjs --metadata-mode=dashboard --stage=source --candidate-commit $candidateCommit --project-ref $projectRef --baseline-function-dir (Join-Path $proofRoot "baseline/standard-game-action") --baseline-download-log (Join-Path $proofRoot "baseline-download.log") --downloaded-function-dir (Join-Path $proofRoot "post/standard-game-action") --download-log (Join-Path $proofRoot "post-download.log") --dashboard-json (Join-Path $proofRoot "dashboard.json") --deploy-log (Join-Path $proofRoot "deploy.log")
node scripts/live-standard-edge-canary.mjs --confirm-live 2>&1 | Tee-Object -FilePath (Join-Path $proofRoot "basic-canary.log")
node scripts/verify-standard-edge-deployment-proof.mjs --metadata-mode=dashboard --stage=release --candidate-commit $candidateCommit --project-ref $projectRef --baseline-function-dir (Join-Path $proofRoot "baseline/standard-game-action") --baseline-download-log (Join-Path $proofRoot "baseline-download.log") --downloaded-function-dir (Join-Path $proofRoot "post/standard-game-action") --download-log (Join-Path $proofRoot "post-download.log") --dashboard-json (Join-Path $proofRoot "dashboard.json") --deploy-log (Join-Path $proofRoot "deploy.log") --canary-log (Join-Path $proofRoot "basic-canary.log")
```

Dashboard fallbackでも、Pages copy、editorの行数、更新ラベル、canaryのどれか単独をsource同一性の証明にしない。proofにはbaseline/post各file SHA、変化したfile名、候補/post比較方式、canary log SHA、`CONTROL_PLANE_ID_NOT_OBSERVED`を残す。version/idが必要な監査ではこの制約を`PENDING`として保持する。

rollbackも「旧version番号へ戻った」という目視だけでは完了しない。事前保全した互換rollback commitのclean worktreeから同じCLI deployを行い、新しい`id + version + ezbr_sha256`、fresh downloadとrollback候補のbyte/SHA一致、基本canary、既存version room継続、active room件数を新しいproofとして残す。alpha.4 active roomが0になる前にalpha.4非対応sourceへ戻さない。失敗deployment、失敗canary、切替前後のversionも削除せず証拠台帳へ残す。

## EdgeとPagesの順序

### 基本palette torn snapshot拒否便

完了。正式候補は`origin/main@3e453a2`へ製品、asset marker、fixture整合修正だけを再構成した`4cefe9f`（製品`023dcf5`、再構成の元`a68c6ab`）。試験枝を再実行するためだけのworkflow変更`462f999`は含めなかった。current-seat private paletteを持つclientだけのPages便であり、DB、migration、RPC、Edge、engine、ルール、カード、報酬は変更していない。

1. [完了] unit 51/51と、390pxで`coherent COLOR → version不一致か基本色破損 → coherent CPU turn → 次のCOLOR`を通すfocused Chrome/Edge各1/1を再確認。torn中の最後の基本2色保持、再接続表示、action送信0、public表示へのprivate palette漏えい0を確認した。
2. [完了] 専用branch `codex/standard-palette-green-release-candidate-20260908`へexact `4cefe9f`をpush。Windows `34354740441`はChrome `102476448386`、Edge `102476448811`とも成功。一時CI triggerを候補へ戻していない。
3. [完了] mainを`3e453a2→4cefe9f`へforceなしでfast-forward。Pages `34355861649`は同SHAのbuild/report/deployが成功し、公開candidate preflightは`ok:true`。
4. [完了] 公開環境でtorn responseを捏造せず、通常CPU戦で基本色「緑・赤」をCPU手番、次のCOLOR、reload後の次COLORまで確認し、両方の`基本色・回数無制限`とおまけ色「黄・残り1回」を維持。390×844でconsole warning/error 0、横overflow 0。
5. [完了] synthetic torn時系列はformal browser gate、公開後は実server通常時系列として証拠を分離し、`PUBLIC_VERIFIED`へ昇格した。

### クイズ選択肢のcompact巡回・位置入替便

正式候補は最新main `6b9133f`へ製品・asset marker・試験だけを再構成した`4f61201`。短い数値は52pxの実寸丸型、長い値は内容に応じた実寸カプセルとし、見えない旧大矩形を残さず、そのwidth/heightを壁反射・相互衝突へ直接使う。通常移動の結果として上下左右が入れ替わり、瞬間shuffle、速度だけ、衝突ジッターの累積移動量で代用しない。DB、Edge、クイズ生成、制限時間、採点、再送、報酬を変更しないPages-only便である。

1. [完了] static/physics 74/74と390pxのChrome/Edge各1/1で、全6候補の実寸、button面積合計がarenaの24%以下、全buttonが開始位置から60px以上、6個中4個以上が90px以上、4個以上が上下／左右帯を移動、連続停滞0、visual order入替、bounds、overlap 0、button中心hit、hover/focus/touch/hint/feedback/hidden/handoff/reduced-motion停止、keyboard DOM順、resize、回答1回を確認した。
2. [完了] 専用branch `codex/quiz-density-release-candidate-20260909`へexact `4508fb4`をpush。Windows `34379857918`はChrome成功、Edge attempt 1だけ既存reduced-motion接触文言のtimingで失敗した。同一SHAの該当Edge単体1/1を局所再現確認し、failed job再実行のattempt 2でEdgeも成功した。失敗runは削除・省略していない。
3. [完了] `origin/main@6b9133f`が候補の祖先、ahead 5・behind 0を再確認し、forceなしで`4508fb4`へfast-forward。Pages `34382383719`は同SHAで成功し、公開candidate preflightは`ok:true`、390px横overflow 0、console warning/error 0。
4. [完了] 公開Lv.5クイズをPC幅と390×844で実測。PCはbutton面積合計4.7%、5秒で全6個154–228px移動。390pxは18.3%、10秒で全6個172–256px移動し、全6個が上下または左右帯を入れ替えた。両幅でbounds内、overlap 0。移動先のbutton中央click直後に全候補disabled・motion paused、server ACK後は採点済み履歴が1回だけ増えて次問で再開した。
5. [完了] 大四角の詰まり、見えない旧hitbox、長時間の小刻みな押し合い、重なり、選択不能、回答重複は公開実測で確認されず、`PUBLIC_VERIFIED`へ昇格した。

### CPU完了報酬の実所持突合便

B便後の最新main `3d84294`へ本番canary `eb629e5`と製品・試験`65f23c9`を再構成したPages-only便である。公開候補は`4318793`。終局の獲得表示をhydration済みLv.1券総数へ拘束し、`+1（所持 2→3）`のように付与前後を明示する。ガチャ画面でも現在総数と1回あたりの消費数を表示し、抽選後reloadでは消費後総数と保存済み結果を一致させる。Pages assetはonline app `app.js?v=20260908-10`、style `style.css?v=20260908-6`。DB、migration、RPC、Edge、engine、報酬量、ガチャ率は変更しない。

1. [完了] 配備済みEdge deploymentのZIPを再取得し、`index.ts` SHA-256 `a80c7fb6773764da291e82fc82086dac497148317e77d6f78ebb8ec7b2833be1`、bundle SHA-256 `6220c7eb72266ae1e3ad2f770429c891192b905b99dd83f9bd491d5113dac673`がローカル候補とbyte単位で一致することを確認した。
2. [完了] 本番CPU敗北を使う有限canary 18/18で、profile revision +1、match history、Lv.1券 +1、既知revisionのdelta省略、完全reload、同一終局action再送のrevision・券非増加を確認した。既存基本Edge canaryも7/7。
3. [完了] 関連非browser 113/113と390px focused Chrome/Edge各1/1で、CPU勝利時の`2→3`、ガチャ遷移時`×3`、1枚抽選後reload時`×2`、結果文の復元、対人・未精算・実験対戦の非表示を確認した。
4. [完了] B便公開後の最新main `3d84294`から専用branch `codex/reward-persistence-release-20260910`へ5 commitを再構成し、exact `4318793`をpushした。Windows run `34384691415`は古いapp v9期待を検出したため修正し、run `34385103929`はChrome成功、Edge attempt 1だけ既存`badge-ready`待機timeout。同一SHAの該当Edge単体1/1後、failed job再実行のattempt 2でEdgeも成功した。失敗runは保持する。
5. [完了] `origin/main@3d84294`が候補の祖先、ahead 5・behind 0を再確認し、forceなしで`4318793`へfast-forward。Pages `34387630198`は同SHAで成功し、公開asset marker、HTTP 200、candidate preflight `ok:true`、console warning/error 0、390px横overflow 0を確認した。
6. [完了] 公開通常CPU戦で終局表示`Lv.1券 15→16`、ガチャ画面`×16`、1枚抽選後`×15`、reload後も`×15`と獲得カード「色封じ・乱」を実見した。本番canaryの完全reload・同一終局action再送非二重付与18/18と合わせ、`PUBLIC_VERIFIED`へ昇格した。

### 持ち色変更の変更元枠→変更先色UI便

報酬証跡追補後の最新main `a4f9bf4`から専用branch `codex/palette-change-release-20260910`へ製品`f3ea574`、対象試験`6b7940b`、asset marker、browser待機安定化、有限CI予算だけを積んだPages-only便である。公開製品は`eac26ed`。基本色1／2・おまけ色を変更元として先に選び、別段で変更先色を選ぶ。選択slotの現色だけをno-opとして無効化し、他slotと同色にする既存serverルールは維持する。DB、migration、RPC、Edge、engine、ルール、カード在庫は変更しない。

1. [完了] 元の累積worktreeは`51ca420`として専用branchへ保全し、直接統合しなかった。最新main起点のclean release worktreeへ対象差分だけを再構成し、static/runbook 83/83、対象390px Chrome/Edge各1/1、diff checkを合格させた。
2. [完了] 正式browserで基本色1／2・おまけ色の色と無制限／残数、変更元選択前の変更先非表示、選択slotの現色disabled、別slotとの同色化、summary、Escape／取消のwrite-free、二重clickでもaction一回、server refresh後の`青・青`、390px overflowなし、private payload非漏えいを確認した。
3. [完了] Windows `34390627632`は初回Edge成功／Chrome既存`badge-ready` timeout、attempt 2はChrome成功／Edge既存reduced-motion告知raceだった。前者は同一SHAの局所Chrome 1/1、後者は告知文自体を待つよう修正して局所Chrome/Edge各1/1。`34393139988`はChrome成功、Edgeが81/82・fail 0のまま15分上限でcancelされたため、workflowの有限上限を20分へ更新し契約11/11を確認した。最終`34394919317`はexact `eac26ed`でChrome・Edgeとも成功した。途中runも削除しない。
4. [完了] `origin/main@a4f9bf4`の不変、候補clean、祖先関係を再確認し、forceなしで`eac26ed`へfast-forward。Pages `34396124927`は同SHAで成功し、candidate preflightは`ok:true`。
5. [完了] 公開390pxでonline app `app.js?v=20260910-14`、Standard style `style.css?v=20260910-9`、横overflow 0、console warning/error 0を確認した。公開プロフィールは持ち色変更0枚のため本番actionを捏造せず、公開asset／表示健全性と正式browser behaviorを分離して記録し、`UDL-038`を`PUBLIC_VERIFIED`へ昇格した。

### 各セル選択直後の接触演出便

全開始候補証跡追補後の最新main `5fc8a3b`へ、保全済み差分から製品変更だけを再構成したPages-only便である。公開製品は`3dea0ed`（製品`b5fdd36`、asset marker`56afb4e`、静的契約`3dea0ed`）。自分のCREATE local draftだけを各選択・解除直後に再計算し、接触色数が2、3、4へ上昇した時だけ対応演出を即時提示する。required-size完成、送信、server ACKは待たない。DB、migration、RPC、Edge、engine、ルールを変更しない。

1. [完了] 古い累積作業床を直接mergeせず、最新main起点のclean branch `codex/per-cell-contact-release-20260910`へ製品差分だけを移植した。style v10を維持し、JavaScript変更をapp v16へcache-bustした。static/runbook 84/84、対象Chrome/Edge各1/1が合格した。
2. [完了] 正式browserは1マス目2色、2マス目3色、3マス目4色を即時提示し、4マス目の同数では再提示0、解除による閾値低下で古い演出clear、再上昇で一回だけ再提示することを確認した。pointer／keyboard、reduced-motion、aria-live、390px、action通信0を確認し、CPU／相手／poll／reload／public trace／skill targetでは発火しない。
3. [完了] 初回Windows `34406783091`は、今回SUPERSEDEした完成時-only仕様を要求する旧静的契約2件によりChrome／EdgeともCPU policy stepで失敗した。製品コードを変えず契約を各セル上昇閾値へ更新し、正式stepをローカル505/505で再現後、修正run `34407352376`はChrome／Edgeとも成功した。失敗履歴は保持する。
4. [完了] `origin/main@5fc8a3b`の不変、候補clean、祖先関係を再確認し、forceなしで`3dea0ed`へfast-forward。Pages `34408261449`は同SHAで成功し、candidate preflightは`ok:true`、`hasPerCellContactFeedback:true`だった。
5. [完了] 公開390pxはonline app `app.js?v=20260910-16`、style `style.css?v=20260910-10`、contact reveal/titleとpolite announcement DOM、横overflow 0を確認した。実CREATE手番は捏造せず、公開asset／DOM／表示健全性と正式browser behaviorを分離して`UDL-040`を`PUBLIC_VERIFIED`へ昇格した。

### 0マス時の全開始候補便

封印色証跡追補後の最新main `efaa185`へ、保全済み同等差分から製品変更だけを再構成したPages-only便である。公開製品は`4a8cb28`（製品`1e4a7ce`、asset marker`4a8cb28`）。0マス時は既存の公開盤面・必要数・completion判定から、必要数まで完成可能な開始候補をすべて水色破線で示す。自動選択、選択数加算、通信、サーバー制約、合法色oracleは追加しない。DB、migration、RPC、Edge、engine、ルールを変更しない。

1. [完了] 古い累積作業床を直接mergeせず、最新main起点のclean branch `codex/all-start-release-20260910`へ製品差分だけを移植した。style v10を維持し、JavaScript変更をapp v15へcache-bustした。static/runbook 83/83、対象Chrome/Edge各1/1が合格した。
2. [完了] 正式browserは通常手の5候補とskill対象の8候補を集合一致で確認し、重複0、範囲外0、選択数0、action通信0を固定した。pointer／keyboard、focus位置、選択後の緑の接続候補への切替、取消、手番外none、390px、最大盤面1280px／1秒未満を確認した。
3. [完了] Windows `34404697454`はChrome／Edgeとも成功した。`origin/main@efaa185`の不変、候補clean、祖先関係を再確認し、forceなしで`4a8cb28`へfast-forwardした。
4. [完了] Pages `34405690053`は同SHAで成功し、candidate preflightは`ok:true`。公開390pxはonline app `app.js?v=20260910-15`、style `style.css?v=20260910-10`、横overflow 0で、全候補／自動選択なしのkeyboard helpを実配信している。
5. [完了] 公開プロフィールで進行中CREATE手番を捏造せず、公開asset／案内／表示健全性と正式browser behaviorを分離して記録し、`UDL-039`を`PUBLIC_VERIFIED`へ昇格した。

### 封印中の元色保持便

COLOR長文案内撤去証跡追補後の最新main `1b39b69`へ、保全済み差分から製品変更だけを再構成したPages-only便である。公開製品は`816f51e`（製品`9d1647a`、asset marker`816f51e`）。所有中の色buttonへ赤・青・黄・緑それぞれの固有surface／border／ink変数を持たせ、封印時も同じ変数とopacity 1を使う。鍵、封印中、公開される残り回数、disabled、keyboard遮断は維持する。DB、migration、RPC、Edge、engine、ルール、palette projectionを変更しない。

1. [完了] 古い保全作業床を直接mergeせず、最新main起点のclean branch `codex/sealed-color-release-20260910`へ製品差分だけを移植した。app v14を維持し、CSS変更をstyle v10へcache-bustした。static/runbook 83/83、対象Chrome/Edge各1/1が合格した。
2. [完了] 正式browserは未封印の赤と封印後の赤でsurface／borderが同一、opacity 1であることを比較し、全4色の期待surface／border、基本／おまけ／残0、鍵とdisabled、stale clickのaction 0、skill target不変、keyboard、390px、相手private非漏えいを確認した。
3. [完了] Windows `34402078335`はChrome／Edgeとも成功した。`origin/main@1b39b69`の不変、候補clean、祖先関係を再確認し、forceなしで`816f51e`へfast-forwardした。
4. [完了] Pages `34403138912`は同SHAで成功し、candidate preflightは`ok:true`。公開390pxはonline app `app.js?v=20260910-14`、style `style.css?v=20260910-10`、横overflow 0だった。公開CSSOMから4色の固有変数と`.color-button.is-sealed:disabled`の元色変数／opacity 1を確認した。
5. [完了] 公開プロフィールに実封印状態がなかったため本番対局を捏造せず、公開asset／CSSOM／表示健全性と正式browser behaviorを分離して記録し、`UDL-036`を`PUBLIC_VERIFIED`へ昇格した。

### COLOR長文案内撤去便

パレット変更証跡追補後の最新main `21b4b57`へ、保全済み同一patch `ae06452`／`608962e`から製品差分だけを再構成したPages-only便である。公開製品は`21c1e23`（製品`bf9b5c1`、Local bundle marker`21c1e23`）。COLOR中の「塗れる色が見つからないとき」と説明文だけをonline／Local Standard双方から撤去し、通常色、既存色操作カード、明示投了を残す。自動敗北、合法色oracle、時間制限、旧`DECLARE_NO_COLOR`は追加しない。DB、migration、RPC、Edge、engine、ルール、報酬を変更しない。

1. [完了] 古い2作業床の製品commitがpatch ID `dd10c34bcaee736b96746924e57104b915c7f0d3`で同一と確認し、古いdocsを混ぜず最新main起点のclean branch `codex/color-guidance-trim-release-20260910`へ一度だけ適用した。Local bundleを再生成して差分0、static/runbook 94/94、対象390px Chrome/Edge各4/4を確認した。
2. [完了] onlineでは通常palette、`色操作カードを見る`、`敗北として投了する`を残し、長文heading、説明ID、aria参照を撤去。Localでは通常paletteと`投了`を残し、private panelの長文sectionだけを撤去した。合法色一覧や隣接色oracleを追加せず、旧申告は引き続きwrite-free拒否する。
3. [完了] Windows `34397743592`は初回Edge成功、Chromeが変更外のhidden new-match fixtureで`badge-ready` timeout。同一SHAの該当Chrome単体1/1後、failed-job attempt 2でChromeも成功した。失敗履歴は保持する。
4. [完了] `origin/main@21b4b57`の不変、候補clean、祖先関係を再確認し、forceなしで`21c1e23`へfast-forward。Pages `34400264017`は同SHAで成功し、candidate preflightは`ok:true`。
5. [完了] 公開390pxのonline／Local Standardで長文heading 0、旧guide 0、通常操作と投了の残存、横overflow 0、console warning/error 0を確認。Localは`app.bundle.js?v=20260908-3-ad91938e65c4`を配信し、`UDL-041`を`PUBLIC_VERIFIED`へ昇格した。

### CPU封印skill局面判断便

完了。`UDL-20260909-045`はCPUが参照できる公開盤面と自分のprivate状態だけを使い、直後に作成可能な領域の公開応答候補色を評価する。候補が3色以上なら封印を温存し、2色以下からさらに減らせる場合だけ封印を高評価にする。turn番号による一律禁止は置かず、1手目でも条件を満たせば使用できる。相手のprivate palette／handは参照せず、ランダム封印の結果は`potential`として扱い確定情報にしない。

1. [完了] 最新main `b79bf29`起点の専用branch `codex/cpu-seal-timing-release-20260910`で、弱い1接触と強い2接触のseeded比較、対象色／空振り色、10人の合法性・決定性、private noise不変、formal self-playを確認した。関連99/99、formal self-play＋彩色済み角膨張10/10、実CPU browser 1/1、Edge deployment proof 10/10。Edge bundleとLocal bundleを2回再生成し、2回目差分0だった。
2. [完了] exact `e50044a`を専用branchへpush。Windows `34426581125`はChrome attempt 1だけ変更外の既存クイズ初期配置timingで失敗し、同一SHAの局所Chrome 1/1後にfailed jobを再実行してattempt 2でChrome／Edgeとも成功した。Pages assetはonline app v20／progression CSS v1を維持し、Local bundleだけ`app.bundle.js?v=20260910-6-5888f3df390d`へ更新した。
3. [完了] Pagesより先にEdge `standard-game-action`へ未変更`index.ts`と生成済みbundleを同時反映し、成功toast後にDashboard editorから両ファイル全文を再取得した。LF正規化後の内容は候補と完全一致し、SHA-256はindex `a80c7fb6773764da291e82fc82086dac497148317e77d6f78ebb8ec7b2833be1`、bundle `ffd11ac23830f711a270c7837d0d543b3d4f4462abfa78771e8489eb7fb89b8d`。JWT verification ON、基本7/7、CPU有限canary 107/107を確認した。CLI未導入のためcontrol-plane id/versionはPENDINGのまま分離する。
4. [完了] `b79bf29→e50044a`をforceなしでmainへfast-forwardし、Pages `34428346200`は同SHAで成功した。candidate preflightは`ok:true`／`hasCpuSealTimingPolicy:true`、Local bundle SHA-256は`5888f3df390d0a6bba228c52146fdcc22029ea87f05d58345f28c63570b02091`。公開Chromeはapp v20を読み込み、表示正常、warning/error 0だった。局面を本番へ注入せず、強弱比較はsource一致したbundleのseeded試験証拠として分離して`PUBLIC_VERIFIED`へ昇格した。

Edge失敗時はPagesを公開せず、直前の成功deploymentへ戻す。Pages公開後に表示退行が出た場合はEdge互換を保ったまま直前のPages commitへ戻す。DB rollback、policy外private推測、test-only本番状態注入は行わない。

### クイズ全体・Lv別正答率便

完了。`UDL-20260909-044`は既存の`attempts`、`bestCorrect`、直近成績から過去の正答数を推定せず、新migration適用後にサーバー採点が確定した回答だけを`trackedAnswered`／`trackedCorrect`へ累積する。旧recordはそのまま有効で、最初の新規精算から記録を開始する。表示は全体とLv.1〜5を常に並べ、未記録は`—`と`0/0問正解`、390pxは2列とする。

1. [完了] 最新main起点branch `codex/quiz-accuracy-release-20260910`の製品`a60aee3`で新旧record、10問精算、時間切れ、同一finish action再送、破損counter拒否、追加read 0を確認。関連143/143、save 7/7、clean proof 10/10、accuracy browser 1/1。旧migrationとv4.9 baselineのbyte/SHAは不変。
2. [完了] Windows `34432093814`は製品`a60aee3`のChrome／Edgeとも成功。正式対応は最新Chromeとし、EdgeはChromium回帰として維持する。
3. [完了] Pagesより先に`202609100001_standard_quiz_accuracy.sql`をSQL Editorで一度だけ適用。貼付全文は候補と改行正規化一致、SHA-256 `bb85eed5a2f3c98fc37b8625a41b7a86df226441ceb86b8d52dd2da5201b82c8`。配備後のsignature、security definer、空search_path、3 counter marker、duplicate guard、anon/authenticated禁止、service-role許可の総合判定はtrue。既存Edge bundle SHA `ffd11ac23830f711a270c7837d0d543b3d4f4462abfa78771e8489eb7fb89b8d`は不変で再配備していない。
4. [完了] 既存Runbook B全体はクイズ22ラウンド通過後、変更外の古い売却lock期待で停止したため全体PASSとはしない。代わりに1ラウンド専用modeを`89b2976`／`c36bd18`で追加し、10問、各answer再送、finish再送、判定数+10、正解数不変、報酬一回、cold reload全文一致を本番47/47で確認した。
5. [完了] `05bf50c→c36bd18`をforceなしでmainへfast-forwardし、Pages `34433653551`成功、candidate preflight `ok:true`／`hasQuizAccuracyRecords:true`。公開Chromeはapp v21、progression CSS v2、390×844で6件・2列、各card／page横overflow 0、注記、console 0。公開プロフィールに移行後精算がないため全6件`—`／`0/0問正解`を正しい表示として確認した。

Pages表示の退行は直前Pagesへ戻せる。適用済みcounterは旧clientが無視できる追加fieldなので、migrationを逆適用・削除せず保持する。counter異常時は新規quiz公開を止め、receiptとprofileをread-onlyで照合してから追加migrationで修正する。

### alpha.4彩色済みエリア角膨張便

完了履歴。この便は新payloadを旧Edgeが拒否する一方、新Edgeは旧UIのoutgoing payloadを継続できるため、`alpha.4対応Edge → live canary → Pages`の順で公開した。後続の対戦報酬便、CPU台詞／地の文分離便、CPU選択前portrait便、終局復帰時の開始告知抑止便、パレット属性識別便を含む現在のPages候補assetはonline app `app.js?v=20260911-26`、CPU commentary `cpu-commentary.js?v=20260910-1`、progression `progression.css?v=20260910-2`、style `style.css?v=20260910-12`、intents `standard-online-skill-intents.js?v=20260911-21`、client `standard-online-client.js?v=20260910-1`、portrait `cpu-portraits.js?v=20260908-1`、Local bundle `app.bundle.js?v=20260910-8-79935a0310f2`である。このalpha.4便自体ではDB、migration、RPC、secret、cleanup scheduleは変更しない。

1. `origin/main@63972b6`起点の専用clean worktreeで両bundleを2回生成し、2回目のSHAが不変、正式全製品試験、Windows Chrome/Edge CI、対象実browserのskip 0を確認する。
2. alpha.4対応bundleを保持したまま新規対局だけを`5.0.0-alpha.3`へ戻す互換rollback branchを作成・GitHub保全する。既存alpha.4 stateの読込み・継続と、alpha.3新規stateが彩色済みpayloadをwrite-free拒否することを確認する。
3. deployment直前にmain/Pages HEAD、Edge deployment、migration tail、active alpha.4 room数、資源警告をread-onlyで再取得する。診断不能時は推測cleanup・課金・Compute変更をせず、Edge公開を保留する。
4. `index.ts`と生成済み`standard-engine.bundle.js`を同一deploymentへ反映し、上記Edge deployment同一性証明ゲートでfresh downloadとのbyte/SHA一致と`id + version + ezbr_sha256`を確定する。基本canary、COLOR canary、CPU有限進行、公開preflightを実行する。通常loadoutに角膨張がないlive runは彩色済み用途の直接実測とみなさず、保存済みsource、live canary、actual browserの証拠を分けて記録する。
5. Edgeが旧outgoing UIを継続できることを確認してからmainをforceなしでfast-forwardし、Pagesを公開する。asset marker、HTTP 200、390px、pointer/keyboard/Escape、console warning/error 0を確認する。

Edge公開後に失敗した場合は、alpha.4対応bundleを残した互換rollbackで新規alpha.4作成だけを止める。active alpha.4 roomが0になる前にalpha.4非対応Edgeへ単純復帰しない。Pages公開前なら旧Pagesは新Edgeと互換のため維持できる。Pages公開後のUI障害ではalpha.4対応Edgeを保持したままPagesだけをdeployment直前に記録したPages baselineへ戻し、既存alpha.4 roomを継続可能にする。

### alpha.3カテゴリ制限便

完了済み。この便は `Pages app v40/intents v18/local bundle v4 → Edge deployment 22上の互換smoke → alpha.3対応Edge deployment 23 → 専用canary` の順で完了した。新Pagesは`skillCategoryWindow`欠落を旧対局として扱うためalpha.1/2 Edgeと互換であり、旧cacheのUIへalpha.3対局を先行して渡さなかった。Windows `34048695008`、Pages `34049734628`、基本7/7、COLOR追補263/263、LAB 23/23、CPU 108/108、Runbook A 44/44、更新前後active alpha.3 room 0、候補preflight `ok:true`を確認した。追補canaryはtest-only注入なしで同カテゴリ2枚目のrejectとwrite-freeを直接実測した。favicon追補`df56432`はゲーム挙動を変えず、browser gate `34050740206`とPages `34051979716`で公開し、390px EdgeのHTTP error・console warning/error 0を確認した。

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
