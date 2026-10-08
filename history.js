// history.js - Game History: har game aur referral ke point, naye se purane
//
// Data kahan se aata hai:  users/<uid>/history/<id> = { type, game, points, from, time }
//   type = 'game'     -> game, points, time        (score.js likhta hai)
//   type = 'referral' -> from (dost ka naam), points, time   (referral-core.js likhta hai)
(function () {
  var PAGE = 10;   // ek baar mein kitni entry dikhani hain

  // Game ka naam, icon aur rang (naya game judne par yahin ek line jodo)
  var GAMES = {
    'knife-hit':    { name: 'Knife Hit',    icon: '🔪', bg: '#b91c1c' },
    'stack-tower':  { name: 'Stack Tower',  icon: '🗼', bg: '#15803d' },
    'flip-ball':    { name: 'Flip Ball',    icon: '🏀', bg: '#c2410c' },
    'fly-modi':     { name: 'Fly Modi',     icon: '🐦', bg: '#0e7490' },
    'fruit-cut':    { name: 'Fruit Cut',    icon: '🍉', bg: '#be185d' },
    'block-blast':  { name: 'Block Blast',  icon: '🟦', bg: '#1d4ed8' },
    'gem-blast':    { name: 'Gem Blast',    icon: '💎', bg: '#6d28d9' },
    'endless-ride': { name: 'Endless Ride', icon: '🚗', bg: '#1d4ed8' },
    'memory-match': { name: 'Memory Match', icon: '🃏', bg: '#7c3aed' },
    'arrow-escape':  { name: 'Arrow Escape',  icon: '🏹', bg: '#b45309' },
    'ball-blast':  { name: 'Ball Blast',  icon: '🔮', bg: '#7c3aed' },
    'target-hit':   { name: 'Target Hit',   icon: '🎯', bg: '#b91c1c' },
  };
  var REF = { name: 'Referral Reward', icon: '👥', bg: '#0e7490' };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var listEl = document.getElementById('hList');
  var moreBtn = document.getElementById('moreBtn');

  var db = firebase.database();
  var me = null, oldestKey = null, loading = false, lastDay = '';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(n) { return (+n || 0).toLocaleString('en-IN'); }

  // Naam wagairah screen par daalne se pehle saaf karo (koi HTML na ghus sake)
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function timeText(ms) {
    var d = new Date(ms), h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return pad(h) + ':' + pad(d.getMinutes()) + ' ' + ap;
  }

  function dateText(ms) {
    var d = new Date(ms);
    return pad(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  // Aaj / Kal / tarikh
  function dayLabel(ms) {
    var d = new Date(ms), now = new Date();
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var diff = Math.round((b - a) / 86400000);
    if (diff === 0) return 'Aaj';
    if (diff === 1) return 'Kal';
    return dateText(ms);
  }

  function prettyId(id) {
    return String(id || 'game').split('-').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function rowHtml(v) {
    var isRef = v.type === 'referral';
    var g = isRef ? REF : (GAMES[v.game] || { name: prettyId(v.game), icon: '🎮', bg: '#1d4ed8' });
    var sub = isRef ? 'From: ' + (v.from || 'Dost') : 'Game';
    var hasTime = typeof v.time === 'number';
    var detail = (hasTime ? dateText(v.time) + ', ' + timeText(v.time) : '') +
      (hasTime ? '  |  ' : '') + g.name + '  +' + fmt(v.points) + ' points';

    return '<div class="h-row">' +
      '<div class="h-main">' +
        '<div class="h-icon" style="background:' + g.bg + '">' + g.icon + '</div>' +
        '<div class="h-info"><span class="h-name">' + esc(g.name) + '</span>' +
          '<span class="h-sub">' + esc(sub) + '</span></div>' +
        '<div class="h-right"><span class="h-pts">+' + fmt(v.points) + '</span>' +
          '<span class="h-time">' + (hasTime ? timeText(v.time) : '') + '</span></div>' +
        '<span class="h-arrow">›</span>' +
      '</div>' +
      '<div class="h-detail">' + esc(detail) + '</div>' +
    '</div>';
  }

  function message(text) {
    listEl.innerHTML = '<div class="h-empty">' + esc(text) + '</div>';
    moreBtn.style.display = 'none';
  }

  function render(items, first) {
    var html = '';
    items.forEach(function (it) {
      var v = it.v;
      if (typeof v.time === 'number') {
        var lbl = dayLabel(v.time);
        if (lbl !== lastDay) { html += '<div class="h-day">' + esc(lbl) + '</div>'; lastDay = lbl; }
      }
      html += rowHtml(v);
    });
    if (first) listEl.innerHTML = html;
    else listEl.insertAdjacentHTML('beforeend', html);
  }

  function load(first) {
    if (loading || !me) return;
    loading = true;
    moreBtn.disabled = true;

    // Push ID waqt ke hisaab se chalti hai, isliye key se hi naye-purane ka kram mil jata hai
    var q = db.ref('users/' + me.uid + '/history').orderByKey();
    if (!first && oldestKey) q = q.endBefore(oldestKey);

    q.limitToLast(PAGE).once('value').then(function (snap) {
      var items = [];
      snap.forEach(function (c) { items.push({ key: c.key, v: c.val() || {} }); });
      items.reverse();                                   // sabse naya upar

      if (first && !items.length) { message('Abhi koi history nahi. Koi game khelo!'); return; }

      if (items.length) oldestKey = items[items.length - 1].key;
      render(items, first);
      moreBtn.style.display = items.length === PAGE ? 'block' : 'none';
    }).catch(function () {
      if (first) message('History load nahi hui. Dobara try karo.');
    }).then(function () {
      loading = false;
      moreBtn.disabled = false;
    });
  }

  // Entry par dabane se tarikh aur samay khulta hai
  listEl.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== listEl && !(el.classList && el.classList.contains('h-row'))) el = el.parentNode;
    if (el && el !== listEl) el.classList.toggle('open');
  });

  moreBtn.addEventListener('click', function () { load(false); });

  firebase.auth().onAuthStateChanged(function (user) {
    me = user || null;
    oldestKey = null; lastDay = '';
    if (!me) { message('History dekhne ke liye pehle login karo'); return; }
    load(true);
  });
})();