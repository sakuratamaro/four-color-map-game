# Standard公開版 段階リリース手順

更新日: 2026-09-03

状態: 実行前。公開DB、Edge Function、Pagesを変更する作業は利用者の明示承認後にだけ行う。この文書を作っただけでは本番は変わらない。

## 完了の定義

migrationやコードの配置だけでは完了にしない。最新の公開URLと別々の二端末で、合言葉対戦と野良対戦を最後まで行い、再読込、再戦、新しい試合を確認する。さらに実時間90秒待機後に明示同意したCPU戦を完走し、報酬、ガチャ、カード、対人/CPU別戦績、トロフィー、見た目が再読込後も保持されること、private情報が漏れないこと、軽量化の呼出数とbytesを実測して初めて公開完了とする。

## 変更前の読取り確認

1. 対象Supabase project refが `qkcuhludisairpgzhryl` であることを画面上で再確認する。
2. Git作業ツリーがcleanで、公開候補commitが記録済みであることを確認する。
3. 現行Pages commit、現行 `standard-game-action` version、適用済み関数を記録する。
4. Security Advisor、Performance Advisor、API/Database/Edge使用量の変更前snapshotを保存する。
5. `fcg_standard_room_snapshot(uuid)` が存在し、`202609030006` 以降の新規関数/表が未適用であることを読取りSQLで確認する。

確認結果が想定と違う場合は適用を止め、現物に合わせて手順を更新する。

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

各実行直後に、そのmigrationが追加する表、関数、列、ACLを `to_regclass`、`to_regprocedure`、`information_schema.columns`、`proacl` で確認する。`SECURITY DEFINER` 関数は空の `search_path`、ブラウザー用RPCは `authenticated` のみ、サーバー用RPCは `service_role` のみであることを確認してから次へ進む。

`202609030012` の適用時にはcleanupを実行しない。定期実行も作らない。`202609030013` の既存プロフィールappearance backfill件数と所要時間を記録し、失敗または長時間ロックならEdge/Pagesへ進まない。

## EdgeとPagesの順序

1. DB 8本の確認が終わってから `standard-game-action` を更新する。
2. JWT検証が有効なこと、managed service-role secretの参照だけで値を表示していないことを確認する。
3. Edgeへ、欠落JWT、改変JWT、正規JWT、プロフィール読取り、見た目catalog、CPU rosterの小さなcanaryを行う。
4. Edgeが正常なまま、StandardオンラインPagesを公開する。
5. Pagesの公開commitとbuild成功を確認し、キャッシュをまたぐ通常URLの新しいブラウザーで確認する。

新クライアントは `fcg_standard_room_snapshot_v2(uuid,bigint)` を必須とするため、PagesをDBより先に公開しない。

## 段階canary

### A. 合言葉対戦

- 二端末A/Bで作成、参加、6枚選択、初期化、通常手、スキル、終局、両者再読込、再戦を確認する。
- 第三者Cのsnapshotと直接table更新が拒否されることを確認する。
- snapshot v2の同revision応答で `profile=null`、profile revision更新時だけ本文が返ることを確認する。

### B. 経済・進行・見た目

- クイズ10問の報酬が一度だけ、ガチャの券消費/付与が一度だけ保存される。
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

## 軽量化・負荷の合格条件

- `scripts/live-standard-room-snapshot-smoke.mjs --confirm-live` で完全snapshotより同revision差分snapshotのbytesが小さい。
- Realtime正常時は重複通知がsingle-flightへまとまり、playing中の救済pollは15秒間隔で1 RPC、hidden/offline中は停止する。
- 旧4 SELECT方式に戻っていない。30分2人対戦の救済通信見込みは5,760 SELECTから240 RPCで、実測値には操作起因の通知分を別記する。
- 正常な最速CPU進行と二端末操作がEdgeの濫用抑止に触れず、明示的な過剰canaryだけが429になる。
- DB/Edgeのp50、p95、エラー率、Database/Edge/Realtime使用量を変更前後で記録し、悪化時は公開範囲を広げない。

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
- cleanupはpreview結果だけ。実削除を承認・実行した場合のみ件数と保持境界。
