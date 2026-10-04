// leaderboard.js
// Ab yeh FAKE/random data nahi, Firebase ke asli users/ data se Daily/Weekly/Monthly
// leaderboard banata hai, real-time (jaise hi kisi ka score badlega, list khud-ba-khud update hogi)

var state = { period: 'monthly', count: 10 };

// Sirf inaam (reward) table — fake players banane ke liye nahi, sirf ₹ dikhane ke liye
var config = {
  monthly: { rewards: [100000, 50000, 25000, 15000, 10000, 7500, 5000, 3000, 2000, 1000], mid: 500 },
  weekly:  { rewards: [25000, 12000, 6000, 4000, 2500, 2000, 1500, 1000, 750, 500], mid: 200 },
  daily:   { rewards: [5000, 2500, 1200, 800, 500, 400, 300, 200, 150, 100], mid: 50 }
};

var avatars = ['🧑', '👩', '🧔'];

var allPlayers = [];      // current period ke hisaab se sorted, sabhi real users
var myRankData = null;    // login kiye hue user ka apna rank + score
var latestUsersSnapshot = null;

function fmt(n) {
  return (n || 0).toLocaleString('en-IN');
}

function rewardFor(period, rank) {
  var cfg = config[period];
  if (rank <= 10) return '₹ ' + fmt(cfg.rewards[rank - 1]);
  if (rank <= 50) return '₹ ' + fmt(cfg.mid);
  return '-';
}

// UID se hamesha wahi avatar (random nahi badlega)
function avatarFor(uid) {
  var sum = 0;
  for (var i = 0; i < uid.length; i++) sum += uid.charCodeAt(i);
  return avatars[sum % avatars.length];
}

function nameFor(uid, data) {
  if (data.name) return data.name;
  if (data.playerId) return 'Player' + data.playerId;
  return 'Player' + uid.slice(0, 5);
}

// score.js ke stats.day/week/month se, sirf CURRENT period ka point nikalo
// (agar key match nahi karti, matlab purana data hai, is period mein 0 point)
function pointsForPeriod(data, period, k) {
  var st = (data.stats || {})[period];
  if (st && st.key === k[period]) return st.points || 0;
  return 0;
}

function buildPlayers(usersObj, period, k) {
  var list = [];
  Object.keys(usersObj || {}).forEach(function (uid) {
    var data = usersObj[uid] || {};
    list.push({
      uid: uid,
      name: nameFor(uid, data),
      avatar: avatarFor(uid),
      points: pointsForPeriod(data, period, k)
    });
  });
  // Sirf wahi dikhao jinke is period mein kam se kam 1 point hai
  list = list.filter(function (p) { return p.points > 0; });
  list.sort(function (a, b) { return b.points - a.points; });
  return list;
}

function render() {
  var list = document.querySelector('.list');
  var data = allPlayers.slice(0, state.count);
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

  if (!data.length) {
    html = '<div class="empty-msg">Is period mein abhi tak koi score nahi hai</div>';
  }

  list.innerHTML = html;
  renderMyRank();
}

// Neeche wali sticky "Apna Rank" bar bharo
function renderMyRank() {
  var bar = document.getElementById('myRankBar');
  if (!bar) return;

  if (!myRankData) {
    bar.innerHTML = '<span class="my-rank-msg">Login karke khelo, yahan apna rank dikhega</span>';
    return;
  }

  bar.innerHTML =
    '<span class="c-rank">' + myRankData.rank + '</span>' +
    '<span class="c-player"><i class="avatar">' + myRankData.avatar + '</i>' + myRankData.name + ' (Aap)</span>' +
    '<span class="c-points">' + fmt(myRankData.points) + '</span>' +
    '<span class="c-reward">' + rewardFor(state.period, myRankData.rank) + '</span>';
}

function computeMyRank(uid) {
  if (!uid) { myRankData = null; return; }
  var idx = -1;
  for (var i = 0; i < allPlayers.length; i++) {
    if (allPlayers[i].uid === uid) { idx = i; break; }
  }
  if (idx === -1) { myRankData = null; return; }
  myRankData = {
    rank: idx + 1,
    name: allPlayers[idx].name,
    avatar: allPlayers[idx].avatar,
    points: allPlayers[idx].points
  };
}

function setActive(buttons, clicked) {
  buttons.forEach(function (b) { b.classList.remove('active'); });
  clicked.classList.add('active');
}

// Firebase ka naya data aate hi (ya tab/period badalte hi) sort+render dobara karo
function refreshFromCache() {
  if (!latestUsersSnapshot) return;
  var k = (window.PWScore && PWScore.keys) ? PWScore.keys(Date.now()) : { day: '', week: '', month: '' };
  allPlayers = buildPlayers(latestUsersSnapshot, state.period, k);
  var myUid = (firebase.auth().currentUser) ? firebase.auth().currentUser.uid : null;
  computeMyRank(myUid);
  render();
}

// Daily / Weekly / Monthly tabs
var periodBtns = document.querySelectorAll('.tab');
periodBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    state.period = btn.textContent.trim().toLowerCase();
    setActive(periodBtns, btn);
    refreshFromCache();
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

// 🔥 Real-time: Firebase ke 'users' mein kisi ka bhi score badlega, list khud-ba-khud refresh hogi
firebase.database().ref('leaderboard').on('value', function (snap) {
  latestUsersSnapshot = snap.val() || {};
  refreshFromCache();
});

// Login/Logout hone par bhi "Apna Rank" turant update ho
firebase.auth().onAuthStateChanged(function () {
  refreshFromCache();
});
