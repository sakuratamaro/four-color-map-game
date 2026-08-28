# four-color-map-game
Turn-based four-color map strategy game with hidden palettes, tactical skills, math quizzes, and collectible skill cards.

# Four Color Map Game

四色定理をモチーフにした、ターン制の対戦型地図彩色ゲームです。

## Playable builds

- `index.html`: 検証済みv4.9ローカル2人対戦の原本（単体HTML）
- `online-v5/index.html`: Supabaseを使うv5.0オンライン速攻チュートリアル

オンライン版は、別々のブラウザまたは端末から同じページを開き、一方が表示した6文字の合言葉をもう一方が入力して遊びます。匿名ログインなのでメールアドレス登録は不要です。ブラウザへ含める設定はProject URLとPublishable keyだけで、ゲーム状態の確定はSupabase Edge Functionが行います。

現在のオンライン公開候補は速攻モードMVPです。v4.9本編を作り直したものではなく、v4.9のルールと幾何エンジンを基点に、オンライン同期の主要経路を先に検証するための版です。セットアップと検証状況は `docs/SUPABASE_SETUP.md` と `docs/TEST_CHECKLIST.md` を参照してください。

プレイヤーは自分が塗るエリアを選ぶのではなく、**次に相手が塗るエリアを指定**します。

相手は自分だけが知っている持ち色から合法な1色を選んでエリアを塗り、その後、今度は相手に塗らせるエリアを指定します。

相手の持ち色を推測しながら、塗ることのできないエリアを押し付けることが基本的な勝利条件です。

---

## Game Concept

四色定理では、平面上の任意の地図は4色以下で隣接領域を異なる色に塗り分けられます。

本ゲームでは、この考え方に次の制約を加えます。

* 地図はゲーム中に逐次作成される
* 一度塗ったエリアは原則として塗り直せない
* プレイヤーごとに使用可能な色が異なる
* 持ち色の一部は相手から見えない
* スキルカードによって盤面や彩色条件を変更できる

そのため、四色定理そのものとは異なり、ゲーム途中で「現在の持ち色では合法に塗れない」状態が発生します。

この詰み状態を相手に押し付けることが、本ゲームの中心的な戦術です。

---

## Basic Rules

### Board

ゲームは正方形のグリッド上で行います。

各エリアは、1個以上の未使用セルから構成されます。

新しいエリアは次の条件を満たす必要があります。

* 指定可能な未使用セルのみで構成される
* 最大指定可能セル数以下である
* エリア内部が辺接続で連結している
* 初手以外は既存エリアの少なくとも1つと辺で接触している

通常状態では、点で接しているだけのエリアは隣接とはみなしません。

---

## Turn Flow

先攻プレイヤーは、最初の未彩色エリアを指定します。

以降の通常手番では、

1. 相手から指定されたエリアを彩色する
2. 必要に応じてスキルカードを使用する
3. 次に相手が彩色するエリアを指定する

という流れを繰り返します。

```text
Player A creates Region 1
        ↓
Player B colors Region 1
        ↓
Player B creates Region 2
        ↓
Player A colors Region 2
        ↓
Player A creates Region 3
        ↓
...
```

---

## Hidden Color Palettes

ゲーム全体では複数の色を使用します。

初期案では、

* 全体：約5色
* 各プレイヤー：3色

を想定しています。

各プレイヤーの持ち色は原則として相手には非公開です。

ただし、実際に盤面で使用した色は相手から確認できるため、ゲームが進むにつれて持ち色の一部が判明します。

この仕組みにより、

* 地形戦
* 彩色戦
* 相手の色を読む情報戦

を同時に行います。

---

## Coloring Rule

対象エリアに隣接する既塗エリアの色を、そのプレイヤーの持ち色から除外します。

```text
PlayableColors
    = PlayerPalette
    - AdjacentColors
```

使用可能な色が1色以上存在する場合、その中から任意の1色でエリア全体を塗ります。

---

## Losing Condition

使用可能色が0色になっても、即座には敗北しません。

彩色前に使用可能なスキルカードによって、

* 持ち色を変更する
* 既存エリアの色を変更する
* 指定されたエリアを分割する

などの操作を行い、詰み状態から脱出できます。

スキル使用後も合法色を1色も作れなかった場合、そのプレイヤーの敗北です。

---

## Map Completion Victory

合法に彩色した後、次に相手へ指定できる新規エリアが1つも存在しない場合は、そのプレイヤーの勝利とします。

通常の詰み勝利とは別の、

**Map Completion Victory / 完塗り勝利**

です。

---

# Skill Cards

スキルは消耗型カードとして実装します。

試合前に所持カードから一定枚数を選び、その試合へ持ち込みます。

初期案では1試合あたり2～4枚程度を想定しています。

使用したカードは消費されます。

---

## Planned Skill Types

### Area Expansion

次に指定する新規エリアの最大セル数を増加します。

---

### Palette Change

自分の現在の持ち色の一部を別の色へ変更します。

* 過去に塗ったエリアの色は変化しない
* 変更後の色は相手には非公開
* 詰み回避にも使用可能

---

### Region Recolor

既に塗られているエリア1つの色を変更します。

攻撃、防御、盤面整理のいずれにも利用できます。

---

### Region Split

相手から渡された未彩色エリアを2つの連結エリアへ分割します。

一方を自分で彩色し、もう一方をそのまま相手へ返します。

返したエリアが、その手番における通常の新規エリア指定の代わりになります。

---

### Half-Cell Grid Shift

指定した行または列を0.5セル分ずらし、エリアの隣接関係を変更します。

その試合で最初にこの種類のスキルを使用したプレイヤーが、

* Row shift
* Column shift

のどちらかを選択します。

選ばれた軸は、その試合終了まで固定されます。

移動方向は各使用時に選択できます。

---

### Playable Area Expansion / Reduction

新しいエリアを作成可能な領域を拡大または縮小します。

縮小時にも既存エリアは削除されません。

変更されるのは、未使用セルを今後新しいエリアとして指定できるかどうかだけです。

---

### Corner Expansion

指定セルの四隅を視覚的に膨張させ、通常は点接触だった斜め方向との接触を発生させます。

通常の4近傍から、一時的または局所的に8近傍相当の隣接関係を作ります。

---

## Same-Color Region Merge

盤面変更によって同色の別エリア同士が辺接触した場合は、自動的に1つのエリアへ統合する仕様を基本案としています。

---

# Math Quiz & Gacha

スキルカードは、広告視聴や課金ではなく、数学クイズを解くことで獲得します。

初期実装では、自動生成可能な算数・数学問題を使用します。

---

## Quiz Challenge

初期案では1チャレンジ10問です。

```text
Question count: 10
Failure: third incorrect answer
```

3問目を間違えた時点でチャレンジ失敗となり、ガチャ報酬はありません。

---

## Gacha Reward

複数条件を満たした場合でも報酬は累積せず、達成した最高報酬のみを付与します。

| Result                        |   Reward |
| ----------------------------- | -------: |
| Challenge failed              |        0 |
| Challenge cleared             |   1 draw |
| 5 consecutive correct answers |  5 draws |
| 10 / 10 correct               | 10 draws |

---

## Quiz Difficulty and Rarity

クイズの難易度とガチャ回数は別々に決定します。

**Quiz difficulty determines gacha quality.**

**Quiz performance determines number of draws.**

例えば、

```text
Easy quiz + perfect score
→ 10 draws from an easy rarity table

Hard quiz + normal clear
→ 1 draw from a high-rarity table
```

という関係です。

低難易度の排出テーブルからも最高レアリティは排出可能ですが、確率は低く設定します。

---

## Card Rarity

予定レアリティ：

```text
★1
★2
★3
★4
★5
```

レアリティは単純なカード性能の上下関係にはしません。

高レアリティほど、

* 特殊な効果
* 珍しい盤面操作
* 高い戦術性

を持つ方向で設計します。

低レアリティカードにも実戦上の用途を残します。

---

# Technology

Current planned stack:

* Expo
* React Native
* TypeScript
* Expo Router
* React Native Skia
* Jest / jest-expo
* expo-sqlite

Online multiplayer is planned as a later phase.

Current backend candidate:

* Supabase

  * PostgreSQL
  * Auth
  * Realtime
  * Row Level Security
  * Edge Functions

---

# Architecture

The game rules must remain independent from the UI framework.

```text
UI / Expo
    │
    ├── Standard React Native UI
    │
    └── Skia Board Rendering
             │
             ▼
       Game Engine
       Pure TypeScript
```

Core game logic must not depend on React components.

Examples:

```text
isConnectedCellSet()
isValidNewRegion()
getAdjacentRegions()
getPlayableColors()
mergeSameColorRegions()
splitRegion()
applyGridShift()
canCreateAnyRegion()
```

These rules should be testable independently with unit tests.

---

# Repository Structure

```text
four-color-map-game/
│
├─ app/
│  ├─ battle/
│  ├─ quiz/
│  ├─ gacha/
│  ├─ cards/
│  └─ settings/
│
├─ src/
│  ├─ game/
│  │  ├─ domain/
│  │  ├─ rules/
│  │  ├─ skills/
│  │  └─ engine/
│  │
│  ├─ board/
│  ├─ quiz/
│  ├─ gacha/
│  ├─ cards/
│  ├─ storage/
│  └─ config/
│
├─ tests/
│  ├─ game/
│  ├─ skills/
│  ├─ quiz/
│  └─ gacha/
│
├─ docs/
│  ├─ GAME_DESIGN.md
│  ├─ ARCHITECTURE.md
│  ├─ RULES.md
│  └─ decisions/
│
├─ assets/
│
└─ supabase/
```

The `supabase/` directory may remain unused until online multiplayer development begins.

---

# Development Roadmap

## Phase 1 — Core Game Engine

* Grid model
* Region creation
* Connectivity validation
* Adjacency calculation
* Coloring
* Hidden palettes
* Turn management
* Losing condition
* Map completion victory
* Unit tests

No skills are required for the first playable core.

---

## Phase 2 — Local Two-Player Prototype

* Board rendering
* Cell selection
* Region selection
* Color selection
* Turn UI
* Debug information

---

## Phase 3 — Core Skill Cards

Initial candidates:

* Area Expansion
* Palette Change
* Region Recolor
* Region Split

---

## Phase 4 — Geometry Skills

* Half-cell Grid Shift
* Playable Area Expansion / Reduction
* Corner Expansion

---

## Phase 5 — Math Quiz and Gacha

* Procedural math-question generation
* Difficulty levels
* Quiz challenge
* Gacha reward calculation
* Card inventory
* Local persistence

---

## Phase 6 — Online Multiplayer

* User authentication
* Match creation
* Match joining
* Turn synchronization
* Secret palette management
* Secret card management
* Server-side move validation

---

# Development Principles

1. Correct game rules take priority over visual polish.
2. Game rules and UI must remain separated.
3. Balance values must be configurable.
4. Random behavior must support deterministic test seeds.
5. Do not implement unnecessary infrastructure before the core game is playable.
6. Do not silently change game rules for implementation convenience.
7. Add new skill cards without coupling each skill directly to UI code.
8. Keep public information and secret player information conceptually separate even before online multiplayer is implemented.

---

# Status

**Planning / early prototype stage**

The current goal is to validate whether the core loop—

> create a region for the opponent, infer their hidden palette, force difficult coloring decisions, and escape or reverse threats using consumable skill cards

—is enjoyable before investing in advanced online functionality, monetization, or production-level presentation.

---

# License

License has not yet been selected.
