// block-sound.js - Block Blast ki saari awaazein (koi audio file nahi, sab code se)
//
//   BlockSound.pick()          -> block ungli se uthaya
//   BlockSound.place()         -> block board par laga ("tok")
//   BlockSound.clear(lines, c) -> line kati. lines = ek saath kitni lines (1,2,3+), c = lagatar combo (1,2,3..)
//                                  1 line = normal, 2 line = zyada tez, 3+ = sabse tez aur bhari
//   BlockSound.bad()           -> galat jagah chhoda (wapas gaya)
//   BlockSound.stuck()         -> board bhar gaya, koi chaal nahi
//   BlockSound.reset()         -> board saaf hua
//   BlockSound.end()           -> time khatam
//
// Mute: music.js ke 🔊/🔇 button wali hi setting (pw_music_off).
(function () {
  var VOL = 0.9;

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
    master = ctx.createGain();
    master.gain.value = VOL;
    master.connect(comp);
    comp.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    var len = Math.floor(ctx.sampleRate * 0.8);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var ch = ir.getChannelData(c);
      for (var j = 0; j < len; j++) ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 3);
    }
    conv = ctx.createConvolver();
    conv.buffer = ir;
    var wet = ctx.createGain();
    wet.gain.value = 0.3;
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

  function noise(t, dur, f0, f1, type, peak, echo) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    if (echo) g.connect(conv);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  function tone(t, type, f0, f1, dur, peak, lowpass, echo) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    var out = o;
    if (lowpass) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      o.connect(f); out = f;
    }
    out.connect(g); g.connect(master);
    if (echo) g.connect(conv);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // sundar sur (pentatonic) - chadhte hue
  var SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5, 1568.0, 1760.0, 2093.0];

  var api = {
    pick: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'sine', 520, 760, 0.07, 0.18);
    },

    // block lagne ki "tok"
    place: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'sine', 240, 110, 0.16, 0.8);
      tone(t, 'triangle', 700, 300, 0.07, 0.25, 2500);
      noise(t, 0.05, 2500, 600, 'bandpass', 0.35, false);
    },

    bad: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'square', 200, 140, 0.12, 0.12, 900);
    },

    // line kati: lines jitni zyada, utni zyada awaaz aur zyada sur
    clear: function (lines, combo) {
      if (!ready()) return;
      lines = Math.max(1, lines || 1);
      combo = Math.max(1, combo || 1);
      var level = Math.min(3, lines);                 // 1, 2, 3
      var vol = level === 1 ? 0.55 : (level === 2 ? 0.8 : 1.0);
      var t = ctx.currentTime;
      var notes = 3 + level * 2 + Math.min(3, combo - 1);   // zyada line = zyada sur
      var base = Math.min(3, combo - 1);              // combo badhe to sur upar

      // phatne wali "pop" + shor
      noise(t, 0.12 + level * 0.05, 5000, 500, 'lowpass', 0.5 * vol, true);
      tone(t, 'sine', 260 + level * 40, 60, 0.18 + level * 0.04, 0.9 * vol);
      if (level >= 2) noise(t, 0.1, 3500, 1200, 'highpass', 0.35 * vol, false);
      if (level >= 3) {
        tone(t, 'sine', 120, 35, 0.5, 1.0);            // gehri gadgadahat
        noise(t + 0.02, 0.45, 2500, 150, 'lowpass', 0.6, true);
      }

      // chadhti hui ghanti jaisi dhun
      for (var i = 0; i < notes; i++) {
        var f = SCALE[Math.min(SCALE.length - 1, base + i)];
        var tt = t + 0.03 + i * (0.055 - level * 0.006);
        tone(tt, 'triangle', f, f, 0.32, 0.30 * vol, 6000, true);
        tone(tt, 'sine', f * 2, f * 2, 0.22, 0.12 * vol, null, true);
      }
    },

    stuck: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'sawtooth', 330, 200, 0.22, 0.22, 1200);
      tone(t + 0.2, 'sawtooth', 260, 150, 0.35, 0.22, 1000);
    },

    reset: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      noise(t, 0.5, 600, 4000, 'bandpass', 0.35, true);
      tone(t, 'sine', 300, 900, 0.4, 0.25, null, true);
    },

    end: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'triangle', 784, 784, 0.25, 0.3, 4000, true);
      tone(t + 0.15, 'triangle', 659, 659, 0.25, 0.3, 4000, true);
      tone(t + 0.3, 'triangle', 523, 523, 0.5, 0.3, 4000, true);
    }
  };

  window.BlockSound = api;

  function unlock() {
    if (!muted() && init() && ctx.state === 'suspended') ctx.resume();
  }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

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
