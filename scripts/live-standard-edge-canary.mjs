import { readFile } from "node:fs/promises";

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing to create a live canary profile without --confirm-live.");
  process.exit(2);
}

const hardTimeout = setTimeout(() => {
  console.error("Standard Edge canary exceeded its 60-second safety timeout.");
  process.exit(1);
}, 60_000);

const configSource = await readFile(new URL("../online/supabase-config.js", import.meta.url), "utf8");
const url = configSource.match(/url:\s*"([^"]+)"/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*"([^"]+)"/)?.[1];
if (!url || !publishableKey) throw new Error("Public Supabase configuration is incomplete.");

const checks = [];
function check(name, condition, detail = "") {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ""}`);
}

async function request(path, { token, body, authorization } = {}) {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publishableKey,
      ...(authorization !== undefined
        ? { Authorization: authorization }
        : token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, ok: response.ok, data };
}

function mutateJwt(token) {
  const parts = token.split(".");
  const signature = parts[2];
  const index = Math.min(3, signature.length - 1);
  const replacement = signature[index] === "A" ? "B" : "A";
  parts[2] = `${signature.slice(0, index)}${replacement}${signature.slice(index + 1)}`;
  return parts.join(".");
}

const signup = await request("/auth/v1/signup", {
  authorization: `Bearer ${publishableKey}`,
  body: {},
});
check("anonymous sign-in", signup.ok && typeof signup.data?.access_token === "string", `status ${signup.status}`);
const token = signup.data.access_token;

const endpoint = "/functions/v1/standard-game-action";
const noJwt = await request(endpoint, { authorization: "", body: { operation: "cpu-roster" } });
check("missing JWT rejected", noJwt.status === 401, `status ${noJwt.status}`);

const changedJwt = await request(endpoint, {
  authorization: `Bearer ${mutateJwt(token)}`,
  body: { operation: "cpu-roster" },
});
check("modified JWT rejected", changedJwt.status === 401, `status ${changedJwt.status}`);

const profile = await request(endpoint, {
  token,
  body: { operation: "profile", expectedRevision: 0, displayName: "StandardCanary", profileState: {} },
});
check(
  "profile read succeeds",
  profile.ok && Number.isSafeInteger(profile.data?.revision) && profile.data?.profileState && typeof profile.data.profileState === "object",
  `status ${profile.status}`,
);

const cosmetics = await request(endpoint, { token, body: { operation: "cosmetic-catalog" } });
check(
  "cosmetic catalog succeeds",
  cosmetics.ok && cosmetics.data?.cosmetics && typeof cosmetics.data.cosmetics === "object",
  `status ${cosmetics.status}`,
);

const roster = await request(endpoint, { token, body: { operation: "cpu-roster" } });
const characters = roster.data?.characters;
const characterIds = Array.isArray(characters) ? characters.map((character) => character?.id) : [];
check(
  "CPU roster exposes ten unique characters",
  roster.ok && roster.data?.rosterVersion === "standard-character-roster-v1"
    && characterIds.length === 10 && new Set(characterIds).size === 10
    && characterIds.every((id) => typeof id === "string" && id.length > 0),
  `status ${roster.status}/count ${characterIds.length}`,
);

for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}`);
console.log(`SUMMARY ${checks.filter(({ pass }) => pass).length}/${checks.length} Standard Edge checks passed`);
clearTimeout(hardTimeout);
