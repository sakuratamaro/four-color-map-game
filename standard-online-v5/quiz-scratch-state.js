// This one sessionStorage entry is local scratch paper, never a quiz payload.
export const SCRATCH_KEY = "fourColorMapGame.standard.online.v5.quiz-scratch-v1";
export const SCRATCH_LIMITS = Object.freeze({ points: 12000, operations: 1000, undo: 100, bytes: 512 * 1024 });

export function scratchScope(sessionId, questionIndex) {
  return typeof sessionId === "string" && sessionId.length > 0 && sessionId.length <= 200
    && Number.isSafeInteger(questionIndex) && questionIndex >= 0 && questionIndex < 10
    ? JSON.stringify([sessionId, questionIndex]) : null;
}

export function emptyScratch(scope) {
  return { version: 1, scope, operations: [], undoFloor: 0, calculator: { expression: "", result: "", history: [] } };
}

export function sanitizeScratch(value, scope) {
  if (!scope || value?.version !== 1 || value.scope !== scope || !Array.isArray(value.operations)
    || value.operations.length > SCRATCH_LIMITS.operations) return null;
  const result = emptyScratch(scope);
  let points = 0;
  for (const operation of value.operations) {
    if (operation?.kind === "clear") { result.operations.push({ kind: "clear" }); continue; }
    if (operation?.kind !== "stroke" || !["pen", "eraser"].includes(operation.tool)
      || ![3, 20].includes(operation.width) || !Array.isArray(operation.points) || !operation.points.length) return null;
    points += operation.points.length;
    if (points > SCRATCH_LIMITS.points) return null;
    const normalized = [];
    for (const point of operation.points) {
      if (!Array.isArray(point) || point.length !== 2 || point.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) return null;
      normalized.push(point.map((n) => Math.round(n * 1e6) / 1e6));
    }
    result.operations.push({ kind: "stroke", tool: operation.tool, width: operation.width, points: normalized });
  }
  if (!Number.isSafeInteger(value.undoFloor) || value.undoFloor < 0 || value.undoFloor > result.operations.length) return null;
  result.undoFloor = Math.max(value.undoFloor, result.operations.length - SCRATCH_LIMITS.undo);
  const calculator = value.calculator;
  if (!calculator || typeof calculator.expression !== "string" || calculator.expression.length > 96
    || typeof calculator.result !== "string" || calculator.result.length > 400
    || !Array.isArray(calculator.history) || calculator.history.length > 8) return null;
  for (const entry of calculator.history) {
    if (typeof entry?.expression !== "string" || entry.expression.length > 96
      || typeof entry.result !== "string" || entry.result.length > 400) return null;
    result.calculator.history.push({ expression: entry.expression, result: entry.result });
  }
  result.calculator.expression = calculator.expression;
  result.calculator.result = calculator.result;
  return result;
}

export function appendScratchOperation(state, operation) {
  const next = sanitizeScratch({ ...state, operations: [...state.operations, operation],
    undoFloor: Math.max(state.undoFloor, state.operations.length + 1 - SCRATCH_LIMITS.undo) }, state.scope);
  if (!next || JSON.stringify(next).length * 2 > SCRATCH_LIMITS.bytes) return null;
  return next;
}

export function undoScratch(state) {
  if (state.operations.length <= state.undoFloor) return state;
  return { ...state, operations: state.operations.slice(0, -1) };
}

export function createScratchStorage(storage, onFailure = () => {}) {
  function remove() { try { storage?.removeItem(SCRATCH_KEY); } catch { onFailure(); } }
  return {
    remove,
    load(scope) {
      try {
        const raw = storage?.getItem(SCRATCH_KEY);
        if (!raw) return emptyScratch(scope);
        if (raw.length * 2 > SCRATCH_LIMITS.bytes) { remove(); return emptyScratch(scope); }
        const result = sanitizeScratch(JSON.parse(raw), scope);
        if (result) return result;
      } catch { onFailure(); }
      remove();
      return emptyScratch(scope);
    },
    save(state) {
      try {
        const safe = sanitizeScratch(state, state.scope);
        const raw = safe && JSON.stringify(safe);
        if (!raw || raw.length * 2 > SCRATCH_LIMITS.bytes || !storage) throw new Error("SCRATCH_UNAVAILABLE");
        storage.setItem(SCRATCH_KEY, raw);
        return true;
      } catch { remove(); onFailure(); return false; }
    },
  };
}
