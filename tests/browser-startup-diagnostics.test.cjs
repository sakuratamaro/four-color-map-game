"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createStartupDiagnostics, observeStartupPage, sanitizeStartupState } = require("./helpers/browser-startup-diagnostics.cjs");
test("only isolated local fixtures can construct startup diagnostics", () => {
  assert.throws(() => createStartupDiagnostics("https://example.com"), /LOCAL_FIXTURE_ONLY/);
  assert.throws(() => createStartupDiagnostics("http://example.com"), /LOCAL_FIXTURE_ONLY/);
  assert.ok(createStartupDiagnostics("http://127.0.0.1:12345"));
});
test("console errors from handled boot failures remain distinct from uncaught page errors", () => {
  const d = createStartupDiagnostics("http://127.0.0.1:12345");
  d.record("console-error", {url:"http://127.0.0.1:12345/standard-online-v5/app.js?v=secret",line:6597,column:1,text:"secret",args:["secret"]});
  d.record("pageerror", {name:"TypeError",message:"secret",stack:"secret"});
  assert.equal(d.snapshot()[0].pathname, "/standard-online-v5/app.js");
  assert.equal(d.snapshot()[0].line, 6597);
  assert.equal(d.snapshot()[1].error_class, "TypeError");
  assert.doesNotMatch(JSON.stringify(d.snapshot()), /secret|12345|message|stack|args/);
});
test("external and API URLs never retain paths queries tokens or coordinates", () => {
  const d = createStartupDiagnostics("http://localhost:1234");
  for(const url of ["https://example.com/secret","http://localhost:1234/api/private?token=secret","http://localhost:1235/standard-online-v5/app.js"]){
    d.record("requestfailed",{url,line:9,name:"secret",networkError:"secret"});
  }
  assert.ok(d.snapshot().every(row=>row.pathname===null&&row.line===null&&row.error_class===null&&row.network_error===null));
});
test("finite buffer and defensive snapshots cannot grow or mutate stored evidence", () => {
  const d=createStartupDiagnostics("http://localhost:1234",2);
  for(let i=0;i<100;i++)d.record("pageerror",{name:"Error"});
  assert.equal(d.snapshot().length,2);
  d.snapshot()[0].kind="changed";
  assert.equal(d.snapshot()[0].kind,"pageerror");
  d.record("unknown"); assert.equal(d.snapshot().length,2);
});
test("network code and source positions are allowlisted independently", () => {
  const d=createStartupDiagnostics("http://localhost:1234");
  d.record("requestfailed",{url:"http://localhost:1234/online/supabase-config.js?secret",networkError:"net::ERR_CONNECTION_RESET",line:-1,column:Infinity});
  assert.deepEqual(d.snapshot()[0],{kind:"requestfailed",pathname:"/online/supabase-config.js",line:null,column:null,error_class:null,network_error:"net::ERR_CONNECTION_RESET"});
});

test("startup DOM state keeps fixed enums and booleans only", () => {
  assert.deepEqual(sanitizeStartupState({documentReady:"complete",badge:"warn",fixturePresent:true,captureAvailable:true,
    profile:"secret",text:"secret",token:"secret"}), {document_ready:"complete",badge:"warn",fixture_present:true,capture_available:true});
  assert.deepEqual(sanitizeStartupState({documentReady:"secret",badge:"secret",fixturePresent:"secret"}),
    {document_ready:null,badge:null,fixture_present:null,capture_available:false});
});
test("observer captures handled, uncaught and failed request categories and detaches exactly once", () => {
  const page=new EventEmitter(),d=observeStartupPage(page,"http://127.0.0.1:1234");
  page.emit("pageerror",Object.assign(new Error("secret"),{name:"TypeError",stack:"secret"}));
  page.emit("console",{type:()=>"error",location:()=>({url:"http://127.0.0.1:1234/standard-online-v5/app.js?token=secret",lineNumber:2,columnNumber:3}),
    text:()=>{throw new Error("must never read text");},args:()=>{throw new Error("must never read arguments");}});
  page.emit("requestfailed",{url:()=>"http://127.0.0.1:1234/standard-online-v5/app.js?secret",
    failure:()=>({errorText:"net::ERR_CONNECTION_RESET"})});
  const result=d.snapshot({documentReady:"complete",badge:"other",fixturePresent:true,captureAvailable:true});
  assert.deepEqual(result.events.map(row=>row.kind),["pageerror","console-error","requestfailed"]);
  assert.equal(result.events[0].error_class,"TypeError");
  assert.equal(result.events[1].pathname,"/standard-online-v5/app.js");
  assert.equal(result.events[2].network_error,"net::ERR_CONNECTION_RESET");
  assert.doesNotMatch(JSON.stringify(result),/secret|1234|stack|arguments/);
  d.stop();d.stop();
  assert.equal(page.eventNames().length,0);
  page.emit("pageerror",new Error("later body failure"));
  assert.equal(d.snapshot().events.length,3);
});
test("network codes are a closed allowlist and unknown console levels are ignored", () => {
  const page=new EventEmitter(),d=observeStartupPage(page,"http://127.0.0.1:1234");
  page.emit("console",{type:()=>"log",location:()=>{throw new Error("not read");}});
  page.emit("requestfailed",{url:()=>"https://example.com/private?secret",failure:()=>({errorText:"net::ERR_SECRET_TOKEN"})});
  assert.deepEqual(d.snapshot().events,[{kind:"requestfailed",pathname:null,line:null,column:null,error_class:null,network_error:null}]);
  d.stop();
});
