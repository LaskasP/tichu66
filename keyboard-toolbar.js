// Track the visible viewport: iOS and Android can resize it without moving
// controls fixed to the layout viewport when the software keyboard opens.
(() => {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const bar = document.querySelector('.save-row');
  const mobile = matchMedia('(max-width: 540px), (pointer: coarse) and (max-width: 1024px)');
  let frame = 0, revealInput = false;

  function update() {
    frame = 0;
    const active = document.activeElement;
    const editing = active?.matches('#scoreA, #scoreB, #note');
    const tracking = mobile.matches && (!viewport || Math.abs(viewport.scale - 1) < 0.01);
    const bottom = viewport ? viewport.offsetTop + viewport.height : innerHeight;
    const inset = tracking ? Math.max(0, innerHeight - bottom) : 0;
    const barHeight = bar.getBoundingClientRect().height;
    const rect = editing ? active.getBoundingClientRect() : null;
    root.style.setProperty('--keyboard-inset', `${inset}px`);
    root.classList.toggle('keyboard-open', tracking && inset > 80);

    // Reserve room above the action bar as the browser reveals the input.
    // Only do this after focus/resize, so normal scrolling remains under user control.
    if (revealInput && tracking && rect && !document.getElementById('view-game').hidden) {
      const top = (viewport?.offsetTop || 0) + 12;
      const limit = bottom - barHeight - 12;
      if (rect.bottom > limit) window.scrollBy(0, rect.bottom - limit);
      else if (rect.top < top) window.scrollBy(0, rect.top - top);
    }
    revealInput = false;
  }
  function schedule(reveal = false) {
    revealInput ||= reveal;
    if (!frame) frame = requestAnimationFrame(update);
  }
  viewport?.addEventListener('resize', () => schedule(true));
  viewport?.addEventListener('scroll', () => schedule());
  window.addEventListener('resize', () => schedule(true));
  document.addEventListener('focusin', () => schedule(true));
  document.addEventListener('focusout', () => schedule());
  mobile.addEventListener('change', () => schedule(true));
  schedule();
})();
