import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRoute: () => ({ path: '/', fullPath: '/' }),
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));

import AppShell from '../AppShell.vue';
import { useSettingsStore } from '../../../stores/settings';

const TopBarStub = { template: '<div class="top-bar-stub" />' };
const MainSidebarStub = { template: '<div class="main-sidebar-stub" />' };
const PageTabBarStub = { template: '<div class="page-tab-bar-stub" />' };
const NetworkStatusBannerStub = { template: '<div class="network-status-banner-stub" />' };
const MobileTopBarStub = { template: '<div class="mobile-top-bar-stub" />' };
const MobileBottomNavStub = { template: '<div class="mobile-bottom-nav-stub" />' };

describe('AppShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('默认状态下渲染移动端顶栏和底栏，且不包含 prevent-mobile-layout 类名', () => {
    const wrapper = mount(AppShell, {
      global: {
        stubs: {
          TopBar: TopBarStub,
          MainSidebar: MainSidebarStub,
          PageTabBar: PageTabBarStub,
          NetworkStatusBanner: NetworkStatusBannerStub,
          MobileTopBar: MobileTopBarStub,
          MobileBottomNav: MobileBottomNavStub,
        },
      },
    });

    expect(wrapper.classes()).not.toContain('prevent-mobile-layout');
    expect(wrapper.findComponent(MobileTopBarStub).exists()).toBe(true);
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(true);
  });

  it('开启 disableAutoMobileMode 时隐藏移动端顶栏和底栏，且添加 prevent-mobile-layout 类名', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const settingsStore = useSettingsStore(pinia);
    settingsStore.settings.disableAutoMobileMode = true;

    const wrapper = mount(AppShell, {
      global: {
        plugins: [pinia],
        stubs: {
          TopBar: TopBarStub,
          MainSidebar: MainSidebarStub,
          PageTabBar: PageTabBarStub,
          NetworkStatusBanner: NetworkStatusBannerStub,
          MobileTopBar: MobileTopBarStub,
          MobileBottomNav: MobileBottomNavStub,
        },
      },
    });

    expect(wrapper.classes()).toContain('prevent-mobile-layout');
    expect(wrapper.findComponent(MobileTopBarStub).exists()).toBe(false);
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(false);
  });
});
