import { readFile } from "node:fs/promises";

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create live test users/rooms without --confirm-live.");
  process.exit(2);
}

const configSource = await readFile(new URL("../online/supabase-config.js", import.meta.url), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const hardTimeout = setTimeout(() => {
  console.error("Live Realtime smoke test exceeded its 35-second safety timeout.");
  process.exit(1);
}, 35_000);
hardTimeout.unref();
const liveSockets = new Set();

function trackSocket(socket) {
  liveSockets.add(socket);
  socket.addEventListener("close", () => liveSockets.delete(socket), { once: true });
  return socket;
}

function closeLiveSockets() {
  for (const socket of liveSockets) {
    try { socket.close(); } catch { /* best-effort cleanup */ }
  }
  liveSockets.clear();
}

process.once("uncaughtException", (error) => {
  closeLiveSockets();
  clearTimeout(hardTimeout);
  console.error(error);
  process.exit(1);
});

async function request(path, { token, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    signal: AbortSignal.timeout(15_000),
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
  if (!result.ok || typeof result.data?.access_token !== "string") throw new Error(`Anonymous sign-in failed (${result.status}).`);
  return { token: result.data.access_token };
}

async function rpc(name, token, body) {
  return request(`/rest/v1/rpc/${name}`, { token, method: "POST", body });
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function waitFor(predicate, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (predicate()) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error(message));
      setTimeout(poll, 50);
    };
    poll();
  });
}

async function subscribe(session, roomId) {
  const socketUrl = `${url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(publishableKey)}&vsn=1.0.0`;
  const socket = trackSocket(new WebSocket(socketUrl));
  const messages = [];
  socket.addEventListener("message", (event) => {
    try { messages.push(JSON.parse(event.data)); } catch { /* ignore */ }
  });
  await waitFor(
    () => socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSED,
    6_000,
    "Realtime websocket did not connect.",
  );
  if (socket.readyState !== WebSocket.OPEN) throw new Error("Realtime websocket closed before joining.");
  socket.send(JSON.stringify({
    topic: `realtime:public:fcg_rooms:id=eq.${roomId}`,
    event: "phx_join",
    payload: {
      config: {
        broadcast: { self: false },
        presence: { key: "" },
        postgres_changes: [{ event: "UPDATE", schema: "public", table: "fcg_rooms", filter: `id=eq.${roomId}` }],
      },
      access_token: session.token,
    },
    ref: "1",
    join_ref: "1",
  }));
  await waitFor(
    () => messages.some((message) => message.event === "phx_reply" && String(message.ref) === "1" && message.payload?.status === "ok"),
    6_000,
    `Realtime join did not become ready: ${JSON.stringify(messages.map((message) => ({ event: message.event, ref: message.ref, status: message.payload?.status, reason: message.payload?.response?.reason })))}`,
  );
  return { socket, messages };
}

const a = await anonymousSession();
const b = await anonymousSession();
const c = await anonymousSession();
const created = await rpc("fcg_create_room", a.token, { p_display_name: "RealtimeA" });
const room = firstRow(created.data);
if (!created.ok || !room?.room_id || !room?.room_code) throw new Error(`Room creation failed (${created.status}).`);
console.log(`CLEANUP_ROOM ${room.room_id}`);

const subscriptions = await Promise.allSettled([subscribe(a, room.room_id), subscribe(c, room.room_id)]);
if (subscriptions.some((result) => result.status === "rejected")) {
  for (const result of subscriptions) if (result.status === "fulfilled") result.value.socket.close();
  throw subscriptions.find((result) => result.status === "rejected").reason;
}
const [member, outsider] = subscriptions.map((result) => result.value);

await new Promise((resolve) => setTimeout(resolve, 250));
const joined = await rpc("fcg_join_room", b.token, { p_room_code: room.room_code, p_display_name: "RealtimeB" });
if (!joined.ok || !firstRow(joined.data)?.room_id) throw new Error(`Player B join failed (${joined.status}).`);

const isDatabaseChange = (message) => message.event === "postgres_changes" || message.event === "UPDATE";
await waitFor(
  () => member.messages.some(isDatabaseChange),
  8_000,
  "Member did not receive the authorized Realtime update.",
);
await new Promise((resolve) => setTimeout(resolve, 2_000));
const memberSawUpdate = member.messages.some(isDatabaseChange);
const outsiderSawUpdate = outsider.messages.some(isDatabaseChange);
member.socket.close();
outsider.socket.close();
closeLiveSockets();

if (!memberSawUpdate) throw new Error("Member did not receive the authorized Realtime update.");
if (outsiderSawUpdate) throw new Error("Third party received a Realtime update blocked by RLS.");
console.log("PASS  member receives authorized room Realtime update");
console.log("PASS  third party receives no Realtime update");
console.log("SUMMARY 2/2 live Realtime checks passed");
clearTimeout(hardTimeout);
setTimeout(() => process.exit(0), 50);
