// Electron spike main process. Starts a named-pipe echo server in this process, round-trips one JSON line
// over \\.\pipe\shell-spike-<pid> (real Windows named pipe, client and server sockets both in main), runs the UI.
// Args: --auto=N  --streams=0  --out=<file>  --hold=<ms> (report memory after that long, then quit)
const { app, BrowserWindow, ipcMain } = require("electron");
const net = require("net");
const path = require("path");
const fs = require("fs");

const arg = (k) => (process.argv.find((a) => a.startsWith("--" + k + "=")) || "").split("=")[1];
const outFile = arg("out");
const pipeName = "\\\\.\\pipe\\shell-spike-" + process.pid;

function startPipeServer() {
  const server = net.createServer((sock) => {
    let buf = "";
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        const msg = JSON.parse(line);
        sock.write(
          JSON.stringify({ t: "pong", id: msg.id, echo: msg, server_pid: process.pid }) + "\n",
        );
      }
    });
  });
  return new Promise((resolve) => server.listen(pipeName, () => resolve(server)));
}

function pipeRoundTrip(line) {
  return new Promise((resolve, reject) => {
    const c = net.connect(pipeName);
    let buf = "";
    c.on("connect", () => c.write(line + "\n"));
    c.on("data", (d) => {
      buf += d.toString("utf8");
      const i = buf.indexOf("\n");
      if (i >= 0) {
        resolve(buf.slice(0, i));
        c.end();
      }
    });
    c.on("error", reject);
    setTimeout(() => reject(new Error("pipe timeout")), 5000);
  });
}

function metrics() {
  return app.getAppMetrics().map((m) => ({
    pid: m.pid,
    type: m.type,
    workingSetMB: +(m.memory.workingSetSize / 1024).toFixed(1),
    privateMB: +((m.memory.privateBytes || 0) / 1024).toFixed(1),
  }));
}

function finish(obj) {
  const m = metrics();
  const sum = (k) => +m.reduce((a, x) => a + x[k], 0).toFixed(1);
  const result = Object.assign({}, obj, {
    processes: m,
    totalWorkingSetMB: sum("workingSetMB"),
    totalPrivateMB: sum("privateMB"),
    mainPid: process.pid,
    pipeResult,
    pipe: pipeName,
  });
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

function createWindow() {
  const w = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const query = process.argv
    .filter((a) => /^--(auto|streams)=/.test(a))
    .map((a) => a.slice(2))
    .join("&");
  w.loadFile(path.join(__dirname, "..", "web", "index.html"), { search: query });
  return w;
}

let win;
let pipeResult = null;
app.whenReady().then(async () => {
  const server = await startPipeServer();
  ipcMain.handle("pipe-round-trip", async (_e, line) => {
    const t0 = process.hrtime.bigint();
    const reply = await pipeRoundTrip(line);
    pipeResult = { sent: line, got: reply, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
    return reply;
  });
  let done = false;
  ipcMain.handle("report", (_e, obj) => {
    if (done) return;
    done = true;
    // keep the 5 streams running a moment so memory reflects steady state
    setTimeout(async () => {
      const shot = arg("shot");
      if (shot) fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
      finish(obj);
      server.close();
      app.quit();
    }, 1500);
  });
  win = createWindow();
  const hold = parseInt(arg("hold") || "0", 10);
  if (hold) {
    setTimeout(() => {
      finish({ kind: "hold" });
      app.quit();
    }, hold);
  }
  setTimeout(() => app.quit(), 120000); // safety
});
app.on("window-all-closed", () => app.quit());
