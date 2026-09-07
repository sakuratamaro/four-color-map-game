# 公開UX復旧マスター台帳 — 2026-09-07

この台帳は、緊急7件だけをタスク全体と誤認しないための作業用一覧である。正本は `HANDOFF_PUBLIC_UX_RECOVERY_20260907.md` と `PROJECT_COMMAND_CENTER.md` の User Decision Ledger。作業床は `codex/public-ux-recovery-live-20260907` / `.codex-worktrees/public-ux-recovery-live-20260907`。

最新の作業順は、(1)おまけ色残数、(2)★4角膨張、(3)registryレアリティ、(4)Lv3/4強化とLv5維持＋延長、(5)CPU敗北イラスト、(6)クイズbutton物理移動。ロビー、接触演出、封印、★1ひとふくらみは追跡を継続するが後順位。角膨張とひとふくらみを混同しない。

## P0 public regression 再現・原因表

| 要求 | 出典区分 | 現状 | 再現・原因 | 担当・worktree | 次の証拠 |
| --- | --- | --- | --- | --- | --- |
| 接触演出を本人のセル選択時だけへ | ユーザー確定・旧契約を上書き | PUBLIC_VERIFIED (`844f563`) | required-sizeを満たした本人のlocal選択でだけ接触色数を計算し、公開traceの受信・CPU・poll・reloadでは演出しない | UX/a11y・本worktree | Windows `34137623118`、Pages `34139833503`、公開CPU戦でCPUの2色traceは0、人間の3マス完成選択は「二色接触！」1回、完全reload後0 |
| 色ボタン内のおまけ色残数 | ユーザー確定 | PUBLIC_VERIFIED (`2f75e40`) | 所有中の全色を正規化する`colorChoiceDetails`を追加し、実ボタンへ`おまけ色 残りN回`を表示。基本色重複時は残0でも使用可能 | UX/privacy・本worktree | main `e941d11`、Pages `34114644417`、公開app43/style41/intents20、candidate preflight、390px overflow 0、console 0 |
| 封印色の鍵と残期間 | ユーザー確定 | PUBLIC_VERIFIED (`2f75e40`) | 残0おまけ色も消さずdisabledで保持し、鍵と公開封印残数を同じボタンへ表示。相手private paletteは参照しない | UX/privacy・本worktree | 同上 |
| クイズbutton全体の衝突移動 | ユーザー確定・fixed hitboxを上書き | IMPLEMENTING | grid上のbuttonは固定で、子`span.quiz-option-float`だけ2–3px drift。衝突計算がない | Quiz/UX/a11y・本worktree | whole-button座標変化、bounds、非重複、衝突、停止条件、resize、exactly-once |
| 6枚/対象指定へregistryレアリティ | ユーザー確定 | PUBLIC_VERIFIED (`26c4bd2`) | `standard-skill-registry.js`から21件の公開metadataを決定的生成し、6枚一覧と対象パネルが同じrarityを読む。手書きrarityとinventory推測を撤去 | UX/registry・本worktree | main `72acb8c`、Pages `34123125700`、479/479＋79/79＋Edge/Chrome各83/83、公開app45/registry v1、preflight合格 |
| 中幅ロビーreflow | ユーザー確定・旧live判定を再開 | IMPLEMENTING | 高優先度の`#lobby ... auto-fit minmax(280px)`が1180px content内へ3cardを詰め、旧1080px breakpointより上でfriend/public controlsが潰れる | responsive・本worktree | 390/報告中幅/wideでoverflow・clip・overlap 0、controls 44px以上 |
| ひとふくらみ合法使用と失敗案内 | ユーザー確定 | PUBLIC_VERIFIED (`844f563`) | `source-macros`対象指定で盤面選択を保持し、候補0/不正選択を安全な日本語へ対応。authoritative engineと生成bundleを一致させた | Rule/UX/Edge・本worktree | 129/129、実Edge/Chrome各3/3、Windows `34137623118`、Pages `34139833503`、公開CPU戦で合法送信・カード消費・preparedOutgoingを確認。無効候補はカード・手番非消費 |

## 最新優先切片

| 要求 | 出典区分 | 現状 | 実装 | 担当・worktree | 次の証拠 |
| --- | --- | --- | --- | --- | --- |
| ★4 角膨張を実盤面で使える状態へ | ユーザー確定・★1ひとふくらみとは別 | PUBLIC_VERIFIED (`c5369b0`) | public geometry由来の送信対象を紫枠表示し、keyboard初期位置を最初の対象へ移動。成功可否はserverだけが判定し、候補0・旧room・位置不一致を原因別日本語で再選択可能にした | UX/a11y/privacy・本worktree | main `1c6ad47`、Pages `34118055876`、公開app44/client20、candidate preflight、overflow 0、console 0 |
| 6枚一覧・対象指定の正本レア度 | ユーザー確定 | PUBLIC_VERIFIED (`26c4bd2`) | authoritative registryからbrowser artifactを生成し、全19枚＋実験2枚の名前・category・usageCategory・rarityを共通化。6枚ボタンへ`（★N）`、対象指定へ星badgeを表示 | UX/registry・本worktree | main `72acb8c`、Pages `34123125700`、公開app45/registry v1、source parity、candidate preflight、overflow 0 |

## 別管理マスターバックログ

| 要求 | 出典区分 | 現状 | 担当・worktree | 次の証拠 |
| --- | --- | --- | --- | --- |
| 日本語の小規模紹介入口、短いルール、現行画像、CPU CTA、友だち対戦、OGP、Search Console | ユーザー確定 | 未着手 | discovery backlog・未割当 | 範囲設計と検索console所有確認。外部投稿は別承認 |
| 盤面を主役にし、pink/frame/persistent説明/巨大結果/重複投了を削減 | ユーザー確定 | 実装候補・既反映分あり | UX backlog・未割当 | 現行public差分監査と390/wide視覚確認 |
| 0選択時は最初のlegal candidate、以後connected guidance | ユーザー確定 | 実装候補・既反映分あり | board UX backlog・未割当 | no-oracle境界を保つbrowser test |
| 強制持ち替え/汚染をaffected playerへ即時通知 | ユーザー確定 | 未着手監査 | feedback backlog・未割当 | current-seat private event、opponent leak 0 |
| Lv5延長、Lv3/4を実質難化 | ユーザー確定 | PUBLIC_VERIFIED (`a0eeca7`) | Lv3/4各10テンプレートを複数段計算へ強化し、図形・行列式積を構造表示。Lv5全10問を初期実装値120秒へ延長し、Lv1/2時間は不変 | Edge deployment 25、Windows `34130696248`、Pages `34133326144`、live Lv1–5各10問、公開app47/style42、candidate preflight合格。120秒はユーザー指定値ではなく初期実装値 |
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
