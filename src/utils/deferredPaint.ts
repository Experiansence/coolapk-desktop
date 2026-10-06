import type { ObjectDirective } from 'vue';

// 先测量真实高度，再让浏览器跳过离屏绘制；不销毁卡片或评论状态。
const elements = new Set<HTMLElement>();
let observer: ResizeObserver | null = null;
const stops = new WeakMap<HTMLElement, () => void>();
const measurements = new Map<HTMLElement, number>();
let paintFrame: number | null = null;

function schedulePaint() {
  if (paintFrame !== null) return;
  // ResizeObserver 的通知阶段只读取尺寸；改变布局必须放到下一帧，避免再次触发同轮测量。
  paintFrame = requestAnimationFrame(() => {
    paintFrame = null;
    for (const [target, height] of measurements) {
      if (!elements.has(target)) continue;
      const size = `auto ${height}px`;
      if (target.style.containIntrinsicBlockSize !== size) target.style.containIntrinsicBlockSize = size;
      if (target.style.contentVisibility !== 'auto') target.style.contentVisibility = 'auto';
    }
    measurements.clear();
  });
}

function stop(el: HTMLElement) {
  stops.get(el)?.();
  stops.delete(el);
}

function start(el: HTMLElement) {
  if (stops.has(el) || typeof ResizeObserver === 'undefined'
    || typeof CSS === 'undefined' || !CSS.supports('content-visibility', 'auto')) return;
  const visibility = el.style.contentVisibility;
  const intrinsicSize = el.style.containIntrinsicBlockSize;
  observer ??= new ResizeObserver(entries => {
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      if (!elements.has(target) || entry.contentRect.height <= 0) continue;
      measurements.set(target, entry.contentRect.height);
    }
    if (measurements.size) schedulePaint();
  });
  elements.add(el);
  observer.observe(el);
  stops.set(el, () => {
    elements.delete(el);
    measurements.delete(el);
    observer?.unobserve(el);
    el.style.contentVisibility = visibility;
    el.style.containIntrinsicBlockSize = intrinsicSize;
    if (!elements.size) {
      if (paintFrame !== null) cancelAnimationFrame(paintFrame);
      paintFrame = null;
      measurements.clear();
      observer?.disconnect();
      observer = null;
    }
  });
}

export const vDeferredPaint: ObjectDirective<HTMLElement, boolean> = {
  mounted(el, binding) { if (binding.value) start(el); },
  updated(el, binding) { if (binding.value) start(el); else stop(el); },
  beforeUnmount(el) { stop(el); },
};
