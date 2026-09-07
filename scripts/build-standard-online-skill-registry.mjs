import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "standard-online-v5", "standard-skill-registry.generated.js");
const require = createRequire(import.meta.url);
const { STANDARD_SKILLS, V49_SKILL_IDS } = require(path.join(root, "standard", "standard-skill-registry.js"));

const publicFields = [
  "id",
  "displayName",
  "category",
  "usageCategory",
  "rarity",
  "timing",
  "v49Catalogued",
  "standardUiEnabled",
  "alphaUiEnabled",
  "experimental",
];
const skills = Object.fromEntries(Object.entries(STANDARD_SKILLS).map(([id, definition]) => [
  id,
  Object.fromEntries(publicFields.map((field) => [field, definition[field]])),
]));
const source = `"use strict";\n((root, factory) => {\n  const value = factory();\n  if (typeof module === "object" && module.exports) module.exports = value;\n  root.FourColorStandardSkillRegistry = value;\n})(typeof globalThis === "object" ? globalThis : this, () => {\n  const skills = ${JSON.stringify(skills, null, 2)};\n  for (const definition of Object.values(skills)) Object.freeze(definition);\n  return Object.freeze({\n    VERSION: "standard-skill-registry-generated-v1",\n    skills: Object.freeze(skills),\n    v49SkillIds: Object.freeze(${JSON.stringify(V49_SKILL_IDS)}),\n  });\n});\n`;

if (process.argv.includes("--check")) {
  const actual = fs.existsSync(output) ? fs.readFileSync(output, "utf8").replace(/\r\n?/g, "\n") : "";
  if (actual !== source) {
    console.error("standard-online-v5/standard-skill-registry.generated.js is stale; run node scripts/build-standard-online-skill-registry.mjs");
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(output, source, "utf8");
}
