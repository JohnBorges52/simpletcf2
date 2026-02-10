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
 * Send purchase confirmation email
 * @param {string} email - User email
 * @param {string} userName - User display name
 * @param {string} planName - Plan name
 * @param {number} durationDays - Plan duration in days
 */
async function sendPurchaseConfirmationEmail(
    email,
    userName,
    planName,
    durationDays,
) {
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

    // For now, log the email
    // (Firebase Functions would need email service setup)
    // You would typically use SendGrid, AWS SES, or another email service
    console.log("📧 Would send email to:", email);
    console.log("📧 Email subject: Your SimpleTCF Account is Active!");
    console.log("📧 Plan:", planName, "for", durationDays, "days");

    // TODO: Integrate with an email service provider
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: email,
    //   from: 'noreply@simpletcf.com',
    //   subject: 'Your SimpleTCF Account is Active!',
    //   html: emailHTML
    // });

    // For now, we'll use Firebase Admin to create an email document
    // that can be picked up by a mail service extension
    await admin.firestore().collection("mail").add({
      to: email,
      message: {
        subject: "Your SimpleTCF Account is Active!",
        html: emailHTML,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Email queued for sending");
  } catch (error) {
    console.error("❌ Error sending email:", error);
    // Don't throw - we don't want email failure to break the webhook
  }
}

/**
 * Send invoice email that was auto-created by Stripe Checkout
 * @param {string} invoiceId - Stripe invoice ID
 * @return {Promise<boolean>} Success status
 */
async function sendStripeInvoice(invoiceId) {
  console.log("📧 ================== SENDING STRIPE INVOICE ==================");
  console.log("📧 Invoice ID:", invoiceId);

  // Check if Stripe is initialized
  if (!stripe) {
    console.error("❌ CRITICAL: Stripe is not initialized!");
    return false;
  }

  try {
    if (!invoiceId) {
      console.error("❌ No invoice ID provided");
      return false;
    }

    // Retrieve the invoice
    console.log("📧 Step 1: Retrieving invoice from Stripe...");
    const invoice = await stripe.invoices.retrieve(invoiceId);
    console.log("✅ Invoice retrieved:", {
      id: invoice.id,
      status: invoice.status,
      customer: invoice.customer,
      customer_email: invoice.customer_email,
      amount_paid: invoice.amount_paid,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
    });

    // If invoice isn't finalized, finalize it
    if (invoice.status === "draft") {
      console.log("📧 Step 2: Finalizing invoice...");
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
      console.log("✅ Invoice finalized:", finalizedInvoice.id);
    }

    // Send the invoice via email
    console.log("📧 Step 3: Sending invoice email...");
    const sentInvoice = await stripe.invoices.sendInvoice(invoiceId);
    console.log("✅ Invoice email sent successfully:", {
      id: sentInvoice.id,
      status: sentInvoice.status,
      customer_email: sentInvoice.customer_email,
      invoice_pdf: sentInvoice.invoice_pdf,
      hosted_invoice_url: sentInvoice.hosted_invoice_url,
    });
    console.log("📧 ================== INVOICE SENT SUCCESSFULLY ==================");

    return true;
  } catch (error) {
    console.error("❌ ================== INVOICE SEND FAILED ==================");
    console.error("❌ Error type:", error.type);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error code:", error.code);
    console.error("❌ Full error:", JSON.stringify(error, null, 2));
    console.error("❌ ===============================================================");
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

        // Check if customer already exists in Firestore
        let customerId = null;
        try {
          const userDoc = await admin.firestore().collection("users").doc(userId).get();
          if (userDoc.exists) {
            customerId = userDoc.data().stripeCustomerId;
          }
        } catch (error) {
          console.error("Error fetching user document:", error);
        }

        // Create or reuse Stripe Customer
        if (!customerId) {
          console.log("🔍 Creating new Stripe customer for:", userEmail);
          const customer = await stripe.customers.create({
            email: userEmail,
            metadata: {
              firebaseUID: userId,
            },
          });
          customerId = customer.id;
          console.log("✅ Stripe customer created:", customerId);
        } else {
          console.log("🔍 Using existing Stripe customer:", customerId);
        }

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
          customer: customerId, // Use customer ID instead of just email
          client_reference_id: userId,
          // Enable automatic tax calculation if needed
          // automatic_tax: {enabled: true},
          // Store metadata for webhook processing
          metadata: {
            userId: userId,
            tier: planDetails.tier,
            price: planDetails.price.toString(),
            durationDays: planDetails.durationDays.toString(),
            priceId: priceId,
          },
          // Enable invoice creation and email sending
          invoice_creation: {
            enabled: true,
            invoice_data: {
              description: `SimpleTCF - ${planDetails.name}`,
              metadata: {
                userId: userId,
                tier: planDetails.tier,
              },
              footer: "Thank you for choosing SimpleTCF!",
            },
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
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).send("Method not allowed");
      }

      // Initialize Stripe with the secret
      if (!stripe) {
        stripe = require("stripe")((stripeSecretKey.value() || "").trim());
      }

      // SECURITY: Verify webhook signature
      const sig = req.headers["stripe-signature"];
      const webhookSecret = (stripeWebhookSecret.value() || "").trim();

      console.log("🔍 Webhook request received");
      console.log("🔍 Has signature:", !!sig);

      if (!sig) {
        console.error("❌ Missing Stripe signature header");
        return res.status(400).send("Missing signature");
      }

      try {
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
        console.log("🔍 Full event data:", JSON.stringify(event, null, 2));

        // Handle successful payment event
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;

          console.log("💳 ========== CHECKOUT SESSION COMPLETED ==========");
          console.log("💳 Processing payment:", {
            sessionId: session.id,
            customerId: session.customer,
            customerEmail: session.customer_email,
            amountTotal: session.amount_total,
            currency: session.currency,
            paymentStatus: session.payment_status,
            paymentIntent: session.payment_intent,
          });
          console.log("💳 Full session object:", JSON.stringify(session, null, 2));

          try {
            // Extract metadata (set by createCheckoutSession)
            const {userId, tier, price, durationDays, priceId} =
              session.metadata;

            console.log("🔍 Extracted metadata:", {
              userId,
              tier,
              price,
              durationDays,
              priceId,
            });

            if (!userId || !tier || !durationDays) {
              console.error("❌ Missing required metadata:", session.metadata);
              return res.status(400).send("Invalid session metadata");
            }

            // Calculate subscription dates
            const now = new Date();
            const endDate = new Date(
                now.getTime() + parseInt(durationDays) * 24 * 60 * 60 * 1000,
            );

            // Update user subscription in Firestore
            // Use set with merge to create document if it doesn't exist
            console.log("🔍 Updating user document in Firestore...");
            await admin.firestore().collection("users").doc(userId).set({
              tier: tier,
              subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
              subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
              stripeCustomerId: session.customer || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {merge: true});

            console.log(`✅ User ${userId} upgraded to ${tier}`);

            // Create order record for tracking
            // Use priceId to get plan name, fallback to tier name
            const planInfo = priceId ? VALID_PRICE_IDS[priceId] : null;
            const planName = planInfo? planInfo.name : tier;

            console.log("🔍 Creating order record in Firestore...");
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

            console.log(`✅ Order created for user ${userId}`, {
              orderId: orderRef.id,
            });

            // Handle invoice - Stripe auto-creates it via invoice_creation setting
            console.log("💰 ========== PROCESSING STRIPE INVOICE ==========");
            console.log("💰 Session data:", {
              sessionId: session.id,
              customerId: session.customer,
              customerEmail: session.customer_email,
              invoice: session.invoice,
              paymentIntent: session.payment_intent,
              paymentStatus: session.payment_status,
            });

            let invoiceId = null;
            if (session.invoice) {
              console.log("✅ Invoice was auto-created by Stripe:", session.invoice);
              invoiceId = session.invoice;

              // Send the invoice email
              const invoiceSent = await sendStripeInvoice(invoiceId);
              console.log("💰 Invoice send result:", {
                invoiceId: invoiceId,
                sent: invoiceSent,
              });

              // Update order with invoice ID
              if (invoiceId) {
                await orderRef.update({
                  stripeInvoiceId: invoiceId,
                });
                console.log("✅ Invoice linked to order:", {
                  orderId: orderRef.id,
                  invoiceId: invoiceId,
                });
              }
            } else {
              console.warn("⚠️ No invoice was auto-created by Stripe");
              console.warn("⚠️ Check that invoice_creation is enabled in checkout session");
            }
            console.log("💰 ========== INVOICE PROCESSING COMPLETE ==========");

            // Send purchase confirmation email
            console.log("📨 Sending purchase confirmation email...");
            const customerEmail = session.customer_email || "";
            const userName = customerEmail.split("@")[0] || "User";
            await sendPurchaseConfirmationEmail(
                customerEmail,
                userName,
                planName,
                parseInt(durationDays),
            );

            console.log("🎉 ========== WEBHOOK PROCESSING COMPLETE ==========");
            console.log("🎉 Summary:", {
              userId: userId,
              tier: tier,
              planName: planName,
              orderCreated: !!orderRef.id,
              invoiceCreated: !!invoiceId,
              invoiceId: invoiceId,
              confirmationEmailQueued: true,
            });

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
      } catch (error) {
        // Handle errors in reading request body or webhook processing
        console.error("❌ Error in webhook handler:", error);
        return res.status(400).send("Bad request");
      }
    });
