/**
 * ad-service.js
 * Manages Google AdSense integration for SimpleTCF
 *
 * Features:
 *  - Fixed bottom ad bar (refreshes on each navigation)
 *  - Internal support / upsell overlay every 10 questions answered
 *  - Ad-blocker detection with overlay message
 *  - Skips ads for ad-free tier users
 *
 * -----------------------------------------------------------------------
 * HOW TO CONNECT REAL GOOGLE ADSENSE ADS
 * -----------------------------------------------------------------------
 * 1. Sign up at https://www.google.com/adsense/ and get approved.
 * 2. Replace ADSENSE_PUBLISHER_ID below with your real publisher ID
 *    (e.g. 'ca-pub-1234567890123456').
 * 3. In your AdSense dashboard, create one manual ad unit:
 *    a. A "Display ad" for the bottom bar → paste its slot ID
 *       into AD_SLOT_BOTTOM_BAR.
 * 4. For real Vignette ads, enable them in AdSense under:
 *    Ads > your site > Overlay formats > Vignette ads
 *    Do NOT use a manual data-ad-slot for vignette.
 * 5. Deploy. AdSense will automatically serve real ads once the site is
 *    approved and the correct IDs are in place.
 * -----------------------------------------------------------------------
 */

// -----------------------------------------------------------------------
// CONFIGURATION — replace with your real AdSense publisher ID & slot IDs
// -----------------------------------------------------------------------
const ADSENSE_PUBLISHER_ID = 'ca-pub-3540516083991428';
const AD_SLOT_BOTTOM_BAR = '7383588658';
const QUESTIONS_PER_AD = 10;

// -----------------------------------------------------------------------

class AdService {
  constructor() {
    this._adBlockDetected = false;
    this._questionsSincePrompt = 0;
  }

  /**
   * Bootstrap ads — call once on DOMContentLoaded
   */
  async init() {
    if (await this._isAdFreeUser()) {
      this._pauseAutoAds();
      return;
    }

    this._detectAdBlocker();
    this._injectAdSenseScript();
    this._initBottomAdBar();
  }

  /**
   * Pause all AdSense auto-ads for ad-free users.
   * Called when the statically-loaded AdSense script is present but the
   * user has an active ad-free subscription.
   */
  _pauseAutoAds() {
    (window.adsbygoogle = window.adsbygoogle || []).pauseAdRequests = 1;
  }

  // -----------------------------------------------------------------------
  // Ad-blocker detection
  // -----------------------------------------------------------------------

  _detectAdBlocker() {
    const bait = document.createElement('div');
    bait.className = 'adsbygoogle ad-bait';
    bait.style.cssText =
      'width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;';
    document.body.appendChild(bait);

    setTimeout(() => {
      const blocked =
        bait.offsetHeight === 0 ||
        window.getComputedStyle(bait).display === 'none' ||
        bait.offsetParent === null;

      if (bait.parentNode) {
        bait.parentNode.removeChild(bait);
      }

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

    const btn = overlay.querySelector('button');
    if (btn) {
      setTimeout(() => btn.focus(), 100);
    }
  }

  // -----------------------------------------------------------------------
  // AdSense script injection
  // -----------------------------------------------------------------------

  _injectAdSenseScript() {
    if (document.querySelector('script[data-ad-client]')) return;

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
        <button
          class="bottom-ad-bar__remove-btn"
          onclick="window.location.href='/plan.html'"
          title="Go Ad-Free"
        >
          ✕ Remove Ads – CAD $10
        </button>
      </div>
    `;

    document.body.appendChild(bar);
    document.body.style.paddingBottom = 'var(--bottom-ad-bar-height, 110px)';

    this._pushAdsbygoogle();
  }

  /**
   * Refresh the bottom bar ad unit (call on each SPA navigation)
   */
  refreshBottomAd() {
    if (this._adBlockDetected) return;

    const ins = document.querySelector('#bottom-ad-bar .bottom-ad-bar__ad');
    if (!ins) return;

    const barInner = ins.parentElement;
    if (!barInner) return;

    ins.remove();

    const fresh = document.createElement('ins');
    fresh.className = 'adsbygoogle bottom-ad-bar__ad';
    fresh.style.cssText = 'display:inline-block;width:728px;height:90px';
    fresh.setAttribute('data-ad-client', ADSENSE_PUBLISHER_ID);
    fresh.setAttribute('data-ad-slot', AD_SLOT_BOTTOM_BAR);

    const removeBtn = barInner.querySelector('.bottom-ad-bar__remove-btn');
    if (removeBtn) {
      barInner.insertBefore(fresh, removeBtn);
    } else {
      barInner.appendChild(fresh);
    }

    this._pushAdsbygoogle();
  }

  // -----------------------------------------------------------------------
  // Prompt overlay every QUESTIONS_PER_AD answered
  // -----------------------------------------------------------------------

  /**
   * Call after each question is answered.
   * Returns true if the support overlay was shown.
   */
  async onQuestionAnswered() {
    if (await this._isAdFreeUser()) return false;
    if (this._adBlockDetected) return false;

    this._questionsSincePrompt += 1;

    if (this._questionsSincePrompt < QUESTIONS_PER_AD) {
      return false;
    }

    this._questionsSincePrompt = 0;
    this._showSupportOverlay();
    return true;
  }

  _showSupportOverlay() {
    if (document.getElementById('vignette-ad-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'vignette-ad-overlay';
    overlay.innerHTML = `
      <div class="vignette-ad__box" role="dialog" aria-modal="true" aria-label="Support SimpleTCF">
        <div class="vignette-ad__header">
          <span class="vignette-ad__label">Support SimpleTCF</span>
          <span class="vignette-ad__countdown" id="vignette-countdown">5</span>
        </div>

        <div class="vignette-ad__body">
          <h3>SimpleTCF is free thanks to ads</h3>
          <p>
            Thanks for using SimpleTCF. You can continue in a few seconds,
            or go ad-free for a smoother experience.
          </p>
        </div>

        <div class="vignette-ad__footer">
          <div class="vignette-ad__actions">
            <button id="vignette-close-btn" class="btn btn--ghost" disabled>
              Continue (5s)
            </button>
            <a href="/plan.html" class="btn btn--primary">Go Ad-Free</a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('vignette-ad-open');

    let seconds = 5;
    const closeBtn = overlay.querySelector('#vignette-close-btn');
    const countdownEl = overlay.querySelector('#vignette-countdown');

    const cleanup = () => {
      overlay.remove();
      document.body.classList.remove('vignette-ad-open');
    };

    const tick = setInterval(() => {
      seconds -= 1;

      if (countdownEl) countdownEl.textContent = String(seconds);
      if (closeBtn) {
        closeBtn.textContent = seconds > 0 ? `Continue (${seconds}s)` : 'Continue';
      }

      if (seconds <= 0) {
        clearInterval(tick);

        if (closeBtn) {
          closeBtn.disabled = false;
          closeBtn.addEventListener('click', cleanup, { once: true });
          closeBtn.focus();
        }
      }
    }, 1000);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  _pushAdsbygoogle() {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }

  async _isAdFreeUser() {
    try {
      if (window.SubscriptionService) {
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
