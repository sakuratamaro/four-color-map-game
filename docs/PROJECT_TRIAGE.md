# 四色地図プロジェクト整理台帳

更新日: 2026-09-05

この台帳は、正本、公開済み、ローカル限定、未統合、重複、設計保留を混同しないための司令塔向け索引である。削除の許可ではない。

## 正本

| 項目 | 現在値 | 状態 |
| --- | --- | --- |
| 正本worktree | `.codex-worktrees/standard-transport-lite-20260903` | VERIFIED |
| 開発branch | `codex/standard-release-command` | VERIFIED |
| GitHub `main` | `a3425a4d459214e5274e20497af21f35a312099d` | PUBLIC_VERIFIED |
| 公開URL | `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/` | PUBLIC_VERIFIED |

正本以外からは丸ごとmerge/cherry-pickしない。採用候補は正本を基点に、差分の意味、サーバー権威、公開データ境界、試験を再確認して作り直す。

## 2026-09-05 棚卸し

| 分類 | 対象 | 取り扱い |
| --- | --- | --- |
| 統合済み | `6a824ca`, `274e3a7`, `dc5452a` | `origin/main`の祖先。旧branch refは史料 |
| 重複 | `a5a5b2c`, `852589a` | mainの`87604e6`, `d5590af`へ実質統合済み。再pushしない |
| 保全用 | `codex/salvage-a8fce7d-20260904@9e4e8ee` | cleanなローカル保全枝。root整理まで維持 |
| dirty root | `codex/standard-v5-alpha1@ac78282` | tracked 15件、untracked 25件。正本worktree自体もuntracked表示されるため一括削除禁止 |
| 未保存文書 | `docs/HANDOFF_20260902_TWO_DEVICE_P0.md` | 旧P0引継ぎ史料。現行受入手順へ直接使わず、保全/破棄は別判断 |
| 再設計候補 | `1e72602`, `943b454`, root `online-v5/waiting-loop.mjs` | Quick待機中クイズ＋ローカルガチャ。現行サーバー管理型経済へ丸ごと移植しない |
| obsolete候補 | `ef7d42f`, `1f823b2`, `39f8f2e`, `b80ff3e`, `fc36380` | 旧Standard。現mainが機能・試験とも後継 |
| obsolete候補 | `b98351c`, `4ea9268`, `76923a9` | 旧Quick hardening。価値ある差分はmainへ回収済み |
| obsolete候補 | `764ff96` | 旧Solo RC。固有差分はasset版相当だけ |
| stale ref候補 | local `main@2b9997b`, `8229f28`, `company/main@7c3692c` | 正本判断に使わない。安全な整理窓で別途処理 |

rootのQuick engine、server mirror、回帰試験、初期migrationは現mainと同一byteである。他の差分も、未保存文書を除き既存commit/refに同一byteが保存されている。

## 司令塔判断

- 現在の完成優先順位は、正本の物理二端末受入、24時間後指標、運用証拠の完結である。
- Quick待機中クイズの発想は体験候補として保持するが、ローカルガチャ経済は不採用。採用時はStandardのサーバー権威報酬か、報酬なし練習として正本上で再設計する。
- 旧branch、dirty root、salvage worktreeは、二端末受入が終わるまで削除しない。
- cleanupの実削除・定期化は、対象件数、cascade、復元不能範囲を記録してから扱う。

## 未完了ゲート

1. 別々の物理二端末で、合言葉対人戦の作成、参加、完走、片側再読込、再戦を確認する。
2. 物理端末でCPU戦を完走し、戦績、報酬、再読込、同じCPUとの再戦、別CPUの新試合を確認する。
3. 公開24時間後にDB、Edge、Realtime、error rate、p50/p95、資源警告を再採取する。
4. 上記が完了するまで、プロジェクト全体を完成扱いにしない。
