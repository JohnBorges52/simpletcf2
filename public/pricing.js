// pricing.js
(() => {
  function getFirebaseAuthUser() {
    const fbKey = Object.keys(localStorage).find((k) =>
      k.startsWith("firebase:authUser")
    );
    if (!fbKey) return null;
    try {
      return JSON.parse(localStorage.getItem(fbKey));
    } catch {
      return null;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // ...existing code...

    // Carousel logic (copiado do plan.js)
    function initPlansCarousel() {
      const carousels = document.querySelectorAll(".plan-carousel");
      carousels.forEach((carousel) => {
        const track = carousel.querySelector(".plan-grid--carousel");
        const prev = carousel.querySelector(".plan-carousel__btn--prev");
        const next = carousel.querySelector(".plan-carousel__btn--next");
        if (!track || !prev || !next) return;
        const cards = Array.from(track.querySelectorAll(".plan"));
        if (!cards.length) return;
        let index = 0;
        const visibleCount = () =>
          window.matchMedia("(max-width: 900px)").matches ? 1 : 3;
        function clampIndex(i) {
          const max = Math.max(0, cards.length - visibleCount());
          return Math.max(0, Math.min(i, max));
        }
        function gapPx() {
          const cs = getComputedStyle(track);
          return parseFloat(cs.gap || "0") || 0;
        }
        function stepPx() {
          const cardW = cards[0].getBoundingClientRect().width;
          return cardW + gapPx();
        }
        function render() {
          index = clampIndex(index);
          const x = stepPx() * index;
          track.style.transform = `translateX(${-x}px)`;
          const max = Math.max(0, cards.length - visibleCount());
          prev.disabled = index <= 0;
          next.disabled = index >= max;
        }
        prev.addEventListener("click", () => {
          index -= 1;
          render();
        });
        next.addEventListener("click", () => {
          index += 1;
          render();
        });
        window.addEventListener("resize", () => render());
        requestAnimationFrame(render);
      });
    }
    initPlansCarousel();
  });
})();
