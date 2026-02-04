/* ============================================================================
   TCF Audio Practice — Full App Script (quiz-- class prefix edition)
   ✅ Includes:
   - Real Test: hide per-question stats line
   - Real Test: hide KPI pill (empty colored box)
   - Real Test: after ANY Confirm -> jump to next unanswered (wrap)
   - Finish Test button pulses green when all answered
   - Results page: highlight active CLB row (by CLB, works when score < 331)
   - Results page: hide top filters toolbar
   - Results page: move "Do another Real Test" button to top
   - Overlay: scoring shows ONLY spinner/text (no Start button)
   - ✅ Results Review cards: Audio player + Transcript toggle per question
   - ✅ Transcript button hidden during Real Test (taking test)
============================================================================ */

(() => {
  /* 1) Constants */
  const PATHS = Object.freeze({ DATA: "public/audios/all_quiz_data.json" });

  const STORAGE_KEYS = Object.freeze({
    TRACKING: "answer_tracking",
    EVENTS: "answer_events_v1",
  });

  const TL_KEY = "TCF Listening";

  const KEYS = Object.freeze({
    ENTER: "Enter",
    LEFT: "ArrowLeft",
    RIGHT: "ArrowRight",
  });

  const CLS = Object.freeze({
    hidden: "quiz--hidden",

    weightBtn: "quiz--weight-btn",
    selectedWeight: "quiz--selected-weight",
    toggled: "quiz--toggled",

    toolbar: "quiz--toolbar",

    option: "quiz--option",
    optionSelected: "quiz--selected",
    optionCorrect: "quiz--correct",
    optionIncorrect: "quiz--incorrect",

    transcript: "quiz--transcript",
    transcriptShowBtn: "quiz--show-btn",
    transcriptShowText: "quiz--show-text",

    qdot: "quiz--qdot",
    qdotActive: "quiz--active",

    btn: "quiz--btn",
    pill: "quiz--pill",

    // ✅ Finish button pulse when ready
    finishReady: "quiz--finish-ready",
  });

  /* 2) State */
  const state = {
    allData: [],
    filtered: [],
    index: 0,
    score: 0,
    answered: 0,
    selectedOptionIndex: null,
    onlyUnanswered: false,
    currentWeight: null,

    deservesMode: false,

    realTestMode: false,
    realTestFinished: false,
    realTestPool: [],
    realTestCircles: [],
  };

  /* 3) DOM helpers */
  const $ = (sel) => document.querySelector(sel);
  const els = {
    quiz: () => $("#quiz"),
    qNumber: () => $("#questionNumber"),
    picture: () => $("#pictureContainer"),
    audio: () => $("#audio"),
    options: () => $("#alternatives"),
    confirmBtn: () => $("#confirmBtn"),
    score: () => $("#score"),
    deservesBtn: () => $("#deservesBtn"),
    transcriptWrap: () => $("#transcriptContainer"),
    transcriptText: () => $("#transcriptContainer #transcriptText"),
    onlyChk: () => $("#onlyUnansweredChk"),
    qStats: () => $("#questionStats"),
  };

  const RT = {
    overlay: () => $("#realTestLoading"),
    loadingText: () => $("#rtLoadingText"),
    startBtn: () => $("#startRealTestBtn"),
    closeBtn: () => $("#rtClose"),
    backdrop: () => $("#rtBackdrop"),

    container: () => $("#realTestContainer"),
    nav: () => $("#questionNav"),
    finishBtn: () => $("#finishRealTestBtn"),

    results: () => $("#realTestResults"),
    resultsHeader: () => $("#resultsHeader"),
    clbTable: () => $("#clbTable"),
    resultsDots: () => $("#resultsDots"),
    review: () => $("#allQuestionsReview"),
    againBtn: () => $("#againBtn"),
    realTestBtn: () => $("#realTestBtn"),
  };

  /* 4) Utils & storage */
  const safeText = (node, text) => {
    if (node) node.textContent = (text ?? "").toString();
  };
  const deriveLetters = (i) => String.fromCharCode(65 + i);

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
    localStorage.setItem(STORAGE_KEYS.TRACKING, JSON.stringify(o || {}));
  }
  function getEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || "[]");
    } catch {
      return [];
    }
  }
  function setEvents(a) {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(a || []));
  }

  function tlDefault() {
    return { answers: {}, tests: { count: 0, items: [] } };
  }
  function tlGet() {
    try {
      const raw = localStorage.getItem(TL_KEY);
      if (!raw) return tlDefault();
      const obj = JSON.parse(raw);
      if (!obj.answers) obj.answers = {};
      if (!obj.tests) obj.tests = { count: 0, items: [] };
      if (typeof obj.tests.count !== "number")
        obj.tests.count = Number(obj.tests.count || 0);
      if (!Array.isArray(obj.tests.items)) obj.tests.items = [];
      return obj;
    } catch {
      return tlDefault();
    }
  }
  function tlSet(obj) {
    try {
      localStorage.setItem(TL_KEY, JSON.stringify(obj || tlDefault()));
    } catch {}
  }
  function tlQuestionKey(q) {
    return (
      q?.question_ID ||
      q?.number_ID ||
      `${q?.test_id || "unknownTest"}-q${String(q?.question_number ?? "")
        .toString()
        .padStart(4, "0")}`
    );
  }
  function tlReadAnswer(q) {
    const key = tlQuestionKey(q);
    return tlGet().answers[key] || { correct: 0, wrong: 0, lastAnswered: 0 };
  }
  function tlBumpAnswer(q, isCorrect) {
    const store = tlGet();
    const key = tlQuestionKey(q);
    const rec = store.answers[key] || { correct: 0, wrong: 0, lastAnswered: 0 };
    if (isCorrect) rec.correct++;
    else rec.wrong++;
    rec.lastAnswered = Date.now();
    store.answers[key] = rec;
    tlSet(store);
  }
  function tlRecordTest({ weightedScore, pct, clb, band, totalCorrect }) {
    const store = tlGet();
    const next = (store.tests.count || 0) + 1;
    const entry = {
      number: next,
      date: Date.now(),
      weightedScore,
      pct: Number(pct.toFixed ? pct.toFixed(2) : pct),
      clb,
      band,
      totalCorrect,
    };
    store.tests.count = next;
    store.tests.items.push(entry);
    tlSet(store);
  }

  function deservesFromTL(q) {
    const rec = tlReadAnswer(q);
    const total = (rec.correct || 0) + (rec.wrong || 0);
    if (total === 0) return false;
    return Math.abs((rec.correct || 0) - (rec.wrong || 0)) < 2;
  }

  function isPictureTrue(q) {
    const v = q?.is_picture;
    return v === true || v === "true" || v === 1 || v === "1";
  }
  function resolveImageSrc(q) {
    const p = q?.picture || q?.image || q?.picture_url;
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return p.startsWith("/") ? p : "/" + p.replace(/^(\.\/)+/, "");
  }
  function resolveAudioSrc(q) {
    if (!q) return null;
    if (q.audio_local_path)
      return q.audio_local_path.startsWith("/")
        ? q.audio_local_path
        : "/" + q.audio_local_path.replace(/^(\.\/)+/, "");
    if (q.audio_url) {
      const base = q.audio_url.split("/").pop() || "";
      if (base) return `/public/audios/${base}`;
    }
    if (q.filename) return `/public/audios/${q.filename}`;
    return null;
  }

  function fmt2or3(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n ?? "");
    const width = num > 99 ? 3 : 2;
    return String(num).padStart(width, "0");
  }
  function getHeaderNumber(q) {
    if (!q) return null;
    if (state.realTestMode) return state.index + 1;
    if (state.currentWeight == null && q.overall_question_number != null)
      return Number(q.overall_question_number);
    const raw = q.question_number;
    if (raw == null) return null;
    if (typeof raw === "string") {
      const m = raw.match(/(\d+)/);
      return m ? Number(m[1]) : null;
    }
    return Number(raw);
  }

  /* ===========================
     ✅ Hide KPI pill(s) during Real Test
     =========================== */
  function updateKpiVisibility() {
    const kpis = document.querySelectorAll(".quiz--kpi");
    kpis.forEach((kpi) => {
      if (state.realTestMode && !state.realTestFinished) {
        kpi.classList.add(CLS.hidden);
      } else {
        kpi.classList.remove(CLS.hidden);
      }
    });
  }

  /* ===========================
     ✅ Results mode: hide top filters on results page
     =========================== */
  function setResultsMode(on) {
    document.body.classList.toggle("quiz--results-mode", !!on);
  }

  function moveAgainButtonToTop() {
    const wrap = document.querySelector(".quiz--again-wrap");
    const header = RT.resultsHeader?.();
    if (!wrap || !header) return;
    header.insertAdjacentElement("afterend", wrap);
  }

  /* ===========================
     ✅ Transcript main button visibility (hide during Real Test)
     =========================== */
  function setTranscriptButtonVisible(visible) {
    const btn = document.getElementById("transcriptBtn");
    if (!btn) return;
    btn.classList.toggle(CLS.hidden, !visible);
  }

  /* ===========================
     ✅ Overlay (prepare vs score)
     =========================== */
  function showOverlay(mode = "prepare") {
    const textEl = RT.loadingText();
    const startBtn = RT.startBtn();
    const overlay = RT.overlay();

    overlay?.classList.remove(CLS.hidden);
    overlay?.classList.remove("quiz--rt-ready");

    if (textEl) {
      safeText(
        textEl,
        mode === "score" ? "Scoring test…" : "Preparing Test...",
      );
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
    RT.overlay()?.classList.add(CLS.hidden);
  }

  function stopSpinnerShowStart() {
    const textEl = RT.loadingText();
    const startBtn = RT.startBtn();
    const overlay = RT.overlay();
    if (!textEl || !startBtn || !overlay) return;

    startBtn.style.display = "";

    textEl.classList.remove("quiz--loading-flash");
    textEl.classList.add("quiz--fade-out");

    setTimeout(() => {
      safeText(textEl, "Test Ready");
      textEl.classList.remove("quiz--fade-out");
      textEl.classList.add("quiz--fade-in");

      overlay.classList.add("quiz--rt-ready");

      startBtn.disabled = false;
      startBtn.classList.add("quiz--ready");
    }, 350);
  }

  /* 5) Data */
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
    }
  }

  /* ===========================
     ✅ MOBILE LABELS
     =========================== */
  const COMPACT_MQ = window.matchMedia("(max-width: 520px)");

  function setBtnLabel(btn, label) {
    if (!btn) return;
    btn.textContent = label;
  }

  function applyCompactToolbarLabels() {
    const compact = !!COMPACT_MQ.matches;

    document.querySelectorAll(`.${CLS.weightBtn}`).forEach((btn) => {
      if (!btn.dataset.originalLabel) {
        btn.dataset.originalLabel = (btn.textContent || "").trim();
      }

      if (!compact) {
        btn.textContent = btn.dataset.originalLabel;
        return;
      }

      if (btn.dataset.all === "1") {
        setBtnLabel(btn, "All");
        return;
      }

      const w = Number(btn.dataset.weight || "");
      if (Number.isFinite(w)) {
        const two = String(w).padStart(2, "0");
        setBtnLabel(btn, `›${two}`);
      }
    });

    const d = els.deservesBtn();
    if (d) {
      if (!d.dataset.originalLabel)
        d.dataset.originalLabel = (d.textContent || "").trim();
      if (compact) {
        const m = (d.textContent || "").match(/\((\d+)\)/);
        const cnt = m ? m[1] : "0";
        d.textContent = `Deserve… (${cnt})`;
      }
    }

    const rt = RT.realTestBtn();
    if (rt) {
      if (!rt.dataset.originalLabel)
        rt.dataset.originalLabel = (rt.textContent || "").trim();
      if (compact) rt.textContent = "Real Test";
      else rt.textContent = rt.dataset.originalLabel || "🧪 Real Test";
    }
  }

  function ensureWeightButtonsOriginalLabels() {
    document.querySelectorAll(`.${CLS.weightBtn}`).forEach((btn) => {
      const seed = (btn.dataset.originalLabel || btn.textContent || "").trim();
      if (
        btn.dataset.all === "1" ||
        /^all$/i.test(seed) ||
        seed === "All Weights"
      ) {
        btn.dataset.all = "1";
        btn.dataset.originalLabel = "All Weights";
        btn.textContent = btn.dataset.originalLabel;
        return;
      }
      const m = seed.match(/Weight[-\s]?(\d+)/i);
      if (m) {
        const w = Number(m[1]);
        btn.dataset.weight = String(w);
        btn.dataset.originalLabel = `Weight-${String(w).padStart(2, "0")}`;
        btn.textContent = btn.dataset.originalLabel;
      }
    });
  }

  function refreshWeightButtonsLabels() {
    ensureWeightButtonsOriginalLabels();
    applyCompactToolbarLabels();
  }

  async function ensureDataLoaded() {
    if (!state.allData.length) await loadData();
  }

  async function filterQuestions(weightOrAll) {
    if (state.realTestMode && state.realTestFinished) {
      if (
        !confirm(
          "You are viewing Real Test results. Do you want to leave the results page?",
        )
      )
        return;
      exitRealTest();
    }

    await ensureDataLoaded();

    state.currentWeight =
      weightOrAll === "all" || weightOrAll == null ? null : Number(weightOrAll);

    document
      .querySelectorAll(`.${CLS.weightBtn}`)
      .forEach((btn) => btn.classList.remove(CLS.selectedWeight));

    const selectedBtn =
      state.currentWeight == null
        ? document.querySelector(`.${CLS.weightBtn}[data-all="1"]`)
        : Array.from(document.querySelectorAll(`.${CLS.weightBtn}`)).find(
            (btn) => Number(btn.dataset.weight) === state.currentWeight,
          );

    selectedBtn?.classList.add(CLS.selectedWeight);

    recomputeFiltered();
    shuffle(state.filtered);
    state.index = 0;
    state.score = 0;
    state.answered = 0;

    els.quiz()?.classList.remove(CLS.hidden);
    renderQuestion();
    updateDeservesButton();
    refreshWeightButtonsLabels();
  }

  function countDeservesAttentionForCurrentScope() {
    let pool = state.allData;
    if (state.currentWeight != null) {
      pool = pool.filter(
        (q) => Number(q.weight_points) === Number(state.currentWeight),
      );
    }
    return pool.filter(deservesFromTL).length;
  }

  function updateDeservesButton() {
    const btn = els.deservesBtn();
    if (!btn) return;

    btn.textContent = `📚 Deserves Attention (${countDeservesAttentionForCurrentScope()})`;
    btn.classList.toggle(CLS.toggled, state.deservesMode);
    btn.setAttribute("aria-pressed", state.deservesMode ? "true" : "false");

    applyCompactToolbarLabels();
  }

  function toggleDeserves() {
    if (state.realTestMode && state.realTestFinished) {
      if (
        !confirm(
          "You are viewing Real Test results. Do you want to leave the results page?",
        )
      )
        return;
      exitRealTest();
    }
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
    renderQuestion();
    updateDeservesButton();
  }

  function recomputeFiltered() {
    let items = state.allData.slice();

    if (state.currentWeight != null) {
      items = items.filter(
        (q) => Number(q.weight_points) === Number(state.currentWeight),
      );
    }

    if (state.deservesMode) {
      items = items.filter(deservesFromTL);
    } else if (state.onlyUnanswered) {
      items = items.filter((q) => {
        const tl = tlReadAnswer(q);
        return (tl.correct || 0) + (tl.wrong || 0) === 0;
      });
    }

    state.filtered = items;
  }

  /* === Per-Question Stats DOM & Updater ============================== */
  function ensureQuestionStatsDOM() {
    if (els.qStats()) return;
    const anchor =
      els.qNumber() ||
      document.querySelector(`.${CLS.toolbar}`) ||
      document.body;
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

    if (state.realTestMode) {
      safeText(node, "");
      return;
    }

    if (!q) {
      safeText(node, "");
      return;
    }

    const tl = tlReadAnswer(q);
    const correct = Number(tl.correct || 0);
    const wrong = Number(tl.wrong || 0);
    const total = correct + wrong;

    safeText(node, `: ✅ ${correct} | ❌ ${wrong} (total ${total})`);
  }

  /* 7) Rendering */
  function renderPicture(q, displayNumStr) {
    const picWrap = els.picture();
    if (!picWrap) return;

    if (q.question_number >= 1 && q.question_number <= 10 && isPictureTrue(q)) {
      const imgSrc = resolveImageSrc(q);
      if (imgSrc) {
        const numForAlt = displayNumStr || fmt2or3(getHeaderNumber(q));
        picWrap.innerHTML = `<img src="${imgSrc}" alt="Question ${numForAlt} illustration" class="quiz--question-picture">`;
        picWrap.classList.remove(CLS.hidden);
        return;
      }
    }
    picWrap.classList.add(CLS.hidden);
    picWrap.innerHTML = "";
  }

  function renderAudio(q) {
    const audioEl = els.audio();
    if (!audioEl) return;
    audioEl.innerHTML = "";
    const src = resolveAudioSrc(q);
    if (src) {
      const s = document.createElement("source");
      s.src = src;
      s.type = src.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
      audioEl.appendChild(s);
      audioEl.src = src;
    }
    audioEl.load();
  }

  function renderOptions(q, alreadyAnswered, correctIndex) {
    const container = els.options();
    const confirmBtn = els.confirmBtn();
    if (!container) return;

    container.innerHTML = "";
    state.selectedOptionIndex = null;

    if (confirmBtn) confirmBtn.classList.add(CLS.hidden);

    q.alternatives.forEach((alt, i) => {
      const div = document.createElement("div");
      div.className = CLS.option;

      const letter = alt.letter || deriveLetters(i);
      div.textContent = `${letter}. ${alt.text}`;

      if (alreadyAnswered) {
        if (q.userAnswerIndex === i) div.classList.add(CLS.optionSelected);

        if (!state.realTestMode) {
          if (i === correctIndex) div.classList.add(CLS.optionCorrect);
          if (i === q.userAnswerIndex && i !== correctIndex)
            div.classList.add(CLS.optionIncorrect);
        }

        div.style.cursor = "default";
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

  function renderQuestion() {
    ensureQuestionStatsDOM();

    const q = state.filtered[state.index];
    const qNum = els.qNumber();
    const audioEl = els.audio();
    const transcriptWrap = els.transcriptWrap();

    if (!q) {
      const container = els.options();
      if (container)
        container.textContent =
          "📭 Select a weight to start, or no questions match the current filter.";

      safeText(qNum, "");
      try {
        audioEl.pause();
      } catch {}
      audioEl.removeAttribute("src");
      audioEl.innerHTML = "";
      audioEl.load();

      transcriptWrap?.classList.remove("quiz--show-btn", "quiz--show-text");
      safeText(els.transcriptText(), "");

      // hide transcript main button when no question
      setTranscriptButtonVisible(false);

      updateScore();
      updateQuestionStats(null);
      updateFinishButtonState();
      updateKpiVisibility();
      return;
    }

    const headerNum = getHeaderNumber(q);
    const qNumDisplayStr = fmt2or3(headerNum);
    safeText(qNum, `Question ${qNumDisplayStr}`);

    renderPicture(q, qNumDisplayStr);
    renderAudio(q);

    const alreadyAnswered = q.userAnswerIndex !== undefined;
    const correctIndex = q.alternatives.findIndex((a) => a.is_correct);

    // ✅ Transcript main button behavior
    if (state.realTestMode && !state.realTestFinished) {
      transcriptWrap?.classList.remove("quiz--show-btn", "quiz--show-text");
      safeText(els.transcriptText(), "");
      setTranscriptButtonVisible(false); // hide completely while taking test
    } else {
      if (alreadyAnswered) transcriptWrap?.classList.add("quiz--show-btn");
      else
        transcriptWrap?.classList.remove("quiz--show-btn", "quiz--show-text");
      safeText(els.transcriptText(), "");
      setTranscriptButtonVisible(!!alreadyAnswered);
    }

    renderOptions(q, alreadyAnswered, correctIndex);
    updateScore();
    updateQuestionStats(q);

    if (state.realTestMode) refreshNavDots();
    updateFinishButtonState();
    updateKpiVisibility();
  }

  /* 8) Tracking + events */
  function trackAnswerLocally(qObj, isCorrect) {
    const testId = qObj.test_id || "unknownTest";
    const questionNumber = qObj.question_number;
    const weight_points = qObj.weight_points;

    const key = `${testId}-question${questionNumber}`;
    const tracking = getTracking();
    if (!tracking[key]) tracking[key] = { correct: 0, wrong: 0 };
    isCorrect ? tracking[key].correct++ : tracking[key].wrong++;
    tracking[key].lastAnswered = Date.now();
    setTracking(tracking);

    const events = getEvents();
    events.push({
      ts: Date.now(),
      test_id: testId,
      question_number: questionNumber,
      question_weight: weight_points,
      weight: weight_points,
      correct: !!isCorrect,
    });
    if (events.length > 20000) events.splice(0, events.length - 20000);
    setEvents(events);

    tlBumpAnswer(qObj, !!isCorrect);
    updateDeservesButton();
  }

  function rtFindNextUnanswered(fromIndex) {
    const n = state.realTestPool.length;
    if (!n) return null;
    for (let step = 1; step <= n; step++) {
      const idx = (fromIndex + step) % n;
      if (state.realTestPool[idx]?.userAnswerIndex == null) return idx;
    }
    return null;
  }

  function updateFinishButtonState() {
    const btn = RT.finishBtn();
    if (!btn) return;

    if (!state.realTestMode || state.realTestFinished) {
      btn.classList.remove(CLS.finishReady);
      return;
    }

    const missing = state.realTestPool.filter(
      (q) => q.userAnswerIndex == null,
    ).length;

    if (missing === 0) btn.classList.add(CLS.finishReady);
    else btn.classList.remove(CLS.finishReady);
  }

  function confirmAnswer(q) {
    if (state.selectedOptionIndex === null) return;

    const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
    q.userAnswerIndex = state.selectedOptionIndex;

    const isCorrect = state.selectedOptionIndex === correctIndex;

    if (isCorrect) state.score++;
    state.answered++;

    trackAnswerLocally(q, isCorrect);

    state.selectedOptionIndex = null;
    els.confirmBtn()?.classList.add(CLS.hidden);

    refreshWeightButtonsLabels();

    // ✅ PRACTICE MODE: re-render so correct/wrong colors + transcript become available
    if (!state.realTestMode) {
      renderQuestion(); // <-- this is the missing piece
      return;
    }

    // ✅ REAL TEST MODE (keeps your existing behavior: jump to next unanswered)
    refreshNavDots();
    updateFinishButtonState();

    if (!state.realTestFinished) {
      const nextIdx = rtFindNextUnanswered(state.index);
      if (nextIdx != null) {
        state.index = nextIdx;
        renderQuestion();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        renderQuestion();
      }
    }

    updateKpiVisibility();
  }

  function nextQuestion() {
    if (state.index < state.filtered.length - 1) state.index++;
    renderQuestion();
  }
  function prevQuestion() {
    if (state.index > 0) {
      state.index--;
      renderQuestion();
    }
  }

  function loadTranscript() {
    const q = state.filtered[state.index];
    if (!q) return;

    const tWrap = els.transcriptWrap();

    if (state.realTestMode && !state.realTestFinished) {
      tWrap?.classList.remove("quiz--show-text");
      safeText(els.transcriptText(), "");
      return;
    }

    const has = q.transcript && q.transcript.trim() !== "";
    safeText(
      els.transcriptText(),
      has ? `📝 ${q.transcript}` : "⚠️ No transcript available.",
    );
    tWrap?.classList.add("quiz--show-text");
  }

  /* 9) Real Test */
  const REAL_TEST_COUNTS = Object.freeze({
    3: 4,
    9: 6,
    15: 9,
    21: 10,
    26: 6,
    33: 4,
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

  function buildRealTestPool() {
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

  function disableFiltersDuringRealTest(disabled) {
    const weightButtons = Array.from(
      document.querySelectorAll(`.${CLS.weightBtn}`),
    );
    weightButtons.forEach((btn) => {
      btn.classList.remove(CLS.selectedWeight);
      btn.disabled = !!disabled;
    });

    const deserves = els.deservesBtn();
    if (deserves) deserves.disabled = !!disabled;

    const chk = els.onlyChk();
    if (chk) {
      chk.checked = false;
      chk.disabled = !!disabled;
    }
  }

  let rtPrepareTimer = null;

  async function startRealTestFlow(opts = { skipConfirm: false }) {
    await ensureDataLoaded();

    if (state.realTestMode && state.realTestFinished && !opts.skipConfirm) {
      if (!confirm("Start a new Real Test and leave the current results?"))
        return;
      exitRealTest();
    }

    setResultsMode(false);

    RT.results()?.classList.add(CLS.hidden);
    RT.container()?.classList.add(CLS.hidden);
    els.quiz()?.classList.add(CLS.hidden);

    RT.resultsHeader().innerHTML = "";
    RT.clbTable().innerHTML = "";
    RT.resultsDots().innerHTML = "";
    RT.review().innerHTML = "";

    state.realTestMode = true;
    state.realTestFinished = false;
    state.deservesMode = false;
    updateDeservesButton();

    disableFiltersDuringRealTest(true);

    showOverlay("prepare");

    if (rtPrepareTimer) {
      clearTimeout(rtPrepareTimer);
      rtPrepareTimer = null;
    }

    rtPrepareTimer = setTimeout(() => {
      state.realTestPool = buildRealTestPool();
      state.filtered = state.realTestPool.slice();
      state.index = 0;
      state.score = 0;
      state.answered = 0;

      stopSpinnerShowStart();
      rtPrepareTimer = null;
    }, 3000);
  }

  function beginRealTest() {
    hideOverlay();
    RT.container()?.classList.remove(CLS.hidden);
    els.quiz()?.classList.remove(CLS.hidden);
    buildNavDots();
    renderQuestion();
    updateFinishButtonState();
    updateKpiVisibility();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildNavDots() {
    const wrap = RT.nav();
    if (!wrap) return;

    wrap.innerHTML = "";
    state.realTestCircles = [];

    for (let i = 0; i < state.realTestPool.length; i++) {
      const dot = document.createElement("div");
      dot.className = CLS.qdot;
      dot.textContent = String(i + 1);
      dot.dataset.index = String(i);

      dot.addEventListener("click", () => {
        if (!state.realTestFinished) {
          state.index = i;
          renderQuestion();
          refreshNavDots();
          updateFinishButtonState();
          updateKpiVisibility();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          const target = document.getElementById(`qsec-${i + 1}`);
          if (target)
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

      wrap.appendChild(dot);
      state.realTestCircles.push(dot);
    }

    refreshNavDots();
  }

  function refreshNavDots() {
    const answeredSet = new Set(
      state.realTestPool
        .map((q, i) => (q.userAnswerIndex != null ? i : null))
        .filter((x) => x != null),
    );

    state.realTestCircles.forEach((dot, i) => {
      dot.style.opacity = "1";
      dot.style.background =
        answeredSet.has(i) && !state.realTestFinished ? "#dedede" : "#fff";

      if (i === state.index && !state.realTestFinished) {
        dot.classList.add(CLS.qdotActive);
        dot.style.outline = "2px solid #2196f3";
      } else {
        dot.classList.remove(CLS.qdotActive);
        dot.style.outline = "none";
      }

      if (state.realTestFinished) {
        const q = state.realTestPool[i];
        const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
        const correct = q.userAnswerIndex === correctIndex;
        dot.style.background = correct ? "#d4edda" : "#f8d7da";
        dot.style.borderColor = correct ? "#28a745" : "#dc3545";
      }
    });
  }

  function finishRealTest() {
    const missing = state.realTestPool.filter(
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

    setTimeout(() => {
      hideOverlay();
      state.realTestFinished = true;
      disableFiltersDuringRealTest(false);

      renderResults();

      refreshNavDots();
      updateFinishButtonState();
      updateKpiVisibility();
    }, 700);
  }

  function scoreRealTest() {
    let totalCorrect = 0,
      weightedScore = 0;

    state.realTestPool.forEach((q) => {
      const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
      const gotIt = q.userAnswerIndex === correctIndex;
      if (gotIt) {
        totalCorrect++;
        weightedScore += Number(q.weight_points) || 0;
      }
    });

    const pct = (totalCorrect / 39) * 100;
    return { totalCorrect, weightedScore, pct };
  }

  const CLB_RANGES = [
    { clb: 4, min: 331, max: 368, band: "A2" },
    { clb: 5, min: 369, max: 397, band: "A2" },
    { clb: 6, min: 398, max: 457, band: "B1" },
    { clb: 7, min: 458, max: 502, band: "B2" },
    { clb: 8, min: 503, max: 522, band: "B2" },
    { clb: 9, min: 523, max: 548, band: "C1" },
    { clb: 10, min: 549, max: 699, band: "C2" },
  ];

  function clbForScore(score) {
    if (score < 331) return { clb: 4, band: "A2", notReached: true };
    return (
      CLB_RANGES.find((r) => score >= r.min && score <= r.max) || {
        clb: 10,
        band: "C2",
      }
    );
  }
  function cefrForCLB(clb) {
    if (clb <= 4) return "A2";
    if (clb === 5) return "A2";
    if (clb === 6) return "B1";
    if (clb === 7 || clb === 8) return "B2";
    if (clb === 9) return "C1";
    return "C2";
  }

  function renderResults() {
    RT.container()?.classList.add(CLS.hidden);
    els.quiz()?.classList.add(CLS.hidden);
    RT.results()?.classList.remove(CLS.hidden);

    // ✅ hide top filters while on results page
    setResultsMode(true);

    const { totalCorrect, weightedScore, pct } = scoreRealTest();
    const clbObj = clbForScore(weightedScore);
    const clb = clbObj.clb;
    const band = cefrForCLB(clb);

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

    RT.resultsHeader().innerHTML = `
      <div class="quiz--results-badge" style="${badgeStyle}">${pctValue.toFixed(
        2,
      )}%</div>
      <div class="quiz--results-sub" style="margin-top:6px">
        Score: ${weightedScore} /699
        <span class="quiz--band-pill" style="border:1px solid #333;border-radius:12px;padding:2px 8px;margin-left:6px; background: rgba(16,185,129,.40);">
          <strong>${band}</strong>
        </span>
      </div>
      <div class="quiz--results-sub" style="margin-top:4px">
        Correct: ${totalCorrect} /39
      </div>
    `;

    // ✅ move "Do another Real Test" ABOVE CLB Bands
    moveAgainButtonToTop();

    // ✅ CLB table highlight by CLB value (works even when score < 331)
    const rows = CLB_RANGES.map((r) => {
      const active = Number(r.clb) === Number(clb);
      return `
        <div class="quiz--clb-row ${active ? "quiz--clb-active" : ""}">
          <div>CLB ${r.clb} <span style="opacity:.7">(${r.band})</span></div>
          <div style="opacity:.85">${r.min}–${r.max}</div>
        </div>
      `;
    }).join("");

    RT.clbTable().innerHTML = `
      <div style="margin-top:1px;font-weight:600">CLB Bands</div>
      <div style="margin-top:8px">${rows}</div>
    `;

    // dots
    const dots = state.realTestPool
      .map((q, i) => {
        const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
        const ok = q.userAnswerIndex === correctIndex;
        return `<span title="Q${i + 1}" style="
          display:inline-block;width:12px;height:12px;border-radius:999px;
          margin:4px;background:${ok ? "#10b981" : "#ef4444"};
        "></span>`;
      })
      .join("");

    RT.resultsDots().innerHTML = `
      <div style="margin-top:14px;font-weight:600; font-size: 16px;">Overview</div>
      <div style="margin-top:8px;line-height:0">${dots}</div>
    `;

    // review (✅ now includes Transcript toggle per card)
    const reviewHtml = state.realTestPool
      .map((q, i) => {
        const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
        const ua = q.userAnswerIndex;
        const ok = ua === correctIndex;

        const alts = q.alternatives
          .map((a, idx) => {
            const letter = a.letter || deriveLetters(idx);
            const isC = idx === correctIndex;
            const isU = idx === ua;
            return `
              <div style="
                padding:6px 10px;border-radius:10px;margin:6px 0;
                border:1px solid #e5e7eb;
                background:${isC ? "rgba(16,185,129,.10)" : isU ? "rgba(239,68,68,.10)" : "#fff"};
                font-weight:${isC ? "601" : "600"};
              ">
                ${letter}. ${a.text}
                ${
                  isC
                    ? `<span style="margin-left:6px;font-size:.85rem;opacity:.85">✅ correct</span>`
                    : ""
                }
                ${
                  isU && !isC
                    ? `<span style="margin-left:6px;font-size:.85rem;opacity:.85">❌ your answer</span>`
                    : ""
                }
              </div>
            `;
          })
          .join("");

        const src = resolveAudioSrc(q);
        const audioBlock = src
          ? `
            <div style="margin-top:10px">
              <audio controls preload="none" style="width:50%">
                <source src="${src}" type="${src.endsWith(".wav") ? "audio/wav" : "audio/mpeg"}" />
                Your browser does not support the audio element.
              </audio>
            </div>
          `
          : `
            <div style="margin-top:10px;opacity:.7;font-weight:700">
              ⚠️ Audio not available for this question.
            </div>
          `;

        const transcriptBlock =
          q.transcript && q.transcript.trim()
            ? `
              <div style="margin-top:10px">
                <button
                  type="button"
                  class="quiz--btn quiz--pill"
                  data-tr-toggle="1"
                  data-target="tr-${i + 1}"
                >
                  Transcript
                </button>

                <div
                  id="tr-${i + 1}"
                  style="
                    display:none;
                    margin-top:10px;
                    background:#fff;
                    padding:12px;
                    border-radius:14px;
                    border:1px solid #e5e7eb;
                  "
                >
                  📝 ${q.transcript}
                </div>
              </div>
            `
            : `
              <div style="margin-top:10px;opacity:.7;font-weight:700">
                ⚠️ No transcript available.
              </div>
            `;

        return `
          <section id="qsec-${i + 1}" style="
            margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;
            box-shadow:0 10px 30px rgba(0,0,0,.06);
          ">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
              <div style="font-weight:600">Question ${i + 1}</div>
              <div style="font-weight:800; color:${ok ? "#10b981" : "#ef4444"}">
                ${ok ? "Correct" : "Wrong"}
              </div>
            </div>

            ${audioBlock}

            <div style="margin-top:10px">${alts}</div>
            ${transcriptBlock}
          </section>
        `;
      })
      .join("");

    RT.review().innerHTML = `
      <div style="margin-top:18px;font-weight:800;font-size:1.10rem">Review</div>
      ${reviewHtml}
    `;

    tlRecordTest({ weightedScore, pct, clb, band, totalCorrect });
    updateKpiVisibility();
  }

  function exitRealTest() {
    state.realTestMode = false;
    state.realTestFinished = false;

    setResultsMode(false);

    RT.container()?.classList.add(CLS.hidden);
    RT.results()?.classList.add(CLS.hidden);
    RT.resultsHeader().innerHTML = "";
    RT.clbTable().innerHTML = "";
    RT.resultsDots().innerHTML = "";
    RT.review().innerHTML = "";
    disableFiltersDuringRealTest(false);

    els.quiz()?.classList.remove(CLS.hidden);
    updateDeservesButton();
    refreshWeightButtonsLabels();
    recomputeFiltered();
    renderQuestion();

    updateFinishButtonState();
    updateKpiVisibility();
  }

  /* 11) Init & bindings */
  async function init() {
    await loadData();
    ensureWeightButtonsOriginalLabels();
    refreshWeightButtonsLabels();
    ensureQuestionStatsDOM();

    applyCompactToolbarLabels();
    window.addEventListener("resize", () => {
      refreshWeightButtonsLabels();
      updateDeservesButton();
      applyCompactToolbarLabels();
    });

    /* =========================================================
       ✅ Header Practice dropdown (hover desktop + tap mobile)
       Put this inside init() so DOM is ready.
    ========================================================= */
    (() => {
      const header = document.getElementById("mainHeader");
      const dropdown = document.querySelector(".quiz--nav__dropdown");
      if (!header || !dropdown) return;

      const toggle = dropdown.querySelector(".quiz--nav__dropdown-toggle");
      if (!toggle) return;

      // Mobile: tap "Practice" to open/close dropdown (only when hamburger menu is open)
      toggle.addEventListener("click", (e) => {
        const navOpen = header.classList.contains("open-nav");
        if (!navOpen) return; // desktop: allow link normal behavior

        e.preventDefault(); // prevent jumping to #success-section on mobile tap
        const isOpen = dropdown.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
      });

      // Close dropdown when nav closes (hamburger toggled off)
      const navToggle = document.getElementById("navToggle");
      if (navToggle) {
        navToggle.addEventListener("click", () => {
          const navOpen = header.classList.contains("open-nav");
          if (!navOpen) {
            dropdown.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
          }
        });
      }

      // Close dropdown if clicking outside (mobile + nav open)
      document.addEventListener("click", (e) => {
        const navOpen = header.classList.contains("open-nav");
        if (!navOpen) return;
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    })();

    // ✅ Transcript toggle inside Results review cards
    document.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-tr-toggle='1']");
      if (!btn) return;
      const id = btn.getAttribute("data-target");
      if (!id) return;
      const box = document.getElementById(id);
      if (!box) return;
      box.style.display =
        box.style.display === "none" || !box.style.display ? "block" : "none";
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
      )
        confirmBtn.click();

      if (e.key === KEYS.RIGHT) nextQuestion();
      if (e.key === KEYS.LEFT) prevQuestion();
    });

    function closeRealTestPopupOnly() {
      if (rtPrepareTimer) {
        clearTimeout(rtPrepareTimer);
        rtPrepareTimer = null;
      }

      hideOverlay();

      state.realTestMode = false;
      state.realTestFinished = false;
      state.realTestPool = [];

      disableFiltersDuringRealTest(false);
      els.quiz()?.classList.remove(CLS.hidden);

      safeText(RT.loadingText(), "Preparing Test...");
      RT.loadingText()?.classList.add("quiz--loading-flash");

      updateFinishButtonState();
      updateKpiVisibility();
      setResultsMode(false);
    }

    // Click handlers
    document.addEventListener("click", (e) => {
      const t = e.target;

      if (t && t.id === "realTestBtn") {
        startRealTestFlow();
        return;
      }

      if (t && t.id === "deservesBtn") {
        toggleDeserves();
        return;
      }

      if (t && t.id === "startRealTestBtn") {
        if (t.disabled) return;
        beginRealTest();
        return;
      }

      if (t && t.id === "finishRealTestBtn") {
        finishRealTest();
        return;
      }

      if (t && t.id === "againBtn") {
        setResultsMode(false);
        startRealTestFlow({ skipConfirm: true });
        return;
      }

      if (t && t.id === "rtClose") {
        closeRealTestPopupOnly();
        return;
      }

      if (t && t.id === "rtBackdrop") {
        closeRealTestPopupOnly();
        return;
      }
    });

    // Only-unanswered checkbox
    els.onlyChk()?.addEventListener("click", (e) => {
      if (state.realTestMode && !state.realTestFinished) {
        e.preventDefault();
        return;
      }
      state.onlyUnanswered = !!e.target.checked;
      if (state.onlyUnanswered) state.deservesMode = false;
      updateDeservesButton();

      recomputeFiltered();
      shuffle(state.filtered);
      state.index = 0;
      state.score = 0;
      state.answered = 0;
      renderQuestion();
    });

    // init initial state
    updateDeservesButton();
    recomputeFiltered();
    renderQuestion();
    updateKpiVisibility();
    setResultsMode(false);

    // expose
    window.filterQuestions = filterQuestions;
    window.nextQuestion = nextQuestion;
    window.prevQuestion = prevQuestion;
    window.loadTranscript = () => loadTranscript();
  }

  init();
})();
