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
    const initialTab = ["gacha", "quiz"].includes(initialMode) ? "quiz" : initialMode === "cosmetic" ? "profile" : initialMode === "empty" ? "home" : "battle";
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
      if (!["lobby", "cosmetic", "quiz", "publicFind", "cpuWait"].includes(initialMode)) {
        localStorage.setItem(connection, JSON.stringify({
          roomId: id, roomCode: "A1B2C3", profileRevision: 1, setupRevision: 3,
          rematchActionId: initialMode === "finished" ? pendingId : null,
          rematchExpectedVersion: initialMode === "finished" ? 9 : null,
        }));
      } else if (initialMode === "cpuWait") {
        localStorage.setItem(connection, JSON.stringify({
          roomId: null, roomCode: null, profileRevision: 1, setupRevision: 0,
          matchmakingTicketId: pendingId, matchmakingStartedAt: new Date(Date.now() - 91000).toISOString(), matchmakingFindActionId: null,
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
      matchHistory: [{ matchId: "history-1", result: "WIN", terminalReason: "BOARD_LOCK", endedAt: "2026-09-01T00:00:00.000Z", fullPaint: true, skillsUsed: 0 }],
    };
    if (initialMode === "cosmetic") {
      try { Object.assign(profileState, JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.remote-profile") || "null") || {}); } catch { /* fresh mock profile */ }
    }
    if (initialMode === "cpuTurn") active.active = "B";
    const runtime = {
      waitStartedAt: initialMode === "cpuWait" ? new Date(Date.now() - 91000).toISOString() : new Date().toISOString(),
      room: { id, status: ["finished", "finishedCpu"].includes(initialMode) ? "finished" : initialMode === "publicFind" ? "ready" : "playing", version: 9, game_mode: "standard_v5", access_mode: ["cpuTurn", "finishedCpu"].includes(initialMode) ? "cpu" : initialMode === "publicFind" ? "public_queue" : "private_code", opponent_kind: ["cpuTurn", "finishedCpu"].includes(initialMode) ? "cpu" : "human", cpu_character_id: ["cpuTurn", "finishedCpu"].includes(initialMode) ? "yuzu" : null, public_state: ["finished", "finishedCpu"].includes(initialMode) ? finished : initialMode === "publicFind" ? null : active },
      view: initialMode === "publicFind" ? null : { seat: "A", version: 9, private_state: { hand: { areaDiePlus: 1, areaResize: 1 }, basicPalette: ["red", "blue"], bonusColor: "yellow", bonusUsesRemaining: 2, privateEffects: {} } },
      profile: initialMode === "empty" ? null : { revision: 1, display_name: "A", profile_state: profileState },
      gachaReceipts: {},
      cardSaleReceipts: {},
      cosmeticReceipts: {},
      calls: [],
    };
    runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false, appearance: { nameplate: "nameplateDefault", title: "titleNone" } }, { user_id: "44444444-4444-4444-8444-444444444444", seat: "B", display_name: ["cpuTurn", "finishedCpu"].includes(initialMode) ? "うっかりユズ" : "B", is_cpu: ["cpuTurn", "finishedCpu"].includes(initialMode), appearance: { nameplate: "nameplateGold", title: "titleArtisan" } }];
    const cosmeticProjection = () => ({
      coins: runtime.profile.profile_state.coins,
      equipped: runtime.profile.profile_state.equipped,
      items: [
        { cosmeticId: "boardDefault", name: "標準盤面", type: "board", price: 0, preview: "DEFAULT", previewClass: "", trophyId: null, trophyUnlocked: true, owned: true, equipped: runtime.profile.profile_state.equipped.board === "boardDefault" },
        { cosmeticId: "boardAurora", name: "オーロラ盤面", type: "board", price: 600, preview: "AURORA", previewClass: "aurora", trophyId: null, trophyUnlocked: true, owned: runtime.profile.profile_state.cosmeticsOwned.includes("boardAurora"), equipped: runtime.profile.profile_state.equipped.board === "boardAurora" },
        { cosmeticId: "titleArtisan", name: "四色の匠", type: "title", price: 0, preview: "四色の匠", previewClass: "prism", trophyId: "noSkillFullPaint", trophyUnlocked: true, owned: true, equipped: runtime.profile.profile_state.equipped.title === "titleArtisan" },
      ],
    });
    globalThis.__standardOnlineRuntime = runtime;
    const resultFor = (table) => table === "fcg_rooms" ? runtime.room
      : table === "fcg_room_members" ? runtime.members
        : table === "fcg_player_views" ? runtime.view
          : runtime.profile;
    globalThis.__standardOnlineMockSupabase = {
      auth: { getSession: async () => ({ data: { session: { user: { id: "33333333-3333-4333-8333-333333333333" } } } }), signInAnonymously: async () => { throw new Error("unexpected sign-in"); } },
      functions: { invoke: async (name, request) => {
        runtime.calls.push({ kind: "invoke", name, body: request.body });
        if (request.body.operation === "profile") {
          runtime.profile = { revision: 1, display_name: request.body.displayName, profile_state: request.body.profileState };
          return { data: { revision: 1, displayName: request.body.displayName, profileState: request.body.profileState } };
        }
        if (request.body.operation === "quiz-start") {
          const questions = Array.from({ length: 10 }, (_, index) => ({
            number: index + 1,
            templateId: "add",
            category: "たし算",
            prompt: `${index + 1} + 1 = ?`,
            math: { kind: "expression", value: `${index + 1} + 1 = ?` },
            hintOptions: ["たし算：同じ位どうしを足す", "円の面積：S = πr²", "2次の行列式：det A = ad − bc"],
            hintDurationMs: 2500,
            timeLimitSeconds: 10,
            options: Array.from({ length: 6 }, (_, optionIndex) => ({ id: `q${index + 1}-${optionIndex + 1}`, label: String(index + optionIndex + 2) })),
          }));
          return { data: { sessionId: "66666666-6666-4666-8666-666666666666", duplicate: false, selectedLevel: request.body.selectedLevel, expiresAt: "2099-01-01T00:00:00.000Z", questions, timeoutAnswerId: "__timeout__" } };
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
        if (request.body.operation === "cpu-accept") {
          runtime.room = { ...runtime.room, status: "ready", access_mode: "cpu", opponent_kind: "cpu", cpu_character_id: request.body.characterId, public_state: null };
          runtime.view = null;
          runtime.members = [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A", is_cpu: false }, { user_id: "55555555-5555-4555-8555-555555555555", seat: "B", display_name: "うっかりユズ", is_cpu: true }];
          return { data: { matchmakingStatus: "matched", roomId: id, seat: "A", characterId: request.body.characterId, duplicate: false } };
        }
        if (request.body.operation === "cpu-action") {
          runtime.room = { ...runtime.room, version: runtime.room.version + 1, public_state: { ...runtime.room.public_state, version: runtime.room.version + 1, active: "A" } };
          runtime.view = { ...runtime.view, version: runtime.room.version };
          return { data: { duplicate: false, room: runtime.room } };
        }
        if (request.body.operation === "cpu-rematch") {
          runtime.room = { ...runtime.room, status: "ready", version: runtime.room.version + 1, public_state: {} };
          runtime.view = null;
          return { data: { roomStatus: "ready", roomVersion: runtime.room.version, readyToSetup: true, duplicate: false } };
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

async function withPage(mode, run) {
  assert.ok(chromium, "Playwright is required");
  assert.ok(fs.existsSync(browserPath), `${browserName} browser is required`);
  let browser;
  let context;
  const { server, url } = await startServer();
  try {
    browser = await chromium.launch({ executablePath: browserPath, headless: true, timeout: 15_000 });
    context = await browser.newContext({ viewport: { width: 900, height: 800 } });
    await installMock(context, mode);
    const page = await context.newPage();
    await page.goto(`${url}/standard-online-v5/index.html`);
    await page.locator("#connectionBadge.good").waitFor();
    await run(page);
  } finally {
    try {
      await context?.close();
    } finally {
      try {
        await browser?.close();
      } finally {
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections?.();
        });
      }
    }
  }
}

test("actual Edge carries a fresh player from the home CTA through profile sync to the visible battle lobby", { timeout: 30000 }, async () => {
  await withPage("empty", async (page) => {
    await page.locator("#starterCreator:not(.hidden)").waitFor();
    assert.equal(await page.locator("#profileSelect option").count(), 0);
    assert.equal(await page.locator("#syncProfile").isDisabled(), true);
    await page.getByRole("button", { name: "対戦を始める" }).click();
    await page.locator("#starterName").waitFor({ state: "visible" });
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "battle");
    assert.equal(await page.locator("#profileCard").isVisible(), true);
    assert.equal(await page.locator("#lobby").isVisible(), false);
    await page.locator("#starterName").fill("新規プレイヤー");
    await page.getByRole("button", { name: "はじめて用プロフィールを作る" }).click();
    assert.equal(await page.locator("#profileSelect option").count(), 1);
    assert.equal(await page.locator('#loadoutGrid input[type="checkbox"]:checked').count(), 6);
    const evidence = await page.evaluate(({ save, starter }) => {
      const profile = JSON.parse(localStorage.getItem(starter));
      return { localSave: localStorage.getItem(save), name: profile.displayName, inventory: profile.inventory };
    }, { save: saveKey, starter: "fourColorMapGame.standard.online.v5.starter-profile" });
    assert.equal(evidence.localSave, null);
    assert.equal(evidence.name, "新規プレイヤー");
    assert.deepEqual(Object.values(evidence.inventory), [3, 3, 3, 3, 3, 3]);
    await page.getByRole("button", { name: "このプロフィールをオンライン用に同期" }).click();
    await page.locator("#lobby").waitFor({ state: "visible" });
    assert.equal(await page.locator("#profileCard").isVisible(), false);
    const profileCall = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.find((entry) => entry.body?.operation === "profile")?.body);
    assert.equal(profileCall.expectedRevision, 0);
    assert.equal(profileCall.displayName, "新規プレイヤー");
    const automaticMatchCalls = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => (
      entry.body?.operation === "cpu-accept"
      || ["fcg_standard_create_room", "fcg_standard_join_room", "fcg_standard_matchmaking_recruit", "fcg_standard_matchmaking_find"].includes(entry.name)
    )));
    assert.deepEqual(automaticMatchCalls, []);
  });
});

test("actual Edge reuses a persisted rematch ID and returns to fresh setup", { timeout: 30000 }, async () => {
  await withPage("finished", async (page) => {
    await page.getByRole("button", { name: "結果を確認して戻る" }).click();
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

test("actual Edge celebrates an opponent surrender and presents defeat from the local seat", { timeout: 30000 }, async () => {
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

test("actual Edge routes immediate skills and keeps target cancellation write-free", { timeout: 30000 }, async () => {
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

test("actual Edge gacha persists one server draw and immediately hydrates inventory", { timeout: 30000 }, async () => {
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

test("actual Edge quiz freezes for the hint, resumes without room polling, and advances once", { timeout: 30000 }, async () => {
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

test("actual Edge presents server-hydrated stats, trophy state, and match history", { timeout: 30000 }, async () => {
  await withPage("playing", async (page) => {
    await page.locator("#progressionPanel:not(.hidden)").waitFor();
    assert.deepEqual(await page.locator("#profileStats strong").allTextContents(), ["4", "2", "2", "3", "1"]);
    assert.equal(await page.locator("#trophyList .unlocked").count(), 2);
    assert.equal(await page.locator("#trophyList .locked").count(), 1);
    assert.match(await page.locator("#matchHistory .history-win").textContent(), /勝利.*完塗り.*スキル0回/);
  });
});

test("actual Edge hides onboarding after restoring a synced profile into the saved battle tab", { timeout: 30000 }, async () => {
  await withPage("lobby", async (page) => {
    assert.equal(await page.locator("body").getAttribute("data-active-tab"), "battle");
    assert.equal(await page.locator("#profileCard").isVisible(), false);
    assert.equal(await page.locator("#lobby").isVisible(), true);
  });
});

test("actual Edge quotes and commits one server-authoritative card sale", { timeout: 30000 }, async () => {
  await withPage("lobby", async (page) => {
    await page.locator("#progressionPanel:not(.hidden)").waitFor();
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

test("actual Edge confirms, persists, restores, and safely cancels online appearance", { timeout: 30000 }, async () => {
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

test("actual Edge recruits and cancels with one persisted public matchmaking ticket", { timeout: 30000 }, async () => {
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

test("actual Edge offers ten explicit CPU choices after 90 seconds and labels the accepted room", { timeout: 30000 }, async () => {
  await withPage("cpuWait", async (page) => {
    await page.locator("#cpuOpponentOffer:not(.hidden)").waitFor();
    assert.match(await page.locator("#cpuOfferMessage").textContent(), /90秒/);
    await page.getByRole("button", { name: "CPUを選ぶ" }).click();
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

test("actual Edge asks the server for exactly one CPU action then returns control to the human", { timeout: 60000 }, async () => {
  await withPage("cpuTurn", async (page) => {
    await page.waitForFunction(() => globalThis.__standardOnlineRuntime.calls.some((entry) => entry.body?.operation === "cpu-action"), null, { timeout: 45000 });
    await page.getByText("あなたの手番").waitFor();
    const actions = await page.evaluate(() => globalThis.__standardOnlineRuntime.calls.filter((entry) => entry.body?.operation === "cpu-action").map((entry) => entry.body));
    assert.deepEqual(actions, [{ operation: "cpu-action", roomId, expectedVersion: 9 }]);
  });
});

test("actual Edge rematches the same visible CPU and returns the human to fresh setup", { timeout: 30000 }, async () => {
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

test("actual Edge finds a public opponent and enters setup without exposing a code", { timeout: 30000 }, async () => {
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

test("actual Edge explains private random setup and every visible skill without exposing an oracle", { timeout: 30000 }, async () => {
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
