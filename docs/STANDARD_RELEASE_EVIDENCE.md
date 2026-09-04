# Standard公開候補 証拠台帳

更新日: 2026-09-04

この文書は「コードがある」と「公開環境で確認した」を混同しないための台帳である。`VERIFIED` は同じ行に再現可能な根拠がある場合だけ使用する。token、API key、user ID、個人情報は記録しない。

## 現在のゲート

| ゲート | 状態 | 現在の根拠 | 次の証拠 |
| --- | --- | --- | --- |
| 採否棚卸し | VERIFIED | `ONLINE_COMPLETION_INVENTORY.md`。旧Expo試作と現行Web Standardを分離済み | 公開後に状態列だけ更新 |
| 製品コード・生成元 | VERIFIED | `standard/`、build scripts、生成済みEdge bundleが統合ブランチに存在 | 最終公開commitを記録 |
| ローカル製品試験 | VERIFIED | 2026-09-04、専用runnerで665件合格、失敗0、769.2秒 | 公開後のcandidate preflightと実端末canary |
| 公開Pages候補 | VERIFIED | 2026-09-04 22:46 JST、HTTP 200、Standard Online title、野良、CPU、見た目をcandidate preflightで確認 | A〜Dの公開UI canary |
| 公開前DB境界 | VERIFIED | 旧snapshotは匿名権限拒否。snapshot v2と野良募集は`PGRST202`で未存在 | migration後のdb-ready preflight |
| migration 006–013静的検査 | VERIFIED | migration別security/transaction testsと読み取り専用44項目SQL | 実DBで全行`ok=true` |
| Dashboard Advisor・使用量baseline | BLOCKED | 資源逼迫警告を本番Dashboardで確認。変更前の詳細数値は取得できないままDB/Edge更新済み | Security/Performance/API/DB/Edge/Realtimeの現時点スナップショットとcanary後比較 |
| migration 006–013本番適用 | VERIFIED | 2026-09-04、8本を順番どおり個別実行。最終読み取り検査は44/44 true、失敗0 | 公開後canaryで実経路を確認 |
| Edge Function更新 | VERIFIED | deployment 7、JWT検証ON。2026-09-04 22:46 JSTの`live-standard-edge-canary.mjs --confirm-live`は6/6合格 | 公開UI経由の完全canary |
| GitHub main・Pages更新 | VERIFIED | 2026-09-04 22:46 JST、remote `main=dc5452a`、公開candidate preflight合格 | Actions run識別子の補記 |
| 合言葉対戦canary | PENDING | 最新候補では未実施 | A/B完走、C拒否、再読込、再戦 |
| 経済・進行・見た目canary | PENDING | 最新候補では未実施 | クイズ、ガチャ、売却、精算、履歴、トロフィー、購入/装備のexactly-onceと復元 |
| 野良対戦canary | PENDING | 最新候補では未実施 | 募集/検索、取消競合、二重成立なし、完走、再検索 |
| CPU canary | PENDING | 最新候補では未実施 | 実時間90/180秒、同意、代表3人完走、復帰、同じCPU再戦 |
| 軽量化・負荷 | PENDING | live full/delta bytesは1815→991で824 bytes削減、部外者拒否を確認。負荷指標は未取得 | RPC数、p50/p95、エラー率、使用量前後 |
| cleanup preview | PENDING | 関数はローカルのみ。削除・定期化なし | dry-run分類別件数、処理時間。実削除は別承認 |
| cleanup実削除・定期化 | PENDING_APPROVAL | preview件数とcascade先を未確認 | 対象を特定し、復元不能性を説明したうえで別承認 |
| 別々の二端末による最終受入 | PENDING | 旧公開版の過去証拠だけ | 最新URLで対人/CPU完走、復帰、新試合、全永続化 |

## 2026-09-04 22:46 JST 再検証

- GitHub remote `main` は `dc5452a`。不要な再pushは行っていない。
- `live-standard-release-preflight.mjs --expect=candidate` は、公開UI、snapshot v1/v2、野良募集の保護境界を含め合格。
- `live-standard-edge-canary.mjs --confirm-live` は匿名認証、JWT欠落・改変拒否、profile、見た目catalog、CPU rosterの6/6合格。
- `live-standard-room-snapshot-smoke.mjs --confirm-live` はA/B snapshot、部外者拒否、同revision profile省略に合格。full 1815 bytes、delta 991 bytes。
- Playwrightを同梱ランタイムへ接続した再検証で、証拠台帳2/2、接触演出43/43、Standard Online実ブラウザ14/14が合格。全体連続実行で発生したreduced-motion 1件と後続browser timeoutは、対象ファイル単独で再現せず全件合格したため、実行環境負荷によるflakeとして分離した。

## 公開前後メトリクス

値が取得できなかった項目を空欄のまま`VERIFIED`にしない。

| 時点 | Database | Edge invocations | Realtime messages / peak | Egress | p50 | p95 | error rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 変更前 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| canary後 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## 公開識別子

| 項目 | 値 |
| --- | --- |
| candidate code commit | `b9ccdb7` |
| applied migrations | `202609030006`–`202609030013` |
| `standard-game-action` version | deployment 7 |
| Pages Actions run | 未取得（公開candidate preflightで配信確認済み） |
| public URL | `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/` |

## Canary結果

各項目は`PASS`、`FAIL`、`NOT_RUN`のいずれかとし、失敗を空欄で消さない。

| 区分 | 結果 | 時刻 | 有限な証拠 |
| --- | --- | --- | --- |
| Edge認証・基本公開 | PASS | 2026-09-04 22:46 JST | 匿名sign-in、JWT欠落/改変拒否、profile、cosmetic catalog、CPU roster 10人の6/6 |
| A 合言葉・A/B/C・snapshot delta | NOT_RUN | snapshot subgateのみ2026-09-04 22:46 JST PASS | 部外者拒否・delta縮小は確認済み。試合完走、再読込、再戦は未実施 |
| B クイズ・ガチャ・売却・精算・トロフィー・見た目 | NOT_RUN | PENDING | PENDING |
| C 野良・競合・完走 | NOT_RUN | PENDING | PENDING |
| D CPU同意・10人・代表3人・再戦 | NOT_RUN | PENDING | PENDING |
| 二端末最終受入 | NOT_RUN | PENDING | PENDING |

## 残存リスク

- Dashboardの詳細なAdvisor/使用量baselineは未取得。画面上では資源逼迫警告が継続しているため、公開範囲を広げる前後で使用量を追跡する。
- Edgeのper-isolate濫用抑止は分散レート制限ではない。公開後の計測で必要性が出た場合だけprovider側制限を検討する。
- 10人CPUの合法性・決定性は自動検証済みだが、人間が感じる個性と楽しさは代表3人の実プレイ後も定性的判断として残る。
- cleanup実削除、定期化、課金設定変更はこの公開候補の承認範囲外である。
