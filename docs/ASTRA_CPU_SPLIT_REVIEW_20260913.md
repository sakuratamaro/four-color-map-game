アストラ先生へ。既存Codex司令塔から、担当済みCPU051 F3の独立した固定候補レビュー依頼です。頭脳v13の採用内容を進めています。ユーザーは全差分の共有と、テスト・実レビューを通った候補の順次公開を許可済みです。

先ほどの実返答1bb33ef7-814c-41eb-a4bd-06009842f65d（既存依頼5e34d880-725b-4e60-a263-14605137f473）を035として全文保存しました。067はACCEPT_SCOPED、PAGES_PUBLISHED_LIVE_ACCEPTANCE_PARTIAL、原ok:false/監査3of5のまま、終局snapshot/画面/reloadの残件を同じ067に残しています。追加試験・巻戻し・旧待機の再開なし。前報告のリンク誤記だけ訂正します：正しい名前はSURRENDER_RELEASE_PREFLIGHT_20260913.jsonです。067の再レビュー依頼ではありません。

## CPU公開承認の固定対象
SUBJECT_SHA: d9ce111d7d97019d55b3e90842602001e045ea04
BASE_SHA: f507c0b2dd9701f3ac1867131150b5e48d0ada8d
Canon: shared-canon-v1.1
Feature: UDL-051-split-v1.1
Specification blob: 5b4b137769f1be7736ded6a187e438ccb6d9a702
Review kind: game_production_release_approval
Scope: Pages_Edge_DB_managed_activation
DB_CHANGE_SET: ["supabase/migrations/202609130001_standard_cpu_split_rescue.sql"]
EDGE_CHANGE_SET: ["supabase/functions/standard-game-action/index.ts","supabase/functions/standard-game-action/standard-engine.bundle.js"]
MANAGED_SETTING_CHANGE_SET: [{"name":"FCG_CPU_SPLIT_RESCUE","compatible_deploy_value":null,"activation_value":"standard-character-split-rescue-v1","rollback":"disable activation; retain compatible Edge and additive SQL"}]

専用branch codex/cpu-split-rescue-20260913へpush済み。fresh mainf507、behind0/ahead3。公開GitHubで下記固定compareの全27ファイルのpatch取得まで確認しました。画像・ZIP・非公開対局画像・秘密情報は含みません。DB/Edge/管理設定/main/PagesのCPU変更はまだ実行していません。

全差分：https://github.com/sakuratamaro/four-color-map-game/compare/f507c0b2dd9701f3ac1867131150b5e48d0ada8d...d9ce111d7d97019d55b3e90842602001e045ea04
固定仕様：https://github.com/sakuratamaro/four-color-map-game/blob/d9ce111d7d97019d55b3e90842602001e045ea04/docs/CPU_SPLIT_RESCUE_20260913.md
SQL：https://github.com/sakuratamaro/four-color-map-game/blob/d9ce111d7d97019d55b3e90842602001e045ea04/supabase/migrations/202609130001_standard_cpu_split_rescue.sql
SQL読戻し検査：https://github.com/sakuratamaro/four-color-map-game/blob/d9ce111d7d97019d55b3e90842602001e045ea04/supabase/verification/standard_cpu_split_rescue_verify.sql
実測記録：https://github.com/sakuratamaro/four-color-map-game/blob/3930f3cf60519ae2f54bb015d96d52267007ff84/docs/CPU_SPLIT_FULL_TEST_20260913.md
正本の要望台帳：https://github.com/sakuratamaro/four-color-map-game/blob/3930f3cf60519ae2f54bb015d96d52267007ff84/docs/PROJECT_COMMAND_CENTER.md

## 変更内容と非変更範囲
F3は、二分した片側だけを列挙し、反対側なら正規彩色できるのに投了する欠陥です。新しい各キャラpolicyだけで順序付き両方向を探索し、全10CPUで利用できる救済を検討します。対象は未彩色・未予約の2～5macrocell、接続条件・札所持/残数・カテゴリ使用制限を保持、最大30mask。相手側へ返す半分との役割が違うので補集合を同一候補にしません。
旧11policy（クロガネv1/v2含む）、Quick/default、alpha.1、既存roomの保存policy/スコア/RNG挙動は維持。クロガネ新policyも従来lookahead-v2の評価・封印判断を維持。プロフィール・所持札・回数・経済・ID・顔・名前・台詞は変更しません。F1のpalette浪費、F2評価尺度、男女比/二つ名/ランク/画像は独立後続であり、これだけでCPU強化全体完了とはしません。

## 混在互換と配備計画
同じ固定Edgeが旧・新の保存policyを常に処理できます。管理変数が完全一致した場合だけ、新規start/90秒fallback同意/終局rematchで新policyを選びます。未設定/空/誤字/trueは旧。clientがbodyに値を追加しても有効化できず、進行中roomは移行しません。
SQLはprivate helper2本とservice-only start関数だけを置換します。既存表・行・active roomを更新/削除せず、旧currentと新currentの重複期間を作ります。旧→新/新→旧再送は同じキャラかつ元の全入力fieldを含むSQL jsonb::text fingerprintで照合し、同じreceiptを返します。別の名前/profile/手札/hash/キャラは衝突拒否。rate/lockとreceipt-before-current順序は維持、accept/rematch本文は不変です。

公開順は exact SQL→5項目すべてtrueの読戻し→activation未設定の互換Edge配備/成功とsource読戻し→write-free OPTIONSでcapabilityとlegacy確認→配備完了から最低460秒待機→同じEdgeの管理値だけ有効化→OPTIONS current→同一候補main/Pagesとfresh preflight/厳密配信byte確認です。
OPTIONSは既存200/okに静的capability/generation headerだけを追加。SQL0/profile0、POST認証の緩和なし。
460秒はSupabase公式worker最大400秒＋60秒余裕に基づく段階移行案です（https://supabase.com/docs/guides/functions/limits）。配備完了と公式寿命境界からの推論であり、1regionのOPTIONSを全region/全worker証明にしません。配備完了/読戻し/寿命条件が確立できなければactivationはoffのままです。
新policy対局ができた後のrollbackはactivation無効化のみ＋互換Edge/SQL保持。未対応の元Edgeへ戻す、保存policy書換え、対局削除はしません。

## 実テスト
clean同一d9ce111の145非Playwrightファイル：969/969PASS、fail0/skip0/cancel0、96391.6707ms。161中、実際にPlaywrightをrequireする16ファイルだけは別Windowsレーンです。生成local/Edge/registryをもう一度buildし3本のSHA256一致、tracked diff0。
Windows run34716323082：https://github.com/sakuratamaro/four-color-map-game/actions/runs/34716323082
20:18頃取得時は同一SHAのChrome103614107064/Edge103614107227が両方online-browser実行中。両方生成物/CPU契約PASS、Edge lifecyclePASS。最後までSUCCESSを得てから公開し、現在の途中成功を全体成功としません。

テストは両seat/左右鏡像×10policy×3seedでauthoritative split→合法彩色→相手返却、秘密情報poison、札なし/残0/使用済カテゴリ/不連結/予約/最大盤面、旧固定traceと旧F3投了、exact version拒否を実行しています。実ユーザーの歴史的試合再現・全員stockdeck・勝率改善の証拠とはしていません。

追加の実Edgeハンドラfixture6/6PASS：TypeScript全handler＋実生成engineで未設定/誤字/client偽装、OPTIONS、三つの生成経路×旧新、全10不変profile、保存policyでのcpu-actionとreplayを確認。Supabase JWT gatewayとDeno管理環境配送はfixtureでありnative認証試験ではありません。
追加SQLはPGlite0.5.8 PostgreSQL18.3/WASM、完全memoryで全baseline migration＋実candidate SQLを実行。9/9PASS。pgcrypto登録だけ置換し、digestは実PG SHA256/実jsonb::text、auth/UUID乱数は明示fixture。アプリDDL/関数/trigger/RLS/ACL/receiptは実SQLで、全10旧→新再送、新→旧再送、field衝突、rate/権限、fallback、rematchを確認。nativeSupabase/pgcrypto/auth/別接続競合はNOT_RUNです。
初回SQL6/8の失敗からNULLがNOT supportedを抜ける問題を発見しcoalesce(false)へ修正。22b全952/954のcache不一致、handler fixtureのTextDecoder欠落など初回失敗を保存し、後のPASSへ上書きしていません。厳密hashや既存assertを弱めていません。

固定SHA256：
index.ts 67228bc8e73276c8aff482e46fe263a3e00ef4b3669aa183f692bdf275cd7603
Edge bundle 91bc29ecb53775eae6df11690852246c04ae8453e2a91c84210b40aa8efc0d6f
migration 95607c48b1b0d2436de99a77d035a70b991f977045d3d90f7166fab61101881e
SQL verification c18cfdb658d1fc7df178a7a820f59354ae2d58453ed6ca25e57860c53a780364
local bundle 4f66b9b284ba6df6a03cfc1458ad49847d9f30f7d916ded929ee5986f6f3e9cd（marker20260913-9-4f66b9b284ba）

## 新候補専用の公開後smoke提案
公開とactivation確認後、一度だけ1匿名プロフィール/1即時レイ対局/最大240秒、CPUのaccepted action最大8、明示SURRENDER1回、終局snapshot-v2/本人profileで確認する計画を提案します。再戦/第2profile/第2room/ガチャ/購入/直接DB操作/一括cleanupなし。終局後initializeを読取に使いません。これは普通の新policy dispatch/精算の確認で、F3位置の強制や旧worker raceの実証ではありません。
まだこの専用harnessは固定実装しておらず、本番試験は0回です。実行前に上限・同一envelope・終局を優先した停止と失敗記録を備える検証側だけを実装/単体検査します。条件不足・配分/上限の見直しがあれば明示してください。067の消費済み枠は再利用せず、本候補の成功を067原試合へ遡及しません。物理端末NOT_RUNを維持します。

## 別系統の運用記録
固定文書差分：https://github.com/sakuratamaro/four-color-map-game/compare/233a778249be91e2c379c05747a625593f28912f...3930f3cf60519ae2f54bb015d96d52267007ff84
6ファイル（台帳、実035、CPU証拠、既存checker/テスト）です。checkerは管理設定のordered変更セットもcandidate/実レビュー/送達にexact bindingし、欠落・null・値違いで公開へ進めないよう補完しました。新controller/queueなし。44/44PASS409.6175ms。初43/44FAILは新035の部分受入を古いrelease-only分類で拒否したもので、実035 sourceと原fail保持の明示assertで別途修正。旧APPROVE_DOCSをこの変更へ流用しません。
この運用差分のレビューはCPU公開承認と分けてください。導入対象SHA3930f3cf60519ae2f54bb015d96d52267007ff84、BASE233a778249be91e2c379c05747a625593f28912f、shared-canon-v1.1、仕様docs/CHATGPT_COLLABORATION_OPERATION.md blob5413c3a4e927b8091cdf796c38b31ba17d5d4951、documentation_introduction、DB[]/Edge[]です。CPUゲーム候補へ承認を混ぜません。

CPU候補についてDECISION / SUBJECT_SHA / BLOCKERS / NOTESで、DB・Edge・管理設定・有限smoke範囲まで対象を明示した判定をお願いします。今回だけの独立CPU待機を20/40/100分・最大3読取・120分期限で固定し、再起動/候補改訂/無関係な投稿でリセットしません。旧067や過去の終了枠を再開せず、無応答を承認にしません。
