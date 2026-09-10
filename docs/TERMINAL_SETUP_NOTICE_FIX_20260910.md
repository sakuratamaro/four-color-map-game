# 終局復帰時の開始告知抑止 — UDL-20260910-055

CANON_RECEIPT version=shared-canon-v1.1 base=2f855ccfef11d7c099cfb73fb57ec3da79be8789 request=UDL-20260910-055 specs=docs/TERMINAL_SETUP_NOTICE_FIX_20260910.md,docs/STANDARD_MODE_SPEC.md tests=tests/standard-online-random-info-ui.test.cjs,tests/standard-online-browser.test.cjs

共有正本の入口は同一リポジトリ `codex/dev-brain-current-20260910:docs/SHARED_CANON.md`。本便は最新main起点の `codex/terminal-setup-notice-20260910` へゲーム差分だけを分離する。担当・統合・公開は既存Codex司令塔。この文書は対象便の受入条件と証拠であり、別の要望台帳ではない。

## 出典・権限

- 元のユーザー報告: ChatGPT「改修ロールバック防止策」`6aa229e7-e098-83ee-ac5e-d366a12653a4` / user message `bbb21a1e-346f-438d-8f41-2ecdcb75bf37`。
- 同一ChatGPTによる受入整理: assistant message `927e69f3-5491-4ab3-9af8-4476a4dc1fb8`。コード修正・公開済みという判定ではない。
- 公開権限: このCodexタスクの2026-09-10ユーザー指示「早く本番に反映してほしいです」。文書導入候補 `f9a4ab9` のAPPROVE_DOCSをゲーム公開承認として流用しない。
- DB変更セット `[]`、Edge変更セット `[]`。勝敗・報酬・精算・乱数・カード・ルール・既存未コミット変更は変更しない。

## 受入条件

1. 終局画面を閉じずに画面を消し、同じページへ復帰しても開始時のランダム要素告知を表示しない。
2. 終了済み対局のreload・新しいタブ・タブ復元でも同じ。sessionStorageの表示済み記録がなくても抑止する。一瞬表示して隠す実装も不合格。
3. authoritativeなroom状態が未取得の間も開始告知を先行しない。roomのfinished、public stateのFINISHED/GAME_OVERを開始告知より優先し、既存の演出タイマーも解除する。
4. 永続的な終了結果・勝敗理由・戦績・券・同じroomを保持し、再抽選、二重精算、強制ロビー帰還を追加しない。
5. 新しい対局・明示再戦による新matchIdの開始告知は従来通り一度だけ表示する。

## 検証・公開状態

候補検証中。Chrome・Edgeのfocused各5/5 PASS（新規browser 2件、既存再戦・開始説明2件、runtime gate 1件）、skip 0。runtime gateは未hydration、別room、ready、room finished、public FINISHED、GAME_OVER、public nullの7条件を実sourceで実行する。

修正前のChromeでは終了済み初回復元の同期表示回数が1となり、0期待の回帰テストが失敗した。初稿テストではhydration待機不足とread-only cosmetic-catalogをwrite扱いする問題も検出して修正し、製品不具合とは区別した。

3 builder実行後、Local bundle・Edge bundle・skill registry生成物の差分0。要望照合は既存49件でPASS後、本便055を追記。全非browser回帰、Windows CI、候補SHA、Pages、公開アセット照合は後続で記録する。実機未確認をPHYSICAL_ACCEPTEDにしない。
