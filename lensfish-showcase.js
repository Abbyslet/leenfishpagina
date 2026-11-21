(() => {
  const reveal = document.querySelectorAll('[data-reveal]');
  if (!window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reveal.forEach((element) => element.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.13 });
    reveal.forEach((element) => observer.observe(element));
  }
})();
