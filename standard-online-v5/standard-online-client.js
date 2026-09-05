(function initStandardOnlineClient(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardOnlineClient = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardOnlineClientFactory() {
  "use strict";

  const STORAGE_KEY = "fourColorMapGame.standard.online.v5.connection";
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const PUBLIC_FUNCTION_ERRORS = Object.freeze({
    AUTH_REQUIRED: "匿名ログインが必要です。接続を確認して、もう一度お試しください。",
    AUTH_INVALID: "ログイン情報を確認できませんでした。ページを再読み込みしてください。",
    NOT_A_MEMBER: "この対戦への参加を確認できませんでした。ロビーへ戻って入り直してください。",
    ROOM_NOT_FOUND: "対戦が終了または失効しました。ロビーから新しい対戦を始めてください。",
    ROOM_NOT_PLAYING: "対戦はまだ開始されていません。最新の状態を確認してください。",
    MATCH_FINISHED: "この対戦は終了しています。結果を確認してください。",
    STALE_VERSION: "盤面が先に更新されました。最新の盤面で操作を選び直してください。",
    VERSION_CONFLICT: "盤面が先に更新されました。最新の盤面で操作を選び直してください。",
    NOT_YOUR_TURN: "いまはあなたの手番ではありません。相手の操作をお待ちください。",
    WRONG_PHASE: "いまの手順ではその操作はできません。画面の案内に沿って選び直してください。",
    WRONG_REGION_SIZE: "選ぶマス数が違います。表示された枚数どおりに選び直してください。",
    REGION_NOT_CONNECTED: "選んだマスがつながっていません。辺でつながるように選び直してください。",
    REGION_NOT_ADJACENT: "既存の領域に接していません。辺で接するように選び直してください。",
    REGION_OVERLAP: "すでに使われているマスが含まれています。空いているマスを選び直してください。",
    COLOR_UNAVAILABLE: "その色は現在使えません。別の持ち色を選んでください。",
    ILLEGAL_COLOR: "その色では隣り合う領域が同色になります。別の色を選んでください。",
    COLOR_AVAILABLE: "使える色があります。持ち色から選んでください。",
    INVALID_ACTION: "操作内容を確認できませんでした。最新の盤面で選び直してください。",
    UNKNOWN_ACTION: "その操作は利用できません。画面を再読み込みしてください。",
    RULE_REJECTED: "その操作は現在のルールでは行えません。画面の案内から選び直してください。",
    IDEMPOTENCY_KEY_REUSE: "操作内容が前回の送信と一致しません。最新の盤面で選び直してください。",
    INVALID_SETUP: "6枚セットを確認できませんでした。各カテゴリから2枚ずつ選び直してください。",
    DEBUG_MODE_NOT_ALLOWED: "デバッグ対戦は合言葉による人同士の対戦だけで使えます。CPU戦・野良対戦ではデバッグをOFFにしてください。",
    DEBUG_MODE_MISMATCH: "2人のデバッグ設定が一致していません。2人とも同じ設定にして、6枚を準備し直してください。",
    SETUP_REQUIRED: "2人分の6枚セットがそろっていません。準備完了後に相手をお待ちください。",
    ROOM_NOT_READY: "対戦開始の準備が整っていません。6枚セットと相手の状態を確認してください。",
    RATE_LIMITED: "短時間に操作が集中しました。少し待ってから同じ操作を再送してください。",
    SERVER_BUSY: "ゲームサーバーが混み合っています。少し待ってから同じ操作を再送してください。",
    SERVER_ERROR: "ゲームサーバーで操作を完了できませんでした。同じ操作を再送できます。",
  });
  const RETRYABLE_FUNCTION_ERROR_CODES = new Set(["RATE_LIMITED", "SERVER_BUSY", "SERVER_ERROR"]);

  async function normalizeFunctionError(rawError) {
    const context = rawError?.context;
    const candidateStatus = Number(context?.status);
    const httpStatus = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 0;
    let payload = rawError && typeof rawError === "object" && typeof rawError.code === "string" ? rawError : null;
    try {
      const readable = typeof context?.clone === "function" ? context.clone() : context;
      if (typeof readable?.json === "function") payload = await readable.json();
    } catch { /* an unreadable FunctionsHttpError body remains private */ }
    const envelope = payload?.error && typeof payload.error === "object" ? payload.error : payload;
    const rawCode = typeof envelope?.code === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(envelope.code) ? envelope.code : "";
    const knownCode = Object.hasOwn(PUBLIC_FUNCTION_ERRORS, rawCode);
    const code = knownCode ? rawCode : httpStatus >= 400 && httpStatus < 500 ? "REQUEST_REJECTED" : "NETWORK_OR_UNKNOWN";
    const message = PUBLIC_FUNCTION_ERRORS[code]
      || (code === "REQUEST_REJECTED"
        ? "その操作は受け付けられませんでした。最新の状態を確認して選び直してください。"
        : "サーバーの応答を確認できませんでした。同じ操作を再送できます。");
    const retryable = RETRYABLE_FUNCTION_ERROR_CODES.has(code)
      || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500
      || (httpStatus === 0 && !knownCode);
    return Object.assign(new Error(message), { code, httpStatus, retryable });
  }

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
      matchmakingTicketId: null,
      matchmakingStartedAt: null,
      matchmakingFindActionId: null,
      cpuStartActionId: null,
      cpuStartCharacterId: null,
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
      if (response.error) throw await normalizeFunctionError(response.error);
      if (response.data?.error) throw await normalizeFunctionError(response.data.error);
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
    async function readCosmetics() {
      await ensureSession();
      const result = await invoke("cosmetic-catalog");
      state.profileRevision = Number(result.revision);
      persist();
      return clone(result);
    }
    async function quoteCosmetic({ cosmeticId }) {
      await ensureSession();
      if (!requiredText(cosmeticId, "INVALID_COSMETIC_ID", 64)) throw new Error("INVALID_COSMETIC_REQUEST");
      const result = await invoke("cosmetic-quote", { cosmeticId });
      state.profileRevision = Number(result.revision);
      persist();
      return clone(result);
    }
    async function applyCosmetic({ expectedRevision = state.profileRevision, actionId = idFactory(), cosmeticId }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(actionId)) || !requiredText(cosmeticId, "INVALID_COSMETIC_ID", 64)) throw new Error("INVALID_COSMETIC_REQUEST");
      const result = await invoke("cosmetic-action", { expectedRevision, actionId, cosmeticId });
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
    async function answerQuiz({ sessionId, actionId = idFactory(), questionIndex, answerId }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(sessionId)) || !UUID_PATTERN.test(String(actionId))
          || !Number.isSafeInteger(questionIndex) || questionIndex < 0 || questionIndex > 9
          || typeof answerId !== "string" || answerId.length < 1 || answerId.length > 32) {
        throw new Error("INVALID_QUIZ_REQUEST");
      }
      return clone(await invoke("quiz-answer", { sessionId, actionId, questionIndex, answerId }));
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
    function enterMatchedRoom(row) {
      if (!row || row.matchmaking_status !== "matched" || !UUID_PATTERN.test(String(row.room_id))) return false;
      state.roomId = row.room_id;
      state.roomCode = null;
      state.setupRevision = 0;
      state.rematchActionId = null;
      state.rematchExpectedVersion = null;
      state.matchmakingTicketId = null;
      state.matchmakingStartedAt = null;
      state.matchmakingFindActionId = null;
      state.cpuStartActionId = null;
      state.cpuStartCharacterId = null;
      persist();
      return true;
    }
    async function recruitOpponent({ displayName, ticketId = state.matchmakingTicketId || idFactory() }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(ticketId))) throw new Error("INVALID_MATCHMAKING_TICKET");
      state.matchmakingTicketId = ticketId;
      persist();
      const response = await supabase.rpc("fcg_standard_matchmaking_recruit", {
        p_ticket_id: ticketId,
        p_display_name: requiredText(displayName, "INVALID_DISPLAY_NAME", 20),
      });
      if (response.error) throw response.error;
      const row = firstRow(response.data);
      if (!enterMatchedRoom(row)) {
        state.matchmakingStartedAt = row?.wait_started_at || state.matchmakingStartedAt;
        persist();
      }
      return clone(row);
    }
    async function findOpponent({ displayName, actionId = state.matchmakingFindActionId || idFactory() }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(actionId))) throw new Error("INVALID_MATCHMAKING_ACTION");
      state.matchmakingFindActionId = actionId;
      persist();
      const response = await supabase.rpc("fcg_standard_matchmaking_find", {
        p_action_id: actionId,
        p_display_name: requiredText(displayName, "INVALID_DISPLAY_NAME", 20),
      });
      if (response.error) throw response.error;
      const row = firstRow(response.data);
      enterMatchedRoom(row);
      state.matchmakingFindActionId = null;
      persist();
      return clone(row);
    }
    async function readMatchmakingStatus(ticketId = state.matchmakingTicketId) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(ticketId))) throw new Error("INVALID_MATCHMAKING_TICKET");
      const response = await supabase.rpc("fcg_standard_matchmaking_status", { p_ticket_id: ticketId });
      if (response.error) throw response.error;
      const row = firstRow(response.data);
      enterMatchedRoom(row);
      if (row?.matchmaking_status !== "searching" && row?.matchmaking_status !== "matched") {
        state.matchmakingTicketId = null;
        state.matchmakingStartedAt = null;
        persist();
      }
      return clone(row);
    }
    async function cancelMatchmaking(ticketId = state.matchmakingTicketId) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(ticketId))) throw new Error("INVALID_MATCHMAKING_TICKET");
      const response = await supabase.rpc("fcg_standard_matchmaking_cancel", { p_ticket_id: ticketId });
      if (response.error) throw response.error;
      const row = firstRow(response.data);
      if (!enterMatchedRoom(row)) {
        state.matchmakingTicketId = null;
        state.matchmakingStartedAt = null;
        persist();
      }
      return clone(row);
    }
    async function readCpuRoster() {
      await ensureSession();
      return clone(await invoke("cpu-roster"));
    }
    async function startCpuOpponent({ actionId = state.cpuStartActionId || idFactory(), characterId }) {
      await ensureSession();
      const selectedCharacter = requiredText(characterId || state.cpuStartCharacterId, "INVALID_CPU_CHARACTER", 32);
      if (!UUID_PATTERN.test(String(actionId))) throw new Error("INVALID_CPU_START");
      if (state.cpuStartActionId && (state.cpuStartActionId !== actionId || state.cpuStartCharacterId !== selectedCharacter)) {
        throw Object.assign(new Error("CPU_START_ALREADY_PENDING"), { code: "CPU_START_ALREADY_PENDING" });
      }
      state.cpuStartActionId = actionId;
      state.cpuStartCharacterId = selectedCharacter;
      persist();
      const result = await invoke("cpu-start", { actionId, characterId: selectedCharacter, confirmed: true });
      if (!UUID_PATTERN.test(String(result.roomId)) || result.matchmakingStatus !== "matched") throw new Error("INVALID_CPU_START_RESULT");
      state.roomId = result.roomId;
      state.roomCode = null;
      state.setupRevision = 0;
      state.rematchActionId = null;
      state.rematchExpectedVersion = null;
      state.matchmakingTicketId = null;
      state.matchmakingStartedAt = null;
      state.matchmakingFindActionId = null;
      state.cpuStartActionId = null;
      state.cpuStartCharacterId = null;
      persist();
      return clone(result);
    }
    async function acceptCpuOpponent({ ticketId = state.matchmakingTicketId, characterId }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(ticketId)) || !requiredText(characterId, "INVALID_CPU_CHARACTER", 32)) throw new Error("INVALID_CPU_ACCEPT");
      const result = await invoke("cpu-accept", { ticketId, characterId });
      if (!UUID_PATTERN.test(String(result.roomId)) || result.matchmakingStatus !== "matched") throw new Error("INVALID_CPU_ACCEPT_RESULT");
      state.roomId = result.roomId;
      state.roomCode = null;
      state.setupRevision = 0;
      state.rematchActionId = null;
      state.rematchExpectedVersion = null;
      state.matchmakingTicketId = null;
      state.matchmakingStartedAt = null;
      state.matchmakingFindActionId = null;
      state.cpuStartActionId = null;
      state.cpuStartCharacterId = null;
      persist();
      return clone(result);
    }
    async function takeCpuTurn({ roomId = state.roomId, expectedVersion }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId)) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("INVALID_CPU_ACTION");
      return clone(await invoke("cpu-action", { roomId, expectedVersion }));
    }
    async function submitSetup({ roomId = state.roomId, expectedSetupRevision = state.setupRevision, loadout, debugMode = false, setupActionId = idFactory() }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId)) || !UUID_PATTERN.test(String(setupActionId)) || typeof debugMode !== "boolean") throw new Error("INVALID_SETUP_ID");
      const result = await invoke("setup", { roomId, expectedSetupRevision, setupActionId, loadout: clone(loadout), debugMode });
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
    async function requestCpuRematch({ roomId = state.roomId, expectedVersion, actionId = null }) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId)) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("INVALID_CPU_REMATCH_REQUEST");
      const pendingMatches = state.rematchExpectedVersion === expectedVersion && UUID_PATTERN.test(String(state.rematchActionId));
      const resolvedActionId = actionId || (pendingMatches ? state.rematchActionId : idFactory());
      if (!UUID_PATTERN.test(String(resolvedActionId))) throw new Error("INVALID_REMATCH_ID");
      state.rematchActionId = resolvedActionId;
      state.rematchExpectedVersion = expectedVersion;
      persist();
      const result = await invoke("cpu-rematch", { roomId, expectedVersion, actionId: resolvedActionId });
      if (result?.readyToSetup || result?.roomStatus === "ready") {
        state.setupRevision = 0;
        state.rematchActionId = null;
        state.rematchExpectedVersion = null;
        persist();
      }
      return clone(result);
    }
    async function readRoom(roomId = state.roomId) {
      await ensureSession();
      if (!UUID_PATTERN.test(String(roomId))) throw new Error("INVALID_ROOM_ID");
      const response = await supabase.rpc("fcg_standard_room_snapshot_v2", { p_room_id: roomId, p_known_profile_revision: state.profileRevision });
      if (response.error) throw response.error;
      const snapshot = firstRow(response.data);
      if (Number(snapshot?.snapshot_schema_version) !== 2 || !Number.isSafeInteger(Number(snapshot?.snapshot_version))
          || !Number.isSafeInteger(Number(snapshot?.profile_revision))
          || !snapshot?.room || !Array.isArray(snapshot.members)) throw new Error("INVALID_ROOM_SNAPSHOT");
      if (snapshot.room.game_mode !== "standard_v5") throw new Error("WRONG_GAME_MODE");
      if (snapshot.room.status === "ready" && Number.isSafeInteger(state.rematchExpectedVersion)
          && Number(snapshot.room.version) > state.rematchExpectedVersion) {
        state.setupRevision = 0;
        state.rematchActionId = null;
        state.rematchExpectedVersion = null;
      }
      state.profileRevision = Number(snapshot.profile_revision);
      state.roomId = roomId;
      persist();
      return clone({
        snapshotSchemaVersion: 2,
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
      let channel = supabase.channel(`standard-room-${roomId}`);
      channel = channel.on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "fcg_rooms",
        filter: `id=eq.${roomId}`,
      }, onInvalidate);
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
      state.matchmakingTicketId = null;
      state.matchmakingStartedAt = null;
      state.matchmakingFindActionId = null;
      state.cpuStartActionId = null;
      state.cpuStartCharacterId = null;
    }

    return Object.freeze({
      acceptCpuOpponent,
      applyCosmetic,
      answerQuiz,
      cancelMatchmaking,
      clearRoom,
      createRoom,
      drawGacha,
      ensureSession,
      finishQuiz,
      findOpponent,
      initialize,
      joinRoom,
      readMatchmakingStatus,
      readCpuRoster,
      readCosmetics,
      readProfile,
      readRoom,
      requestCpuRematch,
      requestRematch,
      quoteCardSale,
      quoteCosmetic,
      recruitOpponent,
      resetConnection,
      snapshot: () => Object.freeze(clone(state)),
      startQuiz,
      startCpuOpponent,
      sellCards,
      submitAction,
      submitSetup,
      subscribeToRoom,
      syncProfile,
      takeCpuTurn,
    });
  }

  return Object.freeze({ STORAGE_KEY, createStandardOnlineClient, normalizeFunctionError });
});
