# 公開UX復旧マスター台帳 — 2026-09-07

この台帳は、緊急7件だけをタスク全体と誤認しないための作業用一覧である。正本は `HANDOFF_PUBLIC_UX_RECOVERY_20260907.md` と `PROJECT_COMMAND_CENTER.md` の User Decision Ledger。作業床は `codex/public-ux-recovery-live-20260907` / `.codex-worktrees/public-ux-recovery-live-20260907`。

最新の作業順は、(1)おまけ色残数、(2)★4角膨張、(3)registryレアリティ、(4)Lv3/4強化とLv5維持＋延長、(5)CPU敗北イラスト、(6)クイズbutton物理移動。ロビー、接触演出、封印、★1ひとふくらみは追跡を継続するが後順位。角膨張とひとふくらみを混同しない。

## P0 public regression 再現・原因表

| 要求 | 出典区分 | 現状 | 再現・原因 | 担当・worktree | 次の証拠 |
| --- | --- | --- | --- | --- | --- |
| 接触演出を本人のセル選択時だけへ | ユーザー確定・旧契約を上書き | IMPLEMENTING | `observeCommittedContact` がactor/seatを見ず新しい公開`CREATE_REGION` traceを全端末で演出する。local draft observerがない | UX/a11y・本worktree | 2→3の段階追加、相手/poll/reload無発火をChrome/Edgeで確認 |
| 色ボタン内のおまけ色残数 | ユーザー確定 | LOCAL_VERIFIED (`2f75e40`) | 所有中の全色を正規化する`colorChoiceDetails`を追加し、実ボタンへ`おまけ色 残りN回`を表示。基本色重複時は残0でも使用可能 | UX/privacy・本worktree | 非browser 477/477、lifecycle Edge 79/79、online Edge/Chrome各83/83。次はmain/Pages/live確認 |
| 封印色の鍵と残期間 | ユーザー確定 | LOCAL_VERIFIED (`2f75e40`) | 残0おまけ色も消さずdisabledで保持し、鍵と公開封印残数を同じボタンへ表示。相手private paletteは参照しない | UX/privacy・本worktree | 同上。次はmain/Pages/live確認 |
| クイズbutton全体の衝突移動 | ユーザー確定・fixed hitboxを上書き | IMPLEMENTING | grid上のbuttonは固定で、子`span.quiz-option-float`だけ2–3px drift。衝突計算がない | Quiz/UX/a11y・本worktree | whole-button座標変化、bounds、非重複、衝突、停止条件、resize、exactly-once |
| 6枚/対象指定へregistryレアリティ | ユーザー確定 | IMPLEMENTING | clientの`SKILL_META`は名前/categoryの複製でrarityを持たず、registry artifactも読んでいない | UX/registry・本worktree | source registryから生成、21件parity、表示browser test |
| 中幅ロビーreflow | ユーザー確定・旧live判定を再開 | IMPLEMENTING | 高優先度の`#lobby ... auto-fit minmax(280px)`が1180px content内へ3cardを詰め、旧1080px breakpointより上でfriend/public controlsが潰れる | responsive・本worktree | 390/報告中幅/wideでoverflow・clip・overlap 0、controls 44px以上 |
| ひとふくらみ合法使用と失敗案内 | ユーザー確定 | IMPLEMENTING | engine/bundleの合法fixtureは成功するが、online `beginSkill`が既選択を消して再選択を強いる。候補0/不正選択のcodeはclient allowlist外で一般エラーになり、再選択可能性が伝わらない | Rule/UX/Edge・本worktree | UI payload→source engine→generated bundle成功、違法時state/card/RNG/write不変と日本語案内 |

## 別管理マスターバックログ

| 要求 | 出典区分 | 現状 | 担当・worktree | 次の証拠 |
| --- | --- | --- | --- | --- |
| 日本語の小規模紹介入口、短いルール、現行画像、CPU CTA、友だち対戦、OGP、Search Console | ユーザー確定 | 未着手 | discovery backlog・未割当 | 範囲設計と検索console所有確認。外部投稿は別承認 |
| 盤面を主役にし、pink/frame/persistent説明/巨大結果/重複投了を削減 | ユーザー確定 | 実装候補・既反映分あり | UX backlog・未割当 | 現行public差分監査と390/wide視覚確認 |
| 0選択時は最初のlegal candidate、以後connected guidance | ユーザー確定 | 実装候補・既反映分あり | board UX backlog・未割当 | no-oracle境界を保つbrowser test |
| 強制持ち替え/汚染をaffected playerへ即時通知 | ユーザー確定 | 未着手監査 | feedback backlog・未割当 | current-seat private event、opponent leak 0 |
| Lv5延長、Lv3/4を実質難化 | ユーザー確定 | 未着手監査 | Quiz/Edge backlog・未割当 | 現行template/time監査後、具体値を別決定 |
| memo/mini calculator | 提案のみ | HOLD・未承認 | 未割当 | ユーザー承認 |
| curse backlashをskill timingで消さず次の彩色まで保持 | ユーザー確定 | 未着手監査 | Rule/Edge backlog・未割当 | opponent turnをまたぐstate machine test |
| seal cardのrarity/acquisition difficulty引上げと既存所持保全 | ユーザー確定 | 未着手監査 | Balance/registry/migration backlog・未割当 | exact mapping決定、既存inventory migration証拠 |
| 弱い★2 seal cardの具体案 | 提案のみ | HOLD・未承認 | Game design backlog・未割当 | mechanics/nameのユーザー承認 |
| CPU敗北時の固有落胆＋大きい全身絵、毎勝利1回、PvPなし、画像失敗非阻害 | ユーザー確定 | 実装候補・HOLD解除 | `codex/standard-cpu-portraits-p1-20260907` | `a9a1fc0`とdocs `5e1ad55`を監査し、IndexedDBを除外して採用 |
| 使用256×256 WebPだけ、NOTICE/manifest/credit維持、追加連絡不要 | ユーザー確定・author contact旧TODOを上書き | 実装候補・portrait release待ち | portrait worktree | asset/credit/license manifest監査 |
| portrait gallery/encyclopedia | 提案のみ | HOLD・未承認 | 未割当 | ユーザー承認 |
| 外部promotion/ad/broad SEO | 提案のみ | HOLD・未承認 | 未割当 | ユーザー承認 |
| IndexedDB feedback rewrite | 既存候補・未完 | HOLD | `codex/standard-cpu-portraits-p1-20260907` | docs/release review、portraitから分離 |
| 五タブ、anonymous-first、no-auto-loss、category window、math scroll、Kurogane、direct-cell corner bloom、no-op非消費、CPU→gacha→loadout→rematch、quiz feedback、active-room/realtime/exactly-once/settlement | 既反映・保持必須 | PUBLIC_VERIFIED（非回帰対象） | 本worktreeで保護 | official full contract gate 0 skip |
| 物理二端末受入 | ユーザー確定 | PENDING | ユーザー＋司令塔 | 別端末でPvP/CPU完走、復帰、再戦、永続化 |
