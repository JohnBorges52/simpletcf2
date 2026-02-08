// writing.js — Expression Écrite page
// ✅ Loads topics from expression_ecrite_all.json (tries multiple URLs to avoid 404)
// ✅ Random topic per section (1/2/3)
// ✅ Section 3 loads 2 documents + shows title
// ✅ WORD limits + per-section drafts + palette-only accents, persistent
(async () => {
  // ✅ AUTHENTICATION CHECK - Redirect non-logged-in users to plans
  // Wait for AuthService to be available (loaded by config.js)
  while (!window.AuthService) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  await window.AuthService.waitForAuth();
  const user = window.AuthService.getCurrentUser();
  
  if (!user) {
    console.log("🔒 User not logged in, redirecting to plans page...");
    window.location.href = "/plan.html";
    return;
  }
  
  console.log("✅ User authenticated:", user.email);
  // =====================
  // Helpers
  // =====================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const toastEl = $("#toast");
  let toastTimer = null;

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1800);
  }

  // =====================
  // Header mobile toggle
  // =====================
  const header = $(".main_h");
  const toggle = $(".mobile-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("open-nav");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // =====================
  // localStorage helpers
  // =====================
  function getLS(key, fallback = "") {
    try {
      const v = localStorage.getItem(key);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }
  function setLS(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }

  // =====================
  // CLEAR drafts on page reload (refresh)
  // =====================
  const navEntries = performance.getEntriesByType("navigation");
  const isReload =
    navEntries.length > 0
      ? navEntries[0].type === "reload"
      : performance.navigation.type === 1;

  if (isReload) {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("tcf_writing_draft_section_")) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // ignore
    }
  }

  // =====================
  // Auth nav (optional)
  // =====================
  function setAuthNavFromLocalStorage() {
    const link = $("#auth-link");
    if (!link) return;
    const isLoggedIn = getLS("isLoggedIn", "false") === "true";
    link.textContent = isLoggedIn ? "Profile" : "Sign In";
    link.href = isLoggedIn ? "/profile.html" : "/login.html";
  }
  setAuthNavFromLocalStorage();

  // =====================
  // WORD limits per section
  // =====================
  const LIMITS = {
    1: { min: 60, max: 120 },
    2: { min: 120, max: 150 },
    3: { min: 120, max: 180 },
  };

  // =====================
  // Subscription state
  // =====================
  let userSubscription = null;

  // =====================
  // Per-section draft storage
  // =====================
  const DRAFT_KEY_PREFIX = "tcf_writing_draft_section_";
  const draftKey = (section) => `${DRAFT_KEY_PREFIX}${section}`;
  const saveDraft = (section, text) => setLS(draftKey(section), text ?? "");
  const loadDraft = (section) => getLS(draftKey(section), "");

  // =====================
  // Elements
  // =====================
  const writingBox = $("#writingBox");
  const wordCountEl = $("#wordCount");
  const charCountEl = $("#charCount");
  const rangeHint = $("#rangeHint");
  const lenPill = $("#lenPill");
  const badgeSection = $("#badgeSection");
  const topicBox = $("#topicBox");
  const segBtns = $$(".quiz--segBtn");
  const docsWrap = $("#docsWrap");
  const docAEl = $("#docA");
  const docBEl = $("#docB");

  // =====================
  // Topics (from JSON) — robust path probing
  // =====================
  const WRITING_JSON_CANDIDATES = [
    "/data/expression_ecrite_all.json",
  ];

  let QUESTION_BANK = [];

  async function fetchJsonFirstWorking(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log("[Writing] ✅ Loaded JSON from:", url);
        return data;
      } catch (e) {
        console.warn("[Writing] JSON not found at", url, "-", e?.message || e);
      }
    }
    throw new Error("All JSON URL candidates returned 404/failed.");
  }

  async function loadWritingQuestions() {
    try {
      if (topicBox) {
        topicBox.textContent = "Loading writing topics…";
      }

      const raw = await fetchJsonFirstWorking(WRITING_JSON_CANDIDATES);

      // raw: { "Question 1": {...}, "Question 2": {...} }
      const entries = Object.entries(raw)
        .map(([k, v]) => {
          const m = String(k).match(/Question\s+(\d+)/i);
          const n = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
          return { n, v };
        })
        .sort((a, b) => a.n - b.n)
        .map((x) => x.v)
        .filter(Boolean);

      QUESTION_BANK = entries;

      // if (topicBox) {
      //   topicBox.innerHTML = `Loaded <b>${QUESTION_BANK.length}</b> writing prompts. Click <span class="gerate-span">Generate Topic</span> to start.`;
      // }

      // showToast(`Loaded ${QUESTION_BANK.length} topics ✅`);
    } catch (e) {
      console.error("[Writing] Failed to load JSON:", e);
      if (topicBox) {
        topicBox.textContent =
          "Could not load writing topics (404). Make sure the JSON is being served by your site.";
      }
      showToast("JSON not found (404) ❌");
    }
  }

  function pickRandomQuestion() {
    if (!QUESTION_BANK.length) return null;
    return QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  }

  // =====================
  // Accent rules (PALETTE ONLY)
  // =====================
  const SPECIAL_CHARS_BASE = [
    "é",
    "è",
    "ê",
    "ë",
    "à",
    "â",
    "î",
    "ï",
    "ô",
    "û",
    "ù",
    "œ",
  ];

  const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
  const DIRECT_ACCENTED_REGEX = /[À-ÖØ-öø-ÿĀ-žƠ-Ươ-ưǍ-ǰȀ-ȳ]/;

  function hasAccents(str) {
    if (!str) return false;
    const nfd = str.normalize("NFD");
    if (COMBINING_MARKS_REGEX.test(nfd)) {
      COMBINING_MARKS_REGEX.lastIndex = 0;
      return true;
    }
    COMBINING_MARKS_REGEX.lastIndex = 0;
    return DIRECT_ACCENTED_REGEX.test(str);
  }

  function stripAccents(str) {
    if (!str) return "";
    let s = str;
    s = s.replace(/œ/g, "oe").replace(/Œ/g, "OE");
    s = s.normalize("NFD").replace(COMBINING_MARKS_REGEX, "").normalize("NFC");
    s = s.replace(/ç/g, "c").replace(/Ç/g, "C");
    return s;
  }

  function insertTextAtCursor(el, text) {
    if (!el) return;
    el.focus();
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const newPos = start + text.length;
    el.setSelectionRange(newPos, newPos);
  }

  // =====================
  // Counts + range warning (WORD count)
  // =====================
  let activeSection = 1;

  function countWords(str) {
    const s = (str || "").trim();
    if (!s) return 0;
    return s.split(/\s+/).filter(Boolean).length;
  }

  function updateRangeHint() {
    const lim = LIMITS[activeSection];
    if (!lim) return;
    if (rangeHint)
      rangeHint.textContent = `Target: ${lim.min}–${lim.max} words`;
    if (lenPill) lenPill.textContent = `0 / ${lim.max}`;
  }

  function updateCountsAndRange() {
    if (!writingBox) return;

    const txt = writingBox.value || "";
    const words = countWords(txt);
    const chars = txt.length;

    if (wordCountEl)
      wordCountEl.textContent = `${words} word${words === 1 ? "" : "s"}`;
    if (charCountEl)
      charCountEl.textContent = `${chars} char${chars === 1 ? "" : "s"}`;

    const lim = LIMITS[activeSection];
    if (!lim) return;

    if (lenPill) lenPill.textContent = `${words} / ${lim.max}`;

    if (lenPill) lenPill.classList.remove("is-ok", "is-over");
    if (rangeHint) rangeHint.classList.remove("is-ok", "is-over");
    writingBox.classList.remove("is-ok", "is-over");

    if (words > lim.max) {
      if (lenPill) lenPill.classList.add("is-over");
      if (rangeHint) rangeHint.classList.add("is-over");
      writingBox.classList.add("is-over");
    } else if (words >= lim.min && words <= lim.max) {
      if (lenPill) lenPill.classList.add("is-ok");
      if (rangeHint) rangeHint.classList.add("is-ok");
      writingBox.classList.add("is-ok");
    }
  }

  function loadSectionDraftIntoEditor(section) {
    if (!writingBox) return;

    writingBox.value = loadDraft(section) || "";

    requestAnimationFrame(() => {
      const end = writingBox.value.length;
      writingBox.focus();
      writingBox.setSelectionRange(end, end);
    });

    updateCountsAndRange();
  }

  function switchSection(nextSection) {
    if (!writingBox) return;

    saveDraft(activeSection, writingBox.value);

    activeSection = nextSection;
    if (docsWrap) docsWrap.hidden = activeSection !== 3;

    segBtns.forEach((b) => {
      const isActive = Number(b.dataset.section) === nextSection;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-selected", String(isActive));
    });

    if (badgeSection) badgeSection.textContent = `Section ${nextSection}`;
    if (topicBox)
      topicBox.innerHTML = `Click <span class="gerate-span">Generate Topic</span> to start.`;

    // Clear docs when leaving section 3 (optional)
    if (activeSection !== 3) {
      if (docAEl) docAEl.textContent = "";
      if (docBEl) docBEl.textContent = "";
    }

    updateRangeHint();
    loadSectionDraftIntoEditor(nextSection);
  }

  segBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const n = Number(btn.dataset.section);
      if (!n || n === activeSection) return;
      switchSection(n);
    });
  });

  // =====================
  // Generate topic (from JSON)
  // =====================
  const btnGenerate = $("#btnGenerateTopic");
  if (btnGenerate) {
    btnGenerate.addEventListener("click", async () => {
      // ✅ Check subscription access before generating
      const canGenerate = await canGenerateWritingPrompt();
      if (!canGenerate) {
        return; // Blocked by subscription limit
      }

      const q = pickRandomQuestion();
      if (!q) {
        showToast("No topics loaded. Fix JSON path first.");
        return;
      }

      // Section 3: load two documents
      if (activeSection === 3) {
        const t3 = q.tache_3 || {};
        const docs = t3.Documents || {};

        if (docAEl) docAEl.textContent = docs.document1 || "";
        if (docBEl) docBEl.textContent = docs.document2 || "";

        if (topicBox) {
          const title = t3.title ? `🧩 ${t3.title}\n\n` : "";
          topicBox.textContent =
            title +
            "Comparez les points de vue et donnez votre opinion. Utilisez des connecteurs et des exemples.";
        }
        
        // ✅ Track usage after successful generation
        trackWritingUsage();
        return;
      }

      // Sections 1–2: normal single prompt
      const txt = activeSection === 1 ? q.tache_1 || "" : q.tache_2 || "";
      if (topicBox) topicBox.textContent = txt || "";

      // ✅ Track usage after successful generation
      trackWritingUsage();
    });
  }

  // =====================
  // Special characters palette (toggle: lowercase vs uppercase)
  // =====================
  const charPanel = $("#charPanel");
  const capsOffBtn = $("#capsOff");
  const capsOnBtn = $("#capsOn");
  let useCaps = false;

  function setCaps(on) {
    useCaps = !!on;
    if (capsOnBtn) {
      capsOnBtn.classList.toggle("is-active", useCaps);
      capsOnBtn.setAttribute("aria-pressed", String(useCaps));
    }
    if (capsOffBtn) {
      capsOffBtn.classList.toggle("is-active", !useCaps);
      capsOffBtn.setAttribute("aria-pressed", String(!useCaps));
    }
    buildCharPanel();
  }

  if (capsOffBtn) capsOffBtn.addEventListener("click", () => setCaps(false));
  if (capsOnBtn) capsOnBtn.addEventListener("click", () => setCaps(true));

  function insertFromPalette(ch) {
    if (!writingBox) return;
    insertTextAtCursor(writingBox, ch);
    saveDraft(activeSection, writingBox.value);
    updateCountsAndRange();
  }

  function buildCharPanel() {
    if (!charPanel) return;
    charPanel.innerHTML = "";

    const list = useCaps
      ? SPECIAL_CHARS_BASE.map((c) => c.toUpperCase())
      : SPECIAL_CHARS_BASE.slice();

    list.forEach((ch) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "quiz--charBtn";
      b.textContent = ch;
      b.title = `Insert "${ch}"`;
      b.addEventListener("click", () => insertFromPalette(ch));
      charPanel.appendChild(b);
    });
  }

  buildCharPanel();
  setCaps(false);

  // =====================
  // Editor events (auto-save + enforce palette-only accents)
  // =====================
  if (writingBox) {
    writingBox.addEventListener("input", () => {
      saveDraft(activeSection, writingBox.value);
      updateCountsAndRange();
    });

    writingBox.addEventListener("beforeinput", (e) => {
      if (!e.data) return;
      if (hasAccents(e.data)) {
        e.preventDefault();
        showToast("Use the special characters panel to insert accents.");
      }
    });

    writingBox.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (!text) return;

      const cleaned = stripAccents(text);
      if (cleaned === text) return;

      e.preventDefault();
      insertTextAtCursor(writingBox, cleaned);
      showToast(
        "Accents removed from pasted text. Use the panel to add accents.",
      );
      saveDraft(activeSection, writingBox.value);
      updateCountsAndRange();
    });

    writingBox.addEventListener("drop", (e) => {
      const text = e.dataTransfer?.getData("text") ?? "";
      if (!text) return;

      const cleaned = stripAccents(text);
      if (cleaned === text) return;

      e.preventDefault();
      insertTextAtCursor(writingBox, cleaned);
      showToast(
        "Accents removed from dropped text. Use the panel to add accents.",
      );
      saveDraft(activeSection, writingBox.value);
      updateCountsAndRange();
    });
  }

  // Save on leaving page
  window.addEventListener("beforeunload", () => {
    if (!writingBox) return;
    saveDraft(activeSection, writingBox.value);
  });

  // ============================================================================
  // SUBSCRIPTION TIER MANAGEMENT
  // ============================================================================

  /**
   * Initialize subscription service for the current user
   */
  async function initializeSubscription() {
    try {
      if (!window.SubscriptionService) {
        console.warn('SubscriptionService not available');
        return;
      }
      
      const userData = await window.SubscriptionService.init();
      userSubscription = userData;
      console.log('🔍 [DEBUG] Writing - Subscription initialized, full data:', JSON.stringify(userData, null, 2));
    } catch (error) {
      console.error('Error initializing subscription:', error);
    }
  }

  /**
   * Check if user has access to writing practice
   * Shows upgrade modal if limit reached
   */
  async function checkWritingAccess() {
    const user = window.AuthService?.getCurrentUser();
    if (!user) {
      console.log('No user logged in');
      return true; // Allow access when not logged in
    }

    if (!window.SubscriptionService || !userSubscription) {
      console.warn('Subscription service not initialized');
      return true; // Fail open
    }

    const canAccess = window.SubscriptionService.canAccess('writing', userSubscription);
    
    if (!canAccess) {
      window.SubscriptionService.showUpgradeModal(
        `You've used all ${3} free writing prompts! Keep enjoying SimpleTCF by selecting a plan.`
      );
      
      return false;
    }

    return true;
  }

  /**
   * Check if user can generate another writing prompt
   */
  async function canGenerateWritingPrompt() {
    const user = window.AuthService?.getCurrentUser();
    if (!user) return true; // Allow if not logged in

    if (!window.SubscriptionService || !userSubscription) return true;

    // Check if writing is accessible at all
    const tier = userSubscription?.tier || 'free';
    const limits = window.SubscriptionService ? window.SubscriptionService.constructor : null;
    
    // Quick Study tier has NO writing access
    if (tier === 'quick-study') {
      window.SubscriptionService.showUpgradeModal(
        'Writing practice is not included in Quick Study plan. Upgrade to access writing prompts!'
      );
      return false;
    }

    const canAccess = window.SubscriptionService.canAccess('writing', userSubscription);
    
    if (!canAccess) {
      const remaining = window.SubscriptionService.getRemainingUsage(userSubscription);
      window.SubscriptionService.showUpgradeModal(
        `You've reached your limit of ${3} free writing prompts! Keep enjoying SimpleTCF by selecting a plan.`
      );
      return false;
    }

    return true;
  }

  /**
   * Increment usage counter after generating a writing prompt
   */
  async function trackWritingUsage() {
    const user = window.AuthService?.getCurrentUser();
    if (!user || !window.SubscriptionService) return;

    // ✅ Track for ALL users (limits are checked separately)
    try {
      await window.SubscriptionService.incrementUsage(user.uid, 'writing');
      console.log('✅ Writing usage incremented');
      
      // Refresh subscription data
      userSubscription = await window.SubscriptionService.getUserSubscriptionData(user.uid);
      
      // Check if limit reached after this generation
      const canAccessNext = window.SubscriptionService.canAccess('writing', userSubscription);
      if (!canAccessNext) {
        showToast('You have reached your writing prompt limit!');
        setTimeout(() => {
          window.SubscriptionService.showUpgradeModal(
            `You've used all ${3} free writing prompts! Keep enjoying SimpleTCF by selecting a plan.`
          );
        }, 1500);
      } else {
        const remaining = window.SubscriptionService.getRemainingUsage(userSubscription);
        if (remaining.writing !== undefined && remaining.writing !== Infinity) {
          showToast(`Writing prompt generated! ${remaining.writing} prompts remaining.`);
        } else {
          showToast('Writing prompt generated!');
        }
      }
    } catch (error) {
      console.error('Error tracking writing usage:', error);
    }
  }

  // =====================
  // Init
  // =====================
  (async () => {
    // ✅ Wait for Firebase to initialize before using subscription service
    await window.AuthService?.waitForAuth();
    console.log('✅ Firebase ready, initializing writing page...');
    
    // Initialize subscription first
    await initializeSubscription();
    
    // Check initial access (for quick-study or exceeded limits)
    const hasAccess = await checkWritingAccess();
    
    updateRangeHint();
    loadSectionDraftIntoEditor(1);
    loadWritingQuestions();
  })();
})();
