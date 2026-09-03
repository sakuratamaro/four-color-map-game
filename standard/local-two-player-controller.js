"use strict";

const {
  applyStandardAction,
  projectStandardPrivateState,
  projectStandardPublicState,
} = require("./standard-match.js");

function clearPrivateDom(root) {
  if (!root) return;
  root.replaceChildren();
  for (const attribute of [...(root.attributes || [])]) {
    const name = String(attribute.name || "").toLowerCase();
    if (name === "title" || name.startsWith("aria-") || name.startsWith("data-")) root.removeAttribute(attribute.name);
  }
}

class LocalTwoPlayerController {
  constructor({
    state,
    rngStreams,
    renderPublic,
    renderPrivate,
    clearPrivate,
    showHandover,
    hideHandover,
    applyAction = applyStandardAction,
    projectPublic = projectStandardPublicState,
    projectPrivate = projectStandardPrivateState,
  }) {
    this.state = state;
    this.rngStreams = rngStreams;
    this.revealedSeat = null;
    this.renderPublic = renderPublic;
    this.renderPrivate = renderPrivate;
    this.clearPrivate = clearPrivate;
    this.showHandover = showHandover;
    this.hideHandover = hideHandover;
    this.applyAction = applyAction;
    this.projectPublic = projectPublic;
    this.projectPrivate = projectPrivate;
  }

  start() {
    this.#concealAndHandover();
  }

  revealCurrentSeat() {
    if (this.state.status === "FINISHED") return Object.freeze({ ok: false, code: "MATCH_FINISHED" });
    this.hideHandover();
    this.revealedSeat = this.state.active;
    this.renderPublic(this.projectPublic(this.state));
    this.renderPrivate(this.projectPrivate(this.state, this.revealedSeat));
    return Object.freeze({ ok: true, seat: this.revealedSeat });
  }

  dispatch(action) {
    if (this.revealedSeat !== this.state.active) return Object.freeze({ ok: false, code: "PRIVATE_VIEW_NOT_REVEALED", state: this.state });
    const previousSeat = this.state.active;
    const result = this.applyAction({
      state: this.state,
      actor: previousSeat,
      action,
      expectedVersion: this.state.version,
      rngStreams: this.rngStreams,
    });
    if (!result.ok) return result;
    this.state = result.state;
    if (this.state.status === "FINISHED") {
      this.revealedSeat = null;
      this.clearPrivate();
      this.renderPublic(this.projectPublic(this.state));
      this.hideHandover();
    } else if (this.state.active !== previousSeat) {
      this.#concealAndHandover();
    } else {
      this.renderPublic(this.projectPublic(this.state));
      this.renderPrivate(this.projectPrivate(this.state, this.revealedSeat));
    }
    return result;
  }

  dispatchAutomated(actor, action) {
    if (actor !== this.state.active) return Object.freeze({ ok: false, code: "NOT_YOUR_TURN", state: this.state });
    this.revealedSeat = null;
    this.clearPrivate();
    const result = this.applyAction({
      state: this.state,
      actor,
      action,
      expectedVersion: this.state.version,
      rngStreams: this.rngStreams,
    });
    if (!result.ok) return result;
    this.state = result.state;
    if (this.state.status === "FINISHED") {
      this.renderPublic(this.projectPublic(this.state));
      this.hideHandover();
    } else {
      this.renderPublic(this.projectPublic(this.state));
      this.showHandover(Object.freeze({ seat: this.state.active, phase: this.state.phase }));
    }
    return result;
  }

  #concealAndHandover() {
    this.revealedSeat = null;
    this.clearPrivate();
    this.renderPublic(this.projectPublic(this.state));
    this.showHandover(Object.freeze({ seat: this.state.active, phase: this.state.phase }));
  }
}

module.exports = { LocalTwoPlayerController, clearPrivateDom };
