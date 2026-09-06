"use strict";

const CLOSE_TIMEOUT_MESSAGE = "BROWSER_STAGE_TIMEOUT browser-close";

async function closeOwnedBrowserServer({ browserServer, bounded, stage }) {
  if (!browserServer) return { killed: false };
  stage("browser-close-start");
  try {
    await bounded("browser-close", browserServer.close(), 20_000);
    stage("browser-close-ready");
    return { killed: false };
  } catch (closeError) {
    const timedOut = closeError?.message === CLOSE_TIMEOUT_MESSAGE;
    stage(timedOut ? "browser-close-timeout" : "browser-close-error");
    stage("browser-kill-start");
    try {
      await bounded("browser-kill", browserServer.kill(), 10_000);
      stage("browser-kill-ready");
    } catch (killError) {
      throw new AggregateError([closeError, killError], "BROWSER_PROCESS_CLEANUP_FAILED");
    }
    if (!timedOut) throw closeError;
    return { killed: true };
  }
}

module.exports = { CLOSE_TIMEOUT_MESSAGE, closeOwnedBrowserServer };
