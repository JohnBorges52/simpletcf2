// ===============================
// Firebase Initialization
// Clean authentication using auth-service.js
// No localStorage usage
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { getRemoteConfig, fetchAndActivate } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-remote-config.js";
import { 
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { 
  applyActionCode, 
  checkActionCode, 
  verifyPasswordResetCode, 
  confirmPasswordReset,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Import our clean auth service
import * as AuthService from "./auth-service.js";

// ===============================
// Firebase Config
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyAAQrh2cqH7mgjMOQ5SkoGR3V6nKdYRPm8",
  authDomain: "simpletcf.firebaseapp.com",
  projectId: "simpletcf",
  storageBucket: "simpletcf.firebasestorage.app",
  messagingSenderId: "233851428734",
  appId: "1:233851428734:web:a1bd5148731c8845825d2f",
  measurementId: "G-K63ZE5JTL9"
};

// ===============================
// Promises for Service Readiness
// ===============================
let resolveFirestoreReady;
window.__firestoreReady = new Promise((res) => (resolveFirestoreReady = res));

// ===============================
// Initialize Firebase Services
// ===============================
const app = initializeApp(firebaseConfig);
let analytics = null;
let storage = null;
let remoteConfig = null;
let firestore = null;

// Initialize Analytics (if supported)
(async () => {
  const supported = await isSupported();
  if (supported) {
    analytics = getAnalytics(app);
    console.log("✅ Analytics initialized");
  }
})();

// Initialize Storage
storage = getStorage(app);
console.log("✅ Storage initialized");

// Initialize Firestore
firestore = getFirestore(app);
window.__firestore = firestore;
window.firestoreExports = { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  Timestamp,
  onSnapshot
};
resolveFirestoreReady(firestore);
console.log("✅ Firestore initialized");

// Initialize Remote Config
remoteConfig = getRemoteConfig(app);
remoteConfig.settings = {
  minimumFetchIntervalMillis: 3600000, // 1 hour
  fetchTimeoutMillis: 60000, // 1 minute
};

fetchAndActivate(remoteConfig)
  .then(() => console.log("✅ Remote Config activated"))
  .catch((err) => console.warn("Remote Config fetch failed:", err));

// Initialize Auth
AuthService.initAuth(app).then(() => {
  console.log("✅ Authentication initialized");
  
  // Update nav on auth state changes
  AuthService.onAuthChange((user) => {
    AuthService.updateAuthNav(user);
  });
});

// ===============================
// Global Exports
// ===============================
window.firebaseApp = app;
window.firebaseAuth = AuthService.getAuthInstance;
window.firebaseStorage = storage;
window.firebaseFirestore = firestore;
window.firebaseRemoteConfig = remoteConfig;
window.firebaseAnalytics = analytics;

// Export auth service methods globally for easy access
window.AuthService = AuthService;

// ===============================
// Firebase Storage Helper
// ===============================
window.getFirebaseStorageUrl = async (path) => {
  if (!path) return null;
  
  // If already absolute URL, return as-is
  if (/^https?:\/\//i.test(path)) return path;
  
  try {
    if (!storage) return null;
    
    // Clean path and get download URL
    const cleanPath = path.replace(/^\/+/, "");
    const fileRef = ref(storage, cleanPath);
    return await getDownloadURL(fileRef);
  } catch (err) {
    console.warn(`Storage URL failed for ${path}:`, err);
    return null;
  }
};

// ===============================
// UI Helper Functions
// ===============================

function shakeElement(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function showFieldError(inputEl, errId, msg) {
  if (!inputEl) return;
  inputEl.classList.remove("is-success");
  inputEl.classList.add("is-error");
  inputEl.setAttribute("aria-invalid", "true");
  const el = document.getElementById(errId);
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }
}

function clearFieldError(inputEl, errId) {
  if (!inputEl) return;
  inputEl.classList.remove("is-error");
  inputEl.classList.add("is-success");
  inputEl.setAttribute("aria-invalid", "false");
  const el = document.getElementById(errId);
  if (el) {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function wirePasswordToggle({ buttonId, inputId, eyeOnId, eyeOffId }) {
  const toggleBtn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  const eyeOn = document.getElementById(eyeOnId);
  const eyeOff = document.getElementById(eyeOffId);

  if (!toggleBtn || !input || !eyeOn || !eyeOff) return;

  toggleBtn.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    eyeOn.classList.toggle("hidden", !isPassword);
    eyeOff.classList.toggle("hidden", isPassword);
    toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
}

// ===============================
// Registration Page Logic
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("register-name");
  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const confirmInput = document.getElementById("register-password-confirm");
  const startBtn = document.getElementById("register-btn-start");
  const googleBtn = document.getElementById("register-btn-google");

  // Only run on register page
  if (!startBtn && !googleBtn) return;

  console.log("📝 Register page detected");
  console.log("Start button:", startBtn);
  console.log("Google button:", googleBtn);

  // Wire password toggles
  wirePasswordToggle({
    buttonId: "register-toggle-password",
    inputId: "register-password",
    eyeOnId: "register-eye-on",
    eyeOffId: "register-eye-off",
  });
  wirePasswordToggle({
    buttonId: "register-toggle-password-confirm",
    inputId: "register-password-confirm",
    eyeOnId: "register-eye-on-2",
    eyeOffId: "register-eye-off-2",
  });

  // Email/Password Registration
  startBtn?.addEventListener("click", async () => {
    const name = nameInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const confirm = confirmInput?.value || "";

    // Clear previous errors
    [nameInput, emailInput, passwordInput, confirmInput].forEach((input) => {
      if (input) {
        input.classList.remove("is-error", "is-success");
        input.setAttribute("aria-invalid", "false");
      }
    });
    ["err-name", "err-email", "err-password", "err-password-confirm"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = "";
        el.classList.add("hidden");
      }
    });

    // Validation
    let hasError = false;

    if (!name) {
      showFieldError(nameInput, "err-name", "Name is required.");
      hasError = true;
    }

    if (!email) {
      showFieldError(emailInput, "err-email", "Email is required.");
      hasError = true;
    }

    if (!password) {
      showFieldError(passwordInput, "err-password", "Password is required.");
      hasError = true;
    } else if (password.length < 6) {
      showFieldError(passwordInput, "err-password", "Password must be at least 6 characters.");
      hasError = true;
    }

    if (password !== confirm) {
      showFieldError(confirmInput, "err-password-confirm", "Passwords don't match.");
      hasError = true;
    }

    if (hasError) {
      shakeElement("#register-form");
      return;
    }

    // Register
    try {
      startBtn.disabled = true;
      startBtn.textContent = "Creating account...";

      await AuthService.registerWithEmail(email, password, name);

      // Show verification message
      showVerificationMessage(email, name);

    } catch (error) {
      console.error("Registration error:", error);
      const msg = AuthService.formatAuthError(error);
      showFieldError(emailInput, "err-email", msg);
      shakeElement("#register-form");
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = "Get Started";
    }
  });

  // Google Sign-in
  googleBtn?.addEventListener("click", async () => {
    console.log("Google register button clicked!");
    
    const originalHTML = googleBtn.innerHTML;
    try {
      googleBtn.disabled = true;
      googleBtn.innerHTML = '<span>Signing in with Google...</span>';

      console.log("Waiting for auth...");
      // Wait for auth to be ready
      await AuthService.waitForAuth();

      console.log("Calling signInWithGoogle...");
      const result = await AuthService.signInWithGoogle();
      const user = result.user;

      console.log("Google sign-in successful:", user.email);
      
      // Check if this is a new user (additionalUserInfo.isNewUser)
      const isNewUser = result._tokenResponse?.isNewUser || false;
      
      if (isNewUser) {
        // New user - redirect to welcome page
        window.location.href = '/welcome.html';
      } else {
        // Returning user - show welcome message and redirect to home
        showWelcomeMessage(user.displayName || "User", user.email);
      }

    } catch (error) {
      console.error("Google sign-in error:", error);
      
      if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
        // User cancelled, just re-enable button
        console.log("User cancelled Google sign-in");
      } else {
        const msg = AuthService.formatAuthError(error);
        showFieldError(emailInput, "err-email", msg);
        shakeElement("#register-form");
      }
    } finally {
      googleBtn.disabled = false;
      googleBtn.innerHTML = originalHTML;
    }
  });
});

// ===============================
// Login Page Logic
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginSubmit");
  const googleLoginBtn = document.getElementById("googleBtn");

  // Only run on login page
  if (!loginForm && !googleLoginBtn) return;

  console.log("🔐 Login page detected");
  console.log("Login form:", loginForm);
  console.log("Google button:", googleLoginBtn);
  console.log("Email input:", emailInput);
  console.log("Password input:", passwordInput);

  // Wire password toggle
  wirePasswordToggle({
    buttonId: "login-toggle-password",
    inputId: "passwordInput",
    eyeOnId: "login-eye-on",
    eyeOffId: "login-eye-off",
  });

  // Email/Password Login
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    // Clear previous errors
    [emailInput, passwordInput].forEach((input) => {
      if (input) {
        input.classList.remove("is-error", "is-success");
        input.setAttribute("aria-invalid", "false");
      }
    });
    ["err-login-email", "err-login-password"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = "";
        el.classList.add("hidden");
      }
    });

    // Validation
    let hasError = false;

    if (!email) {
      showFieldError(emailInput, "err-login-email", "Email is required.");
      hasError = true;
    }

    if (!password) {
      showFieldError(passwordInput, "err-login-password", "Password is required.");
      hasError = true;
    }

    if (hasError) {
      shakeElement("#loginForm");
      return;
    }

    // Sign in
    const originalText = loginBtn.innerHTML;
    try {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span>Signing in...</span>';

      const result = await AuthService.signInWithEmail(email, password);
      const user = result.user;

      // Check if email is verified
      if (!user.emailVerified) {
        // Send new verification email
        try {
          await sendEmailVerification(user);
        } catch (e) {
          console.warn("Could not send verification email:", e);
        }
        
        // Sign out unverified user
        await AuthService.signOutUser();
        
        showFieldError(
          emailInput,
          "err-login-email",
          `📩 Your email isn't verified. We just sent a new verification link to ${email}. Please verify, then log in.`
        );
        shakeElement("#loginForm");
        return;
      }

      // Success
      showWelcomeMessage(user.displayName || "User", user.email);

    } catch (error) {
      console.error("Login error:", error);
      const msg = AuthService.formatAuthError(error);
      showFieldError(emailInput, "err-login-email", msg);
      shakeElement("#loginForm");
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalText || '<span class="ml-3">Log in</span>';
    }
  });

  // Google Login
  googleLoginBtn?.addEventListener("click", async () => {
    console.log("Google login button clicked!");
    
    const originalHTML = googleLoginBtn.innerHTML;
    try {
      googleLoginBtn.disabled = true;
      googleLoginBtn.innerHTML = '<span>Signing in with Google...</span>';

      console.log("Waiting for auth...");
      // Wait for auth to be ready
      await AuthService.waitForAuth();

      console.log("Calling signInWithGoogle...");
      const result = await AuthService.signInWithGoogle();
      const user = result.user;

      console.log("Google sign-in successful:", user.email);
      // Google users are typically pre-verified
      showWelcomeMessage(user.displayName || "User", user.email);

    } catch (error) {
      console.error("Google login error:", error);
      
      if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
        // User cancelled
        console.log("User cancelled Google sign-in");
      } else {
        const msg = AuthService.formatAuthError(error);
        showFieldError(emailInput, "err-login-email", msg);
        shakeElement("#loginForm");
      }
    } finally {
      googleLoginBtn.disabled = false;
      googleLoginBtn.innerHTML = originalHTML;
    }
  });
});

// ===============================
// Password Reset Logic
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const resetForm = document.getElementById("resetForm");
  const resetEmailInput = document.getElementById("reset-email");
  const resetBtn = document.getElementById("reset-btn");

  if (!resetForm) return;

  console.log("🔑 Password reset page detected");

  resetBtn?.addEventListener("click", async () => {
    const email = resetEmailInput?.value.trim() || "";

    // Clear previous errors
    const errEl = document.getElementById("err-reset-email");
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }

    if (!email) {
      if (errEl) {
        errEl.textContent = "Email is required.";
        errEl.classList.remove("hidden");
      }
      shakeElement("#resetForm");
      return;
    }

    try {
      resetBtn.disabled = true;
      resetBtn.textContent = "Sending...";

      await AuthService.resetPassword(email);

      // Show success message
      if (errEl) {
        errEl.className = "text-green-600 text-sm mt-1";
        errEl.textContent = `✅ Password reset email sent to ${email}. Check your inbox!`;
        errEl.classList.remove("hidden");
      }

      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2000);

    } catch (error) {
      console.error("Password reset error:", error);
      const msg = AuthService.formatAuthError(error);
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove("hidden");
      }
      shakeElement("#resetForm");
    } finally {
      resetBtn.disabled = false;
      resetBtn.textContent = "Send Reset Link";
    }
  });
});

// ===============================
// UI Overlays / Messages
// ===============================

function showWelcomeMessage(name, email) {
  const welcomeSection = document.getElementById("welcome-screen");
  
  if (welcomeSection) {
    const loginContainer = document.getElementById("loginContainer");
    const registerForm = document.getElementById("register-form");
    
    if (loginContainer) loginContainer.classList.add("blur-bg");
    if (registerForm) registerForm.classList.add("blur-bg");
    
    welcomeSection.classList.remove("hidden");
    
    const title = document.getElementById("verify-title");
    const nameEl = document.getElementById("welcome-name");
    const emailEl = document.getElementById("welcome-email");
    const avatarEl = document.getElementById("avatar-initial");
    
    if (title) title.textContent = "Welcome!";
    if (nameEl) nameEl.textContent = `Welcome back, ${name}!`;
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) avatarEl.textContent = (name[0] || "U").toUpperCase();
  }

  setTimeout(() => {
    window.location.href = "/index.html";
  }, 1500);
}

function showVerificationMessage(email, name) {
  // Redirect to welcome page for registered users
  // They will stay logged in (persistence is set to LOCAL)
  window.location.href = '/welcome.html';
}

// Handle email verification from link
(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const code = urlParams.get("oobCode");

  if (mode === "verifyEmail" && code) {
    try {
      const auth = AuthService.getAuthInstance();
      if (auth) {
        await applyActionCode(auth, code);
        await auth.currentUser?.reload();
        console.log("✅ Email verified successfully");
      }
      window.location.replace("/welcome.html");
    } catch (error) {
      console.error("Email verification error:", error);
      window.location.replace("/login.html?verify_error=1");
    }
  }
})();

console.log("✅ Config loaded - Firebase initialized with clean auth service");
