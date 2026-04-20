/**
 * ad-service.js
 * Manages SimpleTCF self-promotion ads (no third-party ad networks)
 *
 * Features:
 *  - Fixed bottom bar promoting the ad-free plan (always visible for free users)
 *  - Support overlay every 15 questions answered
 *  - Random page-navigation popup promoting the ad-free plan
 *  - Skips all promotions for ad-free tier users
 */

const QUESTIONS_PER_PROMO = 15;

/** Probability (0–1) that a promo popup appears on page navigation */
const PAGE_NAV_POPUP_CHANCE = 0.25;

class AdService {
  constructor() {
    this._questionsSincePrompt = 0;
    this._pageNavPopupShown = false;
  }

  /**
   * Bootstrap ads — call once on DOMContentLoaded
   */
  async init() {
    // Register for real-time tier changes
    if (window.SubscriptionService) {
      window.SubscriptionService.addTierChangeCallback((newTier, previousTier) => {
        this.refreshAdVisibility(newTier, previousTier);
      });

      // Ensure subscription data is loaded before checking the user's tier.
      if (window.SubscriptionService.currentUserData === null && !window.SubscriptionService._initPromise) {
        try {
          if (window.AuthService) {
            await window.AuthService.waitForAuth();
          }
          await window.SubscriptionService.init();
        } catch (error) {
          console.warn('[AdService] Failed to initialize subscription service:', error);
        }
      }
    }

    if (await this._isAdFreeUser()) {
      return;
    }

    // Show the bottom bar for free users (always visible)
    this._initBottomAdBar();

    // Random page-navigation popup
    this._maybeShowPageNavPopup();
  }

  /**
   * Refresh ad visibility when the user's subscription tier changes.
   */
  refreshAdVisibility(newTier, previousTier) {
    if (newTier === 'ad-free') {
      // Remove the bottom ad bar
      const bar = document.getElementById('bottom-ad-bar');
      if (bar) {
        bar.remove();
        document.body.style.paddingBottom = '';
      }

      // Remove any open popups
      const navPopup = document.getElementById('promo-nav-popup-overlay');
      if (navPopup) {
        navPopup.remove();
        document.body.classList.remove('promo-popup-open');
      }

      const vignetteOverlay = document.getElementById('vignette-ad-overlay');
      if (vignetteOverlay) {
        vignetteOverlay.remove();
        document.body.classList.remove('vignette-ad-open');
      }
    } else if (previousTier === 'ad-free') {
      // Downgraded from ad-free to free — reload so promos initialise properly
      window.location.reload();
    }
  }

  // -----------------------------------------------------------------------
  // Bottom fixed promo bar
  // -----------------------------------------------------------------------

  _initBottomAdBar() {
    if (document.getElementById('bottom-ad-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'bottom-ad-bar';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Upgrade to Ad-Free');
    bar.innerHTML = `
      <div class="bottom-ad-bar__inner">
        <span class="bottom-ad-bar__label">SimpleTCF</span>
        <span class="bottom-ad-bar__promo-text">
          🚀 Enjoy an ad-free experience — focus on your TCF preparation without interruptions!
        </span>
        <button
          class="bottom-ad-bar__remove-btn"
          onclick="window.location.href='/plan.html'"
          title="Go Ad-Free"
        >
          ⭐ Go Ad-Free – CAD $10
        </button>
      </div>
    `;

    document.body.appendChild(bar);
    document.body.style.paddingBottom = 'var(--bottom-ad-bar-height, 110px)';
  }

  // -----------------------------------------------------------------------
  // Random page navigation promo popup
  // -----------------------------------------------------------------------

  _maybeShowPageNavPopup() {
    // Only show once per page load and with a random chance
    if (this._pageNavPopupShown) return;

    if (Math.random() > PAGE_NAV_POPUP_CHANCE) return;

    this._pageNavPopupShown = true;

    // Small delay to let the page render first
    setTimeout(() => {
      this._showPageNavPopup();
    }, 1500);
  }

  _showPageNavPopup() {
    if (document.getElementById('promo-nav-popup-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'promo-nav-popup-overlay';
    overlay.innerHTML = `
      <div class="promo-nav-popup__card" role="dialog" aria-modal="true" aria-label="Go Ad-Free">
        <button class="promo-nav-popup__close" id="promo-nav-close-btn" aria-label="Close">&times;</button>
        <div class="promo-nav-popup__icon">⭐</div>
        <h3 class="promo-nav-popup__title">Go Ad-Free!</h3>
        <p class="promo-nav-popup__body">
          Remove all promotional messages and enjoy a cleaner, distraction-free study experience.
        </p>
        <div class="promo-nav-popup__actions">
          <a href="/plan.html" class="btn btn--primary">Upgrade Now – CAD $10</a>
          <button id="promo-nav-dismiss-btn" class="btn btn--ghost">Maybe Later</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('promo-popup-open');

    const closeBtn = overlay.querySelector('#promo-nav-close-btn');
    const dismissBtn = overlay.querySelector('#promo-nav-dismiss-btn');

    const cleanup = () => {
      overlay.remove();
      document.body.classList.remove('promo-popup-open');
    };

    if (closeBtn) closeBtn.addEventListener('click', cleanup, { once: true });
    if (dismissBtn) dismissBtn.addEventListener('click', cleanup, { once: true });

    // Close on overlay background click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });
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

    this._questionsSincePrompt += 1;

    if (this._questionsSincePrompt < QUESTIONS_PER_PROMO) {
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
          <h3>Great progress! 🎉</h3>
          <p>
            You've answered ${QUESTIONS_PER_PROMO} questions! Upgrade to ad-free for uninterrupted practice sessions.
          </p>
        </div>

        <div class="vignette-ad__footer">
          <div class="vignette-ad__actions">
            <button id="vignette-close-btn" class="btn btn--ghost" disabled>
              Continue (5s)
            </button>
            <a href="/plan.html" class="btn btn--primary">Go Ad-Free – CAD $10</a>
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

  async _isAdFreeUser() {
    try {
      if (window.SubscriptionService) {
        await window.SubscriptionService.waitForInit(5000);
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
