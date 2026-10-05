// wallet.js - Inaam ka paisa wallet mein jodna + wallet dikhana (Home aur Settings dono mein)
//
// KAISE KAAM KARTA HAI
//  1. Jab bhi player app kholta hai, ye pichhle khatam ho chuke din / hafte / mahine dekhta hai.
//  2. Har khatam period ke liye: us period ke board mein player ka rank nikalta hai
//     aur admin ne rewards/<kind>/<key>/r<rank> mein jo inaam likha tha wo padhta hai.
//  3. Agar player top mein tha aur inaam likha tha -> winnings/<uid>/<kind>/<key> mein ek entry banti hai (sirf ek baar).
//  4. Wallet = in sab entries ke number ka jod. Ye .wallet-amount aur Winnings dono jagah dikhta hai.
//  5. Agar admin ne number ki jagah text likha (jaise "Mobile"), to wo record hota hai par wallet mein paise nahi judte.
//
// Samay: Daily subah 8 baje, Weekly Somwar 8 baje, Monthly 1 tarikh 8 baje khatam (score.js jaisa hi).
(function () {
  var IST = 5.5 * 3600 * 1000, CUT = 8 * 3600 * 1000, DAY = 86400000;
  var MAX_RANK = 10;                       // top kitne rank tak inaam check karna (Rules mein bhi 10)
  var LOOK = { day: 7, week: 5, month: 3 }; // kitne pichhle period tak dekhna (chhute hue inaam ke liye)
  var NAME = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
  var db = firebase.database(), uid = null, running = false;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function keys(ms) {                      // score.js wala hi hisaab
    var d = new Date(ms + IST - CUT), dow = (d.getUTCDay() + 6) % 7;
    var mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
    return { day: ymd(d), week: ymd(mon), month: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) };
  }
  function finished(now) {                 // khatam ho chuke periods ki list
    var cur = keys(now), out = { day: [], week: [], month: [] }, i, k;
    for (i = 1; i <= LOOK.day; i++) { k = keys(now - i * DAY).day; if (k !== cur.day && out.day.indexOf(k) < 0) out.day.push(k); }
    for (i = 1; i <= LOOK.week; i++) { k = keys(now - i * 7 * DAY).week; if (k !== cur.week && out.week.indexOf(k) < 0) out.week.push(k); }
    var p = cur.month.split('-'), y = +p[0], m = +p[1];
    for (i = 1; i <= LOOK.month; i++) {
      var mm = m - i, yy = y; while (mm < 1) { mm += 12; yy--; }
      out.month.push(yy + '-' + pad(mm));
    }
    return out;
  }

  function money(n) { return '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function toast(text) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);max-width:90%;padding:12px 16px;' +
      'border-radius:12px;background:#15803d;color:#fff;font:14px/1.4 Arial,sans-serif;z-index:99999;text-align:center;';
    el.textContent = text; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 6000);
  }
  function showWallet(total) {             // Home + Settings dono mein wallet badlo
    document.querySelectorAll('.wallet-amount').forEach(function (e) { e.textContent = money(total); });
    var w = document.querySelector('.wallet-bottom b.green');   // "Winnings"
    if (w) w.textContent = money(total);
  }
  function amountOf(s) {                   // "1,30,000" ya "₹ 5000" -> number, text ho to 0
    var t = String(s).replace(/[₹,\s]/g, '');
    return /^\d+$/.test(t) ? parseInt(t, 10) : 0;
  }

  function checkedStore() {
    try { return JSON.parse(localStorage.getItem('pwChecked_' + uid) || '{}'); } catch (e) { return {}; }
  }
  function saveChecked(c) { try { localStorage.setItem('pwChecked_' + uid, JSON.stringify(c)); } catch (e) {} }

  // Ek khatam period: rank dekho, inaam ho to jodo
  function claimOne(kind, key, have, checked) {
    var id = kind + '/' + key;
    if (checked[id] || (have[kind] && have[kind][key])) return Promise.resolve();
    return db.ref('board/' + kind + '/' + key).orderByChild('p').limitToLast(MAX_RANK).once('value').then(function (snap) {
      var ids = []; snap.forEach(function (c) { ids.push(c.key); }); ids.reverse();
      var rank = ids.indexOf(uid) + 1;
      if (!rank) { checked[id] = 1; return; }                      // top mein nahi tha
      return db.ref('rewards/' + kind + '/' + key + '/r' + rank).once('value').then(function (r) {
        var prize = r.val();
        if (!prize) { checked[id] = 1; return; }                   // admin ne inaam nahi likha
        return db.ref('winnings/' + uid + '/' + kind + '/' + key).set({
          r: 'r' + rank, a: String(prize), t: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
          checked[id] = 1;
          toast('🎉 ' + NAME[kind] + ' Rank ' + rank + ': ' + prize + (amountOf(prize) ? ' wallet mein juda!' : ' jeeta!'));
        });
      });
    }).catch(function (e) { console.error('Inaam check nahi hua', id, e); });
  }

  function claimAll() {
    if (!uid || running) return;
    running = true;
    db.ref('.info/serverTimeOffset').once('value').then(function (o) {
      var now = Date.now() + (o.val() || 0), list = finished(now), checked = checkedStore();
      return db.ref('winnings/' + uid).once('value').then(function (s) {
        var have = s.val() || {}, chain = Promise.resolve();
        ['day', 'week', 'month'].forEach(function (kind) {
          list[kind].forEach(function (key) { chain = chain.then(function () { return claimOne(kind, key, have, checked); }); });
        });
        return chain.then(function () { saveChecked(checked); });
      });
    }).catch(function (e) { console.error('Wallet claim error', e); }).then(function () { running = false; });
  }

  firebase.auth().onAuthStateChanged(function (u) {
    if (!u) return;
    uid = u.uid;
    // wallet live dikhao (jaise hi inaam judta hai, turant badal jata hai)
    db.ref('winnings/' + uid).on('value', function (s) {
      var total = 0, all = s.val() || {};
      Object.keys(all).forEach(function (kind) {
        Object.keys(all[kind] || {}).forEach(function (key) { total += amountOf((all[kind][key] || {}).a); });
      });
      showWallet(total);
    }, function (e) { console.error('Wallet nahi padha', e); });
    claimAll();
    setInterval(claimAll, 5 * 60 * 1000);   // app khula rahe to har 5 minute mein dobara dekho
  });
})();
