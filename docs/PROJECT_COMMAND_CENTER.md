# 四色地図ゲーム 司令塔台帳

更新日: 2026-09-05

目的: 四色地図ゲームを、迷わず始められ、駆け引きが伝わり、もう一局遊びたくなる体験へ磨き上げる。

この台帳は、設計・実装・未コミット作業・公開済み状態を混同しないための入口である。公開可否の有限な証拠は `STANDARD_RELEASE_EVIDENCE.md`、具体的な公開順序は `STANDARD_PUBLIC_RELEASE_RUNBOOK.md` を正本とする。

## 司令塔ルール

- 統合基点は `origin/main` とし、現在の基点は `dc5452a`。
- 現在の統合作業は `codex/standard-release-command` だけで行う。
- 古いdirty worktreeからbuild、merge、deployしない。
- `実装済み`、`ローカル検証済み`、`live検証済み`、`公開済み`を別状態として記録する。
- 変更は製品テスト、live preflight、canary、公開後確認の順に昇格させる。
- private情報漏えい、二重精算、二重マッチ成立、相手誤表示は一件でも公開停止条件とする。

## 現在の優先順位と担当

| 優先度 | 作業 | 主担当 | 状態 | 完了条件 |
| --- | --- | --- | --- | --- |
| P0 | Standard公開候補の固定と再検証 | 司令塔 | IN_PROGRESS | UX統合候補は非browser製品試験501/501合格。共有環境復旧後にbrowser gateを再実行 |
| P0 | Pages反映と公開後preflight | 司令塔 | COMPLETED | remote `main=dc5452a`、Pages run `33814089903`成功、candidate preflight合格 |
| P0 | 合言葉・経済・野良・CPUのlive縦通し | 技術品質 | IN_PROGRESS | Edge 6/6、runbook A 43/43合格。B〜D自動化済み。Cは準備時500後、Auth 429で停止 |
| P0 | 同時profile作成のHTTP 500抑止 | Edge＋運用 | LOCAL_VERIFIED | 新規作成をload→commitの2 RPCへ削減。一時的なDB/PostgREST障害を503化し、秘密を含まないupstream codeを記録。live再検証待ち |
| P0 | デバッグ対戦のサーバー側隔離 | 技術品質 | LOCAL_VERIFIED | 合言葉・人間同士だけをservice-loaded roomから許可。API直叩きで野良/CPUへ混入不可 |
| P0 | Supabase資源とRealtime負荷の追跡 | 運用 | IN_PROGRESS | 現況取得済み。24時間後にinfra alertと`realtime.list_changes`比率を再測定 |
| P0 | 別々の二端末による最終受入 | チャッピー先生＋司令塔 | PENDING | 対人/CPUの完走、復帰、再戦、永続化を確認 |
| P1 | 対戦を主役にする情報設計 | UX | LOCAL_VERIFIED | 5タブ化し、ホームの主CTAから対戦タブ内の初回profile作成・同期・ロビーまでを一本化。公開後の実端末確認待ち |
| P1 | プレイヤー向けno-color宣言の仕様整合 | UX＋ルール | LOCAL_VERIFIED | 通常受渡し/split返却とも同一action内で自動終局し、Online UIから宣言を除去 |
| P1 | Standardを学んで即CPU戦へ入る導線 | ゲーム体験 | CANDIDATE | 3手ガイドまたは固定スターターCPU戦から本戦へ遷移 |
| P1 | 未コミット／孤立作業の回収 | 構成管理 | IN_PROGRESS | 保全、比較、採用、破棄候補が全件分類済み |
| P2 | GitHub Pages actionのNode.js警告解消 | 技術品質 | BACKLOG | 公開結果を変えず、Node.js 20廃止予定warningを消す |

## 旧作業床からの回収候補

古いブランチは丸ごと統合せず、次の意味差分だけを正本と比較する。

| 優先度 | 候補 | 採否条件 |
| --- | --- | --- |
| P1 | Quick Half Shiftの非連結領域を決定的に分割 | 両ゲームエンジンで同じ結果になり、既存Standardルールを壊さない |
| P1 | Quickロビーの期限切れ・Realtime・poll復旧 | 現行Standardにも同型障害が残る場合だけ移植 |
| P1 | Quickのlive regression/release補助ツール | 現行runbookの不足を埋め、固定データを汚さない |
| P2 | Quick EdgeのPT409/PGRST003変換 | JWT有効化とlive認証試験を同時に満たす場合だけ採用 |
| HOLD | Quick待機クイズ・ローカルガチャ | Quickを製品導線として残す決定が出るまでStandard版を正本とする |

## 作業床の扱い

| 区分 | 対象 | 方針 |
| --- | --- | --- |
| 正本 | `origin/main@dc5452a` | 公開候補の基点 |
| 現在の統合床 | `codex/standard-release-command` | 司令塔が検証・修正・公開準備に使用 |
| 統合済み次候補 | `codex/standard-release-command` | 5タブ、初回対戦導線、クイズ・演出、debug隔離、no-color自動終局、Runbook B〜D、profile作成安定化を統合。browser/live gate後に公開判断 |
| 保全済み | detached `a8fce7d` dirty床 | `codex/salvage-a8fce7d-20260904` / `9e4e8ee` に秘密情報なしでWIP保全済み。機能単位で比較 |
| 旧大型dirty | root `ac78282`、online rc4 dirty床 | 直接merge禁止。重複を除き、正本にない変更だけを比較 |
| 見かけdirty | 改行コード差分だけの3床 | 意味差分なし。保全不要候補 |
| clean detached | 祖先12床 | 到達可能性確認後のworktree整理候補 |
| 要内容確認 | detached `1f823b2`、`6f309d0` | branchまたはtagで保全してから採否判断 |

## 設計と実装の対応

| 文書／構想 | 判定 | 次の扱い |
| --- | --- | --- |
| 合言葉不要マッチング＋CPUフォールバック | 主要実装は`origin/main`へ統合済み | live canaryが終わるまで公開完成とは呼ばない |
| クイズ・スキル・バランス | 系統分岐した部分実装 | 最新クイズ未完差分とStandard正本を比較して一本化 |
| online MVP status／live regression | 実装済み部分と運用残件が混在 | 証拠台帳へ状態を移し、古い時系列ログは参照化 |
| 二端末P0 handoff | 検証引継ぎ | 最新runbookに未反映の条件だけ回収 |
| nested Expo設計群 | 旧ローカル試作 | 現行Standard Onlineから凍結分離 |

## 体験改善の判断軸

改善は次の順で評価する。

1. 初戦開始までの迷いと操作数を減らす。
2. 「相手に塗らせる領域を作る」という独自の駆け引きを伝える。
3. 操作結果と勝因を自然な日本語と演出で返す。
4. 再戦、クイズ、ガチャ、収集を一つの循環としてつなぐ。
5. 安全性と再現性を保ったまま、公開環境で完走できる。
