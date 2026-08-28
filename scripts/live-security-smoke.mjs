import { readFile } from "node:fs/promises";

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live test users/rooms without --confirm-live.");
  process.exit(2);
}
const hardTimeout = setTimeout(() => {
  console.error("Live security smoke test exceeded its 90-second safety timeout.");
  process.exit(1);
}, 90_000);

const configSource = await readFile(new URL("../online/supabase-config.js", import.meta.url), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const checks = [];
function check(name, condition, detail = "") {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ""}`);
}

async function request(path, { token, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    signal: AbortSignal.timeout(25_000),
    headers: {
      apikey: publishableKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, ok: response.ok, data };
}

async function anonymousSession() {
  const result = await request("/auth/v1/signup", {
    method: "POST",
    body: {},
    headers: { Authorization: `Bearer ${publishableKey}` },
  });
  check("anonymous sign-in", result.ok && typeof result.data?.access_token === "string");
  return { token: result.data.access_token };
}

async function rpc(name, token, body) {
  return request(`/rest/v1/rpc/${name}`, { token, method: "POST", body });
}

async function edge(token, body, authorizationOverride) {
  return request("/functions/v1/game-action", {
    token,
    method: "POST",
    body,
    ...(authorizationOverride === undefined ? {} : { headers: { Authorization: authorizationOverride } }),
  });
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function errorCode(result) {
  return result.data?.error?.code || result.data?.code || "";
}

function mutateJwt(token) {
  const parts = token.split(".");
  const signature = parts[2];
  const index = Math.min(3, signature.length - 1);
  const replacement = signature[index] === "A" ? "B" : "A";
  parts[2] = `${signature.slice(0, index)}${replacement}${signature.slice(index + 1)}`;
  return parts.join(".");
}

const [a, contender1, contender2] = await Promise.all([
  anonymousSession(), anonymousSession(), anonymousSession(),
]);
console.log("STAGE anonymous sessions ready");

const created = await rpc("fcg_create_room", a.token, { p_display_name: "LiveSecurityA" });
const createdRow = firstRow(created.data);
check("room creation", created.ok && createdRow?.seat === "A" && createdRow?.room_id && createdRow?.room_code);
const roomId = createdRow.room_id;
const roomCode = createdRow.room_code;

const joins = await Promise.all([
  rpc("fcg_join_room", contender1.token, { p_room_code: roomCode, p_display_name: "LiveSecurityB1" }),
  rpc("fcg_join_room", contender2.token, { p_room_code: roomCode, p_display_name: "LiveSecurityB2" }),
]);
const winners = joins.map((result, index) => ({ result, session: index === 0 ? contender1 : contender2 })).filter(({ result }) => result.ok);
const losers = joins.map((result, index) => ({ result, session: index === 0 ? contender1 : contender2 })).filter(({ result }) => !result.ok);
check("simultaneous B/C join chooses exactly one B", winners.length === 1 && losers.length === 1);
const b = winners[0].session;
const c = losers[0].session;
console.log("STAGE room and seats ready");

const noJwt = await edge(undefined, { operation: "initialize", roomId }, "");
check("missing JWT rejected", noJwt.status === 401 && errorCode(noJwt) === "AUTH_REQUIRED", `status ${noJwt.status}`);
const keyAsJwt = await edge(undefined, { operation: "initialize", roomId }, `Bearer ${publishableKey}`);
check("publishable key as Bearer rejected", keyAsJwt.status === 401, `status ${keyAsJwt.status}`);
const changedJwt = await edge(undefined, { operation: "initialize", roomId }, `Bearer ${mutateJwt(a.token)}`);
check("modified JWT rejected", changedJwt.status === 401, `status ${changedJwt.status}`);

const initializedA = await edge(a.token, { operation: "initialize", roomId });
check("valid anonymous JWT initializes", initializedA.ok && initializedA.data?.room?.seat === "A");
const initializedB = await edge(b.token, { operation: "initialize", roomId });
check("Player B receives only seat B view", initializedB.ok && initializedB.data?.room?.seat === "B");

const spoofed = await edge(c.token, { operation: "initialize", roomId, userId: "pretend-a", seat: "A" });
check("body identity cannot impersonate a member", !spoofed.ok, `status ${spoofed.status}`);
console.log("STAGE identity checks complete");

const version0 = initializedA.data.room.version;
const requiredSize = initializedA.data.room.publicState.requiredSize;
const macros = [13, 14, 15, 16].slice(0, requiredSize);
const offTurn = await edge(b.token, {
  operation: "action", roomId,
  action: { id: crypto.randomUUID(), expectedVersion: version0, type: "CREATE_REGION", payload: { macros } },
});
check("off-turn action rejected", !offTurn.ok && errorCode(offTurn) === "NOT_YOUR_TURN", `${offTurn.status}/${errorCode(offTurn)}`);

const createAction = { id: crypto.randomUUID(), expectedVersion: version0, type: "CREATE_REGION", payload: { macros } };
const createdRegion = await edge(a.token, { operation: "action", roomId, action: createAction });
check("authoritative action succeeds", createdRegion.ok && createdRegion.data?.room?.version === version0 + 1);
const repeated = await edge(a.token, { operation: "action", roomId, action: createAction });
check("same action_id applies once", repeated.ok && repeated.data?.duplicate === true);

const version1 = createdRegion.data.room.version;
const paletteB = initializedB.data.room.privateState.palette;
const colorRequests = paletteB.slice(0, 2).map((color) => edge(b.token, {
  operation: "action", roomId,
  action: { id: crypto.randomUUID(), expectedVersion: version1, type: "COLOR_REGION", payload: { color } },
}));
const colorResults = await Promise.all(colorRequests);
check("same-version competing actions have one winner", colorResults.filter((result) => result.ok).length === 1);
check("same-version loser is rejected as stale", colorResults.some((result) => result.status === 409 && errorCode(result) === "STALE_VERSION"), colorResults.map((result) => `${result.status}/${errorCode(result)}`).join(","));
const colored = colorResults.find((result) => result.ok);
const version2 = colored.data.room.version;
console.log("STAGE concurrency checks complete");

const stale = await edge(a.token, {
  operation: "action", roomId,
  action: { id: crypto.randomUUID(), expectedVersion: version0, type: "SURRENDER", payload: {} },
});
check("explicit stale version rejected", stale.status === 409 && errorCode(stale) === "STALE_VERSION");
const nonmember = await edge(c.token, {
  operation: "action", roomId, userId: "pretend-a", seat: "A",
  action: { id: crypto.randomUUID(), expectedVersion: version2, type: "SURRENDER", payload: {} },
});
check("nonmember action rejected", !nonmember.ok, `status ${nonmember.status}`);

const finished = await edge(a.token, {
  operation: "action", roomId,
  action: { id: crypto.randomUUID(), expectedVersion: version2, type: "SURRENDER", payload: {} },
});
check("surrender finishes match", finished.ok && finished.data?.room?.status === "finished");
const afterFinish = await edge(b.token, {
  operation: "action", roomId,
  action: { id: crypto.randomUUID(), expectedVersion: version2 + 1, type: "SURRENDER", payload: {} },
});
check("post-finish operation rejected", !afterFinish.ok && errorCode(afterFinish) === "ROOM_NOT_PLAYING", `${afterFinish.status}/${errorCode(afterFinish)}`);

async function selectRows(session, table, query) {
  return request(`/rest/v1/${table}?${query}`, { token: session.token });
}
const [aRoom, bRoom, cRoom, aMembers, bMembers, cMembers, aView, bView, cView] = await Promise.all([
  selectRows(a, "fcg_rooms", `id=eq.${roomId}&select=id`),
  selectRows(b, "fcg_rooms", `id=eq.${roomId}&select=id`),
  selectRows(c, "fcg_rooms", `id=eq.${roomId}&select=id`),
  selectRows(a, "fcg_room_members", `room_id=eq.${roomId}&select=seat`),
  selectRows(b, "fcg_room_members", `room_id=eq.${roomId}&select=seat`),
  selectRows(c, "fcg_room_members", `room_id=eq.${roomId}&select=seat`),
  selectRows(a, "fcg_player_views", `room_id=eq.${roomId}&select=seat`),
  selectRows(b, "fcg_player_views", `room_id=eq.${roomId}&select=seat`),
  selectRows(c, "fcg_player_views", `room_id=eq.${roomId}&select=seat`),
]);
check("A/B can read only their member room", aRoom.data?.length === 1 && bRoom.data?.length === 1 && cRoom.data?.length === 0);
check("A/B see two seats while C sees none", aMembers.data?.length === 2 && bMembers.data?.length === 2 && cMembers.data?.length === 0);
check("private projections are owner-only", aView.data?.length === 1 && aView.data[0]?.seat === "A" && bView.data?.length === 1 && bView.data[0]?.seat === "B" && cView.data?.length === 0);
const [aPolledRoom, bPolledRoom] = await Promise.all([
  selectRows(a, "fcg_rooms", `id=eq.${roomId}&select=status,version`),
  selectRows(b, "fcg_rooms", `id=eq.${roomId}&select=status,version`),
]);
check("A/B polling recovers the final server state", [aPolledRoom, bPolledRoom].every((result) => result.data?.length === 1 && result.data[0].status === "finished" && result.data[0].version === version2 + 1));

async function deniedPatch(session, table, body) {
  return request(`/rest/v1/${table}?room_id=eq.${roomId}`, {
    token: session.token, method: "PATCH", body,
    headers: { Prefer: "return=minimal" },
  });
}
const writeAttempts = await Promise.all([
  request(`/rest/v1/fcg_rooms?id=eq.${roomId}`, { token: a.token, method: "PATCH", body: { status: "finished" }, headers: { Prefer: "return=minimal" } }),
  deniedPatch(a, "fcg_room_members", { last_seen_at: new Date().toISOString() }),
  deniedPatch(a, "fcg_player_views", { version: version2 + 1 }),
]);
check("direct browser writes are denied", writeAttempts.every((result) => !result.ok), writeAttempts.map((result) => result.status).join(","));

for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}`);
console.log(`SUMMARY ${checks.filter(({ pass }) => pass).length}/${checks.length} live security checks passed`);
clearTimeout(hardTimeout);
setTimeout(() => process.exit(0), 50);
