import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import "../online/supabase-config.js";

const cfg = globalThis.FourColorSupabaseConfig;
const supabase = createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
const client = globalThis.FourColorStandardOnlineClient.createStandardOnlineClient({ supabase, storage: localStorage, idFactory: () => crypto.randomUUID() });
const skillIntents = globalThis.FourColorStandardOnlineSkillIntents;
const $ = (id) => document.getElementById(id);
const SAVE_KEY = "fourColorMapGame.standard.v5.save";
const PROFILE_CHOICE_KEY = "fourColorMapGame.standard.online.v5.profile";
const STARTER_PROFILE_KEY = "fourColorMapGame.standard.online.v5.starter-profile";
const STARTER_PROFILE_ID = "online-starter";
const STARTER_INVENTORY = Object.freeze({
  colorRandomBorrow: 3, colorChoiceBorrow: 3,
  areaMicroBloom: 3, areaDiePlus: 3,
  disruptRandomOne: 3, disruptChoiceOne: 3,
});
const SKILLS = [
  ["colorRandomBorrow", "色拾い・乱", "color"], ["colorChoiceBorrow", "色借り", "color"], ["colorPrism", "四色解放", "color"],
  ["colorRegionSplit", "エリア二分", "color"], ["colorPaletteChange", "持ち色変更", "color"],
  ["areaMicroBloom", "ひとふくらみ", "area"], ["areaDiePlus", "エリア拡張", "area"], ["areaResize", "拡大縮小", "area"],
  ["areaCornerBloom", "角膨張", "area"], ["areaHalfShift", "半マスシフト", "area"], ["areaTripleShift", "三層断層", "area"],
  ["disruptRandomOne", "色封じ・乱", "disrupt"], ["disruptChoiceOne", "色封じ", "disrupt"], ["disruptRandomTwo", "二重封じ・乱", "disrupt"],
  ["disruptPaletteRandom", "持ち色汚染・乱", "disrupt"], ["disruptChoiceTwo", "追封", "disrupt"], ["disruptPaletteChoice", "持ち色汚染", "disrupt"],
  ["disruptChoiceThree", "長封", "disrupt"], ["disruptForcedPalette", "強制持ち替え", "disrupt"],
];
const CATEGORY_LABEL = { color: "色カード", area: "エリアカード", disrupt: "妨害カード" };
let localRoot = null;
let availableProfiles = {};
let selectedProfileId = null;
let synced = false;
let connected = false;
let roomModel = null;
let pollTimer = null;
let initializeBusy = false;
let actionBusy = false;
let rematchBusy = false;
let pendingAction = null;
let targetDraft = null;
const selectedMacros = new Set();
const COLOR_HEX = { red: "#ef4444", blue: "#3b82f6", yellow: "#eab308", green: "#22c55e" };
const COLOR_JA = { red: "赤", blue: "青", yellow: "黄", green: "緑" };
const SKILL_META = Object.fromEntries(SKILLS.map(([id, name, category]) => [id, { name, category }]));

function show(id, value) { $(id).classList.toggle("hidden", !value); }
function badge(text, tone = "warn") { $("connectionBadge").textContent = text; $("connectionBadge").className = `badge ${tone}`; }
function toast(message) { const node = $("toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2400); }
function profile() { return availableProfiles[selectedProfileId] || null; }
function displayName() { return String(profile()?.displayName || "").trim().slice(0, 20); }
function safeJson(value) { return JSON.stringify(value, null, 2); }
function actionSignature(type, payload) { return JSON.stringify({ type, payload }); }
function hasStandardPublicState(value) {
  return Boolean(value && typeof value === "object" && value.playableBounds && Number.isSafeInteger(value.version));
}

function loadProfiles() {
  try { localRoot = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch { localRoot = null; }
  let starterProfile = null;
  try { starterProfile = JSON.parse(localStorage.getItem(STARTER_PROFILE_KEY) || "null"); } catch { starterProfile = null; }
  const profiles = Object.entries(localRoot?.profiles || {});
  if (starterProfile && typeof starterProfile === "object" && !Array.isArray(starterProfile)) profiles.push([STARTER_PROFILE_ID, starterProfile]);
  availableProfiles = Object.fromEntries(profiles);
  $("profileSelect").replaceChildren();
  for (const [id, value] of profiles) {
    const option = document.createElement("option"); option.value = id; option.textContent = value.displayName || id; $("profileSelect").appendChild(option);
  }
  const saved = localStorage.getItem(PROFILE_CHOICE_KEY);
  selectedProfileId = profiles.some(([id]) => id === saved) ? saved : profiles[0]?.[0] || null;
  if (selectedProfileId) $("profileSelect").value = selectedProfileId;
  renderProfile();
}

function renderProfile() {
  const value = profile();
  show("profileCard", true);
  show("starterCreator", !value);
  $("syncProfile").disabled = !value || !connected;
  $("profileSummary").textContent = value ? `${value.displayName} — 所持カード ${Object.values(value.inventory || {}).reduce((sum, count) => sum + count, 0)}枚` : "名前を入力して、はじめて用プロフィールを作成してください。";
  if (value) renderLoadout();
}

function starterProfile(displayName) {
  return {
    displayName,
    quizRecords: {},
    gachaTickets: {},
    inventory: { ...STARTER_INVENTORY },
    coins: 0,
    achievements: [],
    protectedSkills: { areaHalfShift: true },
    cosmeticsOwned: ["boardDefault", "effectDefault", "nameplateDefault", "titleNone"],
    equipped: { board: "boardDefault", effect: "effectDefault", nameplate: "nameplateDefault", title: "titleNone" },
    trophies: { fullPaint: false, fullPaint3: false, noSkillFullPaint: false },
    trophyDates: {},
    stats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
    matchHistory: [],
  };
}

function createStarterProfile() {
  const name = String($("starterName").value || "").trim().slice(0, 20);
  if (!name) return toast("名前を入力してください。");
  localStorage.setItem(STARTER_PROFILE_KEY, JSON.stringify(starterProfile(name)));
  localStorage.setItem(PROFILE_CHOICE_KEY, STARTER_PROFILE_ID);
  loadProfiles();
  toast("はじめて用プロフィールを作成しました。続けてオンライン同期してください。");
}

function renderLoadout() {
  const value = profile();
  const grid = $("loadoutGrid"); grid.replaceChildren();
  for (const category of ["color", "area", "disrupt"]) {
    const section = document.createElement("div"); section.className = "loadout-category";
    const title = document.createElement("h3"); title.textContent = CATEGORY_LABEL[category]; section.appendChild(title);
    const available = SKILLS.filter(([id, , kind]) => kind === category && (value?.inventory?.[id] || 0) > 0);
    for (const [index, [id, name]] of available.entries()) {
      const label = document.createElement("label"); label.className = "loadout-option";
      const input = document.createElement("input"); input.type = "checkbox"; input.name = `loadout-${category}`; input.value = id; input.checked = index < 2;
      input.onchange = () => enforceTwo(category, input); label.appendChild(input);
      const text = document.createTextNode(name); label.appendChild(text);
      const count = document.createElement("span"); count.textContent = `×${value.inventory[id]}`; label.appendChild(count); section.appendChild(label);
    }
    if (!available.length) { const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "所持カードなし"; section.appendChild(empty); }
    grid.appendChild(section);
  }
}

function enforceTwo(category, changed) {
  const checked = [...document.querySelectorAll(`input[name="loadout-${category}"]:checked`)];
  if (checked.length > 2) changed.checked = false;
}
function selectedLoadout() {
  return Object.fromEntries(["color", "area", "disrupt"].map((category) => [category, [...document.querySelectorAll(`input[name="loadout-${category}"]:checked`)].map((input) => input.value)]));
}
function validLoadout(loadout) { return ["color", "area", "disrupt"].every((category) => loadout[category].length === 2); }

async function refreshRoom() {
  const snapshot = client.snapshot();
  if (!snapshot.roomId) return render();
  roomModel = await client.readRoom(snapshot.roomId);
  render();
  if (roomModel.room.status === "ready" && client.snapshot().setupRevision > 0 && !hasStandardPublicState(roomModel.room.public_state) && !initializeBusy) {
    initializeBusy = true;
    try { await client.initialize(); roomModel = await client.readRoom(); } catch (error) { if (!String(error.message).includes("setup")) console.warn(error); }
    finally { initializeBusy = false; render(); }
  }
}

function render() {
  const snapshot = client.snapshot();
  show("lobby", synced && !snapshot.roomId);
  show("room", Boolean(snapshot.roomId));
  show("setupCard", Boolean(snapshot.roomId) && Boolean(profile()) && !["playing", "finished"].includes(roomModel?.room?.status));
  show("matchCard", ["playing", "finished"].includes(roomModel?.room?.status));
  show("rematchControls", roomModel?.room?.status === "finished");
  if (!snapshot.roomId) return;
  $("shownCode").textContent = snapshot.roomCode || "復帰済";
  $("seatBadge").textContent = roomModel?.view?.seat ? `Player ${roomModel.view.seat}` : "席確認中";
  $("roomStatus").textContent = roomModel?.room?.status || "loading";
  const rematchPending = snapshot.rematchExpectedVersion === roomModel?.room?.version;
  $("requestRematch").textContent = rematchPending ? "同じ再戦申請を再送" : "再戦を申し込む";
  $("requestRematch").disabled = rematchBusy || roomModel?.room?.status !== "finished";
  $("rematchStatus").textContent = rematchPending ? "再戦を申請済みです。相手の申請を待っています。" : "両プレイヤーの申請後、6枚セットを選び直します。";
  $("members").replaceChildren(...(roomModel?.members || []).map((member) => { const node = document.createElement("span"); node.className = "member"; node.textContent = `Player ${member.seat}: ${member.display_name}`; return node; }));
  $("waitingMessage").textContent = client.snapshot().setupRevision > 0 ? "あなたの6枚は確認済みです。相手の6枚を待っています。" : "6枚セットを確認してください。";
  $("setupStatus").textContent = client.snapshot().setupRevision > 0 ? `setup revision ${client.snapshot().setupRevision} 確認済み` : "未確認";
  if (hasStandardPublicState(roomModel?.room?.public_state)) {
    const publicState = roomModel.room.public_state;
    $("versionText").textContent = roomModel.room.version;
    $("turnBadge").textContent = publicState.status === "FINISHED" ? `勝者 Player ${publicState.winner}` : `Player ${publicState.active} の手番`;
    $("phaseText").textContent = publicState.phase;
    $("publicProjection").textContent = safeJson(publicState);
    $("privateProjection").textContent = safeJson(roomModel.view?.private_state || {});
    renderBoard(publicState);
    renderBasicActions(publicState, roomModel.view?.private_state || {});
    renderSkills(publicState, roomModel.view?.private_state || {});
  }
}

function button(text, onClick, className = "") {
  const node = document.createElement("button"); node.textContent = text; node.className = className; node.onclick = onClick; return node;
}

function renderSkills(state, privateState) {
  const box = $("skillControls"); box.replaceChildren();
  const myTurn = state.status === "ACTIVE" && state.active === roomModel?.view?.seat;
  for (const [skill, count] of Object.entries(privateState.hand || {})) {
    if (!(count > 0) || !SKILL_META[skill]) continue;
    const meta = SKILL_META[skill]; const node = button(`${meta.name} ×${count}`, () => beginSkill(skill), "skill");
    const timingOkay = meta.category === "color" ? state.phase === "COLOR" : ["CREATE_FIRST", "WORK"].includes(state.phase);
    node.disabled = actionBusy || !myTurn || !timingOkay; box.appendChild(node);
  }
  renderSkillTarget(state);
}

function beginSkill(skill) {
  if (skillIntents.isImmediate(skill)) {
    return sendAction("USE_SKILL", skillIntents.buildSkillPayload(skill));
  }
  targetDraft = { skill, kind: skillIntents.TARGET_KIND[skill], input: {} };
  selectedMacros.clear(); render();
}

function targetChoice(label, key, value) {
  const selected = targetDraft?.input?.[key] === value;
  const node = button(label, () => { targetDraft.input[key] = value; render(); }, selected ? "primary" : "ghost");
  return node;
}

function renderSkillTarget(state) {
  const panel = $("skillTargetControls"); panel.replaceChildren(); show("skillTargetControls", Boolean(targetDraft));
  if (!targetDraft) return;
  const title = document.createElement("strong"); title.textContent = `${SKILL_META[targetDraft.skill].name} — 対象を指定`; panel.appendChild(title);
  const controls = document.createElement("div"); controls.className = "controls";
  if (["color", "slot-color"].includes(targetDraft.kind)) {
    for (const color of skillIntents.COLORS) controls.appendChild(targetChoice(COLOR_JA[color], "color", color));
  }
  if (targetDraft.kind === "slot-color") for (const slot of [0, 1, 2]) controls.appendChild(targetChoice(`持ち色${slot + 1}`, "slot", slot));
  if (targetDraft.kind === "region-split") {
    for (const id of Object.keys(state.regions || {})) controls.appendChild(targetChoice(id, "regionId", id));
  }
  if (["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind)) {
    const note = document.createElement("span"); note.className = "selected-macro-note"; note.textContent = `盤面選択 ${selectedMacros.size}マス`; controls.appendChild(note);
  }
  if (targetDraft.kind === "corner-bloom") {
    const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.placeholder = "角の基準マス";
    input.value = targetDraft.input.macro ?? ""; input.oninput = () => { targetDraft.input.macro = Number(input.value); }; controls.appendChild(input);
  }
  if (targetDraft.kind === "resize") {
    for (const mode of ["expand", "shrink"]) controls.appendChild(targetChoice(mode === "expand" ? "拡大" : "縮小", "mode", mode));
    for (const [side, label] of [["top", "上"], ["right", "右"], ["bottom", "下"], ["left", "左"]]) controls.appendChild(targetChoice(label, "side", side));
  }
  if (targetDraft.kind === "band-shift") {
    for (const axis of ["ROW", "COLUMN"]) controls.appendChild(targetChoice(axis === "ROW" ? "行" : "列", "axis", axis));
    const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = String(state.playableBounds.macroWidth - 1); input.placeholder = "番号";
    input.value = targetDraft.input.index ?? ""; input.oninput = () => { targetDraft.input.index = Number(input.value); }; controls.appendChild(input);
    for (const direction of ["minus", "plus"]) controls.appendChild(targetChoice(direction === "minus" ? "負方向" : "正方向", "direction", direction));
  }
  panel.appendChild(controls);
  const actions = document.createElement("div"); actions.className = "controls";
  if (["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind)) {
    actions.appendChild(button("盤面選択を解除", () => { selectedMacros.clear(); render(); }, "ghost"));
  }
  actions.appendChild(button("この対象で使う", submitSkillTarget, "primary"));
  actions.appendChild(button("キャンセル", () => { targetDraft = null; selectedMacros.clear(); render(); }, "ghost")); panel.appendChild(actions);
}

function submitSkillTarget() {
  if (!targetDraft) return;
  const input = { ...targetDraft.input };
  if (["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind)) input.sourceMacros = [...selectedMacros];
  try {
    const payload = skillIntents.buildSkillPayload(targetDraft.skill, input);
    targetDraft = null; selectedMacros.clear(); sendAction("USE_SKILL", payload);
  } catch { toast("対象の指定が不足しています。"); }
}

function renderBoard(state) {
  const canvas = $("board"); const ctx = canvas.getContext("2d");
  const macroWidth = state.playableBounds.macroWidth; const microScale = state.playableBounds.microScale;
  const microWidth = macroWidth * microScale; const cell = canvas.width / microWidth;
  ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bounds = state.playableBounds;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(bounds.minCol * microScale * cell, bounds.minRow * microScale * cell,
    (bounds.maxCol - bounds.minCol + 1) * microScale * cell, (bounds.maxRow - bounds.minRow + 1) * microScale * cell);
  for (const region of Object.values(state.regions || {})) {
    ctx.fillStyle = region.color ? COLOR_HEX[region.color] : "#94a3b8";
    for (const micro of region.micro || []) {
      const x = micro % microWidth; const y = Math.floor(micro / microWidth);
      ctx.fillRect(x * cell, y * cell, cell + .2, cell + .2);
    }
  }
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
  for (let index = 0; index <= macroWidth; index += 1) {
    const offset = index * microScale * cell;
    ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, offset); ctx.lineTo(canvas.width, offset); ctx.stroke();
  }
  ctx.fillStyle = "#ffffff38"; ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 3;
  for (const macro of selectedMacros) {
    const col = macro % macroWidth; const row = Math.floor(macro / macroWidth);
    ctx.fillRect(col * microScale * cell, row * microScale * cell, microScale * cell, microScale * cell);
    ctx.strokeRect(col * microScale * cell + 1, row * microScale * cell + 1, microScale * cell - 2, microScale * cell - 2);
  }
}

function renderBasicActions(state, privateState) {
  const seat = roomModel?.view?.seat;
  const myTurn = state.status === "ACTIVE" && state.active === seat;
  const canCreate = myTurn && !targetDraft && ["CREATE_FIRST", "WORK"].includes(state.phase);
  show("regionControls", canCreate);
  $("selectionCount").textContent = `${selectedMacros.size} / ${state.requiredSize}マス`;
  $("submitRegion").disabled = actionBusy || selectedMacros.size !== state.requiredSize;
  const palette = $("paletteControls"); palette.replaceChildren();
  if (myTurn && state.phase === "COLOR") {
    const colors = [...new Set([...(privateState.basicPalette || []), ...(privateState.bonusUsesRemaining > 0 ? [privateState.bonusColor] : [])])];
    for (const color of colors) {
      const button = document.createElement("button"); button.className = "color-button"; button.dataset.color = color;
      button.textContent = COLOR_JA[color] || color; button.disabled = actionBusy; button.onclick = () => sendAction("COLOR_REGION", { color }); palette.appendChild(button);
    }
  }
  show("declareNoColor", myTurn && state.phase === "COLOR");
  $("declareNoColor").disabled = actionBusy;
  $("surrender").disabled = actionBusy || !myTurn;
  show("retryAction", Boolean(pendingAction) && !actionBusy);
}

function boardPointer(event) {
  const state = roomModel?.room?.public_state; const seat = roomModel?.view?.seat;
  const skillGeometry = targetDraft && ["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind);
  if (!state || actionBusy || state.active !== seat || (!skillGeometry && !["CREATE_FIRST", "WORK"].includes(state.phase))) return;
  const rect = event.currentTarget.getBoundingClientRect(); const width = state.playableBounds.macroWidth;
  const col = Math.max(0, Math.min(width - 1, Math.floor((event.clientX - rect.left) / rect.width * width)));
  const row = Math.max(0, Math.min(width - 1, Math.floor((event.clientY - rect.top) / rect.height * width)));
  const macro = row * width + col;
  if (selectedMacros.has(macro)) selectedMacros.delete(macro);
  else if (selectedMacros.size < state.requiredSize) selectedMacros.add(macro);
  render();
}

async function sendAction(type, payload = {}, retry = false) {
  const state = roomModel?.room?.public_state; if (!state || actionBusy) return;
  const signature = actionSignature(type, payload);
  if (!retry || !pendingAction || pendingAction.signature !== signature) {
    pendingAction = { id: crypto.randomUUID(), expectedVersion: roomModel.room.version, type, payload, signature };
  }
  actionBusy = true; $("actionStatus").textContent = "サーバーで確認中…"; render();
  try {
    await client.submitAction(pendingAction);
    pendingAction = null; selectedMacros.clear(); $("actionStatus").textContent = "操作を保存しました。";
    await refreshRoom();
  } catch (error) {
    $("actionStatus").textContent = "保存できませんでした。同じ操作IDで再送できます。"; toast(error.message || "操作に失敗しました。");
    await refreshRoom().catch(() => {});
  } finally { actionBusy = false; render(); }
}

async function syncSelectedProfile() {
  const value = profile(); if (!value) return;
  $("syncProfile").disabled = true;
  try {
    await client.readProfile();
    await client.syncProfile({ displayName: displayName(), profileState: value });
    synced = true; localStorage.setItem(PROFILE_CHOICE_KEY, selectedProfileId); badge("プロフィール同期済み", "good"); render();
  } catch (error) { toast(error.message || "同期に失敗しました。"); }
  finally { $("syncProfile").disabled = false; }
}

async function createRoom() { try { await client.createRoom(displayName()); await refreshRoom(); startPolling(); } catch (error) { toast(error.message); } }
async function joinRoom() { try { await client.joinRoom({ roomCode: $("roomCode").value, displayName: displayName() }); await refreshRoom(); startPolling(); } catch (error) { toast(error.message); } }
async function submitSetup() {
  const loadout = selectedLoadout(); if (!validLoadout(loadout)) return toast("各カテゴリから2枚ずつ選んでください。");
  $("submitSetup").disabled = true;
  try { await client.submitSetup({ loadout }); await refreshRoom(); toast("6枚セットを確認しました。"); }
  catch (error) { toast(error.message || "6枚セットを確認できませんでした。"); }
  finally { $("submitSetup").disabled = false; }
}
async function requestRematch() {
  if (rematchBusy || roomModel?.room?.status !== "finished") return;
  rematchBusy = true; render();
  try {
    const result = await client.requestRematch({ expectedVersion: roomModel.room.version });
    toast(result.ready_to_setup ? "再戦用の6枚セットを選んでください。" : "再戦を申請しました。相手を待っています。");
    await refreshRoom();
  } catch (error) {
    toast(error.message || "再戦を申請できませんでした。同じIDで再送できます。");
    await refreshRoom().catch(() => {});
  } finally { rematchBusy = false; render(); }
}
function startPolling() { clearInterval(pollTimer); pollTimer = setInterval(() => refreshRoom().catch(() => badge("再接続中", "warn")), 2500); }

$("profileSelect").onchange = () => { selectedProfileId = $("profileSelect").value; synced = false; renderProfile(); render(); };
$("createStarterProfile").onclick = createStarterProfile;
$("syncProfile").onclick = syncSelectedProfile;
$("createRoom").onclick = createRoom;
$("joinRoom").onclick = joinRoom;
$("roomCode").oninput = () => { $("roomCode").value = $("roomCode").value.replace(/\s/g, "").toUpperCase().slice(0, 6); };
$("submitSetup").onclick = submitSetup;
$("board").addEventListener("pointerdown", boardPointer);
$("clearSelection").onclick = () => { selectedMacros.clear(); render(); };
$("submitRegion").onclick = () => sendAction("CREATE_REGION", { sourceMacros: [...selectedMacros].sort((a, b) => a - b) });
$("declareNoColor").onclick = () => sendAction("DECLARE_NO_COLOR");
$("surrender").onclick = () => sendAction("SURRENDER");
$("retryAction").onclick = () => pendingAction && sendAction(pendingAction.type, pendingAction.payload, true);
$("requestRematch").onclick = requestRematch;
$("leaveRoom").onclick = () => { client.clearRoom(); roomModel = null; clearInterval(pollTimer); render(); };

loadProfiles();
render();
try {
  const session = await client.ensureSession();
  connected = true;
  $("connectionMessage").textContent = `端末ユーザー ${session.user.id.slice(0, 8)}…`;
  badge("匿名ログイン済み", "good"); loadProfiles();
  if (client.snapshot().roomId) { synced = true; await refreshRoom(); startPolling(); }
  render();
} catch (error) {
  badge("接続失敗", "bad"); $("connectionMessage").textContent = "Supabaseへ接続できません。匿名ログイン設定を確認してください。"; console.error(error);
}
