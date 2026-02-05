/* ============================================================================
   TCF Reading Practice — Full App Script (Listening-style UI)
   ✅ Copy button overlay: button text becomes "Copied ✅" (green) for 2s
   ✅ PDF renders into #pdfInner so overlay button is never wiped
   ✅ Practice: requires selecting a weight first (empty state)
   ✅ Never responded filter + Deserves Attention
   NOTE: This file focuses on Practice flow + Copy button + PDF rendering.
         If you have a bigger Real Test implementation already, keep it and
         only merge the COPY + PDF-INNER parts.
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

    // Real Test flags (kept for compatibility; not implemented fully here)
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

    // Practice: show question_number from json if present; else overall_question_number
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
    // Prefer passage text from JSON
    const passage = (q.text ?? "").toString().trim();
    // Fallback to question prompt
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

    // Fallback
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
    // First load: require weight selection
    if (!state.realTestMode && state.currentWeight == null) {
      state.filtered = [];
      return;
    }

    let items = state.allData.slice();

    // Practice weight filtering
    if (!state.realTestMode) {
      if (state.currentWeight !== "all") {
        items = items.filter(
          (q) => Number(q.weight_points) === Number(state.currentWeight),
        );
      }
    }

    // Deserves > Unanswered
    if (state.deservesMode) items = items.filter(deservesFromTracking);
    else if (state.onlyUnanswered) items = items.filter(isUnansweredLifetime);

    state.filtered = items;
  }

  function showSelectWeightEmptyState() {
    els.emptyState()?.classList.remove(CLS.hidden);
    els.quiz()?.classList.add(CLS.hidden);

    safeText(els.qNumber(), "");
    safeText(els.qText(), "");

    // Clear PDF content but keep overlay button
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
     5) Data
  ===================== */
  async function loadData() {
    try {
      const res = await fetch(PATHS.DATA, { cache: "no-store" });
      const raw = await res.json();
      state.allData = (raw || []).map((q) => ({
        ...q,
        weight_points: Number(q.weight_points),
      }));
    } catch (e) {
      console.error("loadData failed", e);
      state.allData = [];
      setNotice("Failed to load reading JSON. Check console.", "err");
    }
  }

  async function ensureDataLoaded() {
    if (!state.allData.length) await loadData();
  }

  /* =====================
     6) PDF rendering
  ===================== */
  async function renderPdf(q) {
    // ✅ render inside #pdfInner so overlay button stays intact
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

    const url = resolvePdfSrc(q);
    if (!url) {
      if (myToken !== pdfRenderToken) return;
      wrap.textContent = "No PDF found.";
      return;
    }

    const loading = document.createElement("div");
    loading.style.cssText =
      "padding:10px 12px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;opacity:.75;font-weight:700;";
    loading.textContent = "Loading page…";
    wrap.appendChild(loading);

    if (myToken !== pdfRenderToken) return;

    // If pdf.js isn't present, fallback to iframe
    if (!window.pdfjsLib) {
      wrap.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.style.width = "100%";
      iframe.style.height = "780px";
      iframe.style.border = "0";
      iframe.loading = "lazy";

      activePdfRenderController.signal.addEventListener("abort", () => {
        try {
          iframe.src = "about:blank";
        } catch {}
      });

      if (myToken !== pdfRenderToken) return;
      wrap.appendChild(iframe);
      return;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

    try {
      const task = pdfjsLib.getDocument(url);
      const pdf = await task.promise;
      if (myToken !== pdfRenderToken) return;

      const page = await pdf.getPage(1);
      if (myToken !== pdfRenderToken) return;

      const containerWidth = wrap.clientWidth || 900;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
        transform,
      });
      await renderTask.promise;

      if (myToken !== pdfRenderToken) return;

      wrap.innerHTML = "";
      wrap.appendChild(canvas);
    } catch (e) {
      console.error("PDF render failed:", e);
      if (myToken !== pdfRenderToken) return;
      wrap.innerHTML = "";
      wrap.textContent = "Failed to render PDF.";
    }
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

        // Practice: show correct/wrong styling after answered
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
    // prevent double count
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

    // rerender to lock + show correct/wrong
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

    // Selected pill highlight
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

    // Turning on deserves turns off never responded
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

  // ============================
  // Force reading text collapsed
  // ============================
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

    // show overlay
    overlay.classList.remove("quiz--hidden");

    // RESET states (important so it can replay)
    overlay.classList.remove("quiz--rt-ready");
    startBtn.classList.remove("quiz--ready");
    startBtn.disabled = true;

    txt.classList.remove("quiz--fade-out", "quiz--fade-in");
    txt.classList.add("quiz--loading-flash");
    txt.textContent = "Preparing Test...";

    // after delay: switch to READY state (this is what your CSS expects)
    setTimeout(() => {
      // stop flashing, animate text swap
      txt.classList.add("quiz--fade-out");

      setTimeout(() => {
        txt.classList.remove("quiz--fade-out");
        txt.classList.add("quiz--fade-in");
        txt.classList.remove("quiz--loading-flash");
        txt.textContent = "Ready ✅";

        // ✅ these two lines are the key for your CSS
        overlay.classList.add("quiz--rt-ready");  // makes spinner/check look ready
        startBtn.classList.add("quiz--ready");    // makes button visible/clickable

        startBtn.disabled = false;
      }, 220);
    }, 900);
  }


  function closeRealTestOverlay() {
    const overlay = document.getElementById("realTestLoading");
    const startBtn = document.getElementById("startRealTestBtn");
    const txt = document.getElementById("rtLoadingText");

    overlay?.classList.add(CLS.hidden);

    // reset so it doesn't get stuck next open
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
    // Use your entire dataset — typical TCF is 39 questions.
    // If you want strict weight distribution later, we can implement it.
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

      // mark answered
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

    // reset flags
    state.realTestMode = true;
    state.realTestFinished = false;
    state.deservesMode = false;
    state.onlyUnanswered = false;
    state.currentWeight = "all"; // not used in real test, but avoids empty state

    // lock practice filters
    setUiLocked(true);

    // show real test container
    document.getElementById("realTestContainer")?.classList.remove(CLS.hidden);
    document.getElementById("realTestResults")?.classList.add(CLS.hidden);

    // build test set and reset counters
    state.filtered = buildRealTestSet();
    state.index = 0;
    state.score = 0;
    state.answered = 0;

    // show quiz
    els.quiz()?.classList.remove(CLS.hidden);
    hideEmptyState();

    renderQuestion();
    renderRealTestDots();
  }

  function finishRealTest() {
    state.realTestFinished = true;
    state.realTestMode = false;

    // unlock practice filters again
    setUiLocked(false);

    // hide real test container
    document.getElementById("realTestContainer")?.classList.add(CLS.hidden);

    // return to “select weight” state (or keep last chosen weight if you prefer)
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

    // Copy binding: button changes to "Copied ✅" green for 2 seconds
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

    // Deserves Attention
    els.deservesBtn()?.addEventListener("click", toggleDeserves);

    // Real Test button
    els.realTestBtn()?.addEventListener("click", openRealTestOverlay);

    // Overlay close (X + backdrop)
    document
      .getElementById("rtClose")
      ?.addEventListener("click", closeRealTestOverlay);
    document
      .getElementById("rtBackdrop")
      ?.addEventListener("click", closeRealTestOverlay);

    // Start real test from overlay
    document
      .getElementById("startRealTestBtn")
      ?.addEventListener("click", startRealTest);

    // Finish test
    document
      .getElementById("finishRealTestBtn")
      ?.addEventListener("click", finishRealTest);

    // Never responded
    els.onlyChk()?.addEventListener("click", (e) => {
      state.onlyUnanswered = !!e.target.checked;

      // If never responded is ON, force deserves OFF
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

    // Keyboard shortcuts
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

    // Initial state: require weight selection
    state.currentWeight = null;
    state.onlyUnanswered = false;
    state.deservesMode = false;

    recomputeFiltered();
    showSelectWeightEmptyState();
    updateDeservesButton();

    // Expose for inline HTML onclick + nav buttons
    window.filterQuestions = filterQuestions;
    window.nextQuestion = nextQuestion;
    window.prevQuestion = prevQuestion;
  }

  init();
})();
