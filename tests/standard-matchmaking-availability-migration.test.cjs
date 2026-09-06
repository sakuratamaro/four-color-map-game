"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "202609060003_standard_matchmaking_availability.sql",
), "utf8");

test("matchmaking availability exposes one privacy-preserving boolean snapshot", () => {
  assert.match(sql, /returns table \(\s*has_waiting_opponent boolean,\s*observed_at timestamptz\s*\)/i);
  assert.match(sql, /return query\s+select\s+exists \([\s\S]+\) as has_waiting_opponent,\s*pg_catalog\.statement_timestamp\(\) as observed_at/i);
  assert.match(sql, /ticket\.state = 'searching'/i);
  assert.match(sql, /ticket\.expires_at > pg_catalog\.statement_timestamp\(\)/i);
  assert.match(sql, /ticket\.user_id <> v_user_id/i);
  assert.match(sql, /member\.user_id = ticket\.user_id/i);
  assert.match(sql, /room\.game_mode = 'standard_v5'/i);
  assert.match(sql, /room\.status in \('waiting', 'ready', 'playing'\)/i);
  assert.match(sql, /room\.expires_at > pg_catalog\.statement_timestamp\(\)/i);
  assert.doesNotMatch(sql, /returns table \([^)]*(?:ticket_id|room_id|display_name|user_id|wait_started_at|waiting_count)/i);
});

test("matchmaking availability has a bounded live-search index", () => {
  assert.match(sql, /create index if not exists fcg_standard_matchmaking_expiry_cleanup_idx\s+on fcg_private\.standard_matchmaking_tickets \(expires_at, ticket_id\)\s+where state = 'searching'/i);
});

test("matchmaking availability is authenticated-only with a pinned definer boundary", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_matchmaking_availability\(\)/i);
  assert.match(sql, /language plpgsql\s+stable\s+security definer\s+set search_path = ''/i);
  assert.match(sql, /if v_user_id is null then\s+raise exception 'authentication required'/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_matchmaking_availability\(\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_matchmaking_availability\(\) to authenticated/i);
  assert.doesNotMatch(sql, /grant execute[^;]+to (?:public|anon)/i);
});
