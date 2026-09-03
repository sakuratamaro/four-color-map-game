import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configSource = fs.readFileSync(path.join(root, "online", "supabase-config.js"), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];

assert.ok(url && publishableKey, "PUBLIC_SUPABASE_CONFIG_REQUIRED");

async function anonymous() {
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  const data = await response.json();
  assert.equal(response.ok, true, `ANONYMOUS_AUTH_FAILED_${response.status}_${data?.error_code || data?.code || "UNKNOWN"}`);
  assert.match(data.user?.id || "", /^[0-9a-f-]{36}$/i);
  assert.equal(typeof data.access_token, "string");
  return { accessToken: data.access_token, userId: data.user.id };
}

async function rpc(session, name, args) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await response.json();
  return response.ok
    ? { data, error: null }
    : { data: null, error: data };
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

const [playerA, playerB, outsider] = await Promise.all([
  anonymous(),
  anonymous(),
  anonymous(),
]);

const createdResponse = await rpc(playerA, "fcg_standard_create_room", {
  p_display_name: "snapshot-A",
});
assert.ifError(createdResponse.error);
const created = firstRow(createdResponse.data);
assert.match(created?.room_id || "", /^[0-9a-f-]{36}$/i);
assert.match(created?.room_code || "", /^[0-9A-F]{6}$/);

const joinedResponse = await rpc(playerB, "fcg_standard_join_room", {
  p_room_code: created.room_code,
  p_display_name: "snapshot-B",
});
assert.ifError(joinedResponse.error);
const joined = firstRow(joinedResponse.data);
assert.equal(joined?.room_id, created.room_id);

const [snapshotAResponse, snapshotBResponse, outsiderResponse] = await Promise.all([
  rpc(playerA, "fcg_standard_room_snapshot", { p_room_id: created.room_id }),
  rpc(playerB, "fcg_standard_room_snapshot", { p_room_id: created.room_id }),
  rpc(outsider, "fcg_standard_room_snapshot", { p_room_id: created.room_id }),
]);
assert.ifError(snapshotAResponse.error);
assert.ifError(snapshotBResponse.error);
assert.ok(outsiderResponse.error, "OUTSIDER_MUST_BE_REJECTED");

const snapshotA = firstRow(snapshotAResponse.data);
const snapshotB = firstRow(snapshotBResponse.data);
for (const snapshot of [snapshotA, snapshotB]) {
  assert.equal(snapshot.snapshot_schema_version, 1);
  assert.equal(snapshot.room.id, created.room_id);
  assert.equal(snapshot.room.game_mode, "standard_v5");
  assert.deepEqual(snapshot.members.map((member) => member.seat), ["A", "B"]);
  const serialized = JSON.stringify(snapshot);
  for (const forbidden of ["authoritative_state", "profile_a_state", "profile_b_state", "setup_a", "setup_b"]) {
    assert.equal(serialized.includes(forbidden), false, `SNAPSHOT_LEAKED_${forbidden}`);
  }
}

assert.equal(snapshotA.snapshot_version, snapshotB.snapshot_version);
assert.notEqual(playerA.userId, playerB.userId);
assert.notEqual(playerA.userId, outsider.userId);
assert.notEqual(playerB.userId, outsider.userId);

console.log(JSON.stringify({
  ok: true,
  roomId: created.room_id,
  roomStatus: snapshotA.room.status,
  snapshotVersion: snapshotA.snapshot_version,
  memberSeats: snapshotA.members.map((member) => member.seat),
  outsiderRejected: true,
  outsiderCode: outsiderResponse.error.code || null,
}));
