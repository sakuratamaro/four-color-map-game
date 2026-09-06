(function initStandardCpuPortraits(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardCpuPortraits = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardCpuPortraitsFactory() {
  "use strict";

  const VERSION = "standard-cpu-portraits-v1";
  const ASSET_BASE = "assets/cpu-portraits";
  const LOSS_REASONS = Object.freeze(["ILLEGAL_COLOR", "BOARD_LOCK", "SURRENDER", "SEALED_OUT", "NO_LEGAL_COLOR"]);
  const definitions = {
    yuzu: { normal: "yuzu-g.webp", loss: { ILLEGAL_COLOR: "yuzu-b.webp", BOARD_LOCK: "yuzu-d.webp", SURRENDER: "yuzu-e.webp", SEALED_OUT: "yuzu-f.webp", NO_LEGAL_COLOR: "yuzu-d.webp" } },
    ren: { normal: "ren-c.webp", loss: { ILLEGAL_COLOR: "ren-b.webp", BOARD_LOCK: "ren-a.webp", SURRENDER: "ren-f.webp", SEALED_OUT: "ren-d.webp", NO_LEGAL_COLOR: "ren-d.webp" } },
    minato: { normal: "minato-a.webp", loss: { ILLEGAL_COLOR: "minato-f.webp", BOARD_LOCK: "minato-c.webp", SURRENDER: "minato-e.webp", SEALED_OUT: "minato-e.webp", NO_LEGAL_COLOR: "minato-c.webp" } },
    koharu: { normal: "koharu-a.webp", loss: { ILLEGAL_COLOR: "koharu-d.webp", BOARD_LOCK: "koharu-c.webp", SURRENDER: "koharu-e.webp", SEALED_OUT: "koharu-f.webp", NO_LEGAL_COLOR: "koharu-c.webp" } },
    aoi: { normal: "aoi-a.webp", loss: { ILLEGAL_COLOR: "aoi-d.webp", BOARD_LOCK: "aoi-e.webp", SURRENDER: "aoi-f.webp", SEALED_OUT: "aoi-c.webp", NO_LEGAL_COLOR: "aoi-e.webp" } },
    kai: { normal: "kai-a.webp", loss: { ILLEGAL_COLOR: "kai-g.webp", BOARD_LOCK: "kai-h.webp", SURRENDER: "kai-d.webp", SEALED_OUT: "kai-f.webp", NO_LEGAL_COLOR: "kai-h.webp" } },
    tsubasa: { normal: "tsubasa-a.webp", loss: { ILLEGAL_COLOR: "tsubasa-e.webp", BOARD_LOCK: "tsubasa-c.webp", SURRENDER: "tsubasa-f.webp", SEALED_OUT: "tsubasa-d.webp", NO_LEGAL_COLOR: "tsubasa-c.webp" } },
    shion: { normal: "shion-a.webp", loss: { ILLEGAL_COLOR: "shion-e.webp", BOARD_LOCK: "shion-c.webp", SURRENDER: "shion-h.webp", SEALED_OUT: "shion-f.webp", NO_LEGAL_COLOR: "shion-c.webp" } },
    rei: { normal: "rei-a.webp", loss: { ILLEGAL_COLOR: "rei-c.webp", BOARD_LOCK: "rei-f.webp", SURRENDER: "rei-h.webp", SEALED_OUT: "rei-e.webp", NO_LEGAL_COLOR: "rei-f.webp" } },
    kurogane: { normal: "kurogane-a.webp", loss: { ILLEGAL_COLOR: "kurogane-f.webp", BOARD_LOCK: "kurogane-c.webp", SURRENDER: "kurogane-g.webp", SEALED_OUT: "kurogane-d.webp", NO_LEGAL_COLOR: "kurogane-c.webp" } },
  };
  const CPU_PORTRAITS = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [id, Object.freeze({
    normal: definition.normal,
    loss: Object.freeze({ ...definition.loss }),
  })])));
  const CPU_CHARACTER_IDS = Object.freeze(Object.keys(CPU_PORTRAITS));

  function selectCpuPortrait({ characterId, mode = "normal", reason = null } = {}) {
    const definition = CPU_PORTRAITS[characterId];
    if (!definition || !["normal", "loss"].includes(mode)) return null;
    const file = mode === "loss" && LOSS_REASONS.includes(reason) ? definition.loss[reason] : definition.normal;
    return Object.freeze({
      characterId,
      mode: mode === "loss" && LOSS_REASONS.includes(reason) ? "loss" : "normal",
      reason: mode === "loss" && LOSS_REASONS.includes(reason) ? reason : null,
      file,
      src: `${ASSET_BASE}/${file}`,
      key: `${characterId}:${mode === "loss" && LOSS_REASONS.includes(reason) ? reason : "normal"}:${file}`,
    });
  }

  function showCpuPortrait({ image, fallback, characterId, mode = "normal", reason = null } = {}) {
    if (!image || !fallback) return null;
    const selection = selectCpuPortrait({ characterId, mode, reason });
    if (!selection) {
      image.hidden = true;
      fallback.hidden = false;
      delete image.dataset.portraitKey;
      image.removeAttribute("src");
      return null;
    }
    if (image.dataset.portraitKey === selection.key && image.getAttribute("src") === selection.src) return selection;
    image.dataset.portraitKey = selection.key;
    image.hidden = true;
    fallback.hidden = false;
    image.onload = () => {
      if (image.dataset.portraitKey !== selection.key) return;
      image.hidden = false;
      fallback.hidden = true;
    };
    image.onerror = () => {
      if (image.dataset.portraitKey !== selection.key) return;
      image.hidden = true;
      fallback.hidden = false;
    };
    image.setAttribute("src", selection.src);
    return selection;
  }

  return Object.freeze({ ASSET_BASE, CPU_CHARACTER_IDS, CPU_PORTRAITS, LOSS_REASONS, VERSION, selectCpuPortrait, showCpuPortrait });
});
