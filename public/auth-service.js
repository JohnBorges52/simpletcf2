// ===============================
// Authentication Service
// Pure Firebase authentication - no localStorage
// ===============================

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ===============================
// Auth State Management
// ===============================

let authInstance = null;
let currentUser = undefined; // Start as undefined until first auth state callback
const authStateCallbacks = new Set();
let authInitPromise = null;
let hasReceivedInitialState = false;

/**
 * Initialize authentication
 * @param {Object} app - Firebase app instance
 * @returns {Promise<Object>} Auth instance
 */
export async function initAuth(app) {
  if (authInstance) return authInstance;
  
  if (authInitPromise) return authInitPromise;
  
  authInitPromise = (async () => {
    authInstance = getAuth(app);
    
    // Set persistence to LOCAL (survives browser restarts)
    try {
      await setPersistence(authInstance, browserLocalPersistence);
    } catch (error) {
      console.error("Failed to set auth persistence:", error);
    }

    // Listen to auth state changes
    onAuthStateChanged(authInstance, (user) => {
      currentUser = user;
      hasReceivedInitialState = true;
      
      console.log("🔐 Auth state changed:", user ? `Logged in as ${user.email}` : "Logged out");
      
      // Notify all subscribers
      authStateCallbacks.forEach(callback => {
        try {
          callback(user);
        } catch (error) {
          console.error("Auth state callback error:", error);
        }
      });
    });

    return authInstance;
  })();
  
  return authInitPromise;
}

/**
 * Get current auth instance
 * @returns {Object|null} Auth instance
 */
export function getAuthInstance() {
  return authInstance;
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
  authStateCallbacks.add(callback);
  
  // Immediately call with current state if we've received it
  if (hasReceivedInitialState) {
    callback(currentUser);
  }
  
  return () => authStateCallbacks.delete(callback);
}

/**
 * Wait for auth to be ready
 * @returns {Promise<Object|null>} Current user or null
 */
export function waitForAuth() {
  // Only return immediately if we've received the initial auth state
  if (hasReceivedInitialState) {
    console.log("🔐 Auth already initialized, current user:", currentUser?.email || "none");
    return Promise.resolve(currentUser);
  }
  
  console.log("⏳ Waiting for initial auth state...");
  // Wait for the first auth state callback
  return new Promise((resolve) => {
    const unsubscribe = onAuthChange((user) => {
      console.log("🔐 Auth state received:", user?.email || "none");
      unsubscribe();
      resolve(user);
    });
  });
}

// ===============================
// Authentication Actions
// ===============================

/**
 * Register with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User display name
 * @returns {Promise<Object>} User credential
 */
export async function registerWithEmail(email, password, displayName) {
  // Wait for auth to be initialized
  if (!authInstance) {
    await authInitPromise;
  }
  
  if (!authInstance) throw new Error("Auth not initialized");
  
  const userCredential = await createUserWithEmailAndPassword(
    authInstance,
    email,
    password
  );
  
  // Update profile with display name
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }
  
  // Send verification email
  await sendEmailVerification(userCredential.user);
  
  return userCredential;
}

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User credential
 */
export async function signInWithEmail(email, password) {
  // Wait for auth to be initialized
  if (!authInstance) {
    await authInitPromise;
  }
  
  if (!authInstance) throw new Error("Auth not initialized");
  
  return await signInWithEmailAndPassword(authInstance, email, password);
}

/**
 * Sign in with Google
 * @returns {Promise<Object>} User credential
 */
export async function signInWithGoogle() {
  // Wait for auth to be initialized
  if (!authInstance) {
    await authInitPromise;
  }
  
  if (!authInstance) throw new Error("Auth not initialized");
  
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(authInstance, provider);
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
export async function resetPassword(email) {
  if (!authInstance) throw new Error("Auth not initialized");
  
  const actionCodeSettings = {
    url: `${window.location.origin}/passwordReset.html`,
    handleCodeInApp: true
  };
  
  return await sendPasswordResetEmail(authInstance, email, actionCodeSettings);
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  if (!authInstance) throw new Error("Auth not initialized");
  
  return await signOut(authInstance);
}

/**
 * Resend verification email
 * @returns {Promise<void>}
 */
export async function resendVerificationEmail() {
  if (!authInstance || !currentUser) {
    throw new Error("No user signed in");
  }
  
  return await sendEmailVerification(currentUser);
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return currentUser !== null;
}

/**
 * Check if user email is verified
 * @returns {boolean}
 */
export function isEmailVerified() {
  return currentUser?.emailVerified ?? false;
}

/**
 * Require authentication (redirect to login if not authenticated)
 * @param {string} redirectUrl - URL to redirect to if not authenticated (default: /login.html)
 * @returns {Object|null} Current user or redirects
 */
export function requireAuth(redirectUrl = "/login.html") {
  if (!currentUser) {
    window.location.href = redirectUrl;
    return null;
  }
  return currentUser;
}

/**
 * Require email verification (redirect if not verified)
 * @param {string} redirectUrl - URL to redirect to if not verified (default: /login.html)
 * @returns {Object|null} Current user or redirects
 */
export function requireVerification(redirectUrl = "/login.html") {
  if (!currentUser || !currentUser.emailVerified) {
    window.location.href = redirectUrl;
    return null;
  }
  return currentUser;
}

// ===============================
// UI Helper Functions
// ===============================

/**
 * Update navigation auth link based on user state
 * @param {Object|null} user - Current user
 */
export function updateAuthNav(user) {
  const authLink = document.getElementById("auth-link");
  if (!authLink) return;
  
  if (user) {
    authLink.textContent = "Profile";
    authLink.href = "/profile.html";
  } else {
    authLink.textContent = "Sign In";
    authLink.href = "/login.html";
  }
}

/**
 * Get user display info
 * @param {Object} user - Firebase user object
 * @returns {Object} Display name, email, and initial
 */
export function getUserDisplayInfo(user) {
  if (!user) {
    return {
      displayName: "User",
      email: "",
      initial: "U"
    };
  }
  
  const displayName = user.displayName || "User";
  const email = user.email || "";
  const initial = (displayName.trim()[0] || email.trim()[0] || "U").toUpperCase();
  
  return { displayName, email, initial };
}

/**
 * Format Firebase auth errors into user-friendly messages
 * @param {Error} error - Firebase error
 * @returns {string} User-friendly error message
 */
export function formatAuthError(error) {
  const code = error?.code || "";
  
  const errorMessages = {
    "auth/email-already-in-use": "This email is already registered. Please sign in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/operation-not-allowed": "This sign-in method is not enabled.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/too-many-requests": "Too many failed attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/invalid-credential": "Invalid credentials. Please check your email and password.",
    "auth/missing-password": "Please enter your password.",
    "auth/invalid-login-credentials": "Invalid email or password. Please try again."
  };
  
  return errorMessages[code] || error?.message || "An error occurred. Please try again.";
}
