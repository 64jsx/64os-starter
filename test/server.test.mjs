// Tests for server.mjs. Run from the repo folder:  node --test "test/*.test.mjs"
// (On Node 22 the bare directory form "node --test test/" fails: the directory is run as a module.)
// Every test gets its own temp data folder and a random port, so the real data folder is never touched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {startServer, writeAtomic} from "../server.mjs";

const serverFile = fileURLToPath(new URL("../server.mjs", import.meta.url));
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }; // the local date, as the server names its backups
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "os64-"));
const removeDir = dir => fs.rmSync(dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 50});
const readText = (dir, name) => fs.readFileSync(path.join(dir, name), "utf8");
const readJson = (dir, name) => JSON.parse(readText(dir, name));
const backupNames = dir => {
  const folder = path.join(dir, "backups");
  return fs.existsSync(folder) ? fs.readdirSync(folder).sort() : [];
};

// fetch with a time limit, so a broken server fails a test instead of hanging the run
const call = (url, init) => fetch(url, {signal: AbortSignal.timeout(5000), ...init});
const putRaw = (base, body) => call(base + "/api/state", {method: "PUT", headers: {"Content-Type": "application/json"}, body});
const putState = (base, rev, state) => putRaw(base, JSON.stringify({rev, state}));

// Polls until check() gives something truthy, so no test sleeps longer than it has to.
async function waitFor(check, what, ms = 3000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    assert.ok(Date.now() < deadline, "timed out after " + ms + " ms waiting for " + what);
    await sleep(20);
  }
}

// Fresh data folder + server on a random port for one test; always cleaned up.
async function withServer(run, options = {}) {
  const dir = tempDir();
  let server;
  try {
    server = await startServer({port: 0, dataDir: dir, ...options});
    await run({dir, server, base: "http://127.0.0.1:" + server.port});
  } finally {
    if (server) await server.close();
    removeDir(dir);
  }
}

// Minimal SSE client: remembers the names of the events it receives.
async function openEvents(port) {
  const req = http.get({host: "127.0.0.1", port, path: "/api/events", signal: AbortSignal.timeout(8000)});
  req.on("error", () => {});
  const res = await new Promise((resolve, reject) => {
    req.once("response", resolve);
    req.once("error", reject);
  });
  res.on("error", () => {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "text/event-stream");
  const names = [];
  let buffer = "";
  res.setEncoding("utf8");
  res.on("data", chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const match = /^event: (.+)$/m.exec(buffer.slice(0, end));
      if (match) names.push(match[1]);
      buffer = buffer.slice(end + 2);
    }
  });
  return {names, close: () => req.destroy()};
}

// Runs "node <script>" with the server settings in the environment (the way the startup task runs it).
function launch(script, cwd, port, dataDir) {
  const child = spawn(process.execPath, [script], {
    cwd,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {...process.env, OS64_PORT: String(port), OS64_DATA: dataDir},
  });
  const proc = {output: "", done: false, code: null};
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { proc.output += chunk; });
  child.once("exit", code => { proc.done = true; proc.code = code; });
  proc.stop = async () => {
    child.kill();
    await waitFor(() => proc.done, "the server process to exit");
  };
  return proc;
}

// A port that was free a moment ago.
async function freePort() {
  const dir = tempDir();
  try {
    const probe = await startServer({port: 0, dataDir: dir});
    const port = probe.port;
    await probe.close();
    return port;
  } finally {
    removeDir(dir);
  }
}

// Starts "node <script>" as its own process and checks that it serves the port and folder it was given.
async function checkProcessServes(script, cwd) {
  const dataDir = tempDir();
  const port = await freePort();
  const proc = launch(script, cwd, port, dataDir);
  try {
    const res = await waitFor(() => call("http://127.0.0.1:" + port + "/api/state").catch(() => null), "the server process to answer", 8000);
    assert.deepEqual(await res.json(), {rev: 0, savedAt: null, state: null});
    assert.match(readText(dataDir, "server.log"), new RegExp("listening on 127\\.0\\.0\\.1:" + port + "\\n"));
    assert.equal(proc.output, "", "it prints nothing");
  } finally {
    await proc.stop();
    removeDir(dataDir);
  }
}

test("GET /api/state on an empty folder returns the empty default", () => withServer(async ({base}) => {
  const res = await call(base + "/api/state");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {rev: 0, savedAt: null, state: null});
}));

test("PUT {rev:0} writes os.json as {rev, savedAt, state} and leaves no temp file", () => withServer(async ({dir, base}) => {
  const res = await putState(base, 0, {a: 1});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {rev: 1});
  const doc = readJson(dir, "os.json");
  assert.deepEqual(Object.keys(doc), ["rev", "savedAt", "state"]);
  assert.equal(doc.rev, 1);
  assert.deepEqual(doc.state, {a: 1});
  assert.equal(new Date(doc.savedAt).toISOString(), doc.savedAt, "savedAt is an ISO time");
  assert.ok(Math.abs(Date.now() - Date.parse(doc.savedAt)) < 5000, "savedAt is now");
  assert.deepEqual(fs.readdirSync(dir).filter(name => name.endsWith(".tmp")), []);
  assert.deepEqual(await (await call(base + "/api/state")).json(), doc, "GET returns what was saved");
}));

test("PUT with a stale rev gets 409 with the current rev, changes nothing and is logged", () => withServer(async ({dir, base}) => {
  assert.equal((await putState(base, 0, {a: 1})).status, 200);
  const before = readText(dir, "os.json");
  const res = await putState(base, 0, {a: 2});
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {rev: 1});
  assert.equal(readText(dir, "os.json"), before);
  assert.match(readText(dir, "server.log"), /409 stale rev 0 vs 1/);
}));

test("backup: the first save of a day copies the previous os.json once, and only the newest 30 are kept", () => withServer(async ({dir, base}) => {
  const backups = path.join(dir, "backups");
  assert.equal((await putState(base, 0, {n: 1})).status, 200);
  assert.deepEqual(backupNames(dir), [], "the very first save has no previous file to copy");

  const old = Array.from({length: 31}, (_, i) => "os-2026-01-" + String(i + 1).padStart(2, "0") + ".json");
  fs.mkdirSync(backups, {recursive: true});
  for (const name of old) fs.writeFileSync(path.join(backups, name), "{}");
  const previous = readText(dir, "os.json");

  const dayBefore = today();
  assert.equal((await putState(base, 1, {n: 2})).status, 200);
  const dayAfter = today();
  const names = backupNames(dir);
  assert.equal(names.length, 30);
  assert.deepEqual(names.slice(0, 29), old.slice(2), "the two oldest backups are gone");
  const fresh = names[29];
  assert.ok([dayBefore, dayAfter].map(day => "os-" + day + ".json").includes(fresh), "today's backup: " + fresh);
  assert.equal(readText(backups, fresh), previous, "it holds the file as it was before the save");

  assert.equal((await putState(base, 2, {n: 3})).status, 200);
  assert.deepEqual(backupNames(dir), names, "a second save the same day adds and removes nothing");
  assert.equal(readText(backups, fresh), previous, "and does not overwrite the day's backup");
}));

test("SSE: a change of os.json from outside sends a state event within 3 s", () => withServer(async ({dir, server}) => {
  const events = await openEvents(server.port);
  try {
    fs.writeFileSync(path.join(dir, "os.json"), JSON.stringify({rev: 1, state: {migrated: true}}));
    await waitFor(() => events.names.includes("state"), "a state event");
  } finally {
    events.close();
  }
}));

test("SSE: the app's own save does not send a state event", () => withServer(async ({dir, base, server}) => {
  const events = await openEvents(server.port);
  try {
    assert.equal((await putState(base, 0, {a: 1})).status, 200);
    await sleep(1500); // longer than the window in which the server ignores the file events of its own save
    assert.deepEqual(events.names, []);
  } finally {
    events.close();
  }
}));

test("a request whose Host header is not this server is refused (DNS rebinding), a local Host passes", () => withServer(async ({dir, server}) => {
  const status = host => new Promise((resolve, reject) => {
    const req = http.request({host: "127.0.0.1", port: server.port, path: "/api/state", headers: {Host: host}}, res => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject); req.end();
  });
  assert.equal(await status("evil.example.com"), 403);
  assert.equal(await status("evil.example.com:" + server.port), 403);
  assert.equal(await status("127.0.0.1:1"), 403, "another port is another server");
  assert.equal(await status("127.0.0.1:" + server.port), 200);
  assert.equal(await status("localhost:" + server.port), 200);
  assert.equal(await status("LOCALHOST:" + server.port), 200, "case does not matter");
  assert.equal(await status("[::1]:" + server.port), 200);
  assert.match(readText(dir, "server.log"), /403 host evil\.example\.com/);
}));

test("writeAtomic retries a rename a lock refuses (Windows) and gives up cleanly after several tries", async () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, "os.json");
    const locked = () => { const e = new Error("locked"); e.code = "EPERM"; return e; };
    let attempts = 0;
    const twice = {...fs, renameSync: (a, b) => { attempts++; if (attempts <= 2) throw locked(); return fs.renameSync(a, b); }};
    await writeAtomic(file, {a: 1}, twice);
    assert.equal(attempts, 3, "two refusals, then the rename went through");
    assert.deepEqual(readJson(dir, "os.json"), {a: 1});
    assert.deepEqual(fs.readdirSync(dir), ["os.json"], "no temp file left");
    const always = {...fs, renameSync: () => { throw locked(); }};
    await assert.rejects(writeAtomic(file, {a: 2}, always), /locked/);
    assert.deepEqual(readJson(dir, "os.json"), {a: 1}, "the old file is untouched");
    assert.deepEqual(fs.readdirSync(dir), ["os.json"], "the temp file is removed after giving up");
    const other = {...fs, renameSync: () => { const e = new Error("no such dir"); e.code = "ENOENT"; throw e; }};
    await assert.rejects(writeAtomic(file, {a: 3}, other), /no such dir/, "an error that is not a lock is not retried");
  } finally { removeDir(dir); }
});

test("the server listens on 127.0.0.1 only", () => withServer(async ({server}) => {
  assert.equal(server.address, "127.0.0.1");
  const lan = Object.values(os.networkInterfaces()).flat().find(nic => nic.family === "IPv4" && !nic.internal);
  if (!lan) return;
  const reachable = await new Promise(resolve => {
    const socket = net.connect({host: lan.address, port: server.port, timeout: 1000});
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
  });
  assert.equal(reachable, false, "not reachable through " + lan.address);
}));

test("GET / and /index.html serve the html file, any other path is 404", async () => {
  const htmlDir = tempDir();
  const htmlPath = path.join(htmlDir, "64os.html");
  const html = "<!doctype html><title>64 OS</title><p>Zażółć gęślą jaźń</p>";
  fs.writeFileSync(htmlPath, html);
  try {
    await withServer(async ({base}) => {
      for (const url of ["/", "/index.html", "/?cache=1"]) {
        const res = await call(base + url);
        assert.equal(res.status, 200, url);
        assert.match(res.headers.get("content-type"), /^text\/html; charset=utf-8/);
        assert.equal(res.headers.get("cache-control"), "no-store");
        assert.equal(await res.text(), html);
      }
      assert.equal((await call(base + "/nope")).status, 404);
    }, {htmlPath});
  } finally {
    removeDir(htmlDir);
  }
});

test("GET / answers 500 when the html file is missing, and the server keeps running", () => withServer(async ({base}) => {
  assert.equal((await call(base + "/")).status, 500);
  assert.equal((await call(base + "/api/state")).status, 200);
}, {htmlPath: path.join(os.tmpdir(), "os64-no-such-file.html")}));

test("PUT bodies that are not {rev, state}, or are over 20 MB, are refused and change nothing", () => withServer(async ({dir, base}) => {
  for (const body of ["{not json", "null", "[]", '{"state":{}}', '{"rev":"0","state":{}}', '{"rev":0}']) {
    assert.equal((await putRaw(base, body)).status, 400, body);
  }
  assert.equal((await putState(base, 0, {pad: "x".repeat(21e6)})).status, 413);
  assert.equal(fs.existsSync(path.join(dir, "os.json")), false);
  assert.equal((await call(base + "/api/state")).status, 200);
}));

test("a large state with Polish letters and emoji survives a save byte for byte", () => withServer(async ({base}) => {
  // About 1 MB arrives in many chunks, some of which end in the middle of a character.
  const state = {text: "ąęłóżź€😀".repeat(50000)};
  assert.equal((await putState(base, 0, state)).status, 200);
  const saved = await (await call(base + "/api/state")).json();
  assert.equal(saved.state.text, state.text);
}));

test("an os.json written by the migration as {rev, state} is served with savedAt null and can be saved over", () => withServer(async ({dir, base}) => {
  fs.writeFileSync(path.join(dir, "os.json"), JSON.stringify({rev: 1, state: {weeks: 3}}));
  assert.deepEqual(await (await call(base + "/api/state")).json(), {rev: 1, savedAt: null, state: {weeks: 3}});
  assert.equal((await putState(base, 0, {x: 1})).status, 409);
  assert.equal((await putState(base, 1, {weeks: 4})).status, 200);
  assert.equal(readJson(dir, "os.json").rev, 2);
  const names = backupNames(dir);
  assert.equal(names.length, 1);
  assert.deepEqual(readJson(path.join(dir, "backups"), names[0]), {rev: 1, state: {weeks: 3}}, "the migrated file was backed up before the first save");
}));

test("an os.json that cannot be parsed is reported as an error and never overwritten", () => withServer(async ({dir, base}) => {
  const broken = '{"rev":7,"state":{"half"';
  fs.writeFileSync(path.join(dir, "os.json"), broken);
  assert.equal((await call(base + "/api/state")).status, 500);
  assert.equal((await putState(base, 0, {a: 1})).status, 500);
  assert.equal(readText(dir, "os.json"), broken);
  assert.match(readText(dir, "server.log"), /os\.json/);
}));

test("node server.mjs honours OS64_PORT and OS64_DATA, works from any folder and prints nothing", async () => {
  const cwd = tempDir();  // the startup task does not run in the OS folder either
  try {
    await checkProcessServes(serverFile, cwd);
  } finally {
    removeDir(cwd);
  }
});

test("node server.mjs also starts when it is launched through a folder link", async () => {
  const [realDir, holder] = [tempDir(), tempDir()];
  try {
    fs.copyFileSync(serverFile, path.join(realDir, "server.mjs"));  // a copy, so nothing real sits behind the link
    fs.symlinkSync(realDir, path.join(holder, "link"), "junction");
    await checkProcessServes(path.join(holder, "link", "server.mjs"), holder);
  } finally {
    removeDir(holder);
    removeDir(realDir);
  }
});

test("node server.mjs exits with code 1 and a clear log line when the port is taken", () => withServer(async ({server}) => {
  const dataDir = tempDir();
  let proc;
  try {
    proc = launch("server.mjs", path.dirname(serverFile), server.port, dataDir);
    await waitFor(() => proc.done, "the second server to give up", 8000);
    assert.equal(proc.code, 1);
    assert.match(readText(dataDir, "server.log"), /cannot start: .*EADDRINUSE/);
    assert.equal(proc.output, "");
  } finally {
    if (proc) await proc.stop();
    removeDir(dataDir);
  }
}));

test("close() and a failed start both release the file watcher", async () => {
  // A closed handle disappears one event loop turn after close(), hence the waiting.
  const watchers = () => process.getActiveResourcesInfo().filter(name => name === "FSEventWrap").length;
  await waitFor(() => watchers() === 0, "the watchers of earlier tests to be released");
  await withServer(async ({server}) => {
    assert.equal(watchers(), 1);
    const other = tempDir();
    try {
      await assert.rejects(startServer({port: server.port, dataDir: other}), {code: "EADDRINUSE"});
      await waitFor(() => watchers() <= 1, "the failed start to release its watcher");
      assert.equal(watchers(), 1);
    } finally {
      removeDir(other);
    }
  });
  await waitFor(() => watchers() === 0, "close() to release the watcher");
});

// The motivation clips (2026-10-24): two fixed names in data/media, ranges for seeking, nothing else reachable.
test("media: /api/media says what exists, /media serves the two clips with ranges and nothing else", () => { const media = tempDir(); return withServer(async ({dir, base}) => {
  assert.deepEqual(await (await call(base + "/api/media")).json(), {video: false, audio: false});
  fs.writeFileSync(path.join(media, "motivation.mp3"), Buffer.alloc(1000, 7));
  fs.writeFileSync(path.join(media, "secret.mp3"), "x");
  assert.deepEqual(await (await call(base + "/api/media")).json(), {video: false, audio: true});
  const all = await call(base + "/media/motivation.mp3");
  assert.equal(all.status, 200);
  assert.equal(all.headers.get("content-type"), "audio/mpeg");
  assert.equal((await all.arrayBuffer()).byteLength, 1000);
  const part = await call(base + "/media/motivation.mp3", {headers: {Range: "bytes=100-199"}});
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), "bytes 100-199/1000");
  assert.equal((await part.arrayBuffer()).byteLength, 100);
  const tail = await call(base + "/media/motivation.mp3", {headers: {Range: "bytes=-50"}});
  assert.equal(tail.headers.get("content-range"), "bytes 950-999/1000");
  await tail.arrayBuffer();
  const past = await call(base + "/media/motivation.mp3", {headers: {Range: "bytes=5000-"}});
  assert.equal(past.status, 416);
  for (const bad of ["/media/secret.mp3", "/media/motivation.mp4", "/media/..%2Fos.json", "/media/"]) {
    const r = await call(base + bad);
    assert.equal(r.status, 404, bad);
    await r.arrayBuffer();
  }
}, {mediaDir: media}).finally(() => removeDir(media)); });
