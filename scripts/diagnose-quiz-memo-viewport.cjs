"use strict";
// Reuse the committed browser fixture without mutating the published candidate.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const filename = path.resolve(__dirname, "../../quiz-memo-calculator-20260912/tests/standard-online-browser.test.cjs");
const source = fs.readFileSync(filename, "utf8");
const probe = `
test("memo viewport probe", { timeout: 120000 }, async () => {
  await withPage("quizPhysics", async page => {
    const snapshots = [];
    const capture = async label => snapshots.push(await page.evaluate(label => {
      const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top:r.top, bottom:r.bottom }; };
      return { label, scrollY, question:rect("quizQuestion"), entry:rect("quizMemoOn"), tools:rect("quizMemoTools"), focus:document.activeElement.id };
    }, label));
    await startMemoQuiz(page);
    await capture("before");
    await page.locator("#quizMemoOn").click();
    await page.waitForTimeout(400);
    await capture("ON settled");
    await drawMemoStroke(page);
    await page.locator("#quizCalculatorPanel summary").click();
    await capture("calculator expanded");
    await page.locator("#quizCalculatorExpression").click();
    await page.keyboard.type("(1234.56+2)*3");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await capture("native input settled");
    await page.locator("#quizCalculatorExpression").fill("2+3");
    await page.locator("#quizCalculatorExpression").press("Enter");
    await capture("locator fill");
    console.log(JSON.stringify({ browser:browserName,snapshots }));
  }, { viewport:{width:390,height:844},deviceScaleFactor:2 });
});
`;
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(source + probe, filename);
