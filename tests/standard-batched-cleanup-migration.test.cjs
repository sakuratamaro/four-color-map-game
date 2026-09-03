"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030012_batched_cleanup.sql"), "utf8");

test("cleanup is preview-first, service-only, threshold guarded, and batch bounded", () => {
  assert.match(sql, /p_dry_run boolean default true/i);
  assert.match(sql, /p_batch_size is null or p_batch_size not between 1 and 500/i);
  assert.match(sql, /p_ephemeral_before > now\(\) - interval '1 hour'/i);
  assert.match(sql, /p_receipt_before > now\(\) - interval '7 days'/i);
  assert.match(sql, /limit p_batch_size for update skip locked/ig);
  assert.match(sql, /revoke all on function public\.fcg_server_cleanup_expired_batched[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.fcg_server_cleanup_expired_batched[\s\S]+to service_role/i);
  assert.doesNotMatch(sql, /grant execute[^;]+to authenticated/i);
});

test("cleanup preserves active data and returns finite per-category counts", () => {
  assert.match(sql, /room\.expires_at < p_room_before and room\.last_activity_at < p_room_before/i);
  assert.match(sql, /ticket\.state = 'searching' and ticket\.expires_at < p_ephemeral_before/i);
  assert.match(sql, /ticket\.state in \('claimed','cancelled','expired'\)/i);
  assert.match(sql, /coalesce\(quiz\.completed_at, quiz\.expires_at\) < p_ephemeral_before/i);
  for (const key of ["rooms", "tickets_expired", "tickets_deleted", "find_receipts", "quiz_sessions", "gacha_receipts", "card_sale_receipts", "cosmetic_receipts", "rate_limit_rows"]) {
    assert.match(sql, new RegExp(`'${key}'`));
  }
});

test("legacy room cleanup is no longer unbounded", () => {
  const legacy = sql.slice(sql.lastIndexOf("create or replace function public.fcg_server_cleanup_expired("));
  assert.match(legacy, /limit 100 for update skip locked/i);
  assert.match(legacy, /room\.expires_at < p_before and room\.last_activity_at < p_before/i);
});
