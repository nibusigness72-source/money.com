// leader-data.js  -  Leaderboard mein Firebase ka asli data dikhane wali file
//
// Kaise kaam karti hai:
//  1. Login user ke apne point (users/<uid>/stats) ko public "board/<uid>" mein copy karti hai
//     (phone number copy NAHI hota, sirf naam, ID aur point).
//  2. "board" se sabke Daily / Weekly / Monthly point padhkar list banati hai.
//  3. Sirf wahi point gine jaate hain jinki "key" abhi ke din/hafte/mahine se match karti hai
//     (subah 8 baje naya din - score.js ke hisaab se), isliye purane point apne aap hat jaate hain.
//
// Ye file leaderboard.js ke BAAD lagani hai. Ye purani nakli list ki jagah asli list laga deti hai.
(function () {
  var db = firebase.database();
  var MAP = { daily: 'day', weekly: 'week', monthly: 'month' };
  var real = { daily: [], weekly: [], monthly: [] };
  var myUid = null;
  var message = 'Loading...';

  // leaderboard.js ka nakli data hata do, asli data do
  window.getPlayers = function (period) { return real[period] || []; };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // leaderboard.js ke render jaisa hi, bas asli data + khali/loading message ke saath
  window.render = function () {
    var list = document.querySelector('.list');
    var data = getPlayers(state.period).slice(0, state.count);
    var html = '';

    if (!data.length) {
      list.innerHTML = '<div style="padding:30px 10px;text-align:center;color:#9fb0d9;">' +
        esc(message === 'ok' ? 'Abhi koi player nahi. Game khelo aur pehle bano!' : message) + '</div>';
      return;
    }

    data.forEach(function (p, i) {
      var rank = i + 1, cls = 'row', rankHtml = rank;
      if (rank === 1) { cls += ' gold';   rankHtml = '<span class="crown">👑</span>'; }
      if (rank === 2) { cls += ' silver'; rankHtml = '<span class="crown">👑</span>'; }
      if (rank === 3) { cls += ' bronze'; rankHtml = '<span class="crown">👑</span>'; }
      html +=
        '<div class="' + cls + '">' +
          '<span class="c-rank">' + rankHtml + '</span>' +
          '<span class="c-player"><i class="avatar">🧑</i>' + esc(p.name) + (p.me ? ' (You)' : '') + '</span>' +
          '<span class="c-points">' + fmt(p.points) + '</span>' +
          '<span class="c-reward">' + rewardFor(state.period, rank) + '</span>' +
        '</div>';
    });
    list.innerHTML = html;
  };

  function showError(e) {
    var code = (e && (e.code || e.message)) || e;
    message = 'Leaderboard load nahi hua (' + code + ')';
    render();
  }

  // Apna data public board mein daalo
  function publishMine(user) {
    var ref = db.ref('users/' + user.uid);
    return ref.once('value').then(function (snap) {
      var d = snap.val() || {}, st = d.stats;
      if (!st) return;
      return db.ref('board/' + user.uid).set({
        name: d.name || '', playerId: d.playerId || '',
        day: st.day || null, week: st.week || null, month: st.month || null,
        updated: firebase.database.ServerValue.TIMESTAMP
      });
    });
  }

  function load() {
    return db.ref('.info/serverTimeOffset').once('value').then(function (o) {
      var k = PWScore.keys(Date.now() + (o.val() || 0));
      return db.ref('board').once('value').then(function (snap) {
        var all = snap.val() || {};
        Object.keys(MAP).forEach(function (period) {
          var f = MAP[period], arr = [];
          Object.keys(all).forEach(function (uid) {
            var e = all[uid], cur = e && e[f];
            if (!cur || cur.key !== k[f] || !(cur.points > 0)) return;
            arr.push({
              name: e.name || ('Player' + String(e.playerId || uid).slice(-4)),
              points: cur.points,
              me: uid === myUid
            });
          });
          arr.sort(function (a, b) { return b.points - a.points; });
          real[period] = arr.slice(0, 100);
        });
        message = 'ok';
        render();
      });
    });
  }

  render();   // pehle "Loading..." dikhao

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) { message = 'Leaderboard dekhne ke liye pehle login karo.'; render(); return; }
    myUid = user.uid;
    publishMine(user).catch(function () {}).then(load).catch(showError);
  });

  window.PWLeader = { publish: publishMine, reload: load };
})();
