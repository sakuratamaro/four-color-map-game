import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const LEDGER_HEADING = "User Decision Ledger";
export const LEDGER_COLUMNS = Object.freeze([
  "ID", "原文要旨", "決定", "受入条件", "依存関係", "担当", "対象release", "状態", "実装commit", "main統合", "Pages", "live実機", "決定元タスク", "DEFERRED-SUPERSEDED理由", "ユーザー承認",
]);
export const LEDGER_STATES = Object.freeze([
  "INBOX", "DECIDED", "SPEC_READY", "IMPLEMENTING", "LOCAL_VERIFIED", "MERGED", "PUBLIC_VERIFIED", "PHYSICAL_ACCEPTED", "DEFERRED", "SUPERSEDED",
]);

const ACTIVE_STATES = LEDGER_STATES.slice(0, 8);
const REQUIRED_FROM_DECIDED = Object.freeze(["受入条件", "担当", "対象release", "決定元タスク"]);
const EMPTY_MARKERS = new Set(["", "-", "—", "n/a", "na", "none", "null", "pending", "tbd", "未定", "未入力", "なし", "not_run"]);

function normalizeCell(value) {
  return String(value ?? "").replace(/<br\s*\/?\s*>/gi, " ").replace(/^`+|`+$/g, "").trim();
}

function normalizedComparison(value) {
  return normalizeCell(value).replace(/[\s。、・,，.．:：;；「」『』()（）\[\]【】]/g, "").toLocaleLowerCase("ja");
}

function hasEvidence(value) {
  return !EMPTY_MARKERS.has(normalizeCell(value).toLocaleLowerCase("en-US"));
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const body = trimmed.endsWith("|") ? trimmed.slice(1, -1) : trimmed.slice(1);
  const cells = [];
  let cell = "";
  let escaped = false;
  for (const character of body) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      cell += character;
      escaped = true;
    } else if (character === "|") {
      cells.push(normalizeCell(cell));
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(normalizeCell(cell));
  return cells;
}

function isSeparatorRow(cells) {
  return Array.isArray(cells) && cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function ledgerSectionLines(markdown) {
  const lines = String(markdown).replaceAll("\n", "\n").split("\n");
  const headingIndex = lines.findIndex((line) => new RegExp(`^##\\s+${LEDGER_HEADING}\\s*$`, "i").test(line.trim()));
  if (headingIndex < 0) return { lines: [], headingIndex: -1 };
  let end = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+\S/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }
  return { lines: lines.slice(headingIndex + 1, end), headingIndex };
}

export function parseDecisionLedger(markdown) {
  const section = ledgerSectionLines(markdown);
  if (section.headingIndex < 0) return { columns: [], rows: [], parseErrors: [`missing \"## ${LEDGER_HEADING}\" section`] };
  const tableLines = section.lines
    .map((line, offset) => ({ line, lineNumber: section.headingIndex + offset + 2 }))
    .filter(({ line }) => line.trim().startsWith("|"));
  if (tableLines.length < 2) return { columns: [], rows: [], parseErrors: ["ledger section must contain a Markdown table"] };
  const columns = splitMarkdownRow(tableLines[0].line) ?? [];
  const separator = splitMarkdownRow(tableLines[1].line);
  const parseErrors = [];
  if (!isSeparatorRow(separator)) parseErrors.push(`line ${tableLines[1].lineNumber}: ledger table separator is invalid`);
  const rows = [];
  for (const item of tableLines.slice(2)) {
    const cells = splitMarkdownRow(item.line);
    if (!cells) continue;
    if (cells.length !== columns.length) {
      parseErrors.push(`line ${item.lineNumber}: expected ${columns.length} cells but found ${cells.length}`);
      continue;
    }
    rows.push({ lineNumber: item.lineNumber, values: Object.fromEntries(columns.map((column, index) => [column, cells[index]])) });
  }
  return { columns, rows, parseErrors };
}

function addManual(manualReconciliation, row, kind, detail) {
  manualReconciliation.push({ id: row.values.ID || `(line ${row.lineNumber})`, lineNumber: row.lineNumber, kind, detail });
}

export function auditDecisionLedger(markdown) {
  const parsed = parseDecisionLedger(markdown);
  const errors = [...parsed.parseErrors];
  const warnings = [];
  const manualReconciliation = [];
  if (parsed.columns.length > 0 && (parsed.columns.length !== LEDGER_COLUMNS.length
      || parsed.columns.some((column, index) => column !== LEDGER_COLUMNS[index]))) {
    errors.push(`ledger schema must be exactly: ${LEDGER_COLUMNS.join(" | ")}`);
  }
  if (errors.length > 0 && parsed.rows.length === 0) return { ok: false, entryCount: 0, errors, warnings, manualReconciliation };

  const seenIds = new Map();
  const activeBySummary = new Map();
  for (const row of parsed.rows) {
    const values = row.values;
    const id = normalizeCell(values.ID);
    const state = normalizeCell(values.状態);
    if (!id) errors.push(`line ${row.lineNumber}: ID is required`);
    else if (seenIds.has(id)) errors.push(`line ${row.lineNumber}: duplicate stable ID ${id} (first seen on line ${seenIds.get(id)})`);
    else seenIds.set(id, row.lineNumber);

    if (!LEDGER_STATES.includes(state)) {
      errors.push(`line ${row.lineNumber} (${id || "missing ID"}): unknown state ${state || "(empty)"}`);
      continue;
    }
    const rank = ACTIVE_STATES.indexOf(state);
    if (rank >= ACTIVE_STATES.indexOf("DECIDED")) {
      for (const column of REQUIRED_FROM_DECIDED) {
        if (!hasEvidence(values[column])) errors.push(`line ${row.lineNumber} (${id}): ${column} is required from DECIDED onward`);
      }
    }
    if (rank >= ACTIVE_STATES.indexOf("LOCAL_VERIFIED") && !hasEvidence(values.実装commit)) {
      errors.push(`line ${row.lineNumber} (${id}): LOCAL_VERIFIED or later requires 実装commit evidence`);
    }
    if (rank >= ACTIVE_STATES.indexOf("MERGED") && !hasEvidence(values.main統合)) {
      errors.push(`line ${row.lineNumber} (${id}): MERGED or later requires main統合 evidence`);
    }
    if (rank >= ACTIVE_STATES.indexOf("PUBLIC_VERIFIED") && !hasEvidence(values.Pages)) {
      errors.push(`line ${row.lineNumber} (${id}): PUBLIC_VERIFIED or later requires Pages evidence`);
    }
    if (state === "PHYSICAL_ACCEPTED" && !hasEvidence(values.live実機)) {
      errors.push(`line ${row.lineNumber} (${id}): PHYSICAL_ACCEPTED requires live実機 evidence`);
    }
    if (["DEFERRED", "SUPERSEDED"].includes(state)) {
      if (!hasEvidence(values["DEFERRED-SUPERSEDED理由"])) errors.push(`line ${row.lineNumber} (${id}): ${state} requires a reason`);
      if (!hasEvidence(values.ユーザー承認)) errors.push(`line ${row.lineNumber} (${id}): ${state} requires user approval evidence`);
    }

    if (state === "INBOX") addManual(manualReconciliation, row, "INBOX", "user decision and disposition must be reconciled manually");
    if (/\b(?:final|archived?|closed)\b|旧(?:task|タスク)|古い(?:task|タスク)|アーカイブ/i.test(values.決定元タスク ?? "")) {
      addManual(manualReconciliation, row, "STALE_TASK_FINAL", "source task final may be stale; compare it with the latest user decision");
    }
    if (/手動照合|manual\s*(?:check|reconciliation|review)/i.test(Object.values(values).join(" "))) {
      addManual(manualReconciliation, row, "EXPLICIT_MANUAL_CHECK", "ledger row explicitly requests manual reconciliation");
    }
    if (rank >= ACTIVE_STATES.indexOf("DECIDED")) {
      const summaryKey = normalizedComparison(values.原文要旨);
      if (summaryKey) {
        const entries = activeBySummary.get(summaryKey) ?? [];
        entries.push(row);
        activeBySummary.set(summaryKey, entries);
      }
    }
  }
  for (const rows of activeBySummary.values()) {
    const decisions = new Set(rows.map((row) => normalizedComparison(row.values.決定)).filter(Boolean));
    if (decisions.size > 1) {
      for (const row of rows) addManual(manualReconciliation, row, "CONFLICTING_DECISION", `same request summary has ${decisions.size} active decisions`);
    }
  }
  const uniqueManual = [...new Map(manualReconciliation.map((item) => [`${item.lineNumber}:${item.kind}`, item])).values()];
  return { ok: errors.length === 0, entryCount: parsed.rows.length, errors, warnings, manualReconciliation: uniqueManual };
}

function parseArguments(argv) {
  let file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "PROJECT_COMMAND_CENTER.md");
  let json = false;
  for (const argument of argv) {
    if (argument === "--json") json = true;
    else if (argument.startsWith("--file=")) file = path.resolve(argument.slice("--file=".length));
    else throw new Error(`unknown argument: ${argument}`);
  }
  return { file, json };
}

export function runDecisionReconciliationCli(argv = process.argv.slice(2)) {
  try {
    const options = parseArguments(argv);
    const result = auditDecisionLedger(fs.readFileSync(options.file, "utf8"));
    if (options.json) console.log(JSON.stringify({ file: options.file, ...result }, null, 2));
    else {
      console.log(`Decision reconciliation: ${result.ok ? "PASS" : "FAIL"} (${result.entryCount} entries, ${result.manualReconciliation.length} manual)`);
      for (const error of result.errors) console.error(`ERROR: ${error}`);
      for (const item of result.manualReconciliation) console.log(`MANUAL: ${item.id} [${item.kind}] ${item.detail}`);
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`Decision reconciliation: ERROR: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = runDecisionReconciliationCli();
