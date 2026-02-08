/* -------------------------------------------------
   Safe runner: isolates each block so one error
   doesn't kill the rest of the UI.
---------------------------------------------------*/
const run = (name, fn) => {
  try {
    fn();
  } catch (e) {
    console.error(`[UI] ${name} failed:`, e);
  }
};

/* -------------------------------------------------
   2) Sticky header (vanilla) + hamburger integration
---------------------------------------------------*/
run("sticky-header", () => {
  const header = document.querySelector(".main_h");
  if (!header) return;

  const THRESHOLD = 100;

  // Central rule: when nav is open, header must be sticky.
  // When nav is closed, sticky only if scrollY > 100.
  const syncSticky = () => {
    const navOpen = header.classList.contains("open-nav");
    const shouldStick = navOpen || window.scrollY > THRESHOLD;
    header.classList.toggle("sticky", shouldStick);
  };

  document.addEventListener("scroll", syncSticky, { passive: true });
  window.addEventListener("resize", syncSticky, { passive: true });

  // expose so mobile-nav can call it after toggle/close actions
  header.__syncSticky = syncSticky;

  syncSticky();
});

/* -------------------------------------------------
   3) Mobile navigation toggle
---------------------------------------------------*/
run("mobile-nav", () => {
  const header = document.querySelector(".main_h");
  const toggle = document.querySelector(".mobile-toggle");
  if (!header || !toggle) return;

  const syncSticky = header.__syncSticky || (() => {});

  const closeNav = () => {
    if (!header.classList.contains("open-nav")) return;
    header.classList.remove("open-nav");
    toggle.setAttribute("aria-expanded", "false");
    syncSticky(); // ✅ apply rule on close
  };

  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("open-nav");
    toggle.setAttribute("aria-expanded", String(open));

    // ✅ if opening -> sticky ON; if closing -> sticky depends on scrollY>100
    syncSticky();
  });

  // Close nav on link + smooth scroll
  document.getElementById("site-nav")?.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;

    const href = a.getAttribute("href");
    if (href && href.startsWith(".")) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }

    closeNav(); // ✅ includes syncSticky()
  });

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (!header.classList.contains("open-nav")) return;
    if (!e.target.closest(".main_h")) closeNav();
  });

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });
});

/* -------------------------------------------------
   3.1 Mobile navigation toggle (quiz-- prefixed)
---------------------------------------------------*/
run("mobile-nav", () => {
  const header = document.querySelector(".quiz--main_h");
  const toggle = document.querySelector(".quiz--mobile-toggle");
  const nav = document.getElementById("site-nav");

  if (!header || !toggle || !nav) return;

  // Toggle mobile nav
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("quiz--open-nav");
    toggle.setAttribute("aria-expanded", String(open));
  });

  // Close nav on link click + smooth scroll
  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;

    const href = a.getAttribute("href");

    // Smooth scroll only for in-page anchors
    if (href && href.startsWith("#")) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const HEADER_HEIGHT = 70;
        const y =
          target.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;

        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }

    if (header.classList.contains("quiz--open-nav")) {
      header.classList.remove("quiz--open-nav");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  // Click outside header → close nav
  document.addEventListener("click", (e) => {
    if (!header.classList.contains("quiz--open-nav")) return;
    if (!e.target.closest(".quiz--main_h")) {
      header.classList.remove("quiz--open-nav");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  // ESC key → close nav
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("quiz--open-nav")) {
      header.classList.remove("quiz--open-nav");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
});

/* -------------------------------------------------
   4) Carousel (auto + dots + drag)
   - Uses viewport width for exact slide size
   - Resizes with ResizeObserver fallback
   - Isolated so other errors won’t break it
---------------------------------------------------*/
run("carousel", () => {
  const carousel = document.querySelector(".carousel");
  if (!carousel) return;

  const viewport = carousel.querySelector(".carousel__viewport");
  if (!viewport) return;

  const slides = Array.from(viewport.children);
  if (!slides.length) return;

  const prev = carousel.querySelector('[data-dir="prev"]');
  const next = carousel.querySelector('[data-dir="next"]');
  const dotsWrap = carousel.querySelector(".carousel__dots");
  if (!dotsWrap) return;

  let i = 0;
  let slideW = 0;

  // Build dots
  dotsWrap.innerHTML = "";
  const dots = slides.map((_, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "carousel__dot";
    b.setAttribute("aria-label", `Go to slide ${idx + 1}`);
    b.addEventListener("click", () => {
      go(idx);
      restartTimer();
    });
    dotsWrap.appendChild(b);
    return b;
  });

  function updateDots() {
    dots.forEach((d, idx) =>
      d.setAttribute("aria-current", idx === i ? "true" : "false"),
    );
  }

  function measure() {
    // Use viewport width to avoid padding/scrollbar mismatches
    slideW = Math.round(viewport.clientWidth);
    slides.forEach((s) => {
      s.style.minWidth = slideW + "px";
      s.style.maxWidth = slideW + "px";
      s.style.flex = "0 0 " + slideW + "px";
    });
    viewport.style.transform = `translateX(${-i * slideW}px)`;
  }

  function go(idx) {
    i = (idx + slides.length) % slides.length;
    viewport.style.transform = `translateX(${-i * slideW}px)`;
    updateDots();
  }

  prev?.addEventListener("click", () => {
    go(i - 1);
    restartTimer();
  });
  next?.addEventListener("click", () => {
    go(i + 1);
    restartTimer();
  });

  // Auto-advance
  const AUTO_MS = 15000;
  let autoId = null;
  function startTimer() {
    stopTimer();
    autoId = setInterval(() => go(i + 1), AUTO_MS);
  }
  function stopTimer() {
    if (autoId) clearInterval(autoId);
    autoId = null;
  }
  function restartTimer() {
    startTimer();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopTimer();
    else startTimer();
  });

  // Init after layout paints to get correct width
  const init = () => {
    measure();
    go(0);
    startTimer();
  };
  // Resize handling that actually observes the element
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
  } else {
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
  }
  // Ensure we measure once the fonts/layout settle
  requestAnimationFrame(() => {
    measure();
    requestAnimationFrame(init);
  });

  // Drag support
  let startX = 0,
    dragging = false,
    pointerId = null;
  viewport.addEventListener("pointerdown", (e) => {
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    viewport.setPointerCapture(pointerId);
  });
  viewport.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    restartTimer();
    if (pointerId != null) {
      try {
        viewport.releasePointerCapture(pointerId);
      } catch {}
      pointerId = null;
    }
  });
});

/* -------------------------------------------------
   5) Hero background rotator (zoom crossfade)
   - Creates two layers and swaps with keyframes
   - Isolated and robust to CSS being present/absent
---------------------------------------------------*/
run("hero-rotator", () => {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const slides = [
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1920&q=80",
  ];

  // Ensure container has positioning so absolute layers render
  if (getComputedStyle(hero).position === "static") {
    hero.style.position = "relative";
  }

  const mkLayer = () => {
    const d = document.createElement("div");
    d.className = "hero__bg";
    d.setAttribute("aria-hidden", "true");
    // Provide fallback styles if CSS class is missing
    d.style.position = "absolute";
    d.style.inset = "0";
    d.style.backgroundSize = "cover";
    d.style.backgroundPosition = "center";
    d.style.transition = "opacity 800ms ease";
    d.style.opacity = "0";
    return d;
  };

  const layerA = mkLayer();
  const layerB = mkLayer();
  hero.prepend(layerB);
  hero.prepend(layerA);

  let idx = 0;
  let current = layerA;
  let next = layerB;
  let dir = 1;
  const DURATION = 7000;

  function startKB(el, zoomIn) {
    // If your CSS defines @keyframes kb-zoom-in / kb-zoom-out, they’ll be used.
    // Otherwise we simulate a mild zoom with transform.
    el.style.animation = "none";
    // Force reflow
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    const hasKeyframes = typeof getComputedStyle(el).animationName === "string";
    if (hasKeyframes) {
      el.style.animation = `${zoomIn ? "kb-zoom-in" : "kb-zoom-out"} ${DURATION}ms ease-in-out 1 forwards`;
    } else {
      // JS fallback
      el.animate(
        [
          { transform: "scale(1)" },
          { transform: `scale(${zoomIn ? 1.05 : 1.03})` },
        ],
        { duration: DURATION, easing: "ease-in-out", fill: "forwards" },
      );
    }
  }

  function show(el) {
    el.style.opacity = "1";
  }
  function hide(el) {
    el.style.opacity = "0";
  }

  current.style.backgroundImage = `url("${slides[idx]}")`;
  show(current);
  requestAnimationFrame(() => startKB(current, true));

  function swap() {
    idx = (idx + 1) % slides.length;
    next.style.backgroundImage = `url("${slides[idx]}")`;
    startKB(next, dir > 0);
    dir *= -1;

    show(next);
    hide(current);

    const tmp = current;
    current = next;
    next = tmp;
  }

  // Preload to avoid flash
  slides.forEach((src) => {
    const im = new Image();
    im.src = src;
  });

  setInterval(swap, DURATION);
});

/* -------------------------------------------------
   6) Contact submit button animation + email form
---------------------------------------------------*/
run("contact-button", () => {
  const button = document.getElementById("submit-button");
  const form = document.getElementById("contact");
  if (!button || !form) return;

  // Get form fields
  const topicField = document.getElementById("contact-topic");
  const nameField = document.getElementById("contact-name");
  const surnameField = document.getElementById("contact-surname");
  const emailField = document.getElementById("contact-email");
  const phoneField = document.getElementById("contact-phone");
  const messageField = document.getElementById("contact-message");

  // Validation function
  const validateField = (field, errorId, fieldId) => {
    const fieldContainer = document.getElementById(fieldId);
    const errorElement = document.getElementById(errorId);
    
    if (!field.value.trim()) {
      fieldContainer.classList.add("field--error");
      field.classList.add("field__control--error");
      if (errorElement) errorElement.style.display = "block";
      return false;
    } else {
      fieldContainer.classList.remove("field--error");
      field.classList.remove("field__control--error");
      if (errorElement) errorElement.style.display = "none";
      return true;
    }
  };

  // Email validation
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  button.addEventListener("click", (e) => {
    e.preventDefault();

    // Validate required fields
    const isTopicValid = validateField(topicField, "topic-error", "topic-field");
    const isNameValid = validateField(nameField, "name-error", "name-field");
    const isEmailValid = validateField(emailField, "email-error", "email-field") && validateEmail(emailField.value);
    const isMessageValid = validateField(messageField, "message-error", "message-field");

    // Check email format
    if (emailField.value.trim() && !validateEmail(emailField.value)) {
      document.getElementById("email-field").classList.add("field--error");
      emailField.classList.add("field__control--error");
      document.getElementById("email-error").textContent = "Please enter a valid email";
      document.getElementById("email-error").style.display = "block";
    }

    if (!isTopicValid || !isNameValid || !isEmailValid || !isMessageValid) {
      // Shake the button to indicate error
      button.classList.add("shake");
      setTimeout(() => button.classList.remove("shake"), 500);
      return;
    }

    // Build email content
    const subject = `SimpleTCF Contact: ${topicField.value}`;
    const fullName = surnameField.value ? `${nameField.value} ${surnameField.value}` : nameField.value;
    const body = `Name: ${fullName}%0D%0AEmail: ${emailField.value}%0D%0A${phoneField.value ? `Phone: ${phoneField.value}%0D%0A` : ""}%0D%0AMessage:%0D%0A${messageField.value}`;

    // Create mailto link
    const mailtoLink = `mailto:info@simpletcf.com?subject=${encodeURIComponent(subject)}&body=${body}`;

    // Animate button
    button.classList.add("onclic");
    setTimeout(() => {
      button.classList.remove("onclic");
      button.classList.add("validate");
      
      // Open email client
      window.location.href = mailtoLink;
      
      // Reset form after a delay
      setTimeout(() => {
        button.classList.remove("validate");
        form.reset();
      }, 1750);
    }, 500);
  });
});

/* -------------------------------------------------
   7) Pricing CTA → Checkout (URL + sessionStorage)
   (homepage; safe to run everywhere)
---------------------------------------------------*/
run("pricing-to-checkout", () => {
  const ctas = document.querySelectorAll(".price__cta");
  if (!ctas.length) return;

  const parseMoney = (s) => {
    if (typeof s !== "string") return 0;
    const cleaned = s.replace(/[^\d.,-]/g, "");
    const normalized =
      cleaned.indexOf(",") > -1 && cleaned.indexOf(".") === -1
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  };

  const findTextNearby = (startEl, selector) => {
    const card = startEl.closest(".price");
    const el = card?.querySelector(selector);
    return el ? el.textContent.trim() : "";
  };

  const findPriceNearby = (startEl, selector) => {
    const card = startEl.closest(".price");
    const el = card?.querySelector(selector);
    if (!el) return "";
    return el.textContent.replace(/\s+/g, "").trim();
  };

  ctas.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const plan = btn.dataset.plan || findTextNearby(btn, ".price__title");
      const duration =
        btn.dataset.duration || findTextNearby(btn, ".price__people");
      const priceStr =
        btn.dataset.price || findPriceNearby(btn, ".price__discount") || "";
      const strikeStr =
        btn.dataset.strike || findTextNearby(btn, ".price__strike") || "";

      const price = parseMoney(priceStr);
      const strike = strikeStr ? parseMoney(strikeStr) : "";

      const checkoutItem = {
        id: `plan:${encodeURIComponent(plan)}`,
        name: plan,
        duration,
        price,
        strike: strike || null,
        quantity: 1,
        feeRate: 0.025,
      };

      try {
        sessionStorage.setItem("checkoutItem", JSON.stringify(checkoutItem));
      } catch {}

      const qp = new URLSearchParams({
        plan,
        duration,
        price: String(price),
        ...(strike ? { strike: String(strike) } : {}),
      });

      window.location.href = `/checkout.html?${qp.toString()}`;
    });
  });
});

// =======================
// Auth helpers
// =======================
function getFirebaseAuthUser() {
  const fbKey = Object.keys(localStorage).find((k) =>
    k.startsWith("firebase:authUser"),
  );
  if (!fbKey) return null;
  try {
    return JSON.parse(localStorage.getItem(fbKey));
  } catch {
    return null;
  }
}

function isLoggedIn() {
  const fbUser = getFirebaseAuthUser();
  return !!(fbUser && fbUser.email);
}

// =======================
// Pricing click -> checkout (with optional auth gate)
// =======================
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".price__cta").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();

      const price = parseFloat(button.dataset.price || "0");
      const duration = button.dataset.duration || "";
      const badge = button.dataset.badge || "Free";

      const checkoutUrl = new URL("/checkout.html", window.location.origin);
      checkoutUrl.searchParams.set("price", String(price));
      checkoutUrl.searchParams.set("duration", duration);
      checkoutUrl.searchParams.set("badge", badge);

      // fallback for checkout.js
      localStorage.setItem(
        "checkout_selection",
        JSON.stringify({ price, duration, badge })
      );

      // 🔒 ALWAYS auth-gate (for ALL plans)
      if (!isLoggedIn()) {
        const loginUrl = new URL("/login.html", window.location.origin);
        loginUrl.searchParams.set("next", checkoutUrl.pathname + checkoutUrl.search);
        window.location.href = loginUrl.toString();
        return;
      }

      window.location.href = checkoutUrl.toString();
    });
  });

});

// =======================
// Pricing carousel (3 cards visible on desktop)
// =======================
document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.getElementById("pricingViewport");
  const dotsWrap = document.getElementById("pricingDots");
  const prevBtn = document.querySelector('[data-pricing-dir="prev"]');
  const nextBtn = document.querySelector('[data-pricing-dir="next"]');

  if (!viewport || !dotsWrap || !prevBtn || !nextBtn) return;

  const slides = Array.from(viewport.querySelectorAll(".price"));
  let index = 0;

  const getGap = () => parseFloat(getComputedStyle(viewport).gap || "0");

  const perView = () => {
    if (window.innerWidth <= 767) return 1;
    if (window.innerWidth <= 991) return 2;
    return 3;
  };

  const clampIndex = () => {
    const max = Math.max(0, slides.length - perView());
    index = Math.min(Math.max(index, 0), max);
    return max;
  };

  const slideStepPx = () => {
    const first = slides[0];
    if (!first) return 0;
    return first.getBoundingClientRect().width + getGap();
  };

  const renderDots = () => {
    const max = clampIndex();
    dotsWrap.innerHTML = "";

    for (let i = 0; i <= max; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-current", i === index ? "true" : "false");
      dot.addEventListener("click", () => {
        index = i;
        update();
      });
      dotsWrap.appendChild(dot);
    }
  };

  const updateDots = () => {
    dotsWrap.querySelectorAll("button").forEach((b, i) => {
      b.setAttribute("aria-current", i === index ? "true" : "false");
    });
  };

  const update = () => {
    clampIndex();
    const step = slideStepPx();
    viewport.style.transform = `translateX(-${index * step}px)`;
    renderDots();
    updateDots();
  };

  prevBtn.addEventListener("click", () => {
    index -= 1;
    update();
  });

  nextBtn.addEventListener("click", () => {
    index += 1;
    update();
  });

  window.addEventListener("resize", () => {
    index = 0;
    viewport.style.transform = "translateX(0px)";
    update();
  });

  update();
});
