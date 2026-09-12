UDL-060のB1局所修正版を再提出します。実REQUEST_CHANGES c48e8537-8d5e-4076-904e-1443382115f0（CHATGPT-REVIEW-20260912-015）への対応です。061や文言整理全体は含みません。

SUBJECT_SHA: b81a1d52e8230d41ec9e69610d89bafc86d1d84e
BASE_SHA: d6f745d3f1291457539dd2f3476e9a749a547069
CANON_VERSION: shared-canon-v1.1
FEATURE_SPEC: UDL-060-result-v1.1
SPEC_PATH: docs/UI_RESULT_CONTINUATION_20260912.md
SPEC_BLOB: 54cd9c8a945fcc84dff1354733fad6a32cc5624a
SCOPE: Pages_only
DB_CHANGE_SET: []
EDGE_CHANGE_SET: []

固定候補:
https://github.com/sakuratamaro/four-color-map-game/commit/b81a1d52e8230d41ec9e69610d89bafc86d1d84e
今回の局所差分（ccc9→b81、11既存files、33追加/14削除、画像なし）:
https://github.com/sakuratamaro/four-color-map-game/compare/ccc9e91e0d1fecb74ce693b15d324c375671f8a1...b81a1d52e8230d41ec9e69610d89bafc86d1d84e
固定仕様:
https://github.com/sakuratamaro/four-color-map-game/blob/b81a1d52e8230d41ec9e69610d89bafc86d1d84e/docs/UI_RESULT_CONTINUATION_20260912.md

B1修正: overlayのterminalChooseAnotherをhumanでは「結果を閉じて別の相手を選ぶ」、CPUでは「別のCPUを選ぶ」と分岐。hidden初期HTMLもhumanの明示close表記。確認ダイアログ・追加clickなし。通常navigationの保持、明示client-only close、CPU picker取消・結果保持は変更しません。app cache33と契約だけ同期しました。

追加回帰: human overlayの明示ラベル→client room参照null→server fixture room/profile/history/tickets不変→募集/検索/生成等write0→相手選択入口表示。CPU picker取消とfocus復帰は既存テストを維持しCPUラベルも照合。旧ccc9 Windows両SUCCESSは過去候補の証拠として残し、新b81へ流用しません。

新b81ローカル: clean nonbrowser910/910 (130.601秒)、installed Chrome12/12 (96.753秒)、Edge12/12 (127.050秒)、skip0。3builder後tracked差分0。これらはCodex実施報告で、Astra再実行済みとはしません。
新Windows34659862518:
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34659862518
提出前の00:08Z確認では両jobがonline-browser step実行中、まだSUCCESSではありません。コード・仕様の再確認と並行して走らせています。本番には同SHAの両job SUCCESS・fresh main祖先確認がそろうまで進みません。

公開mainはd6のまま。b81 main/Pages/live/物理はNOT_RUN。承認とWindows合格後、同SHA Pages→4asset byte一致→新規テストプロフィール1件/CPU対局1件の通常操作・明示投了・保存済み実報酬Lvからガチャ移動（draw0）・390/1280結果UI・reload・CPU picker取消・client-only close・server保存内容不変を有限検証します。live対人戦や実物端末はNOT_RUNと分けます。既存ユーザーの操作・削除・画像・DB/Edge変更はありません。

DECISION、SUBJECT_SHA、BLOCKERS、NOTESをこの固定対象へお願いします。Windows確認がまだなら、その条件を明示してください。Codex自己承認や前候補の承認流用はしません。元依頼5aa5bf01の23:29:13Z開始、01:29:13Z期限、20/40/100分・最大3回・既消費1回を維持し、修正でリセットしません。
