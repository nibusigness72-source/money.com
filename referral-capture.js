// referral-capture.js - Link se aaya referral code yaad rakho (login.html aur auth.html par lagta hai)
// Link aisa hota hai:  .../login.html?ref=PWAB12CD
(function () {
  try {
    var m = location.search.match(/[?&]ref=([A-Za-z0-9]{4,20})/);
    if (m) localStorage.setItem('pw_ref', m[1].toUpperCase());
  } catch (e) {}
})();
