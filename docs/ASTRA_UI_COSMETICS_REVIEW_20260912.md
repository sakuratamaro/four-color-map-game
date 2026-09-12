UDL-061「購入・装備を商品内で完了する」の独立候補レビューをお願いします。結果画面060はb81への実承認016を保存済みですが、Windows Edge初回123/124の既存band選択テスト1件タイムアウトを保持し、同SHAの失敗Edge jobのみ1回再実行中です。まだmainはd6です。061を先に公開することはありません。

SUBJECT_SHA: 0b5d0b2ea7ab510ce107bfc2477e2e275f9a9125
BASE_SHA: b81a1d52e8230d41ec9e69610d89bafc86d1d84e
CURRENT_PUBLIC_FLOOR: d6f745d3f1291457539dd2f3476e9a749a547069
CANON_VERSION: shared-canon-v1.1
FEATURE_SPEC: UDL-061-cosmetics-v1
SPEC_PATH: docs/UI_COSMETIC_ITEM_ACTION_20260912.md
SPEC_BLOB: ebb2229705f4b7e075b97e315b789198ee84126c
SCOPE: Pages_only
DB_CHANGE_SET: []
EDGE_CHANGE_SET: []

固定差分（b81→0b5、15files/300追加49削除、画像なし）:
https://github.com/sakuratamaro/four-color-map-game/compare/b81a1d52e8230d41ec9e69610d89bafc86d1d84e...0b5d0b2ea7ab510ce107bfc2477e2e275f9a9125
固定仕様:
https://github.com/sakuratamaro/four-color-map-game/blob/0b5d0b2ea7ab510ce107bfc2477e2e275f9a9125/docs/UI_COSMETIC_ITEM_ACTION_20260912.md
Windows（実行中、合格とはしません）:
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34661329641

v8実paired user bbb21715-8ab0-4dfb-ad2f-b46883434765 / response c1c1a98e-749e-42ec-8a95-2ef30abd5035、既存UDL061が出典です。ZIPv8も522675bytes/SHA256 CC27C090BFEE5F69A66AA32BC84ED32771A8655D876602ACF077151F0B35587B、manifest47/47を独立検証済み。ZIPの新台帳は作らず既存alias対応のみ。

通常は商品に表示された購入/装備ボタン1click→server quote→表示中の商品ID/購入要否/価格と一致→同actionId/revisionを保存して1回commit→同商品内success。価格等が変わった時だけ同商品内confirm/cancelへ進み、再確認時にまた変われば再表示するだけで送信しません。旧UIの未送信pendingは起動で自動送信しません。送信後ACK不明は同actionId/revision/itemを保存し、reloadでも自動再送せず「購入・装備の結果を確認」でexact retryします。結果不明を取消して未購入と誤表示しないため、送信済み/failedにはcancelを出しません。元のpending DOM IDは対象商品へ移動、商品一覧未取得時はfallbackを維持します。

server/economy/price/catalog/protected ownership/trophy/receipt/client契約は変更なし。現行serverにはexpectedPrice/quote tokenがなく、Edge配備をまたぐatomic価格ロックを新設したとは主張しません。この候補は配備catalog不変を保ち、表示と見積の差を検査するUI変更です。app cache34、pure intent module1。

検証報告: clean0b5 nonbrowser913/913 (83.543s)、installedChrome7/7 (38.668s)、Edge7/7 (29.739s)、skip0、通常owned cleanup、3builder差分0。unchanged item purchase/owned equip、650→取消/675へ再変化、fixtureでserver commit後ACK喪失/reload/exact retry/1receipt、pointer/Enter/Space反復1操作、legacy未送信、localStorage失敗で送信0、残高不足→保存済み売却後有効化を検査。390/768/1280の44px/focus/overflowと4枚の実Chrome画像を目視確認しました。これはfixture検証でlive/物理ではありません。初期576の全体テストは旧app32固定2件で失敗した履歴を保存し、clean0b5の成功へ塗り替えていません。

公開条件:060が同SHAでPUBLIC_VERIFIED、061両Windows SUCCESS、fresh mainがb81から0b5の祖先であること、今回の正確な実承認が必要。変更があれば再提出。公開後はindex/app34/intent1 byte一致、許可済み新規テストプロフィール1件だけで、通常のクイズ→ガチャ→余剰カード売却から得た仮想コインを使い最安の黄金名札350を1回購入、その場success・server ACK/revision/350のみ減算、無料の標準名札へ戻す→所有済み黄金名札再装備で追加減算0、reload/390・1280表示を確認する予定です。資金準備は最大3クイズ/各10回答、最大30抽選、各カード最後の1枚と保護カードを維持した必要分の売却に限定し、足りなければ不足として終了。実通貨購入、任意コイン付与、DB直書き、既存プレイヤーのデータ操作、対局作成、削除、live通信改ざんはしません。未知ACK/価格変化はfixtureに限定、live NOT_RUNと区別します。

DECISION / SUBJECT_SHA / BLOCKERS / NOTESをお願いします。この061は独立した有限レビューで、開始00:24:00Z、20/40/100分の最大3回、期限02:24:00Zを予約します。060の閉じた待機は再開・延長しません。
