# 四色地図ゲーム 司令塔台帳

更新日: 2026-09-05

目的: 四色地図ゲームを、迷わず始められ、駆け引きが伝わり、もう一局遊びたくなる体験へ磨き上げる。

この台帳は、設計・実装・未コミット作業・公開済み状態を混同しないための入口である。公開可否の有限な証拠は `STANDARD_RELEASE_EVIDENCE.md`、具体的な公開順序は `STANDARD_PUBLIC_RELEASE_RUNBOOK.md` を正本とする。

## 司令塔ルール

- 統合基点は `origin/main` とし、現在の公開ゲーム資産基点は `e0f4f98`。後続の記録・検査専用commitは製品ロジック更新と数えない。
- 現在の統合作業は `codex/standard-release-command` だけで行う。
- 古いdirty worktreeからbuild、merge、deployしない。
- `実装済み`、`ローカル検証済み`、`live検証済み`、`公開済み`を別状態として記録する。
- 変更は製品テスト、live preflight、canary、公開後確認の順に昇格させる。
- private情報漏えい、二重精算、二重マッチ成立、相手誤表示は一件でも公開停止条件とする。

## 現在の優先順位と担当

| 優先度 | 作業 | 主担当 | 状態 | 完了条件 |
| --- | --- | --- | --- | --- |
| P0 | Standard公開候補の固定と再検証 | 司令塔 | PUBLIC_VERIFIED | `a3425a4`。非browser Standard 544/544、重点89/89、オンラインbrowser 31/31、CPU browser Chrome/Edge各1/1。Windows browser run `33947039777`はChrome/Edge成功 |
| P0 | Pages反映と公開後preflight | 司令塔 | PUBLIC_VERIFIED | 公開ゲーム資産基点`e0f4f98`、Pages run `33949936952`成功。公開URLで匿名profile→CPU選択→6枚準備→対戦開始を実確認。後続の記録・検査専用commitはゲーム資産を変更しない |
| P0 | 合言葉・経済・野良・CPUのlive縦通し | 技術品質 | COMPLETED | deployment 8でEdge 6/6、A 43/43、B 93/93、C 210/210、D 107/107合格 |
| P0 | 待ち時間なしのStandard CPU開始 | UX＋Edge＋DB | PUBLIC_VERIFIED | `cc96350`。migration `202609050002`、Edge deployment 9、基本6/6＋即時CPU 7/7、Windows run `33931963065`、Pages run `33932159043`合格。公開UIでCPU選択→6枚準備→CPU初手→人間第2手を確認 |
| P0 | 同時profile作成のHTTP 500抑止 | Edge＋運用 | PUBLIC_VERIFIED | 新規作成をload→commitの2 RPCへ削減。一時障害を503化。C準備の16 profileが逐次で全件成功し、500/429なし |
| P0 | 役割表示 | UX | PUBLIC_VERIFIED | `2d5e6bc`。作る側／塗る側を自分視点で明示。後続のWindows browser run `33940381350`とPages run `33940876572`に累積して公開確認 |
| P0 | 彩色前の封印表示 | UX＋ルール | PUBLIC_VERIFIED | `604e932`。封印中の色を彩色前から鍵付きで表示し操作不可にした。後続のWindows browser run `33940381350`とPages run `33940876572`に累積して公開確認 |
| P0 | 部分領域・デバッグ隔離・setup/action feedback | 技術品質＋UX | PUBLIC_VERIFIED | `c9a2ad5`。部分占有macroを正しく扱い、debugを合言葉human roomへ限定し、setup/actionの確定・失敗・同一操作再送を操作直下へ保持。migration `202609050003`、Runbook A 43/43、Windows run `33940381350`、Pages run `33940876572`合格。`db45ebc`はEdge CI終了猶予の検証基盤修正 |
| P0 | クイズ即時採点・全10問の答え合わせ | クイズ＋Edge＋DB | PUBLIC_VERIFIED | `2f06504`。migration `202609050004`、新しい各問回答方式と旧一括方式のcanary、Windows run `33943348061`、Pages run `33943980517`、公開実ブラウザ10問完走が合格 |
| P0 | CPU戦の完了報酬表示 | UX＋進行 | PUBLIC_VERIFIED | `640ec98`。保存済みCPU結果へ`Lv.1ガチャ券 +1`を明示し、再読込を含む券2→3、対人精算とCPU未精算の否定条件を確認。Windows run `33944794035`、Pages run `33944924097`成功 |
| P0 | 持ち色変更の説明 | UX＋ルール | PUBLIC_VERIFIED | `640ec98`。基本色2枠は回数無制限、おまけ色枠は残り回数を変更後の色へ引き継ぐことを明示。Windows run `33944794035`、Pages run `33944924097`成功 |
| P0 | クロガネ公開情報lookahead v2 | CPU＋Edge＋DB | PUBLIC_VERIFIED | `a3425a4`。migration `202609050005`、新規クロガネだけv2、旧roomは旧policy維持、再戦時v2更新。公開情報だけの合法手、再送、決着、同CPU再戦canary合格。Windows run `33947039777`、Pages run `33947644765`成功 |
| P0 | Supabase資源とRealtime負荷の追跡 | 運用 | PENDING | client購読を公開room UPDATE 1本へ限定。直前公開ではCPU 2%、RAM 64%、disk 16%、connections 14/60。`a3425a4`公開後24時間で同条件の指標を再測定 |
| P0 | 別々の二端末による最終受入 | チャッピー先生＋司令塔 | PENDING | 対人/CPUの完走、復帰、再戦、永続化を確認 |
| P1 | 対戦を主役にする情報設計 | UX | PUBLIC_VERIFIED | 5タブ化し、ホームの主CTAから対戦タブ内の初回profile作成・同期・ロビーまでを一本化。公開URLの390px実画面で確認済み |
| P1 | 初回オンライン準備を一操作に短縮 | UX | PUBLIC_VERIFIED | `9d42784`。名前入力後の一操作でstarter保存とprofile同期を行い、自動入室はしない。空名write 0、同期二重送信防止、失敗時starter保持。公開CTA確認済み |
| P1 | 接続状態を対戦中も常時表示 | UX＋同期 | PUBLIC_VERIFIED | `9d42784`。全5タブで単一statusを表示し、room外offlineも反映。公開390px画面で固定statusと下部navの8px間隔を確認 |
| P1 | プレイヤー向けno-color宣言の仕様整合 | UX＋ルール | PUBLIC_VERIFIED | 通常受渡し/split返却とも同一action内で自動終局し、Online UIから宣言を除去。公開候補`a3425a4`へ累積反映済み |
| P1 | Standardを学んで即CPU戦へ入る導線 | ゲーム体験 | PUBLIC_VERIFIED | 初手ガイドに加え、ホーム／ロビーから10人のStandard CPUを選んで待ち時間なく6枚準備へ入る公開導線を実画面確認済み |
| P1 | 6枚提出から初手案内への引き継ぎ | UX | PUBLIC_VERIFIED | `29c6958`。提出操作自身がready→playingを観測した時だけ、ランダム結果後に対戦見出しへ移動。reload、poll、backgroundではfocusを奪わない |
| P1 | 6枚セットアップの即時確定 | UX | PUBLIC_VERIFIED | `e0f4f98`。390×844の初期表示から、選択済みスターター6枚と準備OK、確定CTAを下部nav直上へ固定表示。無効構成ではdisabled、準備送信1回、公開CPU対戦開始まで確認。Windows run `33950043659`はChrome/Edge成功 |
| P1 | CPU戦終了から次の一局への循環 | ゲーム体験 | PUBLIC_VERIFIED | `29c6958`。同じCPU再戦に加え、結果を残したまま別CPUを選んで即時新対戦へ進める。公開API完走・同CPU再戦canary 25/25 |
| P1 | CPU報酬からガチャへの直行 | ゲーム体験 | BACKLOG | 保存済みCPU精算だけに「獲得したLv.1券でガチャへ」を出し、自動抽選せずLv.1の1枚引く操作へfocusする。対人・未精算・debugは非表示 |
| P1 | 未コミット／孤立作業の回収 | 構成管理 | COMPLETED | 29床を3床へ集約。丸ごと統合候補は0。Quick回帰試験だけを回収し、残るroot dirtyは救出済み・凍結管理 |
| P2 | GitHub Pages actionのNode.js警告解消 | 技術品質 | BACKLOG | 公開結果を変えず、Node.js 20廃止予定warningを消す |

直前の公開履歴も維持する。`29c6958`は非browser 528/528、ローカルChrome/Edge各25/25、Windows run `33933769885`（Edgeは終了処理timeout後のattempt 2成功）、Pages run `33934125859`で公開確認した。即時CPU開始は`cc96350`、migration `202609050002`、Edge deployment 9、Windows run `33931963065`、Pages run `33932159043`で確認した。現在のDB適用済み追加migrationは、status正規化`202609050001`、即時CPU`202609050002`、デバッグroom境界`202609050003`、クイズ回答feedback`202609050004`、クロガネv2`202609050005`である。

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
| 正本 | `origin/main` | 公開ゲーム資産基点は`e0f4f98`。migration `202609050001`–`202609050005`、クロガネv2対応Edge、Pages run `33949936952`まで公開確認済み。記録・検査専用commitが後続する |
| 現在の統合床 | `codex/standard-release-command` | `main`と同じ公開履歴へ同期。次は物理二端末受入と24時間負荷確認 |
| 公開済み現候補 | ゲーム資産`e0f4f98` | クロガネv2までの公開機能に、スマホ初期表示から使える6枚準備CTAを追加。公開UI、DB、Edge、Pagesの自動／有限canary確認済み |
| 保全済み | detached `a8fce7d` dirty床 | `codex/salvage-a8fce7d-20260904` / `9e4e8ee` に秘密情報なしでWIP保全済み。機能単位で比較 |
| 凍結root | root `ac78282` | 正史worktreeを内包するため作業床は維持。dirty 40件は救出済みで、丸ごとmerge禁止。正本にない候補の採否は完了 |
| GitHub保管 | `codex/archive-standard-release-1f823b2` | 正史の祖先でない孤立コミットをGitHubへ退避済み。作業床は削除 |
| 整理済み | clean旧作業床22個 | HEAD、branch、dirty=0を個別確認し、`--force`なしで作業床だけを削除。到達可能な履歴は維持 |
| 整理済み | UI `6ac4a29`、phase2 `93a5578`、solo `9bfbaf8` | 全tracked差分がCRLFだけ、staged/untracked/秘密候補0、salvageから到達可能と二重確認し、改行差分だけを破棄して作業床を削除 |
| 整理済み | online rc4 `b98351c` | dirty全21ファイルがrootの同名ファイルとバイト単位で一致、staged 0、branch保全済みと二重確認し、重複作業床だけを削除 |

## 設計と実装の対応

| 文書／構想 | 判定 | 次の扱い |
| --- | --- | --- |
| 合言葉不要マッチング＋CPUフォールバック | `origin/main@a3425a4`でPUBLIC_VERIFIED | 自動live canaryは完了。物理二端末で対人/CPUの完走、復帰、再戦を確認する |
| クイズ・スキル・バランス | 即時採点、答え合わせ、持ち色変更説明、クロガネv2までPUBLIC_VERIFIED | 物理端末の操作感を確認し、公開後24時間指標と分離して記録する |
| online MVP status／live regression | 現行公開識別子と有限な証拠を`STANDARD_RELEASE_EVIDENCE.md`へ集約 | 古い時系列ログは履歴として保持し、現行状態と混同しない |
| 二端末P0 handoff | PENDING | `e0f4f98`の対人/CPU完走、途中再読込、再戦、永続化だけを残件として回収 |
| nested Expo設計群 | 旧ローカル試作 | 現行Standard Onlineから凍結分離 |

## 体験改善の判断軸

改善は次の順で評価する。

1. 初戦開始までの迷いと操作数を減らす。
2. 「相手に塗らせる領域を作る」という独自の駆け引きを伝える。
3. 操作結果と勝因を自然な日本語と演出で返す。
4. 再戦、クイズ、ガチャ、収集を一つの循環としてつなぐ。
5. 安全性と再現性を保ったまま、公開環境で完走できる。
