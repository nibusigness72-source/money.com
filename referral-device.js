// referral-device.js  -  NAYI file (referral-core.js ko bilkul nahi badalna).
// Kaam: ek hi MOBILE se bar-bar referral lene wale ko rokna. Do jaanch hoti hain:
//
//   Jaanch 1 - LOCAL ID  (browser mein bani random pehchaan, data clear karne par badal jati hai)
//       Agar is Local ID se pehle koi referral lag chuka hai  ->  ROKO:
//       "Pehle is mobile mein referral use ho chuka hai, dobara nahi lagega."
//
//   Jaanch 2 - FINGERPRINT (phone/browser ki bandawat se bana hash, data clear karne par bhi wahi rehta hai)
//       Local ID nayi hai (data clear kiya) to fingerprint dekho. Is referrer (jiska code lag raha hai) ke liye
//       ek hi fingerprint se zyada se zyada 2 dost allow. Teesra  ->  roko:
//       "Is mobile se is code par do referral ho chuke hain. Ab dusre mobile se bhejna padega."
//       (Ginti har referrer ki alag hai: dusre ke code par wahi mobile phir 2 baar chalega.)
//
//   Referral lagte hi Local ID aur fingerprint ki ginti usi ek saath (atomic) Firebase mein likhi jati hai.
//
// Lagana: jahan <script src="referral-core.js"> hai, uske TEEK NEECHE:  <script src="referral-device.js"></script>
(function () {
  var FP_LIMIT = 2;                       // Rules (refFp) mein bhi 2 hi hai. Badalna ho to dono jagah badlo.
  if (!window.firebase || !firebase.apps || !firebase.apps.length || !firebase.database) return;

  var db = firebase.database();
  var proto = Object.getPrototypeOf(db.ref());
  var origOnce = proto.once, origUpdate = proto.update;

  function pathOf(ref) {
    try { return decodeURIComponent(new URL(String(ref.toString())).pathname.replace(/^\//, '')); } catch (e) { return ''; }
  }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function say(text) {
    setTimeout(function () { try { window.PWRef.toast(text, false); } catch (e) {} }, 600);   // thodi der baad, purana message dab jaye
  }
  function emptySnap() { return { val: function () { return null; }, exists: function () { return false; } }; }
  function get(path) { return origOnce.call(db.ref(path), 'value'); }

  // ---------- Local ID ----------
  function localId() {
    var id = ls('pw_lid');
    if (!id) { var m = document.cookie.match(/(?:^|; )pw_lid=([A-Za-z0-9]{16,40})/); if (m) id = m[1]; }
    if (!id) {
      var ch = 'abcdefghijklmnopqrstuvwxyz0123456789';
      try { var a = new Uint8Array(24); crypto.getRandomValues(a); for (var i = 0; i < 24; i++) id += ch.charAt(a[i] % ch.length); }
      catch (e) { id = ''; for (var j = 0; j < 24; j++) id += ch.charAt(Math.floor(Math.random() * ch.length)); }
    }
    try { localStorage.setItem('pw_lid', id); } catch (e) {}
    try { document.cookie = 'pw_lid=' + id + '; max-age=315360000; path=/; SameSite=Lax'; } catch (e) {}
    return id;
  }

  // ---------- Fingerprint ----------
  function hashText(str) {                // 32 akshar ka hex
    try {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 32);
        });
      }
    } catch (e) {}
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); h1 = ((h1 * 33) ^ c) >>> 0; h2 = ((h2 * 31) + c) >>> 0; }
    var hex = function (n) { return ('00000000' + n.toString(16)).slice(-8); };
    return Promise.resolve(hex(h1) + hex(h2) + hex(h1 ^ h2) + hex((h2 + h1) >>> 0));
  }
  function fingerprint() {
    var p = [];
    try {
      var n = navigator, sc = screen;
      p.push(n.platform, n.language, sc.width + 'x' + sc.height, sc.colorDepth, window.devicePixelRatio,
             n.hardwareConcurrency || '', n.deviceMemory || '', new Date().getTimezoneOffset(), n.maxTouchPoints || 0);
      p.push((n.userAgent || '').replace(/\d+(\.\d+)*/g, ''));            // version badalne se hash na badle
      var cv = document.createElement('canvas'); cv.width = 220; cv.height = 40;
      var x = cv.getContext('2d');
      x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(10, 5, 90, 25);
      x.fillStyle = '#069'; x.fillText('PlayWin fp 123', 4, 8);
      p.push(cv.toDataURL());
    } catch (e) {}
    return hashText(p.join('|'));
  }
  function deviceIds() {
    var lid = localId();
    return fingerprint().then(function (fp) { return { lid: lid, fp: fp }; });
  }

  // Dono jaanch: {bad:'device-used'|'fp-limit'} ya {lid, fp, count}
  function check(refUid) {
    return deviceIds().then(function (dv) {
      return get('refDevices/' + dv.lid).then(function (ds) {
        if (ds.exists()) return { bad: 'device-used' };
        return get('refFp/' + refUid + '/' + dv.fp).then(function (fs) {
          var cnt = Number(fs.val()) || 0;
          if (cnt >= FP_LIMIT) return { bad: 'fp-limit' };
          return { lid: dv.lid, fp: dv.fp, count: cnt };
        });
      });
    });
  }

  // ---------- 1) Code lagne se PEHLE jaanch ----------
  proto.once = function (type) {
    var m = /^refCodes\/([A-Za-z0-9]+)$/.exec(pathOf(this));
    if (m && type === 'value' && m[1] === ls('pw_ref')) {                // sirf "dost ne abhi code lagaya" wali ghadi
      return origOnce.apply(this, arguments).then(function (snap) {
        var refUid = snap.val();
        if (!refUid) return snap;
        return check(refUid).then(function (r) {
          if (r.bad === 'device-used') { say('Pehle is mobile mein referral use ho chuka hai, dobara nahi lagega.'); return emptySnap(); }
          if (r.bad === 'fp-limit') { say('Is mobile se is code par do referral ho chuke hain. Ab dusre mobile se bhejna padega.'); return emptySnap(); }
          return snap;
        });
      });
    }
    return origOnce.apply(this, arguments);
  };

  // ---------- 2) Referral lagte waqt: Local ID aur fingerprint ki ginti usi ek saath likho ----------
  proto.update = function (values) {
    var self = this, args = arguments;
    if (pathOf(this) === '' && values && typeof values === 'object') {
      var keys = Object.keys(values);
      for (var i = 0; i < keys.length; i++) {
        var m = /^referrals\/([^\/]+)\/([^\/]+)$/.exec(keys[i]);
        if (!m) continue;
        var refUid = m[1], childUid = m[2];
        return check(refUid).then(function (r) {
          if (r.bad) return Promise.reject(new Error('DEVICE_' + r.bad));
          values['refDevices/' + r.lid] = { uid: childUid, t: firebase.database.ServerValue.TIMESTAMP };
          values['refFp/' + refUid + '/' + r.fp] = r.count + 1;
          return origUpdate.apply(self, args);
        });
      }
    }
    return origUpdate.apply(this, args);
  };
})();
