// whatsapp-channel.js - "WhatsApp Channel join karein" ka hara button (WhatsApp ke logo ke saath)
//
// Kya karta hai:
//   * Screen ke BAAYEN kinare par, beech se thoda neeche (jahan aapne screenshot mein dikhaya) hara button.
//   * Dabane par aapka WhatsApp Channel khulta hai, wahan user "Follow" dabakar jud jaata hai.
//   * Jo user button dab chuka hai, uske liye button kuch din chhup jaata hai (taaki baar baar na dikhe).
//
// Lagana: jis page par button chahiye, uske </body> se theek pehle ye ek line:
//     <script src="whatsapp-channel.js"></script>
//
// Channel ka link kahan se milega:
//     WhatsApp kholo -> "Updates" -> Channels mein apna channel -> upar ⋮ -> "Share" -> "Copy link".
//     Link aisa dikhta hai:  https://whatsapp.com/channel/0029VaXXXXXXXXXXXXXXXX

(function () {

  /* ===================== YAHAN SE BADLO ===================== */
  var CH = {
    link: 'https://chat.whatsapp.com/E9tl5ukce0uIxTCavvagrz?s=cl&p=a&mlu=4&ilr=4',   // <-- WhatsApp group ka link
    top: 62,                // button screen ki oonchai ke kitne % par (62 = beech se thoda neeche)
    left: 12,               // baayen kinare se kitne px
    text: 'Join',           // logo ke neeche chhota likha ('' = nahi dikhega)
    hideDaysAfterTap: 1   // button dabne ke baad kitne din chhupa rahe (0 = kabhi na chhupe)
  };
  /* ========================================================== */

  var KEY = 'pw_wa_channel_tap';

  function linkOk() {
    return CH.link.indexOf('PASTE') === -1 &&
      /^https:\/\/(chat\.whatsapp\.com\/|(www\.)?whatsapp\.com\/channel\/)[A-Za-z0-9_-]{15,}/.test(CH.link);
  }

  function hiddenNow() {
    if (!CH.hideDaysAfterTap) return false;
    try {
      var t = parseInt(localStorage.getItem(KEY) || '0', 10);
      return t && (Date.now() - t) < CH.hideDaysAfterTap * 86400000;
    } catch (e) { return false; }
  }

  var css = document.createElement('style');
  css.textContent =
    '.wa-ch{position:fixed;left:' + CH.left + 'px;top:' + CH.top + '%;transform:translateY(-50%);' +
    'width:58px;padding:7px 0 6px;border-radius:16px;background:#25D366;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;gap:1px;text-decoration:none;color:#fff;' +
    'font:800 10px Arial,sans-serif;letter-spacing:.3px;box-shadow:0 6px 18px rgba(0,0,0,.45);' +
    'z-index:40;-webkit-tap-highlight-color:transparent;' +
    'left:max(' + CH.left + 'px,calc((100vw - 480px)/2 + ' + CH.left + 'px))}' +
    '.wa-ch:active{transform:translateY(-50%) scale(.94)}' +
    '.wa-ch svg{width:30px;height:30px;fill:#fff;display:block}' +
    '.wa-ch::after{content:"";position:absolute;inset:0;border-radius:16px;border:2px solid #25D366;' +
    'animation:waChPulse 2.6s ease-out infinite;pointer-events:none}' +
    '@keyframes waChPulse{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(1.35);opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){.wa-ch::after{animation:none;display:none}}';
  document.head.appendChild(css);

  // WhatsApp ka logo (simple-icons, CC0)
  var LOGO =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

  function init() {
    if (hiddenNow()) return;

    var a = document.createElement('a');
    a.className = 'wa-ch';
    a.href = CH.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'WhatsApp Group join karein');
    a.title = 'WhatsApp Group join karein';
    a.innerHTML = LOGO + (CH.text ? '<span>' + CH.text + '</span>' : '');

    a.addEventListener('click', function (e) {
      if (!linkOk()) {
        e.preventDefault();
        alert('Channel ka link abhi set nahi hua.\nwhatsapp-channel.js mein  link  ke aage apne channel ka link paste karo\n(https://whatsapp.com/channel/... jaisa).');
        return;
      }
      try { localStorage.setItem(KEY, String(Date.now())); } catch (err) {}
      // link khulne ke baad button hata do
      setTimeout(function () { if (CH.hideDaysAfterTap && a.parentNode) a.parentNode.removeChild(a); }, 600);
    });

    document.body.appendChild(a);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
