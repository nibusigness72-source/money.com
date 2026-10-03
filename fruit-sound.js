// fruit-sound.js - Fruit Cut ki awaazein (koi mp3 nahi, sab code se banti hain)
// FruitSound.slice()  -> phal katne par
// FruitSound.bomb()   -> bomb se takrane par

var FruitSound = (function () {
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var enabled = true;

  // Phone par awaaz tabhi chalti hai jab user ne screen touch ki ho
  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        enabled = false;
        return;
      }
      ctx = new AC();

      var comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

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

    // Phal kata: talwar ki sarsarahat + rasdaar "chhap" (har baar thodi alag)
    slice: function () {
      if (!on()) return;
      var k = 0.9 + Math.random() * 0.25;
      noise(0.14, 0.5, 'bandpass', 900 * k, 4500 * k, 0, 0.3);     // sarsarahat
      noise(0.1, 0.45, 'lowpass', 1800, 300, 0.05);                 // phal ka kat-na
      tone(520 * k, 190, 0.12, 0.3, 'triangle', 0.05);              // rasdaar chhap
      tone(1800 * k, 1200, 0.05, 0.1, 'square', 0.04);              // chhoti tik
    },

    // Bomb phata: tez dhamaka, gehri gunj, phir kaanon mein sanssanahat
    bomb: function () {
      if (!on()) return;
      noise(0.06, 0.8, 'highpass', 2500, 1500);                     // pehli tez khadak
      noise(1.3, 0.9, 'lowpass', 3200, 100);                        // dhamaka
      tone(90, 25, 1.0, 1.0, 'sine');                               // gehri gunj
      tone(200, 50, 0.4, 0.6, 'triangle');                          // phone speaker ke liye
      tone(3000, 2900, 1.0, 0.04, 'sine', 0.15);                    // sanssanahat
    }
  };
})();
