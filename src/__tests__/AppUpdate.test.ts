import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: { os: 'macos', arch: 'aarch64' },
  distribution: vi.fn(),
  checkLatestRelease: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn(),
  cleanup: vi.fn(),
  available: vi.fn(),
  installError: vi.fn(),
  quitApp: vi.fn(),
  flushSettings: vi.fn(),
  settings: {
    updateChannel: 'stable', ignoredUpdateVersion: '', ignoreAllUpdates: false,
    checkUpdateOnStartup: false, autoCleanCache: false, desktopNotifications: false,
    updateSpeedLimitKBps: 0, proxyUrl: '',
  },
}));
vi.mock('../utils/platform', () => ({ getPlatformInfo: async () => mocks.platform }));
vi.mock('../utils/updateChecker', async (importOriginal) => ({
  ...await importOriginal<typeof import('../utils/updateChecker')>(),
  checkLatestRelease: mocks.checkLatestRelease,
}));
vi.mock('../api/coolapk', () => ({ CoolapkTauriAPI: {
  getUpdateDistribution: mocks.distribution, downloadUpdate: mocks.downloadUpdate,
  installUpdate: mocks.installUpdate, cleanupUpdatePackages: mocks.cleanup,
  isUpdatePackageAvailable: mocks.available, takeUpdateInstallError: mocks.installError,
  quitApp: mocks.quitApp,
} }));
vi.mock('../stores/auth', () => ({ useAuthStore: () => ({ initAuth: vi.fn() }) }));
vi.mock('../stores/settings', () => ({ useSettingsStore: () => ({
  settings: mocks.settings, flushSettings: mocks.flushSettings, refreshAutoZoom: vi.fn(),
}) }));
vi.mock('../stores/downloads', () => ({ useDownloadStore: () => ({ initialize: vi.fn() }) }));
vi.mock('../stores/pageTabs', () => ({ usePageTabsStore: () => ({ getGeneration: () => 0, syncRoute: vi.fn() }) }));
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/home', fullPath: '/home' }) }));
vi.mock('../utils/routeTransition', () => ({ useSidebarTransition: () => ({ isSidebarTransitionActive: false, resetSidebarTransition: vi.fn() }) }));
vi.mock('../utils/hotkeys', () => ({ registerGlobalHotkeys: () => vi.fn() }));
vi.mock('../utils/selection', () => ({ registerGlobalSelectionClear: () => vi.fn() }));
vi.mock('../utils/anchorClick', () => ({ handleAnchorClick: vi.fn() }));
vi.mock('../utils/diagnosticLogger', () => ({ logDiagnostic: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => vi.fn()) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }));
import App from '../App.vue';

function mountApp() {
  return mount(App, { global: { stubs: {
    AppShell: { template: '<div><slot /></div>' },
    AppDialog: { props: ['isOpen', 'title'], template: '<section v-if="isOpen"><h2>{{ title }}</h2><slot /></section>' },
    PublishDialog: true, ImageViewer: true, SearchCommand: true, LoginModal: true,
    AppConfirmHost: true, AppContextMenu: true, ShuzilmDeviceGuideModal: true, 'router-view': true,
  } } });
}

describe('桌面自动更新交互', () => {
  let wrapper: ReturnType<typeof mountApp> | undefined;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform.os = 'macos';
    mocks.platform.arch = 'aarch64';
    mocks.distribution.mockResolvedValue('installer');
    mocks.installError.mockResolvedValue(null);
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.available.mockResolvedValue(true);
    mocks.installUpdate.mockResolvedValue('started');
    mocks.flushSettings.mockResolvedValue(undefined);
    mocks.quitApp.mockResolvedValue(undefined);
    mocks.downloadUpdate.mockResolvedValue('/cache/coolapk-desktop_9.9.9_aarch64-12-34.dmg');
  });
  afterEach(() => { wrapper?.unmount(); wrapper = undefined; });

  it.each([
    ['macos', 'aarch64', 'installer', 'coolapk-desktop_9.9.9_aarch64.dmg'],
    ['linux', 'x86_64', 'portable', 'coolapk-desktop_9.9.9_amd64.AppImage'],
    ['linux', 'x86_64', 'deb', 'coolapk-desktop_9.9.9_amd64.deb'],
    ['linux', 'x86_64', 'rpm', 'coolapk-desktop-9.9.9-1.x86_64.rpm'],
  ])('恢复 %s %s %s 待安装包并安装重启', async (os, arch, packageType, fileName) => {
    mocks.platform.os = os;
    mocks.platform.arch = arch;
    mocks.distribution.mockResolvedValue(packageType);
    const path = `/cache/${fileName}`;
    localStorage.setItem('coolapk_pending_update', JSON.stringify({
      version: '9.9.9', path, fileName, packageType, releaseNotes: '新版说明',
    }));
    wrapper = mountApp();
    await flushPromises();
    expect(wrapper.text()).toContain('更新包已下载');
    expect(wrapper.text()).toContain('新版说明');
    if (['deb', 'rpm'].includes(packageType)) expect(wrapper.text()).toContain('管理员授权');
    const install = wrapper.findAll('button').find((button) => button.text() === '立即更新')!;
    await install.trigger('click');
    await flushPromises();
    expect(mocks.installUpdate).toHaveBeenCalledWith(path, packageType === 'portable');
    expect(mocks.quitApp).toHaveBeenCalledOnce();
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();
  });

  it('手动检查 macOS 更新后可以下载并记录待安装包', async () => {
    mocks.checkLatestRelease.mockResolvedValue({ hasNew: true, latestVersion: 'v9.9.9',
      installerUrl: 'https://github.com/download/new.dmg', installerName: 'coolapk-desktop_9.9.9_aarch64.dmg',
      packageType: 'installer', releaseNotes: '更新说明',
    });
    wrapper = mountApp();
    await flushPromises();
    window.dispatchEvent(new Event('check-for-update'));
    await flushPromises();
    expect(mocks.checkLatestRelease).toHaveBeenCalledWith('stable', undefined, 'installer');
    await wrapper.findAll('button').find((button) => button.text().includes('后台下载更新'))!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('更新包已下载');
    expect(JSON.parse(localStorage.getItem('coolapk_pending_update')!)).toMatchObject({ version: '9.9.9', packageType: 'installer' });
  });

  it('安装授权取消时保留下载记录和当前应用', async () => {
    mocks.platform.os = 'linux';
    mocks.platform.arch = 'x86_64';
    mocks.distribution.mockResolvedValue('deb');
    mocks.installUpdate.mockRejectedValue('用户取消管理员授权');
    localStorage.setItem('coolapk_pending_update', JSON.stringify({
      version: '9.9.9', path: '/cache/coolapk-desktop_9.9.9_amd64.deb', packageType: 'deb',
    }));
    wrapper = mountApp();
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '立即更新')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('用户取消管理员授权');
    expect(mocks.quitApp).not.toHaveBeenCalled();
    expect(localStorage.getItem('coolapk_pending_update')).not.toBeNull();
  });

  it('拒绝从 AppImage 切换到 deb 的缓存包', async () => {
    mocks.platform.os = 'linux';
    mocks.platform.arch = 'x86_64';
    mocks.distribution.mockResolvedValue('portable');
    localStorage.setItem('coolapk_pending_update', JSON.stringify({
      version: '9.9.9', path: '/cache/coolapk-desktop_9.9.9_amd64.deb', packageType: 'deb',
    }));
    wrapper = mountApp();
    await flushPromises();
    expect(wrapper.text()).not.toContain('更新包已下载');
    expect(localStorage.getItem('coolapk_pending_update')).toBeNull();
  });

  it('在重新启动后显示更新助手的失败原因', async () => {
    mocks.installError.mockResolvedValue('新版程序启动失败，已恢复旧版');
    wrapper = mountApp();
    await flushPromises();
    expect(wrapper.text()).toContain('已恢复旧版');
  });
});
