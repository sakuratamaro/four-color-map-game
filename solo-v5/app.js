"use strict";

const engine = globalThis.FourColorQuickEngine;
const cpu = globalThis.FourColorQuickCpu;
const saveCodec = globalThis.FourColorSoloSaveCodec;
const COLORS = ["red", "blue", "yellow", "green"];
const COLOR_JA = { red: "赤", blue: "青", yellow: "黄", green: "緑" };
const COLOR_HEX = { red: "#ef4444", blue: "#3b82f6", yellow: "#eab308", green: "#22c55e" };
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "four-color-map-game-solo-v5-save";
const CORRUPT_SAVE_MESSAGE = "保存された対戦データを読み込めませんでした。\n新しい対戦を開始してください。";
const STORAGE_UNAVAILABLE_MESSAGE = "このブラウザでは保存機能を利用できません。対戦はこの画面を閉じずに続けられます。";

let state = null;
let humanSeat = "A";
let cpuSeat = "B";
let difficulty = "normal";
let selectedMacros = new Set();
let targetMode = null;
let actionBusy = false;
let cpuThinking = false;
let generation = 0;
let cpuTimer = null;
let paletteRandom = Math.random;
let rollRandom = Math.random;
let effectRandom = Math.random;
let cpuRandom = Math.random;
let toastTimer = null;
let saveFailureShown = false;
let storageAvailable = true;
let corruptSaveHandled = false;
const macroButtons = [];

function show(id, visible) { $(id).classList.toggle("hidden", !visible); }
function other(seat) { return seat === "A" ? "B" : "A"; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function seededRandom(seed, restoredState = null) {
  let value = restoredState === null ? seed >>> 0 : restoredState >>> 0;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
  random.snapshot = () => value;
  return random;
}
function randomSeed() {
  if (globalThis.crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
function actionId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function clearToast() {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  $("toast").textContent = "";
  $("toast").classList.remove("show");
}
function toast(message) {
  clearToast();
  $("toast").textContent = message;
  $("toast").classList.add("show");
  toastTimer = setTimeout(() => {
    toastTimer = null;
    $("toast").textContent = "";
    $("toast").classList.remove("show");
  }, 2300);
}

function runtimeProblem() {
  if (!engine?.createQuickGame || !engine?.applyAction || !engine?.publicState || !engine?.privateState) {
    return "ゲーム本体を読み込めませんでした。ZIP内から直接開かず、フォルダーへ展開してから再度開いてください。";
  }
  if (!cpu?.chooseAction || !cpu?.internals) {
    return "CPU対戦データを読み込めませんでした。ページを Ctrl+F5 で再読み込みしてください。";
  }
  if (!saveCodec?.decode || !saveCodec?.encode) {
    return "保存データ検証ファイルを読み込めませんでした。ページを Ctrl+F5 で再読み込みしてください。";
  }
  return "";
}

function showStartupProblem(message = runtimeProblem()) {
  const box = $("startupError");
  box.textContent = message;
  show("startupError", Boolean(message));
  $("startGame").disabled = Boolean(message);
}

function rngSnapshot() {
  return {
    version: saveCodec.RNG_VERSION,
    streams: [
      ["palette", paletteRandom],
      ["roll", rollRandom],
      ["effect", effectRandom],
      ["cpu", cpuRandom],
    ].map(([name, random]) => ({ name, state: random.snapshot() })),
  };
}

function saveGame(candidateState = state) {
  if (!candidateState) return false;
  try {
    if (!storageAvailable) throw new Error("storage unavailable");
    const record = {
      schemaVersion: saveCodec.SAVE_SCHEMA_VERSION,
      engineVersion: saveCodec.ENGINE_VERSION,
      policyVersion: cpu.POLICY_VERSIONS[difficulty],
      savedAt: new Date().toISOString(),
      humanSeat,
      cpuSeat,
      difficulty,
      state: candidateState,
      rngSnapshot: rngSnapshot(),
    };
    localStorage.setItem(STORAGE_KEY, saveCodec.encode(record));
    return true;
  } catch {
    storageAvailable = false;
    if (!saveFailureShown) {
      saveFailureShown = true;
      toast(STORAGE_UNAVAILABLE_MESSAGE);
    }
    return false;
  }
}

function clearSavedGame() {
  try {
    if (!storageAvailable) throw new Error("storage unavailable");
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}

function restoreGame() {
  if (corruptSaveHandled) return false;
  let text;
  try {
    if (!storageAvailable) throw new Error("storage unavailable");
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
    showStartupProblem(STORAGE_UNAVAILABLE_MESSAGE);
    $("startGame").disabled = false;
    return false;
  }
  if (!text) return false;
  try {
    const restored = saveCodec.decode(text, engine, cpu);
    generation += 1;
    if (cpuTimer) clearTimeout(cpuTimer);
    cpuTimer = null;
    humanSeat = restored.humanSeat;
    cpuSeat = restored.cpuSeat;
    difficulty = restored.difficulty;
    paletteRandom = seededRandom(0, restored.rngStates.palette);
    rollRandom = seededRandom(0, restored.rngStates.roll);
    effectRandom = seededRandom(0, restored.rngStates.effect);
    cpuRandom = seededRandom(0, restored.rngStates.cpu);
    selectedMacros.clear();
    targetMode = null;
    actionBusy = false;
    cpuThinking = false;
    state = restored.state;
    showStartupProblem("");
    render();
    scheduleCpu(generation);
    return true;
  } catch {
    corruptSaveHandled = true;
    const cleared = clearSavedGame();
    showStartupProblem(cleared ? CORRUPT_SAVE_MESSAGE : STORAGE_UNAVAILABLE_MESSAGE);
    $("startGame").disabled = false;
    return false;
  }
}

function startGame() {
  clearToast();
  const problem = runtimeProblem();
  if (problem) {
    showStartupProblem(problem);
    return;
  }
  generation += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = null;
  const token = generation;
  const seed = randomSeed();
  paletteRandom = seededRandom(seed ^ 0x9e3779b9);
  rollRandom = seededRandom(seed ^ 0x243f6a88);
  effectRandom = seededRandom(seed ^ 0xb7e15162);
  cpuRandom = seededRandom(seed ^ 0x5a5a5a5a);
  difficulty = $("difficulty").value;
  const first = $("firstPlayer").value;
  humanSeat = first === "human" ? "A" : first === "cpu" ? "B" : (seed & 1) ? "A" : "B";
  cpuSeat = other(humanSeat);
  selectedMacros.clear();
  targetMode = null;
  actionBusy = false;
  cpuThinking = false;
  saveFailureShown = false;
  state = engine.createQuickGame({ paletteRandom, rollRandom });
  saveGame();
  show("setup", false);
  show("game", true);
  render();
  scheduleCpu(token);
}

function returnToSetup() {
  clearToast();
  clearSavedGame();
  saveFailureShown = false;
  generation += 1;
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = null;
  state = null;
  actionBusy = false;
  cpuThinking = false;
  selectedMacros.clear();
  targetMode = null;
  show("game", false);
  show("setup", true);
}

function applyLocalAction(actor, type, payload = {}) {
  if (!state || state.winner || actionBusy) return false;
  actionBusy = true;
  try {
    const applied = engine.applyAction(state, actor, {
      id: actionId(),
      expectedVersion: state.version,
      type,
      payload,
    }, { rollRandom, effectRandom });
    const nextState = applied.state;
    saveCodec.validateState(nextState, engine);
    saveGame(nextState);
    state = nextState;
    selectedMacros.clear();
    targetMode = null;
    clearToast();
    return true;
  } catch (error) {
    toast(error?.message || "その操作は実行できません。");
    return false;
  } finally {
    actionBusy = false;
    render();
  }
}

function humanAction(type, payload = {}) {
  if (!state || state.active !== humanSeat || cpuThinking) return;
  if (applyLocalAction(humanSeat, type, payload)) scheduleCpu(generation);
}

function scheduleCpu(token) {
  if (!state || state.winner || state.active !== cpuSeat || token !== generation) return;
  cpuThinking = true;
  render();
  const delay = difficulty === "easy" ? 420 : difficulty === "normal" ? 520 : 650;
  cpuTimer = setTimeout(() => {
    cpuTimer = null;
    if (!state || state.winner || state.active !== cpuSeat || token !== generation) return;
    try {
      const action = cpu.chooseAction({
        publicState: engine.publicState(state),
        ownPrivateState: engine.privateState(state, cpuSeat),
        level: difficulty,
        random: cpuRandom,
        idFactory: actionId,
      });
      cpuThinking = false;
      if (applyLocalAction(cpuSeat, action.type, action.payload)) scheduleCpu(token);
    } catch (error) {
      cpuThinking = false;
      render();
      toast(`CPU処理を停止しました: ${error?.message || "不明なエラー"}`);
    }
  }, delay);
}

function phaseLabel(phase) {
  return phase === "COLOR" ? "彩色フェーズ" : phase === "CREATE_FIRST" ? "初手エリア指定" : phase === "WORK" ? "エリア指定・スキル" : "対戦終了";
}

function render() {
  if (!state) return;
  const humanTurn = state.active === humanSeat && !state.winner && !cpuThinking;
  $("versionText").textContent = state.version;
  $("seatBadge").textContent = `あなた: Player ${humanSeat} / CPU: Player ${cpuSeat}`;
  $("turnBadge").textContent = state.winner ? `勝者 Player ${state.winner}` : humanTurn ? "あなたの手番" : "CPUの手番";
  $("turnBadge").className = `badge ${state.winner ? "warn" : humanTurn ? "good" : "bad"}`;
  $("phaseText").textContent = phaseLabel(state.phase);
  show("thinking", cpuThinking);
  const humanPrivate = engine.privateState(state, humanSeat);
  $("privatePalette").innerHTML = humanPrivate.palette.map((color) => `<span class="badge" style="border-color:${COLOR_HEX[color]}">${COLOR_JA[color]}</span>`).join("");
  drawBoard();
  renderMacroGrid(humanTurn);
  renderSelection(humanTurn);
  renderPalette(humanTurn, humanPrivate);
  renderSkills(humanTurn, humanPrivate);
  renderTargets(humanTurn);
  $("surrender").disabled = actionBusy || cpuThinking || Boolean(state.winner);
  $("gameLog").innerHTML = (state.log || []).slice(-40).reverse().map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  show("result", Boolean(state.winner));
  if (state.winner) $("result").textContent = state.winner === humanSeat ? "あなたの勝ちです！" : "CPUの勝ちです。もう一度挑戦できます。";
}

function macroInBounds(macro) {
  const column = macro % 12;
  const row = Math.floor(macro / 12);
  const bounds = state.playableBounds;
  return column >= bounds.left && column <= bounds.right && row >= bounds.top && row <= bounds.bottom;
}

function occupiedMacros() {
  const occupied = new Map();
  for (const region of Object.values(state.regions || {})) {
    for (const micro of region.micro) {
      const column = Math.floor((micro % 48) / 4);
      const row = Math.floor(Math.floor(micro / 48) / 4);
      const macro = row * 12 + column;
      occupied.set(macro, (occupied.get(macro) || 0) + 1);
    }
  }
  return occupied;
}

function renderMacroGrid(humanTurn) {
  const occupied = occupiedMacros();
  const selecting = state.phase === "WORK" || state.phase === "CREATE_FIRST";
  for (let macro = 0; macro < macroButtons.length; macro += 1) {
    const button = macroButtons[macro];
    const row = Math.floor(macro / 12) + 1;
    const column = (macro % 12) + 1;
    const usedCells = occupied.get(macro) || 0;
    const available = usedCells < 16;
    const targetable = targetMode === "areaHalfShift" ? usedCells > 0 : selecting && available;
    button.disabled = !humanTurn || !macroInBounds(macro) || !targetable;
    button.classList.toggle("selected", selectedMacros.has(macro) || targetMode?.macro === macro);
    button.setAttribute("aria-pressed", String(selectedMacros.has(macro) || targetMode?.macro === macro));
    const stateLabel = usedCells >= 16 ? "使用済み" : usedCells > 0 ? "一部使用中" : "空き";
    button.setAttribute("aria-label", `盤面 ${row}行 ${column}列、${stateLabel}`);
  }
}

function renderSelection(humanTurn) {
  const enabled = humanTurn && (state.phase === "WORK" || state.phase === "CREATE_FIRST");
  show("selectionControls", enabled);
  $("selectionCount").textContent = `${selectedMacros.size} / ${state.requiredSize}マス`;
  $("submitRegion").disabled = actionBusy || selectedMacros.size !== state.requiredSize;
}

function renderPalette(humanTurn, own) {
  const box = $("palette");
  box.innerHTML = "";
  if (state.phase !== "COLOR") return;
  const palette = own.prismActive ? COLORS : own.palette;
  for (const color of [...new Set(palette)]) {
    const button = document.createElement("button");
    button.className = "color-button";
    button.dataset.color = color;
    const note = own.seals[color] > 0 ? "（封印）" : "";
    button.textContent = `${COLOR_JA[color]}${note}`;
    button.disabled = !humanTurn || actionBusy || own.seals[color] > 0;
    button.onclick = () => humanAction("COLOR_REGION", { color });
    box.appendChild(button);
  }
  if (humanTurn) {
    const lose = document.createElement("button");
    lose.textContent = "塗れる色なしを宣言";
    lose.className = "danger";
    lose.onclick = () => humanAction("DECLARE_NO_COLOR");
    box.appendChild(lose);
  }
}

function renderSkills(humanTurn, own) {
  const box = $("skills");
  box.innerHTML = "";
  const defs = [
    ["colorPrism", "四色解放", "彩色前だけ全4色を候補にする", "COLOR"],
    ["areaHalfShift", "半マスシフト", "行または列を0.5マス移動", "WORK"],
    ["disruptChoiceOne", "色封じ", "CPUの次の彩色で1色を封印", "WORK"],
  ];
  for (const [key, name, desc, timing] of defs) {
    const button = document.createElement("button");
    button.className = "skill";
    button.innerHTML = `${name} ×${own.hand[key] || 0}<span>${desc}</span>`;
    const phaseOkay = timing === "COLOR" ? state.phase === "COLOR" : state.phase === "WORK" || state.phase === "CREATE_FIRST";
    button.disabled = !humanTurn || actionBusy || !phaseOkay || !(own.hand[key] > 0);
    button.onclick = () => selectSkill(key);
    box.appendChild(button);
  }
}

function selectSkill(key) {
  if (key === "colorPrism") return humanAction("USE_SKILL", { skill: key });
  targetMode = key;
  renderTargets(true);
  toast(key === "areaHalfShift" ? "盤面の基準マスを選んでください。" : "封印する色を選んでください。");
}

function renderTargets(humanTurn) {
  const box = $("targetControls");
  box.innerHTML = "";
  if (!humanTurn || !targetMode) return;
  if (targetMode === "disruptChoiceOne") {
    for (const color of COLORS) {
      const button = document.createElement("button");
      button.className = "color-button";
      button.dataset.color = color;
      button.textContent = `${COLOR_JA[color]}を封じる`;
      button.onclick = () => humanAction("USE_SKILL", { skill: "disruptChoiceOne", color });
      box.appendChild(button);
    }
  } else if (typeof targetMode === "object") {
    for (const [direction, label] of [["left", "左"], ["right", "右"], ["up", "上"], ["down", "下"]]) {
      const button = document.createElement("button");
      button.textContent = `${label}へ0.5マス`;
      button.onclick = () => humanAction("USE_SKILL", { skill: "areaHalfShift", macro: targetMode.macro, direction });
      box.appendChild(button);
    }
  }
  const cancel = document.createElement("button");
  cancel.className = "ghost";
  cancel.textContent = "キャンセル";
  cancel.onclick = () => { targetMode = null; render(); };
  box.appendChild(cancel);
}

function drawBoard() {
  const canvas = $("board");
  const context = canvas.getContext("2d");
  const size = canvas.width / 48;
  context.fillStyle = "#020617";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const bounds = state.playableBounds;
  context.fillStyle = "#0f172a";
  context.fillRect(bounds.left * 4 * size, bounds.top * 4 * size, (bounds.right - bounds.left + 1) * 4 * size, (bounds.bottom - bounds.top + 1) * 4 * size);
  for (const region of Object.values(state.regions || {})) {
    context.fillStyle = region.color ? COLOR_HEX[region.color] : "#94a3b8";
    for (const micro of region.micro) {
      const x = micro % 48;
      const y = Math.floor(micro / 48);
      context.fillRect(x * size, y * size, size + 0.2, size + 0.2);
    }
  }
  context.lineWidth = 1;
  context.strokeStyle = "#334155";
  for (let index = 0; index <= 12; index += 1) {
    context.beginPath(); context.moveTo(index * 4 * size, 0); context.lineTo(index * 4 * size, canvas.height); context.stroke();
    context.beginPath(); context.moveTo(0, index * 4 * size); context.lineTo(canvas.width, index * 4 * size); context.stroke();
  }
  context.fillStyle = "#ffffff38";
  context.strokeStyle = "#f8fafc";
  context.lineWidth = 3;
  for (const macro of selectedMacros) {
    const x = macro % 12;
    const y = Math.floor(macro / 12);
    context.fillRect(x * 4 * size, y * 4 * size, 4 * size, 4 * size);
    context.strokeRect(x * 4 * size + 1, y * 4 * size + 1, 4 * size - 2, 4 * size - 2);
  }
}

function toggleMacro(macro) {
  if (!state || actionBusy || cpuThinking || state.active !== humanSeat || state.winner || !macroInBounds(macro)) return;
  if (targetMode === "areaHalfShift") { targetMode = { macro }; return render(); }
  if (state.phase !== "WORK" && state.phase !== "CREATE_FIRST") return;
  if (selectedMacros.has(macro)) selectedMacros.delete(macro);
  else if (selectedMacros.size < state.requiredSize) selectedMacros.add(macro);
  render();
}

function boardClick(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const column = Math.max(0, Math.min(11, Math.floor(((event.clientX - rect.left) / rect.width) * 12)));
  const row = Math.max(0, Math.min(11, Math.floor(((event.clientY - rect.top) / rect.height) * 12)));
  toggleMacro(row * 12 + column);
}

function initMacroGrid() {
  const grid = $("macroGrid");
  for (let macro = 0; macro < 144; macro += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "macro-cell";
    button.onclick = () => toggleMacro(macro);
    grid.appendChild(button);
    macroButtons.push(button);
  }
}

$("startGame").onclick = startGame;
$("rematch").onclick = returnToSetup;
$("clearSelection").onclick = () => { selectedMacros.clear(); render(); };
$("submitRegion").onclick = () => humanAction("CREATE_REGION", { macros: [...selectedMacros].sort((a, b) => a - b) });
$("surrender").onclick = () => humanAction("SURRENDER");
$("board").addEventListener("pointerdown", boardClick);
initMacroGrid();
showStartupProblem();
if (!runtimeProblem() && restoreGame()) {
  show("setup", false);
  show("game", true);
} else {
  show("setup", true);
  show("game", false);
}
globalThis.FourColorSoloReady = true;
