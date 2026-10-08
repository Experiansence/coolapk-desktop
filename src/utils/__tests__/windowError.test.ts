import { describe, expect, it } from 'vitest';
import { isResizeObserverWarning } from '../windowError';

describe('浏览器尺寸通知与脚本异常区分', () => {
  it.each([
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications.',
  ])('识别无异常对象的浏览器通知：%s', message => {
    expect(isResizeObserverWarning(new ErrorEvent('error', { message }))).toBe(true);
  });
  it('保留真实脚本异常与其他错误', () => {
    expect(isResizeObserverWarning(new ErrorEvent('error', { message: 'ResizeObserver loop limit exceeded', error: new Error('script failure') }))).toBe(false);
    expect(isResizeObserverWarning(new ErrorEvent('error', { message: 'ResizeObserver is not defined' }))).toBe(false);
    expect(isResizeObserverWarning(new ErrorEvent('error', { message: 'Cannot read properties of undefined' }))).toBe(false);
  });
});
