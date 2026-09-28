# 熟考モード setup のカード種類数

Specification: `UDL011-local-card-count-v1`

Base: `d68b22bbbafeca896400bedcda1605ce646a5d0e`

新カード追加（UDL-20260906-011 / UDL-20260911-056）に伴う既存表示の修正。`standard-v5` の熟考モード説明が通常カード24種になっても `/19枚` と表示していた。

## 受入条件

- 「使用可能 N/T種類」と表示する。Tは描画と同じ `STANDARD_SKILL_IDS.length`、Nはその集合のうち `profile.cards[id].available > 0` の種類数。
- 同じカードを複数枚持っていても1種類。使用可能0の在庫、実験札、未知IDは分子に含めない。未所持の旧saveは0種類として扱い、在庫を追加しない。
- カード種類数を別の固定数へ置換せず、registryの増減へ自動追従する。
- 名前は既存のtextContentで表示する。空save、α回帰用モード、開始条件、カテゴリ2枚選択、在庫・save・対戦処理は変更しない。
- Chrome/Edgeのlocal画面で、種類数・α切替/再読込・在庫/save不変を確認する。これは本番/物理端末確認とは分ける。

変更範囲はlocal UI、再生成bundleとcache marker、その配信byteを照合する既存preflightの期待hash、既存Windows登録済みテスト内の追加ケース/期待marker、本仕様のみ。online製品、engine/registry、画像、報酬/ガチャ率、DB、Edge、設定は変更しない。独立した未公開の色交換/反転・再彩色予約のコードや承認を含めない。
