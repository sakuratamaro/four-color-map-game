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
      const currentSession = await ensureSession();
      if (!UUID_PATTERN.test(String(roomId))) throw new Error("INVALID_ROOM_ID");
      const [roomResult, membersResult, viewResult, profileResult] = await Promise.all([
        supabase.from("fcg_rooms").select("id,status,version,game_mode,public_state,winner_seat,expires_at").eq("id", roomId).single(),
        supabase.from("fcg_room_members").select("user_id,seat,display_name,last_seen_at").eq("room_id", roomId).order("seat"),
        supabase.from("fcg_player_views").select("seat,version,private_state").eq("room_id", roomId).maybeSingle(),
        supabase.from("fcg_standard_profiles").select("revision,display_name,profile_state").eq("user_id", currentSession.user.id).maybeSingle(),
      ]);
      for (const result of [roomResult, membersResult, viewResult, profileResult]) if (result.error) throw result.error;
      if (roomResult.data?.game_mode !== "standard_v5") throw new Error("WRONG_GAME_MODE");
      if (roomResult.data?.status === "ready" && Number.isSafeInteger(state.rematchExpectedVersion)
          && Number(roomResult.data.version) > state.rematchExpectedVersion) {
        state.setupRevision = 0;
        state.rematchActionId = null;
        state.rematchExpectedVersion = null;
      }
      if (profileResult.data?.revision !== undefined) state.profileRevision = Number(profileResult.data.revision);
      state.roomId = roomId;
      persist();
      return clone({ room: roomResult.data, members: membersResult.data || [], view: viewResult.data || null, profile: profileResult.data || null });
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
      initialize,
      joinRoom,
      readProfile,
      readRoom,
      requestRematch,
      resetConnection,
      snapshot: () => Object.freeze(clone(state)),
      submitAction,
      submitSetup,
      syncProfile,
    });
  }

  return Object.freeze({ STORAGE_KEY, createStandardOnlineClient });
});
