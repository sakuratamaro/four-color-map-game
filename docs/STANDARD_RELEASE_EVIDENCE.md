# Standard公開候補 証拠台帳

更新日: 2026-09-03

この文書は「コードがある」と「公開環境で確認した」を混同しないための台帳である。`VERIFIED` は同じ行に再現可能な根拠がある場合だけ使用する。token、API key、user ID、個人情報は記録しない。

## 現在のゲート

| ゲート | 状態 | 現在の根拠 | 次の証拠 |
| --- | --- | --- | --- |
| 採否棚卸し | VERIFIED | `ONLINE_COMPLETION_INVENTORY.md`。旧Expo試作と現行Web Standardを分離済み | 公開後に状態列だけ更新 |
| 製品コード・生成元 | VERIFIED | `standard/`、build scripts、生成済みEdge bundleが統合ブランチに存在 | 最終公開commitを記録 |
| ローカル製品試験 | VERIFIED | 既存製品試験659件の直列合格。後続追加4件も対象別に合格 | 公開直前に専用runnerを再実行し、総数と所要時間を記録 |
| 公開前Pages | VERIFIED | HTTP 200、旧Standard title。野良、CPU、見た目の文字列なし | 公開後のcandidate preflight |
| 公開前DB境界 | VERIFIED | 旧snapshotは匿名権限拒否。snapshot v2と野良募集は`PGRST202`で未存在 | migration後のdb-ready preflight |
| migration 006–013静的検査 | VERIFIED | migration別security/transaction testsと読み取り専用44項目SQL | 実DBで全行`ok=true` |
| Dashboard Advisor・使用量baseline | BLOCKED | Browser拡張/native-hostがこのPCになく、ログイン済み画面を読み取れない | Browser plugin再導入後、Security/Performance/API/DB/Edge/Realtimeの時刻付き値 |
| migration 006–013本番適用 | PENDING_APPROVAL | 本番未変更 | 1本ずつ成功、追加直後のobject/ACL確認、最終44項目全true |
| Edge Function更新 | PENDING_APPROVAL | 本番未変更 | version、JWT 3経路、profile/catalog/CPU roster canary |
| GitHub main・Pages更新 | PENDING_APPROVAL | `origin/main`は`274e3a7`、公開UIは旧版 | 公開commit、Actions run、candidate preflight |
| 合言葉対戦canary | PENDING | 最新候補では未実施 | A/B完走、C拒否、再読込、再戦 |
| 経済・進行・見た目canary | PENDING | 最新候補では未実施 | クイズ、ガチャ、売却、精算、履歴、トロフィー、購入/装備のexactly-onceと復元 |
| 野良対戦canary | PENDING | 最新候補では未実施 | 募集/検索、取消競合、二重成立なし、完走、再検索 |
| CPU canary | PENDING | 最新候補では未実施 | 実時間90/180秒、同意、代表3人完走、復帰、同じCPU再戦 |
| 軽量化・負荷 | PENDING | ローカルのprofile-delta/static証拠のみ | full/delta bytes、RPC数、p50/p95、エラー率、使用量前後 |
| cleanup preview | PENDING | 関数はローカルのみ。削除・定期化なし | dry-run分類別件数、処理時間。実削除は別承認 |
| 別々の二端末による最終受入 | PENDING | 旧公開版の過去証拠だけ | 最新URLで対人/CPU完走、復帰、新試合、全永続化 |

## 公開前後メトリクス

値が取得できなかった項目を空欄のまま`VERIFIED`にしない。

| 時点 | Database | Edge invocations | Realtime messages / peak | Egress | p50 | p95 | error rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 変更前 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| canary後 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## 公開識別子

| 項目 | 値 |
| --- | --- |
| candidate commit | PENDING |
| applied migrations | PENDING |
| `standard-game-action` version | PENDING |
| Pages Actions run | PENDING |
| public URL | `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/` |

## Canary結果

各項目は`PASS`、`FAIL`、`NOT_RUN`のいずれかとし、失敗を空欄で消さない。

| 区分 | 結果 | 時刻 | 有限な証拠 |
| --- | --- | --- | --- |
| A 合言葉・A/B/C・snapshot delta | NOT_RUN | PENDING | PENDING |
| B クイズ・ガチャ・売却・精算・トロフィー・見た目 | NOT_RUN | PENDING | PENDING |
| C 野良・競合・完走 | NOT_RUN | PENDING | PENDING |
| D CPU同意・10人・代表3人・再戦 | NOT_RUN | PENDING | PENDING |
| 二端末最終受入 | NOT_RUN | PENDING | PENDING |

## 残存リスク

- migration SQLはローカルPostgresで未実行。実DBの1本ずつの適用と44項目検査が必要。
- Edgeのper-isolate濫用抑止は分散レート制限ではない。公開後の計測で必要性が出た場合だけprovider側制限を検討する。
- 10人CPUの合法性・決定性は自動検証済みだが、人間が感じる個性と楽しさは代表3人の実プレイ後も定性的判断として残る。
- cleanup実削除、定期化、課金設定変更はこの公開候補の承認範囲外である。
