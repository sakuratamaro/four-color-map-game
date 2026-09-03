import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDirectory = path.join(root, "tests");
const testFiles = fs.readdirSync(testDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.cjs"))
  .map((entry) => path.join(testDirectory, entry.name))
  .sort((left, right) => left.localeCompare(right, "en"));

if (process.argv.includes("--list")) {
  for (const file of testFiles) console.log(path.relative(root, file).replaceAll("\\", "/"));
  process.exit(0);
}

const forwarded = process.argv.slice(2);
const hasConcurrency = forwarded.some((argument) => argument.startsWith("--test-concurrency"));
const nodeArguments = [
  "--test",
  ...(hasConcurrency ? [] : ["--test-concurrency=1"]),
  ...forwarded,
  ...testFiles,
];

console.log(`Running ${testFiles.length} Standard product test files with ${hasConcurrency ? "requested" : "single-process"} concurrency.`);

const child = spawn(process.execPath, nodeArguments, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`Standard product tests stopped by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
