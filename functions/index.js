const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");

// Define secret parameters for Stripe keys
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Initialize Stripe - will be set in function runtime
let stripe;

admin.initializeApp();

// ============================================================================
// SECURITY: Whitelist of valid Stripe Price IDs
// These are the ONLY price IDs that can be used
// Update these values from your Stripe Dashboard
// ============================================================================
const VALID_PRICE_IDS = {
  "price_1SymwrCwya11CpgZ3eFENT6r": {
    tier: "quick-study",
    name: "Quick Study (10 days)",
    price: 9.99,
    durationDays: 10,
  },
  "price_1SymymCwya11CpgZCe0uZNIc": {
    tier: "30-day",
    name: "30-Day Intensive",
    price: 19.99,
    durationDays: 30,
  },
  "price_1SymzZCwya11CpgZSf5VpJdy": {
    tier: "full-prep",
    name: "Full Preparation",
    price: 34.99,
    durationDays: 60,
  },
};

/**
 * Verify Firebase Authentication Token
 * Security: Ensures only authenticated users can create checkout sessions
 * @param {object} req - HTTP request object
 * @return {Promise<object>} Decoded Firebase auth token
 */
async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid authentication token");
  }
}

/**
 * Validate Price ID
 * Security: Prevents price manipulation by validating against whitelist
 * @param {string} priceId - Stripe price ID to validate
 * @return {object} Plan details from whitelist
 */
function validatePriceId(priceId) {
  const planDetails = VALID_PRICE_IDS[priceId];

  if (!planDetails) {
    throw new Error("Invalid price ID");
  }

  return planDetails;
}

/**
 * Create Stripe Checkout Session
 * Security Features:
 * - Validates Firebase Auth token
 * - Whitelists price IDs (prevents price manipulation)
 * - Uses server-side pricing (never trusts client)
 * - Stores metadata for webhook processing
 */
exports.createCheckoutSession = onRequest(
    {secrets: [stripeSecretKey], cors: true},
    async (req, res) => {
      // Initialize Stripe with the secret (only once)
      if (!stripe) {
        stripe = require("stripe")(stripeSecretKey.value());
      }

      try {
        // SECURITY: Only accept POST requests
        if (req.method !== "POST") {
          console.error("🔍 DEBUG: Invalid method:", req.method);
          return res.status(405).json({error: "Method not allowed"});
        }

        console.log("🔍 DEBUG: Request received");

        // SECURITY: Verify Firebase Authentication token
        let decodedToken;
        try {
          decodedToken = await verifyAuthToken(req);
          console.log(
              "🔍 DEBUG: Auth token verified for user:",
              decodedToken.uid,
          );
        } catch (error) {
          console.error(
              "🔍 DEBUG: Auth verification failed:",
              error.message,
          );
          return res.status(401).json({
            error: "Unauthorized: " + error.message,
          });
        }

        const {priceId, successUrl, cancelUrl} = req.body;
        console.log("🔍 DEBUG: Request body:", {priceId, successUrl, cancelUrl});

        // Validate required parameters
        if (!priceId) {
          console.error("🔍 DEBUG: Missing priceId");
          return res.status(400).json({error: "Missing priceId"});
        }

        if (!successUrl || !cancelUrl) {
          console.error("🔍 DEBUG: Missing redirect URLs");
          return res.status(400).json({
            error: "Missing redirect URLs",
          });
        }

        // SECURITY: Validate price ID against whitelist
        let planDetails;
        try {
          planDetails = validatePriceId(priceId);
          console.log("🔍 DEBUG: Price ID validated:", planDetails);
        } catch (error) {
          console.error("🔍 DEBUG: Invalid price ID:", priceId);
          return res.status(400).json({error: "Invalid plan selected"});
        }

        // Get user details from verified token
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        console.log("🔍 DEBUG: Creating Stripe session for:", {
          userId,
          userEmail,
          priceId,
          tier: planDetails.tier,
          price: planDetails.price,
        });

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price: priceId, // Use validated priceId
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: userEmail,
          client_reference_id: userId,
          // Store metadata for webhook processing
          metadata: {
            userId: userId,
            tier: planDetails.tier,
            price: planDetails.price.toString(),
            durationDays: planDetails.durationDays.toString(),
            priceId: priceId,
          },
        });

        console.log("✅ Checkout session created:", session.id);

        // Return only the session ID (not sensitive data)
        res.json({id: session.id});
      } catch (error) {
        console.error("❌ ERROR creating checkout session:", {
          message: error.message,
          type: error.type,
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack,
        });

        // Return more detailed error for debugging
        res.status(500).json({
          error: "Failed to create checkout session",
          details: error.message,
          type: error.type,
        });
      }
    });

/**
 * Stripe Webhook Handler
 * Security Features:
 * - Verifies Stripe webhook signature (prevents request forgery)
 * - Uses rawBody for signature verification
 * - Validates event data before processing
 * - Creates atomic Firestore updates
 *
 * Note: For Firebase Functions v2, we collect the raw body from the
 * request stream before processing to enable Stripe signature verification
 */
exports.stripeWebhook = onRequest(
    {secrets: [stripeSecretKey, stripeWebhookSecret]},
    (req, res) => {
      // Initialize Stripe with the secret
      if (!stripe) {
        stripe = require("stripe")(stripeSecretKey.value());
      }

      // SECURITY: Verify webhook signature
      const sig = req.headers["stripe-signature"];
      const webhookSecret = stripeWebhookSecret.value();

      if (!sig) {
        console.error("Missing Stripe signature header");
        return res.status(400).send("Missing signature");
      }

      // Collect raw body for signature verification
      const chunks = [];

      req.on("data", (chunk) => {
        chunks.push(chunk);
      });

      req.on("end", async () => {
        const rawBody = Buffer.concat(chunks);

        let event;

        try {
          // SECURITY: Construct event from raw body buffer
          event = stripe.webhooks.constructEvent(
              rawBody,
              sig,
              webhookSecret,
          );
        } catch (err) {
          console.error(
              "⚠️ Webhook signature verification failed:", err.message,
          );
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log("✅ Webhook verified:", event.type);

        // Handle successful payment event
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;

          console.log("Processing payment:", {
            sessionId: session.id,
            customerId: session.customer,
            amount: session.amount_total,
          });

          try {
            // Extract metadata (set by createCheckoutSession)
            const {userId, tier, price, durationDays} = session.metadata;

            if (!userId || !tier || !durationDays) {
              console.error("Missing required metadata:", session.metadata);
              return res.status(400).send("Invalid session metadata");
            }

            // Calculate subscription dates
            const now = new Date();
            const endDate = new Date(
                now.getTime() + parseInt(durationDays) * 24 * 60 * 60 * 1000,
            );

            // Update user subscription in Firestore
            // Use set with merge to create document if it doesn't exist
            await admin.firestore().collection("users").doc(userId).set({
              tier: tier,
              subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
              subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
              stripeCustomerId: session.customer || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {merge: true});

            console.log(`✅ User ${userId} upgraded to ${tier}`);

            // Create order record for tracking
            const planInfo = VALID_PRICE_IDS[session.metadata.priceId];
            const planName = planInfo? planInfo.name : tier;

            await admin.firestore().collection("orders").add({
              userId: userId,
              tier: tier,
              plan: planName,
              price: parseFloat(price) || (session.amount_total / 100),
              currency: session.currency || "usd",
              status: "completed",
              stripeSessionId: session.id,
              stripePaymentIntent: session.payment_intent,
              stripeCustomerId: session.customer,
              customerEmail: session.customer_email,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`✅ Order created for user ${userId}`);

            // Send success response to Stripe
            res.json({received: true});
          } catch (error) {
            console.error("❌ Error processing payment:", error);
            // Return 500 so Stripe retries the webhook
            return res.status(500).send("Error processing payment");
          }
        } else {
          // Acknowledge other event types
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
          res.json({received: true});
        }
      });

      req.on("error", (err) => {
        console.error("❌ Error reading request body:", err);
        res.status(400).send("Bad request");
      });
    });

