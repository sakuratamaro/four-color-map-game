import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_INPUT_BYTES = 64 * 1024;
const SCHEMA_VERSION = "standard-release-observation-v1";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");

const SOURCES = new Set([
  "dashboard.database",
  "dashboard.api",
  "dashboard.edge",
  "dashboard.egress",
  "dashboard.realtime",
  "dashboard.query-performance",
  "dashboard.advisor",
]);

const METRIC_SPECS = Object.freeze({
  "database.cpu_pct": { unit: "percent", aggregation: "window_peak", kind: "percent" },
  "database.ram_pct": { unit: "percent", aggregation: "window_peak", kind: "percent" },
  "database.disk_pct": { unit: "percent", aggregation: "window_peak", kind: "percent" },
  "database.disk_io_pct": { unit: "percent", aggregation: "window_peak", kind: "percent" },
  "database.connections_current": { unit: "count", aggregation: "window_end", kind: "number" },
  "database.connections_peak": { unit: "count", aggregation: "window_peak", kind: "number" },
  "database.active_queries": { unit: "count", aggregation: "window_peak", kind: "number" },
  "database.idle_in_transaction": { unit: "count", aggregation: "window_peak", kind: "number" },
  "database.blocked_queries": { unit: "count", aggregation: "window_peak", kind: "number" },
  "api.postgrest_requests": { unit: "count", aggregation: "window_total", kind: "number" },
  "api.gateway_error_pct": { unit: "percent", aggregation: "window_rate", kind: "percent" },
  "api.http_429": { unit: "count", aggregation: "window_total", kind: "number" },
  "api.http_5xx": { unit: "count", aggregation: "window_total", kind: "number" },
  "api.p50_ms": { unit: "milliseconds", aggregation: "p50", kind: "number" },
  "api.p95_ms": { unit: "milliseconds", aggregation: "p95", kind: "number" },
  "edge.invocations": { unit: "count", aggregation: "window_total", kind: "number" },
  "edge.http_429": { unit: "count", aggregation: "window_total", kind: "number" },
  "edge.http_5xx": { unit: "count", aggregation: "window_total", kind: "number" },
  "edge.p50_ms": { unit: "milliseconds", aggregation: "p50", kind: "number" },
  "edge.p95_ms": { unit: "milliseconds", aggregation: "p95", kind: "number" },
  "egress.bytes": { unit: "bytes", aggregation: "window_total", kind: "number" },
  "realtime.messages": { unit: "count", aggregation: "window_total", kind: "number" },
  "realtime.warning_pct": { unit: "percent", aggregation: "window_rate", kind: "percent" },
  "realtime.connections_peak": { unit: "count", aggregation: "window_peak", kind: "number" },
  "query.realtime_list_changes.calls": { unit: "count", aggregation: "pg_stat_statements_cumulative", kind: "number" },
  "query.realtime_list_changes.total_time_pct": { unit: "percent", aggregation: "pg_stat_statements_cumulative_share", kind: "percent" },
  "query.realtime_list_changes.mean_ms": { unit: "milliseconds", aggregation: "pg_stat_statements_cumulative_mean", kind: "number" },
  "query.realtime_list_changes.max_ms": { unit: "milliseconds", aggregation: "pg_stat_statements_cumulative_max", kind: "number" },
  "query.fcg_room_members.calls": { unit: "count", aggregation: "pg_stat_statements_cumulative", kind: "number" },
  "query.fcg_rooms.calls": { unit: "count", aggregation: "pg_stat_statements_cumulative", kind: "number" },
  "advisor.security_errors": { unit: "count", aggregation: "window_end", kind: "number" },
  "advisor.security_warnings": { unit: "count", aggregation: "window_end", kind: "number" },
  "advisor.security_suggestions": { unit: "count", aggregation: "window_end", kind: "number" },
  "advisor.performance_errors": { unit: "count", aggregation: "window_end", kind: "number" },
  "advisor.performance_warnings": { unit: "count", aggregation: "window_end", kind: "number" },
  "advisor.performance_suggestions": { unit: "count", aggregation: "window_end", kind: "number" },
  "advisor.health_alerts": { unit: "alert_names", aggregation: "window_end", kind: "strings" },
});

const FORBIDDEN_KEYS = new Set([
  "token",
  "authorization",
  "apikey",
  "servicerole",
  "secret",
  "password",
  "jwt",
  "accesstoken",
  "refreshtoken",
  "userid",
  "roomid",
  "actionid",
  "email",
  "connectionstring",
]);

const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+\S+/i,
  /\bBasic\s+[A-Za-z0-9+/=]{12,}\b/i,
  /\bsb_secret_[A-Za-z0-9_-]+\b/i,
  /\bsbp_[A-Za-z0-9_-]{12,}\b/i,
  /\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /\bpostgres(?:ql)?:\/\/[^\s/:]+:[^\s@]+@/i,
];

export class SafeObservationError extends Error {
  constructor(code, safePath = "$") {
    super(code);
    this.name = "SafeObservationError";
    this.code = code;
    this.safePath = safePath;
  }
}

function fail(code, safePath = "$") {
  throw new SafeObservationError(code, safePath);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, safePath) {
  if (!isPlainObject(value)) fail("INVALID_INPUT", safePath);
  return value;
}

function assertKnownKeys(value, allowed, safePath) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("UNKNOWN_FIELD", `${safePath}.[unknown]`);
  }
}

function scanForSecrets(value, safePath = "$input") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForSecrets(item, `${safePath}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[-_]/g, "");
      if (FORBIDDEN_KEYS.has(normalized) || /(token|secret|password|apikey|authorization|servicerole|connectionstring|userid|roomid|actionid|email)/.test(normalized)) {
        fail("FORBIDDEN_FIELD", `${safePath}.[forbidden]`);
      }
      const childPath = /^[A-Za-z0-9_.-]{1,64}$/.test(key) ? `${safePath}.${key}` : `${safePath}.[field]`;
      scanForSecrets(child, childPath);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    fail("FORBIDDEN_VALUE", safePath);
  }
}

function parseArgs(argv) {
  const result = {};
  const allowed = new Set(["label", "input", "baseline"]);
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.+)$/.exec(argument);
    if (!match || !allowed.has(match[1])) fail("UNKNOWN_ARGUMENT", "$argv.[unknown]");
    if (Object.hasOwn(result, match[1])) fail("DUPLICATE_ARGUMENT", `$argv.${match[1]}`);
    result[match[1]] = match[2];
  }
  if (result.label !== "T0" && result.label !== "T+24h") fail("INVALID_LABEL", "$argv.label");
  if (!result.input) fail("INPUT_REQUIRED", "$argv.input");
  if (result.label === "T+24h" && !result.baseline) fail("BASELINE_REQUIRED", "$argv.baseline");
  if (result.label === "T0" && result.baseline) fail("BASELINE_NOT_ALLOWED", "$argv.baseline");
  return result;
}

function readLimitedJson(location, safePath, readFile = fs.readFileSync) {
  let bytes;
  try {
    bytes = readFile(location);
  } catch {
    fail("INPUT_UNREADABLE", safePath);
  }
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.byteLength > MAX_INPUT_BYTES) fail("INPUT_TOO_LARGE", safePath);
  try {
    return JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    fail("INVALID_JSON", safePath);
  }
}

function normalizeIso(value, safePath) {
  if (typeof value !== "string") fail("INVALID_INPUT", safePath);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) fail("INVALID_INPUT", safePath);
  return new Date(timestamp).toISOString();
}

function requireString(value, safePath, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) fail("INVALID_INPUT", safePath);
  return value;
}

function pendingMetric(spec, reason = "not_provided") {
  return { state: "PENDING", value: null, unit: spec.unit, reason };
}

function normalizeMetric(value, spec, safePath, { allowUnit = false } = {}) {
  const metric = requireObject(value, safePath);
  const allowed = new Set(["state", "value", "source", "aggregation", "reason"]);
  if (allowUnit) allowed.add("unit");
  assertKnownKeys(metric, allowed, safePath);
  if (allowUnit && metric.unit !== spec.unit) fail("INVALID_BASELINE", `${safePath}.unit`);
  if (metric.aggregation !== undefined && metric.aggregation !== spec.aggregation) {
    fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", `${safePath}.aggregation`);
  }
  if (metric.source !== undefined && !SOURCES.has(metric.source)) {
    fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", `${safePath}.source`);
  }
  if (metric.state === "PENDING") {
    if (metric.value !== null || (metric.reason !== undefined && (typeof metric.reason !== "string" || metric.reason.length > 160))) {
      fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", safePath);
    }
    return pendingMetric(spec, metric.reason || "not_provided");
  }
  if (metric.state !== "OBSERVED" || !metric.source) {
    fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", safePath);
  }
  if (metric.reason !== undefined) fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", `${safePath}.reason`);
  if (spec.kind === "strings") {
    if (!Array.isArray(metric.value) || metric.value.length > 100 || metric.value.some((item) => typeof item !== "string" || item.length < 1 || item.length > 120)) {
      fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", `${safePath}.value`);
    }
    return {
      state: "OBSERVED",
      value: [...new Set(metric.value)].sort(),
      unit: spec.unit,
      aggregation: spec.aggregation,
      source: metric.source,
    };
  }
  if (typeof metric.value !== "number" || !Number.isFinite(metric.value) || metric.value < 0) {
    fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", `${safePath}.value`);
  }
  if (spec.kind === "percent" && metric.value > 100) {
    fail(allowUnit ? "INVALID_BASELINE" : "INVALID_INPUT", `${safePath}.value`);
  }
  return {
    state: "OBSERVED",
    value: metric.value,
    unit: spec.unit,
    aggregation: spec.aggregation,
    source: metric.source,
  };
}

function normalizeInput(raw) {
  scanForSecrets(raw);
  const input = requireObject(raw, "$input");
  assertKnownKeys(input, new Set(["capturedAt", "window", "release", "metrics"]), "$input");

  const window = requireObject(input.window, "$input.window");
  assertKnownKeys(window, new Set(["preset", "from", "to"]), "$input.window");
  if (window.preset !== "last-24-hours") fail("INVALID_INPUT", "$input.window.preset");
  const from = normalizeIso(window.from, "$input.window.from");
  const to = normalizeIso(window.to, "$input.window.to");
  if (Date.parse(to) <= Date.parse(from)) fail("INVALID_INPUT", "$input.window");

  const release = requireObject(input.release, "$input.release");
  assertKnownKeys(release, new Set(["publicAssetCommit", "pagesCommit", "pagesRun", "edgeDeployment", "migrationTail"]), "$input.release");
  const commitPattern = /^[0-9a-fA-F]{7,40}$/;
  const normalizedRelease = {
    publicAssetCommit: requireString(release.publicAssetCommit, "$input.release.publicAssetCommit", commitPattern).toLowerCase(),
    pagesCommit: requireString(release.pagesCommit, "$input.release.pagesCommit", commitPattern).toLowerCase(),
    pagesRun: requireString(release.pagesRun, "$input.release.pagesRun", /^\d+$/),
    edgeDeployment: release.edgeDeployment === undefined
      ? pendingMetric({ unit: "deployment_version" })
      : normalizeMetric(release.edgeDeployment, { unit: "deployment_version", aggregation: "window_end", kind: "number" }, "$input.release.edgeDeployment"),
    migrationTail: requireString(release.migrationTail, "$input.release.migrationTail", /^\d{12}$/),
  };

  const suppliedMetrics = requireObject(input.metrics, "$input.metrics");
  assertKnownKeys(suppliedMetrics, new Set(Object.keys(METRIC_SPECS)), "$input.metrics");
  const metrics = {};
  for (const [name, spec] of Object.entries(METRIC_SPECS)) {
    metrics[name] = Object.hasOwn(suppliedMetrics, name)
      ? normalizeMetric(suppliedMetrics[name], spec, `$input.metrics.${name}`)
      : pendingMetric(spec);
  }

  return {
    capturedAt: normalizeIso(input.capturedAt, "$input.capturedAt"),
    window: { preset: window.preset, from, to },
    release: normalizedRelease,
    metrics,
  };
}

function normalizeBaseline(raw) {
  scanForSecrets(raw, "$baseline");
  const baseline = requireObject(raw, "$baseline");
  assertKnownKeys(baseline, new Set([
    "schemaVersion", "label", "capturedAt", "timezone", "window", "release", "publicPreflight",
    "metrics", "comparison", "warnings", "observationCompleteness", "physicalTwoDeviceAcceptance",
  ]), "$baseline");
  if (baseline.schemaVersion !== SCHEMA_VERSION || baseline.label !== "T0" || baseline.timezone !== "Asia/Tokyo" || baseline.comparison !== null) {
    fail("INVALID_BASELINE", "$baseline");
  }
  const window = requireObject(baseline.window, "$baseline.window");
  assertKnownKeys(window, new Set(["preset", "from", "to"]), "$baseline.window");
  if (window.preset !== "last-24-hours" || Date.parse(normalizeIso(window.to, "$baseline.window.to")) <= Date.parse(normalizeIso(window.from, "$baseline.window.from"))) {
    fail("INVALID_BASELINE", "$baseline.window");
  }
  const release = requireObject(baseline.release, "$baseline.release");
  assertKnownKeys(release, new Set(["repositoryHead", "publicAssetCommit", "pagesCommit", "pagesRun", "edgeDeployment", "migrationTail"]), "$baseline.release");
  requireString(release.repositoryHead, "$baseline.release.repositoryHead", /^[0-9a-fA-F]{40}$/);
  requireString(release.publicAssetCommit, "$baseline.release.publicAssetCommit", /^[0-9a-fA-F]{7,40}$/);
  requireString(release.pagesCommit, "$baseline.release.pagesCommit", /^[0-9a-fA-F]{7,40}$/);
  requireString(release.pagesRun, "$baseline.release.pagesRun", /^\d+$/);
  requireString(release.migrationTail, "$baseline.release.migrationTail", /^\d{12}$/);
  normalizeMetric(release.edgeDeployment, { unit: "deployment_version", aggregation: "window_end", kind: "number" }, "$baseline.release.edgeDeployment", { allowUnit: true });
  normalizePublicPreflight(baseline.publicPreflight, "$baseline.publicPreflight");
  const physical = requireObject(baseline.physicalTwoDeviceAcceptance, "$baseline.physicalTwoDeviceAcceptance");
  assertKnownKeys(physical, new Set(["gateState", "executionState", "automated", "reasonCode"]), "$baseline.physicalTwoDeviceAcceptance");
  if (physical.automated !== false || physical.executionState !== "NOT_RUN" || physical.gateState !== "PENDING" || physical.reasonCode !== "REQUIRES_TWO_PHYSICAL_DEVICES") {
    fail("INVALID_BASELINE", "$baseline.physicalTwoDeviceAcceptance");
  }
  const suppliedMetrics = requireObject(baseline.metrics, "$baseline.metrics");
  assertKnownKeys(suppliedMetrics, new Set(Object.keys(METRIC_SPECS)), "$baseline.metrics");
  const metrics = {};
  for (const [name, spec] of Object.entries(METRIC_SPECS)) {
    if (!Object.hasOwn(suppliedMetrics, name)) fail("INVALID_BASELINE", `$baseline.metrics.${name}`);
    metrics[name] = normalizeMetric(suppliedMetrics[name], spec, `$baseline.metrics.${name}`, { allowUnit: true });
  }
  return { capturedAt: normalizeIso(baseline.capturedAt, "$baseline.capturedAt"), metrics };
}

function defaultRepositoryHead() {
  const safeRepositoryRoot = REPOSITORY_ROOT.replaceAll("\\", "/");
  const result = spawnSync("git", ["-c", `safe.directory=${safeRepositoryRoot}`, "rev-parse", "HEAD"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function defaultPublicPreflight() {
  const result = spawnSync(process.execPath, [path.join(SCRIPT_DIR, "live-standard-release-preflight.mjs"), "--expect=candidate"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: MAX_INPUT_BYTES,
  });
  if (result.status !== 0 || !result.stdout) fail("PREFLIGHT_FAILED", "$publicPreflight");
  let output;
  try {
    output = JSON.parse(result.stdout.trim());
  } catch {
    fail("PREFLIGHT_FAILED", "$publicPreflight");
  }
  return output;
}

function normalizeRepositoryHead(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/i.test(value)) {
    fail("REPOSITORY_HEAD_UNAVAILABLE", "$release.repositoryHead");
  }
  return value.toLowerCase();
}

function normalizePublicPreflight(output, safePath = "$publicPreflight") {
  scanForSecrets(output, safePath);
  if (!isPlainObject(output) || output.ok !== true || output.expectedPhase !== "candidate") {
    fail("PREFLIGHT_FAILED", safePath);
  }
  return { state: "OBSERVED", ok: true, expectedPhase: "candidate" };
}

function compareMetrics(current, baseline) {
  const comparison = {};
  for (const [name, spec] of Object.entries(METRIC_SPECS)) {
    const currentMetric = current[name];
    const baselineMetric = baseline[name];
    if (currentMetric.state !== "OBSERVED" || baselineMetric.state !== "OBSERVED") {
      comparison[name] = pendingMetric(spec, "baseline_or_current_pending");
    } else if (spec.kind === "strings") {
      comparison[name] = {
        state: "OBSERVED",
        value: {
          added: currentMetric.value.filter((item) => !baselineMetric.value.includes(item)),
          removed: baselineMetric.value.filter((item) => !currentMetric.value.includes(item)),
        },
        unit: spec.unit,
      };
    } else {
      comparison[name] = {
        state: "OBSERVED",
        value: currentMetric.value - baselineMetric.value,
        unit: spec.unit,
        baseline: baselineMetric.value,
        current: currentMetric.value,
      };
    }
  }
  return comparison;
}

export function buildObservation(argv, dependencies = {}) {
  const args = parseArgs(argv);
  const readFile = dependencies.readFile || fs.readFileSync;
  const input = normalizeInput(readLimitedJson(args.input, "$input", readFile));
  const baseline = args.baseline
    ? normalizeBaseline(readLimitedJson(args.baseline, "$baseline", readFile))
    : null;

  // All caller-controlled JSON is validated before either subprocess can start.
  const repositoryHead = normalizeRepositoryHead((dependencies.getRepositoryHead || defaultRepositoryHead)());
  const publicPreflight = normalizePublicPreflight((dependencies.runPublicPreflight || defaultPublicPreflight)());
  const warnings = [];
  const windowHours = (Date.parse(input.window.to) - Date.parse(input.window.from)) / 3_600_000;
  if (Math.abs(windowHours - 24) > 1 / 60) warnings.push("OBSERVATION_WINDOW_NOT_24_HOURS");
  if (Object.entries(input.metrics).some(([name, metric]) => name.startsWith("query.") && metric.state === "OBSERVED")) {
    warnings.push("QUERY_METRICS_ARE_PG_STAT_STATEMENTS_CUMULATIVE");
  }

  let comparison = null;
  if (baseline) {
    const intervalHours = (Date.parse(input.capturedAt) - Date.parse(baseline.capturedAt)) / 3_600_000;
    if (intervalHours < 24) warnings.push("CAPTURE_INTERVAL_UNDER_24_HOURS");
    comparison = {
      baselineCapturedAt: baseline.capturedAt,
      intervalHours: Math.round(intervalHours * 1000) / 1000,
      metrics: compareMetrics(input.metrics, baseline.metrics),
    };
  }

  const pendingPaths = [];
  if (input.release.edgeDeployment.state === "PENDING") pendingPaths.push("release.edgeDeployment");
  for (const [name, metric] of Object.entries(input.metrics)) {
    if (metric.state === "PENDING") pendingPaths.push(`metrics.${name}`);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    label: args.label,
    capturedAt: input.capturedAt,
    timezone: "Asia/Tokyo",
    window: input.window,
    release: { repositoryHead, ...input.release },
    publicPreflight,
    metrics: input.metrics,
    comparison,
    warnings,
    observationCompleteness: {
      state: pendingPaths.length === 0 ? "COMPLETE" : "PARTIAL",
      pendingPaths,
    },
    physicalTwoDeviceAcceptance: {
      gateState: "PENDING",
      executionState: "NOT_RUN",
      automated: false,
      reasonCode: "REQUIRES_TWO_PHYSICAL_DEVICES",
    },
  };
}

export function runCli(argv = process.argv.slice(2), dependencies = {}, io = process) {
  try {
    io.stdout.write(`${JSON.stringify(buildObservation(argv, dependencies))}\n`);
    return 0;
  } catch (error) {
    const safeError = error instanceof SafeObservationError
      ? error
      : new SafeObservationError("UNEXPECTED_ERROR", "$");
    io.stderr.write(`${JSON.stringify({ ok: false, error: { code: safeError.code, path: safeError.safePath } })}\n`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
