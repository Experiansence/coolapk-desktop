import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AppDialog from '../AppDialog.vue';

afterEach(() => vi.restoreAllMocks());

it('listens for Escape only while open and preserves closing behavior', async () => {
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  const wrapper = mount(AppDialog, { props: { isOpen: false } });
  expect(add.mock.calls.filter(call => call[0] === 'keydown')).toHaveLength(0);
  await wrapper.setProps({ isOpen: true });
  expect(add.mock.calls.filter(call => call[0] === 'keydown')).toHaveLength(1);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(wrapper.emitted('close')).toHaveLength(1);
  await wrapper.setProps({ isOpen: false });
  expect(remove.mock.calls.filter(call => call[0] === 'keydown').length).toBeGreaterThan(0);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(wrapper.emitted('close')).toHaveLength(1);
  wrapper.unmount();
});

it('opens an earlier-mounted confirmation above its source dialog and Escape closes only the top dialog', async () => {
  // 全局确认窗口先挂载，用户操作窗口后挂载，模拟主页拉黑和屏蔽的打开顺序。
  const confirmation = mount(AppDialog, { props: { isOpen: false, title: '拉黑用户' }, global: { stubs: { Teleport: true } } });
  const actions = mount(AppDialog, { props: { isOpen: true, title: '用户操作' }, global: { stubs: { Teleport: true } } });
  const zIndex = (wrapper: typeof actions, selector: string) => Number((wrapper.get(selector).element as HTMLElement).style.zIndex);
  try {
    await confirmation.setProps({ isOpen: true });
    expect(zIndex(confirmation, '.dialog-backdrop')).toBeGreaterThan(zIndex(actions, '.dialog-wrapper'));
    expect(zIndex(confirmation, '.dialog-wrapper')).toBeGreaterThan(zIndex(confirmation, '.dialog-backdrop'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(confirmation.emitted('close')).toHaveLength(1);
    expect(actions.emitted('close')).toBeUndefined();
    await confirmation.setProps({ isOpen: false });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(actions.emitted('close')).toHaveLength(1);
    await confirmation.setProps({ isOpen: true, title: '屏蔽用户' });
    expect(zIndex(confirmation, '.dialog-backdrop')).toBeGreaterThan(zIndex(actions, '.dialog-wrapper'));
  } finally {
    confirmation.unmount();
    actions.unmount();
  }
});
