const fs = require("fs");
const path = require("path");

const vars = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTHDOMAIN || "",
  projectId: process.env.FIREBASE_PROJECTID || "",
  storageBucket: process.env.FIREBASE_STORAGEBUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID || "",
  appId: process.env.FIREBASE_APPID || "",
  measurementId: process.env.FIREBASE_MEASUREMENTID || "",
};

const out = `window.firebaseConfig = ${JSON.stringify(vars, null, 2)};
window.__FIREBASE_CONFIG__ = window.firebaseConfig;
var firebaseConfig = window.firebaseConfig;
`;

const dest = path.join(__dirname, "..", "public", "firebase-config.js");

try {
  fs.writeFileSync(dest, out, "utf8");
  console.log(`Wrote ${dest}`);
  const missing = Object.entries(vars).filter(([, v]) => !v);
  if (missing.length) {
    console.warn("Warning: some firebase env vars are empty:", missing.map(([k]) => k));
  }
  process.exit(0);
} catch (err) {
  console.error("Failed to write firebase-config.js:", err);
  process.exit(2);
}
