"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const html = read("standard-online-v5/index.html"), app = read("standard-online-v5/app.js"), css = read("standard-online-v5/ui-diet.css");

test("UDL062 Home keeps two explicit ordinary entries and one existing settings store", () => {
  const actions = html.match(/<div class="home-actions">([\s\S]*?)<\/div>/)[1];
  assert.equal((actions.match(/<button /g) || []).length, 2);
  for(const id of ["openHomeSettings", "openTutorial"]) assert.ok(actions.includes(`id="${id}"`));
  assert.doesNotMatch(actions, /data-tab-jump|startStandardCpuHome/);
  assert.match(html, /id="openHomeSettings"[^>]+aria-expanded="false"[^>]+aria-controls="feedbackSettings"/);
  assert.match(html, /id="feedbackSettings" class="feedback-settings hidden"/);
  for(const id of ["soundEffectsEnabled", "vibrationEnabled", "feedbackSettingsStatus"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  assert.match(app, /basicFeedback\.bindControls\(\{ soundInput: \$\("soundEffectsEnabled"\), vibrationInput: \$\("vibrationEnabled"\)/);
});

test("UDL068 optional native rules modal is explicit, closeable and free of game writes", () => {
  assert.match(html, /<dialog id="tutorialDialog"[^>]+aria-labelledby="tutorialTitle"/);
  assert.match(html, /id="tutorialTitle" tabindex="-1" autofocus/);
  assert.match(html, /id="closeTutorial" type="submit" value="close"/);
  const handlers = app.slice(app.indexOf('$("openHomeSettings").onclick'), app.indexOf('$("startStandardCpuHome").onclick'));
  assert.match(handlers, /showModal\(\)/); assert.match(handlers, /\$\("tutorialTitle"\)\.focus/);
  assert.match(handlers, /activeAppTab === "home" && !hasMatchedRoomHandoff\(\)/);
  assert.doesNotMatch(handlers, /client\.|localStorage|sessionStorage|syncSelectedProfile|setCpuEntryIntent|startOnlineQuiz|runGacha|sendAction|preventDefault/);
  assert.match(app, /if \(tab !== "home"\)[\s\S]*?show\("feedbackSettings", false\);[\s\S]*?\$\("tutorialDialog"\)\.close\(\)/);
  assert.match(app, /if \(visible && \$\("tutorialDialog"\)\.open\) \$\("tutorialDialog"\)\.close\(\)/);
});

test("Home rules explain only normal current rules and preserve active-session recovery", () => {
  const tutorial = html.match(/<dialog id="tutorialDialog"[\s\S]*?<\/dialog>/)[0];
  for(const text of ["先手", "表示された数のマスを辺でつなげて", "辺で接しているエリアと同じ色を塗ると負け", "角で触れるだけ", "基本2枠", "残り回数", "6枚のスキル", "自動で負けにはなりません", "投了", "作れる場所がなくなれば、塗った人の勝ち"])
    assert.ok(tutorial.includes(text), text);
  assert.doesNotMatch(tutorial, /角膨張|白紙化|合法色を表示|相手の持ち色|ガチャ券.*枚/);
  assert.match(html, /id="homeSessionRecovery"[^>]+hidden[^>]+data-app-tab-panel="home"/);
  assert.match(app, /show\("homeSessionRecovery", cpuDraftOwnsRoomlessEntry \|\| Boolean\(snapshot\.roomId\) \|\| hasCpuEntryIntent\(\)\)/);
  assert.match(css, /body\[data-active-tab="home"\] \.connection-card\.connection-ready:not\(\.has-matched-room\)/);
  assert.match(app, /classList\.toggle\("connection-ready", tone === "good"\)/);
  assert.match(css, /\.tutorial-dialog[^}]+max-height: calc\(100dvh - 24px\)[^}]+overflow: auto/);
});
