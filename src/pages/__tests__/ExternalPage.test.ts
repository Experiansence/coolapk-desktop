import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchExternalPage: vi.fn(), openUrl: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('../../utils/anchorClick', () => ({ handleAnchorClick: vi.fn() }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { url: 'https://example.com/article' } })
}));
import ExternalPage from '../ExternalPage.vue';

describe('ExternalPage 系统浏览器', () => {
  beforeEach(() => {
    mocks.fetchExternalPage.mockReset().mockResolvedValue({ data: { html: '<p>文章正文</p>', status: 200 } });
    mocks.openUrl.mockReset().mockResolvedValue(undefined);
  });

  it('打开失败时显示错误，允许再次尝试并清除旧错误', async () => {
    mocks.openUrl.mockRejectedValueOnce('未安装浏览器');
    const wrapper = mount(ExternalPage);
    await flushPromises();
    await wrapper.get('.header-actions button').trigger('click');
    await flushPromises();
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com/article', 'system');
    expect(wrapper.get('[role="alert"]').text()).toContain('未安装浏览器');
    expect(wrapper.text()).toContain('文章正文');
    await wrapper.get('.header-actions button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(mocks.openUrl).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it.each([
    '<script>renderPage()</script>',
    '<div><br>&nbsp;</div>',
    '<a href="https://example.com">&nbsp;</a>',
    ''
  ])('抓取结果没有可见正文时显示浏览器打开提示：%s', async (html) => {
    mocks.fetchExternalPage.mockResolvedValue({ data: { html, status: 200 } });
    const wrapper = mount(ExternalPage);
    await flushPromises();
    expect(wrapper.text()).toContain('打开完整网页');
    expect(wrapper.find('.external-content').exists()).toBe(false);
    wrapper.unmount();
  });

  it('抓取失败仍可打开系统浏览器，并显示原始错误', async () => {
    mocks.fetchExternalPage.mockRejectedValue('连接超时');
    const wrapper = mount(ExternalPage);
    await flushPromises();
    expect(wrapper.text()).toContain('连接超时');
    await wrapper.get('.header-actions button').trigger('click');
    await flushPromises();
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com/article', 'system');
    wrapper.unmount();
  });

  it('打开期间禁用按钮，避免重复调用，结束后恢复', async () => {
    let finishOpen!: () => void;
    mocks.openUrl.mockImplementation(() => new Promise<void>((resolve) => { finishOpen = resolve; }));
    const wrapper = mount(ExternalPage);
    await flushPromises();
    const button = wrapper.get('.header-actions button');
    await button.trigger('click');
    expect(button.attributes('disabled')).toBeDefined();
    await button.trigger('click');
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    finishOpen();
    await flushPromises();
    expect(button.attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
});
