/* global window, document */
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

(function () {
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
    // ts can be Firestore Timestamp, Date, or null
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

  async function waitForAuthUser() {
    const auth = await window.__authReady;
    if (!auth) return null;

    // If already restored, return immediately
    if (auth.currentUser) return auth.currentUser;

    // Otherwise wait for first state
    return await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user || null);
      });
    });
  }

  function setAvatarAndName(displayName, email) {
    const name = displayName || "User";
    const mail = email || "—";
    $("profileName").textContent = name;
    $("profileEmail").textContent = mail;

    const initial = (name?.trim?.()[0] || mail?.trim?.()[0] || "U").toUpperCase();
    $("avatarInitial").textContent = initial;

    // Account tab inputs
    const nameInput = $("acctNameInput");
    const emailInput = $("acctEmailInput");
    if (nameInput) nameInput.value = name;
    if (emailInput) emailInput.value = mail;
  }

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

    // default
    show("overview");
  }

  // ----------------------------
  // Answer History (Realtime)
  // ----------------------------
  let unsubscribeHistory = null;

  async function startAnswerHistoryListener(userId) {
    // UI elements
    const loadingEl = $("answerHistoryLoading");
    const emptyEl = $("answerHistoryEmpty");
    const tableWrap = $("answerHistoryTableWrap");
    const tbody = $("answerHistoryBody");

    if (!loadingEl || !emptyEl || !tableWrap || !tbody) return;

    loadingEl.style.display = "block";
    emptyEl.style.display = "none";
    tableWrap.style.display = "none";
    tbody.innerHTML = "";

    const db = await window.__firestoreReady;
    const {
      collection,
      query,
      where,
      orderBy,
      limit: limitFn,
      onSnapshot,
    } = window.firestoreExports;

    const q = query(
      collection(db, "questionResponses"),
      where("userId", "==", userId),
      orderBy("answeredAt", "desc"),
      limitFn(50)
    );

    // stop previous
    if (unsubscribeHistory) unsubscribeHistory();

    unsubscribeHistory = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));

        loadingEl.style.display = "none";

        if (!rows.length) {
          emptyEl.style.display = "block";
          tableWrap.style.display = "none";
          tbody.innerHTML = "";
          return;
        }

        emptyEl.style.display = "none";
        tableWrap.style.display = "block";

        tbody.innerHTML = rows
          .map((r) => {
            const result = r.isCorrect ? "✅ Correct" : "❌ Wrong";
            const qLabel = `${(r.questionType || "—").toUpperCase()} • Q${r.questionNumber || "—"} • W${r.weight || 0}`;
            return `
              <tr>
                <td>${fmtDate(r.answeredAt)}</td>
                <td>${qLabel}</td>
                <td>${result}</td>
                <td>${r.isCorrect ? "1" : "0"}</td>
                <td>${r.isCorrect ? "0" : "1"}</td>
                <td>${r.isCorrect ? "100%" : "0%"}</td>
              </tr>
            `;
          })
          .join("");
      },
      (err) => {
        console.error("Answer history listener error:", err);
        loadingEl.style.display = "none";
        emptyEl.style.display = "block";
        emptyEl.textContent =
          "Could not load answer history. Check Firestore rules / indexes.";
      }
    );
  }

  // ----------------------------
  // Load stats + render KPIs
  // ----------------------------
  async function loadOverviewAndProgress(userId) {
    const stats = await window.dbService.getUserStatistics(userId, { limit: 500 });

    const total = stats.totalResponses || 0;
    const correct = stats.correctResponses || 0;
    const wrong = stats.incorrectResponses || 0;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;

    // Overview KPIs
    $("kpiAnswered").textContent = String(total);
    $("kpiAccuracy").textContent = fmtPct(accuracy);
    $("kpiCorrect").textContent = String(correct);
    $("kpiWrong").textContent = String(wrong);

    // Progress KPIs (default Listening view)
    $("pAccuracy").textContent = fmtPct(accuracy);
    $("pAnswered").textContent = String(total);
    $("pCorrect").textContent = String(correct);

    // streak (overall)
    const streak = await window.dbService.getStudyStreak(userId);
    $("pStreak").textContent = streak ? `${streak} days` : "0";

    // Weight bars
    const weightBars = $("weightBars");
    if (weightBars) {
      const weights = Object.entries(stats.byWeight || {})
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
  }

  // ----------------------------
  // Logout
  // ----------------------------
  async function bindLogout() {
    const btn = $("logoutBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      try {
        const auth = await window.__authReady;
        if (auth) await signOut(auth);
      } catch (e) {
        console.warn("signOut failed:", e);
      }

      // Optional: keep if you still use these elsewhere
      try {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
      } catch {}

      window.location.href = "/login.html";
    });
  }

  // ----------------------------
  // Init
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    await bindLogout();

    const user = await waitForAuthUser();

    // If not logged in -> go to login
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    // User doc (optional)
    let userDoc = null;
    try {
      userDoc = await window.dbService.getUser(user.uid);
    } catch (e) {
      console.warn("getUser failed:", e);
    }

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

    // Load stats + realtime answer history
    await loadOverviewAndProgress(user.uid);
    await startAnswerHistoryListener(user.uid);
  });
})();
