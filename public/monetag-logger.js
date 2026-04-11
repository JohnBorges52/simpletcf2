/**
 * monetag-logger.js
 * Monitors and logs Monetag ad script injection and events for SimpleTCF.
 *
 * Logs (visible in browser DevTools console):
 *  - When each Monetag script is successfully injected
 *  - Zone ID and ad type for each injection
 *  - Errors if a script fails to load
 */

(function () {
  var AD_TYPES = {
    Vignette: { zone: '10845759', url: 'https://n6wxm.com/vignette.min.js' },
    Push: { zone: '10846191', url: 'https://5gvci.com/act/files/tag.min.js' },
  };

  /**
   * Attach load/error listeners to a Monetag script element and emit logs.
   * @param {HTMLScriptElement} scriptEl
   * @param {string} type  Human-readable ad type name (e.g. 'Vignette')
   * @param {string} zone  Monetag zone ID
   */
  function watchScript(scriptEl, type, zone) {
    scriptEl.addEventListener('load', function () {
      console.log('[Monetag] ' + type + ' Script injetado - Zone: ' + zone + ' - URL: ' + scriptEl.src);
    });

    scriptEl.addEventListener('error', function () {
      console.warn('[Monetag] ' + type + ' Erro ao carregar - Zone: ' + zone + ' - URL: ' + scriptEl.src);
    });
  }

  /**
   * Observe <head> and <body> for Monetag script elements being added and
   * attach loggers to them.
   */
  function observeMonetag() {
    var knownUrls = Object.values(AD_TYPES).map(function (t) { return t.url; });

    function checkNode(node) {
      if (node.nodeName !== 'SCRIPT') return;
      var src = node.src || '';
      for (var type in AD_TYPES) {
        var info = AD_TYPES[type];
        if (src.indexOf(info.url) !== -1 || src.indexOf(info.zone) !== -1) {
          watchScript(node, type, info.zone);
          return;
        }
      }
      // Fallback: any unrecognised Monetag-looking URL
      var monetagHosts = ['n6wxm.com', '5gvci.com'];
      for (var i = 0; i < monetagHosts.length; i++) {
        if (src.indexOf(monetagHosts[i]) !== -1) {
          watchScript(node, 'Unknown', 'unknown');
          return;
        }
      }
    }

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          checkNode(node);
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Expose so ad-service.js can call injectMonetag() with logging
  window.MonetagLogger = {
    /**
     * Wrap a script element so its load/error events are logged.
     * @param {HTMLScriptElement} scriptEl
     * @param {string} type
     * @param {string} zone
     */
    watch: watchScript,

    /**
     * Start observing the DOM for Monetag script injections.
     */
    observe: observeMonetag,
  };

  // Auto-start observation as early as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeMonetag);
  } else {
    observeMonetag();
  }
}());
