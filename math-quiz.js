// math-quiz.js - Math Quiz
// Upar sawal (jaise 69 + 79), neeche 4 jawab. Har sawal 3 second ka. Sahi = +25 point.
(function () {
  'use strict';

  // ================= SETTINGS (sirf yahin badalna) =================
  var CONFIG = {
    TIME: 120,            // pura game kitne second ka (120 = 2 minute)
    QUESTION_TIME: 3,     // ek sawal kitne second dikhe, phir khud badal jaye
    POINTS: 15,           // sahi jawab ke point
    SCORE_CAP: 1000,      // ek game ka sabse zyada score jo save hoga (Firebase rule ke andar)

    // ---- sawal kitne mushkil: SIRF NEECHE KE NUMBER BADLO ----
    // Plus (+): dono number ADD_MIN se ADD_MAX ke beech. Jaise 69 + 79
    ADD_MIN: 10,  ADD_MAX: 120,
    // Minus (-): bada number SUB_MIN se SUB_MAX ke beech, chhota usse kam. Jawab kabhi minus me nahi aata
    SUB_MIN: 20,  SUB_MAX: 150,
    // Guna (x): pehla number MUL_A_MIN..MUL_A_MAX, doosra MUL_B_MIN..MUL_B_MAX. Jaise 14 x 7
    MUL_A_MIN: 2, MUL_A_MAX: 15,
    MUL_B_MIN: 2, MUL_B_MAX: 10,
    // Bhaag (/): bhaajak DIV_B_MIN..DIV_B_MAX, jawab DIV_Q_MIN..DIV_Q_MAX. Hamesha poora bhaag hota hai. Jaise 15 / 5
    DIV_B_MIN: 2, DIV_B_MAX: 10,
    DIV_Q_MIN: 2, DIV_Q_MAX: 15,

    // Kaun sa sawal kitni baar aaye (bada = zyada baar, 0 = kabhi nahi)
    W_ADD: 3, W_SUB: 3, W_MUL: 2, W_DIV: 2
  };

  // ================= Elements =================
  var timeEl = document.getElementById('time');
  var scoreEl = document.getElementById('score');
  var qbarEl = document.getElementById('qbar');
  var qEl = document.getElementById('question');
  var optsEl = document.getElementById('opts');
  var optBtns = Array.prototype.slice.call(optsEl.querySelectorAll('.opt'));
  var flashEl = document.getElementById('flash');
  var menu = document.getElementById('menu');
  var over = document.getElementById('over');
  var startBtn = document.getElementById('startBtn');
  var againBtn = document.getElementById('againBtn');
  var finalScoreEl = document.getElementById('finalScore');
  var finalStatsEl = document.getElementById('finalStats');
  var finalNoteEl = document.getElementById('finalNote');

  function sfx(name) {
    try { if (window.MathSound) window.MathSound[name](); } catch (e) {}
  }

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  // ================= Sawal banana =================
  function makeQuestion() {
    var ops = [], tot = 0;
    [['+', CONFIG.W_ADD], ['-', CONFIG.W_SUB], ['×', CONFIG.W_MUL], ['÷', CONFIG.W_DIV]].forEach(function (o) {
      if (o[1] > 0) { ops.push(o); tot += o[1]; }
    });
    var x = Math.random() * tot, op = ops[0][0];
    for (var i = 0; i < ops.length; i++) { if ((x -= ops[i][1]) < 0) { op = ops[i][0]; break; } }

    var a, b, ans;
    if (op === '+') {
      a = ri(CONFIG.ADD_MIN, CONFIG.ADD_MAX); b = ri(CONFIG.ADD_MIN, CONFIG.ADD_MAX); ans = a + b;
    } else if (op === '-') {
      a = ri(CONFIG.SUB_MIN, CONFIG.SUB_MAX); b = ri(2, a - 1); ans = a - b;
    } else if (op === '×') {
      a = ri(CONFIG.MUL_A_MIN, CONFIG.MUL_A_MAX); b = ri(CONFIG.MUL_B_MIN, CONFIG.MUL_B_MAX); ans = a * b;
    } else {
      b = ri(CONFIG.DIV_B_MIN, CONFIG.DIV_B_MAX); ans = ri(CONFIG.DIV_Q_MIN, CONFIG.DIV_Q_MAX); a = b * ans;
    }
    return { text: a + ' ' + op + ' ' + b, ans: ans, options: makeOptions(ans) };
  }

  // 1 sahi + 3 galat (sahi ke aas-paas ke, taaki soch kar chunna pade)
  function makeOptions(ans) {
    var set = {}, list = [ans], tries = 0;
    set[ans] = 1;
    var spread = Math.max(6, Math.round(ans * 0.12));
    while (list.length < 4 && tries++ < 200) {
      var w;
      var r = Math.random();
      if (r < 0.3) w = ans + (Math.random() < 0.5 ? -10 : 10);                // 10 ka fark
      else if (r < 0.5) w = ans + (Math.random() < 0.5 ? -1 : 1);             // 1 ka fark
      else w = ans + ri(-spread, spread);
      if (w < 0 || set[w]) continue;
      set[w] = 1;
      list.push(w);
    }
    var n = 1;
    while (list.length < 4) { if (!set[ans + n]) { set[ans + n] = 1; list.push(ans + n); } n++; }
    for (var i = list.length - 1; i > 0; i--) {            // fent do
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  // ================= State =================
  var state = 'menu';      // menu | play | over
  var timeLeft = CONFIG.TIME;
  var qLeft = CONFIG.QUESTION_TIME;
  var score = 0, asked = 0, right = 0;
  var q = null, locked = false;

  function fmt(sec) {
    sec = Math.ceil(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function showQuestion(withSound) {
    q = makeQuestion();
    asked++;
    qLeft = CONFIG.QUESTION_TIME;
    locked = false;
    optsEl.classList.remove('locked');
    qEl.textContent = q.text;
    qEl.classList.remove('pop');
    void qEl.offsetWidth;
    qEl.classList.add('pop');
    optBtns.forEach(function (b, i) {
      b.textContent = q.options[i];
      b.dataset.v = q.options[i];
      b.classList.remove('right', 'wrong');
    });
    if (withSound) sfx('next');
  }

  function flash(text, color) {
    flashEl.textContent = text;
    flashEl.style.color = color;
    flashEl.classList.remove('show');
    void flashEl.offsetWidth;
    flashEl.classList.add('show');
  }

  function answer(btn) {
    if (state !== 'play' || locked) return;
    locked = true;            // ek sawal par sirf PEHLA tap ginta hai, baaki tap bekaar
    optsEl.classList.add('locked');
    var v = parseInt(btn.dataset.v, 10);
    if (v === q.ans) {
      score += CONFIG.POINTS;
      right++;
      scoreEl.textContent = score;
      btn.classList.add('right');
      flash('+' + CONFIG.POINTS, '#7dffa0');
      sfx('right');
    } else {
      btn.classList.add('wrong');
      optBtns.forEach(function (b) { if (parseInt(b.dataset.v, 10) === q.ans) b.classList.add('right'); });
      sfx('wrong');
    }
  }

  optBtns.forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); answer(b); });
  });

  function newGame() {
    score = 0; asked = 0; right = 0;
    timeLeft = CONFIG.TIME;
    scoreEl.textContent = '0';
    timeEl.textContent = fmt(timeLeft);
    timeEl.parentNode.classList.remove('low');
    state = 'play';
    menu.classList.add('hidden');
    over.classList.add('hidden');
    showQuestion(false);
  }

  function finish() {
    state = 'over';
    sfx('end');
    var finalScore = Math.min(Math.max(0, score), CONFIG.SCORE_CAP);
    finalScoreEl.textContent = finalScore;
    finalStatsEl.textContent = 'Sahi jawab: ' + right;
    finalNoteEl.textContent = finalScore > 0 ? 'Score save ho raha hai...' : 'Is baar koi point nahi mila';
    over.classList.remove('hidden');
    if (finalScore > 0 && window.PWScore) {
      PWScore.save('math-quiz', finalScore).then(function (r) {
        finalNoteEl.textContent = r ? '✅ Score save ho gaya' : '❌ Score save nahi hua, login check karo';
      });
    }
  }

  startBtn.addEventListener('click', newGame);
  againBtn.addEventListener('click', newGame);

  // ================= Loop =================
  var last = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;

    if (state === 'play') {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        timeEl.textContent = fmt(0);
        finish();
      } else {
        timeEl.textContent = fmt(timeLeft);
        if (timeLeft <= 10) timeEl.parentNode.classList.add('low');

        // jawab de do ya na do, agla sawal TAB hi aayega jab 3 second poore ho jayein
        qLeft -= dt;
        if (qLeft <= 0) showQuestion(true);
        qbarEl.style.width = Math.max(0, qLeft / CONFIG.QUESTION_TIME) * 100 + '%';
      }
    }
    requestAnimationFrame(frame);
  }

  //@HOOK
  requestAnimationFrame(function (t) { last = t; frame(t); });
})();
