import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeResizeOnFrame } from '../observeResizeOnFrame';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  let notify!: () => void;
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notify = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle));
  const update = vi.fn();
  const stop = observeResizeOnFrame(document.createElement('div'), update);
  const paint = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); };
  return { notify: () => notify(), frames, update, stop, paint, disconnect };
}

describe('resize layout scheduling', () => {
  it('合并同轮尺寸通知，等下一帧才更新布局，后续尺寸变化继续生效', () => {
    const task = setup();
    task.notify(); task.notify();
    expect(task.update).not.toHaveBeenCalled();
    expect(task.frames.size).toBe(1);
    task.paint();
    expect(task.update).toHaveBeenCalledOnce();
    task.notify(); task.paint();
    expect(task.update).toHaveBeenCalledTimes(2);
  });
  it('关闭组件时断开观察，取消待执行布局更新', () => {
    const task = setup();
    task.notify();
    task.stop();
    expect(task.disconnect).toHaveBeenCalledOnce();
    expect(task.frames.size).toBe(0);
    task.paint(); task.notify(); task.paint();
    expect(task.update).not.toHaveBeenCalled();
  });
});
