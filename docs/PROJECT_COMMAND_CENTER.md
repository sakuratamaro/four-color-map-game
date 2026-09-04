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
| P0 | Standard公開候補の固定と再検証 | 司令塔 | IN_PROGRESS | dirty回収、status正規化、Realtime復旧を含む統合候補は非browser製品試験515/515合格。browser harnessは段階ログ・有限timeout静的5/5合格、実browser完走待ち |
| P0 | Pages反映と公開後preflight | 司令塔 | COMPLETED | remote `main=dc5452a`、Pages run `33814089903`成功、candidate preflight合格 |
| P0 | 合言葉・経済・野良・CPUのlive縦通し | 技術品質 | COMPLETED | deployment 8でEdge 6/6、A 43/43、B 93/93、C 210/210、D 107/107合格 |
| P0 | 同時profile作成のHTTP 500抑止 | Edge＋運用 | LIVE_VERIFIED | 新規作成をload→commitの2 RPCへ削減。一時障害を503化。C準備の16 profileが逐次で全件成功し、500/429なし |
| P0 | デバッグ対戦のサーバー側隔離 | 技術品質 | LOCAL_VERIFIED | 合言葉・人間同士だけをservice-loaded roomから許可。API直叩きで野良/CPUへ混入不可 |
| P0 | Supabase資源とRealtime負荷の追跡 | 運用 | CANDIDATE_VERIFIED | client購読を公開room UPDATE 1本へ限定。Quick pollをplaying 5秒/待機10秒、hidden停止へ変更。live Realtime 2/2合格。公開後24時間で負荷を再測定 |
| P0 | 別々の二端末による最終受入 | チャッピー先生＋司令塔 | PENDING | 対人/CPUの完走、復帰、再戦、永続化を確認 |
| P1 | 対戦を主役にする情報設計 | UX | LOCAL_VERIFIED | 5タブ化し、ホームの主CTAから対戦タブ内の初回profile作成・同期・ロビーまでを一本化。公開後の実端末確認待ち |
| P1 | プレイヤー向けno-color宣言の仕様整合 | UX＋ルール | LOCAL_VERIFIED | 通常受渡し/split返却とも同一action内で自動終局し、Online UIから宣言を除去 |
| P1 | Standardを学んで即CPU戦へ入る導線 | ゲーム体験 | CANDIDATE | 3手ガイドまたは固定スターターCPU戦から本戦へ遷移 |
| P1 | 未コミット／孤立作業の回収 | 構成管理 | COMPLETED | 29床を3床へ集約。丸ごと統合候補は0。Quick回帰試験だけを回収し、残るroot dirtyは救出済み・凍結管理 |
| P2 | GitHub Pages actionのNode.js警告解消 | 技術品質 | BACKLOG | 公開結果を変えず、Node.js 20廃止予定warningを消す |

## 旧作業床からの回収候補

古いブランチは丸ごと統合せず、次の意味差分だけを正本と比較する。

| 優先度 | 候補 | 採否条件 |
| --- | --- | --- |
| ADOPTED | Quick Half Shiftの非連結領域を決定的に分割 | `af8c789`で由来つき単独回収。Quick/Standard重点34/34、client/Edge mirror SHA-256一致 |
| ADOPTED | Quick/Standardロビーの期限切れ・Realtime・poll復旧 | `a113abb`で機能単位回収。missing roomはロビー帰還、通信障害では接続情報を保持し、非browser製品試験507/507合格 |
| ADOPTED | Quickの入力独立性・合法色なし・終局到達性 | `1bddae0`で製品コードを変えず回帰試験3件だけを回収。Quick重点12/12合格 |
| P1 | Quickのlive regression/release補助ツール | 現行runbookの不足を埋め、固定データを汚さない |
| P2 | Quick EdgeのPT409/PGRST003変換 | JWT有効化とlive認証試験を同時に満たす場合だけ採用 |
| HOLD | Quick待機クイズ・ローカルガチャ | Quickを製品導線として残す決定が出るまでStandard版を正本とする |

## 作業床の扱い

| 区分 | 対象 | 方針 |
| --- | --- | --- |
| 正本 | `origin/main@dc5452a` | 公開候補の基点 |
| 現在の統合床 | `codex/standard-release-command` | 司令塔が検証・修正・公開準備に使用 |
| 統合済み次候補 | `codex/standard-release-command@0e02176` | 5タブ、初回対戦導線、クイズ・演出、debug隔離、no-color自動終局、profile安定化、status正規化、Realtime/poll復旧を統合。実browser再検証後に公開判断 |
| 保全済み | detached `a8fce7d` dirty床 | `codex/salvage-a8fce7d-20260904` / `9e4e8ee` に秘密情報なしでWIP保全済み。機能単位で比較 |
| 凍結root | root `ac78282` | 正史worktreeを内包するため作業床は維持。dirty 40件は救出済みで、丸ごとmerge禁止。正本にない候補の採否は完了 |
| GitHub保管 | `codex/archive-standard-release-1f823b2` | 正史の祖先でない孤立コミットをGitHubへ退避済み。作業床は削除 |
| 整理済み | clean旧作業床22個 | HEAD、branch、dirty=0を個別確認し、`--force`なしで作業床だけを削除。到達可能な履歴は維持 |
| 整理済み | UI `6ac4a29`、phase2 `93a5578`、solo `9bfbaf8` | 全tracked差分がCRLFだけ、staged/untracked/秘密候補0、salvageから到達可能と二重確認し、改行差分だけを破棄して作業床を削除 |
| 整理済み | online rc4 `b98351c` | dirty全21ファイルがrootの同名ファイルとバイト単位で一致、staged 0、branch保全済みと二重確認し、重複作業床だけを削除 |

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
