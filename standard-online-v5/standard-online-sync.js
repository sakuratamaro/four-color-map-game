(function initStandardOnlineSync(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardOnlineSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardOnlineSyncFactory() {
  "use strict";

  const FALLBACK_MS = Object.freeze({
    waiting: 30000,
    ready: 15000,
    playing: 15000,
    finished: 30000,
  });
  const DEGRADED_FALLBACK_MS = 4000;
  const INVALIDATION_DEBOUNCE_MS = 250;

  function createStandardOnlineSync({
    refreshRoom,
    subscribeRoom,
    getRoomStatus,
    isVisible = () => true,
    isOnline = () => true,
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(timer),
    onConnectionState = () => {},
  }) {
    if (typeof refreshRoom !== "function" || typeof subscribeRoom !== "function" || typeof getRoomStatus !== "function") {
      throw new Error("INVALID_STANDARD_ONLINE_SYNC_OPTIONS");
    }

    let active = false;
    let generation = 0;
    let roomId = null;
    let timer = null;
    let inFlight = null;
    let pendingRefresh = false;
    let unsubscribe = null;
    let realtimeHealthy = false;

    function cancelTimer() {
      if (timer !== null) clearTimer(timer);
      timer = null;
    }

    function fallbackDelay() {
      if (!realtimeHealthy) return DEGRADED_FALLBACK_MS;
      return FALLBACK_MS[getRoomStatus()] || FALLBACK_MS.waiting;
    }

    function schedule(delay) {
      if (!active || !isVisible() || !isOnline()) return;
      cancelTimer();
      timer = setTimer(() => {
        timer = null;
        return refreshNow("fallback").catch(() => {});
      }, delay);
    }

    async function refreshNow(reason = "manual") {
      if (!active) return null;
      if (!isVisible() || !isOnline()) {
        pendingRefresh = true;
        return null;
      }
      if (inFlight?.generation === generation) {
        pendingRefresh = true;
        return inFlight.promise;
      }

      cancelTimer();
      const refreshGeneration = generation;
      const refreshRoomId = roomId;
      let refreshPromise;
      refreshPromise = Promise.resolve()
        .then(() => refreshRoom(reason, refreshRoomId))
        .then((result) => {
          onConnectionState("connected");
          return result;
        })
        .catch((error) => {
          onConnectionState("degraded", error);
          throw error;
        })
        .finally(() => {
          if (inFlight?.promise === refreshPromise) inFlight = null;
          if (!active || generation !== refreshGeneration) return;
          if (!isVisible() || !isOnline()) {
            pendingRefresh = true;
            return;
          }
          if (pendingRefresh) {
            pendingRefresh = false;
            schedule(0);
          } else {
            schedule(fallbackDelay());
          }
        });
      inFlight = { generation: refreshGeneration, promise: refreshPromise };
      return refreshPromise;
    }

    function invalidate() {
      if (!active) return;
      pendingRefresh = true;
      if (!isVisible() || !isOnline() || inFlight?.generation === generation) return;
      pendingRefresh = false;
      schedule(INVALIDATION_DEBOUNCE_MS);
    }

    function handleSubscriptionStatus(status) {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        realtimeHealthy = true;
        onConnectionState("realtime");
        invalidate();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        realtimeHealthy = false;
        onConnectionState("degraded", new Error(`REALTIME_${status}`));
        schedule(DEGRADED_FALLBACK_MS);
      }
    }

    async function start(nextRoomId) {
      stop();
      active = true;
      roomId = nextRoomId;
      realtimeHealthy = false;
      const startGeneration = generation;
      try {
        const stopSubscription = await subscribeRoom(roomId, {
          onInvalidate: invalidate,
          onStatus: handleSubscriptionStatus,
        });
        if (!active || generation !== startGeneration) {
          if (typeof stopSubscription === "function") stopSubscription();
        } else {
          unsubscribe = typeof stopSubscription === "function" ? stopSubscription : null;
        }
      } catch (error) {
        onConnectionState("degraded", error);
      }
      return refreshNow("start");
    }

    function handleVisibilityChange() {
      if (!active) return;
      if (!isVisible() || !isOnline()) {
        cancelTimer();
        pendingRefresh = true;
      } else {
        invalidate();
      }
    }

    function handleConnectivityChange() {
      if (!active) return;
      if (!isOnline()) {
        realtimeHealthy = false;
        cancelTimer();
        pendingRefresh = true;
        onConnectionState("offline");
      } else {
        realtimeHealthy = false;
        invalidate();
      }
    }

    function stop() {
      active = false;
      generation += 1;
      roomId = null;
      pendingRefresh = false;
      realtimeHealthy = false;
      cancelTimer();
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
    }

    return Object.freeze({
      handleConnectivityChange,
      handleVisibilityChange,
      invalidate,
      refreshNow,
      start,
      stop,
      snapshot: () => Object.freeze({ active, roomId, pendingRefresh, realtimeHealthy, refreshInFlight: inFlight?.generation === generation }),
    });
  }

  return Object.freeze({ DEGRADED_FALLBACK_MS, FALLBACK_MS, INVALIDATION_DEBOUNCE_MS, createStandardOnlineSync });
});
