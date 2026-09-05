"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "scripts", "capture-standard-release-observation.mjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const modulePromise = import(`${pathToFileURL(scriptPath).href}?test=${Date.now()}`);
const fakeHead = "e36dfccf256955c261e3c87eb0734482433d84b3";

function validInput(overrides = {}) {
  return {
    capturedAt: "2026-09-05T12:00:00.000Z",
    window: {
      preset: "last-24-hours",
      from: "2026-09-04T12:00:00.000Z",
      to: "2026-09-05T12:00:00.000Z",
    },
    release: {
      publicAssetCommit: "e0f4f98",
      pagesCommit: "c0b4f77",
      pagesRun: "33949936952",
      migrationTail: "202609050005",
    },
    metrics: {
      "database.cpu_pct": {
        state: "OBSERVED",
        value: 0,
        source: "dashboard.database",
      },
      "advisor.health_alerts": {
        state: "OBSERVED",
        value: [],
        source: "dashboard.advisor",
      },
    },
    ...overrides,
  };
}

function withJsonFiles(input, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "standard-observation-"));
  const inputPath = path.join(directory, "input.json");
  fs.writeFileSync(inputPath, JSON.stringify(input));
  try {
    return callback({ directory, inputPath });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function dependencies(counter = { calls: 0 }) {
  return {
    getRepositoryHead: () => fakeHead,
    runPublicPreflight: () => {
      counter.calls += 1;
      return { state: "OBSERVED", ok: true, expectedPhase: "candidate" };
    },
  };
}

test("T0 preserves observed zero, fills missing metrics as PENDING, and separates release identities", async () => {
  const { buildObservation } = await modulePromise;
  withJsonFiles(validInput(), ({ inputPath }) => {
    const output = buildObservation(["--label=T0", `--input=${inputPath}`], dependencies());
    assert.equal(output.release.repositoryHead, fakeHead);
    assert.equal(output.release.publicAssetCommit, "e0f4f98");
    assert.equal(output.release.pagesCommit, "c0b4f77");
    assert.equal(output.release.pagesRun, "33949936952");
    assert.equal(output.metrics["database.cpu_pct"].state, "OBSERVED");
    assert.equal(output.metrics["database.cpu_pct"].value, 0);
    assert.deepEqual(output.metrics["api.p95_ms"], {
      state: "PENDING",
      value: null,
      unit: "milliseconds",
      reason: "not_provided",
    });
    assert.deepEqual(output.physicalTwoDeviceAcceptance, {
      gateState: "PENDING",
      executionState: "NOT_RUN",
      automated: false,
      reasonCode: "REQUIRES_TWO_PHYSICAL_DEVICES",
    });
  });
});

test("query-performance values stay explicitly cumulative and advisor severities stay separate", async () => {
  const { buildObservation } = await modulePromise;
  withJsonFiles(validInput({
    metrics: {
      "query.realtime_list_changes.calls": { state: "OBSERVED", value: 68723, source: "dashboard.query-performance" },
      "advisor.security_errors": { state: "OBSERVED", value: 0, source: "dashboard.advisor" },
      "advisor.security_warnings": { state: "OBSERVED", value: 19, source: "dashboard.advisor" },
      "advisor.security_suggestions": { state: "OBSERVED", value: 15, source: "dashboard.advisor" },
    },
  }), ({ inputPath }) => {
    const output = buildObservation(["--label=T0", `--input=${inputPath}`], dependencies());
    assert.equal(output.metrics["query.realtime_list_changes.calls"].aggregation, "pg_stat_statements_cumulative");
    assert.ok(output.warnings.includes("QUERY_METRICS_ARE_PG_STAT_STATEMENTS_CUMULATIVE"));
    assert.equal(output.metrics["advisor.security_errors"].value, 0);
    assert.equal(output.metrics["advisor.security_warnings"].value, 19);
    assert.equal(output.metrics["advisor.security_suggestions"].value, 15);
  });
});

test("default repository identity is read from the current checkout and still differs from public release inputs", async () => {
  const { buildObservation } = await modulePromise;
  withJsonFiles(validInput(), ({ inputPath }) => {
    const expected = spawnSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).stdout.trim().toLowerCase();
    const output = buildObservation(
      ["--label=T0", `--input=${inputPath}`],
      { runPublicPreflight: dependencies().runPublicPreflight },
    );
    assert.equal(output.release.repositoryHead, expected);
    assert.notEqual(output.release.repositoryHead, output.release.publicAssetCommit);
    assert.notEqual(output.release.repositoryHead, output.release.pagesCommit);
  });
});

test("T+24h requires a T0 baseline and warns instead of passing an early comparison", async () => {
  const { buildObservation, SafeObservationError } = await modulePromise;
  withJsonFiles(validInput(), ({ inputPath }) => {
    assert.throws(
      () => buildObservation(["--label=T+24h", `--input=${inputPath}`], dependencies()),
      (error) => error instanceof SafeObservationError && error.code === "BASELINE_REQUIRED",
    );

    const baseline = buildObservation(["--label=T0", `--input=${inputPath}`], dependencies());
    const baselinePath = path.join(path.dirname(inputPath), "baseline.json");
    fs.writeFileSync(baselinePath, JSON.stringify(baseline));
    const current = validInput({ capturedAt: "2026-09-06T11:00:00.000Z" });
    fs.writeFileSync(inputPath, JSON.stringify(current));
    const output = buildObservation(
      ["--label=T+24h", `--input=${inputPath}`, `--baseline=${baselinePath}`],
      dependencies(),
    );
    assert.equal(output.comparison.intervalHours, 23);
    assert.ok(output.warnings.includes("CAPTURE_INTERVAL_UNDER_24_HOURS"));
    assert.equal(output.comparison.metrics["database.cpu_pct"].value, 0);
    assert.equal(output.comparison.metrics["api.p95_ms"].state, "PENDING");
    assert.equal(output.physicalTwoDeviceAcceptance.automated, false);
  });
});

test("a tampered or non-T0 baseline is rejected before preflight", async () => {
  const { buildObservation } = await modulePromise;
  withJsonFiles(validInput(), ({ inputPath }) => {
    const baseline = buildObservation(["--label=T0", `--input=${inputPath}`], dependencies());
    baseline.label = "T+24h";
    baseline.physicalTwoDeviceAcceptance.automated = true;
    const baselinePath = path.join(path.dirname(inputPath), "tampered-baseline.json");
    fs.writeFileSync(baselinePath, JSON.stringify(baseline));
    const counter = { calls: 0 };
    assert.throws(
      () => buildObservation(
        ["--label=T+24h", `--input=${inputPath}`, `--baseline=${baselinePath}`],
        dependencies(counter),
      ),
      (error) => error.code === "INVALID_BASELINE",
    );
    assert.equal(counter.calls, 0);
  });
});

test("secret keys, secret-shaped values, and unknown paths are rejected before preflight", async () => {
  const { buildObservation, runCli } = await modulePromise;
  for (const input of [
    { ...validInput(), service_role: "do-not-print-me" },
    { ...validInput(), release: { ...validInput().release, edgeDeployment: { state: "PENDING", value: null, reason: "Bearer do-not-print-me" } } },
    { ...validInput(), unexpected: 1 },
    { ...validInput(), metrics: { "not.on.allowlist": { state: "OBSERVED", value: 1, source: "dashboard.api" } } },
  ]) {
    withJsonFiles(input, ({ inputPath }) => {
      const counter = { calls: 0 };
      const stdout = [];
      const stderr = [];
      const exitCode = runCli(
        ["--label=T0", `--input=${inputPath}`],
        dependencies(counter),
        { stdout: { write: (chunk) => stdout.push(chunk) }, stderr: { write: (chunk) => stderr.push(chunk) } },
      );
      assert.equal(exitCode, 2);
      assert.equal(counter.calls, 0, "preflight must not start for invalid input");
      assert.equal(stdout.join(""), "");
      assert.equal(stderr.length, 1);
      assert.doesNotMatch(stderr[0], /do-not-print-me|not\.on\.allowlist|unexpected|service_role/);
      const error = JSON.parse(stderr[0]);
      assert.match(error.error.path, /^\$(?:input|argv|baseline)?(?:\.|$)/);
    });
  }

  // Direct exceptions also expose only stable codes and safe paths.
  withJsonFiles({ ...validInput(), password: "another-secret" }, ({ inputPath }) => {
    assert.throws(
      () => buildObservation(["--label=T0", `--input=${inputPath}`], dependencies()),
      (error) => error.code === "FORBIDDEN_FIELD" && error.safePath.endsWith(".[forbidden]"),
    );
  });
});

test("input and baseline JSON are independently limited to 64 KiB", async () => {
  const { buildObservation } = await modulePromise;
  withJsonFiles(validInput(), ({ directory, inputPath }) => {
    const oversizedPath = path.join(directory, "oversized.json");
    fs.writeFileSync(oversizedPath, Buffer.alloc(64 * 1024 + 1, 0x20));
    let counter = { calls: 0 };
    assert.throws(
      () => buildObservation(["--label=T0", `--input=${oversizedPath}`], dependencies(counter)),
      (error) => error.code === "INPUT_TOO_LARGE" && error.safePath === "$input",
    );
    assert.equal(counter.calls, 0);

    counter = { calls: 0 };
    assert.throws(
      () => buildObservation(
        ["--label=T+24h", `--input=${inputPath}`, `--baseline=${oversizedPath}`],
        dependencies(counter),
      ),
      (error) => error.code === "INPUT_TOO_LARGE" && error.safePath === "$baseline",
    );
    assert.equal(counter.calls, 0);
  });
});

test("successful CLI writes exactly one JSON document to stdout and nothing to stderr", async () => {
  const { runCli } = await modulePromise;
  withJsonFiles(validInput(), ({ inputPath }) => {
    const stdout = [];
    const stderr = [];
    const exitCode = runCli(
      ["--label=T0", `--input=${inputPath}`],
      dependencies(),
      { stdout: { write: (chunk) => stdout.push(chunk) }, stderr: { write: (chunk) => stderr.push(chunk) } },
    );
    assert.equal(exitCode, 0);
    assert.equal(stderr.join(""), "");
    assert.equal(stdout.length, 1);
    assert.equal(stdout[0].trim().split("\n").length, 1);
    assert.equal(JSON.parse(stdout[0]).schemaVersion, "standard-release-observation-v1");
  });
});

test("implementation is read-only and invokes the existing candidate preflight through an injectable boundary", () => {
  assert.match(scriptSource, /live-standard-release-preflight\.mjs/);
  assert.match(scriptSource, /--expect=candidate/);
  assert.match(scriptSource, /dependencies\.runPublicPreflight/);
  assert.doesNotMatch(scriptSource, /signInAnonymously|writeFile|appendFile|unlink|rmSync|method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
});
