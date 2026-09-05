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
const pendingQuizKey = "fourColorMapGame.standard.online.v5.pending-quiz";
const saveKey = "fourColorMapGame.standard.v5.save";
const remoteProfileKey = "fourColorMapGame.standard.online.v5.remote-profile";
const roomId = "11111111-1111-4111-8111-111111111111";
const pendingRematchId = "22222222-2222-4222-8222-222222222222";
const RESTORED_ROOM_MODES = new Set(["finished", "playing", "labPlaying", "setupLabPersist", "setupLabLostResponse", "setupLabMismatch", "handoffGuide", "cpuTurn", "cpuTurnNoColor", "finishedCpu", "finishedCpuSagaStart", "finishedHumanSagaBlocked", "finishedCpuWrongSagaBlocked", "activeCpuSagaBlocked", "cpuWin", "setupTransition", "setupTransitionCpuFirst", "actionRuleError", "setupDebugError", "handoffReload", "waitingAbandon", "readyGuestAbandon", "cpuReadyAbandon", "abandonLost", "abandonAdvancedReady", "activeBootPrivate", "activeBootPublic", "activeBootCpu", "cpuSagaStartServerActive"]);

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
  let lifetimeCpuActionCalls = 0;
  const lifetimeInvocations = [];
  await context.exposeFunction("__standardOnlineCountCpuAction", () => { lifetimeCpuActionCalls += 1; });
  await context.exposeFunction("__standardOnlineCpuActionCount", () => lifetimeCpuActionCalls);
  await context.exposeFunction("__standardOnlineRecordInvoke", (body) => { lifetimeInvocations.push(structuredClone(body)); });
  await context.exposeFunction("__standardOnlineLifetimeInvocations", () => structuredClone(lifetimeInvocations));
  await context.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript; charset=utf-8",
    body: "export function createClient(){return globalThis.__standardOnlineMockSupabase}",
  }));
  await context.addInitScript(({ connectionKey: connection, saveKey: save, roomId: id, pendingId, mode: initialMode }) => {
    globalThis.__standardOnlineFocusEvents = [];
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function trackedFocus(...args) {
      globalThis.__standardOnlineFocusEvents.push({ id: this.id || "", stack: new Error().stack || "" });
      return originalFocus.apply(this, args);
    };
    const quizReloadModes = ["handoffReload", "quizReloadPrivate", "quizReloadCpu", "quizReloadPublicFinished", "quizReloadStale"];
    const initialTab = ["gacha", "quiz", "quizPolish", ...quizReloadModes].includes(initialMode) ? "quiz" : initialMode === "cosmetic" ? "profile" : initialMode === "empty" ? "home" : "battle";
    const setupTransition = ["setupTransition", "setupTransitionCpuFirst"].includes(initialMode);
    const setupPending = setupTransition || initialMode === "setupDebugError";
    const pregameMode = ["setupLabPersist", "setupLabLostResponse", "setupLabMismatch", "waitingAbandon", "readyGuestAbandon", "cpuReadyAbandon", "abandonLost", "abandonAdvancedReady", "abandonedPassive"].includes(initialMode);
    const activeRecoveryModes = ["activeBootPrivate", "activeBootPublic", "activeBootCpu", "activeCreatePrivate", "activeCreatePublic", "activeCreateCpu"];
    const activeRecoveryMode = activeRecoveryModes.includes(initialMode);
    const activeRecoveryAccessMode = initialMode.endsWith("Public") ? "public_queue" : initialMode.endsWith("Cpu") ? "cpu" : "private_code";
    const activeRecoveryAtBoot = initialMode.startsWith("activeBoot") || initialMode === "cpuSagaStartServerActive";
    if (["cpuSagaFindBlocked", "finishedCpuSagaStart", "activeCpuSagaBlocked", "finishedHumanSagaBlocked", "finishedCpuWrongSagaBlocked", "cpuSagaStartServerActive"].includes(initialMode)) {
      localStorage.setItem("fourColorMapGame.standard.online.v5.cpu-start-saga", JSON.stringify({
        stage: "start",
        roomId: null,
        replaceRoomId: ["finishedCpuSagaStart", "finishedHumanSagaBlocked"].includes(initialMode)
          ? id
          : initialMode === "finishedCpuWrongSagaBlocked" ? "99999999-9999-4999-8999-999999999999" : null,
        cpuStartActionId: "77777777-7777-4777-8777-777777777777",
        setupActionId: "88888888-8888-4888-8888-888888888888",
        characterId: "yuzu",
        canonicalLoadout: {
          color: ["colorRandomBorrow", "colorChoiceBorrow"],
          area: ["areaDiePlus", "areaResize"],
          disrupt: ["disruptRandomOne", "disruptChoiceOne"],
        },
      }));
    }
    if (initialMode === "cpuReadyAbandon" && sessionStorage.getItem("mock-standard-cpu-ready-saga-seeded") !== id) {
      localStorage.setItem("fourColorMapGame.standard.online.v5.cpu-start-saga", JSON.stringify({
        stage: "setup",
        roomId: id,
        replaceRoomId: null,
        cpuStartActionId: "77777777-7777-4777-8777-777777777777",
        setupActionId: "88888888-8888-4888-8888-888888888888",
        characterId: "yuzu",
        canonicalLoadout: {
          color: ["colorRandomBorrow", "colorChoiceBorrow"],
          area: ["areaDiePlus", "areaResize"],
          disrupt: ["disruptRandomOne", "disruptChoiceOne"],
        },
      }));
      sessionStorage.setItem("mock-standard-cpu-ready-saga-seeded", id);
    }
    let restoredCpuRewardResult = null;
    try { restoredCpuRewardResult = JSON.parse(sessionStorage.getItem("fourColorMapGame.standard.online.v5.cpu-reward-gacha-result") || "null"); } catch { restoredCpuRewardResult = null; }
    let restoredCpuStartSaga = null;
    try { restoredCpuStartSaga = JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga") || "null"); } catch { restoredCpuStartSaga = null; }
    const restoreCpuRewardResult = initialMode === "cpuWin" && restoredCpuRewardResult?.continuation?.roomId === id;
    const restoreNoColorResult = initialMode === "cpuTurnNoColor" && sessionStorage.getItem("fourColorMapGame.standard.online.v5.mock-no-color-finished") === id;
    const restoredCpuRewardVersion = restoreCpuRewardResult ? Number(restoredCpuRewardResult.continuation.roomVersion) : 9;
    const restoredRoomVersion = restoreNoColorResult ? 10 : restoredCpuRewardVersion;
    const cpuRoomMode = ["cpuTurn", "cpuTurnNoColor", "finishedCpu", "finishedCpuSagaStart", "finishedCpuWrongSagaBlocked", "activeCpuSagaBlocked", "cpuWin", "setupTransition", "setupTransitionCpuFirst", "quizReloadCpu", "cpuReadyAbandon", "activeBootCpu", "activeCreateCpu", "cpuSagaStartServerActive"].includes(initialMode);
    let restoredConnection = null;
    try { restoredConnection = JSON.parse(localStorage.getItem(connection) || "null"); } catch { restoredConnection = null; }
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
      if (!["lobby", "cosmetic", "quiz", "quizPolish", "publicFind", "cpuWait", "cpuRetry", "cpuSagaFindBlocked", "finishedCpuSagaStart", "finishedHumanSagaBlocked", "finishedCpuWrongSagaBlocked", "activeCpuSagaBlocked", "handoffActivity", "handoffStart", ...activeRecoveryModes, "cpuSagaStartServerActive"].includes(initialMode)
          && !(["setupLabPersist", "setupLabLostResponse"].includes(initialMode) && restoredConnection)) {
        localStorage.setItem(connection, JSON.stringify({
          roomId: id, roomCode: "A1B2C3", profileRevision: 1, setupRevision: initialMode === "setupLabMismatch" ? 3 : setupPending || pregameMode ? 0 : 3,
          rematchActionId: initialMode === "finished" ? pendingId : null,
          rematchExpectedVersion: initialMode === "finished" ? 9 : null,
          ...(initialMode === "abandonLost" && restoredConnection ? {
            abandonRoomId: restoredConnection.abandonRoomId,
            abandonActionId: restoredConnection.abandonActionId,
            abandonExpectedVersion: restoredConnection.abandonExpectedVersion,
          } : {}),
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
      } else if (initialMode === "cpuSagaFindBlocked") {
        localStorage.setItem(connection, JSON.stringify({
          roomId: null, roomCode: null, profileRevision: 1, setupRevision: 0,
          matchmakingTicketId: null, matchmakingStartedAt: null, matchmakingFindActionId: pendingId,
          cpuStartActionId: null, cpuStartCharacterId: null,
        }));
      } else if (initialMode === "cpuSagaStartServerActive") {
        localStorage.setItem(connection, JSON.stringify({
          roomId: null, roomCode: null, profileRevision: 1, setupRevision: 0,
          matchmakingTicketId: null, matchmakingStartedAt: null, matchmakingFindActionId: null,
          cpuStartActionId: null, cpuStartCharacterId: null,
        }));
      } else if (["finishedCpuSagaStart", "finishedHumanSagaBlocked", "finishedCpuWrongSagaBlocked", "activeCpuSagaBlocked"].includes(initialMode)) {
        localStorage.setItem(connection, JSON.stringify({
          roomId: id, roomCode: null, profileRevision: 1, setupRevision: 0,
          matchmakingTicketId: null, matchmakingStartedAt: null, matchmakingFindActionId: null,
          cpuStartActionId: null, cpuStartCharacterId: null,
        }));
      }
    }
    if (quizReloadModes.includes(initialMode)) {
      const questions = Array.from({ length: 10 }, (_, index) => ({
        number: index + 1, templateId: "add", category: "たし算", prompt: `${index + 1} + 1 = ?`,
        math: { kind: "expression", value: `${index + 1} + 1 = ?` }, hintOptions: ["たし算：同じ位どうしを足す"],
        hintDurationMs: 2500, timeLimitSeconds: 60,
        options: Array.from({ length: 6 }, (_, optionIndex) => ({ id: `q${index + 1}-${optionIndex + 1}`, label: String(index + optionIndex + 2) })),
      }));
      localStorage.setItem("fourColorMapGame.standard.online.v5.pending-quiz", JSON.stringify({
        sessionId: "66666666-6666-4666-8666-666666666666", finishActionId: pendingId,
        selectedLevel: 1, expiresAt: "2099-01-01T00:00:00.000Z", questions, answers: [], answerResults: [],
        answerMode: "per-question-v1", pendingAnswer: null, timeoutAnswerId: "__timeout__",
        questionState: { index: 0, remainingMs: 30000, lastTickAt: Date.now() - 5000, hintUsed: false, hintActiveUntil: 0 },
      }));
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
    if (["cpuTurn", "cpuTurnNoColor"].includes(initialMode)) active.active = "B";
    if (initialMode === "cpuTurnNoColor") {
      active.regions = { R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: ["B"], color: "blue", isPending: false } };
    }
    if (initialMode === "actionRuleError") {
      active.phase = "COLOR";
      active.pending = "R1";
      active.regions = { R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: ["B"], color: null, isPending: true } };
    }
    if (initialMode === "labPlaying") {
      active.labRuleSetId = "STANDARD_V5_LEGAL_RECOLOR_LAB_V1";
      active.regions = {
        R1: { id: "R1", micro: [0, 1], sourceMacros: [0], controllers: ["B"], color: "red", isPending: false },
        R2: { id: "R2", micro: [4, 5], sourceMacros: [4], controllers: ["A"], color: "blue", isPending: false },
      };
    }
    const noColorFinished = {
      ...active, status: "FINISHED", phase: "GAME_OVER", version: 10, winner: "B", terminalReason: "NO_LEGAL_COLOR", pending: "R2",
      publicEffects: { A: { seals: { yellow: 1, green: 1 } }, B: { seals: {} } },
      regions: {
        R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: ["B"], color: "blue", isPending: false },
        R2: { id: "R2", micro: [1], sourceMacros: [1], controllers: ["B"], color: null, isPending: true },
      },
    };
    const pregameStatus = ["setupLabPersist", "setupLabLostResponse", "waitingAbandon"].includes(initialMode) ? "waiting" : initialMode === "abandonedPassive" ? "abandoned" : "ready";
    const runtime = {
      waitStartedAt: initialMode === "cpuWait" ? new Date(Date.now() - 91000).toISOString() : new Date().toISOString(),
      room: { id, status: ["finished", "finishedCpu", "finishedCpuSagaStart", "finishedHumanSagaBlocked", "finishedCpuWrongSagaBlocked", "quizReloadPublicFinished"].includes(initialMode) || restoreCpuRewardResult || restoreNoColorResult ? "finished" : pregameMode ? pregameStatus : ["publicFind", "handoffActivity", "handoffStart", "handoffReload"].includes(initialMode) || setupPending ? "ready" : "playing", version: restoredRoomVersion, game_mode: "standard_v5", access_mode: cpuRoomMode ? "cpu" : ["publicFind", "handoffActivity", "handoffStart", "handoffReload", "quizReloadPublicFinished"].includes(initialMode) ? "public_queue" : "private_code", opponent_kind: cpuRoomMode ? "cpu" : "human", cpu_character_id: cpuRoomMode ? "yuzu" : null, public_state: restoreNoColorResult ? noColorFinished : ["finished", "finishedCpu", "finishedCpuSagaStart", "finishedHumanSagaBlocked", "finishedCpuWrongSagaBlocked", "quizReloadPublicFinished"].includes(initialMode) || restoreCpuRewardResult ? { ...finished, version: restoredRoomVersion } : pregameMode || ["publicFind", "handoffActivity", "handoffStart", "handoffReload"].includes(initialMode) || setupPending ? null : active },
      view: pregameMode || ["publicFind", "handoffActivity", "handoffStart", "handoffReload"].includes(initialMode) || setupPending ? null : { seat: "A", version: restoredRoomVersion, private_state: { hand: initialMode === "labPlaying" ? { areaDiePlus: 1, legalRecolor: 1 } : { areaDiePlus: 1, areaResize: 1 }, basicPalette: initialMode === "cpuTurnNoColor" ? ["yellow", "green"] : ["red", "blue"], bonusColor: initialMode === "cpuTurnNoColor" ? "blue" : "yellow", bonusUsesRemaining: initialMode === "cpuTurnNoColor" ? 3 : 2, privateEffects: {} } },
      profile: initialMode === "empty" ? null : { revision: 1, display_name: "A", profile_state: profileState },
      gachaReceipts: {},
      cardSaleReceipts: {},
      cosmeticReceipts: {},
      quizAnswerReceipts: {},
      quizFinishReceipts: {},
      cpuStartReceipts: JSON.parse(sessionStorage.getItem("mock-standard-cpu-start-receipts") || "{}"),
      setupReceipts: JSON.parse(sessionStorage.getItem("mock-standard-setup-receipts") || "{}"),
      recoverExistingCpuStart: false,
      failNextCpuStartResponse: false,
      failNextSetupResponse: initialMode === "cpuReadyAbandon",
      failNextFindResponse: false,
      failNextColorAction: false,
      failNextGacha: false,
      failNextQuizAnswer: false,
      failNextAbandonResponse: initialMode === "abandonLost" && sessionStorage.getItem("mock-standard-abandon-response-lost") !== id,
      abandonRpcIds: JSON.parse(sessionStorage.getItem("mock-standard-abandon-rpc-ids") || "[]"),
      advancedReadyConflictSent: false,
      activeRecoveryAvailable: activeRecoveryAtBoot,
      activeRecoverySuccessfulReads: 0,
      calls: [],
    };
    runtime.missingRoom = initialMode === "quizReloadStale";
    if (activeRecoveryMode || initialMode === "cpuSagaStartServerActive") {
      const accessMode = initialMode === "cpuSagaStartServerActive" ? "cpu" : activeRecoveryAccessMode;
      const roomStatus = initialMode === "cpuSagaStartServerActive" ? "ready"
        : accessMode === "private_code" ? "waiting" : accessMode === "public_queue" ? "ready" : "playing";
      runtime.room = {
        ...runtime.room,
        status: roomStatus,
        access_mode: accessMode,
        opponent_kind: accessMode === "cpu" ? "cpu" : "human",
        cpu_character_id: accessMode === "cpu" ? "yuzu" : null,
        public_state: roomStatus === "playing" ? active : null,
      };
      runtime.view = roomStatus === "playing"
        ? { seat: "A", version: runtime.room.version, private_state: { hand: {}, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } }
        : null;
    }
    runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false, appearance: { nameplate: "nameplateDefault", title: "titleNone" } }, { user_id: "44444444-4444-4444-8444-444444444444", seat: "B", display_name: cpuRoomMode ? "うっかりユズ" : "B", is_cpu: cpuRoomMode, appearance: { nameplate: "nameplateGold", title: "titleArtisan" } }];
    if (initialMode === "cpuSagaStartServerActive") {
      runtime.cpuStartReceipts["77777777-7777-4777-8777-777777777777"] = {
        matchmakingStatus: "matched", startStatus: "created", roomId: id, seat: "A",
        opponentKind: "cpu", characterId: "yuzu", duplicate: false,
      };
    }
    if (restoredCpuStartSaga?.stage === "setup" && restoredCpuStartSaga.roomId === id) {
      runtime.room = { ...runtime.room, status: "ready", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: restoredCpuStartSaga.characterId, public_state: null };
      runtime.view = null;
      runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
    }
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
      auth: { getSession: async () => ({ data: { session: { user: { id: initialMode === "readyGuestAbandon" ? "44444444-4444-4444-8444-444444444444" : "33333333-3333-4333-8333-333333333333" } } } }), signInAnonymously: async () => { throw new Error("unexpected sign-in"); } },
      functions: { invoke: async (name, request) => {
        runtime.calls.push({ kind: "invoke", name, body: request.body });
        await globalThis.__standardOnlineRecordInvoke(request.body);
        if (request.body.operation === "setup" && initialMode === "setupDebugError") return functionError(403, "DEBUG_MODE_NOT_ALLOWED", "private access_mode row and service secret");
        if (request.body.operation === "setup" && ["setupLabPersist", "setupLabLostResponse"].includes(initialMode)) {
          const prior = runtime.setupReceipts[request.body.setupActionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const result = { setupRevision: (runtime.setupRevision = (runtime.setupRevision || 0) + 1), profileRevision: 1, quoteId: request.body.setupActionId, debugMode: request.body.debugMode, labMode: request.body.labMode };
          runtime.setupReceipts[request.body.setupActionId] = result;
          sessionStorage.setItem("mock-standard-setup-receipts", JSON.stringify(runtime.setupReceipts));
          if (initialMode === "setupLabLostResponse" && sessionStorage.getItem("mock-standard-lab-setup-response-lost") !== id) {
            sessionStorage.setItem("mock-standard-lab-setup-response-lost", id);
            return { error: new Error("simulated lost lab setup response") };
          }
          return { data: result };
        }
        if (request.body.operation === "setup" && setupTransition) return { data: { setupRevision: 1, profileRevision: 1 } };
        if (request.body.operation === "setup" && runtime.room.opponent_kind === "cpu") {
          const prior = runtime.setupReceipts[request.body.setupActionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const result = { setupRevision: 1, profileRevision: runtime.profile.revision, quoteId: request.body.setupActionId };
          runtime.setupReceipts[request.body.setupActionId] = result;
          sessionStorage.setItem("mock-standard-setup-receipts", JSON.stringify(runtime.setupReceipts));
          if (runtime.failNextSetupResponse) {
            runtime.failNextSetupResponse = false;
            return { error: new Error("simulated lost setup response") };
          }
          return { data: result };
        }
        if (request.body.operation === "initialize" && setupTransition) {
          const cpuFirst = initialMode === "setupTransitionCpuFirst";
          const started = { ...active, matchId: `${id}:10`, status: "ACTIVE", version: 10, turn: 1, active: cpuFirst ? "B" : "A", phase: "CREATE_FIRST" };
          runtime.room = { ...runtime.room, status: "playing", version: 10, public_state: started };
          runtime.view = { seat: "A", version: 10, private_state: { hand: { areaDiePlus: 1, areaResize: 1 }, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } };
          return { data: { roomStatus: "playing", roomVersion: 10 } };
        }
        if (request.body.operation === "initialize" && initialMode === "setupLabMismatch") {
          return functionError(409, "LAB_MODE_MISMATCH", "private mismatched setup markers");
        }
        if (request.body.operation === "initialize" && runtime.room.opponent_kind === "cpu" && runtime.room.status === "ready") {
          const started = { ...active, matchId: `${id}:10`, status: "ACTIVE", version: 10, turn: 1, active: "A", phase: "CREATE_FIRST" };
          runtime.room = { ...runtime.room, status: "playing", version: 10, public_state: started };
          runtime.view = { seat: "A", version: 10, private_state: { hand: {}, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } };
          return { data: { roomStatus: "playing", roomVersion: 10 } };
        }
        if (request.body.operation === "profile") {
          runtime.profile = { revision: 1, display_name: request.body.displayName, profile_state: request.body.profileState };
          return { data: { revision: 1, displayName: request.body.displayName, profileState: request.body.profileState } };
        }
        if (request.body.operation === "quiz-start") {
          if (initialMode === "handoffStart") await new Promise((resolve) => setTimeout(resolve, 800));
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
            mission: question.math?.kind === "story"
              ? `条件を整理して、${question.category}の答えを求めよう`
              : question.math?.kind === "geometry"
                ? `図の寸法から${question.category}を求めよう`
                : "式を読み、「?」に入る数を求めよう",
            formatLabel: question.math?.kind === "story" ? "文章を整理" : question.math?.kind === "geometry" ? "図を読む" : "ひらめき計算",
            thinkingSteps: initialMode === "quizPolish" ? 3 : 1,
            hintOptions: ["たし算：同じ位どうしを足す", "円の面積：S = πr²", "2次の行列式：det A = ad − bc"],
            hintDurationMs: 2500,
            timeLimitSeconds: initialMode === "handoffStart" ? 1 : 10,
            options: Array.from({ length: 6 }, (_, optionIndex) => ({ id: `q${index + 1}-${optionIndex + 1}`, label: String(index + optionIndex + 2) })),
          }));
          return { data: { sessionId: "66666666-6666-4666-8666-666666666666", duplicate: false, selectedLevel: request.body.selectedLevel, answerMode: "per-question-v1", expiresAt: "2099-01-01T00:00:00.000Z", questions, timeoutAnswerId: "__timeout__" } };
        }
        if (request.body.operation === "quiz-answer") {
          if (initialMode === "handoffActivity") await new Promise((resolve) => setTimeout(resolve, 800));
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
          if (initialMode === "handoffActivity") await new Promise((resolve) => setTimeout(resolve, 800));
          if (runtime.failNextGacha) {
            runtime.failNextGacha = false;
            return functionError(503, "SERVER_BUSY", "temporary gacha failure with private detail");
          }
          const prior = runtime.gachaReceipts[request.body.actionId];
          if (prior) return { data: { ...prior, duplicate: true } };
          const next = JSON.parse(JSON.stringify(runtime.profile.profile_state));
          const drawnSkillId = initialMode === "cpuWin" ? "colorPrism" : "colorRandomBorrow";
          const drawnName = initialMode === "cpuWin" ? "四色解放" : "色拾い・乱";
          next.gachaTickets[String(request.body.ticketLevel)] -= request.body.count;
          next.inventory[drawnSkillId] = (next.inventory[drawnSkillId] || 0) + request.body.count;
          runtime.profile = { ...runtime.profile, revision: runtime.profile.revision + 1, profile_state: next };
          const result = { revision: runtime.profile.revision, duplicate: false, draws: Array.from({ length: request.body.count }, () => ({ ticketLevel: request.body.ticketLevel, rarity: 1, category: "color", skillId: drawnSkillId, displayName: drawnName })), profileState: next };
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
          if (prior) {
            runtime.room = { ...runtime.room, status: "ready", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: prior.characterId, public_state: null };
            runtime.view = null;
            runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
            return { data: { ...prior, duplicate: true, startStatus: "duplicate" } };
          }
          if (runtime.recoverExistingCpuStart) {
            runtime.room = { ...runtime.room, status: "playing", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: "yuzu", public_state: active };
            runtime.view = { seat: "A", version: runtime.room.version, private_state: { hand: {}, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } };
            runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
            const recovered = { matchmakingStatus: "matched", startStatus: "recovered_existing", roomId: id, seat: "A", opponentKind: "cpu", characterId: "yuzu", duplicate: false };
            runtime.cpuStartReceipts[request.body.actionId] = recovered;
            sessionStorage.setItem("mock-standard-cpu-start-receipts", JSON.stringify(runtime.cpuStartReceipts));
            return { data: recovered };
          }
          runtime.room = { ...runtime.room, status: "ready", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: request.body.characterId, public_state: null };
          runtime.view = null;
          runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
          const result = { matchmakingStatus: "matched", startStatus: "created", roomId: id, seat: "A", opponentKind: "cpu", characterId: request.body.characterId, duplicate: false };
          runtime.cpuStartReceipts[request.body.actionId] = result;
          sessionStorage.setItem("mock-standard-cpu-start-receipts", JSON.stringify(runtime.cpuStartReceipts));
          if (runtime.failNextCpuStartResponse) {
            runtime.failNextCpuStartResponse = false;
            return { error: new Error("simulated lost CPU start response") };
          }
          return { data: result };
        }
        if (request.body.operation === "cpu-accept") {
          runtime.room = { ...runtime.room, status: "ready", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: request.body.characterId, public_state: null };
          runtime.view = null;
          runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
          return { data: { matchmakingStatus: "matched", roomId: id, seat: "A", characterId: request.body.characterId, duplicate: false } };
        }
        if (request.body.operation === "cpu-action") {
          await globalThis.__standardOnlineCountCpuAction();
          if (initialMode === "setupTransitionCpuFirst") return { error: new Error("CPU_NOT_ACTIVE") };
          if (initialMode === "cpuTurnNoColor") {
            sessionStorage.setItem("fourColorMapGame.standard.online.v5.mock-no-color-finished", id);
            const next = JSON.parse(JSON.stringify(runtime.profile.profile_state));
            next.cpuStats.losses += 1;
            next.cpuStats.currentWinStreak = 0;
            next.cpuCharacterStats.yuzu = { matches: 1, wins: 0, losses: 1, firstWinAt: null };
            next.matchHistory.unshift({ matchId: `${id}:9`, result: "LOSS", terminalReason: "NO_LEGAL_COLOR", endedAt: "2026-09-05T01:00:00.000Z", fullPaint: false, skillsUsed: 0, onlineOpponentKind: "cpu", cpuCharacterId: "yuzu" });
            runtime.profile = { ...runtime.profile, revision: runtime.profile.revision + 1, profile_state: next };
            const nextVersion = runtime.room.version + 1;
            runtime.room = { ...runtime.room, status: "finished", version: nextVersion, winner_seat: "B", public_state: {
              ...runtime.room.public_state, status: "FINISHED", phase: "GAME_OVER", version: nextVersion, winner: "B", terminalReason: "NO_LEGAL_COLOR", pending: "R2",
              publicEffects: { A: { seals: { yellow: 1, green: 1 } }, B: { seals: {} } },
              regions: {
                R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: ["B"], color: "blue", isPending: false },
                R2: { id: "R2", micro: [1], sourceMacros: [1], controllers: ["B"], color: null, isPending: true },
              },
            } };
            runtime.view = { ...runtime.view, version: nextVersion };
            return { data: { duplicate: false, room: runtime.room } };
          }
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
        if (name === "fcg_standard_active_room") {
          if (!runtime.activeRecoveryAvailable) return { data: [] };
          runtime.activeRecoverySuccessfulReads += 1;
          return { data: [{
            room_id: id,
            seat: "A",
            room_status: runtime.room.status,
            room_version: runtime.room.version,
            access_mode: runtime.room.access_mode,
            opponent_kind: runtime.room.opponent_kind,
            cpu_character_id: runtime.room.cpu_character_id,
            setup_revision: 0,
          }] };
        }
        if (name === "fcg_standard_create_room" && initialMode.startsWith("activeCreate")) {
          runtime.activeRecoveryAvailable = true;
          return { error: Object.assign(new Error(`STANDARD_ALREADY_IN_ROOM private sentinel ${id}`), {
            code: "55000",
            details: `private actor 33333333-3333-4333-8333-333333333333 ${id}`,
          }) };
        }
        if (name === "fcg_standard_matchmaking_recruit") {
          runtime.ticketId = args.p_ticket_id;
          return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "searching", room_id: null, seat: null, wait_started_at: runtime.waitStartedAt, server_time: new Date().toISOString() }] };
        }
        if (name === "fcg_standard_matchmaking_status") return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: runtime.matchNow ? "matched" : "searching", room_id: runtime.matchNow ? id : null, seat: runtime.matchNow ? "A" : null, wait_started_at: runtime.waitStartedAt, server_time: new Date().toISOString() }] };
        if (name === "fcg_standard_matchmaking_cancel") return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "cancelled", room_id: null, seat: null, server_time: new Date().toISOString() }] };
        if (name === "fcg_standard_matchmaking_find") {
          if (runtime.failNextFindResponse) {
            runtime.failNextFindResponse = false;
            return { error: new Error("simulated lost find response") };
          }
          return { data: [{ matchmaking_status: initialMode === "publicFind" ? "matched" : "none_available", room_id: initialMode === "publicFind" ? id : null, seat: initialMode === "publicFind" ? "B" : null, server_time: new Date().toISOString(), duplicate: false }] };
        }
        if (name === "fcg_standard_room_snapshot_v2" && runtime.missingRoom) return { data: null, error: Object.assign(new Error("room removed"), { code: "P0002" }) };
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
        if (name === "fcg_standard_abandon_room") {
          runtime.abandonRpcIds.push(args.p_action_id);
          sessionStorage.setItem("mock-standard-abandon-rpc-ids", JSON.stringify(runtime.abandonRpcIds));
          if (initialMode === "abandonAdvancedReady" && !runtime.advancedReadyConflictSent) {
            runtime.advancedReadyConflictSent = true;
            runtime.room = { ...runtime.room, version: runtime.room.version + 1 };
            return { error: Object.assign(new Error("stale room version"), { code: "PT409" }) };
          }
          if (runtime.failNextAbandonResponse) {
            runtime.failNextAbandonResponse = false;
            sessionStorage.setItem("mock-standard-abandon-response-lost", id);
            return { error: new Error("simulated lost abandon response") };
          }
          if (!["waiting", "ready", "abandoned"].includes(runtime.room.status)) return { error: new Error("room is not pregame") };
          const alreadyAbandoned = runtime.room.status === "abandoned";
          if (!alreadyAbandoned) runtime.room = { ...runtime.room, status: "abandoned", version: runtime.room.version + 1, winner_seat: null, public_state: null };
          return { data: [{ room_status: "abandoned", room_version: runtime.room.version, abandon_result: alreadyAbandoned ? "already_abandoned" : "applied", duplicate: false, server_time: new Date().toISOString() }] };
        }
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
        const read = async () => ({ data: resultFor(table) });
        const chain = { eq: () => chain, order: read, single: read, maybeSingle: read };
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

test("actual Edge reviews six cards before starting Standard CPU exactly once", { timeout: 130000 }, async () => {
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
    await page.getByRole("button", { name: "うっかりユズを選んで6枚を確認" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "setupTitle");
    assert.equal(await page.locator("#cpuStartReview").textContent(), "対戦相手：CPU「うっかりユズ」。この画面ではまだ対戦は始まっていません。");
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => ["cpu-start", "setup"].includes(entry.body?.operation)).length), 0);
    await page.getByRole("button", { name: "このCPU・6枚で対戦開始" }).dblclick();
    await page.locator("#matchCard:not(.hidden)").waitFor();
    assert.equal(await page.locator("#shownCode").textContent(), "CPU：うっかりユズ");
    assert.equal(await page.locator("#waitingMessage").textContent(), "CPUとの対戦中です。盤面と手番案内を確認してください。");
    const evidence = await page.evaluate(({ key, sagaKey }) => ({
      bodies: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.kind === "invoke").map((entry) => entry.body),
      publicCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => String(entry.name || "").includes("matchmaking")),
      connection: JSON.parse(localStorage.getItem(key)),
      saga: localStorage.getItem(sagaKey),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }), { key: connectionKey, sagaKey: "fourColorMapGame.standard.online.v5.cpu-start-saga" });
    assert.deepEqual(evidence.bodies.filter((body) => ["cpu-start", "setup", "initialize"].includes(body.operation)).map((body) => body.operation), ["cpu-start", "setup", "initialize"]);
    const cpuStart = evidence.bodies.find((body) => body.operation === "cpu-start");
    assert.match(cpuStart.actionId, /^[0-9a-f-]{36}$/i);
    assert.deepEqual({ ...cpuStart, actionId: "<uuid>" }, { operation: "cpu-start", actionId: "<uuid>", characterId: "yuzu", confirmed: true });
    assert.match(evidence.bodies.find((body) => body.operation === "setup").setupActionId, /^[0-9a-f-]{36}$/i);
    assert.deepEqual(evidence.publicCalls, []);
    assert.equal(evidence.connection.cpuStartActionId, null);
    assert.equal(evidence.connection.cpuStartCharacterId, null);
    assert.equal(evidence.connection.setupRevision, 1);
    assert.equal(evidence.saga, null);
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

test("actual Edge resumes the immutable CPU setup saga after a lost setup response", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    await page.getByRole("button", { name: "10人からCPUを選ぶ" }).click();
    await page.getByRole("button", { name: "うっかりユズを選んで6枚を確認" }).click();
    await page.evaluate(() => { globalThis.__standardOnlineRuntime.failNextSetupResponse = true; });
    await page.getByRole("button", { name: "このCPU・6枚で対戦開始" }).click();
    await page.getByRole("button", { name: "同じ開始処理を再確認" }).waitFor();
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga")));
    assert.match(pending.cpuStartActionId, /^[0-9a-f-]{36}$/i);
    assert.match(pending.setupActionId, /^[0-9a-f-]{36}$/i);
    assert.equal(pending.stage, "setup");
    assert.equal(pending.roomId, roomId);

    await page.reload({ waitUntil: "load" });
    await page.locator("#connectionBadge.good").waitFor();
    await page.locator("#matchCard:not(.hidden)").waitFor();
    const evidence = await page.evaluate(async () => ({
      starts: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start").map((entry) => entry.body),
      setups: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "setup").map((entry) => entry.body),
      lifetime: await globalThis.__standardOnlineLifetimeInvocations(),
      saga: localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga"),
      activeElement: document.activeElement?.id,
      focusEvents: globalThis.__standardOnlineFocusEvents,
    }));
    assert.equal(evidence.starts.length, 0);
    assert.equal(evidence.setups.length, 1);
    assert.equal(evidence.setups[0].setupActionId, pending.setupActionId);
    const lifetimeStarts = evidence.lifetime.filter((body) => body.operation === "cpu-start");
    const lifetimeSetups = evidence.lifetime.filter((body) => body.operation === "setup");
    assert.equal(lifetimeStarts.length, 1);
    assert.equal(lifetimeStarts[0].actionId, pending.cpuStartActionId);
    assert.equal(lifetimeSetups.length, 2);
    assert.deepEqual(new Set(lifetimeSetups.map((body) => body.setupActionId)), new Set([pending.setupActionId]));
    assert.equal(evidence.saga, null);
    assert.deepEqual(evidence.focusEvents.filter((entry) => entry.id === "matchTitle"), []);
  });
});

test("actual Edge retries only the same CPU start after its response is lost", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    await page.getByRole("button", { name: "10人からCPUを選ぶ" }).click();
    await page.getByRole("button", { name: "うっかりユズを選んで6枚を確認" }).click();
    await page.evaluate(() => { globalThis.__standardOnlineRuntime.failNextCpuStartResponse = true; });
    await page.getByRole("button", { name: "このCPU・6枚で対戦開始" }).click();
    await page.getByRole("button", { name: "同じ開始処理を再確認" }).waitFor();
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga")));
    assert.equal(pending.stage, "start");
    assert.equal(pending.roomId, null);

    await page.reload({ waitUntil: "load" });
    await page.locator("#connectionBadge.good").waitFor();
    await page.locator("#matchCard:not(.hidden)").waitFor();
    const lifetime = await page.evaluate(() => globalThis.__standardOnlineLifetimeInvocations());
    const starts = lifetime.filter((body) => body.operation === "cpu-start");
    const setups = lifetime.filter((body) => body.operation === "setup");
    assert.equal(starts.length, 2);
    assert.deepEqual(new Set(starts.map((body) => body.actionId)), new Set([pending.cpuStartActionId]));
    assert.equal(setups.length, 1);
    assert.equal(setups[0].setupActionId, pending.setupActionId);
  });
});

test("restored CPU start replaces only its old finished room and never a different active room", { timeout: 130000 }, async () => {
  await withPage("finishedCpuSagaStart", async (page) => {
    await page.locator("#matchCard:not(.hidden)").waitFor();
    const evidence = await page.evaluate(() => ({
      starts: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start"),
      setups: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "setup"),
      saga: localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga"),
    }));
    assert.equal(evidence.starts.length, 1);
    assert.equal(evidence.setups.length, 1);
    assert.equal(evidence.starts[0].body.actionId, "77777777-7777-4777-8777-777777777777");
    assert.equal(evidence.setups[0].body.setupActionId, "88888888-8888-4888-8888-888888888888");
    assert.equal(evidence.saga, null);
  });
  for (const mode of ["activeCpuSagaBlocked", "finishedHumanSagaBlocked", "finishedCpuWrongSagaBlocked"]) {
    await withPage(mode, async (page) => {
      await page.waitForFunction(() => document.querySelector("#matchCard") && !document.querySelector("#matchCard").classList.contains("hidden"));
      await page.waitForFunction(() => document.activeElement?.id === "matchTitle");
      const evidence = await page.evaluate(() => ({
        cpuWrites: globalThis.__standardOnlineRuntime.calls.filter((entry) => ["cpu-start", "setup"].includes(entry.body?.operation)),
        saga: JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga")),
        setupHidden: document.getElementById("setupCard").classList.contains("hidden"),
        activeElement: document.activeElement?.id,
      }));
      assert.equal(evidence.cpuWrites.length, 0, mode);
      assert.equal(evidence.saga.stage, "start", mode);
      assert.equal(evidence.setupHidden, true, mode);
      assert.equal(evidence.activeElement, "matchTitle", mode);
    });
  }
});

test("actual Edge recovers an existing room without submitting the new CPU draft", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    await page.getByRole("button", { name: "10人からCPUを選ぶ" }).click();
    await page.getByRole("button", { name: "せっかちレンを選んで6枚を確認" }).click();
    await page.evaluate(() => { globalThis.__standardOnlineRuntime.recoverExistingCpuStart = true; });
    await page.getByRole("button", { name: "このCPU・6枚で対戦開始" }).click();
    await page.locator("#matchCard:not(.hidden)").waitFor();
    const evidence = await page.evaluate(() => ({
      starts: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start").length,
      setups: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "setup").length,
      saga: localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga"),
      activeElement: document.activeElement?.id,
    }));
    assert.equal(evidence.starts, 1);
    assert.equal(evidence.setups, 0);
    assert.equal(evidence.saga, null);
    assert.equal(evidence.activeElement, "matchTitle");
    assert.equal(await page.locator("#shownCode").textContent(), "CPU：うっかりユズ");
  });
});

test("actual Edge edits the roomless next loadout with a reachable mobile commit bar", { timeout: 130000 }, async () => {
  await withPage("lobby", async (page) => {
    await page.getByRole("button", { name: "カード", exact: true }).click();
    await page.getByRole("button", { name: "次の対戦用6枚を編集" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    assert.equal(await page.locator('#loadoutGrid input[type="checkbox"]:checked').count(), 6);
    const geometry = await page.evaluate(() => {
      const commit = document.querySelector("#setupCommitBar").getBoundingClientRect();
      const connection = document.querySelector("#connectionCard").getBoundingClientRect();
      return { commitBottom: commit.bottom, commitTop: commit.top, connectionBottom: connection.bottom, viewport: innerHeight };
    });
    assert.ok(geometry.commitBottom <= geometry.viewport - 80);
    assert.ok(geometry.connectionBottom <= geometry.commitTop);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => ["cpu-start", "setup"].includes(entry.body?.operation)).length), 0);
    await page.getByRole("button", { name: "この6枚を次戦候補に保存" }).click();
    assert.equal(await page.locator("#setupStatus").textContent(), "この端末の次戦候補として6枚を保存しました。対戦やルームはまだ始まっていません。");
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge closes only the active-room screen and returns through the exclusive CTA", { timeout: 130000 }, async () => {
  await withPage("cpuTurn", async (page) => {
    await page.getByRole("button", { name: "画面だけ閉じる" }).click();
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "home");
    assert.equal(await page.getByRole("button", { name: "進行中の対戦へ戻る" }).isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "startStandardCpuHome");
    assert.equal(await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key)).roomId, { key: connectionKey }), roomId);
    await page.getByRole("button", { name: "進行中の対戦へ戻る" }).click();
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "battle");
    assert.equal(await page.locator("#room").isVisible(), true);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start").length), 0);
  });
});

test("actual Edge lets a ready guest abandon without rewards and keeps confirmation accessible at 390px", { timeout: 130000 }, async () => {
  await withPage("readyGuestAbandon", async (page) => {
    assert.equal(await page.locator("#abandonRoom").isVisible(), true);
    assert.equal(await page.locator("#leaveRoomDescription").textContent(), "ルーム・待機・対戦は継続します。");
    const beforeProfile = await page.evaluate(() => JSON.stringify(globalThis.__standardOnlineRuntime.profile.profile_state));
    const layout = await page.evaluate(() => {
      const safe = document.querySelector("#leaveRoom").getBoundingClientRect();
      const destructive = document.querySelector("#abandonRoom").getBoundingClientRect();
      return { safe, destructive, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    assert.ok(layout.safe.height >= 44 && layout.destructive.height >= 44, JSON.stringify(layout));
    assert.ok(layout.destructive.top >= layout.safe.bottom, JSON.stringify(layout));
    assert.equal(layout.overflow, false);

    await page.locator("#abandonRoom").click();
    await page.locator("#abandonRoomDialog[open]").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "abandonRoomTitle");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "abandonRoom");
    await page.locator("#abandonRoom").click();
    await page.locator("#cancelAbandonRoom").click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "abandonRoom");

    await page.locator("#abandonRoom").click();
    await page.locator("#confirmAbandonRoom").click();
    await page.locator("#lobby:not(.hidden)").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "lobbyTitle");
    await page.waitForFunction(() => document.querySelector("#roomLifecycleAnnouncement")?.textContent.includes("戦績・報酬はありません"));
    const after = await page.evaluate(({ key }) => ({
      profile: JSON.stringify(globalThis.__standardOnlineRuntime.profile.profile_state),
      connection: JSON.parse(localStorage.getItem(key)),
      abandonCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_abandon_room"),
      actionCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action"),
      announcement: document.querySelector("#roomLifecycleAnnouncement").textContent,
    }), { key: connectionKey });
    assert.equal(after.profile, beforeProfile);
    assert.equal(after.connection.roomId, null);
    assert.equal(after.abandonCalls.length, 1);
    assert.equal(after.actionCalls.length, 0);
    assert.equal(after.announcement, "開始前の対戦を取りやめました。戦績・報酬はありません。");
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge keeps one waiting abandon request ID across a lost response and reload", { timeout: 180000 }, async () => {
  await withPage("abandonLost", async (page) => {
    await page.locator("#abandonRoom").click();
    await page.locator("#confirmAbandonRoom").click();
    await page.getByText("サーバーの応答を確認できませんでした。同じ取りやめ処理を再確認してください。", { exact: true }).waitFor();
    const first = await page.evaluate(({ key }) => ({
      connection: JSON.parse(localStorage.getItem(key)),
      ids: JSON.parse(sessionStorage.getItem("mock-standard-abandon-rpc-ids")),
    }), { key: connectionKey });
    assert.match(first.connection.abandonActionId, /^[0-9a-f-]{36}$/i);
    assert.equal(first.connection.abandonRoomId, roomId);
    assert.equal(first.ids.length, 1);

    await page.reload({ waitUntil: "load" });
    await page.locator("#connectionBadge.good").waitFor();
    await page.getByRole("button", { name: "取りやめ結果を再確認" }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "abandonRoomTitle");
    await page.getByRole("button", { name: "同じ取りやめ処理を再確認" }).click();
    await page.locator("#lobby:not(.hidden)").waitFor();
    const second = await page.evaluate(({ key }) => ({
      connection: JSON.parse(localStorage.getItem(key)),
      ids: JSON.parse(sessionStorage.getItem("mock-standard-abandon-rpc-ids")),
    }), { key: connectionKey });
    assert.equal(second.ids.length, 2);
    assert.deepEqual(new Set(second.ids), new Set([first.connection.abandonActionId]));
    assert.equal(second.connection.roomId, null);
    assert.equal(second.connection.abandonActionId, null);
  }, { viewport: { width: 390, height: 844 }, bodyTimeout: 70_000 });
});

test("actual Edge retires a stale abandon ID when ready advances and reconfirms with the new version", { timeout: 130000 }, async () => {
  await withPage("abandonAdvancedReady", async (page) => {
    await page.locator("#abandonRoom").click();
    await page.locator("#confirmAbandonRoom").click();
    await page.getByText("対戦準備が更新されたため、前の処理は再送しません。現在の状態を確認し、取りやめる場合はもう一度確定してください。", { exact: true }).waitFor();
    const afterConflict = await page.evaluate(({ key }) => ({
      connection: JSON.parse(localStorage.getItem(key)),
      ids: [...globalThis.__standardOnlineRuntime.abandonRpcIds],
      roomVersion: globalThis.__standardOnlineRuntime.room.version,
    }), { key: connectionKey });
    assert.equal(afterConflict.ids.length, 1);
    assert.equal(afterConflict.connection.abandonActionId, null);
    assert.equal(afterConflict.roomVersion, 10);
    await page.getByRole("button", { name: "更新後の状態で無報酬のまま取りやめる" }).click();
    await page.locator("#lobby:not(.hidden)").waitFor();
    const final = await page.evaluate(() => ({
      ids: [...globalThis.__standardOnlineRuntime.abandonRpcIds],
      abandonCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_abandon_room").map((entry) => entry.args.p_expected_version),
      actionCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length,
    }));
    assert.equal(final.ids.length, 2);
    assert.notEqual(final.ids[0], final.ids[1]);
    assert.deepEqual(final.abandonCalls, [9, 10]);
    assert.equal(final.actionCalls, 0);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge resolves opponent abandon and ready-to-playing races without surrendering", { timeout: 200000 }, async () => {
  await withPage("abandonedPassive", async (page) => {
    await page.locator("#lobby:not(.hidden)").waitFor();
    await page.waitForFunction(() => document.querySelector("#roomLifecycleAnnouncement")?.textContent === "相手が開始前の対戦を取りやめました。戦績・報酬はありません。");
    const evidence = await page.evaluate(({ key }) => ({
      connection: JSON.parse(localStorage.getItem(key)),
      abandonCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_abandon_room").length,
      actionCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length,
      focus: document.activeElement?.id,
    }), { key: connectionKey });
    assert.equal(evidence.connection.roomId, null);
    assert.equal(evidence.abandonCalls, 0);
    assert.equal(evidence.actionCalls, 0);
    assert.equal(evidence.focus, "lobbyTitle");
  });

  await withPage("readyGuestAbandon", async (page) => {
    await page.locator("#abandonRoom").click();
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      runtime.room = { ...runtime.room, status: "playing", version: runtime.room.version + 1, public_state: {
        matchId: `${runtime.room.id}:race`, status: "ACTIVE", version: runtime.room.version + 1, turn: 1, active: "A", phase: "CREATE_FIRST", winner: null,
        requiredSize: 1, rolledSize: 1, baseRequiredSize: 1, playableBounds: { macroWidth: 4, microScale: 1, minCol: 0, minRow: 0, maxCol: 3, maxRow: 3 }, regions: {},
      } };
      runtime.view = { seat: "B", version: runtime.room.version, private_state: { hand: {}, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } };
      runtime.onInvalidate();
    });
    await page.locator("#abandonRoomDialog").waitFor({ state: "hidden" });
    await page.locator("#matchCard:not(.hidden)").waitFor();
    assert.equal(await page.locator("#abandonRoom").isHidden(), true);
    assert.equal(await page.getByRole("button", { name: "敗北として投了する" }).isVisible(), true);
    const calls = await page.evaluate(() => ({
      abandon: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_abandon_room").length,
      surrender: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action" && entry.body?.action?.type === "SURRENDER").length,
    }));
    assert.deepEqual(calls, { abandon: 0, surrender: 0 });
  });
});

test("actual Edge keeps finished close unchanged, CPU ready idle, and 980px actions separated", { timeout: 200000 }, async () => {
  await withPage("finished", async (page) => {
    await page.locator("#terminalClose").click();
    assert.equal(await page.locator("#abandonRoom").isHidden(), true);
    assert.equal(await page.locator("#leaveRoom").textContent(), "結果を閉じてロビーへ");
    await page.locator("#abandonRoom").evaluate((button) => button.click());
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_abandon_room").length), 0);
  });

  await withPage("cpuReadyAbandon", async (page) => {
    assert.equal(await page.locator("#abandonRoom").isVisible(), true);
    const beforeProfile = await page.evaluate(() => JSON.stringify(globalThis.__standardOnlineRuntime.profile.profile_state));
    await page.waitForFunction(async () => (await globalThis.__standardOnlineLifetimeInvocations())
      .filter((entry) => entry.operation === "setup").length === 1);
    const callsBeforeAbandon = await page.evaluate(async () => (await globalThis.__standardOnlineLifetimeInvocations())
      .filter((entry) => ["cpu-start", "setup", "cpu-action"].includes(entry.operation)));
    assert.deepEqual(callsBeforeAbandon.map((entry) => entry.operation), ["setup"]);
    await new Promise((resolve) => setTimeout(resolve, 900));
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-action").length), 0);
    await page.locator("#abandonRoom").click();
    await page.locator("#confirmAbandonRoom").click();
    await page.locator("#lobby:not(.hidden)").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "lobbyTitle");
    const cpuExit = await page.evaluate(({ key }) => ({
      profile: JSON.stringify(globalThis.__standardOnlineRuntime.profile.profile_state),
      connection: JSON.parse(localStorage.getItem(key)),
      abandon: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_abandon_room").length,
      cpuAction: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-action").length,
      focus: document.activeElement?.id,
    }), { key: connectionKey });
    assert.equal(cpuExit.profile, beforeProfile);
    assert.equal(cpuExit.connection.roomId, null);
    assert.equal(cpuExit.abandon, 1);
    assert.equal(cpuExit.cpuAction, 0);
    assert.equal(cpuExit.focus, "lobbyTitle");
    assert.equal(await page.evaluate(() => localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga")), null);
    await page.reload({ waitUntil: "load" });
    await page.locator("#connectionBadge.good").waitFor();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const callsAfterReload = await page.evaluate(async () => (await globalThis.__standardOnlineLifetimeInvocations())
      .filter((entry) => ["cpu-start", "setup", "cpu-action"].includes(entry.operation)));
    assert.deepEqual(callsAfterReload, callsBeforeAbandon);
    assert.equal(await page.evaluate(() => localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga")), null);
  }, { viewport: { width: 390, height: 844 } });

  await withPage("waitingAbandon", async (page) => {
    const layout = await page.evaluate(() => {
      const safe = document.querySelector("#leaveRoom").getBoundingClientRect();
      const destructive = document.querySelector("#abandonRoom").getBoundingClientRect();
      return { safe, destructive, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    assert.ok(Math.abs(layout.safe.top - layout.destructive.top) <= 2, JSON.stringify(layout));
    assert.equal(layout.overflow, false);
    await page.locator("#abandonRoom").click();
    const bounds = await page.locator("#abandonRoomDialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 980 && bounds.y + bounds.height <= 800, JSON.stringify(bounds));
  }, { viewport: { width: 980, height: 800 } });
});

test("hidden new-match handlers allocate no action and make no RPC while another entry owns the actor", { timeout: 240000 }, async () => {
  const entryIds = ["createRoom", "joinRoom", "recruitOpponent", "findOpponent"];
  const entryNames = ["fcg_standard_create_room", "fcg_standard_join_room", "fcg_standard_matchmaking_recruit", "fcg_standard_matchmaking_find"];
  await withPage("cpuTurn", async (page) => {
    await page.evaluate(async (ids) => { for (const id of ids) await document.getElementById(id).onclick(); }, entryIds);
    const evidence = await page.evaluate((names) => ({
      calls: globalThis.__standardOnlineRuntime.calls.filter((entry) => names.includes(entry.name)),
      connection: JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.connection")),
    }), entryNames);
    assert.equal(evidence.calls.length, 0);
    assert.equal(evidence.connection.roomId, roomId);
  });
  await withPage("lobby", async (page) => {
    await page.getByRole("button", { name: "10人からCPUを選ぶ" }).click();
    await page.getByRole("button", { name: "うっかりユズを選んで6枚を確認" }).click();
    await page.evaluate(async (ids) => { for (const id of ids) await document.getElementById(id).onclick(); }, entryIds);
    const evidence = await page.evaluate((names) => ({
      rpcCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => names.includes(entry.name)),
      cpuStarts: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start"),
    }), entryNames);
    assert.equal(evidence.rpcCalls.length, 0);
    assert.equal(evidence.cpuStarts.length, 0);
  });
  await withPage("cpuWait", async (page) => {
    assert.equal(await page.locator("#createRoom").isDisabled(), true);
    assert.equal(await page.locator("#joinRoom").isDisabled(), true);
    await page.evaluate(async (ids) => { for (const id of ids) await document.getElementById(id).onclick(); }, entryIds);
    const calls = await page.evaluate((names) => globalThis.__standardOnlineRuntime.calls.filter((entry) => names.includes(entry.name)), entryNames);
    assert.equal(calls.length, 0);
  });
  await withPage("lobby", async (page) => {
    await page.evaluate(() => { globalThis.__standardOnlineRuntime.failNextFindResponse = true; });
    await page.getByRole("button", { name: "今入れる試合を探す" }).click();
    await page.getByText("検索結果を確認できませんでした。同じ検索IDで再試行します。").waitFor();
    await page.evaluate(async () => {
      for (const id of ["startStandardCpuHome", "startStandardCpuLobby"]) {
        const node = document.getElementById(id);
        await node.onclick({ currentTarget: node });
      }
    });
    const evidence = await page.evaluate(() => ({
      findCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_matchmaking_find").length,
      cpuCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => ["cpu-roster", "cpu-start", "setup"].includes(entry.body?.operation)).length,
      pendingFind: JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.connection")).matchmakingFindActionId,
    }));
    assert.equal(evidence.findCalls, 1);
    assert.equal(evidence.cpuCalls, 0);
    assert.match(evidence.pendingFind, /^[0-9a-f-]{36}$/i);
  });
  for (const kind of ["ticket", "find"]) {
    await withPage("lobby", async (page) => {
      await page.getByRole("button", { name: "10人からCPUを選ぶ" }).click();
      if (kind === "ticket") {
        await page.evaluate(() => document.getElementById("recruitOpponent").onclick());
      } else {
        await page.evaluate(() => {
          globalThis.__standardOnlineRuntime.failNextFindResponse = true;
          return document.getElementById("findOpponent").onclick();
        });
      }
      await page.locator("#cpuRosterGrid button").first().evaluate((node) => node.onclick());
      await page.waitForFunction(() => document.activeElement?.id === "matchmakingStatus");
      const evidence = await page.evaluate(() => ({
        cpuWrites: globalThis.__standardOnlineRuntime.calls.filter((entry) => ["cpu-start", "setup"].includes(entry.body?.operation)),
        connection: JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.connection")),
        saga: localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga"),
        dialogOpen: document.getElementById("cpuRosterDialog").open,
        activeTab: document.body.dataset.activeTab,
        statusVisible: Boolean(document.getElementById("matchmakingStatus").offsetParent),
        activeElement: document.activeElement?.id,
      }));
      assert.equal(evidence.cpuWrites.length, 0);
      assert.equal(evidence.saga, null);
      assert.equal(Boolean(evidence.connection.matchmakingTicketId), kind === "ticket");
      assert.equal(Boolean(evidence.connection.matchmakingFindActionId), kind === "find");
      assert.equal(evidence.dialogOpen, false);
      assert.equal(evidence.activeTab, "battle");
      assert.equal(evidence.statusVisible, true);
      assert.equal(evidence.activeElement, "matchmakingStatus");
    });
  }
  await withPage("cpuSagaFindBlocked", async (page) => {
    await page.waitForFunction(() => document.activeElement?.id === "matchmakingStatus");
    await page.evaluate(() => document.getElementById("submitSetup").onclick());
    const evidence = await page.evaluate(() => ({
      cpuWrites: globalThis.__standardOnlineRuntime.calls.filter((entry) => ["cpu-start", "setup"].includes(entry.body?.operation)),
      connection: JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.connection")),
      saga: JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga")),
      setupHidden: document.getElementById("setupCard").classList.contains("hidden"),
      activeTab: document.body.dataset.activeTab,
      statusVisible: Boolean(document.getElementById("matchmakingStatus").offsetParent),
      activeElement: document.activeElement?.id,
    }));
    assert.equal(evidence.cpuWrites.length, 0);
    assert.match(evidence.connection.matchmakingFindActionId, /^[0-9a-f-]{36}$/i);
    assert.equal(evidence.saga.stage, "start");
    assert.equal(evidence.setupHidden, true);
    assert.equal(evidence.activeTab, "battle");
    assert.equal(evidence.statusVisible, true);
    assert.equal(evidence.activeElement, "matchmakingStatus");
  });
});

test("server-only active rooms recover at boot with one safe Japanese handoff", { timeout: 180000 }, async () => {
  const cases = [
    {
      mode: "activeBootPrivate",
      message: "続きの合言葉対戦が見つかりました。新しい対戦は作らず、その対戦へ戻ります。この端末では合言葉を再表示できません。",
      identity: "復帰済",
    },
    {
      mode: "activeBootPublic",
      message: "成立済みの野良対戦が見つかりました。新しい対戦は作らず、その対戦へ戻ります。",
      identity: "野良対戦",
    },
    {
      mode: "activeBootCpu",
      message: "続きのCPU戦が見つかりました。新しい対戦は作らず、その対戦へ戻ります。",
      identity: "CPU：うっかりユズ",
    },
  ];
  for (const item of cases) {
    await withPage(item.mode, async (page) => {
      await page.waitForTimeout(250);
      assert.equal(await page.locator("#matchedRoomAnnouncement").textContent(), item.message);
      assert.equal(await page.locator("#shownCode").textContent(), item.identity);
      const evidence = await page.evaluate((id) => ({
        activeRoomReads: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_active_room").length,
        successfulReads: globalThis.__standardOnlineRuntime.activeRecoverySuccessfulReads,
        createCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_create_room").length,
        setupCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "setup").length,
        openDialogs: document.querySelectorAll("dialog[open]").length,
        activeElement: document.activeElement?.id,
        forcedHeadingFocuses: globalThis.__standardOnlineFocusEvents.filter((entry) => ["setupTitle", "matchTitle"].includes(entry.id)).length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        leaked: document.body.innerText.includes(id)
          || document.body.innerText.includes("STANDARD_ALREADY_IN_ROOM")
          || document.body.innerText.includes("33333333-3333-4333-8333-333333333333")
          || document.body.innerText.includes("private sentinel"),
        announcementContract: document.getElementById("matchedRoomAnnouncement").getAttribute("role") === "status"
          && document.getElementById("matchedRoomAnnouncement").getAttribute("aria-live") === "polite"
          && document.getElementById("matchedRoomAnnouncement").getAttribute("aria-atomic") === "true",
      }), roomId);
      assert.deepEqual(evidence, {
        activeRoomReads: 1,
        successfulReads: 1,
        createCalls: 0,
        setupCalls: 0,
        openDialogs: 0,
        activeElement: "",
        forcedHeadingFocuses: 0,
        overflow: false,
        leaked: false,
        announcementContract: true,
      }, item.mode);
    }, { viewport: { width: 390, height: 844 } });
  }
});

test("a stale create collision recovers the one private, public, or CPU room without leaking the RPC sentinel", { timeout: 180000 }, async () => {
  const cases = [
    { mode: "activeCreatePrivate", identity: "復帰済", focus: "setupTitle", copy: "続きの合言葉対戦" },
    { mode: "activeCreatePublic", identity: "野良対戦", focus: "setupTitle", copy: "成立済みの野良対戦" },
    { mode: "activeCreateCpu", identity: "CPU：うっかりユズ", focus: "matchTitle", copy: "続きのCPU戦" },
  ];
  for (const item of cases) {
    await withPage(item.mode, async (page) => {
      await page.locator("#lobby:not(.hidden)").waitFor();
      await page.getByRole("button", { name: "合言葉ルームを作る" }).click();
      await page.locator("#room:not(.hidden)").waitFor();
      await page.waitForFunction((focus) => document.activeElement?.id === focus, item.focus);
      await page.waitForFunction((copy) => document.querySelector("#matchedRoomAnnouncement")?.textContent.includes(copy), item.copy);
      assert.equal(await page.locator("#shownCode").textContent(), item.identity);
      assert.match(await page.locator("#matchedRoomAnnouncement").textContent(), new RegExp(item.copy));
      const evidence = await page.evaluate((id) => ({
        createCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_create_room").length,
        activeRoomReads: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_active_room").length,
        successfulReads: globalThis.__standardOnlineRuntime.activeRecoverySuccessfulReads,
        setupCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "setup").length,
        roomId: JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.connection")).roomId,
        openDialogs: document.querySelectorAll("dialog[open]").length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        leaked: document.body.innerText.includes("STANDARD_ALREADY_IN_ROOM")
          || document.body.innerText.includes("private sentinel")
          || document.body.innerText.includes("33333333-3333-4333-8333-333333333333")
          || document.body.innerText.includes(id),
      }), roomId);
      assert.deepEqual(evidence, {
        createCalls: 1,
        activeRoomReads: 2,
        successfulReads: 1,
        setupCalls: 0,
        roomId,
        openDialogs: 0,
        overflow: false,
        leaked: false,
      }, item.mode);
    }, { viewport: { width: 390, height: 844 } });
  }
});

test("boot prioritizes a lost CPU start saga over generic active-room recovery and submits the confirmed six cards", { timeout: 130000 }, async () => {
  await withPage("cpuSagaStartServerActive", async (page) => {
    await page.waitForTimeout(1200);
    const evidence = await page.evaluate(() => ({
      operations: globalThis.__standardOnlineRuntime.calls
        .filter((entry) => ["cpu-start", "setup", "initialize"].includes(entry.body?.operation))
        .map((entry) => entry.body),
      activeRoomReads: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.name === "fcg_standard_active_room").length,
      saga: localStorage.getItem("fourColorMapGame.standard.online.v5.cpu-start-saga"),
      matchVisible: Boolean(document.querySelector("#matchCard")?.offsetParent),
    }));
    assert.deepEqual(evidence.operations.map((body) => body.operation), ["cpu-start", "setup", "initialize"]);
    assert.equal(evidence.operations[0].actionId, "77777777-7777-4777-8777-777777777777");
    assert.equal(evidence.operations[1].setupActionId, "88888888-8888-4888-8888-888888888888");
    assert.equal(evidence.activeRoomReads, 0);
    assert.equal(evidence.saga, null);
    assert.equal(evidence.matchVisible, true);
  }, { viewport: { width: 390, height: 844 } });
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

    await page.getByRole("button", { name: "再戦・対戦結果へ戻る" }).click();
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

test("actual browser clears stale CPU/setup status and keeps the exact no-color defeat reason after dismissal and reload", { timeout: 130000 }, async () => {
  await withPage("cpuTurnNoColor", async (page) => {
    await page.locator("#terminalOverlay:not(.hidden)").waitFor();
    const expectedDetail = "A は塗れる色がなくなりました。\n敗因の内訳：残っていた色 青 は、受け取った灰色エリアの隣接色 青 と重なるため置けませんでした。 封印中：黄・緑。";
    assert.equal(await page.locator("#waitingMessage").textContent(), "対戦は終了しました。下の勝敗理由と再戦メニューを確認してください。");
    assert.equal(await page.locator("#actionStatus").textContent(), "");
    assert.equal(await page.locator("#retryAction").isVisible(), false);
    assert.equal(await page.locator("#terminalOutcomeTitle").textContent(), "敗北：敗因");
    assert.equal(await page.locator("#terminalOutcomeReason").textContent(), expectedDetail);
    assert.equal(await page.locator("#terminalReasonText").textContent(), expectedDetail);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-action").length), 1);

    await page.getByRole("button", { name: "再戦・対戦結果へ戻る" }).click();
    assert.equal(await page.locator("#terminalOverlay").isVisible(), false);
    assert.equal(await page.locator("#terminalSummary").isVisible(), true);
    assert.equal(await page.locator("#terminalOutcomeReason").textContent(), expectedDetail);
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineCpuActionCount()), 1);

    await page.reload();
    await page.locator("#connectionBadge.good").waitFor({ state: "visible" });
    await page.locator("#terminalSummary:not(.hidden)").waitFor();
    await page.waitForTimeout(900);
    assert.equal(await page.locator("#terminalOverlay").isVisible(), false);
    assert.equal(await page.locator("#terminalOutcomeReason").textContent(), expectedDetail);
    assert.equal(await page.locator("#waitingMessage").textContent(), "対戦は終了しました。下の勝敗理由と再戦メニューを確認してください。");
    assert.equal(await page.locator("#actionStatus").textContent(), "");
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineCpuActionCount()), 1);
  });

  await withPage("playing", async (page) => {
    assert.equal(await page.locator("#terminalSummary").isVisible(), false);
    assert.equal(await page.locator("#terminalOutcomeReason").textContent(), "");
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      runtime.room = { ...runtime.room, status: "finished", version: 10, winner_seat: "A", public_state: {
        ...runtime.room.public_state, status: "FINISHED", phase: "GAME_OVER", version: 10, winner: "A", terminalReason: "NO_LEGAL_COLOR", pending: "R2",
        publicEffects: { A: { seals: {} }, B: { seals: { blue: 1, yellow: 1 } } },
        regions: {
          R1: { id: "R1", micro: [0], sourceMacros: [0], controllers: ["A"], color: "green", isPending: false },
          R2: { id: "R2", micro: [1], sourceMacros: [1], controllers: ["A"], color: null, isPending: true },
        },
      } };
      runtime.view = { ...runtime.view, version: 10, private_state: { ...runtime.view.private_state, privateEffects: { secretSentinel: "OPPONENT-PRIVATE-SENTINEL" } } };
      runtime.onInvalidate();
    });
    await page.locator("#terminalOverlay:not(.hidden)").waitFor();
    assert.equal(await page.locator("#terminalOutcomeTitle").textContent(), "勝利：決着理由");
    assert.equal(await page.locator("#terminalOutcomeReason").textContent(), "B は塗れる色がなくなりました。");
    assert.equal((await page.locator("#terminalSummary").textContent()).includes("OPPONENT-PRIVATE-SENTINEL"), false);
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

test("actual browser exposes one keyboard-safe recolor lab loan without touching the 19-card library", { timeout: 130000 }, async () => {
  await withPage("labPlaying", async (page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByText("対戦中・LAB（無報酬）").waitFor();
    await page.getByText("LAB貸与カード（この対戦で1回）").waitFor();
    assert.equal(await page.locator("#cardInventory").getByText("塗り直し・乱", { exact: true }).count(), 0);

    const skillButton = page.getByRole("button", { name: "塗り直し・乱 ×1" });
    await skillButton.focus();
    await page.keyboard.press("Enter");
    await page.getByText("塗り直し・乱 — 対象を指定").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "塗り直し・乱 — 対象を指定");
    assert.match(await page.getByText(/不成立でもカード・手番は減りません/).textContent(), /成功可否は確定するまで分かりません/);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "エリア1・赤");
    await page.keyboard.press("Space");
    assert.equal(await page.getByRole("button", { name: "エリア1・赤" }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "エリア1・赤");
    assert.equal(await page.getByRole("button", { name: "このエリアをランダムに塗り直す" }).isEnabled(), true);
    assert.match(await page.locator("#board").getAttribute("aria-label"), /番号と色名/);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "エリア2・青");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "このエリアをランダムに塗り直す");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "キャンセル");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.dataset?.skill === "legalRecolor");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "塗り直し・乱 ×1");
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length), 0);

    await page.keyboard.press("Enter");
    await page.getByText("塗り直し・乱 — 対象を指定").waitFor();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "エリア2・青");
    await page.keyboard.press("Enter");
    assert.equal(await page.getByRole("button", { name: "エリア2・青" }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "エリア2・青");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "このエリアをランダムに塗り直す");
    await page.keyboard.press("Space");
    const actions = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").map((entry) => entry.body.action));
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0].payload, { skill: "legalRecolor", regionId: "R2" });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      targetHidden: document.querySelector("#skillTargetControls").classList.contains("hidden"),
    }));
    assert.equal(layout.overflow, false);
    assert.equal(layout.targetHidden, true);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge restores the committed lab setup and marks later toggle changes as uncommitted", { timeout: 130000 }, async () => {
  await withPage("setupLabPersist", async (page) => {
    const labToggle = page.locator("#legalRecolorLabMode");
    await page.locator("#setupCard:not(.hidden)").waitFor();
    assert.equal(await labToggle.isChecked(), false);
    await labToggle.check();
    await page.getByRole("button", { name: "この6枚で準備完了" }).click();
    await page.getByText("準備完了。相手を待っています。開始前なら6枚を変更できます。", { exact: true }).waitFor();
    assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).committedLabMode, connectionKey), true);

    await page.reload({ waitUntil: "load" });
    await page.locator("#connectionBadge.good").waitFor();
    await page.locator("#room:not(.hidden)").waitFor();
    assert.equal(await labToggle.isChecked(), true);
    await page.getByText("準備完了。相手を待っています。開始前なら6枚を変更できます。", { exact: true }).waitFor();

    await labToggle.uncheck();
    await page.getByText(/設定の変更はまだサーバーへ反映されていません/).waitFor();
    assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).committedLabMode, connectionKey), true);
    await page.getByRole("button", { name: "変更した設定・6枚で準備し直す" }).click();
    await page.getByText("準備完了。相手を待っています。開始前なら6枚を変更できます。", { exact: true }).waitFor();
    assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).committedLabMode, connectionKey), false);
  });
});

test("actual Edge keeps a lost lab setup immutable across reload and retries the same setup ID", { timeout: 130000 }, async () => {
  await withPage("setupLabLostResponse", async (page) => {
    const labToggle = page.locator("#legalRecolorLabMode");
    await page.locator("#setupCard:not(.hidden)").waitFor();
    await labToggle.check();
    await page.getByRole("button", { name: "この6枚で準備完了" }).click();
    await page.getByRole("button", { name: "同じ準備処理を再確認" }).waitFor();
    const pending = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).pendingSetup, connectionKey);
    assert.equal(pending.labMode, true);
    assert.match(pending.setupActionId, /^[0-9a-f-]{36}$/i);
    assert.equal(await labToggle.isDisabled(), true);
    assert.equal(await page.locator('#loadoutGrid input[type="checkbox"]').first().isDisabled(), true);

    await page.reload({ waitUntil: "load" });
    await page.locator("#connectionBadge.good").waitFor();
    await page.getByRole("button", { name: "同じ準備処理を再確認" }).waitFor();
    assert.equal(await labToggle.isChecked(), true);
    assert.equal(await labToggle.isDisabled(), true);
    const beforeRetry = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).pendingSetup, connectionKey);
    assert.deepEqual(beforeRetry, pending);

    await page.getByRole("button", { name: "同じ準備処理を再確認" }).click();
    await page.getByText("準備完了。相手を待っています。開始前なら6枚を変更できます。", { exact: true }).waitFor();
    const evidence = await page.evaluate(async (key) => ({
      connection: JSON.parse(localStorage.getItem(key)),
      lifetime: await globalThis.__standardOnlineLifetimeInvocations(),
    }), connectionKey);
    const setups = evidence.lifetime.filter((body) => body.operation === "setup");
    assert.equal(setups.length, 2);
    assert.deepEqual(new Set(setups.map((body) => body.setupActionId)), new Set([pending.setupActionId]));
    assert.equal(evidence.connection.pendingSetup, null);
    assert.equal(evidence.connection.committedLabMode, true);
  });
});

test("actual Edge keeps a lab mismatch visible with the exact recovery instruction", { timeout: 130000 }, async () => {
  await withPage("setupLabMismatch", async (page) => {
    await page.locator("#setupCard:not(.hidden)").waitFor();
    const message = "ラボ設定が相手と違います。2人ともラボを同じ設定にして、もう一度6枚を準備してください。";
    await page.locator("#setupStatus").getByText(message, { exact: true }).waitFor();
    assert.equal(await page.locator("#setupStatus").textContent(), message);
    assert.equal(await page.locator("#setupStatus").getAttribute("data-tone"), "error");
    assert.equal(await page.locator("#toast").textContent(), message);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.room.status), "ready");
  });
});

test("actual Edge gacha persists one server draw and immediately hydrates inventory", { timeout: 130000 }, async () => {
  await withPage("gacha", async (page) => {
    await page.locator("#gachaPanel:not(.hidden)").waitFor();
    await page.evaluate(() => { globalThis.__standardOnlineRuntime.failNextGacha = true; });
    await page.getByRole("button", { name: "1枚引く" }).click();
    await page.getByText("抽選結果を確認できませんでした。同じ抽選IDで安全に再試行できます。").waitFor();
    assert.equal(await page.locator("#gachaDrawOne").isDisabled(), true);
    assert.equal(await page.locator("#gachaDrawAll").isDisabled(), true);
    const failedActionId = await page.evaluate(() => JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.pending-gacha")).actionId);
    await page.evaluate(() => {
      document.querySelector("#gachaDrawOne").click();
      document.querySelector("#gachaDrawAll").click();
    });
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "gacha").length), 1);
    await page.reload();
    await page.locator("#gachaPanel:not(.hidden):not(.tab-panel-hidden)").waitFor();
    assert.equal(await page.locator("#gachaDrawOne").isDisabled(), true);
    assert.equal(await page.locator("#gachaDrawAll").isDisabled(), true);
    await page.getByRole("button", { name: "同じ抽選を再確認" }).click();
    await page.getByText("1枚を獲得しました。券消費とカード付与は一度だけ保存済みです。").waitFor();
    const evidence = await page.evaluate(({ key }) => {
      const calls = globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "gacha").map((entry) => entry.body);
      return { calls, profile: JSON.parse(localStorage.getItem(key)) };
    }, { key: remoteProfileKey });
    assert.equal(evidence.calls.length, 1);
    assert.match(evidence.calls[0].actionId, /^[0-9a-f-]{36}$/i);
    assert.equal(evidence.calls[0].actionId, failedActionId);
    assert.equal(evidence.calls[0].expectedRevision, 1);
    assert.equal(evidence.calls[0].ticketLevel, 1);
    assert.equal(evidence.calls[0].count, 1);
    assert.equal(evidence.profile.gachaTickets["1"], 1);
    assert.equal(evidence.profile.inventory.colorRandomBorrow, 3);
    assert.equal(await page.locator("#gachaResults .gacha-card").count(), 1);
    assert.equal(await page.locator("#gachaCpuRematch").isHidden(), true);
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
    assert.equal(await page.locator("#quizMission").textContent(), "式を読み、「?」に入る数を求めよう");
    assert.equal(await page.locator("#quizThinkingSteps").textContent(), "考え方 1段階");

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
    assert.equal(await feedback.textContent(), "前問 Q1：○ 正解！なるほど：1 + 1 = 2");
    assert.equal(await feedback.isVisible(), true);
    const answerCalls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").map((entry) => entry.body));
    assert.equal(answerCalls.length, 2);
    assert.equal(answerCalls[0].actionId, pendingBeforeRetry.actionId);
    assert.equal(answerCalls[1].actionId, pendingBeforeRetry.actionId);
    assert.equal(answerCalls[0].answerId, answerCalls[1].answerId);
    await page.waitForTimeout(700);
    assert.equal(await feedback.evaluate((node) => node.classList.contains("emphasize")), false);
    assert.equal(await feedback.textContent(), "前問 Q1：○ 正解！なるほど：1 + 1 = 2");

    await page.locator("#quizOptions button").nth(1).click();
    await page.getByText("3 / 10", { exact: true }).waitFor();
    assert.equal(await feedback.textContent(), "前問 Q2：× おしい　正解：3なるほど：2 + 1 = 3");
    await page.getByRole("button", { name: "カード" }).click();
    await page.getByRole("button", { name: "クイズ・ガチャ" }).click();
    assert.equal(await feedback.textContent(), "前問 Q2：× おしい　正解：3なるほど：2 + 1 = 3");

    for (let questionNumber = 3; questionNumber <= 10; questionNumber += 1) {
      await page.locator("#quizOptions button").first().click();
      if (questionNumber < 10) await page.getByText(`${questionNumber + 1} / 10`, { exact: true }).waitFor();
      if (questionNumber === 4) {
        assert.equal(await page.locator("#quizStreak").textContent(), "いい流れ！ 2連続正解");
        assert.equal(await page.locator("#quizStreak").getAttribute("data-tier"), "1");
      }
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

    assert.equal(await page.locator("#quizMission").textContent(), "条件を整理して、速さの答えを求めよう");
    assert.equal(await page.locator("#quizFormatLabel").textContent(), "🎯 文章を整理");
    assert.equal(await page.locator("#quizThinkingSteps").textContent(), "考え方 3段階");
    assert.equal(await page.locator("#quizMission").evaluate((node) => node.scrollWidth <= node.clientWidth), true);

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

test("actual Edge finishes one quiz answer and its feedback before handing a waiting player to setup", { timeout: 130000 }, async () => {
  await withPage("handoffActivity", async (page) => {
    await page.evaluate(() => {
      globalThis.__standardOnlineRuntime.matchAnnouncements = [];
      globalThis.__standardOnlineRuntime.feedbackAt = null;
      globalThis.__standardOnlineRuntime.battleAt = null;
      new MutationObserver(() => globalThis.__standardOnlineRuntime.matchAnnouncements.push(document.querySelector("#matchedRoomAnnouncement").textContent))
        .observe(document.querySelector("#matchedRoomAnnouncement"), { childList: true, characterData: true, subtree: true });
      new MutationObserver(() => {
        if (document.querySelector("#quizAnswerFeedback").textContent) globalThis.__standardOnlineRuntime.feedbackAt ||= performance.now();
      }).observe(document.querySelector("#quizAnswerFeedback"), { childList: true, characterData: true, subtree: true });
      new MutationObserver(() => {
        if (document.body.dataset.activeTab === "battle" && document.querySelector("#matchedRoomAnnouncement").textContent) {
          globalThis.__standardOnlineRuntime.battleAt ||= performance.now();
        }
      }).observe(document.body, { attributes: true, attributeFilter: ["data-active-tab"] });
    });
    await page.getByRole("button", { name: "対戦相手を募集" }).click();
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    await page.getByRole("button", { name: "10問チャレンジ開始" }).click();
    await page.locator("#quizOptions button").first().click();
    await page.evaluate(() => {
      globalThis.__standardOnlineRuntime.matchNow = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => document.querySelector("#matchedRoomAnnouncement")?.textContent === "対戦相手が見つかりました。6枚セットを選んでください。");
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "quiz");
    assert.equal(await page.locator("#returnToMatchedRoom").isDisabled(), true);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length), 1);
    await page.getByText(/前問 Q1：○ 正解！/).waitFor();
    await page.locator("body[data-active-tab='battle']").waitFor();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    await page.locator("#returnToMatchedRoom").focus();
    await page.keyboard.press("Enter");
    await page.locator("body[data-active-tab='battle']").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "setupTitle");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "setupTitle");
    const evidence = await page.evaluate(() => ({
      announcements: globalThis.__standardOnlineRuntime.matchAnnouncements,
      answers: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").map((entry) => entry.body),
      feedbackDuration: globalThis.__standardOnlineRuntime.battleAt - globalThis.__standardOnlineRuntime.feedbackAt,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.equal(evidence.announcements.length, 1);
    assert.equal(evidence.answers.length, 1);
    assert.match(evidence.answers[0].actionId, /^[0-9a-f-]{36}$/i);
    assert.ok(evidence.feedbackDuration >= 500, JSON.stringify(evidence));
    assert.equal(evidence.overflow, false);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge settles an in-flight quiz start without starting a hidden question clock", { timeout: 130000 }, async () => {
  await withPage("handoffStart", async (page) => {
    await page.getByRole("button", { name: "対戦相手を募集" }).click();
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    await page.getByRole("button", { name: "10問チャレンジ開始" }).click();
    await page.evaluate(() => {
      globalThis.__standardOnlineRuntime.matchNow = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => document.querySelector("#matchedRoomAnnouncement")?.textContent === "対戦相手が見つかりました。6枚セットを選んでください。");
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "quiz");
    assert.equal(await page.locator("#returnToMatchedRoom").isDisabled(), true);
    await page.locator("body[data-active-tab='battle']").waitFor();
    assert.equal(await page.locator("#matchedRoomHandoff").isVisible(), false);
    await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length), 0);
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    assert.equal(await page.locator("#quizOptions button:not([disabled])").count(), 0);
    assert.match(await page.locator("#quizStatus").textContent(), /一時停止/);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge waits for a pending quiz from another tab and locks later answers after handoff", { timeout: 130000 }, async () => {
  await withPage("handoffActivity", async (page) => {
    await page.getByRole("button", { name: "対戦相手を募集" }).click();
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    await page.getByRole("button", { name: "10問チャレンジ開始" }).click();
    await page.getByRole("button", { name: "カード", exact: true }).click();
    await page.evaluate(() => {
      globalThis.__standardOnlineRuntime.matchNow = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => document.querySelector("#matchedRoomAnnouncement")?.textContent === "対戦相手が見つかりました。6枚セットを選んでください。");
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "cards");
    assert.equal(await page.locator("#returnToMatchedRoom").isDisabled(), true);
    await page.getByRole("button", { name: "対戦", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.id === "matchedRoomHandoffTitle");
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "cards");
    await page.waitForTimeout(400);
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "cards");
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    assert.ok(await page.locator("#quizOptions button:not([disabled])").count() > 0);
    await page.locator("#quizOptions button:not([disabled])").first().click();
    await page.getByText(/前問 Q1：○ 正解！/).waitFor();
    await page.locator("body[data-active-tab='battle']").waitFor();
    assert.equal(await page.locator("#matchedRoomHandoff").isVisible(), false);
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    assert.equal(await page.locator("#quizOptions button:not([disabled])").count(), 0);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length), 1);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge waits for one gacha result before handing a waiting player to setup", { timeout: 130000 }, async () => {
  await withPage("handoffActivity", async (page) => {
    await page.getByRole("button", { name: "対戦相手を募集" }).click();
    await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
    await page.getByRole("button", { name: "1枚引く" }).click();
    await page.evaluate(() => {
      globalThis.__standardOnlineRuntime.matchNow = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => document.querySelector("#matchedRoomAnnouncement")?.textContent === "対戦相手が見つかりました。6枚セットを選んでください。");
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "quiz");
    assert.equal(await page.locator("#returnToMatchedRoom").isDisabled(), true);
    await page.locator("body[data-active-tab='battle']").waitFor();
    assert.match(await page.locator("#gachaStatus").textContent(), /1枚を獲得しました/);
    const draws = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "gacha").map((entry) => entry.body));
    assert.equal(draws.length, 1);
    assert.match(draws[0].actionId, /^[0-9a-f-]{36}$/i);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge safely restores a retained public room from another tab", { timeout: 130000 }, async () => {
  await withPage("handoffReload", async (page) => {
    await page.locator("body[data-active-tab='battle']").waitFor();
    await page.waitForFunction(() => document.querySelector("#matchedRoomAnnouncement")?.textContent === "成立済みの野良対戦があります。");
    assert.equal(await page.locator("#matchedRoomAnnouncement").textContent(), "成立済みの野良対戦があります。");
    assert.equal(await page.locator("#setupCard").evaluate((node) => node.classList.contains("hidden")), false);
    assert.equal(await page.locator("#matchedRoomHandoff").isVisible(), false);
    assert.equal(await page.locator("#connectionCard").evaluate((node) => node.classList.contains("has-matched-room")), false);
    const remainingBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).questionState.remainingMs, pendingQuizKey);
    await page.waitForTimeout(1200);
    const frozen = await page.evaluate((key) => ({
      remaining: JSON.parse(localStorage.getItem(key)).questionState.remainingMs,
      answerCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length,
    }), pendingQuizKey);
    assert.equal(frozen.remaining, remainingBefore);
    assert.equal(frozen.answerCalls, 0);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual Edge resumes a retained quiz after private, CPU, finished-public, and stale rooms are classified", { timeout: 240000 }, async () => {
  for (const mode of ["quizReloadPrivate", "quizReloadCpu", "quizReloadPublicFinished", "quizReloadStale"]) {
    await withPage(mode, async (page) => {
      browserStage(`${mode}-classification-start`);
      if (mode === "quizReloadStale") await page.waitForFunction(() => !document.querySelector("#lobby")?.classList.contains("hidden"));
      else await page.waitForFunction(() => !document.querySelector("#roomStatus")?.textContent.includes("読み込み中"));
      browserStage(`${mode}-classification-ready`);
      await page.waitForFunction(() => document.body.dataset.activeTab === "quiz"
        && !document.querySelector("#quizStatus")?.textContent.includes("一時停止")
        && document.querySelectorAll("#quizOptions button:not([disabled])").length > 0);
      browserStage(`${mode}-quiz-running`);
      const before = await page.evaluate((key) => ({
        remaining: JSON.parse(localStorage.getItem(key)).questionState.remainingMs,
        answers: JSON.parse(localStorage.getItem(key)).answers,
        calls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").map((entry) => entry.body),
        percent: Number.parseFloat(document.querySelector("#quizTimeBar").style.width),
      }), pendingQuizKey);
      await page.waitForTimeout(600);
      const running = await page.evaluate(() => ({
        percent: Number.parseFloat(document.querySelector("#quizTimeBar").style.width),
        answerCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length,
      }));
      assert.ok(before.remaining > 29000, `${mode}: ${before.remaining}`);
      assert.ok(before.percent > 48, `${mode}: ${before.percent}`);
      assert.ok(running.percent < before.percent - 0.3, `${mode}: ${before.percent} -> ${running.percent}`);
      assert.equal(running.answerCalls, 0, JSON.stringify({ mode, before, running }));
    }, { viewport: { width: 390, height: 844 }, bodyTimeout: 30_000 });
  }
});

test("actual Edge preserves paused quiz time across finish and missing-room cleanup until quiz is opened", { timeout: 240000 }, async () => {
  for (const cleanup of ["finished", "missing"]) {
    await withPage("handoffStart", async (page) => {
      await page.getByRole("button", { name: "対戦相手を募集" }).click();
      await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
      await page.getByRole("button", { name: "10問チャレンジ開始" }).click();
      await page.evaluate(() => {
        globalThis.__standardOnlineRuntime.matchNow = true;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.locator("body[data-active-tab='battle']").waitFor();
      const remainingBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).questionState.remainingMs, pendingQuizKey);
      if (cleanup === "finished") {
        await page.evaluate(() => {
          globalThis.__standardOnlineRuntime.room = { ...globalThis.__standardOnlineRuntime.room, status: "finished" };
          globalThis.__standardOnlineRuntime.onInvalidate?.({});
        });
        await page.locator("#roomStatus").getByText("対戦終了", { exact: true }).waitFor();
      } else {
        await page.evaluate(() => {
          globalThis.__standardOnlineRuntime.missingRoom = true;
          window.dispatchEvent(new Event("focus"));
        });
        await page.locator("#lobby:not(.hidden)").waitFor();
      }
      await page.waitForTimeout(1400);
      const paused = await page.evaluate((key) => ({
        pending: JSON.parse(localStorage.getItem(key)),
        answerCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length,
      }), pendingQuizKey);
      assert.equal(paused.answerCalls, 0, cleanup);
      assert.equal(paused.pending.questionState.remainingMs, remainingBefore, cleanup);
      await page.getByRole("button", { name: "クイズ・ガチャ", exact: true }).click();
      await page.waitForFunction(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length === 1);
      assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "quiz-answer").length), 1, cleanup);
    }, { viewport: { width: 390, height: 844 }, bodyTimeout: 55_000 });
  }
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

test("actual Edge hydrates a CPU win once, routes its earned ticket deliberately, and keeps progression after reload", { timeout: 150000 }, async () => {
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
    const rewardCta = page.getByRole("button", { name: "獲得したLv.1券でガチャへ" });
    await rewardCta.waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "terminalClose");
    const terminalLayout = await page.evaluate(() => {
      const dialog = document.querySelector(".terminal-celebration").getBoundingClientRect();
      const reward = document.querySelector("#terminalGoGacha").getBoundingClientRect();
      const close = document.querySelector("#terminalClose").getBoundingClientRect();
      return {
        dialog: { top: dialog.top, bottom: dialog.bottom },
        reward: { top: reward.top, bottom: reward.bottom },
        close: { top: close.top, bottom: close.bottom },
        dialogClientHeight: document.querySelector(".terminal-celebration").clientHeight,
        dialogScrollHeight: document.querySelector(".terminal-celebration").scrollHeight,
        viewportHeight: innerHeight,
      };
    });
    assert.ok(terminalLayout.dialog.top >= 0 && terminalLayout.dialog.bottom <= terminalLayout.viewportHeight, JSON.stringify(terminalLayout));
    assert.ok(terminalLayout.reward.top >= 0 && terminalLayout.close.bottom <= terminalLayout.viewportHeight, JSON.stringify(terminalLayout));
    assert.ok(terminalLayout.dialogScrollHeight <= terminalLayout.dialogClientHeight + 1, JSON.stringify(terminalLayout));
    await rewardCta.click();
    await page.locator("#gachaPanel:not(.hidden)").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "gachaTitle");
    await page.waitForFunction(() => {
      const draw = document.querySelector("#gachaDrawOne").getBoundingClientRect();
      const tabs = document.querySelector(".app-tabs").getBoundingClientRect();
      return draw.top >= 0 && draw.bottom <= tabs.top;
    });
    const routed = await page.evaluate(({ key }) => {
      const draw = document.querySelector("#gachaDrawOne").getBoundingClientRect();
      const tabs = document.querySelector(".app-tabs").getBoundingClientRect();
      return {
        activeTab: document.body.dataset.activeTab,
        level: document.querySelector("#gachaLevel").value,
        roomStatus: globalThis.__standardOnlineRuntime.room.status,
        storedRoomId: JSON.parse(localStorage.getItem(key)).roomId,
        gachaCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "gacha").length,
        drawVisible: draw.top >= 0 && draw.bottom <= tabs.top,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    }, { key: connectionKey });
    assert.deepEqual(routed, { activeTab: "quiz", level: "1", roomStatus: "finished", storedRoomId: roomId, gachaCalls: 0, drawVisible: true, overflow: false });
    const selectedBeforeDraw = await page.locator('input[name="loadout-color"]:checked').evaluateAll((nodes) => nodes.map((node) => node.value));
    assert.equal(selectedBeforeDraw.includes("colorPrism"), false);
    await page.getByRole("button", { name: "1枚引く" }).click();
    await page.getByText("1枚を獲得しました。券消費とカード付与は一度だけ保存済みです。").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "gachaResults");
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "gacha").length), 1);
    assert.equal(await page.locator("#gachaResultAnnouncement").textContent(), "1枚獲得。1種類、最高レアリティ星1。詳しくは獲得カード一覧で確認できます。");
    assert.match(await page.locator("#gachaResults .gacha-card").textContent(), /四色解放.*4色を使える/s);
    assert.equal(await page.locator("#gachaResults").getAttribute("role"), "list");
    assert.equal(await page.locator("#gachaResults .gacha-card").getAttribute("role"), "listitem");
    assert.equal(await page.locator('input[name="loadout-color"][value="colorPrism"]').isChecked(), false);
    assert.deepEqual(await page.locator('input[name="loadout-color"]:checked').evaluateAll((nodes) => nodes.map((node) => node.value)), selectedBeforeDraw);
    assert.equal(await page.locator('input[name="loadout-color"][value="colorPrism"]').locator("xpath=..").locator(".loadout-owned").textContent(), "所持 ×3");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-rematch").length), 0);
    const resultCta = page.getByRole("button", { name: "6枚を選び直して同じCPUと再戦" });
    await resultCta.waitFor();
    await page.waitForFunction(() => {
      const cta = document.querySelector("#gachaCpuRematch").getBoundingClientRect();
      const tabs = document.querySelector(".app-tabs").getBoundingClientRect();
      return cta.top >= 0 && cta.bottom <= tabs.top;
    });
    assert.notEqual(await page.evaluate(() => sessionStorage.getItem("fourColorMapGame.standard.online.v5.cpu-reward-gacha-result")), null);
    await page.reload();
    await page.locator("#connectionBadge.good").waitFor();
    await page.locator("#gachaPanel:not(.hidden):not(.tab-panel-hidden)").waitFor();
    await page.getByRole("button", { name: "6枚を選び直して同じCPUと再戦" }).waitFor();
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "gacha").length), 0);
    await page.evaluate(() => {
      document.querySelector("#gachaCpuRematch").click();
      document.querySelector("#gachaCpuRematch").click();
    });
    await page.locator("#setupCard:not(.hidden):not(.tab-panel-hidden)").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "setupTitle");
    const continuation = await page.evaluate(({ key }) => ({
      activeTab: document.body.dataset.activeTab,
      roomStatus: globalThis.__standardOnlineRuntime.room.status,
      cpuRematches: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-rematch").length,
      gachaCalls: globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "gacha").length,
      stored: JSON.parse(localStorage.getItem(key)),
      continuationResult: sessionStorage.getItem("fourColorMapGame.standard.online.v5.cpu-reward-gacha-result"),
    }), { key: connectionKey });
    assert.equal(continuation.activeTab, "battle");
    assert.equal(continuation.roomStatus, "ready");
    assert.equal(continuation.cpuRematches, 1);
    assert.equal(continuation.gachaCalls, 0);
    assert.equal(continuation.stored.setupRevision, 0);
    assert.equal(continuation.stored.rematchActionId, null);
    assert.equal(continuation.continuationResult, null);
    const restored = await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key)), { key: remoteProfileKey });
    assert.equal(restored.cpuStats.wins, 1);
    assert.equal(restored.cpuCharacterStats.yuzu.matches, 1);
    assert.equal(restored.gachaTickets["1"], 2);
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "action").length), 0);
  }, { bodyTimeout: 65_000, viewport: { width: 390, height: 844 } });
});

test("CPU reward copy requires a saved CPU settlement", { timeout: 150000 }, async () => {
  await withPage("finished", async (page) => {
    await page.getByText("戦績を保存しました：対人戦 勝利 4").waitFor();
    assert.doesNotMatch(await page.locator("#terminalProgressText").textContent(), /完了報酬/);
    assert.equal(await page.locator("#terminalGoGacha").isHidden(), true);
  });
  await withPage("finishedCpu", async (page) => {
    await page.getByText("戦績を同期しています。マイページで確認できます。").waitFor();
    assert.doesNotMatch(await page.locator("#terminalProgressText").textContent(), /完了報酬/);
    assert.equal(await page.locator("#terminalGoGacha").isHidden(), true);
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const matchId = runtime.room.public_state.matchId;
      runtime.profile = { ...runtime.profile, revision: runtime.profile.revision + 1, profile_state: {
        ...runtime.profile.profile_state,
        cpuStats: { ...runtime.profile.profile_state.cpuStats, wins: 1 },
        matchHistory: [{ matchId, result: "WIN", onlineOpponentKind: "cpu", terminalReason: "SURRENDER" }, ...runtime.profile.profile_state.matchHistory],
      } };
      runtime.room = { ...runtime.room, public_state: { ...runtime.room.public_state, debugUnlimitedSkills: true } };
      runtime.onInvalidate();
    });
    await page.locator("#terminalProgressText").filter({ hasText: "実験対戦のため、戦績・報酬・在庫は変わりません。" }).waitFor();
    assert.doesNotMatch(await page.locator("#terminalProgressText").textContent(), /完了報酬/);
    assert.equal(await page.locator("#terminalGoGacha").isHidden(), true);
  });
});

test("actual Edge rematches the same visible CPU and returns the human to fresh setup", { timeout: 130000 }, async () => {
  await withPage("finishedCpu", async (page) => {
    await page.getByRole("button", { name: "再戦・対戦結果へ戻る" }).click();
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
    await page.getByRole("button", { name: "再戦・対戦結果へ戻る" }).click();
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
    await page.getByRole("button", { name: "せっかちレンを選んで6枚を確認" }).click();
    await page.locator("#setupCard:not(.hidden)").waitFor();
    assert.equal(await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-start").length), 0);
    await page.getByRole("button", { name: "このCPU・6枚で対戦開始" }).click();
    await page.locator("#matchCard:not(.hidden)").waitFor();
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
    const calls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls
      .filter((entry) => entry.kind === "rpc" && entry.name !== "fcg_standard_active_room")
      .map((entry) => entry.name));
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
    assert.equal(await page.locator("#setupCommitTitle").textContent(), "6枚を選択済み・準備OK");
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

test("actual browser presents a committed contact cascade once and keeps a public tactical trace", { timeout: 120000 }, async () => {
  await withPage("playing", async (page) => {
    await page.evaluate(() => {
      globalThis.__contactEvidence = { stages: [], announcements: [], startedAt: 0, hiddenAt: 0 };
      const evidence = globalThis.__contactEvidence;
      const reveal = document.querySelector("#contactReveal");
      const title = document.querySelector("#contactRevealTitle");
      const announcement = document.querySelector("#contactRevealAnnouncement");
      let lastTitle = "";
      const recordVisual = () => {
        if (!reveal.classList.contains("hidden") && title.textContent && title.textContent !== lastTitle) {
          if (!evidence.startedAt) evidence.startedAt = performance.now();
          lastTitle = title.textContent;
          evidence.stages.push({ title: title.textContent, at: performance.now() });
        }
        if (reveal.classList.contains("hidden") && evidence.startedAt) evidence.hiddenAt = performance.now();
      };
      new MutationObserver(recordVisual).observe(reveal, { subtree: true, childList: true, attributes: true, characterData: true });
      new MutationObserver(() => {
        if (announcement.textContent) evidence.announcements.push(announcement.textContent);
      }).observe(announcement, { childList: true, characterData: true });
    });
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const state = runtime.room.public_state;
      const version = 10;
      const matchId = state.matchId;
      runtime.room = { ...runtime.room, version, public_state: {
        ...state, version, turn: 4, active: "B", phase: "COLOR", pending: "R1",
        regions: { R1: { id: "R1", micro: [5], sourceMacros: [5], controllers: ["A"], color: null, isPending: true } },
        lastPublicTrace: { eventId: `${matchId}:${version}`, version, type: "CREATE_REGION", actor: "A", regionId: "R1", sourceMacroCount: 1, contactColorCount: 3 },
      } };
      runtime.onInvalidate?.({});
    });
    await page.locator("#contactRevealTitle").filter({ hasText: "三色圧力" }).waitFor({ timeout: 5000 });
    assert.equal(await page.locator("#tacticalTrace").isVisible(), true);
    assert.match(await page.locator("#tacticalTraceAction").textContent(), /あなたが1マスを渡した/);
    assert.match(await page.locator("#tacticalTraceChange").textContent(), /3色に接している/);
    assert.match(await page.locator("#tacticalTraceNext").textContent(), /相手が、隣接色と違う持ち色を選ぶ/);
    const box = await page.locator("#contactRevealCard").boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844);
    const contactIntercepted = await page.evaluate(() => {
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return document.querySelector("#contactReveal").contains(hit);
    });
    assert.equal(contactIntercepted, false);
    await page.locator("#contactReveal").waitFor({ state: "hidden", timeout: 5000 });
    const first = await page.evaluate(() => structuredClone(globalThis.__contactEvidence));
    assert.deepEqual(first.stages.map((entry) => entry.title), ["二色接触！", "三色圧力!!"]);
    assert.deepEqual(first.announcements, ["三色圧力!! 3色に接する強いエリア"]);
    assert.ok(first.hiddenAt - first.startedAt < 1500, `cascade lasted ${first.hiddenAt - first.startedAt}ms`);
    await page.evaluate(() => globalThis.__standardOnlineRuntime.onInvalidate?.({}));
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => globalThis.__contactEvidence.stages.length), 2);
    assert.equal(await page.locator("#contactReveal").isHidden(), true);
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const version = 11;
      const matchId = runtime.room.public_state.matchId;
      runtime.room = { ...runtime.room, version, public_state: {
        ...runtime.room.public_state, version, active: "B", phase: "WORK", pending: null,
        regions: { R1: { ...runtime.room.public_state.regions.R1, color: "green", isPending: false } },
        lastPublicTrace: { eventId: `${matchId}:${version}`, version, type: "COLOR_REGION", actor: "B", regionId: "R1", color: "green" },
      } };
      runtime.onInvalidate?.({});
    });
    await page.waitForFunction(() => document.querySelector("#tacticalTraceAction")?.textContent === "相手が緑で塗った");
    assert.match(await page.locator("#tacticalTraceChange").textContent(), /受け取ったエリアが緑の領域になった/);
    assert.equal(await page.evaluate(() => globalThis.__contactEvidence.stages.length), 2);
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const version = 12;
      const matchId = runtime.room.public_state.matchId;
      runtime.room = { ...runtime.room, version, public_state: {
        ...runtime.room.public_state, version,
        lastPublicTrace: { eventId: `${matchId}:${version}`, version, type: "USE_SKILL", actor: "B" },
      } };
      runtime.onInvalidate?.({});
    });
    await page.waitForFunction(() => document.querySelector("#tacticalTraceAction")?.textContent === "相手がスキルを使った");
    assert.match(await page.locator("#tacticalTraceChange").textContent(), /公開結果が盤面と対戦状態に反映された/);
    assert.equal(await page.evaluate(() => globalThis.__contactEvidence.stages.length), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }, { viewport: { width: 390, height: 844 } });
});

test("actual browser reduced motion skips intermediate contact stages and terminal UI wins", { timeout: 120000 }, async () => {
  await withPage("playing", async (page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      globalThis.__reducedContactTitles = [];
      const reveal = document.querySelector("#contactReveal");
      const title = document.querySelector("#contactRevealTitle");
      let prior = "";
      new MutationObserver(() => {
        if (!reveal.classList.contains("hidden") && title.textContent && title.textContent !== prior) {
          prior = title.textContent;
          globalThis.__reducedContactTitles.push(prior);
        }
      }).observe(reveal, { subtree: true, childList: true, attributes: true, characterData: true });
      const runtime = globalThis.__standardOnlineRuntime;
      const state = runtime.room.public_state;
      const version = 10;
      const matchId = state.matchId;
      runtime.room = { ...runtime.room, version, public_state: {
        ...state, version, active: "B", phase: "COLOR", pending: "R1",
        regions: { R1: { id: "R1", micro: [5], sourceMacros: [5], controllers: ["A"], color: null, isPending: true } },
        lastPublicTrace: { eventId: `${matchId}:${version}`, version, type: "CREATE_REGION", actor: "A", regionId: "R1", sourceMacroCount: 1, contactColorCount: 3 },
      } };
      runtime.onInvalidate?.({});
    });
    await page.locator("#contactRevealTitle").filter({ hasText: "三色圧力" }).waitFor({ timeout: 5000 });
    const box = await page.locator("#contactRevealCard").boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 980 && box.y + box.height <= 844);
    assert.equal(await page.locator("#contactRevealAnnouncement").textContent(), "三色圧力!! 3色に接する強いエリア");
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => globalThis.__reducedContactTitles), ["三色圧力!!"]);
    const motion = await page.locator("#contactRevealCard").evaluate((node) => {
      const style = getComputedStyle(node);
      return { animation: style.animationName, transition: style.transitionDuration };
    });
    assert.equal(motion.animation, "none");
    assert.equal(motion.transition, "0s");
    await page.evaluate(() => {
      const runtime = globalThis.__standardOnlineRuntime;
      const version = 11;
      const matchId = runtime.room.public_state.matchId;
      runtime.room = { ...runtime.room, status: "finished", version, winner_seat: "A", public_state: {
        ...runtime.room.public_state, status: "FINISHED", phase: "GAME_OVER", version, winner: "A", terminalReason: "NO_LEGAL_COLOR",
        lastPublicTrace: { eventId: `${matchId}:${version}`, version, type: "CREATE_REGION", actor: "A", regionId: "R2", sourceMacroCount: 1, contactColorCount: 4 },
      } };
      runtime.onInvalidate?.({});
    });
    await page.locator("#terminalOverlay").waitFor({ state: "visible", timeout: 5000 });
    assert.match(await page.locator("#terminalReasonText").textContent(), /四色包囲（2 → 3 → 4色接触）/);
    assert.equal(await page.locator("#contactReveal").isHidden(), true);
    assert.equal(await page.locator("#tacticalTrace").isHidden(), true);
    assert.equal(await page.locator("#contactRevealAnnouncement").textContent(), "");
  }, { viewport: { width: 980, height: 844 } });
});
