"use strict";

// Explicitly offline-only. Never add these IDs to the ordinary card registry.
const engine = require("./standard-engine.js");
const match = require("./standard-match.js");
const RULE_SET = "SKILL_WORKSHOP_V1";
const SAVE_KEY = "fourColorMapGame.skillWorkshop.v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
const other = (seat) => seat === "A" ? "B" : "A";
const card = (name, phase, category, targets, help) => Object.freeze({ name, phase, category, targets, help });
const CARDS = Object.freeze({
  labWeather: card("色落とし・風化", "WORK", "disrupt", 1, "塗られた形をそのまま無色にし、指定の代わりに相手へ渡します。"),
  labWhiteout: card("白化・乱", "WORK", "disrupt", 0, "適格な既塗エリアをランダムに無色化して相手へ渡します。"),
  labSwap: card("色交換", "WORK", "disrupt", 2, "辺で接していない2エリアの色を同時交換します。交換後に隣接違反があれば不消費です。"),
  labRotate: card("地層反転", "WORK", "disrupt", 3, "順に隣接する3エリアの色を①→②→③→①へ回します。"),
  labRecolorNext: card("再彩色予約", "WORK", "disrupt", 1, "相手の次の成功彩色後に、対象を合法な別色へ。形や色が変わると不発です。"),
  labDemolish: card("エリア破壊", "WORK", "disrupt", 1, "4マス以下の既塗エリアを形ごと消し、普通の空きマスへ戻します。"),
  labCancelRegion: card("指定の爆破", "COLOR", "color", 1, "受け取った未塗エリアを取り消し、相手が同じマス数で指定し直します。分割中は使えません。"),
  labChecker: card("二色市松", "WORK", "disrupt", 1, "既塗エリアへ第二色を加えます。一つのエリアのまま、隣接判定では両色が効きます。"),
  labSilence: card("妨害封じ", "WORK", "disrupt", 0, "相手の次の操作区間だけ妨害カテゴリを禁止。救済COLORカードは使えます。全スキル禁止とは異なる試作です。"),
  labUnseal: card("封印解除札", "COLOR", "color", 0, "現在の持ち色のうち1色の封印を解除します。隣接違反は解除しません。"),
  labRefillUnseal: card("おまけ補充・解封", "COLOR", "color", 0, "おまけ色を1回補充（最大4回）し、その色の封印も解除します。"),
});
const IDS = Object.freeze(Object.keys(CARDS));
function check(ok, code) { if (!ok) throw new engine.StandardRuleError(code, code); }
function colors(region) { return region?.color ? region.labColors || [region.color] : []; }
function setColors(region, values) {
  region.color = values[0] || null;
  if (values.length === 2) region.labColors = [...values];
  else delete region.labColors;
}
function adjacentConflict(state) {
  return Object.values(state.regions).some((region) => colors(region).length
    && engine.adjacentRegionIds(state, region.id).some((id) => colors(state.regions[id]).some((color) => colors(region).includes(color))));
}
function candidates(state, id) {
  const blocked = new Set([...colors(state.regions[id]), ...engine.adjacentRegionIds(state, id).flatMap((neighbor) => colors(state.regions[neighbor]))]);
  return engine.COLORS.filter((color) => !blocked.has(color));
}
function fingerprint(region) { return JSON.stringify({ micro: region.micro, colors: colors(region) }); }
function eligible(session, id) {
  const state = session.state, region = state.regions[id];
  return Boolean(region?.color && !region.isPending && !region.isReserved && state.pending !== id && state.reserved !== id
    && session.createdTurn[id] !== state.turn && !session.scheduled.some((item) => item.regionId === id));
}
function micro(macro) {
  return Array.from({ length: 16 }, (_, i) => (Math.floor(macro / 12) * 4 + Math.floor(i / 4)) * 48 + macro % 12 * 4 + i % 4);
}
function addRegion(state, id, macros, color = null, controller = "B") {
  state.regions[id] = { id, sourceMacros: macros, micro: macros.flatMap(micro), color, controllers: [controller], isPending: !color };
  if (!color) state.pending = id;
}
function validate(session) {
  check(session?.ruleSetId === RULE_SET && session.schemaVersion === 1, "WORKSHOP_RULESET_REQUIRED");
  match.validateStandardState(session.state);
  check(session.state.ruleSetId === RULE_SET, "WORKSHOP_RULESET_REQUIRED");
  const state = session.state;
  check(state.microWidth === 48 && state.playableBounds.macroWidth === 12 && state.playableBounds.microScale === 4
    && state.playableBounds.minCol === 1 && state.playableBounds.maxCol === 10
    && state.playableBounds.minRow === 1 && state.playableBounds.maxRow === 10, "INVALID_WORKSHOP_BOUNDS");
  for (const region of Object.values(state.regions)) {
    check(region.micro.length > 0 && Array.isArray(region.sourceMacros) && Array.isArray(region.controllers), "INVALID_WORKSHOP_REGION");
    check(region.sourceMacros.length > 0 && new Set(region.sourceMacros).size === region.sourceMacros.length
      && region.sourceMacros.every((macro) => Number.isInteger(macro) && macro % 12 >= 1 && macro % 12 <= 10 && Math.floor(macro / 12) >= 1 && Math.floor(macro / 12) <= 10)
      && JSON.stringify([...region.micro].sort((a,b) => a-b)) === JSON.stringify(region.sourceMacros.flatMap(micro).sort((a,b) => a-b)), "INVALID_WORKSHOP_GEOMETRY");
    check(region.color === null || engine.COLORS.includes(region.color), "INVALID_WORKSHOP_COLOR");
    if (region.labColors !== undefined) check(Array.isArray(region.labColors) && region.labColors.length === 2
      && region.labColors[0] === region.color && new Set(region.labColors).size === 2
      && region.labColors.every((color) => engine.COLORS.includes(color)), "INVALID_WORKSHOP_COLOR");
  }
  check(!adjacentConflict(state), "WORKSHOP_ADJACENCY_CONFLICT");
  for (const seat of ["A", "B"]) {
    check(session.charges?.[seat] && Object.keys(session.charges[seat]).sort().join() === [...IDS].sort().join()
      && IDS.every((id) => [0, 1].includes(session.charges[seat][id])), "INVALID_WORKSHOP_CHARGES");
    check(["NONE", "QUEUED", "ACTIVE"].includes(session.silence?.[seat]), "INVALID_WORKSHOP_SILENCE");
  }
  check(session.createdTurn && typeof session.createdTurn === "object" && !Array.isArray(session.createdTurn)
    && Object.values(session.createdTurn).every((turn) => Number.isInteger(turn) && turn >= 0 && turn <= state.turn), "INVALID_WORKSHOP_CREATED_TURN");
  check(Array.isArray(session.scheduled) && session.scheduled.length <= 2
    && new Set(session.scheduled.map((item) => item.regionId)).size === session.scheduled.length
    && session.scheduled.every((item) => ["A", "B"].includes(item.actor) && typeof item.regionId === "string"
      && typeof item.fingerprint === "string" && Number.isInteger(item.version) && item.version <= state.version), "INVALID_WORKSHOP_SCHEDULE");
  check(session.receipts && typeof session.receipts === "object" && !Array.isArray(session.receipts)
    && Object.values(session.receipts).every((item) => typeof item === "string"), "INVALID_WORKSHOP_RECEIPTS");
  engine.createRngDomainsFromSnapshot(session.rngSnapshot, match.REQUIRED_RNG_STREAMS);
  return true;
}
function create({ seed = 110927, scenario = "labWeather" } = {}) {
  check(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, "INVALID_SEED");
  check(scenario === "free" || IDS.includes(scenario), "UNKNOWN_SCENARIO");
  const rng = engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({ matchId: `workshop-${seed}-${scenario}`, firstSeat: "A" }, rng);
  state.ruleSetId = RULE_SET;
  for (const seat of ["A", "B"]) {
    state.basicPalettes[seat] = ["red", "blue"];
    state.bonusColors[seat] = "green";
    state.bonusUsesRemaining[seat] = 3;
    state.initialPalettes[seat] = { basic: ["red", "blue"], bonus: "green" };
  }
  const session = { schemaVersion: 1, ruleSetId: RULE_SET, state, rngSnapshot: {},
    charges: Object.fromEntries(["A", "B"].map((seat) => [seat, Object.fromEntries(IDS.map((id) => [id, 1]))])),
    silence: { A: "NONE", B: "NONE" }, scheduled: [], createdTurn: {}, receipts: {}, lastEvent: "練習盤面を用意しました。" };
  if (scenario !== "free") {
    Object.assign(state, { phase: CARDS[scenario].phase, requiredSize: 2, rolledSize: 2, baseRequiredSize: 2 });
    addRegion(state, "R1", [26, 27], "red");
    addRegion(state, "R2", [28, 29], "blue");
    addRegion(state, "R3", [30, 31], "green");
    if (CARDS[scenario].phase === "COLOR") {
      state.regions = {};
      addRegion(state, "R1", [26], "red");
      addRegion(state, "R2", [38, 39], null);
      state.publicEffects.A.seals = { blue: 2, green: 1 };
      if (scenario === "labRefillUnseal") state.bonusUsesRemaining.A = 0;
    }
  }
  session.rngSnapshot = engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS);
  validate(session);
  return session;
}
function skill(session, actor, payload, rng) {
  const state = session.state, id = payload.skill, definition = CARDS[id];
  check(Boolean(definition), "UNKNOWN_WORKSHOP_SKILL");
  check(state.phase === definition.phase, "WRONG_PHASE");
  check(session.charges[actor][id] > 0, "SKILL_UNAVAILABLE");
  check(!state.skillCategoryWindow.categories.includes(definition.category), "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  check(!(session.silence[actor] === "ACTIVE" && definition.category === "disrupt"), "DISRUPT_CATEGORY_SILENCED");
  check(!state.preparedOutgoing && !state.reserved && !state.retainedSplit, "ACTIVE_FLOW_CONFLICT");
  const ids = payload.regionIds || [];
  check(Array.isArray(ids) && ids.length === definition.targets && new Set(ids).size === ids.length
    && ids.every((regionId) => typeof regionId === "string" && Object.hasOwn(state.regions, regionId)), "INVALID_TARGETS");
  if (id !== "labCancelRegion") check(ids.every((regionId) => eligible(session, regionId)), "INELIGIBLE_REGION");
  if (definition.phase === "WORK") check(!state.pending, "PENDING_EXISTS");
  let message = definition.name;
  const draw = () => rng["skill-effect"].next();
  if (["labWeather", "labWhiteout"].includes(id)) {
    const pool = id === "labWhiteout" ? Object.keys(state.regions).filter((regionId) => eligible(session, regionId)).sort(engine.compareRegionIds) : ids;
    check(pool.length > 0, "NO_ELIGIBLE_REGION");
    const target = state.regions[pool[id === "labWhiteout" ? Math.floor(draw() * pool.length) : 0]];
    setColors(target, []);
    target.isPending = true;
    target.controllers = [actor];
    state.pending = target.id;
    state.phase = "COLOR";
    state.active = other(actor);
    state.turn += 1;
    state.interferenceLock = false;
    message += `：${target.id}の形を残し、${state.active}が再彩色します。`;
  } else if (id === "labSwap" || id === "labRotate") {
    if (id === "labSwap") check(!engine.adjacentRegionIds(state, ids[0]).includes(ids[1]), "SWAP_REQUIRES_NONADJACENT");
    else check(engine.adjacentRegionIds(state, ids[0]).includes(ids[1]) && engine.adjacentRegionIds(state, ids[1]).includes(ids[2]), "ROTATION_REQUIRES_CHAIN");
    const before = ids.map((regionId) => colors(state.regions[regionId]));
    ids.forEach((regionId, i) => setColors(state.regions[regionId], before[(i + ids.length - 1) % ids.length]));
    check(!adjacentConflict(state), "RECOLOR_ADJACENCY_CONFLICT");
    check(ids.some((regionId, i) => JSON.stringify(colors(state.regions[regionId])) !== JSON.stringify(before[i])), "NO_EFFECT");
    message += `：${ids.join(" → ")}を同時に変更しました。`;
  } else if (id === "labRecolorNext") {
    session.scheduled.push({ regionId: ids[0], actor, fingerprint: fingerprint(state.regions[ids[0]]), version: state.version + 1 });
    message += `：${ids[0]}を公開予約しました。`;
  } else if (id === "labDemolish") {
    check(state.regions[ids[0]].micro.length <= 4 * state.playableBounds.microScale ** 2, "DESTRUCTION_AREA_LIMIT");
    delete state.regions[ids[0]];
    message += `：${ids[0]}の場所は再指定できる空白になりました。`;
  } else if (id === "labCancelRegion") {
    const target = state.regions[ids[0]];
    check(target.isPending && target.id === state.pending && target.controllers.length === 1 && target.controllers[0] === other(actor), "RECEIVED_REGION_REQUIRED");
    check(target.sourceMacros.length >= 1 && target.sourceMacros.length <= 4, "CANCEL_SIZE_LIMIT");
    state.requiredSize = state.baseRequiredSize = target.sourceMacros.length;
    state.active = other(actor);
    delete state.regions[target.id];
    state.pending = null;
    state.phase = "WORK";
    message += `：${state.active}が${state.requiredSize}マスを指定し直します。封印は残ります。`;
  } else if (id === "labChecker") {
    const target = state.regions[ids[0]];
    check(!target.labColors && engine.COLORS.includes(payload.color) && payload.color !== target.color, "INVALID_SECOND_COLOR");
    setColors(target, [target.color, payload.color]);
    check(!adjacentConflict(state), "RECOLOR_ADJACENCY_CONFLICT");
    message += `：${target.id}は${target.color}と${payload.color}の両方に接触する扱いです。`;
  } else if (id === "labSilence") {
    check(session.silence[other(actor)] === "NONE", "SILENCE_ALREADY_QUEUED");
    session.silence[other(actor)] = "QUEUED";
    message += "：次の相手の妨害だけ禁止。救済COLORは使用できます。";
  } else if (id === "labUnseal") {
    const color = payload.color;
    check([...state.basicPalettes[actor], state.bonusColors[actor]].includes(color) && state.publicEffects[actor].seals[color] > 0, "OWN_SEALED_COLOR_REQUIRED");
    state.publicEffects[actor].seals[color] = 0;
    message += `：${color}の封印を解除しました。`;
  } else if (id === "labRefillUnseal") {
    const color = state.bonusColors[actor];
    check(state.bonusUsesRemaining[actor] < 4 || state.publicEffects[actor].seals[color] > 0, "NO_EFFECT");
    state.bonusUsesRemaining[actor] = Math.min(4, state.bonusUsesRemaining[actor] + 1);
    state.publicEffects[actor].seals[color] = 0;
    message += `：${color}は残り${state.bonusUsesRemaining[actor]}回、封印なしです。`;
  }
  session.charges[actor][id] -= 1;
  state.skillsUsed[actor] += 1;
  state.version += 1;
  state.skillCategoryWindow.categories.push(definition.category);
  state.lastPublicTrace = { eventId: `${state.matchId}:${state.version}`, version: state.version, type: "USE_SKILL", actor };
  state.publicLog.push(message);
  session.lastEvent = message;
}
function enterSeat(session, previous) {
  if (session.state.active === previous) return;
  if (session.silence[previous] === "ACTIVE") session.silence[previous] = "NONE";
  if (session.silence[session.state.active] === "QUEUED") session.silence[session.state.active] = "ACTIVE";
  session.state.skillCategoryWindow = { actor: session.state.active, categories: [] };
}
function settleScheduled(session, actor, rng) {
  const kept = [];
  for (const item of session.scheduled) {
    if (item.actor === actor) { kept.push(item); continue; }
    const target = session.state.regions[item.regionId];
    const choices = target && fingerprint(target) === item.fingerprint ? candidates(session.state, target.id) : [];
    if (choices.length) {
      setColors(target, [choices[Math.floor(rng["skill-effect"].next() * choices.length)]]);
      session.state.publicLog.push(`再彩色予約：${target.id}が${target.color}になりました。`);
    } else session.state.publicLog.push(`再彩色予約：${item.regionId}は対象変更または候補なしで不発です。`);
    session.lastEvent = session.state.publicLog.at(-1);
  }
  session.scheduled = kept;
}
function apply(current, action) {
  validate(current);
  const rejected = (code) => ({ ok: false, code, session: current });
  try {
    check(action && typeof action.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(action.id)
      && !["__proto__", "constructor", "prototype"].includes(action.id), "ACTION_ID_REQUIRED");
    const signature = JSON.stringify([action.actor, action.expectedVersion, action.type, action.payload]);
    if (Object.hasOwn(current.receipts, action.id)) return current.receipts[action.id] === signature
      ? { ok: true, code: "IDEMPOTENT_REPLAY", session: current } : rejected("ACTION_ID_COLLISION");
    check(action.expectedVersion === current.state.version, "VERSION_CONFLICT");
    check(current.state.status === "ACTIVE", "MATCH_FINISHED");
    check(["A", "B"].includes(action.actor) && action.actor === current.state.active, "NOT_YOUR_TURN");
    const next = clone(current), actor = action.actor;
    const rng = engine.createRngDomainsFromSnapshot(current.rngSnapshot, match.REQUIRED_RNG_STREAMS);
    if (action.type === "USE_SKILL") skill(next, actor, action.payload || {}, rng);
    else {
      check(["CREATE_REGION", "COLOR_REGION", "SURRENDER"].includes(action.type), "UNKNOWN_ACTION");
      const result = match.applyStandardAction({ state: next.state, actor, action, expectedVersion: action.expectedVersion, rngStreams: rng });
      if (!result.ok) return rejected(result.code);
      next.state = clone(result.state);
      if (action.type === "COLOR_REGION" && result.code !== "ILLEGAL_COLOR") {
        const accentConflict = engine.adjacentRegionIds(current.state, current.state.pending)
          .some((id) => colors(current.state.regions[id]).includes(action.payload.color));
        if (accentConflict) {
          next.state = clone(current.state);
          Object.assign(next.state, { status: "FINISHED", phase: "GAME_OVER", winner: other(actor), terminalReason: "ILLEGAL_COLOR", version: current.state.version + 1 });
          next.state.publicLog.push(`Player ${actor} lost by two-color adjacency.`);
          next.lastEvent = "二色市松の第二色と接したため、隣接違反で終局しました。";
          // A rejected paint must not retain the ordinary successful-paint die draw.
          next.rngSnapshot = clone(current.rngSnapshot);
        } else {
          next.lastEvent = `${actor}が${current.state.pending}を彩色しました。`;
          if (next.state.status === "ACTIVE") settleScheduled(next, actor, rng);
        }
      } else next.lastEvent = result.code === "ILLEGAL_COLOR" ? "隣接する同色を選んだため終局しました。" : next.state.publicLog.at(-1);
      if (action.type === "CREATE_REGION") next.createdTurn[next.state.pending] = next.state.turn;
    }
    enterSeat(next, actor);
    if (next.state.status === "FINISHED") next.scheduled = [];
    if (!(action.type === "COLOR_REGION" && next.state.terminalReason === "ILLEGAL_COLOR")) next.rngSnapshot = engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS);
    next.receipts[action.id] = signature;
    check(next.state.version === current.state.version + 1, "VERSION_INCREMENT_INVARIANT");
    validate(next);
    return { ok: true, code: "OK", session: next };
  } catch (error) {
    if (error instanceof engine.StandardRuleError) return rejected(error.code);
    throw error;
  }
}
function encode(session) { validate(session); return JSON.stringify(session); }
function decode(text) { const session = JSON.parse(text); validate(session); return session; }
module.exports = { RULE_SET, SAVE_KEY, CARDS, IDS, create, apply, validate, encode, decode, colors };
