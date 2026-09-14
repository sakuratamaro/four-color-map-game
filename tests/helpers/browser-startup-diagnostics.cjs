"use strict";
// Test-fixture startup evidence only. Never record raw messages, arguments, or remote URLs.
const KINDS = new Set(["pageerror", "console-error", "requestfailed"]);
const NETWORK_ERRORS = new Set(["net::ERR_FAILED", "net::ERR_ABORTED", "net::ERR_CONNECTION_RESET", "net::ERR_CONNECTION_REFUSED", "net::ERR_CONNECTION_CLOSED", "net::ERR_TIMED_OUT", "net::ERR_NAME_NOT_RESOLVED"]);
const ERROR_NAMES = new Set(["Error", "TypeError", "SyntaxError", "ReferenceError", "RangeError", "TimeoutError"]);
function createStartupDiagnostics(baseUrl, limit = 16) {
  const origin = new URL(baseUrl);
  if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) throw new Error("LOCAL_FIXTURE_ONLY");
  const cap = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 16) : 16;
  const rows = [];
  function record(kind, event = {}) {
    if (!KINDS.has(kind) || rows.length >= cap) return;
    let pathname = null;
    try {
      const url = new URL(event.url);
      if (url.origin === origin.origin && (/^\/standard-online-v5\/[a-z0-9][a-z0-9.-]{0,80}\.(?:js|html)$/.test(url.pathname) || url.pathname === "/online/supabase-config.js")) pathname = url.pathname;
    } catch {}
    const coordinate = value => Number.isInteger(value) && value >= 0 && value <= 10000000 ? value : null;
    rows.push(Object.freeze({
      kind, pathname,
      line: pathname ? coordinate(event.line) : null,
      column: pathname ? coordinate(event.column) : null,
      error_class: ERROR_NAMES.has(event.name) ? event.name : null,
      network_error: NETWORK_ERRORS.has(event.networkError) ? event.networkError : null,
    }));
  }
  return Object.freeze({ record, snapshot: () => rows.map(row => ({ ...row })) });
}
function sanitizeStartupState(state = {}) {
  return {
    document_ready: ["loading", "interactive", "complete"].includes(state.documentReady) ? state.documentReady : null,
    badge: ["good", "warn", "other", "missing"].includes(state.badge) ? state.badge : null,
    fixture_present: typeof state.fixturePresent === "boolean" ? state.fixturePresent : null,
    capture_available: state.captureAvailable === true,
  };
}
function observeStartupPage(page, baseUrl) {
  const diagnostics = createStartupDiagnostics(baseUrl);
  const handlers = {
    pageerror: error => diagnostics.record("pageerror", { name: error.name }),
    console: message => {
      if (message.type() !== "error") return;
      const location = message.location();
      diagnostics.record("console-error", { url: location.url, line: location.lineNumber, column: location.columnNumber });
    },
    requestfailed: request => diagnostics.record("requestfailed", {
      url: request.url(), networkError: request.failure()?.errorText,
    }),
  };
  for (const [event, handler] of Object.entries(handlers)) page.on(event, handler);
  let stopped = false;
  return Object.freeze({
    snapshot: state => ({ events: diagnostics.snapshot(), state: sanitizeStartupState(state) }),
    stop() {
      if (stopped) return;
      stopped = true;
      for (const [event, handler] of Object.entries(handlers)) page.off(event, handler);
    },
  });
}
module.exports = { createStartupDiagnostics, observeStartupPage, sanitizeStartupState };
