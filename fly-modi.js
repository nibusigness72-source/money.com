// fly-modi.js - Fly Modi game
// Photo: "photo.png" (isi folder me rakho) - wahi udne wali chidiya ki jagah dikhegi
(function () {
  'use strict';

  // ================= SETTINGS (sirf yahin badalna) =================
  var CONFIG = {
    TIME: 60,            // game kitne second ka
    PASS_POINTS: 4,      // ek pipe paar karne par point
    OUT_PENALTY: 20,     // out hone par kitne point kategi
    FREEZE: 1,           // out hone ke baad kitne second ruko (timer chalta rahta hai)
    GRAVITY: 1700,       // neeche girne ki taakat
    FLAP: -470,          // tap par upar jaane ki taakat
    MAX_FALL: 620,       // sabse tez girne ki speed
    SPEED: 270,          // pipe kitni tez aate hain
    GAP: 180,            // pipe ke beech ka khula hissa
    PIPE_W: 32,          // pipe ki chaudai
    SPACING: 180,        // do pipe ke beech doori
    MAX_SHIFT: 190,      // agle pipe ka gap pichhle se zyada se zyada kitna upar-neeche
    BIRD_SIZE: 66,       // photo ka size
    HIT_R: 14,           // chhune ka gola (chhota = aasan)
    BIRD_X: 90,          // photo screen par kahan (left se)
    GROUND: 110          // neeche zameen ki oonchai
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

  // ================= Photo =================
  var photo = new Image();
  var photoOk = false;
  photo.onload = function () { photoOk = true; };
  photo.src = 'photo.png';

  // ================= Screen size =================
  var W = 360, H = 760, scale = 1, dpr = 1;

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
  }
  window.addEventListener('resize', resize);
  resize();

  function groundY() { return H - CONFIG.GROUND; }

  // ================= Game state =================
  var state = 'menu';          // menu | ready | play | dead | over
  var started = false;         // pehla tap hua?
  var timeLeft = CONFIG.TIME;
  var score = 0;
  var bird = { y: 0, vy: 0, rot: 0 };
  var pipes = [];
  var pops = [];
  var scroll = 0;
  var deadT = 0;
  var clock = 0;
  var lastGapY = null;

  function midY() { return groundY() * 0.45; }

  function resetBird() {
    bird.y = midY();
    bird.vy = 0;
    bird.rot = 0;
  }

  function newGame() {
    score = 0;
    timeLeft = CONFIG.TIME;
    started = false;
    pipes = [];
    pops = [];
    lastGapY = null;
    resetBird();
    state = 'ready';
    menu.classList.add('hidden');
    over.classList.add('hidden');
  }

  // ================= Pipes =================
  function nextGapY() {
    var top = 110 + CONFIG.GAP / 2;
    var bottom = groundY() - 60 - CONFIG.GAP / 2;
    var y;
    if (lastGapY === null) {
      y = (top + bottom) / 2;
    } else {
      var lo = Math.max(top, lastGapY - CONFIG.MAX_SHIFT);
      var hi = Math.min(bottom, lastGapY + CONFIG.MAX_SHIFT);
      y = lo + Math.random() * (hi - lo);
    }
    lastGapY = y;
    return y;
  }

  function spawnPipe(x) {
    pipes.push({ x: x, gy: nextGapY(), passed: false });
  }

  // ================= Controls =================
  function flap() {
    if (state === 'ready') {
      started = true;
      state = 'play';
      if (!pipes.length) spawnPipe(W + 40);
    }
    if (state === 'play') bird.vy = CONFIG.FLAP;
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    flap();
  });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      flap();
    }
  });
  startBtn.addEventListener('click', newGame);
  againBtn.addEventListener('click', newGame);

  // ================= Out / End =================
  function popText(text, color) {
    pops.push({ t: text, c: color, x: CONFIG.BIRD_X, y: bird.y - 20, life: 1.1 });
  }

  function die() {
    if (state !== 'play') return;
    state = 'dead';
    deadT = CONFIG.FREEZE;
    bird.vy = -220;
    score = Math.max(0, score - CONFIG.OUT_PENALTY);
    popText('-' + CONFIG.OUT_PENALTY, '#ff5a5a');
  }

  function respawn() {
    pipes = [];
    lastGapY = null;
    resetBird();
    spawnPipe(W + 80);
    state = 'play';
    bird.vy = 0;
  }

  function finish() {
    state = 'over';
    var finalScore = Math.max(0, score);
    finalScoreEl.textContent = finalScore;
    finalNoteEl.textContent = finalScore > 0 ? 'Score save ho raha hai...' : 'Is baar koi point nahi mila';
    over.classList.remove('hidden');

    if (finalScore > 0 && window.PWScore) {
      PWScore.save('fly-modi', finalScore).then(function (r) {
        finalNoteEl.textContent = r ? '✅ Score save ho gaya' : '❌ Score save nahi hua, login check karo';
      });
    }
  }

  // ================= Update =================
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    var nx = Math.max(rx, Math.min(cx, rx + rw));
    var ny = Math.max(ry, Math.min(cy, ry + rh));
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function hitPipe(p) {
    var bx = CONFIG.BIRD_X, by = bird.y, r = CONFIG.HIT_R;
    var gTop = p.gy - CONFIG.GAP / 2;
    var gBot = p.gy + CONFIG.GAP / 2;
    var w = CONFIG.PIPE_W, capH = 26, capX = p.x - 3, capW = w + 6;
    if (circleRect(bx, by, r, p.x, 0, w, gTop)) return true;
    if (circleRect(bx, by, r, p.x, gBot, w, groundY() - gBot)) return true;
    if (circleRect(bx, by, r, capX, gTop - capH, capW, capH)) return true;
    if (circleRect(bx, by, r, capX, gBot, capW, capH)) return true;
    return false;
  }

  function update(dt) {
    clock += dt;

    // Timer (pehle tap se shuru, out ke waqt bhi chalta rehta hai)
    if (started && (state === 'play' || state === 'dead' || state === 'ready')) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        finish();
        return;
      }
    }

    if (state === 'ready') {
      bird.y = midY() + Math.sin(clock * 5) * 6;
      bird.rot = 0;
      scroll += CONFIG.SPEED * dt;
    }

    if (state === 'play') {
      bird.vy = Math.min(CONFIG.MAX_FALL, bird.vy + CONFIG.GRAVITY * dt);
      bird.y += bird.vy * dt;
      bird.rot = Math.max(-0.45, Math.min(1.2, bird.vy / 520));
      scroll += CONFIG.SPEED * dt;

      if (bird.y < 14) { bird.y = 14; if (bird.vy < 0) bird.vy = 0; }   // chhat par ruk jao, out nahi

      var i;
      for (i = 0; i < pipes.length; i++) pipes[i].x -= CONFIG.SPEED * dt;
      if (!pipes.length || pipes[pipes.length - 1].x < W - CONFIG.SPACING) spawnPipe(W + 40);
      while (pipes.length && pipes[0].x < -CONFIG.PIPE_W - 10) pipes.shift();

      for (i = 0; i < pipes.length; i++) {
        var p = pipes[i];
        if (!p.passed && p.x + CONFIG.PIPE_W < CONFIG.BIRD_X - CONFIG.HIT_R) {
          p.passed = true;
          score += CONFIG.PASS_POINTS;
          popText('+' + CONFIG.PASS_POINTS, '#ffe14d');
        }
        if (hitPipe(p)) { die(); break; }
      }

      if (state === 'play' && bird.y + CONFIG.HIT_R >= groundY()) {
        bird.y = groundY() - CONFIG.HIT_R;
        die();
      }
    } else if (state === 'dead') {
      bird.vy = Math.min(CONFIG.MAX_FALL, bird.vy + CONFIG.GRAVITY * dt);
      bird.y += bird.vy * dt;
      if (bird.y + CONFIG.HIT_R >= groundY()) {
        bird.y = groundY() - CONFIG.HIT_R;
        bird.vy = 0;
      }
      bird.rot += 6 * dt;
      deadT -= dt;
      if (deadT <= 0) respawn();
    }

    for (var k = pops.length - 1; k >= 0; k--) {
      pops[k].life -= dt;
      pops[k].y -= 40 * dt;
      if (pops[k].life <= 0) pops.splice(k, 1);
    }
  }

  // ================= Drawing: peeche ka nazara =================
  var cityTile = null, groundTile = null;

  function makeCityTile() {
    var c = document.createElement('canvas');
    c.width = 360; c.height = 260;
    var g = c.getContext('2d');

    // badal
    g.fillStyle = '#e4f2d8';
    var bumps = [[0, 34], [48, 26], [92, 36], [140, 28], [190, 38], [238, 26], [284, 34], [330, 28], [360, 34]];
    bumps.forEach(function (b) { g.beginPath(); g.arc(b[0], 62, b[1], 0, Math.PI * 2); g.fill(); });
    g.fillRect(0, 62, 360, 130);

    // imaarat
    var b = [[8, 44, 96], [62, 54, 126], [126, 38, 78], [176, 46, 108], [232, 54, 134], [296, 46, 88]];
    b.forEach(function (o) {
      var x = o[0], w = o[1], h = o[2], y = 196 - h;
      g.fillStyle = '#cfe9e3';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#a3d6dd';
      g.lineWidth = 3;
      g.strokeRect(x, y, w, h);
      g.fillStyle = '#a3d6dd';
      for (var yy = y + 10; yy < 186; yy += 18) {
        for (var xx = x + 8; xx < x + w - 10; xx += 14) g.fillRect(xx, yy, 7, 9);
      }
    });

    // jhaadi
    g.fillStyle = '#9ad06f';
    g.fillRect(0, 190, 360, 70);
    g.strokeStyle = '#6fb84a';
    g.lineWidth = 3;
    for (var x = 0; x < 360; x += 36) {
      g.beginPath();
      g.moveTo(x, 214);
      g.lineTo(x + 14, 200);
      g.lineTo(x + 28, 214);
      g.stroke();
    }
    return c;
  }

  function makeGroundTile() {
    var h = CONFIG.GROUND;
    var c = document.createElement('canvas');
    c.width = 360; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#c8924f';
    g.fillRect(0, 0, 360, h);
    g.fillStyle = '#f0d9a0';
    g.fillRect(0, h - 34, 360, 34);
    g.fillStyle = '#6cc13e';
    g.fillRect(0, 0, 360, 16);
    g.fillStyle = '#4c9a2a';
    g.fillRect(0, 12, 360, 4);
    g.strokeStyle = '#a8743a';
    g.lineWidth = 3;
    for (var row = 0; row < 3; row++) {
      g.beginPath();
      for (var x = 0; x <= 360; x += 20) {
        var y = 38 + row * 16 + (x % 40 === 0 ? 0 : 5);
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = '#d6b877';
    for (var x2 = 10; x2 < 360; x2 += 70) {
      g.beginPath(); g.moveTo(x2, h - 20); g.lineTo(x2 + 34, h - 20); g.stroke();
    }
    return c;
  }

  function drawTiled(tile, y, speedMul) {
    var off = (scroll * speedMul) % 360;
    for (var x = -off; x < W; x += 360) ctx.drawImage(tile, x, y);
  }

  function drawPipe(p) {
    var w = CONFIG.PIPE_W, capH = 26, capX = p.x - 3, capW = w + 6;
    var gTop = p.gy - CONFIG.GAP / 2, gBot = p.gy + CONFIG.GAP / 2;

    function body(x, y, h) {
      var gr = ctx.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, '#c3e88a');
      gr.addColorStop(0.35, '#a7d65f');
      gr.addColorStop(1, '#5d9a38');
      ctx.fillStyle = gr;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#4a3b4b';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
    function cap(y) {
      var gr = ctx.createLinearGradient(capX, 0, capX + capW, 0);
      gr.addColorStop(0, '#c3e88a');
      gr.addColorStop(0.35, '#a7d65f');
      gr.addColorStop(1, '#5d9a38');
      ctx.fillStyle = gr;
      ctx.fillRect(capX, y, capW, capH);
      ctx.strokeStyle = '#4a3b4b';
      ctx.lineWidth = 2;
      ctx.strokeRect(capX, y, capW, capH);
    }

    body(p.x, -4, gTop - capH + 4);
    cap(gTop - capH);
    body(p.x, gBot + capH, groundY() - gBot - capH);
    cap(gBot);
  }

  function drawBird() {
    var x = CONFIG.BIRD_X, y = bird.y, s = CONFIG.BIRD_SIZE;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bird.rot);
    if (state === 'dead' && Math.floor(clock * 12) % 2 === 0) ctx.globalAlpha = 0.55;

    if (photoOk) {
      var r = photo.width / photo.height;
      var w = r >= 1 ? s : s * r;
      var h = r >= 1 ? s / r : s;
      ctx.drawImage(photo, -w / 2, -h / 2, w, h);
    } else {
      // photo.png na mile to ye peeli chidiya dikhegi
      ctx.fillStyle = '#ffc21a';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(7, -5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(9, -5, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6a2a';
      ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(25, 5); ctx.lineTo(14, 9); ctx.fill();
    }
    ctx.restore();
  }

  function outlinedText(text, x, y, size, fill, align) {
    ctx.font = '900 ' + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 7);
    ctx.strokeStyle = '#1b3a46';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill || '#fff';
    ctx.fillText(text, x, y);
  }

  function draw() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.fillStyle = '#35a8c0';
    ctx.fillRect(0, 0, W, H);

    if (!cityTile) { cityTile = makeCityTile(); groundTile = makeGroundTile(); }

    drawTiled(cityTile, groundY() - 258, 0.25);
    for (var i = 0; i < pipes.length; i++) drawPipe(pipes[i]);
    drawTiled(groundTile, groundY(), 1);

    if (state !== 'menu') drawBird();

    // score (upar beech me)
    outlinedText(String(score), W / 2, 72, 60, '#ffffff');

    // timer (upar left me)
    var t = Math.ceil(timeLeft);
    var mm = Math.floor(t / 60), ss = t % 60;
    outlinedText('⏱ ' + mm + ':' + (ss < 10 ? '0' : '') + ss, 14, 28, 22, timeLeft <= 10 ? '#ff8a8a' : '#ffffff', 'left');

    // +4 / -20 udte hue
    for (var k = 0; k < pops.length; k++) {
      var pp = pops[k];
      ctx.globalAlpha = Math.min(1, pp.life * 1.6);
      outlinedText(pp.t, pp.x + 30, pp.y, 30, pp.c);
      ctx.globalAlpha = 1;
    }

    if (state === 'ready') {
      outlinedText(started ? 'TAP!' : 'TAP TO START', W / 2, groundY() * 0.7, 26, '#ffffff');
    }
    if (state === 'dead') {
      outlinedText('OUT!  -' + CONFIG.OUT_PENALTY, W / 2, groundY() * 0.4, 38, '#ff5a5a');
      outlinedText(String(Math.ceil(deadT)), W / 2, groundY() * 0.4 + 52, 40, '#ffffff');
    }
  }

  // ================= Loop =================
  var last = 0;
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    if (state !== 'menu' && state !== 'over') update(dt);
    else clock += dt;
    draw();
    requestAnimationFrame(frame);
  }

  resetBird();
  requestAnimationFrame(function (t) { last = t; frame(t); });
})();
