// Only a saved result for this exact finished room can choose an earned-ticket route.
export function savedResultReward(room, seat, profile) {
  const state = room?.public_state;
  if (room?.status !== "finished" || state?.status !== "FINISHED" || !["A", "B"].includes(seat)
      || !["A", "B"].includes(state.winner) || typeof state.matchId !== "string" || !state.matchId || state.debugUnlimitedSkills === true
      || state.labRuleSetId === "STANDARD_V5_LEGAL_RECOLOR_LAB_V1"
      || state.techniqueRule?.id === "REN_UNSEAL_TRIAL_V1") return null;
  const result = state.winner === seat ? "WIN" : "LOSS";
  const entry = Array.isArray(profile?.matchHistory) ? profile.matchHistory.find(item => item?.matchId === state.matchId) : null;
  const reward = entry?.matchReward;
  if (entry?.result !== result || room.opponent_kind === "cpu" && entry.onlineOpponentKind !== "cpu"
      || reward?.awarded !== true || !Number.isSafeInteger(reward.ticketLevel)
      || reward.ticketLevel < 1 || reward.ticketLevel > 5
      || !Number.isSafeInteger(reward.ticketCount) || reward.ticketCount < 1) return null;
  const total = profile?.gachaTickets?.[String(reward.ticketLevel)];
  return Object.freeze({ roomId:room.id, roomVersion:Number(room.version), matchId:state.matchId,
    opponentKind:room.opponent_kind, ticketLevel:reward.ticketLevel, ticketCount:reward.ticketCount,
    ticketTotal:Number.isSafeInteger(total) && total >= 0 ? total : null });
}

// Presentation only: never infer a reward from balance, stats, a CPU tier or an example.
export function terminalRewardPresentation(room, seat, profile) {
  const state = room?.public_state;
  const pending = Object.freeze({ kind:"pending", text:"報酬を確認中です。" });
  if (room?.status !== "finished" || state?.status !== "FINISHED" || !["A","B"].includes(seat)
      || !["A","B"].includes(state.winner)) return pending;
  if (state.debugUnlimitedSkills === true || state.labRuleSetId === "STANDARD_V5_LEGAL_RECOLOR_LAB_V1")
    return Object.freeze({kind:"lab",text:"実験対戦のため報酬はありません。"});
  if (state.techniqueRule?.id === "REN_UNSEAL_TRIAL_V1") {
    if (state.winner !== seat) return Object.freeze({kind:"trial_loss",text:"試練は再挑戦できます。通常戦績・券・コインは変わりません。"});
    const learned = profile?.learnedTechniques?.includes("techUnsealOne")
      && profile?.cpuTrialProgress?.["ren-unseal"]?.clearedVersions?.includes(1);
    return Object.freeze({kind:learned ? "trial_learned" : "trial_pending",text:learned
      ? "試練クリア。解封は習得済みです。ロビーへ戻り、プロフィールで装備できます。通常報酬・重複報酬はありません。"
      : "試練クリア。解封の保存状況を確認中です。通常戦績・券・コインは変わりません。"});
  }
  const reward = savedResultReward(room, seat, profile);
  if (reward) return Object.freeze({kind:"reward",text:`完了報酬\nLv.${reward.ticketLevel}ガチャ券 ×${reward.ticketCount}`});
  const entry = Array.isArray(profile?.matchHistory) ? profile.matchHistory.find(item => item?.matchId === state.matchId) : null;
  if (entry?.result !== (state.winner === seat ? "WIN" : "LOSS")
      || (room.opponent_kind === "cpu" && entry.onlineOpponentKind !== "cpu")) return pending;
  if (entry.matchReward?.awarded === false) return Object.freeze({kind:"none",text:
    room.opponent_kind !== "cpu" && entry.matchReward.reason === "PVP_REWARD_LIMIT"
      ? "今回は報酬なし（受取上限）。" : "この対戦の報酬はありません。"});
  return pending;
}
