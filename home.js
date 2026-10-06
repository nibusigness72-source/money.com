// home.js - home page: naam, photo aur ID database se dikhao

var nameEl   = document.getElementById('homeName');
var idEl     = document.getElementById('homeId');
var avatarEl = document.getElementById('homeAvatar');

var db = firebase.database();

// Photo na ho to ye chhota default dikhega
var DEFAULT_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#1e3a8a"/>' +
  '<circle cx="50" cy="38" r="18" fill="#9fb0d9"/>' +
  '<path d="M16 92c4-24 20-34 34-34s30 10 34 34z" fill="#9fb0d9"/></svg>'
);

avatarEl.src = DEFAULT_PHOTO;

function randomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

firebase.auth().onAuthStateChanged(function (user) {
  // Login nahi hai
  if (!user) {
    nameEl.textContent = 'Guest';
    idEl.textContent = 'ID: ------';
    return;
  }

  var ref = db.ref('users/' + user.uid);

  ref.once('value').then(function (snap) {
    var data = snap.val() || {};

if (!data.name && user.displayName) { data.name = user.displayName.slice(0, 20); ref.child('name').set(data.name); }
    if (!data.photo && user.photoURL) { data.photo = user.photoURL; ref.child('photo').set(data.photo); }
    nameEl.textContent = data.name || 'Player';
    if (data.photo) avatarEl.src = data.photo;

    if (data.playerId) {
      idEl.textContent = 'ID: ' + data.playerId;
    } else {
      // Pehli baar: apna 6 digit ID banao aur save karo
      var newId = randomId();
      ref.child('playerId').set(newId).then(function () {
        idEl.textContent = 'ID: ' + newId;
      });
    }

    // Phone number save na ho to save kar do
    if (!data.phone && user.phoneNumber) {
      ref.child('phone').set(user.phoneNumber);
    }
  }).catch(function () {
    nameEl.textContent = 'Player';
  });
});