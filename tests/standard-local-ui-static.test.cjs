"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "standard-v5", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "standard-v5", "app.js"), "utf8");
const staticTerminal = fs.readFileSync(path.join(root, "standard-v5", "static-terminal-result.js"), "utf8");
const bundle = fs.readFileSync(path.join(root, "standard-v5", "app.bundle.js"), "utf8");
const browserFixture = fs.readFileSync(path.join(root, "tests", "fixtures", "standard-v5-browser-bootstrap.html"), "utf8");
const settlementFailureFixture = fs.readFileSync(path.join(root, "tests", "fixtures", "standard-v5-settlement-failure.html"), "utf8");
const actionMetricsFixture = fs.readFileSync(path.join(root, "tests", "fixtures", "standard-v5-action-metrics.html"), "utf8");
const colorSealBrowserGate = fs.readFileSync(path.join(root, "tests", "standard-color-seal-browser-lifecycle.test.cjs"), "utf8");
const illegalColorBrowserGate = fs.readFileSync(path.join(root, "tests", "standard-illegal-color-browser-terminal.test.cjs"), "utf8");
const noColorBrowserGate = fs.readFileSync(path.join(root, "tests", "standard-no-color-browser-terminal.test.cjs"), "utf8");
const settlementInflightBrowserGate = fs.readFileSync(path.join(root, "tests", "standard-settlement-inflight-browser.test.cjs"), "utf8");
const responsiveBrowserGate = fs.readFileSync(path.join(root, "tests", "standard-responsive-browser.test.cjs"), "utf8");
const contactPressureBrowserGate = fs.readFileSync(path.join(root, "tests", "standard-contact-pressure-browser.test.cjs"), "utf8");

test("local alpha has a bundled offline entry point", () => {
  assert.match(html, /app\.bundle\.js/);
  for (const id of ["profileA", "profileB", "firstPlayer", "startMatch", "handover", "privatePanel", "resultPanel"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const id of ["sizeRevealEnabled", "paletteRevealEnabled", "eventReveal"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /id="contactReveal"/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /https?:\/\/|supabase|fetch\s*\(/i);
  assert.ok(bundle.length > app.length);
});

test("formal Standard setup requires a complete owned two-per-category loadout before issuing start identities", () => {
  for (const id of ["ruleSet", "loadoutBuilder", "loadoutA", "loadoutB", "loadoutAStatus", "loadoutBStatus"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /const LOADOUT_CATEGORIES = Object\.freeze\(\["color", "area", "disrupt"\]\)/);
  assert.match(app, /session\.getSetupProjection\(ruleSet\.value\)/);
  assert.match(app, /standardLoadoutComplete\(\)/);
  assert.match(app, /args\.loadouts = selectedStandardLoadouts\(\)/);
  assert.match(app, /profileA\.onchange[\s\S]*clearLoadoutSelection\("A"\)/);
  assert.match(app, /profileB\.onchange[\s\S]*clearLoadoutSelection\("B"\)/);
  assert.match(app, /ruleSet\.onchange[\s\S]*clearLoadoutSelection\(\)/);
  const sameProfileGuard = app.indexOf("profileA.value === profileB.value");
  const incompleteGuard = app.indexOf("standard && !standardLoadoutComplete()");
  const identityIssue = app.indexOf("pendingStart ||= { matchId: makeId");
  assert.ok(sameProfileGuard >= 0 && sameProfileGuard < identityIssue);
  assert.ok(incompleteGuard >= 0 && incompleteGuard < identityIssue);
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML/);
});

test("UI consumes only the session projections and transaction boundaries", () => {
  assert.match(app, /createStandardLocalSession/);
  for (const boundary of ["getSetupProjection", "getStageProjection", "getPublicProjection", "revealPrivate", "quoteStart", "startMatch", "dispatchAction", "settle"]) {
    assert.match(app, new RegExp(`session\\.${boundary}`));
  }
  assert.doesNotMatch(app, /root\.activeMatch|applyStandardAction|createStandardMatch|basicPalettes/);
  assert.doesNotMatch(app, /standard-cpu|cpu\.|CPU/);
});

test("optional size and palette reveals plus permanent static result are wired", () => {
  assert.match(app, /PRESENTATION_KEY/);
  for (const text of ["NEXT AREA", "最初の持ち色"]) assert.match(app, new RegExp(text));
  for (const id of ["terminalHeadline", "terminalWinner", "terminalReason", "settlementStatus", "terminalStats", "unlockedTrophies", "retrySettlement"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /buildTerminalPresentation/);
  assert.match(app, /terminalResultRenderer\.renderStaticTerminalResult\(\{ terminalPresentation, settlementSummary \}\)/);
  assert.doesNotMatch(app, /GAME OVER/);
  assert.match(app, /paletteShown/);
  assert.match(app, /matchId.*result\.seat/);
});

test("static RESULT renderer accepts only public models and uses text nodes", () => {
  assert.match(staticTerminal, /function renderStaticTerminalResult\(\{ terminalPresentation, settlementSummary \}\)/);
  assert.match(staticTerminal, /\.textContent =/);
  assert.match(staticTerminal, /createTextElement/);
  assert.doesNotMatch(staticTerminal, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.doesNotMatch(staticTerminal, /root\.profiles|root\.receipts|activeMatch|authoritativeState|privateProjection|consumptionLedger|reservations|rngSnapshot|profileId/i);
  assert.match(staticTerminal, /settlementState === "FAILED"[\s\S]*retry\.hidden = false/);
  assert.match(staticTerminal, /settlementState !== "SETTLED"[\s\S]*settlementSummary\?\.status !== "SETTLED"/);
});

test("palette controls never encode an adjacency oracle", () => {
  assert.doesNotMatch(`${html}\n${app}`, /接色注意|合法色一覧|安全色|隣接色一覧|safe.?color/i);
  assert.match(app, /button\.disabled = publicState\.phase !== "COLOR"[\s\S]*bonusUsesRemaining[\s\S]*publicEffects/);
  assert.doesNotMatch(app, /adjacentRegionIds|availableColors|legalRecolorCandidates/);
  assert.match(app, /Object\.keys\(COLOR_NAMES\)/);
});

test("handover uses destructive private clearing", () => {
  assert.match(app, /clearPrivateDom\(privatePanel\)/);
  assert.match(app, /showHandover/);
  assert.match(app, /handover\.hidden = false/);
  assert.match(app, /renderStage\(session\.getStageProjection\(\)\)/);
  assert.match(app, /const revealTurn = byId\("revealTurn"\)/);
  assert.match(app, /revealTurn\.onclick/);
});

test("browser fixture can inject hostile profile labels without adding a product debug path", () => {
  assert.match(browserFixture, /fixtureParams = new URLSearchParams\(location\.search\)/);
  assert.match(browserFixture, /fixtureParams\.has\("xss"\)/);
  assert.match(browserFixture, /document\.title=1/);
  assert.match(browserFixture, /<img src=x onerror=document\.title=1>/);
  assert.match(browserFixture, /<script>alert\(1\)<\\\/script>/);
  assert.match(browserFixture, /<svg onload=document\.title=2>/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /document\.title=1|alert\(1\)|URLSearchParams\(location\.search\).*has\("xss"\)/);
  assert.match(app, /option\.textContent = profile\.displayName/);
  assert.match(app, /setupDetails\.textContent =/);
});

test("settlement failure injection remains fixture-only and fails exactly one matching write", () => {
  assert.match(settlementFailureFixture, /forced-settlement-write-failure/);
  assert.match(settlementFailureFixture, /matchSettlement/);
  assert.match(settlementFailureFixture, /let failed = false/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /forced-settlement-write-failure/);
});

test("action ID and save-write metrics remain fixture-only", () => {
  assert.match(actionMetricsFixture, /generatedIds/);
  assert.match(actionMetricsFixture, /saveWrites/);
  assert.match(actionMetricsFixture, /fourColorMapGame\.standard\.v5\.save/);
  assert.match(actionMetricsFixture, /focusTarget/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /e2eMetrics|generatedIds|saveWrites/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /focusTarget/);
});

test("color-seal browser lifecycle instrumentation remains test-owned", () => {
  assert.match(colorSealBrowserGate, /context\.addInitScript/);
  assert.match(colorSealBrowserGate, /payloadSha256/);
  assert.match(colorSealBrowserGate, /page\.keyboard\.down/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /__codexSaveWrite|__codexGeneratedId|payloadSha256/);
});

test("illegal-color terminal instrumentation remains test-owned", () => {
  assert.match(illegalColorBrowserGate, /__codexFailNextSettlementWrite/);
  assert.match(illegalColorBrowserGate, /forced-settlement-write-failure/);
  assert.match(illegalColorBrowserGate, /page\.keyboard\.down/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /__codexFailNextSettlementWrite|forced-settlement-write-failure/);
});

test("no-color session hook remains test-owned and the product UI has no declaration oracle", () => {
  assert.match(noColorBrowserGate, /globalThis\.__codexStandardSession = session/);
  assert.match(noColorBrowserGate, /context\.route/);
  assert.match(noColorBrowserGate, /DECLARE_NO_COLOR/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /__codexStandardSession/);
  assert.doesNotMatch(app, /dispatch\("DECLARE_NO_COLOR"/);
});

test("settlement delay and metrics adapters remain test-owned", () => {
  assert.match(settlementInflightBrowserGate, /__codexSettlementDelayAdapter/);
  assert.match(settlementInflightBrowserGate, /delayMs: 650/);
  assert.match(settlementInflightBrowserGate, /context\.route/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /__codexSettlementDelayAdapter|__codexSettlementMetrics|forced-delayed-settlement-failure/);
});

test("responsive browser instrumentation remains test-owned at the three release viewports", () => {
  assert.match(responsiveBrowserGate, /viewport: \{ width: 390, height: 844 \}/);
  assert.match(responsiveBrowserGate, /viewport: \{ width: 768, height: 1024 \}/);
  assert.match(responsiveBrowserGate, /viewport: \{ width: 1365, height: 768 \}/);
  assert.match(responsiveBrowserGate, /__codexResponsiveSettlementAdapter/);
  assert.match(responsiveBrowserGate, /context\.route/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /__codexResponsiveSettlementAdapter|__codexResponsiveFailSettlements|__codexResponsiveMetrics/);
});

test("contact-pressure browser instrumentation remains test-owned", () => {
  assert.match(contactPressureBrowserGate, /__codexContactSession/);
  assert.match(contactPressureBrowserGate, /__codexContactMetrics/);
  assert.match(contactPressureBrowserGate, /context\.route/);
  assert.doesNotMatch(`${html}\n${app}\n${bundle}`, /__codexContactSession|__codexContactMetrics/);
});

test("legal recolor target mode has an explicit write-free cancel path", () => {
  assert.match(app, /targetMode === "legalRecolor"[\s\S]*対象選択をキャンセル/);
  assert.match(app, /targetMode = null;[\s\S]*対象選択を解除しました。[\s\S]*renderPrivate\(own\)/);
});

test("detached private controls cannot dispatch a second action", () => {
  assert.match(app, /interactionGeneration/);
  assert.match(app, /inFlightGestures/);
  assert.match(app, /recentGestureUntil/);
  assert.match(app, /recentGestureUntil\.set\(group, now \+ 300\)/);
  assert.match(app, /controlGeneration !== interactionGeneration \|\| !button\.isConnected/);
  assert.match(app, /controlGeneration !== interactionGeneration \|\| !apply\.isConnected/);
});

test("one gesture guard precedes IDs and every current persistence boundary", () => {
  const guard = app.indexOf("function runGesture");
  const id = app.indexOf("pendingStart ||= { matchId: makeId");
  assert.ok(guard >= 0 && guard < id);
  assert.match(app, /function dispatch[\s\S]*runGesture\(actionGestureGroup\(type, payload\), async \(\) => \{[\s\S]*session\.dispatchAction/);
  assert.match(app, /function showContactReveal[\s\S]*二色接触！[\s\S]*三色圧力!![\s\S]*四色包囲!!!/);
  assert.match(app, /const reveal = reveals\[contactColorCount\];\s*if \(!reveal\) return;/);
  assert.match(app, /contact-reveal-card contact-pressure-\$\{contactColorCount\}/);
  assert.match(app, /renderStage\(result\.projection\);[\s\S]*result\.status === "RESOLVED"[\s\S]*result\.saved[\s\S]*result\.appliedNow[\s\S]*!result\.replayedReceipt[\s\S]*result\.actionType === "CREATE_REGION"[\s\S]*showContactReveal\(result\.contactColorCount\)/);
  assert.match(html, /\.contact-reveal\{[^}]*pointer-events:none/);
  assert.match(app, /contactReveal = document\.createElement\("div"\)[\s\S]*role", "status"[\s\S]*aria-live", "polite"[\s\S]*document\.body\.appendChild\(contactReveal\)/);
  assert.match(app, /contactReveal\?\.remove\(\);\s*contactReveal = null/);
  assert.match(html, /prefers-reduced-motion:reduce[\s\S]*contact-reveal-card/);
  assert.match(app, /startMatch\.onclick = \(\) => runGesture\("match-start"/);
  assert.match(app, /retrySettlement: \(\) => runGesture\("settlement-retry", settleAndRender\)/);
  assert.match(app, /revealTurn\.onclick = \(\) => \{\s*if \(handover\.hidden\) return;\s*runGesture\(`handover-reveal:\$\{interactionGeneration\}`/);
  assert.match(app, /commitRegion\.onclick = \(\) => \{[\s\S]*dispatch\("CREATE_REGION", \{ sourceMacros: publicState\.preparedOutgoing\?\.sourceMacros \|\| \[\.\.\.selected\]/);
  assert.match(app, /surrender\.onclick = \(\) => dispatch\("SURRENDER"\)/);
  assert.doesNotMatch(app, /runPrivateAction|privateActionLockedUntil/);
});

test("contact presentation accepts only the post-commit public result scalar", () => {
  const start = app.indexOf("function showContactReveal(contactColorCount)");
  const end = app.indexOf("function clearContactReveal()", start);
  assert.ok(start >= 0 && end > start);
  const presentation = app.slice(start, end);
  assert.match(presentation, /reveals\[contactColorCount\]/);
  assert.doesNotMatch(presentation, /session|authoritative|privateState|privateProjection|basicPalette|bonusColor|hand|privateEffects|loadout|rngSnapshot/i);
  assert.match(app, /result\.status === "RESOLVED"[\s\S]*result\.saved[\s\S]*result\.appliedNow[\s\S]*!result\.replayedReceipt[\s\S]*showContactReveal\(result\.contactColorCount\)/);
});

test("contact timers use a presentation-only generation token", () => {
  assert.match(app, /let contactPresentationGeneration = 0/);
  assert.match(app, /const presentationGeneration = \+\+contactPresentationGeneration/);
  assert.match(app, /presentationGeneration !== contactPresentationGeneration \|\| contactReveal !== presentationNode/);
  assert.match(app, /function clearContactReveal\(\) \{\s*contactPresentationGeneration \+= 1/);
  assert.doesNotMatch(app, /interactionGeneration[^\n]*(contactReveal|presentation)|contactPresentationGeneration[^\n]*(root|session|receipt|rng)/i);
  assert.equal(app.match(/contactPresentationGeneration/g).length, 4);
});

test("gesture guard is in-flight safe, scoped, and ignores repeated keyboard activation", () => {
  assert.match(app, /inFlightGestures\.has\(group\)/);
  assert.match(app, /inFlightGestures\.add\(group\)/);
  assert.match(app, /result && typeof result\.finally === "function"/);
  assert.match(app, /result\.finally\(\(\) => inFlightGestures\.delete\(group\)\)/);
  assert.match(app, /event\.repeat && \(event\.key === "Enter" \|\| event\.key === " "\)/);
  assert.match(app, /actionGestureGroup/);
  assert.match(app, /`action:\$\{type\}:\$\{interactionGeneration\}`/);
  assert.match(app, /`skill:\$\{payload\.skill\}:\$\{interactionGeneration\}`/);
  assert.match(app, /skill:\$\{payload\.skill\}/);
  assert.match(app, /action:\$\{type\}/);
  assert.doesNotMatch(app, /runGesture\([^,]*,?\s*\(\) => dispatch/);
});

test("settlement retry exposes a busy disabled state until the awaited transaction completes", () => {
  assert.match(app, /async function settleAndRender\(\)/);
  assert.match(app, /terminalResultRenderer\.setRetryBusy\(true\)/);
  assert.match(app, /const settled = await session\.settle\(\)/);
  assert.match(staticTerminal, /retry\.disabled = busy === true/);
  assert.match(staticTerminal, /retry\.setAttribute\("aria-busy", "true"\)/);
});

test("CREATE keeps its control busy and disabled until the action transaction settles", () => {
  assert.match(app, /return runGesture\(actionGestureGroup\(type, payload\), async \(\) =>/);
  assert.match(app, /const activeControl = type === "CREATE_REGION" \? commitRegion : null/);
  assert.match(app, /activeControl\.disabled = true/);
  assert.match(app, /activeControl\.setAttribute\("aria-busy", "true"\)/);
  assert.match(app, /const result = await session\.dispatchAction/);
  assert.match(app, /activeControl\.removeAttribute\("aria-busy"\)/);
  assert.match(app, /finally \{/);
});
