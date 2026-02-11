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
  });
})();
