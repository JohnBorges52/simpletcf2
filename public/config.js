// ===============================
// Firebase Initialization + Auth
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
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
  signInWithRedirect,
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  applyActionCode,
  checkActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";

// -------------------------------
// Your Firebase Config
// -------------------------------
function readFirebaseConfig() {
  const cfg = window.__FIREBASE_CONFIG__ || null;

  if (cfg) {
    return cfg;
  }

  const apiKey = window.FIREBASE_API_KEY;
  const authDomain = window.FIREBASE_AUTH_DOMAIN;
  const projectId = window.FIREBASE_PROJECT_ID;
  const storageBucket = window.FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = window.FIREBASE_MESSAGING_SENDER_ID;
  const appId = window.FIREBASE_APP_ID;
  const measurementId = window.FIREBASE_MEASUREMENT_ID;

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
      measurementId,
    };
  }

  throw new Error(
    "[config] Missing Firebase config. Set window.__FIREBASE_CONFIG__ before loading module scripts."
  );
}

const firebaseConfig = readFirebaseConfig();

function getUrlParams() {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new Map();
  }
}

// Expose a promise so other code can await auth readiness
let resolveAuthReady;
window.__authReady = new Promise((res) => (resolveAuthReady = res));

// ===============================
// Shared helpers
// ===============================
function humanFirebaseError(err) {
  const code = err?.code || "";
  const map = {
    "auth/email-already-in-use": "This email is already in use.",
    "auth/invalid-email": "The email address is invalid.",
    "auth/operation-not-allowed": "Email/password sign-up is disabled.",
    "auth/weak-password": "Password is too weak.",
    "auth/popup-closed-by-user": "Sign-in was canceled.",
    "auth/popup-blocked": "Popup was blocked by the browser.",
    "auth/unauthorized-domain":
      "This domain isn’t authorized in Firebase Auth settings.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Wrong password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };
  return map[code] || err?.message || "Something went wrong.";
}

function shakeLoginForm() {
  const card =
    document.querySelector("#loginForm .bg-white") ||
    document.querySelector("#register-form .bg-white") ||
    document.getElementById("loginForm") ||
    document.getElementById("register-form");

  if (!card) return;
  card.classList.remove("shake");
  void card.offsetWidth;
  card.classList.add("shake");
}

// ===============================
// ✅ Nav auth UI (Sign In <-> Profile)
// ===============================
function updateAuthNavItem(user) {
  // expects HTML:
  // <li id="auth-item"><a id="auth-link" href="/login.html">Sign In</a></li>
  const authItem = document.getElementById("auth-item");
  const authLink = document.getElementById("auth-link");
  if (!authItem || !authLink) return; // nav not present on this page

  // only verified users count as "logged in" for app access (your rule)
  if (user && user.emailVerified) {
    authLink.textContent = "Profile";
    authLink.href = "/profile.html"; // change if needed
  } else {
    authLink.textContent = "Sign In";
    authLink.href = "/login.html";
  }
}

// ✅ FAST UI: update nav immediately using localStorage (before Firebase is ready)
// Firebase will override this once onAuthStateChanged runs.
function updateAuthNavFromLocalStorage() {
  const authLink = document.getElementById("auth-link");
  const authItem = document.getElementById("auth-item");
  if (!authItem || !authLink) return;

  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const userName = localStorage.getItem("userName") || "User";
  const userEmail = localStorage.getItem("userEmail") || "";

  if (isLoggedIn) {
    // show Profile immediately
    authLink.textContent = "Profile";
    authLink.href = "/profile.html";
  } else {
    authLink.textContent = "Sign In";
    authLink.href = "/login.html";
  }

  // (Optional debug)
  // console.log("⚡ Nav from localStorage:", { isLoggedIn, userName, userEmail });
}

// Update nav ASAP when DOM is ready (localStorage-based)
document.addEventListener("DOMContentLoaded", () => {
  updateAuthNavFromLocalStorage();
});

// Field error helpers
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
function clearAllRegisterErrors() {
  [
    ["register-name", "err-name"],
    ["register-email", "err-email"],
    ["register-password", "err-password"],
    ["register-password-confirm", "err-password-confirm"],
  ].forEach(([inputId, errId]) => {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    inputEl.classList.remove("is-error", "is-success");
    inputEl.setAttribute("aria-invalid", "false");
    const errEl = document.getElementById(errId);
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }
  });
}
function targetFieldForFirebaseCode(code) {
  switch (code) {
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/email-already-in-use":
      return { inputId: "register-email", errId: "err-email" };
    case "auth/weak-password":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return { inputId: "register-password", errId: "err-password" };
    default:
      return { inputId: "register-email", errId: "err-email" };
  }
}

// ===== Overlays =====
function showWelcomeAndRedirect(name, email) {
  const registerFormSection = document.getElementById("register-form");
  const loginFormEl = document.getElementById("loginContainer");
  const loginContent = loginFormEl
    ? loginFormEl.closest(".login-content") || loginFormEl
    : null;

  const welcomeSection = document.getElementById("welcome-screen");
  const verifyTitle = document.getElementById("verify-title");
  const welcomeName = document.getElementById("welcome-name");
  const welcomeEmail = document.getElementById("welcome-email");
  const avatarInitial = document.getElementById("avatar-initial");

  if (!welcomeSection) {
    window.location.href = "/index.html";
    return;
  }

  if (registerFormSection) registerFormSection.classList.add("blur-bg");
  if (loginContent) loginContent.classList.add("blur-bg");
  welcomeSection.classList.remove("hidden");

  if (verifyTitle) verifyTitle.textContent = "Welcome!";
  if (welcomeName) welcomeName.textContent = `Welcome back, ${name || "User"}!`;
  if (welcomeEmail) welcomeEmail.textContent = email || "";
  if (avatarInitial) avatarInitial.textContent = (name || "U")[0].toUpperCase();

  setTimeout(() => {
    window.location.href = "/index.html";
  }, 1000);
}

function showVerifyOverlay({ email, name }) {
  const registerFormSection = document.getElementById("register-form");
  const loginFormEl = document.getElementById("loginForm");
  const loginContent = loginFormEl
    ? loginFormEl.closest(".login-content") || loginFormEl
    : null;
  if (registerFormSection) registerFormSection.classList.add("blur-bg");
  if (loginContent) loginContent.classList.add("blur-bg");

  const welcome = document.getElementById("welcome-screen");
  if (!welcome) return;
  welcome.classList.remove("hidden");

  const verifyTitle = document.getElementById("verify-title");
  const welcomeEmail = document.getElementById("welcome-email");
  const welcomeName = document.getElementById("welcome-name");
  const avatarInitial = document.getElementById("avatar-initial");

  if (verifyTitle) verifyTitle.textContent = "Please verify your email 📩";
  if (welcomeEmail)
    welcomeEmail.textContent = `We sent a verification link to ${email}.`;
  if (welcomeName) welcomeName.textContent = "Then log in to continue.";
  if (avatarInitial) avatarInitial.textContent = "✉️";
}

// ---------- Password visibility toggles ----------
function wirePasswordToggle({ buttonId, inputId, eyeOnId, eyeOffId }) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  const eyeOn = document.getElementById(eyeOnId);
  const eyeOff = document.getElementById(eyeOffId);
  if (!btn || !input) return;

  btn.setAttribute("aria-pressed", "false");

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    if (eyeOn && eyeOff) {
      eyeOn.classList.toggle("hidden", !showing);
      eyeOff.classList.toggle("hidden", showing);
    }
    btn.setAttribute("aria-pressed", String(!showing));
    btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
}

// ===============================
// Firebase init
// ===============================
(async () => {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    window.__auth = auth;
    resolveAuthReady(auth);
    console.log("✅ Firebase initialized + persistence set");

    try {
      if (await isSupported()) {
        getAnalytics(app);
        console.log("📈 Analytics enabled");
      }
    } catch {
      /* ignore analytics availability issues */
    }
  } catch (err) {
    console.error("🔥 Firebase init error:", err);
    resolveAuthReady(null);
  }
})();

// ===============================
// Handle email verification link (?mode=verifyEmail)
// ===============================
(async () => {
  const auth = await window.__authReady;
  if (!auth) return;

  const params = getUrlParams();
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  if (mode === "verifyEmail" && oobCode) {
    try {
      const info = await checkActionCode(auth, oobCode);
      const email = info?.data?.email || "";

      await applyActionCode(auth, oobCode);

      if (email) localStorage.setItem("justVerifiedEmail", email);

      if (auth.currentUser) {
        try {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            const name = auth.currentUser.displayName || "User";
            const mail = auth.currentUser.email || email || "";
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("userName", name);
            localStorage.setItem("userEmail", mail);
            updateAuthNavFromLocalStorage();
            showWelcomeAndRedirect(name, mail);
            return;
          }
        } catch (e) {
          console.warn("Reload after verification failed:", e);
        }
      }

      window.location.replace("/login.html?verified=1");
    } catch (err) {
      console.warn("verifyEmail handling failed:", err);
      window.location.replace("/login.html?verify_error=1");
    }
  }
})();

// ===============================
// 🔥 Global auth listener for navbar (works on ANY page)
// ===============================
(async () => {
  const auth = await window.__authReady;
  if (!auth) return;

  onAuthStateChanged(auth, (user) => {
    // ✅ updates "Sign In" -> "Profile" wherever the nav exists
    updateAuthNavItem(user);

    // Keep localStorage consistent
    if (user && user.emailVerified) {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userName", user.displayName || "User");
      localStorage.setItem("userEmail", user.email || "");
    } else {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userName");
      localStorage.removeItem("userEmail");
    }

    // Optional: update nav again in case DOM loaded later
    updateAuthNavFromLocalStorage();
  });
})();

// ===============================
// Registration Page Logic (register.html)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("register-name");
  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const confirmInput = document.getElementById("register-password-confirm");
  const startBtn = document.getElementById("register-btn-start");
  const googleBtn = document.getElementById("register-btn-google");

  // Only run on register page
  if (!startBtn && !googleBtn && !nameInput && !emailInput) return;

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

  startBtn?.addEventListener("click", async () => {
    const auth = await window.__authReady;
    if (!auth) {
      showFieldError(
        emailInput,
        "err-email",
        "⚠️ Auth not ready. Check console for Firebase errors.",
      );
      return;
    }

    clearAllRegisterErrors();

    const name = (nameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const password = (passwordInput?.value || "").trim();
    const confirm = (confirmInput?.value || "").trim();

    let hasClientError = false;

    if (!name) {
      showFieldError(nameInput, "err-name", "Name is required.");
      hasClientError = true;
    } else if (name.length > 30) {
      showFieldError(
        nameInput,
        "err-name",
        "Name must be 30 characters or less.",
      );
      shakeLoginForm();
      hasClientError = true;
    } else {
      clearFieldError(nameInput, "err-name");
    }

    if (!email) {
      showFieldError(emailInput, "err-email", "Email is required.");
      hasClientError = true;
    } else if (email.length > 30) {
      showFieldError(
        emailInput,
        "err-email",
        "Email must be 30 characters or less.",
      );
      shakeLoginForm();
      hasClientError = true;
    } else {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!ok) {
        showFieldError(
          emailInput,
          "err-email",
          "Please enter a valid email address.",
        );
        hasClientError = true;
      } else {
        clearFieldError(emailInput, "err-email");
      }
    }

    if (!password) {
      showFieldError(passwordInput, "err-password", "Password is required.");
      hasClientError = true;
    } else if (password.length < 6) {
      showFieldError(
        passwordInput,
        "err-password",
        "Password must be at least 6 characters.",
      );
      hasClientError = true;
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      showFieldError(
        passwordInput,
        "err-password",
        "Password must include at least one special character (!@#$...).",
      );
      hasClientError = true;
    } else {
      clearFieldError(passwordInput, "err-password");
    }

    if (!confirm) {
      showFieldError(
        confirmInput,
        "err-password-confirm",
        "Please confirm your password.",
      );
      hasClientError = true;
    } else if (password && confirm && password !== confirm) {
      showFieldError(
        confirmInput,
        "err-password-confirm",
        "Passwords do not match.",
      );
      hasClientError = true;
    } else if (!hasClientError) {
      clearFieldError(confirmInput, "err-password-confirm");
    }

    if (hasClientError) {
      shakeLoginForm();
      return;
    }

    try {
      const authNow = await window.__authReady;
      const cred = await createUserWithEmailAndPassword(
        authNow,
        email,
        password,
      );
      if (name) await updateProfile(cred.user, { displayName: name });

      const actionCodeSettings = {
        url: `${location.origin}/login.html`,
        handleCodeInApp: false,
      };
      try {
        await sendEmailVerification(cred.user, actionCodeSettings);
      } catch (e) {
        console.warn("⚠️ Failed to send verification email:", e);
      }

      await signOut(authNow);
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userName");
      localStorage.removeItem("userEmail");
      updateAuthNavFromLocalStorage();

      showVerifyOverlay({ email, name });

      setTimeout(() => {
        window.location.href = "/login.html";
      }, 1000);
      return;
    } catch (err) {
      console.error("Registration error:", err);
      const msg = humanFirebaseError(err);
      const { inputId, errId } = targetFieldForFirebaseCode(err?.code);
      const inputEl = document.getElementById(inputId);
      showFieldError(inputEl, errId, msg);
      shakeLoginForm();
    }
  });

  // Google Sign-In (register page)
  googleBtn?.addEventListener("click", async () => {
    const auth = await window.__authReady;
    if (!auth) {
      showFieldError(
        document.getElementById("register-email"),
        "err-email",
        "⚠️ Auth not ready. Check console for Firebase errors.",
      );
      shakeLoginForm();
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user);
        } catch {}
        await signOut(auth);

        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        updateAuthNavFromLocalStorage();

        showVerifyOverlay({
          email: user.email,
          name: user.displayName || "User",
        });
        return;
      }

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userName", user.displayName || "User");
      localStorage.setItem("userEmail", user.email || "");

      updateAuthNavFromLocalStorage();
      updateAuthNavItem(user);

      showWelcomeAndRedirect(user.displayName || "User", user.email || "");
    } catch (err) {
      console.error("Google sign-in error:", err);
      const msg = humanFirebaseError(err);
      showFieldError(
        document.getElementById("register-email"),
        "err-email",
        msg,
      );
      shakeLoginForm();
    }
  });
});

// ===============================
// Login Page Logic (login.html)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const formEl = document.getElementById("loginForm");
  if (!formEl) return;

  const emailInput = document.getElementById("emailInput");
  const passwordInp = document.getElementById("passwordInput");
  const loginBtn = document.getElementById("loginSubmit");
  const googleBtn = document.getElementById("googleBtn");
  const forgotLink = document.getElementById("forgotLink");

  // Prefill after verification + green success line
  (() => {
    const params = new URLSearchParams(location.search);
    const wasVerified = params.get("verified") === "1";
    const verifyErr = params.get("verify_error") === "1";
    const stored = localStorage.getItem("justVerifiedEmail");

    if (wasVerified && stored) {
      if (emailInput) emailInput.value = stored;
      const emailErr = document.getElementById("err-login-email");
      if (emailErr) {
        emailErr.textContent = "✅ Email verified. You can log in now.";
        emailErr.classList.remove("hidden");
        emailErr.style.color = "#16a34a"; // green-600
      }
      passwordInp?.focus();
      localStorage.removeItem("justVerifiedEmail");
    }

    if (verifyErr) {
      const emailErr = document.getElementById("err-login-email");
      if (emailErr) {
        emailErr.textContent =
          "⚠️ Verification link invalid or expired. Please request a new one.";
        emailErr.classList.remove("hidden");
      }
    }
  })();

  const clearLoginErrors = () => {
    clearFieldError(emailInput, "err-login-email");
    clearFieldError(passwordInp, "err-login-password");
    emailInput?.classList.remove("is-success");
    passwordInp?.classList.remove("is-success");
  };

  const targetLoginFieldForCode = (code) => {
    switch (code) {
      case "auth/invalid-email":
      case "auth/user-not-found":
        return { el: emailInput, errId: "err-login-email" };
      case "auth/wrong-password":
      case "auth/invalid-credential":
      case "auth/too-many-requests":
        return { el: passwordInp, errId: "err-login-password" };
      default:
        return { el: emailInput, errId: "err-login-email" };
    }
  };

  const setLoading = (el, loading) => {
    if (!el) return;
    el.disabled = !!loading;
    el.style.opacity = loading ? "0.7" : "1";
    el.style.pointerEvents = loading ? "none" : "auto";
  };

  // Listener (login scope)
  (async () => {
    const auth = await window.__authReady;
    if (!auth) return;

    const isLoginPage = /\/login\.html$/i.test(location.pathname);

    onAuthStateChanged(auth, (user) => {
      updateAuthNavItem(user);

      if (!user) {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        updateAuthNavFromLocalStorage();
        return;
      }
      if (isLoginPage) return;
      if (!user.emailVerified) return;

      const name = user.displayName || "User";
      const email = user.email || "";

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      updateAuthNavFromLocalStorage();

      showWelcomeAndRedirect(name, email);
    });
  })();

  // Email/Password login
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearLoginErrors();

    const auth = await window.__authReady;
    if (!auth) {
      showFieldError(
        emailInput,
        "err-login-email",
        "⚠️ Auth not ready. Check console for errors.",
      );
      shakeLoginForm();
      return;
    }

    const email = (emailInput?.value || "").trim();
    const pass = (passwordInp?.value || "").trim();

    let hasError = false;
    if (!email) {
      showFieldError(emailInput, "err-login-email", "Email is required.");
      hasError = true;
      shakeLoginForm();
    } else {
      clearFieldError(emailInput, "err-login-email");
    }

    if (!pass) {
      showFieldError(
        passwordInp,
        "err-login-password",
        "Password is required.",
      );
      hasError = true;
      shakeLoginForm();
    } else {
      clearFieldError(passwordInp, "err-login-password");
    }

    if (hasError) return;

    try {
      setLoading(loginBtn, true);
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const user = cred.user;

      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user);
        } catch (e) {
          console.warn("Could not send verification email:", e);
        }
        await signOut(auth);

        showFieldError(
          emailInput,
          "err-login-email",
          `📩 Your email isn’t verified. We just sent a new verification link to ${email}. Please verify, then log in.`,
        );
        shakeLoginForm();

        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        updateAuthNavFromLocalStorage();
        updateAuthNavItem(null);

        return;
      }

      const name = user.displayName || "User";
      const cleanEmail = user.email || email;

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", cleanEmail);

      updateAuthNavFromLocalStorage();
      updateAuthNavItem(user);

      showWelcomeAndRedirect(name, cleanEmail);
    } catch (err) {
      console.error("Login error:", err);
      const msg = humanFirebaseError(err);
      const { el, errId } = targetLoginFieldForCode(err?.code);
      showFieldError(el, errId, msg);
      shakeLoginForm();
    } finally {
      setLoading(loginBtn, false);
    }
  });

  // Google login
  googleBtn?.addEventListener("click", async () => {
    clearLoginErrors();

    const auth = await window.__authReady;
    if (!auth) {
      showFieldError(
        emailInput,
        "err-login-email",
        "⚠️ Auth not ready. Check console for errors.",
      );
      shakeLoginForm();
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const inIframe = window.self !== window.top;
      if (inIframe) {
        await signInWithRedirect(auth, provider);
        return;
      }
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user);
        } catch {}
        await signOut(auth);

        showFieldError(
          emailInput,
          "err-login-email",
          `📩 Your email isn’t verified. We sent a verification link to ${user.email}. Please verify, then log in.`,
        );
        shakeLoginForm();

        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        updateAuthNavFromLocalStorage();
        updateAuthNavItem(null);

        return;
      }

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userName", user.displayName || "User");
      localStorage.setItem("userEmail", user.email || "");

      updateAuthNavFromLocalStorage();
      updateAuthNavItem(user);

      showWelcomeAndRedirect(user.displayName || "User", user.email || "");
    } catch (err) {
      console.error("Google sign-in error:", err);
      const msg = humanFirebaseError(err);
      showFieldError(emailInput, "err-login-email", msg);
      shakeLoginForm();
    }
  });

  // Forgot password
  forgotLink?.addEventListener("click", async (e) => {
    e.preventDefault();
    clearLoginErrors();

    const auth = await window.__authReady;
    if (!auth) {
      showFieldError(
        emailInput,
        "err-login-email",
        "⚠️ Auth not ready. Check console for errors.",
      );
      shakeLoginForm();
      return;
    }

    const email = (emailInput?.value || "").trim();
    const errEl = document.getElementById("err-login-email");

    if (!email) {
      if (errEl) {
        errEl.textContent = "Please enter your email to reset your password.";
        errEl.classList.remove("hidden");
        errEl.style.color = "#dc2626";
      }
      shakeLoginForm();
      return;
    } else {
      if (errEl) {
        errEl.textContent = "";
        errEl.classList.add("hidden");
      }
    }

    try {
      await sendPasswordResetEmail(auth, email);
      clearFieldError(emailInput, "err-login-email");
      const el = document.getElementById("err-login-email");
      if (el) {
        el.textContent = "✅ Password reset email sent. Check your inbox.";
        el.classList.remove("hidden");
        el.style.color = "";
      }
    } catch (err) {
      console.error("Reset error:", err);
      const msg = humanFirebaseError(err);
      showFieldError(emailInput, "err-login-email", msg);
      shakeLoginForm();
    }
  });

  wirePasswordToggle({
    buttonId: "login-toggle-password",
    inputId: "passwordInput",
    eyeOnId: "login-eye-on",
    eyeOffId: "login-eye-off",
  });
});

// =====================================================
// PASSWORD RESET FLOW (for passwordReset.html)
// =====================================================
const isResetPage =
  new URLSearchParams(location.search).get("mode") === "resetPassword" ||
  /passwordreset\.html$/i.test(location.pathname);

if (isResetPage) {
  (async () => {
    const auth = await window.__authReady;
    const oobCode = new URLSearchParams(location.search).get("oobCode");

    if (!auth) {
      alert("⚠️ Firebase Auth not initialized. Please reload the page.");
      return;
    }
    if (!oobCode) {
      alert(
        "❌ Invalid or missing reset link. Please use the link from your email.",
      );
      return;
    }
    try {
      await verifyPasswordResetCode(auth, oobCode);
    } catch (err) {
      console.error("verifyPasswordResetCode failed:", err);
      alert(
        "❌ This reset link is invalid or expired. Please request a new one.",
      );
      return;
    }

    const resetPassword = document.getElementById("resetPassword");
    resetPassword?.addEventListener("click", async (e) => {
      e.preventDefault();

      const setError = (id, msg) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg || "";
        if (msg) {
          el.classList.remove("hidden");
          el.style.color = "#dc2626";
        } else {
          el.classList.add("hidden");
          el.style.color = "";
        }
      };
      const shake = (sel = "#register-form") => {
        const card = document.querySelector(sel);
        if (!card) return;
        card.classList.add("animate-[shake_.35s]");
        setTimeout(() => card.classList.remove("animate-[shake_.35s]"), 400);
      };

      const pwInput = document.getElementById("register-password");
      const pw2Input = document.getElementById("register-password-confirm");
      const pw = (pwInput?.value || "").trim();
      const pw2 = (pw2Input?.value || "").trim();

      setError("err-password", "");
      setError("err-password-confirm", "");

      if (pw !== pw2) {
        setError("err-password-confirm", "Passwords do not match.");
        shake();
        return;
      }

      const hasSpecial = /[^A-Za-z0-9]/.test(pw);
      if (pw.length < 8 || !hasSpecial) {
        setError(
          "err-password",
          "Password must be at least 8 characters and include a special character.",
        );
        shake();
        return;
      }

      try {
        await confirmPasswordReset(auth, oobCode, pw);
        alert("✅ Password changed successfully! Redirecting to login...");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1000);
      } catch (err) {
        const code = err?.code || "";
        let msg =
          err?.message ||
          "Something went wrong while changing your password. Please try again.";

        if (code.includes("weak-password")) {
          msg =
            "This password does not meet your Firebase policy. Please choose a stronger password.";
        } else if (code.includes("expired-action-code")) {
          msg = "This reset link has expired. Please request a new one.";
        } else if (code.includes("invalid-action-code")) {
          msg = "This reset link is invalid or already used.";
        }

        setError("err-password", msg);
        shake();
      }
    });
  })();
}
