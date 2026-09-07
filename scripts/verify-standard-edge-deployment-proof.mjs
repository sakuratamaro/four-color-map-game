import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STANDARD_PROJECT_REF = "qkcuhludisairpgzhryl";
export const STANDARD_FUNCTION_SLUG = "standard-game-action";
export const EVIDENCE_MAX_AGE_MS = 15 * 60 * 1000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const secretKeyPattern = /(?:access[_-]?token|authorization|password|secret|service[_-]?role)/i;
const secretValuePattern = /(?:bearer\s+[a-z0-9._-]{12,}|eyJ[a-zA-Z0-9_-]{16,}\.[a-zA-Z0-9_-]{8,}\.|SUPABASE_SERVICE_ROLE_KEY)/i;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function collection(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.data)) return value.data;
  throw new Error(`INVALID_${key.toUpperCase()}_JSON`);
}

function assertSecretFree(value, location = "input") {
  if (typeof value === "string") {
    if (secretValuePattern.test(value)) throw new Error(`SECRET_MATERIAL_REJECTED_${location}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSecretFree(entry, `${location}_${index}`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (secretKeyPattern.test(key)) throw new Error(`SECRET_FIELD_REJECTED_${location}_${key}`);
    assertSecretFree(entry, `${location}_${key}`);
  }
}

async function filesUnder(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(absolute, relative));
    else if (entry.isFile()) files.push({ relative, absolute });
  }
  return files;
}

async function compareFunctionSources(candidateDirectory, downloadedDirectory) {
  const candidateFiles = await filesUnder(candidateDirectory);
  const downloadedFiles = await filesUnder(downloadedDirectory);
  const candidateNames = candidateFiles.map(({ relative }) => relative);
  const downloadedNames = downloadedFiles.map(({ relative }) => relative);
  if (JSON.stringify(candidateNames) !== JSON.stringify(downloadedNames)) {
    throw new Error(`DEPLOYED_SOURCE_FILE_SET_MISMATCH_candidate=${candidateNames.join(",")}_downloaded=${downloadedNames.join(",")}`);
  }
  if (!candidateNames.includes("index.ts") || !candidateNames.includes("standard-engine.bundle.js")) {
    throw new Error("REQUIRED_STANDARD_EDGE_SOURCE_MISSING");
  }

  const hashes = {};
  for (let index = 0; index < candidateFiles.length; index += 1) {
    const candidateBytes = await readFile(candidateFiles[index].absolute);
    const downloadedBytes = await readFile(downloadedFiles[index].absolute);
    const candidateSha256 = sha256(candidateBytes);
    const downloadedSha256 = sha256(downloadedBytes);
    const byteEqual = candidateBytes.equals(downloadedBytes);
    const indexLineEndingOnly = candidateFiles[index].relative === "index.ts"
      && candidateBytes.toString("utf8").replaceAll("\r\n", "\n") === downloadedBytes.toString("utf8").replaceAll("\r\n", "\n");
    if (!byteEqual && !indexLineEndingOnly) {
      throw new Error(`DEPLOYED_SOURCE_BYTE_MISMATCH_${candidateFiles[index].relative}_candidate=${candidateSha256}_downloaded=${downloadedSha256}`);
    }
    hashes[candidateFiles[index].relative] = {
      candidateSha256,
      downloadedSha256,
      candidateBytes: candidateBytes.length,
      downloadedBytes: downloadedBytes.length,
      comparison: byteEqual ? "BYTE_EXACT" : "UTF8_LF_NORMALIZED",
    };
  }
  return hashes;
}

async function functionSourceManifest(directory) {
  const files = await filesUnder(directory);
  const names = files.map(({ relative }) => relative);
  if (!names.includes("index.ts") || !names.includes("standard-engine.bundle.js")) throw new Error("REQUIRED_STANDARD_EDGE_SOURCE_MISSING");
  return Object.fromEntries(await Promise.all(files.map(async ({ relative, absolute }) => {
    const bytes = await readFile(absolute);
    return [relative, { sha256: sha256(bytes), bytes: bytes.length }];
  })));
}

function projectEvidence(projectsJson, projectRef) {
  assertSecretFree(projectsJson, "projects");
  const projects = collection(projectsJson, "projects");
  const matches = projects.filter((project) => [project?.id, project?.ref, project?.project_ref].includes(projectRef));
  if (matches.length !== 1) throw new Error(`AUTHENTICATED_PROJECT_REF_NOT_UNIQUE_${matches.length}`);
  return { authenticated: true, projectRef };
}

function functionEvidence(functionsJson, expectedVersion) {
  assertSecretFree(functionsJson, "functions");
  const functions = collection(functionsJson, "functions");
  const matches = functions.filter((entry) => entry?.slug === STANDARD_FUNCTION_SLUG || entry?.name === STANDARD_FUNCTION_SLUG);
  if (matches.length !== 1) throw new Error(`STANDARD_FUNCTION_NOT_UNIQUE_${matches.length}`);
  const entry = matches[0];
  if (entry.status !== "ACTIVE") throw new Error(`STANDARD_FUNCTION_NOT_ACTIVE_${String(entry.status)}`);
  if (entry.verify_jwt !== true) throw new Error("STANDARD_FUNCTION_JWT_VERIFICATION_DISABLED");
  if (!Number.isSafeInteger(entry.version) || entry.version <= 0) throw new Error("STANDARD_FUNCTION_VERSION_INVALID");
  if (entry.version !== expectedVersion) throw new Error(`STANDARD_FUNCTION_VERSION_MISMATCH_expected=${expectedVersion}_actual=${entry.version}`);
  if (typeof entry.id !== "string" || entry.id.length === 0) throw new Error("STANDARD_FUNCTION_ID_MISSING");
  if (entry.ezbr_sha256 !== undefined && entry.ezbr_sha256 !== null
    && (typeof entry.ezbr_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.ezbr_sha256))) {
    throw new Error("STANDARD_FUNCTION_EZBR_SHA256_INVALID");
  }
  return {
    id: entry.id,
    version: entry.version,
    status: entry.status,
    verifyJwt: entry.verify_jwt,
    ezbrSha256: entry.ezbr_sha256?.toLowerCase() || null,
    ezbrSha256State: entry.ezbr_sha256 ? "OBSERVED" : "NOT_EXPOSED_BY_CLI",
  };
}

function dashboardEvidence(dashboardJson) {
  assertSecretFree(dashboardJson, "dashboard");
  if (dashboardJson?.projectRef !== STANDARD_PROJECT_REF) throw new Error("DASHBOARD_PROJECT_REF_MISMATCH");
  if (dashboardJson?.function !== STANDARD_FUNCTION_SLUG) throw new Error("DASHBOARD_FUNCTION_MISMATCH");
  if (dashboardJson?.fileCount !== 2) throw new Error("DASHBOARD_FILE_COUNT_MISMATCH");
  if (dashboardJson?.verifyJwt !== true) throw new Error("DASHBOARD_JWT_VERIFICATION_NOT_CONFIRMED");
  if (typeof dashboardJson?.updatedLabel !== "string" || dashboardJson.updatedLabel.length === 0
    || dashboardJson.updatedLabel.length > 120 || /[\r\n]/.test(dashboardJson.updatedLabel)) {
    throw new Error("DASHBOARD_UPDATED_LABEL_INVALID");
  }
  return {
    project: { authenticated: true, authenticationEvidence: "SIGNED_IN_DASHBOARD_DOWNLOAD", projectRef: STANDARD_PROJECT_REF },
    deployment: {
      id: null,
      version: null,
      status: null,
      verifyJwt: true,
      ezbrSha256: null,
      ezbrSha256State: "NOT_EXPOSED_BY_DASHBOARD_DOWNLOAD",
      identityState: "CONTROL_PLANE_ID_NOT_OBSERVED",
      updatedLabel: dashboardJson.updatedLabel,
      fileCount: dashboardJson.fileCount,
    },
  };
}

function canaryEvidence(logText) {
  if (secretValuePattern.test(logText)) throw new Error("SECRET_MATERIAL_REJECTED_canary");
  if (/^FAIL\s{2}/m.test(logText)) throw new Error("LIVE_CANARY_REPORTED_FAILURE");
  const summaries = [...logText.matchAll(/^SUMMARY\s+(\d+)\/(\d+)\s+.+passed\s*$/gm)];
  if (summaries.length === 0) throw new Error("LIVE_CANARY_SUMMARY_MISSING");
  const checks = summaries.reduce((total, match) => total + Number(match[1]), 0);
  const total = summaries.reduce((sum, match) => sum + Number(match[2]), 0);
  if (checks !== total || total <= 0) throw new Error(`LIVE_CANARY_INCOMPLETE_${checks}_${total}`);
  return { checks, total, logSha256: sha256(Buffer.from(logText, "utf8")) };
}

function deployEvidence(logText, method = "supabase-functions-deploy-use-api") {
  if (secretValuePattern.test(logText)) throw new Error("SECRET_MATERIAL_REJECTED_deploy");
  if (!logText.includes(STANDARD_FUNCTION_SLUG)) throw new Error("DEPLOY_LOG_FUNCTION_MISSING");
  if (/\b(?:error|failed|failure)\b/i.test(logText)) throw new Error("DEPLOY_LOG_REPORTED_FAILURE");
  return { method, logSha256: sha256(Buffer.from(logText, "utf8")) };
}

function downloadEvidence(logText, method) {
  if (secretValuePattern.test(logText)) throw new Error("SECRET_MATERIAL_REJECTED_download");
  if (!logText.includes(STANDARD_FUNCTION_SLUG)) throw new Error("DOWNLOAD_LOG_FUNCTION_MISSING");
  if (/\b(?:error|failed|failure)\b/i.test(logText)) throw new Error("DOWNLOAD_LOG_REPORTED_FAILURE");
  return { method, logSha256: sha256(Buffer.from(logText, "utf8")) };
}

function evidenceWindow(stage, metadataMode, times, nowMillis) {
  if (!times || typeof times !== "object") throw new Error("EVIDENCE_TIMES_REQUIRED");
  const required = metadataMode === "dashboard"
    ? ["baselineFirst", "baselineLast", "deploy", "dashboard", "downloadedFirst", "downloadedLast"]
    : ["projects", "functions", "downloadedFirst", "downloadedLast"];
  if (stage === "release" && metadataMode === "cli") required.push("deploy");
  for (const key of required) {
    const value = times[key];
    if (!Number.isFinite(value)) throw new Error(`EVIDENCE_TIME_MISSING_${key}`);
    if (value > nowMillis + 60_000) throw new Error(`FUTURE_EVIDENCE_${key}`);
    if (nowMillis - value > EVIDENCE_MAX_AGE_MS) throw new Error(`STALE_EVIDENCE_${key}`);
  }
  const canaries = Array.isArray(times.canaries) ? times.canaries : [];
  if (stage === "release" && canaries.length === 0) throw new Error("EVIDENCE_TIME_MISSING_canaries");
  canaries.forEach((value, index) => {
    if (!Number.isFinite(value)) throw new Error(`EVIDENCE_TIME_MISSING_canary_${index}`);
    if (value > nowMillis + 60_000) throw new Error(`FUTURE_EVIDENCE_canary_${index}`);
    if (nowMillis - value > EVIDENCE_MAX_AGE_MS) throw new Error(`STALE_EVIDENCE_canary_${index}`);
  });
  const ordered = metadataMode === "dashboard"
    ? [times.baselineFirst, times.baselineLast, times.deploy, times.dashboard, times.downloadedFirst, times.downloadedLast, ...canaries]
    : stage === "release"
      ? [times.deploy, times.projects, times.functions, times.downloadedFirst, times.downloadedLast, ...canaries]
      : [times.projects, times.functions, times.downloadedFirst, times.downloadedLast];
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index] < ordered[index - 1]) throw new Error(`EVIDENCE_ORDER_INVALID_${index}`);
  }
  return {
    maximumAgeSeconds: EVIDENCE_MAX_AGE_MS / 1000,
    oldestAgeSeconds: Math.max(...required.map((key) => nowMillis - times[key]), ...canaries.map((value) => nowMillis - value)) / 1000,
    order: metadataMode === "dashboard"
      ? "baseline-download<=deploy<=dashboard-metadata<=post-download<=canary"
      : stage === "release" ? "deploy<=projects<=functions<=download<=canary" : "projects<=functions<=download",
  };
}

export async function verifyStandardEdgeDeploymentProof({
  candidateDirectory,
  downloadedDirectory,
  baselineDirectory,
  projectsJson,
  functionsJson,
  dashboardJson,
  expectedVersion,
  candidateCommit,
  deployLog = "",
  downloadLog = "",
  baselineDownloadLog = "",
  canaryLogs = [],
  stage = "release",
  metadataMode = "cli",
  evidenceTimes,
  nowMillis = Date.now(),
}) {
  if (stage !== "source" && stage !== "release") throw new Error("INVALID_PROOF_STAGE");
  if (metadataMode !== "cli" && metadataMode !== "dashboard") throw new Error("INVALID_METADATA_MODE");
  if (!/^[a-f0-9]{40}$/i.test(candidateCommit)) throw new Error("INVALID_CANDIDATE_COMMIT");
  if (metadataMode === "cli" && (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0)) throw new Error("INVALID_EXPECTED_VERSION");
  const metadata = metadataMode === "cli"
    ? { project: projectEvidence(projectsJson, STANDARD_PROJECT_REF), deployment: functionEvidence(functionsJson, expectedVersion) }
    : dashboardEvidence(dashboardJson);
  const sourceFiles = await compareFunctionSources(candidateDirectory, downloadedDirectory);
  const baselineFiles = baselineDirectory ? await functionSourceManifest(baselineDirectory) : null;
  if (metadataMode === "dashboard" && !baselineFiles) throw new Error("DASHBOARD_BASELINE_SOURCE_REQUIRED");
  if (!downloadLog) throw new Error("DOWNLOAD_LOG_EVIDENCE_REQUIRED");
  if (metadataMode === "dashboard" && !baselineDownloadLog) throw new Error("DASHBOARD_BASELINE_DOWNLOAD_LOG_REQUIRED");
  const canaries = canaryLogs.map(canaryEvidence);
  const deploy = deployLog ? deployEvidence(deployLog, metadataMode === "cli" ? undefined : "supabase-dashboard-deploy") : null;
  const download = downloadEvidence(downloadLog, metadataMode === "cli" ? "supabase-functions-download-use-api" : "supabase-dashboard-download-zip");
  const baselineDownload = baselineDownloadLog ? downloadEvidence(baselineDownloadLog, "supabase-dashboard-baseline-download-zip") : null;
  if (metadataMode === "dashboard" && !deploy) throw new Error("DASHBOARD_DEPLOY_LOG_EVIDENCE_REQUIRED");
  if (stage === "release" && !deploy) throw new Error("DEPLOY_LOG_EVIDENCE_REQUIRED");
  if (stage === "release" && canaries.length === 0) throw new Error("LIVE_CANARY_EVIDENCE_REQUIRED");
  const freshness = evidenceWindow(stage, metadataMode, evidenceTimes, nowMillis);
  const changedFilesAgainstBaseline = baselineFiles
    ? Object.keys(sourceFiles).filter((name) => baselineFiles[name]?.sha256 !== sourceFiles[name].downloadedSha256)
    : [];
  return {
    ok: true,
    gateState: stage === "release"
      ? metadataMode === "cli" ? "VERIFIED" : "VERIFIED_WITH_DASHBOARD_SOURCE_READBACK"
      : "SOURCE_VERIFIED_CANARY_PENDING",
    capturedAt: new Date(nowMillis).toISOString(),
    candidateCommit: candidateCommit.toLowerCase(),
    project: metadata.project,
    function: STANDARD_FUNCTION_SLUG,
    deployment: metadata.deployment,
    deploy,
    sourceReadback: {
      method: metadataMode === "cli" ? "supabase-functions-download-use-api" : "supabase-dashboard-download-zip",
      receipt: download,
      files: sourceFiles,
      baselineFiles,
      baselineReceipt: baselineDownload,
      changedFilesAgainstBaseline,
    },
    liveCanaries: canaries,
    evidenceWindow: freshness,
    pagesArtifactIsNotLiveEdgeEvidence: true,
  };
}

function parseArguments(argv) {
  const result = { canaryLogs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`UNEXPECTED_ARGUMENT_${argument}`);
    const [inlineKey, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? argv[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`MISSING_ARGUMENT_VALUE_${inlineKey}`);
    if (inlineKey === "canary-log") result.canaryLogs.push(value);
    else result[inlineKey.replaceAll("-", "_")] = value;
  }
  return result;
}

function gitText(args) {
  return execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const metadataMode = args.metadata_mode || "cli";
  const requiredArguments = metadataMode === "dashboard"
    ? ["candidate_commit", "downloaded_function_dir", "download_log", "baseline_function_dir", "baseline_download_log", "dashboard_json", "deploy_log"]
    : ["candidate_commit", "downloaded_function_dir", "download_log", "functions_json", "projects_json", "expect_version"];
  for (const key of requiredArguments) {
    if (!args[key]) throw new Error(`REQUIRED_ARGUMENT_MISSING_${key}`);
  }
  if (args.project_ref && args.project_ref !== STANDARD_PROJECT_REF) throw new Error("UNEXPECTED_PROJECT_REF");
  const head = gitText(["rev-parse", "HEAD"]);
  if (head.toLowerCase() !== args.candidate_commit.toLowerCase()) throw new Error(`CANDIDATE_HEAD_MISMATCH_expected=${args.candidate_commit}_actual=${head}`);
  if (gitText(["status", "--porcelain=v1"])) throw new Error("CANDIDATE_WORKTREE_NOT_CLEAN");

  const projectsText = args.projects_json ? await readFile(path.resolve(args.projects_json), "utf8") : "";
  const functionsText = args.functions_json ? await readFile(path.resolve(args.functions_json), "utf8") : "";
  const dashboardText = args.dashboard_json ? await readFile(path.resolve(args.dashboard_json), "utf8") : "";
  const deployLog = args.deploy_log ? await readFile(path.resolve(args.deploy_log), "utf8") : "";
  const downloadLog = await readFile(path.resolve(args.download_log), "utf8");
  const baselineDownloadLog = args.baseline_download_log ? await readFile(path.resolve(args.baseline_download_log), "utf8") : "";
  const canaryLogs = await Promise.all(args.canaryLogs.map((file) => readFile(path.resolve(file), "utf8")));
  const downloadedFiles = await filesUnder(path.resolve(args.downloaded_function_dir));
  if (downloadedFiles.length === 0) throw new Error("DOWNLOADED_SOURCE_EMPTY");
  const downloadTime = (await stat(path.resolve(args.download_log))).mtimeMs;
  const evidenceTimes = metadataMode === "dashboard" ? {
    baselineFirst: (await stat(path.resolve(args.baseline_download_log))).mtimeMs,
    baselineLast: (await stat(path.resolve(args.baseline_download_log))).mtimeMs,
    deploy: (await stat(path.resolve(args.deploy_log))).mtimeMs,
    dashboard: (await stat(path.resolve(args.dashboard_json))).mtimeMs,
    downloadedFirst: downloadTime,
    downloadedLast: downloadTime,
    canaries: await Promise.all(args.canaryLogs.map((file) => stat(path.resolve(file)).then(({ mtimeMs }) => mtimeMs))),
  } : {
    projects: (await stat(path.resolve(args.projects_json))).mtimeMs,
    functions: (await stat(path.resolve(args.functions_json))).mtimeMs,
    downloadedFirst: downloadTime,
    downloadedLast: downloadTime,
    deploy: args.deploy_log ? (await stat(path.resolve(args.deploy_log))).mtimeMs : undefined,
    canaries: await Promise.all(args.canaryLogs.map((file) => stat(path.resolve(file)).then(({ mtimeMs }) => mtimeMs))),
  };
  const parseJson = (text) => JSON.parse(text.replace(/^\uFEFF/, ""));
  const proof = await verifyStandardEdgeDeploymentProof({
    candidateDirectory: path.resolve(args.candidate_function_dir || path.join(root, "supabase", "functions", STANDARD_FUNCTION_SLUG)),
    downloadedDirectory: path.resolve(args.downloaded_function_dir),
    baselineDirectory: args.baseline_function_dir ? path.resolve(args.baseline_function_dir) : undefined,
    projectsJson: projectsText ? parseJson(projectsText) : undefined,
    functionsJson: functionsText ? parseJson(functionsText) : undefined,
    dashboardJson: dashboardText ? parseJson(dashboardText) : undefined,
    expectedVersion: Number(args.expect_version),
    candidateCommit: args.candidate_commit,
    deployLog,
    downloadLog,
    baselineDownloadLog,
    canaryLogs,
    stage: args.stage || "release",
    metadataMode,
    evidenceTimes,
  });
  console.log(JSON.stringify(proof));
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`EDGE_DEPLOYMENT_PROOF_FAILED ${error instanceof Error ? error.message : "UNKNOWN"}`);
    process.exitCode = 1;
  });
}
