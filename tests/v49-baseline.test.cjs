"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const published = fs.readFileSync(path.join(root, "index.html"));
const baseline = fs.readFileSync(path.join(root, "reference", "v4.9", "four-color-map-game-browser-v4-9-modes-economy.html"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("published local game is the byte-identical verified v4.9 baseline", () => {
  assert.deepEqual(published, baseline);
  assert.equal(sha256(published), "f1d106fbebd46b91cb463c8fa4e379b4620ac8068c395fceffbc2854ae43edc1");
});
