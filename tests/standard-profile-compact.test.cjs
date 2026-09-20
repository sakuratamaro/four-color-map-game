"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
const html = read("standard-online-v5/index.html"), app = read("standard-online-v5/app.js"), css = read("standard-online-v5/ui-diet.css");

test("UDL062 public nickname warning and existing profile identities are preserved", () => {
  assert.doesNotMatch(html, /この端末のStandardセーブから選べます|このオンライン画面だけに保存/);
  assert.match(html, /<label for="starterName">ニックネーム（20文字まで）<\/label>/);
  assert.match(html, /id="starterName"[^>]+maxlength="20"[^>]+aria-describedby="profilePublicNameHelp"/);
  assert.match(html, /id="profilePublicNameHelp"[^>]*>この名前は対戦相手に表示されます。ニックネームを入力してください。/);
  for (const id of ["profileSelect", "starterCreator", "starterName", "createStarterProfile", "syncProfile", "toggleProfileOptions", "profileSaveStatus"]) assert.equal(html.split(`id="${id}"`).length, 2, id);
  assert.match(app, /if \(remote\) hydrateProfileRow\(remote\);\s*else \{\s*const created = await client\.syncProfile/);
  assert.match(app, /created\.displayName \|\| displayName\(\)/);
});

test("UDL062 profile disclosure does not choose save or initiate a game", () => {
  const handler = app.slice(app.indexOf('$("toggleProfileOptions").onclick'), app.indexOf('$("profileSelect").onchange'));
  assert.match(handler, /if \(profileSyncBusy\) return/);
  assert.match(handler, /profilePickerOpen = !profilePickerOpen/);
  assert.doesNotMatch(handler, /client\.|localStorage|sessionStorage|selectedProfileId|syncSelectedProfile|createStarterProfile|runGacha/);
  assert.match(app, /initialHydrationPending = false;\s*renderProfile\(\);\s*render\(\);/);
  assert.match(app, /profileSyncBusy = false;\s*renderProfile\(\);\s*if \(synced && !profileSyncError && returnProfileFocus/);
  for (const id of ["profileSelect", "starterName", "createStarterProfile", "toggleProfileOptions"]) assert.ok(app.includes(`$("${id}").disabled = profileSyncBusy;`), id);
});

test("UDL062 full progression and cosmetic pending controls remain under native disclosures", () => {
  for (const id of ["profileStatsDetails", "cpuRecordsDetails", "quizAccuracyDetails", "profileTrophiesDetails", "cosmeticPanel"]) {
    const tag = html.match(new RegExp('<details id="' + id + '"[^>]*>'))?.[0];
    assert.ok(tag, id); assert.doesNotMatch(tag, /\bopen(?:\s|=|>)/, id);
  }
  for (const id of ["profileStats", "cpuProfileStats", "cpuCharacterRecords", "quizAccuracyRecords", "trophyList", "matchHistory", "profileCoins", "cosmeticCoins", "cosmeticCatalog", "cosmeticRetry", "cosmeticCommit"]) assert.equal(html.split(`id="${id}"`).length, 2, id);
  assert.match(app, /if \(pending\) \$\("cosmeticPanel"\)\.open = true/);
  assert.match(app, /for \(const characterId of Object\.keys\(CPU_NAMES\)\) appendCpuCharacterRecord/);
  assert.match(app, /for \(const \[id, meta\] of Object\.entries\(TROPHY_META\)\)/);
  assert.match(app, /appendQuizAccuracyRecord\("全体", overall\)/);
  assert.match(css, /\.profile-disclosure > summary[^}]+min-height: 48px/);
});

test("UDL062 compact profile asset preflight rejects missing notice details and pending recovery", async () => {
  const { hasCompactProfile } = await import("../scripts/standard-release-preflight-contracts.mjs");
  assert.equal(hasCompactProfile(html, app, css), true);
  assert.equal(hasCompactProfile(html, app.replace(/\n/g, "\r\n"), css), true);
  assert.equal(hasCompactProfile(null, app, css), false);
  for (const id of ["profileStatsDetails", "cpuRecordsDetails", "quizAccuracyDetails", "profileTrophiesDetails", "cosmeticPanel"]) {
    assert.equal(hasCompactProfile(html.replace(`id="${id}"`, `id="missing-${id}"`), app, css), false, id);
    assert.equal(hasCompactProfile(html.replace(`<details id="${id}"`, `<details open id="${id}"`), app, css), false, id);
  }
  assert.equal(hasCompactProfile(html.replaceAll('aria-describedby="profilePublicNameHelp"', ''), app, css), false);
  assert.equal(hasCompactProfile(html, app.replace('if (pending) $("cosmeticPanel").open = true;', ''), css), false);
  assert.equal(hasCompactProfile(html, app, css.replaceAll('min-height: 48px', 'min-height: 20px')), false);
});
