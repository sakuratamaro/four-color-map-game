# Standard Online 通信軽量化の採否と実装記録

更新日: 2026-09-03

## 結論

チャッピー先生との設計レビューを踏まえ、次を採用する。

- 4本のブラウザ直接SELECTを、参加者専用の1本のsnapshot RPCへ統合する。
- Realtimeの本文を状態の正本として使わず、「snapshotを取り直す合図」としてだけ使う。
- snapshot取得は常にsingle-flightとし、取得中の通知は1回の追加取得へ束ねる。
- Realtime正常時の救済pollはplaying/readyが15秒、waiting/finishedが30秒とする。
- Realtime異常時だけ4秒へ短縮する。offlineまたはhiddenでは停止し、復帰時に250msで重複を束ねて再取得する。
- 退出・別ルーム開始後に完了した古い取得結果は、room IDとgenerationで破棄する。
- finishedは即停止しない。再戦・最終プロフィール反映の取りこぼしを避けるため、現段階では30秒の救済pollを残す。

CPU応答を人間の操作と同じEdge呼出し内で処理する案は、通信回数だけでなくDB確定の原子性を満たせる場合に限り採用する。今回の通信基盤変更には混ぜない。

## 実装

- `public.fcg_standard_room_snapshot(uuid)`
  - `auth.uid()`を利用し、引数で利用者IDを受け取らない。
  - 対象ルームの参加者であることを関数内で検証する。
  - room、members、本人のplayer view、本人のStandard profileを1つのJSONへまとめる。
  - 相手のprivate stateと`fcg_private`の正本は返さない。
  - `SECURITY DEFINER`、空の`search_path`、PUBLIC実行権限剥奪を固定する。
  - 読取り時刻やlast_seen_atを更新せず、Realtimeの自己発火ループを作らない。
  - `snapshot_schema_version`、ルームversion、server timeを返す。
- ブラウザ同期制御
  - `fcg_rooms`、`fcg_room_members`、本人にRLSで限定される`fcg_player_views`の変更を同一channelで監視する。
  - イベント本文は画面へ直接適用せず、snapshot RPCを呼ぶ。
  - 同時取得、通知重複、通知中の再通知、ルーム切替中の古い応答を処理する。

`fcg_rooms`だけの購読にはしていない。現行DBのすべての更新処理が、snapshotに含まれる値の変更時に必ず同一の単調増加versionを更新することを、リポジトリ内のmigrationだけでは証明できないためである。将来その不変条件をDBで保証できた時点で、軽量なsignal行1種類へ集約できる。

## 通信量の見込み

30分の2人対戦を、状態変化を除いた救済pollだけで比較する。

- 変更前: `720回 × 2人 × 4 API = 5,760 SELECT API呼出し`
- 変更後（Realtime正常、playing）: `120回 × 2人 × 1 RPC = 240 RPC呼出し`
- 変更後（Realtime異常が30分継続）: `450回 × 2人 × 1 RPC = 900 RPC呼出し`

正常時の救済通信は概算95.8%減る。これはブラウザからのAPI呼出し数の比較であり、RPC内部のDB処理量が同率で減るという意味ではない。実際の総数には、初回取得とゲーム操作に伴うRealtime起因のsnapshot取得が加わる。

## 段階的な公開手順

1. snapshot migrationだけを適用する。旧公開クライアントは従来の4 SELECTを続けるため互換性がある。
2. DB上でA、B、非参加者を使い、A/Bは自分のprivate stateだけ読め、非参加者は読めないことを確認する。
3. 旧4 SELECTとsnapshotの結果一致を同じルームで比較する。
4. 新クライアントを限定公開し、Realtimeあり・遮断・重複・再接続・hidden復帰を確認する。
5. 2端末で作成、参加、完走、再読込復帰、再戦を確認してから通常公開する。

クライアントを先に公開してはいけない。新クライアントはsnapshot RPCが未適用だとルームを読めない。

## 今回に混ぜず、後続で行うもの

- 期限切れ検索チケット、waiting/finishedルーム、receiptsのDB定期バッチ整理
- profileを毎ターンのroom snapshotから外す追加軽量化
- CPU手の原子的確定または`cpu_pending`再試行ジョブ
- 専用signal行またはprivate Broadcastへの将来移行

receiptsは再送可能期間より長く保持し、直後に削除しない。cleanupは本番データを一括削除せず、対象・保持期間・インデックスを確認したうえで小さなバッチにする。

## ローカル検証

- 対象テスト19件: PASS
- リポジトリ直下の`.cjs`テスト51件: PASS
- JavaScript構文検査: PASS
- `git diff --check`: PASS
- ローカル実ブラウザ同期ハーネス: PASS（初回1取得、Realtime通知3件を1タイマーへ集約、次回遅延250ms、console errorなし）

実装中に公開側へ追加されたCPU依存関係とプロフィール復旧の3コミットも取り込んだ。その時点でQuickのブラウザ用エンジンとEdge Function同梱コピーの不一致を既存テストが検出したため、同梱コピーを最新版へ同期し、51件すべての合格を再確認した。

DB適用と公開URLでの検証は未実施であり、公開完了とは扱わない。
