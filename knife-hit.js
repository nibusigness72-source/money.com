// knife-hit.js  —  Knife Hit game (5 stage, 100 chaku, 60 second, ~300 points)
(function () {
  // ===== Yahan se settings badal sakte ho =====
  var CONFIG = {
    TIME: 60,            // total samay (second)
    COLLISION: 'freeze', // 'freeze' = 5 sec rukna | 'out' = seedha out
    FREEZE: 5,           // chaku takraye to kitne second rukna
    STAGE_TIME_BONUS: 3, // stage todne par extra second
    GAP_PX: 9            // chaku ke beech kam se kam gap (bada = zyada aasaan/kam jagah)
  };
  // n = chaku (kul 100), pre = pehle se laga chaku, pts = har chaku ke point, bonus = stage tutne ka bonus
  var STAGES = [
    { n: 8,  pre: 0, pts: 2, bonus: 4, R: 68, spd: [1.0, 2.0], bob: 0,  hue: 40 },
    { n: 14, pre: 2, pts: 2, bonus: 4, R: 74, spd: [1.4, 2.6], bob: 0,  hue: 170 },
    { n: 20, pre: 3, pts: 3, bonus: 4, R: 80, spd: [1.8, 3.2], bob: 10, hue: 280 },
    { n: 26, pre: 4, pts: 3, bonus: 4, R: 86, spd: [2.2, 3.8], bob: 16, hue: 350 },
    { n: 32, pre: 5, pts: 3, bonus: 6, R: 92, spd: [2.6, 4.4], bob: 22, hue: 200 }
  ];
  // Kul max = 278 (chaku) + 22 (bonus) = 300

  var W = 360, H = 640, TAU = Math.PI * 2, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var CY = 235;

  var state = 'ready', si = 0, stage, left, stuck, rot, spd, tgt, nextChange, t = 0;
  var score = 0, timeLeft = CONFIG.TIME, frozen = 0, fly = null, bt = 0, flash = 0, kick = 0;
  var shards = [], debris = [], floaters = [], total = 0;
  var best = 0;
  try { best = +localStorage.getItem('knifeBest') || 0; } catch (e) {}
  $('totalPoints').textContent = best;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function angDiff(a, b) { var d = ((a - b) % TAU + TAU) % TAU; return d > Math.PI ? TAU - d : d; }
  function minGap() { return CONFIG.GAP_PX / stage.R; }
  function cyNow() { return CY + Math.sin(t * 1.6) * stage.bob; }

  function resize() {
    var r = cv.getBoundingClientRect();
    cv.width = r.width * DPR; cv.height = r.height * DPR;
  }
  window.addEventListener('resize', resize);

  // ---------- Stage shuru ----------
  function startStage(i) {
    si = i; stage = STAGES[i]; left = stage.n; stuck = []; total = stage.n;
    rot = Math.random() * TAU; spd = 0; nextChange = 0.5; tgt = 0;
    for (var k = 0, tries = 0; k < stage.pre && tries < 200; tries++) {
      var a = Math.random() * TAU, ok = true;
      for (var j = 0; j < stuck.length; j++) if (angDiff(a, stuck[j]) < minGap() * 3) ok = false;
      if (ok) { stuck.push(a); k++; }
    }
    $('stageNo').textContent = i + 1;
    floaters.push({ x: W / 2, y: 90, text: 'STAGE ' + (i + 1), life: 1.4, col: '#facc15', big: 1 });
  }

  function startGame() {
    score = 0; timeLeft = CONFIG.TIME; frozen = 0; fly = null;
    shards = []; debris = []; floaters = []; state = 'play';
    startStage(0); updateHud();
    $('overlay').classList.remove('show');
  }

  // ---------- Circle ki random chaal ----------
  function pickMotion() {
    if (Math.random() < 0.22) { tgt = 0; nextChange = rnd(0.3, 0.8); }          // achanak ruk jao
    else {
      tgt = (Math.random() < 0.5 ? -1 : 1) * rnd(stage.spd[0], stage.spd[1]);   // left ya right
      nextChange = rnd(0.5, 1.6);
      if (Math.random() < 0.35) spd = tgt;                                        // achanak palat jao
    }
  }

  // ---------- Chaku fenko ----------
  function throwKnife() {
    if (state !== 'play' || frozen > 0 || fly) return;
    fly = { y: H - 120 };
  }

  function land() {
    var a = Math.PI / 2 - rot, hit = false;
    for (var i = 0; i < stuck.length; i++) if (angDiff(a, stuck[i]) < minGap()) hit = true;
    if (hit) {
      debris.push({ x: W / 2, y: fly.y, vx: rnd(-220, 220), vy: 420, th: Math.PI / 2, vth: rnd(-9, 9), life: 1.5 });
      fly = null; flash = 0.35;
      floaters.push({ x: W / 2, y: 330, text: 'TAKRAYA!', life: 1, col: '#ff5d5d', big: 1 });
      if (CONFIG.COLLISION === 'out') return end(false);
      frozen = CONFIG.FREEZE;
      return;
    }
    stuck.push(a); fly = null; left--; kick = 6;
    score += stage.pts;
    floaters.push({ x: W / 2 + 40, y: 330, text: '+' + stage.pts, life: 0.7, col: '#7dff9b' });
    updateHud();
    if (left === 0) breakStage();
  }

  // ---------- Sab chaku sahi lage = circle toot jaye ----------
  function breakStage() {
    state = 'break'; bt = 1.3;
    score += stage.bonus; timeLeft += CONFIG.STAGE_TIME_BONUS;
    floaters.push({ x: W / 2, y: 140, text: 'STAGE CLEAR +' + stage.bonus, life: 1.3, col: '#facc15', big: 1 });
    var n = 8, cy = cyNow();
    for (var i = 0; i < n; i++) {
      var a0 = i * TAU / n + rot, a1 = (i + 1) * TAU / n + rot, m = (a0 + a1) / 2;
      shards.push({ x: W / 2, y: cy, a0: a0, a1: a1, vx: Math.cos(m) * rnd(120, 260), vy: Math.sin(m) * rnd(120, 260) - 120, r: 0, vr: rnd(-4, 4), col: wedgeColor(i), R: stage.R });
    }
    stuck.forEach(function (s) {
      var th = s + rot;
      debris.push({ x: W / 2 + Math.cos(th) * stage.R, y: cy + Math.sin(th) * stage.R, vx: Math.cos(th) * rnd(150, 300), vy: Math.sin(th) * rnd(150, 300) - 150, th: th, vth: rnd(-8, 8), life: 1.4 });
    });
    stuck = []; updateHud();
  }

  function end(win) {
    state = 'over';
    try { if (score > best) { best = score; localStorage.setItem('knifeBest', best); } } catch (e) {}
    $('totalPoints').textContent = best;
    saveOnline();
    $('resultTitle').textContent = win ? '🏆 Shabaash!' : (timeLeft <= 0 ? '⏰ Time Over' : '💥 Out!');
    $('resultText').textContent = 'Score: ' + score + '\nStage: ' + (si + 1) + '/5';
    $('againBtn').textContent = 'Play Again';
    $('overlay').classList.add('show');
  }

  // Score Firebase mein sabse achha score ke roop mein save hota hai (users/<uid>/knifeHitBest)
  function saveOnline() {
    try {
      var u = window.firebase && firebase.auth().currentUser;
      if (u) firebase.database().ref('users/' + u.uid + '/knifeHitBest').transaction(function (c) { return Math.max(c || 0, score); });
    } catch (e) {}
  }

  function updateHud() {
    $('score').textContent = score;
    $('timeLeft').textContent = Math.max(0, Math.ceil(timeLeft));
  }

  // ---------- Update ----------
  function update(dt) {
    t += dt;
    if (flash > 0) flash -= dt;
    if (kick > 0) kick = Math.max(0, kick - dt * 30);
    shards.forEach(function (s) { s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt; });
    debris.forEach(function (d) { d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.th += d.vth * dt; d.life -= dt; });
    debris = debris.filter(function (d) { return d.life > 0 && d.y < H + 80; });
    floaters.forEach(function (f) { f.life -= dt; f.y -= 30 * dt; });
    floaters = floaters.filter(function (f) { return f.life > 0; });

    if (state === 'break') {
      bt -= dt;
      if (bt <= 0) { shards = []; if (si === 4) end(true); else { startStage(si + 1); state = 'play'; } }
      return;
    }
    if (state !== 'play') { rot += 0.4 * dt; return; }

    timeLeft -= dt; if (frozen > 0) frozen = Math.max(0, frozen - dt);
    if (timeLeft <= 0) { timeLeft = 0; updateHud(); return end(false); }
    nextChange -= dt; if (nextChange <= 0) pickMotion();
    spd += (tgt - spd) * Math.min(1, dt * 6);
    rot += spd * dt;
    if (fly) { fly.y -= 2800 * dt; if (fly.y <= cyNow() + stage.R) land(); }
    updateHud();
  }

  // ---------- Drawing ----------
  function knife(tx) {                 // tip tx par, handle bahar ki taraf (+x)
    ctx.fillStyle = '#e5ecff'; ctx.beginPath();
    ctx.moveTo(tx, 0); ctx.lineTo(tx + 8, -4.5); ctx.lineTo(tx + 34, -4.5); ctx.lineTo(tx + 34, 4.5); ctx.lineTo(tx + 8, 4.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.fillRect(tx + 34, -8, 4, 16);
    ctx.fillStyle = '#b45309'; ctx.fillRect(tx + 38, -4, 20, 8);
  }

  // Color badalte wedge — milkar hamesha ek hi gol circle dikhta hai
  function wedgeColor(i) {
    return 'hsl(' + ((stage.hue + i * 38 + t * 40) % 360) + ',75%,' + (i % 2 ? 52 : 60) + '%)';
  }
  function wedge(R, a0, a1, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function drawWheel(cx, cy) {
    var n = 8, R = stage.R;
    ctx.save(); ctx.translate(cx, cy);
    for (var i = 0; i < n; i++) wedge(R, rot + i * TAU / n, rot + (i + 1) * TAU / n + 0.02, wedgeColor(i));
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#0b1b3a'; ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, TAU); ctx.fill();
    ctx.restore();
    stuck.forEach(function (a) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot + a); knife(stage.R - 12); ctx.restore();
    });
  }

  function text(s, x, y, size, col) {
    ctx.fillStyle = col; ctx.font = 'bold ' + size + 'px Arial'; ctx.textAlign = 'center'; ctx.fillText(s, x, y);
  }

  function draw() {
    var r = cv.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (r.width - W * s) / 2, DPR * (r.height - H * s) / 2);
    if (!stage) stage = STAGES[0];
    var cx = W / 2, cy = cyNow() + (kick ? Math.sin(t * 90) * kick * 0.3 : 0);

    if (state !== 'break') drawWheel(cx, cy);
    shards.forEach(function (sh) {
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.r); wedge(sh.R, sh.a0 - sh.r, sh.a1 - sh.r, sh.col); ctx.restore();
    });
    debris.forEach(function (d) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.th); knife(-12); ctx.restore(); });

    // Haath mein rakha chaku / udta chaku
    if (state === 'play' || state === 'break') {
      var ky = fly ? fly.y : H - 120;
      if (left > 0 || fly) {
        ctx.save(); ctx.globalAlpha = frozen > 0 && !fly ? 0.3 : 1; ctx.translate(W / 2, ky); ctx.rotate(Math.PI / 2); knife(0); ctx.restore();
      }
    }
    // Bache hue chaku (left side)
    for (var i = 0; i < total; i++) {
      ctx.fillStyle = i < left ? '#e5ecff' : 'rgba(255,255,255,.15)';
      ctx.fillRect(10, H - 16 - i * 8, 14, 4);
    }
    if (frozen > 0) text(Math.ceil(frozen), W / 2, H - 200, 70, '#ff5d5d');
    floaters.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.life * 2); text(f.text, f.x, f.y, f.big ? 26 : 20, f.col); ctx.globalAlpha = 1; });
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash + ')'; ctx.fillRect(0, 0, W, H); }
  }

  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  // ---------- Controls ----------
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); throwKnife(); });
  document.addEventListener('keydown', function (e) { if (e.code === 'Space') { e.preventDefault(); throwKnife(); } });
  $('againBtn').addEventListener('click', startGame);

  resize(); stage = STAGES[0]; stuck = []; left = 0; rot = 0; spd = 0; tgt = 0; nextChange = 0;
  requestAnimationFrame(loop);
})();
