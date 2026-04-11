(function () {
  var VIGNETTE_ZONE = '10845759';
  var PUSH_ZONE = '10846191';

  function injectScripts() {
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
