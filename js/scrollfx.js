(function(){
  var cfg = window.AppConfig && window.AppConfig.EFFETS ? window.AppConfig.EFFETS : {};
  if (!(cfg.scrollLie) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var fx = [].slice.call(document.querySelectorAll('[data-fx]')),
      vh = innerHeight,
      tick = false;

  var clamp = function(x){ return x<0?0:x>1?1:x; };
  var easeOut = function(t){ return 1-Math.pow(1-t,3); };
  var back = function(t){ var a=1.70158,b=a+1; return 1+b*Math.pow(t-1,3)+a*Math.pow(t-1,2); };

  function frame(){
    tick = false;
    for (var k=0;k<fx.length;k++){
      var el = fx[k], top = el.getBoundingClientRect().top;
      // Optimisation : on ne calcule que si l'élément est proche de l'écran
      if (top > vh*1.3 || top < -vh){
        if (top > vh*1.3) el.style.setProperty('--e',0);
        continue;
      }
      var d = parseFloat(el.dataset.d||0);
      var p = clamp(((vh-top)/(vh*.6) - d)/(1-d));
      el.style.setProperty('--e', el.dataset.ease==='back' ? back(p) : easeOut(p));
    }

    var band = document.getElementById('band');
    if (band){
      var half = band.scrollWidth/2||1;
      band.style.transform = 'translateX('+(-((window.scrollY*.7)%half))+'px)';
    }
  }

  function on(){
    if(!tick){
      tick=true;
      requestAnimationFrame(frame);
    }
  }

  // Désactivation du scroll-snap pour éviter les saccades avec les animations liées au scroll
  var container = document.getElementById('main-container');
  if (container) container.style.scrollSnapType = 'none';

  addEventListener('scroll', on, {passive:true});
  addEventListener('resize', function(){ vh=innerHeight; on(); });

  document.documentElement.classList.add('scrollfx');
  frame();
})();
