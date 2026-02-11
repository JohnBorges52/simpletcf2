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
    // ...removed log...
  }
})();

// Initialize Storage
storage = getStorage(app);
// ...removed log...

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
// ...removed log...

// Initialize Remote Config
remoteConfig = getRemoteConfig(app);
remoteConfig.settings = {
  minimumFetchIntervalMillis: 3600000, // 1 hour
  fetchTimeoutMillis: 60000, // 1 minute
};

fetchAndActivate(remoteConfig)
  .then(() => {/* ...removed log... */})
  .catch((err) => {/* ...removed log... */});

// Initialize Auth
AuthService.initAuth(app).then(() => {
  // ...removed log...
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
      
      // Keep user logged in (they just can't access protected pages until verified)
      console.log('✅ Account created. User stays logged in but must verify email.');

      // Show verification message
      showVerificationMessage(email, name);

    } catch (error) {
      // Special handling for email already in use
      if (error.code === "auth/email-already-in-use") {
        console.log("Email already registered, checking verification status...");
        
        try {
          startBtn.textContent = "Checking account...";
          
          // Try to sign in to check if account is unverified
          const credential = await AuthService.signInWithEmail(email, password);
          const user = credential.user;
          
          if (!user.emailVerified) {
            console.log("Account exists but not verified - resending verification email");
            
            // Account exists but unverified - resend verification email
            await sendEmailVerification(user);
            
            // Keep user logged in (they just can't access protected pages until verified)
            console.log('✅ Verification email resent. User stays logged in.');
            
            // Show verification message
            showVerificationMessage(email, name);
            return; // Exit early - success case
          } else {
            // Account exists and is verified - tell them to sign in
            await AuthService.signOutUser();
            showFieldError(emailInput, "err-email", "This email is already registered. Please sign in instead.");
            shakeElement("#register-form");
            return; // Exit early
          }
        } catch (signInError) {
          // Sign-in failed - email exists with different password
          console.log("Email exists but wrong password provided");
          showFieldError(emailInput, "err-email", "This email is already registered. Please sign in instead.");
          shakeElement("#register-form");
          return; // Exit early
        }
      }
      
      // Other errors (not email-already-in-use)
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
        // New user - check if email is verified (Google users are usually verified)
        if (user.emailVerified) {
          // Email verified - redirect to welcome page
          window.location.href = '/welcome';
        } else {
          // Email not verified - redirect to verification page
          window.location.href = '/verify-email';
        }
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
        console.log("⚠️ Login blocked - email not verified. Sending verification email...");
        
        // Send new verification email
        try {
          await sendEmailVerification(user);
          console.log("✅ Verification email sent");
        } catch (e) {
          console.warn("Could not send verification email:", e);
        }
        
        // Sign out unverified user
        await AuthService.signOutUser();
        
        showFieldError(
          emailInput,
          "err-login-email",
          `📩 Your email isn't verified yet. We just sent a new verification link to ${email}. Please check your inbox and verify your email, then try logging in again.`
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
// Forgot Password Link Handler (Login Page)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const forgotLink = document.getElementById("forgotLink");
  
  forgotLink?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/forgotPassword";
  });
});

// ===============================
// Forgot Password Page Logic
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const sendResetBtn = document.getElementById("send-reset-btn");
  const forgotEmailInput = document.getElementById("forgot-email");
  const forgotForm = document.getElementById("forgot-form");
  const successScreen = document.getElementById("success-screen");
  const resendLink = document.getElementById("resend-link");

  if (!sendResetBtn) return;

  console.log("🔑 Forgot password page detected");

  const sendResetEmail = async () => {
    const email = forgotEmailInput?.value.trim() || "";

    // Clear previous errors
    const errEl = document.getElementById("err-forgot-email");
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }

    if (!email) {
      if (errEl) {
        errEl.textContent = "Email is required.";
        errEl.classList.remove("hidden");
      }
      shakeElement("#forgot-form");
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errEl) {
        errEl.textContent = "Please enter a valid email address.";
        errEl.classList.remove("hidden");
      }
      shakeElement("#forgot-form");
      return;
    }

    try {
      sendResetBtn.disabled = true;
      sendResetBtn.textContent = "Sending...";

      await AuthService.resetPassword(email);

      // Show success animation
      if (forgotForm) forgotForm.classList.add("hidden");
      if (successScreen) {
        successScreen.classList.remove("hidden");
        const successEmailEl = document.getElementById("success-email");
        if (successEmailEl) successEmailEl.textContent = email;
      }

    } catch (error) {
      console.error("Password reset error:", error);
      const msg = AuthService.formatAuthError(error);
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove("hidden");
      }
      shakeElement("#forgot-form");
    } finally {
      sendResetBtn.disabled = false;
      sendResetBtn.textContent = "Send Email";
    }
  };

  sendResetBtn.addEventListener("click", sendResetEmail);

  // Handle Enter key
  forgotEmailInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendResetEmail();
    }
  });

  // Resend link
  resendLink?.addEventListener("click", (e) => {
    e.preventDefault();
    if (successScreen) successScreen.classList.add("hidden");
    if (forgotForm) forgotForm.classList.remove("hidden");
    if (forgotEmailInput) forgotEmailInput.focus();
  });
});

// ===============================
// Password Reset Logic (Old - keeping for backward compatibility)
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
        window.location.href = "/login";
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
    window.location.href = "/";
  }, 1500);
}

function showVerificationMessage(email, name) {
  // Show pop-up notification
  const notification = document.getElementById('email-sent-notification');
  const emailEl = document.getElementById('notification-email');
  const closeBtn = document.getElementById('close-notification-btn');
  
  if (notification && emailEl) {
    emailEl.textContent = `We sent a verification email to ${email}`;
    notification.classList.remove('hidden');
    
    // Close button handler - just close popup
    // User stays logged in but can't access protected pages until verified
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        notification.classList.add('hidden');
      }, { once: true });
    }
  }
}

// Handle email verification from link
(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const code = urlParams.get("oobCode");

  if (mode === "verifyEmail" && code) {
    try {
      // Wait for auth to be initialized
      await AuthService.initAuth(app);
      const auth = AuthService.getAuthInstance();
      
      let verifiedEmail = '';
      
      if (auth) {
        // Check the action code to get the email before applying it
        const info = await checkActionCode(auth, code);
        verifiedEmail = info.data.email || '';
        
        // Apply the verification code
        await applyActionCode(auth, code);
        
        // If user is logged in, reload their data to update emailVerified status
        if (auth.currentUser) {
          await auth.currentUser.reload();
          console.log("✅ Email verified successfully - user still logged in");
        } else {
          console.log("✅ Email verified successfully (user not logged in)");
        }
      }
      
      // Redirect to welcome page with verified email parameter
      // If user is logged in, they'll see "Complete Setup" button
      // If user is logged out, they'll see sign-in form with pre-filled email
      const redirectUrl = verifiedEmail 
        ? `/welcome?verified_email=${encodeURIComponent(verifiedEmail)}`
        : '/welcome';
      window.location.replace(redirectUrl);
    } catch (error) {
      console.error("Email verification error:", error);
      window.location.replace("/login?verify_error=1");
    }
  }
})();

console.log("✅ Config loaded - Firebase initialized with clean auth service");
