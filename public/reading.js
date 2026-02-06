/* ============================================================================
   reading.js — FULL
   ✅ Uses PDF.js canvas render (NO black PDF viewer background)
   ✅ Keeps copy overlay button
   ✅ Re-renders on resize to keep perfect fit
============================================================================ */

import {
  getTracking as getTrackingFS,
  setTracking as setTrackingFS,
} from "./firestore-storage.js";

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
    pdfInner: () => $("#pdfInner"),
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

  async function getTracking() {
    return getTrackingFS();
  }

  async function setTracking(o) {
    return setTrackingFS(o || {});
  }

  function keyFor(q) {
    return `${q.test_id || "unknownTest"}-question${q.question_number}`;
  }

  function getStableQuestionId(q) {
    // Generate stable ID like tlQuestionKey in listening.js
    return (
      q?.question_ID ||
      q?.number_ID ||
      `${q?.test_id || "unknownTest"}-q${String(q?.question_number ?? "")
        .toString()
        .padStart(4, "0")}`
    );
  }

  async function readLifetime(q) {
    const t = await getTracking();
    const rec = t[keyFor(q)] || { correct: 0, wrong: 0 };
    const correct = Number(rec.correct || 0);
    const wrong = Number(rec.wrong || 0);
    return { correct, wrong, total: correct + wrong };
  }

  async function bumpLifetime(q, isCorrect) {
    const key = keyFor(q);
    const tracking = await getTracking();
    if (!tracking[key]) tracking[key] = { correct: 0, wrong: 0 };

    if (isCorrect) tracking[key].correct = Number(tracking[key].correct || 0) + 1;
    else tracking[key].wrong = Number(tracking[key].wrong || 0) + 1;

    tracking[key].lastAnswered = Date.now();
    await setTracking(tracking);
  }

  async function isUnansweredLifetime(q) {
    const lifetime = await readLifetime(q);
    return lifetime.total === 0;
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
    if (q.overall_question_number != null) return Number(q.overall_question_number);
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

  async function updateQuestionStats(q) {
    ensureQuestionStatsDOM();
    const node = els.qStats();
    if (!node) return;
    if (!q) {
      safeText(node, "");
      return;
    }
    const { correct, wrong, total } = await readLifetime(q);
    safeText(node, `: ✅ ${correct} | ❌ ${wrong} (total ${total})`);
  }

  async function updateDeservesButton() {
    const btn = els.deservesBtn();
    if (!btn) return;

    const count = await countDeservesAttentionForCurrentScope();
    btn.textContent = `📚 Deserves Attention (${count})`;
    btn.classList.toggle("quiz--toggled", !!state.deservesMode);
    btn.setAttribute("aria-pressed", state.deservesMode ? "true" : "false");
  }

  async function deservesFromTracking(q) {
    const { correct, wrong, total } = await readLifetime(q);
    if (total === 0) return false;
    return Math.abs(correct - wrong) < 2;
  }

  async function countDeservesAttentionForCurrentScope() {
    if (state.currentWeight == null) return 0;

    let pool = state.allData;
    if (state.currentWeight !== "all") {
      pool = pool.filter((q) => Number(q.weight_points) === Number(state.currentWeight));
    }
    const results = await Promise.all(pool.map(deservesFromTracking));
    return results.filter(Boolean).length;
  }

  async function recomputeFiltered() {
    if (!state.realTestMode && state.currentWeight == null) {
      state.filtered = [];
      return;
    }

    let items = state.allData.slice();

    if (!state.realTestMode) {
      if (state.currentWeight !== "all") {
        items = items.filter((q) => Number(q.weight_points) === Number(state.currentWeight));
      }
    }

    if (state.deservesMode) {
      const results = await Promise.all(items.map(deservesFromTracking));
      items = items.filter((_, i) => results[i]);
    } else if (state.onlyUnanswered) {
      const results = await Promise.all(items.map(isUnansweredLifetime));
      items = items.filter((_, i) => results[i]);
    }

    state.filtered = items;
  }

  async function showSelectWeightEmptyState() {
    els.emptyState()?.classList.remove(CLS.hidden);
    els.quiz()?.classList.add(CLS.hidden);

    safeText(els.qNumber(), "");
    safeText(els.qText(), "");

    if (els.pdfInner()) els.pdfInner().innerHTML = "";

    if (els.options()) els.options().innerHTML = "";
    els.confirmBtn()?.classList.add(CLS.hidden);
    safeText(els.score(), "");
    await updateQuestionStats(null);
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

  /* =====================
     6) PDF rendering (PDF.js CANVAS)
  ===================== */
  function ensurePdfJsWorker() {
    const lib = window.pdfjsLib;
    if (!lib) return false;

    if (!lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    }
    return true;
  }

  async function renderPdf(q) {
    const wrap = els.pdfInner();
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

    // If you have helper: storage path -> download URL
    if (!/^https?:\/\//i.test(url) && window.getFirebaseStorageUrl) {
      try {
        const storageUrl = await window.getFirebaseStorageUrl(url);
        if (storageUrl) url = storageUrl;
      } catch (err) {
        console.warn("Storage URL failed for PDF:", err);
      }
    }

    if (!ensurePdfJsWorker()) {
      wrap.textContent = "PDF.js not loaded.";
      return;
    }

    const loading = document.createElement("div");
    loading.style.cssText =
      "padding:10px 12px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;opacity:.75;font-weight:700;";
    loading.textContent = "Loading page…";
    wrap.appendChild(loading);

    const renderToCanvas = async () => {
      if (myToken !== pdfRenderToken) return;
      if (activePdfRenderController.signal.aborted) return;

      wrap.innerHTML = "";

      const canvas = document.createElement("canvas");
      canvas.className = "quiz--pdf-canvas";
      wrap.appendChild(canvas);

      const lib = window.pdfjsLib;

      const task = lib.getDocument({
        url,
        disableStream: true,
        disableAutoFetch: true,
      });

      const pdf = await task.promise;
      if (activePdfRenderController.signal.aborted) {
        try {
          await pdf.destroy();
        } catch {}
        return;
      }

      const page = await pdf.getPage(1);

      const containerWidth = wrap.clientWidth || 800;
      const viewport1 = page.getViewport({ scale: 1 });

      const scale = containerWidth / viewport1.width;
      const viewport = page.getViewport({ scale });

      const ctx = canvas.getContext("2d", { alpha: false });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);

      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;

      await page.render({ canvasContext: ctx, viewport }).promise;

      try {
        await pdf.destroy();
      } catch {}
    };

    try {
      await renderToCanvas();
    } catch (err) {
      if (myToken !== pdfRenderToken) return;
      console.error("PDF render failed:", err);
      wrap.innerHTML = "";
      wrap.textContent = "Failed to render PDF.";
      return;
    }

    const onResize = () => {
      if (activePdfRenderController.signal.aborted) return;
      clearTimeout(renderPdf._t);
      renderPdf._t = setTimeout(() => {
        renderToCanvas().catch(() => {});
      }, 120);
    };

    window.removeEventListener("resize", renderPdf._resizeHandler);
    renderPdf._resizeHandler = onResize;
    window.addEventListener("resize", onResize);

    activePdfRenderController.signal.addEventListener("abort", () => {
      window.removeEventListener("resize", onResize);
    });
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

    if (confirmBtn) confirmBtn.onclick = async () => {
      try {
        await confirmAnswer(q);
      } catch (err) {
        console.error("Error confirming answer:", err);
      }
    };
  }

  function updateScore() {
    if (state.realTestMode) {
      safeText(els.score(), "");
      return;
    }
    safeText(
      els.score(),
      `✅ ${state.score} correct out of ${state.answered} answered.`
    );
  }

  /* =====================
     8) Render Question
  ===================== */
  async function renderQuestion() {
    ensureQuestionStatsDOM();

    if (!state.realTestMode && state.currentWeight == null) {
      await showSelectWeightEmptyState();
      return;
    }

    const q = state.filtered[state.index];
    state.currentQuestion = q || null;

    if (!q) {
      await showSelectWeightEmptyState();
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
    await updateQuestionStats(q);
  }

  /* =====================
     9) Confirm Answer
  ===================== */
  async function confirmAnswer(q) {
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

    // ✅ Show UI feedback immediately (non-blocking)
    state.selectedOptionIndex = null;
    els.confirmBtn()?.classList.add(CLS.hidden);

    renderOptions(q, true, correctIndex);

    updateScore();
    updateQuestionStats(q);
    
    // ✅ Run database writes in background without blocking UI
    bumpLifetime(q, isCorrect).catch(err => {
      console.error("Failed to save answer to database:", err);
    });
    
    // ✅ Log to Firestore (non-blocking)
    if (window.dbService && window.dbService.logQuestionResponse) {
      const selectedLetter = q.alternatives?.[q.userAnswerIndex]?.letter || "";
      window.dbService.logQuestionResponse({
        questionId: getStableQuestionId(q),
        questionType: "reading",
        testId: q.test_id || null,
        questionNumber: q.question_number || q.overall_question_number?.toString() || "",
        weight: q.weight_points || 0,
        selectedOption: selectedLetter,
        isCorrect: isCorrect,
      }).catch(err => {
        console.warn("Failed to log reading response to Firestore:", err);
      });
    }
  }

  /* =====================
     10) Navigation
  ===================== */
  async function nextQuestion() {
    if (!state.filtered.length) return;
    if (state.index < state.filtered.length - 1) state.index++;

    await renderQuestion();
    if (state.realTestMode) renderRealTestDots();
  }

  async function prevQuestion() {
    if (!state.filtered.length) return;
    if (state.index > 0) state.index--;
    await renderQuestion();
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
            `.${CLS.weightBtn}[data-weight="${state.currentWeight}"]`
          );
    selectedBtn?.classList.add(CLS.selectedWeight);

    await recomputeFiltered();

    if (!state.realTestMode && state.currentWeight == null) {
      await showSelectWeightEmptyState();
      await updateDeservesButton();
      return;
    }

    hideEmptyState();

    shuffle(state.filtered);
    state.index = 0;
    state.score = 0;
    state.answered = 0;

    els.quiz()?.classList.remove(CLS.hidden);
    await renderQuestion();
    await updateDeservesButton();
  }

  async function toggleDeserves() {
    state.deservesMode = !state.deservesMode;

    if (state.deservesMode) {
      state.onlyUnanswered = false;
      const chk = els.onlyChk();
      if (chk) chk.checked = false;
    }

    await recomputeFiltered();
    shuffle(state.filtered);

    state.index = 0;
    state.score = 0;
    state.answered = 0;

    if (!state.realTestMode && state.currentWeight == null) {
      await showSelectWeightEmptyState();
      await updateDeservesButton();
      return;
    }

    hideEmptyState();
    els.quiz()?.classList.remove(CLS.hidden);
    await renderQuestion();
    await updateDeservesButton();
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

      dot.addEventListener("click", async () => {
        state.index = i;
        await renderQuestion();
        renderRealTestDots();
      });

      nav.appendChild(dot);
    });
  }

  async function startRealTest() {
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

    await renderQuestion();
    renderRealTestDots();
  }

  async function finishRealTest() {
    state.realTestFinished = true;
    state.realTestMode = false;

    setUiLocked(false);

    document.getElementById("realTestContainer")?.classList.add(CLS.hidden);

    state.currentWeight = null;
    state.filtered = [];
    state.index = 0;

    await showSelectWeightEmptyState();
    await updateDeservesButton();
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

    document.getElementById("rtClose")?.addEventListener("click", closeRealTestOverlay);
    document.getElementById("rtBackdrop")?.addEventListener("click", closeRealTestOverlay);

    document.getElementById("startRealTestBtn")?.addEventListener("click", startRealTest);
    document.getElementById("finishRealTestBtn")?.addEventListener("click", finishRealTest);

    els.onlyChk()?.addEventListener("click", async (e) => {
      state.onlyUnanswered = !!e.target.checked;

      if (state.onlyUnanswered) state.deservesMode = false;

      await updateDeservesButton();
      await recomputeFiltered();

      if (!state.realTestMode && state.currentWeight == null) {
        await showSelectWeightEmptyState();
        return;
      }

      shuffle(state.filtered);
      state.index = 0;
      state.score = 0;
      state.answered = 0;
      await renderQuestion();
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

    await recomputeFiltered();
    await showSelectWeightEmptyState();
    await updateDeservesButton();
  }

  window.filterQuestions = filterQuestions;
  window.nextQuestion = nextQuestion;
  window.prevQuestion = prevQuestion;

  init();
})();
