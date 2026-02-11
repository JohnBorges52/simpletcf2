// plans.js
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // =======================
  // ✅ Auth helpers (same logic as index.html)
  // =======================
  function getFirebaseAuthUser() {
    const fbKey = Object.keys(localStorage).find((k) =>
      k.startsWith("firebase:authUser"),
    );
    if (!fbKey) return null;
    try {
      return JSON.parse(localStorage.getItem(fbKey));
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    const fbUser = getFirebaseAuthUser();
    if (fbUser && fbUser.email) return true;

    if (localStorage.getItem("isLoggedIn") === "true") return true;

    const fallbackEmail = localStorage.getItem("userEmail");
    return !!fallbackEmail;
  }

  function goToLoginThenReturn(checkoutUrl) {
    sessionStorage.setItem("postLoginRedirect", checkoutUrl.toString());
    const loginUrl = new URL("/login", window.location.origin);
    loginUrl.searchParams.set(
      "next",
      checkoutUrl.pathname + checkoutUrl.search,
    );
    window.location.href = loginUrl.toString();
  }

  function updateAuthNavFromLocalStorage() {
    const authLink = document.getElementById("auth-link");
    const authItem = document.getElementById("auth-item");
    if (!authItem || !authLink) return;

    if (isLoggedIn()) {
      authLink.textContent = "Profile";
      authLink.href = "/profile";
    } else {
      authLink.textContent = "Sign In";
      authLink.href = "/login";
    }
  }

  // =======================
  // ✅ Check if user has active paid plan
  // =======================
  async function checkUserPlanStatus() {
    try {
      // Wait for auth to be ready
      if (window.AuthService) {
        await window.AuthService.waitForAuth();
        const user = window.AuthService.getCurrentUser();
        
        if (!user) return null;
        
        // Initialize subscription service to get user tier
        if (window.SubscriptionService) {
          await window.SubscriptionService.init();
          const tier = window.SubscriptionService.getCurrentTier();
          return tier;
        }
      }
      return null;
    } catch (error) {
      console.error("Error checking user plan status:", error);
      return null;
    }
  }

  // =======================
  // ✅ ALL paid plans → auth-gated + check existing plan
  // =======================
  function initPlanCheckoutButtons() {
    document.querySelectorAll(".price__cta").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.preventDefault();

        const price = parseFloat(button.dataset.price || "0");
        const duration = (button.dataset.duration || "").trim();
        const badge = (button.dataset.badge || "Free").trim();

        localStorage.setItem(
          "checkout_selection",
          JSON.stringify({ price, duration, badge }),
        );

        const checkoutUrl = new URL("/checkout", window.location.origin);
        checkoutUrl.searchParams.set("price", String(price));
        checkoutUrl.searchParams.set("duration", duration);
        checkoutUrl.searchParams.set("badge", badge);

        if (!isLoggedIn()) {
          goToLoginThenReturn(checkoutUrl);
          return;
        }

        // ✅ Check if user already has a paid plan
        const currentTier = await checkUserPlanStatus();
        if (currentTier && currentTier !== 'free') {
          alert('You already have an active plan. You cannot purchase another plan while your current subscription is active. Please wait for it to expire or contact support.');
          return;
        }

        window.location.href = checkoutUrl.toString();
      });
    });
  }

  // =======================
  // ✅ Free plan button → same auth-gate + same next param
  // =======================
  function initStartFreeButton() {
    document.querySelectorAll(".start-free-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const checkoutUrl = new URL("/checkout", window.location.origin);
        checkoutUrl.searchParams.set("price", "0");
        checkoutUrl.searchParams.set("duration", "Free");
        checkoutUrl.searchParams.set("badge", "Free");

        localStorage.setItem(
          "checkout_selection",
          JSON.stringify({ price: 0, duration: "Free", badge: "Free" }),
        );

        if (!isLoggedIn()) {
          goToLoginThenReturn(checkoutUrl);
          return;
        }

        window.location.href = checkoutUrl.toString();
      });
    });
  }

  function initSmoothAnchors() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (!href || href === "#") return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", href);
      });
    });
  }

  function initPlansCarousel() {
    // Find all carousels (both #plans and index.html)
    const carousels = document.querySelectorAll(".plan-carousel");
    
    carousels.forEach((carousel) => {
      const track = carousel.querySelector(".plan-grid--carousel");
      const prev = carousel.querySelector(".plan-carousel__btn--prev");
      const next = carousel.querySelector(".plan-carousel__btn--next");
      
      if (!track || !prev || !next) return;

      const cards = Array.from(track.querySelectorAll(".plan"));
      if (!cards.length) return;

      let index = 0;

      const visibleCount = () =>
        window.matchMedia("(max-width: 900px)").matches ? 1 : 3;

      function clampIndex(i) {
        const max = Math.max(0, cards.length - visibleCount());
        return Math.max(0, Math.min(i, max));
      }

      function gapPx() {
        const cs = getComputedStyle(track);
        return parseFloat(cs.gap || "0") || 0;
      }

      function stepPx() {
        const cardW = cards[0].getBoundingClientRect().width;
        return cardW + gapPx();
      }

      function render() {
        index = clampIndex(index);
        const x = stepPx() * index;
        track.style.transform = `translateX(${-x}px)`;

        const max = Math.max(0, cards.length - visibleCount());
        prev.disabled = index <= 0;
        next.disabled = index >= max;
      }

      prev.addEventListener("click", () => {
        index -= 1;
        render();
      });

      next.addEventListener("click", () => {
        index += 1;
        render();
      });

      window.addEventListener("resize", () => render());
      requestAnimationFrame(render);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateAuthNavFromLocalStorage();

    // Mobile nav toggle
    const header = document.getElementById("mainHeader");
    const toggle = document.getElementById("navToggle");
    if (header && toggle) {
      toggle.addEventListener("click", () => {
        const open = header.classList.toggle("open-nav");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }

    // Show internal test plan only for admin
    const fbUser = getFirebaseAuthUser();
    if (fbUser && fbUser.email === "jrborges52@gmail.com") {
      const testPlan = document.getElementById("internalTestPlan");
      if (testPlan) testPlan.style.display = "block";
    }

    // Handle test payment button
    const testBtn = document.querySelector(".test-payment-btn");
    if (testBtn) {
      testBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        // Stripe Price ID for internal test
        const testPriceId = "price_1SzXBVCjnElzxNngInFwOA9j";
        const user = fbUser;
        if (!user || user.email !== "jrborges52@gmail.com") {
          alert("Not allowed");
          return;
        }
        // Get Firebase ID token
        let idToken = null;
        if (window.firebase && window.firebase.auth) {
          const currentUser = window.firebase.auth().currentUser;
          if (currentUser) idToken = await currentUser.getIdToken();
        }
        if (!idToken) {
          alert("Login required");
          return;
        }
        const response = await fetch("https://us-central1-simpletcf.cloudfunctions.net/createCheckoutSession", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + idToken
          },
          body: JSON.stringify({
            priceId: testPriceId,
            successUrl: window.location.origin + "/profile.html?payment=success",
            cancelUrl: window.location.origin + "/pricing.html?payment=cancelled"
          })
        });
        const data = await response.json();
        if (data.id) {
          const stripe = Stripe("pk_live_51LPvkVCjnElzxNngyE3orsGbMc4G8W3qXqyC0hj0HPtSupDNj5B5TcX9QzZOsUX5x39psHalzUL94AvjXjpzlsGj00IGft9mbl");
          stripe.redirectToCheckout({ sessionId: data.id });
        } else {
          alert("Erro: " + (data.error || JSON.stringify(data)));
        }
      });
    }

    initPlanCheckoutButtons();
    initSmoothAnchors();
    initPlansCarousel();
    initStartFreeButton();
  });
})();
