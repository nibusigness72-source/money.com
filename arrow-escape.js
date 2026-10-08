// arrow-escape.js - Arrow Escape: teer par TAP karo, wo bahar nikal jayega
// 1 minute | 4 stage: 10, 20, 40, 50 teer | har teer ke 2 point | teer takraya to 3 second ruko (3-2-1)
// Har stage mein teer milkar ek alag tasveer banate hain (1, 5, M, heart, star ...)

var TOTAL_TIME = 60;    // kul samay (second)
var WAIT_TIME = 3;      // teer takraya to kitne second ruko
var PTS = 2;            // har teer ke point

// Har stage: kitne teer, aur ek khane (cell) ki chaudai (screen ki chaudai ka hissa)
var STAGES = [
  { arrows: 10, cell: 0.14 },
  { arrows: 20, cell: 0.10 },
  { arrows: 40, cell: 0.074 },
  { arrows: 50, cell: 0.066 }
];

var BROWN = '#6b4528';
var BLUE = '#2f80ed';
var RED = '#e53935';
var AMBER = '#f59e0b';

// ==GEN START==
// ---------- Tasveer + teer banane ka hissa (yahan haath mat lagana) ----------
function rnd(n) { return Math.floor(Math.random() * n); }

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = rnd(i + 1);
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Tasveeron ki list: strokes = moti lakiren, fill = bhari hui aakriti
var SHAPES = [
  { name: '1', strokes: [[.55, .08, .55, .9], [.55, .08, .3, .26], [.3, .9, .8, .9]] },
  { name: '5', strokes: [[.74, .1, .3, .1], [.3, .1, .27, .46], [.27, .46, .56, .42], [.56, .42, .74, .55], [.74, .55, .76, .76], [.76, .76, .56, .9], [.56, .9, .25, .84]] },
  { name: 'M', strokes: [[.12, .9, .12, .1], [.12, .1, .5, .6], [.5, .6, .88, .1], [.88, .1, .88, .9]] },
  { name: 'A', strokes: [[.12, .92, .5, .08], [.5, .08, .88, .92], [.28, .62, .72, .62]] },
  { name: 'H', strokes: [[.18, .1, .18, .9], [.82, .1, .82, .9], [.18, .5, .82, .5]] },
  { name: '7', strokes: [[.2, .1, .8, .1], [.8, .1, .4, .92]] },
  { name: 'W', strokes: [[.08, .1, .28, .9], [.28, .9, .5, .4], [.5, .4, .72, .9], [.72, .9, .92, .1]] },
  { name: 'plus', strokes: [[.5, .1, .5, .9], [.1, .5, .9, .5]] },
  { name: 'Z', strokes: [[.2, .1, .8, .1], [.8, .1, .2, .9], [.2, .9, .8, .9]] },
  { name: 'N', strokes: [[.2, .9, .2, .1], [.2, .1, .8, .9], [.8, .9, .8, .1]] },
  { name: '4', strokes: [[.65, .9, .65, .1], [.65, .1, .15, .65], [.15, .65, .9, .65]] },
  { name: 'heart', fill: 'heart' },
  { name: 'circle', fill: 'circle' },
  { name: 'diamond', fill: 'diamond' },
  { name: 'star', fill: 'star' }
];

function distSeg(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  var t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  var x = x1 + t * dx, y = y1 + t * dy;
  return Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
}

function inStar(px, py, cx, cy, Ro, Ri) {
  var pts = [], i;
  for (i = 0; i < 10; i++) {
    var ang = -Math.PI / 2 + i * Math.PI / 5;
    var rr = (i % 2 === 0) ? Ro : Ri;
    pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
  }
  var inside = false, j;
  for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// k jitna bada, tasveer utni moti (zyada khane)
function makeMask(shape, cols, rows, k) {
  var m = [], c, r, i;
  var t = 0.85 + 0.13 * k;
  var g = 0.72 + 0.05 * k;
  var cx = cols / 2, cy = rows / 2, R = Math.min(cols, rows) / 2;
  for (r = 0; r < rows; r++) {
    for (c = 0; c < cols; c++) {
      var px = c + 0.5, py = r + 0.5, u = px / cols, v = py / rows, inside = false;
      if (shape.strokes) {
        for (i = 0; i < shape.strokes.length; i++) {
          var sg = shape.strokes[i];
          if (distSeg(px, py, sg[0] * cols, sg[1] * rows, sg[2] * cols, sg[3] * rows) <= t) { inside = true; break; }
        }
      } else if (shape.fill === 'circle') {
        var rr = R * 0.92 * g;
        inside = ((px - cx) * (px - cx) + (py - cy) * (py - cy)) <= rr * rr;
      } else if (shape.fill === 'diamond') {
        inside = Math.abs(px - cx) / (cols / 2 * 0.95 * g) + Math.abs(py - cy) / (rows / 2 * 0.95 * g) <= 1;
      } else if (shape.fill === 'heart') {
        var x = (u - 0.5) * 2.7 / g, y = (0.45 - v) * 2.7 / g;
        var a = x * x + y * y - 1;
        inside = a * a * a - x * x * y * y * y <= 0;
      } else if (shape.fill === 'star') {
        inside = inStar(px, py, cx, cy, R * 0.98 * g, R * 0.45 * g);
      }
      m.push(inside);
    }
  }
  return m;
}

// Tasveer ke khanon ko 2 se 5 khane ke teeron mein baanto
function partition(mask, cols, rows) {
  var owner = [], i, arrows = [], order = [];
  for (i = 0; i < cols * rows; i++) {
    owner.push(mask[i] ? -1 : -3);
    if (mask[i]) order.push(i);
  }
  shuffle(order);
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function free(c, r) { return c >= 0 && r >= 0 && c < cols && r < rows && owner[r * cols + c] === -1; }

  order.forEach(function (idx) {
    if (owner[idx] !== -1) return;
    var c0 = idx % cols, r0 = (idx - c0) / cols;
    var path = [[c0, r0]];
    owner[idx] = arrows.length;
    var L = 2 + rnd(4);
    while (path.length < L) {
      var last = path[path.length - 1], opts = [];
      DIRS.forEach(function (d) {
        if (free(last[0] + d[0], last[1] + d[1])) opts.push([last[0] + d[0], last[1] + d[1]]);
      });
      if (!opts.length) break;
      var n = opts[rnd(opts.length)];
      path.push(n);
      owner[n[1] * cols + n[0]] = arrows.length;
    }
    arrows.push({ cells: path });
  });

  // akela bacha khana: paas ke teer ke sire se jod do, nahi to hata do
  var out = arrows.filter(function (a) { return a.cells.length >= 2; });
  arrows.filter(function (a) { return a.cells.length < 2; }).forEach(function (sg) {
    var p = sg.cells[0], done = false;
    for (var q = 0; q < out.length && !done; q++) {
      var B = out[q];
      if (B.cells.length >= 6) continue;
      var f = B.cells[0], l = B.cells[B.cells.length - 1];
      if (Math.abs(f[0] - p[0]) + Math.abs(f[1] - p[1]) === 1) { B.cells.unshift(p); done = true; }
      else if (Math.abs(l[0] - p[0]) + Math.abs(l[1] - p[1]) === 1) { B.cells.push(p); done = true; }
    }
  });
  return out;
}

// Har teer ka sir (head) tay karo, taaki puzzle hamesha hal ho sake.
// Jo teer pehle nikal sakte hain unhe pehli "parat" (layer) mein rakhte hain, phir agli.
function solveOrder(arrows, cols, rows) {
  var occ = {}, remaining = [], depth = 0;
  arrows.forEach(function (a, i) {
    remaining.push(i);
    a.cells.forEach(function (p) { occ[p[1] * cols + p[0]] = i; });
  });
  while (remaining.length) {
    var batch = [];
    shuffle(remaining.slice()).forEach(function (i) {
      var orients = shuffle([0, 1]);
      for (var q = 0; q < 2; q++) {
        var cells = orients[q] ? arrows[i].cells.slice().reverse() : arrows[i].cells;
        var head = cells[cells.length - 1], prev = cells[cells.length - 2];
        var dx = head[0] - prev[0], dy = head[1] - prev[1];
        var x = head[0] + dx, y = head[1] + dy, blocked = false;
        while (x >= 0 && y >= 0 && x < cols && y < rows) {
          if (occ[y * cols + x] !== undefined) { blocked = true; break; }
          x += dx; y += dy;
        }
        if (!blocked) { batch.push({ i: i, orient: orients[q] }); return; }
      }
    });
    if (!batch.length) return null;
    batch.forEach(function (b) {
      var a = arrows[b.i];
      if (b.orient) a.cells = a.cells.slice().reverse();
      var h = a.cells[a.cells.length - 1], pv = a.cells[a.cells.length - 2];
      a.dx = h[0] - pv[0];
      a.dy = h[1] - pv[1];
      a.cells.forEach(function (p) { delete occ[p[1] * cols + p[0]]; });
      remaining.splice(remaining.indexOf(b.i), 1);
    });
    depth++;
  }
  return depth;
}

// N teer wali ek tasveer banao. Na bane to null.
function generate(N, cols, rows, shape, maxDepth) {
  var best = null;
  for (var k = 0; k <= 18; k++) {
    for (var tr = 0; tr < 4; tr++) {
      var mask = makeMask(shape, cols, rows, k);
      var arrows = partition(mask, cols, rows);
      if (arrows.length < N) break;
      while (arrows.length > N) arrows.splice(rnd(arrows.length), 1);
      var depth = solveOrder(arrows, cols, rows);
      if (depth && depth <= maxDepth) return { arrows: arrows, depth: depth, shape: shape.name };
      if (depth && (!best || depth < best.depth)) best = { arrows: arrows, depth: depth, shape: shape.name };
    }
  }
  return best;
}

// Aakhri upay: sab teer upar ki taraf (hamesha hal ho jata hai)
function fallbackStage(N, cols, rows) {
  var used = {}, arrows = [], tries = 0;
  while (arrows.length < N && tries < 5000) {
    tries++;
    var c = rnd(cols), r = rnd(rows - 1);
    var k1 = (r + 1) * cols + c, k2 = r * cols + c;
    if (used[k1] || used[k2]) continue;
    used[k1] = true; used[k2] = true;
    arrows.push({ cells: [[c, r + 1], [c, r]], dx: 0, dy: -1 });
  }
  return { arrows: arrows, depth: 0, shape: 'simple' };
}
// ==GEN END==

// ================= Game ka hissa =================
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');

var scoreEl = document.getElementById('score');
var timeEl = document.getElementById('timeLeft');
var leftEl = document.getElementById('left');
var titleEl = document.getElementById('title');
var dropsEl = document.getElementById('drops');
var totalEl = document.getElementById('totalPoints');
var hintEl = document.getElementById('hint');
var waitEl = document.getElementById('wait');
var waitNumEl = document.getElementById('waitNum');
var overlay = document.getElementById('overlay');
var resultTitle = document.getElementById('resultTitle');
var resultText = document.getElementById('resultText');
var againBtn = document.getElementById('againBtn');

if (window.firebase && firebase.auth) {
  firebase.auth().onAuthStateChanged(function (u) {
    if (!u) return;
    firebase.database().ref('users/' + u.uid + '/points').once('value').then(function (snap) {
      totalEl.textContent = snap.val() || 0;
    });
  });
}

var W, H, cols, rows, s, ox, oy;
var arrows, occ, flyers, popups, blocked, shapesQueue;
var stageNo, score, state, endTime, waitEnd, waitNum, clearT, clock, banner, bannerText;
var lastTime = 0;
var loopId = null;

function setup() {
  var dpr = window.devicePixelRatio || 1;
  var r = canvas.getBoundingClientRect();
  W = r.width;
  H = r.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function aliveCount() {
  var n = 0;
  arrows.forEach(function (a) { if (a.alive) n++; });
  return n;
}

function updateDrops() {
  dropsEl.innerHTML = '';
  for (var i = 0; i < STAGES.length; i++) {
    var d = document.createElement('i');
    d.className = 'drop' + (i <= stageNo ? ' on' : '');
    dropsEl.appendChild(d);
  }
}

function newGame() {
  if (loopId) cancelAnimationFrame(loopId);
  setup();
  shapesQueue = shuffle(SHAPES.slice());
  stageNo = 0;
  score = 0;
  endTime = 0;
  clock = 0;
  scoreEl.textContent = '0';
  timeEl.textContent = TOTAL_TIME;
  timeEl.parentNode.classList.remove('low');
  hintEl.style.display = 'block';
  waitEl.classList.remove('show');
  overlay.classList.remove('show');
  startStage();
  lastTime = performance.now();
  loopId = requestAnimationFrame(loop);
}

function startStage() {
  var st = STAGES[stageNo];
  s = Math.max(18, Math.floor(W * st.cell));
  cols = Math.floor(W / s);
  rows = Math.min(Math.floor(H / s), Math.round(cols * 1.45));
  ox = (W - cols * s) / 2;
  oy = (H - rows * s) / 2;

  var res = generate(st.arrows, cols, rows, shapesQueue[stageNo], 5) ||
            generate(st.arrows, cols, rows, SHAPES[rnd(SHAPES.length)], 9) ||
            fallbackStage(st.arrows, cols, rows);
  arrows = res.arrows;

  occ = [];
  for (var i = 0; i < cols * rows; i++) occ.push(-1);
  arrows.forEach(function (a, idx) {
    a.alive = true;
    a.bumpAt = -1;
    a.pts = a.cells.map(function (p) { return { x: ox + (p[0] + 0.5) * s, y: oy + (p[1] + 0.5) * s }; });
    a.cum = [0];
    for (var q = 1; q < a.pts.length; q++) {
      a.cum.push(a.cum[q - 1] + Math.abs(a.pts[q].x - a.pts[q - 1].x) + Math.abs(a.pts[q].y - a.pts[q - 1].y));
    }
    a.cells.forEach(function (p) { occ[p[1] * cols + p[0]] = idx; });
  });

  flyers = [];
  popups = [];
  blocked = null;
  state = 'play';
  clearT = 0;
  banner = 1.2;
  bannerText = 'Stage ' + (stageNo + 1);
  titleEl.textContent = 'Stage ' + (stageNo + 1) + ' / ' + STAGES.length;
  leftEl.textContent = aliveCount();
  updateDrops();
}

// Teer ke aage ka raasta: koi doosra teer mile to uska number do
function blockerOf(i) {
  var a = arrows[i];
  var head = a.cells[a.cells.length - 1];
  var x = head[0] + a.dx, y = head[1] + a.dy;
  while (x >= 0 && y >= 0 && x < cols && y < rows) {
    var o = occ[y * cols + x];
    if (o !== -1) return { idx: o, c: x, r: y };
    x += a.dx; y += a.dy;
  }
  return null;
}

function distPoly(px, py, pts) {
  var d = 1e9;
  for (var i = 1; i < pts.length; i++) {
    d = Math.min(d, distSeg(px, py, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
  }
  return d;
}

// Teer bahar udaao
function flyOut(i, now) {
  var a = arrows[i];
  a.alive = false;
  a.cells.forEach(function (p) { occ[p[1] * cols + p[0]] = -1; });

  var head = a.cells[a.cells.length - 1];
  var steps = 0, x = head[0] + a.dx, y = head[1] + a.dy;
  while (x >= 0 && y >= 0 && x < cols && y < rows) { steps++; x += a.dx; y += a.dy; }
  var n = steps + a.cells.length + 2;

  var pts = a.pts.slice();
  var hp = pts[pts.length - 1];
  for (var j2 = 1; j2 <= n; j2++) pts.push({ x: hp.x + a.dx * s * j2, y: hp.y + a.dy * s * j2 });
  var cum = [0];
  for (var q = 1; q < pts.length; q++) {
    cum.push(cum[q - 1] + Math.abs(pts[q].x - pts[q - 1].x) + Math.abs(pts[q].y - pts[q - 1].y));
  }
  var Lbody = a.cum[a.cum.length - 1];
  flyers.push({ pts: pts, cum: cum, Lbody: Lbody, d: 0, v: s * 10, end: cum[cum.length - 1] - Lbody });

  score += PTS;
  scoreEl.textContent = score;
  leftEl.textContent = aliveCount();
  popups.push({ x: hp.x, y: hp.y, t: 0 });
  ArrowSound.fly();

  if (aliveCount() === 0) {
    state = 'clear';
    clearT = 0;
    banner = 1.2;
    bannerText = 'Stage clear!';
    ArrowSound.stage();
  }
}

// Teer takra gaya: 3 second ruko
function hitBlocked(i, b, now) {
  arrows[i].bumpAt = clock;
  blocked = { i: i, b: b };
  state = 'wait';
  waitEnd = now + WAIT_TIME * 1000;
  waitNum = WAIT_TIME;
  waitNumEl.textContent = waitNum;
  waitEl.classList.add('show');
  ArrowSound.bump();
  ArrowSound.tick(waitNum);
}

function finish(won) {
  if (state === 'over') return;
  state = 'over';
  waitEl.classList.remove('show');
  timeEl.textContent = won ? Math.max(0, Math.ceil((endTime - performance.now()) / 1000)) : '0';
  ArrowSound.end();

  resultTitle.textContent = won ? '🏆 Saare stage poore!' : '⏰ Time khatam';
  resultText.textContent = 'Score: ' + score + '  |  Stage: ' + Math.min(stageNo + 1, STAGES.length) + ' / ' + STAGES.length;

  if (score > 0 && window.PWScore) {
    PWScore.save('arrow-escape', score).then(function (res) {
      if (res) {
        resultText.textContent += '  →  +' + score + ' points mile';
        totalEl.textContent = res.total;
      }
    });
  }
  overlay.classList.add('show');
}

function update(dt, now) {
  clock += dt;

  if (endTime) {
    var left = Math.max(0, (endTime - now) / 1000);
    timeEl.textContent = Math.ceil(left);
    if (left <= 10) timeEl.parentNode.classList.add('low');
    if (left <= 0) { finish(false); return; }
  }

  flyers.forEach(function (f) {
    f.v += s * 55 * dt;
    f.d += f.v * dt;
  });
  flyers = flyers.filter(function (f) { return f.d < f.end; });

  popups.forEach(function (p) { p.t += dt; });
  popups = popups.filter(function (p) { return p.t < 0.8; });
  if (banner > 0) banner -= dt;

  if (state === 'wait') {
    var secs = Math.ceil((waitEnd - now) / 1000);
    if (secs >= 1 && secs !== waitNum) {
      waitNum = secs;
      waitNumEl.textContent = secs;
      ArrowSound.tick(secs);
    }
    if (now >= waitEnd) {
      state = 'play';
      blocked = null;
      waitEl.classList.remove('show');
      ArrowSound.go();
    }
  } else if (state === 'clear') {
    clearT += dt;
    if (clearT >= 0.9 && flyers.length === 0) {
      stageNo++;
      if (stageNo >= STAGES.length) finish(true);
      else startStage();
    }
  }
}

// ---------- Drawing ----------
function pointAt(pts, cum, d) {
  var i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  var seg = (cum[i] - cum[i - 1]) || 1;
  var t = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t, i: i };
}

// Teer ka ek hissa banao (d0 se d1 tak) aur sir par teer ka nok lagao
function drawArrow(pts, cum, d0, d1, color, ox2, oy2) {
  var lw = Math.max(2.5, s * 0.15);
  var p0 = pointAt(pts, cum, d0), p1 = pointAt(pts, cum, d1);
  ctx.save();
  ctx.translate(ox2 || 0, oy2 || 0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (var j3 = p0.i; j3 < p1.i; j3++) ctx.lineTo(pts[j3].x, pts[j3].y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();

  var dx = pts[p1.i].x - pts[p1.i - 1].x, dy = pts[p1.i].y - pts[p1.i - 1].y;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len; dy /= len;
  var tipX = p1.x + dx * s * 0.34, tipY = p1.y + dy * s * 0.34;
  var bx = p1.x - dx * s * 0.06, by = p1.y - dy * s * 0.06;
  var wd = s * 0.27;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(bx - dy * wd, by + dx * wd);
  ctx.lineTo(bx + dy * wd, by - dx * wd);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw(now) {
  ctx.fillStyle = '#f4ead7';
  ctx.fillRect(0, 0, W, H);

  // khade teer
  arrows.forEach(function (a, i) {
    if (!a.alive) return;
    var color = BROWN, offx = 0, offy = 0;
    if (blocked && blocked.i === i) {
      color = RED;
      var t = Math.min(1, (clock - a.bumpAt) / 0.35);
      var off = Math.sin(t * Math.PI) * s * 0.4;
      offx = a.dx * off; offy = a.dy * off;
    } else if (blocked && blocked.b.idx === i) {
      color = AMBER;
    }
    drawArrow(a.pts, a.cum, 0, a.cum[a.cum.length - 1], color, offx, offy);
  });

  // takrane wale teer tak laal tooti hui lakir
  if (blocked) {
    var ba = arrows[blocked.i], hp = ba.pts[ba.pts.length - 1];
    var tx = ox + (blocked.b.c + 0.5) * s, ty = oy + (blocked.b.r + 0.5) * s;
    ctx.save();
    ctx.strokeStyle = RED;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(hp.x + ba.dx * s * 0.4, hp.y + ba.dy * s * 0.4);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  }

  // udte hue teer
  flyers.forEach(function (f) {
    drawArrow(f.pts, f.cum, f.d, f.d + f.Lbody, BLUE, 0, 0);
  });

  // +2 ke nishan
  popups.forEach(function (p) {
    ctx.save();
    ctx.globalAlpha = 1 - p.t / 0.8;
    ctx.fillStyle = '#b9831f';
    ctx.font = 'bold ' + Math.round(s * 0.7) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('+' + PTS, p.x, p.y - p.t * 40);
    ctx.restore();
  });

  // stage ka naam
  if (banner > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, banner / 0.4);
    ctx.fillStyle = '#8a5a1c';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(bannerText, W / 2, 34);
    ctx.restore();
  }
}

function loop(now) {
  var dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt, now);
  if (state !== 'over') draw(now);
  if (state !== 'over') loopId = requestAnimationFrame(loop);
}

// ---------- Touch ----------
canvas.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  ArrowSound.unlock();
  if (state !== 'play') return;

  var r = canvas.getBoundingClientRect();
  var x = e.clientX - r.left, y = e.clientY - r.top;
  var best = -1, bd = 1e9;
  arrows.forEach(function (a, i) {
    if (!a.alive) return;
    var d = distPoly(x, y, a.pts);
    if (d < bd) { bd = d; best = i; }
  });
  if (best < 0 || bd > Math.max(16, s * 0.7)) return;

  var now = performance.now();
  if (!endTime) {
    endTime = now + TOTAL_TIME * 1000;
    hintEl.style.display = 'none';
  }
  var b = blockerOf(best);
  if (b) hitBlocked(best, b, now);
  else flyOut(best, now);
});

againBtn.addEventListener('click', newGame);

newGame();
