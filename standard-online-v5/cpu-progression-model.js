// Presentation projections only. The server owns eligibility, equipment and uses.
const COLORS = ["red", "blue", "yellow", "green"];
export const TECHNIQUE_ID = "techUnsealOne";
export function isRenTrial(state) {
  return state?.engineVersion === "5.0.0-alpha.5" && state?.techniqueRule?.id === "REN_UNSEAL_TRIAL_V1";
}
export function techniquePresentation(state, own, seat, pending = false) {
  const slot = own?.technique;
  const visible = ["5.0.0-alpha.5", "5.0.0-alpha.6"].includes(state?.engineVersion) && ["A", "B"].includes(seat)
    && own?.seat === seat && slot?.id === TECHNIQUE_ID && slot.definitionVersion === "unseal-v1"
    && [0, 1].includes(slot.usesRemaining)
    // The validated provenance stays in server authority, not the seat projection.
    && (isRenTrial(state) || state.techniqueRule?.id === "CPU_LEARNED_V1" && state.techniqueRule.playerSeat === seat);
  if (!visible) return { visible: false, usable: false, colors: [] };
  const colors = [...new Set([...(own.basicPalette || []), own.bonusColor])].filter(color => COLORS.includes(color))
    .map(color => ({ color, sealed: Number(state.publicEffects?.[seat]?.seals?.[color] || 0) > 0,
      bonusEmpty: color === own.bonusColor && own.bonusUsesRemaining === 0 }));
  const reason = slot.usesRemaining === 0 ? "この対局では使用済み"
    : pending ? "前の操作を確認中"
      : state.status !== "ACTIVE" ? "対局は終了しました"
        : state.active !== seat ? "自分の手番で使えます"
          : state.phase !== "COLOR" ? "色を塗るときに使えます"
            : state.skillCategoryWindow?.categories?.includes("color") ? "この手番の色操作は使用済み"
              : !colors.some(item => item.sealed) ? "現在の持ち色に封印はありません" : "封印を解く色を選べます";
  return { visible: true, usable: reason === "封印を解く色を選べます", colors, reason,
    sourceLabel: isRenTrial(state) ? "試練貸与" : "伝授",
    uses: slot.usesRemaining, scope: `${state.matchId}:${state.version}:${seat}` };
}
export function validRenTrialInfo(value) {
  const p = value?.progression, t = value?.trial;
  return p?.characterId === "ren" && ["learned", "trial_unlocked", "returning", "first_meeting"].includes(p.stage)
    && typeof p.line === "string" && p.line.length <= 120 && typeof p.trialUnlocked === "boolean"
    && t?.trialId === "ren-unseal" && t.trialVersion === 1 && t.characterId === "ren"
    && t.techniqueId === TECHNIQUE_ID && t.policyVersion === "ren-unseal-trial-v1" && t.loanUses === 1
    && typeof t.title === "string" && t.title.length <= 80 && Array.isArray(t.conditions) && t.conditions.length === 4
    && t.conditions.every(line => typeof line === "string" && line.length <= 240)
    && ["color", "area", "disrupt"].every(category => Array.isArray(t.loanLoadout?.[category])
      && t.loanLoadout[category].length === 2 && t.loanLoadout[category].every(id => typeof id === "string" && id !== TECHNIQUE_ID));
}
