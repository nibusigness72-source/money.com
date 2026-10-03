// knife-hit.js - original Knife Hit jaisa: lakdi ka gol, chaku, awaaz | 1 minute, 5 stage, 100 chaku

var TOTAL_TIME = 60;     // kul samay (second)
var WAIT_TIME = 5;       // chaku takrane par intezaar (second)
var CLEAR_BONUS = 4;     // har stage poora karne ka bonus
var CLASH = 0.1;         // do chaku kitne paas hon to takra jayenge
var THROW_SPEED = 1700;  // chaku kitni tezi se jayega
var PEN = 0.7;           // phal ka kitna hissa lakdi ke andar jata hai

// 5 stage, lakdi ka rang har stage mein thoda alag | chaku 7+13+20+27+33 = 100 | max 280 + 20 bonus = 300
var STAGES = [
  { knives: 7,  pre: 2, pts: 6, min: 1.4, max: 2.4, stop: 0.15, hue: 0 },
  { knives: 10, pre: 3, pts: 6, min: 1.8, max: 3.0, stop: 0.20, hue: -8 },
  { knives: 12, pre: 4, pts: 6, min: 2.2, max: 3.6, stop: 0.25, hue: 8 },
  { knives: 14, pre: 5, pts: 6, min: 2.6, max: 4.2, stop: 0.30, hue: -14 },
  { knives: 22, pre: 6, pts: 6, min: 3.0, max: 4.8, stop: 0.30, hue: 14 }
];

var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');

var scoreEl     = document.getElementById('score');
var timeEl      = document.getElementById('timeLeft');
var stageEl     = document.getElementById('stage');
var knivesEl    = document.getElementById('knives');
var totalEl     = document.getElementById('totalPoints');
var popupEl     = document.getElementById('popup');
var overlay     = document.getElementById('overlay');
var resultTitle = document.getElementById('resultTitle');
var resultText  = document.getElementById('resultText');
var againBtn    = document.getElementById('againBtn');

var db = firebase.database();
var currentUser = null;

var W, H, cx, cy, R, BL, HL, startY;
var stageNo, stuck, flying, fallers, knivesLeft, hits, score, clashes;
var rot, omega, target, changeIn, kRate, kick;
var state, endTime, waitEnd, breakT, clock, hintOn;
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

firebase.auth().onAuthStateChanged(function (user) {
  if (!user) return;
  currentUser = user;
  db.ref('users/' + user.uid + '/points').once('value').then(function (snap) {
    totalEl.textContent = snap.val() || 0;
  });
});

function savePoints(pts) {
  if (!currentUser) {
    resultText.textContent += ' (Points save nahi hue, pehle login karo)';
    return;
  }
  var ref = db.ref('users/' + currentUser.uid);
  ref.child('points').transaction(function (cur) {
    return (cur || 0) + pts;
  }).then(function (res) {
    totalEl.textContent = res.snapshot.val();
  });
  ref.child('pointsByDay/' + todayKey()).transaction(function (cur) {
    return (cur || 0) + pts;
  });
}

function setup() {
  var dpr = window.devicePixelRatio || 1;
  var r = canvas.getBoundingClientRect();
  W = r.width;
  H = r.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  R = Math.max(50, Math.min(W * 0.23, H * 0.16));  // lakdi ka radius
  cx = W / 2;
  cy = H * 0.34;
  BL = R * 0.8;                                     // phal ki lambai
  HL = R * 0.5;                                     // mutthe ki lambai
  startY = H - BL - HL - 14;                        // chaku yahan se chalega
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

function normAngle(a) {
  var t = Math.PI * 2;
  return ((a % t) + t) % t;
}

function angleDiff(a, b) {
  var d = Math.abs(normAngle(a) - normAngle(b));
  return Math.min(d, Math.PI * 2 - d);
}

function newGame() {
  if (loopId) cancelAnimationFrame(loopId);
  setup();
  stageNo = 0;
  score = 0;
  hits = 0;
  clashes = 0;
  endTime = 0;
  clock = 0;
  kick = 0;
  hintOn = true;
  scoreEl.textContent = '0';
  timeEl.textContent = TOTAL_TIME;
  popupEl.className = 'popup';
  overlay.classList.remove('show');
  startStage();
  lastTime = performance.now();
  loopId = requestAnimationFrame(loop);
}

// Naya stage: pehle se lage chaku random jagah
function startStage() {
  var s = STAGES[stageNo];
  stuck = [];
  flying = null;
  fallers = [];
  rot = 0;
  omega = 0;
  target = 0;
  changeIn = 0.5;
  kRate = 10;
  knivesLeft = s.knives;
  state = 'play';

  var tries = 0;
  while (stuck.length < s.pre && tries < 500) {
    tries++;
    var a = Math.random() * Math.PI * 2;
    var ok = true;
    for (var i = 0; i < stuck.length; i++) {
      if (angleDiff(a, stuck[i]) < 0.5) ok = false;
    }
    if (ok) stuck.push(a);
  }

  stageEl.textContent = stageNo + 1;
  knivesEl.textContent = knivesLeft;
  showPopup('Stage ' + (stageNo + 1) + (stageNo === 4 ? ' BOSS' : ''), 'gold', 0);
}

// Lakdi ki chaal: kabhi left, kabhi right, kabhi achanak ruk jana ya palat jana
function pickMotion() {
  var s = STAGES[stageNo];
  if (Math.random() < s.stop) {
    target = 0;
    changeIn = 0.25 + Math.random() * 0.5;
    kRate = 30;
  } else {
    var dir = Math.random() < 0.5 ? -1 : 1;
    target = dir * (s.min + Math.random() * (s.max - s.min));
    changeIn = 0.4 + Math.random() * 1.1;
    kRate = Math.random() < 0.4 ? 25 : 8;
  }
}

function updateSpin(dt) {
  changeIn -= dt;
  if (changeIn <= 0) pickMotion();
  omega += (target - omega) * Math.min(1, dt * kRate);
  rot += omega * dt;
}

function throwKnife() {
  Sound.unlock();   // pehle tap par awaaz chalu
  if (state !== 'play' || flying || knivesLeft <= 0) return;
  if (!endTime) endTime = performance.now() + TOTAL_TIME * 1000;
  hintOn = false;
  flying = { y: startY };
  knivesLeft--;
  knivesEl.textContent = knivesLeft;
  Sound.drop();
}

// Chaku lakdi tak pahunch gaya
function landKnife(now) {
  var a = normAngle(Math.PI / 2 - rot);
  for (var i = 0; i < stuck.length; i++) {
    if (angleDiff(a, stuck[i]) < CLASH) {
      // chaku se chaku takraya: tan-tan, 5 second ruko
      fallers.push({ x: cx, y: flying.y, vx: (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 80), vy: -300, r: 0 });
      flying = null;
      knivesLeft++;
      knivesEl.textContent = knivesLeft;
      clashes++;
      state = 'wait';
      waitEnd = now + WAIT_TIME * 1000;
      Sound.clink();
      showPopup('Chaku takra gaya!', 'miss', 0);
      return;
    }
  }

  var s = STAGES[stageNo];
  stuck.push(a);
  flying = null;
  hits++;
  score += s.pts;
  scoreEl.textContent = score;
  kick = 7;                 // lakdi halka sa hilti hai
  Sound.stab();             // lakdi mein dasne ki awaaz
  showPopup('Sahi!', 'good', s.pts);

  if (knivesLeft === 0) {   // stage ke saare chaku lag gaye: lakdi toot jayegi
    score += CLEAR_BONUS;
    scoreEl.textContent = score;
    state = 'break';
    breakT = 0;
    Sound.crack();
    showPopup('Stage clear!', 'gold', CLEAR_BONUS);
  }
}

function finish(won) {
  if (state === 'over') return;
  state = 'over';
  clearTimeout(popupTimer);
  popupEl.className = 'popup';
  timeEl.textContent = won ? Math.max(0, Math.ceil((endTime - performance.now()) / 1000)) : '0';
  Sound.end();

  resultTitle.textContent = won ? '🏆 Saare stage poore!' : '⏰ Time khatam';
  resultText.textContent = 'Score: ' + score +
    '  |  Chaku lage: ' + hits +
    '  |  Takraye: ' + clashes;

  if (score > 0) {
    resultText.textContent += '  →  +' + score + ' points mile';
    savePoints(score);
  }
  overlay.classList.add('show');
}

function update(dt, now) {
  clock += dt;
  kick *= 0.8;

  if (endTime) {
    var left = Math.max(0, (endTime - now) / 1000);
    timeEl.textContent = Math.ceil(left);
    if (left <= 0) {
      finish(false);
      return;
    }
  }

  fallers.forEach(function (f) {
    f.vy += 2200 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.r += 6 * dt;
  });

  if (state === 'play') {
    updateSpin(dt);
    if (flying) {
      flying.y -= THROW_SPEED * dt;
      var landY = cy + R - BL * PEN;
      if (flying.y <= landY) {
        flying.y = landY;
        landKnife(now);
      }
    }
  } else if (state === 'wait') {
    omega = 0;
    if (now >= waitEnd) {
      state = 'play';
      fallers = [];
    }
  } else if (state === 'break') {
    breakT += dt;
    if (breakT >= 0.8) {
      stageNo++;
      if (stageNo >= STAGES.length) finish(true);
      else startStage();
    }
  }
}

// Chaku: (tx,ty) nok hai, th us taraf jidhar mutthha hai
function drawKnife(tx, ty, th, red) {
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(th);
  ctx.fillStyle = '#e5e7eb';                         // phal
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(BL * 0.2, -5);
  ctx.lineTo(BL, -5);
  ctx.lineTo(BL, 5);
  ctx.lineTo(BL * 0.2, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9ca3af';                         // phal ka neeche ka hissa
  ctx.fillRect(BL * 0.2, 0, BL * 0.8, 5);
  ctx.fillStyle = '#facc15';                         // guard
  ctx.fillRect(BL - 2, -9, 5, 18);
  ctx.fillStyle = red ? '#ef4444' : '#b45309';       // mutthha
  ctx.fillRect(BL + 3, -5, HL, 10);
  ctx.fillStyle = '#78350f';
  for (var i = 1; i < 4; i++) ctx.fillRect(BL + 3 + HL * i / 4 - 1.5, -5, 3, 10);
  ctx.restore();
}

// Lakdi ka rang dheere dheere badalta aur milta hai, par dikhta hamesha ek hi gol
function shade(h, s, l) {
  var shift = Math.sin(clock * 0.7) * 14 + STAGES[stageNo].hue;
  return 'hsl(' + (h + shift) + ',' + s + '%,' + l + '%)';
}

function ring(r, a, b) {
  ctx.beginPath();
  ctx.arc(0, 0, r, a, b);
  ctx.stroke();
}

function disc(r) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

// Lakdi ka gol tukda (chhaal + andar ke chhalle)
function paintLog() {
  ctx.fillStyle = shade(22, 65, 33);     // chhaal
  disc(R);
  ctx.fillStyle = shade(36, 80, 58);     // lakdi
  disc(R * 0.9);
  ctx.strokeStyle = shade(30, 70, 45);
  ctx.lineWidth = R * 0.07;
  ring(R * 0.7, 0.4, 4.6);
  ring(R * 0.48, 2, 6);
  ring(R * 0.26, 0, 3.6);
  ctx.fillStyle = shade(28, 70, 40);
  disc(R * 0.07);
}

// Stage poora: lakdi 6 tukdon mein toot kar bikharti hai
function drawPieces() {
  var n = 6, step = Math.PI * 2 / n;
  ctx.globalAlpha = Math.max(0, 1 - breakT / 0.8);
  for (var k = 0; k < n; k++) {
    var mid = rot + k * step + step / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * breakT * 200, cy + Math.sin(mid) * breakT * 200 + breakT * breakT * 500);
    ctx.rotate(rot + (k % 2 ? 1 : -1) * breakT * 2.2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R * 1.2, k * step, (k + 1) * step);
    ctx.closePath();
    ctx.clip();
    paintLog();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function draw(now) {
  var i;
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e5560');
  g.addColorStop(1, '#061a2b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (var x = 0; x < W; x += 46) ctx.fillRect(x, 0, 18, H);

  var s = STAGES[stageNo];
  var breaking = state === 'break';

  ctx.save();
  ctx.translate(0, kick);

  // lakdi mein lage chaku (lakdi ke neeche, taki nok andar chhupi rahe)
  stuck.forEach(function (a) {
    var th = a + rot, d = R - BL * PEN, ox = 0, oy = 0, tw = 0;
    ctx.globalAlpha = 1;
    if (breaking) {
      ox = Math.cos(th) * breakT * 260;
      oy = Math.sin(th) * breakT * 260 + breakT * breakT * 500;
      tw = breakT * 2;
      ctx.globalAlpha = Math.max(0, 1 - breakT / 0.8);
    }
    drawKnife(cx + Math.cos(th) * d + ox, cy + Math.sin(th) * d + oy, th + tw, false);
  });
  ctx.globalAlpha = 1;

  // udta chaku: lakdi mein ghuste hi lakdi ke neeche
  if (flying && flying.y < cy + R) drawKnife(cx, flying.y, Math.PI / 2, false);

  if (breaking) {
    drawPieces();
  } else {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    paintLog();
    ctx.restore();
    if (state === 'wait') {
      ctx.fillStyle = 'rgba(239,68,68,0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  if (flying && flying.y >= cy + R) drawKnife(cx, flying.y, Math.PI / 2, false);

  fallers.forEach(function (f) {
    drawKnife(f.x, f.y, Math.PI / 2 + f.r, true);
  });

  if (state === 'play' && !flying && knivesLeft > 0) drawKnife(cx, startY, Math.PI / 2, false);

  // baayen taraf chaku ginti (kharch hue chaku kaale)
  var n = s.knives, sp = Math.min(20, H * 0.6 / n);
  ctx.lineWidth = 4;
  for (i = 0; i < n; i++) {
    var yy = H * 0.14 + i * sp;
    ctx.strokeStyle = i < n - knivesLeft ? 'rgba(0,0,0,0.45)' : '#a5e3f2';
    ctx.beginPath();
    ctx.moveTo(12, yy + 6);
    ctx.lineTo(24, yy - 4);
    ctx.stroke();
  }

  // upar 5 stage ke bindu
  for (i = 0; i < 5; i++) {
    ctx.fillStyle = i <= stageNo ? '#facc15' : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(W / 2 + (i - 2) * 18, 16, i === stageNo ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';

  if (hintOn) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 17px Arial';
    ctx.fillText('TAP karo, chaku maaro', W / 2, H * 0.62);
    ctx.font = '14px Arial';
    ctx.fillText('Chaku se chaku na takraye!', W / 2, H * 0.62 + 24);
  }

  if (state === 'wait') {
    var secs = Math.max(0, Math.ceil((waitEnd - now) / 1000));
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Chaku takra gaya! Ruko:', W / 2, H * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Arial';
    ctx.fillText(secs, W / 2, H * 0.6 + 70);
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
  throwKnife();
});

document.addEventListener('keydown', function (e) {
  if (e.code === 'Space') {
    e.preventDefault();
    throwKnife();
  }
});

againBtn.addEventListener('click', newGame);

newGame();
