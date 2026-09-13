"use strict";
// Local fixture-only observer by default. Explicit flags enable one viewport
// resize counterexperiment; neither product sources nor input events are forged.
const { chromium } = require("playwright");
const resizeOnMeasure = Number(process.env.SHIFT_DIAG_RESIZE_ON_MEASURE || 0);
const refreshAfterResize = process.env.SHIFT_DIAG_REFRESH_AFTER_RESIZE === "1";
const connect = chromium.connect.bind(chromium);
chromium.connect = async (...args) => {
  const browser = await connect(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArgs) => {
    const context = await newContext(...contextArgs);
    await context.addInitScript(() => {
      const records = [];
      globalThis.__shiftPointerDiagnostic = records;
      const snap = (kind, event) => {
        if (!["127.0.0.1", "localhost"].includes(location.hostname) || !globalThis.__standardOnlineRuntime) return;
        if (records.length >= 160) return;
        const board = document.getElementById("board");
        if (!board) return;
        const rect = board.getBoundingClientRect();
        const viewport = document.getElementById("boardViewport");
        const target = document.getElementById("skillTargetControls");
        const width = globalThis.__standardOnlineRuntime?.room?.public_state?.playableBounds?.macroWidth;
        records.push({
          kind, time: Math.round(performance.now()), eventType: event?.type,
          target: event?.target?.id || event?.target?.textContent?.slice(0, 55),
          client: event ? [event.clientX, event.clientY] : null,
          pointerId: event?.pointerId, isPrimary: event?.isPrimary,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          mapped: event && width ? [Math.floor((event.clientX - rect.x) / rect.width * width),
            Math.floor((event.clientY - rect.y) / rect.height * width)] : null,
          scroll: [scrollX, scrollY, viewport?.scrollLeft, viewport?.scrollTop],
          focus: document.activeElement?.id, targetText: target?.textContent?.slice(0, 280)
        });
      };
      for (const type of ["pointerdown", "pointerup", "pointercancel", "click"]) {
        document.addEventListener(type, event => {
          snap("capture", event);
          requestAnimationFrame(() => { snap("next-frame"); requestAnimationFrame(() => snap("second-frame")); });
        }, true);
      }
    });
    const measurements = [];
    let resized = false;
    const newPage = context.newPage.bind(context);
    context.newPage = async (...pageArgs) => {
      const page = await newPage(...pageArgs);
      const locate = page.locator.bind(page);
      page.locator = (selector, ...options) => {
        const locator = locate(selector, ...options);
        if (selector === "#board") {
          const box = locator.boundingBox.bind(locator), click = locator.click.bind(locator);
          locator.boundingBox = async (...boxArgs) => {
            const result = await box(...boxArgs);
            measurements.push({ kind: "measured-box", at: Date.now(), result });
            if (resizeOnMeasure && !resized) {
              resized = true;
              await page.setViewportSize({ ...page.viewportSize(), height: resizeOnMeasure });
              await locator.scrollIntoViewIfNeeded();
              const current = await box(...boxArgs);
              measurements.push({ kind: "controlled-viewport-resize", at: Date.now(), current,
                refreshAfterResize, oldCoordinatesIntentionallyKept: !refreshAfterResize });
              if (refreshAfterResize) return current;
            }
            return result;
          };
          locator.click = (...clickArgs) => {
            measurements.push({ kind: "requested-native-click", at: Date.now(), options: clickArgs });
            return click(...clickArgs);
          };
        }
        return locator;
      };
      return page;
    };
    const close = context.close.bind(context);
    context.close = async (...closeArgs) => {
      for (const page of context.pages()) {
        if (page.isClosed()) continue;
        const records = await page.evaluate(() => globalThis.__shiftPointerDiagnostic || [])
          .catch(error => [{ diagnosticReadFailure: error.message }]);
        console.log("SHIFT_POINTER_DIAGNOSTIC " + JSON.stringify({ measurements,
          boardEvents: records.filter(r => r.target === "board"),
          boardSizes: [...new Set(records.map(r => r.rect?.width))],
          final: records.at(-1) }));
      }
      return close(...closeArgs);
    };
    return context;
  };
  return browser;
};
