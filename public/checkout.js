// checkout.js (module or normal script)
// ✅ Fills Order Summary for PAID + FREE
// ✅ Locks payment UI only for FREE

(() => {
  const $ = (sel) => document.querySelector(sel);

  const money = (n) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(Number(n || 0));

  function readSelection() {
    const params = new URLSearchParams(window.location.search);

    // 1) URL params (preferred)
    let price = params.get("price");
    let duration = params.get("duration");
    let badge = params.get("badge");

    // 2) localStorage fallback (your plan.js stores this)
    if (price == null || duration == null || badge == null) {
      try {
        const ls = JSON.parse(
          localStorage.getItem("checkout_selection") || "null",
        );
        if (ls) {
          if (price == null) price = ls.price;
          if (duration == null) duration = ls.duration;
          if (badge == null) badge = ls.badge;
        }
      } catch {}
    }

    // 3) sessionStorage fallback (your other code mentions selected_plan)
    if (price == null || duration == null || badge == null) {
      try {
        const ss = JSON.parse(
          sessionStorage.getItem("selected_plan") || "null",
        );
        if (ss) {
          if (price == null) price = ss.price ?? ss.total;
          if (duration == null) duration = ss.duration;
          if (badge == null) badge = ss.badge ?? ss.label;
        }
      } catch {}
    }

    const priceNum = Number(price || 0);
    const badgeStr = String(badge || "").trim();
    const durationStr = String(duration || "").trim();

    // Treat as free if price == 0 OR badge/plan indicates free
    const isFree =
      priceNum === 0 ||
      badgeStr.toLowerCase() === "free" ||
      (params.get("plan") || "").toLowerCase() === "free" ||
      (params.get("tier") || "").toLowerCase() === "free" ||
      params.get("free") === "1" ||
      params.get("total") === "0";

    return { params, priceNum, badgeStr, durationStr, isFree };
  }

  function applyBadgeColor(badgeEl, badgeStr, isFree) {
    const tier = (badgeStr || (isFree ? "free" : "")).toLowerCase();

    badgeEl.classList.remove(
      "order-summary-badge--free",
      "order-summary-badge--bronze",
      "order-summary-badge--silver",
      "order-summary-badge--gold",
    );

    if (tier.includes("bronze")) {
      badgeEl.classList.add("order-summary-badge--bronze");
    } else if (tier.includes("silver")) {
      badgeEl.classList.add("order-summary-badge--silver");
    } else if (tier.includes("gold")) {
      badgeEl.classList.add("order-summary-badge--gold");
    } else {
      badgeEl.classList.add("order-summary-badge--free");
    }
  }

  function fillSummaryText({ badgeStr, durationStr, isFree }) {
    const badgeEl = document.querySelector(".order-summary-badge");
    const textEl = document.querySelector(".order-summary-text");

    if (badgeEl) {
      const label = badgeStr || (isFree ? "Free" : "");
      badgeEl.textContent = label ? label.toUpperCase() : "";
      applyBadgeColor(badgeEl, label, isFree);
    }

    if (textEl) {
      if (isFree) {
        textEl.textContent =
          "You selected the Free plan. Your access will be activated immediately.";
      } else {
        const d = durationStr ? ` (${durationStr})` : "";
        textEl.textContent =
          `You selected the ${badgeStr || "plan"} plan${d}. ` +
          "Taxes and fees are calculated below.";
      }
    }
  }

  function setTotals({ priceNum, isFree }) {
    const platformFeeEl = $("#platformFeeId");
    const subtotalEl = $("#subtotalId");
    const gstEl = $("#gstId");
    const pstEl = $("#pstId");
    const totalEl = $("#totalId");

    // first line "Package Price" value span
    const pkgPriceEl = document.querySelector(
      ".order-summary-block--breakdown .order-summary-line .order-summary-value",
    );

    if (isFree) {
      if (pkgPriceEl) pkgPriceEl.textContent = money(0);
      if (platformFeeEl) platformFeeEl.textContent = money(0);
      if (subtotalEl) subtotalEl.textContent = money(0);
      if (gstEl) gstEl.textContent = money(0);
      if (pstEl) pstEl.textContent = money(0);
      if (totalEl) totalEl.textContent = money(0);
      return;
    }

    const pkg = Number(priceNum || 0);
    const platformFee = pkg * 0.025; // 2.5%
    const subtotal = pkg + platformFee;
    const gst = subtotal * 0.05; // 5%
    const pst = subtotal * 0.07; // 7%
    const total = subtotal + gst + pst;

    if (pkgPriceEl) pkgPriceEl.textContent = money(pkg);
    if (platformFeeEl) platformFeeEl.textContent = money(platformFee);
    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (gstEl) gstEl.textContent = money(gst);
    if (pstEl) pstEl.textContent = money(pst);
    if (totalEl) totalEl.textContent = money(total);
  }

  function disablePaymentUIForFree() {
    document.body.classList.add("is-free-checkout");

    const pmCard = $("#pm-card");
    const pmPaypal = $("#pm-paypal");
    if (pmCard) pmCard.disabled = true;
    if (pmPaypal) pmPaypal.disabled = true;
    if (pmCard) pmCard.checked = true;

    const paymentSection = $("#paymentSection");
    if (paymentSection) {
      paymentSection
        .querySelectorAll("input, select, textarea, button")
        .forEach((el) => {
          el.disabled = true;
          el.setAttribute("tabindex", "-1");
        });
    }

    const infoTitle = document.querySelector(".order-summary-info__title");
    if (infoTitle) infoTitle.textContent = "No payment required";

    // Create CTA below the summary card (outside payment lock)
    const card = document.querySelector("main.checkout .card");
    if (!card) return;

    if ($("#freeCtaRow")) return;

    const row = document.createElement("div");
    row.id = "freeCtaRow";
    row.style.padding = "0 24px 24px 24px";

    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "btn btn--primary";
    cta.textContent = "Activate Free Plan";
    cta.addEventListener("click", async () => {
      // ✅ Set user to free tier in Firestore
      await activateFreeTier();
      window.location.href = "profile.html";
    });

    row.appendChild(cta);
    card.appendChild(row);
  }

  /**
   * Activate free tier for logged-in user
   */
  async function activateFreeTier() {
    try {
      const user = window.AuthService?.getCurrentUser();
      if (!user) {
        console.warn('Cannot activate free tier: no user logged in');
        return;
      }

      if (!window.SubscriptionService) {
        console.warn('SubscriptionService not available');
        return;
      }

      await window.SubscriptionService.updateUserSubscriptionData(user.uid, {
        tier: 'free',
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        usage: {
          listeningQuestionsAnswered: 0,
          readingQuestionsAnswered: 0,
          writingPromptsUsed: 0
        }
      });

      console.log('✅ Free tier activated');
    } catch (error) {
      console.error('Error activating free tier:', error);
    }
  }

  /**
   * Activate paid tier after successful payment
   */
  async function activatePaidTier(tierName, durationDays, price = 0) {
    try {
      const user = window.AuthService?.getCurrentUser();
      if (!user) {
        console.warn('Cannot activate paid tier: no user logged in');
        return;
      }

      if (!window.SubscriptionService) {
        console.warn('SubscriptionService not available');
        return;
      }

      await window.SubscriptionService.setUserTier(user.uid, tierName, durationDays, price);
      console.log(`✅ ${tierName} tier activated for ${durationDays} days at $${price}`);
    } catch (error) {
      console.error('Error activating paid tier:', error);
    }
  }

  /**
   * Map badge string to tier name and duration
   */
  function getTierConfig(badgeStr, durationStr) {
    const badge = (badgeStr || '').toLowerCase();
    const duration = (durationStr || '').toLowerCase();

    // Quick Study: 10 days
    if (badge.includes('quick') || badge.includes('study')) {
      return { tier: 'quick-study', days: 10 };
    }

    // 30-day Intensive
    if (badge.includes('30') || badge.includes('intensive') || duration.includes('30')) {
      return { tier: '30-day', days: 30 };
    }

    // Full Preparation: 60 days
    if (badge.includes('full') || badge.includes('prep') || duration.includes('60')) {
      return { tier: 'full-prep', days: 60 };
    }

    // Default to 30-day if unclear
    return { tier: '30-day', days: 30 };
  }

  function wirePaidPaymentToggle() {
    const pmCard = $("#pm-card");
    const pmPaypal = $("#pm-paypal");
    const paypalBox = $("#paypalBox");
    const cardForm = $("#cardForm");

    const sync = () => {
      const isPaypal = pmPaypal && pmPaypal.checked;
      if (paypalBox) paypalBox.classList.toggle("hidden", !isPaypal);
      if (cardForm) cardForm.style.display = isPaypal ? "none" : "block";
    };

    if (pmCard) pmCard.addEventListener("change", sync);
    if (pmPaypal) pmPaypal.addEventListener("change", sync);
    sync();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // Wait for auth to be ready
    if (window.AuthService) {
      await window.AuthService.waitForAuth();
    }

    const sel = readSelection();

    // If user arrived with NO params and NO storage, you'll see blanks:
    // This is expected—fix by ensuring plan.html click handler runs (file name mismatch).
    fillSummaryText(sel);
    setTotals(sel);

    if (sel.isFree) {
      disablePaymentUIForFree();
    } else {
      wirePaidPaymentToggle();
      
      // ✅ Payment button - Stripe integration with security
      const completePaymentBtn = $("#completePaymentBtn");
      if (completePaymentBtn) {
        completePaymentBtn.addEventListener("click", async () => {
          try {
            console.log("💳 Payment button clicked");

            const tierConfig = getTierConfig(sel.badgeStr, sel.durationStr);
            console.log("Selected tier:", tierConfig);

            // Validate Stripe service is loaded
            if (!window.StripeService) {
              alert("Payment system not loaded. Please refresh the page.");
              return;
            }

            // Initialize Stripe if not already done
            if (!window.StripeService.isInitialized()) {
              console.log("Initializing Stripe...");
              await window.StripeService.init();
            }

            console.log("Creating checkout session...");

            // SECURITY: Only send tier name, backend controls pricing
            await window.StripeService.createCheckoutSession(
                tierConfig.tier,
            );
          } catch (error) {
            console.error("❌ Payment error:", error);
            alert("Payment failed: " + error.message);
          }
        });
      } else {
        console.error("Complete payment button not found!");
      }
    }
  });
})();
