// ============================================================================
// Stripe Payment Service
// SECURITY: Frontend Integration with Best Practices
// ============================================================================
// This service handles Stripe Checkout integration for the frontend
// Security features:
// - Uses publishable key only (never secret key)
// - Sends authentication token with requests
// - Delegates all pricing logic to backend
// - Validates user authentication before payment
// ============================================================================

class StripeService {
  constructor() {
    this.stripe = null;
    this.initialized = false;

    // SECURITY: Only publishable key is safe to expose in frontend
    // Get from: https://dashboard.stripe.com/apikeys (Live mode)
    this.publishableKey = "pk_live_51LPvkVCjnElzxNngyE3orsGbMc4G8W3qXqyC0hj0HPtSupDNj5B5TcX9QzZOsUX5x39psHalzUL94AvjXjpzlsGj00IGft9mbl";

    // SECURITY: Map tier names to Stripe Price IDs
    // These are used for display purposes only
    // Backend validates against its own whitelist
    this.priceIds = {
      "quick-study": "price_1SzOPyCjnElzxNngxs0lvgQv",
      "30-day": "price_1SzOQyCjnElzxNngf4vtCnTC",
      "full-prep": "price_1SzOSLCjnElzxNngwqqTwHal",
    };

    // Cloud Function endpoint (deployed URL)
    this.cloudFunctionUrl =
      "https://us-central1-simpletcf.cloudfunctions.net/createCheckoutSession";
  }

  /**
   * Initialize Stripe with publishable key
   */
  async init() {
    if (this.initialized) return;

    try {
      // Verify Stripe.js is loaded from CDN
      if (typeof Stripe === "undefined") {
        throw new Error(
            "Stripe.js not loaded. Add script tag to HTML head.",
        );
      }

      this.stripe = Stripe(this.publishableKey);
      this.initialized = true;
      console.log("✅ Stripe initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Stripe:", error);
      throw error;
    }
  }

  /**
   * Create Checkout Session and redirect to Stripe
   * SECURITY FEATURES:
   * - Validates user authentication
   * - Sends Firebase Auth token to backend
   * - Backend validates price (prevents frontend manipulation)
   * - Only sends priceId (not price amount)
   */
  async createCheckoutSession(tier) {
    if (!this.stripe) {
      throw new Error("Stripe not initialized. Call init() first.");
    }

    try {
      // SECURITY: Verify user is authenticated
      const user = window.AuthService?.getCurrentUser();
      if (!user) {
        alert("Please log in to purchase a plan");
        window.location.href = "/login";
        return;
      }

      // SECURITY: Get Firebase Auth token for backend validation
      const idToken = await user.getIdToken();

      // Get Price ID for the selected tier
      const priceId = this.getPriceId(tier);

      if (!priceId) {
        throw new Error("Invalid plan selected");
      }

      console.log("🔍 DEBUG: Creating checkout session for:", {tier, priceId});
      console.log("🔍 DEBUG: User ID:", user.uid);
      console.log("🔍 DEBUG: User Email:", user.email);

      // SECURITY: Call Cloud Function with authentication
      const response = await fetch(this.cloudFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // SECURITY: Send auth token in Authorization header
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          // SECURITY: Only send priceId, not price amount
          // Backend controls all pricing logic
          priceId: priceId,
          successUrl:
            window.location.origin + "/profile.html?payment=success",
          cancelUrl:
            window.location.origin + "/checkout.html?payment=cancelled",
        }),
      });

      console.log("🔍 DEBUG: Response status:", response.status);

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = "Failed to create checkout session";
        try {
          const errorData = await response.json();
          console.error("🔍 DEBUG: Backend error:", errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error("🔍 DEBUG: Could not parse error response");
        }

        if (response.status === 401) {
          throw new Error("Authentication failed. Please log in again.");
        }
        throw new Error(`Backend error (${response.status}): ${errorMessage}`);
      }

      const session = await response.json();

      if (!session.id) {
        throw new Error("Invalid session response");
      }

      console.log("✅ Session created, redirecting to Stripe...");

      // Redirect to Stripe Checkout
      const result = await this.stripe.redirectToCheckout({
        sessionId: session.id,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error("❌ Checkout error:", error);
      alert(`Payment failed: ${error.message}. Please try again.`);
      throw error;
    }
  }

  /**
   * Get Stripe Price ID for a tier
   */
  getPriceId(tier) {
    return this.priceIds[tier] || null;
  }

  /**
   * Check if Stripe is initialized
   */
  isInitialized() {
    return this.initialized;
  }
}

// Create global instance
window.StripeService = new StripeService();
