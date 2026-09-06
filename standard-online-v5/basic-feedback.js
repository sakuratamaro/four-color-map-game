(function universalModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardBasicFeedback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function basicFeedbackFactory() {
  "use strict";

  const VERSION = "standard-basic-feedback-v1";
  const STORAGE_KEY = "fourColorMapGame.standard.online.v5.basic-feedback-settings-v1";
  const EVENT_HISTORY_KEY = "fourColorMapGame.standard.online.v5.basic-feedback-events-v1";
  const EVENT_HISTORY_LOCK = "fourColorMapGame.standard.online.v5.basic-feedback-events-v1.lock";
  const EVENT_HISTORY_LIMIT = 64;
  const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,300}$/;
  const CUES = Object.freeze(["turn", "contact-2", "contact-3", "contact-4", "victory", "defeat"]);
  const CUE_SET = new Set(CUES);
  const CUE_SPECS = Object.freeze({
    turn: Object.freeze({ notes: Object.freeze([[540, 0, 0.08, 0.025]]), vibration: Object.freeze([24]) }),
    "contact-2": Object.freeze({ notes: Object.freeze([[440, 0, 0.09, 0.035], [660, 0.08, 0.12, 0.04]]), vibration: Object.freeze([35, 30, 35]) }),
    "contact-3": Object.freeze({ notes: Object.freeze([[392, 0, 0.08, 0.035], [587, 0.07, 0.1, 0.04], [784, 0.15, 0.14, 0.045]]), vibration: Object.freeze([45, 25, 45, 25, 65]) }),
    "contact-4": Object.freeze({ notes: Object.freeze([[392, 0, 0.16, 0.04], [523, 0, 0.16, 0.035], [784, 0.12, 0.2, 0.045]]), vibration: Object.freeze([65, 30, 65, 30, 110]) }),
    victory: Object.freeze({ notes: Object.freeze([[523, 0, 0.12, 0.04], [659, 0.1, 0.12, 0.04], [784, 0.2, 0.22, 0.05]]), vibration: Object.freeze([35, 25, 35, 25, 90]) }),
    defeat: Object.freeze({ notes: Object.freeze([[330, 0, 0.16, 0.035], [247, 0.14, 0.24, 0.04]]), vibration: Object.freeze([110, 45, 70]) }),
  });

  function normalizedSettings(value) {
    return Object.freeze({
      schemaVersion: 1,
      sound: value?.schemaVersion === 1 && value.sound === true,
      vibration: value?.schemaVersion === 1 && value.vibration === true,
    });
  }

  function validEventId(value) {
    return typeof value === "string" && EVENT_ID_PATTERN.test(value);
  }

  function createBasicFeedbackController({ storage, documentRef, navigatorRef, globalRef } = {}) {
    const safeStorage = storage || null;
    const safeDocument = documentRef || null;
    const safeNavigator = navigatorRef || null;
    const safeGlobal = globalRef || (typeof globalThis !== "undefined" ? globalThis : null);
    let settings = readSettings();
    let eventHistory = readHistory();
    let audioContext = null;
    let audioUnlocked = false;
    let destroyed = false;
    let controls = null;
    let gestureTarget = null;
    let audioAttempt = 0;
    let outputRevision = 0;
    const activeOscillators = new Set();

    function readJson(key) {
      try { return JSON.parse(safeStorage?.getItem?.(key) || "null"); }
      catch { return null; }
    }

    function writeJson(key, value) {
      try { safeStorage?.setItem?.(key, JSON.stringify(value)); return true; }
      catch { return false; }
    }

    function observeOptionalPromise(value, onFulfilled, onRejected) {
      try {
        if (!value || typeof value.then !== "function") {
          try { onFulfilled?.(); } catch { /* presentation callback */ }
          return;
        }
        Promise.resolve(value).then(
          () => { try { onFulfilled?.(); } catch { /* presentation callback */ } },
          () => { try { onRejected?.(); } catch { /* presentation callback */ } },
        ).catch(() => {});
      } catch {
        try { onRejected?.(); } catch { /* presentation callback */ }
      }
    }

    function readSettings() {
      return normalizedSettings(readJson(STORAGE_KEY));
    }

    function readHistory() {
      const stored = readJson(EVENT_HISTORY_KEY);
      if (stored?.schemaVersion !== 1 || !Array.isArray(stored.eventIds)) return [];
      const result = [];
      const seen = new Set();
      for (const eventId of stored.eventIds.slice(-EVENT_HISTORY_LIMIT)) {
        if (validEventId(eventId) && !seen.has(eventId)) { seen.add(eventId); result.push(eventId); }
      }
      return result;
    }

    function vibrationSupported() {
      return typeof safeNavigator?.vibrate === "function";
    }

    function coordinationSupported() {
      return typeof safeNavigator?.locks?.request === "function";
    }

    function audioSupported() {
      return typeof (safeGlobal?.AudioContext || safeGlobal?.webkitAudioContext) === "function";
    }

    function statusText() {
      const soundState = !settings.sound ? "効果音 OFF"
        : !audioSupported() || !coordinationSupported() ? "効果音 ON（このブラウザーは非対応）"
        : audioUnlocked ? "効果音 ON" : "効果音 ON（次の操作で有効）";
      const vibrationState = !settings.vibration ? "振動 OFF"
        : vibrationSupported() && coordinationSupported() ? "振動 ON" : "振動 ON（この端末は非対応）";
      return `${soundState}｜${vibrationState}`;
    }

    function renderControls() {
      if (!controls) return;
      controls.soundInput.checked = settings.sound;
      controls.vibrationInput.checked = settings.vibration;
      controls.status.textContent = statusText();
    }

    function stopActiveSound() {
      for (const oscillator of activeOscillators) {
        try { oscillator.stop(0); } catch { /* already stopped or unavailable */ }
        try { oscillator.disconnect?.(); } catch { /* optional presentation API */ }
      }
      activeOscillators.clear();
    }

    function stopVibration() {
      if (!vibrationSupported()) return;
      try { safeNavigator.vibrate(0); } catch { /* optional presentation API */ }
    }

    function suspendSoundContext() {
      const context = audioContext;
      if (!context || typeof context.suspend !== "function") return;
      try {
        observeOptionalPromise(context.suspend(), () => {
          if (!destroyed && settings.sound && context === audioContext && context.state === "suspended") {
            audioUnlocked = false;
            installGestureUnlock(safeDocument);
            renderControls();
          }
        });
      } catch { /* optional presentation API */ }
    }

    function setSettings(next) {
      const previous = settings;
      settings = normalizedSettings({ schemaVersion: 1, sound: next?.sound === true, vibration: next?.vibration === true });
      outputRevision += 1;
      writeJson(STORAGE_KEY, settings);
      if (!settings.sound) {
        audioAttempt += 1;
        audioUnlocked = false;
        stopActiveSound();
        suspendSoundContext();
      } else if (!audioUnlocked) installGestureUnlock(safeDocument);
      if (previous.vibration && !settings.vibration) stopVibration();
      renderControls();
      return settings;
    }

    function finishAudioUnlock() {
      audioUnlocked = Boolean(settings.sound && audioContext && audioContext.state !== "suspended" && audioContext.state !== "closed");
      renderControls();
      return audioUnlocked;
    }

    function unlockFromGesture(event) {
      if (destroyed || !settings.sound || event?.isTrusted !== true || !audioSupported() || !coordinationSupported()) return false;
      const attempt = ++audioAttempt;
      try {
        const AudioContextClass = safeGlobal.AudioContext || safeGlobal.webkitAudioContext;
        if (!audioContext || audioContext.state === "closed") audioContext = new AudioContextClass();
        if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
          const context = audioContext;
          const resumed = audioContext.resume();
          observeOptionalPromise(resumed, () => {
            if (destroyed || !settings.sound || context !== audioContext || attempt !== audioAttempt) return;
            if (finishAudioUnlock()) removeGestureListeners();
            else installGestureUnlock(safeDocument);
          }, () => {
            if (destroyed || !settings.sound || context !== audioContext || attempt !== audioAttempt) return;
            audioUnlocked = false;
            installGestureUnlock(safeDocument);
            renderControls();
          });
        }
        finishAudioUnlock();
        if (audioUnlocked) removeGestureListeners();
        return audioUnlocked;
      } catch {
        audioContext = null;
        audioUnlocked = false;
        renderControls();
        return false;
      }
    }

    function onGesture(event) {
      unlockFromGesture(event);
    }

    function installGestureUnlock(target = safeDocument) {
      if (!target?.addEventListener || gestureTarget) return false;
      gestureTarget = target;
      for (const type of ["pointerdown", "keydown", "touchstart"]) gestureTarget.addEventListener(type, onGesture, { capture: true, passive: type !== "keydown" });
      return true;
    }

    function removeGestureListeners() {
      if (!gestureTarget?.removeEventListener) return;
      for (const type of ["pointerdown", "keydown", "touchstart"]) gestureTarget.removeEventListener(type, onGesture, true);
      gestureTarget = null;
    }

    function refreshHistory() {
      const persisted = readHistory();
      eventHistory = [...new Set([...eventHistory, ...persisted])].slice(-EVENT_HISTORY_LIMIT);
    }

    function remember(eventId) {
      refreshHistory();
      if (eventHistory.includes(eventId)) return Object.freeze({ claimed: false, duplicate: true });
      eventHistory = [...eventHistory, eventId].slice(-EVENT_HISTORY_LIMIT);
      return Object.freeze({
        claimed: writeJson(EVENT_HISTORY_KEY, { schemaVersion: 1, eventIds: eventHistory }),
        duplicate: false,
      });
    }

    async function claimEvent(eventId) {
      const requestLock = safeNavigator?.locks?.request;
      if (typeof requestLock === "function") {
        try {
          return await requestLock.call(safeNavigator.locks, EVENT_HISTORY_LOCK, { mode: "exclusive" }, () => remember(eventId));
        } catch { /* unsupported, denied, or interrupted lock service: consume without output */ }
      }
      const local = remember(eventId);
      return Object.freeze({ claimed: false, duplicate: local.duplicate });
    }

    function presentationAllowed() {
      return safeDocument?.hidden !== true
        && safeDocument?.visibilityState !== "hidden"
        && safeNavigator?.onLine !== false;
    }

    function playSound(cue) {
      if (!settings.sound || !audioUnlocked || !audioContext || audioContext.state === "suspended" || audioContext.state === "closed") return false;
      try {
        const startAt = Number(audioContext.currentTime) || 0;
        for (const [frequency, offset, duration, volume] of CUE_SPECS[cue].notes) {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          activeOscillators.add(oscillator);
          const forgetOscillator = () => {
            activeOscillators.delete(oscillator);
            try { oscillator.disconnect?.(); } catch { /* optional presentation API */ }
          };
          try {
            if (typeof oscillator.addEventListener === "function") oscillator.addEventListener("ended", forgetOscillator, { once: true });
            else oscillator.onended = forgetOscillator;
          } catch { /* optional presentation API */ }
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, startAt + offset);
          gain.gain.setValueAtTime(0.0001, startAt + offset);
          gain.gain.exponentialRampToValueAtTime(volume, startAt + offset + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + duration);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(startAt + offset);
          oscillator.stop(startAt + offset + duration + 0.02);
        }
        return true;
      } catch { return false; }
    }

    function vibrate(cue) {
      if (!settings.vibration || !vibrationSupported()) return false;
      try { return safeNavigator.vibrate([...CUE_SPECS[cue].vibration]) !== false; }
      catch { return false; }
    }

    async function notify({ eventId, cue } = {}) {
      const rejected = Object.freeze({ accepted: false, duplicate: false, sound: false, vibration: false });
      try {
        if (destroyed || !validEventId(eventId) || !CUE_SET.has(cue)) return rejected;
        const dispatchRevision = outputRevision;
        const dispatchAllowed = presentationAllowed();
        const dispatchSound = settings.sound && audioUnlocked;
        const dispatchVibration = settings.vibration;
        const claim = await claimEvent(eventId);
        if (claim.duplicate) return Object.freeze({ accepted: false, duplicate: true, sound: false, vibration: false });
        if (!claim.claimed) return Object.freeze({ accepted: true, duplicate: false, sound: false, vibration: false });
        if (destroyed || dispatchRevision !== outputRevision || !dispatchAllowed || !presentationAllowed()) {
          return Object.freeze({ accepted: true, duplicate: false, sound: false, vibration: false });
        }
        return Object.freeze({
          accepted: true,
          duplicate: false,
          sound: dispatchSound ? playSound(cue) : false,
          vibration: dispatchVibration ? vibrate(cue) : false,
        });
      } catch { return rejected; }
    }

    function bindControls({ soundInput, vibrationInput, status } = {}) {
      if (!soundInput?.addEventListener || !vibrationInput?.addEventListener || !status) return false;
      const soundChange = (event) => {
        setSettings({ sound: soundInput.checked, vibration: vibrationInput.checked });
        if (soundInput.checked) unlockFromGesture(event);
      };
      const vibrationChange = () => setSettings({ sound: soundInput.checked, vibration: vibrationInput.checked });
      soundInput.addEventListener("change", soundChange);
      vibrationInput.addEventListener("change", vibrationChange);
      controls = { soundInput, vibrationInput, status, soundChange, vibrationChange };
      renderControls();
      return true;
    }

    function reloadSettings() {
      settings = readSettings();
      outputRevision += 1;
      if (!settings.sound) {
        audioAttempt += 1;
        audioUnlocked = false;
        stopActiveSound();
        suspendSoundContext();
      } else if (!audioUnlocked) installGestureUnlock(safeDocument);
      if (!settings.vibration) stopVibration();
      renderControls();
      return settings;
    }

    function handleStorageEvent(event) {
      if (event?.key === STORAGE_KEY) reloadSettings();
      else if (event?.key === EVENT_HISTORY_KEY) refreshHistory();
    }

    function snapshot() {
      refreshHistory();
      return Object.freeze({ settings, audioUnlocked, audioSupported: audioSupported(), vibrationSupported: vibrationSupported(), eventIds: Object.freeze([...eventHistory]) });
    }

    function destroy() {
      destroyed = true;
      audioAttempt += 1;
      removeGestureListeners();
      if (controls) {
        controls.soundInput.removeEventListener("change", controls.soundChange);
        controls.vibrationInput.removeEventListener("change", controls.vibrationChange);
        controls = null;
      }
      stopActiveSound();
      stopVibration();
      try { observeOptionalPromise(audioContext?.close?.()); } catch { /* optional presentation API */ }
      audioContext = null;
      audioUnlocked = false;
    }

    return Object.freeze({ VERSION, bindControls, destroy, handleStorageEvent, installGestureUnlock, notify, reloadSettings, setSettings, snapshot, unlockFromGesture });
  }

  return Object.freeze({ VERSION, STORAGE_KEY, EVENT_HISTORY_KEY, EVENT_HISTORY_LOCK, EVENT_HISTORY_LIMIT, CUES, createBasicFeedbackController, normalizedSettings, validEventId });
});
