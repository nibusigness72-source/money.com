// skeleton.js - Naam, photo, ID, wallet aur list jab tak load ho rahe hon tab khaali chamakte dibbe dikhao.
// Sirf EK line lagani hai (har page ke sabse neeche):  <script src="skeleton.js"></script>
// Ye apni CSS (skeleton.css) khud jod leti hai.
(function () {
  var MAX_WAIT = 8000;   // 8 second baad bhi data na aaye (net band) to dibbe hata do

  // 1) CSS jodo (skeleton.js ke saath wali skeleton.css)
  var me = document.currentScript, base = me && me.src ? me.src.replace(/[^\/]*$/, '') : '';
  var lk = document.createElement('link');
  lk.rel = 'stylesheet'; lk.href = base + 'skeleton.css';
  document.head.appendChild(lk);

  // 2) Chhote items: naam / ID / photo / wallet. Inme se koi bhi badle to poora group "load ho gaya" maana jayega
  var GROUPS = [
    ['#homeName', '#homeId', '#homeAvatar'],                                   // Home aur Play page
    ['#profileName', '#profileId', '#profileAvatar'],                          // Settings page
    ['.wallet-amount', '.wallet-bottom span:first-child b.green']              // Wallet (Home + Settings)
  ];
  // Inme se yahi "photo" wale hain jo khud nahi badalte, group ke saath hatenge
  var PASSIVE = { '#homeAvatar': 1, '#profileAvatar': 1 };

  function startGroup(sels) {
    var els = [], watch = [];
    sels.forEach(function (s) {
      document.querySelectorAll(s).forEach(function (e) {
        e.classList.add('skeleton'); els.push(e);
        if (!PASSIVE[s]) watch.push(e);
      });
    });
    if (!els.length) return;
    var done = false, obs = [];
    function end() {
      if (done) return; done = true;
      els.forEach(function (e) { e.classList.remove('skeleton'); });
      obs.forEach(function (o) { o.disconnect(); });
    }
    watch.forEach(function (e) {
      var o = new MutationObserver(end);
      o.observe(e, { childList: true, characterData: true, subtree: true });
      obs.push(o);
    });
    setTimeout(end, MAX_WAIT);
  }

  // 3) List: leaderboard (.list), history/payout list (#list, #mine)
  var LISTS = ['.list', '#list', '#mine'], ROWS = 6;
  function skRow() {
    var r = document.createElement('div');
    r.className = 'sk-row';
    r.innerHTML = '<i class="sk-c skeleton"></i><div class="sk-m"><i class="sk-l skeleton"></i><i class="sk-s skeleton"></i></div><i class="sk-a skeleton"></i>';
    return r;
  }
  function realChildren(c) {
    return Array.prototype.filter.call(c.children, function (x) { return !x.classList.contains('sk-row'); });
  }
  function startList(c) {
    var real = realChildren(c);
    // shuru mein sirf "Load ho raha hai..." jaisa likha ho to use hata do
    if (real.length === 1 && real[0].classList.contains('empty')) { real[0].remove(); real = []; }
    if (real.length) return;                      // pehle se data hai
    function fill() { for (var i = 0; i < ROWS; i++) c.appendChild(skRow()); }
    fill();
    var timer = setTimeout(clear, MAX_WAIT), busy = false;
    function clear() { c.querySelectorAll('.sk-row').forEach(function (r) { r.remove(); }); }
    var o = new MutationObserver(function () {
      if (busy) return; busy = true;
      var r = realChildren(c);
      if (r.length) { clear(); }                  // asli data aaya -> dibbe hatao
      else if (!c.children.length && c.matches('.list')) { fill(); }   // tab badalne par list khaali -> phir dibbe
      busy = false;
    });
    o.observe(c, { childList: true });
  }

  function init() {
    GROUPS.forEach(startGroup);
    LISTS.forEach(function (s) { document.querySelectorAll(s).forEach(startList); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
