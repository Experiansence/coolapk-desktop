import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../stores/app';
import ImageViewer from '../ImageViewer.vue';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/api/app', () => ({
  onBackButtonPress: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('../../../utils/resourceCache', () => ({
  loadImageResource: vi.fn(async (url: string) => `data:image/png;base64,${btoa(url)}`),
  normalizeResourceUrl: (url: string) => url,
}));

interface Point {
  clientX: number;
  clientY: number;
}

function point(clientX: number, clientY: number): Point {
  return { clientX, clientY };
}

/** jsdom 没有 TouchEvent，这里手工挂 touches 后派发同名事件。 */
function dispatchTouch(target: Element, type: string, touches: Point[]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches });
  target.dispatchEvent(event);
}

async function mountViewer(count = 3, index = 0) {
  const store = useAppStore();
  const wrapper = mount(ImageViewer, { global: { stubs: { Teleport: true } } });
  // 与线上一致：先挂载再打开，触发 viewerData 侦听器同步 currentIndex。
  store.openImageViewer(
    Array.from({ length: count }, (_, i) => `https://img.example/${i}.jpg`),
    index,
  );
  await flushPromises();
  return { wrapper, store, stage: wrapper.get('.image-stage').element };
}

async function swipe(stage: Element, from: Point, to: Point) {
  dispatchTouch(stage, 'touchstart', [from]);
  dispatchTouch(stage, 'touchmove', [to]);
  dispatchTouch(stage, 'touchend', []);
  await flushPromises();
}

function counter(wrapper: ReturnType<typeof mount>): string {
  return wrapper.get('.counter-text').text();
}

describe('图片查看器触摸手势', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('单指左滑切换到下一张', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);
    expect(counter(wrapper)).toBe('1 / 3');

    await swipe(stage, point(300, 400), point(180, 405));

    expect(counter(wrapper)).toBe('2 / 3');
    wrapper.unmount();
  });

  it('单指右滑回到上一张', async () => {
    const { wrapper, stage } = await mountViewer(3, 2);
    expect(counter(wrapper)).toBe('3 / 3');

    await swipe(stage, point(120, 400), point(260, 395));

    expect(counter(wrapper)).toBe('2 / 3');
    wrapper.unmount();
  });

  it('位移不足阈值时不切图', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);

    await swipe(stage, point(300, 400), point(272, 402));

    expect(counter(wrapper)).toBe('1 / 3');
    wrapper.unmount();
  });

  it('上滑既不切图也不关闭', async () => {
    const { wrapper, store, stage } = await mountViewer(3, 0);

    await swipe(stage, point(200, 400), point(120, 200));

    expect(counter(wrapper)).toBe('1 / 3');
    expect(store.activeImageViewer).not.toBeNull();
    wrapper.unmount();
  });

  it('放大后横滑是平移而不是切图', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);
    await wrapper.get('.image-stage').trigger('dblclick');

    await swipe(stage, point(300, 400), point(180, 400));

    expect(counter(wrapper)).toBe('1 / 3');
    expect(wrapper.get('.viewer-img').attributes('style')).toContain('translate(-120px');
    wrapper.unmount();
  });

  it('第一张继续右滑有边界阻尼且不会越界', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);

    await swipe(stage, point(200, 400), point(340, 400));

    expect(counter(wrapper)).toBe('1 / 3');
    wrapper.unmount();
  });

  it('滑动结束后的补发点击不会误关查看器', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { wrapper, store, stage } = await mountViewer(3, 1);

    await swipe(stage, point(300, 400), point(180, 400));
    expect(counter(wrapper)).toBe('3 / 3');

    await wrapper.get('.image-viewer-backdrop').trigger('click');
    expect(store.activeImageViewer).not.toBeNull();

    now.mockReturnValue(1_000_500);
    await wrapper.get('.image-viewer-backdrop').trigger('click');
    expect(store.activeImageViewer).toBeNull();
    wrapper.unmount();
  });

  it('没有滑动时点击背景仍然关闭查看器', async () => {
    const { wrapper, store } = await mountViewer(3, 0);

    await wrapper.get('.image-viewer-backdrop').trigger('click');

    expect(store.activeImageViewer).toBeNull();
    wrapper.unmount();
  });

  it('多指手势不触发切图', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);

    dispatchTouch(stage, 'touchstart', [point(300, 400)]);
    dispatchTouch(stage, 'touchmove', [
      point(180, 400),
      point(320, 420),
    ]);
    dispatchTouch(stage, 'touchend', []);
    await flushPromises();

    expect(counter(wrapper)).toBe('1 / 3');
    wrapper.unmount();
  });

  it('触摸取消不切图', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);

    dispatchTouch(stage, 'touchstart', [point(300, 400)]);
    dispatchTouch(stage, 'touchmove', [point(150, 400)]);
    dispatchTouch(stage, 'touchcancel', []);
    await flushPromises();

    expect(counter(wrapper)).toBe('1 / 3');
    wrapper.unmount();
  });

  it('双指捏合按距离比例缩放', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);

    dispatchTouch(stage, 'touchstart', [point(200, 300), point(240, 300)]);
    dispatchTouch(stage, 'touchmove', [point(180, 300), point(260, 300)]);
    await flushPromises();

    expect(wrapper.get('.viewer-img').attributes('style')).toContain('scale(2');

    // 捏合结束后不切换图片。
    dispatchTouch(stage, 'touchend', []);
    await flushPromises();
    expect(counter(wrapper)).toBe('1 / 3');
    wrapper.unmount();
  });

  it('捏合缩放上限被夹住', async () => {
    const { wrapper, stage } = await mountViewer(3, 0);

    dispatchTouch(stage, 'touchstart', [point(200, 300), point(210, 300)]);
    dispatchTouch(stage, 'touchmove', [point(100, 300), point(310, 300)]);
    await flushPromises();

    expect(wrapper.get('.viewer-img').attributes('style')).toContain('scale(4)');
    wrapper.unmount();
  });

  it('双击放大到 1.8 倍，再双击还原', async () => {
    let clock = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const { wrapper, stage } = await mountViewer(3, 0);

    const tap = async () => {
      dispatchTouch(stage, 'touchstart', [point(300, 400)]);
      dispatchTouch(stage, 'touchend', []);
      await flushPromises();
    };

    await tap();
    clock += 120;
    await tap();
    expect(wrapper.get('.viewer-img').attributes('style')).toContain('scale(1.8)');

    clock += 120;
    await tap();
    clock += 120;
    await tap();
    expect(wrapper.get('.viewer-img').attributes('style')).toContain('scale(1)');

    wrapper.unmount();
  });

  it('两次点击间隔过长不会触发双击缩放', async () => {
    let clock = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const { wrapper, stage } = await mountViewer(3, 0);

    dispatchTouch(stage, 'touchstart', [point(300, 400)]);
    dispatchTouch(stage, 'touchend', []);
    await flushPromises();
    clock += 900;
    dispatchTouch(stage, 'touchstart', [point(300, 400)]);
    dispatchTouch(stage, 'touchend', []);
    await flushPromises();

    expect(wrapper.get('.viewer-img').attributes('style')).toContain('scale(1)');
    wrapper.unmount();
  });

  it('单指下滑超过阈值关闭查看器', async () => {
    const { wrapper, store, stage } = await mountViewer(3, 1);

    dispatchTouch(stage, 'touchstart', [point(200, 300)]);
    dispatchTouch(stage, 'touchmove', [point(205, 500)]);
    dispatchTouch(stage, 'touchend', []);
    await flushPromises();

    expect(store.activeImageViewer).toBeNull();
    wrapper.unmount();
  });

  it('单指下滑不足阈值只回弹不关闭', async () => {
    const { wrapper, store, stage } = await mountViewer(3, 1);

    dispatchTouch(stage, 'touchstart', [point(200, 300)]);
    dispatchTouch(stage, 'touchmove', [point(205, 380)]);
    dispatchTouch(stage, 'touchend', []);
    await flushPromises();

    expect(store.activeImageViewer).not.toBeNull();
    expect(wrapper.get('.viewer-img').attributes('style')).toContain('translate(0px, 0px)');
    wrapper.unmount();
  });
});
