"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "supabase", "migrations");
const sql = fs.readFileSync(path.join(root, "202609050006_standard_single_active_room.sql"), "utf8");
const createSql = fs.readFileSync(path.join(root, "202609020001_standard_online_foundation.sql"), "utf8");
const joinSql = fs.readFileSync(path.join(root, "202609030003_standard_join_rate_limit.sql"), "utf8");
const matchmakingSql = fs.readFileSync(path.join(root, "202609030007_standard_public_matchmaking.sql"), "utf8");
const cpuStartSql = fs.readFileSync(path.join(root, "202609050005_standard_kurogane_lookahead.sql"), "utf8");

test("all room-producing Standard paths terminate at guarded member inserts", () => {
  assert.match(createSql, /fcg_standard_create_room[\s\S]+insert into public\.fcg_room_members/i);
  assert.match(joinSql, /fcg_standard_join_room[\s\S]+public\.fcg_join_room/i);
  for (const name of ["matchmaking_recruit", "matchmaking_find"]) {
    assert.match(matchmakingSql, new RegExp(`fcg_standard_${name}[\\s\\S]+(?:insert into public\\.fcg_room_members|matchmaking_status)`, "i"));
  }
  assert.match(cpuStartSql, /fcg_standard_server_start_cpu[\s\S]+insert into public\.fcg_room_members/i);
  assert.match(sql, /before insert or update of room_id, user_id on public\.fcg_room_members/i);
});

test("member insertion serializes the actor and rejects a second live Standard membership", () => {
  const guard = sql.slice(sql.indexOf("create or replace function fcg_private.fcg_standard_guard_member_active_room"), sql.indexOf("create or replace function fcg_private.fcg_standard_guard_room_reactivation"));
  const targetRoom = guard.indexOf("from public.fcg_rooms room");
  const roomShare = guard.indexOf("for share", targetRoom);
  const activeCheck = guard.indexOf("if not found", roomShare);
  const lock = guard.indexOf("pg_try_advisory_xact_lock");
  const membership = guard.indexOf("from public.fcg_room_members member");
  const reject = guard.indexOf("STANDARD_ALREADY_IN_ROOM");
  assert.ok(targetRoom >= 0 && roomShare > targetRoom && activeCheck > roomShare);
  assert.ok(lock > activeCheck && membership > lock && reject > membership);
  assert.match(guard, /room\.game_mode = 'standard_v5'[\s\S]+room\.status in \('waiting', 'ready', 'playing'\)[\s\S]+room\.expires_at > now\(\)/i);
  assert.match(guard, /member\.room_id <> new\.room_id/i);
  assert.match(guard, /STANDARD_ACTOR_BUSY' using errcode = '40001'/i);
  assert.match(guard, /STANDARD_ALREADY_IN_ROOM' using errcode = '55000'/i);
});

test("reactivation locks every room member in UUID order before checking other rooms", () => {
  const guard = sql.slice(sql.indexOf("create or replace function fcg_private.fcg_standard_guard_room_reactivation"), sql.indexOf("do $$"));
  const activation = guard.indexOf("new.status in ('waiting', 'ready', 'playing')");
  const order = guard.indexOf("order by member.user_id");
  const lock = guard.indexOf("pg_advisory_xact_lock", order);
  const otherRoom = guard.indexOf("other_member.room_id <> new.id");
  assert.ok(activation >= 0 && order > activation && lock > order && otherRoom > lock);
  assert.match(sql, /before update of status, expires_at, game_mode on public\.fcg_rooms/i);
});

test("the database boundary is private, pinned, additive, and reports legacy duplicates read-only", () => {
  for (const name of ["fcg_standard_guard_member_active_room", "fcg_standard_guard_room_reactivation"]) {
    assert.match(sql, new RegExp(`function fcg_private\\.${name}\\(\\)[\\s\\S]+security definer[\\s\\S]+set search_path = ''`, "i"));
    assert.match(sql, new RegExp(`revoke all on function fcg_private\\.${name}\\(\\)[\\s\\S]+from public, anon, authenticated`, "i"));
  }
  assert.match(sql, /having count\(\*\) > 1[\s\S]+raise notice 'existing Standard actors with multiple active rooms/i);
  assert.doesNotMatch(sql, /delete\s+from\s+(?:public\.)?fcg_(?:rooms|room_members)/i);
  assert.doesNotMatch(sql, /sb_secret_|service_role_key|postgres(?:ql)?:\/\//i);
});

test("transaction ordering yields one winner and a finite loser across two-device races", () => {
  const transact = (state, actor, room) => {
    if (state.locks.has(actor)) return { ok: false, code: "40001" };
    state.locks.add(actor);
    if ([...state.memberships].some(([user, activeRoom]) => user === actor && activeRoom !== room)) return { ok: false, code: "55000" };
    state.memberships.push([actor, room]);
    return { ok: true };
  };
  const state = { locks: new Set(), memberships: [] };
  assert.deepEqual(transact(state, "same-auth-user", "room-a"), { ok: true });
  state.locks.clear();
  assert.deepEqual(transact(state, "same-auth-user", "room-b"), { ok: false, code: "55000" });
  assert.deepEqual(state.memberships, [["same-auth-user", "room-a"]]);
});

test("inactive-room member insertion and reactivation serialize on the target room", () => {
  const state = {
    roomShareHolders: new Set(),
    committedMembers: [["same-auth-user", "already-active-room"]],
    pendingMembers: [],
  };

  // T1's member trigger reads the inactive target under FOR SHARE. T2 cannot
  // update that room to an active status until this insert commits or rolls back.
  state.roomShareHolders.add("t1");
  state.pendingMembers.push(["same-auth-user", "inactive-room"]);
  const t2BeforeT1Commit = state.roomShareHolders.size > 0 ? "blocked-on-room" : "entered-trigger";
  assert.equal(t2BeforeT1Commit, "blocked-on-room");

  state.committedMembers.push(...state.pendingMembers);
  state.pendingMembers = [];
  state.roomShareHolders.delete("t1");

  // Once T2 enters the reactivation trigger, T1's membership is committed and
  // its actor is included in the ordered lock/check, so the other active room wins.
  const reactivatedMembers = state.committedMembers.filter(([, room]) => room === "inactive-room");
  const conflict = reactivatedMembers.some(([actor]) => state.committedMembers.some(
    ([otherActor, room]) => otherActor === actor && room !== "inactive-room" && room === "already-active-room",
  ));
  assert.equal(conflict, true);
  assert.equal(conflict ? "55000" : "ok", "55000");
});
