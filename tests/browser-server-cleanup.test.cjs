"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { CLOSE_TIMEOUT_MESSAGE, closeOwnedBrowserServer } = require("./helpers/browser-server-cleanup.cjs");

function harness({ close, kill }) {
  const stages = [];
  const calls = { close: 0, kill: 0 };
  const browserServer = {
    close: () => { calls.close += 1; return close(); },
    kill: () => { calls.kill += 1; return kill(); },
  };
  return {
    stages,
    calls,
    run: () => closeOwnedBrowserServer({
      browserServer,
      bounded: async (_stage, promise) => promise,
      stage: (value) => stages.push(value),
    }),
  };
}

test("graceful browser-server close never kills the owned process", async () => {
  const subject = harness({ close: async () => {}, kill: async () => {} });
  assert.deepEqual(await subject.run(), { killed: false });
  assert.deepEqual(subject.calls, { close: 1, kill: 0 });
  assert.deepEqual(subject.stages, ["browser-close-start", "browser-close-ready"]);
});

test("browser-close timeout kills the owned process and preserves a passing product assertion", async () => {
  const subject = harness({
    close: async () => { throw new Error(CLOSE_TIMEOUT_MESSAGE); },
    kill: async () => {},
  });
  assert.deepEqual(await subject.run(), { killed: true });
  assert.deepEqual(subject.calls, { close: 1, kill: 1 });
  assert.deepEqual(subject.stages, ["browser-close-start", "browser-close-timeout", "browser-kill-start", "browser-kill-ready"]);
});

test("non-timeout close errors kill the process and remain failures", async () => {
  const closeError = new Error("close failed");
  const subject = harness({ close: async () => { throw closeError; }, kill: async () => {} });
  await assert.rejects(subject.run(), (error) => error === closeError);
  assert.deepEqual(subject.calls, { close: 1, kill: 1 });
});

test("kill failure reports both the close and process cleanup failures", async () => {
  const closeError = new Error(CLOSE_TIMEOUT_MESSAGE);
  const killError = new Error("kill failed");
  const subject = harness({ close: async () => { throw closeError; }, kill: async () => { throw killError; } });
  await assert.rejects(subject.run(), (error) => error instanceof AggregateError
    && error.message === "BROWSER_PROCESS_CLEANUP_FAILED"
    && error.errors[0] === closeError
    && error.errors[1] === killError);
  assert.deepEqual(subject.calls, { close: 1, kill: 1 });
});
