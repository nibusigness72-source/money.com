// arrow-sound.js - Arrow Escape ki awaazein (koi mp3 nahi, sab code se banti hain)
// ArrowSound.fly()    -> teer chhootne ki awaaz (dhanush ki "tang" + sarr-sarr karti teer ki seeti)
// ArrowSound.bump()   -> teer takraya
// ArrowSound.tick(n)  -> 3 / 2 / 1 ginte waqt ghadi jaisi tik-tik
// ArrowSound.go()     -> intezaar khatam
// ArrowSound.stage()  -> stage poora
// ArrowSound.end()    -> game khatam

var ArrowSound = (function () {
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

    // Teer chhoota: dhanush ki tang, phir teer ki sarr-sarr (har baar thodi alag)
    fly: function () {
      if (!on()) return;
      var k = 0.92 + Math.random() * 0.16;
      tone(95 * k, 60, 0.1, 0.55, 'sine');                          // dhanush ki dori chhootna
      tone(420 * k, 300, 0.09, 0.18, 'triangle');                   // dori ki tang
      noise(0.05, 0.35, 'highpass', 2500, 2000);                    // tez "tak"
      noise(0.5, 0.42, 'bandpass', 700 * k, 5200 * k, 0.03, 0.25);  // teer ki sarrr
      tone(900 * k, 3200 * k, 0.42, 0.07, 'sawtooth', 0.04);        // seeti jaisi uthti dhwani
    },

    // Teer takraya: lakdi jaisi thak aur halki buzz
    bump: function () {
      if (!on()) return;
      tone(150, 60, 0.18, 0.7, 'sine');
      tone(300, 120, 0.12, 0.3, 'triangle');
      noise(0.1, 0.35, 'lowpass', 1500, 200);
      tone(220, 200, 0.25, 0.12, 'square', 0.05);
    },

    // 3, 2, 1: ghadi jaisi tik-tik (aakhri 1 par thodi lambi aur oonchi)
    tick: function (n) {
      if (!on()) return;
      var f = n >= 3 ? 760 : (n === 2 ? 880 : 1040);
      tone(f, f, n === 1 ? 0.22 : 0.12, n === 1 ? 0.34 : 0.28, 'triangle');
      noise(0.03, 0.25, 'highpass', 3000, 2500);
    },

    // Intezaar khatam
    go: function () {
      if (!on()) return;
      tone(660, 660, 0.12, 0.2, 'triangle');
      tone(990, 990, 0.25, 0.2, 'sine', 0.08);
    },

    // Stage poora
    stage: function () {
      if (!on()) return;
      var n = [523, 659, 784, 1047];
      for (var i = 0; i < n.length; i++) tone(n[i], n[i], 0.25, 0.2, 'triangle', i * 0.09);
    },

    // Game khatam
    end: function () {
      if (!on()) return;
      tone(660, 660, 0.25, 0.2, 'sine');
      tone(440, 440, 0.45, 0.2, 'sine', 0.22);
    }
  };
})();
