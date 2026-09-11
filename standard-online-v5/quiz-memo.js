import { calculateExpression, CALCULATOR_LIMITS } from "./quiz-calculator.js?v=20260912-1";
import { appendScratchOperation, createScratchStorage, emptyScratch, scratchScope, undoScratch } from "./quiz-scratch-state.js?v=20260912-1";
import { createMemoCanvas } from "./quiz-memo-canvas.js?v=20260912-1";

export function createQuizMemo({ documentRef = document, onActiveChange = () => {}, onViewportChange = () => {} } = {}) {
  const view = documentRef.defaultView;
  const $ = (id) => documentRef.getElementById(id);
  const overlay = $("quizMemoOverlay"), toolbar = $("quizMemoTools"), entry = $("quizMemoOn");
  let active = false, blocked = true, visible = false, scope;
  let state = emptyScratch(null), saveTimer = null, lockUntil = 0, previousFocus = null;
  let background = [], previousOverflow = "", canvasFailed = false;
  let renderer = null;
  const notify = (message) => { $("quizMemoStatus").textContent = message; };
  let storage;
  try { storage = view.sessionStorage; } catch { /* unavailable scratch persistence */ }
  const persistence = createScratchStorage(storage, () => notify("この端末にはメモを保存できません。回答は続けられますが、再読込でメモは失われます。"));
  function flush() {
    view.clearTimeout(saveTimer); saveTimer = null;
    if (scope) persistence.save(state);
  }
  function scheduleSave() { view.clearTimeout(saveTimer); saveTimer = view.setTimeout(flush, 250); }
  function renderCalculator() {
    const calculator = state.calculator;
    $("quizCalculatorExpression").value = calculator.expression;
    $("quizCalculatorResult").textContent = calculator.result || "—";
    const entries = calculator.history.map((item) => {
      const li = documentRef.createElement("li"); li.textContent = `${item.expression} = ${item.result}`; return li;
    });
    $("quizCalculatorHistory").replaceChildren(...entries);
  }
  function renderTools() {
    $("quizMemoUndo").disabled = canvasFailed || state.operations.length <= state.undoFloor;
    $("quizMemoClear").disabled = canvasFailed || !state.operations.length;
    for (const id of ["quizMemoPen", "quizMemoEraser"]) $(id).disabled = canvasFailed;
  }
  function addOperation(operation) {
    const next = appendScratchOperation(state, operation);
    if (!next) { notify("メモの上限です。操作を戻すか、次の問題へ進んでください。"); return; }
    state = next; scheduleSave(); renderTools();
  }
  function restoreBackground() {
    for (const [element, wasInert] of background) element.inert = wasInert;
    background = [];
    documentRef.body.style.overflow = previousOverflow;
  }
  function deactivate({ lockAnswers = true, restoreFocus = true } = {}) {
    if (!active) return;
    renderer?.setEnabled(false);
    active = false;
    lockUntil = lockAnswers ? Date.now() + 450 : 0;
    overlay.classList.remove("is-active");
    overlay.removeAttribute("role"); overlay.removeAttribute("aria-modal");
    toolbar.hidden = true;
    restoreBackground();
    flush();
    if (restoreFocus && previousFocus?.isConnected && !previousFocus.inert && !previousFocus.disabled) previousFocus.focus({ preventScroll: true });
    onActiveChange(false);
  }
  function activate() {
    if (!scope || blocked || active || !visible) return;
    previousFocus = documentRef.activeElement;
    previousOverflow = documentRef.body.style.overflow;
    background = [...documentRef.body.children].filter((element) => element !== overlay && !["SCRIPT", "STYLE", "LINK"].includes(element.tagName))
      .map((element) => [element, element.inert]);
    for (const [element] of background) element.inert = true;
    documentRef.body.style.overflow = "hidden";
    active = true; lockUntil = 0;
    overlay.classList.add("is-active"); overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
    toolbar.hidden = false;
    renderer?.setEnabled(true); renderer?.redraw();
    $("quizMemoOff").focus({ preventScroll: true });
    onActiveChange(true);
  }
  renderer = createMemoCanvas({ canvas: $("quizMemoCanvas"), getOperations: () => state.operations, onStroke: addOperation,
    onFailure() { canvasFailed = true; notify("手書きを表示できません。電卓は引き続き使えます。Memo OFFで回答に戻れます。"); renderTools(); } });
  entry.addEventListener("click", activate);
  $("quizMemoOff").addEventListener("click", () => deactivate());
  for (const [id, tool] of [["quizMemoPen", "pen"], ["quizMemoEraser", "eraser"]]) {
    $(id).addEventListener("click", () => {
      renderer.setTool(tool);
      $("quizMemoPen").setAttribute("aria-pressed", String(tool === "pen"));
      $("quizMemoEraser").setAttribute("aria-pressed", String(tool === "eraser"));
    });
  }
  $("quizMemoUndo").addEventListener("click", () => { renderer.finish(); state = undoScratch(state); renderer.redraw(); renderTools(); scheduleSave(); });
  $("quizMemoClear").addEventListener("click", () => { renderer.finish(); addOperation({ kind: "clear" }); renderer.redraw(); });
  const input = $("quizCalculatorExpression");
  function updateExpression(expression) {
    state.calculator.expression = expression.slice(0, CALCULATOR_LIMITS.characters);
    state.calculator.result = "";
    renderCalculator(); scheduleSave();
  }
  function calculate() {
    const result = calculateExpression(state.calculator.expression);
    if (!result.ok) { state.calculator.result = ""; notify(result.message); }
    else {
      state.calculator.result = result.display;
      state.calculator.history = [...state.calculator.history, { expression: state.calculator.expression, result: result.display }].slice(-CALCULATOR_LIMITS.history);
      notify("");
    }
    renderCalculator(); scheduleSave();
  }
  input.addEventListener("input", () => updateExpression(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculate(); }
  });
  $("quizCalculatorKeys").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-calc-key]");
    if (!button || !active) return;
    const key = button.dataset.calcKey;
    if (key === "=") { calculate(); return; }
    if (key === "Clear") { state.calculator = { expression: "", result: "", history: [] }; renderCalculator(); scheduleSave(); return; }
    if (key === "Backspace") { updateExpression(state.calculator.expression.slice(0, -1)); return; }
    let expression = state.calculator.expression;
    if (state.calculator.result) expression = "+−×÷".includes(key) ? state.calculator.result : "";
    if (expression.length + key.length > CALCULATOR_LIMITS.characters) { notify("式が長すぎます。短く分けて計算してください。"); return; }
    updateExpression(expression + key);
  });
  overlay.addEventListener("keydown", (event) => {
    if (!active) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); deactivate(); return; }
    if (event.key !== "Tab") return;
    const targets = [...toolbar.querySelectorAll('button:not([disabled]), input, summary')].filter((element) => {
      const closedDetails = element.closest("details:not([open])");
      return element.getClientRects().length && (!closedDetails || closedDetails.querySelector("summary") === element);
    });
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  documentRef.addEventListener("focusin", (event) => {
    if (!active || overlay.contains(event.target)) return;
    if (criticalDialog()) { deactivate({ lockAnswers: false, restoreFocus: false }); return; }
    $("quizMemoOff").focus({ preventScroll: true });
  });
  // Existing top-layer/fatal dialogs always take precedence over optional scratch UI.
  const criticalDialog = () => documentRef.querySelector('dialog[open], [role="alertdialog"]');
  new view.MutationObserver(() => {
    if (!active) return;
    if (criticalDialog()) { deactivate({ lockAnswers: false, restoreFocus: false }); return; }
    for (const element of documentRef.body.children) {
      if (element === overlay || ["SCRIPT", "STYLE", "LINK"].includes(element.tagName) || background.some(([node]) => node === element)) continue;
      background.push([element, element.inert]); element.inert = true;
    }
  })
    .observe(documentRef.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "role"] });
  view.addEventListener("pagehide", () => { renderer.finish(); flush(); });
  view.addEventListener("resize", () => {
    if (active) view.requestAnimationFrame(() => { if (active) onViewportChange(); });
  });
  documentRef.addEventListener("visibilitychange", () => { if (documentRef.hidden) { renderer.finish(); flush(); } });
  return {
    get active() { return active; },
    get answerLocked() { return active || Date.now() < lockUntil; },
    deactivate,
    setContext({ sessionId, questionIndex, eligible, isVisible, isBlocked }) {
      const nextScope = eligible ? scratchScope(sessionId, questionIndex) : null;
      const redraw = nextScope !== scope || visible !== Boolean(isVisible && nextScope);
      blocked = Boolean(isBlocked || criticalDialog());
      visible = Boolean(isVisible && nextScope);
      if (nextScope !== scope) {
        deactivate({ lockAnswers: false, restoreFocus: false });
        view.clearTimeout(saveTimer); saveTimer = null;
        scope = nextScope;
        notify(canvasFailed ? "手書きを表示できません。電卓は引き続き使えます。Memo OFFで回答に戻れます。" : "");
        if (scope) state = persistence.load(scope);
        else { state = emptyScratch(null); persistence.remove(); }
        lockUntil = 0;
        renderCalculator(); renderTools(); renderer.redraw();
      }
      if ((blocked || !visible) && active) deactivate({ lockAnswers: false, restoreFocus: false });
      entry.hidden = !nextScope; entry.disabled = blocked;
      overlay.hidden = !visible;
      if (visible && redraw) renderer.redraw();
    },
  };
}
