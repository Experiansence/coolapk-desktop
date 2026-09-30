import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import PublishTargetPicker from '../PublishTargetPicker.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { searchPublishTopics: vi.fn(), searchApks: vi.fn(), searchByType: vi.fn(), getProductDetail: vi.fn() } }));
describe('发布到板块', () => {
  it('选择话题保留真实板块标识，支持移除', async () => {
    vi.mocked(CoolapkTauriAPI.searchPublishTopics).mockResolvedValue({ code: 200, data: [{ id: '123', title: '摄影', entityType: 'topic' }] });
    const wrapper = mount(PublishTargetPicker, { props: { modelValue: null } });
    await wrapper.get('.target-current button').trigger('click');
    await flushPromises();
    await wrapper.get('.target-choice').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ id: '123', type: 'tag', title: '摄影' });
    await wrapper.setProps({ modelValue: { id: '123', type: 'tag', title: '摄影' } });
    await wrapper.findAll('.target-current button')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });
});
