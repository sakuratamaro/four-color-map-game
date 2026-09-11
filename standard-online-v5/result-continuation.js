// Only a saved result for this exact finished room can choose an earned-ticket route.
export function savedResultReward(room, seat, profile) {
  const state = room?.public_state;
  if (room?.status !== "finished" || state?.status !== "FINISHED" || !["A", "B"].includes(seat)
      || !["A", "B"].includes(state.winner) || typeof state.matchId !== "string" || !state.matchId || state.debugUnlimitedSkills === true
      || state.labRuleSetId === "STANDARD_V5_LEGAL_RECOLOR_LAB_V1") return null;
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
