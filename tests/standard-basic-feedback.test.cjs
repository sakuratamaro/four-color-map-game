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

function audioHarness({ fail = false, resumeRejects = 0, rejectLifecycle = false } = {}) {
  const calls = { contexts: 0, oscillators: 0, starts: 0, stops: 0, resumes: 0, suspends: 0, closes: 0 };
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
    resume() {
      calls.resumes += 1;
      if (calls.resumes <= resumeRejects) return Promise.reject(new Error("RESUME_REJECTED"));
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      calls.suspends += 1;
      this.state = "suspended";
      return rejectLifecycle ? Promise.reject(new Error("SUSPEND_REJECTED")) : Promise.resolve();
    }
    close() {
      calls.closes += 1;
      this.state = "closed";
      return rejectLifecycle ? Promise.reject(new Error("CLOSE_REJECTED")) : Promise.resolve();
    }
  }
  return { globalRef: { AudioContext, setTimeout }, calls };
}

function environment({ storage = memoryStorage(), hidden = false, online = true, audioFail = false, vibrationFail = false, resumeRejects = 0, rejectLifecycle = false } = {}) {
  const audio = audioHarness({ fail: audioFail, resumeRejects, rejectLifecycle });
  const patterns = [];
  let lockTail = Promise.resolve();
  const documentRef = { hidden, visibilityState: hidden ? "hidden" : "visible" };
  const navigatorRef = {
    onLine: online,
    locks: {
      request(_name, _options, callback) {
        const result = lockTail.then(() => callback());
        lockTail = result.catch(() => {});
        return result;
      },
    },
    vibrate(pattern) {
      if (vibrationFail) throw new Error("VIBRATION_DISABLED");
      patterns.push(Array.isArray(pattern) ? [...pattern] : pattern);
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

test("sound is created only by a trusted gesture and every cue is synthesized in code", async () => {
  const env = environment();
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: true });
  assert.equal(controller.snapshot().audioUnlocked, false);
  assert.equal(controller.unlockFromGesture({ isTrusted: false }), false);
  assert.equal(env.calls.contexts, 0);

  assert.equal(controller.unlockFromGesture({ isTrusted: true }), true);
  assert.equal(env.calls.contexts, 1);
  const result = await controller.notify({ eventId: "match-1:4", cue: "contact-3" });
  assert.deepEqual(result, { accepted: true, duplicate: false, sound: true, vibration: true });
  assert.equal(env.calls.oscillators, 3);
  assert.equal(env.calls.starts, 3);
  assert.equal(env.calls.stops, 3);
  assert.deepEqual(env.patterns, [[45, 25, 45, 25, 65]]);

  assert.deepEqual(await controller.notify({ eventId: "match-1:4", cue: "victory" }),
    { accepted: false, duplicate: true, sound: false, vibration: false });
  assert.equal(env.calls.oscillators, 3);
  assert.equal(env.patterns.length, 1);
});

test("hidden, offline, reload, and cross-controller replay are remembered before output", async () => {
  const storage = memoryStorage();
  const env = environment({ storage, hidden: true });
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: true });
  controller.unlockFromGesture({ isTrusted: true });
  assert.deepEqual(await controller.notify({ eventId: "match-2:8", cue: "turn" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
  env.documentRef.hidden = false;
  env.documentRef.visibilityState = "visible";
  assert.equal((await controller.notify({ eventId: "match-2:8", cue: "turn" })).duplicate, true);

  env.navigatorRef.onLine = false;
  assert.deepEqual(await controller.notify({ eventId: "match-2:9", cue: "victory" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
  env.navigatorRef.onLine = true;
  assert.equal((await controller.notify({ eventId: "match-2:9", cue: "victory" })).duplicate, true);
  assert.equal(env.calls.oscillators, 0);
  assert.equal(env.patterns.length, 0);

  const afterReload = feedback.createBasicFeedbackController(environment({ storage }));
  afterReload.setSettings({ sound: true, vibration: true });
  afterReload.unlockFromGesture({ isTrusted: true });
  assert.equal((await afterReload.notify({ eventId: "match-2:8", cue: "turn" })).duplicate, true);
  assert.equal((await afterReload.notify({ eventId: "match-2:9", cue: "victory" })).duplicate, true);
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

test("a rejected resume keeps gesture recovery armed and the next trusted gesture succeeds", async () => {
  const target = gestureTarget();
  const env = environment({ resumeRejects: 1 });
  env.documentRef = { ...env.documentRef, ...target };
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: false });
  target.dispatch("pointerdown", { isTrusted: true });
  assert.equal(controller.snapshot().audioUnlocked, true);

  controller.setSettings({ sound: false, vibration: false });
  controller.setSettings({ sound: true, vibration: false });
  target.dispatch("keydown", { isTrusted: true });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.snapshot().audioUnlocked, false);
  assert.equal(target.listenerCount(), 3);

  target.dispatch("keydown", { isTrusted: true });
  await Promise.resolve();
  assert.equal(controller.snapshot().audioUnlocked, true);
  assert.equal(target.listenerCount(), 0);
  assert.equal(env.calls.resumes, 2);
});

test("turning outputs OFF immediately cancels scheduled sound and active vibration", async () => {
  const env = environment();
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: true });
  controller.unlockFromGesture({ isTrusted: true });
  assert.equal((await controller.notify({ eventId: "match-stop:1", cue: "victory" })).accepted, true);
  const scheduledStops = env.calls.stops;
  assert.ok(scheduledStops > 0);
  controller.setSettings({ sound: false, vibration: false });
  assert.equal(env.calls.stops, scheduledStops * 2);
  assert.equal(env.patterns.at(-1), 0);
});

test("lock serialization elects one presenter and retains simultaneous distinct events", async () => {
  const storage = memoryStorage();
  let lockTail = Promise.resolve();
  const locks = {
    request(_name, _options, callback) {
      const result = lockTail.then(() => callback());
      lockTail = result.catch(() => {});
      return result;
    },
  };
  const first = environment({ storage });
  const second = environment({ storage });
  first.navigatorRef.locks = locks;
  second.navigatorRef.locks = locks;
  const a = feedback.createBasicFeedbackController(first);
  const b = feedback.createBasicFeedbackController(second);

  const same = await Promise.all([
    a.notify({ eventId: "match-lock:same", cue: "turn" }),
    b.notify({ eventId: "match-lock:same", cue: "turn" }),
  ]);
  assert.equal(same.filter((result) => result.accepted).length, 1);
  assert.equal(same.filter((result) => result.duplicate).length, 1);

  const distinct = await Promise.all([
    a.notify({ eventId: "match-lock:a", cue: "turn" }),
    b.notify({ eventId: "match-lock:b", cue: "turn" }),
  ]);
  assert.ok(distinct.every((result) => result.accepted));
  const fresh = feedback.createBasicFeedbackController(environment({ storage }));
  assert.equal((await fresh.notify({ eventId: "match-lock:a", cue: "turn" })).duplicate, true);
  assert.equal((await fresh.notify({ eventId: "match-lock:b", cue: "turn" })).duplicate, true);
});

test("lock holder yields one task so a stale renderer sees the previous claim before remembering", async () => {
  const persisted = new Map();
  const views = [new Map(), new Map()];
  const storageFor = (index) => ({
    getItem(key) { return views[index].has(key) ? views[index].get(key) : null; },
    setItem(key, value) {
      const text = String(value);
      views[index].set(key, text);
      persisted.set(key, text);
    },
    removeItem(key) {
      views[index].delete(key);
      persisted.delete(key);
    },
  });
  const timerFor = (index) => (callback) => setImmediate(() => {
    views[index] = new Map(persisted);
    callback();
  });
  let lockTail = Promise.resolve();
  const locks = {
    request(_name, _options, callback) {
      const result = lockTail.then(() => callback());
      lockTail = result.catch(() => {});
      return result;
    },
  };
  const environments = [0, 1].map((index) => {
    const env = environment({ storage: storageFor(index) });
    env.navigatorRef.locks = locks;
    env.globalRef = { ...env.globalRef, setTimeout: timerFor(index) };
    return env;
  });
  const controllers = environments.map((env) => feedback.createBasicFeedbackController(env));

  const same = await Promise.all(controllers.map((controller) => controller.notify({
    eventId: "match-delayed-visibility:same",
    cue: "turn",
  })));
  assert.equal(same.filter((result) => result.accepted).length, 1);
  assert.equal(same.filter((result) => result.duplicate).length, 1);

  const distinct = await Promise.all([
    controllers[0].notify({ eventId: "match-delayed-visibility:a", cue: "turn" }),
    controllers[1].notify({ eventId: "match-delayed-visibility:b", cue: "turn" }),
  ]);
  assert.ok(distinct.every((result) => result.accepted && !result.duplicate));

  const freshStorage = memoryStorage(Object.fromEntries(persisted));
  const fresh = feedback.createBasicFeedbackController(environment({ storage: freshStorage }));
  assert.equal((await fresh.notify({ eventId: "match-delayed-visibility:a", cue: "turn" })).duplicate, true);
  assert.equal((await fresh.notify({ eventId: "match-delayed-visibility:b", cue: "turn" })).duplicate, true);
});

test("missing or throwing safe task timer consumes a coordinated claim without hanging or presenting", async () => {
  for (const [suffix, timer] of [["missing", undefined], ["throw", () => { throw new Error("TIMER_DISABLED"); }]]) {
    const env = environment();
    env.globalRef = { AudioContext: env.globalRef.AudioContext, ...(timer ? { setTimeout: timer } : {}) };
    const controller = feedback.createBasicFeedbackController(env);
    controller.setSettings({ sound: true, vibration: true });
    controller.unlockFromGesture({ isTrusted: true });
    const eventId = `match-no-timer:${suffix}`;
    assert.deepEqual(await controller.notify({ eventId, cue: "turn" }),
      { accepted: true, duplicate: false, sound: false, vibration: false });
    assert.equal((await controller.notify({ eventId, cue: "turn" })).duplicate, true);
    assert.equal(env.calls.oscillators, 0);
    assert.deepEqual(env.patterns, []);
  }
});

test("destroy during the lock task yield consumes identity without late output", async () => {
  let releaseTimer;
  const env = environment();
  env.globalRef = {
    ...env.globalRef,
    setTimeout(callback) { releaseTimer = callback; },
  };
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: true });
  controller.unlockFromGesture({ isTrusted: true });
  const pending = controller.notify({ eventId: "match-destroyed-yield:1", cue: "victory" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(typeof releaseTimer, "function");
  controller.destroy();
  releaseTimer();
  assert.deepEqual(await pending, { accepted: true, duplicate: false, sound: false, vibration: false });
  assert.equal((await controller.notify({ eventId: "match-destroyed-yield:1", cue: "victory" })).accepted, false);
  const fresh = feedback.createBasicFeedbackController(environment({ storage: env.storage }));
  assert.equal((await fresh.notify({ eventId: "match-destroyed-yield:1", cue: "victory" })).duplicate, true);
  assert.equal(env.calls.oscillators, 0);
  assert.equal(env.patterns.at(-1), 0);
});

test("storage event payload converges stale cross-page histories without write-back ping-pong", () => {
  const key = feedback.EVENT_HISTORY_KEY;
  const encode = (eventIds) => JSON.stringify({ schemaVersion: 1, eventIds });
  const storage = memoryStorage({ [key]: encode(["match-storage-event:local"]) });
  const controller = feedback.createBasicFeedbackController(environment({ storage }));
  let writeBacks = 0;
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (storageKey, value) => {
    if (storageKey === key) writeBacks += 1;
    setItem(storageKey, value);
  };

  storage.values.set(key, encode(["match-storage-event:current"]));
  controller.handleStorageEvent({
    key,
    newValue: encode(["match-storage-event:incoming"]),
  });
  const converged = JSON.parse(storage.getItem(key));
  assert.deepEqual(new Set(converged.eventIds), new Set([
    "match-storage-event:local",
    "match-storage-event:incoming",
    "match-storage-event:current",
  ]));
  assert.equal(converged.eventIds.length, 3);
  assert.equal(writeBacks, 1);

  controller.handleStorageEvent({ key, newValue: encode([...converged.eventIds].reverse()) });
  assert.equal(writeBacks, 1);
});

test("storage event convergence keeps schema v1 bounded and ignores malformed payloads", () => {
  const key = feedback.EVENT_HISTORY_KEY;
  const encode = (eventIds) => JSON.stringify({ schemaVersion: 1, eventIds });
  const localIds = Array.from({ length: feedback.EVENT_HISTORY_LIMIT }, (_, index) => `match-storage-limit:${index}`);
  const storage = memoryStorage({ [key]: encode(localIds) });
  const controller = feedback.createBasicFeedbackController(environment({ storage }));
  storage.values.set(key, encode(["match-storage-limit:current"]));
  controller.handleStorageEvent({ key, newValue: encode(["match-storage-limit:incoming"]) });
  const converged = JSON.parse(storage.getItem(key));
  assert.equal(converged.schemaVersion, 1);
  assert.equal(converged.eventIds.length, feedback.EVENT_HISTORY_LIMIT);
  assert.ok(converged.eventIds.includes("match-storage-limit:incoming"));
  assert.ok(converged.eventIds.includes("match-storage-limit:current"));

  const beforeMalformed = storage.getItem(key);
  controller.handleStorageEvent({ key, newValue: "{malformed" });
  assert.equal(storage.getItem(key), beforeMalformed);
});

test("missing coordination and failed storage safely consume without output", async () => {
  const noLock = environment();
  delete noLock.navigatorRef.locks;
  const unsupported = feedback.createBasicFeedbackController(noLock);
  unsupported.setSettings({ sound: true, vibration: true });
  assert.equal(unsupported.unlockFromGesture({ isTrusted: true }), false);
  assert.deepEqual(await unsupported.notify({ eventId: "match-no-lock:1", cue: "victory" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
  assert.equal((await unsupported.notify({ eventId: "match-no-lock:1", cue: "victory" })).duplicate, true);
  assert.equal(noLock.calls.contexts, 0);
  assert.deepEqual(noLock.patterns, []);

  const brokenStorage = memoryStorage();
  brokenStorage.setItem = () => { throw new Error("STORAGE_DISABLED"); };
  const failed = environment({ storage: brokenStorage });
  const failedController = feedback.createBasicFeedbackController(failed);
  failedController.setSettings({ sound: true, vibration: true });
  failedController.unlockFromGesture({ isTrusted: true });
  assert.deepEqual(await failedController.notify({ eventId: "match-storage-fail:1", cue: "turn" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
  assert.equal((await failedController.notify({ eventId: "match-storage-fail:1", cue: "turn" })).duplicate, true);
  assert.equal(failed.calls.oscillators, 0);
  assert.deepEqual(failed.patterns, []);
});

test("a lock-delayed event cannot refire after settings are enabled", async () => {
  let releaseLock;
  let held = true;
  const env = environment();
  env.navigatorRef.locks = {
    request(_name, _options, callback) {
      if (!held) return callback();
      return new Promise((resolve) => {
        releaseLock = () => { held = false; resolve(callback()); };
      });
    },
  };
  const controller = feedback.createBasicFeedbackController(env);
  const pending = controller.notify({ eventId: "match-delayed:1", cue: "victory" });
  controller.setSettings({ sound: true, vibration: true });
  controller.unlockFromGesture({ isTrusted: true });
  releaseLock();
  assert.deepEqual(await pending, { accepted: true, duplicate: false, sound: false, vibration: false });
  assert.equal(env.calls.oscillators, 0);
  assert.deepEqual(env.patterns, []);
  assert.equal((await controller.notify({ eventId: "match-delayed:1", cue: "victory" })).duplicate, true);
});

test("a late OFF suspend cannot leave a newer ON state falsely unlocked", async () => {
  let settleSuspend;
  let resumeCalls = 0;
  class RacingAudioContext {
    constructor() { this.currentTime = 0; this.destination = {}; this.state = "running"; }
    suspend() {
      return new Promise((resolve) => {
        settleSuspend = () => { this.state = "suspended"; resolve(); };
      });
    }
    resume() { resumeCalls += 1; this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  const target = gestureTarget();
  const env = environment();
  env.globalRef = { AudioContext: RacingAudioContext };
  env.documentRef = { ...env.documentRef, ...target };
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: true, vibration: false });
  target.dispatch("pointerdown", { isTrusted: true });
  assert.equal(controller.snapshot().audioUnlocked, true);
  controller.setSettings({ sound: false, vibration: false });
  controller.setSettings({ sound: true, vibration: false });
  target.dispatch("keydown", { isTrusted: true });
  assert.equal(controller.snapshot().audioUnlocked, true);

  settleSuspend();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.snapshot().audioUnlocked, false);
  assert.equal(target.listenerCount(), 3);
  target.dispatch("keydown", { isTrusted: true });
  await Promise.resolve();
  assert.equal(controller.snapshot().audioUnlocked, true);
  assert.equal(target.listenerCount(), 0);
  assert.equal(resumeCalls, 1);
});

test("rejected suspend, resume, and close promises never become unhandled rejections", async () => {
  const unhandled = [];
  const listener = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", listener);
  try {
    const env = environment({ resumeRejects: 1, rejectLifecycle: true });
    const controller = feedback.createBasicFeedbackController(env);
    controller.setSettings({ sound: true, vibration: false });
    controller.unlockFromGesture({ isTrusted: true });
    controller.setSettings({ sound: false, vibration: false });
    controller.setSettings({ sound: true, vibration: false });
    controller.unlockFromGesture({ isTrusted: true });
    controller.destroy();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.removeListener("unhandledRejection", listener);
  }
});

test("unsupported and failing presentation APIs never escape into gameplay", async () => {
  const storage = memoryStorage();
  const failing = environment({ storage, audioFail: true, vibrationFail: true });
  const controller = feedback.createBasicFeedbackController(failing);
  controller.setSettings({ sound: true, vibration: true });
  assert.doesNotThrow(() => controller.unlockFromGesture({ isTrusted: true }));
  assert.equal(controller.snapshot().audioUnlocked, false);
  await assert.doesNotReject(() => controller.notify({ eventId: "match-3:2:terminal:A:SURRENDER", cue: "defeat" }));
  assert.deepEqual(await controller.notify({ eventId: "match-3:2:terminal:A:SURRENDER", cue: "defeat" }),
    { accepted: false, duplicate: true, sound: false, vibration: false });

  const unsupported = feedback.createBasicFeedbackController({
    storage: memoryStorage(),
    documentRef: { hidden: false, visibilityState: "visible" },
    navigatorRef: { onLine: true },
    globalRef: {},
  });
  unsupported.setSettings({ sound: true, vibration: true });
  assert.equal(unsupported.unlockFromGesture({ isTrusted: true }), false);
  assert.deepEqual(await unsupported.notify({ eventId: "match-4:1", cue: "contact-2" }),
    { accepted: true, duplicate: false, sound: false, vibration: false });
});

test("event identities and retained history are finite and fail closed", async () => {
  const env = environment();
  const controller = feedback.createBasicFeedbackController(env);
  controller.setSettings({ sound: false, vibration: false });
  for (const [eventId, cue] of [
    ["", "turn"], ["contains space", "turn"], ["a".repeat(301), "turn"], ["match-5:1", "unknown"],
  ]) assert.deepEqual(await controller.notify({ eventId, cue }), { accepted: false, duplicate: false, sound: false, vibration: false });
  for (let index = 0; index < 70; index += 1) await controller.notify({ eventId: `match-5:${index}`, cue: "turn" });
  const snapshot = controller.snapshot();
  assert.equal(snapshot.eventIds.length, feedback.EVENT_HISTORY_LIMIT);
  assert.equal(snapshot.eventIds[0], "match-5:6");
  assert.equal(snapshot.eventIds.at(-1), "match-5:69");
  assert.deepEqual(feedback.CUES, ["turn", "contact-2", "contact-3", "contact-4", "victory", "defeat"]);
});
