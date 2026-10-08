// referral-limit.js  -  NAYI file (purani files nahi badalni). Ye 2 kaam karti hai:
//
//  A) LIFE TIME MEIN SIRF 5 REFERRAL: ek aadmi (jiska code lagta hai) ke 5 dost judne ke baad uska code band.
//
//  B) MOBILE NUMBER PEHLE (sirf Google / email se login wale ke liye, jinka OTP wala number nahi hota):
//     "Kisi dost ka referral code hai?" wale dibbe mein pehle MOBILE NUMBER ka dibba aata hai.
//       - 10 ank, 6/7/8/9 se shuru hona chahiye
//       - agar ye number pehle kabhi referral mein use ho chuka hai (database mein hai) -> referral wala dibba GAYAB
//       - agar number naya hai -> number save, phir referral code wala dibba khulta hai
//     Referral lagte hi ye number hamesha ke liye database (referredPhones) mein chala jata hai, dobara kabhi nahi chalega.
//     OTP se login wale ka number pehle se verified hai, unse dobara number nahi maanga jata.
//
//  Device ki jaanch (Local ID + Fingerprint) alag file referral-device.js mein hai.
//
// Lagana: jahan <script src="referral-core.js"> hai, uske TEEK NEECHE:  <script src="referral-limit.js"></script>
// Asli rok Firebase Rules mein hai (refCount 5 se upar nahi, referredPhones sirf ek baar likha ja sakta hai).
(function () {
  var LIMIT = 5;                         // Rules mein bhi 5 hi hai
  var MOB_RE = /^[6-9]\d{9}$/;           // 10 ank, 6 se 9 tak shuru
  if (!window.firebase || !firebase.apps || !firebase.apps.length || !firebase.database) return;

  var db = firebase.database();
  var proto = Object.getPrototypeOf(db.ref());
  var origOnce = proto.once, origUpdate = proto.update;

  // ---------- chhote madadgaar ----------
  function pathOf(ref) {
    try { return decodeURIComponent(new URL(String(ref.toString())).pathname.replace(/^\//, '')); } catch (e) { return ''; }
  }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function me() { try { return firebase.auth().currentUser; } catch (e) { return null; } }
  function needsMobile(u) { return !!u && !u.phoneNumber; }          // OTP wale ka number pehle se pakka hai
  function say(text) {
    setTimeout(function () { try { window.PWRef.toast(text, false); } catch (e) {} }, 600);   // thodi der baad, purana message dab jaye
  }
  function emptySnap() { return { val: function () { return null; }, exists: function () { return false; } }; }
  function get(path) { return origOnce.call(db.ref(path), 'value'); }
  function countOf(uid) { return get('refCount/' + uid).then(function (s) { return Number(s.val()) || 0; }); }

  // Number ki chaabi: referral-core.js ke phoneKey jaisi hi (taaki OTP wale aur is number ki chaabi ek jaisi ho)
  function keyOf(ident) {
    try {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode('pw|' + ident)).then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 40);
        });
      }
    } catch (e) {}
    return Promise.resolve('p' + ident.replace(/[^a-z0-9]/gi, ''));
  }
  function mobKey(mobile) { return keyOf('91' + mobile); }

  // Is account ne mobile number diya hai? diya hai to kya wo pehle use ho chuka tha?
  function mobState(u) {
    return Promise.all([get('users/' + u.uid + '/mobile'), get('users/' + u.uid + '/refMobile')]).then(function (r) {
      return { mobile: String(r[0].val() || ''), used: r[1].val() === 'used' };
    });
  }

  // ---------- 1) Code lagne se PEHLE ki jaanch ----------
  proto.once = function (type) {
    var m = /^refCodes\/([A-Za-z0-9]+)$/.exec(pathOf(this));
    if (m && type === 'value' && m[1] === ls('pw_ref')) {                // sirf "dost ne abhi code lagaya" wali ghadi
      var code = m[1], u = me();
      return origOnce.apply(this, arguments).then(function (snap) {
        var refUid = snap.val();
        if (!refUid) return snap;
        var step = needsMobile(u) ? mobState(u) : Promise.resolve({ mobile: 'ok', used: false });
        return step.then(function (ms) {
          if (ms.used) { say('Is mobile number par referral pehle hi use ho chuka hai.'); return emptySnap(); }
          if (!ms.mobile) {                                              // mobile number abhi diya hi nahi
            lsSet('pw_ref_hold', code);                                  // code sambhal kar rakh lo
            say('Referral lagane se pehle Referral page par apna mobile number daalo.');
            return emptySnap();
          }
          return countOf(refUid).then(function (n) {
            if (n >= LIMIT) { say('Is code ke ' + LIMIT + ' referral poore ho chuke hain, ab ye code kaam nahi karega.'); return emptySnap(); }
            return snap;
          });
        });
      });
    }
    return origOnce.apply(this, arguments);
  };

  // ---------- 2) Referral lagte waqt: ginti +1 aur mobile number hamesha ke liye database mein (sab ek saath) ----------
  proto.update = function (values) {
    var self = this, args = arguments;
    if (pathOf(this) === '' && values && typeof values === 'object') {
      var keys = Object.keys(values);
      for (var i = 0; i < keys.length; i++) {
        var m = /^referrals\/([^\/]+)\/([^\/]+)$/.exec(keys[i]);
        if (!m) continue;
        var refUid = m[1], u = me();
        return Promise.all([countOf(refUid), needsMobile(u) ? mobState(u) : Promise.resolve(null)]).then(function (r) {
          if (r[0] >= LIMIT) return Promise.reject(new Error('REF_LIMIT'));
          values['refCount/' + refUid] = r[0] + 1;
          var ms = r[1];
          if (!ms) return origUpdate.apply(self, args);
          if (!ms.mobile || ms.used) return Promise.reject(new Error('NO_MOBILE'));
          return mobKey(ms.mobile).then(function (k) {
            values['referredPhones/' + k] = { uid: u.uid, t: firebase.database.ServerValue.TIMESTAMP };
            return origUpdate.apply(self, args);
          });
        });
      }
    }
    return origUpdate.apply(this, args);
  };

  // ---------- 3) Dibba: pehle mobile number, phir referral code ----------
  function setupCard() {
    var inp = document.getElementById('enterCode');
    if (!inp || inp.getAttribute('data-pwm')) return;
    inp.setAttribute('data-pwm', '1');
    var u = me();
    if (!needsMobile(u)) return;                                         // OTP wale ko mobile dobara nahi poochna

    var card = inp.closest('.card'), codeRow = inp.closest('.code-row'), msg = document.getElementById('enterMsg');
    codeRow.style.display = 'none';
    var mrow = document.createElement('div');
    mrow.className = 'code-row';
    mrow.innerHTML = '<input id="enterMobile" class="enter-code" type="tel" inputmode="numeric" maxlength="10" placeholder="Mobile number">' +
                     '<button type="button" class="copy-btn" id="mobSubmit">Submit</button>';
    codeRow.parentNode.insertBefore(mrow, codeRow);
    msg.textContent = 'Referral code dalne se pehle apna mobile number daalo (10 ank, 6 se 9 tak shuru)';

    function gone(text) {                                                // referral wala dibba gayab
      msg.textContent = text;
      setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 2500);
    }
    function open() {                                                    // mobile theek -> referral code wala dibba khulta hai
      if (mrow.parentNode) mrow.parentNode.removeChild(mrow);
      codeRow.style.display = '';
      msg.textContent = 'Mobile number save ho gaya. Ab referral code daalo.';
      var held = ls('pw_ref_hold');
      if (held) {                                                        // link se aaya code wapas bhar do aur lagao
        try { localStorage.removeItem('pw_ref_hold'); } catch (e) {}
        inp.value = held;
        var b = document.getElementById('applyCodeBtn'); if (b) b.click();
      }
    }

    mobState(u).then(function (ms) {                                     // pehle se number diya ho to dobara nahi
      if (ms.used) gone('Is mobile number par referral pehle hi use ho chuka hai, referral nahi lagega.');
      else if (ms.mobile) open();
    }).catch(function () {});

    document.getElementById('mobSubmit').addEventListener('click', function () {
      var btn = this, v = document.getElementById('enterMobile').value.replace(/\D/g, '');
      if (!MOB_RE.test(v)) { msg.textContent = 'Sahi mobile number likho: 10 ank, 6/7/8/9 se shuru.'; return; }
      btn.disabled = true; msg.textContent = 'Check ho raha hai...';
      mobKey(v).then(function (k) { return get('referredPhones/' + k); }).then(function (s) {
        var used = s.exists();                                           // database mein pehle se hai?
        return db.ref('users/' + u.uid).update({ mobile: v, refMobile: used ? 'used' : 'ok' }).then(function () {
          if (used) gone('Is mobile number par referral pehle hi use ho chuka hai, referral nahi lagega.');
          else open();
        });
      }).catch(function (e) {
        btn.disabled = false; msg.textContent = 'Error, dobara try karo';
      });
    });
  }

  if (window.MutationObserver) new MutationObserver(setupCard).observe(document.documentElement, { childList: true, subtree: true });
  setupCard();
})();
