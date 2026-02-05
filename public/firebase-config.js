/* global window */
// Load Firebase config before module scripts.
// Replace the placeholder values with your Firebase project's config.
(function setFirebaseConfig() {
  if (window.__FIREBASE_CONFIG__) return;

  const apiKey = window.FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY";
  const authDomain = window.FIREBASE_AUTH_DOMAIN || "YOUR_FIREBASE_AUTH_DOMAIN";
  const projectId = window.FIREBASE_PROJECT_ID || "YOUR_FIREBASE_PROJECT_ID";
  const storageBucket =
    window.FIREBASE_STORAGE_BUCKET || "YOUR_FIREBASE_STORAGE_BUCKET";
  const messagingSenderId =
    window.FIREBASE_MESSAGING_SENDER_ID || "YOUR_FIREBASE_MESSAGING_SENDER_ID";
  const appId = window.FIREBASE_APP_ID || "YOUR_FIREBASE_APP_ID";
  const measurementId =
    window.FIREBASE_MEASUREMENT_ID || "YOUR_FIREBASE_MEASUREMENT_ID";

  if (
    String(apiKey).startsWith("YOUR_FIREBASE_") ||
    String(authDomain).startsWith("YOUR_FIREBASE_") ||
    String(projectId).startsWith("YOUR_FIREBASE_")
  ) {
    console.warn(
      "[firebase-config] Update public/firebase-config.js with your Firebase config values."
    );
  }

  window.__FIREBASE_CONFIG__ = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
})();
