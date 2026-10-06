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
