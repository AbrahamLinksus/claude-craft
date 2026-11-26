/* eslint-disable no-undef -- browser script, globals shared via window */
// Canvas branch graph drawn on the mono grid (geometry in cell units).
(function (g) {
  var BRANCHES = [
    { n: "main", c: "#ece8e1", from: -1, at: 0, len: 14 },
    { n: "craft/s1", c: "#6aa0d8", from: 0, at: 2, len: 6 },
    { n: "craft/s2", c: "#d97757", from: 0, at: 4, len: 8 },
    { n: "craft/s3", c: "#4fb3a6", from: 0, at: 7, len: 5 },
    { n: "craft/s4", c: "#e0b84c", from: 2, at: 6, len: 4 },
    { n: "craft/s5", c: "#7fb069", from: 0, at: 10, len: 3 },
  ];
  function size(canvas) {
    var dpr = window.devicePixelRatio || 1,
      w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return { dpr: dpr, w: w, h: h };
  }
  function drawBranch(x, b, i, o) {
    var cell = o.cell,
      dims = o.dims,
      live = o.live;
    var y = (1 + i * 2 + 0.5) * cell.h,
      x0 = (1 + b.at * 2) * cell.w,
      x1 = x0 + b.len * 2 * cell.w,
      k;
    x.strokeStyle = b.c;
    x.fillStyle = b.c;
    if (b.from >= 0) {
      x.beginPath();
      x.moveTo(x0, (1 + b.from * 2 + 0.5) * cell.h);
      x.lineTo(x0, y);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(x0, y);
    x.lineTo(x1, y);
    x.stroke();
    for (k = 0; k <= b.len; k++) {
      x.beginPath();
      x.arc(x0 + k * 2 * cell.w, y, 3, 0, 6.2832);
      x.fill();
    }
    if (live) {
      x.beginPath();
      x.arc(x1 + cell.w, y, 4, 0, 6.2832);
      x.stroke();
    }
    x.fillText(
      b.n,
      Math.max(cell.w, Math.min(x1 + 2 * cell.w, dims.w - (b.n.length + 1) * cell.w)),
      y - cell.h * 0.6,
    );
  }
  function draw(canvas, cell, tick) {
    var dims = size(canvas),
      x = canvas.getContext("2d"),
      rows = Math.floor(dims.h / cell.h),
      i;
    x.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
    x.clearRect(0, 0, dims.w, dims.h);
    x.font = "14px Consolas, monospace";
    x.textBaseline = "middle";
    for (i = 0; i < BRANCHES.length; i++) {
      if (1 + i * 2 >= rows) break;
      drawBranch(x, BRANCHES[i], i, {
        cell: cell,
        dims: dims,
        live: i > 0 && tick % 36 < (i + 1) * 6,
      });
    }
  }
  g.BranchGraph = { draw: draw, branches: BRANCHES };
})(window);
