import { onScopeDispose, watch, type Ref } from 'vue';

/** iOS 的路由在同一个 WebView 内切换，因此显式处理左边缘右滑返回。 */
export function useIosBackGesture(
  surface: Ref<HTMLElement | null>,
  enabled: () => boolean,
  onBack: () => void,
): void {
  let start: { x: number; y: number; id: number } | null = null;
  const reset = () => { start = null; };
  const onStart = (event: TouchEvent) => {
    reset();
    if (!enabled() || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const left = surface.value?.getBoundingClientRect().left ?? 0;
    if (touch.clientX < left || touch.clientX - left > 24) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], video, .more-menu')) return;
    start = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
  };
  const onMove = (event: TouchEvent) => {
    if (!start) return;
    const touch = event.touches[0];
    if (!enabled() || event.touches.length !== 1 || touch.identifier !== start.id) { reset(); return; }
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    // 一旦判定为纵向滚动或反向滑动，本次触摸不再转成返回。
    if ((dy > 12 && dy > Math.abs(dx)) || dx < -12) { reset(); return; }
    if (dx > 12 && dx > dy * 1.5 && event.cancelable) event.preventDefault();
  };
  const onEnd = (event: TouchEvent) => {
    const origin = start;
    reset();
    if (!origin || !enabled() || event.touches.length) return;
    const touch = Array.from(event.changedTouches).find(item => item.identifier === origin.id);
    if (!touch) return;
    const dx = touch.clientX - origin.x;
    if (dx >= 72 && dx > Math.abs(touch.clientY - origin.y) * 1.5) onBack();
  };

  const stop = watch(surface, (element, previous) => {
    detach(previous);
    element?.addEventListener('touchstart', onStart, { passive: true });
    element?.addEventListener('touchmove', onMove, { passive: false });
    element?.addEventListener('touchend', onEnd);
    element?.addEventListener('touchcancel', reset);
  }, { immediate: true, flush: 'post' });
  const stopEnabled = watch(enabled, reset, { flush: 'sync' });
  function detach(element: HTMLElement | null | undefined) {
    reset();
    element?.removeEventListener('touchstart', onStart);
    element?.removeEventListener('touchmove', onMove);
    element?.removeEventListener('touchend', onEnd);
    element?.removeEventListener('touchcancel', reset);
  }
  onScopeDispose(() => { stop(); stopEnabled(); detach(surface.value); });
}
