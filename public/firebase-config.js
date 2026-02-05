/* global window */

/**
 * Firebase Client Config Loader
 * This MUST be loaded before any module that uses Firebase.
 */

(function setFirebaseConfig() {
  // Prevent double loading
  if (window.__FIREBASE_CONFIG__) return;

  window.__FIREBASE_CONFIG__ = {
    apiKey: "AIzaSyAAQrh2cqH7mgjM0Q5SKoCR3V6nKdYRPm8",
    authDomain: "simpletcf.firebaseapp.com",
    projectId: "simpletcf",
    storageBucket: "simpletcf.firebasestorage.app",
    messagingSenderId: "233851428734", // <-- Add if you have it
    appId: "1:233851428734:web:a1bd5148731c8845825d2f"
  };

  console.log("[Firebase] Config loaded successfully");
})();
