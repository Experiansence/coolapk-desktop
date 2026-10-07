/** Keep layout writes out of ResizeObserver's notification phase. */
export function observeResizeOnFrame(element: Element, update: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  let frame: number | null = null;
  let stopped = false;
  const observer = new ResizeObserver(() => {
    if (stopped || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!stopped) update();
    });
  });
  observer.observe(element);
  return () => {
    stopped = true;
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
}
