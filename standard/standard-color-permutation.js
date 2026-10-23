"use strict";

const { COLORS, StandardRuleError, adjacentRegionIds } = require("./standard-engine.js");
const { supportsSplitKeep } = require("./standard-skill-registry.js");

function validateColorPermutationState(state) {
  if (!Object.hasOwn(state, "rotationUsedBy")) return;
  const used = state.rotationUsedBy;
  if (!supportsSplitKeep(state.engineVersion) || !Array.isArray(used) || used.length < 1 || used.length > 2
    || new Set(used).size !== used.length || used.some(seat => !["A", "B"].includes(seat))) {
    throw new StandardRuleError("INVALID_ROTATION_HISTORY", "Invalid public rotation history");
  }
}

// Uses only public geometry/colors. No candidate filtering consults either player's palette.
function applyColorPermutation({ state, actor, payload }) {
  const rotating = payload.skill === "disruptColorRotate", ids = payload.regionIds;
  const reject = code => ({ ok: false, code, state });
  if (state.phase !== "WORK") return reject("WRONG_PHASE");
  if (state.pending || state.reserved || state.retainedSplit || state.preparedOutgoing || state.redesignation) {
    return reject("ACTIVE_FLOW_CONFLICT");
  }
  if (rotating && state.rotationUsedBy?.includes(actor)) return reject("ROTATION_ALREADY_USED");
  if (ids.some(id => !COLORS.includes(state.regions[id]?.color) || state.regions[id].isPending
    || state.regions[id].isReserved || state.regions[id].deleted || state.regions[id].delayed || state.regions[id].delayState || !state.regions[id].micro?.length)) {
    return reject("INELIGIBLE_PERMUTATION_REGION");
  }
  const adjacent = ids.map(id => adjacentRegionIds(state, id));
  if (rotating ? !adjacent[0].includes(ids[1]) || !adjacent[1].includes(ids[2]) : adjacent[0].includes(ids[1])) {
    return reject(rotating ? "ROTATION_REQUIRES_CHAIN" : "SWAP_REQUIRES_NONADJACENT");
  }
  const colors = ids.map(id => state.regions[id].color);
  if (colors.every(color => color === colors[0])) return reject("NO_EFFECT");
  const next = JSON.parse(JSON.stringify(state));
  ids.forEach((id, index) => { next.regions[id].color = colors[(index + ids.length - 1) % ids.length]; });
  if (ids.some((id, index) => adjacent[index].some(neighbor => next.regions[neighbor].color === next.regions[id].color))) {
    return reject("RECOLOR_ADJACENCY_CONFLICT");
  }
  next.hands[actor][payload.skill] -= 1;
  next.skillsUsed[actor] = (next.skillsUsed[actor] || 0) + 1;
  next.version += 1;
  if (rotating) next.rotationUsedBy = [...(next.rotationUsedBy || []), actor];
  next.active = actor === "A" ? "B" : "A";
  next.phase = "WORK";
  next.interferenceLock = true;
  next.publicLog.push(`Player ${actor} ${rotating ? "rotated" : "swapped"} the colors of ${ids.join(" -> ")}; Player ${next.active} must designate a region.`);
  return { ok: true, code: "OK", state: next, cardConsumed: true, regionIds: [...ids] };
}

module.exports = { applyColorPermutation, validateColorPermutationState };
