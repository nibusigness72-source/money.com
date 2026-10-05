// payouts.js - Withdraw request (player) + Pending/Success list (admin 72588 45353)
//
// Data Firebase mein:  withdrawals/<uid>/<id> = { a: rakam, s: 'pending'|'success', t: samay, n: naam, d: {account details}, pt: paid samay }
// Wallet = (jeeta hua paisa) - (sabhi withdraw request, pending + success)   -> wallet.js ye hisaab karti hai
(function () {
  var ADMIN = '+917258845353', MIN = 10, MAX = 100000;
  var db = firebase.database(), uid = null, isAdmin = false, tab = 'pending', allReq = [];
  var $ = function (id) { return document.getElementById(id); };

  function inr(n) { return '₹ ' + Number(n || 0).toLocaleString('en-IN'); }
  function when(t) { return t ? new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function msg(text, ok) { $('msg').textContent = text; $('msg').className = 'msg' + (ok ? ' ok' : ''); }
  function amountOf(s) { var t = String(s).replace(/[₹,\s]/g, ''); return /^\d+$/.test(t) ? parseInt(t, 10) : 0; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ---- Paisa kitna bacha hai (taaza, database se) ----
  function balance() {
    return Promise.all([db.ref('winnings/' + uid).once('value'), db.ref('withdrawals/' + uid).once('value')]).then(function (r) {
      var won = 0, taken = 0, w = r[0].val() || {}, t = r[1].val() || {};
      Object.keys(w).forEach(function (k) { Object.keys(w[k] || {}).forEach(function (key) { won += amountOf((w[k][key] || {}).a); }); });
      Object.keys(t).forEach(function (id) { taken += Number(t[id].a) || 0; });
      return Math.max(0, won - taken);
    });
  }
  function showBalance() { return balance().then(function (b) { $('bal').textContent = inr(b) + '.00'; return b; }); }

  // ---- Meri withdraw list ----
  function loadMine() {
    db.ref('withdrawals/' + uid).once('value').then(function (s) {
      var all = s.val() || {}, ids = Object.keys(all).sort(function (a, b) { return all[b].t - all[a].t; });
      var box = $('mine'); box.innerHTML = '';
      if (!ids.length) { box.appendChild(el('div', 'empty', 'Abhi koi withdraw request nahi.')); return; }
      ids.forEach(function (id) {
        var r = all[id], row = el('div', 'row'), nm = el('div', 'nm', inr(r.a));
        nm.appendChild(el('small', '', when(r.t) + (r.s === 'success' ? '  •  Paid: ' + when(r.pt) : '  •  24-48 ghante mein milega')));
        row.appendChild(nm);
        row.appendChild(el('span', 'badge ' + r.s, r.s === 'success' ? 'Success' : 'Pending'));
        box.appendChild(row);
      });
    }).catch(function () {});
  }

  // ---- Withdraw OK ----
  $('okBtn').addEventListener('click', function () {
    var txt = $('amt').value.trim();
    if (!/^\d+$/.test(txt)) return msg('Sirf number likho.');
    var amt = parseInt(txt, 10);
    if (amt < MIN) return msg('Kam se kam ₹' + MIN + ' withdraw kar sakte ho.');
    if (amt > MAX) return msg('Ek baar mein ₹' + MAX + ' se zyada nahi.');
    $('okBtn').disabled = true; msg('Check ho raha hai...', true);

    Promise.all([balance(), db.ref('users/' + uid + '/payout').once('value'), db.ref('users/' + uid + '/name').once('value')]).then(function (r) {
      var bal = r[0], d = r[1].val(), nm = r[2].val();
      if (amt > bal) throw new Error('Wallet mein sirf ' + inr(bal) + ' hai.');
      if (!d || (!d.upi && !d.account)) throw new Error('Pehle "change details" mein bank ya UPI details bharo.');
      var ref = db.ref('withdrawals/' + uid).push();
      return ref.set({
        a: amt, s: 'pending', t: firebase.database.ServerValue.TIMESTAMP, n: nm || d.name || 'Player',
        d: { name: d.name || '', mobile: d.mobile || '', bank: d.bank || '', account: d.account || '', ifsc: d.ifsc || '', upi: d.upi || '' }
      });
    }).then(function () {
      $('amt').value = '';
      msg('✅ Request bhej di gayi! Status: Pending. Paisa 24 se 48 ghante mein mil jayega.', true);
      showBalance(); loadMine();
    }).catch(function (e) {
      msg(e && e.message ? e.message : 'Request nahi gayi.');
    }).then(function () { $('okBtn').disabled = false; });
  });

  // ---- Admin: sabki requests ----
  function loadAdmin() {
    db.ref('withdrawals').once('value').then(function (s) {
      var all = s.val() || {}; allReq = [];
      Object.keys(all).forEach(function (u) {
        Object.keys(all[u]).forEach(function (id) { var r = all[u][id]; r._u = u; r._id = id; allReq.push(r); });
      });
      allReq.sort(function (a, b) { return tab === 'pending' ? a.t - b.t : (b.pt || b.t) - (a.pt || a.t); });
      drawAdmin();
    }).catch(function (e) { $('list').textContent = 'List nahi aayi: ' + (e.code || e.message); });
  }

  function field(label, val) {
    var f = el('div', 'f'); f.appendChild(el('b', '', label + ':')); var v = el('span', '', val || '-'); f.appendChild(v);
    f.onclick = function () { try { navigator.clipboard.writeText(val || ''); v.textContent = (val || '-') + '  ✓ copy'; } catch (e) {} };
    return f;
  }

  function drawAdmin() {
    var list = $('list'); list.innerHTML = '';
    var rows = allReq.filter(function (r) { return r.s === tab; });
    var sum = 0; rows.forEach(function (r) { sum += Number(r.a) || 0; });
    $('total').innerHTML = (tab === 'pending' ? 'Baaki dena hai: ' : 'Ab tak diya: ') + '<b>' + inr(sum) + '</b> (' + rows.length + ' player)';
    $('tabPending').textContent = 'Pending (' + allReq.filter(function (r) { return r.s === 'pending'; }).length + ')';
    if (!rows.length) { list.appendChild(el('div', 'empty', tab === 'pending' ? 'Koi pending request nahi.' : 'Abhi koi success nahi.')); return; }

    rows.forEach(function (r) {
      var row = el('div', 'row'), av = el('div', 'av', '🧑'), nm = el('div', 'nm', r.n || 'Player');
      nm.appendChild(el('small', '', when(r.s === 'success' ? r.pt : r.t)));
      var pen = el('button', 'pen', '✎'); pen.title = 'Account details';
      row.appendChild(av); row.appendChild(nm); row.appendChild(el('div', 'amt', inr(r.a))); row.appendChild(pen);
      list.appendChild(row);

      pen.onclick = function () {
        var nx = row.nextSibling;
        if (nx && nx.className === 'det') { nx.remove(); return; }
        var d = r.d || {}, box = el('div', 'det');
        box.appendChild(field('Name', d.name)); box.appendChild(field('Mobile No', d.mobile));
        box.appendChild(field('Bank Name', d.bank)); box.appendChild(field('Account No', d.account));
        box.appendChild(field('IFSC', d.ifsc)); box.appendChild(field('UPI ID', d.upi));
        var chk = el('div', 'chk', 'Jaanch raha hai...'); box.appendChild(chk);
        if (window.PWReport) {   // Player Report button
          var rb = el('button', '', '📊 Player Report dekho');
          rb.style.cssText = 'width:100%;margin:6px 0 10px;padding:11px;border-radius:12px;border:1px solid #22d3ee;background:transparent;color:#22d3ee;font-weight:700;font-size:14px';
          rb.onclick = function () { PWReport.show(r._u, r.n); };
          box.appendChild(rb);
        }
        // Admin ke liye asli jaanch: is player ne database ke hisaab se kitna jeeta aur kitna pehle liya
        Promise.all([db.ref('winnings/' + r._u).once('value'), db.ref('withdrawals/' + r._u).once('value')]).then(function (x) {
          var won = 0, taken = 0, w = x[0].val() || {}, t = x[1].val() || {};
          Object.keys(w).forEach(function (k) { Object.keys(w[k] || {}).forEach(function (key) { won += amountOf((w[k][key] || {}).a); }); });
          Object.keys(t).forEach(function (id) { if (id !== r._id && t[id].s === 'success') taken += Number(t[id].a) || 0; });
          var okay = won - taken >= r.a;
          chk.textContent = 'Ab tak jeeta: ' + inr(won) + ' | Pehle diya: ' + inr(taken) + (okay ? '  ✅ theek' : '  ⚠️ rakam zyada hai, pehle jaanch karo');
        }).catch(function () { chk.textContent = ''; });

        if (r.s === 'pending') {
          var ok = el('button', 'ok-btn', '✓ Success (paisa bhej diya)');
          ok.onclick = function () {
            if (!confirm(inr(r.a) + ' ' + (r.n || '') + ' ko bhej diya? Success karne ke baad wapas nahi hoga.')) return;
            ok.disabled = true;
            db.ref('withdrawals/' + r._u + '/' + r._id).update({ s: 'success', pt: firebase.database.ServerValue.TIMESTAMP })
              .then(loadAdmin).catch(function (e) { ok.disabled = false; alert('Nahi hua: ' + (e.code || e.message)); });
          };
          box.appendChild(ok);
        }
        row.parentNode.insertBefore(box, row.nextSibling);
      };
    });
  }

  function setTab(t) {
    tab = t;
    $('tabPending').className = 'tab' + (t === 'pending' ? ' active' : '');
    $('tabSuccess').className = 'tab' + (t === 'success' ? ' active' : '');
    loadAdmin();
  }
  $('tabPending').onclick = function () { setTab('pending'); };
  $('tabSuccess').onclick = function () { setTab('success'); };

  firebase.auth().onAuthStateChanged(function (u) {
    if (!u) { location.href = 'login.html'; return; }
    uid = u.uid; isAdmin = u.phoneNumber === ADMIN;
    showBalance(); loadMine();
    if (isAdmin) {
      $('adminBox').style.display = 'block';
      var want = /tab=success/.test(location.search) ? 'success' : 'pending';
      if (/tab=pending/.test(location.search)) $('userBox').style.display = 'none';   // Settings ke "Pending" se aaye to sirf list
      setTab(want);
    }
  });
})();
