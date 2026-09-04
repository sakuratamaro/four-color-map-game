"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609050001_standard_matchmaking_status_normalize.sql"), "utf8");

test("matchmaking status exposes claimed tickets as matched without leaking the private state", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_matchmaking_status\(p_ticket_id uuid\)/i);
  assert.match(sql, /case when v_ticket\.state = 'claimed' then 'matched'::text else v_ticket\.state end/i);
  assert.match(sql, /case when v_ticket\.state = 'claimed' then v_ticket\.room_id else null end/i);
  assert.match(sql, /case when v_ticket\.state = 'claimed' then 'A'::text else null::text end/i);
  assert.doesNotMatch(sql, /return query select p_ticket_id, v_ticket\.state,/i);
});

test("normalized status keeps its authenticated-only definer boundary", () => {
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /if v_user_id is null then raise exception 'authentication required'/i);
  assert.match(sql, /fcg_private\.fcg_standard_matchmaking_rate_limited\(v_user_id\)/i);
  assert.match(sql, /where ticket\.ticket_id = p_ticket_id and ticket\.user_id = v_user_id for update/i);
  assert.match(sql, /v_ticket\.state = 'searching' and v_ticket\.expires_at <= now\(\)/i);
  assert.match(sql, /set state = 'expired', resolved_at = now\(\)/i);
  assert.match(sql, /set heartbeat_at = now\(\), expires_at = now\(\) \+ interval '2 minutes'/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_matchmaking_status\(uuid\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_matchmaking_status\(uuid\) to authenticated/i);
});
