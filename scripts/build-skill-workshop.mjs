import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = ["standard-engine", "standard-match", "standard-match-reward", "standard-skill-registry", "standard-technique-state", "standard-redesignation", "standard-color-permutation", "standard-skill-handlers", "standard-skill-dispatcher", "standard-region-geometry", "standard-skill-workshop"].map(id => `standard/${id}.js`);
const modules = ids.map(id => `${JSON.stringify(id)}:function(require,module,exports){\n${fs.readFileSync(path.join(root,id),"utf8").replace(/\r\n?/g,"\n")}\n}`).join(",\n");
const output = `"use strict";(()=>{const modules={${modules}};const cache={};function load(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;if(!modules[id])throw Error("Unknown workshop dependency "+id);modules[id](request=>load("standard/"+request.replace(/^\.\\//,"")),module,module.exports);return module.exports;}globalThis.FourColorSkillWorkshop=Object.freeze(load("standard/standard-skill-workshop.js"));})();\n`;
const destination=path.join(root,"skill-workshop/engine.bundle.js");
// Git on Windows may check text files out as CRLF; compare the canonical LF bytes.
if(process.argv.includes("--check")){if(fs.readFileSync(destination,"utf8").replace(/\r\n?/g,"\n")!==output)throw Error("STALE_WORKSHOP_BUNDLE");}
else fs.writeFileSync(destination,output,"utf8");
