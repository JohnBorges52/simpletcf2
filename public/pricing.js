// pricing.js
(() => {
  function getFirebaseAuthUser() {
    const fbKey = Object.keys(localStorage).find((k) =>
      k.startsWith("firebase:authUser")
    );
    if (!fbKey) return null;
    try {
      return JSON.parse(localStorage.getItem(fbKey));
    } catch {
      return null;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
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
        // Get Firebase ID token robustly
        let idToken = null;
        if (window.AuthService && window.AuthService.getCurrentUser) {
          await window.AuthService.waitForAuth();
          const currentUser = window.AuthService.getCurrentUser();
          if (currentUser && currentUser.getIdToken) {
            idToken = await currentUser.getIdToken();
          }
        }
        // Fallback to firebase.auth
        if (!idToken && window.firebase && window.firebase.auth) {
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

    // Carousel logic (copiado do plan.js)
    function initPlansCarousel() {
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
    initPlansCarousel();
  });
})();
