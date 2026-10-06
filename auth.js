// auth.js - Firebase Phone OTP

var OTP_SECONDS = 120;

var phoneInput = document.getElementById('phone');
var getOtpBtn  = document.getElementById('getOtpBtn');
var shownPhone = document.getElementById('shownPhone');
var timerEl    = document.getElementById('timer');
var otpBoxes   = document.querySelectorAll('.otp-box');
var phoneBox   = document.querySelector('.phone-box');
var otpCard    = document.querySelector('.otp-row').closest('.card');

var confirmationResult = null;
var recaptchaVerifier = null;
var currentPhone = '';
var timerId = null;
var verifying = false;

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function showTime(sec) {
  timerEl.textContent = pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
}

// Shuru mein OTP card band
function lockOtp() {
  otpCard.classList.add('locked');
  otpBoxes.forEach(function (b) {
    b.value = '';
    b.disabled = true;
  });
  showTime(OTP_SECONDS);
}

// OTP bhejne ke baad OTP card khulta hai
function unlockOtp() {
  otpCard.classList.remove('locked');
  otpBoxes.forEach(function (b) {
    b.value = '';
    b.disabled = false;
  });
  otpBoxes[0].focus();
}

function startTimer() {
  clearInterval(timerId);
  var left = OTP_SECONDS;
  showTime(left);
  getOtpBtn.disabled = true;
  getOtpBtn.textContent = 'Resend OTP';

  timerId = setInterval(function () {
    left--;
    showTime(left);
    if (left <= 0) {
      clearInterval(timerId);
      getOtpBtn.disabled = false;
    }
  }, 1000);
}

// Invisible reCAPTCHA (har baar naya)
function newRecaptcha() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch (e) {}
  }
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size: 'invisible'
  });
}

function errorText(err) {
  switch (err.code) {
    case 'auth/invalid-phone-number':
      return 'Mobile number sahi nahi hai';
    case 'auth/too-many-requests':
      return 'Bahut baar try kiya, thodi der baad try karo';
    case 'auth/billing-not-enabled':
      return 'Firebase mein Blaze plan on karo, ya test number use karo';
    case 'auth/operation-not-allowed':
      return 'Firebase mein Phone sign-in on nahi hai ya ye region band hai';
    case 'auth/unauthorized-domain':
      return 'Is website ka domain Firebase ke Authorized domains mein add karo';
    case 'auth/invalid-verification-code':
      return 'Galat OTP, dobara daalo';
    case 'auth/code-expired':
      return 'OTP ka time khatam ho gaya, Resend OTP dabao';
    default:
      return 'Error: ' + (err.code || err.message);
  }
}

// Mobile number mein sirf digit
phoneInput.addEventListener('input', function () {
  phoneInput.value = phoneInput.value.replace(/\D/g, '');
  phoneBox.classList.remove('error');
});

// Get OTP / Resend OTP
getOtpBtn.addEventListener('click', function () {
  var num = phoneInput.value.replace(/\D/g, '');

  if (!/^[6-9]\d{9}$/.test(num)) {
    phoneBox.classList.add('error');
    alert('Sahi 10 digit mobile number daalo');
    return;
  }

  getOtpBtn.disabled = true;
  getOtpBtn.textContent = 'Sending...';
  newRecaptcha();

  firebase.auth().signInWithPhoneNumber('+91' + num, recaptchaVerifier)
    .then(function (result) {
      confirmationResult = result;
      currentPhone = num;
      shownPhone.textContent = num.slice(0, 5) + ' ' + num.slice(5);
      unlockOtp();
      startTimer();
    })
    .catch(function (err) {
      alert(errorText(err));
      getOtpBtn.disabled = false;
      getOtpBtn.textContent = 'Get OTP';
    });
});

// OTP check
function checkOtp() {
  var code = '';
  otpBoxes.forEach(function (b) { code += b.value; });

  if (code.length < 6 || !confirmationResult || verifying) return;

  verifying = true;
  confirmationResult.confirm(code)
    .then(function () {
      try {
        localStorage.setItem('loggedIn', '1');
        localStorage.setItem('phone', currentPhone);
      } catch (e) {}
      window.location.href = 'index.html';
    })
    .catch(function (err) {
      verifying = false;
      alert(errorText(err));
      otpBoxes.forEach(function (b) { b.value = ''; });
      otpBoxes[0].focus();
    });
}

// OTP boxes: type karte hi agle box mein, backspace par pichhle mein, paste bhi chalega
otpBoxes.forEach(function (box, i) {
  box.addEventListener('input', function () {
    box.value = box.value.replace(/\D/g, '');
    if (box.value && i < otpBoxes.length - 1) {
      otpBoxes[i + 1].focus();
    }
    checkOtp();
  });

  box.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !box.value && i > 0) {
      otpBoxes[i - 1].focus();
    }
  });

  box.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text');
    text = text.replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    text.split('').forEach(function (ch, k) { otpBoxes[k].value = ch; });
    otpBoxes[Math.min(text.length, 5)].focus();
    checkOtp();
  });
});

// ---------- Google se login ----------
var googleBtn = document.getElementById('googleBtn');

function googleDone(user) {
  try {
    localStorage.setItem('loggedIn', '1');
    localStorage.setItem('phone', user.email || '');
  } catch (e) {}
  window.location.href = 'index.html';
}

googleBtn.addEventListener('click', function () {
  googleBtn.disabled = true;
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  firebase.auth().signInWithPopup(provider)
    .then(function (res) { googleDone(res.user); })
    .catch(function (err) {
      // Popup block ho to redirect se try karo
      if (err.code === 'auth/popup-blocked' ||
          err.code === 'auth/operation-not-supported-in-this-environment') {
        firebase.auth().signInWithRedirect(provider);
        return;
      }
      googleBtn.disabled = false;
      if (err.code === 'auth/popup-closed-by-user' ||
          err.code === 'auth/cancelled-popup-request') return;
      alert(errorText(err));
    });
});

// Redirect se wapas aane par
firebase.auth().getRedirectResult().then(function (res) {
  if (res && res.user) googleDone(res.user);
}).catch(function (err) { alert(errorText(err)); });
lockOtp();