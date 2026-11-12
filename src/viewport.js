export function installViewportLayout() {
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) if (entry.contentRect.height > 0) entry.target.style.setProperty('--tower-height', `${entry.contentRect.height}px`);
  });
  document.querySelectorAll('.tower-zone').forEach(zone => observer.observe(zone));
}
