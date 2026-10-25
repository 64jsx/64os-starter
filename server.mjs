// 64 OS local server. Serves the app (GET /) and its data on 127.0.0.1 only, so nothing leaves this PC.
//   data/os.json   {rev, savedAt, state}: everything you tick and time, written only by the app through PUT /api/state;
//                  a change from outside (another window) reaches the open pages on GET /api/events (SSE)
//   media/         the motivation clips (motivation.mp4, motivation.mp3), served read-only on GET /media/<name>
// Node built-ins only. The only output is data/server.log, nothing goes to the console.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const KEEP_BACKUPS = 30;
const MAX_BODY = 20e6;      // characters; the whole app state is a few hundred KB
const DEBOUNCE_MS = 150;    // file events come in bursts, answer once
const OWN_WRITE_MS = 1000;  // file events this soon after our own save are not "from outside"
const MEDIA = {"motivation.mp4": "video/mp4", "motivation.mp3": "audio/mpeg"};  // the only files /media serves

// the local date (the PC's clock), so a backup made just after midnight carries the new day like the ticks do
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const httpError = (status, message) => Object.assign(new Error(message), {status});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// On Windows a file another program holds open for a moment (a backup tool, a sync client, antivirus)
// refuses a rename or a copy with EPERM or EBUSY. Such a step is tried again a few times before the save is given up.
const LOCK_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
async function retrying(step, tries = 6, wait = 60) {
  for (let i = 0; ; i++) {
    try { return step(); } catch (e) { if (!LOCK_CODES.has(e && e.code) || i >= tries - 1) throw e; await sleep(wait); }
  }
}
// Only a page served by this server may talk to it. A browser sends the Host header it navigated to; a web page from the internet
// whose domain is made to point at 127.0.0.1 (DNS rebinding) arrives with that domain in Host and is refused.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
function hostAllowed(header, port) {
  if (!header) return true; // no Host at all (an old client): nothing to compare, and not the attack this guards against
  const h = String(header).toLowerCase();
  const m = h.match(/^(.*):(\d+)$/);
  const name = m ? m[1] : h, p = m ? Number(m[2]) : null;
  return LOCAL_HOSTS.has(name) && (p === null || p === port);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return undefined; }
}

// Temp file in the same folder, flushed to disk, then renamed over the target: a reader (or a crash) never sees half a
// file. The rename is retried while a lock refuses it; if it never goes through the temp file is removed and the error
// reaches the caller. io is the file module, replaceable by the tests.
export async function writeAtomic(file, obj, io = fs) {
  const tmp = file + "." + process.pid + ".tmp";
  const fd = io.openSync(tmp, "w");
  try { io.writeFileSync(fd, JSON.stringify(obj)); io.fsyncSync(fd); } finally { io.closeSync(fd); }
  try { await retrying(() => io.renameSync(tmp, file)); }
  catch (e) { try { io.unlinkSync(tmp); } catch (x) {} throw e; }
}

// Called before a save, while os.json still holds the previous state. The first save of a day copies
// it to backups/os-YYYY-MM-DD.json; later saves that day leave that copy alone. The newest 30 are kept.
async function backup(dataDir, file) {
  const dir = path.join(dataDir, "backups");
  fs.mkdirSync(dir, {recursive: true});
  const target = path.join(dir, "os-" + today() + ".json");
  if (!fs.existsSync(target) && fs.existsSync(file)) await retrying(() => fs.copyFileSync(file, target));
  const all = fs.readdirSync(dir).filter(f => /^os-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) fs.unlinkSync(path.join(dir, f));
}

// The parsed body of a PUT. A body that is too big is read to the end and thrown away, so the client gets its 413.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = "", size = 0;
    req.setEncoding("utf8");  // keeps a character that straddles two chunks in one piece
    req.on("data", chunk => { size += chunk.length; if (size <= MAX_BODY) text += chunk; });
    req.on("error", reject);
    req.on("end", () => {
      if (size > MAX_BODY) return reject(httpError(413, "body too large"));
      try { resolve(JSON.parse(text)); } catch (e) { reject(httpError(400, "body is not JSON")); }
    });
  });
}

export async function startServer({port = 6464, dataDir = path.join(here, "data"), htmlPath = path.join(here, "64os.html"), mediaDir = path.join(here, "media")} = {}) {
  fs.mkdirSync(dataDir, {recursive: true});
  const osFile = path.join(dataDir, "os.json");
  const logFile = path.join(dataDir, "server.log");
  const log = message => {
    try { fs.appendFileSync(logFile, new Date().toISOString() + " " + message + "\n"); } catch (e) {}
  };

  // A missing os.json is an empty store. A file that exists but cannot be read is an error:
  // answering "empty" would let the next save overwrite the user's data.
  const loadOs = () => {
    if (!fs.existsSync(osFile)) return {rev: 0, savedAt: null, state: null};
    const file = readJson(osFile);
    if (!file || typeof file !== "object") throw new Error("os.json exists but cannot be read or parsed");
    return {rev: Number.isInteger(file.rev) ? file.rev : 0, savedAt: file.savedAt ?? null, state: file.state ?? null};
  };

  const clients = new Set();
  const send = event => { for (const res of clients) res.write("event: " + event + "\ndata: {}\n\n"); };
  let ownWriteAt = 0, stateTimer;
  const watcher = fs.watch(dataDir, (kind, name) => {
    if (name === "os.json" && Date.now() - ownWriteAt > OWN_WRITE_MS) {
      clearTimeout(stateTimer);
      stateTimer = setTimeout(() => send("state"), DEBOUNCE_MS);
    }
  });
  watcher.on("error", e => log("watch error: " + e.message));

  const json = (res, code, obj, headers = {}) => {
    res.writeHead(code, {"Content-Type": "application/json", "Cache-Control": "no-store", ...headers});
    res.end(JSON.stringify(obj));
  };

  const server = http.createServer(async (req, res) => {
    const route = req.url.split("?")[0];
    try {
      if (!hostAllowed(req.headers.host, server.address().port)) {
        log("403 host " + req.headers.host);
        return json(res, 403, {error: "wrong host"});
      }
      if (req.method === "GET" && (route === "/" || route === "/index.html")) {
        const html = fs.readFileSync(htmlPath);  // read first, so a missing file still gets a clean 500
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"});
        return res.end(html);
      }
      if (route === "/api/state" && req.method === "GET") return json(res, 200, loadOs());
      if (route === "/api/state" && req.method === "PUT") {
        const body = await readBody(req);
        if (!body || typeof body !== "object" || !Number.isInteger(body.rev) || body.state === undefined) {
          throw httpError(400, "body must be {rev, state}");
        }
        const current = loadOs();
        if (body.rev !== current.rev) {
          log("409 stale rev " + body.rev + " vs " + current.rev);
          return json(res, 409, {rev: current.rev});
        }
        await backup(dataDir, osFile);
        const next = {rev: current.rev + 1, savedAt: new Date().toISOString(), state: body.state};
        ownWriteAt = Date.now();  // the file events of this save are delivered after this code has finished
        await writeAtomic(osFile, next);
        ownWriteAt = Date.now();
        return json(res, 200, {rev: next.rev});
      }
      if (route === "/api/media" && req.method === "GET") {
        const has = name => fs.existsSync(path.join(mediaDir, name));
        return json(res, 200, {video: has("motivation.mp4"), audio: has("motivation.mp3")});
      }
      if (route.startsWith("/media/") && (req.method === "GET" || req.method === "HEAD")) {
        const name = route.slice(7);
        if (!Object.hasOwn(MEDIA, name)) throw httpError(404, "no such media");
        const file = path.join(mediaDir, name);
        if (!fs.existsSync(file)) throw httpError(404, "no such media");
        const size = fs.statSync(file).size;
        const head = {"Content-Type": MEDIA[name], "Accept-Ranges": "bytes", "Cache-Control": "no-cache"};
        // the browser asks for ranges to seek in a video; answer them, or the clip cannot be scrubbed
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
        if (m && (m[1] || m[2])) {
          let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
          let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
          if (start >= size || start > end) {
            res.writeHead(416, {"Content-Range": "bytes */" + size});
            return res.end();
          }
          res.writeHead(206, {...head, "Content-Range": "bytes " + start + "-" + end + "/" + size, "Content-Length": end - start + 1});
          if (req.method === "HEAD") return res.end();
          return fs.createReadStream(file, {start, end}).pipe(res);
        }
        res.writeHead(200, {...head, "Content-Length": size});
        if (req.method === "HEAD") return res.end();
        return fs.createReadStream(file).pipe(res);
      }
      if (route === "/api/events" && req.method === "GET") {
        res.writeHead(200, {"Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive"});
        res.write(": ok\n\n");
        clients.add(res);
        res.on("close", () => clients.delete(res));
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (e) {
      const status = (e && e.status) || 500;
      log(status === 500 ? "error " + ((e && e.stack) || e) : status + " " + e.message);
      if (res.headersSent) return res.end();
      json(res, status, {error: status === 500 ? "server error" : e.message});
    }
  });

  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
    });
  } catch (e) {
    watcher.close();
    throw e;
  }
  const bound = server.address();
  log("listening on " + bound.address + ":" + bound.port);
  return {
    port: bound.port,
    address: bound.address,
    close: () => new Promise(resolve => {
      watcher.close();
      clearTimeout(stateTimer);
      for (const res of clients) res.end();
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}

// "node server.mjs": the settings come from OS64_PORT and OS64_DATA. The two paths are compared by real
// path, so it also starts when launched through a folder link (a plain comparison would silently not start).
const isMain = (() => {
  try { return fs.realpathSync.native(process.argv[1]) === fs.realpathSync.native(fileURLToPath(import.meta.url)); } catch (e) { return false; }
})();
if (isMain) {
  const dataDir = process.env.OS64_DATA || path.join(here, "data");
  startServer({port: Number(process.env.OS64_PORT || 6464), dataDir}).catch(e => {
    try {
      fs.mkdirSync(dataDir, {recursive: true});
      fs.appendFileSync(path.join(dataDir, "server.log"), new Date().toISOString() + " cannot start: " + e.message + "\n");
    } catch (x) {}
    process.exit(1);
  });
}
