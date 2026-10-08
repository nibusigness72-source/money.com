// ball-sound.js - Ball Blast ki saari awaazein (koi audio file nahi, sab code se)
//
//   BallSound.shoot()     -> ball chhoota ("fush")
//   BallSound.stick(n)    -> ball chipka ("tok")
//   BallSound.pop(n)      -> n ball phoote (har ball ki alag "pop", sur chadhta jaata hai; 6+ par badi dhun)
//   BallSound.fall(n)     -> n ball latak kar gire (neeche girti khanak)
//   BallSound.swap()      -> dono ball badle
//   BallSound.danger()    -> ball neeche tak aa gaye
//   BallSound.end()       -> time khatam
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

    var len = Math.floor(ctx.sampleRate * 0.6);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var ch = ir.getChannelData(c);
      for (var j = 0; j < len; j++) ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 3);
    }
    conv = ctx.createConvolver();
    conv.buffer = ir;
    var wet = ctx.createGain();
    wet.gain.value = 0.25;
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
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
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

  var api = {
    shoot: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      noise(t, 0.13, 500, 2600, 'bandpass', 0.35, false);
      tone(t, 'sine', 260, 760, 0.12, 0.3);
    },

    stick: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'sine', 210, 90, 0.12, 0.7);
      noise(t, 0.04, 1800, 500, 'lowpass', 0.3, false);
    },

    // n ball phoote: har ek "pop", sur upar chadhta hua
    pop: function (n) {
      if (!ready()) return;
      n = Math.max(1, n || 1);
      var t0 = ctx.currentTime, shown = Math.min(n, 9), i;
      for (i = 0; i < shown; i++) {
        var t = t0 + i * 0.05;
        var f = 430 * Math.pow(1.07, i);
        tone(t, 'sine', f * 1.5, f * 0.7, 0.11, 0.5);
        tone(t, 'triangle', f * 3, f, 0.06, 0.15);
        noise(t, 0.045, 3500, 1200, 'highpass', 0.3, false);
      }
      if (n >= 6) {                                 // bada dhamaka: chadhti dhun
        var sc = [523, 659, 784, 1047, 1319];
        for (i = 0; i < sc.length; i++) tone(t0 + 0.04 + i * 0.06, 'triangle', sc[i], sc[i], 0.3, 0.2, 5000, true);
        tone(t0, 'sine', 150, 50, 0.3, 0.7);
      }
    },

    // latak kar gire hue ball
    fall: function (n) {
      if (!ready()) return;
      n = Math.max(1, n || 1);
      var t0 = ctx.currentTime + 0.12, shown = Math.min(n, 7);
      for (var i = 0; i < shown; i++) {
        var t = t0 + i * 0.06;
        var f = 1500 - i * 110;
        tone(t, 'sine', f, f * 0.55, 0.16, 0.22, null, true);
        tone(t, 'triangle', f * 2, f, 0.07, 0.07);
      }
    },

    swap: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'triangle', 600, 900, 0.06, 0.2);
      tone(t + 0.06, 'triangle', 900, 600, 0.06, 0.2);
    },

    danger: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'sawtooth', 220, 130, 0.25, 0.22, 900);
      tone(t + 0.22, 'sawtooth', 190, 110, 0.3, 0.22, 900);
    },

    end: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'triangle', 784, 784, 0.25, 0.3, 4000, true);
      tone(t + 0.15, 'triangle', 659, 659, 0.25, 0.3, 4000, true);
      tone(t + 0.3, 'triangle', 523, 523, 0.5, 0.3, 4000, true);
    }
  };

  window.BallSound = api;

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
