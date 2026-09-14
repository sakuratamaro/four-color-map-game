"use strict";
// Only SDK auth/transport/realtime notification are fixtures. Every request from
// the unmodified browser client reaches the actual TypeScript worker and SQL.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { createProgressionRuntime, api, winningEdgeScript, postgrestRpcResult } = require("./cpu-progression-runtime.cjs");
const { plain } = require("./public-skill-fixture.cjs");
const { startStaticServer } = require("./static-server.cjs");
const { closeOwnedBrowserServer } = require("./browser-server-cleanup.cjs");
const browserName = process.env.STANDARD_BROWSER || "edge";
const paths = { chrome: "C:/Program Files/Google/Chrome/Application/chrome.exe", edge: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" };
async function bounded(stage, promise, timeoutMs) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("BROWSER_STAGE_TIMEOUT " + stage)), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
const stage = name => console.error("PILOT_NATIVE_STAGE " + name);
function sdkFixture(id) {
  const listeners = new Set();
  function notify() { queueMicrotask(() => listeners.forEach(fn => fn({}))); }
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id }, access_token: "isolated-platform-fixture" } } }) },
    from(table) {
      if (table !== "fcg_standard_profiles") throw new Error("Unexpected public table");
      let actor;
      return { select() { return this; }, eq(column, value) { if(column !== "user_id" || value !== id) throw new Error("Wrong profile actor"); actor = value; return this; },
        async maybeSingle() { return { data: await globalThis.__pilotReadProfile(actor) }; } };
    },
    async rpc(name, args) {
      const result=await globalThis.__pilotPublicRpc(name, args || {});
      if(name==="fcg_standard_room_snapshot_v2"&&!result.error) globalThis.__pilotLastSnapshot=Array.isArray(result.data)?result.data[0]:result.data;
      return result;
    },
    functions: { async invoke(name, { body }) {
      if(name !== "standard-game-action") throw new Error("Unexpected function");
      const result = await globalThis.__pilotWorker(body);
      notify();
      if(result.drop) return { error: new Error("Committed reply lost in transport fixture") };
      return result.status === 200 ? { data: result.body }
        : { error: { context: new Response(JSON.stringify(result.body), { status: result.status }) } };
    } },
    channel() {
      let listener;
      const channel = { on(_type, _filter, fn) { listener=fn; return channel; }, subscribe(fn) { if(listener) listeners.add(listener); queueMicrotask(() => fn("SUBSCRIBED")); return channel; }, remove() { listeners.delete(listener); } };
      return channel;
    },
    async removeChannel(channel) { channel.remove(); },
  };
}
async function withProgressionPage(run, { width = 390, wins = 1, timeout = 220000 } = {}) {
  assert.ok(paths[browserName] && fs.existsSync(paths[browserName]), "Native browser required");
  let runtime, httpServer, browserServer, browser, context, page, error, diagnosticCalls=[];
  let tail = Promise.resolve();
  // PGlite is single-session: never overlap SET ROLE scopes. This is explicitly
  // not our separate multi-session race proof.
  const serial = fn => { const result = tail.then(fn); tail = result.catch(() => {}); return result; };
  try {
    stage("sql-start"); runtime = await bounded("sql-ready", createProgressionRuntime(), 15000);
    const id = await runtime.player(wins), worker = runtime.worker(id), calls = [], blockedRequests = [], drops = new Set();
    diagnosticCalls=calls;
    const { server, url } = await startStaticServer(); httpServer = server;
    browserServer = await chromium.launchServer({ executablePath: paths[browserName], headless: true, timeout: 15000 });
    browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 5000 });
    context = await browser.newContext({ viewport: { width, height: 844 } });
    context.setDefaultTimeout(12000);
    await context.exposeFunction("__pilotReadProfile", actor => serial(async () => { assert.equal(actor,id); return plain(await runtime.profile(id)); }));
    await context.exposeFunction("__pilotPublicRpc", (name,args) => serial(async () => {
      assert.ok(["fcg_standard_active_room","fcg_standard_matchmaking_availability","fcg_standard_room_snapshot_v2"].includes(name),name);
      calls.push({ kind: "public-rpc", name, args: plain(args) });
      try {
        const rows=plain(await runtime.rpc(name,args,"authenticated",id));
        // SQL SELECT * wraps a scalar jsonb-returning RPC in a named column.
        // PostgREST returns that scalar directly; SETOF/TABLE results stay arrays.
        const data=postgrestRpcResult(name,rows);
        return { data };
      }
      catch(e) { return { error: { code:e.code, message:e.message } }; }
    }));
    await context.exposeFunction("__pilotWorker", body => serial(async () => {
      calls.push({ kind:"worker", body:plain(body) });
      const result=await worker.post(body), drop=result.status===200 && drops.delete(body.operation);
      calls.at(-1).status=result.status; calls.at(-1).drop=drop;
      return { ...result, drop };
    }));
    await context.route("**/*", async route => {
      const requested = route.request().url();
      if(requested.startsWith(url + "/")) return route.continue();
      if(requested === "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        return route.fulfill({ status:200, contentType:"text/javascript", body:`export function createClient(){return (${sdkFixture.toString()})(${JSON.stringify(id)})}` });
      blockedRequests.push(requested); return route.abort("blockedbyclient");
    });
    page = await context.newPage();
    const errors=[]; page.on("pageerror", e => errors.push(e.message));
    stage("page-open"); await page.goto(url + "/standard-online-v5/index.html", { timeout:20000 });
    await page.locator("#connectionBadge.good").waitFor({state:"attached"});
    await page.locator("#toggleProfileOptions:not(.hidden)").waitFor({state:"attached"});
    const fixture={ id, calls, errors, blockedRequests, drop:operation=>drops.add(operation),
      profile:()=>serial(()=>runtime.profile(id)), authority:roomId=>serial(()=>runtime.authority(roomId)),
      snapshot:roomId=>serial(()=>runtime.snapshot(id,roomId)), serial, runtime, worker,
      roomId:()=>page.evaluate(()=>JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.connection")).roomId) };
    stage("journey-start"); await bounded("native-journey",run(page,fixture),timeout);
    assert.deepEqual(errors,[]); assert.deepEqual(blockedRequests,[]);
    stage("journey-complete");
  } catch(e) {
    error=e;
    if(page) {
      try { console.error("PILOT_NATIVE_FAILURE " + JSON.stringify(await page.evaluate(()=>({
        badge:document.querySelector("#connectionBadge")?.textContent,
        status:document.querySelector("#actionStatus")?.textContent,
        room:document.querySelector("#roomSummary")?.textContent,
        version:document.querySelector("#versionText")?.textContent,
        setup:document.querySelector("#setupStatus")?.textContent,
        random:document.querySelector("#randomReveal")?.className,
        match:document.querySelector("#matchCard")?.className,
        lastRoom:globalThis.__pilotLastSnapshot?.room?.id,
        tabs:[...document.querySelectorAll('[aria-selected="true"]')].map(n=>n.textContent),
        alerts:[...document.querySelectorAll("dialog[open]")].map(n=>({id:n.id,text:n.innerText.slice(0,500)}))
      })))); } catch { /* preserve original */ }
      console.error("PILOT_NATIVE_CALLS " + JSON.stringify(diagnosticCalls.slice(-8)));
    }
  } finally {
    try { if(context) await bounded("context-close",context.close(),10000); }
    finally {
      try { await closeOwnedBrowserServer({browserServer,bounded,stage}); }
      finally {
        if(httpServer) { httpServer.closeAllConnections(); await new Promise(resolve=>httpServer.close(resolve)); }
        await tail;
        if(runtime) await runtime.close();
      }
    }
  }
  if(error) throw error;
}
module.exports = { withProgressionPage, browserName, api, winningEdgeScript, stage };
