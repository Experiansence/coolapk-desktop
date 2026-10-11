import { beforeEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MorePage from '../MorePage.vue';

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('MorePage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with title and featured items', () => {
    const wrapper = mount(MorePage);
    expect(wrapper.text()).toContain('更多服务');
    expect(wrapper.text()).toContain('常用与核心专区');
    expect(wrapper.text()).toContain('我的数码');
    expect(wrapper.text()).toContain('好物推荐');
    expect(wrapper.text()).toContain('酷安中心');
    expect(wrapper.text()).toContain('二手市场');
    expect(wrapper.text()).toContain('应用');
    expect(wrapper.text()).toContain('下载');

    const downloadEntry = wrapper.find('.featured-section').findAll('.featured-btn-item')
      .find((item) => item.text().trim() === '下载');
    expect(downloadEntry).toBeDefined();

    const featuresSection = wrapper.findAll('.category-section')
      .find((section) => section.find('.section-title').text().includes('特色功能'));
    expect(featuresSection).toBeDefined();
    expect(featuresSection!.text()).toContain('酷安 CDN 文件上传');
  });

  it('特色功能上传卡片会进入独立的文件选择页', async () => {
    const wrapper = mount(MorePage);
    const featuresSection = wrapper.findAll('.category-section')
      .find((section) => section.find('.section-title').text().includes('特色功能'));
    await featuresSection!.find('.hub-card-item').trigger('click');

    expect(mockPush).toHaveBeenCalledWith('/cdn-upload');
  });

  it('filters items correctly when searching', async () => {
    const wrapper = mount(MorePage);
    const searchInput = wrapper.find('.hub-search-input');
    await searchInput.setValue('二手');

    expect(wrapper.text()).toContain('搜索结果');
    expect(wrapper.text()).toContain('二手市场');
    expect(wrapper.text()).not.toContain('常用与核心专区');
    expect(wrapper.findAll('.search-results-section .hub-card-item')).toHaveLength(1);
  });

  it('搜索覆盖仅位于常用网格的下载服务，清空后恢复完整入口', async () => {
    const wrapper = mount(MorePage);
    await wrapper.get('.hub-search-input').setValue('下载管理');
    const results = wrapper.findAll('.search-results-section .hub-card-item');
    const download = results.find(item => item.get('.hub-card-title').text() === '下载');
    expect(download).toBeDefined();
    await download!.trigger('click');
    expect(mockPush).toHaveBeenLastCalledWith('/downloads');
    await wrapper.get('.clear-search-btn').trigger('click');
    expect(wrapper.findAll('.featured-btn-item')).toHaveLength(10);
    expect(wrapper.findAll('.category-section .hub-card-item')).toHaveLength(9);
    wrapper.unmount();
  });

  it('分类仅展示常用网格以外的服务，所有平台共享准确的服务总数', () => {
    const wrapper = mount(MorePage);
    expect(wrapper.get('.hub-count-tag').text()).toContain('19');
    expect(wrapper.findAll('.category-section .section-count').map(count => count.text())).toEqual(['(2)', '(3)', '(1)', '(2)', '(1)']);
    const categories = wrapper.get('.categories-container').text();
    expect(categories).not.toContain('我的数码装备');
    expect(categories).not.toContain('二手市场');
    expect(categories).toContain('机型多维对比');
    expect(categories).toContain('酷安 CDN 文件上传');
    wrapper.unmount();
  });

  it('navigates to the selected path when a card is clicked', async () => {
    const wrapper = mount(MorePage);
    const firstFeaturedBtn = wrapper.findAll('.featured-btn-item').find((item) => item.text().includes('我的数码'));
    expect(firstFeaturedBtn).toBeDefined();
    await firstFeaturedBtn!.trigger('click');

    expect(mockPush).toHaveBeenCalledWith('/my-products');
  });
});
