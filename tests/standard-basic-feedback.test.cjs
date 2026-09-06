"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const feedback = require("../standard-online-v5/basic-feedback.js");

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values,
  };
}

function audioHarness({ fail = false } = {}) {
  const calls = { contexts: 0, oscillators: 0, starts: 0, stops: 0, resumes: 0, suspends: 0 };
  class AudioContext {
    constructor() {
      if (fail) throw new Error("AUDIO_DISABLED");
      calls.contexts += 1;
      this.currentTime = 4;
      this.destination = {};
      this.state = "running";
    }
    createOscillator() {
      calls.oscillators += 1;
      return {
        type: "",
        frequency: { setValueAtTime() {} },
        connect() {},
        start() { calls.starts += 1; },
        stop() { calls.stops += 1; },
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    }
    resume() { calls.resumes += 1; this.state = "running"; return Promise.resolve(); }
    suspend() { calls.suspends += 1; this.state = "suspended"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  return { globalRef: { AudioContext }, calls };
}

function environment({ storage = memoryStorage(), hidden = false, online = true, audioFail = false, vibrationFail = false } = {}) {
  const audio = audioHarness({ fail: audioFail });
  const patterns = [];
  const documentRef = { hidden, visibilityState: hidden ? "hidden" : "visible" };
  const navigatorRef = {
    onLine: online,
    vibrate(pattern) {
      if (vibrationFail) throw new Error("VIBRATION_DISABLED");
      patterns.push([...pattern]);
      return true;
    },
  };
  return { storage, documentRef, navigatorRef, patterns, ...audio };
}

function gestureTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    dispatch(type, event) { listeners.get(type)?.(event); },
    listenerCount() { return listeners.size; },
  };
}

test("feedback settings are explicit opt-in, versioned, strict, and persistent", () => {
  const storage = memoryStorage();
  const env = environment({ storage });
  const controller = feedback.createBasicFeedbackController(env);
  assert.deepEqual(controller.snapshot().settings, { schemaVersion: 1, sound: false, vibration: false });
  assert.equal(env.calls.contexts, 0);

  controller.setSettings({ sound: true, vibration: true });
  assert.deepEqual(JSON.parse(storage.getItem(feedback.STORAGE_KEY)), { schemaVersion: 1, sound: true, vibration: true });
  const restored = feedback.createBasicFeedbackController(environment({ storage }));
  assert.deepEqual(restored.snapshot().settings, { schemaVersion: 1, sound: true, vibration: true });

  storage.setItem(feedback.STORAGE_KEY, JSON.stringify({ schemaVersion: 2, sound: true, vibration: true }));
  assert.deepEqual(feedback.createBasicFeedbackController(environment({ storage })).snapshot().settings,
    { schemaVersion: 1, sound: false, vibration: false });
  assert.deepEqual(feedback.normalizedSettings({ schemaVersion: 1, sound: "true", vibration: 1 }),
    { schemaVersion: 1, sound: false, vibration: false });
});

test("sound is created only by a trusted gesture and every cue is synthesized in code", () => {
  const env = environment();
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: true });
  assert.equal(controller.snapshot().audioUnlocked, false);
  assert.equal(controller.unlockFromGesture({ isTrusted: false }), false);
  assert.equal(env.calls.contexts, 0);

  assert.equal(controller.unlockFromGesture({ isTrusted: true }), true);
  assert.equal(env.calls.contexts, 1);
  const result = controller.notify({ eventId: "match-1:4", cue: "contact-3" });
  assert.deepEqual(result, { accepted: true, duplicate: false, sound: true, vibration: true });
  assert.equal(env.calls.oscillators, 3);
  assert.equal(env.calls.starts, 3);
  assert.equal(env.calls.stops, 3);
  assert.deepEqual(env.patterns, [[45, 25, 45, 25, 65]]);

  assert.deepEqual(controller.notify({ eventId: "match-1:4", cue: "victory" }),
    { accepted: false, duplicate: true, sound: false, vibration: false });
  assert.equal(env.calls.oscillators, 3);
  assert.equal(env.patterns.length, 1);
});

test("hidden, offline, reload, and cross-controller replay are remembered before output", () => {
  const storage = memoryStorage();
  const env = environment({ storage, hidden: true });
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: true });
  controller.unlockFromGesture({ isTrusted: true });
  assert.deepEqual(controller.notify({ eventId: "match-2:8", cue: "turn" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
  env.documentRef.hidden = false;
  env.documentRef.visibilityState = "visible";
  assert.equal(controller.notify({ eventId: "match-2:8", cue: "turn" }).duplicate, true);

  env.navigatorRef.onLine = false;
  assert.deepEqual(controller.notify({ eventId: "match-2:9", cue: "victory" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
  env.navigatorRef.onLine = true;
  assert.equal(controller.notify({ eventId: "match-2:9", cue: "victory" }).duplicate, true);
  assert.equal(env.calls.oscillators, 0);
  assert.equal(env.patterns.length, 0);

  const afterReload = feedback.createBasicFeedbackController(environment({ storage }));
  afterReload.setSettings({ sound: true, vibration: true });
  afterReload.unlockFromGesture({ isTrusted: true });
  assert.equal(afterReload.notify({ eventId: "match-2:8", cue: "turn" }).duplicate, true);
  assert.equal(afterReload.notify({ eventId: "match-2:9", cue: "victory" }).duplicate, true);
});

test("a cross-tab sound OFF to ON change reinstalls the next trusted gesture unlock", () => {
  const storage = memoryStorage({
    [feedback.STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, sound: true, vibration: false }),
  });
  const target = gestureTarget();
  const env = environment({ storage });
  env.documentRef = { ...env.documentRef, ...target };
  const controller = feedback.createBasicFeedbackController(env);
  controller.installGestureUnlock(env.documentRef);
  target.dispatch("pointerdown", { isTrusted: true });
  assert.equal(controller.snapshot().audioUnlocked, true);
  assert.equal(target.listenerCount(), 0);

  storage.setItem(feedback.STORAGE_KEY, JSON.stringify({ schemaVersion: 1, sound: false, vibration: false }));
  controller.handleStorageEvent({ key: feedback.STORAGE_KEY });
  assert.equal(controller.snapshot().audioUnlocked, false);
  storage.setItem(feedback.STORAGE_KEY, JSON.stringify({ schemaVersion: 1, sound: true, vibration: false }));
  controller.handleStorageEvent({ key: feedback.STORAGE_KEY });
  assert.equal(target.listenerCount(), 3);
  target.dispatch("keydown", { isTrusted: true });
  assert.equal(controller.snapshot().audioUnlocked, true);
  assert.equal(target.listenerCount(), 0);
});

test("unsupported and failing presentation APIs never escape into gameplay", () => {
  const storage = memoryStorage();
  const failing = environment({ storage, audioFail: true, vibrationFail: true });
  const controller = feedback.createBasicFeedbackController(failing);
  controller.setSettings({ sound: true, vibration: true });
  assert.doesNotThrow(() => controller.unlockFromGesture({ isTrusted: true }));
  assert.equal(controller.snapshot().audioUnlocked, false);
  assert.doesNotThrow(() => controller.notify({ eventId: "match-3:2:terminal:A:SURRENDER", cue: "defeat" }));
  assert.deepEqual(controller.notify({ eventId: "match-3:2:terminal:A:SURRENDER", cue: "defeat" }),
    { accepted: false, duplicate: true, sound: false, vibration: false });

  const unsupported = feedback.createBasicFeedbackController({
    storage: memoryStorage(),
    documentRef: { hidden: false, visibilityState: "visible" },
    navigatorRef: { onLine: true },
    globalRef: {},
  });
  unsupported.setSettings({ sound: true, vibration: true });
  assert.equal(unsupported.unlockFromGesture({ isTrusted: true }), false);
  assert.deepEqual(unsupported.notify({ eventId: "match-4:1", cue: "contact-2" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
});

test("event identities and retained history are finite and fail closed", () => {
  const env = environment();
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: false, vibration: false });
  for (const [eventId, cue] of [
    ["", "turn"], ["contains space", "turn"], ["a".repeat(301), "turn"], ["match-5:1", "unknown"],
  ]) assert.deepEqual(controller.notify({ eventId, cue }), { accepted: false, duplicate: false, sound: false, vibration: false });
  for (let index = 0; index < 70; index += 1) controller.notify({ eventId: `match-5:${index}`, cue: "turn" });
  const snapshot = controller.snapshot();
  assert.equal(snapshot.eventIds.length, feedback.EVENT_HISTORY_LIMIT);
  assert.equal(snapshot.eventIds[0], "match-5:6");
  assert.equal(snapshot.eventIds.at(-1), "match-5:69");
  assert.deepEqual(feedback.CUES, ["turn", "contact-2", "contact-3", "contact-4", "victory", "defeat"]);
});
