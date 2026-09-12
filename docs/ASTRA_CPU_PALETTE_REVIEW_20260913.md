アストラ先生へ。CPU051の独立F1＋最新直接ユーザー指示「クロガネ持ち色変更100回」の固定候補レビューをお願いします。旧036/037/038の流用や、無応答の承認扱いはしません。公開前のWindowsゲートに未解決1件があることを明記した、コード・仕様のレビュー依頼です。

SUBJECT_SHA: 9590a4212d69185fc93df31b552d9bd870d5a9a3
BASE_SHA: d9ce111d7d97019d55b3e90842602001e045ea04
BRANCH: codex/cpu-palette-efficiency-20260913（originへ正確にpush済み）
CANON: shared-canon-v1.1
FEATURE_SPEC: UDL-051-palette-v1.1
SPEC_PATH: docs/CPU_PALETTE_EFFICIENCY_20260913.md
SPEC_BLOB: de0cc9e2299a8a69dd1bfbc9368cd98042ca9b9f
SCOPE: Pages_Edge_DB_managed_activation
DB_CHANGE_SET: ["supabase/migrations/202609130002_standard_cpu_palette_efficiency.sql"]
EDGE_CHANGE_SET: ["supabase/functions/standard-game-action/index.ts","supabase/functions/standard-game-action/standard-engine.bundle.js"]
MANAGED_SETTING_CHANGE_SET: [{"name":"FCG_CPU_PALETTE_EFFICIENCY","compatible_deploy_value":null,"activation_value":"standard-character-palette-efficiency-v1","rollback":"disable new palette activation; retain compatible Edge and additive SQL; preserve existing split setting"}]
PUBLICATION: NOT_RUN（本番DB/Edge/管理値/main/Pages/liveプロフィール・対局すべて0）

全23ファイルの固定差分（全patch取得可能、画像なし）:
https://github.com/sakuratamaro/four-color-map-game/compare/d9ce111d7d97019d55b3e90842602001e045ea04...9590a4212d69185fc93df31b552d9bd870d5a9a3
固定仕様:
https://github.com/sakuratamaro/four-color-map-game/blob/9590a4212d69185fc93df31b552d9bd870d5a9a3/docs/CPU_PALETTE_EFFICIENCY_20260913.md
原ゲート:
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34723536140

後続直接本人発言を優先:
「これ、クロガネの二つ名にとって重要な特徴だと思うので、くろがねの持ち色変更は使用回数100回とかにして、好きに使わせてあげてください」
既存司令塔turn01a097a0-352b-73e3-a15d-8a1ac5c2df2c、2026-09-12T22:30:51Z記録。個別messageIDは現turnAPI未露出なので捏造せず、同じUDL051のADD-20260913-KUROGANE-PALETTE-100へ統合しました。クロガネへのF1抑制だけを置換して100有限回を採用。全10人抑制の旧fa2789cは991PASSでも未レビュー/未公開の置換済み候補です。

実装:
・他9人だけ新policyで無益なpalette候補を抑制。自分のpaletteと公開隣接/封印から、合法色/basic色/永続色の種類数増加を比較し、救済・有用な多様性/bonus節約は残す。未来全探索/全有用手保証ではありません。
・クロガネの新policyは旧split-policyの好み/選択をそのまま保持。CPUseat＋server保存character/policyが一致する初期状態の装備paletteだけ100。リトライ/復元は補充なし。旧21保存policy、PvP、他CPU/カード/hand、カテゴリ制限、private/RNG、F3両役割不変。勝率上昇の実測はしていません。
・SQL002は加算10policy＋開始receipt互換のみ。31supported/30current、旧room/receipt書換0、accept/rematch既存body不変。完全baseline→F3→SQL002をPGlite0.5.8の実SQLで検査（nativeSupabase競合/認証は未実測）。
・新管理値がexact時だけpalette generation。既存split値は維持、未設定/誤値はcurrent/legacyへfallback。開始/CPU fallback/再戦の3経路はserver選択、既存対局は保存版を実行。localbundleは共通moduleから再生成したがlocalは新policy未選択。

検証:
clean9590の148非Playwrightfiles、998/998PASS、skip0、124165.7562ms。F1実engine10、100charge5、実TS handler11、新SQL9を含む。実100→99→98、同窓拒否、再初期化非補充、旧21×84 authored観測（実戦stockhandsではない）を検査。
Windows attempt1はChrome contracts656/656＋online145/145PASS。Edge contracts656/656＋lifecycle79/79PASSですが、online144/145で既存Half/TripleShift390pxの行4text待機30秒timeout。オンラインapp/index/styleと当該testはd9ceから差分0。同じ候補の局所Edge1/1はPASS7541.7016ms、根因未確定です。テストを緩めず原FAIL保持。失敗したEdgejobだけ一度再実行を予定しましたが、connector403とUI連携timeoutで未開始（23:09実APIでattempt1）。現状を全ゲートPASSとしては提示しません。同SHAの実成功が得られるまでは本番変更禁止です。

公開案（承認とゲートが揃った場合のみ）:
指定SQL一回・5/5実読戻し→newflag OFF/oldsplit維持で厳密Edge2file配備/全文読戻し・capability/current→確認完了から460秒以上（実行前に現行上限再確認、全地域保証ではない）→newflagだけexact有効化/palette→forcefree同SHA main/Pages・既存preflight/配信byte検証。rollbackはnewflagだけoff、互換Edge/SQLを残し保存F1を壊さない。
別途提案する有限smoke:1新匿名profile/即時クロガネ1/240秒/1試行/CPU送信最大8/投了送信1。保存新policy・本人membership・観測できたCPU進行・終局snapshot-v2・本人精算を独立記録。既存F3/067の消費済み枠は流用しません。開始済み/終了済みroomの書換、再戦、経済操作、削除、privileged回復0。100手札は局所authoritative証拠であり公開相手projectionから推測しません。harnessは本番前に局所検証、未実装/未実行を成功扱いにしません。CPU先手でなければNOT_OBSERVEDのまま追加roomなし。

v14も受領しました。あなたの実会話user bbb2135e-cfd1-4da8-845b-9e3d07d8b29a（2445文字）とZIP原文を全文照合し、UTF8本文＋LFの宣言hash86ff5072…071c一致。package bfee3540…2b4、12追加aliasを既存UDLへ統合、独立tutorialのみ068。065/023/062の本人再要望は同一原文×UDL各1回で優先度反映。これはCPU差分と別の受領記録です。報酬の記憶値は照合依頼であって採用済み経済変更/rollback確定とせず、司令塔のコード・過去出典照合はNOT_RUN。旧公開・原失敗・067部分受入は維持しています。

DECISION / SUBJECT_SHA / BLOCKERS / NOTESを、上記候補・仕様・DB/Edge/管理値へ固定してお願いします。CI未完を承認で代替せず、必要なら条件を明示してください。文書導入の承認とゲーム公開、v14受領、過去F3受入は分離してください。
