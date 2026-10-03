// fruit-cut.js  —  Fruit Cut game (lamba / landscape screen)
// Phal niche se dheere dheere upar jaate hain, phir niche girte hain. Ungli se beech mein kaatne par point milte hain.
// Kabhi kabhi bomb (granate) bhi aata hai - use kaata to 5 second game ruk jata hai.
(function () {
  // ===== Yahan se settings badal sakte ho =====
  var CONFIG = {
    TIME: 60,                   // poora game 1 minute (60 second)
    FREEZE: 5,                  // bomb kaatne par kitne second rukna
    TIMER_RUNS_IN_FREEZE: true, // true = ruke hue 5 second bhi 1 minute ke timer mein ginenge | false = timer ruk jayega
    GRAVITY: 350,               // phal kitni tezi se neeche aaye (chhota = aur dheere)
    LAUNCH_MIN: 410,            // phal ke upar jaane ki kam se kam tezi
    LAUNCH_MAX: 500,            // phal ke upar jaane ki zyada se zyada tezi (bada = zyada upar jayega)
    SPAWN_GAP_MIN: 0.7,         // agle phal ke beech kam se kam kitne second
    SPAWN_GAP_MAX: 1.6,         // agle phal ke beech zyada se zyada kitne second
    MAX_PER_WAVE: 5,            // ek baar mein ek saath zyada se zyada kitne phal
    BOMB_CHANCE: 0.14,          // bomb aane ka mauka (0.14 = 14%)
    BOMB_AFTER: 4,              // shuru ke itne second bomb nahi aayega
    TRAIL_LIFE: 0.25            // ungli ka nishan (pankh) kitni der dikhe
  };

  // pts = us phal ko kaatne ke point | r = phal ka size
  var FRUITS = [
    { name: 'Tarbuj',    emoji: '🍉', pts: 1, r: 34, juice: '#ef4444' },
    { name: 'Santra',    emoji: '🍊', pts: 2.5, r: 26, juice: '#fb923c' },
    { name: 'Kela',      emoji: '🍌', pts: 3, r: 28, juice: '#fde047' },
    { name: 'Seb',       emoji: '🍎', pts: 2, r: 26, juice: '#fef3c7' },
    { name: 'Nimbu',     emoji: '🍋', pts: 3, r: 24, juice: '#fde047' },
    { name: 'Aam',       emoji: '🥭', pts: 2, r: 26, juice: '#fbbf24' },
    { name: 'Nariyal',   emoji: '🥥', pts: 2, r: 30, juice: '#f5f5f4' },
    { name: 'Kathal',    emoji: null, pts: 1, r: 38, juice: '#facc15' }   // bhari phal - 1 point (khud ban hua drawing)
  ];

  var W = 640, H = 360, TAU = Math.PI * 2, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var wrap = document.getElementById('wrap');
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };

  // layout (screen kitni badi hai, seedhi hai ya lambi)
  var portrait = false, LW = 0, LH = 0, S = 1, OX = 0, OY = 0;

  var state = 'play', score = 0, timeLeft = CONFIG.TIME, frozen = 0, flash = 0, t = 0, spawnT = 0.5, cuts = 0;
  var objs = [], halves = [], parts = [], floaters = [], trails = {};
  var best = 0;
  try { best = +localStorage.getItem('fruitBest') || 0; } catch (e) {}

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ---------- Screen: seedha phone ho to 90 degree ghuma kar lamba karo ----------
  function resize() {
    var iw = window.innerWidth, ih = window.innerHeight;
    portrait = ih > iw;
    LW = portrait ? ih : iw;           // game ki chaudai
    LH = portrait ? iw : ih;           // game ki unchai
    wrap.style.width = LW + 'px';
    wrap.style.height = LH + 'px';
    wrap.style.transform = portrait ? 'translateX(' + iw + 'px) rotate(90deg)' : 'none';
    cv.width = Math.round(LW * DPR); cv.height = Math.round(LH * DPR);
    S = Math.min(LW / W, LH / H);
    OX = (LW - W * S) / 2; OY = (LH - H * S) / 2;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });

  // ungli ki jagah (screen) -> game ki jagah
  function toGame(cx, cy) {
    var lx = portrait ? cy : cx;
    var ly = portrait ? window.innerWidth - cx : cy;
    return { x: (lx - OX) / S, y: (ly - OY) / S };
  }

  // ---------- Game shuru ----------
  function startGame() {
    score = 0; timeLeft = CONFIG.TIME; frozen = 0; flash = 0; spawnT = 0.5; cuts = 0;
    objs = []; halves = []; parts = []; floaters = []; trails = {};
    state = 'play';
    $('overlay').classList.remove('show');
  }

  function endGame() {
    state = 'over';
    try { if (score > best) { best = score; localStorage.setItem('fruitBest', best); } } catch (e) {}
    saveOnline();
    $('resultTitle').textContent = '⏰ Time Over';
    $('resultText').textContent = 'Score: ' + score + '\nPhal kate: ' + cuts + '\nBest: ' + best;
    $('againBtn').textContent = 'Play Again';
    $('overlay').classList.add('show');
  }

  // Sabse achha score Firebase mein save (users/<uid>/fruitCutBest)
  function saveOnline() {
    try {
      var u = window.firebase && firebase.auth().currentUser;
      if (u) firebase.database().ref('users/' + u.uid + '/fruitCutBest').transaction(function (c) { return Math.max(c || 0, score); });
    } catch (e) {}
  }

  // ---------- Phal / bomb chhodo ----------
  function launch(isBomb) {
    var f = isBomb ? { name: 'Bomb', emoji: '💣', r: 27 } : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    var x = rnd(70, W - 70);
    var vx = (W / 2 - x) * rnd(0.05, 0.25) + rnd(-25, 25);      // thoda beech ki taraf
    objs.push({ bomb: isBomb, f: f, x: x, y: H + f.r + 6, vx: vx, vy: -rnd(CONFIG.LAUNCH_MIN, CONFIG.LAUNCH_MAX),
                rot: rnd(0, TAU), vrot: rnd(-2, 2), cut: false });
  }

  function spawnWave() {
    var n = 1 + Math.floor(Math.random() * CONFIG.MAX_PER_WAVE);
    var bombDone = false;
    for (var i = 0; i < n; i++) {
      var bomb = !bombDone && t > CONFIG.BOMB_AFTER && Math.random() < CONFIG.BOMB_CHANCE;
      if (bomb) bombDone = true;
      launch(bomb);
    }
  }

  // ---------- Kaatna ----------
  function distToSeg(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    var u = l2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
    var qx = x0 + u * dx, qy = y0 + u * dy;
    return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
  }

  function slash(x0, y0, x1, y1) {
    if (state !== 'play') return;
    var ang = Math.atan2(y1 - y0, x1 - x0);
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      if (o.cut || o.y < -10) continue;
      if (distToSeg(o.x, o.y, x0, y0, x1, y1) <= o.f.r + 4) {
        cutObj(o, ang);
        if (state !== 'play') return;
      }
    }
  }

  function burst(x, y, col, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = rnd(0, TAU), v = rnd(speed * 0.3, speed);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: rnd(2, 4.5), life: rnd(0.5, 1.0), col: col });
    }
  }

  function cutObj(o, ang) {
    o.cut = true;
    if (o.bomb) {                                   // bomb kata: 5 second game ruk jata hai
      state = 'freeze'; frozen = CONFIG.FREEZE; flash = 0.45;
      FruitSound.bomb();
      burst(o.x, o.y, '#f97316', 26, 260); burst(o.x, o.y, '#3f3f46', 16, 200);
      floaters.push({ x: o.x, y: o.y - 20, text: 'BOMB!', life: 1.4, col: '#ef4444', big: 1 });
      objs = []; halves = [];
      return;
    }
    score += o.f.pts; cuts++;
    FruitSound.slice();
    floaters.push({ x: o.x, y: o.y - 14, text: '+' + o.f.pts, life: 0.9, col: '#fde047', big: 0 });
    burst(o.x, o.y, o.f.juice, 14, 170);
    var nx = -Math.sin(ang), ny = Math.cos(ang);    // kaat ke seedhe disha
    for (var side = 0; side < 2; side++) {
      var sg = side ? 1 : -1;
      halves.push({ f: o.f, x: o.x, y: o.y, vx: o.vx * 0.6 + nx * sg * 70, vy: o.vy * 0.4 + ny * sg * 70 - 20,
                    rot: o.rot, vrot: o.vrot + sg * rnd(1, 3), la: ang - o.rot, side: side });
    }
  }

  // ---------- Update ----------
  function update(dt) {
    t += dt;
    if (flash > 0) flash -= dt;
    parts.forEach(function (p) { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    parts = parts.filter(function (p) { return p.life > 0; });
    floaters.forEach(function (f) { f.life -= dt; f.y -= 30 * dt; });
    floaters = floaters.filter(function (f) { return f.life > 0; });
    halves.forEach(function (h) { h.vy += CONFIG.GRAVITY * 1.6 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vrot * dt; });
    halves = halves.filter(function (h) { return h.y < H + 80; });
    Object.keys(trails).forEach(function (k) {
      var tr = trails[k]; tr.pts = tr.pts.filter(function (p) { return t - p.t < CONFIG.TRAIL_LIFE; });
    });

    if (state === 'over') return;

    if (state === 'play' || CONFIG.TIMER_RUNS_IN_FREEZE) {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; return endGame(); }
    }

    if (state === 'freeze') {
      frozen -= dt;
      if (frozen <= 0) { state = 'play'; spawnT = 0.6; trails = {}; }
      return;
    }

    spawnT -= dt;
    if (spawnT <= 0) { spawnWave(); spawnT = rnd(CONFIG.SPAWN_GAP_MIN, CONFIG.SPAWN_GAP_MAX); }

    objs.forEach(function (o) { o.vy += CONFIG.GRAVITY * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vrot * dt; });
    objs = objs.filter(function (o) { return !o.cut && !(o.vy > 0 && o.y > H + o.f.r + 10); });
  }

  // ---------- Drawing ----------
  function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, '#f8efcf'); g.addColorStop(1, '#f1dca6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 240);
    for (var x = 0; x < W; x += 40) rect(x, 0, 2, 240, 'rgba(160,110,50,.12)');           // deewar ki patti
    // darwaza
    rect(262, 14, 116, 220, '#d9e8c8'); rect(270, 22, 100, 204, '#e6f1d6');
    rect(280, 34, 36, 70, '#cfe0bb'); rect(324, 34, 36, 70, '#cfe0bb'); rect(280, 116, 36, 90, '#cfe0bb'); rect(324, 116, 36, 90, '#cfe0bb');
    ctx.fillStyle = '#e0a93b'; ctx.beginPath(); ctx.arc(320, 18, 34, Math.PI, TAU); ctx.fill();
    rect(246, 14, 16, 220, '#6aa3b8'); rect(378, 14, 16, 220, '#6aa3b8');
    // khidki (daayi taraf)
    rect(470, 22, 150, 104, '#fff7df'); rect(480, 32, 130, 84, '#9ed0e0'); rect(542, 32, 6, 84, '#fff7df');
    // railing (baayi taraf)
    rect(0, 150, 200, 8, '#fff7df'); rect(0, 216, 200, 8, '#fff7df');
    [20, 80, 140, 190].forEach(function (px) { rect(px, 150, 12, 74, '#fff2cc'); });
    // farsh
    rect(0, 232, W, 34, '#b9564b'); rect(0, 232, W, 4, '#8f3d36'); rect(0, 262, W, 4, '#8f3d36');
    // seedhiyan
    ctx.fillStyle = '#e8d9a9'; ctx.beginPath(); ctx.moveTo(210, 266); ctx.lineTo(430, 266); ctx.lineTo(450, 312); ctx.lineTo(190, 312); ctx.closePath(); ctx.fill();
    rect(228, 270, 184, 30, '#a24a58');
    ctx.fillStyle = '#7d93bd'; ctx.beginPath(); ctx.moveTo(190, 312); ctx.lineTo(450, 312); ctx.lineTo(470, H); ctx.lineTo(170, H); ctx.closePath(); ctx.fill();
    rect(206, 318, 228, 32, '#a24a58');
    // khamba
    rect(190, 236, 22, 124, '#fff2cc'); rect(430, 236, 22, 124, '#fff2cc');
    // jhaadiyan
    ctx.fillStyle = '#8ccfc0';
    [[60, 340, 80], [140, 350, 60], [520, 340, 80], [590, 350, 60]].forEach(function (b) { ctx.beginPath(); ctx.arc(b[0], b[1], b[2] * 0.7, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#fffbe8';
    [[50, 330], [100, 345], [530, 332], [585, 346]].forEach(function (b) { ctx.beginPath(); ctx.arc(b[0], b[1], 5, 0, TAU); ctx.fill(); });
  }

  function emojiAt(emoji, r) {
    ctx.font = Math.round(r * 2) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 0, r * 0.06);
  }

  function drawJack(r, cutFace) {            // kathal (khud ka drawing)
    ctx.fillStyle = '#7f9430'; ctx.strokeStyle = '#4d5d1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.82, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5f7120';
    for (var i = 0; i < 16; i++) {
      var a = i * 2.4, d = (i % 4) * r * 0.2 + r * 0.12;
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.82, 3.2, 0, TAU); ctx.fill();
    }
  }

  function drawBody(f) {
    if (f.emoji) emojiAt(f.emoji, f.r); else drawJack(f.r);
  }

  function drawObj(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    if (!o.bomb) ctx.rotate(o.rot);
    drawBody(o.f);
    ctx.restore();
  }

  function drawHalf(h) {
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
    ctx.save();
    ctx.rotate(h.la);
    ctx.beginPath(); ctx.rect(-80, h.side ? 0 : -80, 160, 80); ctx.clip();
    ctx.rotate(-h.la);
    drawBody(h.f);
    ctx.restore();
    // kate hue hisse par ras ki lakeer
    ctx.rotate(h.la);
    ctx.strokeStyle = h.f.juice; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-h.f.r * 0.85, 0); ctx.lineTo(h.f.r * 0.85, 0); ctx.stroke();
    ctx.restore();
  }

  function drawTrails() {
    Object.keys(trails).forEach(function (k) {
      var p = trails[k].pts;
      for (var i = 1; i < p.length; i++) {
        var age = (t - p[i].t) / CONFIG.TRAIL_LIFE, a = Math.max(0, 1 - age);
        ctx.strokeStyle = 'rgba(230,246,255,' + (0.9 * a) + ')';
        ctx.lineWidth = 2 + 7 * a * (i / p.length) + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p[i - 1].x, p[i - 1].y); ctx.lineTo(p[i].x, p[i].y); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,200,240,' + (0.5 * a) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p[i - 1].x, p[i - 1].y - 2); ctx.lineTo(p[i].x, p[i].y - 2); ctx.stroke();
      }
    });
  }

  function outlined(s, x, y, size, fill, stroke, align) {
    ctx.font = 'bold ' + size + 'px "Arial Black", Arial, sans-serif';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 7); ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y);
    ctx.fillStyle = fill; ctx.fillText(s, x, y);
  }

  function fmt(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b0f0a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    drawBg();
    halves.forEach(drawHalf);
    objs.forEach(drawObj);
    parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); });
    ctx.globalAlpha = 1;
    drawTrails();
    floaters.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.life * 2); outlined(f.text, f.x, f.y, f.big ? 34 : 24, f.col, '#7a3b00'); ctx.globalAlpha = 1; });

    // score (upar baayein) aur time (upar daayein)
    ctx.save(); ctx.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('🍉', 12, 28); ctx.restore();
    outlined(String(score), 52, 28, 34, '#fde047', '#8a4b00', 'left');
    outlined(fmt(timeLeft), W - 12, 28, 34, '#fde047', '#8a4b00', 'right');
    outlined('Best ' + Math.max(best, score), W - 12, 58, 15, '#fff7df', '#8a4b00', 'right');

    // bomb kata: bada 5 second ginti
    if (state === 'freeze') {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H);
      outlined('💥 BOMB KATA!', W / 2, 110, 34, '#ffffff', '#7f1d1d');
      outlined(String(Math.ceil(frozen)), W / 2, 205, 100, '#ffffff', '#7f1d1d');
      outlined('Ruko...', W / 2, 288, 22, '#fde68a', '#7f1d1d');
    }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,90,40,' + Math.min(0.7, flash * 1.6) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  // ---------- Ungli / mouse ----------
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    FruitSound.unlock();
    var p = toGame(e.clientX, e.clientY);
    trails[e.pointerId] = { pts: [{ x: p.x, y: p.y, t: t }] };
  });
  cv.addEventListener('pointermove', function (e) {
    var tr = trails[e.pointerId]; if (!tr) return;
    e.preventDefault();
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    for (var i = 0; i < evs.length; i++) {
      var p = toGame(evs[i].clientX, evs[i].clientY), prev = tr.pts[tr.pts.length - 1];
      if (prev && Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) < 1.5) continue;
      tr.pts.push({ x: p.x, y: p.y, t: t });
      if (prev) slash(prev.x, prev.y, p.x, p.y);
    }
  });
  function lift(e) { delete trails[e.pointerId]; }
  cv.addEventListener('pointerup', lift);
  cv.addEventListener('pointercancel', lift);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  $('againBtn').addEventListener('click', startGame);

  resize();
  startGame();                 // page khulte hi game seedha shuru (start button nahi)
  requestAnimationFrame(loop);
})();
