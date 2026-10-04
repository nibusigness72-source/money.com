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
    if (!digits) return Promise.resolve('');
    try {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode('pw|' + digits)).then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ('0' + b.toString(16)).slice(-2);
          }).join('').slice(0, 40);
        });
      }
    } catch (e) {}
    return Promise.resolve('p' + digits);
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
  function claim(user, entries) {
    var ids = Object.keys(entries || {}).filter(function (id) {
      var e = entries[id];
      return e && e.ready === true && !e.paid;
    });

    var total = 0;
    return ids.reduce(function (chain, id) {
      return chain.then(function () {
        return db.ref('referrals/' + user.uid + '/' + id + '/paid').transaction(function (cur) {
          return cur ? undefined : REWARD;                          // pehle se paid ho to dobara nahi
        }).then(function (r) {
          if (!r.committed) return;
          return Promise.all([
            db.ref('users/' + user.uid + '/points').transaction(function (c) { return (c || 0) + REWARD; }),
            db.ref('users/' + user.uid + '/refPoints').transaction(function (c) { return (c || 0) + REWARD; })
          ]).then(function () {
            total += REWARD;
            toast('🎉 Dost ne ' + minutesText() + ' khel liye! +' + REWARD + ' points mile.');
          });
        });
      });
    }, Promise.resolve()).then(function () { return total; })
      .catch(function (e) { console.error('referral claim fail', e); return total; });
  }

  window.PWRef = {
    config: { REWARD_POINTS: REWARD, PLAY_MINUTES: NEED_MIN, NEED_SEC: NEED_SEC, NEW_ACCOUNT_HOURS: NEW_HOURS },
    whenReady: whenReady, waitForUser: waitForUser, ensureCode: ensureCode, link: link,
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
