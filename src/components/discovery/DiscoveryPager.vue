<template>
  <div ref="viewport" class="discovery-pager" @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @touchmove="preventSwipeScroll" @click.capture="blockClick">
    <div class="discovery-pager-track" :style="{ transform: `translate3d(${-position * width}px, 0, 0)` }">
      <section v-for="(tab, index) in tabs" :key="tab.key" class="discovery-pager-page" :style="{ left: `${index * 100}%` }" :inert="index !== activeIndex ? true : undefined" :aria-hidden="index !== activeIndex">
        <slot :tab="tab" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { DiscoveryTab } from '../../types/discovery';

const props = defineProps<{ tabs: DiscoveryTab[]; activeKey: string }>();
const emit = defineEmits<{ select: [key: string]; prepare: [key: string]; progress: [position: number] }>();
const viewport = ref<HTMLElement>();
const width = ref(1), position = ref(0);
const activeIndex = computed(() => Math.max(0, props.tabs.findIndex(tab => tab.key === props.activeKey)));
let observer: ResizeObserver | undefined, animation = 0;
let drag: { id: number; x: number; y: number; time: number; index: number; horizontal: boolean } | undefined;
let suppressClickUntil = 0;

function setPosition(value: number) { position.value = value; emit('progress', value); }
function settle(target: number) {
  cancelAnimationFrame(animation);
  const from = position.value, started = performance.now();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(from - target) < .001) { setPosition(target); return; }
  const tick = (now: number) => {
    const fraction = Math.min(1, (now - started) / 280);
    setPosition(from + (target - from) * (1 - Math.pow(1 - fraction, 3)));
    if (fraction < 1) animation = requestAnimationFrame(tick);
  };
  animation = requestAnimationFrame(tick);
}
function start(event: PointerEvent) {
  if (event.pointerType !== 'touch' || event.isPrimary === false || !viewport.value || viewport.value.closest('.prevent-mobile-layout') || window.innerWidth > 720) return;
  if ((event.target as HTMLElement).closest('input, textarea, a, [data-discovery-horizontal-scroll]')) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), index: activeIndex.value, horizontal: false };
}
function move(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.horizontal) {
    if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { drag = undefined; return; }
    if (Math.abs(dx) <= 8) return;
    drag.horizontal = true;
    cancelAnimationFrame(animation);
    viewport.value?.setPointerCapture(event.pointerId);
  }
  setPosition(Math.max(0, Math.min(props.tabs.length - 1, drag.index - dx / width.value)));
  const neighbor = props.tabs[drag.index + (dx < 0 ? 1 : -1)];
  if (neighbor) emit('prepare', neighbor.key);
}
function finish(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return;
  const gesture = drag; drag = undefined;
  if (!gesture.horizontal) return;
  suppressClickUntil = performance.now() + 350;
  viewport.value?.releasePointerCapture(event.pointerId);
  const dx = event.clientX - gesture.x;
  const fast = Math.abs(dx) > 24 && Math.abs(dx) / Math.max(1, performance.now() - gesture.time) > .35;
  const target = Math.max(0, Math.min(props.tabs.length - 1, gesture.index + (Math.abs(dx) > width.value * .2 || fast ? (dx < 0 ? 1 : -1) : 0)));
  const tab = props.tabs[target];
  if (tab) emit('select', tab.key);
  // 话题 / 网页等入口可能打开新页面，原发现频道仍停留在当前页。
  settle(activeIndex.value);
}
function cancel() {
  if (drag && viewport.value?.hasPointerCapture?.(drag.id)) viewport.value.releasePointerCapture(drag.id);
  drag = undefined; settle(activeIndex.value);
}
function preventSwipeScroll(event: TouchEvent) { if (drag?.horizontal && event.cancelable) event.preventDefault(); }
function blockClick(event: MouseEvent) { if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); } }
watch(activeIndex, value => { if (!drag) settle(value); });
onMounted(() => {
  width.value = viewport.value?.clientWidth || 1;
  setPosition(activeIndex.value);
  observer = new ResizeObserver(() => { width.value = viewport.value?.clientWidth || 1; cancel(); });
  if (viewport.value) observer.observe(viewport.value);
});
onUnmounted(() => { observer?.disconnect(); cancelAnimationFrame(animation); });
</script>

<style scoped>
.discovery-pager { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.discovery-pager-track { position: relative; width: 100%; height: 100%; will-change: transform; }
.discovery-pager-page { position: absolute; top: 0; width: 100%; height: 100%; display: flex; flex-direction: column; min-width: 0; }
</style>
