/**
 * LOT 4 — EFFETS LIÉS AU SCROLL (réversibles)
 *
 * Un seul moteur : chaque [data-fx] reçoit une valeur --e (0 à 1) calculée
 * selon sa position à l'écran. Le CSS en déduit l'état. Rien n'est joué
 * « une seule fois » : on avance en descendant, on recule en remontant.
 *
 * Sécurité : l'état caché (--e: 0) n'existe QUE sous html.scrollfx.
 * La classe est posée après le premier calcul ; si le moteur échoue ou si
 * l'utilisateur préfère réduire les animations, rien ne reste invisible.
 */
(function () {
  var cfg = (window.AppConfig && window.AppConfig.EFFETS) ||
            (window.App && window.App.config && window.App.config.EFFETS) ||
            {};
  if (!cfg.scrollLie) return;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (mq && mq.matches) return;

  var racine = document.documentElement;
  var conteneur = document.getElementById('main-container');
  var fx = [];
  var suiveurs = [];
  var vh = window.innerHeight;
  var tick = false;

  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var back = function (t) {
    var a = 1.70158, b = a + 1;
    return 1 + b * Math.pow(t - 1, 3) + a * Math.pow(t - 1, 2);
  };

  function collecter() {
    fx = [].slice.call(document.querySelectorAll('[data-fx]'));
  }

  function frame() {
    tick = false;
    vh = window.innerHeight || racine.clientHeight;
    var slots = [];
    suiveurs = [];

    for (var k = 0; k < fx.length; k++) {
      var el = fx[k];
      if (!el.isConnected) continue;

      var type = el.getAttribute('data-fx');

      // Le surligneur suit sa ligne : il ne consomme pas une place
      // dans le plafond de 3 éléments animés.
      if (type === 'hl') {
        var parent = el.parentElement ? el.parentElement.closest('[data-fx]') : null;
        if (parent) {
          suiveurs.push({ el: el, parent: parent });
          continue;
        }
      }

      var rect = el.getBoundingClientRect();
      var top = rect.top;

      // Sous l'écran : état de départ (caché tant qu'on n'approche pas).
      if (top > vh * 1.3) {
        el.style.setProperty('--e', 0);
        continue;
      }

      // Au-dessus de l'écran : état final (visible).
      if (rect.bottom < 0) {
        el.style.setProperty('--e', 1);
        continue;
      }

      slots.push({
        el: el,
        top: top,
        centre: Math.abs(top + rect.height / 2 - vh / 2)
      });
    }

    // 3 éléments animés maximum à l'écran : les plus proches du centre.
    slots.sort(function (a, b) { return a.centre - b.centre; });

    for (var j = 0; j < slots.length; j++) {
      var item = slots[j];

      if (j >= 3) {
        // Au-delà du plafond : état final, visible mais statique.
        item.el.style.setProperty('--e', 1);
        continue;
      }

      var d = parseFloat(item.el.dataset.d || 0);
      if (!(d >= 0 && d < 1)) d = 0;

      var p = clamp(((vh - item.top) / (vh * 0.6) - d) / (1 - d));
      item.el.style.setProperty(
        '--e',
        item.el.dataset.ease === 'back' ? back(p) : easeOut(p)
      );
    }

    // Les surligneurs héritent de la valeur de leur ligne.
    for (var s = 0; s < suiveurs.length; s++) {
      var parentEl = suiveurs[s].parent;
      suiveurs[s].el.style.setProperty(
        '--e',
        parentEl.style.getPropertyValue('--e') || '1'
      );
    }

    var band = document.getElementById('band');
    if (band) {
      var half = band.scrollWidth / 2 || 1;
      var y = conteneur ? conteneur.scrollTop : window.scrollY;
      band.style.transform = 'translateX(' + (-((y * 0.7) % half)) + 'px)';
    }
  }

  function on() {
    if (!tick) {
      tick = true;
      requestAnimationFrame(frame);
    }
  }

  function demarrer() {
    if (racine.classList.contains('scrollfx')) return;
    collecter();

    // On calcule d'abord, on masque ensuite : si frame() échoue,
    // la classe n'est jamais ajoutée et tout reste visible.
    try {
      frame();
    } catch (erreur) {
      racine.classList.remove('scrollfx');
      console.warn('[scrollfx] Moteur non démarré :', erreur);
      return;
    }

    racine.classList.add('scrollfx');
    if (conteneur) conteneur.style.scrollSnapType = 'none';
  }

  function arreter() {
    racine.classList.remove('scrollfx');
    if (conteneur) conteneur.style.scrollSnapType = '';
    var band = document.getElementById('band');
    if (band) band.style.transform = '';
  }

  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', function () {
      if (mq.matches) arreter();
      else demarrer();
    });
  }

  document.addEventListener('app:pagechange', function () { collecter(); on(); });
  document.addEventListener('app:magazineopen', function () { collecter(); on(); });
  window.addEventListener('load', function () { collecter(); on(); });
  window.addEventListener('resize', function () { vh = innerHeight; on(); });

  if (conteneur) conteneur.addEventListener('scroll', on, { passive: true });
  window.addEventListener('scroll', on, { passive: true });

  // Les scènes (polaroïds, mots) sont injectées après le chargement :
  // on recollecte à chaque ajout dans le magazine.
  if (window.MutationObserver && conteneur) {
    var mo = new MutationObserver(function () { collecter(); on(); });
    mo.observe(conteneur, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
