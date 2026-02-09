# Stripe Webhook Fix - Order Creation Issue

## Problem Summary

Your Stripe integration was failing to create orders in Firebase after successful payments. The logs showed:
- Payment success detected on the frontend
- Tier update polling (10 attempts) but always timing out
- No orders being created in Firestore

## Root Cause

The Stripe webhook handler (`stripeWebhook` Cloud Function) was unable to verify webhook signatures because:

1. **Firebase Cloud Functions v2 doesn't provide `req.rawBody` by default**
   - Stripe requires the raw request body to verify webhook signatures
   - Without proper signature verification, the webhook would reject all incoming events
   - This prevented the function from processing payment events

2. **Missing error handling for async operations**
   - The original implementation had race conditions
   - Responses could be sent before async operations completed

## Changes Made

### 1. Fixed Raw Body Handling (`functions/index.js`)

**Before:**
```javascript
exports.stripeWebhook = onRequest(
    {secrets: [stripeSecretKey, stripeWebhookSecret]},
    async (req, res) => {
      // ... tried to use req.rawBody which doesn't exist
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    }
);
```

**After:**
```javascript
exports.stripeWebhook = onRequest(
    {secrets: [stripeSecretKey, stripeWebhookSecret]},
    async (req, res) => {
      try {
        // Collect raw body as a Promise
        const rawBody = await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("error", reject);
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
        });
        
        // Now we can verify the signature
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        // ... process the event
      } catch (error) {
        // Proper error handling
      }
    }
);
```

### 2. Enhanced Logging

Added detailed logs at each step:
- `🔍 Webhook request received` - When webhook is called
- `🔍 Has signature: true/false` - Signature validation check
- `✅ Webhook verified: checkout.session.completed` - Successful signature verification
- `🔍 Extracted metadata: {...}` - Shows all metadata from Stripe
- `🔍 Updating user document in Firestore...` - Before tier update
- `✅ User {userId} upgraded to {tier}` - After successful tier update
- `🔍 Creating order record in Firestore...` - Before order creation
- `✅ Order created for user {userId}` - After successful order creation

### 3. Improved Metadata Validation

- Extract `priceId` from metadata explicitly
- Validate `priceId` exists before using it
- Fallback to tier name if `priceId` is unavailable

### 4. Better Error Handling

- All operations wrapped in try-catch
- Error handler registered before data handlers
- Only one response sent per request (prevents race conditions)
- Return 500 for Firestore errors (so Stripe retries)
- Return 400 for validation errors (no retry needed)

## How to Deploy and Test

### Step 1: Deploy the Functions

```bash
cd /path/to/simpletcf2
firebase deploy --only functions
```

Expected output:
```
✔ functions[createCheckoutSession(us-central1)]
✔ functions[stripeWebhook(us-central1)]
```

### Step 2: Verify Webhook Configuration in Stripe

1. Go to [Stripe Dashboard - Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Verify you have an endpoint configured:
   - **URL:** `https://us-central1-simpletcf.cloudfunctions.net/stripeWebhook`
   - **Events:** `checkout.session.completed`
3. If not configured, click "+ Add endpoint" and set it up
4. Copy the "Signing secret" (starts with `whsec_...`)
5. Update Firebase secret:
   ```bash
   echo "whsec_YOUR_ACTUAL_SECRET" > .webhook_secret
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET < .webhook_secret
   ```
6. Redeploy functions: `firebase deploy --only functions`

### Step 3: Test Payment Flow

1. **Navigate to your site**
   - Go to: `https://simpletcf.web.app/plan.html`
   - Select a plan (e.g., "Quick Study")
   - Click "Subscribe Now"

2. **Complete checkout**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any ZIP code (e.g., `12345`)
   - Click "Complete Payment"

3. **Monitor the webhook**
   - Open a terminal and run:
     ```bash
     firebase functions:log --only stripeWebhook
     ```
   - You should see the logs in real-time

4. **Verify the results**
   - After payment, you should be redirected to `/profile.html?payment=success`
   - The page should show "🎉 Payment successful!" alert
   - Check Firestore in [Firebase Console](https://console.firebase.google.com/project/simpletcf/firestore):
     - **users/{userId}** should have:
       - `tier`: "quick-study" (or whatever you selected)
       - `subscriptionStartDate`: Current timestamp
       - `subscriptionEndDate`: Future timestamp
       - `stripeCustomerId`: Customer ID from Stripe
     - **orders** collection should have a new document with:
       - `userId`: Your user ID
       - `tier`: "quick-study"
       - `plan`: "Quick Study (10 days)"
       - `price`: 9.99 (or selected plan price)
       - `status`: "completed"
       - `stripeSessionId`: Session ID
       - etc.

### Step 4: Check Logs

If anything goes wrong, check the logs:

```bash
# View all function logs
firebase functions:log

# View only webhook logs
firebase functions:log --only stripeWebhook

# View logs with timestamps
firebase functions:log --only stripeWebhook --lines 100
```

Look for these indicators:

**Success indicators:**
- ✅ `Webhook verified: checkout.session.completed`
- ✅ `User {userId} upgraded to {tier}`
- ✅ `Order created for user {userId}`

**Error indicators:**
- ❌ `Missing Stripe signature header` - Stripe isn't sending signature
- ⚠️ `Webhook signature verification failed` - Secret mismatch or rawBody issue
- ❌ `Missing required metadata` - createCheckoutSession didn't set metadata
- ❌ `Error processing payment` - Firestore permission or connection issue

## Expected Log Output (Success Case)

```
🔍 Webhook request received
🔍 Has signature: true
✅ Webhook verified: checkout.session.completed
Processing payment: { sessionId: 'cs_test_...', customerId: 'cus_...', amount: 1119 }
🔍 Extracted metadata: {
  userId: 'oEm7vxvw9OOwZzKq4FUmSlcmwxQ2',
  tier: 'quick-study',
  price: '9.99',
  durationDays: '10',
  priceId: 'price_1SymwrCwya11CpgZ3eFENT6r'
}
🔍 Updating user document in Firestore...
✅ User oEm7vxvw9OOwZzKq4FUmSlcmwxQ2 upgraded to quick-study
🔍 Creating order record in Firestore...
✅ Order created for user oEm7vxvw9OOwZzKq4FUmSlcmwxQ2
```

## Troubleshooting

### Issue: Webhook still not receiving events

**Check Stripe Dashboard:**
1. Go to [Stripe Events](https://dashboard.stripe.com/test/events)
2. Find your recent `checkout.session.completed` event
3. Click on "View webhook details"
4. Check if delivery was attempted
5. Look for error messages

**Common causes:**
- Webhook endpoint not configured in Stripe
- Wrong URL configured
- Webhook secret not set or incorrect

### Issue: "Webhook signature verification failed"

**Solution:**
1. Get the correct signing secret from [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click on your endpoint
3. Click "Reveal signing secret"
4. Update Firebase secret:
   ```bash
   echo "whsec_YOUR_ACTUAL_SECRET" > .webhook_secret
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET < .webhook_secret
   firebase deploy --only functions
   ```

### Issue: "Missing required metadata"

**Solution:**
This means `createCheckoutSession` isn't setting metadata properly. Check:
1. The `createCheckoutSession` function is deployed
2. The frontend is calling it with the correct tier
3. Check createCheckoutSession logs: `firebase functions:log --only createCheckoutSession`

### Issue: Orders created but tier not updated in profile page

**Solution:**
This is a caching issue. The profile page may be using stale data:
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check Firestore directly to confirm tier was updated

## Security Summary

✅ **No security vulnerabilities found** - CodeQL analysis passed
✅ **Webhook signature verification** - Prevents unauthorized webhook calls
✅ **Metadata validation** - Ensures all required data is present
✅ **Secrets stored securely** - Firebase Secret Manager (not in code)
✅ **Error messages sanitized** - No sensitive data exposed in errors
✅ **Firestore security rules** - Ensures proper access control

## Next Steps for User

1. **Deploy the functions** - `firebase deploy --only functions`
2. **Verify webhook configuration** in Stripe Dashboard
3. **Test with a payment** using test card `4242 4242 4242 4242`
4. **Verify order creation** in Firestore
5. **Check logs** if anything doesn't work as expected

If you encounter any issues, the enhanced logging will show exactly where the problem occurs. Share the logs and I can help diagnose further.
