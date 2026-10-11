import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { expect, it, vi } from 'vitest';
import PageDataListPage from '../PageDataListPage.vue';

const api = vi.hoisted(() => ({ getProductCategoryList: vi.fn(), getDiscoveryPageData: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('vue-router', async importOriginal => ({ ...await importOriginal<typeof import('vue-router')>(), useRoute: () => ({ query: { url: '/product/categoryList', title: '全部', renderer: 'discovery' } }), useRouter: () => ({ push: vi.fn() }) }));

it('全部入口使用分类目录，分类实体不进入通用产品卡片渲染', async () => {
  api.getProductCategoryList.mockResolvedValue({ data: [{ id: 1, entityType: 'productBrand', title: '热门', url: '#/product/categoryDetailList?type=hot' }] });
  api.getDiscoveryPageData.mockResolvedValue({ data: [], hasMore: false });
  const wrapper = mount(PageDataListPage, { global: { plugins: [createPinia()], stubs: { AppImage: true } } });
  await flushPromises();
  expect(wrapper.get('.category-directory').text()).toContain('热门');
  expect(wrapper.find('.digital-product-card').exists()).toBe(false);
  expect(api.getProductCategoryList).toHaveBeenCalledTimes(1);
  expect(api.getDiscoveryPageData).toHaveBeenCalledTimes(1);
  expect(api.getDiscoveryPageData).toHaveBeenCalledWith(expect.objectContaining({ url: '#/product/categoryDetailList?type=hot' }));
  wrapper.unmount();
});
