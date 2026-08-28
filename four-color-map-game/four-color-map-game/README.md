# Four Color Map Game

四色定理をモチーフにした、ターン制の対戦型地図彩色ゲームです。

**自分が塗る場所ではなく、次に相手が塗るエリアを指定する**ことがゲームの核です。相手は秘密の持ち色から合法色を選んで彩色し、次にこちらへエリアを返します。相手の持ち色を推測しながら詰みを作り、消耗型スキルカードで詰みを回避・反転します。

> Status: planning / early prototype

## Repository description

> Turn-based four-color map strategy game with hidden palettes, tactical skills, math quizzes, and collectible skill cards.

## Core loop

1. 先攻が最初のエリアを指定する。
2. 相手がそのエリアを自分の持ち色で彩色する。
3. 彩色した側が次のエリアを指定する。
4. 以後交互に繰り返す。
5. 防御スキル使用後も合法色が存在しなければ敗北。
6. 彩色後、合法な新規エリアを一つも作れなければ「完塗り勝利」。

2手目以降の新規エリアは、既存エリアへ**辺で接触**している必要があります。通常状態では点接触は隣接として扱いません。

## Hidden palettes

初期案では全5色程度から各プレイヤー3色をランダムに所持します。持ち色は相手に非公開で、実際に使用した色だけが盤面から判明します。持ち色変更スキルの変更後の色も非公開です。

## Skill cards

スキルは試合前に2～4枚程度を持ち込み、使用すると消費されます。現時点の主要候補は次のとおりです。

- 指定可能エリア拡張
- 持ち色変更
- 既塗エリア色変更
- エリア二分（片方を塗り、残りをそのまま相手へ返す）
- 0.5マス行／列シフト
- プレイ可能領域拡大／縮小
- 角膨張（斜め方向との接触を発生）

詳細は [`docs/SKILL_CARD_CATALOG.md`](docs/SKILL_CARD_CATALOG.md) を参照してください。

## Math quiz & gacha

広告視聴や課金をガチャの前提にせず、数学クイズでガチャ権を得る構想です。

初期設定案：

- 1チャレンジ 10問
- 3問目の誤答で失敗・ガチャなし
- クリア：1回
- 5問連続正解：5連
- 10問全問正解：10連
- 複数条件は累積せず、最高報酬のみ
- 問題難易度が高いほど高レアリティ比率の高い排出テーブルを使用
- 低難易度テーブルでも最高レアリティは低確率で排出

## Planned technology

- Expo
- React Native
- TypeScript
- Expo Router
- React Native Skia
- Jest / jest-expo
- expo-sqlite
- Later: Supabase for online multiplayer

ゲームルールはReact/UIから分離した純粋TypeScriptとして実装します。

## Requirements

このリポジトリの初期依存関係は **Expo SDK 57** を対象にしています。

- Node.js 22.13+
- npm 10+


> **2026-08-07時点の注意:** Expo公式はSDK 57移行期間中で、物理端末のExpo Goを使う場合はSDK 54を案内しています。この雛形は将来側の **SDK 57** を基準にしています。最初の実機確認をExpo Goだけで簡単に行いたい場合は、実装開始時にCodexへ「SDK 54へ整合させてから開始」と指示する選択肢があります。

Expo SDKの移行期は依存関係が更新されることがあるため、clone直後は次を実行してください。

```bash
npm install
npm run deps:fix
npm run doctor
npm run typecheck
npm test
npm start
```

> `app.json` の `com.example...` package / bundle identifier は仮値です。ストア公開前に正式IDへ変更してください。

## Project structure

```text
four-color-map-game/
├─ app/                       # Expo Router screens
├─ src/
│  ├─ board/                 # Board rendering / interaction
│  ├─ cards/                 # Skill card catalog
│  ├─ config/                # Balance values
│  ├─ game/                  # Pure game domain/rules/engine
│  ├─ gacha/                 # Gacha logic
│  ├─ quiz/                  # Procedural math quiz
│  └─ storage/               # Local persistence
├─ tests/                    # Pure logic tests
├─ docs/                     # Specifications / architecture / ADR
├─ supabase/                 # Reserved for later online phase
└─ AGENTS.md                 # Codex implementation constraints
```

## Documents

- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — game design specification
- [`docs/RULES.md`](docs/RULES.md) — machine-oriented rule summary
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — implementation architecture
- [`docs/SKILL_CARD_CATALOG.md`](docs/SKILL_CARD_CATALOG.md) — current skill-card candidates
- [`docs/ONLINE_MULTIPLAYER.md`](docs/ONLINE_MULTIPLAYER.md) — future online design boundary
- [`AGENTS.md`](AGENTS.md) — instructions for Codex

## Development order

1. Pure TypeScript game engine + tests
2. Local two-player prototype
3. Core skills
4. Geometry-changing skills
5. Quiz + gacha + local card inventory
6. Online multiplayer

Do not implement production-grade online infrastructure before the local rules engine is stable.

## License

Not selected yet. Treat this repository as **all rights reserved / no redistribution permission granted** until a license is explicitly added.
