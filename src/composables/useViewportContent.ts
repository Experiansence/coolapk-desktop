import { computed, nextTick, onActivated, onDeactivated, onUnmounted, ref, watch, type Ref } from 'vue';
import { getResourceScrollRoot } from '../utils/resourceVisibility';

type CardObserver = { visibility: (visible: boolean) => void; resize: () => void };
const cards = new Map<Element, CardObserver & { reobserve: () => void }>();
const observers = new Map<Element | null, { observer: IntersectionObserver; count: number }>();
let resizeFrame = 0;

function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    for (const callback of cards.values()) callback.resize();
    void nextTick(() => {
      for (const callback of cards.values()) callback.reobserve();
    });
  });
}

function observeCard(element: Element, callback: CardObserver) {
  const root = getResourceScrollRoot(element);
  let group = observers.get(root);
  if (!group) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) cards.get(entry.target)?.visibility(entry.isIntersecting);
    }, { root, rootMargin: '2000px 0px' });
    group = { observer, count: 0 };
    observers.set(root, group);
  }
  const cardGroup = group;
  if (!cards.size) window.addEventListener('resize', onResize, { passive: true });
  cardGroup.count += 1;
  cards.set(element, { ...callback, reobserve() {
    cardGroup.observer.unobserve(element);
    cardGroup.observer.observe(element);
  } });
  cardGroup.observer.observe(element);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    cards.delete(element);
    cardGroup.observer.unobserve(element);
    if (--cardGroup.count === 0) {
      cardGroup.observer.disconnect();
      observers.delete(root);
    }
    if (!cards.size) {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(resizeFrame);
    }
  };
}

/** 保留卡片本身的数据和事件接口；只回收未交互的离屏子树。 */
export function useViewportContent(element: Ref<HTMLElement | null>, protectedContent: Ref<boolean>, pageVisible: Ref<boolean> = ref(true)) {
  const nearViewport = ref(true);
  const retained = ref(false);
  const height = ref(0);
  const active = ref(true);
  let stop = () => {};
  const renderViewportContent = computed(() => retained.value || protectedContent.value
    || (active.value && pageVisible.value && (nearViewport.value || !height.value)));
  const viewportPlaceholderStyle = computed(() => renderViewportContent.value || !height.value ? undefined
    : { height: `${height.value}px`, boxSizing: 'border-box' as const });

  function retainViewportContent() { retained.value = true; }
  function observe() {
    stop();
    stop = () => {};
    if (!active.value || !pageVisible.value || !element.value || retained.value || protectedContent.value || typeof IntersectionObserver === 'undefined') return;
    stop = observeCard(element.value, {
      visibility(visible) {
        if (visible) nearViewport.value = true;
        else {
          const selection = window.getSelection();
          if (element.value && selection && !selection.isCollapsed && selection.containsNode(element.value, true)) {
            retainViewportContent();
            return;
          }
          const measured = element.value?.getBoundingClientRect().height || 0;
          if (measured > 0) {
            height.value = measured;
            nearViewport.value = false;
          }
        }
      },
      resize() { height.value = 0; nearViewport.value = true; },
    });
  }
  watch([element, retained, protectedContent, pageVisible], (_, previous) => {
    if (retained.value || protectedContent.value || (pageVisible.value && previous && !previous[3])) nearViewport.value = true;
    observe();
  }, { flush: 'post' });
  onDeactivated(() => { active.value = false; stop(); });
  onActivated(() => { if (!active.value) { active.value = true; nearViewport.value = true; observe(); } });
  onUnmounted(() => { active.value = false; stop(); });
  return { renderViewportContent, viewportPlaceholderStyle, retainViewportContent };
}
