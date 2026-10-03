// gem-sound.js - Gem Blast ki awaazein (koi mp3 nahi, sab code se banti hain)
// GemSound.clear(res, chain) -> har baar gems tootne par (khud ke swap par bhi aur upar se gire gems ke chain par bhi, dono mein same awaaz)
//
// Awaaz ka size:
//   3 gems            -> chhoti "pop"
//   4 gems (line gem banta hai)     -> thodi badi + ghanti
//   5 gems (rainbow gem banta hai)  -> aur badi + teen sur ki ghanti
//   line gem fata (row/column)      -> bijli ki kadak, thodi kam
//   rainbow gem fata (saare gems)   -> bahut tez bijli, jab tak chalta hai tab tak

// Aadmi ki awaaz chahiye to neeche false ko true kar do.
// (Ye phone ki apni awaaz se bolta hai: "Nice", "Great", "Excellent"... Phone ke hisaab se awaaz alag ho sakti hai.)
var GEM_VOICE = false;

var GemSound = (function () {
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

  // Aadmi ki awaaz (phone ki text-to-speech)
  function say(text) {
    if (!GEM_VOICE || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-IN';
      u.pitch = 0.6;
      u.rate = 1.1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  // Bijli: tez kadak + chinagariyan + badal ki garaj. dur = kitni der chalegi
  function lightning(dur, vol) {
    noise(0.05, vol, 'highpass', 4000, 2500);
    tone(3200, 150, 0.25, vol * 0.5, 'sawtooth');
    var n = Math.round(dur * 14);
    for (var i = 0; i < n; i++) {
      var d = Math.random() * dur;
      noise(0.04 + Math.random() * 0.05, vol * (0.3 + Math.random() * 0.5), 'bandpass', 2000 + Math.random() * 3000, 1500, d);
    }
    noise(dur, vol * 0.9, 'lowpass', 900, 80, 0.05);
    tone(70, 28, dur, vol, 'sine');
  }

  // 3 gems: chhoti pop
  function pop3() {
    tone(520, 780, 0.12, 0.25, 'triangle');
    noise(0.08, 0.2, 'lowpass', 2000, 500);
  }

  return {
    unlock: unlock,

    clear: function (res, chain) {
      if (!on()) return;

      if (res.firedBomb) {                      // rainbow gem fata: sabse tez bijli
        lightning(1.5, 0.9);
        tone(110, 30, 0.8, 0.9, 'sine');
        say('Unbelievable');
      } else if (res.firedStriped) {            // line gem fata: bijli, rainbow se kam
        lightning(0.7, 0.55);
        pop3();
        say('Wow');
      } else if (res.createdBomb) {             // 5 gems: badi awaaz
        tone(170, 45, 0.25, 0.5, 'sine');
        pop3();
        tone(660, 660, 0.2, 0.22, 'triangle', 0.05);
        tone(880, 880, 0.2, 0.22, 'triangle', 0.15);
        tone(1320, 1320, 0.45, 0.22, 'triangle', 0.25);
        tone(2600, 2500, 0.5, 0.06, 'sine', 0.3);
        say('Excellent');
      } else if (res.createdStriped) {          // 4 gems: thodi badi awaaz
        pop3();
        tone(110, 40, 0.2, 0.35, 'sine');
        tone(740, 740, 0.2, 0.2, 'triangle', 0.06);
        tone(990, 990, 0.3, 0.2, 'triangle', 0.16);
        say('Great');
      } else {                                  // 3 gems: chhoti awaaz
        pop3();
        say('Nice');
      }
    }
  };
})();
