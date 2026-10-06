// live-board.js - ASLI leaderboard: database se sabke points, upar se niche tak
// Ye purani leaderboard.js (nakli naam wali) ki jagah chalti hai.

var state = { period: 'monthly', count: 10 };
var MAP = { daily: 'day', weekly: 'week', monthly: 'month' };

// Inaam (reward) rank ke hisaab se - pehle jaisa hi
var config = {
  monthly: { rewards: [100000, 50000, 25000, 15000, 10000, 7500, 5000, 3000, 2000, 1000], mid: 500 },
  weekly:  { rewards: [25000, 12000, 6000, 4000, 2500, 2000, 1500, 1000, 750, 500],       mid: 200 },
  daily:   { rewards: [5000, 2500, 1200, 800, 500, 400, 300, 200, 150, 100],              mid: 50 }
};

var user = null;
var authReady = false;
var reqId = 0;

function fmt(n) {
  return (n || 0).toLocaleString('en-IN');
}

function rewardFor(period, rank) {
  var cfg = config[period];
  if (rank <= 10) return '₹ ' + fmt(cfg.rewards[rank - 1]);
  if (rank <= 50) return '₹ ' + fmt(cfg.mid);
  return '-';
}

function message(text) {
  var list = document.querySelector('.list');
  list.innerHTML = '';
  var d = document.createElement('div');
  d.style.cssText = 'padding:24px 12px;text-align:center;color:#9fb0d9;font-size:14px;';
  d.textContent = text;
  list.appendChild(d);
}

function render(rows) {
  var list = document.querySelector('.list');
  list.innerHTML = '';

  if (!rows.length) {
    message('Abhi koi player nahi, pehle game khelo!');
    return;
  }

  rows.forEach(function (p, i) {
    var rank = i + 1;
    var cls = 'row';
    var rankHtml = rank;

    if (rank === 1) { cls += ' gold';   rankHtml = '<span class="crown">👑</span>'; }
    if (rank === 2) { cls += ' silver'; rankHtml = '<span class="crown">👑</span>'; }
    if (rank === 3) { cls += ' bronze'; rankHtml = '<span class="crown">👑</span>'; }

    var row = document.createElement('div');
    row.className = cls;
    row.innerHTML =
      '<span class="c-rank">' + rankHtml + '</span>' +
      '<span class="c-player"><i class="avatar">🧑</i><span class="nm"></span></span>' +
      '<span class="c-points">' + fmt(p.points) + '</span>' +
      '<span class="c-reward">' + rewardFor(state.period, rank) + '</span>';
    row.querySelector('.nm').textContent = (p.name || 'Player') + (p.me ? ' (Aap)' : '');
    row.dataset.uid = p.uid || '';
    list.appendChild(row);
  });
}

// quiet = true to "Load ho raha hai" nahi dikhata (apne aap refresh ke waqt)
function load(quiet) {
  if (!authReady) return;
  if (!user) {
    message('Leaderboard dekhne ke liye login karo');
    return;
  }

  var kind = MAP[state.period];
  var key = PWScore.keys(Date.now())[kind];
  var my = ++reqId;
  if (!quiet) message('');

  firebase.database().ref('board/' + kind + '/' + key)
    .orderByChild('p').limitToLast(state.count).once('value')
    .then(function (snap) {
      if (my !== reqId) return;
      var rows = [];
      snap.forEach(function (c) {
        var v = c.val() || {};
        rows.push({ name: v.n, points: v.p, uid: c.key, me: c.key === user.uid });
      });
      rows.reverse();
      render(rows);
    })
    .catch(function (e) {
      console.error('Leaderboard nahi aaya', e);
      if (my === reqId) message('Leaderboard nahi aaya. Database Rules check karo.');
    });
}

firebase.auth().onAuthStateChanged(function (u) {
  user = u;
  authReady = true;
  load();
});

function setActive(buttons, clicked) {
  buttons.forEach(function (b) { b.classList.remove('active'); });
  clicked.classList.add('active');
}

// Daily / Weekly / Monthly tabs
var periodBtns = document.querySelectorAll('.tab');
periodBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    state.period = btn.textContent.trim().toLowerCase();
    setActive(periodBtns, btn);
    load();
  });
});

// Top 10 / Top 50 / Top 100 tabs
var topBtns = document.querySelectorAll('.top-tab');
topBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    state.count = parseInt(btn.textContent.replace(/\D/g, ''), 10);
    setActive(topBtns, btn);
    load();
  });
});

// Har 30 second mein list apne aap naya ho jaati hai
setInterval(function () { load(true); }, 30000);
