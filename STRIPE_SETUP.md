# Stripe Payment Integration Setup Guide

## Overview
This guide will help you integrate Stripe payments into SimpleTCF for handling subscription purchases.

---

## Step 1: Create Stripe Account & Get Test Keys

1. **Sign up for Stripe**
   - Go to https://stripe.com
   - Create an account (it's free)
   
2. **Get your test API keys**
   - Go to https://dashboard.stripe.com/test/apikeys
   - You'll see two keys:
     - **Publishable key** (starts with `pk_test_...`) - Safe to use in frontend
     - **Secret key** (starts with `sk_test_...`) - MUST be kept secret, backend only
   
3. **Enable Test Mode**
   - Make sure the toggle in top-right says "Test mode"
   - All transactions in test mode are fake and free

---

## Step 2: Create Products & Prices in Stripe Dashboard

1. **Go to Products**
   - https://dashboard.stripe.com/test/products
   
2. **Create 3 products** (one for each paid tier):

   **Product 1: Quick Study**
   - Name: `Quick Study (10 days)`
   - Description: `10 days of unlimited practice`
   - Click "Add pricing"
     - Price: `$19.99` (or your price)
     - Billing period: `One time`
     - Save the **Price ID** (starts with `price_...`)

   **Product 2: 30-Day Intensive**
   - Name: `30-Day Intensive`
   - Description: `30 days of full access`
   - Price: `$49.99` (or your price)
   - Billing period: `One time`
   - Save the **Price ID**

   **Product 3: Full Preparation**
   - Name: `Full Preparation (60 days)`
   - Description: `60 days of complete exam preparation`
   - Price: `$79.99` (or your price)
   - Billing period: `One time`
   - Save the **Price ID**

---

## Step 3: Install Stripe.js (Frontend)

No npm install needed! Stripe provides a CDN script.

**Add to `public/checkout.html` in the `<head>` section:**

```html
<script src="https://js.stripe.com/v3/"></script>
```

---

## Step 4: Create Stripe Configuration File

**Create `public/stripe-config.js`:**

```javascript
// Stripe Configuration
// IMPORTANT: Only use PUBLISHABLE keys here (pk_test_... or pk_live_...)
// NEVER put secret keys in frontend code

const STRIPE_CONFIG = {
  // Get this from https://dashboard.stripe.com/test/apikeys
  publishableKey: 'pk_test_YOUR_PUBLISHABLE_KEY_HERE',
  
  // Price IDs from your Stripe products (created in Step 2)
  prices: {
    'quick-study': 'price_YOUR_QUICK_STUDY_PRICE_ID',
    '30-day': 'price_YOUR_30DAY_PRICE_ID',
    'full-prep': 'price_YOUR_FULL_PREP_PRICE_ID'
  }
};

// Initialize Stripe
const stripe = Stripe(STRIPE_CONFIG.publishableKey);
```

**Add to `public/checkout.html` before `checkout.js`:**

```html
<script type="module" src="stripe-config.js"></script>
```

---

## Step 5: Update checkout.html

**Add Stripe script to `<head>`:**

```html
<script src="https://js.stripe.com/v3/"></script>
```

---

## Step 6: Create Stripe Checkout Function

**Add to `public/stripe-service.js` (new file):**

```javascript
// Stripe Payment Service
// Handles Stripe Checkout sessions and payment processing

class StripeService {
  constructor() {
    this.stripe = null;
    this.initialized = false;
  }

  /**
   * Initialize Stripe with publishable key
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Get publishable key from Firebase Remote Config or hardcode for now
      const publishableKey = 'pk_test_YOUR_PUBLISHABLE_KEY_HERE';
      
      this.stripe = Stripe(publishableKey);
      this.initialized = true;
      console.log('✅ Stripe initialized');
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
    }
  }

  /**
   * Create Checkout Session and redirect to Stripe
   */
  async createCheckoutSession(tier, priceId) {
    if (!this.stripe) {
      console.error('Stripe not initialized');
      return;
    }

    try {
      const user = window.AuthService?.getCurrentUser();
      if (!user) {
        alert('Please log in to purchase a plan');
        window.location.href = '/login.html';
        return;
      }

      // Call your backend to create a Checkout Session
      const response = await fetch('YOUR_CLOUD_FUNCTION_URL/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: priceId,
          userId: user.uid,
          userEmail: user.email,
          tier: tier,
          successUrl: window.location.origin + '/profile.html?payment=success',
          cancelUrl: window.location.origin + '/checkout.html?payment=cancelled'
        })
      });

      const session = await response.json();

      // Redirect to Stripe Checkout
      const result = await this.stripe.redirectToCheckout({
        sessionId: session.id
      });

      if (result.error) {
        alert(result.error.message);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Payment failed. Please try again.');
    }
  }

  /**
   * Map tier to Stripe Price ID
   */
  getPriceId(tier) {
    const prices = {
      'quick-study': 'price_YOUR_QUICK_STUDY_PRICE_ID',
      '30-day': 'price_YOUR_30DAY_PRICE_ID',
      'full-prep': 'price_YOUR_FULL_PREP_PRICE_ID'
    };
    return prices[tier];
  }
}

// Export as singleton
window.StripeService = new StripeService();
```

---

## Step 7: Create Firebase Cloud Function (Backend)

Stripe requires a backend to create checkout sessions securely.

**Install Stripe SDK in your functions:**

```bash
cd functions
npm install stripe
```

**Create `functions/index.js` (or add to existing):**

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(functions.config().stripe.secret_key);

admin.initializeApp();

// Create Stripe Checkout Session
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const { priceId, userId, userEmail, tier, successUrl, cancelUrl } = req.body;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      metadata: {
        userId: userId,
        tier: tier
      }
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook - Handle successful payments
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = functions.config().stripe.webhook_secret;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, tier } = session.metadata;

    // Map tier to duration
    const durations = {
      'quick-study': 10,
      '30-day': 30,
      'full-prep': 60
    };

    const durationDays = durations[tier] || 30;
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Update user's subscription in Firestore
    await admin.firestore().collection('users').doc(userId).update({
      tier: tier,
      subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate)
    });

    // Create order record
    await admin.firestore().collection('orders').add({
      userId: userId,
      tier: tier,
      plan: getPlanName(tier),
      price: session.amount_total / 100, // Convert cents to dollars
      status: 'Completed',
      stripeSessionId: session.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Subscription activated for user ${userId}: ${tier}`);
  }

  res.json({ received: true });
});

function getPlanName(tier) {
  const names = {
    'quick-study': 'Quick Study (10 days)',
    '30-day': '30-Day Intensive',
    'full-prep': 'Full Preparation'
  };
  return names[tier] || tier;
}
```

---

## Step 8: Set Stripe Secret Keys in Firebase

**Set your Stripe secret key (DO NOT commit this to git):**

```bash
firebase functions:config:set stripe.secret_key="sk_test_YOUR_SECRET_KEY_HERE"
```

**After you set up webhooks (Step 9), also set:**

```bash
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

**View your config:**

```bash
firebase functions:config:get
```

---

## Step 9: Set Up Stripe Webhooks

1. **Deploy your Cloud Functions first:**
   ```bash
   firebase deploy --only functions
   ```

2. **Get your webhook URL** (from deploy output):
   ```
   https://us-central1-simpletcf.cloudfunctions.net/stripeWebhook
   ```

3. **Add webhook in Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/test/webhooks
   - Click "Add endpoint"
   - Endpoint URL: Your `stripeWebhook` function URL
   - Events to send: Select `checkout.session.completed`
   - Click "Add endpoint"
   - Copy the **Signing secret** (starts with `whsec_...`)

4. **Save webhook secret to Firebase:**
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
   firebase deploy --only functions
   ```

---

## Step 10: Update checkout.js to Use Stripe

**Replace the mock payment button with real Stripe checkout:**

```javascript
// In checkout.js, update the completePaymentBtn click handler

if (completePaymentBtn) {
  completePaymentBtn.addEventListener("click", async () => {
    const tierConfig = getTierConfig(sel.badgeStr, sel.durationStr);
    
    // Initialize Stripe if not already done
    if (!window.StripeService.initialized) {
      await window.StripeService.init();
    }
    
    // Get Price ID for this tier
    const priceId = window.StripeService.getPriceId(tierConfig.tier);
    
    // Create checkout session and redirect to Stripe
    await window.StripeService.createCheckoutSession(tierConfig.tier, priceId);
  });
}
```

**Add script tags to `checkout.html`:**

```html
<script src="https://js.stripe.com/v3/"></script>
<script type="module" src="stripe-service.js"></script>
```

---

## Step 11: Test Payment Flow

**Test Card Numbers (Stripe provides these for testing):**

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Requires authentication:** `4000 0025 0000 3155`

**Any future expiry date, any CVC, any postal code**

**Testing Steps:**

1. Select a plan on plans page
2. Click "Continue to checkout"
3. Click payment button
4. Enter test card: `4242 4242 4242 4242`
5. Enter any future date, any CVC, any ZIP
6. Complete payment
7. Should redirect to profile page
8. Check Firestore - user's tier should be updated
9. Check Stripe Dashboard - payment should appear
10. Check orders tab - new order should be created

---

## Step 12: Handle Payment Success/Cancellation

**Update `profile.js` to show payment confirmation:**

```javascript
// Add to profile.js DOMContentLoaded
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('payment') === 'success') {
  alert('Payment successful! Your subscription is now active.');
  // Remove query param
  window.history.replaceState({}, document.title, '/profile.html');
}
```

---

## Security Checklist

✅ **DO:**
- Use publishable key (`pk_test_...`) in frontend
- Use secret key (`sk_test_...`) only in Cloud Functions
- Verify webhook signatures
- Use HTTPS in production
- Store sensitive keys in Firebase Functions Config

❌ **DON'T:**
- Put secret keys in frontend code
- Trust client-side payment amounts
- Skip webhook verification
- Commit API keys to git

---

## Going Live (Production)

When ready for real payments:

1. **Complete Stripe account verification**
   - Submit business information
   - Add bank account for payouts

2. **Get live API keys**
   - Switch from "Test mode" to "Live mode" in Stripe Dashboard
   - Get live keys (`pk_live_...` and `sk_live_...`)

3. **Update Firebase config:**
   ```bash
   firebase functions:config:set stripe.secret_key="sk_live_YOUR_LIVE_KEY"
   ```

4. **Update frontend publishable key** in `stripe-service.js`

5. **Create live webhook** pointing to your production Cloud Function

6. **Test with real card** (you'll be charged!)

---

## Testing the Integration

**Test Mode Scenarios:**

1. **Successful Payment:** `4242 4242 4242 4242`
2. **Card Declined:** `4000 0000 0000 0002`
3. **Insufficient Funds:** `4000 0000 0000 9995`
4. **Expired Card:** `4000 0000 0000 0069`

**Check:**
- Payment appears in Stripe Dashboard
- Webhook fires successfully
- User tier updates in Firestore
- Order record created
- User redirected to success page

---

## Troubleshooting

**Webhook not firing?**
- Check Cloud Function logs: `firebase functions:log`
- Verify webhook URL in Stripe Dashboard
- Check webhook signing secret matches

**Payment succeeds but tier doesn't update?**
- Check webhook is receiving events
- Check Cloud Function logs for errors
- Verify user ID in session metadata

**"Stripe is not defined" error?**
- Make sure Stripe.js script is loaded before your code
- Check browser console for script loading errors

---

## Additional Resources

- **Stripe Testing:** https://stripe.com/docs/testing
- **Stripe Checkout:** https://stripe.com/docs/payments/checkout
- **Firebase Functions:** https://firebase.google.com/docs/functions
- **Webhooks:** https://stripe.com/docs/webhooks

---

## Next Steps

1. Create Stripe account
2. Get API keys
3. Create products and prices
4. Create `stripe-service.js` file
5. Create Cloud Functions for checkout
6. Deploy and test with test cards
7. Set up webhooks
8. Test complete flow
9. Go live when ready!
