import { afterEach, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { vDeferredPaint } from '../deferredPaint';

afterEach(() => vi.unstubAllGlobals());
const entry = (target: HTMLElement, height: number): ResizeObserverEntry => ({
  target, contentRect: new DOMRect(0, 0, 100, height),
  borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [],
});

it('measures before skipping paint, restores expanded cards, and shares/cleans the observer', async () => {
  let notify!: ResizeObserverCallback;
  const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
  const ResizeMock = vi.fn(function(callback: ResizeObserverCallback) {
    notify = callback;
    return { observe, unobserve, disconnect };
  });
  vi.stubGlobal('ResizeObserver', ResizeMock);
  vi.stubGlobal('CSS', { supports: () => true });
  let paint!: FrameRequestCallback;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => { paint = callback; return 1; });
  const cancelFrame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  const enabled = ref(true);
  const wrapper = mount(defineComponent({
    directives: { deferredPaint: vDeferredPaint },
    setup: () => ({ enabled }),
    template: '<div><article v-deferred-paint="enabled"/><article v-deferred-paint="enabled"/></div>',
  }));
  const cards = wrapper.findAll('article').map(c => c.element as HTMLElement);
  expect(ResizeMock).toHaveBeenCalledTimes(1);
  expect(cards[0].style.contentVisibility).toBe('');
  notify(cards.map(target => entry(target, 350)), {} as ResizeObserver);
  expect(cards[0].style.containIntrinsicBlockSize).toBe('');
  expect(cards[0].style.contentVisibility).toBe('');
  notify([entry(cards[0], 400)], {} as ResizeObserver);
  expect(requestFrame).toHaveBeenCalledTimes(1);
  paint(0);
  expect(cards[0].style.containIntrinsicBlockSize).toBe('auto 400px');
  expect(cards[1].style.containIntrinsicBlockSize).toBe('auto 350px');
  expect(cards[0].style.contentVisibility).toBe('auto');
  enabled.value = false;
  await nextTick();
  expect(cards[0].style.contentVisibility).toBe('');
  expect(cards[0].style.containIntrinsicBlockSize).toBe('');
  expect(disconnect).toHaveBeenCalledTimes(1);
  notify([entry(cards[0], 500)], {} as ResizeObserver);
  expect(cards[0].style.contentVisibility).toBe('');
  enabled.value = true;
  await nextTick();
  expect(ResizeMock).toHaveBeenCalledTimes(2);
  notify([entry(cards[0], 500)], {} as ResizeObserver);
  wrapper.unmount();
  expect(cancelFrame).toHaveBeenCalledWith(1);
  paint(0);
  expect(cards[0].style.contentVisibility).toBe('');
  expect(unobserve).toHaveBeenCalledTimes(4);
  expect(disconnect).toHaveBeenCalledTimes(2);
});

it('leaves ordinary rendering unchanged on unsupported WebViews', () => {
  vi.stubGlobal('ResizeObserver', undefined);
  const wrapper = mount(defineComponent({ directives: { deferredPaint: vDeferredPaint }, template: '<article v-deferred-paint="true" />' }));
  expect((wrapper.element as HTMLElement).style.contentVisibility).toBe('');
  wrapper.unmount();
});
