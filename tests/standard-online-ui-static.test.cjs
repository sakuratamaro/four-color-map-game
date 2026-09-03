"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { STANDARD_SKILLS } = require("../standard/standard-skill-registry.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");
const progressionCss = fs.readFileSync(path.join(root, "standard-online-v5", "progression.css"), "utf8");

test("Standard online setup UI exposes the complete reconnect path", () => {
  for (const id of [
    "connectionBadge", "profileSelect", "starterCreator", "starterName", "createStarterProfile", "syncProfile", "createRoom", "roomCode", "joinRoom",
    "shownCode", "members", "loadoutGrid", "submitSetup", "setupStatus", "matchCard",
    "publicProjection", "privateProjection", "leaveRoom",
    "board", "regionControls", "selectionCount", "submitRegion", "paletteControls", "skillControls", "skillTargetControls",
    "declareNoColor", "surrender", "retryAction", "actionStatus", "rematchControls", "rematchStatus", "requestRematch",
    "gachaPanel", "gachaTickets", "gachaLevel", "gachaDrawOne", "gachaDrawAll", "gachaRetry", "gachaStatus", "gachaResults",
    "progressionPanel", "profileCoins", "profileStats", "trophyList", "matchHistory",
    "cardSaleSkill", "cardSaleCount", "cardSaleQuote", "cardSaleCommit", "cardSaleRetry", "cardSaleReset", "cardSaleStatus",
    "matchmakingPanel", "recruitOpponent", "findOpponent", "cancelMatchmaking", "matchmakingWait", "matchmakingElapsed", "matchmakingStatus", "roomIdentityLabel",
    "terminalOverlay", "terminalIcon", "terminalEyebrow", "terminalTitle", "terminalMessage", "terminalReasonText", "terminalClose",
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /standard-online-client\.js/);
  assert.match(html, /standard-online-skill-intents\.js/);
  assert.match(html, /type="module" src="app\.js"/);
});

test("server-hydrated progression renders stats, three trophies, and recent history as text", () => {
  assert.match(app, /function renderProgression\(\)/);
  assert.match(app, /show\("progressionPanel", synced && Boolean\(profile\(\)\)\)/);
  for (const trophyId of ["fullPaint", "fullPaint3", "noSkillFullPaint"]) assert.match(app, new RegExp(`${trophyId}:`));
  assert.match(app, /value\.matchHistory\.slice\(0, 10\)/);
  assert.match(app, /item\.append\(result, detail\)/);
  assert.doesNotMatch(app, /matchHistory[^\n]+innerHTML/);
  assert.match(progressionCss, /\.trophy\.unlocked/);
  assert.match(progressionCss, /\.history-win/);
});

test("card sale persists an immutable action before commit and hydrates only the server result", () => {
  assert.match(app, /const CARD_SALE_PENDING_KEY = "fourColorMapGame\.standard\.online\.v5\.pending-card-sale"/);
  assert.match(app, /client\.quoteCardSale\(\{ skillId, count \}\)/);
  const persisted = app.indexOf("localStorage.setItem(CARD_SALE_PENDING_KEY, JSON.stringify(pendingCardSale))");
  const sent = app.indexOf("client.sellCards(pendingCardSale)");
  assert.ok(persisted >= 0 && sent > persisted);
  assert.match(app, /persistRemoteProfile\(result\.profileState, displayName\(\), Number\(result\.revision\)\)/);
  assert.match(app, /cardSaleQuote\.requiresConfirmation === true/);
  assert.match(app, /client\.snapshot\(\)\.setupRevision > 0/);
});

test("public matchmaking stays code-free, recoverable, cancellable, and separate from invitation rooms", () => {
  assert.match(html, /友だちと遊ぶ/);
  assert.match(html, /だれかと遊ぶ/);
  assert.match(app, /client\.recruitOpponent\(\{ displayName: displayName\(\) \}\)/);
  assert.match(app, /client\.findOpponent\(\{ displayName: displayName\(\) \}\)/);
  assert.match(app, /client\.readMatchmakingStatus\(\)/);
  assert.match(app, /client\.cancelMatchmaking\(\)/);
  assert.match(app, /accessMode === "public_queue" \? "野良対戦"/);
  assert.match(app, /document\.visibilityState === "hidden"/);
  assert.match(progressionCss, /prefers-reduced-motion: reduce/);
});

test("every finished match presents a local-seat victory or defeat overlay, including surrender", () => {
  assert.match(app, /function renderTerminalResult\(state\)/);
  assert.match(app, /state\?\.status !== "FINISHED"/);
  assert.match(app, /const won = state\.winner === mySeat/);
  assert.match(app, /\$\("terminalTitle"\)\.textContent = won \? "勝利！" : "敗北"/);
  assert.match(app, /state\.terminalReason === "SURRENDER" && won \? "相手が投了しました"/);
  assert.match(app, /SURRENDER: `\$\{loser\} が投了しました。`/);
  assert.match(app, /requestAnimationFrame\(\(\) => \$\("terminalClose"\)\.focus/);
  assert.match(app, /dismissedTerminalEventKey = shownTerminalEventKey/);
  assert.doesNotMatch(app, /terminal(?:Title|Message|ReasonText)"\)\.innerHTML/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[^{]*\{[^}]*\.terminal-overlay/);
});

test("gacha persists its action identity before sending and hydrates the committed server profile", () => {
  assert.match(app, /const GACHA_PENDING_KEY = "fourColorMapGame\.standard\.online\.v5\.pending-gacha"/);
  assert.match(app, /pendingGacha = \{ actionId: crypto\.randomUUID\(\), ticketLevel: level, count \}/);
  const persisted = app.indexOf("localStorage.setItem(GACHA_PENDING_KEY, JSON.stringify(pendingGacha))");
  const sent = app.indexOf("client.drawGacha(pendingGacha)");
  assert.ok(persisted >= 0 && sent > persisted);
  assert.match(app, /persistRemoteProfile\(result\.profileState, displayName\(\), Number\(result\.revision\)\)/);
  assert.match(app, /localStorage\.removeItem\(GACHA_PENDING_KEY\)/);
  assert.match(app, /runGacha\(1, true\)/);
});

test("existing online progression is hydrated from the server rather than re-uploaded", () => {
  assert.match(app, /const REMOTE_PROFILE_KEY = "fourColorMapGame\.standard\.online\.v5\.remote-profile"/);
  assert.match(app, /function hydrateProfileRow\(row\)/);
  assert.match(app, /if \(!row\?\.profile_state \|\| Number\(row\.revision\) === hydratedProfileRevision\) return/);
  const sync = app.slice(app.indexOf("async function syncSelectedProfile()"), app.indexOf("async function leaveRoom()"));
  assert.match(sync, /const remote = await client\.readProfile\(\)/);
  assert.match(sync, /if \(remote\) hydrateProfileRow\(remote\)/);
  assert.match(sync, /else \{[\s\S]+client\.syncProfile\(\{ displayName: displayName\(\), profileState: value \}\)/);
});

test("UI enumerates exactly the 19 canonical Standard cards by category", () => {
  const catalog = app.slice(app.indexOf("const SKILLS = ["), app.indexOf("];", app.indexOf("const SKILLS = [")) + 2);
  const ids = [...catalog.matchAll(/\["([A-Za-z][A-Za-z0-9]+)", "[^"]+", "(color|area|disrupt)"\]/g)].map((match) => match[1]);
  const canonical = Object.values(STANDARD_SKILLS).filter((skill) => skill.v49Catalogued).map((skill) => skill.id);
  assert.equal(ids.length, 19);
  assert.deepEqual([...ids].sort(), [...canonical].sort());
  assert.equal(new Set(ids).size, 19);
  assert.doesNotMatch(app, /legalRecolor/);
});

test("profile, room, setup, initialize, and reconnect flow only through the client boundary", () => {
  for (const method of ["ensureSession", "readProfile", "syncProfile", "createRoom", "joinRoom", "recruitOpponent", "findOpponent", "readMatchmakingStatus", "cancelMatchmaking", "submitSetup", "initialize", "readRoom", "clearRoom"]) {
    assert.match(app, new RegExp(`client\\.${method}\\(`));
  }
  assert.doesNotMatch(app, /supabase\.rpc\(|supabase\.functions\.invoke\(/);
  assert.match(app, /fourColorMapGame\.standard\.v5\.save/);
  assert.match(app, /if \(client\.snapshot\(\)\.roomId\)/);
  assert.match(app, /function hasStandardPublicState\(value\)/);
  assert.match(app, /!hasStandardPublicState\(roomModel\.room\.public_state\)/);
  assert.match(app, /if \(hasStandardPublicState\(roomModel\?\.room\?\.public_state\)\)/);
});

test("setup enforces two owned cards from every category before submission", () => {
  assert.match(app, /value\?\.inventory\?\.\[id\]/);
  assert.match(app, /if \(checked\.length > 2\) changed\.checked = false/);
  assert.match(app, /every\(\(category\) => loadout\[category\]\.length === 2\)/);
  assert.match(app, /client\.submitSetup\(\{ loadout \}\)/);
});

test("a fresh device can create a six-card online-only starter without overwriting the Standard save", () => {
  assert.match(app, /fourColorMapGame\.standard\.online\.v5\.starter-profile/);
  assert.match(app, /const STARTER_INVENTORY = Object\.freeze\(\{/);
  for (const id of ["colorRandomBorrow", "colorChoiceBorrow", "areaMicroBloom", "areaDiePlus", "disruptRandomOne", "disruptChoiceOne"]) {
    assert.match(app, new RegExp(`${id}: 3`));
  }
  assert.match(app, /localStorage\.setItem\(STARTER_PROFILE_KEY/);
  assert.doesNotMatch(app, /localStorage\.setItem\(SAVE_KEY/);
  assert.match(app, /loadProfiles\(\);\s*render\(\);\s*try \{/);
  assert.match(app, /syncProfile"\)\.disabled = !value \|\| !connected/);
});

test("remote labels and projections are rendered as text, not HTML", () => {
  assert.match(app, /node\.textContent = `Player \$\{member\.seat\}: \$\{member\.display_name\}`/);
  assert.match(app, /\$\("publicProjection"\)\.textContent = safeJson\(publicState\)/);
  assert.match(app, /\$\("privateProjection"\)\.textContent = safeJson\(privateState\)/);
  assert.doesNotMatch(app, /innerHTML/);
  assert.doesNotMatch(app, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role/i);
});

test("UI does not expose an adjacency or legal-color oracle", () => {
  assert.doesNotMatch(html + app, /legal colors?|legalColors|adjacent colors?|adjacentColors|使用可能な色[:：]/i);
});

test("basic board actions are intents derived from public and own-private projections", () => {
  assert.match(app, /roomModel\.room\.public_state/);
  assert.match(app, /roomModel\.view\?\.private_state/);
  assert.match(app, /sendAction\("CREATE_REGION", \{ sourceMacros:/);
  assert.match(app, /sendAction\("COLOR_REGION", \{ color \}\)/);
  assert.match(app, /sendAction\("DECLARE_NO_COLOR"\)/);
  assert.match(app, /sendAction\("SURRENDER"\)/);
  assert.doesNotMatch(app, /client\.submitAction\([^)]*(?:state|publicState|privateState)/);
});

test("failed actions retain the exact identity and retry only the same intent", () => {
  assert.match(app, /pendingAction = \{ id: crypto\.randomUUID\(\), expectedVersion: roomModel\.room\.version, type, payload, signature \}/);
  assert.match(app, /if \(!retry \|\| !pendingAction \|\| pendingAction\.signature !== signature\)/);
  assert.match(app, /await client\.submitAction\(pendingAction\)/);
  assert.match(app, /sendAction\(pendingAction\.type, pendingAction\.payload, true\)/);
  assert.match(app, /pendingAction = null; selectedMacros\.clear\(\)/);
});

test("all 19 skill target kinds route through the reviewed intent builder", () => {
  assert.match(app, /Object\.entries\(privateState\.hand \|\| \{\}\)/);
  assert.match(app, /skillIntents\.isImmediate\(skill\)/);
  assert.match(app, /skillIntents\.buildSkillPayload\(skill\)/);
  assert.match(app, /skillIntents\.buildSkillPayload\(targetDraft\.skill, input\)/);
  for (const kind of ["color", "slot-color", "region-split", "source-macros", "corner-bloom", "resize", "band-shift"]) {
    assert.match(app, new RegExp(kind));
  }
  assert.match(app, /sendAction\("USE_SKILL", payload\)/);
});

test("skill target cancel is write-free and clears only transient selection", () => {
  assert.match(app, /"キャンセル", \(\) => \{ targetDraft = null; selectedMacros\.clear\(\); render\(\); \}/);
  assert.match(app, /盤面選択を解除/);
  assert.doesNotMatch(app, /キャンセル[^\n]+submitAction/);
});

test("finished rooms expose a reconnect-safe rematch request", () => {
  assert.match(app, /show\("rematchControls", roomModel\?\.room\?\.status === "finished"\)/);
  assert.match(app, /client\.requestRematch\(\{ expectedVersion: roomModel\.room\.version \}\)/);
  assert.match(app, /rematchPending \? "同じ再戦申請を再送"/);
  assert.match(app, /await roomSync\.refreshNow\(\)/);
  assert.match(app, /roomModel\.room\.status === "ready" && client\.snapshot\(\)\.setupRevision > 0/);
});
