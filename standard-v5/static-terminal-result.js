"use strict";

function createTextElement(document, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function safeStats(summary, seat) {
  if (summary?.status !== "SETTLED") return null;
  const source = summary.bySeat?.[seat];
  if (!source || !["WIN", "LOSS"].includes(source.result)) return null;
  const fields = ["wins", "losses", "currentWinStreak", "bestWinStreak"];
  if (fields.some((field) => !Number.isSafeInteger(source[field]) || source[field] < 0)) return null;
  return Object.freeze({ result: source.result, ...Object.fromEntries(fields.map((field) => [field, source[field]])) });
}

function createStaticTerminalResultRenderer({ document, container, retrySettlement }) {
  if (!document || !container || typeof retrySettlement !== "function") throw new TypeError("STATIC_TERMINAL_RENDERER_INPUT_REQUIRED");
  const headline = container.querySelector("#terminalHeadline");
  const winner = container.querySelector("#terminalWinner");
  const reason = container.querySelector("#terminalReason");
  const settlementStatus = container.querySelector("#settlementStatus");
  const stats = container.querySelector("#terminalStats");
  const trophies = container.querySelector("#unlockedTrophies");
  const retry = container.querySelector("#retrySettlement");
  if ([headline, winner, reason, settlementStatus, stats, trophies, retry].some((element) => !element)) throw new Error("STATIC_TERMINAL_DOM_REQUIRED");

  retry.addEventListener("click", () => {
    if (!retry.hidden && !retry.disabled) retrySettlement();
  });

  function clearOptionalSections() {
    stats.replaceChildren();
    stats.hidden = true;
    trophies.replaceChildren();
    trophies.hidden = true;
    retry.hidden = true;
    retry.disabled = false;
    retry.removeAttribute("aria-busy");
  }

  function appendSeatStats(terminalPresentation, settlementSummary, seat) {
    const publicStats = safeStats(settlementSummary, seat);
    if (!publicStats) return;
    const name = seat === terminalPresentation.winnerSeat ? terminalPresentation.winnerName : terminalPresentation.loserName;
    const group = document.createElement("section");
    group.className = "terminal-seat-stats";
    group.appendChild(createTextElement(document, "h3", name));
    const list = document.createElement("dl");
    for (const [label, value] of [
      ["結果", publicStats.result === "WIN" ? "勝利" : "敗北"],
      ["通算勝利", publicStats.wins],
      ["通算敗北", publicStats.losses],
      ["現在連勝", publicStats.currentWinStreak],
      ["最高連勝", publicStats.bestWinStreak],
    ]) {
      list.append(createTextElement(document, "dt", label), createTextElement(document, "dd", String(value)));
    }
    group.appendChild(list);
    stats.appendChild(group);
  }

  function renderStaticTerminalResult({ terminalPresentation, settlementSummary }) {
    clearOptionalSections();
    container.hidden = false;
    const valid = terminalPresentation?.ok === true;
    headline.textContent = valid ? terminalPresentation.headline : "対戦は終了しました";
    winner.textContent = valid ? terminalPresentation.resultText : "対戦結果を表示できません。";
    reason.textContent = valid ? terminalPresentation.reasonText : "結果の詳細を表示できません。";
    settlementStatus.textContent = valid ? terminalPresentation.settlementText : "戦績の状態を確認できません。";
    if (!valid) return;

    if (terminalPresentation.settlementState === "FAILED") {
      retry.hidden = false;
      return;
    }
    if (terminalPresentation.settlementState !== "SETTLED" || settlementSummary?.status !== "SETTLED") return;

    appendSeatStats(terminalPresentation, settlementSummary, "A");
    appendSeatStats(terminalPresentation, settlementSummary, "B");
    stats.hidden = stats.childElementCount === 0;
    if (!Array.isArray(terminalPresentation.unlockedTrophies) || terminalPresentation.unlockedTrophies.length === 0) return;
    trophies.appendChild(createTextElement(document, "h3", "今回解除したトロフィー"));
    const list = document.createElement("ul");
    for (const trophy of terminalPresentation.unlockedTrophies) {
      const owner = trophy.seat === terminalPresentation.winnerSeat
        ? terminalPresentation.winnerName
        : trophy.seat === terminalPresentation.loserSeat
          ? terminalPresentation.loserName
          : "";
      list.appendChild(createTextElement(document, "li", owner ? `${owner}：${trophy.label}` : trophy.label));
    }
    trophies.appendChild(list);
    trophies.hidden = false;
  }

  function setRetryBusy(busy) {
    if (retry.hidden) return;
    retry.disabled = busy === true;
    if (busy === true) retry.setAttribute("aria-busy", "true");
    else retry.removeAttribute("aria-busy");
  }

  function hide() {
    clearOptionalSections();
    container.hidden = true;
  }

  return Object.freeze({ hide, renderStaticTerminalResult, setRetryBusy });
}

module.exports = { createStaticTerminalResultRenderer };
