// referral-core.js - Refer & Earn ka dimaag
//   1) har user ka apna referral code banana
//   2) naya dost link se aaye to usse jodna (ek phone number par sirf ek baar)
//   3) dost kitna khela (sirf apne account se) ginna
//   4) dost ke PLAY_MINUTES poore hone par referrer ko REWARD_POINTS dena (ek dost ke liye ek hi baar)
//
// Firebase mein ye jagah use hoti hain:
//   refCodes/<CODE>                       = jis user ka code hai uska uid
//   users/<uid>/refCode                   = us user ka apna code
//   users/<uid>/referredBy                = {uid, code, t}  (dost ko kisne bheja)
//   referredPhones/<phone-ka-hash>        = ek phone number ek hi baar refer ho sakta hai
//   referrals/<referrer-uid>/<dost-uid>   = {n: naam, t: time, sec: kitne second khela, ready: true/false, paid: kitne point diye}
//   users/<uid>/points , users/<uid>/refPoints = point jodte hain (leaderboard par asar nahi)
(function () {
  var C = window.REF_CONFIG || {};
  var REWARD = C.REWARD_POINTS || 1000;
  var NEED_MIN = C.PLAY_MINUTES || 5;
  var NEED_SEC = NEED_MIN * 60;
  var NEW_HOURS = C.NEW_ACCOUNT_HOURS || 24;
  var CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var db = null;

  function TS() { return firebase.database.ServerValue.TIMESTAMP; }

  // Leaderboard ke liye (score.js ke jaisa hi): din subah 8 baje se badalta hai
  var IST = 5.5 * 3600 * 1000;
  var CUT = 8 * 3600 * 1000;
  var BOARD_CHUNK = 1000;      // leaderboard rule mein ek baar mein max 700 point jud sakte hain (1000 = 700 + 300)

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function boardKeys(ms) {
    var d = new Date(ms + IST - CUT);
    var dow = (d.getUTCDay() + 6) % 7;
    var mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
    return { day: ymd(d), week: ymd(mon), month: d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) };
  }
  function serverNow() {
    return db.ref('.info/serverTimeOffset').once('value').then(function (s) {
      return Date.now() + (s.val() || 0);
    }, function () { return Date.now(); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------- chhota message ----------
  function toast(text, ok) {
    try {
      var el = document.getElementById('pw-ref-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pw-ref-toast';
        el.style.cssText = 'position:fixed;left:50%;bottom:86px;transform:translateX(-50%);max-width:90%;' +
          'padding:10px 14px;border-radius:10px;font:13px/1.4 Arial,sans-serif;color:#fff;z-index:99999;' +
          'text-align:center;pointer-events:none;';
        document.body.appendChild(el);
      }
      el.style.background = ok === false ? '#b91c1c' : '#15803d';
      el.textContent = text;
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 5000);
    } catch (e) {}
  }

  // ---------- Firebase tayyar hone tak ruko ----------
  function whenReady(cb) {
    var tries = 0;
    (function check() {
      if (window.firebase && firebase.apps && firebase.apps.length && firebase.auth && firebase.database) {
        db = firebase.database();
        cb();
        return;
      }
      if (++tries > 100) return;          // 20 second baad haar maan lo
      setTimeout(check, 200);
    })();
  }

  // ---------- Login wala user milne tak ruko (8 second tak) ----------
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
      }, 8000);
    });
  }

  // Phone number seedha nahi, uska hash rakhte hain (privacy)
function phoneKey(user) {
    var digits = String(user.phoneNumber || '').replace(/\D/g, '');
    var ident = digits || (user.email ? 'g' + String(user.email).toLowerCase() : '');
    if (!ident) return Promise.resolve('');
    try {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode('pw|' + ident)).then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ('0' + b.toString(16)).slice(-2);
          }).join('').slice(0, 40);
        });
      }
    } catch (e) {}
    return Promise.resolve('p' + ident.replace(/[^a-z0-9]/gi, ''));
}

  function minutesText(m) {
    m = m || NEED_MIN;
    return (m >= 60 && m % 60 === 0) ? (m / 60) + (m === 60 ? ' hour' : ' hours') : m + ' minutes';
  }

  // ---------- 1) Apna referral code (pehli baar banega, phir wahi rahega) ----------
  function ensureCode(user) {
    var uref = db.ref('users/' + user.uid + '/refCode');
    return uref.once('value').then(function (s) {
      if (s.val()) return s.val();

      function attempt(n) {
        if (n > 10) return Promise.reject(new Error('code nahi ban paya'));
        var code = 'PW';
        for (var i = 0; i < 6; i++) code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        return db.ref('refCodes/' + code).transaction(function (cur) {
          return cur ? undefined : user.uid;          // code pehle se kisi ka ho to naya try
        }).then(function (r) {
          if (!r.committed) return attempt(n + 1);
          return uref.set(code).then(function () { return code; });
        });
      }
      return attempt(1);
    });
  }

  // ---------- Invite link ----------
  function link(code) {
    var base = C.BASE_URL;
    if (!base) base = location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + 'login.html?ref=' + code;
  }

  // ---------- 2) Naya dost: link ka code lagao ----------
  // Wapas milta hai: none | applied | old-account | already | badcode | phone-used | nophone
  function applyPending(user) {
    var code = '';
    try { code = localStorage.getItem('pw_ref') || ''; } catch (e) {}
    if (!code) return Promise.resolve('none');

    function clear() { try { localStorage.removeItem('pw_ref'); } catch (e) {} }

    var created = Date.parse(user.metadata && user.metadata.creationTime);
    if (!created || Date.now() - created > NEW_HOURS * 3600 * 1000) {
      clear();
      return Promise.resolve('old-account');              // purane account par referral nahi lagta
    }

    return phoneKey(user).then(function (pk) {
      if (!pk) return 'nophone';

      return db.ref('users/' + user.uid + '/referredBy').once('value').then(function (s) {
        if (s.val()) { clear(); return 'already'; }

        return db.ref('refCodes/' + code).once('value').then(function (c) {
          var refUid = c.val();
          if (!refUid || refUid === user.uid) { clear(); return 'badcode'; }   // galat code ya apna hi code

          // Ek phone number ek hi baar: pehle se hai to yahin ruk jao
          return db.ref('referredPhones/' + pk).transaction(function (cur) {
            return cur ? undefined : { uid: user.uid, t: TS() };
          }).then(function (r) {
            if (!r.committed) { clear(); return 'phone-used'; }

            return db.ref('users/' + user.uid + '/name').once('value').then(function (nm) {
              var name = String(nm.val() || 'Player').slice(0, 20);
              var up = {};
              up['users/' + user.uid + '/referredBy'] = { uid: refUid, code: code, t: TS() };
              up['referrals/' + refUid + '/' + user.uid] = { n: name, t: TS(), sec: 0, ready: false };
              return db.ref().update(up);
            }).then(function () { clear(); return 'applied'; });
          });
        });
      });
    });
  }

  function statusText(st) {
    if (st === 'applied') return '🎁 Referral lag gaya! ' + minutesText() + ' khelo, aapke dost ko ' + REWARD + ' points milenge.';
    if (st === 'phone-used') return 'Is number par referral pehle hi lag chuka hai, dobara nahi lagega.';
    if (st === 'old-account') return 'Referral sirf naye account par lagta hai.';
    if (st === 'badcode') return 'Referral code galat hai.';
    return '';
  }

  // ---------- 3) Dost ka khelne ka time ginna (sirf game pages par chalta hai) ----------
  function startPlayTimer(user) {
    db.ref('users/' + user.uid + '/referredBy').once('value').then(function (s) {
      var rb = s.val();
      if (!rb || !rb.uid) return;                                   // ye user kisi ke refer se nahi aaya

      var eref = db.ref('referrals/' + rb.uid + '/' + user.uid);
      eref.once('value').then(function (es) {
        var e = es.val();
        if (!e || e.ready) return;                                  // pehle hi poora ho chuka

        var pending = 0, done = false, lastAct = Date.now(), saved = e.sec || 0;

        ['pointerdown', 'pointermove', 'touchstart', 'mousedown', 'keydown'].forEach(function (ev) {
          window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true });
        });

        function flush() {
          if (done || pending <= 0) return;
          var add = pending;
          pending = 0;
          eref.child('sec').transaction(function (cur) {
            return Math.min(NEED_SEC, (cur || 0) + add);
          }).then(function (r) {
            saved = r.snapshot.val() || 0;
            if (saved >= NEED_SEC && !done) {
              done = true;
              return eref.child('ready').set(true);
            }
          }).catch(function () { pending += add; });                // nahi gaya to agli baar phir koshish
        }

        // Har second: page dikh raha ho aur pichhle 15 second mein tap/swipe hua ho tabhi gino
        setInterval(function () {
          if (done) return;
          if (!document.hidden && Date.now() - lastAct < 15000) pending++;
          if (pending >= 10 || saved + pending >= NEED_SEC) flush();
        }, 1000);

        document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
        window.addEventListener('pagehide', flush);
      });
    });
  }

  // ---------- 4) Dost ke minute poore hue to referrer ko point do (ek dost ke liye ek hi baar) ----------
  // Point 3 jagah jaate hain: kul points, aaj/hafta/mahina ke stats, aur LEADERBOARD (din/hafta/mahina ke hisaab se, wahi khatam)

  // Din/hafta/mahina ke stats mein point jodo (score.js jaisa). k = point milne ke samay ki chaabiyan
  function addStats(user, amt, k) {
    return db.ref('users/' + user.uid + '/stats').transaction(function (s) {
      s = s || {};
      ['day', 'week', 'month'].forEach(function (p) {
        var cur = s[p];
        if (!cur || cur.key !== k[p]) cur = { key: k[p], points: 0 };
        cur.points = (cur.points || 0) + amt;
        s[p] = cur;
      });
      s.updated = TS();
      return s;
    });
  }

  // Leaderboard mein jodne ke liye "baaki" mein likho.
  // Point jis din/hafte/mahine mein mila, usi ki chaabi ke saath likhte hain:
  //   refBoardPending/day/2026-10-04 = 1000   -> sirf 4 Oct ke daily board mein jayega
  //   refBoardPending/week/2026-09-28 = 1000  -> sirf us hafte ke weekly board mein
  //   refBoardPending/month/2026-10 = 1000    -> sirf October ke monthly board mein
  // Isliye din/hafta/mahina badalte hi wo point apne aap leaderboard se hat jaate hain (live-board.js sirf aaj ki chaabi dikhata hai).
  function queueBoard(user, amt, k) {
    return db.ref('users/' + user.uid + '/refBoardPending').transaction(function (cur) {
      cur = cur || {};
      ['day', 'week', 'month'].forEach(function (kind) {
        var v = cur[kind];
        if (typeof v === 'number') {                       // purana tareeka: sirf ginti thi
          var o = {};
          if (v > 0) o[k[kind]] = v;
          v = o;
        }
        v = v || {};
        v[k[kind]] = (v[k[kind]] || 0) + amt;
        cur[kind] = v;
      });
      return cur;
    });
  }

  function creditPoints(user, amt) {
    var base = 'users/' + user.uid;
    return serverNow().then(function (now) {
      var k = boardKeys(now);
      return Promise.all([
        db.ref(base + '/points').transaction(function (c) { return (c || 0) + amt; }),
        db.ref(base + '/refPoints').transaction(function (c) { return (c || 0) + amt; }),
        addStats(user, amt, k),
        queueBoard(user, amt, k)
      ]);
    });
  }

  // Ek board (kind + key) mein baaki point likho; 700 se zyada ho to 13 second ruk ruk kar
  function drainKind(user, kind, key, name, pending, tries) {
    if (pending <= 0) return Promise.resolve();
    var chunk = Math.min(pending, BOARD_CHUNK);

    return db.ref('board/' + kind + '/' + key + '/' + user.uid).transaction(function (cur) {
      var old = (cur && cur.p) || 0;
      return { n: name, p: old + chunk, t: TS() };
    }).then(function (r) {
      if (!r.committed) return pending;
      return db.ref('users/' + user.uid + '/refBoardPending/' + kind + '/' + key).transaction(function (c) {
        var left = (c || 0) - chunk;
        return left > 0 ? left : null;                    // 0 ho gaya to line hi hata do
      }).then(function () { return pending - chunk; });
    }).then(function (left) {
      if (left > 0) return wait(13000).then(function () { return drainKind(user, kind, key, name, left, 0); });
    }, function (e) {
      // Leaderboard rule: 2 write ke beech 12 second chahiye. Thoda ruk kar dobara koshish.
      if ((tries || 0) < 2) return wait(13000).then(function () { return drainKind(user, kind, key, name, pending, (tries || 0) + 1); });
      console.error('leaderboard mein point nahi gaye (agli baar phir koshish hogi)', kind, key, e);
    });
  }

  var draining = false;
  function drainBoard(user) {
    if (draining) return Promise.resolve();
    draining = true;
    return db.ref('users/' + user.uid + '/refBoardPending').once('value').then(function (s) {
      var p = s.val() || {};
      var jobs = [];
      ['day', 'week', 'month'].forEach(function (kind) {
        var v = p[kind];
        if (!v || typeof v !== 'object') return;           // purane tareeke ki ginti: claim/queue use sudhaar dega
        Object.keys(v).forEach(function (key) {
          if (v[key] > 0) jobs.push({ kind: kind, key: key, amt: v[key] });
        });
      });
      if (!jobs.length) return;
      return db.ref('users/' + user.uid + '/name').once('value').then(function (nm) {
        var name = String(nm.val() || 'Player').slice(0, 30);
        return Promise.all(jobs.map(function (j) {
          return drainKind(user, j.kind, j.key, name, j.amt, 0);
        }));
      });
    }).catch(function (e) { console.error('drainBoard', e); })
      .then(function () { draining = false; });
  }

  // Ek baar (sirf pehli baar): jo referral point leaderboard system se pehle mil chuke the unhe "aaj" mein jod do.
  // Flag (refBoardInit) pehli baar hi lag jata hai, chahe purane point ho ya na ho,
  // taaki baad mein naye system se mile point dobara na jud jaayein.
  function migrateOld(user, entries) {
    return db.ref('users/' + user.uid + '/refBoardInit').transaction(function (c) {
      return c ? undefined : true;
    }).then(function (r) {
      if (!r.committed) return;                              // pehle ho chuka
      var old = 0;
      Object.keys(entries || {}).forEach(function (id) {
        var e = entries[id];
        if (e && e.paid) old += Number(e.paid) || 0;
      });
      if (old <= 0) return;
      return serverNow().then(function (now) {
        var k = boardKeys(now);
        return Promise.all([addStats(user, old, k), queueBoard(user, old, k)]);
      });
    });
  }

  function claim(user, entries) {
    var ids = Object.keys(entries || {}).filter(function (id) {
      var e = entries[id];
      return e && e.ready === true && !e.paid;
    });

    var total = 0;
    return migrateOld(user, entries).catch(function (e) { console.error('migrate', e); }).then(function () {
      return ids.reduce(function (chain, id) {
        return chain.then(function () {
          return db.ref('referrals/' + user.uid + '/' + id + '/paid').transaction(function (cur) {
            return cur ? undefined : REWARD;                        // pehle se paid ho to dobara nahi
          }).then(function (r) {
            if (!r.committed) return;
            return creditPoints(user, REWARD).then(function () {
              total += REWARD;
              db.ref('users/' + user.uid + '/history').push({    // history ke liye: dost ka naam, point, kab
                type: 'referral', points: REWARD, from: String((entries[id] && entries[id].n) || 'Dost').slice(0, 20), time: TS()
              }).catch(function (e) { console.warn('history likhna fail', e); });
              toast('🎉 Dost ne ' + minutesText() + ' khel liye! +' + REWARD + ' points mile.');
            });
          });
        });
      }, Promise.resolve());
    }).catch(function (e) { console.error('referral claim fail', e); })
      .then(function () { return drainBoard(user); })               // leaderboard mein bhi jodo
      .then(function () { return total; });
  }

  window.PWRef = {
    config: { REWARD_POINTS: REWARD, PLAY_MINUTES: NEED_MIN, NEED_SEC: NEED_SEC, NEW_ACCOUNT_HOURS: NEW_HOURS },
    whenReady: whenReady, waitForUser: waitForUser, drainBoard: drainBoard, ensureCode: ensureCode, link: link,
    applyPending: applyPending, statusText: statusText, claim: claim,
    minutesText: minutesText, toast: toast
  };

  // ---------- Page ke hisaab se apne aap chalne wala kaam ----------
  setTimeout(function () {
    var onReferralPage = !!document.getElementById('shareBtn');     // referral.js ye khud sambhalta hai
    if (onReferralPage) return;

    whenReady(function () {
      waitForUser().then(function (user) {
        if (!user) return;

        if (window.PWScore) {                                       // game page: khelne ka time ginna
          startPlayTimer(user);
          return;
        }

        // Home jaisa koi aur page: referral lagao, phir pending points lo
        applyPending(user).then(function (st) {
          var msg = statusText(st);
          if (msg) toast(msg, st === 'applied');
          return db.ref('referrals/' + user.uid).once('value');
        }).then(function (snap) {
          return claim(user, snap.val());
        }).catch(function (e) { console.error('referral error', e); });
      });
    });
  }, 0);
})();
