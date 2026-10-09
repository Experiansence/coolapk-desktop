import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DigitalPage from '../DigitalPage.vue';
import DiscoveryPager from '../../components/discovery/DiscoveryPager.vue';

const api = vi.hoisted(() => ({ getTabConfig: vi.fn(), getDiscoveryPageData: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('vue-router', async importOriginal => ({ ...await importOriginal<typeof import('vue-router')>(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../utils/anchorClick', () => ({ handleAnchorClick: vi.fn() }));
vi.mock('../../stores/settings', () => ({ useSettingsStore: () => ({ settings: { disableAutoMobileMode: false } }) }));
vi.mock('../../utils/platform', () => ({ isTouchMobilePlatform: () => false }));

beforeEach(() => {
  localStorage.clear();
  api.getTabConfig.mockReset().mockResolvedValue({ data: [{ entityTemplate: 'configCard', title: '数码', entities: ['PHONE', 'TABLET', 'PC'].map(key => ({ title: key, pageName: `V10_${key}`, url: `V10_${key}` })) }] });
  api.getDiscoveryPageData.mockReset().mockImplementation(({ url }) => Promise.resolve({ data: [{ id: url, title: url }], hasMore: false }));
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal('ResizeObserver', undefined);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const render = () => mount(DigitalPage, { global: { stubs: { FeedTabs: { props: ['activeKey', 'swipeProgress'], template: '<nav :data-active="activeKey" />' }, MobileDigitalCard: { props: ['entity'], template: '<article>{{ entity.title }}</article>' }, DigitalProductCard: true, DiscoveryEntityCard: true } } });

it('移动数码复用滑动容器，切换后保留原栏目并且只获取一次配置', async () => {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(360);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
  const wrapper = render();
  try {
    await flushPromises();
    const pager = wrapper.findComponent(DiscoveryPager);
    Object.assign(pager.element, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
    expect(pager.exists()).toBe(true);
    expect(api.getTabConfig).toHaveBeenCalledTimes(1);
    const firstPage = wrapper.findAll('.discovery-pager-page')[0].element;
    // 发送真实触摸指针序列，验证手势最终连通栏目选择与请求流程。
    for (const [type, x] of [['pointerdown', 280], ['pointermove', 100], ['pointerup', 100]] as const) {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 100 });
      Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: 'touch' } });
      pager.element.dispatchEvent(event);
    }
    await flushPromises();
    expect(wrapper.get('nav').attributes('data-active')).toBe('V10_TABLET');
    expect(wrapper.findAll('.discovery-pager-page')[0].element).toBe(firstPage);
    pager.vm.$emit('select', 'V10_PHONE');
    await flushPromises();
    expect(api.getDiscoveryPageData.mock.calls.filter(([args]) => args.url === 'V10_PHONE')).toHaveLength(1);
    expect(api.getTabConfig).toHaveBeenCalledTimes(1);
  } finally { wrapper.unmount(); }
});

it('桌面数码继续直接展示当前栏目', async () => {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
  const wrapper = render();
  try {
    await flushPromises();
    expect(wrapper.findComponent(DiscoveryPager).exists()).toBe(false);
    expect(api.getDiscoveryPageData).toHaveBeenCalledTimes(1);
  } finally { wrapper.unmount(); }
});
