// tcf-exam.js
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

/* ===========================
   Scroll reveal (IntersectionObserver)
=========================== */
function enableScrollReveal() {
  // Respect reduced-motion preference
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) return;

  // 1) Mark main blocks as reveal
  const blocks = [
    ".tcf-hero",
    ".tcf-section",
    ".tcf-eval",
    ".tcf-grid",
    ".tcf-weight-table",
    ".tcf-toc",
  ];

  $all(blocks.join(",")).forEach((el) => {
    el.classList.add("reveal");
  });

  // Make hero pop a little more
  const hero = $(".tcf-hero");
  if (hero) hero.classList.add("reveal--pop");

  // 2) Add stagger for specific containers (children animate in sequence)
  const staggerTargets = [
    ".tcf-toc",
    ".tcf-meta",
    ".tcf-grid",
    ".tcf-eval__list",
    ".tcf-hero-list",
    ".tcf-weight-table tbody",
  ];

  $all(staggerTargets.join(",")).forEach((container) => {
    container.classList.add("reveal-stagger");

    // Apply delays to direct children
    const kids = Array.from(container.children);
    kids.forEach((child, i) => {
      // 60ms step, capped so huge tables don't take forever
      const delay = Math.min(i * 60, 600);
      child.style.setProperty("--d", `${delay}ms`);
    });
  });

  // 3) Observe everything marked as reveal or reveal-stagger
  const observed = $all(".reveal, .reveal-stagger");

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-inview");
          // Optional: animate once only
          io.unobserve(entry.target);

          // If it's a section, also add the inview class for shadow polish
          if (entry.target.classList.contains("tcf-section")) {
            entry.target.classList.add("is-inview");
          }
        }
      });
    },
    {
      root: null,
      // Trigger slightly before fully in view
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    },
  );

  observed.forEach((el) => io.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  setAuthNavFromLocalStorage();
  enableScrollReveal();
});
document.addEventListener("DOMContentLoaded", () => {
  setAuthNavFromLocalStorage();

  // Page fade-in (first load)
  requestAnimationFrame(() => {
    document.body.classList.add("is-loaded");
  });

  enableScrollReveal();
});
