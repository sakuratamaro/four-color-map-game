"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(__dirname, "..", "supabase", "migrations", "202608280001_online_quick_mvp.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

test("migration is additive and scoped to fcg objects", () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|schema|function|policy|extension)\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\s+(?!public\.fcg_rooms\b)/i);
  assert.match(sql, /create table if not exists public\.fcg_rooms/i);
  assert.match(sql, /create schema if not exists fcg_private/i);
});

test("all browser-readable tables enable RLS and deny direct writes", () => {
  for (const table of ["fcg_rooms", "fcg_room_members", "fcg_player_views"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, "i"));
    assert.match(sql, new RegExp(`grant select on table public\\.${table} to authenticated`, "i"));
  }
});

test("server-only RPCs are granted only to service_role", () => {
  for (const fn of ["fcg_server_initialize_room", "fcg_server_load_room", "fcg_server_commit_action", "fcg_server_cleanup_expired"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\([^;]+\\) to service_role`, "i"));
  }
});

test("every fcg SECURITY DEFINER function pins an empty search_path and qualifies data objects", () => {
  const functions = [
    "fcg_is_room_member",
    "fcg_create_room",
    "fcg_join_room",
    "fcg_server_initialize_room",
    "fcg_server_load_room",
    "fcg_server_commit_action",
    "fcg_server_cleanup_expired",
  ];
  for (const [index, name] of functions.entries()) {
    const start = sql.search(new RegExp(`create or replace function public\\.${name}\\(`, "i"));
    assert.notEqual(start, -1, `${name} must exist`);
    const nextName = functions[index + 1];
    const end = nextName ? sql.search(new RegExp(`create or replace function public\\.${nextName}\\(`, "i")) : sql.length;
    const body = sql.slice(start, end);
    assert.match(body, /security definer\s+set search_path\s*=\s*''/i, `${name} must pin search_path`);
    assert.doesNotMatch(
      body,
      /\b(?:from|into|update|join|delete\s+from)\s+(?:fcg_(?:rooms|room_members|player_views)\b|authoritative_matches\b|action_receipts\b)/i,
      `${name} must schema-qualify every data object`,
    );
  }
});

test("migration contains version, idempotency, realtime, and expiry controls", () => {
  assert.match(sql, /primary key \(room_id, action_id\)/i);
  assert.match(sql, /stale match version/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.fcg_rooms/i);
  assert.match(sql, /last_activity_at timestamptz/i);
  assert.match(sql, /expires_at timestamptz/i);
});

test("no credential value is present", () => {
  assert.doesNotMatch(sql, /sb_secret_/i);
  assert.doesNotMatch(sql, /service_role\s*[:=]\s*['\"][A-Za-z0-9._-]+/i);
  assert.doesNotMatch(sql, /postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/i);
});
