// profile.js (vanilla)

function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function getLS(key, fallback = "") {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function setAuthNavFromLocalStorage() {
  const link = $("#auth-link");
  if (!link) return;

  const isLoggedIn = getLS("isLoggedIn", "false") === "true";

  if (isLoggedIn) {
    link.textContent = "Profile";
    link.href = "/profile.html";
  } else {
    link.textContent = "Sign In";
    link.href = "/login.html";
  }
}

function requireLoginOrRedirect() {
  const isLoggedIn = getLS("isLoggedIn", "false") === "true";
  if (!isLoggedIn) {
    window.location.replace("/login.html");
    return false;
  }
  return true;
}

function renderUserHeader() {
  const name = getLS("userName", "User") || "User";
  const email = getLS("userEmail", "") || "";

  const initial = (name?.trim()?.[0] || "U").toUpperCase();

  const avatar = $("#avatarInitial");
  const profileName = $("#profileName");
  const profileEmail = $("#profileEmail");

  if (avatar) avatar.textContent = initial;
  if (profileName) profileName.textContent = name;
  if (profileEmail) profileEmail.textContent = email || "—";
}

/* ===========================
   ACCOUNT
   =========================== */

function setAccountPlaceholders() {
  const plan = getLS("userPlan", "—");
  const renewal = getLS("userRenewalDate", "—");

  $("#acctPlan") && ($("#acctPlan").textContent = plan || "—");
  $("#acctRenewal") && ($("#acctRenewal").textContent = renewal || "—");
}

function wireAccountEditor() {
  const nameInput = $("#acctNameInput");
  const emailInput = $("#acctEmailInput");

  const editBtn = $("#editAccountBtn");
  const saveBtn = $("#saveAccountBtn");
  const cancelBtn = $("#cancelAccountBtn");
  const savedPill = $("#accountSavedPill");

  if (!nameInput || !emailInput || !editBtn || !saveBtn || !cancelBtn) return;

  const seedInputs = () => {
    nameInput.value = getLS("userName", "User") || "User";
    emailInput.value = getLS("userEmail", "") || "";
  };

  const setEditing = (isEditing) => {
    nameInput.disabled = !isEditing;
    emailInput.disabled = !isEditing;

    saveBtn.disabled = !isEditing;
    cancelBtn.disabled = !isEditing;

    editBtn.disabled = isEditing;

    if (savedPill) savedPill.hidden = true;
  };

  const validate = () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name) return { ok: false, msg: "Name cannot be empty." };
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return { ok: false, msg: "Invalid email format." };
    }
    return { ok: true, msg: "" };
  };

  seedInputs();
  setEditing(false);

  editBtn.addEventListener("click", () => {
    seedInputs();
    setEditing(true);
    nameInput.focus();
  });

  cancelBtn.addEventListener("click", () => {
    seedInputs();
    setEditing(false);
  });

  saveBtn.addEventListener("click", () => {
    const v = validate();
    if (!v.ok) {
      alert(v.msg);
      return;
    }

    const newName = nameInput.value.trim();
    const newEmail = emailInput.value.trim();

    try {
      localStorage.setItem("userName", newName);
      localStorage.setItem("userEmail", newEmail);
    } catch {}

    renderUserHeader();

    if (savedPill) {
      savedPill.hidden = false;
      setTimeout(() => {
        if (savedPill) savedPill.hidden = true;
      }, 2000);
    }

    setEditing(false);
  });
}

/* ===========================
   OVERVIEW KPIs (placeholder)
   =========================== */

function seedKpis() {
  const answered = 0;
  const accuracy = "—";
  const realTests = 0;
  const streak = "—";

  $("#kpiAnswered") && ($("#kpiAnswered").textContent = answered);
  $("#kpiAccuracy") && ($("#kpiAccuracy").textContent = accuracy);
  $("#kpiRealTests") && ($("#kpiRealTests").textContent = realTests);
  $("#kpiStreak") && ($("#kpiStreak").textContent = streak);
}

/* ===========================
   REAL TESTS (placeholders)
   =========================== */

function seedRealTests() {
  // Placeholders (newest first)
  const datasets = {
    listening: [
      { id: "L-RT-020", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-019", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-018", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-017", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-016", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-015", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-014", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-013", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-012", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-011", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-010", date: "—", correct: "—", clb: "—" },
      { id: "L-RT-009", date: "—", correct: "—", clb: "—" },
    ],
    reading: [
      { id: "R-RT-020", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-019", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-018", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-017", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-016", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-015", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-014", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-013", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-012", date: "—", correct: "—", clb: "—" },
      { id: "R-RT-011", date: "—", correct: "—", clb: "—" },
    ],
  };

  const tbody = $("#realTestTableAll tbody");
  const loadMoreBtn = $("#loadMoreRealTestsBtn");
  const countPill = $("#rtCountPill");

  const kTotal = $("#rtTotal");
  const kBest = $("#rtBest");
  const kAvg = $("#rtAvg");
  const kLast = $("#rtLast");

  if (!tbody) return;

  let mode = "listening";
  let visibleCount = 5;

  function setMode(nextMode) {
    mode = nextMode;
    visibleCount = 5; // reset to last 5 when switching

    // toggle buttons
    const bL = $("#btnRtListening");
    const bR = $("#btnRtReading");
    if (bL)
      bL.setAttribute("aria-pressed", mode === "listening" ? "true" : "false");
    if (bR)
      bR.setAttribute("aria-pressed", mode === "reading" ? "true" : "false");

    render();
  }

  function rowHTML(t) {
    return `
      <tr>
        <td>${t.id}</td>
        <td>${t.date}</td>
        <td>${t.correct}</td>
        <td>${t.clb}</td>

      </tr>
    `;
  }

  function render() {
    const all = datasets[mode];
    const slice = all.slice(0, visibleCount);

    // Table
    tbody.innerHTML = slice.map(rowHTML).join("");

    // Buttons
    $all("[data-review]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-review");
        alert(`TODO: open review for ${id}`);
      });
    });

    // KPIs (placeholders)
    if (kTotal) kTotal.textContent = all.length;
    if (kBest) kBest.textContent = "—";
    if (kAvg) kAvg.textContent = "—";
    if (kLast) kLast.textContent = slice[0]?.date || "—";

    // Count pill
    if (countPill)
      countPill.textContent = `Showing ${slice.length} of ${all.length}`;

    // Load more button state
    if (loadMoreBtn) {
      const done = visibleCount >= all.length;
      loadMoreBtn.disabled = done;
      loadMoreBtn.textContent = done ? "No more tests" : "Load more (+5)";
      loadMoreBtn.classList.add("review-btn", done);
    }
  }

  // Wire toggle buttons
  $("#btnRtListening")?.addEventListener("click", () => setMode("listening"));
  $("#btnRtReading")?.addEventListener("click", () => setMode("reading"));

  // Load more
  loadMoreBtn?.addEventListener("click", () => {
    const all = datasets[mode];
    visibleCount = Math.min(visibleCount + 5, all.length);
    render();
  });

  // Initial render
  setMode("listening");
}

/* ===========================
   MY ORDERS (placeholders)
   =========================== */

function seedOrdersTable() {
  const allOrders = [
    {
      id: "#BL-12548",
      date: "Jun 15, 2023",
      items: "Spring Blossom Bouquet",
      total: "$45.99",
      status: "Expired",
    },
    {
      id: "#BL-12547",
      date: "Jun 10, 2023",
      items: "Rose Elegance Arrangement",
      total: "$62.50",
      status: "Expired",
    },
    {
      id: "#BL-12542",
      date: "Jun 5, 2023",
      items: "Sunflower Delight",
      total: "$38.75",
      status: "Active",
    },
    {
      id: "#BL-12531",
      date: "May 28, 2023",
      items: "Lavender Dream Bundle",
      total: "$54.20",
      status: "Expired",
    },
    {
      id: "#BL-12520",
      date: "May 12, 2023",
      items: "Orchid Premium Vase",
      total: "$79.00",
      status: "Expired",
    },
    {
      id: "#BL-12505",
      date: "Apr 30, 2023",
      items: "Tulip Seasonal Box",
      total: "$29.99",
      status: "Active",
    },
    {
      id: "#BL-12488",
      date: "Apr 18, 2023",
      items: "Peony Celebration",
      total: "$66.40",
      status: "Expired",
    },
    {
      id: "#BL-12470",
      date: "Apr 2, 2023",
      items: "Mixed Wildflowers",
      total: "$41.10",
      status: "Expired",
    },
    {
      id: "#BL-12450",
      date: "Mar 20, 2023",
      items: "Minimalist White Roses",
      total: "$58.00",
      status: "Active",
    },
  ];

  const tbody = $("#ordersTable tbody");
  const loadMoreBtn = $("#loadMoreOrdersBtn");
  const countPill = $("#ordersCountPill");

  if (!tbody) return;

  let visibleCount = 3;

  function statusClass(status) {
    if (status === "Active") return "pill-status pill-ongoing";
    return "pill-status pill-expired";
  }

  function rowHTML(o) {
    return `
      <tr>
        <td class="order-id">${o.id}</td>
        <td>${o.date}</td>
        <td>${o.items}</td>
        <td>${o.total}</td>
        <td><span class="${statusClass(o.status)}">${o.status}</span></td>
      </tr>
    `;
  }

  function render() {
    const slice = allOrders.slice(0, visibleCount);
    tbody.innerHTML = slice.map(rowHTML).join("");

    if (countPill) {
      countPill.textContent = `Showing ${slice.length} of ${allOrders.length}`;
    }

    if (loadMoreBtn) {
      const done = visibleCount >= allOrders.length;
      loadMoreBtn.disabled = done;
      loadMoreBtn.textContent = done ? "No older orders" : "Show older (+3)";
      loadMoreBtn.classList.add("review-btn", done);
    }
  }

  render();

  loadMoreBtn?.addEventListener("click", () => {
    visibleCount = Math.min(visibleCount + 3, allOrders.length);
    render();
  });
}

/* ===========================
   PROGRESS (placeholders)
   - Listening/Reading
   - Daily/Weekly
   - Interactive canvas chart (tooltip + labels)
   =========================== */

function makeDailyLabels(n) {
  // Simple "D1..Dn" labels (you can replace by real dates later)
  return Array.from({ length: n }, (_, i) => `D${i + 1}`);
}
function makeWeeklyLabels(n) {
  return Array.from({ length: n }, (_, i) => `W${i + 1}`);
}

function seedProgressPlaceholders() {
  // Placeholder datasets
  const data = {
    listening: {
      kpis: { accuracy: 72, answered: 180, correct: 130, streak: 6 },
      daily: [
        55, 56, 57, 58, 57, 59, 60, 61, 60, 62, 63, 64, 63, 65, 66, 67, 66, 68,
        69, 68, 70, 71, 70, 72, 73, 72, 74, 74, 73, 72,
      ],
      weekly: [55, 60, 62, 58, 65, 66, 70, 68, 72, 71, 73, 72],
      weights: [
        { w: 33, pct: 64 },
        { w: 26, pct: 70 },
        { w: 21, pct: 76 },
        { w: 15, pct: 79 },
        { w: 9, pct: 82 },
        { w: 3, pct: 90 },
      ],
    },
    reading: {
      kpis: { accuracy: 68, answered: 140, correct: 95, streak: 6 },
      daily: [
        50, 51, 52, 52, 53, 54, 55, 55, 56, 57, 58, 58, 59, 60, 60, 61, 62, 63,
        63, 64, 65, 65, 66, 67, 67, 68, 68, 68, 68, 68,
      ],
      weekly: [50, 54, 56, 58, 60, 61, 63, 64, 66, 67, 68, 68],
      weights: [
        { w: 33, pct: 58 },
        { w: 26, pct: 63 },
        { w: 21, pct: 70 },
        { w: 15, pct: 72 },
        { w: 9, pct: 78 },
        { w: 3, pct: 88 },
      ],
    },
  };

  let currentMode = "listening";
  let timeScale = "weekly"; // "weekly" | "daily"

  function setMode(mode) {
    currentMode = mode;

    const bL = $("#btnModeListening");
    const bR = $("#btnModeReading");
    if (bL)
      bL.setAttribute("aria-pressed", mode === "listening" ? "true" : "false");
    if (bR)
      bR.setAttribute("aria-pressed", mode === "reading" ? "true" : "false");

    renderProgress();
  }

  function setTimeScale(scale) {
    timeScale = scale;
    // Optional: update pill text if you have #pRangePill
    const pill = $("#pRangePill");
    if (pill)
      pill.textContent =
        scale === "daily" ? "Daily (Last 30 days)" : "Weekly (Last 12 weeks)";
    renderProgress();
  }

  function renderProgress() {
    const d = data[currentMode];

    // KPIs
    $("#pAccuracy") && ($("#pAccuracy").textContent = `${d.kpis.accuracy}%`);
    $("#pAnswered") && ($("#pAnswered").textContent = d.kpis.answered);
    $("#pCorrect") && ($("#pCorrect").textContent = d.kpis.correct);
    $("#pStreak") && ($("#pStreak").textContent = `${d.kpis.streak} days`);

    // Weight bars
    const wrap = $("#weightBars");
    if (wrap) {
      wrap.innerHTML = d.weights
        .map((x) => {
          const color = pctColor(x.pct);
          const track = pctTrackBg(x.pct);

          return `
          <div class="weight-row">
            <div class="weight-label">${x.w} pts</div>
            <div class="weight-track" style="background:${track}">
              <div class="weight-fill" style="width:${x.pct}%; background:${color}"></div>
            </div>
            <div class="weight-val">${x.pct}%</div>
          </div>
        `;
        })
        .join("");
    }

    // Chart series + labels
    const series = d[timeScale];
    const labels =
      timeScale === "daily"
        ? makeDailyLabels(series.length)
        : makeWeeklyLabels(series.length);

    drawLineChartInteractive("progressLineChart", series, labels);
  }

  // Interactive canvas chart with tooltip + labels
  function drawLineChartInteractive(canvasId, values, labels = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const wrap = canvas.parentElement; // expects .chart-wrap
    const tooltip = document.getElementById("chartTooltip");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect0 = canvas.getBoundingClientRect();
    if (rect0.width === 0) return; // tab hidden; we'll redraw when visible

    const n = values.length;
    const defaultLabels = Array.from({ length: n }, (_, i) => `P${i + 1}`);
    const xLabels = labels.length === n ? labels : defaultLabels;

    const dpr = window.devicePixelRatio || 1;
    const cssW = rect0.width;
    const cssH = 260;

    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const W = canvas.width;
    const H = canvas.height;

    const padL = 52 * dpr;
    const padR = 18 * dpr;
    const padT = 18 * dpr;
    const padB = 42 * dpr;

    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const minV = Math.min(...values, 0);
    const maxV = Math.max(...values, 100);
    const range = maxV - minV || 1;

    const stepX = innerW / Math.max(1, n - 1);
    const mapX = (i) => padL + stepX * i;
    const mapY = (v) => padT + innerH - ((v - minV) / range) * innerH;

    const accent = (
      getComputedStyle(document.documentElement).getPropertyValue("--accent") ||
      "#3b82f6"
    ).trim();

    const points = values.map((v, i) => ({
      i,
      v,
      x: mapX(i),
      y: mapY(v),
      label: xLabels[i],
    }));

    let hoverIndex = -1;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Grid + y labels
      const gridCount = 4;
      ctx.lineWidth = 1 * dpr;

      for (let i = 0; i <= gridCount; i++) {
        const t = i / gridCount;
        const y = padT + innerH * t;

        ctx.strokeStyle = "rgba(148,163,184,0.28)";
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + innerW, y);
        ctx.stroke();

        const val = Math.round(maxV - range * t);
        ctx.fillStyle = "rgba(100,116,139,0.95)";
        ctx.font = `${12 * dpr}px system-ui`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${val}%`, padL - 10 * dpr, y);
      }

      // Border
      ctx.strokeStyle = "rgba(229,231,235,1)";
      ctx.strokeRect(padL, padT, innerW, innerH);

      // Y label
      ctx.save();
      ctx.translate(14 * dpr, padT + innerH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "rgba(100,116,139,0.95)";
      ctx.font = `${12 * dpr}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Accuracy (%)", 0, 0);
      ctx.restore();

      // X labels (thin out if many)
      ctx.fillStyle = "rgba(100,116,139,0.95)";
      ctx.font = `${12 * dpr}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const maxLabels = 8;
      const stride = n <= maxLabels ? 1 : Math.ceil(n / maxLabels);

      for (let i = 0; i < n; i += stride) {
        const p = points[i];
        ctx.fillText(p.label, p.x, padT + innerH + 10 * dpr);
      }
      if ((n - 1) % stride !== 0) {
        const p = points[n - 1];
        ctx.fillText(p.label, p.x, padT + innerH + 10 * dpr);
      }

      // Line
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Points + hover
      points.forEach((p, idx) => {
        const isHover = idx === hoverIndex;

        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (isHover ? 4.5 : 3.5) * dpr, 0, Math.PI * 2);
        ctx.fill();

        if (isHover) {
          ctx.strokeStyle = "rgba(59,130,246,0.25)";
          ctx.lineWidth = 6 * dpr;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6.5 * dpr, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = "rgba(148,163,184,0.35)";
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath();
          ctx.moveTo(p.x, padT);
          ctx.lineTo(p.x, padT + innerH);
          ctx.stroke();
        }
      });
    }

    function setTooltip(p, clientX, clientY) {
      if (!tooltip || !wrap) return;
      tooltip.hidden = false;
      tooltip.textContent = `${p.label}: ${Math.round(p.v)}%`;

      const wrapRect = wrap.getBoundingClientRect();
      tooltip.style.left = `${clientX - wrapRect.left}px`;
      tooltip.style.top = `${clientY - wrapRect.top}px`;
    }

    function hideTooltip() {
      if (tooltip) tooltip.hidden = true;
    }

    function nearestPointIndex(ev) {
      const r = canvas.getBoundingClientRect();
      const mx = (ev.clientX - r.left) * dpr;
      const my = (ev.clientY - r.top) * dpr;

      const hitR = 10 * dpr;
      let bestIdx = -1;
      let bestDist = Infinity;

      points.forEach((p, idx) => {
        const dx = mx - p.x;
        const dy = my - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          bestIdx = idx;
        }
      });

      return bestDist <= hitR * hitR ? bestIdx : -1;
    }

    draw();

    canvas.onmousemove = (ev) => {
      const idx = nearestPointIndex(ev);
      if (idx !== hoverIndex) {
        hoverIndex = idx;
        draw();
      }
      if (idx >= 0) setTooltip(points[idx], ev.clientX, ev.clientY);
      else hideTooltip();
    };

    canvas.onmouseleave = () => {
      hoverIndex = -1;
      hideTooltip();
      draw();
    };
  }

  // Listening/Reading toggle (exists in your HTML)
  $("#btnModeListening")?.addEventListener("click", () => setMode("listening"));
  $("#btnModeReading")?.addEventListener("click", () => setMode("reading"));

  // Daily/Weekly: if you add buttons with these IDs later, it will work automatically.
  $("#btnDaily")?.addEventListener("click", () => setTimeScale("daily"));
  $("#btnWeekly")?.addEventListener("click", () => setTimeScale("weekly"));

  // First render
  setMode(currentMode);

  // Resize redraw
  window.addEventListener("resize", () => {
    renderProgress();
  });

  // Expose redraw for tab switching
  window.__renderProgressChart = () => {
    renderProgress();
  };

  // Optional: expose scale changer if you want to call it elsewhere
  window.__setProgressScale = (scale) => setTimeScale(scale);

  function pctColor(pct) {
    // Pick colors by performance band
    if (pct >= 85) return "#16a34a"; // green
    if (pct >= 70) return "#3b82f6"; // blue
    if (pct >= 55) return "#f59e0b"; // orange
    return "#ef4444"; // red
  }

  function pctTrackBg(pct) {
    // Soft background tint (optional)
    if (pct >= 85) return "rgba(22,163,74,0.12)";
    if (pct >= 70) return "rgba(59,130,246,0.10)";
    if (pct >= 55) return "rgba(245,158,11,0.12)";
    return "rgba(239,68,68,0.12)";
  }
}

/* ===========================
   TABS + ACTIONS
   =========================== */

function switchTab(tabId) {
  $all(".profile-sidebtn").forEach((b) => {
    const isActive = b.getAttribute("data-tab") === tabId;
    b.setAttribute("aria-current", isActive ? "true" : "false");
  });

  const allPanels = ["overview", "progress", "realtests", "orders", "account"];

  allPanels.forEach((id) => {
    const panel = $(`#tab-${id}`);
    if (!panel) return;
    panel.classList.toggle("profile-hidden", id !== tabId);
  });

  // If Progress tab becomes visible, redraw after layout/paint
  if (tabId === "progress") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__renderProgressChart?.();
      });
    });
  }
}

function wireTabs() {
  $all(".profile-sidebtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) switchTab(tab);
    });
  });
}

function logout() {
  try {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
  } catch {}
  window.location.href = "/login.html";
}

function wireActions() {
  $("#logoutBtn")?.addEventListener("click", logout);
  $("#logoutBtn2")?.addEventListener("click", logout);

  $("#manageSubBtn")?.addEventListener("click", () => {
    window.location.href = "/checkout.html";
  });
}

/* ===========================
   BOOT
   =========================== */

document.addEventListener("DOMContentLoaded", () => {
  setAuthNavFromLocalStorage();
  if (!requireLoginOrRedirect()) return;

  renderUserHeader();

  seedKpis();

  // Real Tests
  seedRealTests();

  // Orders
  seedOrdersTable();

  // Progress
  seedProgressPlaceholders();

  // Account
  setAccountPlaceholders();
  wireAccountEditor();

  wireTabs();
  wireActions();

  // Default tab
  switchTab("overview");

  // Sync if auth changes in another tab
  window.addEventListener("storage", () => {
    setAuthNavFromLocalStorage();
    if (getLS("isLoggedIn", "false") !== "true") {
      window.location.replace("/login.html");
    } else {
      renderUserHeader();
      setAccountPlaceholders();
      // If progress tab is visible, redraw
      window.__renderProgressChart?.();
    }
  });
});
