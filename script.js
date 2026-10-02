// Bottom nav: Leaderboard par click karne se leaderboard.html khulega
document.querySelectorAll('.nav-item').forEach(function (item) {
  item.addEventListener('click', function (e) {
    var label = item.querySelector('span:last-child').textContent.trim();

    if (label === 'Leaderboard') {
      e.preventDefault();
      window.location.href = 'leaderboard.html';
    }
  });
});
// Bottom nav: Referral par click karne se referral.html khulega
document.querySelectorAll('.nav-item').forEach(function (item) {
  item.addEventListener('click', function (e) {
    var label = item.querySelector('span:last-child').textContent.trim();

    if (label === 'Referral') {
      e.preventDefault();
      window.location.href = 'referral.html';
    }
  });
});

// Bottom nav: More par click karne se settings.html khulega
document.querySelectorAll('.nav-item').forEach(function (item) {
  item.addEventListener('click', function (e) {
    var label = item.querySelector('span:last-child').textContent.trim();

    if (label === 'More') {
      e.preventDefault();
      window.location.href = 'settings.html';
    }
  });
});

// Bottom nav: Play par click karne se play.html khulega
document.querySelectorAll('.nav-item').forEach(function (item) {
  item.addEventListener('click', function (e) {
    var label = item.querySelector('span:last-child').textContent.trim();

    if (label === 'Play') {
      e.preventDefault();
      window.location.href = 'play.html';
    }
  });
});

// Play Now button: har game ki apni file kholega (jab banegi)
document.querySelectorAll('.play-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var game = btn.getAttribute('data-game');
    alert(game + ' abhi ban raha hai');
    // game file ban jaye to upar wali line hata kar ye use karna:
    // window.location.href = game + '.html';
  });
});
// Log Out: login status hatao aur login page par bhejo
var logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', function (e) {
    e.preventDefault();
    try {
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('phone');
    } catch (err) {}
    window.location.href = 'login.html';
  });
}