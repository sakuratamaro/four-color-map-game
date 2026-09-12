# UDL067 投了確認とCPU台詞：固定候補レビュー依頼

送付記録: 固定証拠4d13012と候補16file全差分を含む61079文字を既存ChatGPT「改修ロールバック防止策」へ一度送信。実依頼ID f5646b27-8424-405f-95a7-a21c87b09274、二度目の有限送達確認で先頭20000文字が厳密一致。取得上限のため全文読戻し一致とはしない。最新取得はactive/user-onlyで承認未観測。独立067の待機は保守的な送信前予約17:15:08Zから120分、+20/+40/+100分・最大3回。旧066の閉じた枠をリセットせず、同梱した066は取得済み証拠の判定だけを依頼。本文は送信時点の固定レビュー内容であり、以下を後から実行済みと読み替えない。

SUBJECT_SHA: 8fe4c206547851550de7b4b59c0eb82241ba3060
BASE_SHA: 2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152
Canon: shared-canon-v1.1
Feature: UDL-067-surrender-v1
Specification blob: e5f2c0617d3defcc8dc6105bf567f6ed59fb4432
Review kind: game_production_release_approval
Scope: Pages_only; DB []; Edge [].
Dedicated branch: codex/surrender-confirmation-20260913, clean/pushed exact8fe.
[固定16ファイル全差分](https://github.com/sakuratamaro/four-color-map-game/compare/2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152...8fe4c206547851550de7b4b59c0eb82241ba3060)
[固定仕様](https://github.com/sakuratamaro/four-color-map-game/blob/8fe4c206547851550de7b4b59c0eb82241ba3060/docs/SURRENDER_CONFIRMATION_20260913.md)

v13受領・照合済みの同一UDL067。出典userbbb2137d-8aaa-4432-ab40-0938b5a4cde2、後続CPU台詞bbb213cb-7d07-47a9-be57-a928abfe955e。長い投了ラベルと「色操作カードを見る」を短い投了＋明示確認へ。台詞はユーザー例を確定配役とせず、現行CPU10IDへ既存人格に合わせてAI側で固定設計。CPU画像・レベル変更、全スキル確認、救済断定・自動敗北は混ぜません。

## 実装
短い投了は現在の操作領域に1つだけ表示。native dialogは「対戦を続ける」を初期focus、Enter/Escape/取消はwrite0、肯定だけ既存SURRENDER。CPUは不変の公開IDから固定台詞と実対局名、対人/未知は汎用短文。room/match/seat/room-view-state版本、ACTIVE/playing/自分手番、接続/表示中/対戦tab/非busy/既存pendingなしを開く時と肯定直前に照合。版変更・終局・別tab・切断等で古い確認をwriteせず破棄。同snapshotでは維持。先にconsentを消費してから既存senderへ、CAS/pendingID/同一再送は非変更。optionalJS失敗は無確認投了へ落とさずfailclosed、ゲーム/図鑑は継続。既存dialoglayoutと今回のみcyan focus-visibleを使用。
app20260913-41、新surrender JS/CSS20260913-1。3buildersでregistry/local/Edgebundle差分0、画像0、16textfiles382adds50deletes。2fcはmain/Pages公開済み、066検証側の画像保存不備は別記録であり本候補のゲーム承認に流用しません。

## 実行証拠
clean8fe141非Playwrightfiles937/937PASS63.7165739s、skip0。旧139selectionに対しcleanuphelperunitも含めた件数差でありbrowserを自動試験済みと数えません。
Chrome6/6PASS32.0558912s、Edge14/14PASS130.96111s（067六、065五、066二、六枚手札一）。
確認中のversion/match/seat/terminal/tab/offline、cancel/safeEnter/Tab/Esc/doubleclick、送信前障害と確定後ACK喪失＋一時stalesnapshotの別fixtureで厳密同一action envelope再送、missingoptionalJS/始動継続を検査。
目視後に加えたfocusCSSはChrome1/1PASS7.2558704s、最後のEdge1/1PASS6.9744352s。最終Chrome390/1280、先行Edge390/768/1280を実際に目視。画像自体は未共有なのでAstra実画像確認済みとはしません。
初回browserfixture2FAIL、旧static4FAIL、a44full936/937(timeout宣言の空白書式1件)は別履歴で保持。既存parserを緩めず2行整形し8fe937PASS。
finalEdge一度だけ本文成功/cleanupFAIL40.1741244s。残存ownedheadlessEdge0をread-onlyで確認、重い全試験終了後の単独再試験は正常cleanupまでPASS。製品バグと混同せず、CPU-heavy全試験とnativebrowserlaunchを今後重ねません。
[同一SHA Windows34707002949](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34707002949) は初回取得IN_PROGRESS。両job最終SUCCESSを公開前の条件にします。

## 公開後の限定確認計画（未実装/NOT_RUN、承認後に局所検証してから実行）
同一Windows両SUCCESS→freshmain祖先→forceなし同一SHA main/Pages→freshpreflight→HTML/app41/surrenderJS1/CSS1の厳密byte一致を全てプロフィール作成前に確認。
専用profile1/CPU対局1/max240秒のcanary1回を希望。相手は現行レイID、通常6枚準備だけで開始。自分手番へ進めるCPU操作最大6、本人のSURRENDER最大2送信（通常投了/同じidentityの結果再確認/必要時同じ試験対局のcleanupを全て含む）。他スキル・クイズ・抽選・購入・売却・削除・本番state注入なし。新経済規則は無し、普通の試験対局の既存敗北精算のみ。
390/1280で実CPU名/固定台詞、safe初期focus、Enter取消/Esc/取消でroomversionと本人カードが変わらないこと、肯定後一回の既存投了・終局・再読込を実測。最初から対戦を増やさず、対人/10人全員/障害注入はローカル試験と区別。
途中失敗もfinallyで操作件数・許可通信・console・ownedroom終局/プロフィールの独立結果を保存してから総合判定。終了枠/時間を残し、追加プロフィールや無条件再試行はしません。物理端末NOT_RUN。
計画でありハーネス実装済みとは主張しません。境界が不適切なら限定修正をご指定ください。

DECISION / SUBJECT_SHA / BLOCKERS / NOTES と限定計画の判断をお願いします。文書承認、別候補承認、無回答を承認へ変換しません。CPU033/051と他v13残件の全体目標は継続します。


## 別記：066の既存取得結果による受入判定（追加本番試行は依頼しません）

## 030 authorized zero-account visual supplement result
Actualreview030 response8adbfdb6-2d36-4f20-8958-8fe4dd7d6450 to9ff538bc. Exact2fc, originalprofiletotal1 unchanged. Driver03a22f7; beforeuse11/11localtestsPASS4117.4208ms,including realemptyChromeHTTP/WSbarrier(0serverrequests),PNGsignature,deadlineabort,failureevidencesave.
SKILL_CATALOG_VISUAL_20260913.json SHA256DEA9D2D0C51B596E27522F7E7710828F045AC893A1B3E2D346B647A4B7E61F62 remainsokfalse. Exactlyoneemptycontext/90sprobe; accounts/profile/match/economy/deletion0; twoPOST/auth/v1/signupattemptsbothintercepted,serverforwarded0/backendresponses0/pageerrors0.
All19checksPASS: fourassetbytes,exact21profilefree,390/768/1280 2/3/4columnsand44pxtargets/nooverflow,3realPNGfiles,reload21/detailWORK/lab/keyboardfocus,nosavedprofileorauth.
All3PNGsactuallyviewed. Nativefixednavigation/connectionfailurebadgeappearoverpartsoftheelementcaptures; notremovedorfaked. Visiblecards/layoutarelegibleandspaced; imagesdonotproveeverycardis simultaneouslyunobscured, and thecaptureisnotan authenticatedreload.
FinalconsoleclassifierfailedonlybecauseChrome emitted the exact suffix ERR_BLOCKED_BY_CLIENT.Inspector twice. BothsourceURLs exactlymatchblocked/auth/v1/signup; remainingtwoAuthRetryableFetchError:Failedtofetchalreadyclassifiedexpected. No otherconsoleevents. Narrowfixacceptsonlythat exactadditionalstring AND anactuallyblockedresourcepath; unrelatedpaths/suffixes/errorsstillfail.4/4puretestsPASS814.6522ms; no browser/publicrerun.
OfflineevaluationofthesamerawJSON nowclassifies4expectedblocked/0unexpected/0pageerrors. This is derivedanalysis,notrewritingoriginalokfalseorclaiminga secondlivePASS. No newprofile, thirdprobe, productchangeorrepublish. RequestAstra'sdispositionfromexistingevidencealongsideindependent067review. Original066waitclosedby030after2automaticchecks; donotreset/reopenit.

原本JSONと分類補正だけから066の受入可否を判断してください。初回・補完それぞれのok:falseはそのままです。意味のない再試行や新アカウントは増やさず、067の製品レビューとも分けます。
