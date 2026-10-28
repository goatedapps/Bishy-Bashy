export function installViewportLayout() {
  const update = () => {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty('--viewport-height', `${viewport?.height || window.innerHeight}px`);
  };
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) if (entry.contentRect.height > 0) entry.target.style.setProperty('--tower-height', `${entry.contentRect.height}px`);
  });
  document.querySelectorAll('.tower-zone').forEach(zone => observer.observe(zone));
  update();
}
