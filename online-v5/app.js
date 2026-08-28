import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import "../online/supabase-config.js";
import "../online/quick-engine.js";

const cfg = globalThis.FourColorSupabaseConfig;
const supabase = createClient(cfg.url, cfg.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
const $ = (id) => document.getElementById(id);
const COLORS = globalThis.FourColorQuickEngine.COLORS;
const COLOR_JA = { red: "赤", blue: "青", yellow: "黄", green: "緑" };
const COLOR_HEX = { red: "#ef4444", blue: "#3b82f6", yellow: "#eab308", green: "#22c55e" };
const STORAGE_KEY = "fourColorMapGame.online.v5.room";

let session = null;
let roomId = null;
let roomCode = null;
let seat = null;
let roomRow = null;
let members = [];
let publicState = null;
let privateState = null;
let selectedMacros = new Set();
let targetMode = null;
let channel = null;
let pollTimer = null;
let initializing = false;
let actionBusy = false;

function show(id, visible) { $(id).classList.toggle("hidden", !visible); }
function badge(text, tone = "warn") { $("connectionBadge").textContent = text; $("connectionBadge").className = `badge ${tone}`; }
function toast(message) { const node = $("toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2200); }
function cleanName() { return $("playerName").value.trim().slice(0, 20); }
function cleanCode() { return $("roomCode").value.replace(/\s/g, "").toUpperCase().slice(0, 6); }
function saveRoom() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId, roomCode })); }
function clearSavedRoom() { localStorage.removeItem(STORAGE_KEY); }
function firstRow(data) { return Array.isArray(data) ? data[0] : data; }

async function ensureAnonymousSession() {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

async function createRoom() {
  const name = cleanName();
  if (!name) return toast("プレイヤー名を入力してください。");
  setBusy(true);
  try {
    const { data, error } = await supabase.rpc("fcg_create_room", { p_display_name: name });
    if (error) throw error;
    const row = firstRow(data);
    roomId = row.room_id; roomCode = row.room_code; seat = row.seat;
    saveRoom();
    await openRoom();
  } catch (error) { fail(error); } finally { setBusy(false); }
}

async function joinRoom() {
  const name = cleanName(); const code = cleanCode();
  if (!name) return toast("プレイヤー名を入力してください。");
  if (!/^[0-9A-F]{6}$/.test(code)) return toast("合言葉6文字を入力してください。");
  setBusy(true);
  try {
    const { data, error } = await supabase.rpc("fcg_join_room", { p_room_code: code, p_display_name: name });
    if (error) throw error;
    const row = firstRow(data);
    roomId = row.room_id; roomCode = code; seat = row.seat;
    saveRoom();
    await openRoom();
  } catch (error) { fail(error); } finally { setBusy(false); }
}

function setBusy(value) {
  $("createRoom").disabled = value;
  $("joinRoom").disabled = value;
}

function fail(error) {
  console.error(error);
  const message = error?.message || "通信に失敗しました。";
  toast(message.includes("room not found") ? "ルームが見つかりません。" : message);
  badge("再接続中", "bad");
}

const ACTION_ERROR_JA = {
  "Selection must touch an existing region by an edge": "既存エリアに辺で接するマスを選んでください。",
  "Selected macros are not connected": "選んだマス同士を辺でつなげてください。",
  "Selected macro has no free cells": "すでに埋まったマスは選べません。",
  "Macro is outside playable bounds": "盤面の明るい範囲から選んでください。",
  "Shift leaves the world": "その方向へ動かすと盤面外に出ます。",
  "Shift causes overlap": "その方向へ動かすと別エリアに重なります。",
  "Shift disconnects a region": "その方向へ動かすとエリアが分断されます。",
  "Selected band contains no geometry": "色の付いたエリアがある行または列を選んでください。",
  "Match changed; reload and retry.": "相手の操作が先に反映されました。最新状態でもう一度選んでください。",
  "The match has not started.": "対戦はまだ始まっていません。",
};

async function actionErrorMessage(error) {
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const body = await response.clone().json();
      const message = body?.error?.message;
      if (message) return ACTION_ERROR_JA[message] || message;
    } catch (_) {
      // Fall back to the SDK error below when the response is not JSON.
    }
  }
  const message = error?.message || "操作を完了できませんでした。";
  return ACTION_ERROR_JA[message] || message;
}

async function fetchRoom() {
  if (!roomId) return;
  const [roomResult, memberResult, viewResult] = await Promise.all([
    supabase.from("fcg_rooms").select("id,status,version,public_state,winner_seat,expires_at").eq("id", roomId).single(),
    supabase.from("fcg_room_members").select("user_id,seat,display_name,last_seen_at").eq("room_id", roomId).order("seat"),
    supabase.from("fcg_player_views").select("seat,version,private_state").eq("room_id", roomId).maybeSingle(),
  ]);
  if (roomResult.error) throw roomResult.error;
  if (memberResult.error) throw memberResult.error;
  if (viewResult.error) throw viewResult.error;
  roomRow = roomResult.data;
  members = memberResult.data || [];
  seat = members.find((member) => member.user_id === session.user.id)?.seat || seat;
  publicState = roomRow.public_state && Object.keys(roomRow.public_state).length ? roomRow.public_state : null;
  privateState = viewResult.data?.private_state || null;
  render();
  if (roomRow.status === "ready" && !publicState) await initializeMatch();
}

async function initializeMatch() {
  if (initializing) return;
  initializing = true;
  try {
    const { data, error } = await supabase.functions.invoke("game-action", { body: { operation: "initialize", roomId } });
    if (error) throw error;
    if (data?.error) throw data.error;
    await fetchRoom();
  } catch (error) { fail(error); } finally { initializing = false; }
}

async function sendAction(type, payload = {}) {
  if (actionBusy || !publicState) return;
  actionBusy = true;
  render();
  const action = { id: crypto.randomUUID(), expectedVersion: roomRow.version, type, payload };
  try {
    const { data, error } = await supabase.functions.invoke("game-action", { body: { operation: "action", roomId, action } });
    if (error) throw error;
    if (data?.error) throw data.error;
    selectedMacros.clear(); targetMode = null;
    await fetchRoom();
  } catch (error) {
    console.error(error);
    toast(await actionErrorMessage(error));
    await fetchRoom().catch(() => {});
  } finally { actionBusy = false; render(); }
}

async function openRoom() {
  show("lobby", false); show("room", true);
  $("shownCode").textContent = roomCode || "復帰中";
  await subscribe();
  try { await fetchRoom(); badge("同期済み", "good"); } catch (error) { fail(error); }
}

async function subscribe() {
  if (channel) await supabase.removeChannel(channel);
  channel = supabase.channel(`fcg-room-${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "fcg_rooms", filter: `id=eq.${roomId}` }, () => fetchRoom().catch(fail))
    .on("postgres_changes", { event: "*", schema: "public", table: "fcg_room_members", filter: `room_id=eq.${roomId}` }, () => fetchRoom().catch(fail))
    .on("postgres_changes", { event: "*", schema: "public", table: "fcg_player_views", filter: `room_id=eq.${roomId}` }, () => fetchRoom().catch(fail))
    .subscribe((status) => badge(status === "SUBSCRIBED" ? "リアルタイム" : "再接続中", status === "SUBSCRIBED" ? "good" : "warn"));
  clearInterval(pollTimer);
  pollTimer = setInterval(() => fetchRoom().catch(() => badge("再接続中", "warn")), 2500);
}

function render() {
  show("lobby", !roomId);
  show("room", Boolean(roomId));
  show("game", Boolean(roomRow?.status === "playing" || roomRow?.status === "finished"));
  if (!roomId) return;
  $("shownCode").textContent = roomCode || "復帰済";
  $("seatBadge").textContent = seat ? `Player ${seat}` : "席を確認中";
  $("roomStatus").textContent = roomRow?.status || "loading";
  $("members").innerHTML = members.map((member) => `<span class="member">Player ${member.seat}: ${escapeHtml(member.display_name)}</span>`).join("");
  $("waitingMessage").classList.toggle("hidden", roomRow?.status !== "waiting" && roomRow?.status !== "ready");
  $("waitingMessage").textContent = roomRow?.status === "ready" ? "2人揃いました。対戦を初期化しています。" : "相手の参加を待っています。";
  if (!publicState) return;
  $("versionText").textContent = roomRow.version;
  const myTurn = publicState.active === seat && !publicState.winner;
  $("turnBadge").textContent = publicState.winner ? `勝者 Player ${publicState.winner}` : myTurn ? "あなたの手番" : `Player ${publicState.active} の手番`;
  $("turnBadge").className = `badge ${publicState.winner ? "warn" : myTurn ? "good" : "bad"}`;
  $("phaseText").textContent = phaseLabel(publicState.phase);
  drawBoard(); renderSelection(myTurn); renderPalette(myTurn); renderSkills(myTurn); renderTargets(myTurn);
  $("surrender").disabled = actionBusy || Boolean(publicState.winner);
  $("gameLog").innerHTML = (publicState.log || []).slice(-30).reverse().map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
}

function phaseLabel(phase) {
  return phase === "COLOR" ? "彩色フェーズ" : phase === "CREATE_FIRST" ? "初手エリア指定" : phase === "WORK" ? "エリア指定・スキル" : "対戦終了";
}

function renderSelection(myTurn) {
  const enabled = myTurn && (publicState.phase === "WORK" || publicState.phase === "CREATE_FIRST");
  show("selectionControls", enabled);
  $("selectionCount").textContent = `${selectedMacros.size} / ${publicState.requiredSize}マス`;
  $("submitRegion").disabled = actionBusy || selectedMacros.size !== publicState.requiredSize;
}

function renderPalette(myTurn) {
  const box = $("palette"); box.innerHTML = "";
  if (publicState.phase !== "COLOR" || !privateState) return;
  const palette = privateState.prismActive ? COLORS : privateState.palette;
  for (const color of [...new Set(palette)]) {
    const button = document.createElement("button"); button.className = "color-button"; button.dataset.color = color;
    button.textContent = `${COLOR_JA[color]}${privateState.seals?.[color] ? "（封印）" : ""}`;
    button.disabled = !myTurn || actionBusy || privateState.seals?.[color] > 0;
    button.onclick = () => sendAction("COLOR_REGION", { color }); box.appendChild(button);
  }
  if (myTurn && palette.every((color) => privateState.seals?.[color] > 0)) {
    const lose = document.createElement("button"); lose.textContent = "使用可能色なしを確定"; lose.className = "danger";
    lose.onclick = () => sendAction("DECLARE_NO_COLOR"); box.appendChild(lose);
  }
}

function renderSkills(myTurn) {
  const box = $("skills"); box.innerHTML = "";
  if (!privateState) return;
  const defs = [
    ["colorPrism", "四色解放", "彩色前だけ全4色を候補にする", "COLOR"],
    ["areaHalfShift", "半マスシフト", "行または列を0.5マス移動", "WORK"],
    ["disruptChoiceOne", "色封じ", "相手の次の彩色で1色を封印", "WORK"],
  ];
  for (const [key, name, desc, timing] of defs) {
    const button = document.createElement("button"); button.className = "skill";
    button.innerHTML = `${name} ×${privateState.hand?.[key] || 0}<span>${desc}</span>`;
    const phaseOkay = timing === "COLOR" ? publicState.phase === "COLOR" : publicState.phase === "WORK" || publicState.phase === "CREATE_FIRST";
    button.disabled = !myTurn || actionBusy || !phaseOkay || !(privateState.hand?.[key] > 0);
    button.onclick = () => selectSkill(key); box.appendChild(button);
  }
}

function selectSkill(key) {
  if (key === "colorPrism") return sendAction("USE_SKILL", { skill: key });
  targetMode = key; renderTargets(true); toast(key === "areaHalfShift" ? "盤面の基準マスを選んでください。" : "封印する色を選んでください。");
}

function renderTargets(myTurn) {
  const box = $("targetControls"); box.innerHTML = "";
  if (!myTurn || !targetMode) return;
  if (targetMode === "disruptChoiceOne") {
    for (const color of COLORS) {
      const button = document.createElement("button"); button.className = "color-button"; button.dataset.color = color; button.textContent = `${COLOR_JA[color]}を封じる`;
      button.onclick = () => sendAction("USE_SKILL", { skill: targetMode, color }); box.appendChild(button);
    }
  } else if (targetMode && typeof targetMode === "object") {
    for (const [direction, label] of [["left","左"],["right","右"],["up","上"],["down","下"]]) {
      const button = document.createElement("button"); button.textContent = `${label}へ0.5マス`;
      button.onclick = () => sendAction("USE_SKILL", { skill: "areaHalfShift", macro: targetMode.macro, direction }); box.appendChild(button);
    }
  }
  const cancel = document.createElement("button"); cancel.className = "ghost"; cancel.textContent = "キャンセル"; cancel.onclick = () => { targetMode = null; render(); }; box.appendChild(cancel);
}

function drawBoard() {
  const canvas = $("board"); const ctx = canvas.getContext("2d"); const size = canvas.width / 48;
  ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bounds = publicState.playableBounds;
  ctx.fillStyle = "#0f172a"; ctx.fillRect(bounds.left * 4 * size, bounds.top * 4 * size, (bounds.right - bounds.left + 1) * 4 * size, (bounds.bottom - bounds.top + 1) * 4 * size);
  for (const region of Object.values(publicState.regions || {})) {
    ctx.fillStyle = region.color ? COLOR_HEX[region.color] : "#94a3b8";
    for (const micro of region.micro) { const x = micro % 48; const y = Math.floor(micro / 48); ctx.fillRect(x * size, y * size, size + .2, size + .2); }
  }
  ctx.lineWidth = 1; ctx.strokeStyle = "#334155";
  for (let i = 0; i <= 12; i += 1) { ctx.beginPath(); ctx.moveTo(i * 4 * size, 0); ctx.lineTo(i * 4 * size, canvas.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 4 * size); ctx.lineTo(canvas.width, i * 4 * size); ctx.stroke(); }
  ctx.fillStyle = "#ffffff38"; ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 3;
  for (const macro of selectedMacros) { const x = macro % 12; const y = Math.floor(macro / 12); ctx.fillRect(x * 4 * size, y * 4 * size, 4 * size, 4 * size); ctx.strokeRect(x * 4 * size + 1, y * 4 * size + 1, 4 * size - 2, 4 * size - 2); }
}

function boardClick(event) {
  if (!publicState || actionBusy || publicState.active !== seat || publicState.winner) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const column = Math.max(0, Math.min(11, Math.floor((event.clientX - rect.left) / rect.width * 12)));
  const row = Math.max(0, Math.min(11, Math.floor((event.clientY - rect.top) / rect.height * 12)));
  const macro = row * 12 + column;
  if (targetMode === "areaHalfShift") { targetMode = { macro }; return render(); }
  if (publicState.phase !== "WORK" && publicState.phase !== "CREATE_FIRST") return;
  if (selectedMacros.has(macro)) selectedMacros.delete(macro);
  else if (selectedMacros.size < publicState.requiredSize) selectedMacros.add(macro);
  render();
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }

async function leaveLocal() {
  roomId = roomCode = seat = null; roomRow = publicState = privateState = null; members = []; selectedMacros.clear(); targetMode = null;
  clearSavedRoom(); clearInterval(pollTimer); if (channel) await supabase.removeChannel(channel); channel = null; render();
}

$("createRoom").onclick = createRoom;
$("joinRoom").onclick = joinRoom;
$("roomCode").oninput = () => { $("roomCode").value = cleanCode(); };
$("leaveRoom").onclick = leaveLocal;
$("clearSelection").onclick = () => { selectedMacros.clear(); render(); };
$("submitRegion").onclick = () => sendAction("CREATE_REGION", { macros: [...selectedMacros].sort((a, b) => a - b) });
$("surrender").onclick = () => sendAction("SURRENDER");
$("board").addEventListener("pointerdown", boardClick);

try {
  session = await ensureAnonymousSession();
  badge("匿名ログイン済み", "good");
  $("connectionMessage").textContent = `端末ユーザー ${session.user.id.slice(0, 8)}…`;
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (saved?.roomId) { roomId = saved.roomId; roomCode = saved.roomCode || null; await openRoom(); }
  else { show("lobby", true); render(); }
} catch (error) {
  fail(error); $("connectionMessage").textContent = "Supabaseへ接続できません。通信環境と匿名ログイン設定を確認してください。";
}
