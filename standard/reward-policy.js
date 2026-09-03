"use strict";

function rewardFor({ correct, wrong, bestStreak, selectedLevel }) {
  let draws = 1;
  let ticketLevel = selectedLevel;
  let reason = "参加報酬";
  if (correct === 10) {
    draws = 10;
    reason = "全問正解";
  } else if (bestStreak >= 5) {
    draws = 5;
    reason = "五問以上の連続正解";
  } else if (correct >= 7) {
    draws = 3;
    reason = "累計七問以上正解";
  } else if (wrong >= 3) {
    ticketLevel = Math.max(1, selectedLevel - 1);
    reason = "三回目のミスによる救済";
  }
  return Object.freeze({ draws, ticketLevel, reason });
}

module.exports = { rewardFor };
