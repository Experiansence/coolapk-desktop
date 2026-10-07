import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiscoveryPager from '../DiscoveryPager.vue';

const tabs = ['life', 'picture', 'goods'].map(key => ({ key, title: key, url: key, visible: true, order: 0, raw: {} }));
let frames = new Map<number, FrameRequestCallback>(), id = 0;
function pointer(target: Element, type: string, x: number, y = 100) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: 'touch' } });
  target.dispatchEvent(event);
}
describe('发现频道滑动', () => {
  beforeEach(() => {
    frames = new Map(); id = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const render = () => mount(DiscoveryPager, { props: { tabs, activeKey: 'life' }, slots: { default: '<div class="content">内容<button>入口</button><div data-discovery-horizontal-scroll>分类</div></div>' } });
  it('横滑同步下划线进度，松手选择下一频道并阻止误点击', async () => {
    const w = render();
    pointer(w.find('button').element, 'pointerdown', 280);
    pointer(w.element, 'pointermove', 100);
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(0));
    await nextTick();
    expect(w.emitted('progress')?.at(-1)).toEqual([.5]);
    pointer(w.element, 'pointerup', 100);
    expect(w.emitted('select')?.at(-1)).toEqual(['picture']);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    w.find('button').element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    w.unmount();
  });
  it('纵向滚动、分类横滑与首频道向右滑均不切换频道', () => {
    const w = render();
    pointer(w.element, 'pointerdown', 200);
    pointer(w.element, 'pointermove', 198, 140);
    pointer(w.element, 'pointerup', 180, 180);
    expect(w.emitted('select')).toBeUndefined();
    pointer(w.find('[data-discovery-horizontal-scroll]').element, 'pointerdown', 200);
    pointer(w.element, 'pointermove', 50);
    pointer(w.element, 'pointerup', 50);
    expect(w.emitted('select')).toBeUndefined();
    pointer(w.element, 'pointerdown', 100);
    pointer(w.element, 'pointermove', 280);
    pointer(w.element, 'pointerup', 280);
    expect(w.emitted('select')?.at(-1)).toEqual(['life']);
    w.unmount();
  });
  it('切换后保留频道 DOM 和滚动位置，隐藏页不可交互', async () => {
    const w = render(), content = w.find('.content').element;
    content.scrollTop = 120;
    await w.setProps({ activeKey: 'picture' });
    expect(w.find('.content').element).toBe(content);
    expect(content.scrollTop).toBe(120);
    expect(w.findAll('section')[0].attributes('inert')).toBeDefined();
    expect(w.findAll('section')[1].attributes('inert')).toBeUndefined();
    w.unmount();
  });
  it('连续移动每帧只写一次动画，不触发内容重新渲染或加载', async () => {
    const renderContent = vi.fn(() => '频道内容');
    const w = mount(DiscoveryPager, { props: { tabs, activeKey: 'life' }, slots: { default: renderContent } });
    const initialRenders = renderContent.mock.calls.length;
    pointer(w.element, 'pointerdown', 280);
    pointer(w.element, 'pointermove', 200);
    pointer(w.element, 'pointermove', 100);
    expect(frames.size).toBe(1);
    expect(w.emitted('prepare')).toBeUndefined();
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(0));
    await nextTick();
    expect(renderContent).toHaveBeenCalledTimes(initialRenders);
    expect(w.get('.discovery-pager-track').attributes('style')).toContain('-180px');
    w.unmount();
    expect(frames.size).toBe(0);
  });
});
