/* eslint-disable no-undef -- browser script, globals shared via window */
// Keystroke-to-paint: keydown handler entry -> frame presented.
// Paint proxy: requestAnimationFrame callback, then a MessageChannel task (runs after that frame commits).
(function (g) {
  var samples = [];
  function afterPaint(cb) {
    var ch = new MessageChannel();
    ch.port1.onmessage = function () {
      cb();
    };
    requestAnimationFrame(function () {
      ch.port2.postMessage(0);
    });
  }
  function record(t0, onDone) {
    afterPaint(function () {
      var d = performance.now() - t0;
      samples.push(d);
      if (onDone) onDone(d);
    });
  }
  function pct(arr, p) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) {
      return a - b;
    });
    return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
  }
  function summary() {
    var m = performance.memory;
    return {
      n: samples.length,
      p50: pct(samples, 50),
      p95: pct(samples, 95),
      p99: pct(samples, 99),
      max: samples.length ? Math.max.apply(null, samples) : null,
      heapMB: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : null,
      ua: navigator.userAgent,
    };
  }
  function reset() {
    samples.length = 0;
  }
  g.Bench = { record: record, summary: summary, reset: reset };
})(window);
