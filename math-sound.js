// math-sound.js - Math Quiz ki awaazein (koi audio file nahi, sab code se)
//
//   MathSound.right()   -> sahi jawab: do sur ki chhoti, khushi wali "ting-ting"
//   MathSound.wrong()   -> galat jawab: naram, halki "dub"
//   MathSound.next()    -> naya sawal aaya: halki "swish"
//   MathSound.end()     -> time khatam
//
// Mute: music.js ke 🔊/🔇 button wali hi setting (pw_music_off).
(function () {
  var VOL = 0.85;                    // kul awaaz (0 se 1)
  var ctx = null, master = null;

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
    return true;
  }

  function ready() {
    if (muted()) return false;
    if (!init()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ek sur: f0 se f1 tak, naram shuruaat aur mulayam ant
  function tone(t, type, f0, f1, dur, peak, lowpass) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.setTargetAtTime(0.0001, t + 0.012, dur * 0.3);
    var out = o;
    if (lowpass) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      o.connect(f); out = f;
    }
    out.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.2);
  }

  var api = {
    right: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'triangle', 784, 784, 0.18, 0.32, 5000);
      tone(t + 0.09, 'triangle', 1175, 1175, 0.26, 0.32, 6000);
      tone(t + 0.09, 'sine', 2350, 2350, 0.2, 0.08);
    },

    wrong: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'sine', 230, 140, 0.2, 0.5);
      tone(t, 'triangle', 340, 200, 0.14, 0.16, 1200);
    },

    next: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'sine', 420, 620, 0.09, 0.16);
    },

    end: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      tone(t, 'triangle', 784, 784, 0.25, 0.3, 4000);
      tone(t + 0.15, 'triangle', 659, 659, 0.25, 0.3, 4000);
      tone(t + 0.3, 'triangle', 523, 523, 0.5, 0.3, 4000);
    }
  };

  window.MathSound = api;

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
