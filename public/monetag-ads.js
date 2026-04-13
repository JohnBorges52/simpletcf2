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

  async function maybeInjectScripts() {
    if (window.SubscriptionService) {
      try {
        // Wait for auth and ensure subscription data is loaded before checking
        // the user's tier. Without this, waitForInit may resolve immediately
        // with null (no init in flight yet) and getCurrentTier() defaults to
        // 'free', causing ads to appear for ad-free users on first load.
        if (window.SubscriptionService.currentUserData === null && !window.SubscriptionService._initPromise) {
          if (window.AuthService) {
            await window.AuthService.waitForAuth();
          }
          await window.SubscriptionService.init();
        }
        await window.SubscriptionService.waitForInit(5000);
        if (window.SubscriptionService.getCurrentTier() === 'ad-free') {
          return;
        }
      } catch (_) {
        // If subscription status cannot be determined, skip ads to be safe.
        return;
      }
    }
    injectScripts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeInjectScripts);
  } else {
    maybeInjectScripts();
  }
}());
