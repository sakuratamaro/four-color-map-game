# 全21スキル図鑑：固定候補レビュー依頼

CANON_RECEIPT version=shared-canon-v1.1 base=9515f9bed9536dc2c44b71817129abb9c86ef24f request=UDL-20260912-066 specs=docs/SHARED_CANON.md,docs/SKILL_CATALOG_20260912.md tests=tests/standard-skill-catalog.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/skill-catalog-20260912

## 固定対象
SUBJECT_SHA: 2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152
BASE_SHA: 9515f9bed9536dc2c44b71817129abb9c86ef24f
Canon: shared-canon-v1.1
Feature: UDL-066-catalog-v1
Specification blob: 9aa1c780aac6b394bf1ee622cc2ba10297b6bab1
Review kind: game_production_release_approval
Scope: Pages_only; DB []; Edge [].
Dedicated branch: codex/skill-catalog-20260912, clean/pushed exact2fcfea9.
[全18ファイル差分](https://github.com/sakuratamaro/four-color-map-game/compare/9515f9bed9536dc2c44b71817129abb9c86ef24f...2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152)
[固定仕様](https://github.com/sakuratamaro/four-color-map-game/blob/2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152/docs/SKILL_CATALOG_20260912.md)

出典は実ユーザーbbb21b41-147b-4869-810f-ada7f33bb3f7／設計544402ae-d429-4a0e-a928-1877b7940247、検証済み頭脳v13。コンパクトな全実装スキル一覧・未所持でも予習・小さな枚数表示。2列はAI側の設計値と区別します。親9515は下記のとおり公開後確認まで完了。仕様にある旧public_base/未公開記述は候補準備時のreceiptで、現在の公開証拠とは区別します。

## 今回の実装
正式registryのstandardEngineImplementedかつstandardUiEnabled/alphaUiEnabledから21件（通常19+実験2）を導出。generatedmetadataは既存sourcefieldから生成し、手書きID配列やルール変更を追加しません。分類はusageCategory、使用段階はtiming、legalRecolorのexperimental/COLORusage/WORKtimingを混同しません。通常ガチャ対象外の2件は対応する実験ルール専用と明記。
未プロフィール・未所持でも21件の詳細が読めるnativebutton。色/エリア/妨害/実験の4区分、名前・星・小枚数、390px2列/768px3列/1280px4列。表示更新でbuttonを再作成せずfocus/openerを維持。詳細は既存dialogへつなぎ、use/equip/sell/grant/consumeを実行しません。6枚手札、カード売却・最後の1枚保護・再送identity、パレット、065、クイズ/経済は非変更。
app40・generatedregistry2・skill-catalog CSS1。エンジン/Edgebundle変更0、画像0。18textfiles303 additions71deletions。

## テスト証拠と失敗の保全
初候補a744でclean139files928/928 PASS39.8203615s、static110/110、Chrome2/2・Edge11/11（新図鑑、6枚手札、065全5、gacha/sale/cosmetics）PASS。3画像目視済み、3builders差分0。
その後a744のWindows34702569676は両browser137/139で失敗。Chrome/Edge契約各590/590、Edge lifecycle79/79は成功。失敗2件は旧「実験カードを図鑑に表示しない」期待です。新要望に反するため、今回2fcの追加1file10adds3deletesで、図鑑実験区分に掲載、所持0、通常19種は維持、売却選択肢には入らないことを明示検査する形へ修正。貸与カードの実使用/制限/失敗/keyboard本文は変更しません。テストをskipや削除せず、初回FAILはそのSHAに保持。
修正後Chrome4/4 PASS20.894217s・Edge4/4 PASS37.1156618s（新図鑑2+旧失敗2）、skip0。追加registry/catalog/UI/preflight/browser-harness75/75 PASS571.6801ms。新SHAで928全件を再実行済みとは主張しません（変更はbrowserテストのみ）。
本候補固有[Windows34703885487](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34703885487)は16:01:50Z時点IN_PROGRESS。旧失敗runの再実行ではありません。最終両job SUCCESSを公開前必須条件にします。

## 公開後の限定確認計画（NOT_RUN／まだ試験コード実装済みではない）
同一SHAのWindows最終成功とfreshmain祖先確認→forceなしmain→同一SHA Pages→freshpreflight→HTML/app40/registry2/catalogCSS1厳密byte一致を先に確認。続いて専用プロフィール1件・対局0件・180秒の1回を計画。正式21件と4区分、未所持2件・正しい使用条件、全詳細のEnter/Space/Escとfocus復帰、390/768/1280の可読性/overflow/44px、reload保持を実Chromeで確認。
既存readOnlyRequest/cleanup/保存profileState・revision厳密比較を再利用し、対局/quiz/gacha/購入/売却/削除0。エラー時も保存状態・許可通信・consoleの独立結果を保存します。試験ハーネスは承認後も実行前に局所検証し、コード完成を今の実績に含めません。プロフィールなし閲覧とsnapshot更新でfocusを維持するケースは既にローカル/Windowsで検査、本番state注入で再現しません。物理端末NOT_RUN。

## 027/028の結果報告（別対象、承認流用しない）
指示順どおりまず公開3b1で028補完を一度だけ実行。修正ハーネス57b55ef、14/14局所PASS。復元失敗でもfinally監査保存、通常CPU12/自分8でcleanup枠と時間を確保、旧画像/JSON上書きなし。
補完結果32checksPASS・ok:true、1profile/1CPU、CPU6/自分6、対局終局。本人1/CPU2cutin、復元完了canvas後の過去イベント再演なし、console/errors/warnings/不許可0。実390cutinと1280復元画像も目視。累計065profiles2/matches2、第三試行なし。028の成功時受入条件に従い065 scoped PUBLIC_VERIFIED。旧失敗JSON SHA256 E968514192E44454C1C612288426050BC0D64D324BDCDD94D3C4683605C31237は不変。新PASS JSONはSKILL_CUTIN_RETRY_LIVE_20260913.json、SHA25656D95B1B6389FB48AF42CB7EA4C606FC6C66E2D4A778B80FFD2C1CCB608CDAFA。
その後027のexact9515をforceなしmainへ。[Pages34703792879](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34703792879) SUCCESS、freshpreflight、3assetbytes一致。1profile/0matchesの入口確認は30checks+独立3判定すべてPASS、ok:true、390/768/1280の3同列56pxボタン・CPU10件・経路/Esc/focus/reload、保存profileState/revision一致、通信6許可reads、console0。CPUdialog後に実10件描画を待つ修正を適用済み。UI_FLAT_ENTRANCE_LIVE_20260913.json SHA25684551A8329B44BC1D49DC22678A8FAA3FB21A5821422B88B05BE88DA58408007。
トップレベルdisplayName既知不整合は別REGの情報項目に保持。旧062の024限定受入や失敗原本は不変。065/9515とも物理NOT_RUN。完了報告への別待機は作りません。

066だけのDECISION / SUBJECT_SHA / BLOCKERS / NOTESと、上記1profile/0match限定計画への判断をお願いします。新独立066レビューの有限予算だけを設定し、旧065・9515予算を再開しません。残り067投了は出典/仕様準備中、CPU033/051も未完で全体ゴールは継続します。
