const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const portraits = require("../standard-online-v5/cpu-portraits.js");
const commentary = require("../standard-online-v5/cpu-commentary.js");
const roster = require("../standard/standard-cpu-roster.js");
const manifest = require("../standard-online-v5/assets/cpu-portraits/manifest.json");

const root = path.join(__dirname, "..");
const assetDirectory = path.join(root, "standard-online-v5", "assets", "cpu-portraits");

test("portrait mapping covers the exact ten-character CPU roster and every public loss reason", () => {
  assert.equal(portraits.VERSION, "standard-cpu-portraits-v1");
  assert.deepEqual(portraits.CPU_CHARACTER_IDS, Object.keys(roster.CPU_CHARACTERS));
  assert.deepEqual(portraits.CPU_CHARACTER_IDS, commentary.CPU_CHARACTER_IDS);
  assert.deepEqual(portraits.LOSS_REASONS, commentary.TERMINAL_REASONS);
  assert.equal(portraits.CPU_CHARACTER_IDS.length, 10);
  for (const characterId of portraits.CPU_CHARACTER_IDS) {
    const normal = portraits.selectCpuPortrait({ characterId });
    assert.equal(normal.mode, "normal");
    assert.match(normal.src, new RegExp(`^assets/cpu-portraits/${characterId}-[a-h]\\.webp$`));
    for (const reason of portraits.LOSS_REASONS) {
      const loss = portraits.selectCpuPortrait({ characterId, mode: "loss", reason });
      assert.equal(loss.mode, "loss");
      assert.equal(loss.reason, reason);
      assert.match(loss.src, new RegExp(`^assets/cpu-portraits/${characterId}-[a-h]\\.webp$`));
    }
  }
  assert.equal(portraits.selectCpuPortrait({ characterId: "unknown" }), null);
});

test("only runtime-referenced cropped WebPs are included and each has a valid compact WebP header", () => {
  const referenced = new Set();
  for (const definition of Object.values(portraits.CPU_PORTRAITS)) {
    referenced.add(definition.normal);
    for (const file of Object.values(definition.loss)) referenced.add(file);
  }
  const actual = fs.readdirSync(assetDirectory).filter((file) => file.endsWith(".webp")).sort();
  assert.deepEqual(actual, [...referenced].sort());
  assert.equal(actual.length, 49);
  for (const file of actual) {
    const bytes = fs.readFileSync(path.join(assetDirectory, file));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", file);
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", file);
    assert.equal(bytes.subarray(12, 16).toString("ascii"), "VP8X", file);
    assert.equal(bytes.readUIntLE(24, 3) + 1, 256, `${file}:width`);
    assert.equal(bytes.readUIntLE(27, 3) + 1, 256, `${file}:height`);
    assert.ok(bytes.length > 1_000 && bytes.length < 40_000, `${file}:${bytes.length}`);
  }
  assert.deepEqual(fs.readdirSync(assetDirectory).filter((file) => /\.(png|zip|psd|clip)$/i.test(file)), []);
});

test("asset manifest records balanced low-exposure casting, provenance, processing, and license boundary", () => {
  assert.equal(manifest.provider.author, "わたおび");
  assert.equal(manifest.provider.termsCheckedAt, "2026-09-06");
  assert.equal(manifest.provider.standaloneRedistributionProhibited, true);
  assert.match(manifest.processing, /256x256/);
  assert.match(manifest.processing, /Source ZIPs/);
  assert.match(manifest.repositoryLicenseExclusion, /excluded/);
  assert.deepEqual(manifest.characters.map((entry) => entry.id), portraits.CPU_CHARACTER_IDS);
  assert.equal(manifest.characters.filter((entry) => entry.genderPresentation === "female").length, 5);
  assert.equal(manifest.characters.filter((entry) => entry.genderPresentation === "male").length, 5);
  for (const entry of manifest.characters) {
    assert.match(entry.sourcePageUrl, /^https:\/\/wataokiba\.net\//);
    assert.match(entry.sourceBaseUrl, /^https:\/\/wataokiba\.net\/wp-content\/uploads\//);
    assert.equal(entry.variants.normal.length, 1);
    assert.deepEqual(Object.keys(entry.variants.loss).sort(), [...portraits.LOSS_REASONS].sort());
    const mapped = portraits.CPU_PORTRAITS[entry.id];
    assert.equal(mapped.normal, `${entry.id}-${entry.variants.normal}.webp`);
    for (const reason of portraits.LOSS_REASONS) assert.equal(mapped.loss[reason], `${entry.id}-${entry.variants.loss[reason]}.webp`);
  }
});

test("image loading falls back to the CPU mark and avoids reassigning an unchanged portrait", () => {
  let srcWrites = 0;
  const attributes = new Map();
  const image = {
    dataset: {}, hidden: false, onload: null, onerror: null,
    getAttribute(name) { return attributes.get(name) || null; },
    setAttribute(name, value) { attributes.set(name, value); if (name === "src") srcWrites += 1; },
    removeAttribute(name) { attributes.delete(name); },
  };
  const fallback = { hidden: true };
  const first = portraits.showCpuPortrait({ image, fallback, characterId: "kurogane", mode: "loss", reason: "SEALED_OUT" });
  assert.equal(first.file, "kurogane-d.webp");
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);
  image.onload();
  assert.equal(image.hidden, false);
  assert.equal(fallback.hidden, true);
  portraits.showCpuPortrait({ image, fallback, characterId: "kurogane", mode: "loss", reason: "SEALED_OUT" });
  assert.equal(srcWrites, 1);
  image.onerror();
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);
  assert.equal(portraits.showCpuPortrait({ image, fallback, characterId: "unknown" }), null);
  assert.equal(attributes.has("src"), false);
});

test("portrait integration stays presentation-only and exposes in-game credit", () => {
  const source = fs.readFileSync(path.join(root, "standard-online-v5", "cpu-portraits.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
  const notice = fs.readFileSync(path.join(root, "NOTICE.md"), "utf8");
  for (const forbidden of ["basicPalettes", "bonusColors", "privateEffects", "ownPrivateState", "actionScore", "localStorage", "sessionStorage"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
  assert.match(app, /item\?\.kind === "terminal-loss"/);
  assert.match(app, /item\?\.kind === "terminal-loss" && !isLegalRecolorLab\(context\?\.publicState\)/);
  assert.match(app, /reason: mode === "loss" \? item\?\.reason : null/);
  assert.match(html, /cpu-portraits\.js\?v=20260907-1/);
  assert.match(html, /cpuTerminalPortraitSummaryFallback/);
  assert.match(html, /cpuTerminalPortraitOverlayFallback/);
  assert.match(html, /画像素材クレジット/);
  assert.match(html, /わたおきば/);
  assert.match(html, /顔と上半身へのトリミング/);
  assert.match(notice, /third-party artwork/i);
  assert.match(notice, /Do not extract or redistribute them as standalone materials/);
});
