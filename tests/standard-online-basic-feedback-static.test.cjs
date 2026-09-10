"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");
const feedback = fs.readFileSync(path.join(root, "standard-online-v5", "basic-feedback.js"), "utf8");

test("online feedback settings are explicit, separate, persistent, and keyboard-sized", () => {
  assert.match(html, /id="feedbackSettings"[^>]+data-app-tab-panel="home profile"/);
  assert.match(html, /id="soundEffectsEnabled" type="checkbox"/);
  assert.match(html, /id="vibrationEnabled" type="checkbox"/);
  assert.match(html, /どちらも初期状態はOFFです/);
  assert.match(html, /id="feedbackSettingsStatus"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(css, /\.feedback-toggle\{[^}]*min-height:52px/);
  assert.match(css, /@media\(max-width:420px\)\{\.feedback-settings-controls\{grid-template-columns:1fr\}\.feedback-toggle\{min-height:56px\}\}/);
  assert.match(feedback, /basic-feedback-settings-v1/);
  assert.match(feedback, /sound: value\?\.schemaVersion === 1 && value\.sound === true/);
  assert.match(feedback, /vibration: value\?\.schemaVersion === 1 && value\.vibration === true/);
});

test("feedback script is cache-busted before the matching app generation", () => {
  const controllerScript = html.indexOf('<script src="basic-feedback.js?v=20260908-2"></script>');
  const appScript = html.indexOf('<script type="module" src="app.js?v=20260910-19"></script>');
  assert.ok(controllerScript >= 0 && appScript > controllerScript);
  assert.match(html, /style\.css\?v=20260910-11/);
  assert.doesNotMatch(html, /app\.js\?v=20260906-(?:36|38)|style\.css\?v=20260906-(?:36|37)/);
  assert.match(app, /basicFeedbackFactory\?\.VERSION === "standard-basic-feedback-v1"/);
});

test("only per-cell local threshold increases and new turn or terminal presentation events request sound or vibration", () => {
  const contactScope = app.slice(app.indexOf("function syncContactSelectionScope"), app.indexOf("function cpuCommentaryContext"));
  const turnObserver = app.slice(app.indexOf("function observeTurnArrival"), app.indexOf("function syncContactSelectionScope"));
  const contactSelection = app.slice(app.indexOf("function selectedContactColorCount"), app.indexOf("function boardMicroDescription"));
  const contactReveal = app.slice(app.indexOf("function showContactReveal"), app.indexOf("function renderTerminalResult"));
  const terminal = app.slice(app.indexOf("function renderTerminalResult"), app.indexOf("function colorName"));
  assert.doesNotMatch(contactScope, /lastPublicTrace|showContactReveal|notifyBasicFeedback/);
  assert.match(contactSelection, /function presentSelectedContactChange\(state, previousMacros, nextMacros = selectedMacros\)/);
  assert.doesNotMatch(contactSelection, /sourceMacros\.length !== state\.requiredSize/);
  assert.match(contactSelection, /const previousContactColorCount = selectedContactColorCount\(state, previousSourceMacros\)/);
  assert.match(contactSelection, /if \(contactColorCount < previousContactColorCount\) \{\s*clearContactReveal\(\)/);
  assert.match(contactSelection, /if \(contactColorCount < 2 \|\| contactColorCount <= previousContactColorCount\) return/);
  assert.match(contactSelection, /showContactReveal\(contactColorCount,[\s\S]+local-contact:\$\{contactSelectionPresentationSequence\}/);
  assert.match(contactReveal, /notifyBasicFeedback\(\{ eventId, cue: `contact-\$\{contactColorCount\}` \}\)/);
  assert.match(contactReveal, /const firstStage = Math\.max\(2, Math\.min\(contactColorCount, minimumStage\)\)/);
  assert.equal((app.match(/presentSelectedContactChange\(state, previousMacros\)/g) || []).length, 2);
  assert.match(turnObserver, /previousActive !== seat && active === seat/);
  assert.match(turnObserver, /startTurnArrivalBeat\(`\$\{matchId\}:\$\{version\}:turn:\$\{seat\}`\)/);
  assert.match(terminal, /shownTerminalEventKey !== eventKey[\s\S]+notifyBasicFeedback\(\{[\s\S]+state\.matchId[\s\S]+state\.version[\s\S]+state\.winner[\s\S]+state\.terminalReason/);
  assert.match(app, /Promise\.resolve\(basicFeedback\.notify\(payload\)\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(feedback, /\b(?:private_state|privateState|ownPrivate|palette|hand|loadout)\b/);
});

test("gesture, hidden, offline, replay, API-failure, and reduced-motion boundaries stay independent", () => {
  assert.match(app, /basicFeedback\.installGestureUnlock\(document\)/);
  assert.match(app, /basicFeedback\.handleStorageEvent\(event\)/);
  assert.match(feedback, /event\?\.isTrusted !== true/);
  assert.match(feedback, /safeDocument\?\.hidden !== true[\s\S]+visibilityState !== "hidden"[\s\S]+safeNavigator\?\.onLine !== false/);
  assert.match(feedback, /const claim = await claimEvent\(eventId\)/);
  const claimIndex = feedback.indexOf("const claim = await claimEvent(eventId)");
  const outputGateIndex = feedback.indexOf("if (destroyed || dispatchRevision !== outputRevision");
  assert.ok(claimIndex >= 0 && outputGateIndex > claimIndex);
  assert.match(feedback, /safeNavigator\?\.locks\?\.request/);
  assert.match(feedback, /requestLock\.call\(safeNavigator\.locks, EVENT_HISTORY_LOCK, \{ mode: "exclusive" \}/);
  assert.match(feedback, /storageTurnAvailable = await waitForStorageTurn\(\)/);
  assert.match(feedback, /historyFromJson\(event\.newValue\)/);
  assert.match(feedback, /eventHistory\.some\(\(eventId\) => !persistedIds\.has\(eventId\)\)/);
  assert.match(feedback, /oscillator\.stop\(0\)/);
  assert.match(feedback, /safeNavigator\.vibrate\(0\)/);
  assert.match(feedback, /catch \{ return false; \}/);
  assert.match(feedback, /EVENT_HISTORY_LIMIT = 64/);
  assert.doesNotMatch(feedback, /matchMedia|prefers-reduced-motion|fetch\(|XMLHttpRequest|Audio\(/);
  assert.doesNotMatch(feedback, /throw new Error|alert\(|confirm\(/);
});
