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
   * Load user statistics from Firestore (for Overview - all categories combined)
   */
  async function loadOverview(userId) {
    console.log("📊 Loading overview statistics for user:", userId);
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

      // Overview KPIs (combined listening + reading)
      const accuracyEl = $("kpiAccuracy");
      const answeredEl = $("kpiAnswered");
      const correctEl = $("kpiCorrect");
      const wrongEl = $("kpiWrong");

      if (accuracyEl) accuracyEl.textContent = fmtPct(accuracy);
      if (answeredEl) answeredEl.textContent = String(total);
      if (correctEl) correctEl.textContent = String(correct);
      if (wrongEl) wrongEl.textContent = String(wrong);

    } catch (error) {
      console.error("Failed to load overview stats:", error);
    }
  }

  /**
   * Load progress statistics for a specific category
   */
  async function loadProgress(userId, category = "listening") {
    console.log(`📊 Loading progress for ${category}`);
    if (!window.dbService) {
      console.warn("dbService not available");
      return;
    }

    try {
      // Get category-specific stats
      const stats = await window.dbService.getUserStatistics(userId, { questionType: category });
      const total = stats.totalResponses || 0;
      const correct = stats.correctResponses || 0;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;

      // Progress KPIs
      const pAccuracy = $("pAccuracy");
      const pAnswered = $("pAnswered");
      const pCorrect = $("pCorrect");

      if (pAccuracy) pAccuracy.textContent = fmtPct(accuracy);
      if (pAnswered) pAnswered.textContent = String(total);
      if (pCorrect) pCorrect.textContent = String(correct);

      // Study streak
      const streak = await window.dbService.getStudyStreak(userId, { questionType: category });
      const streakEl = $("pStreak");
      if (streakEl) streakEl.textContent = streak ? `${streak} days` : "0";

      // Render weight bars with improved design
      renderWeightBars(stats.byWeight || {});
      
    } catch (error) {
      console.error("Failed to load progress stats:", error);
    }
  }

  /**
   * Render weight bars with improved visualization
   */
  function renderWeightBars(byWeight) {
    const weightBars = $("weightBars");
    if (!weightBars) return;

    const weights = Object.entries(byWeight)
      .map(([w, obj]) => {
        const totalW = obj.total || 0;
        const correctW = obj.correct || 0;
        const pct = totalW ? Math.round((correctW / totalW) * 100) : 0;
        return { weight: Number(w), total: totalW, correct: correctW, pct };
      })
      .sort((a, b) => a.weight - b.weight);

    if (weights.length === 0) {
      weightBars.innerHTML = '<div class="progress-note muted">No data yet. Start practicing!</div>';
      return;
    }

    weightBars.innerHTML = weights
      .map(w => `
        <div class="weight-row">
          <div class="weight-label">Weight ${w.weight}</div>
          <div class="weight-track">
            <div class="weight-fill" style="width: ${w.pct}%"></div>
          </div>
          <div class="weight-val">${w.pct}%</div>
        </div>
      `)
      .join("");
  }

  /**
   * Render accuracy over time chart
   */
  async function renderAccuracyChart(userId, category, mode = "weekly") {
    console.log(`📈 Rendering ${mode} chart for ${category}`);
    
    const canvas = $("progressLineChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      let data;
      if (mode === "daily") {
        data = await window.dbService.getDailyStats(userId, { questionType: category, days: 30 });
      } else {
        data = await window.dbService.getWeeklyStats(userId, { questionType: category, weeks: 12 });
      }

      console.log(`Chart data (${mode}):`, data);

      // Update pill text
      const pill = $("pRangePill");
      if (pill) {
        pill.textContent = mode === "daily" ? "Daily (Last 30 days)" : "Weekly (Last 12 weeks)";
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!data || data.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "16px Montserrat";
        ctx.textAlign = "center";
        ctx.fillText("No data yet. Start practicing!", canvas.width / 2, canvas.height / 2);
        return;
      }

      // Chart dimensions and padding
      const padding = { top: 20, right: 20, bottom: 40, left: 50 };
      const chartWidth = canvas.width - padding.left - padding.right;
      const chartHeight = canvas.height - padding.top - padding.bottom;

      // Data processing
      const maxAccuracy = 100;
      const dataPoints = data.map((d, i) => ({
        x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
        y: padding.top + chartHeight - (d.accuracy / maxAccuracy) * chartHeight,
        accuracy: d.accuracy,
        label: mode === "daily" ? d.date : `Week ${d.week + 1}`,
        total: d.total
      }));

      // Draw grid lines
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }

      // Draw Y-axis labels
      ctx.fillStyle = "#64748b";
      ctx.font = "12px Montserrat";
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const value = 100 - (i * 25);
        const y = padding.top + (chartHeight / 4) * i;
        ctx.fillText(`${value}%`, padding.left - 10, y + 4);
      }

      // Draw line chart
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      dataPoints.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();

      // Draw points
      ctx.fillStyle = "#3b82f6";
      dataPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw X-axis labels (show every nth label to avoid crowding)
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Montserrat";
      ctx.textAlign = "center";
      const labelStep = mode === "daily" ? 7 : 2;
      dataPoints.forEach((point, i) => {
        if (i % labelStep === 0 || i === dataPoints.length - 1) {
          const label = mode === "daily" 
            ? new Date(data[i].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : `W${data[i].week + 1}`;
          ctx.fillText(label, point.x, canvas.height - 15);
        }
      });

    } catch (error) {
      console.error("Failed to render chart:", error);
    }
  }

  /**
   * Setup category toggle (listening/reading) in Progress tab
   */
  function setupCategoryToggle(userId) {
    let currentCategory = "listening";
    let currentTimeMode = "weekly";

    const btnListening = $("btnModeListening");
    const btnReading = $("btnModeReading");
    const btnDaily = $("btnDaily");
    const btnWeekly = $("btnWeekly");

    const switchCategory = async (category) => {
      currentCategory = category;
      
      // Update button states
      if (btnListening) btnListening.setAttribute("aria-pressed", category === "listening" ? "true" : "false");
      if (btnReading) btnReading.setAttribute("aria-pressed", category === "reading" ? "true" : "false");
      
      // Reload progress data and chart
      await loadProgress(userId, category);
      await renderAccuracyChart(userId, category, currentTimeMode);
    };

    const switchTimeMode = async (mode) => {
      currentTimeMode = mode;
      
      // Update button states
      if (btnDaily) btnDaily.setAttribute("aria-current", mode === "daily" ? "true" : "false");
      if (btnWeekly) btnWeekly.setAttribute("aria-current", mode === "weekly" ? "true" : "false");
      
      // Re-render chart
      await renderAccuracyChart(userId, currentCategory, mode);
    };

    // Bind category buttons
    if (btnListening) {
      btnListening.addEventListener("click", () => switchCategory("listening"));
    }
    if (btnReading) {
      btnReading.addEventListener("click", () => switchCategory("reading"));
    }

    // Bind time mode buttons
    if (btnDaily) {
      btnDaily.addEventListener("click", () => switchTimeMode("daily"));
    }
    if (btnWeekly) {
      btnWeekly.addEventListener("click", () => switchTimeMode("weekly"));
    }

    // Initial load
    loadProgress(userId, currentCategory);
    renderAccuracyChart(userId, currentCategory, currentTimeMode);
  }

  /**
   * Remove old weight bars and answer history code
   */
  async function oldCodeRemoved_loadOverviewAndProgress(userId) {
    // THIS FUNCTION IS NO LONGER USED - REPLACED BY loadOverview() and loadProgress()
    return;
  }

  async function oldCodeRemoved_startAnswerHistoryListener(userId) {
    // THIS FUNCTION IS NO LONGER USED - REMOVED PER USER REQUEST
    return;
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

    // Load overview stats (all categories combined)
    await loadOverview(user.uid);
    
    // Setup category toggle and load initial progress (listening by default)
    setupCategoryToggle(user.uid);
  });
