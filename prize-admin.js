// prize-admin.js - Leaderboard mein har rank ka inaam (reward) badalna
//
// * Sabko inaam dikhta hai. Sirf admin (+91 72588 45353) ko har rank ke saath ✎ icon dikhta hai.
// * ✎ dabao -> chhota box khulta hai -> kuch bhi likho (jaise 130000 ya "50,000 + Mobile") -> Save.
// * Daily  : subah 8 baje se agle din subah 8 baje tak
//   Weekly : Somwar subah 8 baje se agle Somwar subah 8 baje tak
//   Monthly: 1 tarikh subah 8 baje se mahine ke aakhri din (28/29/30/31) subah 8 baje tak
// * Time khatam hone ke baad "Pending" dikhta hai, jab tak admin naya inaam na likhe.
// * Data Firebase mein: rewards/<day|week|month>/<key>/r<rank>
//
// Ye file live-board.js ke BAAD lagani hai.
(function () {
  var ADMIN = '+917258845353';

  // ===== YAHAN SE BADLO: kitne rank tak inaam milega =====
  // 3 = sirf Rank 1, 2, 3 ko inaam (baaki ko "-" dikhega, pencil bhi nahi)
  // 5 = Rank 1 se 5 tak | 10 = Rank 1 se 10 tak   (zyada se zyada 10, Rules mein bhi 10 tak hi hai)
  var PRIZE_RANKS = 3;
  // ======================================================
  var KIND = { daily: 'day', weekly: 'week', monthly: 'month' };
  var IST = 5.5 * 3600 * 1000, CUT = 8 * 3600 * 1000;
  var cache = {};          // period -> { key, data }
  var isAdmin = false;

  function period() { return (window.state && state.period) || 'monthly'; }

  function info() {
    var ms = Date.now(), d = new Date(ms + IST - CUT);
    var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    return { keys: PWScore.keys(ms), monthOpen: d.getUTCDate() !== last };
  }
  function isOpen(p) { return p !== 'monthly' || info().monthOpen; }   // mahine ke aakhri din 8 baje ke baad band
  function keyOf(p) { return info().keys[KIND[p]]; }
  function ready(p) { return cache[p] && cache[p].key === keyOf(p); }
  function pathOf(p, rank) { return 'rewards/' + KIND[p] + '/' + keyOf(p) + '/r' + rank; }

  function show(v) {   // sirf number likha ho to ₹ 1,30,000 jaisa dikhao, warna jo likha wahi
    var s = String(v).trim();
    return /^\d+$/.test(s) ? '₹ ' + Number(s).toLocaleString('en-IN') : s;
  }
  function textFor(p, rank) {
    if (rank > PRIZE_RANKS) return '----';        // inaam wale rank ke baad sirf dash
    if (!isOpen(p)) return 'Pending';
    if (!ready(p)) return '...';
    var v = cache[p].data['r' + rank];
    return v ? show(v) : 'Pending';
  }

  var css = document.createElement('style');
  css.textContent =
    '.rw-ed{margin-left:6px;width:24px;height:24px;border-radius:50%;border:2px solid #22d3ee;background:transparent;color:#22d3ee;font-size:13px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle}' +
    '.rw-box{margin:-4px 0 10px;padding:10px;border:2px solid #facc15;border-radius:14px;background:#0f1b47}' +
    '.rw-box input{width:100%;padding:10px;border-radius:8px;border:1px solid #22d3ee;background:#060c24;color:#fff;font-size:15px}' +
    '.rw-bt{display:flex;gap:8px;margin-top:8px}.rw-bt button{flex:1;padding:9px;border:0;border-radius:8px;color:#fff;font-weight:800}' +
    '.rw-c{background:#dc2626}.rw-s{background:#16a34a}.rw-e{color:#f87171;font-size:12px;margin-top:6px}';
  document.head.appendChild(css);

  function decorate() {
    var p = period();
    document.querySelectorAll('.list .row').forEach(function (row, i) {
      var rank = i + 1, box = row.querySelector('.c-reward');
      if (!box) return;
      box.innerHTML = '';
      var t = document.createElement('span');
      t.textContent = textFor(p, rank);
      box.appendChild(t);
      if (isAdmin && rank <= PRIZE_RANKS && isOpen(p) && ready(p)) {
        var b = document.createElement('button');
        b.className = 'rw-ed';
        b.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="#22d3ee"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.4l-2.35-2.35a1 1 0 0 0-1.4 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
        b.onclick = function () { edit(row, rank, p); };
        box.appendChild(b);
      }
    });
  }

  function edit(row, rank, p) {
    var nxt = row.nextSibling;
    if (nxt && nxt.className === 'rw-box') { nxt.remove(); return; }   // dubara dabane par band
    var old = cache[p].data['r' + rank] || '';
    var box = document.createElement('div');
    box.className = 'rw-box';
    box.innerHTML = '<input maxlength="40" placeholder="Enter amount (kuch bhi likho)">' +
      '<div class="rw-bt"><button class="rw-c">✕ Cancel</button><button class="rw-s">✓ Save</button></div><div class="rw-e"></div>';
    var inp = box.querySelector('input'), err = box.querySelector('.rw-e');
    inp.value = old;
    row.parentNode.insertBefore(box, row.nextSibling);
    inp.focus();
    box.querySelector('.rw-c').onclick = function () { box.remove(); };
    box.querySelector('.rw-s').onclick = function () {
      var val = inp.value.trim(), ref = firebase.database().ref(pathOf(p, rank));
      err.textContent = 'Save ho raha hai...';
      (val ? ref.set(val) : ref.remove()).then(function () {
        if (val) cache[p].data['r' + rank] = val; else delete cache[p].data['r' + rank];
        box.remove(); decorate();
      }).catch(function (e) {
        err.textContent = 'Save nahi hua: ' + ((e && (e.code || e.message)) || e);
      });
    };
  }

  function fetchOne(p) {
    if (!firebase.auth().currentUser) return Promise.resolve();
    var key = keyOf(p);
    return firebase.database().ref('rewards/' + KIND[p] + '/' + key).once('value').then(function (s) {
      cache[p] = { key: key, data: s.val() || {} };
    }).catch(function (e) { console.error('Reward load nahi hua', e); });
  }
  function refresh() { return fetchOne(period()).then(decorate); }

  // live-board.js jab bhi list banaye, uske baad hamara reward lagao
  if (typeof render === 'function') {
    var origRender = render;
    render = function (rows) { origRender(rows); decorate(); };
  }

  firebase.auth().onAuthStateChanged(function (u) {
    isAdmin = !!(u && u.phoneNumber === ADMIN);
    refresh();
  });
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { setTimeout(function () { decorate(); refresh(); }, 0); });
  });
  setInterval(refresh, 60000);   // subah 8 baje naya din/hafta/mahina shuru hote hi "Pending" dikhe
})();
