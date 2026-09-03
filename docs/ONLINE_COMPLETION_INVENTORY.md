# オンライン完成版の機能棚卸し

更新日: 2026-09-03

状態: 統合ブランチ `codex/standard-transport-lite` の現物を基準にした棚卸し。公開環境は別作業で更新中のため、最終公開ゲートを通るまでは「公開確認済み」とみなさない。

## 判定の意味

- **実装済み**: 現在の統合ブランチに、再構築できるソース、DB定義、試験がそろう。
- **公開済み（要再確認）**: 過去に公開動作の証拠があるが、最新一式で二端末の最終確認が必要。
- **ローカルのみ**: ローカルStandardには完成実装と試験があるが、オンラインUI/API/DB境界が未完成。
- **構想のみ**: 設計文書はあるが、実装はまだない。
- **保留**: 意図的に実装していない。バランスまたはルール判断後にだけ再検討する。

## 棚卸し結果

| 項目 | 現在地 | 採用方針 | 完了に必要なこと | 根拠 |
| --- | --- | --- | --- | --- |
| 合言葉ルームの二人対戦 | 公開済み（要再確認）・ソース実装済み | 維持 | 最新一式で二端末の作成、参加、完走、再読込、新しい試合 | `standard-online-v5/`、Standard room/RPC migrations |
| Standard 19スキル | 実装済み | 採用 | 公開二端末で代表操作と一試合完走、全19種は自動試験で保証 | `standard/`、`STANDARD_MODE_SKILL_MATRIX.md`、生成済みEdge bundle |
| 権威的サーバー処理・private projection | 実装済み | 採用 | 最新migration/Edgeの適用後に非メンバー拒否とA/B情報分離を実環境確認 | `standard-game-action`、match/action migrations |
| プロフィール・ロードアウト・カード消費・精算 | 実装済み | 採用 | 再試行、競合、再読込を含む公開確認 | profile/loadout/commit RPC、transaction tests |
| 待機中クイズと報酬 | ソース実装済み・公開確認作業中 | 採用 | 公開で10問、報酬一回、再読込を確認 | quiz migration、Edge operations、online quiz UI/tests |
| ガチャとカード所持 | ソース実装済み・公開確認作業中 | 採用 | 公開で券消費と付与が一度だけ、再読込後も保持 | gacha migration、Edge operation、browser/transaction tests |
| 再戦・復帰・新しい試合 | 実装済み | 採用 | 公開二端末で両者再戦、片側再読込、次試合を完走 | rematch migrations、online browser/client tests |
| 接触色数の演出 | 実装済み | 採用 | 軽量同期との統合後に実ブラウザ確認 | contact feedback UI/test |
| Realtime＋単一snapshotによる軽量同期 | 初代snapshot RPCは本番適用・A/B/非メンバー実測済み。統合ブランチではprofile delta v2と小型appearance列まで実装済み、DB/クライアント未公開 | 採用 | migration先行後の二端末復帰、変更時だけprofile本文が返ること、レスポンスbytes/呼出数を実測 | `202609030013_standard_snapshot_profile_delta.sql`、`STANDARD_ONLINE_TRANSPORT_LITE.md`、sync/client/migration tests |
| 元ソースとデプロイ再現性 | 統合ブランチで復旧済み、未統合 | 採用 | 全試験合格後にコミットし、公開ブランチへ安全に統合 | `standard/`、build scripts、Edge bundle、過去欠落migration、Supabase function config |
| カード売却 | 統合ブランチでオンライン実装済み、DB/Edge未適用 | 採用・野良対戦より先に正本化 | migration/Edgeを適用し、公開で通常・要確認・再送・対戦ロックを確認 | `202609030006_standard_online_card_sale.sql`、Edge operations、online UI/browser/engine tests |
| トロフィー、戦績、対戦履歴 | 対人/CPU別精算・キャラクター別CPU戦績・3トロフィー授与・一覧UIまで統合ブランチで実装済み、未公開 | 採用・授与/書込みは野良対戦より先 | 公開の対人戦/CPU戦で各一回精算、重複なし、再読込表示を確認 | server `applyProfiles` / `applyCpuProfiles`、online progression UI/browser tests |
| 見た目の購入・装備 | 4系統12種の一覧、サーバー価格判定、確認、購入/装備、再送、再読込復元、相手の安全な名札/称号表示まで統合ブランチで実装済み、DB/Edge未適用 | 採用・対戦能力へ影響させない | migration/Edge適用後、公開で購入・無料装備・取消・応答喪失再送・別端末復元・相手表示を確認 | `standard-cosmetics.js`、`202609030010`/`011`、Edge operations、online UI/client/browser/engine tests |
| 合言葉不要の野良マッチング | 人間同士の第1段階を統合ブランチで実装済み、DB未適用 | 採用 | migration適用後、2人/10人同時確保、取消競合、再読込、完走を実環境確認 | matchmaking migration/client/UI/browser tests、`PUBLIC_MATCHMAKING_AND_CPU_FALLBACK_PLAN.md` |
| 90秒/180秒後の同意制CPU案内 | 統合ブランチで実装済み、DB/Edge未適用 | 採用 | 実時間案内、人間参加との実同時競合、再読込を公開環境で確認。自動開始は禁止済み | CPU migration/Edge/client/UI/browser tests、同上 |
| 個性のある固定CPU 10人 | version付きロスター、サーバー選択、1手ずつの原子的commit、固定台詞UI、個別戦績、同じCPUとの専用再戦まで統合ブランチで実装済み、未適用 | 旧3段階を置換して採用 | 実DBで全員の開始、代表3人の公開完走/復帰/再戦 | `standard-cpu-roster.js`、CPU opponent/rematch migrations、Edge bundle、roster/privacy/legality/browser tests |
| 期限切れルーム/チケットの清掃 | preview既定・最大500件/分類のservice-only清掃、索引、旧関数100室上限まで統合ブランチで実装済み、未適用・未実行 | 採用 | stagingでpreview件数、実削除、cascade、ロック競合、処理時間を実測してから定期実行を別承認 | `202609030012_batched_cleanup.sql`、cleanup migration tests、transport plan |
| レート制限・同時実行・冪等性 | join失敗、quiz、野良DB制限、Edgeのbounded per-isolate濫用抑止、各mutationのversion/action ID/原子的receiptまで統合ブランチで実装済み | 各APIの実装条件として採用 | staging負荷試験で正常プレイ非阻害と429を確認。分散攻撃はprovider gateway/WAF側の計測後に追加判断 | join/matchmaking limits、Edge `RATE_GROUP`、action/setup/gacha/rematch/economy receipts |
| `legalRecolor` 実験カード | ローカル実験のみ | 保留 | 通常ガチャへ入れず、既存19種と分離したままバランス判断 | Standard spec/matrix |
| 白紙化、色交換、遅延リカラー、連鎖回転、二分・保持 | 設計案のみ | 保留 | ルール、情報漏えい、原子性、手番価値が決まるまで実装しない | `BLANKING_SKILL_DESIGN.md`、skill matrix |

## 先に閉じる順序

1. 現行公開変更を取り込み、復元したStandard元ソース・migration・生成手順と全試験を一つの再現可能な基準へまとめる。
2. 単一snapshotとRealtime同期をDB/公開環境へ適用し、読み取り回数、復帰、非メンバー拒否を測る。プロフィール全件は将来room snapshotから分離し、毎手の応答を再び重くしない。
3. 既存のオンライン機能を二端末で再確認する。ここで合言葉対戦、クイズ、ガチャ、全試合、再戦、再読込を壊していないことを確定する。
4. 実装済みのカード売却、終局精算、最低限の履歴、既存3トロフィー授与を本番適用・実測する。CPU追加時に対人/CPU戦績を分離する。詳細ショップ・着せ替えUIは後続でもよい。
5. 原子的な野良マッチングを追加し、その後に明示同意のCPUフォールバックを、性格差の大きい3人で共通判断エンジンを検証してから設定データ10人へ拡張する。
6. 実装済みの見た目購入・装備を本番へ適用し、購入確認、同一ID再送、別端末復元、相手の名札/称号表示を確認する。
7. 期限切れ清掃、負荷計測、Realtime障害試験を閉じ、最後に公開URLの二端末人間戦と実時間CPU戦を完走する。同時実行、冪等性、認可、レート制限は各段階のAPI実装時から必須とする。

## チャッピー先生との合意事項

- 全体の採用/見送り線は妥当。既存19スキルを守り、`legalRecolor` と未確定案は通常公開へ混ぜない。
- 野良対戦前の必須条件は、見た目画面一式ではなく、サーバー権威の経済・精算・対人/CPU別戦績・最低限の履歴・既存3トロフィー授与である。
- CPUは人間と同じ権威的検証を通すが、人間手とCPU手を長い一トランザクションへまとめない。人間手を原子的に確定し `cpu_pending` とした後、CPU用の制限snapshotから判断し、決定的なCPU action IDでCPU手を別に原子的確定する。
- 10人を別々のロジックにせず、共通CPU判断エンジンとversion付きキャラクターパラメーターで表現する。まず差の大きい3人で安全性と個性を検証し、同じ仕組みで10人へ増やす。
- 既存トロフィー3種を先に完成させ、ID、条件、重複防止、再試行、CPU戦可否、遡及方針まで固定してから種類を増やす。
- 「エリア二分」と「エリア二分・保持」は別物である。前者は既存19スキルとして維持し、後者だけを未確定案として保留する。

## 完了判定

「コードがある」だけでは完了にしない。最新の公開URLで、別々の二端末による人間戦と、90秒待機後に明示承諾して選んだCPU戦をそれぞれ最後まで行い、途中再読込、再戦、新しい試合、報酬、ガチャ、カード所持、トロフィー、戦績、見た目が保持されることを確認する。さらに、非メンバー/private情報、二重精算、二重マッチ、期限切れ、レート制限、負荷削減の証拠を残して初めて完成とする。
