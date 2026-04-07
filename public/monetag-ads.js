(function () {
  function injectScripts() {
    var onclick = document.createElement('script');
    onclick.src = 'https://quge5.com/88/tag.min.js';
    onclick.setAttribute('data-zone', '227439');
    onclick.async = true;
    onclick.setAttribute('data-cfasync', 'false');
    document.head.appendChild(onclick);

    (function (s) {
      s.dataset.zone = '10845759';
      s.src = 'https://n6wxm.com/vignette.min.js';
    })([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));

    var push = document.createElement('script');
    push.src = 'https://5gvci.com/act/files/tag.min.js?z=10846191';
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
