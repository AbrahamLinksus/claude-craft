/* eslint-disable no-undef -- browser script, globals shared via window */
// Wiring: 5 streaming panes (~30 frames/s), canvas graph, input bar with latency probe, optional shell bridge.
// Bridge contract (optional, set by each shell's preload): window.shellBridge =
//   { name: string, pipeRoundTrip(jsonLine): Promise<string>, report(obj): Promise<void> }
// URL params: ?auto=N runs N synthetic keystrokes after 3 s warmup, then reports; ?streams=0 disables streaming.
(function () {
  var $ = function (id) {
    return document.getElementById(id);
  };
  var params = new URLSearchParams(location.search);
  var bridge = window.shellBridge || null;
  var MAX_LINES = 60,
    FRAME_MS = 33,
    LINES_PER_FRAME = 2;
  var panes = [],
    linesTotal = 0,
    tick = 0,
    lastTotal = 0,
    lastT = performance.now();

  function measureCell() {
    var s = document.createElement("span");
    s.style.cssText =
      'position:absolute;visibility:hidden;font:14px/20px Consolas,"Cascadia Mono",monospace';
    s.textContent = "MMMMMMMMMM";
    document.body.appendChild(s);
    var w = s.getBoundingClientRect().width / 10;
    document.body.removeChild(s);
    return { w: w, h: 20 };
  }
  var cell = measureCell();

  function buildPanes() {
    var n = params.get("streams") === "0" ? 0 : Replay.count,
      i,
      el;
    for (i = 0; i < n; i++) {
      el = document.createElement("div");
      el.className = "pane";
      el.innerHTML = "<h2><b>s" + (i + 1) + "</b> sonnet</h2><pre></pre>";
      $("panes").appendChild(el);
      panes.push({
        pre: el.querySelector("pre"),
        stream: Replay.makeStream("s" + (i + 1), 1000 + i * 7919),
      });
    }
  }

  function pump() {
    var i, j, p, l, d;
    for (i = 0; i < panes.length; i++) {
      p = panes[i];
      for (j = 0; j < LINES_PER_FRAME; j++) {
        l = p.stream.next();
        d = document.createElement("div");
        d.className = l.k;
        d.textContent = l.s;
        p.pre.appendChild(d);
        linesTotal++;
      }
      while (p.pre.childNodes.length > MAX_LINES) p.pre.removeChild(p.pre.firstChild);
    }
  }

  function updateStats() {
    var now = performance.now(),
      lps = Math.round(((linesTotal - lastTotal) * 1000) / (now - lastT)),
      m = performance.memory;
    lastTotal = linesTotal;
    lastT = now;
    $("stats").textContent =
      "streams " +
      panes.length +
      " | lines/s " +
      lps +
      " | heap " +
      (m ? (m.usedJSHeapSize / 1048576).toFixed(0) + "MB" : "n/a");
  }

  function onKey(e) {
    var t0 = performance.now();
    if (e.key === "F9") showSummary();
    Bench.record(t0, function (d) {
      $("lat").textContent = "key-to-paint: " + d.toFixed(1) + " ms";
    });
  }

  function showSummary() {
    var s = Bench.summary();
    $("result").textContent = JSON.stringify(s);
    return s;
  }

  function autoRun(count) {
    var input = $("input"),
      i = 0;
    input.focus();
    Bench.reset();
    (function step() {
      if (i >= count) {
        var s = showSummary();
        if (bridge && bridge.report) bridge.report({ kind: "auto", summary: s });
        return;
      }
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
      input.value = input.value.slice(-40) + "a";
      i++;
      setTimeout(step, 40 + Math.random() * 30);
    })();
  }

  function testPipe() {
    if (!bridge || !bridge.pipeRoundTrip) {
      $("pipe").textContent = "pipe: no bridge (plain browser)";
      return;
    }
    var line = JSON.stringify({ t: "ping", id: 1, ts: Date.now() });
    $("pipe").textContent = "pipe: sending " + line;
    bridge
      .pipeRoundTrip(line)
      .then(function (r) {
        $("pipe").textContent = "pipe OK: sent " + line + " got " + r;
      })
      .catch(function (e) {
        $("pipe").textContent = "pipe FAILED: " + e;
      });
  }

  buildPanes();
  $("shell-name").textContent = bridge ? bridge.name : "browser";
  $("input").addEventListener("keydown", onKey);
  setInterval(function () {
    pump();
    tick++;
    BranchGraph.draw($("graph"), cell, tick >> 3);
  }, FRAME_MS);
  setInterval(updateStats, 1000);
  testPipe();
  window.spike = { summary: showSummary, reset: Bench.reset, autoRun: autoRun, testPipe: testPipe };
  if (params.has("auto"))
    setTimeout(function () {
      autoRun(parseInt(params.get("auto"), 10) || 200);
    }, 3000);
})();
