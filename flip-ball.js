// flip-ball.js  —  Flip Ball game
// Gend ek hi jagah rehti hai, gole (circle) dheere dheere aage aate hain.
// Tap = gend thodi upar | tap chhodo = gend dheere neeche | har circle paar = 20 point
// Circle chhoota ya neeche gira = 5 second game ruk jata hai (score kam nahi hota, aage judta hai)
(function () {
  // ===== Yahan se settings badal sakte ho =====
  var CONFIG = {
    TIME: 60,              // poora game 5 minute (300 second)
    FREEZE: 5,              // galti par kitne second rukna
    TIMER_RUNS_IN_FREEZE: true, // true = ruke hue 5 second bhi 5 minute ke timer mein ginenge | false = timer ruk jayega
    POINTS: 4,             // 1 "point" ki keemat (touch hone par 1x, bina touch par 2x, 3x, 4x...)
        HOLE: 30,               // circle ke khule hisse ki aadhi chaudai (bada = paar karna aasaan)
    CLEAN_DX: 14,           // itna beech mein se nikli to "bina touch" (perfect) maana jayega
    RING_RX: 40,            // circle ki aadhi chaudai
    RING_RY: 15,            // circle ki aadhi unchai (bada = circle zyada khula dikhega)
    BOOST_POWER: 330,       // neele circle mein gend kitni tezi se upar jaye    // circle ki aadhi unchai
    GRAVITY: 600,           // gend kitni tezi se neeche aaye
    MAX_FALL: 240,          // neeche girne ki sabse zyada speed (chhota = aur dheere girti hai)
    TAP_POWER: 200,         // ek tap par gend kitni upar jaye (bada = zyada upar)
    RING_SPEED: 6000,         // circle ki shuruaati speed (dheere dheere aata hai)
    RING_SPEED_MAX: 140,     // circle ki sabse zyada speed
    BOOST_EVERY: 5,         // har 5ve circle par neela circle (upar uthane wale nishan)
    SHIELD_EVERY: 15         // har 8ve circle par shield wala circle (ek galti maaf)
  };

  var W = 360, H = 640, GROUND = 560, BX = 70, BR = 18, TAU = Math.PI * 2;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };

  var PALETTES = [
    { sky: '#e2e0c3', hill: '#d4cba5', far: '#dcd6b4', cloud: '#f0eed9' },
    { sky: '#e3c39a', hill: '#d3b183', far: '#dcbb8e', cloud: '#f1d2aa' },
    { sky: '#c8dde0', hill: '#a9c9c6', far: '#b9d3d2', cloud: '#e6f2f1' },
    { sky: '#d9c9e0', hill: '#bba6c9', far: '#c8b6d3', cloud: '#eee3f3' }
  ];

  var state = 'play', score = 0, hoops = 0, timeLeft = CONFIG.TIME, frozen = 0;
  var x = BX, y = 300, vy = 0, rings = [], spawned = 0, lastY = 300, shield = false;
  var floaters = [], flash = 0, t = 0, scroll = 0, missMsg = '', combo = 0;
  var best = 0;
  try { best = +localStorage.getItem('flipBest') || 0; } catch (e) {}
  $('totalPoints').textContent = best;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ringSpeed() { return Math.min(CONFIG.RING_SPEED_MAX, CONFIG.RING_SPEED + hoops * 1.2); }

  function resize() {
    var r = cv.getBoundingClientRect();
    cv.width = r.width * DPR; cv.height = r.height * DPR;
  }
  window.addEventListener('resize', resize);

  // ---------- Naya circle banao ----------
  function spawnRing(px) {
    spawned++;
    var type = 'normal';
    if (spawned % CONFIG.SHIELD_EVERY === 0) type = 'shield';
    else if (spawned % CONFIG.BOOST_EVERY === 0) type = 'boost';
    var ry = clamp(lastY + rnd(-130, 130), 170, 480);
    lastY = ry;
    rings.push({ x: px, y: ry, type: type, done: false });
  }

  function startGame() {
    score = 0; hoops = 0; timeLeft = CONFIG.TIME; frozen = 0; spawned = 0;
    shield = false; combo = 0; floaters = []; flash = 0; state = 'play';
    resetRound();
    updateHud();
    $('overlay').classList.remove('show');
  }

  // Galti ke baad (ya shuruaat mein): gend beech mein, naye circle
  function resetRound() {
    y = 300; vy = 0; lastY = 300; rings = [];
    spawnRing(W + 40);
  }

  // ---------- Galti ----------
  function miss(msg) {
    if (shield) {
      shield = false;
      floaters.push({ x: BX + 70, y: y - 30, text: '🛡 SHIELD BACHA!', life: 1.2, col: '#22d3ee', big: 1 });
      if (y > GROUND - BR - 2) { y = GROUND - BR - 2; vy = -380; }
      return;
    }
    state = 'freeze'; frozen = CONFIG.FREEZE; flash = 0.35; missMsg = msg; combo = 0;
  }

  function endGame() {
    state = 'over';
    try { if (score > best) { best = score; localStorage.setItem('flipBest', best); } } catch (e) {}
    $('totalPoints').textContent = best;
    saveOnline();
    $('resultTitle').textContent = '⏰ Time Over';
    $('resultText').textContent = 'Score: ' + score + '\nCircle paar: ' + hoops;
    $('againBtn').textContent = 'Play Again';
    $('overlay').classList.add('show');
  }

  // Sabse achha score Firebase mein save (users/<uid>/flipBallBest)
  function saveOnline() {
    try {
      var u = window.firebase && firebase.auth().currentUser;
      if (u) firebase.database().ref('users/' + u.uid + '/flipBallBest').transaction(function (c) { return Math.max(c || 0, score); });
    } catch (e) {}
  }

  function fmt(s) {
    s = Math.max(0, Math.ceil(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function updateHud() {
    $('score').textContent = score;
    $('hoops').textContent = hoops;
    $('timeLeft').textContent = fmt(timeLeft);
  }

  // ---------- Tap ----------
  function tap() {
    if (state !== 'play') return;
    vy = -CONFIG.TAP_POWER;
  }

  // ---------- Update ----------
  function update(dt) {
    t += dt;
    if (flash > 0) flash -= dt;
    floaters.forEach(function (f) { f.life -= dt; f.y -= 30 * dt; });
    floaters = floaters.filter(function (f) { return f.life > 0; });
    if (state === 'over') { scroll += 10 * dt; return; }

    if (state === 'play' || CONFIG.TIMER_RUNS_IN_FREEZE) {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; updateHud(); return endGame(); }
    }

    if (state === 'freeze') {
      frozen -= dt;
      if (frozen <= 0) { state = 'play'; resetRound(); }
      updateHud();
      return;
    }
// gend ki chaal
    vy += CONFIG.GRAVITY * dt;
    if (vy > CONFIG.MAX_FALL) vy = CONFIG.MAX_FALL;

    var RX = CONFIG.RING_RX, HOLE = CONFIG.HOLE, SOLID = BR * 0.6;

    // neele circle ke neeche (^) nishan: gend niche se upar circle ke andar se uthti hai
    rings.forEach(function (r) {
      if (r.type === 'boost' && !r.done && Math.abs(r.x - BX) <= HOLE && y > r.y && y < r.y + 150) {
        vy = -CONFIG.BOOST_POWER;
      }
    });

    var py = y;                         // gend pehle kahan thi
    y += vy * dt;
    if (y < BR + 4) { y = BR + 4; vy = 0; }

    // circle aage khiskao
    var sp = ringSpeed();
    scroll += sp * dt;
    rings.forEach(function (r) { r.x -= sp * dt; });

    for (var i = 0; i < rings.length; i++) {
      var r = rings[i];
      if (r.done) continue;
      var adx = Math.abs(r.x - BX);                       // gend circle ke beech se kitni door
      var down = py <= r.y && y > r.y;                    // gend upar se niche nikli
      var up = py >= r.y && y < r.y;                      // gend niche se upar nikli

      if (adx <= HOLE) {
        // gend circle ke khule hisse (hole) ke andar se nikal rahi hai
        if (down || up) {
          var needUp = (r.type === 'boost');              // neela = niche se upar | lal = upar se niche
          if ((needUp && up) || (!needUp && down)) {
            r.done = true;
            var clean = !r.touched && adx <= CONFIG.CLEAN_DX;   // bina touch ke beech se nikli
            if (clean) combo++; else combo = 0;
            var mult = clean ? combo + 1 : 1;
            var pts = CONFIG.POINTS * mult;
            score += pts; hoops++;
            floaters.push({ x: BX + 70, y: y - 30, text: '+' + pts + (clean ? ' PERFECT x' + mult : ''), life: 1.0, col: clean ? '#b45309' : '#16a34a', big: clean ? 1 : 0 });
            if (needUp) vy = -60;
            if (r.type === 'shield') {
              shield = true;
              floaters.push({ x: BX + 70, y: y - 60, text: '🛡 SHIELD!', life: 1.2, col: '#0891b2', big: 1 });
            }
          } else {
            // galat disha: lal mein niche se upar ya neele mein upar se niche
            r.done = true;
            miss(needUp ? 'Neele circle mein niche se upar!' : 'Lal circle mein upar se niche!');
            if (state === 'freeze') { updateHud(); return; }
          }
        }
      } else if (adx <= RX + 12) {
        // circle ka kinara (rim) thos hai: gend aar-paar nahi ja sakti
        if (down || up || Math.abs(y - r.y) < SOLID) {
          if (py < r.y) { y = r.y - SOLID; if (vy > 0) vy = 0; }
          else          { y = r.y + SOLID; if (vy < 0) vy = 0; }
          r.touched = true;
        }
      }

      // circle poora screen se bahar chala gaya aur gend usse paar nahi hui
      if (!r.done && r.x + RX < -4) {
        r.done = true;
        miss('Circle chhoot gaya!');
        if (state === 'freeze') { updateHud(); return; }
      }
    }
    rings = rings.filter(function (r) { return r.x > -120; });
    var lastR = rings[rings.length - 1];
    if (!lastR || lastR.x < W - 230) spawnRing(W + 60);

    // neeche zameen par gira
    if (y >= GROUND - BR) {
      y = GROUND - BR;
      miss('Neeche gira!');
    }
    updateHud();
  }

  // ---------- Drawing ----------
  function cloud(cx, cy, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, 22 * s, 0, TAU); ctx.arc(cx + 26 * s, cy + 6 * s, 16 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - 28 * s, cy + 6 * s, 80 * s, 16 * s, 8 * s) : ctx.rect(cx - 28 * s, cy + 6 * s, 80 * s, 16 * s); ctx.fill();
  }
  function wrapX(base, factor, span) {
    var v = (base - scroll * factor) % span; if (v < 0) v += span; return v - 80;
  }

  function drawBg() {
    var p = PALETTES[Math.floor(hoops / 8) % PALETTES.length];
    ctx.fillStyle = p.sky; ctx.fillRect(0, 0, W, H);
    cloud(wrapX(40, 0.25, W + 160), 150, 1.3, p.cloud);
    cloud(wrapX(250, 0.25, W + 160), 300, 1.0, p.cloud);
    // door pahaad
    ctx.fillStyle = p.far;
    for (var i = 0; i < 3; i++) {
      var mx = wrapX(i * 190, 0.5, 570);
      ctx.beginPath(); ctx.moveTo(mx - 90, GROUND); ctx.lineTo(mx, GROUND - 170 - (i % 2) * 40); ctx.lineTo(mx + 120, GROUND); ctx.closePath(); ctx.fill();
    }
    // paas ki pahadi + cactus
    ctx.fillStyle = p.hill;
    ctx.beginPath(); ctx.ellipse(wrapX(120, 0.8, W + 300), GROUND + 40, 260, 120, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(wrapX(380, 0.8, W + 300), GROUND + 60, 240, 100, 0, 0, TAU); ctx.fill();
    ctx.fillRect(0, GROUND - 20, W, 20);
    var cxx = wrapX(220, 0.8, W + 300);
    ctx.fillRect(cxx, GROUND - 100, 22, 90);
    ctx.fillRect(cxx - 14, GROUND - 70, 14, 10);
    ctx.fillRect(cxx + 22, GROUND - 60, 14, 10);
    // neeche zameen
    ctx.fillStyle = '#93402a'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#000'; ctx.fillRect(0, GROUND, W, 4);
  }

  function ringShape(r, part) {   // part: 'all' ya 'front'
    var RX = CONFIG.RING_RX, RY = CONFIG.RING_RY;
    ctx.lineWidth = 8; ctx.strokeStyle = '#000';
    var col = r.type === 'boost' ? '#38bdf8' : '#ef5350';
    ctx.beginPath();
    if (part === 'front') ctx.ellipse(r.x, r.y, RX, RY, 0, 0, Math.PI);
    else ctx.ellipse(r.x, r.y, RX, RY, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
    if (part !== 'front') {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.ellipse(r.x, r.y - 1, RX * 0.7, RY * 0.4, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    }
  }

  function drawShieldIcon(sx, sy, s) {
    ctx.save(); ctx.translate(sx, sy); ctx.scale(s, s);
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#00f5e0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(18, -16, 18, -6); ctx.quadraticCurveTo(16, 14, 0, 24);
    ctx.quadraticCurveTo(-16, 14, -18, -6); ctx.quadraticCurveTo(-18, -16, 0, -20); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawChevrons(r) {
    for (var i = 0; i < 3; i++) {
      var cy = r.y + 40 + i * 32 + ((t * 60) % 32) * 0 ;
      ctx.globalAlpha = 0.35 + 0.65 * (((t * 2) + i * 0.33) % 1 < 0.5 ? 1 : 0.4);
      ctx.strokeStyle = '#22b8e0'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r.x - 18, cy + 9); ctx.lineTo(r.x, cy - 6); ctx.lineTo(r.x + 18, cy + 9); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }

  function drawBall(bx, by) {
    ctx.save(); ctx.translate(bx, by);
    if (shield) {
      ctx.fillStyle = 'rgba(0,245,224,.25)'; ctx.strokeStyle = '#00f5e0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, BR + 10, 0, TAU); ctx.fill(); ctx.stroke();
    }
    // pankh
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(-16, -9 + Math.sin(t * 14) * 3, 14, 7, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
    // gend
    ctx.rotate(t * 2);
    ctx.fillStyle = '#fb923c'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, BR, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -BR); ctx.lineTo(0, BR); ctx.moveTo(-BR, 0); ctx.lineTo(BR, 0);
    ctx.moveTo(-10, -14); ctx.quadraticCurveTo(-2, 0, -10, 14); ctx.moveTo(10, -14); ctx.quadraticCurveTo(2, 0, 10, 14); ctx.stroke();
    ctx.restore();
  }

  function text(s, tx, ty, size, col) {
    ctx.fillStyle = col; ctx.font = 'bold ' + size + 'px Arial'; ctx.textAlign = 'center'; ctx.fillText(s, tx, ty);
  }

  function draw() {
    var r = cv.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (r.width - W * s) / 2, DPR * (r.height - H * s) / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    drawBg();
    // circle (peeche wala hissa)
    rings.forEach(function (rg) {
      if (rg.type === 'boost') drawChevrons(rg);
      ringShape(rg, 'all');
      if (rg.type === 'shield') drawShieldIcon(rg.x, rg.y + 10, 0.8);
    });
    drawBall(x, y);
    // circle ka aage wala hissa (gend circle ke andar se nikalti dikhe)
    rings.forEach(function (rg) { if (Math.abs(rg.x - BX) < CONFIG.RING_RX + 20) ringShape(rg, 'front'); });

    floaters.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.life * 2); text(f.text, f.x, f.y, f.big ? 22 : 20, f.col); ctx.globalAlpha = 1; });

    // galti: bada X + 5 second ginti
    if (state === 'freeze') {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 300); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#000'; ctx.fillRect(-18, -80, 36, 160); ctx.fillRect(-80, -18, 160, 36);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(-10, -72, 20, 144); ctx.fillRect(-72, -10, 144, 20);
      ctx.restore();
      text(missMsg, W / 2, 190, 22, '#fff');
      text(Math.ceil(frozen), W / 2, 450, 80, '#fff');
    }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  // ---------- Controls ----------
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); tap(); });
  document.addEventListener('keydown', function (e) { if (e.code === 'Space') { e.preventDefault(); tap(); } });
  $('againBtn').addEventListener('click', startGame);

  resize();
  startGame();                 // page khulte hi game seedha shuru (start button nahi)
  requestAnimationFrame(loop);
})();
