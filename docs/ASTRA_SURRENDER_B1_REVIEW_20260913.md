# UDL067 B1: resize test synchronization repair

送達記録: 一度だけ送信した4830文字は実依頼28d25760-2a7a-4fe0-9c48-bb7ca4888b9aへ到達。二度目の有限読戻しで末尾改行一つを除く4829文字が全文一致。最新取得はactive/user-onlyで新判定未観測。送達確認2回は消費、第三回/再送なし。原067の1/3消費と19:15:08Z期限を維持し、次17:55:08Z枠へ同じ既存heartbeatを設定する。

CANON_RECEIPT version=shared-canon-v1.1 base=2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152 request=UDL-20260912-067 specs=docs/SURRENDER_CONFIRMATION_20260913.md tests=tests/standard-online-browser.test.cjs

SUBJECT_SHA: 23133ef52efb81c39d0623479b0ea7819f850f7d
BASE_SHA: 2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152
Prior held candidate: 8fe4c206547851550de7b4b59c0eb82241ba3060
Specification: shared-canon-v1.1 / UDL-067-surrender-v1
Specification blob: e5f2c0617d3defcc8dc6105bf567f6ed59fb4432
Review kind: game_production_release_approval
Scope: Pages_only; DB []; Edge [].
Branch: codex/surrender-confirmation-20260913 (clean, pushed exact23133ef).

実031 (fa226fa2-ad5e-437c-a447-3a6c84fcd2c1→f5646b27-8424-405f-95a7-a21c87b09274) のB1だけを修正しました。新SHAなので旧HOLDを承認へ読み替えません。
[新候補の全差分](https://github.com/sakuratamaro/four-color-map-game/compare/2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152...23133ef52efb81c39d0623479b0ea7819f850f7d)
[今回の1file全差分](https://github.com/sakuratamaro/four-color-map-game/compare/8fe4c206547851550de7b4b59c0eb82241ba3060...23133ef52efb81c39d0623479b0ea7819f850f7d)

## 切り分けと修正
旧Windows34707002949: Chrome103588754411 contracts595/595/online143/144 (625727.766ms)、Edge103588754672 SUCCESS。失敗は時限超過でなくquizリサイズ直後の枠内assertion。失敗記録を消さず、旧jobの再実行はしていません。
未修正8feの同じ局所Chrome試験は1/1PASS13679.6623msでした。単発PASSだけで不安定と断定せず、保存座標を既存layoutQuizOptionPhysicsの計算式と照合しました。430px時の旧clientWidth358に対する6ボタンのxがすべて誤差0.0034px未満で一致し、現在390pxのclientWidth318とは最大33.33px相違します。現host外幅320/末尾右端384.83というログは、古い幅の座標を検証が取得したことと整合します。この計算は保存ログへの派生分析で、製品側の永続的な破綻やlive実測を新たに主張するものではありません。
appではResizeObserver/animationframe/syncが寸法を検出して再配置しますが、motionState=runningはサイズ変更前からtrueです。旧テストはその既存値だけを待っていました。
今回の変更はtests/standard-online-browser.test.cjs一件12adds/1deleteのみ。430→390の連続変更を残し、runningに加え全6buttonが現host枠内へ戻る条件を最長2000msだけ待ち、その後も元のassertPackedを完全保持します。0.5px許容差、重なり否定、52px操作領域、ヒットテスト、移動・pointer/touch/focus/reduced-motion/二重回答・listener世代検査は非変更。恒久的な枠外は有限待機でFAILし、skip/削除/許容差拡張/一律sleepはありません。
Git差分はこのテスト1fileだけで、全製品コード・CSS・仕様・registry/engine生成物・DB/Edge・画像のblobは8feと同一です。新機能や投了設計変更は混ぜません。

## 新候補の実施結果
修正済み局所Chrome1/1PASS13624.0885ms、Edge1/1PASS15014.8737ms、skip0、正常cleanupまで完了。並行native起動なし。
clean23133efの141非Playwright filesは937/937PASS62729.8167ms、skip0。
067機能のChrome6/6・Edge14/14・最終focus各1/1は変更前8feでの既報です。今回は1fileしか変わっていないことを区別し、全browser再実行済みとはしません。
新Windows[34708897042](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34708897042)は同23133efでIN_PROGRESS。最終Chrome/Edge両SUCCESS前のmain/Pages公開はしません。

## 依頼
新23133efに対しDECISION/SUBJECT_SHA/BLOCKERS/NOTESをお願いします。最終CI成功を条件とする承認の場合、条件を満たした後は既存手順で公開へ進みます。
031が妥当とした公開後計画は非変更: HOLD解除と同一main/Pages/freshpreflight/4asset厳密byte一致後に、1profile/レイCPU1/240秒一回、CPU最大6・同一identityを守るSURRENDER送信最大2（cleanup含む）。ハーネスは未実装・NOT_RUNであり、実装・局所検証前に本番実行しません。開閉取消は不変、肯定後は通常の一度だけの敗北精算を確認し、正常な戦績更新を失敗扱いしません。物理NOT_RUN。

別件066は実032に従い範囲限定PUBLIC_VERIFIEDで閉じました。両raw ok:false、追加profile0、累計profile1、未実測範囲を維持し再試行なし。新しい066待機はありません。
067原予算17:15:08Z開始/19:15:08Z期限、今回の17:35:08枠で1/3消費。次は17:55:08/18:55:08で、候補改訂によるリセットなし。旧16fileを再び貼付せず、今回の1file完全差分を送付します。CPU033/051等の残件も既存goalで継続します。
