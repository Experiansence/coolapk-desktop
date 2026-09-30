import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { CoolapkTauriAPI } from '../coolapk';

const routerMocks = vi.hoisted(() => ({
  push: vi.fn().mockResolvedValue(undefined),
  resolve: vi.fn().mockReturnValue({ matched: [{}] }),
}));
vi.mock('../../router', () => ({ router: routerMocks }));

describe('系统浏览器打开链接', () => {
  const originalBridge = Object.getOwnPropertyDescriptor(window, '__TAURI_INTERNALS__');

  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    routerMocks.push.mockClear();
    routerMocks.resolve.mockClear();
    vi.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  });

  afterEach(() => {
    if (originalBridge) Object.defineProperty(window, '__TAURI_INTERNALS__', originalBridge);
    else Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    vi.restoreAllMocks();
  });

  it('原生应用通过系统打开命令调起浏览器', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await CoolapkTauriAPI.openUrl('https://example.com/article', 'system');
    expect(invoke).toHaveBeenCalledWith('open_url', { url: 'https://example.com/article', mode: 'system' });
    expect(window.open).not.toHaveBeenCalled();
  });

  it.each([
    'https://example.com/article',
    'https://github.com/daimiaopeng/coolapk-desktop',
    'https://coolapk.com.evil.com/feed/123',
    'https://evilcoolapk.com/feed/123',
    'https://coolapk.com@evil.com/feed/123',
    'HTTPS://EXAMPLE.COM/article',
  ])('非酷安地址点击时直接调起系统浏览器，不进入页面：%s', async (url) => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await CoolapkTauriAPI.openUrl(url);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('open_url', { url, mode: 'system' });
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(routerMocks.resolve).not.toHaveBeenCalled();
  });

  it('协议相对的站外地址直接交给浏览器，不拼接酷安域名', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await CoolapkTauriAPI.openUrl('//example.com/article', 'internal');
    expect(invoke).toHaveBeenCalledExactlyOnceWith('open_url', {
      url: 'https://example.com/article', mode: 'system'
    });
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it('酷安动态保留站内跳转', async () => {
    await CoolapkTauriAPI.openUrl('https://www.coolapk.com/feed/123');
    expect(routerMocks.push).toHaveBeenCalledWith('/feed/123');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('未适配的酷安网页可继续应用内查看', async () => {
    await CoolapkTauriAPI.openUrl('https://account.coolapk.com/');
    expect(routerMocks.push).toHaveBeenCalledWith({ path: '/external', query: { url: 'https://account.coolapk.com/' } });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('原生打开失败时保留错误，不退回应用 WebView', async () => {
    vi.mocked(invoke).mockRejectedValue('未安装可打开链接的应用');
    await expect(CoolapkTauriAPI.openUrl('https://example.com/article', 'system'))
      .rejects.toBe('未安装可打开链接的应用');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('普通网页预览仍可使用浏览器窗口备用入口', async () => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    vi.mocked(invoke).mockRejectedValue('没有原生桥接');
    await CoolapkTauriAPI.openUrl('https://example.com/article', 'system');
    expect(window.open).toHaveBeenCalledWith('https://example.com/article', '_blank', 'noopener,noreferrer');
  });
});
