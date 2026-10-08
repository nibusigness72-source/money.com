// ball-sound.js - Ball Blast ki awaazein: PAANI KE BULBULE jaisi ("bloop", "blup", "plip")
// Koi audio file nahi chahiye, sab code se banti hain.
//
//   BallSound.shoot()    -> ball chhoota: naram "bloop" upar ki taraf
//   BallSound.stick(n)   -> ball chipka: halka "blup"
//   BallSound.pop(n)     -> n bulbule phoote: har ek ki alag "bloop", ek ke peeche ek, sur chadhta hua
//   BallSound.fall(n)    -> latke ball gire: paani ki boondon jaisi "plip-plip"
//   BallSound.swap()     -> dono ball badle: do chhote bulbule
//   BallSound.danger()   -> ball neeche aa gaye: gehri gargar
//   BallSound.end()      -> time khatam: bulbulon ki jhadi
//
// Mute: music.js ke 🔊/🔇 button wali hi setting (pw_music_off).
(function () {
  var VOL = 0.95;                    // kul awaaz (0 se 1)
  var ctx = null, master = null, conv = null, noiseBuf = null;

  function muted() {
    try { return localStorage.getItem('pw_music_off') === '1'; } catch (e) { return false; }
  }

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = VOL;
    master.connect(comp);
    comp.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // paani ke andar jaisi halki goonj
    var len = Math.floor(ctx.sampleRate * 0.45);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var ch = ir.getChannelData(c);
      for (var j = 0; j < len; j++) ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 4);
    }
    conv = ctx.createConvolver();
    conv.buffer = ir;
    var wet = ctx.createGain();
    wet.gain.value = 0.28;
    conv.connect(wet);
    wet.connect(master);
    return true;
  }

  function ready() {
    if (muted()) return false;
    if (!init()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ---- ek bulbula: sur tezi se UPAR chadhta hai (asli paani ke bulbule ki pehchaan), phir naram ho kar mit jaata hai ----
  //   f      : bulbule ka sur (chhota bulbula = oonchi awaaz)
  //   rise   : sur kitna chadhega (1.6 = 60% upar)
  //   dur    : kitni der goonje
  //   vol    : awaaz
  function bloop(t, f, rise, dur, vol, echo) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * rise, t + dur * 0.55);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);          // naram shuruaat (click nahi)
    g.gain.setTargetAtTime(0.0001, t + 0.012, dur * 0.28);   // paani jaisa sukoon se mitna
    o.connect(g);
    g.connect(master);
    if (echo) g.connect(conv);
    o.start(t);
    o.stop(t + dur + 0.2);

    // upar ka halka doosra sur: bulbule ko "geela" rang deta hai
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(f * 2.02, t);
    o2.frequency.exponentialRampToValueAtTime(f * 2.02 * rise, t + dur * 0.55);
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(vol * 0.22, t + 0.006);
    g2.gain.setTargetAtTime(0.0001, t + 0.008, dur * 0.16);
    o2.connect(g2);
    g2.connect(master);
    o2.start(t);
    o2.stop(t + dur * 0.8);
  }

  // paani ki chhinte jaisi bahut halki "sshh"
  function splash(t, vol, dur, f) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var fl = ctx.createBiquadFilter();
    fl.type = 'bandpass';
    fl.frequency.value = f || 2200;
    fl.Q.value = 0.9;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  var api = {
    // Ball chhoota: ek naram "bloop" jo upar ki taraf jaata hai
    shoot: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      bloop(t, rnd(300, 340), 2.1, 0.16, 0.42, true);
      splash(t, 0.06, 0.1, 1800);
    },

    // Ball chipka: halka, gehra "blup"
    stick: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      bloop(t, rnd(170, 200), 1.45, 0.14, 0.5, true);
    },

    // n bulbule phoote. Har ek alag chhota/bada bulbula (alag sur), ek ke baad ek, sur upar chadhta hua
    pop: function (n) {
      if (!ready()) return;
      n = Math.max(1, n || 1);
      var t0 = ctx.currentTime, shown = Math.min(n, 10), i;
      for (i = 0; i < shown; i++) {
        var t = t0 + i * 0.055 + rnd(0, 0.012);
        var f = 330 * Math.pow(1.085, i) * rnd(0.93, 1.07);     // har bulbule ka sur thoda alag
        bloop(t, f, rnd(1.7, 2.3), rnd(0.12, 0.17), 0.5, i === 0 || i === shown - 1);
        if (i % 2 === 0) splash(t, 0.05, 0.07, rnd(1800, 3200));
      }
      // bahut saare phoote to upar se kuch chhote chamakdar bulbule
      if (n >= 6) {
        for (i = 0; i < 4; i++) bloop(t0 + 0.08 + i * 0.07, rnd(900, 1500), rnd(1.5, 1.9), 0.09, 0.2, true);
        bloop(t0, 140, 1.5, 0.25, 0.5, true);     // neeche ki gehri "bloomp"
      }
    },

    // Latke ball gire: paani ki boondon ki "plip-plip", ek ke baad ek, dheere-dheere halki hoti hui
    fall: function (n) {
      if (!ready()) return;
      n = Math.max(1, n || 1);
      var t0 = ctx.currentTime + 0.1, shown = Math.min(n, 7);
      for (var i = 0; i < shown; i++) {
        var t = t0 + i * 0.075 + rnd(0, 0.02);
        var f = rnd(700, 1250);
        bloop(t, f, rnd(1.25, 1.55), 0.08, 0.28 * (1 - i * 0.07), true);
      }
    },

    // Dono ball badle: do chhote bulbule
    swap: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      bloop(t, 520, 1.6, 0.07, 0.3, false);
      bloop(t + 0.07, 680, 1.6, 0.07, 0.3, false);
    },

    // Khatra: neeche se gehri gargar
    danger: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) bloop(t + i * 0.11, rnd(110, 150), 1.5, 0.22, 0.5, true);
    },

    // Time khatam: bulbulon ki jhadi, upar se neeche
    end: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 8; i++) bloop(t + i * 0.09, 1100 - i * 100, 1.7, 0.14, 0.35, true);
      bloop(t + 0.75, 220, 1.5, 0.4, 0.5, true);
    }
  };

  window.BallSound = api;

  // Mobile par pehle tap ke baad hi awaaz nikalti hai
  function unlock() {
    if (!muted() && init() && ctx.state === 'suspended') ctx.resume();
  }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // Agar music.js nahi lagi hai to apna chhota 🔊/🔇 button
  function addButton() {
    if (window.PWMusic || !document.body) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99998;width:40px;height:40px;' +
      'border-radius:50%;border:2px solid rgba(255,255,255,.85);background:rgba(0,0,0,.45);' +
      'color:#fff;font-size:20px;line-height:1;cursor:pointer;padding:0;';
    function paint() { b.textContent = muted() ? '🔇' : '🔊'; }
    paint();
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      try { localStorage.setItem('pw_music_off', muted() ? '0' : '1'); } catch (err) {}
      paint();
    });
    document.body.appendChild(b);
  }
  if (document.body) addButton(); else document.addEventListener('DOMContentLoaded', addButton);
})();
