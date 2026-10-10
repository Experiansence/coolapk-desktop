import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { APP_VERSION } from '../../../constants/version';

const mocks = vi.hoisted(() => ({
  getCacheInfo: vi.fn().mockResolvedValue({ bytes: 52.8 * 1024 * 1024, imageBytes: 48.4 * 1024 * 1024, webviewBytes: 0, updateBytes: 4.4 * 1024 * 1024, path: 'C:\\Cache' }),
  clearAppCache: vi.fn().mockResolvedValue({ bytes: 0 }),
  cleanExpiredCache: vi.fn().mockResolvedValue(undefined),
  openCacheDirectory: vi.fn().mockResolvedValue('C:\\Cache'),
  getHitHistory: vi.fn().mockResolvedValue({ data: [] }),
  getFavoriteList: vi.fn().mockResolvedValue({ data: [] }),
  exportJsonFile: vi.fn().mockResolvedValue('C:\\Downloads\\export.json'),
  openUrl: vi.fn().mockResolvedValue(undefined),
  listAccounts: vi.fn().mockResolvedValue({ data: [] }),
  getUserCookie: vi.fn().mockResolvedValue(''),
  open: vi.fn().mockResolvedValue(null),
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('../../../utils/resourceCache', () => ({
  clearResourceCache: vi.fn().mockResolvedValue(undefined),
  clearResourceMemoryCache: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-autostart', () => ({ enable: mocks.enable, disable: mocks.disable, isEnabled: mocks.isEnabled }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  isTauri: vi.fn(() => false),
}));
vi.mock('../../../utils/devicePresets', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../utils/devicePresets')>(),
  loadDevicePresets: vi.fn().mockResolvedValue([
    { id: 'official-13-pro', brand: 'Xiaomi', label: 'Xiaomi 13 pro', device: 'nuwa', model: '2210132C' },
    { id: 'official-k80', brand: 'Redmi', label: 'REDMI K80', device: 'zorn', model: '24117RK2CC' },
  ]),
}));

import AppearanceSettingsPage from '../AppearanceSettingsPage.vue';
import AccountSettingsPage from '../AccountSettingsPage.vue';
import AboutSettingsPage from '../AboutSettingsPage.vue';
import ContentSettingsPage from '../ContentSettingsPage.vue';
import DeviceSettingsPage from '../DeviceSettingsPage.vue';
import DownloadSettingsPage from '../DownloadSettingsPage.vue';
import NetworkSettingsPage from '../NetworkSettingsPage.vue';
import NotificationSettingsPage from '../NotificationSettingsPage.vue';
import PrivacySettingsPage from '../PrivacySettingsPage.vue';
import StartupSettingsPage from '../StartupSettingsPage.vue';
import SettingsLayout from '../SettingsLayout.vue';
import ShortcutSettingsPage from '../ShortcutSettingsPage.vue';
import { useSettingsStore } from '../../../stores/settings';

const RouterViewStub = { template: '<div><slot :Component="null" /></div>' };
const RouterLinkStub = { props: ['to'], template: '<a><slot /></a>' };

function mountPage(component: Parameters<typeof mount>[0]) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(component, { global: { plugins: [pinia], stubs: { 'router-link': RouterLinkStub, 'router-view': RouterViewStub } } });
  return { wrapper, settings: useSettingsStore(pinia) };
}

describe('设置页面交互', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete (window as any).__TAURI_INTERNALS__;
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('外观页覆盖主题、强调色、字体、字号、密度和栏目显隐', async () => {
    const { wrapper, settings } = mountPage(AppearanceSettingsPage);
    await wrapper.findAll('.theme-card')[1].trigger('click');
    await wrapper.findAll('.accent-swatch')[1].trigger('click');
    vi.mocked(invoke).mockResolvedValueOnce('Noto Sans SC');
    await wrapper.get('.font-picker-button').trigger('click');
    await flushPromises();
    await wrapper.findAll('.density-card')[2].trigger('click');
    await wrapper.findAll('.setting-row').find((row) => row.text().includes('显示顶部页面标签栏'))!.find('.switch-input').setValue(false);
    await wrapper.findAll('.setting-row').find((row) => row.text().includes('禁止窄窗口自动切换手机模式'))!.find('.switch-input').setValue(true);
    await wrapper.findAll('.setting-row').find((row) => row.text().includes('默认显示右侧评论'))!.find('.switch-input').setValue(false);
    await wrapper.findAll('.zoom-btn')[3].trigger('click');
    await wrapper.find('.nav-toggle-card input').setValue(false);
    expect(wrapper.find('.nav-main-grid').text()).not.toContain('应用');
    expect(wrapper.find('.nav-main-grid').text()).not.toContain('下载');
    expect(wrapper.find('.nav-main-grid').text()).toContain('更多服务');
    expect(wrapper.find('.nav-more-services-settings').exists()).toBe(false);
    expect(wrapper.findAll('.nav-toggle-card').some((card) => card.text().includes('应用'))).toBe(false);
    expect(wrapper.findAll('.nav-toggle-card').some((card) => card.text().includes('下载'))).toBe(false);
    expect(settings.settings.theme).toBe('dark');
    expect(settings.settings.accentColor).toBe('blue');
    expect(settings.settings.fontFamily).toBe('Noto Sans SC');
    expect(settings.settings.density).toBe('compact');
    expect(settings.settings.showPageTabBar).toBe(false);
    expect(settings.settings.disableAutoMobileMode).toBe(true);
    expect(settings.settings.topicHubShowCommentsByDefault).toBe(false);
    expect(settings.settings.fontSize).toBe(16);
    expect(settings.settings.navVisibility?.home).toBe(false);
  });

  it('内容页覆盖正文、链接和关键词设置', async () => {
    const { wrapper, settings } = mountPage(ContentSettingsPage);
    const selects = wrapper.findAll('select');
    await selects[0].setValue('18');
    await wrapper.get('.text-input').setValue('广告');
    await wrapper.get('.keyword-input-row button').trigger('click');
    await wrapper.get('.text-input').setValue('广告');
    await wrapper.get('.keyword-input-row button').trigger('click');
    expect(settings.settings.collapseLines).toBe(18);
    expect(wrapper.text()).not.toContain('默认评论排序');
    const contentRows = wrapper.findAll('.setting-row');
    await contentRows.find((row) => row.text().includes('Live 图片自动播放声音'))!.find('.switch-input').setValue(true);
    await contentRows.find((row) => row.text().includes('不再提醒 Live 图片编码问题'))!.find('.switch-input').setValue(true);
    await contentRows.find((row) => row.text().includes('打开图片自动加载原图'))!.find('.switch-input').setValue(false);
    expect(settings.settings.autoPlayLivePhotoSound).toBe(true);
    expect(settings.settings.suppressUnsupportedLivePhotoCodecPrompt).toBe(true);
    expect(settings.settings.autoLoadOriginalImage).toBe(false);
    const noImageRow = contentRows.find((row) => row.text().includes('无图模式'))!;
    await noImageRow.find('.switch-input').setValue(true);
    expect(settings.settings.noImageMode).toBe(true);
    expect(settings.settings.blockedKeywords).toEqual(['广告']);
    await wrapper.get('.chip-remove').trigger('click');
    expect(settings.settings.blockedKeywords).toEqual([]);
  });

  it('通知页覆盖通知开关和轮询间隔', async () => {
    const { wrapper, settings } = mountPage(NotificationSettingsPage);
    const switches = wrapper.findAll('.switch-input');
    await switches[3].setValue(true);
    await wrapper.find('select').setValue('30');
    expect(settings.settings.desktopNotifications).toBe(true);
    expect(settings.settings.notificationPollInterval).toBe(30);
  });

  it('隐私页同步设备签名', async () => {
    const { wrapper, settings } = mountPage(PrivacySettingsPage);
    await wrapper.get('.text-input').setValue('测试设备');
    expect(settings.settings.deviceSignature).toBe('测试设备');
  });

  it('启动页覆盖首页、关闭行为、更新渠道和窗口行为', async () => {
    const { wrapper, settings } = mountPage(StartupSettingsPage);
    const selects = wrapper.findAll('select');
    await selects[0].setValue('secondhand');
    await selects[2].setValue('tray');
    await wrapper.findAll('.switch-input')[3].setValue(true);
    await selects[1].setValue('beta');
    await wrapper.findAll('.switch-input')[4].setValue(true);
    expect(settings.settings.defaultHomeTab).toBe('secondhand');
    expect(settings.settings.closeToTray).toBe(true);
    expect(settings.settings.experimentalFeatures).toBe(true);
    expect(settings.settings.updateChannel).toBe('beta');
    expect(settings.settings.alwaysOnTop).toBe(true);
  });

  it('设备页覆盖设备指纹输入、预设、警告和恢复默认', async () => {
    const { wrapper, settings } = mountPage(DeviceSettingsPage);
    await flushPromises();
    await wrapper.find('.switch-input').setValue(true);
    expect(wrapper.findAll('.catalog-field > .row-label').map(label => label.text())).toEqual(['品牌', '系列', '机型', '型号']);
    expect(wrapper.get('[aria-label="机型系列"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[aria-label="机型系列"]').text()).toContain('请先选择品牌');
    const inputs = wrapper.findAll('input[type="text"]');
    Object.assign(settings.settings.deviceFingerprint, { deviceId: 'saved-id', androidVersion: '15', build: 'actual-build', sdkInt: '35' });
    await wrapper.get('[aria-label="搜索官方机型表"]').setValue('nuwa');
    await wrapper.get('[aria-label="机型品牌"]').setValue('xiaomi');
    await wrapper.get('[aria-label="机型系列"]').setValue('数字系列');
    await wrapper.get('[aria-label="机型名称"]').setValue('Xiaomi 13 pro');
    expect(wrapper.get('[aria-label="官方机型表"]').text()).toContain('2210132C');
    expect(wrapper.get('[aria-label="官方机型表"]').text()).not.toContain('24117RK2CC');
    await wrapper.get('[aria-label="官方机型表"]').setValue('official-13-pro');
    expect(settings.settings.deviceFingerprint.model).toBe('2210132C');
    expect(wrapper.get('.catalog-selection').text()).toBe('已选择：Xiaomi > 数字系列 > Xiaomi 13 pro > 2210132C');
    expect(settings.settings.deviceFingerprint.androidVersion).toBe('15');
    expect(settings.settings.deviceFingerprint.build).toBe('actual-build');
    expect(settings.settings.deviceFingerprint.sdkInt).toBe('35');
    await wrapper.get('[aria-label="ROM 信息"]').setValue('HyperOS_3.0; 3.0.310.0');
    expect(wrapper.get('.preview-box').text()).toContain('; HyperOS_3.0; 3.0.310.0)');
    await wrapper.get('[aria-label="官方机型表"]').setValue('');
    expect((wrapper.get('[aria-label="官方机型表"]').element as HTMLSelectElement).value).toBe('');
    const appCodeInput = inputs.find((i) => i.attributes('placeholder') === '2604201') || inputs[5];
    await appCodeInput.setValue('2600000');
    expect(wrapper.find('.version-warning').exists()).toBe(true);
    await wrapper.get('.reset-button').trigger('click');
    expect(settings.settings.deviceFingerprint.model).toBe('23113RKC6C');
    expect(settings.settings.deviceFingerprint.appCode).toBe('2604201');
    expect(settings.settings.deviceFingerprint.sdkInt).toBe('36');
    expect(settings.settings.deviceFingerprint.deviceId).toBe('saved-id');
    expect(settings.settings.deviceFingerprint.rom).toBe('');
  });

  it('设备页支持数盟设备 ID 输入、智能提取与保存', async () => {
    const { wrapper, settings } = mountPage(DeviceSettingsPage);
    await flushPromises();
    const deviceIdInput = wrapper.find('.full-width-input');
    await deviceIdInput.setValue('设备ID: DU-MOCK-SAMPLE-DEVICE-ID-12345\nShuzlmID: DU-MOCK-SAMPLE-DEVICE-ID-12345');
    expect(wrapper.find('.success-tip').exists()).toBe(true);
    await wrapper.find('.primary-btn').trigger('click');
    expect(settings.settings.deviceFingerprint.deviceId).toBe('DU-MOCK-SAMPLE-DEVICE-ID-12345');
  });

  it('设备页展示原生默认机型和默认 UA', async () => {
    vi.mocked(invoke).mockImplementation(async (command) => command === 'get_device_info' ? {
      code: 200, data: { loggedIn: true, deviceCode: 'encoded-device', defaultProfile: {
        source: 'native', brand: 'Apple', model: 'iPhone17,3', userAgent: 'native-ios-user-agent',
      } },
    } : undefined);
    const { wrapper } = mountPage(DeviceSettingsPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Apple iPhone17,3（本机真实设备）');
    expect(wrapper.get('.native-ua').text()).toBe('native-ios-user-agent');
    await wrapper.find('.switch-input').setValue(true);
    expect(wrapper.find('.native-ua').exists()).toBe(false);
    wrapper.unmount();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it('下载页展示缓存总量与明细', async () => {
    const { wrapper } = mountPage(DownloadSettingsPage);
    await flushPromises();
    expect(wrapper.get('.cache-total-value').text()).toContain('48.4 MB');
    expect(wrapper.get('.cache-breakdown').text()).toContain('图片');
    expect(wrapper.get('.cache-breakdown').text()).toContain('48.4 MB');
    expect(wrapper.get('.cache-breakdown').text()).toContain('独立保留');
    expect(wrapper.text()).not.toContain('HTTP 代理');
    expect(mocks.getCacheInfo).toHaveBeenCalled();
  });

  it('网络页应用全局代理地址', async () => {
    const { wrapper, settings } = mountPage(NetworkSettingsPage);
    await flushPromises();
    (window as any).__TAURI_INTERNALS__ = {};
    await wrapper.get('#proxy-type').setValue('socks5h');
    await wrapper.get('#proxy-address').setValue('127.0.0.1:7890');
    await wrapper.findAll('.action-button')[1].trigger('click');
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith('set_network_proxy', { proxyUrl: 'socks5h://127.0.0.1:7890' });
    expect(settings.settings.networkProxyUrl).toBe('socks5h://127.0.0.1:7890');
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('网络页测试草稿代理时不应用设置', async () => {
    const { wrapper, settings } = mountPage(NetworkSettingsPage);
    await flushPromises();
    await wrapper.get('#proxy-type').setValue('socks4');
    await wrapper.get('#proxy-address').setValue('127.0.0.1:1080');
    vi.mocked(invoke).mockResolvedValueOnce({ statusCode: 200, elapsedMs: 42 });
    await wrapper.findAll('.action-button')[0].trigger('click');
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith('test_network_proxy', { proxyUrl: 'socks4://127.0.0.1:1080' });
    expect(wrapper.get('[role="status"]').text()).toContain('42 ms');
    expect(settings.settings.networkProxyUrl).toBe('');
  });

  it('设置布局展示全部设置分类', () => {
    const { wrapper } = mountPage(SettingsLayout);
    expect(wrapper.findAll('.settings-menu-item')).toHaveLength(13);
    expect(wrapper.text()).toContain('网络代理');
    expect(wrapper.text()).toContain('诊断日志');
    expect(wrapper.text()).toContain('账号与安全');
    expect(wrapper.text()).toContain('个人信息');
    expect(wrapper.text()).toContain('设备信息');
  });

  it('快捷键页展示全部快捷键并可设置私信回车行为', async () => {
    const { wrapper, settings } = mountPage(ShortcutSettingsPage);
    expect(wrapper.findAll('.setting-row')).toHaveLength(12);
    expect(wrapper.text()).toContain('Ctrl+K');
    expect(wrapper.text()).toContain('Esc');
    expect(wrapper.text()).toContain('C');
    await wrapper.get('select').setValue('newline');
    expect(settings.settings.messageEnterBehavior).toBe('newline');
  });

  it('关于页展示版本信息并支持打开链接和检查更新', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stargazers_count: 1200, forks_count: 12, open_issues_count: 3 }) }));
    const eventSpy = vi.spyOn(window, 'dispatchEvent');
    const { wrapper } = mountPage(AboutSettingsPage);
    await flushPromises();
    expect(wrapper.text()).toContain(APP_VERSION);
    expect(wrapper.text()).toContain('1.2k');
    expect(wrapper.text()).toContain('1129528119');
    await wrapper.get('.about-head button').trigger('click');
    expect(eventSpy).toHaveBeenCalled();
    await wrapper.find('[title="打开项目主页"]').trigger('click');
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/daimiaopeng/coolapk-desktop', 'system');
    await wrapper.find('[title="加入 QQ 交流群"]').trigger('click');
    expect(mocks.openUrl).toHaveBeenCalledWith('https://qm.qq.com/q/bAOWmjCfJ0', 'system');
    vi.unstubAllGlobals();
  });

  it('账号页在没有本地账户时展示空状态', async () => {
    const { wrapper } = mountPage(AccountSettingsPage);
    await flushPromises();
    expect(wrapper.text()).toContain('暂无保存的账户');
    expect(mocks.listAccounts).toHaveBeenCalled();
  });
});
