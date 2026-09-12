# UDL067 local release candidate
CANON_RECEIPT version=shared-canon-v1.1 base=2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152 request=UDL-20260912-067 specs=docs/SURRENDER_CONFIRMATION_20260913.md tests=tests/standard-surrender-confirmation.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/surrender-confirmation-20260913

Exactcandidate8fe4c206547851550de7b4b59c0eb82241ba3060, specUDL-067-surrender-v1/blobe5f2c0617d3defcc8dc6105bf567f6ed59fb4432; Pages_only DB[]Edge[]. Parent2fc main/Pagesalready;066acceptancepartialnotproductregression.16textfiles382additions50deletions; finalformatrepair2linesadditionalnoeffect. Noimages.

Implementation: shortsinglevisible surrenderentry, nativeconfirmdialog safe初期「対戦を続ける」; explicit肯定onlyexistingSURRENDERsender, cancel/Esczero. Fixed10CPUvoices keyedbycurrentimmutablepublicCPU ID; genericunknown/human. No RNG, oracle, rescueclaim, privateopponentstate, newassets/rewardpreview. Capture/recheckroomId/matchId/seat/room&view&stateversions, ACTIVE/playing/ownturn,connected/visible/battle/nonbusy/no pending. Same-snapshotpreserve;changedcontextclosewithoutsend. Consumeconsentbeforeasyncdispatch; originalCAS/retry unchanged. OptionalJSfailurefailsclosedwithoutbootfailure. Scopedcyan focusvisible. app41/newJS+CSS1.

Executed:
- Pure+wiring5 andbrowserharness6 =11/11PASS189.8617ms,skip0.
- Focusedexistingstatic95/95PASS1031.7077ms beforeadditionalwiringtest; actualcleanfullbelowincludesnewwiring.
- Chrome6/6PASS32055.8912ms,skip0: CPUdialog3widths/cancel/Esc/doubleclick; changedversion/match/seat/terminal/tab/offline; before-commitnetworkfailure; committedlostACK+heldstalesnapshot; missingmodule; blockedCOLORvoluntarysurrender.
- Edge14/14PASS130961.11ms,skip0: same6 +catalog2 +065five +stable3x2hand1. Localbackendfixtures,notlive.
- Aftervisualinspection addedonlydialogfocusCSS. Chrome1/1PASS7255.8704ms, finalEdge1/1PASS6974.4352ms,skip0. FinalChrome390/1280actuallyviewed,earlierEdge390/768/1280actuallyviewed. Artifactsnotexported.
- Threecanonicalbuilders producezerochangeingeneratedregistry/local/Edgeenginebundles. GitdiffcheckPASS.
- Clean8fe selected141non-Playwrightfiles,937/937PASS63716.5739ms,skip0. SelectionexcludesfilesrequiringPlaywright,includesbrowsercleanuphelperunitso countdiffersfromold139filecatalogselection.

Retainedfailurehistory:
1. Initialbrowser3cases:1PASS2FAIL46.2822589s. FixtureCPUnameasyncwaitmissingandfixtureversionrollback werecorrectedwithoutchangingrealmonotonicguards. Separate3/3PASS19790.8728ms.
2. Static90had4obsoleteexpectations(cache/directsend/renderprefix); fixed, then89/90dueonecacheexpectationremaining, then95/95. No skipped/deletedtest.
3. a44clean141files936/937PASS100556.7624ms,onlystricttimeoutdeclarationformatparserrejectingcompacttestsyntax.2declarationlinesformatted; no timeoutweakened.8fefull937PASSseparate.
4. FirstfinalEdgefocusrunbodycompletedbutownedBrowserServerclose20s/kill10stimeout;0/1FAIL40174.1244mskept. Read-onlyprocesscheckconfirmednoownedheadlessEdgeleft. Serialrerunafterfullsuitepassed1/1throughcleanup; no productfixorcustomkill. Do not overlapCPU-heavyfullsuitewithnativebrowserlaunchagain.

Windows, exactgenuineAstra, publicationandpubliccanary stillseparategates. No newprofile/productionmatch for067. No claimofphysicalacceptance.

## First Windows final result, not a release pass

Run34707002949 on exact8fe completed FAILURE (GitHub updated_at2026-09-12T17:20:11Z). Chromejob103588754411: contracts595/595PASS, onlinebrowser143/144PASS, skip0; Edgejob103588754672 completedSUCCESS. The one Chrome failure is the existing quiz motion test at tests/standard-online-browser.test.cjs:4025 after rapid viewport430→390 resize. It awaits an already-true motionState=running rather than completion of resize layout. Rawsnapshot has arena right355 and old-width lastbutton right384.83001708984375. Sourceapp.js:2952-2953 and3037-3041 update geometry asynchronously via animationframe/ResizeObserver; state=running does not prove that resize has been processed. This is a concrete synchronization-race hypothesis, not a product acceptance or an automatic retry pass. Failedjoblogs remain on GitHub; no test assertion is removed, no main/Pages mutation or profile is authorized by this diagnosis. The exact067review request was sent before this final result was observed.

Governance-only checks initially33/35FAIL516.0568ms: new pending_delivery_status did not use the existing enum, and new real029/030 source bindings were missing from the explicit test map. Restored the existing enum while keeping exact20000-prefix/full61079-not-readback facts, and added source/candidate/scope/bounds assertions for actual029/030. Intermediate34/35FAIL585.5138ms retained; final35/35PASS464.3696ms. This is not a game test count or a new review approval.
