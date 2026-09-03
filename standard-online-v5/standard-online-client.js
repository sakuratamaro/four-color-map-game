(function initStandardOnlineClient(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardOnlineClient = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardOnlineClientFactory() {
  "use strict";

  const STORAGE_KEY = "fourColorMapGame.standard.online.v5.connection";
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function firstRow(data) { return Array.isArray(data) ? data[0] : data; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function requiredText(value, code, max = 64) {
    const normalized = String(value || "").trim();
    if (!normalized || normalized.length > max) throw Object.assign(new Error(code), { code });
    return normalized;
  }
  function stored(storage) {
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      return value && typeof value === "object" ? value : {};
    } catch { return {}; }
  }

  function createStandardOnlineClient({ supabase, storage, idFactory }) {
    if (!supabase?.auth || !supabase?.functions || typeof supabase.rpc !== "function") throw new Error("INVALID_SUPABASE_CLIENT");
    if (!storage?.getItem || !storage?.setItem || !storage?.removeItem) throw new Error("INVALID_STORAGE");
    if (typeof idFactory !== "function") throw new Error("INVALID_ID_FACTORY");
    const state = {
      roomId: null,
      roomCode: null,
      profileRevision: 0,
      setupRevision: 0,
      rematchActionId: null,
      rematchExpectedVersion: null,
      ...stored(storage),
    };
    let session = null;

    function persist() { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    async function ensureSession() {
      const existing = await supabase.auth.getSession();
      session = existing?.data?.session || null;
      if (!session) {
        const created = await supabase.auth.signInAnonymously();
        if (created.error) throw created.error;
        session = created.data.session;
      }
      if (!session?.user?.id) throw new Error("AUTH_SESSION_REQUIRED");
      return session;
    }
    async function invoke(operation, body = {}) {
      const response = await supabase.functions.invoke("standard-game-action", { body: { operation, ...body } });
      if (response.error) throw response.error;
      if (response.data?.error) throw Object.assign(new Error(response.data.error.message), response.data.error);
      return response.data;
    }
    async function syncProfile({ expectedRevision = state.profileRevision, displayName, profileState }) {
      await ensureSession();
      const result = await invoke("profile", {
        expectedRevision,
        displayName: requiredText(displayName, "INVALID_DISPLAY_NAME", 20),
        profileState: clone(profileState),
      });
      state.profileRevision = Number(firstRow(result.revision));
      persist();
      return clone(result);
    }
    async function drawGacha({ expectedRevision = state.profileRevision, actionId = idFactory(), ticketLevel, count }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(actionId)) || !Number.isSafeInteger(ticketLevel) || ticketLevel < 1 || ticketLevel > 5
          || !Number.isSafeInteger(count) || count < 1 || count > 100) throw new Error("INVALID_GACHA_REQUEST");
      const result = await invoke("gacha", { expectedRevision, actionId, ticketLevel, count });
      state.profileRevision = Number(result.revision);
      persist();
      return clone(result);
    }
    async function quoteCardSale({ expectedRevision = state.profileRevision, skillId, count }) {
      await ensureSession();
      if (!requiredText(skillId, "INVALID_CARD_SALE_SKILL") || !Number.isSafeInteger(count) || count < 1 || count > 100) {
        throw new Error("INVALID_CARD_SALE_REQUEST");
      }
      const result = await invoke("card-sale-quote", { expectedRevision, skillId, count });
      state.profileRevision = Number(result.revision);
      persist();
      return clone(result);
    }
    async function sellCards({ expectedRevision = state.profileRevision, actionId = idFactory(), skillId, count, confirmed = false }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(actionId)) || !requiredText(skillId, "INVALID_CARD_SALE_SKILL")
          || !Number.isSafeInteger(count) || count < 1 || count > 100 || typeof confirmed !== "boolean") {
        throw new Error("INVALID_CARD_SALE_REQUEST");
      }
      const result = await invoke("card-sale", { expectedRevision, actionId, skillId, count, confirmed });
      state.profileRevision = Number(result.revision);
      persist();
      return clone(result);
    }
    async function startQuiz({ actionId = idFactory(), selectedLevel }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(actionId)) || !Number.isSafeInteger(selectedLevel) || selectedLevel < 1 || selectedLevel > 5) {
        throw new Error("INVALID_QUIZ_REQUEST");
      }
      return clone(await invoke("quiz-start", { actionId, selectedLevel }));
    }
    async function finishQuiz({ sessionId, actionId = idFactory(), answers }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(sessionId)) || !UUID_PATTERN.test(String(actionId))
          || !Array.isArray(answers) || answers.length !== 10 || answers.some((answer) => typeof answer !== "string" || answer.length > 32)) {
        throw new Error("INVALID_QUIZ_REQUEST");
      }
      const result = await invoke("quiz-finish", { sessionId, actionId, answers: clone(answers) });
      state.profileRevision = Number(result.revision);
      persist();
      return clone(result);
    }
    async function readProfile() {
      const currentSession = await ensureSession();
      const result = await supabase.from("fcg_standard_profiles")
        .select("revision,display_name,profile_state").eq("user_id", currentSession.user.id).maybeSingle();
      if (result.error) throw result.error;
      if (result.data?.revision !== undefined) {
        state.profileRevision = Number(result.data.revision);
        persist();
      }
      return result.data ? clone(result.data) : null;
    }
    async function createRoom(displayName) {
      await ensureSession();
      const response = await supabase.rpc("fcg_standard_create_room", { p_display_name: requiredText(displayName, "INVALID_DISPLAY_NAME", 20) });
      if (response.error) throw response.error;
      const row = firstRow(response.data);
      state.roomId = row.room_id;
      state.roomCode = row.room_code;
      state.setupRevision = 0;
      state.rematchActionId = null;
      state.rematchExpectedVersion = null;
      persist();
      return clone(row);
    }
    async function joinRoom({ roomCode, displayName }) {
      await ensureSession();
      const code = requiredText(roomCode, "INVALID_ROOM_CODE", 6).replace(/\s/g, "").toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(code)) throw Object.assign(new Error("INVALID_ROOM_CODE"), { code: "INVALID_ROOM_CODE" });
      const response = await supabase.rpc("fcg_standard_join_room", { p_room_code: code, p_display_name: requiredText(displayName, "INVALID_DISPLAY_NAME", 20) });
      if (response.error) throw response.error;
      const row = firstRow(response.data);
      if (!row || !UUID_PATTERN.test(String(row.room_id)) || row.game_mode !== "standard_v5") {
        throw Object.assign(new Error("部屋が見つからないか、現在参加できません。"), { code: row?.seat === "ERROR_RATE_LIMIT" ? "RATE_LIMITED" : "JOIN_FAILED" });
      }
      state.roomId = row.room_id;
      state.roomCode = code;
      state.setupRevision = 0;
      state.rematchActionId = null;
      state.rematchExpectedVersion = null;
      persist();
      return clone(row);
    }
    async function submitSetup({ roomId = state.roomId, expectedSetupRevision = state.setupRevision, loadout, setupActionId = idFactory() }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId)) || !UUID_PATTERN.test(String(setupActionId))) throw new Error("INVALID_SETUP_ID");
      const result = await invoke("setup", { roomId, expectedSetupRevision, setupActionId, loadout: clone(loadout) });
      state.roomId = roomId;
      state.setupRevision = Number(firstRow(result.setupRevision));
      state.profileRevision = Number(result.profileRevision);
      persist();
      return clone(result);
    }
    async function initialize(roomId = state.roomId) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId))) throw new Error("INVALID_ROOM_ID");
      return clone(await invoke("initialize", { roomId }));
    }
    async function submitAction({ roomId = state.roomId, id = idFactory(), expectedVersion, type, payload = {} }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId)) || !UUID_PATTERN.test(String(id))) throw new Error("INVALID_ACTION_ID");
      if (!Number.isSafeInteger(expectedVersion) || !requiredText(type, "INVALID_ACTION_TYPE")) throw new Error("INVALID_ACTION");
      return clone(await invoke("action", { roomId, action: { id, expectedVersion, type, payload: clone(payload) } }));
    }
    async function requestRematch({ roomId = state.roomId, expectedVersion, actionId = null }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId)) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("INVALID_REMATCH_REQUEST");
      const pendingMatches = state.rematchExpectedVersion === expectedVersion && UUID_PATTERN.test(String(state.rematchActionId));
      const resolvedActionId = actionId || (pendingMatches ? state.rematchActionId : idFactory());
      if (!UUID_PATTERN.test(String(resolvedActionId))) throw new Error("INVALID_REMATCH_ID");
      state.rematchActionId = resolvedActionId;
      state.rematchExpectedVersion = expectedVersion;
      persist();
      const response = await supabase.rpc("fcg_standard_request_rematch", {
        p_room_id: roomId,
        p_expected_version: expectedVersion,
        p_action_id: resolvedActionId,
      });
      if (response.error) throw response.error;
      const row = firstRow(response.data);
      if (row?.ready_to_setup || row?.room_status === "ready") {
        state.setupRevision = 0;
        state.rematchActionId = null;
        state.rematchExpectedVersion = null;
        persist();
      }
      return clone(row);
    }
    async function readRoom(roomId = state.roomId) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId))) throw new Error("INVALID_ROOM_ID");
      const response = await supabase.rpc("fcg_standard_room_snapshot", { p_room_id: roomId });
      if (response.error) throw response.error;
      const snapshot = firstRow(response.data);
      if (Number(snapshot?.snapshot_schema_version) !== 1 || !Number.isSafeInteger(Number(snapshot?.snapshot_version))
          || !snapshot?.room || !Array.isArray(snapshot.members)) throw new Error("INVALID_ROOM_SNAPSHOT");
      if (snapshot.room.game_mode !== "standard_v5") throw new Error("WRONG_GAME_MODE");
      if (snapshot.room.status === "ready" && Number.isSafeInteger(state.rematchExpectedVersion)
          && Number(snapshot.room.version) > state.rematchExpectedVersion) {
        state.setupRevision = 0;
        state.rematchActionId = null;
        state.rematchExpectedVersion = null;
      }
      if (snapshot.profile?.revision !== undefined) state.profileRevision = Number(snapshot.profile.revision);
      state.roomId = roomId;
      persist();
      return clone({
        snapshotSchemaVersion: 1,
        snapshotVersion: Number(snapshot.snapshot_version),
        serverTime: snapshot.server_time,
        room: snapshot.room,
        members: snapshot.members,
        view: snapshot.view || null,
        profile: snapshot.profile || null,
      });
    }
    async function subscribeToRoom({ roomId = state.roomId, onInvalidate, onStatus = () => {} }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId))) throw new Error("INVALID_ROOM_ID");
      if (typeof onInvalidate !== "function" || typeof onStatus !== "function") throw new Error("INVALID_REALTIME_HANDLERS");
      if (typeof supabase.channel !== "function" || typeof supabase.removeChannel !== "function") throw new Error("REALTIME_UNAVAILABLE");
      const changes = [
        { table: "fcg_rooms", filter: `id=eq.${roomId}` },
        { table: "fcg_room_members", filter: `room_id=eq.${roomId}` },
        { table: "fcg_player_views", filter: `room_id=eq.${roomId}` },
      ];
      let channel = supabase.channel(`standard-room-${roomId}`);
      for (const change of changes) {
        channel = channel.on("postgres_changes", {
          event: "*",
          schema: "public",
          ...change,
        }, onInvalidate);
      }
      channel = channel.subscribe(onStatus);
      let subscribed = true;
      return () => {
        if (!subscribed) return undefined;
        subscribed = false;
        return supabase.removeChannel(channel);
      };
    }
    function clearRoom() {
      state.roomId = null;
      state.roomCode = null;
      state.setupRevision = 0;
      state.rematchActionId = null;
      state.rematchExpectedVersion = null;
      persist();
    }
    function resetConnection() {
      storage.removeItem(STORAGE_KEY);
      state.roomId = null;
      state.roomCode = null;
      state.profileRevision = 0;
      state.setupRevision = 0;
      state.rematchActionId = null;
      state.rematchExpectedVersion = null;
    }

    return Object.freeze({
      clearRoom,
      createRoom,
      drawGacha,
      ensureSession,
      finishQuiz,
      initialize,
      joinRoom,
      readProfile,
      readRoom,
      requestRematch,
      quoteCardSale,
      resetConnection,
      snapshot: () => Object.freeze(clone(state)),
      startQuiz,
      sellCards,
      submitAction,
      submitSetup,
      subscribeToRoom,
      syncProfile,
    });
  }

  return Object.freeze({ STORAGE_KEY, createStandardOnlineClient });
});
