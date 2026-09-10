"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const rewards = require("../standard/standard-match-reward.js");

function profile(history = [], tickets = {}) {
  return { matchHistory: history, gachaTickets: { ...tickets } };
}

function history(matchId, endedAt, matchReward) {
  return { matchId, endedAt, ...(matchReward ? { matchReward } : {}) };
}

test("PvP rewards distinguish wins and losses with a bounded hourly issue rate", () => {
  const finishedAt = "2026-09-10T10:00:00.000Z";
  const won = rewards.quoteMatchReward({ profile: profile(), matchId: "win", won: true, opponentKind: "pvp", finishedAt });
  const lost = rewards.quoteMatchReward({ profile: profile(), matchId: "loss", won: false, opponentKind: "pvp", finishedAt });
  assert.deepEqual([won.ticketLevel, won.ticketCount, won.reason], [2, 1, "PVP_WIN"]);
  assert.deepEqual([lost.ticketLevel, lost.ticketCount, lost.reason], [1, 1, "PVP_LOSS"]);

  const recent = Array.from({ length: 10 }, (_, index) => history(`prior-${index}`, `2026-09-10T09:${String(index + 1).padStart(2, "0")}:00.000Z`, won));
  const limited = rewards.quoteMatchReward({ profile: profile(recent), matchId: "eleventh", won: true, opponentKind: "pvp", finishedAt });
  assert.deepEqual([limited.awarded, limited.ticketLevel, limited.ticketCount, limited.reason, limited.rewardedPvpMatchesInWindow], [false, null, 0, "PVP_REWARD_LIMIT", 10]);
});

test("the exact 60-minute boundary expires and legacy rewards are never inferred", () => {
  const finishedAt = "2026-09-10T10:00:00.000Z";
  const sample = rewards.quoteMatchReward({ profile: profile(), matchId: "sample", won: true, opponentKind: "pvp", finishedAt });
  const entries = [
    history("boundary", "2026-09-10T09:00:00.000Z", sample),
    history("inside", "2026-09-10T09:00:00.001Z", sample),
    history("legacy", "2026-09-10T09:59:59.000Z"),
  ];
  const quoted = rewards.quoteMatchReward({ profile: profile(entries), matchId: "current", won: false, opponentKind: "pvp", finishedAt });
  assert.equal(quoted.rewardedPvpMatchesInWindow, 2);
});

test("CPU losses always receive Lv.1 x1 and wins follow stable strength bands", () => {
  for (const characterId of Object.keys(rewards.CPU_REWARD_BANDS)) {
    const lost = rewards.quoteMatchReward({ profile: profile(), matchId: `loss-${characterId}`, won: false, opponentKind: "cpu", cpuCharacterId: characterId, finishedAt: "2026-09-10T10:00:00.000Z" });
    assert.deepEqual([lost.ticketLevel, lost.ticketCount, lost.reason], [1, 1, "CPU_LOSS"]);
  }
  const cases = {
    yuzu: [1, 2, "CPU_WIN_BEGINNER"],
    ren: [2, 1, "CPU_WIN_STANDARD"],
    tsubasa: [2, 2, "CPU_WIN_ADVANCED"],
    kurogane: [3, 2, "CPU_WIN_MASTER"],
  };
  for (const [characterId, expected] of Object.entries(cases)) {
    const won = rewards.quoteMatchReward({ profile: profile(), matchId: `win-${characterId}`, won: true, opponentKind: "cpu", cpuCharacterId: characterId, finishedAt: "2026-09-10T10:00:00.000Z" });
    assert.deepEqual([won.ticketLevel, won.ticketCount, won.reason], expected);
  }
});

test("reward bands are monotonic and cap PvP issuance at ten tickets per hour", () => {
  const expectedSellCoins = { 1: 21.5, 2: 43.2, 3: 65.4 };
  const value = ({ ticketLevel, ticketCount }) => expectedSellCoins[ticketLevel] * ticketCount;
  const bandValues = ["yuzu", "ren", "tsubasa", "kurogane"].map((cpuCharacterId) => value(
    rewards.quoteMatchReward({ profile: profile(), matchId: cpuCharacterId, won: true, opponentKind: "cpu", cpuCharacterId, finishedAt: "2026-09-10T10:00:00.000Z" }),
  ));
  assert.deepEqual(bandValues, [43, 43.2, 86.4, 130.8]);
  assert.ok(bandValues.every((current, index) => index === 0 || current > bandValues[index - 1]));
  assert.equal(value({ ticketLevel: 2, ticketCount: rewards.PVP_REWARD_LIMIT }), 432);
});

test("applying a reward is match-id bound, overflow safe, and single-use", () => {
  const base = profile([history("m1", "2026-09-10T10:00:00.000Z")], { 2: 4 });
  const reward = rewards.quoteMatchReward({ profile: base, matchId: "m1", won: true, opponentKind: "pvp", finishedAt: "2026-09-10T10:00:00.000Z" });
  const applied = rewards.applyMatchReward({ profile: base, matchId: "m1", reward });
  assert.equal(applied.gachaTickets["2"], 5);
  assert.deepEqual(applied.matchHistory[0].matchReward, reward);
  assert.throws(() => rewards.applyMatchReward({ profile: applied, matchId: "m1", reward }), /MATCH_REWARD_ALREADY_RECORDED/);
  assert.throws(() => rewards.applyMatchReward({ profile: profile([], { 2: Number.MAX_SAFE_INTEGER }), matchId: "missing", reward }), /MATCH_REWARD_ALREADY_RECORDED/);
  assert.throws(() => rewards.validateMatchReward({ ...reward, ticketCount: 2 }), /INVALID_MATCH_REWARD/);
});
