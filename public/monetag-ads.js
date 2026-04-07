/**
 * monetag-ads.js
 * Manages Monetag ad placements for SimpleTCF
 *
 * Features:
 *  - Sticky footer banner (always visible, closeable)
 *  - Question-counter modal (shown after every QUESTIONS_PER_MODAL answered)
 *  - Skips all ads for ad-free tier users
 *  - Easily disabled for testing via sessionStorage flag
 *
 * -----------------------------------------------------------------------
 * CONFIGURATION
 * Replace the zone ID placeholders below with your real Monetag zone IDs
 * once you have created the zones in the Monetag dashboard.
 *
 * To temporarily disable ads during testing, run in the browser console:
 *   sessionStorage.setItem('disable_monetag', 'true');
 * To re-enable:
 *   sessionStorage.removeItem('disable_monetag');
 * -----------------------------------------------------------------------
 */

// -----------------------------------------------------------------------
// CONFIGURATION — replace with your real Monetag zone IDs
// -----------------------------------------------------------------------
const MONETAG_STICKY_ZONE_ID  = 'MONETAG_STICKY_ZONE_ID';   // sticky footer
const MONETAG_MODAL_ZONE_ID   = 'MONETAG_MODAL_ZONE_ID';    // question modal

/** How many questions must be answered before the modal ad fires */
const QUESTIONS_PER_MODAL = 19;

/** Set to false to disable all Monetag ads without touching sessionStorage */
const MONETAG_ADS_ENABLED = true;

// -----------------------------------------------------------------------

(function () {
  'use strict';

  let _questionCount = 0;
  let _stickyDismissed = false;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Returns true if Monetag ads should be suppressed for this session/user.
   */
  async function _adsDisabled() {
    if (!MONETAG_ADS_ENABLED) return true;
    if (sessionStorage.getItem('disable_monetag') === 'true') return true;

    // Respect the ad-free subscription tier
    if (window.SubscriptionService) {
      try {
        const user = window.AuthService?.getCurrentUser?.();
        if (user) {
          const data = window.SubscriptionService.currentUserData
            || await window.SubscriptionService.getUserSubscriptionData(user.uid);
          if (data && data.tier === 'ad-free') return true;
        }
      } catch (_) {
        // If we can't determine the tier, default to showing ads
      }
    }

    return false;
  }

  /**
   * Inject a Monetag zone script tag into the given container element.
   * Monetag zones are loaded by appending their script to the page.
   */
  function _injectZoneScript(zoneId, container) {
    if (!zoneId || zoneId.startsWith('MONETAG_')) {
      // Placeholder — render a grey "Ad placeholder" box so the UI is visible
      const placeholder = document.createElement('div');
      placeholder.style.cssText =
        'width:320px;height:50px;background:#eee;border-radius:4px;' +
        'display:flex;align-items:center;justify-content:center;' +
        'color:#aaa;font-size:13px;font-family:sans-serif;';
      placeholder.textContent = 'Ad';
      container.appendChild(placeholder);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    // Monetag inline zone format
    script.src = `//thubanoa.com/${zoneId}`;
    container.appendChild(script);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Initialize the sticky footer banner.
   * Call once on DOMContentLoaded for pages where you want the banner.
   */
  async function initStickyBanner() {
    if (await _adsDisabled()) return;
    if (document.getElementById('monetag-sticky-banner')) return;

    const bar = document.createElement('div');
    bar.id = 'monetag-sticky-banner';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Advertisement');
    bar.innerHTML = `
      <span class="monetag-sticky__label">Advertisement</span>
      <div class="monetag-sticky__content" id="monetag-sticky-content"></div>
      <button class="monetag-sticky__close" aria-label="Close advertisement" title="Close">&#x2715;</button>
    `;

    document.body.appendChild(bar);

    // Adjust page bottom padding so content is not hidden behind the banner
    const existingPadding = parseInt(document.body.style.paddingBottom, 10) || 0;
    const bannerHeight = 70;
    if (existingPadding < bannerHeight) {
      document.body.style.paddingBottom = bannerHeight + 'px';
    }

    _injectZoneScript(MONETAG_STICKY_ZONE_ID, document.getElementById('monetag-sticky-content'));

    bar.querySelector('.monetag-sticky__close').addEventListener('click', function () {
      bar.classList.add('monetag-banner--hidden');
      _stickyDismissed = true;
    });
  }

  /**
   * Show the question-counter modal ad.
   * Called automatically by trackQuestionAnswer() when the threshold is hit.
   */
  async function showQuestionCounterAd() {
    if (await _adsDisabled()) return;
    if (document.getElementById('monetag-modal-overlay')) {
      // Already visible — remove it first so we can show a fresh one
      document.getElementById('monetag-modal-overlay').remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'monetag-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Advertisement');
    overlay.innerHTML = `
      <div class="monetag-modal__dialog">
        <div class="monetag-modal__header">
          <span class="monetag-modal__label">Advertisement</span>
          <button class="monetag-modal__close" aria-label="Close advertisement" title="Close">&#x2715;</button>
        </div>
        <div class="monetag-modal__content" id="monetag-modal-content"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    _injectZoneScript(MONETAG_MODAL_ZONE_ID, document.getElementById('monetag-modal-content'));

    function close() {
      overlay.classList.add('monetag-modal--hidden');
      setTimeout(() => overlay.remove(), 300);
    }

    overlay.querySelector('.monetag-modal__close').addEventListener('click', close);

    // Close when clicking outside the dialog
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    // Close on Escape key
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKeyDown);
      }
    }
    document.addEventListener('keydown', onKeyDown);
  }

  /**
   * Track a question answer and fire the modal after every QUESTIONS_PER_MODAL.
   * Call this from listening.js, reading.js, and writing.js after each answer.
   */
  function trackQuestionAnswer() {
    _questionCount += 1;
    if (_questionCount >= QUESTIONS_PER_MODAL) {
      _questionCount = 0;
      showQuestionCounterAd();
    }
  }

  // -----------------------------------------------------------------------
  // Expose public API on window
  // -----------------------------------------------------------------------

  window.MonetagAds = {
    initStickyBanner,
    showQuestionCounterAd,
    trackQuestionAnswer,
  };

  // Auto-initialize sticky banner when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStickyBanner);
  } else {
    initStickyBanner();
  }
}());
