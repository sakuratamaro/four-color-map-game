"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");

function body(name, nextName) {
  const start = app.indexOf(`function ${name}`);
  const end = nextName ? app.indexOf(`function ${nextName}`, start + 1) : app.length;
  assert.ok(start >= 0 && end > start, `${name} body must be present`);
  return app.slice(start, end);
}

test("matched handoff is one shared, keyboard-operable live notice", () => {
  assert.match(html, /id="connectionCard"[^>]+data-app-tab-panel="home battle quiz cards profile"/);
  assert.equal((html.match(/id="matchedRoomAnnouncement"/g) || []).length, 1);
  assert.match(html, /id="matchedRoomAnnouncement"[^>]+class="visually-hidden"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(html, /id="matchedRoomHandoffTitle"/);
  assert.match(html, /id="returnToMatchedRoom"[^>]+type="button"/);
  assert.match(html, /id="setupTitle"[^>]+tabindex="-1"/);
  assert.match(css, /\.connection-card\.has-matched-room\{[^}]*pointer-events:auto/);
  assert.match(css, /@media\(max-width:420px\)\{\.matched-room-handoff\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(app, /\b(?:alert|confirm)\s*\(/);
});

test("only a client-confirmed room can enqueue and announce once per room", () => {
  const enter = body("enterPublicMatch", "pollMatchmakingStatus");
  const queue = body("queueMatchedRoomHandoff", "markQuizBoundaryForMatchedRoom");
  assert.match(enter, /const authoritativeRoomId = client\.snapshot\(\)\.roomId/);
  assert.match(enter, /if \(!authoritativeRoomId\) throw new Error\("MATCHED_ROOM_NOT_CONFIRMED"\)/);
  assert.ok(enter.indexOf("await roomSync.start(authoritativeRoomId)") < enter.indexOf("queueMatchedRoomHandoff(message)"));
  assert.match(queue, /const authoritativeRoomId = client\.snapshot\(\)\.roomId/);
  assert.match(queue, /announcedMatchedRoomId !== authoritativeRoomId/);
  assert.equal((queue.match(/matchedRoomAnnouncement/g) || []).length, 1);
});

test("quiz handoff preserves the immutable pending answer and stops the next clock", () => {
  const submit = body("submitPendingQuizAnswer", "finishOnlineQuiz");
  const renderQuiz = body("renderQuiz", "startOnlineQuiz");
  assert.ok(submit.indexOf("actionId: pending.actionId") < submit.indexOf("pendingQuiz.pendingAnswer = null"));
  assert.ok(submit.indexOf("pendingQuiz.answers.push(pending.answerId)") < submit.indexOf("markQuizBoundaryForMatchedRoom({ feedback: true })"));
  assert.match(renderQuiz, /else if \(lockedByMatch\) stopQuizClock\(\)/);
  assert.match(app, /Date\.now\(\) \+ MATCHED_ROOM_FEEDBACK_MS/);
  assert.match(app, /pendingQuiz\?\.pendingAnswer[^\n]+同じ回答IDで再送・確定/);
  assert.match(app, /const quizInProgress = Boolean\(pendingQuiz\) && pendingQuiz\.answers\.length < 10/);
  assert.match(app, /const quizOperationInProgress = quizBusy/);
  assert.match(app, /if \(quizLockedByMatchedRoom\(\)[^\n]+return stopQuizClock\(\)/);
  assert.match(app, /button\.disabled = quizBusy \|\| lockedByMatch/);
  assert.match(app, /if \(quizBusy \|\| quizLockedByMatchedRoom\(\)/);
  assert.match(renderQuiz, /const questionState = lockedByMatch \? ensureQuizQuestionState\(\) : settleQuizClock\(\)/);
  assert.doesNotMatch(renderQuiz, /const questionState = settleQuizClock\(\)/);
});

test("gacha settles to a result or retriable state before automatic movement", () => {
  const gacha = body("runGacha", "createStarterProfile");
  assert.ok(gacha.indexOf("client.drawGacha(pendingGacha)") < gacha.indexOf("pendingGacha = null"));
  assert.match(gacha, /同じ抽選IDで安全に再試行できます/);
  assert.match(gacha, /finally \{ gachaBusy = false; renderGacha\(\); render\(\); flushMatchedRoomHandoff\(\); \}/);
  assert.match(app, /gachaBusy\) return "抽選結果、または同じ抽選IDで再送できる状態/);
  assert.match(app, /gachaDrawOne"\)\.disabled = gachaBusy \|\| Boolean\(pendingGacha\) \|\| hasMatchedRoomHandoff\(\)/);
  assert.match(app, /gachaDrawAll"\)\.disabled = gachaBusy \|\| Boolean\(pendingGacha\) \|\| hasMatchedRoomHandoff\(\)/);
  assert.match(app, /gachaRetry"\)\.disabled = gachaBusy \|\| hasMatchedRoomHandoff\(\)/);
});

test("restored public rooms recover while CPU and invitation paths stay separate", () => {
  assert.match(app, /let quizPausedForMatchedRoom = false/);
  assert.match(app, /let quizRoomClassificationPending = Boolean\(client\.snapshot\(\)\.roomId && pendingQuiz\)/);
  assert.match(app, /roomModel\?\.room\?\.access_mode === "public_queue" && roomModel\.room\.status !== "finished"/);
  assert.match(app, /resolveQuizRoomClassification\(\{ activePublicRoom \}\)/);
  assert.match(app, /queueMatchedRoomHandoff\("成立済みの野良対戦があります。"\)/);
  assert.match(app, /if \(pendingQuiz && !pendingQuiz\.pendingAnswer\) markQuizBoundaryForMatchedRoom\(\)/);
  assert.match(app, /roomModel\?\.room\?\.opponent_kind === "cpu"/);
  assert.match(app, /activateAppTab\("battle"\)/);
  assert.match(app, /async function createRoom\(\)[^\n]+client\.createRoom/);
  assert.match(app, /async function joinRoom\(\)[^\n]+client\.joinRoom/);
  assert.doesNotMatch(body("createRoom", "submitSetup"), /queueMatchedRoomHandoff/);
});

test("battle consumes the overlay while preserving a return path and CPU status copy", () => {
  const renderHandoff = body("renderMatchedRoomHandoff", "focusMatchedRoom");
  const go = body("goToMatchedRoom", "flushMatchedRoomHandoff");
  const enter = body("enterPublicMatch", "pollMatchmakingStatus");
  assert.match(renderHandoff, /hasMatchedRoomHandoff\(\) && activeAppTab !== "battle"/);
  assert.ok(go.indexOf("pauseQuizClockForMatchedRoom()") >= 0);
  assert.ok(go.indexOf("pauseQuizClockForMatchedRoom()") < go.indexOf('activateAppTab("battle")'));
  assert.match(go, /matchedRoomHandoff\.arrived = true/);
  assert.match(enter, /opponent_kind === "cpu"[^]+matchmakingStatus"\)\.textContent = message[^]+activateAppTab\("battle"\)/);
  assert.match(app, /requestedTab === "battle" && hasMatchedRoomHandoff\(\) && matchedRoomHandoffBlockReason\(\)/);
  assert.match(app, /matchedRoomHandoffTitle"\)\.focus/);
  assert.match(app, /tab === "quiz" && quizPausedForMatchedRoom && !hasMatchedRoomHandoff\(\)/);
  assert.doesNotMatch(renderHandoff, /resumeQuizClock/);
});

test("room classification freezes reload time only until the authoritative room kind is known", () => {
  const locked = body("quizLockedByMatchedRoom", "pauseQuizClockForMatchedRoom");
  const resolve = body("resolveQuizRoomClassification", "matchedRoomHandoffBlockReason");
  const refresh = body("refreshRoom", "reflectBrowserConnectivity");
  assert.match(locked, /quizRoomClassificationPending/);
  assert.match(resolve, /quizRoomClassificationPending = false/);
  assert.match(resolve, /if \(activePublicRoom\) return/);
  assert.match(resolve, /if \(activeAppTab === "quiz"\) resumeQuizClockOnQuizTab\(\)/);
  assert.match(refresh, /client\.clearRoom\(\);[^]+resolveQuizRoomClassification\(\);\s+render\(\)/);
});
