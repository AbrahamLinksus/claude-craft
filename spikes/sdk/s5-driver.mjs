// Spike 5 driver: start the fake daemon, snapshot its descendants, kill it, list survivors.
// usage: node s5-driver.mjs <variant: default|tracked|fake> <kill: stop-process|taskkill-f> [jobhost]
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { here, save } from "./common.mjs";
const [variant = "default", kill = "taskkill-f"] = process.argv.slice(2);

// Every process with its creation time as Unix ms (0 when Windows reports none, e.g. System/Idle).
function procs() {
  const created =
    "@{n='Created';e={if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }}}";
  const out = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,${created} | ConvertTo-Json -Compress`,
    ],
    { encoding: "utf8", maxBuffer: 64e6 },
  );
  return JSON.parse(out).map((p) => ({
    pid: p.ProcessId,
    ppid: p.ParentProcessId,
    name: p.Name,
    created: Number(p.Created),
  }));
}
// Windows keeps a stale ParentProcessId after the parent exits, and pids are reused, so a child only
// counts if it was created after its parent (the pid+creation time identifies the real parent).
function descendants(all, rootPid) {
  const root = all.find((p) => p.pid === rootPid);
  if (!root) return [];
  const res = [];
  const q = [root];
  while (q.length) {
    const p = q.pop();
    for (const c of all) {
      if (c.ppid === p.pid && c.pid !== p.pid && c.created >= p.created && !res.includes(c)) {
        res.push(c);
        q.push(c);
      }
    }
  }
  return res;
}
// Kill only processes from our own snapshot that still exist with the same pid + creation time.
// No /T: the snapshot already holds the whole tree, and /T would follow stale parent ids.
function killTracked(tracked) {
  const now = procs();
  const alive = tracked.filter((b) => now.some((n) => n.pid === b.pid && n.created === b.created));
  for (const s of alive) {
    try {
      execFileSync("taskkill", ["/F", "/PID", String(s.pid)], { stdio: "ignore" });
    } catch {
      // already gone
    }
  }
  return alive;
}
// 3rd arg 'jobhost' = tier-B emulation (daemon holds the only handle of a kill-on-close job, see jobtools/jobhost.cs)
const hosted = process.argv[4] === "jobhost";
const readyFile = path.join(process.env.SPIKE_TMP, "s5-ready.txt");
fs.rmSync(readyFile, { force: true });
const env = { ...process.env, READY_FILE: readyFile };
let daemon;
if (hosted) {
  const exe = path.join(here, "jobtools", "jobhost.exe");
  if (!fs.existsSync(exe)) {
    console.log(`missing ${exe}; build it first: csc -out:jobhost.exe jobhost.cs`);
    process.exit(2);
  }
  const hostProc = spawn(exe, [process.execPath, path.join(here, "s5-daemon.mjs"), variant], {
    stdio: ["ignore", "pipe", "ignore"],
    env,
  });
  const out = await new Promise((resolve, reject) => {
    hostProc.once("error", reject);
    hostProc.once("exit", (code) =>
      reject(new Error(`jobhost exited (${code}) before printing the daemon PID`)),
    );
    hostProc.stdout.once("data", (d) => resolve(String(d)));
  });
  daemon = { pid: Number(/PID (\d+)/.exec(out)[1]), exitCode: null };
} else {
  daemon = spawn(process.execPath, [path.join(here, "s5-daemon.mjs"), variant], {
    stdio: "ignore",
    env,
  });
}
const t0 = Date.now();
while (!fs.existsSync(readyFile) && Date.now() - t0 < 120000)
  await new Promise((r) => setTimeout(r, 500));
const ready = fs.existsSync(readyFile);
if (!ready) {
  console.log("daemon never became READY");
  const tree = descendants(procs(), daemon.pid);
  try {
    process.kill(daemon.pid);
  } catch {
    // already gone
  }
  killTracked(tree);
  process.exit(2);
}

const before = descendants(procs(), daemon.pid);
const names = {};
for (const p of before) names[p.name] = (names[p.name] ?? 0) + 1;
console.log("descendants before kill:", before.length, JSON.stringify(names));

if (kill === "stop-process")
  execFileSync("powershell", ["-NoProfile", "-Command", `Stop-Process -Id ${daemon.pid} -Force`]);
else execFileSync("taskkill", ["/F", "/PID", String(daemon.pid)]); // no /T: daemon only
console.log("killed daemon with", kill);
await new Promise((r) => setTimeout(r, 5000));
const now = procs();
const survivors = before.filter((b) => now.some((n) => n.pid === b.pid && n.created === b.created));
const daemonAlive = now.some((n) => n.pid === daemon.pid);
console.log(
  "daemon alive:",
  daemonAlive,
  "survivors:",
  survivors.length,
  JSON.stringify(survivors.map((s) => `${s.name}:${s.pid}`)),
);
const result = {
  variant,
  kill,
  hosted,
  descendantsBefore: before.map((b) => ({ name: b.name, pid: b.pid, ppid: b.ppid })),
  survivors: survivors.map((s) => ({ name: s.name, pid: s.pid })),
  daemonAlive,
};
save(`spike5-${variant}-${kill}${hosted ? "-jobhost" : ""}.json`, result);
// cleanup: only the survivors from our own verified snapshot, so nothing the spike started outlives it
killTracked(survivors);
