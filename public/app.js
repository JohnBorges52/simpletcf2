/* ============================================================================
   TCF Audio Practice — Full App Script (with Weight-(count) when "Never responded" is on)
   - Reflects "Never responded" and "Deserves Attention" from new "TCF Listening"
   - Real Test flow intact (overlay, 2s load, 1–39 numbering, results table/dots)
   - Weight button shows unanswered count for selected weight when "Never responded" is checked
============================================================================ */

import {
  getTracking as getTrackingFS,
  setTracking as setTrackingFS,
  getEvents as getEventsFS,
  setEvents as setEventsFS,
  getTCFListening as getTCFListeningFS,
  setTCFListening as setTCFListeningFS,
} from "./firestore-storage.js";

(() => {
  /* 1) Constants */
  const PATHS = Object.freeze({ DATA: "/data/all_quiz_data.json" });

  // Legacy (kept so other parts of your app keep working)
  const STORAGE_KEYS = Object.freeze({
    TRACKING: "answer_tracking",
    EVENTS: "answer_events_v1",
  });

  // Unified store name
  const TL_KEY = "TCF Listening";

  const KEYS = Object.freeze({
    ENTER: "Enter",
    LEFT: "ArrowLeft",
    RIGHT: "ArrowRight",
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

    // Deserves Attention (toggle)
    deservesMode: false,

    // Stats (placeholder flag)
    showingStats: false,

    // Real Test
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
    dayCountdown: () => $("#dayCountdown"),
    onlyChk: () => $("#onlyUnansweredChk"),
  };

  // Real Test handles (auto-injected if missing)
  const RT = {
    overlay: () => $("#realTestLoading"),
    spinner: () => $("#rtSpinner"),
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

  // Legacy stores (migrated to Firestore)
  async function getTracking() {
    return await getTrackingFS();
  }
  async function setTracking(o) {
    await setTrackingFS(o);
  }
  async function getEvents() {
    return await getEventsFS();
  }
  async function setEvents(a) {
    await setEventsFS(a);
  }

  // New unified "TCF Listening"
  function tlDefault() {
    return { answers: {}, tests: { count: 0, items: [] } };
  }
  async function tlGet() {
    const data = await getTCFListeningFS();
    // Ensure structure is valid
    if (!data.answers) data.answers = {};
    if (!data.tests) data.tests = { count: 0, items: [] };
    if (typeof data.tests.count !== "number") {
      data.tests.count = Number(data.tests.count || 0);
    }
    if (!Array.isArray(data.tests.items)) data.tests.items = [];
    return data;
  }
  async function tlSet(obj) {
    await setTCFListeningFS(obj || tlDefault());
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
  async function tlReadAnswer(q) {
    const key = tlQuestionKey(q);
    const store = await tlGet();
    return store.answers[key] || { correct: 0, wrong: 0, lastAnswered: 0 };
  }
  async function tlBumpAnswer(q, isCorrect) {
    const store = await tlGet();
    const key = tlQuestionKey(q);
    const rec = store.answers[key] || { correct: 0, wrong: 0, lastAnswered: 0 };
    if (isCorrect) rec.correct++;
    else rec.wrong++;
    rec.lastAnswered = Date.now();
    store.answers[key] = rec;
    await tlSet(store);
  }
  async function tlRecordTest({ weightedScore, pct, clb, band, totalCorrect }) {
    const store = await tlGet();
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
    await tlSet(store);
  }

  // Helpers
  function makeLegacyKey(q) {
    return q
      ? `${q.test_id || "unknownTest"}-question${q.question_number}`
      : "";
  }

  // "Never responded": use TL (and legacy as a fallback if you want to treat either as answered)
  async function isUnanswered(q) {
    const tl = await tlReadAnswer(q);
    const newAnswered = (tl.correct || 0) + (tl.wrong || 0) > 0;
    if (newAnswered) return false;
    // also check legacy to avoid showing as unanswered when old data exists
    const tracking = await getTracking();
    const st = tracking[makeLegacyKey(q)];
    const oldAnswered = !!(st && (st.correct || 0) + (st.wrong || 0) > 0);
    return !oldAnswered;
  }

  // Deserves Attention — from TL store
  // rule: total>0 and |correct - wrong| < 2
  async function deservesFromTL(q) {
    const rec = await tlReadAnswer(q);
    const total = (rec.correct || 0) + (rec.wrong || 0);
    if (total === 0) return false;
    return Math.abs((rec.correct || 0) - (rec.wrong || 0)) < 2;
  }

  // Assets
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
      if (base) return `/audios/${base}`;
    }
    if (q.filename) return `/audios/${q.filename}`;
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
    if (state.realTestMode) return state.index + 1; // 1–39 in Real Test
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

  /* 6) Filters / buttons */

  // NEW: count unanswered (TL/legacy-aware) for a given weight
  async function countUnansweredForWeight(weight) {
    const w = Number(weight);
    const results = await Promise.all(
      state.allData.map(async (q) => {
        if (Number(q.weight_points) !== w) return false;
        return await isUnanswered(q);
      })
    );
    return results.filter(Boolean).length;
  }

  function ensureWeightButtonsOriginalLabels() {
    document.querySelectorAll(".weight-btn").forEach((btn) => {
      const seed = (btn.dataset.originalLabel || btn.textContent || "").trim();
      if (btn.dataset.all === "1" || /^all$/i.test(seed)) {
        btn.dataset.all = "1";
        btn.dataset.originalLabel = "All Questions";
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

  // UPDATED: when "Never responded" is ON and a weight is selected,
  // append the unanswered count to that *selected* weight button.
  async function refreshWeightButtonsLabels() {
    ensureWeightButtonsOriginalLabels();

    const selectedWeight = state.currentWeight;
    const onlyUnanswered = !!state.onlyUnanswered;

    const buttons = document.querySelectorAll(".weight-btn");
    for (const btn of buttons) {
      const isAll = btn.dataset.all === "1";
      const w = btn.dataset.weight ? Number(btn.dataset.weight) : null;
      let label = (btn.dataset.originalLabel || btn.textContent || "").trim();

      // Only show on the selected weight (not "All Questions"), and only if "Never responded" is checked.
      if (
        onlyUnanswered &&
        !isAll &&
        selectedWeight != null &&
        w === selectedWeight
      ) {
        const qty = await countUnansweredForWeight(w);
        label = `${label} (${qty})`;
      }

      btn.textContent = label;
    }
  }

  async function recomputeFiltered() {
    let items = state.allData.slice();

    // Weight filter (if chosen)
    if (state.currentWeight != null) {
      items = items.filter(
        (q) => Number(q.weight_points) === Number(state.currentWeight),
      );
    }

    // Deserves Attention overrides "only unanswered"
    if (state.deservesMode) {
      const results = await Promise.all(items.map(deservesFromTL));
      items = items.filter((_, i) => results[i]);
    } else if (state.onlyUnanswered) {
      const results = await Promise.all(items.map(isUnanswered));
      items = items.filter((_, i) => results[i]);
    }

    state.filtered = items;
  }

  async function rebuildFiltered() {
    await recomputeFiltered();
    shuffle(state.filtered);
    state.index = 0;
    state.score = 0;
    state.answered = 0;
    els.quiz()?.classList.remove("hidden");
    renderQuestion();
    await updateDeservesButton();
    await refreshWeightButtonsLabels(); // keep labels in sync with state
  }

  async function ensureDataLoaded() {
    if (!state.allData.length) await loadData();
  }

  async function filterQuestions(weightOrAll) {
    // If on results page, confirm leave
    if (state.realTestMode && state.realTestFinished) {
      if (
        !confirm(
          "You are viewing Real Test results. Do you want to leave the results page?",
        )
      )
        return;
      await exitRealTest();
    }
    await ensureDataLoaded();
    state.currentWeight =
      weightOrAll === "all" || weightOrAll == null ? null : Number(weightOrAll);
    document
      .querySelectorAll(".weight-btn")
      .forEach((btn) => btn.classList.remove("selected-weight"));
    const selectedBtn =
      state.currentWeight == null
        ? document.querySelector('.weight-btn[data-all="1"]')
        : Array.from(document.querySelectorAll(".weight-btn")).find(
            (btn) => Number(btn.dataset.weight) === state.currentWeight,
          );
    selectedBtn?.classList.add("selected-weight");
    await rebuildFiltered();
  }

  // Deserves Attention button
  async function countDeservesAttentionForCurrentScope() {
    let pool = state.allData;
    if (state.currentWeight != null) {
      pool = pool.filter(
        (q) => Number(q.weight_points) === Number(state.currentWeight),
      );
    }
    const results = await Promise.all(pool.map(async (q) => {
      return await deservesFromTL(q);
    }));
    return results.filter(Boolean).length;
  }
  async function updateDeservesButton() {
    const btn = els.deservesBtn();
    if (!btn) return;
    const count = await countDeservesAttentionForCurrentScope();
    btn.textContent = `📚 Deserves Attention (${count})`;
    btn.classList.toggle("toggled", state.deservesMode);
    btn.setAttribute("aria-pressed", state.deservesMode ? "true" : "false");
  }
  async function toggleDeserves() {
    // If on results page, confirm leave
    if (state.realTestMode && state.realTestFinished) {
      if (
        !confirm(
          "You are viewing Real Test results. Do you want to leave the results page?",
        )
      )
        return;
      await exitRealTest();
    }
    state.deservesMode = !state.deservesMode;
    // When Deserves is ON during normal practice, ignore "only unanswered"
    if (state.deservesMode) {
      state.onlyUnanswered = false;
      const chk = els.onlyChk();
      if (chk) chk.checked = false;
    }
    await rebuildFiltered();
  }

  /* 7) Rendering */
  function renderPicture(q, displayNumStr) {
    const picWrap = els.picture();
    if (!picWrap) return;
    if (q.question_number >= 1 && q.question_number <= 10 && isPictureTrue(q)) {
      const imgSrc = resolveImageSrc(q);
      if (imgSrc) {
        const numForAlt = displayNumStr || fmt2or3(getHeaderNumber(q));
        picWrap.innerHTML = `<img src="${imgSrc}" alt="Question ${numForAlt} illustration" class="question-picture">`;
        picWrap.classList.remove("hidden");
        return;
      }
    }
    picWrap.classList.add("hidden");
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
    confirmBtn?.classList.add("hidden");

    q.alternatives.forEach((alt, i) => {
      const div = document.createElement("div");
      div.className = "option";
      const letter = alt.letter || deriveLetters(i);
      div.textContent = `${letter}. ${alt.text}`;

      if (alreadyAnswered) {
        // In Real Test (active) we don’t reveal correctness. After results we show in the review section.
        if (!state.realTestMode) {
          if (i === correctIndex) div.classList.add("correct");
          if (i === q.userAnswerIndex && i !== correctIndex)
            div.classList.add("incorrect");
        }
      } else {
        div.onclick = () => {
          document
            .querySelectorAll(".option")
            .forEach((o) => o.classList.remove("selected"));
          div.classList.add("selected");
          state.selectedOptionIndex = i;
          confirmBtn?.classList.remove("hidden");
        };
      }
      container.appendChild(div);
    });

    if (confirmBtn) confirmBtn.onclick = () => confirmAnswer(q);
  }
  function renderQuestion() {
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
      transcriptWrap?.classList.remove("show-btn", "show-text");
      safeText(els.transcriptText(), "");
      updateScore();
      return;
    }

    const headerNum = getHeaderNumber(q);
    const qNumDisplayStr = fmt2or3(headerNum);
    safeText(qNum, `Question ${qNumDisplayStr}`);

    renderPicture(q, qNumDisplayStr);
    renderAudio(q);

    const alreadyAnswered = q.userAnswerIndex !== undefined;
    const correctIndex = q.alternatives.findIndex((a) => a.is_correct);

    if (state.realTestMode && !state.realTestFinished) {
      transcriptWrap?.classList.remove("show-btn", "show-text");
      safeText(els.transcriptText(), "");
    } else {
      if (alreadyAnswered) transcriptWrap?.classList.add("show-btn");
      else transcriptWrap?.classList.remove("show-btn", "show-text");
      safeText(els.transcriptText(), "");
    }

    renderOptions(q, alreadyAnswered, correctIndex);
    updateScore();
    if (state.realTestMode) refreshNavDots();
  }

  /* 8) Tracking + events */
  function updateScore() {
    safeText(
      els.score(),
      `✅ ${state.score} correct out of ${state.answered} answered.`,
    );
  }

  async function trackAnswerLocally(
    testId,
    questionNumber,
    isCorrect,
    weight_points,
    qObj,
  ) {
    // Legacy
    const key = `${testId}-question${questionNumber}`;
    const tracking = await getTracking();
    if (!tracking[key]) tracking[key] = { correct: 0, wrong: 0 };
    isCorrect ? tracking[key].correct++ : tracking[key].wrong++;
    tracking[key].lastAnswered = Date.now();
    await setTracking(tracking);

    const events = await getEvents();
    events.push({
      ts: Date.now(),
      test_id: testId,
      question_number: questionNumber,
      weight: weight_points,
      correct: !!isCorrect,
    });
    if (events.length > 20000) events.splice(0, events.length - 20000);
    await setEvents(events);

    // Unified store (TL)
    await tlBumpAnswer(qObj, !!isCorrect);

    // Update DA button count live
    await updateDeservesButton();
  }

  async function confirmAnswer(q) {
    if (state.selectedOptionIndex === null) return;

    const options = document.querySelectorAll(".option");
    const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
    q.userAnswerIndex = state.selectedOptionIndex;

    const isCorrect = state.selectedOptionIndex === correctIndex;

    // ✅ Show UI feedback immediately (non-blocking)
    if (!state.realTestMode) {
      if (isCorrect)
        options[state.selectedOptionIndex].classList.add("correct");
      else {
        options[state.selectedOptionIndex].classList.add("incorrect");
        if (correctIndex >= 0 && options[correctIndex])
          options[correctIndex].classList.add("correct");
      }
    }

    if (isCorrect) state.score++;
    state.answered++;

    // ✅ Run database writes in background without blocking UI
    trackAnswerLocally(
      q.test_id || "unknownTest",
      q.question_number,
      isCorrect,
      q.weight_points,
      q,
    ).catch(err => {
      console.error("Failed to save answer to database:", err);
    });

    options.forEach((opt) => {
      opt.onclick = null;
    });
    state.selectedOptionIndex = null;
    els.confirmBtn()?.classList.add("hidden");

    if (!state.realTestMode || state.realTestFinished)
      $(".transcript")?.classList.add("show-btn");
    else $(".transcript")?.classList.remove("show-btn", "show-text");

    updateScore();

    // NEW: keep weight button label count refreshed as answers change
    await refreshWeightButtonsLabels();
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
    if (state.realTestMode && !state.realTestFinished) {
      $(".transcript")?.classList.remove("show-text");
      safeText(els.transcriptText(), "");
      return;
    }
    const has = q.transcript && q.transcript.trim() !== "";
    safeText(
      els.transcriptText(),
      has ? `📝 ${q.transcript}` : "⚠️ No transcript available.",
    );
    $(".transcript")?.classList.add("show-text");
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

  // Inject Real Test UI if missing
  function ensureRealTestDOM() {
    if (!RT.realTestBtn()) {
      const toolbar = document.querySelector(".toolbar") || document.body;
      const btn = document.createElement("button");
      btn.id = "realTestBtn";
      btn.type = "button";
      btn.textContent = "🧪 Real Test";
      btn.className = "deserves-btn";
      toolbar.appendChild(btn);
    }
    if (!RT.overlay()) {
      const div = document.createElement("div");
      div.id = "realTestLoading";
      div.className = "hidden";
      div.innerHTML = `
        <div id="rtBackdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9998;"></div>
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;">
          <div style="background:#fff;min-width:320px;max-width:520px;border-radius:12px;padding:16px;position:relative;box-shadow:0 12px 30px rgba(0,0,0,.25)">
            <button id="rtClose" aria-label="Close" style="position:absolute;right:8px;top:8px;border:none;background:transparent;font-size:20px;cursor:pointer">✖</button>
            <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding-top:10px;padding-bottom:10px">
              <div id="rtSpinner" class="spinner" style="width:32px;height:32px;border:3px solid #ddd;border-top-color:#2196f3;border-radius:50%;animation:rtspin 1s linear infinite;"></div>
              <div id="rtLoadingText">Loading test…</div>
              <button id="startRealTestBtn" class="confirm-btn hidden">Start the test</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(div);
      const style = document.createElement("style");
      style.textContent = `@keyframes rtspin{to{transform:rotate(360deg)}} .hidden{display:none!important}`;
      document.head.appendChild(style);
    }
    if (!RT.container()) {
      const cont = document.createElement("section");
      cont.id = "realTestContainer";
      cont.className = "hidden";
      cont.innerHTML = `
        <div id="questionNav" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;"></div>
        <button id="finishRealTestBtn" class="confirm-btn" style="margin-bottom:10px;">Finish Test</button>
      `;
      const quiz = els.quiz() || document.body;
      quiz.parentNode.insertBefore(cont, quiz);
    }
    if (!RT.results()) {
      const res = document.createElement("section");
      res.id = "realTestResults";
      res.className = "hidden";
      res.innerHTML = `
        <h2>Results</h2>
        <div id="resultsHeader" style="margin-bottom:10px"></div>
        <div id="clbTable" style="margin-bottom:10px"></div>
        <div id="resultsDots" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;"></div>
        <div id="allQuestionsReview" style="display:flex;flex-direction:column;gap:12px;"></div>
        <button id="againBtn" class="confirm-btn" style="margin-top:14px;">Do another Real Test</button>
      `;
      const quiz = els.quiz() || document.body;
      quiz.parentNode.insertBefore(res, quiz.nextSibling);
    }
  }

  function showOverlay() {
    RT.overlay()?.classList.remove("hidden");
    RT.spinner()?.classList.remove("stopped");
    safeText(RT.loadingText(), "Loading test…");
    RT.startBtn()?.classList.add("hidden");
  }
  function hideOverlay() {
    RT.overlay()?.classList.add("hidden");
  }
  function stopSpinnerShowStart() {
    RT.spinner()?.classList.add("stopped");
    safeText(RT.loadingText(), "Ready");
    RT.startBtn()?.classList.remove("hidden");
  }

  function disableFiltersDuringRealTest(disabled) {
    const weightButtons = Array.from(document.querySelectorAll(".weight-btn"));
    weightButtons.forEach((btn) => {
      btn.classList.remove("selected-weight");
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

  async function startRealTestFlow(opts = { skipConfirm: false }) {
    await ensureDataLoaded();

    if (state.realTestMode && state.realTestFinished && !opts.skipConfirm) {
      if (!confirm("Start a new Real Test and leave the current results?"))
        return;
      await exitRealTest();
    }

    RT.results()?.classList.add("hidden");
    RT.container()?.classList.add("hidden");
    els.quiz()?.classList.add("hidden");
    RT.resultsHeader().innerHTML = "";
    RT.clbTable().innerHTML = "";
    RT.resultsDots().innerHTML = "";
    RT.review().innerHTML = "";

    state.realTestMode = true;
    state.realTestFinished = false;
    state.realTestPool = [];
    state.deservesMode = false; // turn off DA
    await updateDeservesButton();

    disableFiltersDuringRealTest(true);

    showOverlay();
    setTimeout(() => {
      state.realTestPool = buildRealTestPool();
      state.filtered = state.realTestPool.slice(); // fixed order
      state.index = 0;
      state.score = 0;
      state.answered = 0;
      stopSpinnerShowStart();
    }, 2000);
  }

  function beginRealTest() {
    hideOverlay();
    RT.container()?.classList.remove("hidden");
    els.quiz()?.classList.remove("hidden");
    buildNavDots();
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildNavDots() {
    const wrap = RT.nav();
    if (!wrap) return;
    wrap.innerHTML = "";
    state.realTestCircles = [];
    for (let i = 0; i < state.realTestPool.length; i++) {
      const dot = document.createElement("div");
      dot.className = "qdot";
      dot.textContent = String(i + 1);
      dot.style.cssText =
        "width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #ccc;cursor:pointer;user-select:none;";
      dot.dataset.index = String(i);
      dot.addEventListener("click", () => {
        if (!state.realTestFinished) {
          state.index = i;
          renderQuestion();
          refreshNavDots();
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
        dot.style.outline = "2px solid #2196f3";
      } else {
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

    showOverlay();
    safeText(RT.loadingText(), "Scoring test…");
    setTimeout(async () => {
      hideOverlay();
      state.realTestFinished = true;

      disableFiltersDuringRealTest(false);
      await renderResults();
      refreshNavDots();
    }, 2000);
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

  async function renderResults() {
    RT.container()?.classList.add("hidden");
    RT.results()?.classList.remove("hidden");

    attachResultsLeaveGuards(true);

    // compute once and reuse
    const { totalCorrect, weightedScore, pct } = scoreRealTest();
    const clbObj = clbForScore(weightedScore);
    const clb = clbObj.clb;
    const band = cefrForCLB(clb);

    RT.resultsHeader().innerHTML = `
      <div class="results-badge" style="font-size:1.25rem;font-weight:700">${pct.toFixed(2)}%</div>
      <div class="results-sub">Score: <strong>${weightedScore}/699</strong> <span class="band-pill" style="border:1px solid #333;border-radius:12px;padding:2px 8px">${band}</span></div>
      <div class="results-sub">Correct: <strong>${totalCorrect}</strong> / 39</div>
    `;

    const t = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>CLB</th><th>Score Range</th><th>Band</th></tr>`;
    t.appendChild(thead);
    const tb = document.createElement("tbody");
    const fullRows = [
      {
        label: "CLB 4 not reached",
        clb: 4,
        range: "< 331",
        band: "A2",
        isSpecial: true,
      },
      { clb: 4, range: "331–368", band: "A2" },
      { clb: 5, range: "369–397", band: "A2" },
      { clb: 6, range: "398–457", band: "B1" },
      { clb: 7, range: "458–502", band: "B2" },
      { clb: 8, range: "503–522", band: "B2" },
      { clb: 9, range: "523–548", band: "C1" },
      { clb: 10, range: "549–699", band: "C2" },
    ];
    let indicesToShow = [];
    if (clbObj.notReached) {
      indicesToShow = [0, 1];
    } else {
      const idx = fullRows.findIndex((r) => !r.isSpecial && r.clb === clb);
      const prev = Math.max(1, idx - 1);
      const next = Math.min(fullRows.length - 1, idx + 1);
      indicesToShow = Array.from(new Set([prev, idx, next]));
    }
    indicesToShow.forEach((i) => {
      const r = fullRows[i];
      const tr = document.createElement("tr");
      const isCurrent =
        (!r.isSpecial && r.clb === clb) || (r.isSpecial && clbObj.notReached);
      if (isCurrent) tr.style.fontWeight = "700";
      tr.innerHTML = r.isSpecial
        ? `<td colspan="3"><strong>${r.label}</strong></td>`
        : `<td>CLB ${r.clb}</td><td>${r.range}</td><td>${r.band}</td>`;
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    RT.clbTable().innerHTML = "";
    RT.clbTable().appendChild(t);

    renderResultsDots();

    const review = RT.review();
    review.innerHTML = "";
    state.realTestPool.forEach((q, idx) => {
      const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
      const gotIt = q.userAnswerIndex === correctIndex;
      const card = document.createElement("div");
      card.className = `review-card`;
      card.style.cssText =
        "border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff";
      card.id = `qsec-${idx + 1}`;
      const headerNum = String(idx + 1).padStart(2, "0");
      card.innerHTML = `
        <div class="header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div><strong>Question ${headerNum}</strong> <span class="tag" style="font-size:.85rem;opacity:.8">Weight ${q.weight_points}</span></div>
          <div>${gotIt ? "✅ Correct" : "❌ Wrong"}</div>
        </div>
        <audio controls preload="none" style="width:100%;margin-bottom:6px">
          ${(() => {
            const c = resolveAudioSrc(q) || "";
            return c
              ? `<source src="${c}" ${c.endsWith(".wav") ? 'type="audio/wav"' : 'type="audio/mpeg"'}>`
              : "";
          })()}
        </audio>
        <div class="alts"></div>
        <details class="mt-2"${q.transcript && q.transcript.trim() ? "" : " open"}>
          <summary>Transcript</summary>
          <div>${q.transcript && q.transcript.trim() ? q.transcript : "<em>No transcript available.</em>"}</div>
        </details>
      `;
      const alts = card.querySelector(".alts");

      q.alternatives.forEach((alt, i) => {
        const line = document.createElement("div");
        line.className = "option";
        line.style.cssText =
          "padding:8px;border:1px solid #eee;border-radius:6px;margin:4px 0";
        line.textContent = `${alt.letter || deriveLetters(i)}. ${alt.text}`;
        if (i === correctIndex) {
          line.style.background = "#d4edda";
          line.style.borderColor = "#28a745";
        }
        if (!gotIt && i === q.userAnswerIndex) {
          line.style.background = "#f8d7da";
          line.style.borderColor = "#dc3545";
        }
        alts.appendChild(line);
      });
      review.appendChild(card);
    });

    // Persist test summary to TL
    await tlRecordTest({ weightedScore, pct, clb, band, totalCorrect });
  }

  function renderResultsDots() {
    const wrap = RT.resultsDots();
    if (!wrap) return;
    wrap.innerHTML = "";
    state.realTestPool.forEach((q, i) => {
      const correctIndex = q.alternatives.findIndex((a) => a.is_correct);
      const gotIt = q.userAnswerIndex === correctIndex;
      const dot = document.createElement("div");
      dot.textContent = String(i + 1);
      dot.style.cssText =
        "width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #ccc;cursor:pointer;user-select:none;";
      dot.style.background = gotIt ? "#d4edda" : "#f8d7da";
      dot.style.borderColor = gotIt ? "#28a745" : "#dc3545";
      dot.addEventListener("click", () => {
        const target = document.getElementById(`qsec-${i + 1}`);
        if (target)
          target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      wrap.appendChild(dot);
    });
  }

  async function exitRealTest() {
    state.realTestMode = false;
    state.realTestFinished = false;
    RT.container()?.classList.add("hidden");
    RT.results()?.classList.add("hidden");
    RT.resultsHeader().innerHTML = "";
    RT.clbTable().innerHTML = "";
    RT.resultsDots().innerHTML = "";
    RT.review().innerHTML = "";
    attachResultsLeaveGuards(false);
    disableFiltersDuringRealTest(false);
    els.quiz()?.classList.remove("hidden");
    // restore DA button state/count from TL
    await updateDeservesButton();
    await refreshWeightButtonsLabels();
  }

  function attachResultsLeaveGuards(enable) {
    const handler = async (e) => {
      const id = (e.target && e.target.id) || "";
      if (
        id === "realTestBtn" ||
        id === "againBtn" ||
        id === "finishRealTestBtn"
      )
        return;
      if (state.realTestMode && state.realTestFinished) {
        if (!confirm("Do you want to leave the results page?")) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        } else {
          await exitRealTest();
        }
      }
    };
    const targets = [
      ...document.querySelectorAll(".weight-btn"),
      els.deservesBtn(),
      $("#allBtn"),
    ].filter(Boolean);

    if (enable) {
      targets.forEach((el) =>
        el.addEventListener("click", handler, { capture: true }),
      );
    } else {
      targets.forEach((el) =>
        el.removeEventListener("click", handler, { capture: true }),
      );
    }
  }

  /* 10) Small extras */
  function updateCountdown() {
    const now = new Date();
    let target = new Date(now.getFullYear(), 9, 9);
    if (now > target) target = new Date(now.getFullYear() + 1, 10, 23);
    const diffDays = Math.ceil((target - now) / (24 * 60 * 60 * 1000));
    safeText(
      els.dayCountdown(),
      `${diffDays} day${diffDays !== 1 ? "s" : ""} `,
    );
  }

  /* 11) Init & bindings */
  async function init() {
    ensureRealTestDOM(); // ensure Real Test UI exists
    await loadData();
    ensureWeightButtonsOriginalLabels();
    await refreshWeightButtonsLabels();

    // Countdown (optional)
    try {
      updateCountdown();
    } catch {}
    try {
      setInterval(updateCountdown, 24 * 60 * 60 * 1000);
    } catch {}

    // Keyboard
    window.addEventListener("keydown", (e) => {
      const options = Array.from(document.querySelectorAll(".option"));
      const confirmBtn = els.confirmBtn();
      if (!options.length) return;
      if (/^[1-9]$/.test(e.key)) {
        const i = parseInt(e.key, 10) - 1;
        if (options[i]) {
          options.forEach((o) => o.classList.remove("selected"));
          options[i].classList.add("selected");
          state.selectedOptionIndex = i;
          confirmBtn?.classList.remove("hidden");
        }
      }
      if (
        e.key === KEYS.ENTER &&
        confirmBtn &&
        !confirmBtn.classList.contains("hidden")
      )
        confirmBtn.click();
      if (e.key === KEYS.RIGHT) nextQuestion();
      if (e.key === KEYS.LEFT) prevQuestion();
    });

    // Click handlers
    document.addEventListener("click", async (e) => {
      const t = e.target;

      // Real Test triggers
      if (t && t.id === "realTestBtn") {
        startRealTestFlow();
        // When starting a test, also disable other filters per your rule
        state.deservesMode = false;
        await updateDeservesButton();
      }
      if (t && t.id === "startRealTestBtn") beginRealTest();
      if (t && t.id === "finishRealTestBtn") finishRealTest();
      if (t && t.id === "againBtn") {
        if (state.realTestMode && state.realTestFinished) {
          if (!confirm("Start a new Real Test and leave the current results?"))
            return;
          await exitRealTest();
        }
        startRealTestFlow({ skipConfirm: true });
      }

      // Overlay close & click-outside
      if (t && t.id === "rtClose") {
        hideOverlay();
        if (!state.realTestFinished) {
          state.realTestMode = false;
          disableFiltersDuringRealTest(false);
        }
      }
      if (t && t.id === "rtBackdrop") {
        hideOverlay();
        if (!state.realTestFinished) {
          state.realTestMode = false;
          disableFiltersDuringRealTest(false);
        }
      }

      // Deserves Attention toggle
      if (t && t.id === "deservesBtn") toggleDeserves();
    });

    // Only-unanswered checkbox behavior:
    // - Disabled during active Real Test (your rule)
    // - Otherwise, rebuild using TL "unanswered"
    els.onlyChk()?.addEventListener("click", async (e) => {
      if (state.realTestMode && !state.realTestFinished) {
        e.preventDefault();
        return;
      }
      state.onlyUnanswered = !!e.target.checked;
      if (state.onlyUnanswered) {
        // Turning on "Never responded" turns off Deserves mode
        state.deservesMode = false;
        await updateDeservesButton();
      }
      await rebuildFiltered();
    });

    // Initial DA label
    await updateDeservesButton();
  }
  init();

  // Expose minimal API for inline HTML
  window.filterQuestions = filterQuestions;
  window.nextQuestion = nextQuestion;
  window.prevQuestion = prevQuestion;
  window.loadTranscript = () => loadTranscript();
})();

