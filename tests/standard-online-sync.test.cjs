"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DEGRADED_FALLBACK_MS,
  FALLBACK_MS,
  INVALIDATION_DEBOUNCE_MS,
  createStandardOnlineSync,
} = require("../standard-online-v5/standard-online-sync.js");

const ROOM_ID = "11111111-1111-4111-8111-111111111111";

function timerFixture() {
  const timers = [];
  return {
    timers,
    setTimer(callback, delay) {
      const timer = { callback, delay, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) { timer.cancelled = true; },
    active() { return timers.filter((timer) => !timer.cancelled); },
    async run(timer) { timer.cancelled = true; return timer.callback(); },
  };
}

test("Realtime invalidations coalesce and fallback polling follows room state", async () => {
  const clock = timerFixture();
  const events = {};
  let status = "playing";
  let refreshes = 0;
  const sync = createStandardOnlineSync({
    refreshRoom: async () => { refreshes += 1; },
    subscribeRoom: async (_roomId, handlers) => { Object.assign(events, handlers); handlers.onStatus("SUBSCRIBED"); return () => {}; },
    getRoomStatus: () => status,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  await sync.start(ROOM_ID);
  assert.equal(refreshes, 1);
  assert.deepEqual(clock.active().map((timer) => timer.delay), [FALLBACK_MS.playing]);

  events.onInvalidate();
  events.onInvalidate();
  events.onInvalidate();
  assert.deepEqual(clock.active().map((timer) => timer.delay), [INVALIDATION_DEBOUNCE_MS]);
  await clock.run(clock.active()[0]);
  assert.equal(refreshes, 2);

  status = "finished";
  await sync.refreshNow();
  assert.deepEqual(clock.active().map((timer) => timer.delay), [FALLBACK_MS.finished]);
});

test("hidden pages stop timers and refresh immediately after becoming visible", async () => {
  const clock = timerFixture();
  let visible = true;
  let refreshes = 0;
  const sync = createStandardOnlineSync({
    refreshRoom: async () => { refreshes += 1; },
    subscribeRoom: async (_roomId, handlers) => { handlers.onStatus("SUBSCRIBED"); return () => {}; },
    getRoomStatus: () => "waiting",
    isVisible: () => visible,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  await sync.start(ROOM_ID);
  visible = false;
  sync.handleVisibilityChange();
  assert.equal(clock.active().length, 0);
  sync.invalidate();
  assert.equal(clock.active().length, 0);

  visible = true;
  sync.handleVisibilityChange();
  assert.deepEqual(clock.active().map((timer) => timer.delay), [INVALIDATION_DEBOUNCE_MS]);
  await clock.run(clock.active()[0]);
  assert.equal(refreshes, 2);
});

test("missed Realtime events recover through fallback and stop removes the subscription", async () => {
  const clock = timerFixture();
  let refreshes = 0;
  let unsubscribed = 0;
  const states = [];
  const sync = createStandardOnlineSync({
    refreshRoom: async () => { refreshes += 1; },
    subscribeRoom: async (_roomId, handlers) => {
      handlers.onStatus("CHANNEL_ERROR");
      return () => { unsubscribed += 1; };
    },
    getRoomStatus: () => "ready",
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onConnectionState: (state) => states.push(state),
  });

  await sync.start(ROOM_ID);
  assert.ok(states.includes("degraded"));
  assert.deepEqual(clock.active().map((timer) => timer.delay), [DEGRADED_FALLBACK_MS]);
  await clock.run(clock.active()[0]);
  assert.equal(refreshes, 2);
  sync.stop();
  assert.equal(unsubscribed, 1);
  assert.equal(clock.active().length, 0);
});

test("offline mode stops fallback reads and reconnect coalesces into one prompt refresh", async () => {
  const clock = timerFixture();
  let online = true;
  let refreshes = 0;
  const sync = createStandardOnlineSync({
    refreshRoom: async () => { refreshes += 1; },
    subscribeRoom: async (_roomId, handlers) => { handlers.onStatus("SUBSCRIBED"); return () => {}; },
    getRoomStatus: () => "playing",
    isOnline: () => online,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  await sync.start(ROOM_ID);
  online = false;
  sync.handleConnectivityChange();
  assert.equal(clock.active().length, 0);
  online = true;
  sync.handleConnectivityChange();
  sync.invalidate();
  assert.deepEqual(clock.active().map((timer) => timer.delay), [INVALIDATION_DEBOUNCE_MS]);
  await clock.run(clock.active()[0]);
  assert.equal(refreshes, 2);
});

test("a stale refresh from a previous room generation cannot schedule over the new room", async () => {
  const clock = timerFixture();
  const resolvers = [];
  const refreshedRooms = [];
  let subscriptionStops = 0;
  const sync = createStandardOnlineSync({
    refreshRoom: (_reason, roomId) => new Promise((resolve) => {
      refreshedRooms.push(roomId);
      resolvers.push(resolve);
    }),
    subscribeRoom: async () => () => { subscriptionStops += 1; },
    getRoomStatus: () => "playing",
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  const roomA = sync.start("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await Promise.resolve();
  const roomB = sync.start("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(refreshedRooms, ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
  resolvers[0]();
  await roomA;
  assert.equal(clock.active().length, 0);
  resolvers[1]();
  await roomB;
  assert.deepEqual(clock.active().map((timer) => timer.delay), [DEGRADED_FALLBACK_MS]);
  assert.equal(subscriptionStops, 1);
});
