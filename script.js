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

// Play Now button: game ka page kholega
document.querySelectorAll('.play-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var game = btn.getAttribute('data-game');
    var ready = ['fly-modi','flip-ball','fruit-cut' ,'stack-tower', 'knife-hit','gem-blast'];
    if (ready.indexOf(game) !== -1) {
      window.location.href = game + '.html';
    } else {
      alert(game + ' abhi ban raha hai');
    }
  });
});

// Log Out: login status hatao, Firebase se bhi logout karo, phir login page par bhejo
var logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', function (e) {
    e.preventDefault();
    try {
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('phone');
    } catch (err) {}

    function go() { window.location.href = 'login.html'; }

    if (window.firebase && firebase.auth) {
      firebase.auth().signOut().then(go, go);
    } else {
      go();
    }
  });
}
// home.html wale saare links ko index.html par bhejo (home page ka naam index.html hai)
document.querySelectorAll('a[href="home.html"]').forEach(function (a) {
  a.setAttribute('href', 'index.html');
});
