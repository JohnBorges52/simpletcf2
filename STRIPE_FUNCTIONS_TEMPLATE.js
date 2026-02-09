const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Stripe with secret key from Firebase config
// Set with: firebase functions:config:set stripe.secret_key="sk_test_..."
const stripe = require('stripe')(functions.config().stripe.secret_key);

admin.initializeApp();

/**
 * Create Stripe Checkout Session
 * Called from frontend to initiate payment
 */
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
  // Enable CORS for your domain
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const { priceId, userId, userEmail, tier, price, successUrl, cancelUrl } = req.body;

    // Validate input
    if (!priceId || !userId || !tier) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Creating checkout session:', { priceId, userId, tier, userEmail });

    // Create Stripe Checkout Session
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
      client_reference_id: userId,
      metadata: {
        userId: userId,
        tier: tier,
        price: price
      }
    });

    console.log('Checkout session created:', session.id);
    res.json({ id: session.id });
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stripe Webhook Handler
 * Listens for payment events from Stripe
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = functions.config().stripe.webhook_secret;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Webhook event received:', event.type);

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, tier, price } = session.metadata;

    console.log('Payment completed:', { userId, tier, price });

    try {
      // Map tier to duration
      const durations = {
        'quick-study': 10,
        '30-day': 30,
        'full-prep': 60
      };

      const durationDays = durations[tier];
      if (!durationDays) {
        console.error('Invalid tier:', tier);
        return res.status(400).send('Invalid tier');
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Update user's subscription in Firestore
      await admin.firestore().collection('users').doc(userId).update({
        tier: tier,
        subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
        subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate)
      });

      console.log(`✅ User ${userId} subscription updated to ${tier}`);

      // Create order record
      const planNames = {
        'quick-study': 'Quick Study (10 days)',
        '30-day': '30-Day Intensive',
        'full-prep': 'Full Preparation'
      };

      await admin.firestore().collection('orders').add({
        userId: userId,
        tier: tier,
        plan: planNames[tier] || tier,
        price: parseFloat(price) || (session.amount_total / 100),
        status: 'Completed',
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Order created for user ${userId}`);

    } catch (error) {
      console.error('Error processing payment:', error);
      return res.status(500).send('Error processing payment');
    }
  }

  // Return success response
  res.json({ received: true });
});
