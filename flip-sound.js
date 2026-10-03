// flip-sound.js - Flip Ball ki awaazein (koi mp3 nahi, sab code se banti hain)
// FlipSound.pass(clean, mult) -> circle ke paar hone par (har baar)
// FlipSound.shield()          -> shield milne par
// FlipSound.fall()            -> gend neeche zameen par girne par

var FlipSound = (function () {
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

    // Circle paar: halki sarsarahat + "ting". Perfect par chamakdar sur (combo badhne par sur oonchha hota jaata hai)
    pass: function (clean, mult) {
      if (!on()) return;
      noise(0.16, 0.3, 'bandpass', 600, 2500, 0, 0.4);          // sarsarahat
      tone(520, 780, 0.14, 0.25, 'triangle');                    // ting
      if (clean) {
        var base = 700 * (1 + 0.07 * Math.min(mult || 1, 8));
        tone(base, base, 0.35, 0.18, 'sine', 0.05);
        tone(base * 1.5, base * 1.5, 0.35, 0.12, 'sine', 0.05);
        tone(base * 2, base * 2, 0.3, 0.07, 'sine', 0.09);
      }
    },

    // Shield mila: upar chadhte teen sur + chamak
    shield: function () {
      if (!on()) return;
      tone(440, 440, 0.18, 0.22, 'triangle');
      tone(660, 660, 0.18, 0.22, 'triangle', 0.1);
      tone(880, 880, 0.4, 0.22, 'triangle', 0.2);
      tone(1760, 1700, 0.5, 0.06, 'sine', 0.25);
    },

    // Gend zameen par giri: dhap + chhota uchhal
    fall: function () {
      if (!on()) return;
      tone(160, 40, 0.25, 0.9, 'sine');
      tone(300, 90, 0.12, 0.3, 'triangle');
      noise(0.1, 0.35, 'lowpass', 1400, 200);
      tone(130, 45, 0.15, 0.4, 'sine', 0.16);
    }
  };
})();
