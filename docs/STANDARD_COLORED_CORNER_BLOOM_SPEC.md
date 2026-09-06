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

- 角膨張開始後に「これから渡すエリア」と「色のついたエリア」の用途を明示的に選ぶ。
- 従来用途は現在の盤面選択、白枠、紫の基準macro、取消、pointer/keyboard動作を維持する。
- 新用途は盤面上の彩色済みregionを選び、次にその現在形状に含まれる基準macroを選ぶ。raw region ID、macro番号、数値input、select要素はプレイヤーへ見せない。
- pointerに加え、Tabでregion候補と基準macro候補へ移動し、Enter/Spaceで選択、Escapeで現在の対象を解除できる。
- 合法候補の完全oracleや相手hand/palette/controller情報は表示しない。不成立時はcard非消費と伝える。
- 390×844で盤面、対象案内、確定、接続表示、下部navが重ならず、横overflowを発生させない。

## 受入ゲート

- alpha.1/2/3 room、旧角膨張、replay、reloadが回帰しない。
- Shift分断後の各成分と同色merge後の保持regionへ、現在形状単位で作用する。
- 変形後はregion overlap、範囲外cell、非連結regionがなく、占有集合が変形前占有と新規空きcellの和に一致する。
- reject/cancel/persistence failureはwrite-free、成功/retry/replayはexactly-once。
- CPUは公開stateだけから有限候補を列挙し、Hard補充でも同一windowのarea制限を迂回しない。
- public projectionへ相手private情報を追加しない。
- Local/Edge bundleを決定的に再生成し、生成元包含とbyte一致を確認する。Localは旧outgoing導線でalpha.4 engineを安全に使えることを確認し、新用途UIの合格を過大記録しない。
- Chrome/Edgeのpointer、keyboard、390px、公開preflightを通す。Edge配備前にalpha.3 active room互換とrollback手順を確認する。
