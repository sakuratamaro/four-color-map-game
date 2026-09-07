(function initStandardCpuPortraits(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardCpuPortraits = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardCpuPortraitsFactory() {
  "use strict";

  const VERSION = "standard-cpu-portraits-v2";
  const ATLAS_URL = "assets/cpu-portraits/cpu-portrait-atlas.png";
  const ATLAS_GRID = Object.freeze({ columns: 4, rows: 3, cellWidth: 362, cellHeight: 362, width: 1448, height: 1086 });
  const LOSS_REASONS = Object.freeze(["ILLEGAL_COLOR", "BOARD_LOCK", "SURRENDER", "SEALED_OUT", "NO_LEGAL_COLOR"]);
  const definitions = {
    yuzu: { cell: 1, column: 0, row: 0 },
    ren: { cell: 2, column: 1, row: 0 },
    minato: { cell: 3, column: 2, row: 0 },
    koharu: { cell: 4, column: 3, row: 0 },
    aoi: { cell: 5, column: 0, row: 1 },
    kai: { cell: 6, column: 1, row: 1 },
    tsubasa: { cell: 7, column: 2, row: 1 },
    shion: { cell: 8, column: 3, row: 1 },
    rei: { cell: 9, column: 0, row: 2 },
    kurogane: { cell: 10, column: 1, row: 2 },
  };
  const CPU_PORTRAITS = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [id, Object.freeze({ ...definition })])));
  const CPU_CHARACTER_IDS = Object.freeze(Object.keys(CPU_PORTRAITS));

  function selectCpuPortrait({ characterId, mode = "normal", reason = null } = {}) {
    const definition = CPU_PORTRAITS[characterId];
    if (!definition || !["normal", "loss"].includes(mode)) return null;
    const loss = mode === "loss" && LOSS_REASONS.includes(reason);
    return Object.freeze({
      characterId,
      cell: definition.cell,
      column: definition.column,
      row: definition.row,
      x: `${definition.column * (100 / (ATLAS_GRID.columns - 1))}%`,
      y: `${definition.row * (100 / (ATLAS_GRID.rows - 1))}%`,
      mode: loss ? "loss" : "normal",
      reason: loss ? reason : null,
      key: `${characterId}:${loss ? reason : "normal"}`,
    });
  }

  function createCpuPortraitPresenter({ ImageCtor = typeof Image === "function" ? Image : null } = {}) {
    const bindings = new Map();
    let atlasProbe = null;
    let atlasState = "idle";

    function reflect(binding) {
      const ready = atlasState === "ready";
      binding.art.hidden = !ready;
      binding.fallback.hidden = ready;
      binding.frame.dataset.portraitStatus = atlasState;
    }

    function reflectAll() {
      for (const binding of bindings.values()) reflect(binding);
    }

    function ensureAtlas() {
      if (atlasState !== "idle") return atlasState;
      if (typeof ImageCtor !== "function") {
        atlasState = "error";
        reflectAll();
        return atlasState;
      }
      atlasState = "loading";
      reflectAll();
      const probe = new ImageCtor();
      atlasProbe = probe;
      probe.onload = () => {
        if (atlasProbe !== probe) return;
        atlasState = "ready";
        reflectAll();
      };
      probe.onerror = () => {
        if (atlasProbe !== probe) return;
        atlasState = "error";
        reflectAll();
      };
      probe.src = ATLAS_URL;
      return atlasState;
    }

    function clearCpuPortrait({ frame, art, fallback } = {}) {
      if (!frame || !art || !fallback) return;
      bindings.delete(frame);
      for (const key of ["portraitKey", "portraitMode", "portraitReason", "portraitStatus"]) delete frame.dataset[key];
      art.style.removeProperty("--cpu-portrait-x");
      art.style.removeProperty("--cpu-portrait-y");
      art.hidden = true;
      fallback.hidden = false;
    }

    function showCpuPortrait({ frame, art, fallback, characterId, mode = "normal", reason = null } = {}) {
      if (!frame || !art || !fallback) return null;
      const selection = selectCpuPortrait({ characterId, mode, reason });
      if (!selection) {
        clearCpuPortrait({ frame, art, fallback });
        return null;
      }
      frame.dataset.portraitKey = selection.key;
      frame.dataset.portraitMode = selection.mode;
      if (selection.reason) frame.dataset.portraitReason = selection.reason;
      else delete frame.dataset.portraitReason;
      art.style.setProperty("--cpu-portrait-x", selection.x);
      art.style.setProperty("--cpu-portrait-y", selection.y);
      const binding = { frame, art, fallback, selection };
      bindings.set(frame, binding);
      reflect(binding);
      ensureAtlas();
      return selection;
    }

    return Object.freeze({ clearCpuPortrait, getAtlasState: () => atlasState, showCpuPortrait });
  }

  const defaultPresenter = createCpuPortraitPresenter();
  return Object.freeze({
    ATLAS_GRID,
    ATLAS_URL,
    CPU_CHARACTER_IDS,
    CPU_PORTRAITS,
    LOSS_REASONS,
    VERSION,
    clearCpuPortrait: defaultPresenter.clearCpuPortrait,
    createCpuPortraitPresenter,
    getAtlasState: defaultPresenter.getAtlasState,
    selectCpuPortrait,
    showCpuPortrait: defaultPresenter.showCpuPortrait,
  });
});
