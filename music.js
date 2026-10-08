// music.js - game ka gaana
//
//  * Game shuru hone par 3 gaano me se ek RANDOM gaana bajta hai (ek baar me sirf ek, wahi file download hoti hai)
//  * Time khatam hone par jo "Play Again" wali screen aati hai, wahan CHAUTHA gaana bajta hai
//  * Play Again dabate hi wo gaana band, aur phir koi random gaana shuru
//  * Upar right me 🔊/🔇 button: player gaana band kar sakta hai
//
// Fly Modi me kuch aur likhne ki zaroorat nahi: ye page ke "menu" aur "over" wale box ko khud dekh leta hai.
(function () {
  // ================= SETTINGS (sirf yahin badalna) =================
  // Khelte waqt bajne wale gaane. Sirf ek hi gaana chahiye to ek hi naam rakho: ['song1.mp3']
  var GAME_SONGS = ['song4.mp3', 'song2.mp3', 'song3.mp3'];

  // Play Again wali screen ka gaana. Nahi chahiye to khali rakho: ''
  var END_SONG = 'song1.mp3';

  var VOLUME = 1;      // awaaz: 0 se 1 tak
  // =================================================================

  var audio = new Audio();
  audio.preload = 'auto';
  audio.loop = true;
  audio.volume = VOLUME;

  var muted = false;
  try { muted = localStorage.getItem('pw_music_off') === '1'; } catch (e) {}

  var mode = 'none';      // none | game | end
  var lastIdx = -1;
  var unlocked = false;   // pehla tap/click hua ya nahi

  // ---------- 🔊 / 🔇 button ----------
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99998;width:40px;height:40px;' +
    'border-radius:50%;border:2px solid rgba(255,255,255,.85);background:rgba(0,0,0,.45);' +
    'color:#fff;font-size:20px;line-height:1;cursor:pointer;padding:0;';
  function paint() { btn.textContent = muted ? '🔇' : '🔊'; }
  paint();
  function addBtn() { if (document.body) document.body.appendChild(btn); }
  if (document.body) addBtn(); else document.addEventListener('DOMContentLoaded', addBtn);

  btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    muted = !muted;
    try { localStorage.setItem('pw_music_off', muted ? '1' : '0'); } catch (err) {}
    paint();
    if (muted) audio.pause(); else playNow();
  });

  // ---------- chalana ----------
  function playNow() {
    if (muted || mode === 'none') return;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  function setSong(src, loop) {
    audio.loop = loop;
    audio.src = src;
    try { audio.currentTime = 0; } catch (e) {}
    playNow();
  }

  function pickIndex() {
    if (GAME_SONGS.length < 2) return 0;
    var i;
    do { i = Math.floor(Math.random() * GAME_SONGS.length); } while (i === lastIdx);
    return i;
  }

  // Game shuru: koi random gaana
  function startGame() {
    if (!GAME_SONGS.length || mode === 'game') return;     // pehle se game ka gaana chal raha ho to dobara nahi badalna
    mode = 'game';
    lastIdx = pickIndex();
    setSong(GAME_SONGS[lastIdx], true);

    // Play Again wala gaana peeche se load karwa lo, taaki aate hi baj jaye
    if (END_SONG) {
      setTimeout(function () {
        try { var pre = new Audio(); pre.preload = 'auto'; pre.src = END_SONG; } catch (e) {}
      }, 6000);
    }
  }

  // Time khatam / Play Again screen: chautha gaana
  function endScreen() {
    if (!END_SONG || mode === 'end') return;   // end ka gaana nahi hai to wahi chalta rahe
    mode = 'end';
    setSong(END_SONG, true);
  }

  function stopAll() {
    mode = 'none';
    audio.pause();
  }

  // ---------- mobile: pehle tap ke baad hi awaaz nikalti hai ----------
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    playNow();
  }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // ---------- tab badalne / screen band hone par ruko ----------
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) audio.pause(); else playNow();
  });

  // ---------- Fly Modi: #menu aur #over box ko dekhte raho ----------
  function hidden(el) { return el.classList.contains('hidden'); }

  function watch() {
    var menu = document.getElementById('menu');
    var over = document.getElementById('over');
    if (!menu || !over) return;

    new MutationObserver(function () {
      if (hidden(menu) && hidden(over)) startGame();   // Start dabaya
    }).observe(menu, { attributes: true, attributeFilter: ['class'] });

    new MutationObserver(function () {
      if (!hidden(over)) endScreen();                  // time khatam, Play Again screen
      else startGame();                                // Play Again dabaya
    }).observe(over, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);

  // Dusre games ke liye (agar unme #menu/#over na ho): PWMusic.startGame() / PWMusic.endScreen() / PWMusic.stop()
  window.PWMusic = { startGame: startGame, endScreen: endScreen, stop: stopAll };
})();
