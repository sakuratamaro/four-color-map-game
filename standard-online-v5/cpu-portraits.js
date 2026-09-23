(function initStandardCpuPortraits(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardCpuPortraits = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardCpuPortraitsFactory() {
  "use strict";

  const VERSION = "standard-cpu-portraits-v3";
  const ASSET_BASE = "assets/cpu-portraits/wataokiba/";
  const LOSS_REASONS = Object.freeze(["ILLEGAL_COLOR", "BOARD_LOCK", "SURRENDER", "SEALED_OUT", "NO_LEGAL_COLOR"]);
  // Original canvas and CSS face box. Original hashes and provenance live beside the PNGs.
  const definitions = {
    yuzu: { width: 500, height: 1100, face: [173, 40, 215] },
    ren: { width: 300, height: 1150, face: [30, 0, 235] },
    minato: { width: 400, height: 1200, face: [50, 0, 250] },
    koharu: { width: 400, height: 1100, face: [120, 0, 240] },
    aoi: { width: 500, height: 1150, face: [120, 0, 260] },
    kai: { width: 500, height: 1250, face: [135, 0, 260] },
    tsubasa: { width: 570, height: 1300, face: [100, 0, 300] },
    shion: { width: 790, height: 1260, face: [180, 0, 310] },
    rei: { width: 400, height: 1300, face: [55, 0, 265] },
    kurogane: { width: 400, height: 1200, face: [70, 0, 260] },
  };
  const CPU_PORTRAITS = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id, d]) => [id,
    Object.freeze({ ...d, face: Object.freeze(d.face) })])));
  const CPU_CHARACTER_IDS = Object.freeze(Object.keys(CPU_PORTRAITS));

  function selectCpuPortrait({ characterId, mode = "normal", reason = null, view = "face" } = {}) {
    if (!Object.hasOwn(CPU_PORTRAITS, characterId) || !["normal", "loss"].includes(mode) || !["face", "full"].includes(view)) return null;
    const definition = CPU_PORTRAITS[characterId];
    const loss = mode === "loss" && LOSS_REASONS.includes(reason);
    const full = loss && view === "full";
    const [x, y, size] = definition.face;
    return Object.freeze({
      characterId,
      url: ASSET_BASE + characterId + "-" + (loss ? "loss" : "normal") + ".png",
      x: full ? "50%" : (100 * x / (definition.width - size)) + "%",
      y: full ? "100%" : (100 * y / (definition.height - size)) + "%",
      size: full ? "contain" : (100 * definition.width / size) + "% " + (100 * definition.height / size) + "%",
      mode: loss ? "loss" : "normal",
      view: full ? "full" : "face",
      reason: loss ? reason : null,
      key: characterId + ":" + (loss ? reason : "normal"),
    });
  }

  function createCpuPortraitPresenter({ ImageCtor = typeof Image === "function" ? Image : null } = {}) {
    const bindings = new Map();
    const assets = new Map();

    function reflect(binding) {
      const state = assets.get(binding.selection.url)?.state || "idle";
      binding.art.hidden = state !== "ready";
      binding.fallback.hidden = state === "ready";
      binding.frame.dataset.portraitStatus = state;
    }

    function reflectAsset(url) {
      // Only current bindings: an old request must not revive a cleared or different CPU.
      for (const binding of bindings.values()) if (binding.selection.url === url) reflect(binding);
    }

    function ensureAsset(url) {
      if (assets.has(url)) return;
      const entry = { state: "loading", probe: null };
      assets.set(url, entry);
      const settle = (state) => {
        if (entry.state !== "loading") return;
        entry.state = state;
        reflectAsset(url);
      };
      reflectAsset(url);
      try {
        if (typeof ImageCtor !== "function") { settle("error"); return; }
        const probe = new ImageCtor();
        entry.probe = probe;
        probe.onload = () => settle("ready");
        probe.onerror = () => settle("error");
        probe.src = url;
      } catch { settle("error"); }
    }

    function clearCpuPortrait({ frame, art, fallback } = {}) {
      if (!frame || !art || !fallback) return;
      bindings.delete(frame);
      for (const key of ["portraitKey", "portraitMode", "portraitReason", "portraitStatus", "portraitView"]) delete frame.dataset[key];
      for (const key of ["image", "x", "y", "size"]) art.style.removeProperty("--cpu-portrait-" + key);
      art.hidden = true;
      fallback.hidden = false;
    }

    function showCpuPortrait({ frame, art, fallback, characterId, mode = "normal", reason = null, view = "face" } = {}) {
      if (!frame || !art || !fallback) return null;
      const selection = selectCpuPortrait({ characterId, mode, reason, view });
      if (!selection) { clearCpuPortrait({ frame, art, fallback }); return null; }
      frame.dataset.portraitKey = selection.key;
      frame.dataset.portraitMode = selection.mode;
      frame.dataset.portraitView = selection.view;
      if (selection.reason) frame.dataset.portraitReason = selection.reason;
      else delete frame.dataset.portraitReason;
      art.style.setProperty("--cpu-portrait-image", 'url("' + selection.url + '")');
      art.style.setProperty("--cpu-portrait-x", selection.x);
      art.style.setProperty("--cpu-portrait-y", selection.y);
      art.style.setProperty("--cpu-portrait-size", selection.size);
      const binding = { frame, art, fallback, selection };
      bindings.set(frame, binding);
      reflect(binding);
      ensureAsset(selection.url);
      return selection;
    }

    return Object.freeze({ clearCpuPortrait, showCpuPortrait });
  }

  const defaultPresenter = createCpuPortraitPresenter();
  return Object.freeze({
    ASSET_BASE, CPU_CHARACTER_IDS, CPU_PORTRAITS, LOSS_REASONS, VERSION,
    clearCpuPortrait: defaultPresenter.clearCpuPortrait,
    createCpuPortraitPresenter, selectCpuPortrait,
    showCpuPortrait: defaultPresenter.showCpuPortrait,
  });
});
