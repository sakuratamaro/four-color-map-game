"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createStandardOnlineClient, STORAGE_KEY } = require("../standard-online-v5/standard-online-client.js");

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const ACTION_ID = "22222222-2222-4222-8222-222222222222";
const QUIZ_SESSION_ID = "44444444-4444-4444-8444-444444444444";

function storageFixture(initial = null) {
  const values = new Map(initial ? [[STORAGE_KEY, JSON.stringify(initial)]] : []);
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
}

function supabaseFixture({ roomStatus = "ready", roomVersion = 10 } = {}) {
  const calls = [];
  const subscriptions = [];
  return {
    calls,
    subscriptions,
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "33333333-3333-4333-8333-333333333333" } } } }),
      signInAnonymously: async () => { throw new Error("unexpected sign-in"); },
    },
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      if (name === "fcg_standard_create_room") return { data: [{ room_id: ROOM_ID, room_code: "A1B2C3", seat: "A", game_mode: "standard_v5" }] };
      if (name === "fcg_standard_join_room") return { data: [{ room_id: ROOM_ID, seat: "B", game_mode: "standard_v5" }] };
      if (name === "fcg_standard_request_rematch") return { data: [{ room_status: "finished", room_version: args.p_expected_version, ready_to_setup: false, duplicate: false }] };
      if (name === "fcg_standard_matchmaking_recruit") return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "searching", room_id: null, seat: null, wait_started_at: "2099-01-01T00:00:00Z" }] };
      if (name === "fcg_standard_matchmaking_status") return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "searching", room_id: null, seat: null, wait_started_at: "2099-01-01T00:00:00Z" }] };
      if (name === "fcg_standard_matchmaking_cancel") return { data: [{ ticket_id: args.p_ticket_id, matchmaking_status: "cancelled", room_id: null, seat: null }] };
      if (name === "fcg_standard_matchmaking_find") return { data: [{ matchmaking_status: "matched", room_id: ROOM_ID, seat: "B", duplicate: false }] };
      if (name === "fcg_standard_room_snapshot_v2") return { data: {
        snapshot_schema_version: 2,
        snapshot_version: roomVersion,
        profile_revision: 3,
        server_time: "2099-01-01T00:00:00Z",
        room: { id: ROOM_ID, status: roomStatus, version: roomVersion, game_mode: "standard_v5", public_state: null },
        members: [{ user_id: "33333333-3333-4333-8333-333333333333", seat: "A", display_name: "A" }],
        view: { seat: "A", version: roomVersion, private_state: {} },
        profile: { revision: 3, display_name: "A", profile_state: { inventory: {} } },
      } };
      throw new Error(`unexpected rpc ${name}`);
    },
    functions: {
      invoke: async (name, request) => {
        calls.push({ kind: "invoke", name, request });
        if (request.body.operation === "profile") return { data: { revision: 1 } };
        if (request.body.operation === "gacha") return { data: { revision: 4, duplicate: false, draws: [{ skillId: "colorPrism" }], profileState: { gachaTickets: { "1": 1 }, inventory: { colorPrism: 1 } } } };
        if (request.body.operation === "card-sale-quote") return { data: { revision: 3, quote: { skillId: request.body.skillId, count: request.body.count, earnedCoins: 20, remaining: 1, requiresConfirmation: true } } };
        if (request.body.operation === "card-sale") return { data: { revision: 4, duplicate: false, quote: { skillId: request.body.skillId, count: request.body.count, earnedCoins: 20, remaining: 1 }, profileState: { coins: 20, inventory: { colorRandomBorrow: 1 } } } };
        if (request.body.operation === "cosmetic-catalog") return { data: { revision: 3, cosmetics: { coins: 1000, equipped: { board: "boardDefault" }, items: [] } } };
        if (request.body.operation === "cosmetic-quote") return { data: { revision: 3, quote: { cosmeticId: request.body.cosmeticId, name: "オーロラ盤面", price: 600, coinsAfter: 400, purchaseRequired: true } } };
        if (request.body.operation === "cosmetic-action") return { data: { revision: 4, duplicate: false, quote: { cosmeticId: request.body.cosmeticId, price: 600 }, profileState: { coins: 400, equipped: { board: request.body.cosmeticId } }, cosmetics: { coins: 400, equipped: { board: request.body.cosmeticId }, items: [] } } };
        if (request.body.operation === "quiz-start") return { data: { sessionId: QUIZ_SESSION_ID, duplicate: false, selectedLevel: 2, expiresAt: "2099-01-01T00:00:00Z", questions: Array.from({ length: 10 }, (_, index) => ({ prompt: `Q${index + 1}`, options: [{ id: `q${index + 1}-1`, label: "1" }] })) } };
        if (request.body.operation === "quiz-finish") return { data: { revision: 5, duplicate: false, correct: 10, wrong: 0, bestStreak: 10, reward: { ticketLevel: 2, draws: 10, reason: "全問正解" }, profileState: { gachaTickets: { "2": 10 }, inventory: {} } } };
        if (request.body.operation === "cpu-roster") return { data: { rosterVersion: "standard-character-roster-v1", characters: Array.from({ length: 10 }, (_, index) => ({ id: `cpu${index}`, name: `CPU ${index}` })) } };
        if (request.body.operation === "cpu-accept") return { data: { matchmakingStatus: "matched", roomId: ROOM_ID, seat: "A", characterId: request.body.characterId, duplicate: false } };
        if (request.body.operation === "cpu-action") return { data: { duplicate: false, room: { version: request.body.expectedVersion + 1 } } };
        if (request.body.operation === "cpu-rematch") return { data: { roomStatus: "ready", roomVersion: request.body.expectedVersion + 1, readyToSetup: true, duplicate: false } };
        if (request.body.operation === "setup") return { data: { setupRevision: 1, profileRevision: 1, quoteId: request.body.setupActionId } };
        return { data: { room: { version: request.body.action?.expectedVersion ?? 0 } } };
      },
    },
    from: (table) => ({ select: () => {
      const data = table === "fcg_standard_profiles" ? { revision: 3, display_name: "A", profile_state: { inventory: {} } } : null;
      const chain = { eq: () => chain, order: async () => ({ data }), single: async () => ({ data }), maybeSingle: async () => ({ data }) };
      return chain;
    } }),
    channel: (name) => {
      const subscription = { name, configs: [], invalidations: [], status: null, removed: false };
      subscriptions.push(subscription);
      const channel = {
        on: (_type, config, callback) => { subscription.configs.push(config); subscription.invalidations.push(callback); return channel; },
        subscribe: (callback) => { subscription.status = callback; return channel; },
      };
      subscription.channel = channel;
      return channel;
    },
    removeChannel: async (channel) => {
      const subscription = subscriptions.find((entry) => entry.channel === channel);
      if (subscription) subscription.removed = true;
    },
  };
}

test("client restores only finite reconnect identities from its own storage key", () => {
  const storage = storageFixture({ roomId: ROOM_ID, roomCode: "A1B2C3", profileRevision: 4, setupRevision: 2 });
  const client = createStandardOnlineClient({ supabase: supabaseFixture(), storage, idFactory: () => ACTION_ID });
  assert.deepEqual(client.snapshot(), {
    roomId: ROOM_ID, roomCode: "A1B2C3", profileRevision: 4, setupRevision: 2,
    rematchActionId: null, rematchExpectedVersion: null,
    matchmakingTicketId: null, matchmakingStartedAt: null, matchmakingFindActionId: null,
  });
});

test("profile, create, setup, initialize, and action use the Standard boundaries", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture();
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => ACTION_ID });
  await client.syncProfile({ displayName: "A", profileState: { inventory: {} } });
  await client.createRoom("A");
  await client.submitSetup({ loadout: { color: [], area: [], disrupt: [] } });
  await client.initialize();
  await client.submitAction({ expectedVersion: 0, type: "SURRENDER" });
  assert.deepEqual(supabase.calls.map((call) => call.kind === "invoke" ? call.request.body.operation : call.name), [
    "profile", "fcg_standard_create_room", "setup", "initialize", "action",
  ]);
  assert.equal(client.snapshot().profileRevision, 1);
  assert.equal(client.snapshot().setupRevision, 1);
  assert.equal(client.snapshot().roomId, ROOM_ID);
});

test("join is Standard-mode scoped and persists the normalized code", async () => {
  const supabase = supabaseFixture();
  const client = createStandardOnlineClient({ supabase, storage: storageFixture(), idFactory: () => ACTION_ID });
  await client.joinRoom({ roomCode: "a1b2c3", displayName: "B" });
  assert.equal(supabase.calls[0].name, "fcg_standard_join_room");
  assert.equal(supabase.calls[0].args.p_room_code, "A1B2C3");
  assert.equal(client.snapshot().roomCode, "A1B2C3");
});

test("public matchmaking persists recruit and find identities and hands matched rooms to normal sync", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture();
  let allocated = 0;
  const ids = [ACTION_ID, "55555555-5555-4555-8555-555555555555"];
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => ids[allocated++] });
  const recruited = await client.recruitOpponent({ displayName: "A" });
  assert.equal(recruited.matchmaking_status, "searching");
  assert.equal(client.snapshot().matchmakingTicketId, ACTION_ID);
  await client.readMatchmakingStatus();
  await client.cancelMatchmaking();
  assert.equal(client.snapshot().matchmakingTicketId, null);
  const found = await client.findOpponent({ displayName: "A" });
  assert.equal(found.matchmaking_status, "matched");
  assert.equal(client.snapshot().roomId, ROOM_ID);
  assert.equal(client.snapshot().roomCode, null);
  assert.equal(client.snapshot().matchmakingFindActionId, null);
  assert.deepEqual(supabase.calls.filter((call) => call.kind === "rpc").map((call) => call.name), [
    "fcg_standard_matchmaking_recruit", "fcg_standard_matchmaking_status", "fcg_standard_matchmaking_cancel", "fcg_standard_matchmaking_find",
  ]);
});

test("a failed public find reuses the same persisted action ID on retry", async () => {
  const supabase = supabaseFixture();
  const rpc = supabase.rpc;
  let failOnce = true;
  supabase.rpc = async (name, args) => {
    if (name === "fcg_standard_matchmaking_find" && failOnce) {
      failOnce = false;
      return { error: new Error("response lost") };
    }
    return rpc(name, args);
  };
  let allocations = 0;
  const client = createStandardOnlineClient({ supabase, storage: storageFixture(), idFactory: () => { allocations += 1; return ACTION_ID; } });
  await assert.rejects(client.findOpponent({ displayName: "A" }), /response lost/);
  assert.equal(client.snapshot().matchmakingFindActionId, ACTION_ID);
  await client.findOpponent({ displayName: "A" });
  assert.equal(allocations, 1);
  assert.equal(client.snapshot().roomId, ROOM_ID);
});

test("CPU roster, explicit acceptance, and one server CPU turn use finite client boundaries", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture();
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => ACTION_ID });
  await client.recruitOpponent({ displayName: "A" });
  const roster = await client.readCpuRoster();
  assert.equal(roster.characters.length, 10);
  const accepted = await client.acceptCpuOpponent({ characterId: "yuzu" });
  assert.equal(accepted.characterId, "yuzu");
  assert.equal(client.snapshot().roomId, ROOM_ID);
  assert.equal(client.snapshot().roomCode, null);
  assert.equal(client.snapshot().matchmakingTicketId, null);
  await client.takeCpuTurn({ expectedVersion: 7 });
  const invokes = supabase.calls.filter((call) => call.kind === "invoke").map((call) => call.request.body);
  assert.deepEqual(invokes, [
    { operation: "cpu-roster" },
    { operation: "cpu-accept", ticketId: ACTION_ID, characterId: "yuzu" },
    { operation: "cpu-action", roomId: ROOM_ID, expectedVersion: 7 },
  ]);
  assert.equal(Object.hasOwn(invokes[1], "profileState"), false);
  assert.equal(Object.hasOwn(invokes[2], "action"), false);
});

test("CPU rematch persists one retry identity and resets only after the server returns ready", async () => {
  const supabase = supabaseFixture({ roomStatus: "finished", roomVersion: 12 });
  const originalInvoke = supabase.functions.invoke;
  let failOnce = true;
  const seenActionIds = [];
  supabase.functions.invoke = async (name, request) => {
    if (request.body.operation === "cpu-rematch") seenActionIds.push(request.body.actionId);
    if (request.body.operation === "cpu-rematch" && failOnce) { failOnce = false; return { error: new Error("response lost") }; }
    return originalInvoke(name, request);
  };
  const storage = storageFixture({ roomId: ROOM_ID, profileRevision: 2, setupRevision: 1 });
  let allocations = 0;
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => { allocations += 1; return ACTION_ID; } });
  await assert.rejects(client.requestCpuRematch({ expectedVersion: 12 }), /response lost/);
  assert.equal(client.snapshot().rematchActionId, ACTION_ID);
  assert.equal(client.snapshot().setupRevision, 1);
  const result = await client.requestCpuRematch({ expectedVersion: 12 });
  assert.equal(result.readyToSetup, true);
  assert.equal(allocations, 1);
  assert.equal(client.snapshot().setupRevision, 0);
  assert.equal(client.snapshot().rematchActionId, null);
  assert.deepEqual(seenActionIds, [ACTION_ID, ACTION_ID]);
});

test("owner profile read refreshes the compare-and-swap revision", async () => {
  const client = createStandardOnlineClient({ supabase: supabaseFixture(), storage: storageFixture(), idFactory: () => ACTION_ID });
  const profile = await client.readProfile();
  assert.equal(profile.revision, 3);
  assert.equal(client.snapshot().profileRevision, 3);
});

test("caller-supplied action identity is retained exactly for safe retry", async () => {
  const supabase = supabaseFixture();
  const client = createStandardOnlineClient({ supabase, storage: storageFixture({ roomId: ROOM_ID }), idFactory: () => { throw new Error("must not allocate"); } });
  await client.submitAction({ id: ACTION_ID, expectedVersion: 7, type: "COLOR_REGION", payload: { color: "red" } });
  const body = supabase.calls[0].request.body;
  assert.deepEqual(body.action, { id: ACTION_ID, expectedVersion: 7, type: "COLOR_REGION", payload: { color: "red" } });
});

test("gacha retains the caller action identity and persists the committed profile revision", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture({ profileRevision: 3 });
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => { throw new Error("must not allocate"); } });
  const result = await client.drawGacha({ expectedRevision: 3, actionId: ACTION_ID, ticketLevel: 1, count: 1 });
  const body = supabase.calls[0].request.body;
  assert.deepEqual(body, { operation: "gacha", expectedRevision: 3, actionId: ACTION_ID, ticketLevel: 1, count: 1 });
  assert.equal(result.duplicate, false);
  assert.equal(result.draws[0].skillId, "colorPrism");
  assert.equal(client.snapshot().profileRevision, 4);
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY)).profileRevision, 4);
});

test("card sale quotes current server state and retains one action identity for commit", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture({ profileRevision: 2 });
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => { throw new Error("must not allocate"); } });
  const quoted = await client.quoteCardSale({ skillId: "colorRandomBorrow", count: 2 });
  assert.equal(quoted.quote.requiresConfirmation, true);
  assert.equal(client.snapshot().profileRevision, 3);
  const sold = await client.sellCards({ actionId: ACTION_ID, skillId: "colorRandomBorrow", count: 2, confirmed: true });
  assert.equal(sold.profileState.coins, 20);
  assert.equal(client.snapshot().profileRevision, 4);
  assert.deepEqual(supabase.calls.filter((call) => call.kind === "invoke").map((call) => call.request.body), [
    { operation: "card-sale-quote", expectedRevision: 2, skillId: "colorRandomBorrow", count: 2 },
    { operation: "card-sale", expectedRevision: 3, actionId: ACTION_ID, skillId: "colorRandomBorrow", count: 2, confirmed: true },
  ]);
});

test("cosmetics read and quote current server state then retain the caller action identity", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture({ profileRevision: 2 });
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => { throw new Error("must not allocate"); } });
  const catalog = await client.readCosmetics();
  assert.equal(catalog.cosmetics.coins, 1000);
  const quoted = await client.quoteCosmetic({ cosmeticId: "boardAurora" });
  assert.equal(quoted.quote.price, 600);
  const applied = await client.applyCosmetic({ actionId: ACTION_ID, expectedRevision: 3, cosmeticId: "boardAurora" });
  assert.equal(applied.profileState.coins, 400);
  assert.equal(client.snapshot().profileRevision, 4);
  assert.deepEqual(supabase.calls.filter((call) => call.kind === "invoke").map((call) => call.request.body), [
    { operation: "cosmetic-catalog" },
    { operation: "cosmetic-quote", cosmeticId: "boardAurora" },
    { operation: "cosmetic-action", expectedRevision: 3, actionId: ACTION_ID, cosmeticId: "boardAurora" },
  ]);
});

test("online quiz starts and finishes through server operations and persists the rewarded revision", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture({ profileRevision: 4 });
  const client = createStandardOnlineClient({ supabase, storage, idFactory: () => ACTION_ID });
  const started = await client.startQuiz({ actionId: ACTION_ID, selectedLevel: 2 });
  assert.equal(started.sessionId, QUIZ_SESSION_ID);
  const answers = Array.from({ length: 10 }, (_, index) => `q${index + 1}-1`);
  const finished = await client.finishQuiz({ sessionId: QUIZ_SESSION_ID, actionId: ACTION_ID, answers });
  assert.equal(finished.reward.draws, 10);
  assert.equal(client.snapshot().profileRevision, 5);
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY)).profileRevision, 5);
  assert.deepEqual(supabase.calls.filter((call) => call.kind === "invoke").map((call) => call.request.body.operation), ["quiz-start", "quiz-finish"]);
});

test("rematch persists its identity before the RPC and reuses it after reconnect", async () => {
  const supabase = supabaseFixture();
  const storage = storageFixture({ roomId: ROOM_ID, setupRevision: 2 });
  const first = createStandardOnlineClient({ supabase, storage, idFactory: () => ACTION_ID });
  await first.requestRematch({ expectedVersion: 9 });
  assert.equal(first.snapshot().rematchActionId, ACTION_ID);
  assert.equal(first.snapshot().rematchExpectedVersion, 9);

  const second = createStandardOnlineClient({ supabase, storage, idFactory: () => { throw new Error("must reuse pending rematch"); } });
  await second.requestRematch({ expectedVersion: 9 });
  const calls = supabase.calls.filter((call) => call.name === "fcg_standard_request_rematch");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args.p_action_id, ACTION_ID);
  assert.equal(calls[1].args.p_action_id, ACTION_ID);
});

test("polling a reset room clears the completed rematch and stale setup revision", async () => {
  const storage = storageFixture({ roomId: ROOM_ID, setupRevision: 4, rematchActionId: ACTION_ID, rematchExpectedVersion: 9 });
  const client = createStandardOnlineClient({ supabase: supabaseFixture({ roomStatus: "ready", roomVersion: 10 }), storage, idFactory: () => { throw new Error("unexpected allocation"); } });
  await client.readRoom();
  assert.equal(client.snapshot().setupRevision, 0);
  assert.equal(client.snapshot().rematchActionId, null);
  assert.equal(client.snapshot().rematchExpectedVersion, null);
});

test("room refresh uses one member-scoped profile-delta snapshot RPC instead of four table reads", async () => {
  const supabase = supabaseFixture({ roomStatus: "playing", roomVersion: 12 });
  const client = createStandardOnlineClient({ supabase, storage: storageFixture({ roomId: ROOM_ID }), idFactory: () => ACTION_ID });
  const room = await client.readRoom();
  assert.equal(room.room.version, 12);
  assert.equal(room.view.seat, "A");
  assert.deepEqual(supabase.calls.filter((call) => call.kind === "rpc").map((call) => call.name), ["fcg_standard_room_snapshot_v2"]);
  assert.equal(supabase.calls[0].args.p_known_profile_revision, 0);
});

test("unchanged profile bodies may be omitted while the snapshot revision remains authoritative", async () => {
  const supabase = supabaseFixture({ roomStatus: "playing", roomVersion: 13 });
  const originalRpc = supabase.rpc;
  supabase.rpc = async (name, args) => {
    const result = await originalRpc(name, args);
    if (name === "fcg_standard_room_snapshot_v2") result.data.profile = null;
    return result;
  };
  const client = createStandardOnlineClient({ supabase, storage: storageFixture({ roomId: ROOM_ID, profileRevision: 3 }), idFactory: () => ACTION_ID });
  const room = await client.readRoom();
  assert.equal(room.profile, null);
  assert.equal(client.snapshot().profileRevision, 3);
  assert.equal(supabase.calls[0].args.p_known_profile_revision, 3);
});

test("room subscription is scoped to the room row and can be removed idempotently", async () => {
  const supabase = supabaseFixture();
  const client = createStandardOnlineClient({ supabase, storage: storageFixture({ roomId: ROOM_ID }), idFactory: () => ACTION_ID });
  let invalidations = 0;
  const stop = await client.subscribeToRoom({ roomId: ROOM_ID, onInvalidate: () => { invalidations += 1; } });
  assert.deepEqual(supabase.subscriptions[0].configs, [
    { event: "UPDATE", schema: "public", table: "fcg_rooms", filter: `id=eq.${ROOM_ID}` },
  ]);
  supabase.subscriptions[0].invalidations[0]();
  assert.equal(invalidations, 1);
  await stop();
  await stop();
  assert.equal(supabase.subscriptions[0].removed, true);
});

test("client source contains no privileged credential or caller-provided final state", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "standard-online-client.js"), "utf8");
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role/i);
  assert.doesNotMatch(source, /body:\s*\{[^}]*publicState|body:\s*\{[^}]*privateState/i);
  assert.match(source, /standard-game-action/);
});
