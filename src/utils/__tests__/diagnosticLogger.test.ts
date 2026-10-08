import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  info: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
  debug: vi.fn().mockResolvedValue(undefined),
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-log', () => ({ info: mocks.info, warn: mocks.warn, error: mocks.error, debug: mocks.debug }));

import { installDiagnosticLogging, logDiagnostic, logDiagnosticLayout, logDiagnosticLimited, redactDiagnosticText, setDiagnosticPage, setVerboseDiagnosticLogging, summarizeDiagnosticError } from '../diagnosticLogger';

describe('diagnosticLogger', () => {
  beforeEach(() => { (window as any).__TAURI_INTERNALS__ = {}; });
  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
    vi.clearAllMocks();
  });

  it('removes URL parameters, credentials and user directory names', () => {
    const result = redactDiagnosticText('https://account.coolapk.com/callback?ck=secret&code=123 SESSID=abc token:xyz C:\\Users\\alice\\file "cookie":"hidden" Bearer bearer-secret');
    expect(result).not.toContain('secret');
    expect(result).not.toContain('123');
    expect(result).not.toContain('abc');
    expect(result).not.toContain('xyz');
    expect(result).not.toContain('alice');
    expect(result).not.toContain('hidden');
    expect(result).not.toContain('bearer-secret');
    expect(result).toContain('https://account.coolapk.com/callback');
  });

  it('never serializes arbitrary objects', () => {
    logDiagnostic('error', 'login', 'failed', { cookie: 'private-value' });
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('[object]'));
    expect(mocks.error.mock.calls[0][0]).not.toContain('private-value');
  });

  it('每条日志包含时间、运行标识、序号及安全的页面视口信息', () => {
    setDiagnosticPage('/feed/:id');
    logDiagnostic('info', 'test', 'context');
    const message = mocks.info.mock.calls.at(-1)![0];
    expect(message).toMatch(/time=\d{4}-\d{2}-\d{2}T/);
    expect(message).toMatch(/session=\w+ seq=\d+/);
    expect(message).toContain('page=/feed/:id');
    expect(message).toMatch(/viewport=\d+x\d+ visible_height=\d+/);
    setDiagnosticPage('/search?keyword=private');
    logDiagnostic('info', 'test', 'context');
    expect(mocks.info.mock.calls.at(-1)![0]).not.toContain('private');
  });

  it('过滤设备标识和上传密钥', () => {
    const result = redactDiagnosticText('ddid=private-ddid imei=private-imei client_secret=private-key "security_token":"private-sts"');
    expect(result).not.toContain('private');
  });

  it('布局溢出只记录数值，不收集内容；日志插件同步失败不影响业务', () => {
    const element = document.createElement('div');
    element.textContent = '私密帖子';
    Object.defineProperties(element, { clientWidth: { value: 360 }, scrollWidth: { value: 480 } });
    logDiagnosticLayout('layout-test', element);
    expect(mocks.warn.mock.calls.at(-1)![0]).toContain('overflow_x=true');
    expect(mocks.warn.mock.calls.at(-1)![0]).not.toContain('私密帖子');
    mocks.info.mockImplementationOnce(() => { throw new Error('plugin unavailable'); });
    expect(() => logDiagnostic('info', 'test', 'plugin_failure')).not.toThrow();
  });

  it('logs one sanitized source frame for runtime errors', () => {
    const failure = new Error('failed with token=secret');
    failure.stack = 'Error: failed with token=secret\n    at load (https://example.com/app.js?token=secret:12:3)';
    const summary = summarizeDiagnosticError(failure);
    expect(summary).toContain('load');
    expect(summary).not.toContain('secret');
    expect(summarizeDiagnosticError({ token: 'private-value' })).toBe('unknown');
    expect(summarizeDiagnosticError('token=secret')).not.toContain('secret');
  });

  it('only writes debug events when verbose mode is enabled', async () => {
    logDiagnostic('debug', 'api', 'request_ok');
    expect(mocks.debug).not.toHaveBeenCalled();
    await setVerboseDiagnosticLogging(true);
    logDiagnostic('debug', 'api', 'request_ok');
    expect(mocks.debug).toHaveBeenCalledOnce();
    await setVerboseDiagnosticLogging(false);
  });

  it('deduplicates repeated low-frequency diagnostic events', () => {
    const key = `test-dedupe-${Date.now()}`;
    logDiagnosticLimited('warn', 'test', 'repeated', 'same failure', 60_000, key);
    logDiagnosticLimited('warn', 'test', 'repeated', 'same failure', 60_000, key);
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it('records interactive clicks without persisting labels, values or URLs', () => {
    installDiagnosticLogging();
    const link = document.createElement('a');
    link.className = 'feed-link private-标题';
    link.href = 'https://example.com/private/path?token=secret';
    link.textContent = '用户私密文字';
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.appendChild(link);

    link.click();

    const message = String(mocks.info.mock.calls.at(-1)?.[0] || '');
    expect(message).toContain('[frontend][interaction] click');
    expect(message).toContain('element=a');
    expect(message).toContain('class=feed-link');
    expect(message).toContain('destination=external');
    expect(message).not.toContain('用户私密文字');
    expect(message).not.toContain('private/path');
    expect(message).not.toContain('secret');
    link.remove();
  });
});
