/**
 * ad-service.js
 * Manages Google AdSense integration for SimpleTCF
 *
 * Features:
 *  - Fixed bottom ad bar (refreshes on each navigation)
 *  - Internal support / upsell overlay every 10 questions answered
 *  - Robust multi-layer ad-blocker detection with fullscreen overlay
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
const QUESTIONS_PER_AD = 20;

/** How long (ms) to wait between periodic re-checks */
const ADBLOCK_RECHECK_INTERVAL = 10000;
/** Minimum ms between two full detection runs (debounce) */
const ADBLOCK_DEBOUNCE_MS = 5000;

// -----------------------------------------------------------------------

class AdService {
  constructor() {
    this._adBlockDetected = false;
    this._questionsSincePrompt = 0;
    this._lastDetectionTime = 0;
    this._recheckTimer = null;
    this._overlayMutationObserver = null;
  }

  /**
   * Bootstrap ads — call once on DOMContentLoaded
   */
  async init() {
    if (await this._isAdFreeUser()) {
      this._pauseAutoAds();
      return;
    }

    // Inject the external overlay CSS as a redundancy strategy — both external
    // CSS and inline styles are applied so the overlay remains styled even if
    // one approach is intercepted by the ad blocker.
    this._injectOverlayCss();

    const blocked = await this._runDetection();
    if (blocked) {
      this._adBlockDetected = true;
      this._showAdBlockOverlay();
    } else {
      this._injectAdSenseScript();
      this._initBottomAdBar();
    }

    this._schedulePeriodicRecheck();
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
  // Ad-blocker detection — multi-layer
  // -----------------------------------------------------------------------

  /**
   * Run all detection layers in parallel and apply a consensus strategy:
   * - If fetch detection reports a block, return `true` immediately (network
   *   blocks are the most reliable signal).
   * - Otherwise, require at least 2 out of 3 layers to agree before
   *   concluding that an ad blocker is present.  This prevents the single
   *   bait-detection false positive from suppressing ads on first load.
   * @returns {Promise<boolean>}
   */
  async _runDetection() {
    const now = Date.now();
    if (now - this._lastDetectionTime < ADBLOCK_DEBOUNCE_MS) {
      console.debug('[AdService] Detection debounced.');
      return this._adBlockDetected;
    }
    this._lastDetectionTime = now;

    console.debug('[AdService] Running multi-layer ad-blocker detection…');

    // Run all layers in parallel and wait for all of them to settle.
    // Fetch detection is the most reliable (network-level block), so we
    // give it priority: if fetch says "blocked", we trust it immediately.
    // Without a fetch block, both bait AND script must agree before we
    // conclude an ad blocker is present — this prevents a single
    // false-positive bait result from suppressing ads on first load.
    const [baitBlocked, scriptBlocked, fetchBlocked] = await Promise.all([
      this._detectWithBaits(),
      this._detectWithScript(),
      this._detectWithFetch(),
    ]);

    console.debug('[AdService] Layer results — bait:', baitBlocked, '| script:', scriptBlocked, '| fetch:', fetchBlocked);

    // Fetch is primary: a network-level block is the strongest signal.
    if (fetchBlocked) {
      console.debug('[AdService] Detection result: true (fetch confirmed)');
      return true;
    }

    // Without a fetch block, require at least two of the remaining layers
    // to agree (bait + script both flagged) before concluding blocked.
    const result = baitBlocked && scriptBlocked;
    console.debug('[AdService] Detection result:', result, `(bait:${baitBlocked}, script:${scriptBlocked})`);
    return result;
  }

  // ── Layer 1: Bait elements ──────────────────────────────────────────────

  /**
   * Insert multiple "bait" elements with class names that ad blockers
   * commonly target, then check them with several visibility methods.
   * @returns {Promise<boolean>}
   */
  _detectWithBaits() {
    return new Promise((resolve) => {
      const baits = [
        { tag: 'div',    cls: 'adsbygoogle',       style: 'width:300px;height:250px;' },
        { tag: 'div',    cls: 'ad-banner',          style: 'width:728px;height:90px;' },
        { tag: 'div',    cls: 'advertisement',      style: 'width:1px;height:1px;' },
        { tag: 'ins',    cls: 'adsbygoogle',        style: 'display:block;width:1px;height:1px;' },
        { tag: 'div',    cls: 'ad-slot ad-leaderboard', style: 'width:1px;height:1px;' },
        { tag: 'div',    cls: 'adsbox',             style: 'width:1px;height:1px;' },
      ];

      const container = document.createElement('div');
      container.setAttribute('aria-hidden', 'true');
      container.style.cssText =
        'position:absolute;left:-9999px;top:-9999px;pointer-events:none;';

      const nodes = baits.map(({ tag, cls, style }) => {
        const el = document.createElement(tag);
        el.className = cls;
        el.style.cssText = style;
        container.appendChild(el);
        return el;
      });

      document.body.appendChild(container);

      // Give ad blockers up to 800 ms to act, then inspect.
      // 400 ms was insufficient — CSS timing and browser rendering
      // inconsistencies caused false positives on first load.
      setTimeout(() => {
        let blocked = false;

        for (const el of nodes) {
          const cs = window.getComputedStyle(el);
          if (
            el.offsetHeight === 0 ||
            el.offsetWidth === 0 ||
            cs.display === 'none' ||
            cs.visibility === 'hidden' ||
            cs.opacity === '0' ||
            el.offsetParent === null
          ) {
            blocked = true;
            break;
          }
        }

        container.remove();
        console.debug('[AdService] Bait detection:', blocked);
        resolve(blocked);
      }, 800);
    });
  }

  // ── Layer 2: Script / global object check ───────────────────────────────

  /**
   * Check whether the AdSense global object was loaded.  Ad blockers
   * intercept the adsbygoogle.js request before it executes.
   * @returns {Promise<boolean>}
   */
  _detectWithScript() {
    return new Promise((resolve) => {
      // Google's script sets adsbygoogle.loaded = true once it runs.
      // An undefined global at startup is inconclusive (async script not yet
      // loaded), so we poll until either the flag appears or the deadline passes.
      const checkLoaded = () => {
        const asg = window.adsbygoogle;
        return asg && asg.loaded === true;
      };

      // Give the script up to 2 seconds to load.
      const deadline = Date.now() + 2000;
      const poll = setInterval(() => {
        if (checkLoaded()) {
          clearInterval(poll);
          console.debug('[AdService] Script detection: not blocked');
          resolve(false);
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(poll);
          // Deadline elapsed without adsbygoogle.loaded being set — blocked.
          const blocked = !checkLoaded();
          console.debug('[AdService] Script detection:', blocked);
          resolve(blocked);
        }
      }, 100);
    });
  }

  // ── Layer 3: Network request check ─────────────────────────────────────

  /**
   * Attempt a HEAD request to a known AdSense resource.
   * Ad blockers intercept this request, causing a network error.
   * @returns {Promise<boolean>}
   */
  async _detectWithFetch() {
    const endpoints = [
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/1/?',
    ];

    for (const url of endpoints) {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 3000);
      try {
        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: ctrl.signal,
        });
        // In no-cors mode a successful (opaque) response means the request
        // was not blocked.  A blocked request throws before we get here.
        console.debug('[AdService] Fetch detection: not blocked (got response for', url, ')');
        return false;
      } catch (err) {
        // If the first endpoint threw, try the next one before concluding.
        console.debug('[AdService] Fetch detection: request failed for', url, err && err.name);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // All endpoints failed → ad blocker is active.
    console.debug('[AdService] Fetch detection: blocked');
    return true;
  }

  // ── Overlay ─────────────────────────────────────────────────────────────

  /** Inject the external CSS stylesheet for the overlay (idempotent). */
  _injectOverlayCss() {
    const id = 'adblock-overlay-css';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'ad-blocker-overlay.css';
    document.head.appendChild(link);
  }

  /**
   * Show a fullscreen overlay that blocks the page until the user either
   * disables their ad blocker or upgrades to the ad-free plan.
   */
  _showAdBlockOverlay() {
    if (document.getElementById('adblock-overlay')) return;

    console.debug('[AdService] Showing ad-block overlay.');

    // Inline styles act as a fallback if the external CSS was blocked.
    const inlineOverlayStyle = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'background:rgba(10,20,40,0.97)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    ].join(';');

    const inlineBoxStyle = [
      'background:#fff',
      'border-radius:18px',
      'padding:44px 36px',
      'max-width:500px',
      'width:92%',
      'text-align:center',
      'box-shadow:0 24px 64px rgba(0,0,0,.55)',
      'box-sizing:border-box',
    ].join(';');

    const overlay = document.createElement('div');
    overlay.id = 'adblock-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Ad blocker detected');
    overlay.style.cssText = inlineOverlayStyle;

    overlay.innerHTML = `
      <div class="aob-box" style="${inlineBoxStyle}">
        <span class="aob-icon" style="font-size:52px;display:block;margin-bottom:18px;">🚫</span>
        <h2 class="aob-title" style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0 0 14px;">
          Ad Blocker Detected
        </h2>
        <p class="aob-body" style="font-size:15px;color:#374151;line-height:1.65;margin:0 0 10px;">
          SimpleTCF is completely <strong>free</strong> and maintained by advertising revenue.
          Ads are what allow us to keep all content accessible to everyone at no cost.
        </p>
        <p class="aob-body" style="font-size:15px;color:#374151;line-height:1.65;margin:0 0 10px;">
          Please whitelist <strong>simpletcf.com</strong> in your ad blocker and refresh the page
          to continue.
        </p>
        <div class="aob-countdown" id="aob-countdown"
             style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fbbf24;
                    border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600;
                    margin:12px 0 20px;">
          Checking again in <span id="aob-timer">10</span>s…
        </div>
        <div class="aob-actions" style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
          <button id="aob-refresh-btn"
                  style="display:block;width:100%;padding:14px 20px;background:#1d4ed8;
                         color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;
                         cursor:pointer;box-sizing:border-box;">
            ✅ I've Disabled It — Refresh
          </button>
          <a href="/plan.html"
             style="display:block;width:100%;padding:13px 20px;background:transparent;
                    color:#1d4ed8;border:2px solid #1d4ed8;border-radius:10px;font-size:15px;
                    font-weight:600;cursor:pointer;text-decoration:none;box-sizing:border-box;">
            ⭐ Go Ad-Free — CAD $10
          </a>
        </div>
        <p class="aob-note"
           style="font-size:12px;color:#9ca3af;margin:16px 0 0;line-height:1.5;">
          Already subscribed? <a href="/login.html" style="color:#6b7280;">Sign in</a>
          to restore your ad-free access.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('adblock-wall-open');

    // Wire up the refresh button.
    const refreshBtn = document.getElementById('aob-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => window.location.reload());
      setTimeout(() => refreshBtn.focus(), 120);
    }

    // Countdown display — counts down to the next automatic re-check.
    this._startOverlayCountdown(10);

    // Guard the overlay against removal by browser extensions using
    // MutationObserver (re-insert if removed).
    this._watchOverlay(overlay);
  }

  /**
   * Animate the countdown timer shown inside the overlay.
   * When it reaches 0 the page is silently re-checked; if the user has now
   * disabled their ad blocker the overlay is removed and ads are loaded.
   * The countdown loops automatically until the blocker is gone.
   * @param {number} seconds
   */
  _startOverlayCountdown(seconds) {
    const timerEl = document.getElementById('aob-timer');

    const startTick = (initialSeconds) => {
      let remaining = initialSeconds;

      const tick = setInterval(async () => {
        remaining -= 1;
        if (timerEl) timerEl.textContent = String(remaining);

        if (remaining <= 0) {
          clearInterval(tick);
          // Re-run detection — if the user disabled their blocker, clear overlay.
          const stillBlocked = await this._runDetection();
          if (!stillBlocked) {
            console.debug('[AdService] Ad blocker gone — removing overlay.');
            this._adBlockDetected = false;
            if (this._overlayMutationObserver) {
              this._overlayMutationObserver.disconnect();
              this._overlayMutationObserver = null;
            }
            const overlay = document.getElementById('adblock-overlay');
            if (overlay) overlay.remove();
            document.body.classList.remove('adblock-wall-open');
            // Now load ads normally.
            this._injectAdSenseScript();
            this._initBottomAdBar();
          } else {
            // Still blocked — restart the countdown.
            startTick(10);
          }
        }
      }, 1000);
    };

    startTick(seconds);
  }

  /**
   * Use a MutationObserver to detect if an extension removes the overlay
   * from the DOM, and re-insert it immediately.
   * @param {HTMLElement} overlay
   */
  _watchOverlay(overlay) {
    if (this._overlayMutationObserver) {
      this._overlayMutationObserver.disconnect();
    }

    this._overlayMutationObserver = new MutationObserver(() => {
      if (!document.getElementById('adblock-overlay') && this._adBlockDetected) {
        console.debug('[AdService] Overlay was removed — re-inserting.');
        document.body.appendChild(overlay);
        document.body.classList.add('adblock-wall-open');
      }
    });

    this._overlayMutationObserver.observe(document.body, {
      childList: true,
      subtree: false,
    });
  }

  // ── Periodic background checks ──────────────────────────────────────────

  /**
   * Schedule a re-detection run every ADBLOCK_RECHECK_INTERVAL ms so that
   * ad blockers enabled after initial page load are also caught.
   */
  _schedulePeriodicRecheck() {
    if (this._recheckTimer) return;

    this._recheckTimer = setInterval(async () => {
      if (await this._isAdFreeUser()) return;

      const blocked = await this._runDetection();
      if (blocked && !this._adBlockDetected) {
        console.debug('[AdService] Ad blocker detected on periodic recheck.');
        this._adBlockDetected = true;
        this._showAdBlockOverlay();
      }
    }, ADBLOCK_RECHECK_INTERVAL);
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
