// stack-tower.js - Stack Tower (1 minute, jitne chahe utne block) + points database mein save

var TOTAL_TIME = 60;    // kul samay (second)
var WAIT_TIME = 5;      // tower girne par intezaar (second)
var AMP = 0.85;         // rassi kitni door tak jhoolegi
var GRAVITY = 2600;     // block kitni tezi se girega

var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');

var scoreEl     = document.getElementById('score');
var timeEl      = document.getElementById('timeLeft');
var towersEl    = document.getElementById('towers');
var totalEl     = document.getElementById('totalPoints');
var popupEl     = document.getElementById('popup');
var overlay     = document.getElementById('overlay');
var resultTitle = document.getElementById('resultTitle');
var resultText  = document.getElementById('resultText');
var againBtn    = document.getElementById('againBtn');

var db = firebase.database();
var currentUser = null;

var W, H, BW, BH, groundY, pivotX, pivotY, ROPE, targetY;
var stack, pieces, score, blocks, perfects, camY, phase, state, cur, hintOn;
var endTime = 0;      // game kab khatam hoga
var waitEnd = 0;      // tower girne ke baad intezaar kab khatam hoga
var popupTimer = null;
var lastTime = 0;
var loopId = null;

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// Aaj ki tareekh (leaderboard ke daily/weekly/monthly ke liye)
function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// Login hone par uske kul points dikhao
firebase.auth().onAuthStateChanged(function (user) {
  if (!user) return;
  currentUser = user;
  db.ref('users/' + user.uid + '/points').once('value').then(function (snap) {
    totalEl.textContent = snap.val() || 0;
  });
});

function savePoints(pts) {
  PWScore.save('stack-tower', pts).then(function (r) {
    if (r) totalEl.textContent = r.total;
    else resultText.textContent += ' (Points save nahi hue, pehle login karo)';
  });
}

// Screen ke hisaab se sab naap
function setup() {
  var dpr = window.devicePixelRatio || 1;
  var r = canvas.getBoundingClientRect();
  W = r.width;
  H = r.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  BW = Math.max(64, Math.min(110, W * 0.26));   // block ki chaudai
  BH = BW * 0.78;                               // block ki unchai
  groundY = H - 30;                             // zameen
  pivotX = W / 2;                               // crane ka kendra
  pivotY = 30;
  ROPE = H * 0.28;                              // rassi ki lambai
  targetY = Math.max(H * 0.55, pivotY + ROPE + BH + 50);
}

function newGame() {
  if (loopId) cancelAnimationFrame(loopId);
  setup();
  stack = [];
  pieces = [];
  score = 0;
  blocks = 0;
  perfects = 0;
  camY = 0;
  phase = 0;
  state = 'swing';
  cur = null;
  hintOn = true;
  endTime = 0;
  waitEnd = 0;
  scoreEl.textContent = '0';
  timeEl.textContent = TOTAL_TIME;
  towersEl.textContent = '0';
  popupEl.className = 'popup';
  overlay.classList.remove('show');
  lastTime = performance.now();
  loopId = requestAnimationFrame(loop);
}

// Jhoolne ki raftaar: tower ooncha hone par thodi tez
function omega() {
  return Math.min(2.6 + stack.length * 0.12, 5.2);
}

// Rassi ke neeche block ki jagah
function hangPos() {
  var a = AMP * Math.sin(phase);
  return {
    x: pivotX + ROPE * Math.sin(a),
    y: pivotY + ROPE * Math.cos(a),
    a: a
  };
}

function showPopup(label, cls, pts) {
  clearTimeout(popupTimer);
  popupEl.className = 'popup';
  void popupEl.offsetWidth;
  popupEl.innerHTML = (pts ? '+' + pts + '<br>' : '') + label;
  popupEl.className = 'popup show ' + cls;
  popupTimer = setTimeout(function () {
    popupEl.className = 'popup';
  }, 900);
}

// Tap: block chhodo (pehle tap se 1 minute ki ghadi shuru)
function dropBlock() {
  Sound.unlock();   // pehle tap par awaaz chalu
  if (state !== 'swing') return;
  if (!endTime) endTime = performance.now() + TOTAL_TIME * 1000;

  var p = hangPos();
  hintOn = false;
  cur = {
    x: p.x - BW / 2,
    y: p.y - camY,
    vy: 0,
    landY: groundY - (stack.length + 1) * BH
  };
  state = 'drop';
  Sound.drop();
}

// Poora tower gir gaya: sab block bikhar kar girenge
function collapseTower(now, dir) {
  Sound.collapse();
  stack.forEach(function (b) {
    pieces.push({
      x: b.x, y: b.y,
      vx: dir * (40 + Math.random() * 120),
      vy: -Math.random() * 250,
      rot: 0,
      vr: dir * (0.5 + Math.random() * 2)
    });
  });
  pieces.push({
    x: cur.x, y: cur.y,
    vx: dir * 160,
    vy: 0,
    rot: 0,
    vr: dir * 2.5
  });

  stack = [];
  cur = null;
  towersEl.textContent = '0';
  state = 'wait';
  waitEnd = now + WAIT_TIME * 1000;
  showPopup('Tower gir gaya!', 'miss', 0);
}

// 5 second baad naya tower
function resetTower() {
  pieces = [];
  stack = [];
  camY = 0;
  state = 'swing';
}

// Block neeche pahunch gaya: kitna sahi laga, points do
function landBlock(now) {
  var prevLeft = stack.length ? stack[stack.length - 1].x : (W / 2 - BW / 2);
  var diff = cur.x - prevLeft;
  var r = Math.abs(diff) / BW;
  var pts, label, cls;

  if (r <= 0.10)      { pts = 5; label = 'Perfect!'; cls = 'perfect'; perfects++; Sound.land(3); }
  else if (r <= 0.30) { pts = 2; label = 'Good!';    cls = 'good'; Sound.land(2); }
  else if (r <= 0.60) { pts = 1; label = 'Average!'; cls = 'avg'; Sound.land(1); }
  else {
    // Bahut door: tower gir gaya
    collapseTower(now, diff < 0 ? -1 : 1);
    return;
  }

  stack.push({ x: cur.x, y: cur.landY });
  score += pts;
  blocks++;
  scoreEl.textContent = score;
  towersEl.textContent = stack.length;
  showPopup(label, cls, pts);
  cur = null;
  state = 'swing';
}

function finish() {
  if (state === 'over') return;
  state = 'over';
  clearTimeout(popupTimer);
  popupEl.className = 'popup';
  timeEl.textContent = '0';

  Sound.end();
  resultTitle.textContent = '⏰ Time khatam';
  resultText.textContent = 'Score: ' + score +
    '  |  Blocks: ' + blocks +
    '  |  Perfect: ' + perfects;

  if (score > 0) {
    resultText.textContent += '  →  +' + score + ' points mile';
    savePoints(score);
  }

  overlay.classList.add('show');
}

function update(dt, now) {
  // 1 minute ki ghadi
  if (endTime) {
    var left = Math.max(0, (endTime - now) / 1000);
    timeEl.textContent = Math.ceil(left);
    if (left <= 0) {
      finish();
      return;
    }
  }

  // Tower ooncha hone par camera neeche khiskta hai
  var topY = groundY - stack.length * BH;
  var wantCam = Math.max(0, targetY - topY);
  camY += (wantCam - camY) * Math.min(1, dt * 6);

  if (state === 'swing') {
    var oldPhase = phase;
    phase += omega() * dt;
    // rassi beech se guzre to halki sansanahat
    if (Math.floor(phase / Math.PI) !== Math.floor(oldPhase / Math.PI)) Sound.swing();
  } else if (state === 'drop') {
    cur.vy += GRAVITY * dt;
    cur.y += cur.vy * dt;
    if (cur.y >= cur.landY) landBlock(now);
  } else if (state === 'wait') {
    pieces.forEach(function (p) {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    });
    if (now >= waitEnd) resetTower();
  }
}

function drawBlock(x, y) {
  var m = BW * 0.08;
  // laal frame
  ctx.fillStyle = '#d93a2b';
  ctx.fillRect(x, y, BW, BH);
  // narangi deewar
  ctx.fillStyle = '#f59a3c';
  ctx.fillRect(x + m, y + BH * 0.18, BW - 2 * m, BH * 0.74);
  // khidki
  var ww = BW * 0.34;
  var wh = BH * 0.42;
  var wx = x + (BW - ww) / 2;
  var wy = y + BH * 0.28;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
  ctx.fillRect(wx, wy + wh / 2 - 1.5, ww, 3);
}

function draw(now) {
  // aasman
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050b24');
  g.addColorStop(1, '#10205e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // zameen aur sadak
  var gy = groundY + camY;
  ctx.fillStyle = '#2e9e3f';
  ctx.fillRect(0, gy, W, H);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(W / 2 - BW * 0.9, gy, BW * 1.8, 14);

  // bani hui manzilen
  stack.forEach(function (b) {
    drawBlock(b.x, b.y + camY);
  });

  // girta hua block
  if (cur) drawBlock(cur.x, cur.y + camY);

  // bikhre hue (gire hue) block
  pieces.forEach(function (p) {
    ctx.save();
    ctx.translate(p.x + BW / 2, p.y + camY + BH / 2);
    ctx.rotate(p.rot);
    drawBlock(-BW / 2, -BH / 2);
    ctx.restore();
  });

  // crane: rassi aur sone ki gend
  var p = hangPos();
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 11, 0, Math.PI * 2);
  ctx.fill();

  if (state === 'swing') {
    // jhoolta hua block (thoda tirchha)
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a * 0.35);
    drawBlock(-BW / 2, 0);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';

  if (hintOn) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 17px Arial';
    ctx.fillText('TAP karo, block gir jayega', W / 2, H * 0.5);
    ctx.font = '14px Arial';
    ctx.fillText('1 minute mein jitne chahe block girao', W / 2, H * 0.5 + 24);
  }

  // Tower girne ke baad 5 second ki ginti
  if (state === 'wait') {
    var secs = Math.max(0, Math.ceil((waitEnd - now) / 1000));
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Tower gir gaya! Naya tower:', W / 2, H * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Arial';
    ctx.fillText(secs, W / 2, H * 0.42 + 70);
  }
}

function loop(now) {
  var dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt, now);
  draw(now);
  if (state !== 'over') loopId = requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  dropBlock();
});

document.addEventListener('keydown', function (e) {
  if (e.code === 'Space') {
    e.preventDefault();
    dropBlock();
  }
});

againBtn.addEventListener('click', newGame);

newGame();