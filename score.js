// score.js  v2  -  Sabhi games ke point ek hi jagah se save karne wali file
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
//
// v2: save hone par neeche ek chhota message dikhta hai (hara = save hua, laal = nahi hua + wajah).
(function () {
  var VERSION = 'v3';
  var IST = 5.5 * 3600 * 1000;   // India ka samay (UTC se aage)
  var CUT = 8 * 3600 * 1000;     // naya din subah 8 baje shuru hota hai

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }

  // Screen par chhota message (hara = theek, laal = galti)
  function toast(ok, text) {
    try {
      var el = document.getElementById('pw-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pw-toast';
        el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:90%;' +
          'padding:10px 14px;border-radius:10px;font:13px/1.4 Arial,sans-serif;color:#fff;z-index:99999;' +
          'text-align:center;pointer-events:none;';
        document.body.appendChild(el);
      }
      el.style.background = ok ? '#15803d' : '#b91c1c';
      el.textContent = text;
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, ok ? 4000 : 15000);
    } catch (e) {}
  }

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

  // Login wala user milne tak (zyada se zyada 5 second) ruko
  function waitForUser() {
    var a = firebase.auth();
    if (a.currentUser) return Promise.resolve(a.currentUser);
    return new Promise(function (resolve) {
      var done = false, off = function () {};
      off = a.onAuthStateChanged(function (u) {
        if (done || !u) return;
        done = true; off(); resolve(u);
      });
      setTimeout(function () {
        if (done) return;
        done = true;
        try { off(); } catch (e) {}
        resolve(null);
      }, 5000);
    });
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

  // Leaderboard ke liye: sirf naam aur point (phone ya photo nahi)
  // public "board" mein likho
  function writeBoard(user, k, pts) {
    var db = firebase.database();
    var uid = user.uid;
    var TS = firebase.database.ServerValue.TIMESTAMP;
    db.ref('users/' + uid + '/name')
      .once('value')
      .then(function (s) {
        var name = String(s.val() || 'Player');
        name = name.slice(0, 30);
        var list = [
          ['day', k.day],
          ['week', k.week],
          ['month', k.month]
        ];
        list.forEach(function (x) {
          var path = 'board/' + x[0];
          path += '/' + x[1] + '/' + uid;
          db.ref(path).transaction(function (cur) {
            var old = (cur && cur.p) || 0;
            return { n: name, p: old + pts, t: TS };
          });
        });
      })
      .catch(function (e) {
        console.error('board write fail', e);
      });
  }

  // game = game ka naam (jaise 'knife-hit'), pts = is baar ke point
  // Wapas milta hai: { total, day, week, month } ya save na ho paye to false
  function save(game, pts) {
    pts = Math.max(0, Math.floor(+pts || 0));
    if (!window.firebase || !firebase.auth || !firebase.database) {
      toast(false, '❌ ' + game + ': Firebase load nahi hua (score.js ' + VERSION + ')');
      return Promise.resolve(false);
    }

    return waitForUser().then(function (user) {
      if (!user) {
        toast(false, '❌ ' + game + ': save nahi hua, login nahi mila. Pehle login karo.');
        return false;
      }
      var base = firebase.database().ref('users/' + user.uid);

      return serverNow().then(function (now) {
        var k = keys(now);
        return Promise.all([
          base.child('stats').transaction(function (s) { return addToStats(s, game, pts, k); }),
          base.child('points').transaction(function (c) { return (c || 0) + pts; })
        ]).then(function (res) {
          var st = res[0].snapshot.val() || {};
          var out = {
            total: res[1].snapshot.val() || 0,
            day: st.day ? st.day.points : 0,
            week: st.week ? st.week.points : 0,
            month: st.month ? st.month.points : 0
          };
          writeBoard(user, k, pts);
          toast(true, '✅ ' + game + ': +' + pts + ' point save hue (aaj ' + out.day + ')');
          return out;
        });
      });
    }).catch(function (e) {
      console.error('PWScore.save fail:', e);
      toast(false, '❌ ' + game + ': save nahi hua (' + ((e && (e.code || e.message)) || e) + ')');
      return false;
    });
  }

  window.PWScore = { save: save, keys: keys, version: VERSION };
})();
(function () {
  ['referral-config.js', 'referral-core.js'].forEach(function (src) {
    var s = document.createElement('script');
    s.src = src; s.async = false;
    document.head.appendChild(s);
  });
})();