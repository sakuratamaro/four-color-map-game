# 四色地図ゲーム 司令塔台帳

更新日: 2026-09-06

目的: 四色地図ゲームを、迷わず始められ、駆け引きが伝わり、もう一局遊びたくなる体験へ磨き上げる。

この台帳は、設計・実装・未コミット作業・公開済み状態を混同しないための入口である。公開可否の有限な証拠は `STANDARD_RELEASE_EVIDENCE.md`、具体的な公開順序は `STANDARD_PUBLIC_RELEASE_RUNBOOK.md` を正本とする。

## 司令塔ルール

- 統合基点は `origin/main` とし、現在の公開製品基点は `75791fb`。角膨張の盤面主導・keyboard完走、固定UIと交差しないエラー表示、履歴outline撤去を、待機相手通知・CPU実況・legal-recolor LAB・390px盤面導線・盤面選択アシスト・クイズ明確化へ累積している。
- 現在の統合作業は `codex/standard-release-command` だけで行う。
- 古いdirty worktreeからbuild、merge、deployしない。
- `実装済み`、`ローカル検証済み`、`live検証済み`、`公開済み`を別状態として記録する。
- 変更は製品テスト、live preflight、canary、公開後確認の順に昇格させる。
- private情報漏えい、二重精算、二重マッチ成立、相手誤表示は一件でも公開停止条件とする。

## 現在の優先順位と担当

| 優先度 | 作業 | 主担当 | 状態 | 完了条件 |
| --- | --- | --- | --- | --- |
| P0 | Standard/Quick修正束の公開 | 司令塔 | PUBLIC_VERIFIED | `881bd17`。focused非browser 123/123、Windows browser run `33961455909`のChrome/Edge、Pages `33961706817`が成功。公開asset v18、Quick save codec v20260905-2、candidate preflight、実ブラウザconsole 0を確認 |
| P0 | 終局理由とfinished表示の整合 | ルール＋UX | PUBLIC_VERIFIED | `33bc870`。敗者本人にだけ公開盤面＋本人private状態から`NO_LEGAL_COLOR`/`SEALED_OUT`内訳を表示し、reload後も保持。finished後の待機・CPU思考・再送状態を停止。相手private漏えい否定browserを含め公開済み |
| P0 | Quick Half Shift後の保存freeze | Quick＋保存 | PUBLIC_VERIFIED | `5b850c8`。12x12 worldへ移動した合法regionを保存可能にし、micro由来macro・四近傍連結を厳密検証、旧v1 saveを正規化。関連24/24、公開save codec markerと実画面console 0を確認 |
| P0 | active roomと新規対戦導線の排他 | UX＋同期＋DB | PUBLIC_VERIFIED | `03c5628`。全入口guard、画面だけ閉じる＋同じroom復帰、member insert/updateとroom再活性化triggerを公開。migration `202609050006`、DB verify 61/61、Windows `33966896517`、Pages `33967367304`、公開CPU戦復帰を確認 |
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
| P0 | Supabase資源とRealtime負荷の追跡 | 運用 | OBSERVED_PARTIAL | T0に加え、`STANDARD_RESOURCE_DIAGNOSTIC_20260905.json`をread-only取得。DB 15,297,683 bytes、最大ゲームrelation 327,680 bytes、blocked/idle-in-transaction 0、Realtime slot 2/2 active、slot別最大WAL lag 16,776,968 bytes、期限切れ候補はroom 11件・他0件。ゲーム表肥大をdisk警報の主因とする証拠はなく、単発値だけでslot追従も断定しない。T+24hで時系列比較する |
| P0 | 別々の二端末による最終受入 | チャッピー先生＋司令塔 | PENDING | 対人/CPUの完走、復帰、再戦、永続化を確認 |
| P1 | 対戦を主役にする情報設計 | UX | PUBLIC_VERIFIED | 5タブ化し、ホームの主CTAから対戦タブ内の初回profile作成・同期・ロビーまでを一本化。公開URLの390px実画面で確認済み |
| P1 | 初回オンライン準備を一操作に短縮 | UX | PUBLIC_VERIFIED | `9d42784`。名前入力後の一操作でstarter保存とprofile同期を行い、自動入室はしない。空名write 0、同期二重送信防止、失敗時starter保持。公開CTA確認済み |
| P1 | 接続状態を対戦中も常時表示 | UX＋同期 | PUBLIC_VERIFIED | `9d42784`。全5タブで単一statusを表示し、room外offlineも反映。公開390px画面で固定statusと下部navの8px間隔を確認 |
| P1 | プレイヤー向けno-color自動終局（履歴） | UX＋ルール | SUPERSEDED_BY_RULE_REVIEW | 同一action内の自動終局という既存契約は公開済みだが、正当なCOLOR救済スキルより先に終局する設計欠陥を独立監査で確認。現状確認の証拠は保持し、下記の共通COLOR応答窓で置換する |
| P1 | Standardを学んで即CPU戦へ入る導線 | ゲーム体験 | PUBLIC_VERIFIED | 初手ガイドに加え、ホーム／ロビーから10人のStandard CPUを選んで待ち時間なく6枚準備へ入る公開導線を実画面確認済み |
| P1 | 6枚提出から初手案内への引き継ぎ | UX | PUBLIC_VERIFIED | `29c6958`。提出操作自身がready→playingを観測した時だけ、ランダム結果後に対戦見出しへ移動。reload、poll、backgroundではfocusを奪わない |
| P1 | 6枚セットアップの即時確定 | UX | PUBLIC_VERIFIED | `e0f4f98`。390×844の初期表示から、選択済みスターター6枚と準備OK、確定CTAを下部nav直上へ固定表示。無効構成ではdisabled、準備送信1回、公開CPU対戦開始まで確認。Windows run `33950043659`はChrome/Edge成功 |
| P1 | CPU戦終了から次の一局への循環 | ゲーム体験 | PUBLIC_VERIFIED | `29c6958`。同じCPU再戦に加え、結果を残したまま別CPUを選んで即時新対戦へ進める。公開API完走・同CPU再戦canary 25/25 |
| P1 | CPU報酬からガチャへの直行 | ゲーム体験 | PUBLIC_VERIFIED | `e36dfcc`＋表示追補`193a0e6`。保存済み通常CPU精算だけにCTAを出し、抽選せずLv.1ガチャへ移動して見出しへfocus。対人・未精算・debugは非表示。390×844、再読込、券消費の一度だけ保存を検査し、Windows run `33951596007`、Pages run `33951598229`成功 |
| P1 | 野良成立時のクイズ・ガチャから対戦への安全な引継ぎ | ゲーム体験＋同期 | PUBLIC_VERIFIED | `1e856f9`。回答・抽選のexactly-once境界と650msの正誤表示を完了してからsetupへ移動。クイズ時計は対戦中に凍結し、明示的なQuiz再訪でだけ再開。手動Battle迂回、別タブ、reload、CPU、合言葉、終了済み・失効roomを回帰固定。Windows run `33956185495`、Pages run `33956373181`成功 |
| P1 | CPU報酬ガチャから6枚再編成・同CPU再戦への循環 | ゲーム体験＋進行 | PUBLIC_VERIFIED | `dab28e5`。保存済み通常CPU報酬起点の抽選成功後だけ結果・効果・再戦CTAを表示し、reload後も同一room/version/matchだけ復元。未解決抽選は新規drawを封鎖して同じIDだけ再確認し、獲得カードは自動選択せず6枚選択へ戻す。Windows run `33958531045`、Pages run `33958727024`成功 |
| P1 | 中幅ロビーとガチャ結果の整理 | UX | PUBLIC_VERIFIED | `00d198f`。980px帯を2列＋野良全幅へreflowし、760px以下は1列。通常ガチャの重複大見出しを除き、CPU報酬は次戦CTAだけに整理。公開asset v18へ反映済み |
| P1 | クイズの遊び心・学習feedback | クイズ＋Edge | PUBLIC_VERIFIED | `881bd17`。各問にmission、形式label、1–3段階の考え方を追加し、server確定結果で2/4/6 streakを表示。Edge deployment 14、live canary 7/7、公開asset v18 |
| P1 | room作成前の6枚編成と明示CPU開始 | UX＋同期 | PUBLIC_VERIFIED | `03c5628`。Cardsのroom外6枚保存、CPU選択local-only、`stage/roomId/replaceRoomId`付きimmutable二段sagaを公開。start/setup応答喪失とstale別タブを46 browser testで固定 |
| P1 | waiting/readyの正式な無報酬離脱 | UX＋DB | PUBLIC_VERIFIED | `426dc41`＋migration `202609050007`。同一actionを冪等再送し、waiting/readyだけを無報酬でabandonedにする。playingは既存SURRENDER、finishedは結果導線を維持。DB 66/66、live 33/33、Windows run `33969830340`、Pages `33970429997`、公開v20を確認 |
| P1 | 接触色の累積feedback | 演出＋アクセシビリティ | PUBLIC_VERIFIED | `ecafdd1`。確定CREATEだけで2色=[2]、3色=[2,3]を700/900msで表示し、4色は終局overlayへ一本化。reduced-motionは最終静止tier、読み上げ最終1回、選択/poll/reload/replay/重複では発火しない。Windows gate `33973264978`、Edge deployment 15、Pages `33973971235` |
| P1 | 直前の手→盤面変化→次の判断 | ゲーム理解 | PUBLIC_VERIFIED | `ecafdd1`。CREATE/COLOR/USE_SKILLを公開allowlistだけで説明し、現phase/activeから次判断を導出。相手palette/hand、skill identity/target/payload、事前合法色oracleを非公開。Runbook A 44/44で本番projection確認 |
| P1 | 端末側の部屋情報喪失から安全に復帰 | UX＋同期＋DB＋Edge | PUBLIC_VERIFIED | `5acee05`＋検証追補`958a4da`。本人の生存roomを有限8列・最大2行で読み、厳格な1行だけ採用。private/public/CPU別の日本語案内、raw DB情報非表示、background focus非奪取、CPU/matchmaking saga優先を固定。migration `202609060001`、DB 68/68、live 10/10、Edge deployment 16、Windows `33976873376`、Pages `33977699993`合格 |
| P1 | 塗り直し・乱 LAB | ルール＋UX＋DB＋司令塔 | PUBLIC_VERIFIED | 製品`ad53bb4`、公開HEAD `3fb3ef8`。合言葉human対戦で双方同意した時だけ、通常19枚・6枚構成とは別に1回貸与。debugと排他、CPU/野良/戦績/報酬/在庫へ非干渉。DB 70/70、Edge deployment 17の基本7/7＋LAB 23/23、Windows `33984108011`、Pages `33984536803`、公開candidate preflight・匿名画面・console 0を確認 |
| P1 | 390px対戦開始時に盤面と操作を表示 | UX＋技術品質＋司令塔 | PUBLIC_VERIFIED | `2a1d2ef`。手番ガイド→盤面→確定操作を390×844の初期viewportへ収め、接続表示・下部navと非交差。明示開始だけ見出しfocus、reload/bootはfocusなし、wheel/trackpad操作後の強制scrollを抑止。ローカルonline browser 60/60、responsive 4/4、独立再監査P0/P1なし。Windows `33987952352`はChrome成功、Edge初回の既存badge待機timeout後に同一commitのfailed-job再実行成功。Pages `33988962006`、公開app v24/style v23、candidate preflight合格 |
| P1 | 最新手スポットライト＋手番到着beat | UX＋公開情報＋司令塔 | PUBLIC_VISUAL_SUPERSEDED | `afc89af`で金破線・水色実線を公開した履歴証拠は保持。プレイ中の視覚ノイズを減らすため`75791fb`で履歴outlineと凡例を撤去した。白い現在選択、緑の接続候補、紫の角膨張基準、有限な手番到着beatは維持 |
| P1 | 盤面選択アシスト | UX＋ルール＋技術品質＋司令塔 | PUBLIC_VERIFIED | `72040b8`。任意200% zoom、44px以上のmacro、drag panとtap分離、矢印・Space/Enter/Escape、edge-connected候補を提供し、合法手oracleにはしない。390×844でzoom・手番操作・固定接続表示を非交差化。失敗run `33996927953`–`33999028771`を保持して製品／harnessを修正し、Windows `33999760232`はChrome/Edge各64件成功、Pages `34000125784`、公開app v28/style v26。独立3監査GO、DB/Edge変更なし |
| P1 | クイズ曖昧問題と進捗表示 | クイズ＋UX＋Edge＋司令塔 | PUBLIC_VERIFIED | `a4b9917`。二次方程式を「小さい方の解」と明記し、ACK済み回答だけを「採点済み履歴」へ算入。券は「見込み・未確定」、救済は「3ミス時」、到達不能も明示し、完了・報酬判定はserver authoritativeのまま。ローカルunit 212/212・Edge browser 65/65、Windows `34003307900`、Edge deployment 20の基本7/7＋Runbook B 234/234、Pages `34004028751`、公開10問完走を確認 |
| P1 | 待機相手の匿名通知 | UX＋DB＋司令塔 | PUBLIC_VERIFIED | `1eecb0a`＋migration `202609060003`。認証済み利用者へ相手待ちの有無だけを返し、本人・活動中roomを除外。30秒poll、最大300秒backoff、hidden/offline/自身の募集・対人中を停止。DB 72/72、Windows `34013907089`、Pages `34014339235`、公開390pxを確認 |
| P1 | CPU実況とクイズ固定hitbox | ゲーム体験＋UX＋ルール | PUBLIC_VERIFIED | 10人のCPUへ公開eventだけの個性文を付け、対戦タブ外・reload・background再演とprivate情報参照を禁止。クイズはボタン矩形を固定し内側labelだけを漂わせる。Chrome/Edge各71件、390pxで固定通知・盤面・下部nav非交差、公開console 0を確認 |
| P1 | 角膨張の盤面主導・keyboard完走・エラー可視化 | UX＋ルール＋技術品質＋司令塔 | PUBLIC_VERIFIED | `75791fb`。数値入力を廃止し、渡すエリア→基準マスの2段階を盤面で選ぶ。44px盤面focus導線、pointer、Tab/Enter/Space、2マス接続候補、白/紫の現在状態を固定。長文toastは上部通知の下へ退避し、setup/成立済みconnection/navと遷移中も非交差。Windows `34017288334`のChrome/Edge各73件、Pages `34017695831`、公開app/style v34、candidate preflight、console 0を確認。DB/Edge変更なし |
| P1 | 救済スキルを塞がない共通COLOR応答窓 | ルール＋CPU＋UX＋Edge＋司令塔 | RULE_FIX_NEXT | COLOR進入時の自動終局を廃止し、全員に通常彩色／COLOR救済スキル／`DECLARE_NO_COLOR`／投了の同一窓を開く。宣言はserver authorityで合法色0を検証し、救済カード有無を公開stateへ漏らさない。engine version・CPU policy・UI・生成bundle・Edgeを一便で変更し、SQL/RPCは不要 |
| P1 | 持ち色汚染no-opの消費仕様 | ルール＋Edge＋UX | SPEC_NEXT | no-op時はカードを消費しないがaction・手番・機会は使用する案を有限仕様へ固定し、「変化なし・カードは戻った」だけを公開表示。engine/Edge変更前に再送・private境界を定義する |
| P1 | Shift説明と将来overlay skillの位相 | ルール＋UX | DESIGN_NEXT | 「ちぎれたり、くっついたり」を説明へ追加。merge後はcanonical numeric-min ID/controller unionを維持し、将来の差し色追加も現在の可視region/canonical ID＋盤面属性だけをrules入力にする |
| HOLD | 匿名＋任意Google identity link | 認証＋DB＋司令塔 | PHASE0_ONLY | 現在はSDK/RLS/Realtime/redirect/CSP/idempotency/token/log/admin境界のread-only監査だけ。provider有効化、callback、SDK、DB変更は別の公開便に分離する |
| P1 | 未コミット／孤立作業の回収 | 構成管理 | COMPLETED | 29床を3床へ集約。丸ごと統合候補は0。Quick回帰試験だけを回収し、残るroot dirtyは救出済み・凍結管理 |
| P2 | GitHub Pages actionのNode.js警告解消 | 技術品質 | BACKLOG | 公開結果を変えず、Node.js 20廃止予定warningを消す |

2026-09-06のactive-room復帰公開判断では、3担当をDB/Edge契約、UX/browser、worktree/旧タスク監査に分け、全員P0/P1なしを確認した。ローカルEdge browser 56/56、Windows Chrome/Edge、DB 68/68、Edge本番7/7＋復帰10/10、Pages、公開HTTP/ブラウザの順で昇格した。additive SQLだけを追加し、secret/billing/deletion/cleanupは変更していない。

同日の「塗り直し・乱」LABでも、ルール/DB、UX/accessibility、repository/CIの3担当へ分担した。公開ゲートの弱いDB probe、UI marker、CI pathsを独立担当が公開前に発見し、実asset正方向テストまで補強した。最終P0/P1なし、`202609060002`→Edge deployment 17→live canary→Pagesの順で公開確認した。

同日の390px盤面導線は、UX実測、ルール/公平性、repository/release gateへ分担した。開始時の盤面外れを直す過程で、色操作feedbackを再び画面外へ押し出す配置とwheel操作後の強制scrollを独立監査が公開前に発見し修正した。さらに正式browser harnessの古い件数固定を意味検証へ置換してCI unit列へ追加した。最終P0/P1なし、Windows Chrome/EdgeとPages、公開asset/candidate preflightの順で昇格した。

最新手スポットライトは、実装、公開情報境界、390px UXを既存3タスクへ再分担した。独立監査は二重読み上げ、背景復帰再演、線幅、描画順、接触演出競合、非表示tabのcanvas倍率、凡例による盤面遮蔽を公開前に検出した。初回Windows run `33992219065`のChrome/Edge双方61/62で見つかった初手余白も製品側で修正し、`afc89af`のrun `33992923690`で両browser成功後にmain・Pages・公開preflightへ昇格した。

盤面選択アシストは、repository/release、rules/privacy、390px UXを3つの既存タスクへ再分担した。監査で、盤面overlayボタンがmacroを遮る案と、mobile gridでzoomが3段目へ落ちる案を公開前に棄却した。Windows runs `33996927953`、`33997445395`、`33998002235`、`33999028771`の失敗を省略せず、初手clearanceとbrowser依存のscroll restorationを製品・試験双方で修正した。`72040b8`のrun `33999760232`でChrome/Edge各64件成功後、main、Pages `34000125784`、公開DOM/assetへ昇格した。3担当の最終判定は全てGO、P0/P1なし。

クイズ明確化は、rules/privacy、UX/accessibility、repository/releaseを同じ3タスクへ再分担した。ACK前の回答を進捗へ混ぜないこと、報酬見込みを確定値と誤認させないこと、390pxで全状態を同じ高さに保つことを独立監査した。初回run `34003126498`はWindows CRLFでgenerator runtime抽出が失敗し、LF/CRLF回帰を追加した`a4b9917`のrun `34003307900`でChrome/Edgeとも成功。Edgeエディタの追記操作でdeployment 19がboot errorになった履歴も残し、正しい単一内容をdeployment 20へ修復して基本7/7とRunbook B 234/234を完走後、Pages `34004028751`と公開10問完走まで昇格した。3担当の最終判定は全てGO、P0/P1なし。

直前の公開履歴も維持する。`29c6958`は非browser 528/528、ローカルChrome/Edge各25/25、Windows run `33933769885`（Edgeは終了処理timeout後のattempt 2成功）、Pages run `33934125859`で公開確認した。即時CPU開始は`cc96350`、migration `202609050002`、Edge deployment 9、Windows run `33931963065`、Pages run `33932159043`で確認した。現在のDB適用済み追加migrationは、status正規化`202609050001`、即時CPU`202609050002`、デバッグroom境界`202609050003`、クイズ回答feedback`202609050004`、クロガネv2`202609050005`、単一active room境界`202609050006`、開始前取りやめ`202609050007`、active-room復帰`202609060001`、setup revision guard `202609060002`、待機相手の匿名availability `202609060003`である。

角膨張便は、repository/release、rules/privacy、UX/accessibilityを3つの既存タスクへ再分担した。初回run `34016075931`はasset version契約、次の`34016221487`は390pxの3行toastと接続表示の7px交差を検出し修正した。`69cd67d`のrun `34016798886`は成功したが、独立UX監査がsetup/成立済みconnection、複数マス候補、keyboardの盤面復帰というP1を追加発見したため昇格せず、`75791fb`へ修正した。最終run `34017288334`、Pages `34017695831`、公開HTTP/preflight/Chrome consoleまで成功。長いaggregate runnerの既存contact-pressure tier4 handover待ちは`standard-v5`側の別件として失敗を保持し、このUI便の全成功とは記録しない。

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
| 正本 | `origin/main` | 公開製品基点は`75791fb`。migration `202609050001`–`202609050007`＋`202609060001`–`202609060003`、Edge deployment 20据え置き、Windows run `34017288334`、Pages run `34017695831`まで公開確認済み |
| 現在の統合床 | `codex/standard-release-command` | 公開製品commit `75791fb`を含み、証拠台帳追補をこの床で同期する |
| 公開済み現候補 | `75791fb` | 角膨張の盤面2段階target、2マスkeyboard完走、connected cue、固定UIと交差しない長文toast、履歴outline撤去を追加。公開app/style v34、client v18、skill-intents v17、CPU commentary v1。Chrome/Edge各73件、Pages、candidate preflight、公開HTTP/Chrome console 0を確認済み。DB 72/72とEdge deployment 20は変更なし |
| 保全済み | detached `a8fce7d` dirty床 | `codex/salvage-a8fce7d-20260904` / `9e4e8ee` に秘密情報なしでWIP保全済み。機能単位で比較 |
| 凍結root | root `ac78282` | 正史worktreeを内包するため作業床は維持。再監査したdirty 39件のうち38件は既存commitと一致し、残る旧handoff文書も現正本で置換済み。丸ごとmerge禁止、回収残件なし |
| GitHub保管 | `codex/archive-standard-release-1f823b2` | 正史の祖先でない孤立コミットをGitHubへ退避済み。作業床は削除 |
| 整理済み | clean旧作業床22個 | HEAD、branch、dirty=0を個別確認し、`--force`なしで作業床だけを削除。到達可能な履歴は維持 |
| 整理済み | UI `6ac4a29`、phase2 `93a5578`、solo `9bfbaf8` | 全tracked差分がCRLFだけ、staged/untracked/秘密候補0、salvageから到達可能と二重確認し、改行差分だけを破棄して作業床を削除 |
| 整理済み | online rc4 `b98351c` | dirty全21ファイルがrootの同名ファイルとバイト単位で一致、staged 0、branch保全済みと二重確認し、重複作業床だけを削除 |

## 設計と実装の対応

| 文書／構想 | 判定 | 次の扱い |
| --- | --- | --- |
| 合言葉不要マッチング＋CPUフォールバック | `origin/main@a3425a4`でPUBLIC_VERIFIED | 自動live canaryは完了。物理二端末で対人/CPUの完走、復帰、再戦を確認する |
| クイズ・スキル・バランス | 即時採点、答え合わせ、曖昧問題とACK済み進捗、持ち色変更説明、クロガネv2までPUBLIC_VERIFIED | 物理端末の操作感を確認し、公開後24時間指標と分離して記録する |
| online MVP status／live regression | 現行公開識別子と有限な証拠を`STANDARD_RELEASE_EVIDENCE.md`へ集約 | 古い時系列ログは履歴として保持し、現行状態と混同しない |
| 二端末P0 handoff | PENDING | `75791fb`の対人/CPU/LAB完走、390px盤面導線、盤面選択アシスト、角膨張2段階、履歴outline撤去後の現在選択、クイズ進捗、確定接触feedback、公開戦術trace、開始前取りやめ、終局理由、Quick継続、途中再読込、報酬→ガチャ→6枚再編成→再戦、永続化だけを残件として回収 |
| active-room排他・room外6枚編成・開始前取りやめ | `426dc41`でPUBLIC_VERIFIED | 次便は競合時の既存room再同期・日本語文言を独立して改善する |
| 新カード候補 | `legalRecolor`をLAB限定で条件付き採用 | IDは維持し表示名を「塗り直し・乱」、妨害★3/WORK、ガチャOFF・双方1回貸与で公開。二色市松は1地域1色モデルを壊すため別rulesetへ分離 |
| Google identity link | 匿名＋任意linkはPhase 0の暫定候補、採否未決定 | 既存匿名導線を維持したread-only監査だけを行う。採用時のrollback候補は新規link入口/UIを閉じてPagesを戻し、既にlink済みの利用者を解除しない |
| nested Expo設計群 | 旧ローカル試作 | 現行Standard Onlineから凍結分離 |

## 体験改善の判断軸

改善は次の順で評価する。

1. 初戦開始までの迷いと操作数を減らす。
2. 「相手に塗らせる領域を作る」という独自の駆け引きを伝える。
3. 操作結果と勝因を自然な日本語と演出で返す。
4. 再戦、クイズ、ガチャ、収集を一つの循環としてつなぐ。
5. 安全性と再現性を保ったまま、公開環境で完走できる。
