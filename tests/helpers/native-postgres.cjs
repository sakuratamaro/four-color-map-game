"use strict";
// An owned, temporary PostgreSQL server for genuine multi-session acceptance.
// Never reads a database URL or connects to a pre-existing cluster/service.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), net = require("node:net");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const pgBin = process.env.FCG_TEST_POSTGRES_BIN;
async function unusedLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function createNativePostgres() {
  assert.ok(pgBin, "FCG_TEST_POSTGRES_BIN must name test binaries; no remote database fallback");
  const { Client, types } = createRequire(path.join(__dirname, "../sql-runtime/package.json"))("pg");
  let bin = fs.realpathSync(path.resolve(pgBin));
  const suffix = process.platform === "win32" ? ".exe" : "";
  const executable = name => path.join(bin, name + suffix);
  for (const name of ["postgres", "pg_ctl", "initdb"]) assert.ok(fs.existsSync(executable(name)), name);
  const tempParent = fs.realpathSync(os.tmpdir());
  const owned = fs.mkdtempSync(path.join(tempParent, "fcg-native-pg-"));
  const marker = randomUUID(), markerPath = path.join(owned, ".fcg-native-pg-owner");
  fs.writeFileSync(markerPath, marker, { flag: "wx" });
  const data = path.join(owned, "data"), log = path.join(owned, "server.log"), pwfile = path.join(owned, "init-password");
  const password = randomUUID() + randomUUID();
  let port;
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
  const run = (name, args, timeout = 45000) => new Promise((resolve, reject) => {
    const child = spawn(executable(name), args, { windowsHide:true, cwd:owned, env:childEnv, stdio:["ignore","pipe","pipe"] });
    let stdout="", stderr="", settled=false;
    const finish = error => {
      if (settled) return; settled=true; clearTimeout(timer);
      // pg_ctl's daemon can inherit a pipe on Windows. Wait for the actual
      // command EXIT, then close only these parent-side capture handles.
      child.stdout.destroy(); child.stderr.destroy();
      if(error) reject(error); else resolve({stdout,stderr});
    };
    const timer = setTimeout(() => { child.kill(); finish(new Error(name + " test command timed out; " + stderr)); }, timeout);
    child.stdout.on("data", chunk => { stdout=(stdout+chunk).slice(-1000000); });
    child.stderr.on("data", chunk => { stderr=(stderr+chunk).slice(-1000000); });
    child.once("error",finish);
    child.once("exit", (code, signal) => finish(code===0 ? null : new Error(name + " exited " + code + "/" + signal + "; " + stderr + stdout)));
  });
  const sessions = new Set();
  let closing = false;
  async function openSession() {
    const client = new Client({
      host: "127.0.0.1", port, user: "fcg_test_owner", password, database: "postgres", ssl: false,
      connectionTimeoutMillis: 5000, statement_timeout: 12000, lock_timeout: 8000,
      application_name: "fcg-isolated-progression-test",
      types: { getTypeParser: (oid, format) => oid === 20 ? value => {
        const number = Number(value); assert.ok(Number.isSafeInteger(number)); return number;
      } : types.getTypeParser(oid, format) },
    });
    await client.connect();
    client.on("error", error => { console.error("PG_TEST_SESSION_ERROR " + error.message); });
    sessions.add(client);
    await client.query("set idle_in_transaction_session_timeout='20s'");
    const pid = (await client.query("select pg_backend_pid() pid")).rows[0].pid;
    return { pid, query: (...args) => client.query(...args), exec: sql => client.query(sql),
      close: async () => { sessions.delete(client); await client.end(); } };
  }
  async function close() {
    if (closing) return;
    closing = true;
    await Promise.allSettled([...sessions].map(client => client.end())); sessions.clear();
    // pg_ctl is restricted to our exact data directory; never kill by name/PID wildcard.
    if (fs.existsSync(path.join(data, "postmaster.pid"))) {
      try { await run("pg_ctl", ["-D", data, "-m", "fast", "-w", "-t", "15", "stop"], 20000); }
      catch (error) { console.error("PG_TEST_RETAINED " + owned); throw error; }
    }
    assert.equal(fs.existsSync(path.join(data, "postmaster.pid")), false, "Do not remove a live cluster");
    const resolved = fs.realpathSync(owned);
    assert.equal(path.dirname(resolved).toLowerCase(), tempParent.toLowerCase());
    assert.ok(path.basename(resolved).startsWith("fcg-native-pg-"));
    assert.equal(fs.readFileSync(markerPath, "utf8"), marker);
    // Only this invocation's temporary cluster, after verified shutdown.
    // Async cleanup lets Windows close the exited pg_ctl's directory handle.
    await fs.promises.rm(resolved, { recursive:true, maxRetries:10, retryDelay:100 });
    console.error("PG_TEST_STOPPED_AND_REMOVED " + owned);
  }
  try {
    // Windows PostgreSQL 17 bootstrap interpolates its library path using the
    // system code page. Stage non-ASCII binaries in our owned ASCII temp area.
    if (process.platform === "win32" && /[^\x00-\x7f]/.test(bin)) {
      const source = path.dirname(bin), target = path.join(owned, "runtime");
      assert.doesNotMatch(owned, /[^\x00-\x7f]/, "PostgreSQL needs an ASCII temporary runtime path on this Windows build");
      for (const folder of ["bin", "lib", "share"]) fs.cpSync(path.join(source, folder), path.join(target, folder), { recursive:true });
      bin = path.join(target, "bin");
    }
    port = await unusedLoopbackPort();
    fs.writeFileSync(pwfile, password + "\n", { flag: "wx", mode: 0o600 });
    await run("initdb", ["-D", data, "-U", "fcg_test_owner", "--auth=scram-sha-256", "--pwfile", pwfile,
      "--encoding=UTF8", "--locale=C", "--no-instructions"]);
    fs.unlinkSync(pwfile);
    fs.appendFileSync(path.join(data, "postgresql.conf"), "\nunix_socket_directories = ''\n");
    await run("pg_ctl", ["-D", data, "-l", log, "-w", "-t", "30", "-o",
      "-h 127.0.0.1 -p " + port + " -c shared_buffers=16MB -c max_connections=8 -c wal_level=logical -c max_wal_senders=2", "start"]);
    const primary = await openSession();
    const version = (await primary.query("select version() version")).rows[0].version;
    assert.match(version, /^PostgreSQL 17\./, "Pilot acceptance is pinned to PostgreSQL 17");
    console.error("PG_TEST_READY " + JSON.stringify({ version, host: "127.0.0.1", port, primaryPid: primary.pid }));
    return { ...primary, version, openSession, close };
  } catch (error) {
    if (fs.existsSync(log)) console.error("PG_TEST_SERVER_LOG " + fs.readFileSync(log, "utf8").slice(-6000));
    try { await close(); } catch (cleanup) { error.message += "; cleanup: " + cleanup.message; }
    throw error;
  }
}
async function waitForBlocked(observer, blocked, blocker) {
  assert.notEqual(blocked.pid, blocker.pid);
  const deadline = Date.now() + 5000;
  let row;
  while (Date.now() < deadline) {
    row = (await observer.query(
      `with recursive dependencies(pid,seen) as (
        select $1::int,array[$1::int]
        union all
        select next.pid,d.seen||next.pid from dependencies d
        cross join lateral unnest(pg_blocking_pids(d.pid)) next(pid)
        where not next.pid=any(d.seen) and cardinality(d.seen)<8
      ) select wait_event_type,wait_event,pg_blocking_pids(pid) blockers,
        array(select distinct pid from dependencies where pid<>$1) blocking_chain
        from pg_stat_activity where pid=$1`,
      [blocked.pid])).rows[0];
    if (row?.wait_event_type === "Lock" && row.blocking_chain.includes(blocker.pid)) {
      console.error("PG_TEST_OVERLAP " + JSON.stringify({ blockedPid: blocked.pid, blockerPid: blocker.pid, ...row }));
      return row;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("No genuine blocked-backend overlap: " + JSON.stringify(row));
}
module.exports = { pgBin, createNativePostgres, waitForBlocked };
