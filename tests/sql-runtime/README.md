# Isolated SQL acceptance

These development dependencies are never part of the game bundles. Install the pinned dependencies with `pnpm --dir tests/sql-runtime install --frozen-lockfile --ignore-scripts`. The existing Windows workflow installs the same pinned PGlite/pg versions with its browser dependencies.

## Two distinct runtimes

- Default `cpu-sql-runtime.cjs`: a fresh in-memory PGlite database. All application migrations, functions, triggers, ACLs and RLS run; Supabase identity/platform services and pgcrypto registration are fixtures. Serial calls do not prove multi-session behavior.
- `standard-cpu-progression-postgres.test.cjs`: PostgreSQL 17 and real pgcrypto. Set `FCG_TEST_POSTGRES_BIN` to its `bin` directory, then run `node --test --test-concurrency=1 tests/standard-cpu-progression-postgres.test.cjs`. Missing configuration is an explicit NOT_RUN/skip, not a passed race gate. The Windows Chrome CI step supplies an explicit path, so missing binaries fail that gate.

The native helper creates its own temporary cluster, random disposable password and loopback port. It never reads a production database URL, uses an existing data directory, starts a service, or changes machine configuration. It strips inherited PostgreSQL environment settings, limits resources and timeouts, and stops its exact server before removing only its marked temporary directory. Non-ASCII Windows binary paths are staged inside that temporary area to avoid PostgreSQL bootstrap encoding failure. Command completion uses process exit rather than inherited daemon pipe closure; cleanup is asynchronous so Windows can release directory handles.

Race evidence includes independent backend PIDs, `pg_stat_activity`, and direct or transitive `pg_blocking_pids` paths to the held transaction. The tests release a known lock holder only after observing the actual wait. Concurrent promises on one connection are not accepted as evidence. The old full-JSON writer case is a privileged trigger fixture, not a claim that an authenticated browser can update the private tables.

## Native browser connection

`STANDARD_BROWSER=chrome` or `edge` selects the installed browser for `tests/standard-cpu-progression-browser.test.cjs`. The unmodified page/client calls the actual TypeScript worker, generated engine and isolated PGlite SQL. Only SDK authentication, transport, entropy and realtime notification are fixtures; all other external requests are blocked. Lost replies are dropped after actual commit. Normal CPU actions use the actual versioned policy. Native clicks and keyboard actions are not forced or synthesized DOM events.

SQL `SELECT * FROM scalar_function()` returns a named-column wrapper whereas PostgREST returns the scalar. `postgrestRpcResult` normalizes only that scalar shape; table results remain arrays. This adapter is test infrastructure, not a game/API behavior change.

The progression fixture fixes the SQL platform UUID sequence as well as worker entropy. Room IDs seed real CPU tie breaks, so unseeded UUIDs made a representative WIN test randomly exhaust its finite strategy-search budget. Pinning UUIDs exposed two repeatable failures: the simulated human was using ordinary pre-pilot Ren ranking, which cannot select the disclosed 解封 loan. The human acceptance strategy now considers a useful legal unseal before that ordinary ranking; the actual opposing CPU policy, application SQL and 32-seed limit remain unchanged. Two fixed failing IDs have replay regressions that also verify every opposing move against the actual CPU policy. Native PostgreSQL still provides real transactions/locks/ACLs and pgcrypto digest/random bytes; UUID entropy itself is a fixture, not a cryptographic validation claim. This is deterministic acceptance coverage, not randomized balance testing.

## Staged version rehearsal

`standard-cpu-progression-rollout.test.cjs` reads the exact old worker and bundle from public baseline `70e691b6f8f1d808476e80990d20df7862bfb782` in Git. The Windows checkout retains history for that purpose, with credentials still not persisted. No network fetch occurs inside the test. The shared fixture can defer only the three pilot migrations, so the old/new-worker combinations run against the baseline and then against the same database after additive migration. It preserves the already-published `FCG_CPU_SPLIT_RESCUE=standard-character-split-rescue-v1` configuration, verifies real ordinary CPU turns and preserves learned ownership through disabling/re-enabling new creation.

The default worker fixture now uses that current split policy; explicit legacy fixtures remain possible. Earlier native-checkpoint results used the helper's default legacy policy for ordinary CPU games and are not rewritten as current-policy evidence. The baseline includes published migration 202609130001; the unrelated, unpublished palette-efficiency proposal is not imported. The first staged run failed because the old validator requires the `firstWinAt` key; the newer missing-date fixture was inappropriate for an old-release starter profile. That failure and dependent failures are preserved. The corrected case uses the old engine's actual starter profile, without weakening either validator.

This is a local compatibility rehearsal, not evidence that cloud workers drained, management settings changed, production SQL was applied, or any version was published.

## Reproducible binary provenance

Local 2026-09-14 validation used the [official PostgreSQL Windows distribution route](https://www.postgresql.org/download/windows/) to [EDB binary archives](https://www.enterprisedb.com/download-postgresql-binaries): `postgresql-17.11-3-windows-x64-binaries.zip`, 341325378 bytes, observed SHA256 `4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf`. This is a recorded local hash, not a claimed publisher signature. Only bin/lib/share and license files were extracted, without pgAdmin or an installer.

The [Windows 2025 runner inventory](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md) currently lists PostgreSQL 17 binaries. The workflow uses those binaries, not its pre-existing data or service. Initialization/shutdown follows [initdb](https://www.postgresql.org/docs/17/app-initdb.html) and [pg_ctl](https://www.postgresql.org/docs/17/app-pg-ctl.html).

Local PASS does not establish hosted Windows CI, the Supabase gateway/auth/realtime service, production deployment, physical-device acceptance, or a candidate-specific Astra approval.
