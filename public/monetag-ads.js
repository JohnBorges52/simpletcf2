(function () {
  var ONCLICK_ZONE = '227439';
  var VIGNETTE_ZONE = '10845759';
  var PUSH_ZONE = '10846191';

  function injectScripts() {
    var onclick = document.createElement('script');
    onclick.src = 'https://quge5.com/88/tag.min.js';
    onclick.setAttribute('data-zone', ONCLICK_ZONE);
    onclick.async = true;
    onclick.setAttribute('data-cfasync', 'false');
    document.head.appendChild(onclick);

    var vignette = document.createElement('script');
    vignette.setAttribute('data-zone', VIGNETTE_ZONE);
    vignette.src = 'https://n6wxm.com/vignette.min.js';
    document.body.appendChild(vignette);

    var push = document.createElement('script');
    push.src = 'https://5gvci.com/act/files/tag.min.js?z=' + PUSH_ZONE;
    push.setAttribute('data-cfasync', 'false');
    push.async = true;
    document.head.appendChild(push);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScripts);
  } else {
    injectScripts();
  }
}());
