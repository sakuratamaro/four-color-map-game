"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit actual-browser gate */ }

const root = path.resolve(__dirname, "..");
const BROWSER_PATHS = Object.freeze({
  edge: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  chrome: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const browserName = process.env.STANDARD_BROWSER || "edge";
if (!Object.hasOwn(BROWSER_PATHS, browserName)) throw new Error("STANDARD_BROWSER must be edge or chrome");
const browserPath = BROWSER_PATHS[browserName];
const connectionKey = "fourColorMapGame.standard.online.v5.connection";
const saveKey = "fourColorMapGame.standard.v5.save";
const remoteProfileKey = "fourColorMapGame.standard.online.v5.remote-profile";
const roomId = "11111111-1111-4111-8111-111111111111";
const pendingRematchId = "22222222-2222-4222-8222-222222222222";
const RESTORED_ROOM_MODES = new Set(["finished", "playing", "handoffGuide", "cpuTurn", "finishedCpu", "cpuWin", "setupTransition", "setupTransitionCpuFirst", "actionRuleError", "setupDebugError"]);

function browserStage(stage) {
  console.error(`BROWSER_STAGE ${stage}`);
}

async function bounded(stage, promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`BROWSER_STAGE_TIMEOUT ${stage}`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    const server = http.createServer((request, response) => {
      const relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, "") || "index.html";
      const target = path.resolve(root, relative);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end("Forbidden");
      fs.readFile(target, (error, body) => {
        if (error) return response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
        response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mime[path.extname(target)] || "application/octet-stream" });
        response.end(body);
      });
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function installMock(context, mode) {
  await context.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript; charset=utf-8",
    body: "export function createClient(){return globalThis.__standardOnlineMockSupabase}",
  }));
  await context.addInitScript(({ connectionKey: connection, saveKey: save, roomId: id, pendingId, mode: initialMode }) => {
    const initialTab = ["gacha", "quiz", "quizPolish"].includes(initialMode) ? "quiz" : initialMode === "cosmetic" ? "profile" : initialMode === "empty" ? "home" : "battle";
    const setupTransition = ["setupTransition", "setupTransitionCpuFirst"].includes(initialMode);
    const setupPending = setupTransition || initialMode === "setupDebugError";
    const cpuRoomMode = ["cpuTurn", "finishedCpu", "cpuWin", "setupTransition", "setupTransitionCpuFirst"].includes(initialMode);
    localStorage.setItem("fourColorMapGame.standard.online.v5.active-tab", initialTab);
    const inventory = Object.fromEntries([
      "colorRandomBorrow", "colorChoiceBorrow", "colorPrism", "colorRegionSplit", "colorPaletteChange",
      "areaMicroBloom", "areaDiePlus", "areaResize", "areaCornerBloom", "areaHalfShift", "areaTripleShift",
      "disruptRandomOne", "disruptChoiceOne", "disruptRandomTwo", "disruptPaletteRandom", "disruptChoiceTwo",
      "disruptPaletteChoice", "disruptChoiceThree", "disruptForcedPalette",
    ].map((skill) => [skill, 2]));
    if (initialMode !== "empty") {
      localStorage.setItem(save, JSON.stringify({ profiles: { playerA: { displayName: "A", inventory } } }));
      localStorage.setItem("fourColorMapGame.standard.online.v5.profile", "playerA");
      if (!["lobby", "cosmetic", "quiz", "quizPolish", "publicFind", "cpuWait", "cpuRetry"].includes(initialMode)) {
        localStorage.setItem(connection, JSON.stringify({
          roomId: id, roomCode: "A1B2C3", profileRevision: 1, setupRevision: setupPending ? 0 : 3,
          rematchActionId: initialMode === "finished" ? pendingId : null,
          rematchExpectedVersion: initialMode === "finished" ? 9 : null,
        }));
      } else if (initialMode === "cpuWait") {
        localStorage.setItem(connection, JSON.stringify({
          roomId: null, roomCode: null, profileRevision: 1, setupRevision: 0,
          matchmakingTicketId: pendingId, matchmakingStartedAt: new Date(Date.now() - 91000).toISOString(), matchmakingFindActionId: null,
        }));
      } else if (initialMode === "cpuRetry") {
        localStorage.setItem(connection, JSON.stringify({
          roomId: null, roomCode: null, profileRevision: 1, setupRevision: 0,
          matchmakingTicketId: null, matchmakingStartedAt: null, matchmakingFindActionId: null,
          cpuStartActionId: pendingId, cpuStartCharacterId: "yuzu",
        }));
      }
    }
    const active = {
      matchId: `${id}:9`, status: "ACTIVE", version: 9, turn: 3, active: "A", phase: "WORK", winner: null, requiredSize: 1, rolledSize: 1, baseRequiredSize: 1,
      playableBounds: { macroWidth: 4, microScale: 1, minCol: 0, minRow: 0, maxCol: 3, maxRow: 3 },
      regions: {},
    };
    const finished = { ...active, status: "FINISHED", phase: "GAME_OVER", winner: "A", terminalReason: "SURRENDER" };
    const profileState = {
      displayName: "A", inventory, gachaTickets: { "1": 2 }, coins: initialMode === "cosmetic" ? 1000 : 0,
      protectedSkills: { areaHalfShift: true }, cosmeticsOwned: ["boardDefault", "effectDefault", "nameplateDefault", "titleNone"],
      equipped: { board: "boardDefault", effect: "effectDefault", nameplate: "nameplateDefault", title: "titleNone" },
      trophies: { fullPaint: true, fullPaint3: false, noSkillFullPaint: true },
      trophyDates: { fullPaint: "2026-09-01T00:00:00.000Z", noSkillFullPaint: "2026-09-01T00:00:00.000Z" },
      stats: { wins: 4, losses: 2, currentWinStreak: 2, bestWinStreak: 3, fullPaints: 1 },
      cpuStats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
      cpuCharacterStats: {},
      matchHistory: [{ matchId: "history-1", result: "WIN", terminalReason: "BOARD_LOCK", endedAt: "2026-09-01T00:00:00.000Z", fullPaint: true, skillsUsed: 0 }],
    };
    if (["cosmetic", "cpuWin"].includes(initialMode)) {
      try { Object.assign(profileState, JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.remote-profile") || "null") || {}); } catch { /* fresh mock profile */ }
    }
    if (initialMode === "finished") {
      profileState.matchHistory.unshift({ matchId: `${id}:9`, result: "WIN", terminalReason: "SURRENDER", endedAt: "2026-09-05T00:00:00.000Z", fullPaint: false, skillsUsed: 0, onlineOpponentKind: "human" });
    }
    if (initialMode === "cpuTurn") active.active = "B";
    if (initialMode === "actionRuleError") {
      active.phase = "COLOR";
      active.pending = "R1";
      active.regions = { R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: ["B"], color: null, isPending: true } };
    }
    const runtime = {
      waitStartedAt: initialMode === "cpuWait" ? new Date(Date.now() - 91000).toISOString() : new Date().toISOString(),
      room: { id, status: ["finished", "finishedCpu"].includes(initialMode) ? "finished" : initialMode === "publicFind" || setupPending ? "ready" : "playing", version: 9, game_mode: "standard_v5", access_mode: cpuRoomMode ? "cpu" : initialMode === "publicFind" ? "public_queue" : "private_code", opponent_kind: cpuRoomMode ? "cpu" : "human", cpu_character_id: cpuRoomMode ? "yuzu" : null, public_state: ["finished", "finishedCpu"].includes(initialMode) ? finished : initialMode === "publicFind" || setupPending ? null : active },
      view: initialMode === "publicFind" || setupPending ? null : { seat: "A", version: 9, private_state: { hand: { areaDiePlus: 1, areaResize: 1 }, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } },
      profile: initialMode === "empty" ? null : { revision: 1, display_name: "A", profile_state: profileState },
      gachaReceipts: {},
      cardSaleReceipts: {},
      cosmeticReceipts: {},
      quizAnswerReceipts: {},
      quizFinishReceipts: {},
      cpuStartReceipts: {},
      failNextColorAction: false,
      failNextQuizAnswer: false,
      calls: [],
    };
    runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false, appearance: { nameplate: "nameplateDefault", title: "titleNone" } }, { user_id: "44444444-4444-4444-8444-444444444444", seat: "B", display_name: cpuRoomMode ? "うっかりユズ" : "B", is_cpu: cpuRoomMode, appearance: { nameplate: "nameplateGold", title: "titleArtisan" } }];
    const cosmeticProjection = () => ({
      coins: runtime.profile.profile_state.coins,
      equipped: runtime.profile.profile_state.equipped,
      items: [
        { cosmeticId: "boardDefault", name: "標準盤面", type: "board", price: 0, preview: "DEFAULT", previewClass: "", trophyId: null, trophyUnlocked: true, owned: true, equipped: runtime.profile.profile_state.equipped.board === "boardDefault" },
        { cosmeticId: "boardAurora", name: "オーロラ盤面", type: "board", price: 600, preview: "AURORA", previewClass: "aurora", trophyId: null, trophyUnlocked: true, owned: runtime.profile.profile_state.cosmeticsOwned.includes("boardAurora"), equipped: runtime.profile.profile_state.equipped.board === "boardAurora" },
        { cosmeticId: "titleArtisan", name: "四色の匠", type: "title", price: 0, preview: "四色の匠", previewClass: "prism", trophyId: "noSkillFullPaint", trophyUnlocked: true, owned: true, equipped: runtime.profile.profile_state.equipped.title === "titleArtisan" },
      ],
    });
    const functionError = (status, code, privateMessage) => ({ data: null, error: {
      message: privateMessage,
      context: { status, clone: () => ({ json: async () => ({ error: { code, message: privateMessage, stack: "private stack" } }) }) },
    } });
    globalThis.__standardOnlineRuntime = runtime;
    const resultFor = (table) => table === "fcg_rooms" ? runtime.room
      : table === "fcg_room_members" ? runtime.members
        : table === "fcg_player_views" ? runtime.view
          : runtime.profile;
    globalThis.__standardOnlineMockSupabase = {
      auth: { getSession: async () => ({ data: { session: { user: { id: "33333333-3333-4333-8333-333333333333" } } } }), signInAnonymously: async () => { throw new Error("unexpected sign-in"); } },
      functions: { invoke: async (name, request) => {
        runtime.calls.push({ kind: "invoke", name, body: request.body });
        if (request.body.operation === "setup" && initialMode === "setupDebugError") return functionError(403, "DEBUG_MODE_NOT_ALLOWED", "private access_mode row and service secret");
        if (request.body.operation === "setup" && setupTransition) return { data: { setupRevision: 1, profileRevision: 1 } };
        if (request.body.operation === "initialize" && setupTransition) {
          const cpuFirst = initialMode === "setupTransitionCpuFirst";
          const started = { ...active, matchId: `${id}:10`, status: "ACTIVE", version: 10, turn: 1, active: cpuFirst ? "B" : "A", phase: "CREATE_FIRST" };
          runtime.room = { ...runtime.room, status: "playing", version: 10, public_state: started };
          runtime.view = { seat: "A", version: 10, private_state: { hand: { areaDiePlus: 1, areaResize: 1 }, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } };
          return { data: { roomStatus: "playing", roomVersion: 10 } };
        }
        if (request.body.operation === "profile") {
          runtime.profile = { revision: 1, display_name: request.body.displayName, profile_state: request.body.profileState };
          return { data: { revision: 1, displayName: request.body.displayName, profileState: request.body.profileState } };
        }
        if (request.body.operation === "quiz-start") {
          const polishQuestions = [
            { templateId: "speed-distance", category: "速さ", prompt: "時速12kmで8時間進むと何km？", math: { kind: "story" } },
            { templateId: "trapezoid-area", category: "面積", prompt: "上底7、下底14、高さ12の台形の面積は？", math: { kind: "geometry", shape: "trapezoid", dimensions: { top: 7, bottom: 14, height: 12 } } },
            { templateId: "derivative-polynomial", category: "微分", prompt: "y=4x² + 2x のとき、x=6での dy/dx は？", math: { kind: "derivative", function: "4x² + 2x", at: 6, suffix: "= ?" } },
            { templateId: "integral-linear", category: "積分", prompt: "0から5まで 2x を積分した値は？", math: { kind: "integral", lower: 0, upper: 5, body: "2x", variable: "x", suffix: "= ?" } },
            { templateId: "sequence", category: "等差数列", prompt: "初項4、公差2の等差数列の第12項は？", math: { kind: "sequence", first: 4, difference: 2, position: 12, suffix: "= ?" } },
            { templateId: "sigma-linear", category: "数列の和", prompt: "k=1から8までの長い式の総和は？", math: { kind: "sum", index: "k", lower: 1, upper: 8, body: "123456789k² + 987654321k + 123456789", grouped: true, suffix: "= ?" } },
            { templateId: "legacy-story", category: "文章題", prompt: "りんごが12個ずつ8箱あります。全部で何個？", math: { kind: "story", value: "12 × 8 = ?" } },
            { templateId: "legacy-geometry", category: "面積", prompt: "たて5、よこ8の長方形の面積は？", math: { kind: "geometry", label: "長方形", value: "たて 5、よこ 8、S = ?" } },
            { templateId: "legacy-sum", category: "数列の和", prompt: "k=1から5までの和は？", math: { kind: "sum", lower: "k = 1", upper: 5, body: "k", suffix: "= ?" } },
            { templateId: "cone-volume", category: "体積", prompt: "半径3、高さ9の円すいの体積は何π？", math: { kind: "geometry", shape: "cone", dimensions: { radius: 3, height: 9 } } },
          ];
          const sourceQuestions = initialMode === "quizPolish" ? polishQuestions : Array.from({ length: 10 }, (_, index) => ({
            templateId: "add", category: "たし算", prompt: `${index + 1} + 1 = ?`, math: { kind: "expression", value: `${index + 1} + 1 = ?` },
          }));
          const questions = sourceQuestions.map((question, index) => ({
            number: index + 1,
            ...question,
            hintOptions: ["たし算：同じ位どうしを足す", "円の面積：S = πr²", "2次の行列式：det A = ad − bc"],
            hintDurationMs: 2500,
            timeLimitSeconds: 10,
            options: Array.from({ length: 6 }, (_, optionIndex) => ({ id: `q${index + 1}-${optionIndex + 1}`, label: String(index + optionIndex + 2) })),
          }));
          return { data: { sessionId: "66666666-6666-4666-8666-666666666666", duplicate: false, selectedLevel: request.body.selectedLevel, answerMode: "per-question-v1", expiresAt: "2099-01-01T00:00:00.000Z", questions, timeoutAnswerId: "__timeout__" } };
        }
        if (request.body.operation === "quiz-answer") {
          if (runtime.failNextQuizAnswer) {
            runtime.failNextQuizAnswer = false;
            return functionError(503, "SERVER_BUSY", "temporary quiz answer failure with private detail");
          }
          const prior = runtime.quizAnswerReceipts[request.body.actionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const correctOptionId = `q${request.body.questionIndex + 1}-1`;
          const result = {
            questionIndex: request.body.questionIndex,
            answeredCount: request.body.questionIndex + 1,
            duplicate: false,
            isCorrect: request.body.answerId === correctOptionId,
            correctOptionId,
            correctOptionLabel: String(request.body.questionIndex + 2),
            explanation: `${request.body.questionIndex + 1} + 1 = ${request.body.questionIndex + 2}`,
          };
          runtime.quizAnswerReceipts[request.body.actionId] = result;
          return { data: result };
        }
        if (request.body.operation === "quiz-finish") {
          const prior = runtime.quizFinishReceipts[request.body.actionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const correct = request.body.answers.filter((answerId, index) => answerId === `q${index + 1}-1`).length;
          const answerReview = request.body.answers.map((answerId, index) => ({
            questionIndex: index,
            question: { prompt: `${index + 1} + 1 = ?` },
            selectedOptionId: answerId,
            selectedOptionLabel: answerId === "__timeout__" ? "時間切れ" : String(index + Number(answerId.split("-")[1]) + 1),
            correctOptionId: `q${index + 1}-1`,
            correctOptionLabel: String(index + 2),
            isCorrect: answerId === `q${index + 1}-1`,
            explanation: `${index + 1} + 1 = ${index + 2}`,
          }));
          const result = { revision: runtime.profile.revision + 1, duplicate: false, correct, wrong: 10 - correct, bestStreak: correct, reward: { ticketLevel: 1, draws: 1, reason: "参加報酬" }, profileState: runtime.profile.profile_state, answerReview };
          runtime.quizFinishReceipts[request.body.actionId] = result;
          return { data: result };
        }
        if (request.body.operation === "gacha") {
          const prior = runtime.gachaReceipts[request.body.actionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const next = JSON.parse(JSON.stringify(runtime.profile.profile_state));
          next.gachaTickets[String(request.body.ticketLevel)] -= request.body.count;
          next.inventory.colorRandomBorrow = (next.inventory.colorRandomBorrow || 0) + request.body.count;
          runtime.profile = { ...runtime.profile, revision: runtime.profile.revision + 1, profile_state: next };
          const result = { revision: runtime.profile.revision, duplicate: false, draws: Array.from({ length: request.body.count }, () => ({ ticketLevel: 1, rarity: 1, category: "color", skillId: "colorRandomBorrow", displayName: "色拾い・乱" })), profileState: next };
          runtime.gachaReceipts[request.body.actionId] = result;
          return { data: result };
        }
        if (request.body.operation === "card-sale-quote") {
          const owned = runtime.profile.profile_state.inventory[request.body.skillId] || 0;
          return { data: { revision: runtime.profile.revision, quote: {
            skillId: request.body.skillId, count: request.body.count, earnedCoins: request.body.count * 10,
            remaining: owned - request.body.count, requiresConfirmation: request.body.count === owned - 1,
            confirmationReasons: request.body.count === owned - 1 ? ["LAST_SELLABLE_COPY"] : [],
          } } };
        }
        if (request.body.operation === "card-sale") {
          const prior = runtime.cardSaleReceipts[request.body.actionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const next = JSON.parse(JSON.stringify(runtime.profile.profile_state));
          next.inventory[request.body.skillId] -= request.body.count;
          next.coins += request.body.count * 10;
          runtime.profile = { ...runtime.profile, revision: runtime.profile.revision + 1, profile_state: next };
          const result = { revision: runtime.profile.revision, duplicate: false, quote: { earnedCoins: request.body.count * 10 }, profileState: next };
          runtime.cardSaleReceipts[request.body.actionId] = result;
          return { data: result };
        }
        if (request.body.operation === "cosmetic-catalog") return { data: { revision: runtime.profile.revision, cosmetics: cosmeticProjection() } };
        if (request.body.operation === "cosmetic-quote") {
          const purchaseRequired = !runtime.profile.profile_state.cosmeticsOwned.includes(request.body.cosmeticId);
          return { data: { revision: runtime.profile.revision, quote: { cosmeticId: request.body.cosmeticId, name: "オーロラ盤面", type: "board", price: purchaseRequired ? 600 : 0, coinsAfter: runtime.profile.profile_state.coins - (purchaseRequired ? 600 : 0), purchaseRequired } } };
        }
        if (request.body.operation === "cosmetic-action") {
          const prior = runtime.cosmeticReceipts[request.body.actionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const next = JSON.parse(JSON.stringify(runtime.profile.profile_state));
          if (!next.cosmeticsOwned.includes(request.body.cosmeticId)) { next.cosmeticsOwned.push(request.body.cosmeticId); next.coins -= 600; }
          next.equipped.board = request.body.cosmeticId;
          runtime.profile = { ...runtime.profile, revision: runtime.profile.revision + 1, profile_state: next };
          const result = { revision: runtime.profile.revision, duplicate: false, quote: { name: "オーロラ盤面", price: 600 }, profileState: next, cosmetics: cosmeticProjection() };
          runtime.cosmeticReceipts[request.body.actionId] = result;
          return { data: result };
        }
        if (request.body.operation === "cpu-roster") return { data: { rosterVersion: "standard-character-roster-v1", characters: [
          ["yuzu", "うっかりユズ"], ["ren", "せっかちレン"], ["minato", "見習いミナト"], ["koharu", "読み違いコハル"], ["aoi", "慎重派アオイ"],
          ["kai", "勝負師カイ"], ["tsubasa", "仕掛け屋ツバサ"], ["shion", "観察役シオン"], ["rei", "カード博士レイ"], ["kurogane", "四色のクロガネ"],
        ].map(([cpuId, name]) => ({ id: cpuId, name, line: "よろしく！", strength: "得意な一手", weakness: "うっかり", favorites: ["colorRandomBorrow", "areaMicroBloom"] })) } };
        if (request.body.operation === "cpu-start") {
          const prior = runtime.cpuStartReceipts[request.body.actionId];
          if (prior) return { data: { ...prior, duplicate: true, startStatus: "duplicate" } };
          runtime.room = { ...runtime.room, status: "ready", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: request.body.characterId, public_state: null };
          runtime.view = null;
          runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
          const result = { matchmakingStatus: "matched", startStatus: "created", roomId: id, seat: "A", opponentKind: "cpu", characterId: request.body.characterId, duplicate: false };
          runtime.cpuStartReceipts[request.body.actionId] = result;
          return { data: result };
        }
        if (request.body.operation === "cpu-accept") {
          runtime.room = { ...runtime.room, status: "ready", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: request.body.characterId, public_state: null };
          runtime.view = null;
          runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
          return { data: { matchmakingStatus: "matched", roomId: id, seat: "A", characterId: request.body.characterId, duplicate: false } };
        }
        if (request.body.operation === "cpu-action") {
          if (initialMode === "setupTransitionCpuFirst") return { error: new Error("CPU_NOT_ACTIVE") };
          runtime.room = { ...runtime.room, version: runtime.room.version + 1, public_state: { ...runtime.room.public_state, version: runtime.room.version + 1, active: "A" } };
          runtime.view = { ...runtime.view, version: runtime.room.version };
          return { data: { duplicate: false, room: runtime.room } };
        }
        if (request.body.operation === "cpu-rematch") {
          runtime.room = { ...runtime.room, status: "ready", version: runtime.room.version + 1, public_state: {} };
          runtime.view = null;
          return { data: { roomStatus: "ready", roomVersion: runtime.room.version, readyToSetup: true, duplicate: false } };
        }
        if (request.body.operation === "action" && request.body.action?.type === "COLOR_REGION" && runtime.failNextColorAction) {
          runtime.failNextColorAction = false;
          return { error: new Error("simulated color network failure") };
        }
        if (request.body.operation === "action" && initialMode === "actionRuleError") return functionError(400, "ILLEGAL_COLOR", "private authoritative_state and service secret");
        if (request.body.operation === "action" && initialMode === "handoffGuide" && request.body.action?.type === "CREATE_REGION") {
          const sourceMacros = request.body.action.payload.sourceMacros;
          const nextVersion = runtime.room.version + 1;
          runtime.room = { ...runtime.room, version: nextVersion, public_state: {
            ...runtime.room.public_state, version: nextVersion, turn: runtime.room.public_state.turn + 1,
            active: "B", phase: "COLOR", pending: "R1",
            regions: { R1: { id: "R1", micro: [...sourceMacros], sourceMacros: [...sourceMacros], controllers: ["A"], color: null, isPending: true } },
          } };
          runtime.view = { ...runtime.view, version: nextVersion };
          return { data: { duplicate: false, room: runtime.room } };
        }
        if (request.body.operation === "action" && initialMode === "cpuWin") {
          const next = JSON.parse(JSON.stringify(runtime.profile.profile_state));
          next.gachaTickets["1"] += 1;
          next.cpuStats.wins += 1;
          next.cpuStats.currentWinStreak += 1;
          next.cpuStats.bestWinStreak = Math.max(next.cpuStats.bestWinStreak, next.cpuStats.currentWinStreak);
          next.cpuCharacterStats.yuzu = { matches: 1, wins: 1, losses: 0, firstWinAt: "2026-09-05T00:00:00.000Z" };
          next.matchHistory.unshift({ matchId: `${id}:9`, result: "WIN", terminalReason: "BOARD_LOCK", endedAt: "2026-09-05T00:00:00.000Z", fullPaint: true, skillsUsed: 0, onlineOpponentKind: "cpu", cpuCharacterId: "yuzu" });
          runtime.profile = { ...runtime.profile, revision: runtime.profile.revision + 1, profile_state: next };
          runtime.room = { ...runtime.room, status: "finished", version: runtime.room.version + 1, winner_seat: "A", public_state: { ...runtime.room.public_state, status: "FINISHED", phase: "GAME_OVER", version: runtime.room.version + 1, winner: "A", terminalReason: "BOARD_LOCK" } };
          runtime.view = { ...runtime.view, version: runtime.room.version };
          return { data: { duplicate: false, room: runtime.room } };
        }
        return { data: { ok: true } };
      } },
      rpc: async (name, args) => {
        runtime.calls.push({ kind: "rpc", name, args });
        if (name === "fcg_standard_matchmaking_recruit") {
          runtime.ticketId = args.p_ticket_id;
          return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "searching", room_id: null, seat: null, wait_started_at: runtime.waitStartedAt, server_time: new Date().toISOString() }] };
        }
        if (name === "fcg_standard_matchmaking_status") return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "searching", room_id: null, seat: null, wait_started_at: runtime.waitStartedAt, server_time: new Date().toISOString() }] };
        if (name === "fcg_standard_matchmaking_cancel") return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "cancelled", room_id: null, seat: null, server_time: new Date().toISOString() }] };
        if (name === "fcg_standard_matchmaking_find") return { data: [{ matchmaking_status: initialMode === "publicFind" ? "matched" : "none_available", room_id: initialMode === "publicFind" ? id : null, seat: initialMode === "publicFind" ? "B" : null, server_time: new Date().toISOString(), duplicate: false }] };
        if (name === "fcg_standard_room_snapshot_v2") return { data: [{
          snapshot_schema_version: 2,
          snapshot_version: runtime.room.version,
          profile_revision: runtime.profile.revision,
          server_time: new Date().toISOString(),
          room: runtime.room,
          members: resultFor("fcg_room_members"),
          view: runtime.view,
          profile: Number(args.p_known_profile_revision) === Number(runtime.profile.revision) ? null : runtime.profile,
        }] };
        if (name !== "fcg_standard_request_rematch") return { error: new Error(`unexpected rpc ${name}`) };
        runtime.room = { ...runtime.room, status: "ready", version: 10, public_state: null };
        runtime.view = null;
        return { data: [{ room_status: "ready", room_version: 10, ready_to_setup: true, duplicate: false }] };
      },
      channel: () => {
        const channel = {
          on: (_event, _filter, onInvalidate) => {
            runtime.onInvalidate = onInvalidate;
            return channel;
          },
          subscribe: (onStatus) => {
            queueMicrotask(() => onStatus("SUBSCRIBED"));
            return channel;
          },
        };
        return channel;
      },
      removeChannel: async () => ({ error: null }),
      from: (table) => ({ select: () => {
        const chain = { eq: () => chain, order: async () => ({ data: resultFor(table) }), single: async () => ({ data: resultFor(table) }), maybeSingle: async () => ({ data: resultFor(table) }) };
        return chain;
      } }),
    };
  }, { connectionKey, saveKey, roomId, pendingId: pendingRematchId, mode });
}

async function withPage(mode, run, { bodyTimeout = 35_000, viewport = { width: 900, height: 800 } } = {}) {
  assert.ok(chromium, "Playwright is required");
  assert.ok(fs.existsSync(browserPath), `${browserName} browser is required`);
  let browser;
  let context;
  browserStage("server-start");
  const { server, url } = await bounded("server-ready", startServer(), 5_000);
  browserStage("server-ready");
  try {
    browserStage("browser-launch-start");
    browser = await bounded("browser-launch", chromium.launch({ executablePath: browserPath, headless: true, timeout: 15_000 }), 15_000);
    browserStage("browser-launch-ready");
    browserStage("context-start");
    context = await bounded("context-ready", browser.newContext({ viewport }), 5_000);
    browserStage("context-ready");
    await bounded("mock-ready", installMock(context, mode), 5_000);
    browserStage("page-start");
    const page = await bounded("page-ready", context.newPage(), 5_000);
    browserStage("page-ready");
    browserStage("navigation-start");
    await bounded("navigation-ready", page.goto(`${url}/standard-online-v5/index.html`, { timeout: 20_000 }), 20_000);
    browserStage("navigation-ready");
    browserStage("badge-start");
    await bounded("badge-ready", page.locator("#connectionBadge.good").waitFor({ state: "visible", timeout: 10_000 }), 10_000);
    browserStage("badge-ready");
    if (RESTORED_ROOM_MODES.has(mode)) {
      browserStage("room-ready-start");
      await bounded("room-ready", page.locator("#room:not(.hidden)").waitFor({ timeout: 15_000 }), 15_000);
      browserStage("room-ready");
    }
    browserStage("test-body-start");
    await bounded("test-body", run(page), bodyTimeout);
    browserStage("test-body-ready");
  } finally {
    browserStage("teardown-start");
    try {
      browserStage("context-close-start");
      if (context) await bounded("context-close", context.close(), 10_000);
      browserStage("context-close-ready");
    } finally {
      try {
        browserStage("browser-close-start");
        if (browser) await bounded("browser-close", browser.close(), 20_000);
        browserStage("browser-close-ready");
      } finally {
        browserStage("server-close-start");
        await bounded("server-close", closeServer(server), 3_000);
        browserStage("server-close-ready");
      }
    }
    browserStage("teardown-ready");
  }
}

test("actual Edge carries a fresh player from the home CPU CTA through profile sync to ten explicit choices", { timeout: 130000 }, async () => {
  await withPage("empty", async (page) => {
    await page.locator("#starterCreator:not(.hidden)").waitFor();
    assert.equal(await page.locator("#profileSelect option").count(), 0);
    assert.equal(await page.locator("#syncProfile").isDisabled(), true);
    await page.getByRole("button", { name: "CPUとすぐStandard対戦" }).click();
    await page.locator("#starterName").waitFor({ state: "visible" });
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "battle");
    assert.equal(await page.locator("#profileCard").isVisible(), true);
    assert.equal(await page.locator("#lobby").isVisible(), false);
    await page.locator("#starterName").fill("新規プレイヤー");
    await page.getByRole("button", { name: "この名前で対戦準備へ" }).click();
    assert.equal(await page.locator("#profileSelect option").count(), 1);
    assert.equal(await page.locator('#loadoutGrid input[type="checkbox"]:checked').count(), 6);
    const evidence = await page.evaluate(({ save, starter }) => {
      const profile = JSON.parse(localStorage.getItem(starter));
      return { localSave: localStorage.getItem(save), name: profile.displayName, inventory: profile.inventory };
    }, { save: saveKey, starter: "fourColorMapGame.standard.online.v5.starter-profile" });
    assert.equal(evidence.localSave, null);
    assert.equal(evidence.name, "新規プレイヤー");
    assert.deepEqual(Object.values(evidence.inventory), [3, 3, 3, 3, 3, 3]);
    await page.locator("#lobby").waitFor({ state: "visible" });
    assert.equal(await page.locator("#profileCard").isVisible(), false);
    await page.locator("#cpuRosterDialog[open]").waitFor();
    assert.equal(await page.locator("#cpuRosterGrid .cpu-character-card").count(), 10);
    const profileCalls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "profile").map((entry) => entry.body));
    assert.equal(profileCalls.length, 1);
    const profileCall = profileCalls[0];
    assert.equal(profileCall.expectedRevision, 0);
    assert.equal(profileCall.displayName, "新規プレイヤー");
    const automaticMatchCalls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => (
      ["cpu-start", "cpu-accept"].includes(entry.body?.operation)
      || ["fcg_standard_create_room", "fcg_standard_join_room", "fcg_standard_matchmaking_recruit", "fcg_standard_matchmaking_find"].includes(entry.name)
    )));
    assert.deepEqual(automaticMatchCalls, []);
  });
});

test("actual Edge starts formal Standard CPU immediately without entering public matchmaking", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    const trigger = page.getByRole("button", { name: "10人からCPUを選ぶ" });
    await trigger.click();
    await page.locator("#cpuRosterDialog[open]").waitFor();
    assert.equal(await page.locator("#cpuRosterTitle").textContent(), "Standard CPU対戦 — 相手を選ぶ");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "cpuRosterTitle");
    assert.equal(await page.locator("#cpuRosterGrid .cpu-character-card").count(), 10);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "startStandardCpuLobby");
    await trigger.click();
    await page.getByRole("button", { name: "うっかりユズと対戦" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    assert.equal(await page.locator("#shownCode").textContent(), "CPU：うっかりユズ");
    const evidence = await page.evaluate(({ key }) => ({
      bodies: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.kind === "invoke").map((entry) => entry.body),
      publicCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => String(entry.name || "").includes("matchmaking")),
      connection: JSON.parse(localStorage.getItem(key)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }), { key: connectionKey });
    assert.deepEqual(evidence.bodies.slice(-2).map((body) => body.operation), ["cpu-roster", "cpu-start"]);
    assert.match(evidence.bodies.at(-1).actionId, /^[0-9a-f-]{36}$/i);
    assert.deepEqual({ ...evidence.bodies.at(-1), actionId: "<uuid>" }, { operation: "cpu-start", actionId: "<uuid>", characterId: "yuzu", confirmed: true });
    assert.deepEqual(evidence.publicCalls, []);
    assert.equal(evidence.connection.cpuStartActionId, null);
    assert.equal(evidence.connection.cpuStartCharacterId, null);
    assert.equal(evidence.overflow, false);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge resumes a lost immediate CPU response with the same stored action", { timeout: 130000 }, async () => {
  await withPage("cpuRetry", async (page) => {
    await page.locator("#setupCard:not(.hidden)").waitFor();
    const evidence = await page.evaluate(({ key }) => ({
      starts: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start").map((entry) => entry.body),
      connection: JSON.parse(localStorage.getItem(key)),
    }), { key: connectionKey });
    assert.deepEqual(evidence.starts, [{ operation: "cpu-start", actionId: pendingRematchId, characterId: "yuzu", confirmed: true }]);
    assert.equal(evidence.connection.roomId, roomId);
    assert.equal(evidence.connection.cpuStartActionId, null);
    assert.equal(evidence.connection.cpuStartCharacterId, null);
  });
});

test("actual Edge keeps the first-time setup write-free when the name is empty", { timeout: 130000 }, async () => {
  await withPage("empty", async (page) => {
    await page.getByRole("button", { name: "CPUとすぐStandard対戦" }).click();
    await page.getByRole("button", { name: "この名前で対戦準備へ" }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("fourColorMapGame.standard.online.v5.starter-profile")), null);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "profile").length), 0);
    assert.equal(await page.locator("#lobby").isVisible(), false);
    await page.getByText("名前を入力してください。").waitFor();
  });
});

test("actual Edge keeps one connection status visible across tabs and reflects offline lobby state", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    const badgeNode = page.locator("#connectionBadge");
    const messageNode = page.locator("#connectionMessage");
    assert.equal(await badgeNode.count(), 1);
    for (const [label, tab] of [["ホーム", "home"], ["対戦", "battle"], ["クイズ・ガチャ", "quiz"], ["カード", "cards"], ["マイページ", "profile"]]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await badgeNode.waitFor({ state: "visible" });
      assert.equal(await page.locator("body").getAttribute("data-active-tab"), tab);
      assert.equal(await badgeNode.count(), 1);
      assert.equal(await messageNode.isVisible(), tab === "home");
      assert.equal(await page.locator(".connection-card").evaluate((node) => getComputedStyle(node).position), tab === "home" ? "static" : "fixed");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "対戦", exact: true }).click();
    const mobileLayout = await page.evaluate(() => {
      const status = document.querySelector(".connection-card").getBoundingClientRect();
      const navigation = document.querySelector(".app-tabs").getBoundingClientRect();
      const hit = document.elementFromPoint(navigation.left + navigation.width / 2, navigation.top + navigation.height / 2);
      return {
        status: { top: status.top, right: status.right, bottom: status.bottom, left: status.left },
        navigationTop: navigation.top,
        hitInsideNavigation: Boolean(hit?.closest?.(".app-tabs")),
      };
    });
    assert.ok(mobileLayout.status.top >= 0 && mobileLayout.status.left >= 0 && mobileLayout.status.right <= 390);
    assert.ok(mobileLayout.status.bottom <= mobileLayout.navigationTop - 4);
    assert.equal(mobileLayout.hitInsideNavigation, true);
    const storedBefore = await page.evaluate(({ key }) => localStorage.getItem(key), { key: connectionKey });
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.getByText("オフライン（復帰待ち）", { exact: true }).waitFor();
    assert.equal(await badgeNode.isVisible(), true);
    assert.equal(await page.evaluate(({ key }) => localStorage.getItem(key), { key: connectionKey }), storedBefore);
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.locator("#connectionBadge.good").waitFor({ state: "visible" });
  });
});

test("actual Edge reuses a persisted rematch ID and returns to fresh setup", { timeout: 130000 }, async () => {
  await withPage("finished", async (page) => {
    const terminal = page.locator("#terminalOverlay");
    await terminal.waitFor();
    await page.reload();
    await page.locator("#connectionBadge.good").waitFor({ state: "visible" });
    await page.locator("#room:not(.hidden)").waitFor();
    assert.equal(await terminal.isVisible(), false);
    await page.getByRole("button", { name: "同じ再戦申請を再送" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    const evidence = await page.evaluate(({ key, expectedId }) => {
      const stored = JSON.parse(localStorage.getItem(key));
      const call = globalThis.__standardOnlineRuntime.calls.find((entry) => entry.name === "fcg_standard_request_rematch");
      return { stored, actionId: call.args.p_action_id, status: globalThis.__standardOnlineRuntime.room.status };
    }, { key: connectionKey, expectedId: pendingRematchId });
    assert.equal(evidence.actionId, pendingRematchId);
    assert.equal(evidence.status, "ready");
    assert.equal(evidence.stored.setupRevision, 0);
    assert.equal(evidence.stored.rematchActionId, null);
  });
});

test("actual Edge celebrates an opponent surrender and presents defeat from the local seat", { timeout: 130000 }, async () => {
  await withPage("finished", async (page) => {
    const overlay = page.locator("#terminalOverlay");
    await overlay.waitFor();
    await page.getByRole("heading", { name: "勝利！" }).waitFor();
    assert.equal(await page.locator("#terminalEyebrow").textContent(), "相手が投了しました");
    assert.equal(await page.locator("#terminalMessage").textContent(), "A の勝利です！");
    assert.equal(await page.locator("#terminalReasonText").textContent(), "B が投了しました。");
    assert.equal(await overlay.evaluate((node) => node.classList.contains("is-victory")), true);
    assert.equal(await page.locator("#terminalClose").evaluate((node) => node === document.activeElement), true);

    await page.getByRole("button", { name: "結果を確認して戻る" }).click();
    assert.equal(await page.locator("#chooseDifferentCpu").isVisible(), false);
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      runtime.room = {
        ...runtime.room,
        version: 10,
        public_state: { ...runtime.room.public_state, version: 10, winner: "B", terminalReason: "SURRENDER" },
      };
      runtime.onInvalidate();
    });
    await page.getByRole("heading", { name: "敗北" }).waitFor({ timeout: 5000 });
    assert.equal(await page.locator("#terminalMessage").textContent(), "B の勝利です");
    assert.equal(await page.locator("#terminalReasonText").textContent(), "A が投了しました。");
    assert.equal(await overlay.evaluate((node) => node.classList.contains("is-defeat")), true);
  });
});

test("actual Edge routes immediate skills and keeps target cancellation write-free", { timeout: 130000 }, async () => {
  await withPage("playing", async (page) => {
    await page.getByRole("button", { name: "エリア拡張 ×1" }).click();
    await page.getByText("操作を保存しました。").waitFor();
    await page.getByRole("button", { name: "拡大縮小 ×1" }).click();
    await page.getByRole("button", { name: "キャンセル" }).click();
    const calls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").map((entry) => entry.body));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].operation, "action");
    assert.deepEqual(calls[0].action.payload, { skill: "areaDiePlus" });
    assert.equal(await page.locator("#skillTargetControls").evaluate((node) => node.classList.contains("hidden")), true);
  });
});

test("actual Edge gacha persists one server draw and immediately hydrates inventory", { timeout: 130000 }, async () => {
  await withPage("gacha", async (page) => {
    await page.locator("#gachaPanel:not(.hidden)").waitFor();
    await page.getByRole("button", { name: "1枚引く" }).click();
    await page.getByText("1枚を獲得しました。券消費とカード付与は一度だけ保存済みです。").waitFor();
    const evidence = await page.evaluate(({ key }) => {
      const call = globalThis.__standardOnlineRuntime.calls.find((entry) => entry.body?.operation === "gacha");
      return { call: call.body, profile: JSON.parse(localStorage.getItem(key)) };
    }, { key: remoteProfileKey });
    assert.match(evidence.call.actionId, /^[0-9a-f-]{36}$/i);
    assert.equal(evidence.call.expectedRevision, 1);
    assert.equal(evidence.call.ticketLevel, 1);
    assert.equal(evidence.call.count, 1);
    assert.equal(evidence.profile.gachaTickets["1"], 1);
    assert.equal(evidence.profile.inventory.colorRandomBorrow, 3);
    assert.equal(await page.locator("#gachaResults .gacha-card").count(), 1);
  });
});

test("actual Edge quiz freezes for the hint, resumes without room polling, and advances once", { timeout: 130000 }, async () => {
  await withPage("quiz", async (page) => {
    await page.getByRole("button", { name: "クイズ・ガチャ" }).click();
    await page.locator("#quizPanel").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "10問チャレンジ開始" }).click();
    await page.locator("#quizOptions button").first().waitFor();
    assert.equal(await page.locator("#quizOptions button").count(), 6);
    assert.equal(await page.locator("#quizQuestion math").count(), 1);

    await page.getByRole("button", { name: "ヒントを見る" }).click();
    await page.locator("#quizHintText").waitFor({ state: "visible" });
    const frozenAt = await page.locator("#quizTimeBar").evaluate((node) => Number.parseFloat(node.style.width));
    await page.waitForTimeout(900);
    const stillFrozenAt = await page.locator("#quizTimeBar").evaluate((node) => Number.parseFloat(node.style.width));
    assert.ok(Math.abs(stillFrozenAt - frozenAt) < 0.2, `hint timer moved from ${frozenAt} to ${stillFrozenAt}`);
    assert.equal(await page.locator("#quizOptions button").first().isDisabled(), true);

    await page.locator("#quizHintText").waitFor({ state: "hidden", timeout: 4500 });
    assert.equal(await page.locator("#quizOptions button").first().isEnabled(), true);
    await page.waitForTimeout(600);
    const resumedAt = await page.locator("#quizTimeBar").evaluate((node) => Number.parseFloat(node.style.width));
    assert.ok(resumedAt < stillFrozenAt - 2, `timer did not resume: ${stillFrozenAt} to ${resumedAt}`);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("2 / 10", { exact: true }).waitFor();
    const startCall = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.find((entry) => entry.body?.operation === "quiz-start")?.body);
    assert.equal(startCall.selectedLevel, 1);
  });
});

test("per-question quiz feedback commits before advancing, retries the same answer, and keeps only brief motion", { timeout: 130000 }, async () => {
  await withPage("quiz", async (page) => {
    await page.getByRole("button", { name: "クイズ・ガチャ" }).click();
    await page.getByRole("button", { name: "10問チャレンジ開始" }).click();
    await page.locator("#quizOptions button").first().waitFor();
    await page.evaluate(() => { globalThis.__standardOnlineRuntime.failNextQuizAnswer = true; });
    await page.locator("#quizOptions button").first().click();
    await page.getByText("回答を保存できませんでした。同じ回答で安全に再送できます。", { exact: true }).waitFor();
    assert.equal(await page.locator("#quizProgress").textContent(), "1 / 10");
    const pendingBeforeRetry = await page.evaluate(() => JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.pending-quiz"))?.pendingAnswer);
    assert.match(pendingBeforeRetry.actionId, /^[0-9a-f-]{36}$/i);

    await page.getByRole("button", { name: "同じ回答を再送" }).click();
    await page.getByText("2 / 10", { exact: true }).waitFor();
    const feedback = page.locator("#quizAnswerFeedback");
    assert.equal(await feedback.textContent(), "前問 Q1：○ 正解！");
    assert.equal(await feedback.isVisible(), true);
    const answerCalls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").map((entry) => entry.body));
    assert.equal(answerCalls.length, 2);
    assert.equal(answerCalls[0].actionId, pendingBeforeRetry.actionId);
    assert.equal(answerCalls[1].actionId, pendingBeforeRetry.actionId);
    assert.equal(answerCalls[0].answerId, answerCalls[1].answerId);
    await page.waitForTimeout(700);
    assert.equal(await feedback.evaluate((node) => node.classList.contains("emphasize")), false);
    assert.equal(await feedback.textContent(), "前問 Q1：○ 正解！");

    await page.locator("#quizOptions button").nth(1).click();
    await page.getByText("3 / 10", { exact: true }).waitFor();
    assert.equal(await feedback.textContent(), "前問 Q2：× 不正解　正解：3");
    await page.getByRole("button", { name: "カード" }).click();
    await page.getByRole("button", { name: "クイズ・ガチャ" }).click();
    assert.equal(await feedback.textContent(), "前問 Q2：× 不正解　正解：3");

    for (let questionNumber = 3; questionNumber <= 10; questionNumber += 1) {
      await page.locator("#quizOptions button").first().click();
      if (questionNumber < 10) await page.getByText(`${questionNumber + 1} / 10`, { exact: true }).waitFor();
    }
    await page.getByText("9問正解！ Lv.1ガチャ券を1枚獲得（参加報酬）", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "ガチャへ" }).isVisible(), true);
    await page.getByText("今回の答え合わせ", { exact: true }).click();
    assert.equal(await page.locator("#quizReviewList .quiz-review-item").count(), 10);
    assert.match(await page.locator("#quizReviewList .quiz-review-item").nth(1).textContent(), /あなた：4.*正解：3.*×/);
    assert.equal(await page.evaluate(() => localStorage.getItem("fourColorMapGame.standard.online.v5.pending-quiz")), null);
  });
});

test("actual Edge presents prompt-only stories, dimension diagrams, structured math, and overflow-only scrolling at 390px", { timeout: 150000 }, async () => {
  await withPage("quizPolish", async (page) => {
    await page.evaluate(() => {
      const NativeResizeObserver = globalThis.ResizeObserver;
      globalThis.__quizObserverStats = { created: 0, disconnected: 0 };
      globalThis.ResizeObserver = class extends NativeResizeObserver {
        constructor(callback) {
          super(callback);
          globalThis.__quizObserverStats.created += 1;
        }
        disconnect() {
          globalThis.__quizObserverStats.disconnected += 1;
          return super.disconnect();
        }
      };
    });
    await page.getByRole("button", { name: "10問チャレンジ開始" }).click();
    await page.locator("#quizOptions button").first().waitFor();

    const question = page.locator("#quizQuestion");
    assert.equal(await question.locator("math").count(), 0);
    assert.equal(await question.locator(".quiz-visible-prompt").textContent(), "時速12kmで8時間進むと何km？");
    assert.doesNotMatch(await question.textContent(), /12\s*[×÷+]\s*8|=\s*\?/);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("2 / 10", { exact: true }).waitFor();
    const diagram = question.locator(".quiz-geometry svg");
    assert.equal(await diagram.getAttribute("role"), "img");
    assert.deepEqual(await diagram.locator("text").allTextContents(), ["上底 7", "下底 14", "高さ 12"]);
    assert.doesNotMatch(await diagram.textContent(), /[=×÷?]|面積|S|V/);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("3 / 10", { exact: true }).waitFor();
    assert.equal(await question.locator("math mfrac").count(), 1);
    assert.equal(await question.locator("math msub").count(), 1);
    assert.match((await question.locator("math").textContent()).replace(/\s+/g, ""), /^y=4x²\+2x,dydx\|x=6=\?$/);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("4 / 10", { exact: true }).waitFor();
    assert.ok((await page.evaluate(() => globalThis.__quizObserverStats.disconnected)) >= 1);
    assert.equal(await question.locator("math msubsup").count(), 1);
    assert.match((await question.locator("math").textContent()).replace(/\s+/g, ""), /^∫052xdx=\?$/);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("5 / 10", { exact: true }).waitFor();
    assert.equal(await question.locator("math msub").count(), 2);
    assert.equal(await question.locator("math msub").last().textContent(), "a12");
    assert.equal(await question.locator(".quiz-overflow-scrollbar").isHidden(), true);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("6 / 10", { exact: true }).waitFor();
    const viewport = question.locator(".quiz-math-scroll");
    const scrollbar = question.locator(".quiz-overflow-scrollbar");
    await page.waitForFunction(() => !document.querySelector("#quizQuestion .quiz-overflow-scrollbar")?.hidden);
    const before = await viewport.evaluate((node) => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, scrollLeft: node.scrollLeft, tabIndex: node.tabIndex }));
    assert.ok(before.scrollWidth > before.clientWidth, JSON.stringify(before));
    assert.equal(before.scrollLeft, 0);
    assert.equal(before.tabIndex, 0);
    assert.equal(await scrollbar.isVisible(), true);
    await viewport.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    await page.waitForFunction(() => {
      const node = document.querySelector("#quizQuestion .quiz-math-scroll");
      return node && node.scrollLeft > 0;
    });
    assert.equal(await scrollbar.isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("7 / 10", { exact: true }).waitFor();
    assert.equal(await question.locator("math").count(), 0);
    assert.equal(await question.locator(".quiz-visible-prompt").textContent(), "りんごが12個ずつ8箱あります。全部で何個？");
    assert.doesNotMatch(await question.textContent(), /12\s*×\s*8/);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("8 / 10", { exact: true }).waitFor();
    assert.match((await question.textContent()).replace(/\s+/g, " "), /面積.*たて 5、よこ 8、S = \?/);

    await page.locator("#quizOptions button").first().click();
    await page.getByText("9 / 10", { exact: true }).waitFor();
    assert.equal(await question.locator("math munderover").count(), 1);
    assert.match((await question.locator("math").textContent()).replace(/\s+/g, ""), /^∑k=15k=\?$/);
  }, { bodyTimeout: 60_000, viewport: { width: 390, height: 844 } });
});

test("actual Edge presents server-hydrated stats, trophy state, and match history", { timeout: 130000 }, async () => {
  await withPage("playing", async (page) => {
    await page.getByRole("button", { name: "マイページ" }).click();
    await page.locator("#progressionPanel:not(.hidden)").waitFor();
    assert.deepEqual(await page.locator("#profileStats strong").allTextContents(), ["4", "2", "2", "3", "1"]);
    assert.equal(await page.locator("#trophyList .unlocked").count(), 2);
    assert.equal(await page.locator("#trophyList .locked").count(), 1);
    assert.match(await page.locator("#matchHistory .history-win").textContent(), /勝利.*完塗り.*スキル0回/);
  });
});

test("actual Edge hides onboarding after restoring a synced profile into the saved battle tab", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "battle");
    assert.equal(await page.locator("#profileCard").isVisible(), false);
    assert.equal(await page.locator("#lobby").isVisible(), true);
  });
});

test("actual Edge quotes and commits one server-authoritative card sale", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    await page.getByRole("button", { name: "カード" }).click();
    await page.locator("#cardLibraryPanel:not(.hidden)").waitFor();
    await page.locator("#cardSaleSkill").selectOption("colorRandomBorrow");
    await page.locator("#cardSaleCount").fill("1");
    await page.getByRole("button", { name: "売却内容を確認" }).click();
    await page.getByText(/1枚 → 10コイン/).waitFor();
    await page.getByRole("button", { name: "この内容で売る" }).click();
    await page.getByText("10コインを獲得しました。カード減算とコイン加算は一度だけ保存済みです。").waitFor();
    const evidence = await page.evaluate(({ key }) => ({
      calls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation?.startsWith("card-sale")).map((entry) => entry.body),
      profile: JSON.parse(localStorage.getItem(key)),
    }), { key: remoteProfileKey });
    assert.equal(evidence.calls.length, 2);
    assert.equal(evidence.calls[1].confirmed, true);
    assert.match(evidence.calls[1].actionId, /^[0-9a-f-]{36}$/i);
    assert.equal(evidence.profile.inventory.colorRandomBorrow, 1);
    assert.equal(evidence.profile.coins, 10);
  });
});

test("actual Edge confirms, persists, restores, and safely cancels online appearance", { timeout: 130000 }, async () => {
  await withPage("cosmetic", async (page) => {
    await page.locator("#cosmeticPanel:not(.hidden)").waitFor();
    const aurora = page.locator("#cosmeticCatalog .collection-card", { hasText: "オーロラ盤面" });
    await aurora.getByRole("button", { name: "購入して装備" }).click();
    await page.getByText(/600コインで購入して装備/).waitFor();
    const pendingBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.pending-cosmetic")));
    assert.match(pendingBefore.actionId, /^[0-9a-f-]{36}$/i);
    assert.equal(pendingBefore.expectedRevision, 1);
    assert.equal((await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cosmetic-action").length)), 0);
    await page.getByRole("button", { name: "この内容で保存" }).click();
    await page.getByText(/オーロラ盤面を一度だけ保存/).waitFor();
    assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("skin-board-aurora")), true);
    assert.match(await page.locator("#board").evaluate((node) => getComputedStyle(node).outlineColor), /rgb\(34, 211, 238\)/);
    const saved = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key)), { key: remoteProfileKey });
    assert.equal(saved.coins, 400);
    assert.equal(saved.equipped.board, "boardAurora");
    assert.equal(await page.evaluate(() => localStorage.getItem("fourColorMapGame.standard.online.v5.pending-cosmetic")), null);

    const title = page.locator("#cosmeticCatalog .collection-card", { hasText: "四色の匠" });
    await title.getByRole("button", { name: "装備する" }).click();
    await page.getByRole("button", { name: "キャンセル" }).click();
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cosmetic-action").length), 1);
    await page.reload();
    await page.locator("#cosmeticPanel:not(.hidden)").waitFor();
    assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("skin-board-aurora")), true);
  });
});

test("actual Edge recruits and cancels with one persisted public matchmaking ticket", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    await page.getByRole("button", { name: "対戦相手を募集" }).click();
    await page.locator("#matchmakingWait:not(.hidden)").waitFor();
    const beforeCancel = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key)), { key: connectionKey });
    assert.match(beforeCancel.matchmakingTicketId, /^[0-9a-f-]{36}$/i);
    assert.equal(await page.getByRole("button", { name: "今入れる試合を探す" }).isDisabled(), true);
    await page.getByRole("button", { name: "募集を取り消す" }).click();
    await page.getByText("募集を取り消しました。").waitFor();
    const afterCancel = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key)), { key: connectionKey });
    assert.equal(afterCancel.matchmakingTicketId, null);
  });
});

test("actual Edge offers ten explicit CPU choices after 90 seconds and labels the accepted room", { timeout: 130000 }, async () => {
  await withPage("cpuWait", async (page) => {
    await page.locator("#cpuOpponentOffer:not(.hidden)").waitFor();
    assert.match(await page.locator("#cpuOfferMessage").textContent(), /90秒/);
    await page.getByRole("button", { name: "CPUを選ぶ", exact: true }).click();
    await page.locator("#cpuRosterDialog[open]").waitFor();
    assert.equal(await page.locator("#cpuRosterGrid .cpu-character-card").count(), 10);
    await page.getByRole("button", { name: "うっかりユズと対戦" }).click();
    await page.locator("#room:not(.hidden)").waitFor();
    assert.equal(await page.locator("#roomIdentityLabel").textContent(), "対戦相手");
    assert.equal(await page.locator("#shownCode").textContent(), "CPU：うっかりユズ");
    assert.match(await page.locator("#members").textContent(), /うっかりユズ（CPU）/);
    const bodies = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.kind === "invoke").map((entry) => entry.body));
    assert.deepEqual(bodies.slice(-2).map((body) => body.operation), ["cpu-roster", "cpu-accept"]);
    assert.deepEqual(bodies.at(-1), { operation: "cpu-accept", ticketId: pendingRematchId, characterId: "yuzu" });
  });
});

test("actual Edge asks the server for exactly one CPU action then returns control to the human", { timeout: 150000 }, async () => {
  await withPage("cpuTurn", async (page) => {
    await page.waitForFunction(() => globalThis.__standardOnlineRuntime.calls.some((entry) => entry.body?.operation === "cpu-action"), null, { timeout: 45000 });
    await page.getByText("あなたの手番").waitFor();
    const actions = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-action").map((entry) => entry.body));
    assert.deepEqual(actions, [{ operation: "cpu-action", roomId, expectedVersion: 9 }]);
  }, { bodyTimeout: 50_000 });
});

test("actual Edge hydrates a CPU win once, shows its counter, and keeps it after reload", { timeout: 150000 }, async () => {
  await withPage("cpuWin", async (page) => {
    await page.locator("#board").click({ position: { x: 50, y: 50 } });
    await page.getByRole("button", { name: "このエリアを渡す" }).click();
    await page.getByText("戦績を保存しました：CPU戦 勝利 1\n完了報酬：Lv.1ガチャ券 +1").waitFor();
    const first = await page.evaluate(({ key }) => ({
      profile: JSON.parse(localStorage.getItem(key)),
      actionCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length,
    }), { key: remoteProfileKey });
    assert.equal(first.profile.stats.wins, 4);
    assert.equal(first.profile.cpuStats.wins, 1);
    assert.equal(first.profile.cpuCharacterStats.yuzu.wins, 1);
    assert.equal(first.profile.gachaTickets["1"], 3);
    assert.equal(first.profile.matchHistory.filter((entry) => entry.matchId === `${roomId}:9`).length, 1);
    assert.equal(first.actionCalls, 1);
    await page.getByRole("button", { name: "結果を確認して戻る" }).click();
    await page.reload();
    await page.locator("#room:not(.hidden)").waitFor();
    const restored = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key)), { key: remoteProfileKey });
    assert.equal(restored.cpuStats.wins, 1);
    assert.equal(restored.cpuCharacterStats.yuzu.matches, 1);
    assert.equal(restored.gachaTickets["1"], 3);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length), 0);
  }, { bodyTimeout: 50_000 });
});

test("CPU reward copy requires a saved CPU settlement", { timeout: 150000 }, async () => {
  await withPage("finished", async (page) => {
    await page.getByText("戦績を保存しました：対人戦 勝利 4").waitFor();
    assert.doesNotMatch(await page.locator("#terminalProgressText").textContent(), /完了報酬/);
  });
  await withPage("finishedCpu", async (page) => {
    await page.getByText("戦績を同期しています。マイページで確認できます。").waitFor();
    assert.doesNotMatch(await page.locator("#terminalProgressText").textContent(), /完了報酬/);
  });
});

test("actual Edge rematches the same visible CPU and returns the human to fresh setup", { timeout: 130000 }, async () => {
  await withPage("finishedCpu", async (page) => {
    await page.getByRole("button", { name: "結果を確認して戻る" }).click();
    await page.getByRole("button", { name: "同じCPUと再戦する" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    assert.equal(await page.locator("#shownCode").textContent(), "CPU：うっかりユズ");
    const evidence = await page.evaluate(({ key }) => ({
      stored: JSON.parse(localStorage.getItem(key)),
      calls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-rematch").map((entry) => entry.body),
    }), { key: connectionKey });
    assert.equal(evidence.calls.length, 1);
    assert.equal(evidence.calls[0].expectedVersion, 9);
    assert.match(evidence.calls[0].actionId, /^[0-9a-f-]{36}$/i);
    assert.equal(evidence.stored.setupRevision, 0);
    assert.equal(evidence.stored.rematchActionId, null);
  });
});

test("actual Edge keeps a finished CPU room until another CPU is chosen", { timeout: 130000 }, async () => {
  await withPage("finishedCpu", async (page) => {
    await page.getByRole("button", { name: "結果を確認して戻る" }).click();
    const chooseAnother = page.getByRole("button", { name: "別のCPUを選んで新しく対戦" });
    await chooseAnother.click();
    await page.locator("#cpuRosterDialog[open]").waitFor();
    assert.equal(await page.locator("#closeCpuRoster").textContent(), "対戦結果に戻る");
    const roomBeforeCancel = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key))?.roomId, { key: connectionKey });
    assert.equal(roomBeforeCancel, "11111111-1111-4111-8111-111111111111");

    await page.keyboard.press("Escape");
    await page.locator("#cpuRosterDialog").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.id), "chooseDifferentCpu");
    assert.equal(await page.locator("#room").isVisible(), true);
    assert.equal(await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key))?.roomId, { key: connectionKey }), roomBeforeCancel);

    await chooseAnother.click();
    await page.getByRole("button", { name: "せっかちレンと対戦" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    assert.equal(await page.locator("#shownCode").textContent(), "CPU：せっかちレン");
    const evidence = await page.evaluate(() => ({
      cpuStarts: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start").map((entry) => entry.body),
      cpuAccepts: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-accept").length,
      cpuRematches: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-rematch").length,
      matchmaking: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name?.startsWith("fcg_standard_matchmaking_")).length,
      overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.equal(evidence.cpuStarts.length, 1);
    assert.equal(evidence.cpuStarts[0].characterId, "ren");
    assert.equal(evidence.cpuStarts[0].confirmed, true);
    assert.equal(evidence.cpuAccepts, 0);
    assert.equal(evidence.cpuRematches, 0);
    assert.equal(evidence.matchmaking, 0);
    assert.equal(evidence.overflows, false);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge finds a public opponent and enters setup without exposing a code", { timeout: 130000 }, async () => {
  await withPage("publicFind", async (page) => {
    await page.getByRole("button", { name: "今入れる試合を探す" }).click();
    await page.locator("#room:not(.hidden)").waitFor();
    assert.equal(await page.locator("#roomIdentityLabel").textContent(), "対戦形式");
    assert.equal(await page.locator("#shownCode").textContent(), "野良対戦");
    assert.equal(await page.locator("#setupCard").evaluate((node) => node.classList.contains("hidden")), false);
    const calls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.kind === "rpc").map((entry) => entry.name));
    assert.deepEqual(calls.slice(0, 2), ["fcg_standard_matchmaking_find", "fcg_standard_room_snapshot_v2"]);
  });
});

test("actual Edge makes the six-card setup explicit, constrained, and keyboard-safe on mobile", { timeout: 150000 }, async () => {
  await withPage("publicFind", async (page) => {
    await page.getByRole("button", { name: "今入れる試合を探す" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    const summary = page.locator("#loadoutSummary");
    await summary.getByText("選択 6/6｜色 2/2｜エリア 2/2｜妨害 2/2｜準備OK", { exact: true }).waitFor();
    assert.equal(await page.locator(".loadout-option.is-selected").count(), 6);
    assert.equal(await page.getByText("✓ 持ち込む", { exact: true }).count(), 6);
    assert.equal(await page.locator("#submitSetup").isEnabled(), true);
    assert.equal(await page.locator("#setupCommitTitle").textContent(), "スターター6枚を選択済み・準備OK");
    const initialCommitLayout = await page.evaluate(() => {
      const bar = document.querySelector("#setupCommitBar").getBoundingClientRect();
      const button = document.querySelector("#submitSetup").getBoundingClientRect();
      const tabs = document.querySelector(".app-tabs").getBoundingClientRect();
      return {
        position: getComputedStyle(document.querySelector("#setupCommitBar")).position,
        bar: { top: bar.top, right: bar.right, bottom: bar.bottom, left: bar.left },
        button: { top: button.top, bottom: button.bottom },
        tabsTop: tabs.top,
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    assert.equal(initialCommitLayout.position, "fixed");
    assert.ok(initialCommitLayout.bar.top >= 0 && initialCommitLayout.bar.bottom <= initialCommitLayout.tabsTop, JSON.stringify(initialCommitLayout));
    assert.ok(initialCommitLayout.button.top >= 0 && initialCommitLayout.button.bottom <= initialCommitLayout.tabsTop, JSON.stringify(initialCommitLayout));
    assert.ok(initialCommitLayout.bar.left >= 0 && initialCommitLayout.bar.right <= initialCommitLayout.viewport.width, JSON.stringify(initialCommitLayout));

    const selectedColor = page.locator('input[name="loadout-color"]:checked').first();
    const selectedColorId = await selectedColor.getAttribute("value");
    await selectedColor.focus();
    await page.keyboard.press("Space");
    await summary.getByText(/選択 5\/6｜色 1\/2.*あと1枚/).waitFor();
    assert.equal(await page.locator("#submitSetup").isDisabled(), true);
    assert.equal(await page.locator(`input[name="loadout-color"][value="${selectedColorId}"]`).evaluate((node) => node === document.activeElement), true);

    const replacement = page.locator('input[name="loadout-color"]:not(:checked)').first();
    await replacement.focus();
    await page.keyboard.press("Space");
    await summary.getByText(/選択 6\/6｜色 2\/2.*準備OK/).waitFor();
    assert.equal(await page.locator("#submitSetup").isEnabled(), true);

    const third = page.locator('input[name="loadout-color"]:not(:checked)').first();
    await third.focus();
    await page.keyboard.press("Space");
    await summary.getByText("色カードは2枚までです。入れ替えるカードを先に外してください。", { exact: true }).waitFor();
    assert.equal(await third.isChecked(), false);
    assert.equal(await third.evaluate((node) => node === document.activeElement), true);
    const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.width + 1, JSON.stringify(layout));
  }, { bodyTimeout: 50_000, viewport: { width: 390, height: 844 } });
});

test("actual Edge hands one submitted setup to the visible first-move guide without stealing restored focus", { timeout: 240000 }, async () => {
  await withPage("setupTransition", async (page) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => {
      const original = Element.prototype.scrollIntoView;
      globalThis.__handoffScrolls = [];
      Element.prototype.scrollIntoView = function trackedScroll(options) {
        globalThis.__handoffScrolls.push({ id: this.id, options });
        return original.call(this, options);
      };
    });
    await page.locator("#setupCard:not(.hidden)").waitFor();
    await page.getByRole("button", { name: "この6枚で準備完了" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "matchTitle");
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "setup").length), 1);
    assert.equal(await page.locator("#matchTitle").textContent(), "Standard対戦スタート");
    assert.equal(await page.locator("#turnGuideStep").textContent(), "あなたが作る → CPUが塗る");
    assert.match(await page.locator("#turnGuideTitle").textContent(), /白い盤面をタップして、あと1マス選ぶ/);
    await page.waitForFunction(() => {
      const guide = document.querySelector("#turnGuide").getBoundingClientRect();
      const tabs = document.querySelector(".app-tabs").getBoundingClientRect();
      return guide.top >= 0 && guide.bottom <= tabs.top;
    });
    const handoff = await page.evaluate(() => globalThis.__handoffScrolls.at(-1));
    assert.deepEqual(handoff, { id: "matchCard", options: { block: "start", behavior: "smooth" } });
    await page.locator("#surrender").focus();
    await page.evaluate(() => globalThis.__standardOnlineRuntime.onInvalidate?.());
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "surrender");
  }, { bodyTimeout: 50_000, viewport: { width: 390, height: 844 } });

  await withPage("setupTransitionCpuFirst", async (page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      const original = Element.prototype.scrollIntoView;
      globalThis.__handoffScrolls = [];
      Element.prototype.scrollIntoView = function trackedScroll(options) {
        globalThis.__handoffScrolls.push({ id: this.id, options });
        return original.call(this, options);
      };
    });
    await page.getByRole("button", { name: "この6枚で準備完了" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "matchTitle");
    assert.equal(await page.locator("#turnGuideStep").textContent(), "CPUが作る → あなたが塗る");
    assert.equal(await page.locator("#turnGuideTitle").textContent(), "CPUが最初のエリアを選んでいます");
    assert.match(await page.locator("#turnGuideDetail").textContent(), /次は、受け取った灰色エリア/);
    const handoff = await page.evaluate(() => globalThis.__handoffScrolls.at(-1));
    assert.deepEqual(handoff, { id: "matchCard", options: { block: "start", behavior: "auto" } });
  }, { viewport: { width: 390, height: 844 } });

  await withPage("playing", async (page) => {
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), "matchTitle");
    await page.reload({ waitUntil: "load" });
    await page.locator("#connectionBadge.good").waitFor();
    await page.locator("#matchCard:not(.hidden)").waitFor();
    await page.waitForTimeout(100);
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), "matchTitle");
  });
});

test("actual Edge guides a player from board selection through one CREATE_REGION intent", { timeout: 130000 }, async () => {
  await withPage("playing", async (page) => {
    await page.locator("#turnGuide:not(.hidden)").waitFor();
    assert.equal(await page.locator("#turnGuideStep").textContent(), "あなたが作る → 相手が塗る");
    assert.match(await page.locator("#turnGuideTitle").textContent(), /あと1マス選ぶ/);
    assert.match(await page.locator("#turnGuideDetail").textContent(), /選んだエリアは相手が塗ります/);
    await page.locator("#board").click({ position: { x: 50, y: 50 } });
    assert.equal(await page.locator("#selectionCount").textContent(), "1 / 1マス");
    assert.equal(await page.locator("#turnGuideStep").textContent(), "あなたが作る → 相手が塗る");
    assert.equal(await page.locator("#turnGuideTitle").textContent(), "選べました。「このエリアを渡す」へ");
    await page.getByRole("button", { name: "このエリアを渡す" }).click();
    await page.getByText("操作を保存しました。").waitFor();
    const calls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").map((entry) => entry.body));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action.type, "CREATE_REGION");
    assert.equal(calls[0].action.payload.sourceMacros.length, 1);
  });
});

test("actual Edge keeps safe deterministic action and debug setup errors beside their controls at 390px", { timeout: 180000 }, async () => {
  await withPage("actionRuleError", async (page) => {
    const status = page.locator("#actionStatus");
    await page.locator('#paletteControls .color-button[data-color="red"]').click();
    await status.getByText(/隣り合う領域が同色.*操作を選び直してください/).waitFor();
    assert.equal(await page.locator("#retryAction").isHidden(), true);
    assert.doesNotMatch(await page.locator("body").textContent(), /authoritative_state|service secret|private stack/i);
    await page.locator('#paletteControls .color-button[data-color="red"]').click();
    await status.getByText(/隣り合う領域が同色.*操作を選び直してください/).waitFor();
    const actionIds = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls
      .filter((entry) => entry.body?.operation === "action")
      .map((entry) => entry.body.action.id));
    assert.equal(actionIds.length, 2);
    assert.notEqual(actionIds[0], actionIds[1]);
    const actionLayout = await page.evaluate(() => ({
      feedback: document.querySelector("#actionStatus").getBoundingClientRect(),
      tabs: document.querySelector(".app-tabs").getBoundingClientRect(),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.ok(actionLayout.feedback.bottom <= actionLayout.tabs.top, JSON.stringify(actionLayout));
    assert.equal(actionLayout.overflow, false);
  }, { viewport: { width: 390, height: 844 } });

  await withPage("setupDebugError", async (page) => {
    await page.locator("#setupCard:not(.hidden)").waitFor();
    await page.locator("#debugUnlimitedMode").check();
    await page.getByRole("button", { name: "この6枚で準備完了" }).click();
    const status = page.locator("#setupStatus");
    await status.getByText(/合言葉による人同士の対戦.*デバッグをOFF/).waitFor();
    assert.doesNotMatch(await page.locator("body").textContent(), /access_mode|service secret|private stack/i);
    await page.evaluate(() => globalThis.__standardOnlineRuntime.onInvalidate());
    await status.getByText(/合言葉による人同士の対戦.*デバッグをOFF/).waitFor();
    const setupLayout = await page.evaluate(() => ({
      feedback: document.querySelector("#setupStatus").getBoundingClientRect(),
      tabs: document.querySelector(".app-tabs").getBoundingClientRect(),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.ok(setupLayout.feedback.bottom <= setupLayout.tabs.top, JSON.stringify(setupLayout));
    assert.equal(setupLayout.overflow, false);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge presents public seals and blocks every stale paint path without changing skill targets", { timeout: 130000 }, async () => {
  await withPage("playing", async (page) => {
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      runtime.room = { ...runtime.room, public_state: {
        ...runtime.room.public_state,
        active: "A", phase: "COLOR", pending: "R1",
        publicEffects: { A: { seals: {} }, B: { seals: {} } },
        regions: { R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: ["B"], color: null, isPending: true } },
      } };
      runtime.view = { ...runtime.view, private_state: {
        ...runtime.view.private_state,
        basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2,
      } };
      runtime.onInvalidate();
    });
    const red = page.locator('#paletteControls .color-button[data-color="red"]');
    await red.waitFor();
    assert.equal(await red.textContent(), "赤");
    assert.equal(await red.isEnabled(), true);

    await page.evaluate(() => { globalThis.__standardOnlineRuntime.failNextColorAction = true; });
    await red.click();
    await page.locator("#actionStatus").getByText(/サーバーの応答を確認できませんでした。.*同じ操作を再送/).waitFor();
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length), 1);

    await page.locator('#paletteControls .color-button[data-color="red"]').focus();
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      globalThis.__staleRedButton = document.querySelector('#paletteControls .color-button[data-color="red"]');
      const version = runtime.room.version + 1;
      runtime.room = { ...runtime.room, version, public_state: {
        ...runtime.room.public_state, version,
        publicEffects: { ...runtime.room.public_state.publicEffects, A: { seals: { red: 1 } } },
      } };
      runtime.view = { ...runtime.view, version };
      runtime.onInvalidate();
    });
    const sealedRed = page.locator('#paletteControls .color-button[data-color="red"]');
    await page.waitForFunction(() => document.querySelector('#paletteControls .color-button[data-color="red"]')?.disabled === true);
    assert.equal(await sealedRed.textContent(), "🔒 赤（封印中）");
    assert.equal(await sealedRed.isDisabled(), true);
    assert.equal(await sealedRed.evaluate((node) => node.classList.contains("is-sealed")), true);
    assert.notEqual(await page.evaluate(() => document.activeElement?.dataset?.color), "red");

    await sealedRed.evaluate((node) => node.click());
    await page.keyboard.press("Enter");
    await page.evaluate(() => globalThis.__staleRedButton.onclick());
    await page.getByText("赤は封印中です。", { exact: true }).waitFor();
    await page.getByRole("button", { name: "同じ操作を再送" }).click();
    await page.getByText("🔒 赤は封印中です。別の色を選んでください。").waitFor();
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length), 1);

    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const version = runtime.room.version + 1;
      runtime.room = { ...runtime.room, version, opponent_kind: "cpu", access_mode: "cpu", public_state: {
        ...runtime.room.public_state, version,
        publicEffects: { ...runtime.room.public_state.publicEffects, A: { seals: { red: 0, blue: 1 } } },
      } };
      runtime.view = { ...runtime.view, version };
      runtime.onInvalidate();
    });
    const cpuBlue = page.locator('#paletteControls .color-button[data-color="blue"]');
    await page.waitForFunction(() => document.querySelector('#paletteControls .color-button[data-color="blue"]')?.disabled === true);
    assert.equal(await cpuBlue.textContent(), "🔒 青（封印中）");
    assert.equal(await page.locator('#paletteControls .color-button[data-color="red"]').isEnabled(), true);
    await page.locator('#paletteControls .color-button[data-color="red"]').click();
    await page.getByText("操作を保存しました。").waitFor();
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length), 2);

    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const version = runtime.room.version + 1;
      runtime.room = { ...runtime.room, version, opponent_kind: "human", access_mode: "private_code", public_state: {
        ...runtime.room.public_state, version, active: "A", phase: "WORK", pending: null,
        publicEffects: { ...runtime.room.public_state.publicEffects, A: { seals: { red: 1 } } },
      } };
      runtime.view = { ...runtime.view, version, private_state: {
        ...runtime.view.private_state,
        hand: { ...runtime.view.private_state.hand, disruptChoiceOne: 1 },
      } };
      runtime.onInvalidate();
    });
    await page.getByRole("button", { name: "色封じ ×1" }).click();
    const targetRed = page.locator("#skillTargetControls button", { hasText: /^赤$/ });
    await targetRed.waitFor();
    assert.equal(await targetRed.isEnabled(), true);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length), 2);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge names the maker and painter across every handoff state", { timeout: 130000 }, async () => {
  await withPage("handoffGuide", async (page) => {
    const states = [
      { active: "A", phase: "CREATE_FIRST", role: "あなたが作る → 相手が塗る", title: "白い盤面をタップして、あと1マス選ぶ" },
      { active: "B", phase: "CREATE_FIRST", role: "相手が作る → あなたが塗る", title: "相手があなたへ渡すエリアを作っています" },
      { active: "A", phase: "WORK", role: "あなたが作る → 相手が塗る", title: "盤面をタップ／クリックして、あと1マス選ぶ" },
      { active: "B", phase: "WORK", role: "相手が作る → あなたが塗る", title: "相手があなたへ渡すエリアを作っています" },
      { active: "A", phase: "COLOR", role: "相手が作る → あなたが塗る", title: "受け取った灰色エリアを塗る" },
      { active: "B", phase: "COLOR", role: "あなたが作る → 相手が塗る", title: "相手が受け取ったエリアを塗っています" },
    ];
    for (const expected of states) {
      await page.evaluate(({ active, phase }) => {
        const runtime = globalThis.__standardOnlineRuntime;
        const version = runtime.room.version + 1;
        const coloring = phase === "COLOR";
        runtime.room = { ...runtime.room, version, public_state: {
          ...runtime.room.public_state, version, active, phase, pending: coloring ? "R1" : null,
          regions: coloring ? { R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: [active === "A" ? "B" : "A"], color: null, isPending: true } } : {},
        } };
        runtime.view = { ...runtime.view, version };
        runtime.onInvalidate();
      }, expected);
      await page.waitForFunction(({ role, title }) => (
        document.querySelector("#turnGuideStep")?.textContent === role
        && document.querySelector("#turnGuideTitle")?.textContent === title
      ), expected);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    }

    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const version = runtime.room.version + 1;
      runtime.room = { ...runtime.room, version, public_state: {
        ...runtime.room.public_state, version, active: "A", phase: "WORK", pending: null, regions: {},
      } };
      runtime.view = { ...runtime.view, version };
      runtime.onInvalidate();
    });
    await page.getByText("盤面をタップ／クリックして、あと1マス選ぶ", { exact: true }).waitFor();
    await page.locator("#board").click({ position: { x: 50, y: 50 } });
    await page.getByRole("button", { name: "このエリアを渡す" }).click();
    await page.getByText("操作を保存しました。").waitFor();
    await page.waitForFunction(() => document.querySelector("#turnGuideTitle")?.textContent === "相手が受け取ったエリアを塗っています");
    const afterCreate = await page.evaluate(() => ({
      active: globalThis.__standardOnlineRuntime.room.public_state.active,
      phase: globalThis.__standardOnlineRuntime.room.public_state.phase,
      pending: globalThis.__standardOnlineRuntime.room.public_state.pending,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.deepEqual(afterCreate, { active: "B", phase: "COLOR", pending: "R1", overflow: false });
    assert.equal(await page.locator("#turnGuideStep").textContent(), "あなたが作る → 相手が塗る");
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge explains private random setup and every visible skill without exposing an oracle", { timeout: 130000 }, async () => {
  await withPage("playing", async (page) => {
    assert.match(await page.locator("#members").textContent(), /B｜四色の匠/);
    assert.equal(await page.locator("#members .member-nameplate-gold").count(), 1);
    assert.equal(await page.locator("#roomStatus").textContent(), "対戦中");
    assert.equal(await page.locator("#versionText").textContent(), "3");
    assert.equal(await page.locator("#phaseText").textContent(), "相手に渡すエリアを選んでください");
    assert.equal(await page.locator("#rolledSizeValue").textContent(), "1マス");
    assert.equal(await page.locator("#basicPaletteValue").textContent(), "赤・青");
    assert.equal(await page.locator("#bonusColorValue").textContent(), "黄（残り2回）");
    assert.equal(await page.locator("#randomRevealTitle").textContent(), "サイコロは 1マス！");
    await page.getByRole("button", { name: "エリア拡張の説明" }).click();
    await page.locator("#skillInfoDialog[open]").waitFor();
    assert.equal(await page.locator("#skillInfoTitle").textContent(), "エリア拡張");
    assert.match(await page.locator("#skillInfoBody").textContent(), /渡すエリアを1マス増やします/);
    assert.equal(await page.locator("#skillInfoRandom").evaluate((node) => node.classList.contains("hidden")), true);
    await page.getByRole("button", { name: "説明を閉じる" }).click();
    assert.equal(await page.locator("#skillInfoDialog").evaluate((node) => node.open), false);
  });
});
