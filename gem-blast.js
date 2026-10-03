// gem-blast.js - Gem Blast (match-3 game)
//
// Kaise chalta hai:
//   1. Do paas wale gems ko swap karo (tap-tap ya swipe).
//   2. 3 ya zyada same colour ek line mein aaye to wo toot jaate hain, har gem ka point milta hai.
//   3. 4 gems ek line mein  -> "line gem" banta hai (toote to poori row ya column toot jaati hai).
//   4. 5 gems ek line mein  -> "rainbow gem" banta hai (kisi bhi gem se swap karo to us colour ke saare gems toot jaate hain).
//   5. Gems toot kar upar se naye gems girte hain, ye chain bhi ho sakti hai.
//
// POINTS / TIME / DIFFICULTY badalne ke liye is file ka sabse NEECHE wala
// "GAME SETTINGS" block dekho.

(function () {
  'use strict';

  var N = 8;                 // board 8 x 8
  var TAU = Math.PI * 2;

  // 6 alag gems: har ek ka apna shape + apna colour (colorCount settings se decide hota hai)
  var GEM_COLORS = [
    { light: '#a5f3fc', base: '#06b6d4', dark: '#0e7490' },   // 0 moti (gol)     - cyan
    { light: '#f5d0fe', base: '#d946ef', dark: '#86198f' },   // 1 hexagon        - magenta
    { light: '#d9f99d', base: '#84cc16', dark: '#3f6212' },   // 2 heera (diamond) - lime
    { light: '#fecdd3', base: '#fb7185', dark: '#be123c' },   // 3 triangle       - coral
    { light: '#fef08a', base: '#eab308', dark: '#854d0e' },   // 4 taara (star)   - gold
    { light: '#c7d2fe', base: '#6366f1', dark: '#3730a3' }    // 5 octagon        - indigo
  ];

  var el = {};
  ['gb', 'boardWrap', 'board', 'score', 'time', 'timeBox', 'timeFill', 'scoreBar', 'maxText',
   'maxWrap', 'toast', 'startOv', 'startBtn', 'endOv', 'endTitle', 'endScore', 'endMax',
   'endGems', 'endMoves', 'endChain', 'againBtn', 'icoLine', 'icoRainbow', 'rulePer',
   'ruleMax', 'ruleMaxWrap', 'ruleTime'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  var ctx = el.board.getContext('2d');
  var grid = [];
  var tweens = [];

  var S = {
    phase: 'idle',        // idle -> play -> over
    clock: 0,
    last: 0,
    dpr: 1,
    cell: 40,
    size: 320,
    timeLeft: 60,
    score: 0,
    timeUp: false,
    capped: false,
    busy: false,
    sel: null,
    drag: null,
    hint: null,
    idle: 0,
    stats: { gems: 0, moves: 0, bestChain: 0 },
    fx: [],
    parts: [],
    floats: [],
    sprites: null,
    bg: null,
    shownTime: -1,
    shownScore: -1
  };

  /* ================= chhote helpers ================= */

  function randInt(n) { return Math.floor(Math.random() * n); }
  function randomType() { return randInt(SETTINGS.colorCount); }
  function easeOutBack(k) { var c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
  function easeInOut(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function isStripe(g) { return g && (g.special === 'stripeH' || g.special === 'stripeV'); }

  function newGem(type, special, r, c) {
    return { type: type, special: special || null, gx: c, gy: r, sc: 1, al: 1 };
  }

  /* ================= tween (animation) engine ================= */

  function tween(dur, fn, delay, onStart) {
    return new Promise(function (resolve) {
      tweens.push({ t0: S.clock + (delay || 0), dur: dur, fn: fn, res: resolve, started: false, onStart: onStart });
    });
  }

  function stepTweens() {
    var finished = [];
    tweens = tweens.filter(function (tw) {
      var k = (S.clock - tw.t0) / tw.dur;
      if (k < 0) return true;
      if (!tw.started) {
        tw.started = true;
        if (tw.onStart) tw.onStart();
      }
      if (k >= 1) {
        tw.fn(1);
        finished.push(tw);
        return false;
      }
      tw.fn(k);
      return true;
    });
    finished.forEach(function (tw) { tw.res(); });
  }

  /* ================= gems ki drawing (sprites) ================= */

  function roundedPoly(g, pts, rad) {
    var n = pts.length;
    g.beginPath();
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      if (i === 0) g.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      g.arcTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, rad);
    }
    g.closePath();
  }

  function regular(n, r, rot) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = rot + i * TAU / n;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  function shapePath(g, type, r) {
    if (type === 0) {
      g.beginPath();
      g.arc(0, 0, r * 0.96, 0, TAU);
    } else if (type === 1) {
      roundedPoly(g, regular(6, r * 1.04, -Math.PI / 2), r * 0.22);
    } else if (type === 2) {
      roundedPoly(g, [{ x: 0, y: -r * 1.08 }, { x: r * 0.88, y: 0 }, { x: 0, y: r * 1.08 }, { x: -r * 0.88, y: 0 }], r * 0.18);
    } else if (type === 3) {
      roundedPoly(g, [{ x: 0, y: -r * 1.0 }, { x: r * 1.0, y: r * 0.82 }, { x: -r * 1.0, y: r * 0.82 }], r * 0.26);
    } else if (type === 4) {
      var pts = [];
      for (var i = 0; i < 10; i++) {
        var rr = (i % 2 === 0) ? r * 1.08 : r * 0.52;
        var a = -Math.PI / 2 + i * Math.PI / 5;
        pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
      }
      roundedPoly(g, pts, r * 0.1);
    } else {
      roundedPoly(g, regular(8, r * 1.02, Math.PI / 8), r * 0.2);
    }
  }

  function paintGem(g, type, r) {
    var c = GEM_COLORS[type];
    shapePath(g, type, r);
    var grd = g.createLinearGradient(0, -r, 0, r);
    grd.addColorStop(0, c.light);
    grd.addColorStop(0.5, c.base);
    grd.addColorStop(1, c.dark);
    g.fillStyle = grd;
    g.fill();
    g.lineWidth = r * 0.1;
    g.strokeStyle = c.dark;
    g.stroke();

    // andar ka chhota facet
    g.save();
    g.scale(0.6, 0.6);
    shapePath(g, type, r);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fill();
    g.restore();

    // chamak
    g.beginPath();
    g.ellipse(-r * 0.3, -r * 0.4, r * 0.26, r * 0.12, -0.55, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fill();
  }

  // line gem: gem ke upar safed patti + safed kinara
  function paintStripes(g, type, r, dir) {
    g.save();
    shapePath(g, type, r);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    var offs = [-0.5, 0, 0.5];
    for (var i = 0; i < offs.length; i++) {
      var o = offs[i] * r;
      if (dir === 'h') g.fillRect(-r * 1.2, o - r * 0.075, r * 2.4, r * 0.15);
      else g.fillRect(o - r * 0.075, -r * 1.2, r * 0.15, r * 2.4);
    }
    g.restore();
    shapePath(g, type, r);
    g.lineWidth = r * 0.12;
    g.strokeStyle = '#ffffff';
    g.stroke();
  }

  // rainbow gem: 6 colour ke tukde (ye ghoomta hai)
  function paintBombColor(g, r) {
    var n = 6;
    for (var i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r * 0.96, i * TAU / n, (i + 1) * TAU / n);
      g.closePath();
      g.fillStyle = GEM_COLORS[i].base;
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.28, 0, TAU);
    g.fillStyle = '#ffffff';
    g.fill();
    g.beginPath();
    g.arc(0, 0, r * 0.96, 0, TAU);
    g.lineWidth = r * 0.13;
    g.strokeStyle = '#ffffff';
    g.stroke();
  }

  // rainbow gem ki chamak (ye ghoomti nahi)
  function paintBombGloss(g, r) {
    var grd = g.createRadialGradient(-r * 0.3, -r * 0.36, r * 0.05, 0, 0, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.65)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.beginPath();
    g.arc(0, 0, r * 0.96, 0, TAU);
    g.fillStyle = grd;
    g.fill();
  }

  function makeSprite(cell, fn) {
    var px = Math.ceil(cell * S.dpr);
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var g = c.getContext('2d');
    g.scale(px / cell, px / cell);
    g.translate(cell / 2, cell / 2);
    g.lineJoin = 'round';
    fn(g);
    return c;
  }

  function buildSprites() {
    var cell = S.cell, r = cell * 0.4;
    var sp = { normal: [], stripeH: [], stripeV: [], bombColor: null, bombGloss: null };
    GEM_COLORS.forEach(function (_, t) {
      sp.normal[t] = makeSprite(cell, function (g) { paintGem(g, t, r); });
      sp.stripeH[t] = makeSprite(cell, function (g) { paintGem(g, t, r); paintStripes(g, t, r, 'h'); });
      sp.stripeV[t] = makeSprite(cell, function (g) { paintGem(g, t, r); paintStripes(g, t, r, 'v'); });
    });
    sp.bombColor = makeSprite(cell, function (g) { paintBombColor(g, r); });
    sp.bombGloss = makeSprite(cell, function (g) { paintBombGloss(g, r); });
    S.sprites = sp;
  }

  function buildBg() {
    var px = Math.ceil(S.size * S.dpr);
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var g = c.getContext('2d');
    g.scale(px / S.size, px / S.size);
    for (var r = 0; r < N; r++) {
      for (var cc = 0; cc < N; cc++) {
        g.fillStyle = ((r + cc) % 2 === 0) ? '#0d1a4d' : '#112260';
        g.fillRect(cc * S.cell, r * S.cell, S.cell, S.cell);
      }
    }
    S.bg = c;
  }

  // start screen ke chhote icons
  function drawIcons() {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var size = 44;
    [['icoLine', 'line'], ['icoRainbow', 'bomb']].forEach(function (p) {
      var c = el[p[0]];
      c.width = size * d;
      c.height = size * d;
      c.style.width = size + 'px';
      c.style.height = size + 'px';
      var g = c.getContext('2d');
      g.scale(d, d);
      g.translate(size / 2, size / 2);
      g.lineJoin = 'round';
      if (p[1] === 'line') {
        paintGem(g, 1, 17);
        paintStripes(g, 1, 17, 'h');
      } else {
        paintBombColor(g, 17);
        paintBombGloss(g, 17);
      }
    });
  }

  /* ================= layout ================= */

  function resize() {
    var wrap = el.boardWrap;
    var cs = window.getComputedStyle(wrap);
    var availW = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
    var availH = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4;
    var size = Math.floor(Math.min(availW, availH, 520));
    S.cell = Math.max(24, Math.floor(size / N));
    S.size = S.cell * N;
    S.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    el.board.width = Math.round(S.size * S.dpr);
    el.board.height = Math.round(S.size * S.dpr);
    el.board.style.width = S.size + 'px';
    el.board.style.height = S.size + 'px';
    buildSprites();
    buildBg();
  }

  /* ================= match dhoondhna ================= */

  // Board mein jahan 3 ya zyada same colour ek line mein hain, wo "runs" lautata hai
  function findRuns() {
    var runs = [], r, c, e, t, g, cells, k;
    for (r = 0; r < N; r++) {
      c = 0;
      while (c < N) {
        g = grid[r][c];
        if (!g || g.type < 0) { c++; continue; }
        t = g.type;
        e = c + 1;
        while (e < N && grid[r][e] && grid[r][e].type === t) e++;
        if (e - c >= 3) {
          cells = [];
          for (k = c; k < e; k++) cells.push({ r: r, c: k });
          runs.push({ dir: 'h', type: t, cells: cells });
        }
        c = e;
      }
    }
    for (c = 0; c < N; c++) {
      r = 0;
      while (r < N) {
        g = grid[r][c];
        if (!g || g.type < 0) { r++; continue; }
        t = g.type;
        e = r + 1;
        while (e < N && grid[e][c] && grid[e][c].type === t) e++;
        if (e - r >= 3) {
          cells = [];
          for (k = r; k < e; k++) cells.push({ r: k, c: c });
          runs.push({ dir: 'v', type: t, cells: cells });
        }
        r = e;
      }
    }
    return runs;
  }

  // Koi chal (move) bachi hai ya nahi? Mile to wahi chal lautata hai (hint ke liye bhi)
  function findMove() {
    var dirs = [[0, 1], [1, 0]];
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        for (var d = 0; d < 2; d++) {
          var r2 = r + dirs[d][0], c2 = c + dirs[d][1];
          if (r2 >= N || c2 >= N) continue;
          var a = grid[r][c], b = grid[r2][c2];
          if (!a || !b) continue;
          var pair = { a: { r: r, c: c }, b: { r: r2, c: c2 } };
          if (a.special === 'bomb' || b.special === 'bomb') return pair;
          if (isStripe(a) && isStripe(b)) return pair;
          grid[r][c] = b;
          grid[r2][c2] = a;
          var ok = findRuns().length > 0;
          grid[r][c] = a;
          grid[r2][c2] = b;
          if (ok) return pair;
        }
      }
    }
    return null;
  }

  /* ================= board banana ================= */

  function initBoard() {
    var tries = 0, r, c, row, t;
    do {
      grid = [];
      for (r = 0; r < N; r++) {
        row = [];
        for (c = 0; c < N; c++) {
          do {
            t = randomType();
          } while (
            (c >= 2 && row[c - 1].type === t && row[c - 2].type === t) ||
            (r >= 2 && grid[r - 1][c].type === t && grid[r - 2][c].type === t)
          );
          row.push(newGem(t, null, r, c));
        }
        grid.push(row);
      }
      tries++;
    } while (!findMove() && tries < 60);
  }

  function popIn() {
    var gems = [];
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        gems.push({ g: grid[r][c], d: (r + c) * 22 });
        grid[r][c].sc = 0;
      }
    }
    return Promise.all(gems.map(function (o) {
      return tween(260, function (k) { o.g.sc = easeOutBack(k); }, o.d);
    }));
  }

  /* ================= chal (move) ka poora flow ================= */

  function isAdj(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function animateSwap(a, b) {
    var ga = grid[a.r][a.c], gb = grid[b.r][b.c];
    grid[a.r][a.c] = gb;
    grid[b.r][b.c] = ga;
    var ax = ga.gx, ay = ga.gy, bx = gb.gx, by = gb.gy;
    return tween(150, function (k) {
      var e = easeInOut(k);
      ga.gx = ax + (bx - ax) * e;
      ga.gy = ay + (by - ay) * e;
      gb.gx = bx + (ax - bx) * e;
      gb.gy = by + (ay - by) * e;
    });
  }

  // Swap ke baad: rainbow gem ya do line gems ka khaas combo
  function forcedFromSwap(a, b) {
    var ga = grid[a.r][a.c], gb = grid[b.r][b.c];
    var bombA = ga.special === 'bomb', bombB = gb.special === 'bomb';
    var cells = [], beams = [], r, c, g;

    if (bombA || bombB) {
      var bombPos = bombA ? a : b;
      if (bombA && bombB) {
        for (r = 0; r < N; r++) {
          for (c = 0; c < N; c++) {
            if (grid[r][c]) { cells.push({ r: r, c: c }); beams.push({ from: bombPos, to: { r: r, c: c } }); }
          }
        }
        return { cells: cells, beams: beams, origin: bombPos, bombs: 2 };
      }
      var other = bombA ? gb : ga;
      var color = other.type;
      for (r = 0; r < N; r++) {
        for (c = 0; c < N; c++) {
          g = grid[r][c];
          if (g && g.type === color) { cells.push({ r: r, c: c }); beams.push({ from: bombPos, to: { r: r, c: c } }); }
        }
      }
      cells.push({ r: bombPos.r, c: bombPos.c });
      return { cells: cells, beams: beams, origin: bombPos, bombs: 1 };
    }

    if (isStripe(ga) && isStripe(gb)) {
      return { cells: [{ r: a.r, c: a.c }, { r: b.r, c: b.c }], beams: [], origin: a, bombs: 0 };
    }
    return null;
  }

  // Ek round mein kya kya tootega + kaun sa naya special gem banega
  function collect(forced, swapCells) {
    var clear = {}, queue = [], lines = [], beams = [], spawns = [];
    var firedStriped = 0, firedBomb = 0, createdStriped = 0, createdBomb = 0;
    var origin = null;

    function add(r, c) {
      var k = r * N + c;
      if (clear[k] || !grid[r][c]) return;
      clear[k] = { r: r, c: c };
      queue.push(clear[k]);
    }

    var runs = findRuns();
    runs.forEach(function (run) {
      run.cells.forEach(function (p) { add(p.r, p.c); });
    });

    if (forced) {
      firedBomb += forced.bombs;
      origin = forced.origin;
      beams = forced.beams;
      forced.cells.forEach(function (p) { add(p.r, p.c); });
    }

    // 4 ya 5 ki line -> naya special gem
    var taken = {};
    runs.forEach(function (run) {
      if (run.cells.length < 4) return;
      var cand = run.cells.filter(function (p) {
        return !grid[p.r][p.c].special && !taken[p.r * N + p.c];
      });
      if (!cand.length) return;
      var pick = null;
      if (swapCells) {
        swapCells.forEach(function (s) {
          cand.forEach(function (p) { if (p.r === s.r && p.c === s.c) pick = p; });
        });
      }
      if (!pick) pick = cand[Math.floor(cand.length / 2)];
      taken[pick.r * N + pick.c] = 1;

      var special;
      if (run.cells.length >= 5) {
        special = 'bomb';
        createdBomb++;
      } else {
        var same = SETTINGS.stripeSameDirection;
        // horizontal match -> (same? row : column) clear karne wala gem
        if (run.dir === 'h') special = same ? 'stripeH' : 'stripeV';
        else special = same ? 'stripeV' : 'stripeH';
        createdStriped++;
      }
      spawns.push({ r: pick.r, c: pick.c, special: special, type: run.type });
    });

    // line gem toote to uski poori row / column bhi tootegi (chain reaction)
    for (var i = 0; i < queue.length; i++) {
      var p = queue[i];
      var g = grid[p.r][p.c];
      if (!g) continue;
      var k2;
      if (g.special === 'stripeH') {
        firedStriped++;
        lines.push({ kind: 'row', r: p.r, c: p.c });
        for (k2 = 0; k2 < N; k2++) add(p.r, k2);
      } else if (g.special === 'stripeV') {
        firedStriped++;
        lines.push({ kind: 'col', r: p.r, c: p.c });
        for (k2 = 0; k2 < N; k2++) add(k2, p.c);
      }
    }

    // jahan naya special gem banega wo gem tootega nahi, badal jaayega
    spawns.forEach(function (s) { delete clear[s.r * N + s.c]; });

    var cells = Object.keys(clear).map(function (k) { return clear[k]; });
    return {
      cells: cells, spawns: spawns, lines: lines, beams: beams, origin: origin,
      firedStriped: firedStriped, firedBomb: firedBomb,
      createdStriped: createdStriped, createdBomb: createdBomb
    };
  }

  function addScore(pts) {
    var max = SETTINGS.points.maxScore;
    var before = S.score;
    S.score += pts;
    if (max > 0 && S.score >= max) {
      S.score = max;
      S.capped = true;
    }
    return S.score - before;
  }

  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.remove('show');
    void el.toast.offsetWidth;
    el.toast.classList.add('show');
  }

  function burst(g) {
    var color = g.type >= 0 ? GEM_COLORS[g.type].base : GEM_COLORS[randInt(6)].base;
    var cx = (g.gx + 0.5) * S.cell, cy = (g.gy + 0.5) * S.cell;
    if (S.parts.length > 350) return;
    for (var i = 0; i < 6; i++) {
      var a = Math.random() * TAU, sp = 60 + Math.random() * 190;
      S.parts.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
        life: 480 + Math.random() * 250, max: 730,
        color: color, size: S.cell * (0.05 + Math.random() * 0.06)
      });
    }
  }

  function clearStep(res, chain) {
    var P = SETTINGS.points;
    var count = res.cells.length;
    GemSound.clear(res, chain);

    // ---- POINTS yahan jodte hain (values neeche SETTINGS mein hain) ----
    // ---- POINTS yahan jodte hain (values neeche SETTINGS mein hain) ----
    var pts = count * P.perGem;
    if (chain > 1) pts += (chain - 1) * P.cascadeBonus;
    pts += res.createdStriped * P.createStriped;
    pts += res.createdBomb * P.createBomb;
    pts += res.firedStriped * P.fireStriped;
    pts += res.firedBomb * P.fireBomb;
    var gained = addScore(pts);

    S.stats.gems += count;
    if (chain > S.stats.bestChain) S.stats.bestChain = chain;

    if (res.firedBomb) toast('Colour blast!');
    else if (res.createdBomb) toast('Rainbow gem!');
    else if (res.createdStriped) toast('Line gem!');
    else if (res.firedStriped) toast('Line blast!');
    else if (chain >= 2) toast('Chain x' + chain);

    var cx = 0, cy = 0;
    res.cells.forEach(function (p) { cx += p.c; cy += p.r; });
    cx /= count;
    cy /= count;
    if (gained > 0) {
      S.floats.push({ x: (cx + 0.5) * S.cell, y: (cy + 0.5) * S.cell, text: '+' + gained, life: 900, max: 900 });
    }

    res.lines.forEach(function (l) { S.fx.push({ kind: l.kind, r: l.r, c: l.c, life: 340, max: 340 }); });
    res.beams.forEach(function (b) { S.fx.push({ kind: 'beam', a: b.from, b: b.to, life: 420, max: 420 }); });

    // naya special gem (pop ke saath)
    res.spawns.forEach(function (s) {
      var g = grid[s.r][s.c];
      g.special = s.special;
      if (s.special === 'bomb') g.type = -1;
      tween(280, function (k) { g.sc = 1.55 - 0.55 * easeOutBack(k); });
    });

    var origin = res.origin || { r: cy, c: cx };
    var ps = res.cells.map(function (p) {
      var g = grid[p.r][p.c];
      var delay = Math.min(360, Math.hypot(p.r - origin.r, p.c - origin.c) * 30);
      return tween(210, function (k) {
        g.sc = 1 - k;
        g.al = 1 - k * k;
      }, delay, function () { burst(g); }).then(function () {
        if (grid[p.r][p.c] === g) grid[p.r][p.c] = null;
      });
    });
    return Promise.all(ps);
  }

  // Gems neeche girte hain, upar se naye aate hain
  function dropAndRefill() {
    var items = [], maxD = 0;
    for (var c = 0; c < N; c++) {
      var write = N - 1, r;
      for (r = N - 1; r >= 0; r--) {
        var g = grid[r][c];
        if (g) {
          if (r !== write) {
            grid[write][c] = g;
            grid[r][c] = null;
            items.push({ g: g, from: g.gy, dist: write - g.gy });
            maxD = Math.max(maxD, write - g.gy);
          }
          write--;
        }
      }
      var k = 0;
      for (r = write; r >= 0; r--) {
        var ng = newGem(randomType(), null, -(++k), c);
        grid[r][c] = ng;
        items.push({ g: ng, from: ng.gy, dist: r - ng.gy });
        maxD = Math.max(maxD, r - ng.gy);
      }
    }
    if (!items.length) return Promise.resolve();
    return tween(170 + maxD * 55, function (k) {
      var e = easeOutBack(k);
      items.forEach(function (it) { it.g.gy = it.from + it.dist * e; });
    });
  }

  function reshuffle() {
    toast('No moves left. Shuffling!');
    var gems = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (grid[r][c]) gems.push(grid[r][c]);
    return tween(170, function (k) { gems.forEach(function (g) { g.sc = 1 - 0.7 * k; }); }).then(function () {
      var tries = 0;
      do {
        gems.forEach(function (g) { if (g.type >= 0) g.type = randomType(); });
        tries++;
      } while ((findRuns().length > 0 || !findMove()) && tries < 100);
      return tween(220, function (k) { gems.forEach(function (g) { g.sc = 0.3 + 0.7 * easeOutBack(k); }); });
    });
  }

  function playMove(a, b) {
    S.busy = true;
    S.sel = null;
    S.hint = null;
    S.idle = 0;

    return (async function () {
      try {
        await animateSwap(a, b);
        var forced = forcedFromSwap(a, b);

        // match nahi bana -> gems wapas apni jagah
        if (!forced && findRuns().length === 0) {
          await animateSwap(a, b);
          S.busy = false;
          return;
        }

        S.stats.moves++;
        var chain = 0;
        var swapCells = [a, b];
        while (true) {
          var res = collect(forced, swapCells);
          forced = null;
          swapCells = null;
          if (res.cells.length === 0) break;
          chain++;
          await clearStep(res, chain);
          await dropAndRefill();
        }
        if (!S.timeUp && !S.capped && !findMove()) await reshuffle();
      } catch (err) {
        console.error(err);
      }
      S.busy = false;
    })();
  }

  /* ================= input ================= */

  function canInput() {
    return S.phase === 'play' && !S.busy && !S.timeUp && !S.capped;
  }

  function localPos(e) {
    var rect = el.board.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (S.size / rect.width), y: (e.clientY - rect.top) * (S.size / rect.height) };
  }

  function cellAt(p) {
    var c = Math.floor(p.x / S.cell), r = Math.floor(p.y / S.cell);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    return { r: r, c: c };
  }

  function bindInput() {
    el.board.addEventListener('pointerdown', function (e) {
      GemSound.unlock();
      if (!canInput()) return;
      var p = localPos(e), cell = cellAt(p);
      if (!cell) return;
      e.preventDefault();
      try { el.board.setPointerCapture(e.pointerId); } catch (err) {}
      S.idle = 0;
      S.hint = null;

      if (S.sel) {
        if (S.sel.r === cell.r && S.sel.c === cell.c) { S.sel = null; S.drag = null; return; }
        if (isAdj(S.sel, cell)) {
          var a = S.sel;
          S.sel = null;
          S.drag = null;
          playMove(a, cell);
          return;
        }
      }
      S.sel = cell;
      S.drag = { r: cell.r, c: cell.c, x: p.x, y: p.y };
    });

    el.board.addEventListener('pointermove', function (e) {
      if (!S.drag || !canInput()) return;
      var p = localPos(e);
      var dx = p.x - S.drag.x, dy = p.y - S.drag.y, th = S.cell * 0.35;
      if (Math.abs(dx) < th && Math.abs(dy) < th) return;
      var a = { r: S.drag.r, c: S.drag.c };
      var t = { r: a.r, c: a.c };
      if (Math.abs(dx) > Math.abs(dy)) t.c += dx > 0 ? 1 : -1;
      else t.r += dy > 0 ? 1 : -1;
      S.drag = null;
      S.sel = null;
      if (t.r >= 0 && t.r < N && t.c >= 0 && t.c < N) playMove(a, t);
    });

    var up = function () { S.drag = null; };
    el.board.addEventListener('pointerup', up);
    el.board.addEventListener('pointercancel', up);
  }

  /* ================= game start / end ================= */

  function resetState() {
    S.score = 0;
    S.timeLeft = SETTINGS.time;
    S.timeUp = false;
    S.capped = false;
    S.busy = false;
    S.sel = null;
    S.drag = null;
    S.hint = null;
    S.idle = 0;
    S.stats = { gems: 0, moves: 0, bestChain: 0 };
    S.fx = [];
    S.parts = [];
    S.floats = [];
    S.shownScore = -1;
    S.shownTime = -1;
  }

  function newGame() {
    resetState();
    initBoard();
    S.phase = 'idle';
    el.startOv.classList.remove('hidden');
    el.endOv.classList.add('hidden');
  }

  function startGame() {
    resetState();
    initBoard();
    el.startOv.classList.add('hidden');
    el.endOv.classList.add('hidden');
    S.phase = 'play';
    S.busy = true;
    popIn().then(function () { S.busy = false; });
  }

  function submitScore(result) {
    // TODO: score server par bhejna (Firebase Cloud Function se verify karke).
    // Abhi sirf console mein dikhta hai aur ek event nikalta hai jise baad mein jod sakte hain.
    console.log('Gem Blast result', result);
    try {
      window.dispatchEvent(new CustomEvent('game:finished', { detail: Object.assign({ game: 'gem-blast' }, result) }));
    } catch (e) {}
  }

  function endGame(reason) {
    if (S.phase !== 'play') return;
    S.phase = 'over';
    S.sel = null;
    S.hint = null;
    var result = {
      score: S.score,
      gems: S.stats.gems,
      moves: S.stats.moves,
      bestChain: S.stats.bestChain,
      timeUsed: Math.round((SETTINGS.time - S.timeLeft) * 10) / 10
    };
    submitScore(result);

    el.endTitle.textContent = reason === 'max' ? 'Maximum score!' : "Time's up";
    el.endScore.textContent = result.score;
    el.endMax.textContent = SETTINGS.points.maxScore > 0 ? '/ ' + SETTINGS.points.maxScore + ' points' : 'points';
    el.endGems.textContent = result.gems;
    el.endMoves.textContent = result.moves;
    el.endChain.textContent = result.bestChain;
    setTimeout(function () { el.endOv.classList.remove('hidden'); }, 450);
  }

  /* ================= draw ================= */

  function drawGem(g, r, c) {
    var cell = S.cell, sp = S.sprites;
    var x = (g.gx + 0.5) * cell, y = (g.gy + 0.5) * cell;
    var sc = g.sc;

    if (S.sel && S.sel.r === r && S.sel.c === c) sc *= 1.08 + 0.03 * Math.sin(S.clock / 120);
    if (S.hint && ((S.hint.a.r === r && S.hint.a.c === c) || (S.hint.b.r === r && S.hint.b.c === c))) {
      sc *= 1 + 0.08 * Math.sin(S.clock / 130);
    }
    if (g.special) sc *= 1 + 0.03 * Math.sin(S.clock / 220 + g.gx + g.gy);
    if (sc <= 0.001 || g.al <= 0.001) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.globalAlpha = Math.max(0, Math.min(1, g.al));
    if (g.special === 'bomb') {
      ctx.save();
      ctx.rotate(S.clock * 0.0007);
      ctx.drawImage(sp.bombColor, -cell / 2, -cell / 2, cell, cell);
      ctx.restore();
      ctx.drawImage(sp.bombGloss, -cell / 2, -cell / 2, cell, cell);
    } else {
      var img = g.special === 'stripeH' ? sp.stripeH[g.type] : (g.special === 'stripeV' ? sp.stripeV[g.type] : sp.normal[g.type]);
      ctx.drawImage(img, -cell / 2, -cell / 2, cell, cell);
    }
    ctx.restore();
  }

  function center(p) {
    return { x: (p.c + 0.5) * S.cell, y: (p.r + 0.5) * S.cell };
  }

  function draw() {
    var cell = S.cell, i;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.size, S.size);
    if (S.bg) ctx.drawImage(S.bg, 0, 0, S.size, S.size);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S.size, S.size);
    ctx.clip();

    // selected cell ka kinara
    if (S.sel) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#facc15';
      ctx.strokeRect(S.sel.c * cell + 2, S.sel.r * cell + 2, cell - 4, cell - 4);
    }

    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var g = grid[r] && grid[r][c];
        if (g) drawGem(g, r, c);
      }
    }

    // line gem ki chamak (poori row / column)
    for (i = 0; i < S.fx.length; i++) {
      var f = S.fx[i], a = f.life / f.max;
      if (f.kind === 'row') {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * a) + ')';
        ctx.fillRect(0, f.r * cell + cell * 0.12, S.size, cell * 0.76);
      } else if (f.kind === 'col') {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * a) + ')';
        ctx.fillRect(f.c * cell + cell * 0.12, 0, cell * 0.76, S.size);
      } else if (f.kind === 'beam') {
        var p1 = center(f.a), p2 = center(f.b);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * a) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    for (i = 0; i < S.parts.length; i++) {
      var pt = S.parts[i];
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(cell * 0.55) + 'px Arial';
    for (i = 0; i < S.floats.length; i++) {
      var fl = S.floats[i], k = 1 - fl.life / fl.max;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0a1233';
      ctx.strokeText(fl.text, fl.x, fl.y - k * cell * 0.9);
      ctx.fillStyle = '#facc15';
      ctx.fillText(fl.text, fl.x, fl.y - k * cell * 0.9);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function updateFx(dt) {
    var s = dt / 1000;
    S.parts = S.parts.filter(function (p) {
      p.life -= dt;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vy += 900 * s;
      return p.life > 0;
    });
    S.floats = S.floats.filter(function (f) { f.life -= dt; return f.life > 0; });
    S.fx = S.fx.filter(function (f) { f.life -= dt; return f.life > 0; });
  }

  function updateHud() {
    var t = Math.ceil(S.timeLeft);
    if (t !== S.shownTime) {
      el.time.textContent = t;
      el.timeBox.classList.toggle('low', t <= 10 && S.phase === 'play');
      S.shownTime = t;
    }
    el.timeFill.style.width = (S.timeLeft / SETTINGS.time * 100) + '%';
    if (S.score !== S.shownScore) {
      el.score.textContent = S.score;
      S.shownScore = S.score;
      el.score.classList.remove('pop');
      void el.score.offsetWidth;
      el.score.classList.add('pop');
      var max = SETTINGS.points.maxScore;
      el.scoreBar.style.width = (max > 0 ? Math.min(100, S.score / max * 100) : 0) + '%';
    }
  }

  function frame(ts) {
    if (!S.last) S.last = ts;
    var dt = Math.min(50, ts - S.last);
    S.last = ts;
    S.clock += dt;

    stepTweens();

    if (S.phase === 'play') {
      if (!S.timeUp) {
        S.timeLeft = Math.max(0, S.timeLeft - dt / 1000);
        if (S.timeLeft <= 0) {
          S.timeUp = true;
          S.sel = null;
          S.hint = null;
        }
      }
      if (!S.busy && !S.timeUp && !S.capped) {
        S.idle += dt;
        if (S.idle > 5000 && !S.hint) S.hint = findMove();
      }
      // time khatam / max score ho gaya aur board shaant ho gaya -> result
      if (!S.busy && (S.timeUp || S.capped)) endGame(S.capped ? 'max' : 'time');
    }

    updateFx(dt);
    draw();
    updateHud();
    requestAnimationFrame(frame);
  }

  function init() {
    el.rulePer.textContent = SETTINGS.points.perGem;
    el.ruleTime.textContent = SETTINGS.time;
    if (SETTINGS.points.maxScore > 0) {
      el.ruleMax.textContent = SETTINGS.points.maxScore;
      el.maxText.textContent = 'Max ' + SETTINGS.points.maxScore;
    } else {
      el.ruleMaxWrap.style.display = 'none';
      el.maxWrap.style.visibility = 'hidden';
    }

    resize();
    drawIcons();
    bindInput();
    newGame();

    el.startBtn.addEventListener('click', startGame);
    el.againBtn.addEventListener('click', startGame);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });

    requestAnimationFrame(frame);
  }


  /* =====================================================================
     GAME SETTINGS  -  YAHAN SE POINTS / TIME / DIFFICULTY BADLO
     (Kuch bhi badalna ho to sirf neeche ke numbers badlo, upar ka code mat chhedo)
     ===================================================================== */

  var SETTINGS = {

    // ---------- TIME ----------
    time: 60,                 // game kitne second ka (60 = 1 minute)

    // ---------- DIFFICULTY ----------
    colorCount: 5,            // kitne alag gems: 3 = bahut easy, 4 = easy, 5 = normal, 6 = thoda hard
    stripeSameDirection: false,
    //   false = 4 gems row mein mile to line gem poori COLUMN todta hai (aur column mein mile to ROW)
    //   true  = 4 gems row mein mile to line gem poori ROW todta hai

    // ---------- POINT SYSTEM ----------
    points: {

      // Har ek gem toote to itna point. (Sabse zaroori setting)
      //   3 gems ka match      =  3 x perGem  =  3 point
      //   4 gems ka match      =  3 gems tootte hain + 1 gem line gem ban jaata hai
      //   line gem toote       =  poori row/column ke saare gems ke point
      //   rainbow gem toote    =  us colour ke saare gems ke point
      perGem: 1,

      // Chain (cascade) bonus: gems girne ke baad apne aap naya match bane to
      //   2nd chain mein +1 x cascadeBonus, 3rd chain mein +2 x cascadeBonus ...
      //   0 = koi bonus nahi.  Example: 2 rakhoge to 2nd chain +2, 3rd chain +4
      cascadeBonus: 0,

      // Line gem BANANE par extra bonus (4 ka match). 0 = koi bonus nahi
      createStriped: 0,

      // Rainbow gem BANANE par extra bonus (5 ka match). 0 = koi bonus nahi
      createBomb: 0,

      // Line gem CHALANE (toodne) par extra bonus. 0 = koi bonus nahi
      fireStriped: 0,

      // Rainbow gem CHALANE par extra bonus. 0 = koi bonus nahi
      fireBomb: 0,

      // Maximum score jo koi player le sakta hai (leaderboard ke liye).
      //   300 = 300 point par game ruk jaata hai.   0 = koi limit nahi
      maxScore: 300
    }
  };

  init();
})();
