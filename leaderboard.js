// leaderboard.js
// Daily/Weekly/Monthly aur Top 10/50/100 tabs ke hisaab se list badalti hai

var state = { period: 'monthly', count: 10 };

// Monthly ke pehle 10 players bilkul wahi jo HTML mein hain
var originals = [
  { name: 'RohitKing777', avatar: '🧑', points: 125000 },
  { name: 'QueenGamer',   avatar: '👩', points: 110500 },
  { name: 'XxLegendxX',   avatar: '🧔', points: 98750 },
  { name: 'GamingStar',   avatar: '🧑', points: 87420 },
  { name: 'TechNilesh',   avatar: '🧑', points: 76300 },
  { name: 'ProPlayer',    avatar: '👩', points: 70210 },
  { name: 'FreeFireBoy',  avatar: '🧑', points: 65980 },
  { name: 'SilentKiller', avatar: '🧑', points: 62450 },
  { name: 'NoobMaster',   avatar: '🧑', points: 58760 },
  { name: 'GameChanger',  avatar: '🧑', points: 55320 }
];

var config = {
  monthly: {
    seed: 11, topPoints: 125000, stepMin: 150, stepMax: 600,
    rewards: [100000, 50000, 25000, 15000, 10000, 7500, 5000, 3000, 2000, 1000],
    mid: 500
  },
  weekly: {
    seed: 22, topPoints: 32000, stepMin: 100, stepMax: 300,
    rewards: [25000, 12000, 6000, 4000, 2500, 2000, 1500, 1000, 750, 500],
    mid: 200
  },
  daily: {
    seed: 33, topPoints: 6500, stepMin: 20, stepMax: 90,
    rewards: [5000, 2500, 1200, 800, 500, 400, 300, 200, 150, 100],
    mid: 50
  }
};

var prefixes = ['Pro', 'King', 'Dark', 'Fire', 'Ninja', 'Sniper', 'Rapid', 'Alpha', 'Lucky', 'Turbo'];
var suffixes = ['Gamer', 'Boy', 'Star', 'Killer', 'Master', 'Hero', 'Wolf', 'X', 'Pilot', 'Rider'];
var avatars = ['🧑', '👩', '🧔'];

var cache = {};

// Same seed = same list, isliye tab dubara dabane par list nahi badlegi
function mulberry32(a) {
  return function () {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildPlayers(period) {
  var cfg = config[period];
  var rand = mulberry32(cfg.seed);
  var players = [];
  var pool = [];
  var i, j;

  for (i = 0; i < prefixes.length; i++) {
    for (j = 0; j < suffixes.length; j++) {
      pool.push(prefixes[i] + suffixes[j]);
    }
  }

  // Monthly mein original 10 upar fix, baaki naam mix
  // Daily/Weekly mein original naam bhi pool mein mix ho jaate hain
  if (period !== 'monthly') {
    originals.forEach(function (o) { pool.push(o.name); });
  }

  // Naam shuffle
  for (i = pool.length - 1; i > 0; i--) {
    j = Math.floor(rand() * (i + 1));
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }

  var prev = cfg.topPoints;
  var start = 0;

  if (period === 'monthly') {
    originals.forEach(function (o) { players.push(o); });
    prev = originals[originals.length - 1].points;
    start = originals.length;
  }

  for (i = start; i < 100; i++) {
    if (i > 0) {
      prev = prev - Math.round(cfg.stepMin + rand() * (cfg.stepMax - cfg.stepMin));
    }
    players.push({
      name: pool[i - start],
      avatar: avatars[Math.floor(rand() * avatars.length)],
      points: Math.max(prev, 1)
    });
  }

  return players;
}

function getPlayers(period) {
  if (!cache[period]) {
    cache[period] = buildPlayers(period);
  }
  return cache[period];
}

function fmt(n) {
  return n.toLocaleString('en-IN');
}

function rewardFor(period, rank) {
  var cfg = config[period];
  if (rank <= 10) return '₹ ' + fmt(cfg.rewards[rank - 1]);
  if (rank <= 50) return '₹ ' + fmt(cfg.mid);
  return '-';
}

function render() {
  var list = document.querySelector('.list');
  var data = getPlayers(state.period).slice(0, state.count);
  var html = '';

  data.forEach(function (p, i) {
    var rank = i + 1;
    var cls = 'row';
    var rankHtml = rank;

    if (rank === 1) { cls += ' gold';   rankHtml = '<span class="crown">👑</span>'; }
    if (rank === 2) { cls += ' silver'; rankHtml = '<span class="crown">👑</span>'; }
    if (rank === 3) { cls += ' bronze'; rankHtml = '<span class="crown">👑</span>'; }

    html +=
      '<div class="' + cls + '">' +
        '<span class="c-rank">' + rankHtml + '</span>' +
        '<span class="c-player"><i class="avatar">' + p.avatar + '</i>' + p.name + '</span>' +
        '<span class="c-points">' + fmt(p.points) + '</span>' +
        '<span class="c-reward">' + rewardFor(state.period, rank) + '</span>' +
      '</div>';
  });

  list.innerHTML = html;
}

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
    render();
  });
});

// Top 10 / Top 50 / Top 100 tabs
var topBtns = document.querySelectorAll('.top-tab');
topBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    state.count = parseInt(btn.textContent.replace(/\D/g, ''), 10);
    setActive(topBtns, btn);
    render();
  });
});

render();