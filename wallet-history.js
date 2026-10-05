// wallet-history.js - Wallet History: jo paisa juda (Rank 1/2/3 ya koi inaam) aur jo withdraw hua, time ke saath
// Data yahin se padhta hai (kuch naya save nahi karta):
//   winnings/<uid>/<day|week|month>/<key>  = inaam jo wallet mein juda  (wallet.js banati hai)
//   withdrawals/<uid>/<id>                 = withdraw request            (payouts.js banati hai)
(function () {
  var db = firebase.database(), uid = null, items = [], filter = 'all';
  var NAME = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var $ = function (id) { return document.getElementById(id); };

  function inr(n) { return '₹ ' + Number(n || 0).toLocaleString('en-IN'); }
  function when(t) { return t ? new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function amountOf(s) { var t = String(s).replace(/[₹,\s]/g, ''); return /^\d+$/.test(t) ? parseInt(t, 10) : 0; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function periodText(kind, key) {          // key se saaf likha hua din / hafta / mahina
    var p = key.split('-'), m = MON[(+p[1]) - 1] || '';
    if (kind === 'month') return 'Mahina: ' + m + ' ' + p[0];
    return (kind === 'week' ? 'Hafta (Somwar se): ' : 'Din: ') + (+p[2]) + ' ' + m + ' ' + p[0];
  }

  function load() {
    Promise.all([db.ref('winnings/' + uid).once('value'), db.ref('withdrawals/' + uid).once('value')]).then(function (r) {
      var w = r[0].val() || {}, d = r[1].val() || {};
      items = [];
      Object.keys(w).forEach(function (kind) {
        Object.keys(w[kind] || {}).forEach(function (key) {
          var e = w[kind][key] || {}, rank = parseInt(String(e.r).slice(1), 10) || 0;
          items.push({ type: 'win', t: e.t || 0, kind: kind, rank: rank, sub: periodText(kind, key), prize: e.a, num: amountOf(e.a) });
        });
      });
      Object.keys(d).forEach(function (id) {
        var x = d[id] || {};
        items.push({ type: 'wd', t: x.t || 0, num: Number(x.a) || 0, s: x.s, pt: x.pt });
      });

      items.sort(function (a, b) { return a.t - b.t; });          // purana -> naya, baaki rakam nikalne ke liye
      var bal = 0, won = 0, taken = 0;
      items.forEach(function (it) {
        if (it.type === 'win') { won += it.num; bal += it.num; } else { taken += it.num; bal -= it.num; }
        it.after = bal;
      });
      $('sWon').textContent = inr(won); $('sTaken').textContent = inr(taken); $('sBal').textContent = inr(Math.max(0, bal));
      items.reverse();                                             // naya sabse upar
      draw();
    }).catch(function (e) { $('list').innerHTML = ''; $('list').appendChild(el('div', 'empty', 'History nahi aayi: ' + (e.code || e.message))); });
  }

  function draw() {
    var list = $('list'); list.innerHTML = '';
    var rows = items.filter(function (it) { return filter === 'all' || it.type === filter; });
    if (!rows.length) { list.appendChild(el('div', 'empty', 'Abhi kuch nahi hai.')); return; }

    rows.forEach(function (it) {
      var row = el('div', 'row'), mid = el('div', 'mid'), right = el('div', 'right');
      if (it.type === 'win') {
        row.appendChild(el('div', 'ic', it.rank === 1 ? '🥇' : it.rank === 2 ? '🥈' : it.rank === 3 ? '🥉' : '🏆'));
        mid.appendChild(el('div', 't', NAME[it.kind] + ' Rank ' + it.rank + ' inaam'));
        mid.appendChild(el('small', '', it.sub + '  •  ' + when(it.t)));
        right.appendChild(it.num ? el('div', 'plus', '+' + inr(it.num)) : el('div', 'txt', String(it.prize)));
      } else {
        row.appendChild(el('div', 'ic', '💸'));
        mid.appendChild(el('div', 't', 'Withdraw request'));
        mid.appendChild(el('small', '', when(it.t) + (it.s === 'success' ? '  •  Paid: ' + when(it.pt) : '  •  24-48 ghante mein milega')));
        right.appendChild(el('div', 'minus', '-' + inr(it.num)));
        right.appendChild(el('span', 'badge ' + it.s, it.s === 'success' ? 'Success' : 'Pending'));
      }
      right.appendChild(el('small', '', 'Baaki ' + inr(Math.max(0, it.after))));
      row.appendChild(mid); row.appendChild(right);
      list.appendChild(row);
    });
  }

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); filter = b.getAttribute('data-f'); draw();
    });
  });

  firebase.auth().onAuthStateChanged(function (u) {
    if (!u) { location.href = 'login.html'; return; }
    uid = u.uid; load();
  });
})();
