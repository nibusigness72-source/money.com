// sound.js - saari awaazein code se banti hain (koi mp3 file nahi chahiye)
// Ye file har game mein use ho sakti hai: Sound.swing(), Sound.land(3), Sound.collapse() ...

var Sound = (function () {
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var enabled = true;

  // Phone par awaaz tabhi chalti hai jab user ne screen touch ki ho, isliye pehle tap par chalu hota hai
  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        enabled = false;
        return;
      }
      ctx = new AC();

      // zyada tez awaaz ko kaabu mein rakhne wala
      var comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);

      // 1 second ka random shor (dhamake aur hawa ki awaaz ke liye)
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Ek seedhi awaaz (f1 se f2 tak giregi)
  function tone(f1, f2, dur, vol, type, delay) {
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Shor wali awaaz (hawa, dhamaka, bikharne ki awaaz)
  function noise(dur, vol, ftype, f1, f2, delay, attack) {
    var t = ctx.currentTime + (delay || 0);
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(f1, t);
    f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * (attack || 0.03));
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  function on() {
    return enabled && ctx;
  }

  return {
    unlock: unlock,

    // Jhoolte block ki halki sansanahat (jab rassi beech se guzarti hai)
    swing: function () {
      if (!on()) return;
      noise(0.45, 0.07, 'bandpass', 350, 900, 0, 0.4);
    },

    // Block chhodte hi neeche girne ki siti
    drop: function () {
      if (!on()) return;
      tone(700, 250, 0.22, 0.05, 'sine');
    },

    // Block tikne ki dhamak. q: 1 = Average, 2 = Good, 3 = Perfect
    land: function (q) {
      if (!on()) return;
      tone(170, 45, 0.22, 0.9, 'sine');               // gehri dhamak
      tone(320, 90, 0.12, 0.35, 'triangle');          // phone ke speaker ke liye
      noise(0.12, 0.35, 'lowpass', 1500, 200);        // takrane ki khadak
      if (q >= 2) tone(660, 660, 0.25, 0.12, 'triangle', 0.03);
      if (q === 3) {                                  // Perfect: chamakdar ghanti
        tone(880, 880, 0.5, 0.2, 'sine', 0.05);
        tone(1320, 1320, 0.5, 0.14, 'sine', 0.05);
      }
    },

    // Tower toot kar bikharna: pehle dhadam, phir ek ek block ki takkar
    collapse: function () {
      if (!on()) return;
      noise(1.0, 0.7, 'lowpass', 2800, 150);
      tone(90, 30, 0.9, 0.9, 'sine');
      for (var i = 0; i < 6; i++) {
        var d = 0.08 + i * 0.11 + Math.random() * 0.08;
        tone(140 + Math.random() * 80, 40, 0.18, 0.5, 'sine', d);
        noise(0.1, 0.25, 'lowpass', 1800, 300, d);
      }
    },

    // Game khatam hone par do sur
    end: function () {
      if (!on()) return;
      tone(660, 660, 0.25, 0.2, 'sine');
      tone(440, 440, 0.45, 0.2, 'sine', 0.22);
    }
  };
})();
