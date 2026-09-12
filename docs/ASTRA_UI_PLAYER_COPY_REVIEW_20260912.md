# UDL062 review packet — prepared, NOT SENT

SUBJECT_SHA: 6f8aeab0cbdfe9e013541f5cf30e16c93fb18cd3
BASE_SHA: a757c126e1325532bb11a719cf92d0d13401d3ae
CANON_VERSION: shared-canon-v1.1
FEATURE_SPEC: UDL-062-copy-v1
SPEC_PATH: docs/UI_PLAYER_COPY_20260912.md
SPEC_BLOB: 9a3488f3b7e5d2c94666a64529a679bc863d8171
SCOPE: Pages_only
DB_CHANGE_SET: []
EDGE_CHANGE_SET: []

固定差分（15files、132追加75削除、画像なし）:
https://github.com/sakuratamaro/four-color-map-game/compare/a757c126e1325532bb11a719cf92d0d13401d3ae...6f8aeab0cbdfe9e013541f5cf30e16c93fb18cd3
固定仕様:
https://github.com/sakuratamaro/four-color-map-game/blob/6f8aeab0cbdfe9e013541f5cf30e16c93fb18cd3/docs/UI_PLAYER_COPY_20260912.md
Windows:
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34664375319

既存v8 paired userbbb21715-8ab0-4dfb-ad2f-b46883434765 / designc1c1a98e-749e-42ec-8a95-2ef30abd5035、UDL062の通常表示を平易化する要求です。匿名セッション/UUID/同期データ/同処理IDの通常表示を、接続済み・プレイヤー情報保存・前回の結果確認へ変更。診断は明示して開く「接続の詳細（調査用）」の中に保持します。エラーや重要なpalette変更原因、ルール/価格/排出率/creditsを削除しません。

製品変更はapp/indexの表示文字列だけ、キャッシュ37。client/サーバー/DB/Edge/ID生成/保存key/ACK/状態遷移/ガチャ・売却・再戦の冪等性とroom保持は不変。061 B1修正a757を通常mergeし、35/36だけの競合を37へ一致させました。旧の確定拒否不能へ戻していません。code差分にクイズQ10調査、CPU、画像、カード追加は混ぜません。

検証: clean6f8全917/917 (58.010s)、実Chrome6/6 (31.806s)、Edge6/6 (29.484s)、skip0、生成3builder差分0。新診断optional390/1280、接続badge各tab/offline、lost lab setup同ID、persisted rematch同ID、CPU saved/unsaved表示、親061 stale revision reload回復を実browserで確認。旧77の全件913/915はhandoff旧文言assert2件FAILを保存、修正358640cと正常merge後に再実行しました。live/物理はNOT_RUN。Windowsの実結果は送信直前に証拠へ追記し、見込みでSUCCESSとしません。

前便061のreview取込中なので、この文書はまだ送信していません。相手生成中に追送しない。061の公開確認、062自身の実APPROVE_RELEASE・Windows両成功・fresh main=a757を確認した後だけ062を公開し、親の承認を流用しません。公開後はindex/app37厳密byte一致と、許可済み新規profile1・通常接続/各tab/閉じた診断を開く/390・1280/reloadのread-only実画面確認を計画。新対局/quiz/draw/sale0、物理NOT_RUN。送信時に独立062の有限待機開始を記録し、古い061予算を延長しません。

DECISION / SUBJECT_SHA / BLOCKERS / NOTESをお願いします。
