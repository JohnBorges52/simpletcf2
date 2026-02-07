/* global window, document */
// ===============================
// Profile Page - Clean Firebase Auth
// No localStorage usage
// ===============================

import { signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ----------------------------
// Helpers
// ----------------------------
const $ = (id) => document.getElementById(id);

function fmtPct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${Math.round(num)}%`;
}

  function fmtDate(ts) {
    try {
      const d =
        ts?.toDate?.() ||
        (ts instanceof Date ? ts : null) ||
        (typeof ts === "string" ? new Date(ts) : null);

      if (!d || isNaN(d.getTime())) return "—";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  /**
   * Wait for authentication to be ready and return current user
   * @returns {Promise<Object|null>} Current user or null
   */
  async function waitForAuthUser() {
    // Use the auth service from window.AuthService
    if (!window.AuthService) {
      console.error("AuthService not loaded");
      return null;
    }

    return await window.AuthService.waitForAuth();
  }

  /**
   * Set avatar and user info in header
   */
  function setAvatarAndName(displayName, email) {
    const name = displayName || "User";
    const mail = email || "—";
    
    const nameEl = $("profileName");
    const emailEl = $("profileEmail");
    const avatarEl = $("avatarInitial");

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = mail;

    const initial = (name?.trim?.()[0] || mail?.trim?.()[0] || "U").toUpperCase();
    if (avatarEl) avatarEl.textContent = initial;

    // Account tab inputs
    const nameInput = $("acctNameInput");
    const emailInput = $("acctEmailInput");
    if (nameInput) nameInput.value = name;
    if (emailInput) emailInput.value = mail;
  }

  /**
   * Setup tab navigation
   */
  function setupTabs() {
    const btns = Array.from(document.querySelectorAll(".profile-sidebtn[data-tab]"));
    const tabs = {
      overview: $("tab-overview"),
      progress: $("tab-progress"),
      realtests: $("tab-realtests"),
      orders: $("tab-orders"),
      account: $("tab-account"),
    };

    function show(tabKey) {
      Object.entries(tabs).forEach(([k, el]) => {
        if (!el) return;
        el.classList.toggle("profile-hidden", k !== tabKey);
      });
      btns.forEach((b) => {
        const active = b.dataset.tab === tabKey;
        b.setAttribute("aria-current", active ? "true" : "false");
        b.classList.toggle("is-active", active);
      });
    }

    btns.forEach((b) =>
      b.addEventListener("click", () => show(b.dataset.tab))
    );

    // default tab
    show("overview");
  }

  /**
   * Load user statistics from Firestore
   */
  async function loadOverviewAndProgress(userId) {
    console.log("📊 Loading statistics for user:", userId);
    if (!window.dbService) {
      console.warn("dbService not available");
      return;
    }

    try {
      const stats = await window.dbService.getUserStatistics(userId);
      console.log("📊 User statistics loaded:", stats);
      const total = stats.totalResponses || 0;
      const correct = stats.correctResponses || 0;
      const wrong = total - correct;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;

      console.log(`Stats: Total=${total}, Correct=${correct}, Wrong=${wrong}, Accuracy=${accuracy.toFixed(2)}%`);

      // Overview KPIs
      const accuracyEl = $("kpiAccuracy");
      const totalEl = $("kpiTotal");
      const correctEl = $("kpiCorrect");
      const wrongEl = $("kpiWrong");

      if (accuracyEl) accuracyEl.textContent = fmtPct(accuracy);
      if (totalEl) totalEl.textContent = String(total);
      if (correctEl) correctEl.textContent = String(correct);
      if (wrongEl) wrongEl.textContent = String(wrong);

      // Progress KPIs
      const pAccuracy = $("pAccuracy");
      const pAnswered = $("pAnswered");
      const pCorrect = $("pCorrect");

      if (pAccuracy) pAccuracy.textContent = fmtPct(accuracy);
      if (pAnswered) pAnswered.textContent = String(total);
      if (pCorrect) pCorrect.textContent = String(correct);

      // Study streak
      const streak = await window.dbService.getStudyStreak(userId);
      const streakEl = $("pStreak");
      if (streakEl) streakEl.textContent = streak ? `${streak} days` : "0";

      // Weight bars
      const weightBars = $("weightBars");
      if (weightBars && stats.byWeight) {
        const weights = Object.entries(stats.byWeight)
          .map(([w, obj]) => {
            const totalW = obj.total || 0;
            const correctW = obj.correct || 0;
            const pct = totalW ? Math.round((correctW / totalW) * 100) : 0;
            return { weight: Number(w), total: totalW, pct };
          })
          .sort((a, b) => a.weight - b.weight);

        weightBars.innerHTML = weights
          .map(
            (w) => `
            <div class="weight-bar">
              <div class="weight-bar__label">Weight ${w.weight} (${w.total})</div>
              <div class="weight-bar__track">
                <div class="weight-bar__fill" style="width:${w.pct}%"></div>
              </div>
              <div class="weight-bar__pct">${w.pct}%</div>
            </div>
          `
          )
          .join("");
      }
    } catch (error) {
      console.error("Failed to load user stats:", error);
    }
  }

  /**
   * Start real-time listener for answer history
   */
  async function startAnswerHistoryListener(userId) {
    console.log("🎧 Starting answer history listener for user:", userId);
    if (!window.dbService || !window.dbService.listenToAnswerHistory) {
      console.warn("Answer history listener not available");
      return;
    }

    const tableBody = $("answerHistoryTableBody");
    if (!tableBody) return;

    window.dbService.listenToAnswerHistory(userId, (answers) => {
      console.log("📝 Answer history update received:", answers.length, "answers");
      if (!answers || answers.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-gray-500 py-4">No practice history yet</td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = answers
        .map((ans) => {
          const isCorrect = ans.isCorrect;
          const badge = isCorrect
            ? '<span class="pill pill-green">✓ Correct</span>'
            : '<span class="pill pill-red">✗ Wrong</span>';
          
          return `
            <tr>
              <td>${fmtDate(ans.timestamp)}</td>
              <td><span class="capitalize">${ans.category || "—"}</span></td>
              <td>Weight ${ans.weight || "—"}</td>
              <td>${badge}</td>
              <td>${ans.timeTaken ? `${ans.timeTaken}s` : "—"}</td>
            </tr>
          `;
        })
        .join("");
    });
  }

  /**
   * Bind logout button
   */
  async function bindLogout() {
    const logoutBtn = $("logoutBtn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
      try {
        if (window.AuthService) {
          await window.AuthService.signOutUser();
        }
      } catch (error) {
        console.error("Logout error:", error);
      }

      // Redirect to login
      window.location.href = "/login.html";
    });
  }

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    console.log("🔍 Profile page loading...");
    console.log("AuthService available:", !!window.AuthService);
    
    setupTabs();
    await bindLogout();

    console.log("⏳ Waiting for auth user...");
    const user = await waitForAuthUser();
    console.log("Auth user result:", user);

    // Require authentication
    if (!user) {
      console.log("❌ No user found, redirecting to login");
      window.location.href = "/login.html";
      return;
    }

    console.log("✅ User authenticated:", user.email);

    // Load user document from Firestore (if available)
    let userDoc = null;
    try {
      if (window.dbService && window.dbService.getUser) {
        userDoc = await window.dbService.getUser(user.uid);
      }
    } catch (error) {
      console.warn("Failed to load user document:", error);
    }

    // Set user info in UI
    setAvatarAndName(
      userDoc?.displayName || user.displayName || "User",
      userDoc?.email || user.email || "—"
    );

    // Plan badge
    const plan = userDoc?.plan || "free";
    const pill = $("memberPill");
    if (pill) {
      pill.textContent = plan === "free" ? "Free Member" : `${plan} Member`;
      pill.classList.toggle("pill-green", plan !== "free");
    }

    // Load stats and start listeners
    await loadOverviewAndProgress(user.uid);
    await startAnswerHistoryListener(user.uid);
  });
