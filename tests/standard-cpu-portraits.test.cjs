"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const portraits = require("../standard-online-v5/cpu-portraits.js");
const commentary = require("../standard-online-v5/cpu-commentary.js");
const roster = require("../standard/standard-cpu-roster.js");

const root = path.join(__dirname, "..");
const assetDirectory = path.join(root, "standard-online-v5", "assets", "cpu-portraits");
const atlasPath = path.join(assetDirectory, "cpu-portrait-atlas.png");

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonalDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= diagonalDistance) return left;
  return upDistance <= diagonalDistance ? up : upLeft;
}

function decodeRgbaPng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const compressed = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") compressed.push(data);
    offset += length + 12;
    if (type === "IEND") break;
  }
  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const filtered = zlib.inflateSync(Buffer.concat(compressed));
  assert.equal(filtered.length, height * (stride + 1));
  const pixels = Buffer.alloc(height * stride);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const value = filtered[sourceOffset];
      sourceOffset += 1;
      const left = x >= bytesPerPixel ? pixels[(y * stride) + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[((y - 1) * stride) + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[((y - 1) * stride) + x - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upLeft)
                : null;
      assert.notEqual(predictor, null, `unsupported PNG filter ${filter}`);
      pixels[(y * stride) + x] = (value + predictor) & 255;
    }
  }
  return { width, height, pixels, stride };
}

function portraitElements() {
  const values = new Map();
  const style = {
    getPropertyValue: (name) => values.get(name) || "",
    removeProperty: (name) => values.delete(name),
    setProperty: (name, value) => values.set(name, value),
  };
  return {
    frame: { dataset: {} },
    art: { hidden: true, style },
    fallback: { hidden: false },
  };
}

test("original atlas maps the exact ten-character CPU roster to cells one through ten", () => {
  assert.equal(portraits.VERSION, "standard-cpu-portraits-v2");
  assert.deepEqual(portraits.CPU_CHARACTER_IDS, Object.keys(roster.CPU_CHARACTERS));
  assert.deepEqual(portraits.CPU_CHARACTER_IDS, commentary.CPU_CHARACTER_IDS);
  assert.deepEqual(portraits.LOSS_REASONS, commentary.TERMINAL_REASONS);
  assert.equal(portraits.CPU_CHARACTER_IDS.length, 10);
  portraits.CPU_CHARACTER_IDS.forEach((characterId, index) => {
    const selected = portraits.selectCpuPortrait({ characterId });
    assert.equal(selected.cell, index + 1);
    assert.equal(selected.column, index % 4);
    assert.equal(selected.row, Math.floor(index / 4));
    assert.equal(selected.mode, "normal");
    for (const reason of portraits.LOSS_REASONS) {
      const loss = portraits.selectCpuPortrait({ characterId, mode: "loss", reason });
      assert.equal(loss.cell, selected.cell);
      assert.equal(loss.mode, "loss");
      assert.equal(loss.reason, reason);
    }
  });
  assert.equal(portraits.selectCpuPortrait({ characterId: "unknown" }), null);
});

test("atlas is one exact RGBA 4x3 PNG with ten populated square cells and transparent spare cells", () => {
  assert.deepEqual(fs.readdirSync(assetDirectory).sort(), ["cpu-portrait-atlas.png"]);
  const bytes = fs.readFileSync(atlasPath);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), "44cab0aaa6c0f14871c1f14d2279271ce3383433ce8d832ecd6229313b4b79d0");
  const decoded = decodeRgbaPng(bytes);
  assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 1448, height: 1086 });
  assert.equal(decoded.width % 4, 0);
  assert.equal(decoded.height % 3, 0);
  assert.deepEqual(portraits.ATLAS_GRID, { columns: 4, rows: 3, cellWidth: 362, cellHeight: 362, width: 1448, height: 1086 });
  const counts = [];
  const maximumAlpha = [];
  for (let cell = 0; cell < 12; cell += 1) {
    const column = cell % 4;
    const row = Math.floor(cell / 4);
    let meaningful = 0;
    let maximum = 0;
    for (let y = row * 362; y < (row + 1) * 362; y += 1) {
      for (let x = column * 362; x < (column + 1) * 362; x += 1) {
        const alpha = decoded.pixels[(y * decoded.stride) + (x * 4) + 3];
        if (alpha > 1) meaningful += 1;
        maximum = Math.max(maximum, alpha);
      }
    }
    counts.push(meaningful);
    maximumAlpha.push(maximum);
  }
  for (const count of counts.slice(0, 10)) assert.ok(count > 70_000, String(count));
  assert.deepEqual(maximumAlpha.slice(10), [1, 1]);
  assert.deepEqual(counts.slice(10), [0, 0]);
});

test("atlas loader reveals portraits only after success and keeps the CPU fallback after failure", () => {
  const probes = [];
  class FakeImage {
    constructor() { probes.push(this); }
    set src(value) { this.source = value; }
  }
  const presenter = portraits.createCpuPortraitPresenter({ ImageCtor: FakeImage });
  const first = portraitElements();
  const selection = presenter.showCpuPortrait({ ...first, characterId: "shion", mode: "loss", reason: "BOARD_LOCK" });
  assert.equal(selection.cell, 8);
  assert.equal(probes[0].source, portraits.ATLAS_URL);
  assert.equal(presenter.getAtlasState(), "loading");
  assert.equal(first.art.hidden, true);
  assert.equal(first.fallback.hidden, false);
  assert.equal(first.frame.dataset.portraitReason, "BOARD_LOCK");
  probes[0].onload();
  assert.equal(presenter.getAtlasState(), "ready");
  assert.equal(first.art.hidden, false);
  assert.equal(first.fallback.hidden, true);
  assert.equal(first.art.style.getPropertyValue("--cpu-portrait-x"), "100%");
  assert.equal(first.art.style.getPropertyValue("--cpu-portrait-y"), "50%");

  const failedProbes = [];
  class FailingImage {
    constructor() { failedProbes.push(this); }
    set src(value) { this.source = value; }
  }
  const failing = portraits.createCpuPortraitPresenter({ ImageCtor: FailingImage });
  const second = portraitElements();
  failing.showCpuPortrait({ ...second, characterId: "rei" });
  failedProbes[0].onerror();
  assert.equal(failing.getAtlasState(), "error");
  assert.equal(second.art.hidden, true);
  assert.equal(second.fallback.hidden, false);
  assert.equal(second.frame.dataset.portraitStatus, "error");
  assert.equal(failing.showCpuPortrait({ ...second, characterId: "unknown" }), null);
  assert.equal(second.frame.dataset.portraitKey, undefined);
});

test("portrait integration is presentation-only, decorative, responsive, and third-party-free", () => {
  const source = fs.readFileSync(path.join(root, "standard-online-v5", "cpu-portraits.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");
  for (const forbidden of ["basicPalettes", "bonusColors", "privateEffects", "ownPrivateState", "actionScore", "localStorage", "sessionStorage", "http://", "https://"]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replaceAll(".", "\\."), "i"));
  }
  assert.match(app, /item\?\.kind === "terminal-loss" && !isLegalRecolorLab\(context\?\.publicState\)/);
  assert.match(html, /cpu-portraits\.js\?v=20260908-1/);
  assert.ok(html.indexOf("cpu-portraits.js") < html.indexOf("cpu-commentary.js"));
  assert.match(html, /id="cpuCommentaryPortraitFrame"[^>]+aria-hidden="true"/);
  assert.match(html, /id="cpuTerminalPortraitSummaryFrame"[^>]+aria-hidden="true"/);
  assert.match(html, /id="cpuTerminalPortraitOverlayFrame"[^>]+aria-hidden="true"/);
  assert.match(css, /background-image:url\("assets\/cpu-portraits\/cpu-portrait-atlas\.png"\)/);
  assert.match(css, /background-size:400% 300%/);
  assert.match(css, /@media\(max-width:390px\).*\.cpu-terminal-portrait\{width:56px;height:56px\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\).*\.cpu-portrait-art\{animation:none!important;transition:none!important\}/);
  for (const reason of portraits.LOSS_REASONS) assert.match(css, new RegExp(`data-portrait-reason="${reason}"`));
});
