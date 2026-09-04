"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "online-v5", "app.js"), "utf8");

test("online UI uses anonymous auth and room RPCs", () => {
  assert.match(source, /signInAnonymously\(\)/);
  assert.match(source, /rpc\("fcg_create_room"/);
  assert.match(source, /rpc\("fcg_join_room"/);
});

test("online UI sends intended actions, not final state", () => {
  assert.match(source, /type, payload/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(source, /body:\s*\{[^}]*publicState/s);
  assert.doesNotMatch(source, /body:\s*\{[^}]*privateState/s);
});

test("online UI supports realtime plus persisted reconnect polling", () => {
  assert.match(source, /postgres_changes/);
  const subscribe = source.slice(source.indexOf("async function subscribe"), source.indexOf("function render"));
  assert.match(subscribe, /table: "fcg_rooms"/);
  assert.match(subscribe, /event: "UPDATE"/);
  assert.doesNotMatch(subscribe, /fcg_room_members|fcg_player_views/);
  assert.match(source, /setInterval\(\(\) => fetchRoom/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /if \(!roomId \|\| document\.hidden\) return/);
  assert.match(source, /window\.addEventListener\("pagehide", stopPolling\)/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(source, /localStorage\.getItem\(STORAGE_KEY/);
  assert.match(source, /fcg_rooms"\)\.select\([^\n]+\)\.eq\("id", roomId\)\.maybeSingle\(\)/);
  assert.match(source, /対戦は終了または失効しました/);
  assert.match(source, /handleExpiredRoom\(\)/);
});

test("all quick-mode actions are wired", () => {
  for (const action of ["CREATE_REGION", "COLOR_REGION", "USE_SKILL", "DECLARE_NO_COLOR", "SURRENDER"]) {
    assert.match(source, new RegExp(`sendAction\\(\\"${action}\\"`));
  }
  for (const skill of ["colorPrism", "areaHalfShift", "disruptChoiceOne"]) assert.match(source, new RegExp(skill));
});

test("rule rejections expose the server reason without pretending the connection failed", () => {
  assert.match(source, /response\.clone\(\)\.json\(\)/);
  assert.match(source, /ACTION_ERROR_JA/);
  assert.match(source, /既存エリアに辺で接するマス/);
  const sendAction = source.slice(source.indexOf("async function sendAction"), source.indexOf("async function openRoom"));
  assert.doesNotMatch(sendAction, /fail\(error\)/);
  assert.match(sendAction, /toast\(await actionErrorMessage\(error\)\)/);
});
