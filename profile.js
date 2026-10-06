// profile.js - settings page: naam aur photo badalna, Realtime Database mein save

var avatarEl   = document.getElementById('profileAvatar');
var nameEl     = document.getElementById('profileName');
var photoInput = document.getElementById('photoInput');

var db = firebase.database();
var currentUser = null;

function showPhoto(src) {
  avatarEl.innerHTML = '';
  var img = document.createElement('img');
  img.src = src;
  img.alt = 'Profile';
  avatarEl.appendChild(img);
}

// Login hone par uska saved naam aur photo laao
firebase.auth().onAuthStateChanged(function (user) {
  if (!user) return;
  currentUser = user;

  db.ref('users/' + user.uid).once('value').then(function (snap) {
    var data = snap.val() || {};
    if (data.name) nameEl.textContent = data.name;
    if (data.photo) showPhoto(data.photo);
    document.getElementById('profileId').textContent = data.playerId ? 'ID: ' + data.playerId : 'ID: ------';

  // Phone ya email bhi save karo, taaki pata chale ye kiska account hai
    if (!data.phone && user.phoneNumber) {
      db.ref('users/' + user.uid + '/phone').set(user.phoneNumber);
    } else if (!data.email && user.email) {
      db.ref('users/' + user.uid + '/email').set(user.email);
    }
  }).catch(function () {
    alert('Data nahi aaya. Database Rules check karo.');
  });
});

// Naam par click: naya naam poochho aur save karo
nameEl.addEventListener('click', function () {
  if (!currentUser) {
    alert('Pehle login karo');
    return;
  }

  var n = prompt('Apna naam likho', nameEl.textContent.trim());
  if (n === null) return;
  n = n.trim();

  if (n.length < 2 || n.length > 20) {
    alert('Naam 2 se 20 akshar ka rakho');
    return;
  }

  db.ref('users/' + currentUser.uid + '/name').set(n)
    .then(function () { nameEl.textContent = n; })
    .catch(function () { alert('Save nahi hua, dobara try karo'); });
});



// Photo ko chhota (150x150) karke text bana do
function resizeImage(file, size, done) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');

      // beech ka square hissa kaato
      var min = Math.min(img.width, img.height);
      var sx = (img.width - min) / 2;
      var sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

      done(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

photoInput.addEventListener('change', function () {
  var file = photoInput.files[0];


  if (!file) return;
  if (!currentUser) {
    alert('Pehle login karo');
    photoInput.value = '';
    return;
  }

  if (file.type.indexOf('image/') !== 0) {
    alert('Sirf photo chuno');
    return;
  }

  resizeImage(file, 150, function (dataUrl) {
    db.ref('users/' + currentUser.uid + '/photo').set(dataUrl)
      .then(function () { showPhoto(dataUrl); })
      .catch(function () { alert('Photo save nahi hui, dobara try karo'); });
  });

  photoInput.value = '';
});