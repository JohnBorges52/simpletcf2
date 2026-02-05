// public/firebase-storage.js
// Firebase Storage helper for SimpleTCF (Hosting + Storage)
// Usage:
//   import { storageDownloadUrl } from "./firebase-storage.js";
//   const url = await storageDownloadUrl("audios/CO_test1_question01.mp3");

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

/**
 * 1) Firebase config from ENV-like globals.
 * Put these in your index.html BEFORE your module scripts, e.g.:
 *
 * <script>
 *   window.__FIREBASE_CONFIG__ = {
 *     apiKey: "...",
 *     authDomain: "...",
 *     projectId: "...",
 *     storageBucket: "...",
 *     messagingSenderId: "...",
 *     appId: "..."
 *   };
 * </script>
 */
function readFirebaseConfig() {
  // Preferred: one object set in HTML
  const cfg = window.__FIREBASE_CONFIG__ || null;

  // Fallback: individual vars if you prefer
  if (!cfg) {
    const apiKey = window.FIREBASE_API_KEY;
    const authDomain = window.FIREBASE_AUTH_DOMAIN;
    const projectId = window.FIREBASE_PROJECT_ID;
    const storageBucket = window.FIREBASE_STORAGE_BUCKET;
    const messagingSenderId = window.FIREBASE_MESSAGING_SENDER_ID;
    const appId = window.FIREBASE_APP_ID;

    if (
      apiKey &&
      authDomain &&
      projectId &&
      storageBucket &&
      messagingSenderId &&
      appId
    ) {
      return {
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      };
    }

    throw new Error(
      "[firebase-storage] Missing Firebase config. Set window.__FIREBASE_CONFIG__ (recommended) before loading module scripts."
    );
  }

  // Minimal validation
  const required = ["apiKey", "authDomain", "projectId", "storageBucket", "appId"];
  const missing = required.filter((k) => !cfg[k]);
  if (missing.length) {
    throw new Error(
      `[firebase-storage] Missing keys in window.__FIREBASE_CONFIG__: ${missing.join(", ")}`
    );
  }

  return cfg;
}

/**
 * 2) Init Firebase app + Storage
 */
const firebaseConfig = readFirebaseConfig();

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const storage = getStorage(app);

/**
 * 3) Normalization helpers
 */
function normalizeStoragePath(path) {
  if (!path) return "";

  let p = String(path).trim();

  // If user passes a full URL, just return it (no need to resolve)
  if (/^https?:\/\//i.test(p)) return p;

  // Remove leading slashes
  while (p.startsWith("/")) p = p.slice(1);

  // Remove leading "public/" if they accidentally include it
  if (p.toLowerCase().startsWith("public/")) p = p.slice("public/".length);

  // Collapse any "./"
  p = p.replace(/^(\.\/)+/, "");

  return p;
}

/**
 * 4) In-memory cache so repeated questions don't re-fetch URLs.
 */
const urlCache = new Map();

/**
 * Get a Firebase Storage download URL for a file path.
 * @param {string} storagePath e.g. "audios/file.mp3" (relative to your Storage bucket root)
 * @returns {Promise<string>} download URL
 */
export async function storageDownloadUrl(storagePath) {
  const normalized = normalizeStoragePath(storagePath);

  // If already a full URL, return as-is
  if (/^https?:\/\//i.test(normalized)) return normalized;

  if (!normalized) throw new Error("[firebase-storage] Empty storage path.");

  if (urlCache.has(normalized)) return urlCache.get(normalized);

  const r = storageRef(storage, normalized);

  const url = await getDownloadURL(r);
  urlCache.set(normalized, url);
  return url;
}

/**
 * Optional: clear cache (useful for debugging)
 */
export function clearStorageUrlCache() {
  urlCache.clear();
}
