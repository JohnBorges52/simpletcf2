#!/usr/bin/env node

/**
 * Backfill missing fields in /users documents for all Firebase Auth users.
 *
 * Usage:
 *   cd functions
 *   node scripts/backfill-user-fields.js
 *
 * Notes:
 * - Requires Firebase Admin credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS).
 * - Writes only missing fields to avoid overriding existing values.
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Gets primary provider id from a Firebase Auth user.
 * @param {admin.auth.UserRecord} userRecord Firebase Auth user.
 * @return {string} Provider id.
 */
function getProvider(userRecord) {
  const firstProvider = userRecord.providerData && userRecord.providerData[0];
  return (firstProvider && firstProvider.providerId) || "password";
}

/**
 * Builds the default user document shape.
 * @param {admin.auth.UserRecord} userRecord Firebase Auth user.
 * @return {Object<string, any>} Default user document.
 */
function buildDefaultDoc(userRecord) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    email: userRecord.email || null,
    displayName: userRecord.displayName || "User",
    createdAt: now,
    lastLoginAt: now,
    emailVerified: Boolean(userRecord.emailVerified),
    authProvider: getProvider(userRecord),
    photoURL: userRecord.photoURL || null,
    tier: "free",
    plan: "free",
    renewalDate: null,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
  };
}

/**
 * Filters only fields missing from existing Firestore data.
 * @param {Object<string, any>} defaultDoc Default fields and values.
 * @param {Object<string, any>} existingData Current Firestore data.
 * @return {Object<string, any>} Patch with only missing fields.
 */
function buildMissingFieldsPatch(defaultDoc, existingData) {
  const patch = {};

  for (const [key, value] of Object.entries(defaultDoc)) {
    if (!Object.prototype.hasOwnProperty.call(existingData, key)) {
      patch[key] = value;
    }
  }

  return patch;
}

/**
 * Fetches all Firebase Auth users using pagination.
 * @return {Promise<admin.auth.UserRecord[]>} List of auth users.
 */
async function getAllAuthUsers() {
  const users = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

/**
 * Executes the backfill flow.
 * @return {Promise<void>}
 */
async function run() {
  const users = await getAllAuthUsers();

  if (users.length === 0) {
    console.log("No auth users found. Nothing to backfill.");
    return;
  }

  let usersScanned = 0;
  let docsUpdated = 0;

  for (const userRecord of users) {
    usersScanned += 1;
    const userRef = db.collection("users").doc(userRecord.uid);
    const userDoc = await userRef.get();
    const existingData = userDoc.exists ? userDoc.data() : {};

    const defaults = buildDefaultDoc(userRecord);
    const patch = buildMissingFieldsPatch(defaults, existingData || {});

    if (Object.keys(patch).length > 0) {
      await userRef.set(patch, {merge: true});
      docsUpdated += 1;
    }
  }

  console.log(
      "Backfill completed. Scanned " +
      usersScanned +
      " auth users and updated " +
      docsUpdated +
      " user docs.",
  );
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
