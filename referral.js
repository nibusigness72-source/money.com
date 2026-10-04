// referral.js - Refer & Earn page: code, invite link, share (WhatsApp/Facebook...), copy, stats, dosto ki list
(function () {
  var R = window.PWRef;
  var C = R.config;
  function $(id) { return document.getElementById(id); }

  var codeBox = $('refCode');
  var copyBtn = $('copyBtn');
  var inviteBtn = $('inviteBtn');
  var shareBtn = $('shareBtn');
  var statNums = document.querySelectorAll('.stat-num');
  var myCode = '', myLink = '', sheet = null;

  // ---------- Page ke likhe hue text settings se badlo ----------
  (function texts() {
    var y = document.querySelector('.banner-text .yellow');
    if (y) y.textContent = 'Get ' + C.REWARD_POINTS + ' Points';

    var t = [
      'Share your referral code/link',
      'Friend signs up using your link',
      'Friend plays ' + R.minutesText(),
      'You get ' + C.REWARD_POINTS + ' points (per friend)'
    ];
    var steps = document.querySelectorAll('.step');
    for (var i = 0; i < steps.length && i < t.length; i++) {
      steps[i].innerHTML = '<span class="num">' + (i + 1) + '</span>' + t[i];
    }
  })();

  // ---------- Copy ----------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, 99999);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  function flash(btn, text) {
    var old = btn.getAttribute('data-old') || btn.textContent;
    btn.setAttribute('data-old', old);
    btn.textContent = text;
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.textContent = old; }, 1800);
  }

  function doCopy(text, btn, doneText) {
    copyText(text).then(function () {
      flash(btn, doneText);
      R.toast('✅ Copy ho gaya');
    }, function () {
      R.toast('Copy nahi hua, link ko dabake rakho aur copy karo', false);
    });
  }

  function shareText() {
    return '🎮 PLAY & WIN me mere saath khelo aur points jeeto! Mera referral code: ' + myCode + '\nJoin karo: ' + myLink;
  }

  // ---------- Share sheet (WhatsApp, Facebook, Telegram, X, SMS, Email, More, Copy) ----------
  function buildSheet() {
    sheet = document.createElement('div');
    sheet.className = 'share-sheet';
    sheet.innerHTML =
      '<div class="share-back"></div>' +
      '<div class="share-panel">' +
        '<div class="share-top"><b>Invite karo</b><button type="button" class="share-x" id="shareX">✕</button></div>' +
        '<div class="share-grid">' +
          '<a class="share-item" id="shWa" target="_blank" rel="noopener"><span class="share-ic" style="background:#25d366">💬</span>WhatsApp</a>' +
          '<a class="share-item" id="shFb" target="_blank" rel="noopener"><span class="share-ic" style="background:#1877f2">f</span>Facebook</a>' +
          '<a class="share-item" id="shTg" target="_blank" rel="noopener"><span class="share-ic" style="background:#229ed9">✈️</span>Telegram</a>' +
          '<a class="share-item" id="shTw" target="_blank" rel="noopener"><span class="share-ic" style="background:#111">𝕏</span>X</a>' +
          '<a class="share-item" id="shSms"><span class="share-ic" style="background:#16a34a">✉️</span>SMS</a>' +
          '<a class="share-item" id="shMail"><span class="share-ic" style="background:#ea580c">📧</span>Email</a>' +
          '<a class="share-item" id="shMore" style="display:none"><span class="share-ic" style="background:#6b7280">⋯</span>More</a>' +
        '</div>' +
        '<div class="share-link-row"><input id="shLink" readonly><button type="button" id="shCopy" class="copy-btn">Copy Link</button></div>' +
      '</div>';
    document.body.appendChild(sheet);

    sheet.querySelector('.share-back').addEventListener('click', closeSheet);
    $('shareX').addEventListener('click', closeSheet);
    $('shCopy').addEventListener('click', function () { doCopy(myLink, $('shCopy'), 'Copied ✓'); });

    // Phone ka apna share menu (Instagram, Messenger, Snapchat... sab) - jahan chalta ho wahin dikhega
    if (navigator.share) {
      $('shMore').style.display = '';
      $('shMore').addEventListener('click', function () {
        navigator.share({ title: 'PLAY & WIN', text: shareText(), url: myLink }).catch(function () {});
      });
    }

    ['shWa', 'shFb', 'shTg', 'shTw', 'shSms', 'shMail'].forEach(function (id) {
      $(id).addEventListener('click', function () { setTimeout(closeSheet, 300); });
    });
  }

  function openSheet() {
    if (!myLink) { R.toast('Thoda ruko, link ban raha hai...', false); return; }
    if (!sheet) buildSheet();

    var text = encodeURIComponent(shareText());
    var url = encodeURIComponent(myLink);
    $('shWa').href = 'https://wa.me/?text=' + text;
    $('shFb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + url + '&quote=' + encodeURIComponent(shareText());
    $('shTg').href = 'https://t.me/share/url?url=' + url + '&text=' + encodeURIComponent('🎮 PLAY & WIN me mere saath khelo! Code: ' + myCode);
    $('shTw').href = 'https://twitter.com/intent/tweet?text=' + text;
    $('shSms').href = 'sms:?&body=' + text;
    $('shMail').href = 'mailto:?subject=' + encodeURIComponent('PLAY & WIN - mere saath khelo') + '&body=' + text;
    $('shLink').value = myLink;
    sheet.classList.add('show');
  }

  function closeSheet() { if (sheet) sheet.classList.remove('show'); }

  // ---------- Dosto ki list aur stats ----------
  var friendsBox = null;

  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function render(map) {
    map = map || {};
    var ids = Object.keys(map).sort(function (a, b) { return (map[b].t || 0) - (map[a].t || 0); });
    var total = ids.length, active = 0, earned = 0;

    ids.forEach(function (id) {
      var e = map[id];
      if (e.ready) active++;
      if (e.paid) earned += Number(e.paid) || 0;
    });

    if (statNums[0]) statNums[0].textContent = total;
    if (statNums[1]) statNums[1].textContent = active;
    if (statNums[2]) statNums[2].textContent = earned;

    if (!friendsBox) return;
    friendsBox.innerHTML = '';
    if (!ids.length) {
      var empty = document.createElement('div');
      empty.className = 'friend-empty';
      empty.textContent = 'Abhi koi dost nahi juda. Link share karo!';
      friendsBox.appendChild(empty);
      return;
    }

    ids.forEach(function (id) {
      var e = map[id];
      var sec = Math.min(e.sec || 0, C.NEED_SEC);
      var row = document.createElement('div');
      row.className = 'friend';

      var top = document.createElement('div');
      top.className = 'friend-top';
      var nm = document.createElement('span');
      nm.className = 'friend-name';
      nm.textContent = '👤 ' + (e.n || 'Player');
      var st = document.createElement('span');
      st.className = 'friend-status';
      if (e.paid) st.textContent = '✅ +' + e.paid + ' mile';
      else if (e.ready) st.textContent = '⏳ Points aa rahe hain';
      else st.textContent = mmss(sec) + ' / ' + mmss(C.NEED_SEC);
      top.appendChild(nm);
      top.appendChild(st);

      var bar = document.createElement('div');
      bar.className = 'friend-bar';
      var fill = document.createElement('div');
      fill.style.width = Math.min(100, Math.round((e.ready ? C.NEED_SEC : sec) / C.NEED_SEC * 100)) + '%';
      bar.appendChild(fill);

      row.appendChild(top);
      row.appendChild(bar);
      friendsBox.appendChild(row);
    });
  }

  function addFriendsCard() {
    var how = document.querySelector('.card.how');
    var card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = '<h4 class="card-title">Your Friends</h4><div id="friendsBox"></div>';
    how.parentNode.insertBefore(card, how);
    friendsBox = card.querySelector('#friendsBox');
  }

  // ---------- Link wali jagah (code ke neeche) ----------
  function addLinkRow(card) {
    var row = document.createElement('div');
    row.className = 'link-row';
    row.innerHTML = '<div class="link-box" id="refLink"></div><button type="button" class="copy-btn" id="copyLinkBtn">Copy Link</button>';
    card.appendChild(row);
    $('refLink').textContent = myLink;
    $('copyLinkBtn').addEventListener('click', function () { doCopy(myLink, $('copyLinkBtn'), 'Copied ✓'); });
  }

  // ---------- "Mere dost ka code hai" (agar link se code nahi laga) ----------
  function addCodeEntry(user, afterCard) {
    var card = document.createElement('section');
    card.className = 'card';
    card.innerHTML =
      '<h4 class="card-title">Kisi dost ka referral code hai?</h4>' +
      '<div class="code-row"><input id="enterCode" class="enter-code" maxlength="12" placeholder="PWXXXXXX">' +
      '<button type="button" class="copy-btn" id="applyCodeBtn">Apply</button></div>' +
      '<div class="enter-msg" id="enterMsg"></div>';
    afterCard.parentNode.insertBefore(card, afterCard.nextSibling);

    $('applyCodeBtn').addEventListener('click', function () {
      var v = $('enterCode').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (v.length < 4) { $('enterMsg').textContent = 'Code sahi likho'; return; }
      if (v === myCode) { $('enterMsg').textContent = 'Apna code apne par nahi lagta'; return; }
      try { localStorage.setItem('pw_ref', v); } catch (e) {}
      $('enterMsg').textContent = 'Check ho raha hai...';
      R.applyPending(user).then(function (st) {
        if (st === 'applied') {
          $('enterMsg').textContent = '';
          card.parentNode.removeChild(card);
          R.toast(R.statusText(st));
        } else {
          $('enterMsg').textContent = R.statusText(st) || 'Code nahi laga, dobara try karo';
        }
      }).catch(function () { $('enterMsg').textContent = 'Error, dobara try karo'; });
    });
  }

  // ---------- Shuru ----------
  inviteBtn.addEventListener('click', openSheet);
  shareBtn.addEventListener('click', openSheet);
  copyBtn.addEventListener('click', function () {
    if (!myCode) return;
    doCopy(myCode, copyBtn, 'Copied ✓');
  });
  addFriendsCard();

  R.whenReady(function () {
    R.waitForUser().then(function (user) {
      if (!user) { codeBox.textContent = 'Login karo'; return; }

      // Agar is user ne abhi link se sign up kiya hai to pehle referral lagao
      return R.applyPending(user).then(function (st) {
        var msg = R.statusText(st);
        if (msg) R.toast(msg, st === 'applied');
        return R.ensureCode(user);
      }).then(function (code) {
        myCode = code;
        myLink = R.link(code);
        codeBox.textContent = code;
        addLinkRow(codeBox.closest('.card'));

        // Code daalne wala box: sirf naye account ko, jisne abhi tak koi referral nahi lagaya
        var created = Date.parse(user.metadata && user.metadata.creationTime);
        var isNew = created && (Date.now() - created) < C.NEW_ACCOUNT_HOURS * 3600 * 1000;
        if (isNew) {
          firebase.database().ref('users/' + user.uid + '/referredBy').once('value').then(function (s) {
            if (!s.val()) addCodeEntry(user, codeBox.closest('.card'));
          });
        }

        // Dosto ki list live: jaise hi koi khelta hai, progress badhti dikhegi
        firebase.database().ref('referrals/' + user.uid).on('value', function (snap) {
          var map = snap.val() || {};
          render(map);
          R.claim(user, map);       // jo dost 5 minute khel chuke unke point do (ek hi baar)
        });
      });
    }).catch(function (e) {
      console.error(e);
      codeBox.textContent = 'Error';
      R.toast('Referral load nahi hua. Firebase Rules check karo.', false);
    });
  });
})();
