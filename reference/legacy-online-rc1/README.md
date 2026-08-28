# Four Color Map Game v5.0 Online RC1

v4.9のゲーム本体を維持しつつ、Supabaseを利用した別端末間の2人対戦を追加したリリース候補です。

## 重要：最初に1回だけSupabaseへSQLを適用する

1. Supabase Dashboardで対象プロジェクトを開く。
2. 左メニューの **SQL Editor** を開く。
3. `supabase/001_online_rooms.sql` の内容をすべて貼り付ける。
4. **Run** を押す。
5. エラーが表示されなければ完了。APIスキーマへの反映に数十秒かかる場合があります。

このSQLを実行するまでは、ゲーム画面に「Supabaseの初期SQLが未実行です」と表示され、ルームを作成できません。

## 起動方法

### GitHub Pages等へ配置する場合

このフォルダの構成を維持したまま公開してください。

```text
index.html
online-config.js
supabase/
  001_online_rooms.sql
```

`index.html` と `online-config.js` は同じ階層に置く必要があります。

### ローカルで確認する場合

`index.html` をChromeまたはEdgeで開きます。ブラウザの制約で動作しない場合は、ローカルHTTPサーバーから開いてください。

Pythonが利用できる端末では、このフォルダで次を実行できます。

```powershell
py -m http.server 8080
```

その後、ブラウザで `http://localhost:8080/` を開きます。

## オンライン対戦の始め方

### 端末A：ルーム作成者

1. 起動画面で **オンライン対戦を選ぶ** を押す。
2. 表示名を入力する。
3. 合言葉を入力する。推測されにくい8文字以上を推奨。
4. **部屋を作る** を押す。
5. 表示された合言葉を端末Bへ伝える。

### 端末B：参加者

1. 同じゲームURLを別端末または別ブラウザで開く。
2. **オンライン対戦を選ぶ** を押す。
3. 表示名と、端末Aから受け取った合言葉を入力する。
4. **参加する** を押す。

参加後は盤面・手番が自動同期されます。画面を端末間で渡す必要はありません。

## 実装したオンライン機能

- Supabase匿名認証
- 合言葉による待機ルーム作成・参加
- Player A／Player Bの固定席
- 盤面、手番、スキル効果、公開ログの同期
- Supabase Realtimeと2.5秒間隔ポーリングの併用
- 更新versionによる競合検出
- 相手手番中の操作禁止
- 相手の持ち色・持込カードを画面上で非表示
- 同じブラウザ・同じサイトデータからの再接続
- 作成者による同一ルーム再戦
- 24時間操作がないルームの失効
- 熟考モードで使用したカードを各端末のローカル在庫へ反映
- 従来の同一端末2人対戦も継続利用可能

## セキュリティ設計

`online-config.js` に入っているのはブラウザ公開用のProject URLとPublishable keyだけです。このキーは公開クライアントで使う前提ですが、データ保護はSQLで設定するRLSに依存します。

SQLでは次を実施します。

- `fc_game_rooms` のRLSを有効化
- ルーム行を読めるのは参加中の匿名ユーザー2名だけ
- テーブルへの直接書込みを禁止
- 状態変更をSECURITY DEFINER RPCへ限定
- 現在手番のユーザー以外による状態更新を拒否
- version不一致の上書きを拒否
- ゲーム状態を2 MiB以下に制限
- 待機ルームの合言葉はSHA-256ハッシュのみ保存
- ルームを24時間で失効

次の情報はHTML、ZIP、GitHub、チャットへ入れないでください。

- `sb_secret_...`
- `service_role` key
- Database password
- Database connection string

## RC1の既知の制約

### 対戦相手に対する完全なチート防止ではない

RLSは第三者からの閲覧・改変を防ぎますが、RC1では対戦状態全体を参加者2名が取得します。通常画面では相手の秘密情報を隠しますが、参加者本人がブラウザ開発者ツールで通信内容を解析する行為までは防止していません。夫婦・知人間の試用向けです。

完全な対戦競技性を求める場合は、秘密情報をプレイヤー別テーブルへ分離し、手の検証をサーバー側のRPCまたはEdge Functionへ移す必要があります。

### 匿名ユーザーはブラウザ保存データに依存する

同じ端末でも、サイトデータを削除した場合やシークレットモードを閉じた場合は匿名ユーザーIDが失われます。進行中ルームへ同じ席として戻れなくなるため、対戦中はサイトデータを削除しないでください。

### CAPTCHAは未設定

少人数試用を優先し、CAPTCHA連携は含めていません。公開範囲を広げる前にCloudflare Turnstile等の導入とレート制限を検討してください。

## 構成

```text
four-color-map-game-v5.0-online-rc1/
├─ index.html
├─ online-config.js
├─ README.md
├─ VERSION.md
├─ SOURCE-v4.9.txt
├─ SHA256SUMS.txt
├─ supabase/
│  └─ 001_online_rooms.sql
└─ docs/
   ├─ TEST_CHECKLIST.md
   ├─ IMPLEMENTATION_NOTES.md
   └─ smoke-online-report.json
```

## 検証状況

- JavaScript構文検査：合格
- Chromiumローカル起動スモークテスト：合格
- モックSupabaseを使った2ブラウザE2E：合格
  - ルーム作成
  - 合言葉表示
  - 2人目参加
  - 初期盤面同期
  - AによるR1指定
  - BによるR1彩色・R2指定
  - Aへの手番返却
  - 双方のversion／盤面一致
  - 相手秘密情報のUIマスク
- 実Supabaseプロジェクトでの試験：SQL適用後に実施が必要

