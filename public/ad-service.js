/**
 * ad-service.js
 * Manages Google AdSense integration for SimpleTCF
 *
 * Features:
 *  - Fixed bottom ad bar (refreshes on each navigation)
 *  - Vignette interstitial ad every 10 questions answered
 *  - Ad-blocker detection with overlay message
 *  - Skips ads for ad-free tier users
 *
 * -----------------------------------------------------------------------
 * HOW TO CONNECT REAL GOOGLE ADSENSE ADS
 * -----------------------------------------------------------------------
 * 1. Sign up at https://www.google.com/adsense/ and get approved.
 * 2. Replace ADSENSE_PUBLISHER_ID below with your real publisher ID
 *    (e.g. 'ca-pub-1234567890123456').
 * 3. In your AdSense dashboard, create two ad units:
 *    a. A "Display ad" (728×90) for the bottom bar → paste its slot ID
 *       into AD_SLOT_BOTTOM_BAR.
 *    b. A "Display ad" (336×280) for the vignette → paste its slot ID
 *       into AD_SLOT_VIGNETTE.
 * 4. Deploy. AdSense will automatically serve real ads once the site is
 *    approved and the correct IDs are in place.
 * -----------------------------------------------------------------------
 */

// -----------------------------------------------------------------------
// CONFIGURATION — replace with your real AdSense publisher ID & slot IDs
// -----------------------------------------------------------------------
const ADSENSE_PUBLISHER_ID = 'ca-pub-XXXXXXXXXXXXXXXXX'; // TODO: replace with real publisher ID from AdSense
const AD_SLOT_BOTTOM_BAR   = '1234567890';               // TODO: replace with real ad unit slot ID
const AD_SLOT_VIGNETTE     = '0987654321';               // TODO: replace with real ad unit slot ID
const QUESTIONS_PER_AD     = 10;

// -----------------------------------------------------------------------

class AdService {
  constructor() {
    this._adBlockDetected = false;
    this._vignetteShownAt = 0; // session-level counter reset
  }

  /**
   * Bootstrap ads — call once on DOMContentLoaded
   */
  async init() {
    // Check user tier; if ad-free, skip everything
    if (await this._isAdFreeUser()) return;

    this._detectAdBlocker();
    this._injectAdSenseScript();
    this._initBottomAdBar();
  }

  // -----------------------------------------------------------------------
  // Ad-blocker detection
  // -----------------------------------------------------------------------

  _detectAdBlocker() {
    // Use a bait element approach: if the bait div has zero height the ad
    // network stylesheet was blocked.
    const bait = document.createElement('div');
    bait.className = 'adsbygoogle ad-bait';
    bait.style.cssText = 'width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;';
    document.body.appendChild(bait);

    // Give the browser a moment to apply or block styles
    setTimeout(() => {
      const blocked =
        bait.offsetHeight === 0 ||
        window.getComputedStyle(bait).display === 'none' ||
        bait.offsetParent === null;

      document.body.removeChild(bait);

      if (blocked) {
        this._adBlockDetected = true;
        this._showAdBlockOverlay();
      }
    }, 200);
  }

  _showAdBlockOverlay() {
    if (document.getElementById('adblock-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'adblock-overlay';
    overlay.innerHTML = `
      <div class="adblock-overlay__box">
        <div class="adblock-overlay__icon">📢</div>
        <h2>Please Disable Your Ad Blocker</h2>
        <p>
          SimpleTCF is completely <strong>free</strong> and supported by advertising.<br>
          Ads allow us to keep all content accessible at no cost to you.
        </p>
        <p>Please whitelist <strong>simpletcf.com</strong> in your ad blocker and refresh the page.</p>
        <button class="btn btn--primary" onclick="location.reload()">I've Disabled It — Refresh</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('adblock-overlay-open');

    // Move focus to the overlay for accessibility
    const btn = overlay.querySelector('button');
    if (btn) setTimeout(() => btn.focus(), 100);
  }

  // -----------------------------------------------------------------------
  // AdSense script injection
  // -----------------------------------------------------------------------

  _injectAdSenseScript() {
    if (document.querySelector('script[data-ad-client]')) return; // already loaded
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
    script.setAttribute('crossorigin', 'anonymous');
    script.setAttribute('data-ad-client', ADSENSE_PUBLISHER_ID);
    document.head.appendChild(script);
  }

  // -----------------------------------------------------------------------
  // Bottom fixed ad bar
  // -----------------------------------------------------------------------

  _initBottomAdBar() {
    if (document.getElementById('bottom-ad-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'bottom-ad-bar';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Advertisement');
    bar.innerHTML = `
      <div class="bottom-ad-bar__inner">
        <span class="bottom-ad-bar__label">Advertisement</span>
        <ins class="adsbygoogle bottom-ad-bar__ad"
             style="display:inline-block;width:728px;height:90px"
             data-ad-client="${ADSENSE_PUBLISHER_ID}"
             data-ad-slot="${AD_SLOT_BOTTOM_BAR}"></ins>
        <button class="bottom-ad-bar__remove-btn" onclick="window.location.href='/plan.html'" title="Go Ad-Free">
          ✕ Remove Ads – CAD $10
        </button>
      </div>
    `;
    document.body.appendChild(bar);
    document.body.style.paddingBottom = 'var(--bottom-ad-bar-height, 110px)';

    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
  }

  /**
   * Refresh the bottom bar ad unit (call on each SPA navigation)
   */
  refreshBottomAd() {
    if (this._adBlockDetected) return;
    const ins = document.querySelector('#bottom-ad-bar .bottom-ad-bar__ad');
    if (!ins) return;

    // Remove and re-create the ins element to force a new ad request
    const bar = ins.parentElement;
    ins.remove();

    const fresh = document.createElement('ins');
    fresh.className = 'adsbygoogle bottom-ad-bar__ad';
    fresh.style.cssText = 'display:inline-block;width:728px;height:90px';
    fresh.setAttribute('data-ad-client', ADSENSE_PUBLISHER_ID);
    fresh.setAttribute('data-ad-slot', AD_SLOT_BOTTOM_BAR);
    bar.insertBefore(fresh, bar.querySelector('.bottom-ad-bar__remove-btn'));

    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
  }

  // -----------------------------------------------------------------------
  // Vignette / interstitial ad (every QUESTIONS_PER_AD questions)
  // -----------------------------------------------------------------------

  /**
   * Call after each question is answered.
   * Returns true if a vignette was shown.
   */
  async onQuestionAnswered() {
    if (await this._isAdFreeUser()) return false;
    if (this._adBlockDetected) return false;

    this._vignetteShownAt++;
    if (this._vignetteShownAt < QUESTIONS_PER_AD) return false;

    this._vignetteShownAt = 0;
    this._showVignette();
    return true;
  }

  _showVignette() {
    if (document.getElementById('vignette-ad-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'vignette-ad-overlay';
    overlay.innerHTML = `
      <div class="vignette-ad__box">
        <div class="vignette-ad__header">
          <span class="vignette-ad__label">Advertisement</span>
          <span class="vignette-ad__countdown" id="vignette-countdown">10</span>
        </div>
        <ins class="adsbygoogle vignette-ad__ins"
             style="display:block;width:336px;height:280px"
             data-ad-client="${ADSENSE_PUBLISHER_ID}"
             data-ad-slot="${AD_SLOT_VIGNETTE}"></ins>
        <div class="vignette-ad__footer">
          <p>Enjoying SimpleTCF? Remove ads for just <strong>CAD $10 / 30 days</strong>.</p>
          <div class="vignette-ad__actions">
            <button id="vignette-close-btn" class="btn btn--ghost" disabled>Continue (10s)</button>
            <a href="/plan.html" class="btn btn--primary">Go Ad-Free</a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}

    // Countdown timer — user must wait 10 seconds before dismissing
    let seconds = 10;
    const closeBtn = overlay.querySelector('#vignette-close-btn');
    const countdownEl = overlay.querySelector('#vignette-countdown');

    const tick = setInterval(() => {
      seconds--;
      if (countdownEl) countdownEl.textContent = seconds;
      if (closeBtn) closeBtn.textContent = seconds > 0 ? `Continue (${seconds}s)` : 'Continue';
      if (seconds <= 0) {
        clearInterval(tick);
        if (closeBtn) {
          closeBtn.disabled = false;
          closeBtn.addEventListener('click', () => {
            overlay.remove();
          }, { once: true });
        }
      }
    }, 1000);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  async _isAdFreeUser() {
    try {
      if (window.SubscriptionService) {
        // Use already-loaded data if available
        const tier = window.SubscriptionService.getCurrentTier();
        return tier === 'ad-free';
      }
    } catch (_) {}
    return false;
  }
}

// Singleton
window.AdService = new AdService();

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.AdService.init());
} else {
  window.AdService.init();
}
