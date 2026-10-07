/** Web equivalent of the APK's selectableItemBackground feedback. */
export function discoveryRipple(event: PointerEvent | KeyboardEvent) {
  if (window.innerWidth > 720 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (event instanceof KeyboardEvent && (!['Enter', ' '].includes(event.key) || event.repeat)) return;
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('.discovery-mini-grid-item, .discovery-pill-btn, .tab-item, .discovery-group-header button, .carousel-viewport, .ranking-featured, .ranking-products, .discovery-ranking-card header button, .discovery-secondhand-feed, .discovery-square-links button');
  if (!target || target.closest('.prevent-mobile-layout')) return;
  const rect = target.getBoundingClientRect();
  const pointer = 'clientX' in event;
  const x = pointer ? event.clientX - rect.left : rect.width / 2;
  const y = pointer ? event.clientY - rect.top : rect.height / 2;
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
  const ripple = document.createElement('span');
  ripple.setAttribute('aria-hidden', 'true');
  Object.assign(ripple.style, { position: 'absolute', pointerEvents: 'none', borderRadius: '50%', background: 'currentColor', width: `${radius * 2}px`, height: `${radius * 2}px`, left: `${x - radius}px`, top: `${y - radius}px`, zIndex: '1' });
  target.append(ripple);
  if (!ripple.animate) { ripple.remove(); return; }
  const animation = ripple.animate([{ transform: 'scale(0)', opacity: .16 }, { transform: 'scale(1)', opacity: .1, offset: .65 }, { transform: 'scale(1)', opacity: 0 }], { duration: 450, easing: 'cubic-bezier(.4,0,.2,1)' });
  void animation.finished.then(() => ripple.remove(), () => ripple.remove());
}
