# 既塗エリア角膨張 alpha.4 仕様

更新日: 2026-09-07

## 目的

既存カード「角膨張」に、これから渡す未彩色エリアをふくらませる従来用途と、現在盤面の彩色済みエリアをふくらませる新用途を持たせる。カード種類、レアリティ、19枚catalog、6枚loadout、ガチャ確率、在庫schemaは変えず、Shift後の現在地形を使った駆け引きを増やす。

## engine互換

- 新規対局は`5.0.0-alpha.4`。alpha.1、alpha.2、alpha.3の既存roomと旧payloadを継続できる。
- 同一control windowの同カテゴリ1回制限はalpha.3とalpha.4の両方で有効にする。alpha.4化によってalpha.3の`skillCategoryWindow`を落としてはならない。
- 旧`{ skill, sourceMacros, macro }`は全対応versionで従来と同じ結果を返す。
- 新`{ skill, regionId, macro }`はalpha.4だけで受理する。request bodyからengine versionを選ばせない。
- 新しい永続fieldは追加しない。DB、migration、RPC、profile、reservation schemaは変更しない。

## 新用途のルール

1. WORKまたはCREATE_FIRSTで、手番seatが現在の彩色済みregionを選ぶ。
2. 対象は非pending、非reserved、非deleted、非delayedでなければならない。`controllers`や過去の作成者は可否に使わない。
3. regionの現在microcell集合から得たmacroの一つを基準に選ぶ。古い`sourceMacros`だけを正本にしない。
4. 基準macroの四隅について、対象regionへ辺接続でき、playable bounds内にあるmicrocellをすべて追加する。
5. 空きcellはそのまま対象へ加える。彩色済みdonorのcellは対象へ移し、donorが分断した場合は現在形状の連結成分へ分割する。空になったdonorは削除する。
6. 変形後に同色regionが辺接続した場合は、操作者や`controllers`に依存せず一つへmergeする。
7. 未彩色、pending、reserved regionのcellへは侵入しない。候補が一つもなければrejectする。
8. 成功時だけcard、inventory/reservation、version、root revision、`area`カテゴリ枠を各1回進める。手番、phase、required sizeは変えない。
9. invalid schema、存在しないregion、対象外macro、候補0、persistence failure、cancelはRNG、state、card、inventory、receipt、カテゴリ枠を変えない。同一action IDの再送は二重変形・二重消費しない。

## UI

この便の新用途UIはStandard Onlineを対象とする。Localはalpha.4 engineと旧outgoing導線の互換を保つが、新用途の操作導線はこの公開便へ含めず、別の受入対象とする。

- 角膨張カードをタップしたら、用途切替、候補一覧、別の確定ボタンを挟まず、盤面の対象microcellを1回タップして即発動する。
- alpha.4では、押した公開microcellが対象可能な彩色済みregionに属すれば新payloadを送る。同じmacroに複数regionがあっても、押したcellそのものから`regionId`を一意に決める。
- 押したcellが空きで、所属macroが現在の`preparedOutgoing.sourceMacros`（actor一致）または必要数そろった盤面選択に含まれる場合は、旧outgoing payloadを送る。彩色済みcellを優先するため、同じmacro内でも意図を推測しない。
- pending、reserved、deleted、delayed等の対象外region、重複占有、選択外の空きcellはclientで通信0件とし、その場の案内へ理由とcard・手番非消費を表示する。角候補の有無は先読みせずserverへ委ねる。
- alpha.1/2/3 roomは彩色済みregionを対象にせず、選択済みoutgoingへの旧payloadだけを即発動で送る。
- keyboardでは全versionの角膨張中にmicrocell単位で矢印移動し、Enter/Spaceでpointerと同じ判定を即実行する。alpha.1/2/3では彩色済みcellを通信0で拒否し、空きoutgoing cellだけを送る。Escapeまたは取消でcard targetだけを解除し、既存のoutgoing盤面選択は保つ。
- raw region ID、macro番号、数値input、select要素はプレイヤーへ見せない。
- 合法候補の完全oracleや相手hand/palette/controller情報は表示しない。不成立時はcard非消費と伝える。
- 390×844で盤面、対象案内、取消、接続表示、下部navが重ならず、横overflowを発生させない。

## 受入ゲート

- alpha.1/2/3 room、旧角膨張、replay、reloadが回帰しない。
- Shift分断後の各成分と同色merge後の保持regionへ、現在形状単位で作用する。
- 変形後はregion overlap、範囲外cell、非連結regionがなく、占有集合が変形前占有と新規空きcellの和に一致する。
- reject/cancel/persistence failureはwrite-free、成功/retry/replayはexactly-once。
- CPUは公開stateだけから有限候補を列挙し、Hard補充でも同一windowのarea制限を迂回しない。
- public projectionへ相手private情報を追加しない。
- Local/Edge bundleを決定的に再生成し、生成元包含とbyte一致を確認する。Localは旧outgoing導線でalpha.4 engineを安全に使えることを確認し、新用途UIの合格を過大記録しない。
- Chrome/Edgeのpointer、microcell keyboard、通信0、double activation防止、retry同一性、390px、公開preflightを通す。Edge配備前にalpha.3 active room互換とrollback手順を確認する。
