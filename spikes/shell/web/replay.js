/* eslint-disable no-undef -- browser script, globals shared via window */
// Deterministic replayed streaming transcripts. Plain script, no deps.
(function (g) {
  var WORDS = (
    "read file src db ts edit plan test pass fail merge branch worktree session turn tool call " +
    "result diff stage commit hook prompt allow deny stream token model sonnet opus haiku patch lint types"
  ).split(" ");
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function makeStream(id, seed) {
    var r = rng(seed),
      turn = 1,
      queue = [];
    function pick() {
      return WORDS[Math.floor(r() * WORDS.length)];
    }
    function sentence() {
      var w = [],
        m = 6 + Math.floor(r() * 14),
        j;
      for (j = 0; j < m; j++) w.push(pick());
      return w.join(" ") + ".";
    }
    function refill() {
      var i,
        n = 2 + Math.floor(r() * 4);
      queue.push({ k: "u", s: "> turn " + turn + ": " + pick() + " " + pick() + " " + pick() });
      queue.push({
        k: "t",
        s:
          "  [tool] Edit src/" +
          pick() +
          ".ts +" +
          Math.floor(r() * 40) +
          " -" +
          Math.floor(r() * 9),
      });
      for (i = 0; i < n; i++) queue.push({ k: "a", s: sentence() });
      turn++;
    }
    return {
      id: id,
      next: function () {
        if (!queue.length) refill();
        return queue.shift();
      },
    };
  }
  g.Replay = { makeStream: makeStream, count: 5 };
})(window);
