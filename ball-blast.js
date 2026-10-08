// ball-blast.js - Ball Blast (bubble shooter)
// Ungli se nishana lagao, ball chhodo. 3+ ek rang ke ball phoot jaate hain, latke hue ball gir jaate hain.
(function () {
  'use strict';

  // ================= SETTINGS (sirf yahin badalna) =================
  var CONFIG = {
    TIME: 60,            // game kitne second ka
    POP_POINTS: 1,       // ek ball phootne par point
    FALL_POINTS: 0,      // ek ball latak kar girne par point (phootne se zyada)
    SCORE_CAP: 1000,     // ek game ka sabse zyada score jo save hoga (Firebase rule ke andar)
    START_ROWS: 9,       // shuru me kitni line ball
    MIN_ROWS: 8,         // jab ball kam ho jayein to upar se nayi line aati hai, itni line hamesha rahengi
    MISS_PUSH: 5,        // lagatar itne shot me kuch na phoota to upar se ek nayi line neeche aati hai
    MISS_PUSH_HARD: 3,   // HARD_AFTER second ke baad ye wali ginti (kam = mushkil)
    HARD_AFTER: 30,      // kitne second baad game mushkil ho
    COLORS_START: 4,     // shuru me kitne rang
    COLORS_HARD: 5,      // mushkil hone par kitne rang
    SPEED: 1100          // ball ki raftaar
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

  function sfx(name, a) {
    try { if (window.BallSound) window.BallSound[name](a); } catch (e) {}
  }

  // ================= Size =================
  var R = 20, COLS = 9, ROWH = R * Math.sqrt(3), GW = COLS * R * 2;   // grid ki chaudai 360
  var W = 360, H = 640, scale = 1, dpr = 1;
  var gx = 0, topY = 66, sx = 180, sy = 560, dangerY = 500;

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
    gx = Math.round((W - GW) / 2);
    sx = W / 2;
    sy = H - 86;
    dangerY = sy - 58;
  }
  window.addEventListener('resize', resize);
  resize();

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ================= Rang =================
  var COLORS = ['#2aa9ff', '#ffc21a', '#d23cff', '#ff3b2f', '#3ddc5a'];

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return 'rgb(' + clamp(r, 0, 255) + ',' + clamp(g, 0, 255) + ',' + clamp(b, 0, 255) + ')';
  }

  // ================= State =================
  var state = 'menu';       // menu | play | over
  var timeLeft = CONFIG.TIME, score = 0, dispScore = 0, clock = 0;
  var rows = [];            // rows[r][c] = rang number (0..4) ya null
  var shift = 0;            // kaun si line aadhi khisaki hui hai (upar se line aane par badalta hai)
  var scroll = 0;           // upar se line aane ka smooth animation
  var cur = 0, nxt = 1;     // shooter ka ball aur agla ball
  var shot = null;          // udta hua ball
  var misses = 0;
  var fallers = [], bursts = [], parts = [], pops = [];
  var aim = null;           // {x,y,down:true}
  var recoil = 0, shake = 0;
  var bubbles = [];
  (function () { for (var i = 0; i < 12; i++) bubbles.push({ x: Math.random(), y: Math.random(), r: 12 + Math.random() * 36, sp: 0.01 + Math.random() * 0.03, h: Math.random() * 360 }); })();

  // ================= Grid ki ginti =================
  function isShift(r) { return ((r + shift) & 1) === 1; }
  function colsOf(r) { return isShift(r) ? COLS - 1 : COLS; }
  function px(r, c) { return gx + R + c * 2 * R + (isShift(r) ? R : 0); }
  function py(r) { return topY + R + r * ROWH - scroll; }
  function get(r, c) { return (r >= 0 && r < rows.length) ? rows[r][c] : null; }
  function valid(r, c) { return r >= 0 && c >= 0 && c < colsOf(r); }

  function nbrs(r, c) {
    var out = [], cs = isShift(r) ? [c, c + 1] : [c - 1, c], i;
    if (valid(r, c - 1)) out.push([r, c - 1]);
    if (valid(r, c + 1)) out.push([r, c + 1]);
    for (i = 0; i < 2; i++) { if (valid(r - 1, cs[i])) out.push([r - 1, cs[i]]); }
    for (i = 0; i < 2; i++) { if (valid(r + 1, cs[i])) out.push([r + 1, cs[i]]); }
    return out;
  }

  function colorCount() {
    var hard = (CONFIG.TIME - timeLeft) >= CONFIG.HARD_AFTER;
    return hard ? CONFIG.COLORS_HARD : CONFIG.COLORS_START;
  }

  // ek line banao; neeche wali line ke rang ke saath milte-julte (gucche bante hain)
  function makeRow(below) {
    var n = colsOf(0), row = [], k = colorCount();
    for (var c = 0; c < n; c++) {
      var col = Math.floor(Math.random() * k);
      if (c > 0 && Math.random() < 0.42) col = row[c - 1];
      else if (below) {
        var cs = isShift(0) ? [c, c + 1] : [c - 1, c];
        var cand = [];
        for (var i = 0; i < 2; i++) { var v = below[cs[i]]; if (v !== null && v !== undefined) cand.push(v); }
        if (cand.length && Math.random() < 0.38) col = cand[Math.floor(Math.random() * cand.length)];
      }
      row.push(col);
    }
    return row;
  }

  function addTopRow() {
    shift ^= 1;
    rows.unshift(makeRow(rows[0]));
    scroll += ROWH;
  }

  function lowestRow() {
    for (var r = rows.length - 1; r >= 0; r--)
      for (var c = 0; c < rows[r].length; c++) if (rows[r][c] !== null) return r;
    return -1;
  }

  function trimRows() {
    while (rows.length > 1 && rows[rows.length - 1].every(function (v) { return v === null; })) rows.pop();
  }

  // niche ke ball khatam hote jayein to upar se line kheench kar laao
  function refill() {
    var guard = 0;
    while (lowestRow() < CONFIG.MIN_ROWS - 1 && guard++ < 12) addTopRow();
  }

  function colorsInGrid() {
    var seen = {}, list = [];
    for (var r = 0; r < rows.length; r++)
      for (var c = 0; c < rows[r].length; c++) {
        var v = rows[r][c];
        if (v !== null && !seen[v]) { seen[v] = 1; list.push(v); }
      }
    return list;
  }

  function pickColor() {
    var list = colorsInGrid();
    if (!list.length) return Math.floor(Math.random() * colorCount());
    return list[Math.floor(Math.random() * list.length)];
  }

  function fixQueue() {
    var list = colorsInGrid();
    if (list.length && list.indexOf(cur) < 0) cur = pickColor();
    if (list.length && list.indexOf(nxt) < 0) nxt = pickColor();
  }

  // ================= Naya game =================
  function newGame() {
    rows = []; shift = 0; scroll = 0;
    for (var r = 0; r < CONFIG.START_ROWS; r++) rows.push(null);
    // neeche se upar banao taaki gucche milte-julte rahein
    for (r = CONFIG.START_ROWS - 1; r >= 0; r--) rows[r] = makeRowAt(r, rows[r + 1]);
    score = 0; dispScore = 0; timeLeft = CONFIG.TIME; misses = 0;
    shot = null; fallers = []; bursts = []; parts = []; pops = []; aim = null;
    cur = pickColor(); nxt = pickColor();
    state = 'play';
    menu.classList.add('hidden');
    over.classList.add('hidden');
  }

  function makeRowAt(r, below) {
    var n = colsOf(r), row = [], k = colorCount();
    for (var c = 0; c < n; c++) {
      var col = Math.floor(Math.random() * k);
      if (c > 0 && Math.random() < 0.42) col = row[c - 1];
      else if (below) {
        var cs = isShift(r) ? [c, c + 1] : [c - 1, c], cand = [];
        for (var i = 0; i < 2; i++) { var v = below[cs[i]]; if (v !== null && v !== undefined) cand.push(v); }
        if (cand.length && Math.random() < 0.38) col = cand[Math.floor(Math.random() * cand.length)];
      }
      row.push(col);
    }
    return row;
  }

  function finish() {
    state = 'over';
    aim = null;
    sfx('end');
    var finalScore = Math.min(Math.max(0, score), CONFIG.SCORE_CAP);
    finalScoreEl.textContent = finalScore;
    finalNoteEl.textContent = finalScore > 0 ? 'Score save ho raha hai...' : 'Is baar koi point nahi mila';
    over.classList.remove('hidden');
    if (finalScore > 0 && window.PWScore) {
      PWScore.save('ball-blast', finalScore).then(function (r) {
        finalNoteEl.textContent = r ? '✅ Score save ho gaya' : '❌ Score save nahi hua, login check karo';
      });
    }
  }

  startBtn.addEventListener('click', newGame);
  againBtn.addEventListener('click', newGame);

  // ================= Nishana (dotted line) =================
  function clampAngle(dx, dy) {
    var a = Math.atan2(dy, dx);
    var lo = -Math.PI + 0.2, hi = -0.2;           // sirf upar ki taraf
    if (a > 0) a = (dx >= 0 ? hi : lo);
    return clamp(a, lo, hi);
  }

  function hitsBall(x, y) {
    var lim = (R * 1.86) * (R * 1.86);
    var r0 = Math.max(0, Math.floor((y - topY - R * 3 + scroll) / ROWH));
    var r1 = Math.min(rows.length - 1, Math.ceil((y - topY + R * 3 + scroll) / ROWH));
    for (var r = r0; r <= r1; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        if (row[c] === null) continue;
        var dx = px(r, c) - x, dy = py(r) - y;
        if (dx * dx + dy * dy < lim) return true;
      }
    }
    return false;
  }

  // ball ka raasta (deewar se tak-kar mudta hai), pehle ball/chhat par ruk jaata hai
  function trace(ang, maxLen) {
    var x = sx, y = sy, vx = Math.cos(ang), vy = Math.sin(ang), pts = [[x, y]], len = 0;
    var left = gx + R, right = gx + GW - R;
    while (len < maxLen) {
      x += vx * 5; y += vy * 5; len += 5;
      if (x < left) { x = left + (left - x); vx = -vx; pts.push([x, y]); }
      else if (x > right) { x = right - (x - right); vx = -vx; pts.push([x, y]); }
      if (y <= topY + R || hitsBall(x, y)) break;
    }
    pts.push([x, y]);
    return pts;
  }

  // ================= Chalana =================
  function fire(ang) {
    if (state !== 'play' || shot) return;
    shot = { x: sx, y: sy, vx: Math.cos(ang), vy: Math.sin(ang), col: cur };
    cur = nxt; nxt = pickColor();
    recoil = 1;
    sfx('shoot');
  }

  function swap() {
    var t = cur; cur = nxt; nxt = t;
    sfx('swap');
  }

  // ================= Ball chipkana =================
  function popText(text, x, y, color, size) {
    pops.push({ t: text, x: x, y: y, c: color, s: size || 26, life: 1.1, max: 1.1 });
  }

  function land(b) {
    // sabse paas ki khaali jagah dhundo (jiske paas koi ball ho ya jo pehli line me ho)
    var best = null, bd = 1e9, maxR = rows.length + 1;
    for (var r = 0; r <= maxR; r++) {
      for (var c = 0; c < colsOf(r); c++) {
        if (get(r, c) !== null && get(r, c) !== undefined) continue;
        var ok = r === 0;
        if (!ok) {
          var ns = nbrs(r, c);
          for (var i = 0; i < ns.length; i++) { var v = get(ns[i][0], ns[i][1]); if (v !== null && v !== undefined) { ok = true; break; } }
        }
        if (!ok) continue;
        var dx = px(r, c) - b.x, dy = py(r) - b.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [r, c]; }
      }
    }
    if (!best) return;
    while (rows.length <= best[0]) rows.push(new Array(colsOf(rows.length)).fill(null));
    rows[best[0]][best[1]] = b.col;
    sfx('stick');
    settle(best[0], best[1]);
  }

  function settle(r0, c0) {
    var col = rows[r0][c0];
    // ek rang ke jude hue ball
    var seen = {}, group = [], stack = [[r0, c0]];
    seen[r0 * 20 + c0] = 1;
    while (stack.length) {
      var p = stack.pop();
      group.push(p);
      var ns = nbrs(p[0], p[1]);
      for (var i = 0; i < ns.length; i++) {
        var k = ns[i][0] * 20 + ns[i][1];
        if (seen[k] || get(ns[i][0], ns[i][1]) !== col) continue;
        seen[k] = 1; stack.push(ns[i]);
      }
    }

    var popped = 0, fell = 0;
    if (group.length >= 3) {
      var mx = 0, my = 0;
      group.forEach(function (p, idx) {
        var x = px(p[0], p[1]), y = py(p[0]);
        bursts.push({ x: x, y: y, col: COLORS[col], t: -idx * 0.03 });
        rows[p[0]][p[1]] = null;
        mx += x; my += y;
      });
      popped = group.length;
      mx /= popped; my /= popped;
      fell = dropFloating(true);
      var pts = popped * CONFIG.POP_POINTS + fell * CONFIG.FALL_POINTS;
      score += pts;
      sfx('pop', popped);
      if (fell) sfx('fall', fell);
      shake = 0.1 + Math.min(0.2, popped * 0.015);
      popText('+' + pts, mx, my, '#ffe14d', 30);
      if (fell >= 4 || popped >= 6) popText(fell >= 6 ? 'AWESOME!' : 'GREAT!', W / 2, my - 38, '#7be0ff', 28);
      misses = 0;
    } else {
      misses++;
    }

    trimRows();
    fixQueue();

    // mushkil: kuch na phoote to upar se line neeche aati hai
    var hard = (CONFIG.TIME - timeLeft) >= CONFIG.HARD_AFTER;
    if (!popped && misses >= (hard ? CONFIG.MISS_PUSH_HARD : CONFIG.MISS_PUSH)) {
      addTopRow(); misses = 0;
    }
    refill();
    checkDanger();
  }

  // upar se jude na ho wale ball gir jaayein. points=true to ginti lauta do
  function dropFloating(award) {
    var seen = {}, stack = [], r, c;
    for (c = 0; c < rows[0].length; c++) if (rows[0][c] !== null) { seen[c] = 1; stack.push([0, c]); }
    while (stack.length) {
      var p = stack.pop(), ns = nbrs(p[0], p[1]);
      for (var i = 0; i < ns.length; i++) {
        var k = ns[i][0] * 20 + ns[i][1];
        if (seen[k] || get(ns[i][0], ns[i][1]) === null || get(ns[i][0], ns[i][1]) === undefined) continue;
        seen[k] = 1; stack.push(ns[i]);
      }
    }
    var n = 0;
    for (r = 1; r < rows.length; r++)
      for (c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === null || seen[r * 20 + c]) continue;
        fallers.push({ x: px(r, c), y: py(r), vx: rand(-60, 60), vy: rand(-220, -60), col: rows[r][c], spin: rand(-3, 3) });
        rows[r][c] = null;
        n++;
      }
    return n;
  }

  // ball neeche (shooter ke paas) tak aa jaye to wo line gir jaati hai
  function checkDanger() {
    var any = false;
    for (var r = 0; r < rows.length; r++) {
      if (py(r) + R <= dangerY) continue;
      for (var c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === null) continue;
        fallers.push({ x: px(r, c), y: py(r), vx: rand(-80, 80), vy: rand(-200, -50), col: rows[r][c], spin: rand(-3, 3) });
        rows[r][c] = null;
        any = true;
      }
    }
    if (any) {
      dropFloating(false);
      trimRows();
      sfx('danger');
      popText('DANGER!', W / 2, dangerY - 20, '#ff6a5a', 30);
      fixQueue();
      refill();
    }
  }

  // ================= Ungli =================
  function logical(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function nearShooter(p) {
    var dx = p.x - sx, dy = p.y - sy;
    return dx * dx + dy * dy < 46 * 46 || (p.x - (sx + 56)) * (p.x - (sx + 56)) + (p.y - (sy + 14)) * (p.y - (sy + 14)) < 26 * 26;
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state !== 'play') return;
    var p = logical(e);
    aim = { x: p.x, y: p.y, swapZone: nearShooter(p), moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!aim) return;
    e.preventDefault();
    var p = logical(e);
    if (Math.abs(p.x - aim.x) + Math.abs(p.y - aim.y) > 8) aim.moved = true;
    aim.x = p.x; aim.y = p.y;
    if (aim.moved) aim.swapZone = false;
  });

  function release(e, cancel) {
    if (!aim) return;
    var p = logical(e), a = aim;
    aim = null;
    if (cancel || state !== 'play') return;
    if (a.swapZone && nearShooter(p) && !a.moved) { swap(); return; }
    if (p.y > sy - 14) return;                    // shooter ke neeche chhode to nahi chalega
    fire(clampAngle(p.x - sx, p.y - sy));
  }
  canvas.addEventListener('pointerup', function (e) { release(e, false); });
  canvas.addEventListener('pointercancel', function (e) { release(e, true); });

  // ================= Update =================
  function update(dt) {
    clock += dt;
    var i;

    if (state === 'play') {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; finish(); return; }
    }

    scroll = Math.max(0, scroll - 330 * dt);
    recoil = Math.max(0, recoil - dt * 6);
    shake = Math.max(0, shake - dt);
    dispScore += (score - dispScore) * Math.min(1, dt * 10);
    if (Math.abs(score - dispScore) < 0.5) dispScore = score;

    // udta ball
    if (shot) {
      var left = gx + R, right = gx + GW - R, steps = Math.ceil(CONFIG.SPEED * dt / 5), landed = false;
      var sd = CONFIG.SPEED * dt / steps;
      for (i = 0; i < steps; i++) {
        shot.x += shot.vx * sd; shot.y += shot.vy * sd;
        if (shot.x < left) { shot.x = left + (left - shot.x); shot.vx = -shot.vx; }
        else if (shot.x > right) { shot.x = right - (shot.x - right); shot.vx = -shot.vx; }
        if (shot.y <= topY + R || hitsBall(shot.x, shot.y)) { landed = true; break; }
      }
      if (landed) { var b = shot; shot = null; land(b); }
    }

    // gire hue ball
    for (i = fallers.length - 1; i >= 0; i--) {
      var f = fallers[i];
      f.vy += 1900 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y > H + 40) fallers.splice(i, 1);
    }
    for (i = bursts.length - 1; i >= 0; i--) {
      var bu = bursts[i];
      var before = bu.t;
      bu.t += dt;
      if (before < 0 && bu.t >= 0) {
        for (var q = 0; q < 7; q++) parts.push({ x: bu.x, y: bu.y, vx: rand(-260, 260), vy: rand(-300, 120), c: q % 2 ? '#ffffff' : bu.col, s: rand(3, 6), life: rand(0.35, 0.7), g: 900 });
      }
      if (bu.t > 0.4) bursts.splice(i, 1);
    }
    for (i = parts.length - 1; i >= 0; i--) {
      var pt = parts[i];
      pt.vy += pt.g * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) parts.splice(i, 1);
    }
    for (i = pops.length - 1; i >= 0; i--) {
      pops[i].life -= dt; pops[i].y -= 30 * dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }
    for (i = 0; i < bubbles.length; i++) { bubbles[i].y -= bubbles[i].sp * dt; if (bubbles[i].y < -0.1) { bubbles[i].y = 1.1; bubbles[i].x = Math.random(); } }
  }

  // ================= Drawing =================
  function drawBall(x, y, r, col, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, shade(col, 1.55));
    g.addColorStop(0.45, col);
    g.addColorStop(1, shade(col, 0.68));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r - 0.5, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function outlinedText(text, x, y, size, fill, align) {
    ctx.font = '900 ' + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 7);
    ctx.strokeStyle = '#1a1050';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill || '#fff';
    ctx.fillText(text, x, y);
  }

  function draw() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    var i, r, c;

    // peeche ka rang
     var hh = (clock * 5) % 360;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'hsl(' + (hh + 255) % 360 + ',55%,30%)');
    g.addColorStop(1, 'hsl(' + (hh + 275) % 360 + ',60%,20%)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (i = 0; i < bubbles.length; i++) {
      var bb = bubbles[i];
      ctx.fillStyle = 'hsla(' + (bb.h + hh * 2) % 360 + ',80%,65%,0.09)';
      ctx.beginPath(); ctx.arc(bb.x * W, bb.y * H, bb.r, 0, 6.2832); ctx.fill();
    }

    ctx.save();
    if (shake > 0) ctx.translate(rand(-2, 2) * shake * 10, rand(-2, 2) * shake * 10);

    // khel ka maidan
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(gx, topY, GW, H - topY);
    ctx.fillStyle = 'rgba(160,140,255,0.5)';
    ctx.fillRect(gx - 3, topY, 3, H - topY);
    ctx.fillRect(gx + GW, topY, 3, H - topY);
    ctx.fillStyle = 'rgba(160,140,255,0.75)';
    ctx.fillRect(gx - 3, topY - 3, GW + 6, 4);

    // khatre ki line
    ctx.strokeStyle = 'rgba(255,90,90,0.45)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, dangerY); ctx.lineTo(gx + GW, dangerY); ctx.stroke();
    ctx.setLineDash([]);

    // ball
    for (r = 0; r < rows.length; r++) {
      var y = py(r);
      if (y < topY - R - 4 || y > H + R) continue;
      for (c = 0; c < rows[r].length; c++) {
        var v = rows[r][c];
        if (v !== null) drawBall(px(r, c), y, R - 0.5, COLORS[v]);
      }
    }

    // nishana
    if (aim && state === 'play' && !shot && !aim.swapZone && aim.y < sy - 14) {
      var ang = clampAngle(aim.x - sx, aim.y - sy);
      var pts = trace(ang, 1400);
      var col = COLORS[cur], dist = 0, next = 14;
      ctx.fillStyle = col;
      for (i = 1; i < pts.length; i++) {
        var x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1];
        var sl = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
        while (next <= dist + sl) {
          var t = (next - dist) / (sl || 1);
          ctx.globalAlpha = 0.95;
          ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 4.2, 0, 6.2832); ctx.fill();
          next += 20;
        }
        dist += sl;
      }
      ctx.globalAlpha = 1;
      var last = pts[pts.length - 1];
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(last[0], last[1], R - 1, 0, 6.2832); ctx.stroke();
    }

    // phoote hue ball (ring + chamak)
    for (i = 0; i < bursts.length; i++) {
      var bu = bursts[i];
      if (bu.t < 0) { drawBall(bu.x, bu.y, R - 0.5, bu.col); continue; }
      var k = bu.t / 0.4;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = bu.col;
      ctx.lineWidth = 7 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(bu.x, bu.y, R * (0.8 + k * 1.6), 0, 6.2832); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(bu.x, bu.y, R * (1 - k) * 0.8, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // gire hue ball
    for (i = 0; i < fallers.length; i++) drawBall(fallers[i].x, fallers[i].y, R - 0.5, COLORS[fallers[i].col]);

    // udta ball
    if (shot) drawBall(shot.x, shot.y, R - 0.5, COLORS[shot.col]);

    // kan
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      ctx.globalAlpha = clamp(p.life * 3, 0, 1);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s / 2, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // shooter
    var rc = 1 - recoil * 0.12;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(sx, sy, 34, 0.5, 2.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy, 34, 3.6, 5.7); ctx.stroke();
    if (!shot || true) drawBall(sx, sy + recoil * 6, (R + 2) * rc, COLORS[cur]);
    drawBall(sx + 56, sy + 14, 14, COLORS[nxt]);
    outlinedText('∞', sx - 60, sy + 12, 28, '#ffffff');
    if (aim && aim.swapZone) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 40, 0, 6.2832); ctx.stroke();
    }

    // +points
    for (i = 0; i < pops.length; i++) {
      var q = pops[i], age = q.max - q.life;
      var sc = age < 0.15 ? 0.5 + age / 0.15 * 0.7 : (age < 0.3 ? 1.2 - (age - 0.15) / 0.15 * 0.2 : 1);
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.save();
      ctx.translate(clamp(q.x, 60, W - 60), q.y); ctx.scale(sc, sc);
      outlinedText(q.t, 0, 0, q.s, q.c);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // upar ki patti: score + time
    var hg = ctx.createLinearGradient(0, 0, 0, topY - 4);
    hg.addColorStop(0, '#4a3aa8'); hg.addColorStop(1, '#3a2c8c');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, topY - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, topY - 4, W, 2);
    outlinedText(String(Math.round(dispScore)), W / 2, 30, 40, '#ffffff');
    var t = Math.ceil(timeLeft), mm = Math.floor(t / 60), ss = t % 60;
    outlinedText('⏱ ' + mm + ':' + (ss < 10 ? '0' : '') + ss, 14, 24, 20, timeLeft <= 10 ? '#ff8a8a' : '#ffffff', 'left');
    // time ki patti
    var bw = W - 28;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(14, 54, bw, 6);
    var tg = ctx.createLinearGradient(14, 0, 14 + bw, 0);
    tg.addColorStop(0, '#3ddc5a'); tg.addColorStop(0.6, '#ffc21a'); tg.addColorStop(1, '#ff3b2f');
    ctx.fillStyle = tg;
    ctx.fillRect(14, 54, bw * clamp(timeLeft / CONFIG.TIME, 0, 1), 6);
  }

  // ================= Loop =================
  var last = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (state !== 'menu' && state !== 'over') update(dt);
    else { clock += dt; update2(dt); }
    draw();
    requestAnimationFrame(frame);
  }
  // menu/over par bhi gire hue ball aur kan chalte rahein
  function update2(dt) {
    scroll = Math.max(0, scroll - 330 * dt);
    for (var i = fallers.length - 1; i >= 0; i--) { var f = fallers[i]; f.vy += 1900 * dt; f.y += f.vy * dt; f.x += f.vx * dt; if (f.y > H + 40) fallers.splice(i, 1); }
    for (i = bubbles.length - 1; i >= 0; i--) { bubbles[i].y -= bubbles[i].sp * dt; if (bubbles[i].y < -0.1) bubbles[i].y = 1.1; }
  }

  // menu ke peeche bhi sundar nazara
  (function () {
    var save = timeLeft;
    for (var r = 0; r < CONFIG.START_ROWS; r++) rows.push(null);
    for (r = CONFIG.START_ROWS - 1; r >= 0; r--) rows[r] = makeRowAt(r, rows[r + 1]);
    cur = pickColor(); nxt = pickColor();
    timeLeft = save;
  })();

  //@HOOK
  requestAnimationFrame(function (t) { last = t; frame(t); });
})();
