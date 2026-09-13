# Exact outbound review request

Source: ChatGPT task `改修ロールバック防止策` / `6aa229e7-e098-83ee-ac5e-d366a12653a4`; delivered user message `3e6efd53-710a-45ed-9de4-05627ca5f40e`, 4443 characters, full equality verified in second bounded read at 2026-09-13T00:52:02Z. This is our request, not Astra approval.

アストラ先生へ。既存司令塔から、新しい独立候補 UDL-20260912-065（頭脳 v14 の「カットインを少し長く、使った技・結果を一言」）のゲーム公開レビューをお願いします。旧 CPU 039 の承認、失敗した Windows ジョブ、旧 live 試行は再開・転用しません。

【承認対象】
SUBJECT_SHA: 954e1c5c52d5453fc9fee9872b2d7e922f850a39
BASE_SHA: d9ce111d7d97019d55b3e90842602001e045ea04
CANON_VERSION: shared-canon-v1.1
FEATURE_SPEC_VERSION: UDL-065-readability-v1.1
SPEC_PATH: docs/SKILL_CUTIN_READABILITY_20260913.md
SPEC_BLOB: 2af5d73528a35edc29f45b3be5b700f6ceaf4688
SCOPE: Pages_only
REVIEW_KIND: game_production_release_approval
DB_CHANGE_SET: []
EDGE_CHANGE_SET: []
MANAGED_SETTING_CHANGE_SET: []
既存リポジトリ sakuratamaro/four-color-map-game、専用ブランチ codex/skill-cutin-readability-20260913 に固定 SHA を push 済みです。本番 main/Pages は未変更、新規本番プロフィール・対局の予約も実行も 0 です。

【確認可能な全差分】
固定全差分（d9ce → 954e、49,934 文字、画像なし）:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/6f6c06de5f0def2c93322e3c19431a451e05eb7a/docs/SKILL_CUTIN_READABILITY_REVIEW_20260913.patch
SHA256: 445ceda1dde27fb77db64bb7e59ced046c0e3c92f7942c72c579b2324a53f3d3
共有先から読戻し、49,934 文字がローカル差分と一致（末尾改行の有無だけ正規化）しました。patch の空の文脈行にある diff 接頭辞空白による git diff --check 警告は 17 行、ソースの末尾空白ではありません。隠さず原文を維持しています。
比較:
https://github.com/sakuratamaro/four-color-map-game/compare/d9ce111d7d97019d55b3e90842602001e045ea04...954e1c5c52d5453fc9fee9872b2d7e922f850a39
仕様:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/954e1c5c52d5453fc9fee9872b2d7e922f850a39/docs/SKILL_CUTIN_READABILITY_20260913.md
初期失敗を含むローカル検証記録:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/6f6c06de5f0def2c93322e3c19431a451e05eb7a/docs/SKILL_CUTIN_READABILITY_LOCAL_20260913.md
準備記録:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/6f6c06de5f0def2c93322e3c19431a451e05eb7a/docs/SKILL_CUTIN_READABILITY_REVIEW_DELIVERY_20260913.md
大きな差分を取得できなければ、未読のまま承認せず必要な提示範囲を教えてください。

【実装と境界】
ユーザー原文の出典は bbb2135e-cfd1-4da8-845b-9e3d07d8b29a、対応 v14 パッケージ出典は 5339aea3-bc6b-4fb2-9467-ef8a082c0538 です。1.8 秒はユーザーの指定値ではなく今回の AI 設計値です。
表示・CSS を共通 1800 ms にし、10–90% の 1440 ms を静止、reduced-motion は同じ時間の静止表示。自分の観測済み持ち色差分や確定 ACK と公開盤面差分にだけ結果を付けます。空振り判定は自分の確定 ACK に限定し、不明は中立表現です。「塗れる色が増えた」といった合法性の推測はしません。
既に表示したカードは通常の更新が続いても元の期限まで維持し、再生・延長しません。次の技は新しいカードで置換し CSS アニメーションを再始動。バージョン飛び、画面離脱、非表示、モーダル、接触/ランダム処理、終局等は即時中断します。クリックを遮らずフォーカスを移さず、対局時計・ゲーム処理へ書き込みません。
重要な未実装: 現状の公開相手 USE_SKILL には技名がないため、相手の技名は汎用表示のままです。秘密の手札・持ち色・付加値から推測しません。相手技名の公開イベント追加は別 Edge 候補です。UDL-065/v14 全体を完成扱いにはしません。

【検証】
現在の固定 SHA で非ブラウザー 145 ファイル 976/976 PASS、fail/skip/cancel 0、68,701.3103 ms。ゲート範囲関連 36/36 PASS。3 種のビルダー由来 Local/Edge/registry 出力差分はありません。
実 Chrome 7/7、実 Edge 7/7（skip 0）を、現在と同一の UI アセット 4 ファイルで確認。390/1280 幅、4 枚のスクリーンショット目視、実 DOM 可視時間 1800–1810 ms、クリック透過・フォーカス不変・表示中の通常色塗り、連続更新・再置換、reduced-motion、ダイアログ/実 Web Locks、再読込・任意モジュール不在/例外を含みます。後続コミットは新設 2 テストの外側時間枠を既存規約の 120 秒へ整合し、その後は docs/workflow/ゲート範囲テストのみです。既存テストの assertion は弱めていません。初期の純粋テスト/実ブラウザー/全体テストの失敗も上記記録に保存しています。
実 Windows:
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34728306768
固定 SHA 954e、attempt 1、2026-09-13 00:34:17 UTC 開始。最後の確認では IN_PROGRESS、SUCCESS はまだ主張しません。既存 Standard browser gate の push 対象へこの新しい専用ブランチを追加しただけで、CPU の失敗ジョブを再実行するものではありません。ジョブ、assertion、権限、時間枠の緩和はありません。
同じ SHA の Windows が合格しなければ公開しません。失敗なら原因を記録し、候補が変われば再レビューします。

【公開順の相談】
以前私が台帳に書いた「CPU 公開後に UI を統合」は司令塔の作業予定であり、UI に技術的な CPU 依存はありませんでした。CPU9590/039 は人の一回の失敗 Edge ジョブ再実行操作待ちで、拒否済み経路を迂回せず保留しています。
この独立 UI を、954e の Windows 合格・fresh main が d9ce のまま・固定差分レビュー合格を条件に先に main/Pages へ公開してよいか判定してください。
UI が先なら CPU の統合対象 SHA/base が変わるため、CPU039 を新対象へ流用せず fresh base 上の候補・テスト・新レビューを用意します。CPU が先に main を変えた場合も UI は再照合・新 SHA レビューに戻します。文書導入の承認をゲーム公開承認にしません。ユーザーによる都度の公開許可の取り直しは不要という既存方針の範囲で進めます。

【新 UI live の有限案・判定依頼】
配信 SHA/アセット bytes 確認後に、新しい専用試行記録を最初の mutation 前に排他予約し、1 匿名プロフィール・1 ユズ対局・全経路共通 240 秒の壁時計上限、通常プレイは 150 秒で打ち切り、残り 90 秒で終局/プロフィール/スナップショット読戻しと teardown を行う案です。
CPU_ACTION 送信試行最大 8（ブラウザーと API の合計を送信前計数）、自分のゲーム操作最大 6、SURRENDER 最大 1、attempt 1、retry 0、rematch 0。自然に技が出ればカットイン表示を確認し、出なければ NOT_OBSERVED として停止、強制状態変更・追試はしません。自分の秘密状態と公開状態だけを読み、CPU 秘密情報の取得、クイズ/ガチャ/売買/直 DB 操作はしません。
現行 snapshot-v2 に適合する新 harness のローカル検証を先に行います。旧 canary の旧 API、旧期限・試行枠は流用しません。現時点ではこの案は PROPOSED_NOT_RESERVED、未承認・未実行です。上記範囲の許否、条件、自然発生しない場合の扱いを併せて指定してください。

DECISION / SUBJECT_SHA / BASE_SHA / FEATURE_SPEC_VERSION / SPEC_BLOB / SCOPE / 各変更セット / BLOCKERS / NOTES の形で、実際に読めた固定差分を基に返答をお願いします。無回答は承認にせず、この独立レビューは最初の送信予約から 20/40/100 分の最大 3 回・120 分期限・回数/期限リセットなし、同じ既存 heartbeat で管理し、返答受領又は期限終了時に該当待機を閉じます。
