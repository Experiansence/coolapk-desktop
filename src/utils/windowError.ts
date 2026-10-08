/** 浏览器把本轮未送达的尺寸通知延后，属于布局警告，不是脚本异常。 */
export function isResizeObserverWarning(event: Pick<ErrorEvent, 'message' | 'error'>): boolean {
  return event.error == null && (
    event.message === 'ResizeObserver loop limit exceeded'
    || event.message === 'ResizeObserver loop completed with undelivered notifications.'
  );
}
