// withdraw.js - Payment details bharna aur Firebase mein save karna
// Data yahan save hota hai:  users/<uid>/payout   (sirf us user ko dikhta hai)
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var uid = null, saved = false;

  function msg(text, ok) { $('msg').textContent = text; $('msg').className = 'msg' + (ok ? ' ok' : ''); }

  firebase.auth().onAuthStateChanged(function (u) {
    if (!u) { location.href = 'login.html'; return; }   // login nahi hai to login page par bhejo
    uid = u.uid;
    firebase.database().ref('users/' + uid + '/payout').once('value').then(function (s) {
      var d = s.val() || {};
      $('name').value = d.name || '';
      $('mobile').value = d.mobile || String(u.phoneNumber || '').replace('+91', '');
      $('bank').value = d.bank || '';
      $('account').value = d.account || '';
      $('ifsc').value = d.ifsc || '';
      $('upi').value = d.upi || '';
    }).catch(function () {});
  });

  $('saveBtn').addEventListener('click', function () {
    if (!uid || saved) return;
    var d = {
      name: $('name').value.trim(),
      mobile: $('mobile').value.trim(),
      bank: $('bank').value.trim(),
      account: $('account').value.trim(),
      ifsc: $('ifsc').value.trim().toUpperCase(),
      upi: $('upi').value.trim()
    };

    if (d.name.length < 2) return msg('Apna naam likho.');
    if (!/^[6-9]\d{9}$/.test(d.mobile)) return msg('10 ankon ka sahi mobile number likho.');

    var hasBank = d.bank || d.account || d.ifsc;
    if (!hasBank && !d.upi) return msg('Bank details ya UPI ID mein se kuch bharo.');
    if (hasBank) {
      if (d.bank.length < 2) return msg('Bank ka naam likho.');
      if (!/^\d{9,18}$/.test(d.account)) return msg('Account number 9 se 18 ank ka hona chahiye.');
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.ifsc)) return msg('IFSC sahi likho (jaise SBIN0001234).');
    }
    if (d.upi && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(d.upi)) return msg('UPI ID sahi likho (jaise name@upi).');

    d.t = firebase.database.ServerValue.TIMESTAMP;
    $('saveBtn').disabled = true; msg('Save ho raha hai...', true);
    firebase.database().ref('users/' + uid + '/payout').set(d).then(function () {
      saved = true; msg('✅ Details save ho gayi!', true);
      setTimeout(function () { location.href = 'settings.html'; }, 1200);
    }).catch(function (e) {
      $('saveBtn').disabled = false;
      msg('Save nahi hua: ' + ((e && (e.code || e.message)) || e));
    });
  });
})();
