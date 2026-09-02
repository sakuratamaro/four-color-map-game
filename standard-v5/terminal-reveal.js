"use strict";

function createTerminalRevealController({ document, clearContactReveal, schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (!document?.body || typeof document.createElement !== "function") throw new TypeError("TERMINAL_REVEAL_DOCUMENT_REQUIRED");
  if (typeof clearContactReveal !== "function") throw new TypeError("TERMINAL_REVEAL_CONTACT_CLEAR_REQUIRED");
  let lastShownEventId = null;
  let generation = 0;
  let currentNode = null;
  let currentTimer = null;
  let currentMatchId = null;
  let currentSessionGeneration = 0;

  function clear() {
    generation += 1;
    if (currentTimer !== null) cancel(currentTimer);
    currentTimer = null;
    currentNode?.remove();
    currentNode = null;
  }

  function activateSession(matchId = null) {
    const nextMatchId = typeof matchId === "string" && matchId ? matchId : null;
    if (nextMatchId === currentMatchId) {
      return Object.freeze({ matchId: currentMatchId, sessionGeneration: currentSessionGeneration });
    }
    clear();
    currentMatchId = nextMatchId;
    currentSessionGeneration += 1;
    lastShownEventId = null;
    return Object.freeze({ matchId: currentMatchId, sessionGeneration: currentSessionGeneration });
  }

  function getSessionContext() {
    return Object.freeze({ matchId: currentMatchId, sessionGeneration: currentSessionGeneration });
  }

  function showTerminalReveal({ eventId, matchId, sessionGeneration, headline, resultText } = {}) {
    if (typeof matchId !== "string" || !matchId || matchId !== currentMatchId) return false;
    if (!Number.isSafeInteger(sessionGeneration) || sessionGeneration !== currentSessionGeneration) return false;
    if (typeof eventId !== "string" || !eventId || eventId === lastShownEventId) return false;
    if (typeof headline !== "string" || !headline || typeof resultText !== "string" || !resultText) return false;

    clearContactReveal();
    clear();
    const token = ++generation;
    const layer = document.createElement("div");
    const card = document.createElement("div");
    const kicker = document.createElement("p");
    const title = document.createElement("p");
    const result = document.createElement("p");
    layer.className = "terminal-reveal";
    layer.setAttribute("aria-hidden", "true");
    card.className = "terminal-reveal-card";
    kicker.className = "terminal-reveal-kicker";
    title.className = "terminal-reveal-headline";
    result.className = "terminal-reveal-result";
    kicker.textContent = "MATCH COMPLETE";
    title.textContent = headline;
    result.textContent = resultText;
    card.append(kicker, title, result);
    layer.appendChild(card);
    document.body.appendChild(layer);
    currentNode = layer;
    try {
      currentTimer = schedule(() => {
        if (token !== generation || currentNode !== layer) return;
        layer.remove();
        currentNode = null;
        currentTimer = null;
      }, 1200);
    } catch (error) {
      layer.remove();
      currentNode = null;
      currentTimer = null;
      throw error;
    }
    lastShownEventId = eventId;
    return true;
  }

  return Object.freeze({ activateSession, clear, getSessionContext, showTerminalReveal });
}

module.exports = { createTerminalRevealController };
