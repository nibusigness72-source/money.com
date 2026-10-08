// fake-board.js - leaderboard ke sabse UPAR 5 "fake account" (rank 1 se 5)
//
// Kya hota hai:
//   * Daily / Weekly / Monthly teeno mein rank 1 se 5 par hamesha fake accounts.
//   * Ye asli rows jaise hi hain: rank ka number, mukut (rank 1-3), inaam wala column, admin ke liye ✎.
//     Inaam kitna dikhega ye prize-admin.js decide karta hai, jaise pehle karta tha.
//   * Har fake ke naam ke neeche likha aata hai: "fake account"  (taaki koi confuse na ho).
//   * Fake ke point hamesha asli No.1 se 500 - 1000 zyada.
//   * Fake ke naam har din badalte hain (din subah 8 baje se, baaki leaderboard jaisa).
//   * Asli players rank 6 se shuru hote hain.
//   * Fake accounts database mein kahin save nahi hote, sirf screen par dikhte hain.
//     Isliye unke rank ka inaam kisi ke account mein nahi jaata.
//
// Lagana: leaderboard.html mein live-board.js ke BAAD:
//     <script src="fake-board.js"></script>
//
// Hatana (asli launch se pehle): neeche  enabled: false  kar do. Leaderboard bilkul pehle jaisa ho jaayega.

(function () {

  /* ===================== YAHAN SE BADLO ===================== */
  var FAKE = {
    enabled: true,                 // false = fake accounts gayab, leaderboard bilkul asli
    count: 5,                      // kitne fake upar (3 karna ho to 3 likho, zyada se zyada 10)
    gapMin: 1000, gapMax: 2000,     // asli No.1 se sabse neeche wale fake ka point ka antar
    stepMin: 400, stepMax: 1500,     // ek fake se agle fake ke beech point ka antar
    label: '',         // naam ke neeche jo likha dikhega
    base: { daily: 400, weekly: 1500, monthly: 4000 }   // abhi koi asli player na ho to itne point se shuru
  };
  /* ========================================================== */

  var NAMES = [
    'Aarav S.', 'Vivaan K.', 'Aditya R.', 'Rohan M.', 'Karan P.', 'Arjun T.', 'Ishaan D.', 'Rahul V.',
    'Amit G.', 'Sumit B.', 'Deepak N.', 'Manish Y.', 'Vikas L.', 'Sanjay C.', 'Nitin J.', 'Pankaj H.',
    'Ankit A.', 'Gaurav F.', 'Harsh Q.', 'Yash W.', 'Ravi U.', 'Suraj O.', 'Mohit E.', 'Ajay Z.',
    'Priya S.', 'Neha K.', 'Pooja R.', 'Anjali M.', 'Kavya P.', 'Riya T.', 'Sneha D.', 'Isha V.',
    'Divya G.', 'Komal B.', 'Nisha N.', 'Swati Y.', 'Megha L.', 'Pallavi C.', 'Tanvi J.', 'Shruti H.',
    'Rakesh A.', 'Dinesh F.', 'Mukesh Q.', 'Lokesh W.', 'Naveen U.', 'Bharat O.', 'Tarun E.', 'Varun Z.'
  ];

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Ek hi seed se hamesha ek jaise random number (isliye din bhar list wahi rehti hai)
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function between(rand, a, b) {
    return Math.round(a + rand() * (b - a));
  }

  // Aaj ki "tarikh" (subah 8 baje se naya din), score.js jaisi hi
  function dayKey() {
    try { return PWScore.keys(Date.now()).day; } catch (e) {}
    var d = new Date(Date.now() + 5.5 * 3600000 - 8 * 3600000);
    return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
  }

  function makeFakes(n, realRows) {
    var period = (window.state && state.period) || 'monthly';
    var rand = rng(hash(period + '|' + dayKey()));

    // naam: bina repeat ke
    var pool = NAMES.slice(), names = [];
    for (var i = 0; i < n; i++) {
      names.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    }

    // point: asli No.1 se upar. Neeche se upar ki taraf banate hain.
    var realTop = realRows.length ? (realRows[0].points || 0) : 0;
    var start = Math.max(realTop, FAKE.base[period] || 0);
    var pts = [];
    var cur = start + between(rand, FAKE.gapMin, FAKE.gapMax);
    for (var k = n - 1; k >= 0; k--) {
      pts[k] = cur;
      cur += between(rand, FAKE.stepMin, FAKE.stepMax);
    }

    var out = [];
    for (var j = 0; j < n; j++) out.push({ name: names[j], points: pts[j], uid: '', me: false });
    return out;
  }

  if (!FAKE.enabled || typeof render !== 'function') return;

  var css = document.createElement('style');
  css.textContent =
    '.fk-tag{display:block;margin-top:2px;font-size:10px;font-weight:700;line-height:1.1;color:#fb923c;letter-spacing:.2px}';
  document.head.appendChild(css);

  // live-board.js ki list ke saamne fake rows jod do. Baaki sab (mukut, inaam, ✎) wahi purane code se banta hai.
  var origRender = render;
  render = function (rows) {
    var n = Math.max(0, Math.min(10, FAKE.count | 0));
    var total = (window.state && state.count) || (rows.length + n);   // Top 10 / 50 / 100 ginti wahi rahe
    var merged = makeFakes(n, rows).concat(rows).slice(0, Math.max(total, n));
    origRender(merged);

    var list = document.querySelectorAll('.list .row');
    for (var i = 0; i < n && i < list.length; i++) {
      var row = list[i];
      row.classList.add('fk');
      var nm = row.querySelector('.nm');
      if (nm) {
        var tag = document.createElement('small');
        tag.className = 'fk-tag';
        tag.textContent = FAKE.label;
        nm.appendChild(tag);
      }
    }
  };
})();
