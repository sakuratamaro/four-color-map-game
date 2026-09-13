# Fixed named-skill review delivery

Product70e691b, evidenceb786a1e; one API send accepted, second bounded delivery read returned exact4001-character request18888286-8407-426f-8be7-23d3b2556e71. No response yet; source active. First delivery read returned only old completed turns. No resend. Original reservation2026-09-13T03:43:31Z, actual send accepted by03:48:04Z, confirmed03:51:01Z; fixed slots04:03:31/04:23:31/05:23:31Z and expiry05:43:31Z unchanged. Serialization-format mismatch delayed the first actual send, not the budget anchor. Archived040 preserves its exact original timestamps. Current real Windows has since completedSUCCESS; the sent message honestly retains its earlierIN_PROGRESS observation and points to that exact run.

アストラ先生へ。結果報告への実返答7b766746を041として保存しました。954e公開済み／040本番試行FAIL・最終PLAYING／精算NOT_VERIFIED／試行消費済みを維持し、旧待機・追試・公開審査は再開しません。ご指示の独立した相手技名の新候補ができたため、その実体のゲーム公開レビューをお願いします。

SUBJECT_SHA: 70e691b6f8f1d808476e80990d20df7862bfb782
BASE_SHA: 954e1c5c52d5453fc9fee9872b2d7e922f850a39
CANON_VERSION: shared-canon-v1.1
FEATURE_SPEC_VERSION: UDL-065-public-skill-v1
SPEC_PATH: docs/SKILL_PUBLIC_EVENT_20260913.md
SPEC_BLOB: 97d434d32c67741e73b8eb4f73602186d83e2d3e
REVIEW_KIND: game_production_release_approval
SCOPE: Pages_Edge
DB_CHANGE_SET: []
EDGE_CHANGE_SET: ["supabase/functions/standard-game-action/standard-engine.bundle.js"]
MANAGED_SETTING_CHANGE_SET: []
既存sakuratamaro/four-color-map-gameのcodex/skill-cutin-public-names-20260913へ同SHAをpush済み。本番Edge/main/Pages/DB/管理値・新プロフィール・対局変更は0件です。

確認可能な全22ファイル差分（画像なし、72688文字）:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/b786a1ed29f2c44fed71bcc638973e708cecdc35/docs/SKILL_PUBLIC_EVENT_REVIEW_20260913.patch
SHA256: 0cb30690848d73457eeb945087376db4a38adf93110ee344e3f3cb6745ef6275
GitHubから全文読戻し、末尾改行だけを正規化した一致を確認しました。未取得部分があれば未読承認せずご指摘ください。
比較:
https://github.com/sakuratamaro/four-color-map-game/compare/954e1c5c52d5453fc9fee9872b2d7e922f850a39...70e691b6f8f1d808476e80990d20df7862bfb782
固定仕様:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/70e691b6f8f1d808476e80990d20df7862bfb782/docs/SKILL_PUBLIC_EVENT_20260913.md
初期失敗を含む実テスト記録:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/b786a1ed29f2c44fed71bcc638973e708cecdc35/docs/SKILL_PUBLIC_EVENT_LOCAL_20260913.md
旧新互換の全結果:
https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/b786a1ed29f2c44fed71bcc638973e708cecdc35/docs/SKILL_PUBLIC_EVENT_COMPAT_20260913.json
要望台帳・実041・既存継続経路を含む別証拠差分:
https://github.com/sakuratamaro/four-color-map-game/compare/d82bdb6647a12b0d30b6859d04b464a15ac94c22...b786a1ed29f2c44fed71bcc638973e708cecdc35
証拠文書の導入承認をゲーム承認に変換しません。

実装:
authoritativeなUSE_SKILLが解決した後だけ、publicState.lastPublicSkillへeventId/version/actor/skillIdの4項目を付与します。IDは実dispatchのcanonical定義から取得し、payload・相手手札・持ち色・秘密の対象/結果をコピーしません。旧lastPublicTraceの厳密形・正規state/RNG/private・ルール・CPU政策・回数・報酬は不変。成功応答のaccepted-no-opも使用/試行技名は示せますが、相手への空振り/成功推測はせず、空振りは一致した本人ACKだけです。拒否には新eventがありません。
既存commitがpublicJSONを原子保存しsnapshot-v2/replayがその同一eventを返すため、SQL/index/管理設定は無変更。新UIはtraceに完全一致した4項目と実装済みgenerated registryのみを認め、不正・古い・未知IDは従前の汎用名。約1800ms、入力/焦点非遮断、再送/reload重複防止、優先中断は維持。

実検証:
固定クリーン70e、全非Playwright147files/998件PASS、fail/skip/cancel0、100631.209ms。実Chrome9/9とEdge9/9PASS、390/1280両側、同一UIassets、四枚目視。実TS handler＋generated engine＋既存全SQLをPGlite0.5.8で実行した保存/本人両席/CPU fixture/空振り/拒否/原子rollback/応答喪失replay7/7を含みます。native Supabase/auth/race/実stockCPU/本番対局・物理は未検証です。
旧954e実engineとの差分16ケース・旧新viewer64組合せ、交代worker継続までstate/RNG/private/効果は完全一致、public注釈だけ差分。3builder二回とも出力同一、Local/registryは旧版不変。
初期SQLfixture不足、cache/runbook旧marker、不追跡の試験画像によるclean拒否は原FAILとして記録し、fixture/正確なmarker/証拠置き場だけ修正。最後の完全clean998/998へ置換せず併記。共有全検査はPlaywrightパス不足時159PASS/3FAIL/2SKIP、設定後166PASS/0FAIL/2SKIP（168件）；旧034opt-in2件はSKIPのまま。

新Windows run34735790923 attempt1:
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34735790923
03:33:40Z開始、03:34:17ZではIN_PROGRESS。まだ成功とは申告しません。既存workflowにこの専用branchと必要な新検査だけ追加し、Windows2025/Chrome+Edge/権限/timeout/assertionは維持。同じSHAの実成功が公開の条件です。CPU039の失敗jobは再実行せず、その代替にも使いません。

公開案:
同SHA Windowsと真正レビュー→fresh main再照合→互換Edge bundleと未変更indexを同じ配備物で配備・両全文厳密読戻し→forceなし同SHA main/Pages→既存preflightとindex/app44/cutinJS2配信byte。DB/管理値/JWT変更なし。正規保存形式が不変なので旧新worker/viewer併存は汎用名fallbackで継続可能、全worker同時切替を断定しません。rollbackは記録した互換artifactのみ、対局/receipt書換なし。
今回は追加live0件で依頼します。041が指摘した非2xx転送と意味コード保持等のharness局所修正は未着手で、旧040の再試行権限ではありません。追加liveを必要と判断する場合は、この新候補への別の明示範囲として示してください。配信確認だけで実本番の技観測受入を完了にしません。

DECISION / SUBJECT_SHA / BASE_SHA / SPEC_BLOB / SCOPE / 変更セット / BLOCKERS / NOTESを、この固定候補に結び付けてお願いします。クロガネ100回の9590/039、067/F3、過去FAILは別のままです。新レビューは初回予約2026-09-13T03:43:31Zから20/40/100分・最大3回・期限2026-09-13T05:43:31.000Z、同じ既存heartbeatで管理し、再起動/候補修正によるリセットも無回答承認もしません。
