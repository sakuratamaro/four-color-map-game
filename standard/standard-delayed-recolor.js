"use strict";

const { COLORS, StandardRuleError, legalRecolorCandidates } = require("./standard-engine.js");
const { supportsSplitKeep } = require("./standard-skill-registry.js");
const ID = "disruptDelayedRecolor";
const clone = value => JSON.parse(JSON.stringify(value));
const assert = value => { if (!value) throw new StandardRuleError("INVALID_DELAYED_RECOLOR", "Invalid delayed recolor state"); };
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === keys.slice().sort().join("|");
const sameTarget = (region, effect) => Boolean(region && !region.isPending && !region.isReserved
  && region.color === effect.color && Array.isArray(region.micro)
  && JSON.stringify([...region.micro].sort((a,b)=>a-b)) === JSON.stringify(effect.micro));

function validateDelayedRecolor(state) {
  if (Object.hasOwn(state, "delayedRecolors")) {
    const list = state.delayedRecolors, world = state.microWidth * state.playableBounds.macroWidth * state.playableBounds.microScale;
    assert(supportsSplitKeep(state.engineVersion) && state.status === "ACTIVE" && Array.isArray(list) && list.length > 0 && list.length <= 2);
    assert(new Set(list.map(e=>e?.actor)).size === list.length && new Set(list.map(e=>e?.regionId)).size === list.length);
    for (const [index,e] of list.entries()) {
      assert(exactKeys(e,["actor","regionId","version","color","micro","invalidated"])
        && ["A","B"].includes(e.actor) && typeof e.regionId === "string" && /^R[1-9][0-9]*$/.test(e.regionId) && COLORS.includes(e.color)
        && Number.isSafeInteger(e.version) && e.version >= 1 && e.version <= state.version
        && (index === 0 || list[index-1].version < e.version) && typeof e.invalidated === "boolean"
        && Array.isArray(e.micro) && e.micro.length > 0 && e.micro.length <= world
        && e.micro.every((cell,i)=>Number.isSafeInteger(cell) && cell >= 0 && cell < world && (i === 0 || e.micro[i-1] < cell)));
    }
  }
  if (Object.hasOwn(state, "lastDelayedRecolor")) {
    const e=state.lastDelayedRecolor;
    assert(supportsSplitKeep(state.engineVersion) && exactKeys(e,["version","actor","regionId","outcome","color"])
      && Number.isSafeInteger(e.version) && e.version >= 1 && e.version <= state.version
      && ["A","B"].includes(e.actor) && typeof e.regionId === "string" && /^R[1-9][0-9]*$/.test(e.regionId)
      && ["APPLIED","TARGET_CHANGED","NO_LEGAL_COLOR"].includes(e.outcome)
      && (e.outcome === "APPLIED" ? COLORS.includes(e.color) : e.color === null));
    if (e.version === state.version && e.outcome === "APPLIED") assert(state.regions[e.regionId]?.color === e.color);
  }
}

function applyDelayedRecolor({state,actor,payload}) {
  if (state.phase !== "WORK") return {ok:false,code:"WRONG_PHASE",state};
  if (state.interferenceLock) return {ok:false,code:"INTERFERENCE_CHAINED",state};
  const r=state.regions[payload.regionId],list=state.delayedRecolors || [];
  if (!r || !COLORS.includes(r.color) || !r.micro.length || r.isPending || r.isReserved || r.deleted || r.delayed || r.delayState
    || state.pending || state.reserved || state.retainedSplit || state.preparedOutgoing || state.redesignation)
    return {ok:false,code:"INVALID_DELAYED_RECOLOR_TARGET",state};
  if (list.some(e=>e.actor === actor || e.regionId === r.id)) return {ok:false,code:"RECOLOR_ALREADY_SCHEDULED",state};
  const next=clone(state);
  next.delayedRecolors=[...clone(list),{actor,regionId:r.id,version:state.version+1,color:r.color,micro:[...r.micro].sort((a,b)=>a-b),invalidated:false}];
  next.hands[actor][ID]-=1;next.skillsUsed[actor]=(next.skillsUsed[actor]||0)+1;next.version+=1;
  next.active=actor === "A" ? "B" : "A";next.interferenceLock=true;
  next.publicLog.push(`T${next.turn} 再彩色予約: Player ${actor} → ${r.id}。相手の次の正常な彩色後に解決します。`);
  return {ok:true,code:"OK",state:next,cardConsumed:true,regionId:r.id};
}

// Mark historical changes immediately so deleting/recreating an ID or changing
// a color back later cannot revive a reservation.
function invalidateDelayedRecolors(state) {
  for (const e of state.delayedRecolors || []) if (!sameTarget(state.regions[e.regionId],e)) e.invalidated=true;
}

// Called inside the accepted COLOR transaction, never on skill use/illegal paint.
function resolveDelayedRecolors(state,painter,random) {
  if (!state.delayedRecolors) return;
  const keep=[];
  for (const e of state.delayedRecolors) {
    if (e.actor === painter) {keep.push(e);continue;}
    const r=state.regions[e.regionId];
    let outcome="TARGET_CHANGED",color=null;
    if (!e.invalidated && sameTarget(r,e)) {
      const candidates=legalRecolorCandidates(state,e.regionId);
      outcome="NO_LEGAL_COLOR";
      if (candidates.length) {
        const draw=random();
        if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("INVALID_RANDOM", "Invalid delayed recolor draw");
        color=candidates[Math.floor(draw*candidates.length)];r.color=color;outcome="APPLIED";
      }
    }
    state.lastDelayedRecolor={version:state.version+1,actor:e.actor,regionId:e.regionId,outcome,color};
    state.publicLog.push(outcome === "APPLIED" ? `再彩色予約 ${e.regionId}: ${color} に変わりました。`
      : `再彩色予約 ${e.regionId}: 不発（${outcome === "TARGET_CHANGED" ? "対象が変化・消失" : "合法な別色なし"}）。`);
  }
  if (keep.length) state.delayedRecolors=keep;else delete state.delayedRecolors;
}

module.exports={ID,validateDelayedRecolor,applyDelayedRecolor,invalidateDelayedRecolors,resolveDelayedRecolors};
