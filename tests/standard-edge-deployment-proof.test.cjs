"use strict";

const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const modulePromise = import(pathToFileURL(path.join(__dirname, "..", "scripts", "verify-standard-edge-deployment-proof.mjs")).href);
const commit = "a".repeat(40);
const ezbrSha256 = "b".repeat(64);
const nowMillis = Date.now();

async function fixture(t, {
  candidateIndex = "index",
  downloadedIndex = candidateIndex,
  candidateBundle = "bundle",
  downloadedBundle = candidateBundle,
  version = 26,
  verifyJwt = true,
  deployLog = "Deployed standard-game-action with --use-api\n",
  downloadLog = "Downloaded standard-game-action with --use-api\n",
  canaryLogs = ["PASS  live invocation\nSUMMARY 1/1 Standard Edge checks passed\n"],
} = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "standard-edge-proof-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const candidateDirectory = path.join(root, "candidate");
  const downloadedDirectory = path.join(root, "downloaded");
  await Promise.all([fs.mkdir(candidateDirectory), fs.mkdir(downloadedDirectory)]);
  await Promise.all([
    fs.writeFile(path.join(candidateDirectory, "index.ts"), candidateIndex),
    fs.writeFile(path.join(candidateDirectory, "standard-engine.bundle.js"), candidateBundle),
    fs.writeFile(path.join(downloadedDirectory, "index.ts"), downloadedIndex),
    fs.writeFile(path.join(downloadedDirectory, "standard-engine.bundle.js"), downloadedBundle),
  ]);
  return {
    candidateDirectory,
    downloadedDirectory,
    projectsJson: [{ id: "qkcuhludisairpgzhryl" }],
    functionsJson: [{ id: "function-id", slug: "standard-game-action", status: "ACTIVE", version, verify_jwt: verifyJwt, ezbr_sha256: ezbrSha256 }],
    expectedVersion: 26,
    candidateCommit: commit,
    deployLog,
    downloadLog,
    canaryLogs,
    evidenceTimes: {
      deploy: nowMillis - 50_000,
      projects: nowMillis - 40_000,
      functions: nowMillis - 30_000,
      downloadedFirst: nowMillis - 20_000,
      downloadedLast: nowMillis - 19_000,
      canaries: canaryLogs.map((_, index) => nowMillis - 10_000 + index),
    },
    nowMillis,
  };
}

test("deployment proof binds authenticated project, active version, exact downloaded source, and live canary", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const proof = await verifyStandardEdgeDeploymentProof(await fixture(t));
  assert.equal(proof.ok, true);
  assert.equal(proof.gateState, "VERIFIED");
  assert.equal(proof.project.projectRef, "qkcuhludisairpgzhryl");
  assert.deepEqual(proof.deployment, { id: "function-id", version: 26, status: "ACTIVE", verifyJwt: true, ezbrSha256, ezbrSha256State: "OBSERVED" });
  assert.equal(proof.deploy.method, "supabase-functions-deploy-use-api");
  assert.equal(proof.sourceReadback.method, "supabase-functions-download-use-api");
  assert.equal(proof.sourceReadback.files["index.ts"].candidateSha256, proof.sourceReadback.files["index.ts"].downloadedSha256);
  assert.equal(proof.sourceReadback.files["standard-engine.bundle.js"].candidateSha256, proof.sourceReadback.files["standard-engine.bundle.js"].downloadedSha256);
  assert.equal(proof.sourceReadback.files["standard-engine.bundle.js"].comparison, "BYTE_EXACT");
  assert.deepEqual(proof.liveCanaries.map(({ checks, total }) => ({ checks, total })), [{ checks: 1, total: 1 }]);
  assert.equal(proof.pagesArtifactIsNotLiveEdgeEvidence, true);
  assert.equal(proof.evidenceWindow.order, "deploy<=projects<=functions<=download<=canary");
});

test("source-only proof remains explicitly pending until a live canary is attached", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const input = await fixture(t, { deployLog: "", canaryLogs: [] });
  delete input.evidenceTimes.deploy;
  const proof = await verifyStandardEdgeDeploymentProof({ ...input, stage: "source" });
  assert.equal(proof.gateState, "SOURCE_VERIFIED_CANARY_PENDING");
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(input), /DEPLOY_LOG_EVIDENCE_REQUIRED/);
  const withDeploy = { ...input, deployLog: "Deployed standard-game-action with --use-api\n" };
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(withDeploy), /LIVE_CANARY_EVIDENCE_REQUIRED/);
});

test("deployment proof rejects changed or extra downloaded source", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const changedInput = await fixture(t, { downloadedBundle: "old bundle" });
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(changedInput), /DEPLOYED_SOURCE_BYTE_MISMATCH_standard-engine\.bundle\.js/);
  const input = await fixture(t);
  await fs.writeFile(path.join(input.downloadedDirectory, "unexpected.ts"), "unexpected");
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(input), /DEPLOYED_SOURCE_FILE_SET_MISMATCH/);
});

test("deployment proof tolerates only index.ts CRLF normalization and keeps the generated bundle byte-exact", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const normalizedIndex = await fixture(t, { candidateIndex: "first\r\nsecond\r\n", downloadedIndex: "first\nsecond\n" });
  const proof = await verifyStandardEdgeDeploymentProof(normalizedIndex);
  assert.equal(proof.sourceReadback.files["index.ts"].comparison, "UTF8_LF_NORMALIZED");
  assert.notEqual(proof.sourceReadback.files["index.ts"].candidateSha256, proof.sourceReadback.files["index.ts"].downloadedSha256);

  const normalizedBundle = await fixture(t, { candidateBundle: "first\r\nsecond\r\n", downloadedBundle: "first\nsecond\n" });
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(normalizedBundle), /DEPLOYED_SOURCE_BYTE_MISMATCH_standard-engine\.bundle\.js/);
});

test("deployment proof rejects stale metadata, disabled JWT verification, and failed canaries", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const staleInput = await fixture(t, { version: 25 });
  const noJwtInput = await fixture(t, { verifyJwt: false });
  const failedCanaryInput = await fixture(t, { canaryLogs: ["FAIL  live invocation\nSUMMARY 0/1 Standard Edge checks passed\n"] });
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(staleInput), /STANDARD_FUNCTION_VERSION_MISMATCH/);
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(noJwtInput), /STANDARD_FUNCTION_JWT_VERIFICATION_DISABLED/);
  await assert.rejects(
    () => verifyStandardEdgeDeploymentProof(failedCanaryInput),
    /LIVE_CANARY_REPORTED_FAILURE/,
  );
});

test("deployment proof rejects stale metadata, stale canary logs, and out-of-order evidence", async (t) => {
  const { EVIDENCE_MAX_AGE_MS, verifyStandardEdgeDeploymentProof } = await modulePromise;
  const staleMetadata = await fixture(t);
  staleMetadata.evidenceTimes.functions = nowMillis - EVIDENCE_MAX_AGE_MS - 1;
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(staleMetadata), /STALE_EVIDENCE_functions/);

  const staleCanary = await fixture(t);
  staleCanary.evidenceTimes.canaries[0] = nowMillis - EVIDENCE_MAX_AGE_MS - 1;
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(staleCanary), /STALE_EVIDENCE_canary_0/);

  const reordered = await fixture(t);
  reordered.evidenceTimes.canaries[0] = reordered.evidenceTimes.downloadedFirst - 1;
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(reordered), /EVIDENCE_ORDER_INVALID/);
});

test("deployment proof records absent CLI ezbr metadata without inventing a hash", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const input = await fixture(t);
  delete input.functionsJson[0].ezbr_sha256;
  const proof = await verifyStandardEdgeDeploymentProof(input);
  assert.equal(proof.deployment.ezbrSha256, null);
  assert.equal(proof.deployment.ezbrSha256State, "NOT_EXPOSED_BY_CLI");
});

test("Dashboard ZIP fallback binds fresh pre/post source and canary without inventing deployment IDs", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const input = await fixture(t, { deployLog: "Dashboard deployed standard-game-action\n" });
  const baselineDirectory = path.join(path.dirname(input.candidateDirectory), "baseline");
  await fs.mkdir(baselineDirectory);
  await Promise.all([
    fs.writeFile(path.join(baselineDirectory, "index.ts"), "index"),
    fs.writeFile(path.join(baselineDirectory, "standard-engine.bundle.js"), "old bundle"),
  ]);
  const proof = await verifyStandardEdgeDeploymentProof({
    ...input,
    metadataMode: "dashboard",
    baselineDirectory,
    baselineDownloadLog: "Dashboard downloaded baseline standard-game-action\n",
    projectsJson: undefined,
    functionsJson: undefined,
    expectedVersion: undefined,
    dashboardJson: {
      projectRef: "qkcuhludisairpgzhryl",
      function: "standard-game-action",
      fileCount: 2,
      verifyJwt: true,
      updatedLabel: "updated moments ago",
    },
    evidenceTimes: {
      baselineFirst: nowMillis - 60_000,
      baselineLast: nowMillis - 59_000,
      deploy: nowMillis - 50_000,
      dashboard: nowMillis - 40_000,
      downloadedFirst: nowMillis - 30_000,
      downloadedLast: nowMillis - 29_000,
      canaries: [nowMillis - 10_000],
    },
  });
  assert.equal(proof.gateState, "VERIFIED_WITH_DASHBOARD_SOURCE_READBACK");
  assert.equal(proof.deployment.id, null);
  assert.equal(proof.deployment.version, null);
  assert.equal(proof.deployment.identityState, "CONTROL_PLANE_ID_NOT_OBSERVED");
  assert.equal(proof.sourceReadback.method, "supabase-dashboard-download-zip");
  assert.deepEqual(proof.sourceReadback.changedFilesAgainstBaseline, ["standard-engine.bundle.js"]);
  assert.equal(proof.evidenceWindow.order, "baseline-download<=deploy<=dashboard-metadata<=post-download<=canary");

  const staleInput = {
    ...input,
    metadataMode: "dashboard",
    baselineDirectory,
    baselineDownloadLog: "Dashboard downloaded baseline standard-game-action\n",
    projectsJson: undefined,
    functionsJson: undefined,
    expectedVersion: undefined,
    dashboardJson: { projectRef: "qkcuhludisairpgzhryl", function: "standard-game-action", fileCount: 2, verifyJwt: true, updatedLabel: "updated moments ago" },
    evidenceTimes: { baselineFirst: nowMillis - 60_000, baselineLast: nowMillis - 59_000, deploy: nowMillis - 50_000, dashboard: nowMillis - 15 * 60 * 1000 - 1, downloadedFirst: nowMillis - 30_000, downloadedLast: nowMillis - 29_000, canaries: [nowMillis - 10_000] },
  };
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(staleInput), /STALE_EVIDENCE_dashboard/);
});

test("deployment proof refuses secret-bearing metadata or canary logs", async (t) => {
  const { verifyStandardEdgeDeploymentProof } = await modulePromise;
  const metadataInput = await fixture(t);
  metadataInput.functionsJson[0].access_token = "do-not-print";
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(metadataInput), /SECRET_FIELD_REJECTED/);
  const secretCanaryInput = await fixture(t, { canaryLogs: ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz\nSUMMARY 1/1 Standard Edge checks passed\n"] });
  await assert.rejects(
    () => verifyStandardEdgeDeploymentProof(secretCanaryInput),
    /SECRET_MATERIAL_REJECTED_canary/,
  );
  const secretDeployInput = await fixture(t, { deployLog: "Deployed standard-game-action Authorization: Bearer abcdefghijklmnopqrstuvwxyz\n" });
  await assert.rejects(() => verifyStandardEdgeDeploymentProof(secretDeployInput), /SECRET_MATERIAL_REJECTED_deploy/);
});

test("source-stage CLI entry point validates the current clean candidate against a fresh downloaded fixture", async (t) => {
  const repositoryRoot = path.join(__dirname, "..");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "standard-edge-proof-cli-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const downloadedDirectory = path.join(root, "supabase", "functions", "standard-game-action");
  await fs.mkdir(downloadedDirectory, { recursive: true });
  const projectsFile = path.join(root, "projects.json");
  const functionsFile = path.join(root, "functions.json");
  const downloadLog = path.join(root, "download.log");
  await fs.writeFile(projectsFile, JSON.stringify([{ id: "qkcuhludisairpgzhryl" }]));
  await fs.writeFile(functionsFile, JSON.stringify([{ id: "function-id", slug: "standard-game-action", status: "ACTIVE", version: 26, verify_jwt: true }]));
  for (const name of ["index.ts", "standard-engine.bundle.js"]) {
    await fs.copyFile(path.join(repositoryRoot, "supabase", "functions", "standard-game-action", name), path.join(downloadedDirectory, name));
  }
  await fs.writeFile(downloadLog, "Downloaded standard-game-action with --use-api\n");
  const head = execFileSync("git", ["-c", `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`, "rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  const result = spawnSync(process.execPath, [
    path.join(repositoryRoot, "scripts", "verify-standard-edge-deployment-proof.mjs"),
    "--stage=source",
    `--candidate-commit=${head}`,
    "--project-ref=qkcuhludisairpgzhryl",
    "--expect-version=26",
    `--projects-json=${projectsFile}`,
    `--functions-json=${functionsFile}`,
    `--downloaded-function-dir=${downloadedDirectory}`,
    `--download-log=${downloadLog}`,
  ], { cwd: repositoryRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const proof = JSON.parse(result.stdout);
  assert.equal(proof.gateState, "SOURCE_VERIFIED_CANARY_PENDING");
  assert.equal(proof.deployment.ezbrSha256State, "NOT_EXPOSED_BY_CLI");
  assert.equal(proof.sourceReadback.files["standard-engine.bundle.js"].comparison, "BYTE_EXACT");
});
