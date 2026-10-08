// block-blast.js - Block Blast game
// 8x8 board upar, neeche 3 block. Block ko ungli se pakdo aur board par kahin bhi chhodo.
(function () {
  'use strict';

  // ================= SETTINGS (sirf yahin badalna) =================
  var CONFIG = {
    TIME: 60,             // game kitne second ka
    STUCK_RESET: 3,       // board bhar jaye aur koi chaal na bache to kitne second baad saaf ho
    COMBO_MAX: 5,         // combo ka sabse bada multiplier (5x se upar nahi)
    COMBO_GRACE: 2,       // line kaate bina kitni chaal tak combo bacha rahe (0 = turant tut jaye)
    COMBO_MULTIPLY: true, // true = points x combo (2x me double). false = sirf label dikhe, points wahi
    PERFECT_BONUS: 30,    // poora board saaf ho jaye to extra points (0 = nahi)
    SCORE_CAP: 1000,      // ek game ka sabse zyada score jo save hoga (Firebase rule ke andar rakho)
    BIG_SQUARE_RARE: 2.5, // 3x3 wale block ka weight. Chhota = kam aata hai (normal block ~4-9 hote hain)
    HELP: 0.55,           // 0 se 1: board bharne par madad wale (chhote/line todne wale) block kitne aayein
    LIFT: 56              // ungli aur block ke beech gap (pixel) taaki ungli se block na chhupe
  };

  // ================= Elements =================
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var menu = document.getElementById('menu');
  var over = document.getElementById('over');
  var startBtn = document.getElementById('startBtn');
  var againBtn = document.getElementById('againBtn');
  var finalScoreEl = document.getElementById('finalScore');
  var finalNoteEl = document.getElementById('finalNote');

  function sfx(name, a, b) {
    try { if (window.BlockSound) window.BlockSound[name](a, b); } catch (e) {}
  }

  // ================= Screen size =================
  var N = 8, C = 40;
  var W = 360, H = 640, scale = 1, dpr = 1;
  var boardX = 20, boardY = 84, trayTop = 412, trayCy = 490;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var iw = window.innerWidth, ih = window.innerHeight;
    var s = iw / 360;
    var h = ih / s;
    if (h < 560) { s = ih / 560; h = 560; }
    if (h > 900) { s = ih / 900; h = 900; }
    scale = s;
    W = Math.round(iw / s);
    H = h;
    canvas.width = Math.round(iw * dpr);
    canvas.height = Math.round(ih * dpr);
    boardX = Math.round((W - N * C) / 2);
    boardY = 84 + Math.max(0, H - 560) * 0.2;
    trayTop = boardY + N * C + 8;
    trayCy = trayTop + (H - trayTop) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ================= Block ke shape =================
  // Har family ka "weight" = wo kitni baar aata hai (bada = zyada)
  var FAMILIES = [
    { w: 5,  m: ['#'] },                                   // 1 ka
    { w: 8,  m: ['##'] },                                  // 2 ki line
    { w: 8,  m: ['###'] },                                 // 3 ki line
    { w: 5,  m: ['####'] },                                // 4 ki line
    { w: 3,  m: ['#####'] },                               // 5 ki line
    { w: 9,  m: ['##', '##'] },                            // chhota square
    { w: CONFIG.BIG_SQUARE_RARE, m: ['###', '###', '###'] }, // bada 3x3 (kam)
    { w: 7,  m: ['##', '#.'] },                            // chhota L (3)
    { w: 6,  m: ['#.', '#.', '##'] },                      // L (4)
    { w: 6,  m: ['.#', '.#', '##'] },                      // ulta L (4)
    { w: 3,  m: ['#..', '#..', '###'] },                   // bada kona (5)
    { w: 5,  m: ['###', '.#.'] },                          // T
    { w: 2.5, m: ['##.', '.##'] },                         // S/Z
    { w: 2.5, m: ['.##', '##.'] },
    { w: 4,  m: ['###', '###'] }                           // 2x3 bada dabba
  ];
  var COLORS = ['#ff5252', '#ffb300', '#3ddc84', '#3aa0ff', '#b36bff', '#ff6fb1', '#22d3d3'];

  function parse(m) {
    var cells = [];
    for (var r = 0; r < m.length; r++)
      for (var c = 0; c < m[r].length; c++) if (m[r][c] === '#') cells.push([r, c]);
    return cells;
  }
  function norm(cells) {
    var mr = 99, mc = 99, i;
    for (i = 0; i < cells.length; i++) { mr = Math.min(mr, cells[i][0]); mc = Math.min(mc, cells[i][1]); }
    var out = [];
    for (i = 0; i < cells.length; i++) out.push([cells[i][0] - mr, cells[i][1] - mc]);
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return out;
  }
  function rot(cells) {
    return norm(cells.map(function (p) { return [p[1], -p[0]]; }));
  }
  function key(cells) { return cells.map(function (p) { return p[0] + ',' + p[1]; }).join(';'); }

  var SHAPES = [];     // {cells, w, h, size, weight}
  (function () {
    FAMILIES.forEach(function (f) {
      var variants = [], seen = {};
      var cur = norm(parse(f.m));
      for (var i = 0; i < 4; i++) {
        var k = key(cur);
        if (!seen[k]) { seen[k] = 1; variants.push(cur); }
        cur = rot(cur);
      }
      variants.forEach(function (cells) {
        var w = 0, h = 0;
        cells.forEach(function (p) { h = Math.max(h, p[0] + 1); w = Math.max(w, p[1] + 1); });
        SHAPES.push({ cells: cells, w: w, h: h, size: cells.length, weight: f.w / variants.length, big3: f.w === CONFIG.BIG_SQUARE_RARE && cells.length === 9 });
      });
    });
  })();

  // ================= State =================
  var state = 'menu';     // menu | play | stuck | over
  var timeLeft = CONFIG.TIME;
  var score = 0, streak = 0, misses = 0, stuckT = 0, clock = 0;
  var grid = [];
  var tray = [null, null, null];
  var drag = null;        // {slot, x, y}
  var pops = [], parts = [], flashes = [];
  var shake = 0;

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < N; r++) { g.push([]); for (var c = 0; c < N; c++) g[r].push(0); }
    return g;
  }
  grid = emptyGrid();

  // ================= Board ka logic =================
  function canPlace(g, sh, gr, gc) {
    for (var i = 0; i < sh.cells.length; i++) {
      var r = gr + sh.cells[i][0], c = gc + sh.cells[i][1];
      if (r < 0 || c < 0 || r >= N || c >= N || g[r][c]) return false;
    }
    return true;
  }

  function fits(g, sh) {
    for (var r = 0; r < N; r++)
      for (var c = 0; c < N; c++) if (canPlace(g, sh, r, c)) return true;
    return false;
  }

  // piece rakhne par kaun si rows/cols poori hongi (grid ko badle bina)
  function fullLines(g, sh, gr, gc) {
    var occ = {}, i;
    for (i = 0; i < sh.cells.length; i++) occ[(gr + sh.cells[i][0]) * 10 + gc + sh.cells[i][1]] = 1;
    var rows = [], cols = [], r, c, ok;
    for (r = 0; r < N; r++) {
      ok = true;
      for (c = 0; c < N; c++) if (!g[r][c] && !occ[r * 10 + c]) { ok = false; break; }
      if (ok) rows.push(r);
    }
    for (c = 0; c < N; c++) {
      ok = true;
      for (r = 0; r < N; r++) if (!g[r][c] && !occ[r * 10 + c]) { ok = false; break; }
      if (ok) cols.push(c);
    }
    return { rows: rows, cols: cols };
  }

  function filledCount() {
    var n = 0;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (grid[r][c]) n++;
    return n;
  }

  function canClearAnywhere(sh) {
    for (var r = 0; r < N; r++)
      for (var c = 0; c < N; c++)
        if (canPlace(grid, sh, r, c)) {
          var f = fullLines(grid, sh, r, c);
          if (f.rows.length || f.cols.length) return true;
        }
    return false;
  }

  // ================= Naye 3 block chunna =================
  function weightedPick(list, wfn) {
    var tot = 0, i, w;
    for (i = 0; i < list.length; i++) tot += wfn(list[i]);
    if (tot <= 0) return list[Math.floor(Math.random() * list.length)];
    var x = Math.random() * tot;
    for (i = 0; i < list.length; i++) { w = wfn(list[i]); if ((x -= w) <= 0) return list[i]; }
    return list[list.length - 1];
  }

  function makePiece(sh) {
    return { sh: sh, col: Math.floor(Math.random() * COLORS.length), pop: 0 };
  }

  function genTray() {
    var filled = filledCount(), fill = filled / (N * N), empty = N * N - filled;
    var help = CONFIG.HELP;

    // board jitna bhara, chhote block ka weight utna zyada, bade ka kam
    function wfn(sh) {
      var w = sh.weight;
      if (fill > 0.45) {
        var k = (fill - 0.45) * 9 * help;                 // 0 se ~5
        if (sh.size <= 3) w *= 1 + k * (4 - sh.size) * 0.7;
        else if (sh.size >= 5) w /= 1 + k * 0.8;
        if (sh.big3) w /= 1 + k * 2;
      }
      return w;
    }

    var picks = [], i;
    for (i = 0; i < 3; i++) picks.push(weightedPick(SHAPES, wfn));

    if (empty === 0) { return picks.map(makePiece); }

    // sirf 1 khaali ghar bacha ho to 1 wala block pakka
    if (empty <= 2) {
      picks[0] = SHAPES[0];
    }

    // kam se kam ek block aisa ho jo rakha ja sake
    var anyFits = picks.some(function (sh) { return fits(grid, sh); });
    if (!anyFits) {
      var okList = SHAPES.filter(function (sh) { return fits(grid, sh); });
      picks[Math.floor(Math.random() * 3)] = okList.length ? weightedPick(okList, wfn) : SHAPES[0];
    }

    // board bhara ho to kabhi-kabhi ek aisa block jo line tod de
    if (fill > 0.4 && Math.random() < help) {
      var clearers = SHAPES.filter(function (sh) { return canClearAnywhere(sh); });
      if (clearers.length && !picks.some(function (sh) { return canClearAnywhere(sh); })) {
        picks[Math.floor(Math.random() * 3)] = weightedPick(clearers, function (s) { return s.weight; });
      }
    }

    // 3x3 ek saath do na aaye
    var bigSeen = false;
    for (i = 0; i < 3; i++) {
      if (picks[i].big3) { if (bigSeen) picks[i] = SHAPES.filter(function (s) { return s.size === 4; })[0]; bigSeen = true; }
    }
    return picks.map(makePiece);
  }

  // ================= Game shuru / khatam =================
  function newGame() {
    grid = emptyGrid();
    score = 0; streak = 0; misses = 0; stuckT = 0;
    timeLeft = CONFIG.TIME;
    pops = []; parts = []; flashes = []; drag = null;
    tray = genTray();
    trayAnim();
    state = 'play';
    menu.classList.add('hidden');
    over.classList.add('hidden');
  }

  function trayAnim() { for (var i = 0; i < 3; i++) if (tray[i]) tray[i].pop = 0; }

  function finish() {
    state = 'over';
    drag = null;
    sfx('end');
    var finalScore = Math.min(Math.max(0, score), CONFIG.SCORE_CAP);
    finalScoreEl.textContent = finalScore;
    finalNoteEl.textContent = finalScore > 0 ? 'Score save ho raha hai...' : 'Is baar koi point nahi mila';
    over.classList.remove('hidden');

    if (finalScore > 0 && window.PWScore) {
      PWScore.save('block-blast', finalScore).then(function (r) {
        finalNoteEl.textContent = r ? '✅ Score save ho gaya' : '❌ Score save nahi hua, login check karo';
      });
    }
  }

  startBtn.addEventListener('click', newGame);
  againBtn.addEventListener('click', newGame);

  // ================= Piece rakhna =================
  function popText(text, x, y, color, size, life) {
    pops.push({ t: text, x: x, y: y, c: color, s: size || 26, life: life || 1.1, max: life || 1.1 });
  }

  function cellCenter(r, c) { return { x: boardX + c * C + C / 2, y: boardY + r * C + C / 2 }; }

  function burst(r, c, col) {
    var p = cellCenter(r, c);
    for (var i = 0; i < 5; i++) {
      parts.push({
        x: p.x, y: p.y, vx: rand(-220, 220), vy: rand(-300, 60), c: i % 2 ? '#ffffff' : col,
        s: rand(3, 7), rot: rand(0, 6), w: rand(-10, 10), life: rand(0.4, 0.8), g: 900
      });
    }
  }

  var PRAISE = [
    ['Nice!', 'Good!', 'Sweet!'],
    ['Great!', 'Awesome!', 'Super!'],
    ['Excellent!', 'Amazing!', 'Fantastic!'],
    ['Unbelievable!', 'Legend!', 'Incredible!']
  ];

  function placePiece(slot, gr, gc) {
    var pc = tray[slot], sh = pc.sh, i;
    var f = fullLines(grid, sh, gr, gc);        // rakhne se pehle hi pata kar lo
    for (i = 0; i < sh.cells.length; i++) grid[gr + sh.cells[i][0]][gc + sh.cells[i][1]] = pc.col + 1;
    tray[slot] = null;

    var lines = f.rows.length + f.cols.length;
    if (!lines) {
      sfx('place');
      misses++;
      if (misses > CONFIG.COMBO_GRACE) streak = 0;
    } else {
      // kate hue ghar (row aur col ke beech ka common ek hi baar)
      var gone = {}, n = 0, r, c;
      f.rows.forEach(function (rr) { for (c = 0; c < N; c++) gone[rr * 10 + c] = 1; });
      f.cols.forEach(function (cc) { for (r = 0; r < N; r++) gone[r * 10 + cc] = 1; });
      var midX = 0, midY = 0;
      Object.keys(gone).forEach(function (k) {
        r = Math.floor(k / 10); c = k % 10;
        var col = COLORS[(grid[r][c] - 1 + COLORS.length) % COLORS.length];
        flashes.push({ r: r, c: c, col: col, t: 0, d: 0.1 + (r + c) * 0.012 });
        burst(r, c, col);
        grid[r][c] = 0;
        n++;
        var p = cellCenter(r, c); midX += p.x; midY += p.y;
      });
      midX /= n; midY /= n;

      streak++;
      misses = 0;
      var mult = CONFIG.COMBO_MULTIPLY ? Math.min(CONFIG.COMBO_MAX, streak) : 1;
      var pts =(n-1)* mult;
      score += pts;
      sfx('clear', lines, streak);
      shake = 0.12 + Math.min(3, lines) * 0.05;

      popText('+' + pts, midX, midY + 6, '#ffe14d', 34, 1.2);
      var lv = Math.min(4, lines) - 1;
      popText(PRAISE[lv][Math.floor(Math.random() * 3)], midX, midY - 34, lv >= 2 ? '#ff7a59' : '#7be0ff', 26 + lv * 3, 1.2);
      if (streak >= 2) {
        var cm = Math.min(CONFIG.COMBO_MAX, streak);
        popText(cm + 'x', W / 2, boardY + N * C / 2 - 70, cm >= 4 ? '#ff4d6d' : (cm === 3 ? '#ff9f43' : '#ffe14d'), 80, 1.1);
      }

      // poora board khali
      var left = 0;
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (grid[r][c]) left++;
      if (!left) {
        score += CONFIG.PERFECT_BONUS;
        popText('PERFECT!', W / 2, boardY + N * C / 2 + 50, '#ffffff', 40, 1.6);
        if (CONFIG.PERFECT_BONUS) popText('+' + CONFIG.PERFECT_BONUS, W / 2, boardY + N * C / 2 + 90, '#ffe14d', 30, 1.6);
      }
    }

    // teeno lag gaye to naye teen
    if (!tray[0] && !tray[1] && !tray[2]) { tray = genTray(); trayAnim(); }

    checkStuck();
  }

  function checkStuck() {
    if (state !== 'play') return;
    var any = false;
    for (var i = 0; i < 3; i++) if (tray[i] && fits(grid, tray[i].sh)) { any = true; break; }
    if (!any) {
      state = 'stuck';
      stuckT = CONFIG.STUCK_RESET;
      sfx('stuck');
    }
  }

  function resetBoard() {
    for (var r = 0; r < N; r++)
      for (var c = 0; c < N; c++)
        if (grid[r][c]) {
          burst(r, c, COLORS[(grid[r][c] - 1 + COLORS.length) % COLORS.length]);
          flashes.push({ r: r, c: c, col: COLORS[(grid[r][c] - 1 + COLORS.length) % COLORS.length], t: 0, d: 0.05 + r * 0.03 });
        }
    grid = emptyGrid();
    streak = 0; misses = 0;
    sfx('reset');
    state = 'play';
    checkStuck();     // (khaali board par har block fit hota hai)
  }

  // ================= Ungli / mouse =================
  function logical(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function slotX(i) { return W / 2 + (i - 1) * 120; }

  function dragOrigin() {
    // block ka upar-left kona (logical), ungli ke upar
    var sh = tray[drag.slot].sh;
    return { x: drag.x - sh.w * C / 2, y: drag.y - CONFIG.LIFT - sh.h * C };
  }

  function dragCell() {
    var o = dragOrigin();
    return { gc: Math.round((o.x - boardX) / C), gr: Math.round((o.y - boardY) / C) };
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state !== 'play' && state !== 'stuck') return;
    if (drag) return;
    var p = logical(e);
    if (p.y < trayTop - 14) return;
    var best = -1, bd = 1e9;
    for (var i = 0; i < 3; i++) {
      if (!tray[i]) continue;
      var d = Math.abs(p.x - slotX(i));
      if (d < 62 && d < bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    drag = { slot: best, x: p.x, y: p.y };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    sfx('pick');
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    e.preventDefault();
    var p = logical(e);
    drag.x = p.x; drag.y = p.y;
  });

  function release(e, cancel) {
    if (!drag) return;
    var p = logical(e);
    drag.x = p.x; drag.y = p.y;
    var slot = drag.slot, pc = tray[slot];
    var cell = dragCell();
    drag = null;
    if (cancel || !pc || (state !== 'play' && state !== 'stuck')) return;
    if (canPlace(grid, pc.sh, cell.gr, cell.gc)) {
      placePiece(slot, cell.gr, cell.gc);
    } else {
      sfx('bad');
      pc.pop = 0.4;       // wapas tray me chhota sa uchhal
    }
  }
  canvas.addEventListener('pointerup', function (e) { release(e, false); });
  canvas.addEventListener('pointercancel', function (e) { release(e, true); });

  // ================= Update =================
  function update(dt) {
    clock += dt;
    var i;

    if (state === 'play' || state === 'stuck') {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; finish(); return; }
    }
    if (state === 'stuck') {
      stuckT -= dt;
      if (stuckT <= 0) resetBoard();
    }

    for (i = 0; i < 3; i++) if (tray[i] && tray[i].pop < 1) tray[i].pop = Math.min(1, tray[i].pop + dt * 5);
    shake = Math.max(0, shake - dt);

    for (i = flashes.length - 1; i >= 0; i--) {
      flashes[i].t += dt;
      if (flashes[i].t > flashes[i].d + 0.35) flashes.splice(i, 1);
    }
    for (i = parts.length - 1; i >= 0; i--) {
      var pt = parts[i];
      pt.vy += pt.g * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.rot += pt.w * dt; pt.life -= dt;
      if (pt.life <= 0) parts.splice(i, 1);
    }
    for (i = pops.length - 1; i >= 0; i--) {
      pops[i].life -= dt;
      pops[i].y -= 26 * dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }
  }

  // ================= Drawing =================
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return 'rgb(' + clamp(r, 0, 255) + ',' + clamp(g, 0, 255) + ',' + clamp(b, 0, 255) + ')';
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function drawCell(x, y, s, col, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var pad = Math.max(1, s * 0.04);
    rr(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.18);
    ctx.fillStyle = shade(col, 0.72);
    ctx.fill();
    rr(x + pad, y + pad, s - pad * 2, (s - pad * 2) * 0.86, s * 0.18);
    ctx.fillStyle = col;
    ctx.fill();
    rr(x + s * 0.17, y + s * 0.13, s * 0.66, s * 0.22, s * 0.1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPiece(pc, x, y, s, alpha) {
    var cells = pc.sh.cells, col = COLORS[pc.col];
    for (var i = 0; i < cells.length; i++) drawCell(x + cells[i][1] * s, y + cells[i][0] * s, s, col, alpha);
  }

  function outlinedText(text, x, y, size, fill, align) {
    ctx.font = '900 ' + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 7);
    ctx.strokeStyle = '#0c1440';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill || '#fff';
    ctx.fillText(text, x, y);
  }

  function trayScale(sh) {
    return Math.min(26, 108 / sh.w, (H - trayTop - 14) / sh.h);
  }

  function draw() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

    // peeche ka rang
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a3b8f');
    g.addColorStop(1, '#141f56');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) ctx.translate(rand(-3, 3) * shake * 8, rand(-3, 3) * shake * 8);
// board ka dibba
    ctx.fillStyle = '#0f1845';
    rr(boardX - 8, boardY - 8, N * C + 16, N * C + 16, 14); ctx.fill();
    ctx.fillStyle = '#1b2866';
    rr(boardX - 3, boardY - 3, N * C + 6, N * C + 6, 8); ctx.fill();

    // ghost / highlight
    var ghost = null, hi = null;
    if (drag && tray[drag.slot]) {
      var cell = dragCell(), sh = tray[drag.slot].sh;
      if (canPlace(grid, sh, cell.gr, cell.gc)) {
        ghost = { gr: cell.gr, gc: cell.gc, sh: sh };
        hi = fullLines(grid, sh, cell.gr, cell.gc);
      }
    }

    var r, c;
    for (r = 0; r < N; r++) {
      for (c = 0; c < N; c++) {
        var x = boardX + c * C, y = boardY + r * C;
        ctx.fillStyle = (r + c) % 2 ? '#222f75' : '#1e2b6d';
        rr(x + 1.5, y + 1.5, C - 3, C - 3, 6); ctx.fill();
        if (grid[r][c]) {
          var col = COLORS[(grid[r][c] - 1) % COLORS.length];
          if (hi && (hi.rows.indexOf(r) >= 0 || hi.cols.indexOf(c) >= 0)) {
            drawCell(x, y, C, col, 1);
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            rr(x + 2, y + 2, C - 4, C - 4, 7); ctx.fill();
          } else drawCell(x, y, C, col, 1);
        } else if (hi && (hi.rows.indexOf(r) >= 0 || hi.cols.indexOf(c) >= 0)) {
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          rr(x + 1.5, y + 1.5, C - 3, C - 3, 6); ctx.fill();
        }
      }
    }
    if (ghost) {
      var gcol = COLORS[tray[drag.slot].col];
      for (var i = 0; i < ghost.sh.cells.length; i++) {
        drawCell(boardX + (ghost.gc + ghost.sh.cells[i][1]) * C, boardY + (ghost.gr + ghost.sh.cells[i][0]) * C, C, gcol, 0.5);
      }
    }

    // kate hue ghar ka chamak
    for (i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      if (f.t < f.d) continue;
      var k = (f.t - f.d) / 0.35;
      var sz = C * (1 - k * 0.6), off = (C - sz) / 2;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = k < 0.35 ? '#ffffff' : f.col;
      rr(boardX + f.c * C + off, boardY + f.r * C + off, sz, sz, 8); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // neeche ka tray
    for (i = 0; i < 3; i++) {
      var pc = tray[i];
      ctx.fillStyle = 'rgba(8,14,50,0.35)';
      rr(slotX(i) - 56, trayTop + 2, 112, H - trayTop - 8, 16); ctx.fill();
      if (!pc || (drag && drag.slot === i)) continue;
      var s = trayScale(pc.sh) * (0.6 + 0.4 * pc.pop);
      drawPiece(pc, slotX(i) - pc.sh.w * s / 2, trayCy - pc.sh.h * s / 2, s, 1);
    }

    // ungli se pakda hua block
    if (drag && tray[drag.slot]) {
      var o = dragOrigin();
      drawPiece(tray[drag.slot], o.x, o.y, C, 0.96);
    }

    // kan
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = clamp(p.life * 3, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
    }

    // +points, 2x, Great! wagairah
    for (i = 0; i < pops.length; i++) {
      var q = pops[i];
      var age = q.max - q.life;
      var sc = age < 0.15 ? 0.5 + age / 0.15 * 0.7 : (age < 0.3 ? 1.2 - (age - 0.15) / 0.15 * 0.2 : 1);
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.save();
      ctx.translate(q.x, q.y); ctx.scale(sc, sc);
      outlinedText(q.t, 0, 0, q.s, q.c);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // score (upar beech me)
    outlinedText(String(score), W / 2, 40, 50, '#ffffff');
    if (streak >= 2) outlinedText('🔥 ' + Math.min(CONFIG.COMBO_MAX, streak) + 'x combo', W / 2, 72, 16, '#ffd166');

    // timer (upar left me)
    var t = Math.ceil(timeLeft);
    var mm = Math.floor(t / 60), ss = t % 60;
    outlinedText('⏱ ' + mm + ':' + (ss < 10 ? '0' : '') + ss, 14, 26, 22, timeLeft <= 10 ? '#ff8a8a' : '#ffffff', 'left');

    if (state === 'stuck') {
      ctx.fillStyle = 'rgba(8,12,40,0.55)';
      rr(boardX - 8, boardY - 8, N * C + 16, N * C + 16, 14); ctx.fill();
      outlinedText('NO MOVES!', W / 2, boardY + N * C / 2 - 26, 40, '#ff7a7a');
      outlinedText('Board ' + Math.ceil(stuckT) + ' second me saaf', W / 2, boardY + N * C / 2 + 14, 18, '#ffffff');
      outlinedText(String(Math.ceil(stuckT)), W / 2, boardY + N * C / 2 + 62, 46, '#ffe14d');
    }
  }

  // ================= Loop =================
  var last = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (state !== 'menu' && state !== 'over') update(dt);
    else clock += dt;
    draw();
    requestAnimationFrame(frame);
  }

  //@HOOK
  requestAnimationFrame(function (t) { last = t; frame(t); });
})();
