import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = [
  "standard/standard-engine.js",
  "standard/standard-profile.js",
  "standard/standard-cosmetics.js",
  "standard/standard-skill-registry.js",
  "standard/standard-skill-handlers.js",
  "standard/standard-skill-dispatcher.js",
  "standard/standard-region-geometry.js",
  "standard/standard-match.js",
  "standard/standard-save.js",
  "standard/standard-root-transaction.js",
  "standard/standard-loadout-quote.js",
  "standard/standard-match-start.js",
  "standard/standard-match-transaction.js",
  "standard/standard-local-session.js",
  "standard/quiz-generator.js",
  "standard/hint-policy.js",
  "standard/reward-policy.js",
  "standard/quiz-session.js",
  "standard/standard-quiz-controller.js",
  "standard/standard-quiz-transaction.js",
  "standard/standard-gacha-transaction.js",
  "standard/local-two-player-controller.js",
  "standard-v5/terminal-presentation.js",
  "standard-v5/static-terminal-result.js",
  "standard-v5/terminal-reveal.js",
  "standard-v5/app.js",
];
const modules = ids.map((id) => `${JSON.stringify(id)}:function(require,module,exports){\n${fs.readFileSync(path.join(root, id), "utf8")}\n}`).join(",\n");
const runtime = `"use strict";(()=>{const modules={${modules}};const cache={};function normalize(parts){const out=[];for(const part of parts){if(!part||part===".")continue;if(part==="..")out.pop();else out.push(part);}return out.join("/");}function load(id){if(cache[id])return cache[id].exports;if(!modules[id])throw new Error("Unknown module: "+id);const module={exports:{}};cache[id]=module;const base=id.split("/").slice(0,-1);const localRequire=(request)=>{const resolved=request.startsWith(".")?normalize([...base,...request.split("/")]):request;return load(resolved);};modules[id](localRequire,module,module.exports);return module.exports;}load("standard-v5/app.js").boot();})();\n`;
fs.writeFileSync(path.join(root, "standard-v5", "app.bundle.js"), runtime, "utf8");
