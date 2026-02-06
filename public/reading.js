/* ============================================================================
   reading.js — FULL (Listening-style UI) — FIXED PDF sizing
   ✅ Forces Chrome PDF viewer to "page-width" inside iframe
   ✅ Keeps overlay button intact by rendering PDF into #pdfInner only
   ✅ Stable A4 viewport via CSS (aspect-ratio), no JS height hacks
============================================================================ */

(() => {
  /* =====================
     1) Constants
  ===================== */
  const PATHS = Object.freeze({ DATA: "/data/all_data_reading.json" });

  const STORAGE_KEYS = Object.freeze({
    TRACKING: "answer_tracking",
  });

  const KEYS = Object.freeze({
    ENTER: "Enter",
    LEFT: "ArrowLeft",
    RIGHT: "ArrowRight",
  });

  const CLS = Object.freeze({
    hidden: "quiz--hidden",
    weightBtn: "quiz--weight-btn",
    selectedWeight: "quiz--selected-weight",
    option: "quiz--option",
    optionSelected: "quiz--selected",
    optionCorrect: "quiz--correct",
    optionIncorrect: "quiz--incorrect",
    uiLocked: "quiz--ui-locked",
    btnLocked: "quiz--btn-locked",
  });

  /* =====================
     2) State
  ===================== */
  const state = {
    allData: [],
    filtered: [],
    index: 0,
    score: 0,
    answered: 0,
    selectedOptionIndex: null,

    onlyUnanswered: false,
    currentWeight: null, // null = none selected, "all" or number when selected
    deservesMode: false,

    // Real Test flags
    realTestMode: false,
    realTestFinished: false,

    // For Copy button
    currentQuestion: null,
  };

  // PDF render race guard
  let pdfRenderToken = 0;
  let activePdfRenderController = null;

  // Copy button timer
  let copyBtnTimer = null;

  /* =====================
     3) DOM
  ===================== */
  const $ = (sel) => document.querySelector(sel);

  const els = {
    quiz: () => $("#quiz"),
    qNumber: () => $("#questionNumber"),
    pictureContainer: () => $("#pictureContainer"),
    pdfInner: () => $("#pdfInner"), // must exist inside pictureContainer
    qText: () => $("#questionText"),
    options: () => $("#alternatives"),
    confirmBtn: () => $("#confirmBtn"),
    score: () => $("#score"),
    onlyChk: () => $("#onlyUnansweredChk"),
    qStats: () => $("#questionStats"),
    notice: () => $("#notice"),
    controls: () => $("#practiceControls"),
    toolbar: () => $("#filtersToolbar"),
    realTestBtn: () => $("#realTestBtn"),
    deservesBtn: () => $("#deservesBtn"),
    emptyState: () => $("#emptyState"),

    // Copy overlay button (MUST be unique)
    copyBtn: () => $("#copyReadingBtn"),
  };

  /* =====================
     4) Helpers
  ===================== */
  const safeText = (node, text) => {
    if (node) node.textContent = (text ?? "").toString();
  };

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getTracking() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKING) || "{}");
    } catch {
      return {};
    }
  }

  function setTracking(o) {
    try {
      localStorage.setItem(STORAGE_KEYS.TRACKING, JSON.stringify(o || {}));
    } catch {}
  }

  function keyFor(q) {
    return `${q.test_id || "unknownTest"}-question${q.question_number}`;
  }

  function readLifetime(q) {
    const t = getTracking();
    const rec = t[keyFor(q)] || { correct: 0, wrong: 0 };
    const correct = Number(rec.correct || 0);
    const wrong = Number(rec.wrong || 0);
    return { correct, wrong, total: correct + wrong };
  }

  function bumpLifetime(q, isCorrect) {
    const key = keyFor(q);
    const tracking = getTracking();
    if (!tracking[key]) tracking[key] = { correct: 0, wrong: 0 };

    if (isCorrect)
      tracking[key].correct = Number(tracking[key].correct || 0) + 1;
    else tracking[key].wrong = Number(tracking[key].wrong || 0) + 1;

    tracking[key].lastAnswered = Date.now();
    setTracking(tracking);
  }

  function isUnansweredLifetime(q) {
    return readLifetime(q).total === 0;
  }

  function fmt2or3(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n ?? "");
    const width = num > 99 ? 3 : 2;
    return String(num).padStart(width, "0");
  }

  function getHeaderNumber(q) {
    if (!q) return null;

    if (q.question_number != null) {
      if (typeof q.question_number === "string") {
        const m = q.question_number.match(/(\d+)/);
        return m ? Number(m[1]) : null;
      }
      return Number(q.question_number);
    }
    if (q.overall_question_number != null)
      return Number(q.overall_question_number);
    return null;
  }

  function toRootPath(p) {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith("/")) return p;
    return "/" + p.replace(/^(\.\/)+/, "");
  }

  function resolvePdfSrc(q) {
    const p =
      q.media_url ||
      q.pdf_url ||
      q.file_url ||
      q.image_url ||
      q.image_local_path;
    return toRootPath(p);
  }

  function getCopyTextForQuestion(q) {
    if (!q) return "";
    const passage = (q.text ?? "").toString().trim();
    const fallback = (
      q.question ??
      q.Question ??
      q.prompt ??
      q.statement ??
      q.enonce ??
      ""
    )
      .toString()
      .trim();
    return passage || fallback || "";
  }

  async function copyToClipboard(text) {
    const clean = (text ?? "").toString().trim();
    if (!clean) return false;

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(clean);
      return true;
    }

    const ta = document.createElement("textarea");
    ta.value = clean;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }

  function flashCopiedButton() {
    const btn = els.copyBtn();
    if (!btn) return;

    if (copyBtnTimer) {
      clearTimeout(copyBtnTimer);
      copyBtnTimer = null;
    }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = "Copied ✅";
    btn.classList.add("is-copied");

    copyBtnTimer = setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove("is-copied");
      copyBtnTimer = null;
    }, 2000);
  }

  function setNotice(msg = "", type = "") {
    const n = els.notice();
    if (!n) return;
    n.textContent = msg || "";
    n.style.color =
      type === "err" ? "#b91c1c" : type === "warn" ? "#92400e" : "#334155";
  }

  function ensureQuestionStatsDOM() {
    if (els.qStats()) return;
    const anchor = els.qNumber() || document.body;
    const stats = document.createElement("div");
    stats.id = "questionStats";
    stats.style.cssText =
      "margin:6px 0 10px 0;font-size:.95rem;opacity:.9;transition:opacity .15s ease-in-out;";
    stats.textContent = "";
    anchor.insertAdjacentElement("afterend", stats);
  }

  function updateQuestionStats(q) {
    ensureQuestionStatsDOM();
    const node = els.qStats();
    if (!node) return;
    if (!q) {
      safeText(node, "");
      return;
    }
    const { correct, wrong, total } = readLifetime(q);
    safeText(node, `: ✅ ${correct} | ❌ ${wrong} (total ${total})`);
  }

  function updateDeservesButton() {
    const btn = els.deservesBtn();
    if (!btn) return;

    const count = countDeservesAttentionForCurrentScope();
    btn.textContent = `📚 Deserves Attention (${count})`;
    btn.classList.toggle("quiz--toggled", !!state.deservesMode);
    btn.setAttribute("aria-pressed", state.deservesMode ? "true" : "false");
  }

  function deservesFromTracking(q) {
    const { correct, wrong, total } = readLifetime(q);
    if (total === 0) return false;
    return Math.abs(correct - wrong) < 2;
  }

  function countDeservesAttentionForCurrentScope() {
    if (state.currentWeight == null) return 0;

    let pool = state.allData;
    if (state.currentWeight !== "all") {
      pool = pool.filter(
        (q) => Number(q.weight_points) === Number(state.currentWeight),
      );
    }
    return pool.filter(deservesFromTracking).length;
  }

  function recomputeFiltered() {
    if (!state.realTestMode && state.currentWeight == null) {
      state.filtered = [];
      return;
    }

    let items = state.allData.slice();

    if (!state.realTestMode) {
      if (state.currentWeight !== "all") {
        items = items.filter(
          (q) => Number(q.weight_points) === Number(state.currentWeight),
        );
      }
    }

    if (state.deservesMode) items = items.filter(deservesFromTracking);
    else if (state.onlyUnanswered) items = items.filter(isUnansweredLifetime);

    state.filtered = items;
  }

  function showSelectWeightEmptyState() {
    els.emptyState()?.classList.remove(CLS.hidden);
    els.quiz()?.classList.add(CLS.hidden);

    safeText(els.qNumber(), "");
    safeText(els.qText(), "");

    els.pdfInner() && (els.pdfInner().innerHTML = "");

    els.options() && (els.options().innerHTML = "");
    els.confirmBtn()?.classList.add(CLS.hidden);
    safeText(els.score(), "");
    updateQuestionStats(null);
  }

  function hideEmptyState() {
    els.emptyState()?.classList.add(CLS.hidden);
  }

  /* =====================
     5) Data loading
  ===================== */
  async function fetchJsonFirstWorking(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          console.warn("JSON candidate returned non-ok status", url, res.status);
          continue;
        }
        const ct = res.headers.get("content-type") || "";
        if (!/application\/json/i.test(ct)) {
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch {
            console.warn("Not JSON at", url, "body starts:", text.slice(0, 120));
            continue;
          }
        }
        return await res.json();
      } catch (err) {
        console.warn("fetchJsonFirstWorking failed for", url, err?.message || err);
        continue;
      }
    }
    throw new Error("All JSON URL candidates failed.");
  }

  async function loadData() {
    const candidates = [PATHS.DATA];

    try {
      const raw = await fetchJsonFirstWorking(candidates);
      state.allData = (raw || []).map((q) => ({
        ...q,
        weight_points: Number(q.weight_points),
      }));
    } catch (e) {
      console.error("loadData failed", e);
      setNotice("Failed to load reading JSON. Check console.", "err");
      state.allData = [];
    }
  }

  async function ensureDataLoaded() {
    if (!state.allData.length) await loadData();
  }

async function getPdfAspectRatio(url) {
    const lib = window.pdfjsLib;
    if (!lib?.getDocument) return null;

    try {
      const task = lib.getDocument({
        url,
        disableStream: true,
        disableAutoFetch: true,
        disableWorker: true,
      });
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const width = Number(viewport?.width || 0);
      const height = Number(viewport?.height || 0);

      try {
        await pdf.destroy();
      } catch {}

      if (!width || !height) return null;
      return width / height;
    } catch (err) {
      console.warn("Could not detect PDF ratio, using fallback", err);
      return null;
    }
  }


   
  /* =====================
     6) PDF rendering (IFRAME)
  ===================== */
  async function renderPdf(q) {
    const wrap = els.pdfInner() || els.pictureContainer();
    if (!wrap) return;

    const myToken = ++pdfRenderToken;

    if (activePdfRenderController) {
      try {
        activePdfRenderController.abort();
      } catch {}
    }
    activePdfRenderController = new AbortController();

    wrap.innerHTML = "";

    let url = resolvePdfSrc(q);
    if (!url) {
      if (myToken !== pdfRenderToken) return;
      wrap.textContent = "No PDF found.";
      return;
    }

    // If you have a helper that converts storage paths to signed download URLs
    if (!(/^https?:\/\//i.test(url)) && window.getFirebaseStorageUrl) {
      try {
        const storageUrl = await window.getFirebaseStorageUrl(url);
        if (storageUrl) url = storageUrl;
      } catch (err) {
        console.warn("Storage URL failed for PDF:", err);
      }
    }

    const loading = document.createElement("div");
    loading.style.cssText =
      "padding:10px 12px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;opacity:.75;font-weight:700;";
    loading.textContent = "Loading page…";
    wrap.appendChild(loading);

    if (myToken !== pdfRenderToken) return;

    // ✅ Use iframe to display PDF (no CORS issues)
    wrap.innerHTML = "";
    wrap.style.width = "100%";
    const pdfAspect = await getPdfAspectRatio(url);
    wrap.style.aspectRatio = pdfAspect ? String(pdfAspect) : "1 / 1.414";
    wrap.style.height = "auto";
    wrap.style.overflow = "hidden";
    wrap.style.background = "#fff";
    wrap.style.position = "relative";

    const iframe = document.createElement("iframe");

    // ✅ KEY FIX: force built-in PDF viewer zoom to page width
    const params = "#zoom=page-width&toolbar=0&navpanes=0&scrollbar=0";

    iframe.src = url.includes("#")
      ? `${url}&zoom=page-width&toolbar=0&navpanes=0&scrollbar=0`
      : `${url}${params}`;

    iframe.style.position = "absolute";
    iframe.style.inset = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.background = "#fff";
    iframe.loading = "lazy";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("scrolling", "no");

    activePdfRenderController.signal.addEventListener("abort", () => {
      try {
        iframe.src = "about:blank";
      } catch {}
    });

    if (myToken !== pdfRenderToken) return;
    wrap.appendChild(iframe);
  }

  /* =====================
     7) Options rendering
  ===================== */
  function deriveLetters(i) {
    return String.fromCharCode(65 + i);
  }

  function renderOptions(q, alreadyAnswered, correctIndex) {
    const container = els.options();
    const confirmBtn = els.confirmBtn();
    if (!container) return;

    container.innerHTML = "";
    state.selectedOptionIndex = null;

    if (confirmBtn) confirmBtn.classList.add(CLS.hidden);

    const alts = Array.isArray(q.alternatives) ? q.alternatives : [];

    alts.forEach((alt, i) => {
      const div = document.createElement("div");
      div.className = CLS.option;

      const letter = alt?.letter || deriveLetters(i);
      const text = typeof alt === "string" ? alt : (alt?.text ?? "");
      const clean = String(text || "")
        .replace(/\s*✅/g, "")
        .replace(/^[A-F]\s*[-.)]?\s*/i, "")
        .trim();

      div.textContent = `${letter}. ${clean}`;

      if (alreadyAnswered) {
        if (q.userAnswerIndex === i) div.classList.add(CLS.optionSelected);

        if (!state.realTestMode) {
          if (i === correctIndex) div.classList.add(CLS.optionCorrect);
          if (i === q.userAnswerIndex && i !== correctIndex)
            div.classList.add(CLS.optionIncorrect);
        }

        div.style.cursor = "default";
        div.style.pointerEvents = "none";
        div.onclick = null;
      } else {
        div.onclick = () => {
          document
            .querySelectorAll(`.${CLS.option}`)
            .forEach((o) => o.classList.remove(CLS.optionSelected));

          div.classList.add(CLS.optionSelected);
          state.selectedOptionIndex = i;
          confirmBtn?.classList.remove(CLS.hidden);
        };
      }

      container.appendChild(div);
    });

    if (confirmBtn) confirmBtn.onclick = () => confirmAnswer(q);
  }

  function updateScore() {
    if (state.realTestMode) {
      safeText(els.score(), "");
      return;
    }
    safeText(
      els.score(),
      `✅ ${state.score} correct out of ${state.answered} answered.`,
    );
  }

  /* =====================
     8) Render Question
  ===================== */
  function renderQuestion() {
    ensureQuestionStatsDOM();

    if (!state.realTestMode && state.currentWeight == null) {
      showSelectWeightEmptyState();
      return;
    }

    const q = state.filtered[state.index];
    state.currentQuestion = q || null;

    if (!q) {
      showSelectWeightEmptyState();
      return;
    }

    const headerNum = getHeaderNumber(q);
    safeText(els.qNumber(), `Question ${fmt2or3(headerNum)}`);

    const qtEl = els.qText();
    if (qtEl) {
      const txt = (q.text ?? q.question ?? "").toString().trim();
      qtEl.textContent = txt;
      qtEl.style.display = txt ? "" : "none";
      collapseReadingText();
    }

    renderPdf(q);

    const alreadyAnswered =
      q.userAnswerIndex !== undefined && q.userAnswerIndex !== null;

    const correctIndex =
      typeof q.correct_index === "number"
        ? Number(q.correct_index)
        : Array.isArray(q.alternatives)
          ? q.alternatives.findIndex((a) => a?.is_correct === true)
          : -1;

    renderOptions(q, alreadyAnswered, correctIndex);

    updateScore();
    updateQuestionStats(q);
  }

  /* =====================
     9) Confirm Answer
  ===================== */
  function confirmAnswer(q) {
    if (q.userAnswerIndex !== undefined && q.userAnswerIndex !== null) {
      els.confirmBtn()?.classList.add(CLS.hidden);
      return;
    }

    if (state.selectedOptionIndex === null) return;

    const correctIndex =
      typeof q.correct_index === "number"
        ? Number(q.correct_index)
        : Array.isArray(q.alternatives)
          ? q.alternatives.findIndex((a) => a?.is_correct === true)
          : -1;

    q.userAnswerIndex = state.selectedOptionIndex;

    const isCorrect = q.userAnswerIndex === correctIndex;
    if (isCorrect) state.score++;
    state.answered++;

    bumpLifetime(q, isCorrect);

    state.selectedOptionIndex = null;
    els.confirmBtn()?.classList.add(CLS.hidden);

    renderOptions(q, true, correctIndex);

    updateScore();
    updateQuestionStats(q);
  }

  /* =====================
     10) Navigation
  ===================== */
  function nextQuestion() {
    if (!state.filtered.length) return;
    if (state.index < state.filtered.length - 1) state.index++;

    renderQuestion();
    if (state.realTestMode) renderRealTestDots();
  }

  function prevQuestion() {
    if (!state.filtered.length) return;
    if (state.index > 0) state.index--;
    renderQuestion();
    if (state.realTestMode) renderRealTestDots();
  }

  /* =====================
     11) Filters
  ===================== */
  async function filterQuestions(weightOrAll) {
    await ensureDataLoaded();

    if (weightOrAll === "all") state.currentWeight = "all";
    else if (weightOrAll == null) state.currentWeight = null;
    else state.currentWeight = Number(weightOrAll);

    document
      .querySelectorAll(`.${CLS.weightBtn}`)
      .forEach((btn) => btn.classList.remove(CLS.selectedWeight));

    const selectedBtn =
      state.currentWeight === "all"
        ? document.querySelector(`.${CLS.weightBtn}[data-all="1"]`)
        : document.querySelector(
            `.${CLS.weightBtn}[data-weight="${state.currentWeight}"]`,
          );
    selectedBtn?.classList.add(CLS.selectedWeight);

    recomputeFiltered();

    if (!state.realTestMode && state.currentWeight == null) {
      showSelectWeightEmptyState();
      updateDeservesButton();
      return;
    }

    hideEmptyState();

    shuffle(state.filtered);
    state.index = 0;
    state.score = 0;
    state.answered = 0;

    els.quiz()?.classList.remove(CLS.hidden);
    renderQuestion();
    updateDeservesButton();
  }

  function toggleDeserves() {
    state.deservesMode = !state.deservesMode;

    if (state.deservesMode) {
      state.onlyUnanswered = false;
      const chk = els.onlyChk();
      if (chk) chk.checked = false;
    }

    recomputeFiltered();
    shuffle(state.filtered);

    state.index = 0;
    state.score = 0;
    state.answered = 0;

    if (!state.realTestMode && state.currentWeight == null) {
      showSelectWeightEmptyState();
      updateDeservesButton();
      return;
    }

    hideEmptyState();
    els.quiz()?.classList.remove(CLS.hidden);
    renderQuestion();
    updateDeservesButton();
  }

  // ============================
  // Expand / Collapse reading text
  // ============================
  (function () {
    const btn = document.getElementById("toggleReadingBtn");
    const text = document.getElementById("questionText");

    if (!btn || !text) return;

    btn.addEventListener("click", () => {
      const expanded = text.classList.toggle("quiz--expanded");
      text.classList.toggle("quiz--collapsed", !expanded);

      text.setAttribute("aria-expanded", String(expanded));
      btn.textContent = expanded ? "⬆️ Collapse reading" : "⬇️ Expand text";
    });
  })();

  function collapseReadingText() {
    const text = document.getElementById("questionText");
    const btn = document.getElementById("toggleReadingBtn");

    if (!text || !btn) return;

    text.classList.remove("quiz--expanded");
    text.classList.add("quiz--collapsed");
    text.setAttribute("aria-expanded", "false");

    btn.textContent = "⬇️ Expand reading";
  }

  /* =====================
     Real Test — minimal working implementation
  ===================== */
  function setUiLocked(locked) {
    const controls = els.controls();
    const toolbar = els.toolbar();
    if (!controls || !toolbar) return;

    if (locked) {
      controls.classList.add(CLS.uiLocked);
      toolbar.classList.add(CLS.uiLocked);
    } else {
      controls.classList.remove(CLS.uiLocked);
      toolbar.classList.remove(CLS.uiLocked);
    }
  }

  function openRealTestOverlay() {
    const overlay = document.getElementById("realTestLoading");
    const startBtn = document.getElementById("startRealTestBtn");
    const txt = document.getElementById("rtLoadingText");

    if (!overlay || !startBtn || !txt) return;

    overlay.classList.remove("quiz--hidden");

    overlay.classList.remove("quiz--rt-ready");
    startBtn.classList.remove("quiz--ready");
    startBtn.disabled = true;

    txt.classList.remove("quiz--fade-out", "quiz--fade-in");
    txt.classList.add("quiz--loading-flash");
    txt.textContent = "Preparing Test...";

    setTimeout(() => {
      txt.classList.add("quiz--fade-out");

      setTimeout(() => {
        txt.classList.remove("quiz--fade-out");
        txt.classList.add("quiz--fade-in");
        txt.classList.remove("quiz--loading-flash");
        txt.textContent = "Ready ✅";

        overlay.classList.add("quiz--rt-ready");
        startBtn.classList.add("quiz--ready");

        startBtn.disabled = false;
      }, 220);
    }, 900);
  }

  function closeRealTestOverlay() {
    const overlay = document.getElementById("realTestLoading");
    const startBtn = document.getElementById("startRealTestBtn");
    const txt = document.getElementById("rtLoadingText");

    overlay?.classList.add(CLS.hidden);

    overlay?.classList.remove("quiz--rt-ready");
    startBtn?.classList.remove("quiz--ready");
    if (startBtn) startBtn.disabled = true;

    if (txt) {
      txt.classList.remove("quiz--fade-out", "quiz--fade-in");
      txt.classList.add("quiz--loading-flash");
      txt.textContent = "Preparing Test...";
    }
  }

  function buildRealTestSet() {
    const pool = state.allData.slice();
    shuffle(pool);

    const needed = 39;
    if (pool.length <= needed) return pool;
    return pool.slice(0, needed);
  }

  function renderRealTestDots() {
    const nav = document.getElementById("questionNav");
    if (!nav) return;

    nav.innerHTML = "";

    state.filtered.forEach((q, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "quiz--qdot";
      dot.textContent = String(i + 1);
      dot.title = `Question ${i + 1}`;

      const answered =
        q.userAnswerIndex !== undefined && q.userAnswerIndex !== null;
      if (answered) dot.style.opacity = "0.75";

      if (i === state.index) dot.classList.add("quiz--active");

      dot.addEventListener("click", () => {
        state.index = i;
        renderQuestion();
        renderRealTestDots();
      });

      nav.appendChild(dot);
    });
  }

  function startRealTest() {
    closeRealTestOverlay();

    state.realTestMode = true;
    state.realTestFinished = false;
    state.deservesMode = false;
    state.onlyUnanswered = false;
    state.currentWeight = "all";

    setUiLocked(true);

    document.getElementById("realTestContainer")?.classList.remove(CLS.hidden);
    document.getElementById("realTestResults")?.classList.add(CLS.hidden);

    state.filtered = buildRealTestSet();
    state.index = 0;
    state.score = 0;
    state.answered = 0;

    els.quiz()?.classList.remove(CLS.hidden);
    hideEmptyState();

    renderQuestion();
    renderRealTestDots();
  }

  function finishRealTest() {
    state.realTestFinished = true;
    state.realTestMode = false;

    setUiLocked(false);

    document.getElementById("realTestContainer")?.classList.add(CLS.hidden);

    state.currentWeight = null;
    state.filtered = [];
    state.index = 0;

    showSelectWeightEmptyState();
    updateDeservesButton();
  }

  /* =====================
     12) Init
  ===================== */
  async function init() {
    await loadData();
    ensureQuestionStatsDOM();

    els.copyBtn()?.addEventListener("click", async () => {
      try {
        const q = state.currentQuestion;
        const text = getCopyTextForQuestion(q);
        if (!text) return;

        await copyToClipboard(text);
        flashCopiedButton();
      } catch (e) {
        console.error("Copy failed:", e);
      }
    });

    els.deservesBtn()?.addEventListener("click", toggleDeserves);

    els.realTestBtn()?.addEventListener("click", openRealTestOverlay);

    document
      .getElementById("rtClose")
      ?.addEventListener("click", closeRealTestOverlay);
    document
      .getElementById("rtBackdrop")
      ?.addEventListener("click", closeRealTestOverlay);

    document
      .getElementById("startRealTestBtn")
      ?.addEventListener("click", startRealTest);

    document
      .getElementById("finishRealTestBtn")
      ?.addEventListener("click", finishRealTest);

    els.onlyChk()?.addEventListener("click", (e) => {
      state.onlyUnanswered = !!e.target.checked;

      if (state.onlyUnanswered) state.deservesMode = false;

      updateDeservesButton();
      recomputeFiltered();

      if (!state.realTestMode && state.currentWeight == null) {
        showSelectWeightEmptyState();
        return;
      }

      shuffle(state.filtered);
      state.index = 0;
      state.score = 0;
      state.answered = 0;
      renderQuestion();
    });

    window.addEventListener("keydown", (e) => {
      const options = Array.from(document.querySelectorAll(`.${CLS.option}`));
      const confirmBtn = els.confirmBtn();
      if (!options.length) return;

      if (/^[1-9]$/.test(e.key)) {
        const i = parseInt(e.key, 10) - 1;
        if (options[i]) {
          options.forEach((o) => o.classList.remove(CLS.optionSelected));
          options[i].classList.add(CLS.optionSelected);
          state.selectedOptionIndex = i;
          confirmBtn?.classList.remove(CLS.hidden);
        }
      }

      if (
        e.key === KEYS.ENTER &&
        confirmBtn &&
        !confirmBtn.classList.contains(CLS.hidden)
      ) {
        confirmBtn.click();
      }

      if (e.key === KEYS.RIGHT) nextQuestion();
      if (e.key === KEYS.LEFT) prevQuestion();
    });

    state.currentWeight = null;
    state.onlyUnanswered = false;
    state.deservesMode = false;

    recomputeFiltered();
    showSelectWeightEmptyState();
    updateDeservesButton();
  }

  window.filterQuestions = filterQuestions;
  window.nextQuestion = nextQuestion;
  window.prevQuestion = prevQuestion;

  init();
})();
