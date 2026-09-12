(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorSkillCutin = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STORAGE_KEY = "fourColorMapGame.standard.online.v5.skill-cutin-v1";
  const COLORS = ["red", "blue", "yellow", "green"];
  const safeId = value => typeof value === "string" && /^[A-Za-z0-9._:-]{1,300}$/.test(value);
  function traceFor(state) {
    const t = state?.lastPublicTrace;
    if (!t || !["USE_SKILL", "LEGAL_RECOLOR"].includes(t.type) || !["A", "B"].includes(t.actor)
      || !safeId(state.matchId) || !Number.isSafeInteger(state.version) || state.version < 0
      || t.version !== state.version || t.eventId !== `${state.matchId}:${state.version}`) return null;
    const keys = ["actor", "eventId", "type", "version", ...(t.type === "LEGAL_RECOLOR" ? ["color", "regionId"] : [])].sort();
    if (JSON.stringify(Object.keys(t).sort()) !== JSON.stringify(keys)) return null;
    if (t.type === "LEGAL_RECOLOR" && (!COLORS.includes(t.color) || !safeId(t.regionId))) return null;
    return t;
  }
  function snapshot(input) {
    const { state, roomId, seat } = input || {};
    if (!safeId(roomId) || !safeId(state?.matchId) || !["A", "B"].includes(seat)
      || !Number.isSafeInteger(state.version) || state.version < 0) return null;
    // Only public geometry and the current viewer's already displayed palette are compared.
    const regions = Object.entries(state.regions || {}).sort(([a], [b]) => a.localeCompare(b))
      .map(([id, r]) => [id, r?.color, r?.deleted, r?.micro]);
    return {
      scope: `${roomId}:${state.matchId}:${seat}`, version: state.version, status: state.status,
      visible: input.visible === true,
      palette: JSON.stringify((input.ownColors || []).filter(c => COLORS.includes(c))),
      seals: JSON.stringify(COLORS.map(c => Number(state.publicEffects?.[seat]?.seals?.[c] || 0) > 0)),
      board: JSON.stringify([state.requiredSize, state.pending, state.reserved, state.preparedOutgoing, regions]),
    };
  }
  function describe(previous, current, input) {
    const trace = traceFor(input.state);
    if (!previous || !current || previous.scope !== current.scope || current.version !== previous.version + 1
      || previous.status !== "ACTIVE" || current.status !== "ACTIVE" || !previous.visible || !input.visible || input.blocked || !trace) return null;
    const own = trace.actor === input.seat;
    const ack = own && input.ack?.eventId === trace.eventId && input.ack?.scope === current.scope ? input.ack : null;
    const noOp = ack?.noOp === true;
    const paletteChanged = previous.palette !== current.palette || previous.seals !== current.seals;
    const boardChanged = previous.board !== current.board;
    return { eventId: trace.eventId, scope: current.scope, version: current.version, actor: own ? "self" : "opponent",
      title: ack?.name ? String(ack.name).slice(0, 48) : "スキルを使用",
      detail: noOp ? "空振り" : paletteChanged ? "持ち色に変化" : boardChanged ? "盤面に変化" : "スキルを使用",
      destination: noOp ? null : paletteChanged ? "palette" : boardChanged ? "board" : null,
      noOp };
  }
  async function claim(event, storage, locks) {
    if (!safeId(event?.scope) || !safeId(event?.eventId) || !locks?.request || !storage) return false;
    try {
      return await locks.request(STORAGE_KEY + ".lock", { mode: "exclusive" }, () => {
        const history = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(history) || history.some(x => typeof x !== "string")) return false;
        const key = event.scope + ":" + event.eventId;
        if (history.includes(key)) return false;
        const next = [...history.slice(-63), key];
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
        return storage.getItem(STORAGE_KEY) === JSON.stringify(next);
      });
    } catch { return false; }
  }
  function createObserver({ storage, locks, show, clear }) {
    let previous = null, generation = 0;
    function interrupt() { generation += 1; clear(); }
    function observe(input) {
      const current = snapshot(input);
      if (previous && current?.scope === previous.scope && current.version < previous.version) return Promise.resolve(false);
      if (!input?.visible || !current || current.status !== "ACTIVE") {
        interrupt(); previous = current; return Promise.resolve(false);
      }
      if (previous && current?.scope === previous.scope && current.version === previous.version) {
        previous = current; return Promise.resolve(false);
      }
      interrupt();
      const event = describe(previous, current, input);
      previous = current;
      if (!event) return Promise.resolve(false);
      const revision = generation;
      return claim(event, storage, locks).then(accepted => {
        if (!accepted || revision !== generation) return false;
        show(event, input);
        return true;
      }).catch(() => false);
    }
    return { observe, interrupt };
  }
  return Object.freeze({ VERSION: "skill-cutin-v1", STORAGE_KEY, traceFor, snapshot, describe, claim, createObserver });
});
