// Stripe Payment Service
// Handles Stripe Checkout sessions and payment processing

class StripeService {
  constructor() {
    this.stripe = null;
    this.initialized = false;
    
    // REPLACE WITH YOUR PUBLISHABLE KEY FROM STRIPE DASHBOARD
    // Get from: https://dashboard.stripe.com/test/apikeys
    this.publishableKey = 'pk_test_51SymiRCwya11CpgZM80uSO1NdGsTCQNO7J6W7bJZKsDYdjOMQBzMcR6ERbrUiW7HLnseg5AdcpcvU8RmKtNLQfER00hkpc0AVo';
    
    // REPLACE WITH YOUR PRICE IDs FROM STRIPE PRODUCTS
    // Create products first, then copy the price IDs
    this.priceIds = {
      'quick-study': 'price_1SymwrCwya11CpgZ3eFENT6r',
      '30-day': 'price_1SymymCwya11CpgZCe0uZNIc',
      'full-prep': 'price_1SymzZCwya11CpgZSf5VpJdy'
    };
    
    // REPLACE WITH YOUR CLOUD FUNCTION URL AFTER DEPLOYMENT
    // Will be: https://us-central1-simpletcf.cloudfunctions.net/createCheckoutSession
    this.cloudFunctionUrl = 'https://us-central1-simpletcf.cloudfunctions.net/createCheckoutSession';
  }

  /**
   * Initialize Stripe with publishable key
   */
  async init() {
    if (this.initialized) return;
    
    try {
      if (this.publishableKey.includes('YOUR_PUBLISHABLE_KEY')) {
        console.error('⚠️ Please set your Stripe publishable key in stripe-service.js');
        return;
      }
      
      // Stripe is loaded from CDN script in checkout.html
      if (typeof Stripe === 'undefined') {
        console.error('Stripe.js not loaded. Add <script src="https://js.stripe.com/v3/"></script> to HTML');
        return;
      }
      
      this.stripe = Stripe(this.publishableKey);
      this.initialized = true;
      console.log('✅ Stripe initialized');
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
    }
  }

  /**
   * Create Checkout Session and redirect to Stripe
   */
  async createCheckoutSession(tier, price) {
    if (!this.stripe) {
      console.error('Stripe not initialized. Call init() first.');
      return;
    }

    try {
      const user = window.AuthService?.getCurrentUser();
      if (!user) {
        alert('Please log in to purchase a plan');
        window.location.href = '/login.html';
        return;
      }

      const priceId = this.getPriceId(tier);
      
      if (!priceId || priceId.includes('YOUR_')) {
        console.error('⚠️ Please set your Stripe Price IDs in stripe-service.js');
        alert('Payment system not configured. Please contact support.');
        return;
      }

      if (this.cloudFunctionUrl.includes('YOUR_CLOUD_FUNCTION')) {
        console.error('⚠️ Please set your Cloud Function URL in stripe-service.js');
        alert('Payment system not configured. Please contact support.');
        return;
      }

      console.log('Creating checkout session for:', { tier, priceId, userId: user.uid });

      // Call Firebase Cloud Function to create Checkout Session
      const response = await fetch(this.cloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: priceId,
          userId: user.uid,
          userEmail: user.email,
          tier: tier,
          price: price,
          successUrl: window.location.origin + '/profile.html?payment=success',
          cancelUrl: window.location.origin + '/checkout.html?payment=cancelled'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const session = await response.json();

      if (!session.id) {
        throw new Error('No session ID returned from server');
      }

      console.log('Redirecting to Stripe Checkout...');

      // Redirect to Stripe Checkout
      const result = await this.stripe.redirectToCheckout({
        sessionId: session.id
      });

      if (result.error) {
        alert(result.error.message);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Payment failed. Please try again or contact support.');
    }
  }

  /**
   * Get Stripe Price ID for a tier
   */
  getPriceId(tier) {
    return this.priceIds[tier];
  }

  /**
   * Get tier configuration (duration and price mapping)
   */
  getTierConfig(tier) {
    const configs = {
      'quick-study': { days: 10, displayName: 'Quick Study (10 days)' },
      '30-day': { days: 30, displayName: '30-Day Intensive' },
      'full-prep': { days: 60, displayName: 'Full Preparation' }
    };
    return configs[tier];
  }
}

// Export as singleton
window.StripeService = new StripeService();
