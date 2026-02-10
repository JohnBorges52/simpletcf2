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
  function setupTabs(userId) {
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
      
      // Load data when switching to orders tab
      if (tabKey === 'orders' && userId) {
        loadOrders(userId);
      }
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

      // Get ALL weight data (not filtered by category) to show complete weight breakdown
      const allStats = await window.dbService.getUserStatistics(userId);
      renderWeightBars(allStats.byWeight || {});
      
    } catch (error) {
      console.error("Failed to load progress stats:", error);
    }
  }

  /**
   * Load and display order history
   */
  async function loadOrders(userId) {
    console.log("📦 Loading orders for user:", userId);
    
    const ordersTableBody = document.querySelector('.orders-table tbody');
    const ordersCountPill = document.getElementById('ordersCountPill');
    const loadMoreBtn = document.getElementById('loadMoreOrdersBtn');
    if (!ordersTableBody) {
      console.warn("Orders table tbody not found");
      return;
    }

    try {
      const db = await window.__firestoreReady;
      if (!db || !window.firestoreExports) {
        throw new Error('Firestore not available');
      }

      const { collection, query, where, orderBy, getDocs } = window.firestoreExports;
      
      // Query orders for this user, sorted by date descending
      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(ordersQuery);
      
      if (querySnapshot.empty) {
        ordersTableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: #999; padding: 2rem;">
              No orders yet
            </td>
          </tr>
        `;
        return;
      }
      
      const rows = [];
      const docs = querySnapshot.docs;
      const tierDurations = {
        "quick-study": 10,
        "30-day": 30,
        "full-prep": 60,
      };

      // Fetch current subscription (and refresh expiration) to determine status
      let currentSub = null;
      try {
        if (window.SubscriptionService) {
          await window.SubscriptionService.init();
          currentSub = await window.SubscriptionService.getUserSubscriptionData(userId);
        }
      } catch (error) {
        console.warn("Failed to load current subscription for orders status", error);
      }

      let latestPaidOrderId = null;
      let latestPaidOrderTier = null;
      for (const docSnap of docs) {
        const data = docSnap.data();
        const tierKey = String(data.tier || "").toLowerCase();
        const priceNum = Number(data.price || 0);
        const isPaid = tierKey && tierKey !== "free" && priceNum > 0;
        if (isPaid) {
          latestPaidOrderId = docSnap.id;
          latestPaidOrderTier = tierKey;
          break;
        }
      }

      docs.forEach((docSnap) => {
        const data = docSnap.data();
        const orderId = docSnap.id.substring(0, 8).toUpperCase();
        const createdAt = data.createdAt?.toDate?.() || new Date();
        const formattedDate = createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const tierKey = String(data.tier || "").toLowerCase();
        const plan = data.plan || data.tier || "-";
        const priceNum = Number(data.price || 0);
        const price = priceNum === 0 ? "Free" : `$${priceNum.toFixed(2)}`;

        let statusLabel = data.status || "Completed";
        let statusClass = String(statusLabel).toLowerCase();

        if (priceNum === 0 || tierKey === "free") {
          statusLabel = "Free";
          statusClass = "free";
        } else {
          const isLatestPaid =
            docSnap.id === latestPaidOrderId && latestPaidOrderTier === tierKey;
          let endDate = null;
          if (data.subscriptionEndDate) {
            endDate = data.subscriptionEndDate.toDate
              ? data.subscriptionEndDate.toDate()
              : new Date(data.subscriptionEndDate);
          } else if (
            currentSub?.subscriptionEndDate &&
            docSnap.id === latestPaidOrderId &&
            latestPaidOrderTier === tierKey
          ) {
            endDate = currentSub.subscriptionEndDate.toDate
              ? currentSub.subscriptionEndDate.toDate()
              : new Date(currentSub.subscriptionEndDate);
          } else if (tierDurations[tierKey]) {
            endDate = new Date(
              createdAt.getTime() + tierDurations[tierKey] * 24 * 60 * 60 * 1000,
            );
          }

          if (isLatestPaid && endDate && Date.now() < endDate.getTime()) {
            statusLabel = "Ongoing";
            statusClass = "ongoing";
          } else {
            statusLabel = "Expired";
            statusClass = "expired";
          }
        }

        statusClass = statusClass.replace(/\s+/g, "-");

        rows.push(`
          <tr>
            <td>${orderId}</td>
            <td>${formattedDate}</td>
            <td>${plan}</td>
            <td>${price}</td>
            <td><span class="status-badge status-${statusClass}">${statusLabel}</span></td>
          </tr>
        `);
      });

      const initialCount = 5;
      const loadMoreCount = 3;
      let visibleCount = Math.min(initialCount, rows.length);

      const renderRows = () => {
        ordersTableBody.innerHTML = rows.slice(0, visibleCount).join('');

        if (ordersCountPill) {
          ordersCountPill.textContent = `Showing ${Math.min(visibleCount, rows.length)} of ${rows.length}`;
        }

        if (loadMoreBtn) {
          const remaining = rows.length - visibleCount;
          loadMoreBtn.style.display = remaining > 0 ? '' : 'none';
          loadMoreBtn.textContent = `Show older (+${Math.min(loadMoreCount, remaining)})`;
        }
      };

      if (loadMoreBtn) {
        loadMoreBtn.onclick = () => {
          visibleCount = Math.min(visibleCount + loadMoreCount, rows.length);
          renderRows();
        };
      }

      renderRows();
      console.log(`✅ Loaded ${rows.length} orders`);
      
    } catch (error) {
      console.error("Failed to load orders:", error);
      ordersTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #f44336; padding: 2rem;">
            Failed to load orders
          </td>
        </tr>
      `;
    }
  }

  /**
   * Render weight bars with improved visualization
   */
  function renderWeightBars(byWeight) {
    const weightBars = $("weightBars");
    if (!weightBars) return;

    console.log("📊 Weight data:", byWeight);

    const weights = Object.entries(byWeight)
      .map(([w, obj]) => {
        const totalW = obj.total || 0;
        const correctW = obj.correct || 0;
        const pct = totalW ? Math.round((correctW / totalW) * 100) : 0;
        return { weight: Number(w), total: totalW, correct: correctW, pct };
      })
      .sort((a, b) => a.weight - b.weight);

    console.log("📊 Processed weights:", weights);

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
        data = await window.dbService.getDailyStats(userId, { questionType: category, days: 28 });
      } else {
        data = await window.dbService.getWeeklyStats(userId, { questionType: category, weeks: 12 });
      }

      console.log(`Chart data (${mode}):`, data);

      // Update pill text
      const pill = $("pRangePill");
      if (pill) {
        pill.textContent = mode === "daily" ? "Daily (Last 28 days)" : "Weekly (Last 12 weeks)";
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

      // Draw question count labels on each point
      ctx.fillStyle = "#475569";
      ctx.font = "10px Montserrat";
      ctx.textAlign = "center";
      dataPoints.forEach(point => {
        // Position label above the point
        ctx.fillText(point.total, point.x, point.y - 10);
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

      // Question counts are now always visible on each point

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
   * Load real test results for a specific test type
   */
  async function loadRealTests(userId, testType = "listening") {
    console.log(`🧪 Loading real tests for ${testType}`);
    if (!window.dbService) {
      console.warn("dbService not available");
      return;
    }

    try {
      const stats = await window.dbService.getTestResults(userId, { testType });
      console.log("🧪 Test results loaded:", stats);

      // Update KPIs
      const rtTotal = $("rtTotal");
      const rtBest = $("rtBest");
      const rtAvg = $("rtAvg");
      const rtLast = $("rtLast");
      const rtCountPill = $("rtCountPill");

      if (rtTotal) rtTotal.textContent = String(stats.totalTests || 0);
      if (rtBest) rtBest.textContent = stats.bestScore ? `${stats.bestScore}%` : "—";
      if (rtAvg) rtAvg.textContent = stats.averageScore ? `${stats.averageScore}%` : "—";
      if (rtLast) {
        if (stats.lastTest) {
          rtLast.textContent = fmtDate(stats.lastTest);
        } else {
          rtLast.textContent = "—";
        }
      }
      if (rtCountPill) rtCountPill.textContent = `Showing ${stats.totalTests || 0}`;

      // Render test results table
      renderRealTestsTable(stats.results || []);

    } catch (error) {
      console.error("Failed to load real tests:", error);
    }
  }

  /**
   * Render real tests table
   */
  function renderRealTestsTable(results) {
    const table = $("realTestTableAll");
    if (!table) return;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    if (results.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 24px; color: #94a3b8;">
            No real tests completed yet. Take a test to see your results here!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = results
      .map((test, index) => {
        const testNum = results.length - index;
        const percentage = test.totalQuestions > 0 
          ? Math.round((test.correctAnswers / test.totalQuestions) * 100) 
          : 0;
        const clbBadge = test.clbScore 
          ? `<span class="pill pill-green">CLB ${test.clbScore}</span>` 
          : "—";

        return `
          <tr>
            <td>${test.testType === 'listening' ? '🎧' : '📖'} Test ${testNum}</td>
            <td>${fmtDate(test.completedAt)}</td>
            <td>${test.correctAnswers || 0}/${test.totalQuestions || 0} (${percentage}%)</td>
            <td>${clbBadge}</td>
          </tr>
        `;
      })
      .join("");
  }

  /**
   * Setup real tests category toggle
   */
  function setupRealTestsToggle(userId) {
    let currentTestType = "listening";

    const btnRtListening = $("btnRtListening");
    const btnRtReading = $("btnRtReading");

    const switchTestType = async (testType) => {
      currentTestType = testType;
      
      // Update button states
      if (btnRtListening) btnRtListening.setAttribute("aria-pressed", testType === "listening" ? "true" : "false");
      if (btnRtReading) btnRtReading.setAttribute("aria-pressed", testType === "reading" ? "true" : "false");
      
      // Reload test results
      await loadRealTests(userId, testType);
    };

    // Bind category buttons
    if (btnRtListening) {
      btnRtListening.addEventListener("click", () => switchTestType("listening"));
    }
    if (btnRtReading) {
      btnRtReading.addEventListener("click", () => switchTestType("reading"));
    }

    // Initial load
    loadRealTests(userId, currentTestType);
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
      window.location.href = "/login";
    });
  }

  /**
   * Wait for tier update after successful payment
   * Polls Firestore for tier change (webhook may take a few seconds)
   * @param {string} userId - The user ID to poll for
   * @param {number} maxAttempts - Maximum number of poll attempts
   * @param {number} intervalMs - Milliseconds between each poll
   * @returns {Promise<Object|null>} Updated user data object or null if timeout
   */
  async function waitForTierUpdate(userId, maxAttempts = 20, intervalMs = 1500) {
    console.log("⏳ Waiting for tier update from webhook...");
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`Polling attempt ${attempt + 1}/${maxAttempts}...`);
      
      try {
        // Fetch fresh user data from Firestore
        const db = await window.__firestoreReady;
        if (!db || !window.firestoreExports) {
          console.warn("Firestore not available");
          return null;
        }

        const { doc, getDoc } = window.firestoreExports;
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          const tier = data.tier || 'free';
          
          // Check if tier has been updated to a paid tier
          if (tier !== 'free') {
            console.log(`✅ Tier updated to: ${tier}`);
            return data;
          }
        }
        
        // Wait before next poll (except on last attempt)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.error("Error polling for tier update:", error);
      }
    }
    
    console.warn("⚠️ Tier update timeout - webhook may still be processing");
    return null;
  }

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    console.log("🔍 Profile page loading...");
    console.log("AuthService available:", !!window.AuthService);
    
    await bindLogout();

    console.log("⏳ Waiting for auth user...");
    const user = await waitForAuthUser();
    console.log("Auth user result:", user);

    // Require authentication AND email verification
    // Treat unverified users the same as logged-out users
    if (!user || !user.emailVerified) {
      if (user && !user.emailVerified) {
        console.log("❌ User email not verified, signing out and redirecting to login");
        // Sign out unverified user
        try {
          await window.AuthService.signOutUser();
        } catch (error) {
          console.error("Error signing out:", error);
        }
      } else {
        console.log("❌ No user found, redirecting to login");
      }
      window.location.href = "/login";
      return;
    }

    console.log("✅ User authenticated and email verified:", user.email);
    
    // Show page content only after verification passes
    document.body.style.visibility = "visible";
    
    // Check for payment success redirect
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get('payment') === 'success';
    
    if (isPaymentSuccess) {
      // Don't show alert yet - wait for tier update first
      console.log("💳 Payment success detected, waiting for tier update...");
    } else if (urlParams.get('payment') === 'cancelled') {
      alert('Payment was cancelled. You can try again anytime.');
      window.history.replaceState({}, document.title, '/profile');
    }
    
    // Setup tabs with userId for orders loading
    setupTabs(user.uid);

    // Initialize subscription service (creates user document if needed)
    try {
      if (window.SubscriptionService) {
        await window.SubscriptionService.init();
        console.log("✅ Subscription service initialized");
      }
    } catch (error) {
      console.warn("Failed to initialize subscription service:", error);
    }

    // Load user document from Firestore (if available)
    let userDoc = null;
    
    // If payment was successful, wait for tier update from webhook
    if (isPaymentSuccess) {
      userDoc = await waitForTierUpdate(user.uid);
      
      // If tier was updated, show success message
      if (userDoc && userDoc.tier !== 'free') {
        alert('🎉 Payment successful! Your subscription is now active.');
      } else {
        // Fallback: webhook might be delayed, but show success anyway
        alert('🎉 Payment successful! Your subscription will be activated shortly.');
      }
      
      // Remove query param from URL
      window.history.replaceState({}, document.title, '/profile.html');
    }
    
    // Load user doc if not already loaded
    if (!userDoc) {
      try {
        if (window.dbService && window.dbService.getUser) {
          userDoc = await window.dbService.getUser(user.uid);
        }
      } catch (error) {
        console.warn("Failed to load user document:", error);
      }
    }

    // Set user info in UI from Firestore
    setAvatarAndName(
      userDoc?.displayName || user.displayName || "User",
      userDoc?.email || user.email || "—"
    );

    // If payment was successful, also refresh subscription service data
    if (isPaymentSuccess && window.SubscriptionService) {
      try {
        await window.SubscriptionService.init();
        console.log("✅ Subscription service refreshed after payment");
        
        // Get the refreshed user data from SubscriptionService
        if (window.SubscriptionService.currentUserData) {
          userDoc = window.SubscriptionService.currentUserData;
          console.log("✅ Using refreshed user data from SubscriptionService");
        }
      } catch (error) {
        console.warn("Failed to refresh subscription service:", error);
      }
    }
    
    // Get tier from user document (using potentially refreshed data)
    const tier = userDoc?.tier || "free";
    
    // Map tier to friendly names
    const tierNames = {
      "free": "Free Tier",
      "quick-study": "Quick Study (10 days)",
      "30-day": "30-Day Intensive",
      "full-prep": "Full Preparation"
    };
    
    // Map tier to badge classes
    const tierBadgeClasses = {
      "free": "order-summary-badge--free",
      "quick-study": "order-summary-badge--bronze",
      "30-day": "order-summary-badge--silver",
      "full-prep": "order-summary-badge--gold"
    };
    
    // Update sidebar member pill
    const pill = $("memberPill");
    if (pill) {
      pill.textContent = tierNames[tier] || "Free Tier";
      pill.classList.toggle("pill-green", tier !== "free");
    }
    
    // Update account page plan badge
    const acctPlan = $("acctPlan");
    if (acctPlan) {
      acctPlan.textContent = tierNames[tier] || "Free Tier";
      // Remove all badge classes first
      acctPlan.classList.remove(
        "order-summary-badge--free",
        "order-summary-badge--bronze",
        "order-summary-badge--silver",
        "order-summary-badge--gold"
      );
      // Add the correct badge class
      const badgeClass = tierBadgeClasses[tier] || "order-summary-badge--free";
      acctPlan.classList.add(badgeClass);
    }

    // Update plan expiration date
    const acctExpiration = $("acctExpiration");
    if (acctExpiration) {
      if (tier === "free" || !userDoc?.subscriptionEndDate) {
        acctExpiration.textContent = "—";
        acctExpiration.classList.remove("warning", "critical");
      } else {
        // Calculate time remaining
        const endDate = userDoc.subscriptionEndDate.toDate ? 
          userDoc.subscriptionEndDate.toDate() : 
          new Date(userDoc.subscriptionEndDate);
        const now = new Date();
        const diffMs = endDate - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        
        let expirationText = "";
        let className = "";
        
        if (diffMs <= 0) {
          expirationText = "Expired";
          className = "critical";
        } else if (diffMs < 24 * 60 * 60 * 1000) {
          expirationText = `${diffHours} hour${diffHours === 1 ? "" : "s"} left`;
          className = "critical";
        } else {
          expirationText = `${diffDays} day${diffDays === 1 ? "" : "s"} left`;
          if (diffDays <= 3) {
            className = "critical";
          } else if (diffDays <= 9) {
            className = "warning";
          }
        }
        
        acctExpiration.textContent = expirationText;
        acctExpiration.classList.remove("warning", "critical");
        if (className) {
          acctExpiration.classList.add(className);
        }
      }
    }

    // Setup password reset button
    const profileResetBtn = $("profileResetBtn");
    if (profileResetBtn) {
      profileResetBtn.addEventListener("click", async () => {
        const userEmail = user.email;
        
        if (!userEmail) {
          alert("No email found for this account.");
          return;
        }

        const confirmed = confirm(`Send password reset email to ${userEmail}?`);
        if (!confirmed) return;

        try {
          profileResetBtn.disabled = true;
          profileResetBtn.textContent = "Sending...";

          await window.AuthService.resetPassword(userEmail);

          alert(`✅ Password reset email sent to ${userEmail}. Check your inbox!`);
        } catch (error) {
          console.error("Password reset error:", error);
          const msg = window.AuthService.formatAuthError(error);
          alert(`Failed to send password reset email: ${msg}`);
        } finally {
          profileResetBtn.disabled = false;
          profileResetBtn.textContent = "Send Password Reset Email";
        }
      });
    }

    // Load overview stats (all categories combined)
    await loadOverview(user.uid);
    
    // Setup category toggle and load initial progress (listening by default)
    setupCategoryToggle(user.uid);

    // Setup real tests toggle and load initial data
    setupRealTestsToggle(user.uid);
  });
