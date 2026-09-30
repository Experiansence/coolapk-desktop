import { mount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublishDialog from '../PublishDialog.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { listFullPublishDrafts, saveFullPublishDraft } from '../../../utils/publishDrafts';

const stores = vi.hoisted(() => ({ app: null as any, settings: null as any, auth: null as any }));
vi.mock('../../../stores/app', () => ({ useAppStore: () => stores.app }));
vi.mock('../../../stores/settings', () => ({ useSettingsStore: () => stores.settings }));
vi.mock('../../../stores/auth', () => ({ useAuthStore: () => stores.auth }));
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { createFeed: vi.fn(), getEditableFeed: vi.fn(), updateFeed: vi.fn() } }));
vi.mock('../../../utils/publishDrafts', async (original) => ({ ...await original<any>(), listFullPublishDrafts: vi.fn(async () => []), saveFullPublishDraft: vi.fn(), deleteFullPublishDraft: vi.fn() }));
vi.mock('../../../utils/shuzilmDeviceGuide', () => ({ shuzilmGuideState: { visible: false }, openShuzilmGuide: vi.fn(), isRiskControlError: () => false }));

function mountDialog() {
  return mount(PublishDialog, { global: { stubs: {
    AppDialog: { props: ['isOpen'], template: '<div v-if="isOpen"><slot/><slot name="footer"/></div>' },
    AppButton: { props: ['disabled'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot/></button>' },
    AppImage: true, PublishTargetPicker: true, PublishTopicPicker: true, PublishTopicRecommendations: { props: ['nodeType', 'nodeName', 'uid', 'text', 'cursor', 'refresh'], template: '<div/>' }, PublishMentionPicker: true, PublishProductOptions: true, PublishExtras: true,
  } } });
}
async function openDialog() { const wrapper = mountDialog(); stores.app.isPublishOpen = true; await flushPromises(); return wrapper; }
function typeText(wrapper: ReturnType<typeof mountDialog>, text: string) {
  const editor = wrapper.get('[role=textbox]').element;
  editor.textContent = text;
  const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  return wrapper.get('[role=textbox]').trigger('input', { inputType: 'insertText' });
}
beforeEach(() => {
  vi.clearAllMocks();
  stores.app = reactive({ isPublishOpen: false, editFeedTarget: null, closePublish() { this.isPublishOpen = false; } });
  stores.settings = { settings: { publishDeviceSignature: false, deviceFingerprint: { deviceId: 'device' } } };
  stores.auth = { user: { uid: '123' } };
  vi.mocked(listFullPublishDrafts).mockResolvedValue([]);
});
describe('完整发帖流程', () => {
  it('输入井号触发话题选择并替换正在输入的片段', async () => {
    const wrapper = await openDialog();
    await typeText(wrapper, '内容 #摄');
    const picker = wrapper.findComponent({ name: 'PublishTopicPicker' });
    expect(picker.exists()).toBe(true);
    expect(picker.props('initialQuery')).toBe('摄');
    picker.vm.$emit('select', { id: '1', title: '摄影' });
    await flushPromises();
    expect(wrapper.get('[role=textbox]').text()).toBe('内容 #摄影#');
    expect(wrapper.findComponent({ name: 'PublishTopicPicker' }).exists()).toBe(false);
    wrapper.unmount();
  });
  it('发布请求包含板块、子板块、可见范围和附加内容', async () => {
    vi.mocked(CoolapkTauriAPI.createFeed).mockResolvedValue({ code: 400, message: '测试停止发送' });
    const wrapper = await openDialog();
    await typeText(wrapper, '正文');
    wrapper.findComponent({ name: 'PublishTargetPicker' }).vm.$emit('update:modelValue', { id: '7', title: '产品', type: 'product_phone', subTabs: [{ pageName: '1', title: '续航' }] });
    await flushPromises();
    wrapper.findComponent({ name: 'PublishProductOptions' }).vm.$emit('update:modelValue', { subTypeId: '1', subData: '8.5' });
    wrapper.findComponent({ name: 'PublishExtras' }).vm.$emit('update:modelValue', { originalType: 2, dyhId: '9', extraUrl: '/goods/detail?id=8' });
    await wrapper.get('.publish-visibility select').setValue('-1');
    await wrapper.findAll('button').find((button) => button.text() === '立即发布')!.trigger('click');
    await flushPromises();
    expect(CoolapkTauriAPI.createFeed).toHaveBeenCalledWith('正文', undefined, undefined, expect.objectContaining({ targetType: 'product_phone', targetId: '7', subTypeId: '1', subData: '8.5', visibleStatus: -1, originalType: 2, dyhId: '9', extraUrl: '/goods/detail?id=8' }));
    expect(wrapper.text()).toContain('测试停止发送');
    wrapper.unmount();
  });
  it('关闭前保存完整状态而非仅保存文字', async () => {
    const wrapper = await openDialog();
    await typeText(wrapper, '草稿正文');
    await wrapper.get('.publish-visibility select').setValue('-1');
    await wrapper.findAll('button').find((button) => button.text() === '取消')!.trigger('click');
    await flushPromises();
    expect(saveFullPublishDraft).toHaveBeenCalledWith('123', expect.any(String), expect.objectContaining({ text: '草稿正文', visibleStatus: -1, productOptions: {}, images: [] }));
    expect(stores.app.isPublishOpen).toBe(false);
    wrapper.unmount();
  });
});
