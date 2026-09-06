# 作業床・未コミット物の保全台帳

更新日: 2026-09-07

この台帳は、散在するworktree、未コミット差分、保留設計を、現行リリースへ誤って混ぜないための司令塔用索引である。これは削除許可ではない。削除は対象の到達可能性、dirty状態、正本収録を直前に再確認してから別途行う。

## 現在の統合基点

| 項目 | 現在値 | 扱い |
| --- | --- | --- |
| 正史 | `origin/main@b01c43e` | 比較、候補作成、公開判断の唯一の基点 |
| clean release床 | `.codex-worktrees/standard-release-clean-20260906` | `b01c43e`起点へalpha.3を`d3cb130`として統合。公開前検証・証拠更新用に保護 |
| CI投入床 | `codex/standard-release-command` | Windows Chrome/Edge gate専用として保持 |
| ローカル`main` | `2b9997b` | 正史より189コミット遅れ。比較基点にせず、安全な整理窓でのみfast-forward |
| 保存checkout | `codex/standard-v5-alpha1@ac78282` | 63 status項目の混在床。その場でmerge/rebase/build/deployしない |

## 保護対象

| 対象 | 状態 | 司令塔判断 |
| --- | --- | --- |
| `four-color-alpha3-category-refill-cpu-shapes-20260907` | source `d627cd5`、clean | 最優先保護。候補59 pathは最新main統合`d3cb130`とblob 59/59同値。公開・rollback保全完了まで保持 |
| `cpu-portraits-p1-20260906@be779d1` | clean、main未収録 | ライセンスNO-GOで凍結。画像を公開repoへ入れない |
| `.codex/worktrees/7843` / `salvage-a8fce7d@9e4e8ee` | clean | 旧Quick hardening等の履歴保全。保存checkout整理が終わるまで保持 |
| 保存checkoutのdirty差分 | tracked 38、実ファイルuntracked 24、worktree管理dir 1 | 一括commit・一括破棄禁止。下記の機能束ごとに所有先を固定 |

## 保存checkoutの機能束

| 機能束 | 判定 | 次の扱い |
| --- | --- | --- |
| 旧alpha.3 prototype | 現行alpha.3候補の旧版 | 現行候補のcommit・独立監査後に意味差分を比較し、旧版だけを退役 |
| 旧Quick online hardening / Supabase / live harness | 多くは`salvage-a8fce7d`、`online-v5-rc4-full`またはmainに保存済み | Standard正本へ丸ごと統合しない。必要時のみ機能単位で再監査 |
| Quick待機クイズ・ローカルガチャ | `1e72602`に履歴あり、現行判断はHOLD | 設計倒れではなく保留。Standardのserver-authoritative経済へ混ぜない |
| 旧release package / probe / resource incident資料 | salvage branchに保存済み | 履歴資料。製品mainへ再追加しない |
| `.codex-worktrees/` | worktree管理directory | ゲームの未実装ではない。製品差分として扱わない |

## 孤立文書の判断

`docs/HANDOFF_20260902_TWO_DEVICE_P0.md`は2026-09-02時点の旧P0引継ぎ史料であり、当時の公開基点、migration、GitHub操作禁止条件は現在の権限・正史と不一致である。固有価値は物理二端末受入の観点だが、その実行カードは現行の`STANDARD_PUBLIC_RELEASE_RUNBOOK.md`、残件は`PROJECT_COMMAND_CENTER.md`と`STANDARD_RELEASE_EVIDENCE.md`へ既に収録されている。

したがって現行手順へ統合せず、保存checkoutの最終整理までは履歴として保持する。削除前に「現行runbookへ未収録の受入条件がないこと」だけを再確認する。

## 収録済み・作業床削除候補

次は現時点の候補であり、削除実行リストではない。alpha.3公開候補が安定した後、各床で`clean`、HEAD、branch到達可能性、main収録を再確認する。

- `four-color-skill-category-audit-20260906`
- `basic-feedback`
- `cpu-commentary`
- `no-auto-loss-lv5`
- `quiz-option-float`
- `shift-board-after-feedback`
- `shift-board-target`
- `standard-pc-responsive`
- `standard-quiz-fun`
- `waiting-opponent-notice`

`standard-release-clean`は正本として、`standard-release-command`はCI投入路として削除候補から除外する。

## 安全な整理順序

1. alpha.3候補をcommitし、互換、privacy、再送、CPUバランス、client/Edge bundleを独立監査する。
2. 合格候補だけを最新`origin/main`起点のclean release床へ統合し、CI・Edge・Pages・公開確認を完了する。
3. 保存checkoutの旧alpha.3 prototypeとの差を再確認する。
4. 上記の収録済みworktreeごとに、非破壊確認結果を提示してから作業床だけを整理する。
5. ローカル`main`を`origin/main`へfast-forwardする。
6. 最後に、ローカルのみの歴史branchをGitHubへ保全するか削除するかを別判断する。

## 禁止事項

- 保存checkoutを丸ごとcommit、merge、rebase、build、deployしない。
- 古いローカル`main`を基点に収録済み判定をしない。
- ライセンス未解決のCPU肖像を公開repo、Pages、配布物へ入れない。
- alpha.3候補の監査完了前に、旧prototypeまたは関連worktreeを削除しない。
- 物理二端末受入を自動browser、canary、単一端末の結果からPASS推定しない。
