import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  push: vi.fn(),
  uploadFileToCdn: vi.fn(),
}));

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));

import CdnUploadPage from '../CdnUploadPage.vue';
import { useUploadStore } from '../../stores/uploads';

describe('酷安 CDN 文件上传入口', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.open.mockResolvedValue(['C:\\upload\\sample.zip']);
    mocks.uploadFileToCdn.mockResolvedValue({ code: 200, data: 'https://image.coolapk.com/sample.zip' });
  });

  it('选择文件后加入全局队列并跳转到上传任务管理页', async () => {
    const wrapper = mount(CdnUploadPage);
    await wrapper.find('.upload-picker-panel button').trigger('click');
    await flushPromises();

    const store = useUploadStore();
    expect(store.tasks).toHaveLength(1);
    expect(store.tasks[0]?.fileName).toBe('sample.zip');
    expect(mocks.uploadFileToCdn).toHaveBeenCalledWith(store.tasks[0]?.id, 'C:\\upload\\sample.zip', store.tasks[0]?.attempt);
    expect(mocks.push).toHaveBeenCalledWith({ path: '/downloads', query: { mode: 'upload', tab: 'active' } });
  });
});
