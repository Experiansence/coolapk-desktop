import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useIosBackGesture } from '../useIosBackGesture';

function touch(element: Element, type: string, x: number, y: number, count = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const points = Array.from({ length: count }, (_, identifier) => ({ clientX: x, clientY: y, identifier }));
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' ? [] : points },
    changedTouches: { value: points },
  });
  element.dispatchEvent(event);
  return event;
}
async function setup() {
  const enabled = ref(true);
  const back = vi.fn();
  const wrapper = mount(defineComponent({
    setup() {
      const surface = ref<HTMLElement | null>(null);
      useIosBackGesture(surface, () => enabled.value, back);
      return { surface };
    },
    template: '<main ref="surface"><div class="body">正文</div><input /></main>',
  }));
  await nextTick();
  return { wrapper, enabled, back, surface: wrapper.get('.body').element };
}

describe('iOS 左边缘返回手势', () => {
  it('从左边缘右滑足够距离只返回一次，并阻止横向滚动', async () => {
    const { wrapper, surface, back } = await setup();
    touch(surface, 'touchstart', 10, 100);
    expect(touch(surface, 'touchmove', 100, 110).defaultPrevented).toBe(true);
    touch(surface, 'touchend', 100, 110);
    touch(surface, 'touchend', 100, 110);
    expect(back).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it.each([
    [100, 100, 200, 100], // 正文中部起手
    [10, 100, 50, 100], // 距离不足
    [10, 100, 0, 100], // 向左滑
    [10, 100, 100, 250], // 纵向滚动
  ])('忽略普通滚动或未完成的手势 %s,%s → %s,%s', async (x, y, endX, endY) => {
    const { wrapper, surface, back } = await setup();
    touch(surface, 'touchstart', x, y);
    touch(surface, 'touchmove', endX, endY);
    touch(surface, 'touchend', endX, endY);
    expect(back).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('纵向滚动锁定后即使转向右滑也不返回', async () => {
    const { wrapper, surface, back } = await setup();
    touch(surface, 'touchstart', 10, 100);
    touch(surface, 'touchmove', 12, 140);
    touch(surface, 'touchend', 120, 140);
    expect(back).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('多指、触摸取消、输入框和禁用期间均不返回', async () => {
    const { wrapper, surface, back, enabled } = await setup();
    touch(surface, 'touchstart', 10, 100);
    touch(surface, 'touchmove', 100, 100, 2);
    touch(surface, 'touchend', 100, 100);
    touch(surface, 'touchstart', 10, 100);
    touch(surface, 'touchcancel', 100, 100);
    touch(surface, 'touchend', 100, 100);
    touch(wrapper.get('input').element, 'touchstart', 10, 100);
    touch(surface, 'touchend', 100, 100);
    touch(surface, 'touchstart', 10, 100);
    enabled.value = false;
    touch(surface, 'touchend', 100, 100);
    enabled.value = true;
    touch(surface, 'touchend', 100, 100);
    expect(back).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('卸载时清除监听和未完成的手势', async () => {
    const { wrapper, surface, back } = await setup();
    touch(surface, 'touchstart', 10, 100);
    wrapper.unmount();
    touch(surface, 'touchend', 100, 100);
    expect(back).not.toHaveBeenCalled();
  });
});
