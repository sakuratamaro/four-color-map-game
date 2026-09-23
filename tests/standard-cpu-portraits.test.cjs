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

test("historical original atlas stays unchanged; v3 no longer uses it at runtime", () => {
  assert.deepEqual(fs.readdirSync(assetDirectory).sort(), ["cpu-portrait-atlas.png", "wataokiba"]);
  const bytes = fs.readFileSync(atlasPath);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), "44cab0aaa6c0f14871c1f14d2279271ce3383433ce8d832ecd6229313b4b79d0");
  const decoded = decodeRgbaPng(bytes);
  assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 1448, height: 1086 });
  assert.equal(decoded.width % 4, 0);
  assert.equal(decoded.height % 3, 0);
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

test("UDL033 exact ten stable CPU IDs use normal/loss assets, never unknown or inherited IDs", () => {
  assert.equal(portraits.VERSION, "standard-cpu-portraits-v3");
  assert.deepEqual(portraits.CPU_CHARACTER_IDS, Object.keys(roster.CPU_CHARACTERS));
  assert.deepEqual(portraits.CPU_CHARACTER_IDS, commentary.CPU_CHARACTER_IDS);
  assert.deepEqual(portraits.LOSS_REASONS, commentary.TERMINAL_REASONS);
  assert.equal(portraits.CPU_CHARACTER_IDS.length, 10);
  for (const characterId of portraits.CPU_CHARACTER_IDS) {
    const normal = portraits.selectCpuPortrait({ characterId });
    assert.equal(normal.url, portraits.ASSET_BASE + characterId + "-normal.png");
    assert.equal(normal.view, "face");
    assert.equal(normal.key, characterId + ":normal");
    for (const reason of portraits.LOSS_REASONS) {
      const loss = portraits.selectCpuPortrait({ characterId, mode: "loss", reason, view: "full" });
      assert.equal(loss.url, portraits.ASSET_BASE + characterId + "-loss.png");
      assert.equal(loss.mode, "loss"); assert.equal(loss.view, "full");
      assert.equal(loss.reason, reason); assert.equal(loss.size, "contain");
    }
    for (const input of [{ mode: "normal", view: "full" }, { mode: "loss", reason: "unconfirmed", view: "full" }]) {
      const guarded = portraits.selectCpuPortrait({ characterId, ...input });
      assert.equal(guarded.mode, "normal"); assert.equal(guarded.view, "face"); assert.equal(guarded.url, normal.url);
    }
  }
  for (const characterId of ["unknown", "toString", "constructor", "__proto__", "../yuzu", null]) assert.equal(portraits.selectCpuPortrait({ characterId }), null);
  assert.equal(portraits.selectCpuPortrait({ characterId: "yuzu", view: "invalid" }), null);
});

test("UDL033 shipped files match all 20 exact original hashes, dimensions, crops and provenance", () => {
  const dir = path.join(assetDirectory, "wataokiba");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  assert.equal(manifest.files.length, 10);
  assert.equal(manifest.author, "わたおび"); assert.equal(manifest.site_name, "わたおきば");
  assert.deepEqual(manifest.files.map(r => r.character_id).sort(), [...portraits.CPU_CHARACTER_IDS].sort());
  const expected = ["manifest.json", "NOTICE.md"]; let bytesTotal = 0;
  for (const row of manifest.files) {
    assert.equal(new URL(row.source_page).hostname, "wataokiba.net");
    assert.match(row.source_page_sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(row.assets).sort(), ["loss", "normal"]);
    const definition = portraits.CPU_PORTRAITS[row.character_id];
    assert.deepEqual(definition.face, row.face_box);
    assert.ok(row.face_box[0] >= 0 && row.face_box[1] >= 0 && row.face_box[2] > 0);
    assert.ok(row.face_box[0] + row.face_box[2] <= definition.width && row.face_box[1] + row.face_box[2] <= definition.height);
    for (const [mode, asset] of Object.entries(row.assets)) {
      assert.equal(asset.file, row.character_id + "-" + mode + ".png");
      assert.equal(new URL(asset.source_url).hostname, "wataokiba.net");
      const bytes = fs.readFileSync(path.join(dir, asset.file));
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), asset.sha256);
      assert.equal(bytes.length, asset.bytes); bytesTotal += bytes.length;
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(bytes.readUInt32BE(16), asset.width); assert.equal(bytes.readUInt32BE(20), asset.height);
      assert.equal(asset.width, definition.width); assert.equal(asset.height, definition.height);
      expected.push(asset.file);
    }
    assert.notEqual(row.assets.normal.sha256, row.assets.loss.sha256);
    assert.equal(row.assets.normal.source_url.replace(/_[a-z](-1)?\.png$/, ""), row.assets.loss.source_url.replace(/_[a-z](-1)?\.png$/, ""));
  }
  assert.equal(bytesTotal, 6283280);
  assert.deepEqual(fs.readdirSync(dir).sort(), expected.sort());
  assert.match(fs.readFileSync(path.join(dir, "NOTICE.md"), "utf8"), /No code license.*extends to them/);
});

test("UDL033 loader is lazy and image-specific; one error cannot hide another character", () => {
  const probes = [];
  class FakeImage { constructor() { probes.push(this); } set src(value) { this.source = value; } }
  const p = portraits.createCpuPortraitPresenter({ ImageCtor: FakeImage });
  assert.equal(probes.length, 0);
  const one = portraitElements(), two = portraitElements(), copy = portraitElements();
  p.showCpuPortrait({ ...one, characterId: "shion", mode: "loss", reason: "BOARD_LOCK", view: "full" });
  assert.equal(probes.length, 1); assert.match(probes[0].source, /shion-loss\.png$/);
  assert.equal(one.frame.dataset.portraitStatus, "loading");
  assert.equal(one.art.hidden, true); assert.equal(one.fallback.hidden, false);
  p.showCpuPortrait({ ...two, characterId: "rei" });
  p.showCpuPortrait({ ...copy, characterId: "rei" });
  assert.equal(probes.length, 2);
  probes[0].onerror(); probes[1].onload();
  assert.equal(one.frame.dataset.portraitStatus, "error"); assert.equal(one.art.hidden, true);
  for (const item of [two, copy]) { assert.equal(item.frame.dataset.portraitStatus, "ready"); assert.equal(item.art.hidden, false); assert.equal(item.fallback.hidden, true); }
  p.showCpuPortrait({ ...one, characterId: "shion", mode: "loss", reason: "BOARD_LOCK", view: "full" });
  assert.equal(probes.length, 2, "failed asset is not an automatic retry loop");
  probes[0].onload(); assert.equal(one.frame.dataset.portraitStatus, "error", "only the first completed callback settles");
});

test("UDL033 old callbacks cannot revive a cleared/rebound face or leak a loss expression", () => {
  const probes = [];
  class FakeImage { constructor() { probes.push(this); } set src(value) { this.source = value; } }
  const p = portraits.createCpuPortraitPresenter({ ImageCtor: FakeImage }), view = portraitElements();
  p.showCpuPortrait({ ...view, characterId: "yuzu", mode: "loss", reason: "SURRENDER", view: "full" });
  p.showCpuPortrait({ ...view, characterId: "ren" });
  probes[0].onload();
  assert.equal(view.frame.dataset.portraitKey, "ren:normal");
  assert.equal(view.frame.dataset.portraitView, "face");
  assert.equal(view.frame.dataset.portraitStatus, "loading");
  assert.equal(view.frame.dataset.portraitReason, undefined); assert.equal(view.art.hidden, true);
  p.clearCpuPortrait(view); probes[1].onload();
  assert.deepEqual(view.frame.dataset, {}); assert.equal(view.art.hidden, true); assert.equal(view.fallback.hidden, false);
  for (const prop of ["image", "size", "x", "y"]) assert.equal(view.art.style.getPropertyValue("--cpu-portrait-" + prop), "");
  p.showCpuPortrait({ ...view, characterId: "ren" });
  assert.equal(view.art.hidden, false); assert.equal(probes.length, 2);
  p.showCpuPortrait({ ...view, characterId: "constructor" });
  assert.deepEqual(view.frame.dataset, {}); assert.equal(view.art.hidden, true);
});

test("UDL033 unsupported or throwing image loader fails into the CPU fallback", () => {
  for (const ImageCtor of [null, class { constructor() { throw new Error("unavailable"); } }]) {
    const p = portraits.createCpuPortraitPresenter({ ImageCtor }), view = portraitElements();
    assert.doesNotThrow(() => p.showCpuPortrait({ ...view, characterId: "yuzu" }));
    assert.equal(view.frame.dataset.portraitStatus, "error"); assert.equal(view.art.hidden, true); assert.equal(view.fallback.hidden, false);
  }
});

test("UDL033 integration keeps public/decorative boundaries and native credit controls", () => {
  const source = fs.readFileSync(path.join(root, "standard-online-v5", "cpu-portraits.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "standard-online-v5", "cpu-artwork.css"), "utf8");
  for (const forbidden of ["basicPalettes", "bonusColors", "privateEffects", "ownPrivateState", "actionScore", "localStorage", "sessionStorage", "http://", "https://"]) assert.equal(source.includes(forbidden), false);
  assert.match(app, /item\?\.kind === "terminal-loss" && !isLegalRecolorLab\(context\?\.publicState\)/);
  assert.match(app, /context\.publicState\.winner !== context\.cpuSeat/);
  assert.match(html, /cpu-portraits\.js\?v=20260913-2/);
  assert.ok(html.indexOf("cpu-portraits.js") < html.indexOf("cpu-commentary.js"));
  for (const id of ["cpuCommentaryPortraitFrame", "cpuTerminalPortraitSummaryFrame", "cpuTerminalPortraitOverlayFrame"]) assert.match(html, new RegExp('id="' + id + '"[^>]+aria-hidden="true"'));
  assert.match(css, /background-image:var\(--cpu-portrait-image,none\)/);
  assert.match(css, /@media\(max-width:390px\)/); assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(html, /id="creditsDialog"[^>]+aria-labelledby="creditsTitle"/);
  assert.match(html, /id="closeCredits"[^>]+type="submit"[^>]+autofocus/);
  assert.match(html, /https:\/\/wataokiba.net\/利用規約\//);
  assert.doesNotMatch(source, /cpu-portrait-atlas\.png/);
});

test("UDL033 current-base integration protects compact UI and separate Ren technique controls", () => {
  const app=fs.readFileSync(path.join(root,"standard-online-v5/app.js"),"utf8");
  const html=fs.readFileSync(path.join(root,"standard-online-v5/index.html"),"utf8");
  const spec=fs.readFileSync(path.join(root,"docs/CPU_WATAOKIBA_INTEGRATION_20260923.md"),"utf8");
  for(const marker of ["app.js?v=20260923-1","cpu-portraits.js?v=20260913-2","cpu-artwork.css?v=20260913-1"])
    assert.ok(html.includes(marker)&&spec.includes(marker),marker);
  for(const marker of ["standard-online-client.js?v=20260914-1","standard-skill-registry.generated.js?v=20260914-2",
    "play-surface.css?v=20260915-5","terminal-result.css?v=20260914-1"])assert.ok(html.includes(marker),marker);
  for(const code of ["stableHandSlots(","paletteRoleSlots(","cardActionRecovery(","progressionPending()",
    "cpuEntryDraft","resultContinuationPending()","5.0.0-alpha.5"])assert.ok(app.includes(code),code);
  const targets=html.indexOf('id="skillTargetControls"'),tech=html.indexOf('id="techniqueControls"'),history=html.indexOf('id="paletteHistoryPanel"');
  assert.ok(targets>0&&targets<tech&&tech<history);
  assert.equal(html.split('id="creditsDialog"').length-1,1);
  assert.equal(html.split('id="openCredits"').length-1,1);
  const credits=app.slice(app.indexOf("let creditsTrigger"),app.indexOf('$("terminalGoGacha").onclick'));
  for(const forbidden of ["client.","localStorage.","sendAction(","createRoom","profile("])assert.equal(credits.includes(forbidden),false,forbidden);
});
