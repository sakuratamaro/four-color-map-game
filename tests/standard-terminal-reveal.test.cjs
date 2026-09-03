"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const { createTerminalRevealController } = require("../standard-v5/terminal-reveal.js");

class FakeNode {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.textContent = "";
    this.parentNode = null;
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
}

function fixture() {
  const body = new FakeNode("body");
  const document = { body, createElement: (tagName) => new FakeNode(tagName) };
  const callbacks = [];
  const cancelled = new Set();
  let contactClears = 0;
  const controller = createTerminalRevealController({
    document,
    clearContactReveal: () => { contactClears += 1; },
    schedule: (callback) => { callbacks.push(callback); return callbacks.length - 1; },
    cancel: (id) => cancelled.add(id),
  });
  controller.activateSession("match");
  return { body, callbacks, cancelled, controller, contactClears: () => contactClears };
}

test("terminal reveal is one-shot, text-only, inert, and finite", () => {
  const value = fixture();
  const headline = '<img src=x onerror=alert(1)>';
  const resultText = '\"><svg onload=alert(1)>';
  const context = value.controller.getSessionContext();
  assert.equal(value.controller.showTerminalReveal({ eventId: "match:9", ...context, headline, resultText }), true);
  assert.equal(value.contactClears(), 1);
  assert.equal(value.body.children.length, 1);
  const layer = value.body.children[0];
  assert.equal(layer.attributes["aria-hidden"], "true");
  assert.equal(layer.children[0].children[1].textContent, headline);
  assert.equal(layer.children[0].children[2].textContent, resultText);
  assert.equal(value.controller.showTerminalReveal({ eventId: "match:9", ...context, headline, resultText }), false);
  assert.equal(value.body.children.length, 1);
  value.callbacks[0]();
  assert.equal(value.body.children.length, 0);
});

test("stale terminal callback cannot remove a newer event", () => {
  const value = fixture();
  const matchA = value.controller.activateSession("match-a");
  assert.equal(value.controller.showTerminalReveal({ eventId: "match-a:4", ...matchA, headline: "勝利", resultText: "A の勝利" }), true);
  const staleCallback = value.callbacks[0];
  const matchB = value.controller.activateSession("match-b");
  assert.equal(value.controller.showTerminalReveal({ eventId: "match-b:7", ...matchB, headline: "詰み！", resultText: "B の勝利" }), true);
  assert.equal(value.cancelled.has(0), true);
  staleCallback();
  assert.equal(value.body.children.length, 1);
  assert.equal(value.body.children[0].children[0].children[1].textContent, "詰み！");
  value.callbacks[1]();
  assert.equal(value.body.children.length, 0);
});

test("stale match A admission cannot re-enter after match B presentation", () => {
  const value = fixture();
  const matchA = value.controller.activateSession("match-a");
  assert.equal(value.controller.showTerminalReveal({ eventId: "match-a:4", ...matchA, headline: "A勝利", resultText: "A の結果" }), true);
  const matchB = value.controller.activateSession("match-b");
  assert.equal(value.controller.showTerminalReveal({ eventId: "match-b:7", ...matchB, headline: "B勝利", resultText: "B の結果" }), true);
  const terminalB = value.body.children[0];
  assert.equal(value.controller.showTerminalReveal({ eventId: "match-a:4", ...matchA, headline: "A勝利", resultText: "A の結果" }), false);
  assert.equal(value.body.children.length, 1);
  assert.equal(value.body.children[0], terminalB);
  assert.equal(value.body.children[0].children[0].children[1].textContent, "B勝利");
});

test("terminal priority clears contact and its stale callback cannot remove terminal", () => {
  const body = new FakeNode("body");
  const contact = new FakeNode("div");
  contact.className = "contact-reveal";
  body.appendChild(contact);
  let contactGeneration = 1;
  const capturedContactGeneration = contactGeneration;
  const staleContactCallback = () => {
    if (capturedContactGeneration !== contactGeneration || contact.parentNode !== body) return;
    contact.remove();
  };
  const callbacks = [];
  const controller = createTerminalRevealController({
    document: { body, createElement: (tagName) => new FakeNode(tagName) },
    clearContactReveal: () => { contactGeneration += 1; contact.remove(); },
    schedule: (callback) => { callbacks.push(callback); return callbacks.length - 1; },
    cancel: () => {},
  });
  const context = controller.activateSession("match");
  assert.equal(controller.showTerminalReveal({ eventId: "match:5", ...context, headline: "勝利", resultText: "A の勝利" }), true);
  assert.equal(body.children.filter((node) => node.className === "contact-reveal").length, 0);
  assert.equal(body.children.filter((node) => node.className === "terminal-reveal").length, 1);
  staleContactCallback();
  assert.equal(body.children.filter((node) => node.className === "terminal-reveal").length, 1);
});

test("failed timer reservation does not mark the event as shown", () => {
  const body = new FakeNode("body");
  let fail = true;
  const controller = createTerminalRevealController({
    document: { body, createElement: (tagName) => new FakeNode(tagName) },
    clearContactReveal: () => {},
    schedule: () => {
      if (fail) { fail = false; throw new Error("timer unavailable"); }
      return 1;
    },
    cancel: () => {},
  });
  const context = controller.activateSession("retryable");
  assert.throws(() => controller.showTerminalReveal({ eventId: "retryable:3", ...context, headline: "勝利", resultText: "B の勝利" }), /timer unavailable/);
  assert.equal(body.children.length, 0);
  assert.equal(controller.showTerminalReveal({ eventId: "retryable:3", ...context, headline: "勝利", resultText: "B の勝利" }), true);
  assert.equal(body.children.length, 1);
});

test("product action gate requires saved new terminal resolution and never fires from render or settlement", () => {
  const app = fs.readFileSync(path.join(root, "standard-v5", "app.js"), "utf8");
  assert.match(app, /result\.status === "RESOLVED" && result\.saved && result\.appliedNow && !result\.replayedReceipt/);
  assert.match(app, /result\.projection\?\.publicState\?\.status === "FINISHED"/);
  assert.match(app, /eventId: `\$\{publicResult\.matchId\}:\$\{publicResult\.finalMatchVersion\}`/);
  assert.match(app, /matchId: publicResult\.matchId/);
  assert.match(app, /sessionGeneration: terminalSessionContext\.sessionGeneration/);
  const calls = [...app.matchAll(/showTerminalReveal\(/g)];
  assert.equal(calls.length, 1);
});

test("terminal reveal has no persistence, private-state, dialog, focus, or RNG dependency", () => {
  const source = fs.readFileSync(path.join(root, "standard-v5", "terminal-reveal.js"), "utf8");
  assert.doesNotMatch(source, /localStorage|activeMatch|private|palette|bonus|hand|effect|receipt|settlement|RNG|random|innerHTML|role.*dialog|focus\(/i);
  assert.match(source, /textContent = headline/);
  assert.match(source, /textContent = resultText/);
  assert.doesNotMatch(source, /new Set\(/);
  assert.match(source, /lastShownEventId = eventId/);
  assert.match(source, /matchId !== currentMatchId/);
  assert.match(source, /sessionGeneration !== currentSessionGeneration/);
});
