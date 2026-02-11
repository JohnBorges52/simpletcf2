const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
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
  "price_1SzOPyCjnElzxNngxs0lvgQv": {
    tier: "quick-study",
    name: "Quick Study (10 days)",
    price: 10.28,
    durationDays: 10,
  },
  "price_1SzOQyCjnElzxNngf4vtCnTC": {
    tier: "30-day",
    name: "30-Day Intensive",
    price: 20.58,
    durationDays: 30,
  },
  "price_1SzOSLCjnElzxNngwqqTwHal": {
    tier: "full-prep",
    name: "Full Preparation",
    price: 36.02,
    durationDays: 60,
  },
  "price_1SzXBVCjnElzxNngInFwOA9j": {
    tier: "test",
    name: "Internal Test (Live)",
    price: 0.50,
    durationDays: 1,
    internalOnly: true,
  },
};

/**
 * Send purchase confirmation email
 * @param {string} email - User email
 * @param {string} userName - User display name
 * @param {string} planName - Plan name
 * @param {number} durationDays - Plan duration in days
 */
async function sendPurchaseConfirmationEmail(email, userName, planName, durationDays) {
  try {
    // Create email HTML template
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f7fa;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #6366f1 0%, #C1C6F8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
    }
    .checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #C1C6F8 100%);
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      color: white;
    }
    h1 {
      color: #1f2937;
      font-size: 28px;
      margin: 0 0 10px 0;
    }
    .subtitle {
      color: #6b7280;
      font-size: 16px;
      margin: 0;
    }
    .plan-details {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      border-radius: 8px;
      padding: 24px;
      margin: 30px 0;
    }
    .plan-name {
      font-size: 24px;
      font-weight: bold;
      color: #6366f1;
      margin: 0 0 10px 0;
    }
    .plan-duration {
      font-size: 16px;
      color: #4b5563;
      margin: 0;
    }
    .features {
      margin: 30px 0;
    }
    .feature-item {
      display: flex;
      align-items: start;
      margin-bottom: 15px;
    }
    .feature-icon {
      color: #10b981;
      font-size: 20px;
      margin-right: 12px;
      margin-top: 2px;
    }
    .feature-text {
      color: #374151;
      font-size: 15px;
      line-height: 1.5;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #C1C6F8 100%);
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 30px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .support-link {
      color: #6366f1;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="checkmark">✓</div>
      <h1>Welcome to SimpleTCF!</h1>
      <p class="subtitle">Your account has been approved</p>
    </div>

    <p>Hi ${userName || "there"},</p>

    <p>
      Great news! Your payment has been successfully processed,
      and your SimpleTCF subscription is now active.
    </p>

    <div class="plan-details">
      <p class="plan-name">${planName}</p>
      <p class="plan-duration">Access for ${durationDays} days</p>
    </div>

    <div class="features">
      <div class="feature-item">
        <span class="feature-icon">✓</span>
        <span class="feature-text">
          <strong>Full Access:</strong>
          All listening and reading practice questions
        </span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">✓</span>
        <span class="feature-text">
          <strong>Real Test Simulations:</strong>
          Practice with actual exam-style tests
        </span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">✓</span>
        <span class="feature-text">
          <strong>Progress Tracking:</strong>
          Monitor your improvement over time
        </span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">✓</span>
        <span class="feature-text">
          <strong>Weight-Based Strategy:</strong>
          Focus on high-impact questions
        </span>
      </div>
    </div>

    <p>
      You can now access all features of SimpleTCF and
      start preparing for your TCF Canada exam.
    </p>

    <center>
      <a href="https://simpletcf.web.app" class="cta-button">
        Start Practicing Now
      </a>
    </center>

    <div class="footer">
      <p>
        Questions? Contact us at
        <a href="mailto:support@simpletcf.com" class="support-link">
          support@simpletcf.com
        </a>
      </p>
      <p style="margin-top: 10px;">
        © ${new Date().getFullYear()} SimpleTCF. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    await admin.firestore().collection("mail").add({
      to: email,
      message: {
        subject: "Your SimpleTCF Account is Active!",
        html: emailHTML,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Silent fail - don't want email failure to break the webhook
  }
}

/**
 * Send invoice email that was auto-created by Stripe Checkout
 * @param {string} invoiceId - Stripe invoice ID
 * @return {Promise<boolean>} Success status
 */
async function sendStripeInvoice(invoiceId) {
  if (!stripe) return false;

  try {
    if (!invoiceId) return false;

    const invoice = await stripe.invoices.retrieve(invoiceId);

    if (invoice.status === "draft") {
      await stripe.invoices.finalizeInvoice(invoiceId);
    }

    await stripe.invoices.sendInvoice(invoiceId);
    return true;
  } catch (error) {
    return false;
  }
}

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
    return await admin.auth().verifyIdToken(idToken);
  } catch (error) {
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
  if (!planDetails) throw new Error("Invalid price ID");
  return planDetails;
}

/**
 * Create Stripe Checkout Session
 */
exports.createCheckoutSession = onRequest(
  { secrets: [stripeSecretKey], cors: true },
  async (req, res) => {
    // ✅ Log no começo: confirma que entrou e ajuda a debugar CORS/auth
    console.log("➡️ createCheckoutSession HIT", {
      method: req.method,
      origin: req.headers.origin,
      hasAuth: !!req.headers.authorization,
      bodyKeys: Object.keys(req.body || {}),
    });

    // ✅ Init Stripe com logs seguros
    try {
      const secretValue = (stripeSecretKey.value() || "").trim();

      console.log("Stripe key prefix:", secretValue.substring(0, 8));
      console.log("Stripe key length:", secretValue.length);
      console.log("Stripe mode:", secretValue.startsWith("sk_live_") ? "LIVE" : "TEST/UNKNOWN");

      if (!secretValue) {
        console.error("❌ STRIPE_SECRET_KEY is empty/undefined");
        return res.status(500).json({ error: "Stripe secret key missing" });
      }

      if (!stripe) {
        stripe = require("stripe")(secretValue);
        console.log("✅ Stripe initialized");
      }
    } catch (initError) {
      console.error("❌ Stripe init error:", initError?.message || initError);
      console.error("❌ Stripe init stack:", initError?.stack);
      return res.status(500).json({ error: "Stripe initialization failed" });
    }

    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      let decodedToken;
      try {
        decodedToken = await verifyAuthToken(req);
      } catch (error) {
        console.warn("⚠️ Unauthorized:", error?.message || error);
        return res.status(401).json({
          error: "Unauthorized: " + (error?.message || "Unknown auth error"),
        });
      }

      const { priceId, successUrl, cancelUrl } = req.body || {};

      if (!priceId) {
        return res.status(400).json({ error: "Missing priceId" });
      }
      if (!successUrl || !cancelUrl) {
        return res.status(400).json({ error: "Missing redirect URLs" });
      }

      let planDetails;
      try {
        planDetails = validatePriceId(priceId);
      } catch (error) {
        console.warn("⚠️ Invalid plan selected:", priceId);
        return res.status(400).json({ error: "Invalid plan selected" });
      }

      if (planDetails.internalOnly && decodedToken.email !== "jrborges52@gmail.com") {
        return res.status(403).json({ error: "Not allowed" });
      }

      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      if (!userEmail) {
        console.warn("⚠️ Token has no email. uid:", userId);
      }

      let customerId = null;
      try {
        const userDoc = await admin.firestore().collection("users").doc(userId).get();
        if (userDoc.exists) {
          customerId = userDoc.data()?.stripeCustomerId || null;
        }
      } catch (error) {
        console.warn("⚠️ Could not read user doc for stripeCustomerId:", error?.message || error);
      }

      if (!customerId) {
        console.log("ℹ️ Creating Stripe customer for uid:", userId);
        const customer = await stripe.customers.create({
          email: userEmail || undefined,
          metadata: { firebaseUID: userId },
        });
        customerId = customer.id;
        console.log("✅ Stripe customer created:", customerId);
      }

      console.log("ℹ️ Creating checkout session...", {
        priceId,
        userId,
        customerId,
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
        client_reference_id: userId,
        metadata: {
          userId: userId,
          tier: planDetails.tier,
          price: planDetails.price.toString(),
          durationDays: planDetails.durationDays.toString(),
          priceId: priceId,
        },
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `SimpleTCF - ${planDetails.name}`,
            metadata: { userId: userId, tier: planDetails.tier },
            footer: "Thank you for choosing SimpleTCF!",
          },
        },
      });

      console.log("✅ Checkout session created:", session.id);

      return res.json({ id: session.id });
    } catch (error) {
      // ✅ NÃO faça JSON.stringify(error) no objeto inteiro (pode quebrar)
      console.error("❌ createCheckoutSession FAILED:", error?.message || error);

      console.error("❌ Stripe details:", {
        type: error?.type,
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        requestId: error?.requestId,
        rawType: error?.rawType,
        rawMessage: error?.raw?.message,
        stack: error?.stack,
      });

      return res.status(500).json({
        error: "Failed to create checkout session",
        details: error?.message || String(error),
        type: error?.type || "UnknownError",
        requestId: error?.requestId || null,
      });
    }
  }
);

/**
 * Stripe Webhook Handler
 */
exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    // Initialize Stripe with the secret
    if (!stripe) {
      stripe = require("stripe")((stripeSecretKey.value() || "").trim());
    }

    const sig = req.headers["stripe-signature"];
    const webhookSecret = (stripeWebhookSecret.value() || "").trim();

    if (!sig) {
      return res.status(400).send("Missing signature");
    }

    try {
      // Prefer req.rawBody (provided by Firebase runtime). If it is not
      // available, derive a Buffer from req.body as a safe fallback.
      let rawBody = req.rawBody;
      if (!rawBody && req.body) {
        if (Buffer.isBuffer(req.body)) {
          rawBody = req.body;
        } else if (typeof req.body === "string") {
          rawBody = Buffer.from(req.body, "utf8");
        } else {
          rawBody = Buffer.from(JSON.stringify(req.body), "utf8");
        }
      }

      if (!rawBody || rawBody.length === 0) {
        console.error("❌ Missing raw body for webhook signature check");
        return res.status(400).send("Missing webhook payload");
      }

      let event;

      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        try {
          const { userId, tier, price, durationDays, priceId } = session.metadata || {};

          if (!userId || !tier || !durationDays) {
            return res.status(400).send("Invalid session metadata");
          }

          const now = new Date();
          const endDate = new Date(
            now.getTime() + parseInt(durationDays, 10) * 24 * 60 * 60 * 1000
          );

          await admin.firestore().collection("users").doc(userId).set(
            {
              tier: tier,
              subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
              subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
              stripeCustomerId: session.customer || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const planInfo = priceId ? VALID_PRICE_IDS[priceId] : null;
          const planName = planInfo ? planInfo.name : tier;

          const orderRef = await admin.firestore().collection("orders").add({
            userId: userId,
            tier: tier,
            plan: planName,
            price: parseFloat(price) || (session.amount_total / 100),
            currency: session.currency || "cad",
            status: "completed",
            stripeSessionId: session.id,
            stripePaymentIntent: session.payment_intent,
            stripeCustomerId: session.customer,
            customerEmail: session.customer_email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          let invoiceId = null;
          if (session.invoice) {
            invoiceId = session.invoice;
            await sendStripeInvoice(invoiceId);

            if (invoiceId) {
              await orderRef.update({ stripeInvoiceId: invoiceId });
            }
          }

          const customerEmail = session.customer_email || "";
          const userName = customerEmail.split("@")[0] || "User";
          await sendPurchaseConfirmationEmail(
            customerEmail,
            userName,
            planName,
            parseInt(durationDays, 10)
          );

          return res.json({ received: true });
        } catch (error) {
          console.error("❌ Error processing payment:", error?.message || error);
          console.error("❌ stack:", error?.stack);
          return res.status(500).send("Error processing payment");
        }
      } else {
        return res.json({ received: true });
      }
    } catch (error) {
      console.error("❌ Webhook bad request:", error?.message || error);
      console.error("❌ stack:", error?.stack);
      return res.status(400).send("Bad request");
    }
  }
);
