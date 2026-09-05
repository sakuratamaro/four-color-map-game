"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-pregame-abandon-canary.mjs"), "utf8");

test("pregame-abandon canary is explicit, finite, public-client only, and cleans up playing state", () => {
  assert.match(source, /--confirm-live/);
  assert.match(source, /90_000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
  assert.match(source, /fcg_standard_abandon_room/);
  assert.match(source, /waiting room abandoned/);
  assert.match(source, /ERROR_JOIN_FAILED/);
  assert.match(source, /guest can abandon ready room/);
  assert.match(source, /other member converges/);
  assert.match(source, /playing abandon rejected/);
  assert.match(source, /type: "SURRENDER"/);
  assert.match(source, /pregame abandon leaves profiles unchanged/);
  assert.match(source, /finally \{/);
  assert.match(source, /bestEffortTerminalizeRoom/);
  assert.match(source, /status === "waiting" \|\| status === "ready"/);
  assert.match(source, /latest\.room\.public_state\?\.active/);
  assert.match(source, /cleanupSurrenderActions/);
  assert.match(source, /activeRoomCount/);
  assert.match(source, /unknownRoomCount/);
  assert.match(source, /nonTerminalRoomCount/);
  assert.match(source, /TERMINAL_ROOM_STATUSES/);
  assert.match(source, /terminalRooms/);
  assert.match(source, /anonymousProfiles/);
  assert.match(source, /status: profileCreated \? "retained" : "not-confirmed"/);
  assert.match(source, /ACTIVE_CANARY_RESIDUE/);
  assert.doesNotMatch(source, /serviceRole|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
