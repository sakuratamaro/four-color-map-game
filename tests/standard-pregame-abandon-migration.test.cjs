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
  "202609050007_standard_pregame_abandon.sql",
), "utf8");

function functionBody() {
  const start = sql.indexOf("create or replace function public.fcg_standard_abandon_room");
  const end = sql.indexOf("revoke all on function public.fcg_standard_abandon_room", start);
  assert.ok(start >= 0 && end > start);
  return sql.slice(start, end);
}

test("pregame abandon is an authenticated, pinned browser RPC with a private receipt", () => {
  assert.match(sql, /create table if not exists fcg_private\.standard_pregame_abandon_receipts/i);
  assert.match(sql, /primary key \(room_id, action_id\)/i);
  assert.match(sql, /request_fingerprint text not null[\s\S]+result jsonb not null/i);
  assert.match(sql, /alter table fcg_private\.standard_pregame_abandon_receipts enable row level security/i);
  assert.match(sql, /revoke all on table fcg_private\.standard_pregame_abandon_receipts[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /create or replace function public\.fcg_standard_abandon_room\([\s\S]+security definer[\s\S]+set search_path = ''/i);
  assert.match(sql, /v_user_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_abandon_room\(uuid, bigint, uuid\)[\s\S]+from public, anon, authenticated[\s\S]+grant execute[\s\S]+to authenticated/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]+to (?:anon|public)/i);
});

test("the client contract and receipt replay are stable and collision-safe", () => {
  const body = functionBody();
  assert.match(body, /returns table \([\s\S]+room_status text,[\s\S]+room_version bigint,[\s\S]+abandon_result text,[\s\S]+duplicate boolean,[\s\S]+server_time timestamptz/i);
  assert.match(body, /'operation', 'standard-pregame-abandon'[\s\S]+'actor_id', v_user_id[\s\S]+'room_id', p_room_id[\s\S]+'expected_version', p_expected_version/i);
  const roomLock = body.indexOf("for update;");
  const receiptRead = body.indexOf("from fcg_private.standard_pregame_abandon_receipts receipt");
  const duplicateReturn = body.indexOf("v_receipt.accepted_at", receiptRead);
  assert.ok(roomLock >= 0 && receiptRead > roomLock && duplicateReturn > receiptRead);
  assert.match(body, /v_receipt\.actor_id <> v_user_id[\s\S]+v_receipt\.request_fingerprint <> v_fingerprint/i);
  assert.match(body, /pregame abandon action id reuse'[\s\S]+errcode = '23505'/i);
  assert.match(body, /v_receipt\.result->>'abandonResult'[\s\S]+true,[\s\S]+v_receipt\.accepted_at/i);
});

test("only a room member can abandon a waiting or ready Standard room", () => {
  const body = functionBody();
  assert.match(body, /p_expected_version is null or p_expected_version < 0/i);
  assert.match(body, /v_room\.game_mode <> 'standard_v5'[\s\S]+STANDARD_PREGAME_ABANDON_NOT_ALLOWED'[\s\S]+errcode = '55000'/i);
  assert.match(body, /from public\.fcg_room_members member[\s\S]+member\.room_id = p_room_id and member\.user_id = v_user_id/i);
  assert.match(body, /actor is not a member'[\s\S]+errcode = '42501'/i);
  assert.match(body, /v_room\.status not in \('waiting', 'ready'\)[\s\S]+STANDARD_PREGAME_ABANDON_NOT_ALLOWED/i);
  assert.match(body, /v_room\.version <> p_expected_version[\s\S]+errcode = 'PT409'/i);
  assert.doesNotMatch(body, /status not in \('waiting', 'ready', 'playing'\)/i);
});

test("transition locks the room then try-locks every member in UUID order", () => {
  const body = functionBody();
  const roomLock = body.indexOf("for update;");
  const memberOrder = body.indexOf("order by member.user_id");
  const tryLock = body.indexOf("pg_try_advisory_xact_lock", memberOrder);
  const update = body.indexOf("update public.fcg_rooms", tryLock);
  assert.ok(roomLock >= 0 && memberOrder > roomLock && tryLock > memberOrder && update > tryLock);
  assert.match(body, /STANDARD_ACTOR_BUSY'[\s\S]+errcode = '40001'/i);
  assert.doesNotMatch(body, /perform pg_catalog\.pg_advisory_xact_lock/i);
});

test("applied abandon advances only room lifecycle fields and retains game-adjacent data", () => {
  const body = functionBody();
  const updateStart = body.indexOf("update public.fcg_rooms");
  const updateEnd = body.indexOf("if not found", updateStart);
  const update = body.slice(updateStart, updateEnd);
  assert.match(update, /status = 'abandoned'/i);
  assert.match(update, /version = p_expected_version \+ 1/i);
  assert.match(update, /finished_at = now\(\)/i);
  assert.match(update, /updated_at = now\(\)[\s\S]+last_activity_at = now\(\)[\s\S]+expires_at = now\(\) \+ interval '24 hours'/i);
  assert.match(update, /status in \('waiting', 'ready'\)[\s\S]+version = p_expected_version/i);
  for (const unchanged of ["winner_seat", "public_state"]) assert.doesNotMatch(update, new RegExp(`${unchanged}\\s*=` , "i"));
  assert.doesNotMatch(body, /(?:delete|update)\s+(?:from\s+)?public\.fcg_room_members/i);
  assert.doesNotMatch(body, /(?:delete|update)\s+(?:from\s+)?fcg_private\.standard_room_setups/i);
  assert.doesNotMatch(body, /(?:delete|update)\s+(?:from\s+)?fcg_private\.standard_matchmaking_tickets/i);
  assert.doesNotMatch(body, /(?:delete|update)\s+(?:from\s+)?fcg_private\.authoritative_matches/i);
  assert.doesNotMatch(body, /(?:delete|update)\s+(?:from\s+)?public\.fcg_(?:standard_profiles|player_views)/i);
});

test("a separate action against an abandoned room gets a durable no-op receipt", () => {
  const body = functionBody();
  const start = body.indexOf("if v_room.status = 'abandoned' then");
  const end = body.indexOf("if v_room.status not in", start);
  assert.ok(start >= 0 && end > start);
  const noOp = body.slice(start, end);
  assert.match(noOp, /'abandonResult', 'already_abandoned'/i);
  assert.match(noOp, /insert into fcg_private\.standard_pregame_abandon_receipts/i);
  assert.match(noOp, /return query select 'abandoned'::text, v_room\.version, 'already_abandoned'::text, false/i);
  assert.doesNotMatch(noOp, /update public\.fcg_rooms/i);
});

test("static transaction model makes retries exact and concurrent member requests finite", () => {
  const state = { status: "ready", version: 4, receipts: new Map() };
  const abandon = ({ actor, action, expected }) => {
    const key = action;
    const fingerprint = `${actor}:${expected}`;
    const prior = state.receipts.get(key);
    if (prior) return prior.fingerprint === fingerprint ? { ...prior.result, duplicate: true } : { error: "23505" };
    if (!new Set(["host", "guest"]).has(actor)) return { error: "42501" };
    let result;
    if (state.status === "abandoned") result = { status: "abandoned", version: state.version, kind: "already_abandoned" };
    else if (!new Set(["waiting", "ready"]).has(state.status)) return { error: "55000" };
    else if (state.version !== expected) return { error: "PT409" };
    else {
      state.status = "abandoned";
      state.version += 1;
      result = { status: state.status, version: state.version, kind: "applied" };
    }
    state.receipts.set(key, { fingerprint, result });
    return { ...result, duplicate: false };
  };

  assert.deepEqual(abandon({ actor: "host", action: "action-a", expected: 4 }), {
    status: "abandoned", version: 5, kind: "applied", duplicate: false,
  });
  assert.deepEqual(abandon({ actor: "host", action: "action-a", expected: 4 }), {
    status: "abandoned", version: 5, kind: "applied", duplicate: true,
  });
  assert.deepEqual(abandon({ actor: "guest", action: "action-b", expected: 4 }), {
    status: "abandoned", version: 5, kind: "already_abandoned", duplicate: false,
  });
  assert.deepEqual(abandon({ actor: "guest", action: "action-b", expected: 99 }), { error: "23505" });
});
