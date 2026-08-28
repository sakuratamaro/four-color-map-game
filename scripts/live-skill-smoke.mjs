import { readFile } from "node:fs/promises";

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create a live test match without --confirm-live.");
  process.exit(2);
}

const configSource = await readFile(new URL("../online/supabase-config.js", import.meta.url), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const hardTimeout = setTimeout(() => {
  console.error("Live skill smoke test exceeded its 150-second safety timeout.");
  process.exit(1);
}, 150_000);

const checks = [];
const COLORS = ["red", "blue", "yellow", "green"];
function check(name, condition, detail = "") {
  checks.push({ name, pass: Boolean(condition) });
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ""}`);
}

async function request(path, { token, method = "GET", body, headers = {}, timeout = 30_000 } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    signal: AbortSignal.timeout(timeout),
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
    method: "POST", body: {}, headers: { Authorization: `Bearer ${publishableKey}` },
  });
  check("anonymous sign-in", result.ok && typeof result.data?.access_token === "string");
  return { token: result.data.access_token };
}

async function rpc(name, token, body) {
  return request(`/rest/v1/rpc/${name}`, { token, method: "POST", body });
}

async function edge(token, body) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await request("/functions/v1/game-action", { token, method: "POST", body, timeout: 40_000 });
    } catch (error) {
      if (attempt || error?.name !== "TimeoutError") throw error;
    }
  }
  throw new Error("Edge Function request did not complete.");
}

function firstRow(data) { return Array.isArray(data) ? data[0] : data; }
function errorCode(result) { return result.data?.error?.code || result.data?.code || ""; }
function macrosAt(row, size) { return Array.from({ length: size }, (_, offset) => row * 12 + 1 + offset); }
function action(version, type, payload = {}) {
  return { id: crypto.randomUUID(), expectedVersion: version, type, payload };
}

const [a, b] = await Promise.all([anonymousSession(), anonymousSession()]);
const created = await rpc("fcg_create_room", a.token, { p_display_name: "LiveSkillA" });
const room = firstRow(created.data);
check("skill test room created", created.ok && room?.room_id && room?.room_code);
const joined = await rpc("fcg_join_room", b.token, { p_room_code: room.room_code, p_display_name: "LiveSkillB" });
check("skill test Player B joined", joined.ok);

let aView = await edge(a.token, { operation: "initialize", roomId: room.room_id });
let bView = await edge(b.token, { operation: "initialize", roomId: room.room_id });
check("skill test initialized", aView.ok && bView.ok);
const paletteA = aView.data.room.privateState.palette;
const paletteB = bView.data.room.privateState.palette;

let result = await edge(a.token, {
  operation: "action", roomId: room.room_id,
  action: action(aView.data.room.version, "CREATE_REGION", { macros: macrosAt(1, aView.data.room.publicState.requiredSize) }),
});
check("opening region created", result.ok);
bView = await edge(b.token, { operation: "initialize", roomId: room.room_id });
const firstColor = paletteB[0];
result = await edge(b.token, {
  operation: "action", roomId: room.room_id,
  action: action(bView.data.room.version, "COLOR_REGION", { color: firstColor }),
});
check("opening region colored", result.ok);

const sealedColor = paletteA.includes(firstColor) ? firstColor : paletteA[0];
const safeAColor = paletteA.find((color) => color !== sealedColor && color !== firstColor);
check("test seed has an alternate legal A color", Boolean(safeAColor));
result = await edge(b.token, {
  operation: "action", roomId: room.room_id,
  action: action(result.data.room.version, "USE_SKILL", { skill: "disruptChoiceOne", color: sealedColor }),
});
check("Color Seal activated", result.ok && result.data.room.publicState.seals.A[sealedColor] > 0);
result = await edge(b.token, {
  operation: "action", roomId: room.room_id,
  action: action(result.data.room.version, "CREATE_REGION", { macros: macrosAt(2, result.data.room.publicState.requiredSize) }),
});
check("second region created", result.ok);

aView = await edge(a.token, { operation: "initialize", roomId: room.room_id });
const sealedAttempt = await edge(a.token, {
  operation: "action", roomId: room.room_id,
  action: action(aView.data.room.version, "COLOR_REGION", { color: sealedColor }),
});
check("sealed color is rejected without advancing version", !sealedAttempt.ok && errorCode(sealedAttempt) === "COLOR_SEALED", `${sealedAttempt.status}/${errorCode(sealedAttempt)}`);
result = await edge(a.token, {
  operation: "action", roomId: room.room_id,
  action: action(aView.data.room.version, "COLOR_REGION", { color: safeAColor }),
});
check("alternate legal color succeeds", result.ok);
result = await edge(a.token, {
  operation: "action", roomId: room.room_id,
  action: action(result.data.room.version, "CREATE_REGION", { macros: macrosAt(3, result.data.room.publicState.requiredSize) }),
});
check("third region created", result.ok);

bView = await edge(b.token, { operation: "initialize", roomId: room.room_id });
check(
  "Color Seal curse rebounds onto its user",
  bView.data.room.publicState.curseBacklash.B === 0 && Object.values(bView.data.room.privateState.seals).some((count) => count > 0),
);
const safeBColor = COLORS.find((color) => color !== safeAColor && (bView.data.room.privateState.seals[color] || 0) === 0);
check("curse leaves at least one legal non-adjacent color", Boolean(safeBColor));
if (!paletteB.includes(safeBColor)) {
  bView = await edge(b.token, {
    operation: "action", roomId: room.room_id,
    action: action(bView.data.room.version, "USE_SKILL", { skill: "colorPrism" }),
  });
  check("Player B Four Color Release covers a cursed palette", bView.ok);
}
result = await edge(b.token, {
  operation: "action", roomId: room.room_id,
  action: action(bView.data.room.version, "COLOR_REGION", { color: safeBColor }),
});
check("third region colored", result.ok);

result = await edge(b.token, {
  operation: "action", roomId: room.room_id,
  action: action(result.data.room.version, "CREATE_REGION", { macros: macrosAt(4, result.data.room.publicState.requiredSize) }),
});
check("fourth region created", result.ok);
aView = await edge(a.token, { operation: "initialize", roomId: room.room_id });
result = await edge(a.token, {
  operation: "action", roomId: room.room_id,
  action: action(aView.data.room.version, "USE_SKILL", { skill: "colorPrism" }),
});
check("Four Color Release activated", result.ok && result.data.room.privateState.prismActive === true);
result = await edge(a.token, {
  operation: "action", roomId: room.room_id,
  action: action(result.data.room.version, "COLOR_REGION", { color: safeBColor }),
});
check(
  "adjacent same color causes authoritative loss",
  result.ok && result.data.room.status === "finished" && result.data.room.publicState.reason === "ILLEGAL_COLOR" && result.data.room.publicState.winner === "B",
);
const afterFinish = await edge(b.token, {
  operation: "action", roomId: room.room_id,
  action: action(result.data.room.version, "SURRENDER"),
});
check("post-finish skill match operation rejected", !afterFinish.ok && errorCode(afterFinish) === "ROOM_NOT_PLAYING");

for (const item of checks) console.log(`${item.pass ? "PASS" : "FAIL"}  ${item.name}`);
console.log(`SUMMARY ${checks.filter(({ pass }) => pass).length}/${checks.length} live skill checks passed`);
clearTimeout(hardTimeout);
setTimeout(() => process.exit(0), 50);
