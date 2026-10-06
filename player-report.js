// player-report.js - Admin ke liye "Player Report": kisi player par click karo, uske saare game ka record dikhega
// (kitni baar khela, sabse achha score, average, kul points) aur shak wali baatein alag se chamkengi.
// Sirf admin (+91 72588 45353) ke liye. Paisa bhejne se pehle jaanchne ke kaam aata hai.
(function () {
  var ADMIN = '+917258845353';
  var MAX_SCORE = 300;      // ek baar mein is se zyada score aaye to shak (apne game ke hisaab se badlo)
  var db = firebase.database(), isAdmin = false;

  var css = document.createElement('style');
  css.textContent =
    '.prp-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center}' +
    '.prp{width:100%;max-width:32rem;max-height:88vh;overflow:auto;background:#0f1b47;border:2px solid #22d3ee;border-radius:1.4rem 1.4rem 0 0;padding:1.2rem;color:#fff;font-family:Arial,sans-serif}' +
    '.prp h3{font-size:1.2rem;color:#facc15;margin-bottom:.2rem}.prp small{color:#9fb0d9}' +
    '.prp .x{float:right;background:transparent;border:1px solid #22d3ee;color:#22d3ee;border-radius:50%;width:2.2rem;height:2.2rem;font-size:1rem}' +
    '.prp .g{display:flex;gap:.5rem;margin:.9rem 0}.prp .g div{flex:1;background:#0a1233;border:1px solid #1f3a8a;border-radius:.9rem;padding:.6rem .3rem;text-align:center;font-size:.7rem;color:#9fb0d9}' +
    '.prp .g b{display:block;font-size:1rem;color:#facc15;margin-top:.2rem}' +
    '.prp table{width:100%;border-collapse:collapse;font-size:.8rem;margin:.4rem 0}.prp th,.prp td{border:1px solid #1f3a8a;padding:.45rem;text-align:center}.prp th{background:#12307a;color:#facc15}' +
    '.prp .bad{background:rgba(239,68,68,.18);color:#fca5a5;font-weight:700}' +
    '.prp .flag{background:rgba(239,68,68,.12);border:1px solid #ef4444;border-radius:.9rem;padding:.7rem;margin:.6rem 0;font-size:.82rem;color:#fca5a5;line-height:1.5}' +
    '.prp .ok{background:rgba(34,197,94,.12);border:1px solid #22c55e;color:#86efac;border-radius:.9rem;padding:.7rem;margin:.6rem 0;font-size:.82rem}' +
    '.prp h4{margin:1rem 0 .3rem;font-size:.9rem;color:#22d3ee}.prp p{font-size:.82rem;color:#dbe5ff;margin:.2rem 0}';
  document.head.appendChild(css);

  function inr(n) { return '₹ ' + Number(n || 0).toLocaleString('en-IN'); }
  function amountOf(s) { var t = String(s).replace(/[₹,\s]/g, ''); return /^\d+$/.test(t) ? parseInt(t, 10) : 0; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function label(k) { return k.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function show(uid, name) {
    var bg = el('div', 'prp-bg'), box = el('div', 'prp');
    bg.appendChild(box); document.body.appendChild(bg);
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    box.appendChild(el('p', '', 'Report ban rahi hai...'));

    Promise.all([db.ref('users/' + uid).once('value'), db.ref('winnings/' + uid).once('value'), db.ref('withdrawals/' + uid).once('value')]).then(function (r) {
      var u = r[0].val() || {}, w = r[1].val() || {}, t = r[2].val() || {}, st = u.stats || {}, games = st.games || {};
      box.innerHTML = '';
      var x = el('button', 'x', '✕'); x.onclick = function () { bg.remove(); }; box.appendChild(x);
      box.appendChild(el('h3', '', name || u.name || 'Player'));
      box.appendChild(el('small', '', 'ID: ' + (u.playerId || '-') + '  •  ' + (u.phone || u.email || '')));

      var g = el('div', 'g');
      [['Kul points', u.points || 0], ['Aaj', (st.day || {}).points || 0], ['Hafta', (st.week || {}).points || 0], ['Mahina', (st.month || {}).points || 0]].forEach(function (a) {
        var d = el('div', '', a[0]); d.appendChild(el('b', '', Number(a[1]).toLocaleString('en-IN'))); g.appendChild(d);
      });
      box.appendChild(g);

      // game-wise table + shak wali baatein
      var flags = [], keys = Object.keys(games), sumAll = 0;
      keys.forEach(function (k) { sumAll += Number(games[k].total) || 0; });
      var tb = el('table'), hd = el('tr');
      ['Game', 'Baar', 'Best', 'Average', 'Kul'].forEach(function (h) { hd.appendChild(el('th', '', h)); });
      tb.appendChild(hd);
      keys.forEach(function (k) {
        var m = games[k] || {}, plays = Number(m.plays) || 0, best = Number(m.best) || 0, total = Number(m.total) || 0;
        var avg = plays ? Math.round(total / plays) : 0, tr = el('tr');
        tr.appendChild(el('td', '', label(k)));
        tr.appendChild(el('td', '', plays));
        tr.appendChild(el('td', best > MAX_SCORE ? 'bad' : '', best));
        tr.appendChild(el('td', avg > MAX_SCORE ? 'bad' : '', avg));
        tr.appendChild(el('td', '', total));
        tb.appendChild(tr);
        if (best > MAX_SCORE) flags.push(label(k) + ': ek baar ka best score ' + best + ' (hadd ' + MAX_SCORE + ' se zyada)');
        if (avg > MAX_SCORE) flags.push(label(k) + ': average ' + avg + ' hadd se zyada');
        if (sumAll >= 500 && total / sumAll > 0.8) flags.push(label(k) + ': sabhi points ka ' + Math.round(100 * total / sumAll) + '% sirf isi game se');
      });
      if (((st.day || {}).points || 0) > ((st.week || {}).points || 0)) flags.push('Aaj ke points hafte ke points se zyada hain (hisaab mel nahi khata)');

      box.appendChild(el('h4', '', '🎮 Har game ka record'));
      box.appendChild(keys.length ? tb : el('p', '', 'Abhi koi game record nahi.'));
      box.appendChild(flags.length ? (function () { var f = el('div', 'flag'); f.innerHTML = '<b>⚠️ Shak wali baatein:</b><br>' + flags.map(function (s) { return '• ' + s.replace(/</g, '&lt;'); }).join('<br>'); return f; })()
                                   : el('div', 'ok', '✅ Koi shak wali baat nahi mili'));

      // paisa: jeeta aur withdraw
      var won = 0, wins = 0, paid = 0, pend = 0;
      Object.keys(w).forEach(function (k) { Object.keys(w[k] || {}).forEach(function (kk) { won += amountOf((w[k][kk] || {}).a); wins++; }); });
      Object.keys(t).forEach(function (id) { var a = Number(t[id].a) || 0; if (t[id].s === 'success') paid += a; else pend += a; });
      box.appendChild(el('h4', '', '💰 Paisa'));
      box.appendChild(el('p', '', 'Inaam jeete: ' + wins + ' baar, kul ' + inr(won)));
      box.appendChild(el('p', '', 'Withdraw: Paid ' + inr(paid) + '  |  Pending ' + inr(pend)));
      box.appendChild(el('p', '', 'Wallet mein hona chahiye: ' + inr(Math.max(0, won - paid - pend))));
    }).catch(function (e) {
      box.innerHTML = ''; box.appendChild(el('p', '', 'Report nahi aayi: ' + (e.code || e.message) + ' (Rules mein admin ko users padhne ki ijazat dein)'));
    });
  }

  window.PWReport = { show: show };

  // Leaderboard: admin kisi row par click kare to uski report khule (live-board.js row par data-uid lagata hai)
  document.addEventListener('click', function (e) {
    if (!isAdmin) return;
    var row = e.target.closest ? e.target.closest('.list .row') : null;
    if (!row || !row.dataset.uid || e.target.closest('button')) return;
    var nm = row.querySelector('.nm');
    show(row.dataset.uid, nm ? nm.textContent : '');
  });

  firebase.auth().onAuthStateChanged(function (u) { isAdmin = !!(u && u.phoneNumber === ADMIN); });
})();
