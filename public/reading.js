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
    realTestPool: [],
    realTestCircles: [],

    // For Copy button
    currentQuestion: null,

    // ✅ Subscription state
    userSubscription: null,
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
      `${q?.test_id || "unknownTest"}-q${String(q?.question_number || 0).padStart(4, "0")}`
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

  function getAlternativeLetter(alternative, index) {
    // If alternative is an object with letter property, use it
    if (alternative?.letter) {
      return alternative.letter;
    }
    // If alternative is a string starting with a letter (like "A Compléter..."), extract it
    if (typeof alternative === "string") {
      const match = alternative.match(/^([A-F])\s/);
      if (match) return match[1];
    }
    // Default: derive from index
    return deriveLetters(index);
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

  function updateKpiVisibility() {
    const kpis = document.querySelectorAll(".quiz--kpi");
    const questionNumber = document.getElementById("questionNumber");
    const scoreElement = document.getElementById("score");
    const questionStats = document.getElementById("questionStats");
    
    if (state.realTestMode && !state.realTestFinished) {
      // Hide during real test (not when viewing results)
      kpis.forEach((kpi) => kpi.classList.add(CLS.hidden));
      if (questionNumber) questionNumber.classList.add(CLS.hidden);
      if (scoreElement) scoreElement.classList.add(CLS.hidden);
      if (questionStats) questionStats.classList.add(CLS.hidden);
    } else if (state.realTestMode && state.realTestFinished) {
      // Keep hidden when viewing results
      kpis.forEach((kpi) => kpi.classList.add(CLS.hidden));
      if (questionNumber) questionNumber.classList.add(CLS.hidden);
      if (scoreElement) scoreElement.classList.add(CLS.hidden);
      if (questionStats) questionStats.classList.add(CLS.hidden);
    } else {
      // Show in practice mode
      kpis.forEach((kpi) => kpi.classList.remove(CLS.hidden));
      if (questionNumber) questionNumber.classList.remove(CLS.hidden);
      if (scoreElement) scoreElement.classList.remove(CLS.hidden);
      if (questionStats) questionStats.classList.remove(CLS.hidden);
    }
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
    updateKpiVisibility();
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

    // ✅ Track usage for subscription system (only in practice mode, not Real Tests)
    if (!state.realTestMode) {
      trackReadingUsage().catch(err => {
        console.error("Failed to track reading usage:", err);
      });
    }

    // ✅ Show UI feedback immediately (non-blocking)
    state.selectedOptionIndex = null;
    els.confirmBtn()?.classList.add(CLS.hidden);

    renderOptions(q, true, correctIndex);

    updateScore();
    updateQuestionStats(q);

    // ✅ Update dots and auto-jump in Real Test mode
    if (state.realTestMode) {
      updateFinishButtonState();
      
      if (!state.realTestFinished) {
        const nextIdx = rtFindNextUnanswered(state.index);
        if (nextIdx != null) {
          state.index = nextIdx;
          await renderQuestion();
          renderRealTestDots();  // ✅ Called AFTER state.index is updated
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          await renderQuestion();
          renderRealTestDots();  // ✅ Called AFTER renderQuestion
        }
      } else {
        renderRealTestDots();  // ✅ Update dots when test is finished
      }
    }
    
    updateKpiVisibility();
    
    // ✅ Run database writes in background without blocking UI
    bumpLifetime(q, isCorrect).catch(err => {
      console.error("Failed to save answer to database:", err);
    });
    
    // ✅ Log to Firestore (non-blocking)
    if (window.dbService && window.dbService.logQuestionResponse) {
      const selectedLetter = getAlternativeLetter(q.alternatives?.[q.userAnswerIndex], q.userAnswerIndex);
      window.dbService.logQuestionResponse({
        questionId: getStableQuestionId(q) || `reading-q${state.index}`,
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

  function rtFindNextUnanswered(fromIndex) {
    const n = state.filtered.length;
    if (!n) return null;
    for (let step = 1; step <= n; step++) {
      const idx = (fromIndex + step) % n;
      if (state.filtered[idx]?.userAnswerIndex == null) return idx;
    }
    return null;
  }

  function updateFinishButtonState() {
    const btn = document.getElementById("finishRealTestBtn");
    if (!btn) return;

    if (!state.realTestMode || state.realTestFinished) {
      btn.classList.remove("quiz--finish-ready");
      return;
    }

    const missing = state.filtered.filter(
      (q) => q.userAnswerIndex == null,
    ).length;

    if (missing === 0) btn.classList.add("quiz--finish-ready");
    else btn.classList.remove("quiz--finish-ready");
  }

  /* =====================
     10) Navigation
  ===================== */
  async function nextQuestion() {
    if (!state.filtered.length) return;
    if (state.index < state.filtered.length - 1) state.index++;

    await renderQuestion();
    if (state.realTestMode) {
      renderRealTestDots();
      updateKpiVisibility();
    }
  }

  async function prevQuestion() {
    if (!state.filtered.length) return;
    if (state.index > 0) state.index--;
    await renderQuestion();
    if (state.realTestMode) {
      renderRealTestDots();
      updateKpiVisibility();
    }
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
    startBtn.style.display = ""; // ✅ Reset display in case it was hidden by showOverlay("score")

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

  function showOverlay(mode = "prepare") {
    const textEl = document.getElementById("rtLoadingText");
    const startBtn = document.getElementById("startRealTestBtn");
    const overlay = document.getElementById("realTestLoading");

    overlay?.classList.remove(CLS.hidden);
    overlay?.classList.remove("quiz--rt-ready");

    if (textEl) {
      textEl.textContent = mode === "score" ? "Scoring test…" : "Preparing Test...";
      textEl.classList.remove("quiz--fade-out", "quiz--fade-in");
      textEl.classList.add("quiz--loading-flash");
    }

    if (startBtn) {
      if (mode === "score") {
        startBtn.style.display = "none";
        startBtn.disabled = true;
        startBtn.classList.remove("quiz--ready");
      } else {
        startBtn.style.display = "";
        startBtn.disabled = true;
        startBtn.classList.remove("quiz--ready");
      }
    }
  }

  function hideOverlay() {
    const overlay = document.getElementById("realTestLoading");
    overlay?.classList.add(CLS.hidden);
  }

  const REAL_TEST_COUNTS = Object.freeze({
    3: 4,    // Questions 1-4
    9: 6,    // Questions 5-10
    15: 9,   // Questions 11-19
    21: 10,  // Questions 20-29
    26: 6,   // Questions 30-35
    33: 4,   // Questions 36-39
  });

  function pickRandomByWeight(weight, count) {
    const pool = state.allData.filter(
      (q) => Number(q.weight_points) === Number(weight),
    );
    const bag = pool.slice();
    shuffle(bag);
    const out = [];
    while (out.length < count) {
      if (!bag.length) {
        shuffle(pool);
        bag.push(...pool);
      }
      out.push(bag.pop());
    }
    return out;
  }

  function buildRealTestSet() {
    const seq = [];
    for (const [wStr, cnt] of Object.entries(REAL_TEST_COUNTS)) {
      seq.push(...pickRandomByWeight(Number(wStr), cnt));
    }
    seq.forEach((q, i) => {
      q.overall_question_number = i + 1;
      q.userAnswerIndex = undefined;
    });
    return seq;
  }

  function renderRealTestDots() {
    const nav = document.getElementById("questionNav");
    if (!nav) return;

    // Create dots if not created
    if (state.realTestCircles.length === 0) {
      nav.innerHTML = "";
      state.realTestCircles = [];
      
      state.filtered.forEach((q, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "quiz--qdot";
        dot.textContent = String(i + 1);
        dot.title = `Question ${i + 1}`;

        dot.addEventListener("click", async () => {
          try {
            if (!state.realTestFinished) {
              state.index = i;
              await renderQuestion();
              renderRealTestDots();
              updateFinishButtonState();
              updateKpiVisibility();
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              // When test is finished, scroll to review question
              const target = document.getElementById(`qsec-${i + 1}`);
              if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }
          } catch (err) {
            console.error("Error in dot navigation:", err);
          }
        });

        nav.appendChild(dot);
        state.realTestCircles.push(dot);
      });
    }

    // Update dot styling
    const answeredSet = new Set(
      state.filtered
        .map((q, i) => (q.userAnswerIndex != null ? i : null))
        .filter((x) => x != null),
    );

    state.realTestCircles.forEach((dot, i) => {
      dot.style.opacity = "1";
      dot.style.background =
        answeredSet.has(i) && !state.realTestFinished ? "#dedede" : "#fff";

      if (i === state.index && !state.realTestFinished) {
        dot.classList.add("quiz--active");
        dot.style.outline = "2px solid #2196f3";
      } else {
        dot.classList.remove("quiz--active");
        dot.style.outline = "none";
      }

      if (state.realTestFinished) {
        const q = state.filtered[i];
        const correctIndex =
          typeof q.correct_index === "number"
            ? Number(q.correct_index)
            : q.alternatives.findIndex((a) => a?.is_correct === true);
        const correct = q.userAnswerIndex === correctIndex;
        dot.style.background = correct ? "#d4edda" : "#f8d7da";
        dot.style.borderColor = correct ? "#28a745" : "#dc3545";
      }
    });
  }

  async function startRealTest() {
    closeRealTestOverlay();

    state.realTestMode = true;
    state.realTestFinished = false;
    state.deservesMode = false;
    state.onlyUnanswered = false;
    state.currentWeight = "all";
    state.realTestCircles = [];

    setUiLocked(true);
    updateKpiVisibility();

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
    updateFinishButtonState();
  }

  async function finishRealTest() {
    const missing = state.filtered.filter(
      (q) => q.userAnswerIndex == null,
    ).length;

    if (
      missing > 0 &&
      !confirm(
        `You still have ${missing} unanswered question(s). Finish anyway?`,
      )
    )
      return;

    showOverlay("score");

    setTimeout(async () => {
      hideOverlay();
      state.realTestFinished = true;
      setUiLocked(false);
      
      // Render results page
      await renderResults();
      
      renderRealTestDots();
      updateFinishButtonState();
      updateKpiVisibility();
    }, 700);
  }

  const CLB_RANGES = [
    { clb: 4, min: 331, max: 368, band: "A1" },
    { clb: 5, min: 369, max: 397, band: "A2" },
    { clb: 6, min: 398, max: 457, band: "B1" },
    { clb: 7, min: 458, max: 502, band: "B2" },
    { clb: 8, min: 503, max: 522, band: "B2" },
    { clb: 9, min: 523, max: 548, band: "C1" },
    { clb: 10, min: 549, max: 699, band: "C2" },
  ];

  function clbForScore(score) {
    if (score < 331) return { clb: 4, band: "A1", notReached: true };
    return (
      CLB_RANGES.find((r) => score >= r.min && score <= r.max) || {
        clb: 10,
        band: "C2",
      }
    );
  }

  function cefrForCLB(clb) {
    if (clb <= 4) return "A1";
    if (clb === 5) return "A2";
    if (clb === 6) return "B1";
    if (clb === 7 || clb === 8) return "B2";
    if (clb === 9) return "C1";
    return "C2";
  }

  async function renderResults() {
    // ✅ Hide real test controls, but keep quiz visible for navigation
    document.getElementById("realTestContainer")?.classList.add(CLS.hidden);
    // ✅ Keep quiz visible so users can see their answers
    // els.quiz()?.classList.add(CLS.hidden); // REMOVED - quiz stays visible
    document.getElementById("realTestResults")?.classList.remove(CLS.hidden);

    // ✅ Hide KPI elements in results page
    const kpis = document.querySelectorAll(".quiz--kpi");
    kpis.forEach((kpi) => kpi.classList.add(CLS.hidden));
    
    // ✅ Also hide specific elements by ID
    const questionNumber = document.getElementById("questionNumber");
    const scoreElement = document.getElementById("score");
    const kpiBox = document.getElementById("kpiBox");
    if (questionNumber) questionNumber.classList.add(CLS.hidden);
    if (scoreElement) scoreElement.classList.add(CLS.hidden);
    if (kpiBox) kpiBox.classList.add(CLS.hidden);

    // Calculate scores
    let totalCorrect = 0;
    let weightedScore = 0;
    const detailedResults = [];
    
    state.filtered.forEach((q, i) => {
      const correctIndex =
        typeof q.correct_index === "number"
          ? Number(q.correct_index)
          : q.alternatives.findIndex((a) => a?.is_correct === true);
      const isCorrect = q.userAnswerIndex === correctIndex;
      
      if (isCorrect) {
        totalCorrect++;
        weightedScore += Number(q.weight_points) || 0;
      }
      
      const userAnswerLetter = q.userAnswerIndex !== undefined 
        ? getAlternativeLetter(q.alternatives?.[q.userAnswerIndex], q.userAnswerIndex)
        : null;
      const correctAnswerLetter = correctIndex >= 0 
        ? getAlternativeLetter(q.alternatives?.[correctIndex], correctIndex)
        : null;
      
      detailedResults.push({
        questionNumber: i + 1,
        questionId: getStableQuestionId(q) || `reading-q${i + 1}`,
        weight: q.weight_points || 0,
        userAnswer: userAnswerLetter,
        correctAnswer: correctAnswerLetter,
        isCorrect: isCorrect,
      });
    });
    
    const pct = (totalCorrect / state.filtered.length) * 100;
    const clbObj = clbForScore(weightedScore);
    const clb = clbObj.clb;
    const band = cefrForCLB(clb);

    // Save test result to database
    if (window.dbService?.saveTestResult) {
      window.dbService.saveTestResult({
        testType: "reading",
        testId: `reading-test-${Date.now()}`,
        correctAnswers: totalCorrect,
        totalQuestions: state.filtered.length,
        clbScore: clb,
        detailedResults: detailedResults,
        timeSpent: null,
      }).catch(err => {
        console.error("Failed to save reading test result:", err);
      });
    }

    // Results header
    const pctValue = Number(pct) || 0;
    let badgeStyle = "font-size:1.25rem;font-weight:800;";
    if (pctValue <= 30) {
      badgeStyle +=
        "color:#991b1b;background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.35);";
    } else if (pctValue <= 69) {
      badgeStyle +=
        "color:#92400e;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.40);";
    } else {
      badgeStyle +=
        "color:#065f46;background:rgba(16,185,129,.18);border:1px solid rgba(16,185,129,.40);";
    }
    badgeStyle += "display:inline-block;padding:6px 10px;border-radius:999px;";

    const resultsHeader = document.getElementById("resultsHeader");
    if (resultsHeader) {
      resultsHeader.innerHTML = `
        <div class="quiz--results-badge" style="${badgeStyle}">${pctValue.toFixed(2)}%</div>
        <div class="quiz--results-sub" style="margin-top:6px">
          Score: ${weightedScore} /699
          <span class="quiz--band-pill" style="border:1px solid #333;border-radius:12px;padding:2px 8px;margin-left:6px; background: rgba(16,185,129,.40);">
            <strong>${band}</strong>
          </span>
        </div>
        <div class="quiz--results-sub" style="margin-top:4px">
          Correct: ${totalCorrect} /${state.filtered.length}
        </div>
      `;
    }

    // CLB table
    const rows = CLB_RANGES.map((r) => {
      const active = Number(r.clb) === Number(clb);
      return `
        <div class="quiz--clb-row ${active ? "quiz--clb-active" : ""}">
          <div>CLB ${r.clb} <span style="opacity:.7">(${r.band})</span></div>
          <div style="opacity:.85">${r.min}–${r.max}</div>
        </div>
      `;
    }).join("");

    const clbTable = document.getElementById("clbTable");
    if (clbTable) {
      clbTable.innerHTML = `
        <div style="margin-top:1px;font-weight:600">CLB Bands</div>
        <div style="margin-top:8px">${rows}</div>
      `;
    }

    // Overview dots
    const dots = state.filtered
      .map((q, i) => {
        const correctIndex =
          typeof q.correct_index === "number"
            ? Number(q.correct_index)
            : q.alternatives.findIndex((a) => a?.is_correct === true);
        const ok = q.userAnswerIndex === correctIndex;
        return `<span title="Q${i + 1}" style="
          display:inline-block;width:12px;height:12px;border-radius:999px;
          margin:4px;background:${ok ? "#10b981" : "#ef4444"};
        "></span>`;
      })
      .join("");

    const resultsDots = document.getElementById("resultsDots");
    if (resultsDots) {
      resultsDots.innerHTML = `
        <div style="margin-top:14px;font-weight:600; font-size: 16px;">Overview</div>
        <div style="margin-top:8px;line-height:0">${dots}</div>
      `;
    }

    // Review section
    const reviewHtml = state.filtered
      .map((q, i) => {
        const correctIndex =
          typeof q.correct_index === "number"
            ? Number(q.correct_index)
            : q.alternatives.findIndex((a) => a?.is_correct === true);
        const ua = q.userAnswerIndex;
        const ok = ua === correctIndex;

        const alts = q.alternatives
          .map((a, idx) => {
            const letter = a?.letter || deriveLetters(idx);
            const isC = idx === correctIndex;
            const isU = idx === ua;
            // Handle both string alternatives and object alternatives
            const text = typeof a === "string" ? a : (a?.text ?? "");
            const clean = String(text || "")
              .replace(/\s*✅/g, "")
              .replace(/^[A-F]\s*[-.)]?\s*/i, "")
              .trim();
            return `
              <div style="
                padding:6px 10px;border-radius:10px;margin:6px 0;
                border:1px solid #e5e7eb;
                background:${isC ? "rgba(16,185,129,.10)" : isU ? "rgba(239,68,68,.10)" : "#fff"};
                font-weight:${isC ? "601" : "600"};
              ">
                ${letter}. ${clean}
                ${isC ? " <span style='margin-left:6px;font-size:.85rem;opacity:.85'>✅ correct</span>" : ""}
                ${isU && !isC ? " <span style='margin-left:6px;font-size:.85rem;opacity:.85'>❌ your answer</span>" : ""}
              </div>
            `;
          })
          .join("");

        return `
          <section id="qsec-${i + 1}" style="
            margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;
            box-shadow:0 10px 30px rgba(0,0,0,.06);
          ">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
              <button
                type="button"
                class="quiz--btn quiz--pill"
                data-goto-question="${i}"
                style="font-weight:600;cursor:pointer;padding:8px 14px"
              >
                Question ${i + 1}
              </button>
              <div style="font-weight:800; color:${ok ? "#10b981" : "#ef4444"}">
                ${ok ? "Correct" : "Wrong"}
              </div>
            </div>

            <div style="margin-top:10px">${alts}</div>
          </section>
        `;
      })
      .join("");

    const allQuestionsReview = document.getElementById("allQuestionsReview");
    if (allQuestionsReview) {
      allQuestionsReview.innerHTML = `
        <div style="margin-top:18px;font-weight:800;font-size:1.10rem">Review</div>
        ${reviewHtml}
      `;

      // ✅ Add click handlers for "Question X" buttons
      const gotoButtons = allQuestionsReview.querySelectorAll("[data-goto-question]");
      gotoButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
          const targetIndex = parseInt(btn.getAttribute("data-goto-question"), 10);
          if (isNaN(targetIndex)) return;

          state.index = targetIndex;
          await renderQuestion();
          renderRealTestDots();

          // Scroll to quiz container
          const quiz = document.getElementById("quiz");
          if (quiz) {
            quiz.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
  }
  


  /* ============================================================================
     SUBSCRIPTION TIER MANAGEMENT
     ============================================================================ */
  
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
      state.userSubscription = userData;
      console.log('✅ Subscription initialized:', userData?.tier || 'unknown');
    } catch (error) {
      console.error('Error initializing subscription:', error);
    }
  }

  /**
   * Check if user has access to reading practice
   * Shows upgrade modal if limit reached
   */
  async function checkReadingAccess() {
    const user = window.AuthService?.getCurrentUser();
    if (!user) {
      console.log('No user logged in');
      return true; // Allow access when not logged in (or redirect to login)
    }

    if (!window.SubscriptionService || !state.userSubscription) {
      console.warn('Subscription service not initialized');
      return true; // Fail open
    }

    const canAccess = window.SubscriptionService.canAccess('reading', state.userSubscription);
    
    if (!canAccess) {
      const remaining = window.SubscriptionService.getRemainingUsage(state.userSubscription);
      window.SubscriptionService.showUpgradeModal(
        `You've used all ${15} free reading questions! Keep enjoying SimpleTCF by selecting a plan.`
      );
      
      // Hide main quiz content
      els.quiz()?.classList.add(CLS.hidden);
      
      return false;
    }

    return true;
  }

  /**
   * Increment usage counter after answering a question
   */
  async function trackReadingUsage() {
    const user = window.AuthService?.getCurrentUser();
    if (!user || !window.SubscriptionService) return;

    // Only track for free tier users
    if (state.userSubscription?.tier === 'free') {
      try {
        await window.SubscriptionService.incrementUsage(user.uid, 'reading');
        console.log('✅ Reading usage incremented');
        
        // Refresh subscription data
        state.userSubscription = await window.SubscriptionService.getUserSubscriptionData(user.uid);
        
        // Check if limit reached after this answer
        const canAccessNext = window.SubscriptionService.canAccess('reading', state.userSubscription);
        if (!canAccessNext) {
          // Show modal after short delay to let user see result
          setTimeout(() => {
            window.SubscriptionService.showUpgradeModal(
              `You've reached your free reading question limit! Keep enjoying SimpleTCF by selecting a plan.`
            );
          }, 1500);
        }
      } catch (error) {
        console.error('Error tracking reading usage:', error);
      }
    }
  }

  /**
   * Apply tier-based restrictions to UI elements
   */
  function applyTierRestrictions() {
    if (!window.SubscriptionService || !state.userSubscription) return;

    const canAccessRealTests = window.SubscriptionService.canAccess('realTests', state.userSubscription);
    const canAccessDeserves = window.SubscriptionService.canAccess('deservesAttention', state.userSubscription);

    // Disable Real Test button for free and quick-study tiers
    const realTestBtn = els.realTestBtn();
    if (realTestBtn && !canAccessRealTests) {
      realTestBtn.classList.add('tier-disabled');
      realTestBtn.title = 'Upgrade to access Real Tests';
      realTestBtn.style.pointerEvents = 'none';
      realTestBtn.style.opacity = '0.5';
      realTestBtn.style.cursor = 'not-allowed';
    }

    // Disable Deserves Attention button for free and quick-study tiers
    const deservesBtn = els.deservesBtn();
    if (deservesBtn && !canAccessDeserves) {
      deservesBtn.classList.add('tier-disabled');
      deservesBtn.title = 'Upgrade to access Deserves Attention';
      deservesBtn.style.pointerEvents = 'none';
      deservesBtn.style.opacity = '0.5';
      deservesBtn.style.cursor = 'not-allowed';
    }
  }


  /* =====================
     12) Init
  ===================== */
  async function init() {
    // ✅ Initialize subscription service and check access
    await initializeSubscription();
    const hasAccess = await checkReadingAccess();
    if (!hasAccess) {
      return; // Blocked by subscription modal
    }

    await loadData();
    ensureQuestionStatsDOM();

    // ✅ Apply tier restrictions to UI
    applyTierRestrictions();

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
    document.getElementById("againBtn")?.addEventListener("click", async () => {
      // Reset and start new test
      document.getElementById("realTestResults")?.classList.add(CLS.hidden);
      state.realTestMode = false;
      state.realTestFinished = false;
      state.realTestCircles = [];
      
      // Open overlay and wait for user to click start
      openRealTestOverlay();
    });

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
