// score.js  -  Sabhi games ke point ek hi jagah se save karne wali file
//
// Har game ke ant mein sirf ek line likhni hai:
//     PWScore.save('game-ka-naam', score);
//
// Ye Firebase mein (users/<uid>/...) ye sab save karti hai:
//   points                      -> ab tak ke kul point (sab game milakar)
//   stats/games/<game>          -> us game ka best, last, plays, total
//   stats/day                   -> aaj ke kul point   (subah 8 baje se agle din subah 8 baje tak)
//   stats/week                  -> is hafte ke kul point (Somwar subah 8 baje se agle Somwar subah 8 baje tak)
//   stats/month                 -> is mahine ke kul point (1 tarikh subah 8 baje se agle mahine ki 1 tarikh subah 8 baje tak)
(function () {
  var IST = 5.5 * 3600 * 1000;   // India ka samay (UTC se aage)
  var CUT = 8 * 3600 * 1000;     // naya din subah 8 baje shuru hota hai

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }

  // Server ka samay (phone ki ghadi badalne se kuch nahi hoga)
  function serverNow() {
    try {
      return firebase.database().ref('.info/serverTimeOffset').once('value').then(function (s) {
        return Date.now() + (s.val() || 0);
      }, function () { return Date.now(); });
    } catch (e) {
      return Promise.resolve(Date.now());
    }
  }

  // Samay se aaj / hafta / mahina ki "chaabi" (key) nikalo.
  // Trick: samay mein se 8 ghante ghata do, to subah 8 baje hi raat ke 12 baje ban jaate hain.
  function keys(ms) {
    var d = new Date(ms + IST - CUT);
    var dow = (d.getUTCDay() + 6) % 7;                                   // Somwar = 0
    var mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
    return {
      day: ymd(d),                                                        // jaise 2026-10-03
      week: ymd(mon),                                                     // us hafte ke Somwar ki tarikh
      month: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1)          // jaise 2026-10
    };
  }

  // Ek play ke baad stats mein naye point jodo (naye din/hafte/mahine par apne aap 0 se shuru)
  function addToStats(s, game, pts, k) {
    s = s || {};
    s.games = s.games || {};
    var g = s.games[game] || { best: 0, last: 0, plays: 0, total: 0 };
    g.best = Math.max(g.best || 0, pts);
    g.last = pts;
    g.plays = (g.plays || 0) + 1;
    g.total = (g.total || 0) + pts;
    s.games[game] = g;
    ['day', 'week', 'month'].forEach(function (p) {
      var cur = s[p];
      if (!cur || cur.key !== k[p]) cur = { key: k[p], points: 0 };
      cur.points = (cur.points || 0) + pts;
      s[p] = cur;
    });
    s.updated = firebase.database.ServerValue.TIMESTAMP;
    return s;
  }

  // game = game ka naam (jaise 'knife-hit'), pts = is baar ke point
  // Wapas milta hai: { total, day, week, month } ya login na ho to false
  function save(game, pts) {
    pts = Math.max(0, Math.floor(+pts || 0));
    var user = firebase.auth().currentUser;
    if (!user) return Promise.resolve(false);
    var base = firebase.database().ref('users/' + user.uid);

    return serverNow().then(function (now) {
      var k = keys(now);
      return Promise.all([
        base.child('stats').transaction(function (s) { return addToStats(s, game, pts, k); }),
        base.child('points').transaction(function (c) { return (c || 0) + pts; })
      ]).then(function (res) {
        var st = res[0].snapshot.val() || {};
        return {
          total: res[1].snapshot.val() || 0,
          day: st.day ? st.day.points : 0,
          week: st.week ? st.week.points : 0,
          month: st.month ? st.month.points : 0
        };
      });
    }).catch(function (e) {
      console.error('PWScore.save fail:', e);
      return false;
    });
  }

  window.PWScore = { save: save, keys: keys };
})();