UDL023 v14「だれとでも」の二択UIについて、固定候補のゲーム公開レビューをお願いします。これは新しい独立スライスの依頼1回で、完了した042の再審査や再送ではありません。

SUBJECT_SHA: 84587830730c1f62cf8c502daac4d768886a3f4d
BASE_SHA / RELEASE_AFTER_SHA: 70e691b6f8f1d808476e80990d20df7862bfb782
現在の公開main: 954e1c5c52d5453fc9fee9872b2d7e922f850a39
repository: sakuratamaro/four-color-map-game
branch: codex/ui-public-match-actions-20260913
CANON_VERSION: shared-canon-v1.1
FEATURE_SPEC_VERSION: UDL-023-public-actions-v1
SPEC_BLOB: 468dad9e85fa633e47ea75a79628d18a0ad10565
SCOPE: Pages_only
DB_CHANGE_SET: []
EDGE_CHANGE_SET: []
MANAGED_SETTING_CHANGE_SET: []

本人出典は、この会話のuser bbb2135e-cfd1-4da8-845b-9e3d07d8b29a、頭脳v14のADD-20260913-PUBLIC-MATCH-TWO-ACTIONS（既存UDL-20260907-023）です。旧9515の公開をこの新しい受入へ流用しません。

【取得できる固定成果物】
仕様:
https://github.com/sakuratamaro/four-color-map-game/blob/84587830730c1f62cf8c502daac4d768886a3f4d/docs/UI_PUBLIC_MATCH_ACTIONS_20260913.md
全16テキストファイル差分（画像なし）:
https://github.com/sakuratamaro/four-color-map-game/blob/58f2cac4745fd349aa402670cee262ef67cee7a4/docs/UI_PUBLIC_MATCH_ACTIONS_REVIEW_20260913.patch
raw:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/58f2cac4745fd349aa402670cee262ef67cee7a4/docs/UI_PUBLIC_MATCH_ACTIONS_REVIEW_20260913.patch
検証・失敗履歴:
https://github.com/sakuratamaro/four-color-map-game/blob/58f2cac4745fd349aa402670cee262ef67cee7a4/docs/UI_PUBLIC_MATCH_ACTIONS_LOCAL_20260913.md

全差分は42394文字／45602 UTF-8 bytes、SHA256 d68fa62cd96c0e74fa872371bdafcbd782c65f255d1dbf9625c2eb06ef5d163d。70e..845のgit diffと保存物を厳密一致確認し、リモートraw全文の同一性も確認しました。動くbranchではなく上記固定SHAを審査してください。

【変更】
公開対戦の中に「相手を待つ」「待っている相手に参加」を、同時に見えるnative button2個で置きました。前者は既存recruit、後者は既存findだけを呼びます。旧「相手を待つだけにする」のdetailsを廃止し、joinで相手なしなら自動募集せず「待っている相手はいませんでした。『相手を待つ』で募集できます。」と案内します。これは本人の二択要望に従った旧自動募集仕様の明示的置換です。

既存のbusy、room/ticket/CPU所有権guard、同じ操作IDの永続化・応答喪失後reload、待機取消、CPU/クイズ中の対局引継ぎ、6枚選択は維持しています。client/RPC/DB/Edge、CPU・ルール・報酬・画像は変更していません。公開assetはapp45/ui-diet4、親のcutinJS2/CSS1は保持。Windows対象branchの既存allowlistへこの専用branchだけを追加しています。

【実行済み／未完を区別】
・最初の新回帰は1/2、旧自動募集を検出してFAIL。その後実装。
・最終静的/client等141/141、skip0。
・Edge重点9/9、skip0。Chrome初回8/9は旧ボタン名locatorのtimeout。locator修正後のChrome補完14/14には当該6枚選択と既存待機/クイズ引継ぎ、UDL065カットイン全9件が含まれます。初回FAILを削除せず、単一22/22の実行とは数えません。
・初回dirty-tree全体995/998の3失敗は、clean証明の正常な拒否と旧runbook marker2件。ゲートを弱めず、親70e/app44と後続UI/app45を別の公開laneへ分けました。
・最終固定845のclean全体147/163非browserファイルは999/999、skip0。生成bundle3種のtracked差分0。新SQLの適用なし。
・実ブラウザーfixtureで、pending中の二重操作、wait同ticket reload/cancel、lost-find同ID reload、空findでrecruit0、join成功、320px文字拡大のoverflowを検証。Chrome390/768/1280の3画像を目視済み。物理端末／実ユーザー相手の募集・参加はNOT_RUN。
・同SHA Windows run34740424933 attempt1:
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34740424933
05:42:17Z時点は両online browser job IN_PROGRESSであり、まだWindows合格と報告しません。準備・生成物・CPU契約は両成功、既存Edge lifecycle成功、Chrome lifecycleは既定のskipです。両jobの最終SUCCESS前には公開しません。再実行は開始していません。

【親候補と本人のクロガネ指示は保全】
親70eは実042でAPPROVE_RELEASEのままですが、freshな現行Edge source ZIPが未取得で配備前停止しています。通常Download2回の保存物未取得と内部pageの安全拒否を保全し、本人に通常画面からのZIP保存を一度依頼済み。古いZIPで代用、拒否迂回、ゲート免除、再承認待ちへの読み替えはしません。この845を親より先にmainへ進めず、親70eの正規公開が確認できてから扱います。

クロガネの持ち色変更は本人の直接指示どおり1対局100回、好きな技加点・自由な変更を維持し、無益フィルターから除外した9590候補で固定済みです。本人の意図を再び抑制案へ戻しません。039とCPUの未合格Windows・古い基準SHAの統合問題は別件で、このUIのCI/レビューを流用しません。旧040 rawFAIL・精算未確認、067部分受入、062限定受入、F3公開は不変です。

【今回お願いする判定】
この正確な候補・仕様・Pages_only/空変更セットについて、DECISION / SUBJECT_SHA / BASE_SHA / BLOCKERS / NOTESでレビューしてください。同SHA Windows両SUCCESS、親70eの公開とfresh main=70e、forceなし同845 main/Pages成功、変更asset厳密byte一致・既存write-free preflightという条件で進めてよいか判断をお願いします。候補/base/仕様が変われば旧承認を流用しません。

この便で追加profile/対局/本番find/recruit/実live試行は申請しません。公開asset確認、実ブラウザーfixture、物理NOT_RUN、本番マッチング挙動未観測を分離します。追加liveなしの公開確認範囲も明示していただければ、その範囲を守ります。

共有GOV58f2には結果保存と同じ既存司令塔の再開経路の追補もありますが、これは本UI製品候補へのAPPROVE_DOCS対象ではなく、042/旧文書承認も流用しません。新司令塔・第二キュー・第二heartbeatは作らず、送達後は20/40/100分・最大3回・120分期限の有限取得を同じ設定で行います。今回の本番変更は0です。
