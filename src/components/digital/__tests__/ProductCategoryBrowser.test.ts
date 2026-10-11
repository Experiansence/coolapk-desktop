import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import ProductCategoryBrowser from '../ProductCategoryBrowser.vue';

const api = vi.hoisted(() => ({ getProductCategoryList: vi.fn(), getDiscoveryPageData: vi.fn() }));
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
const phone = { id: 10, entityType: 'productBrand', title: '手机', secondCategoryRows: [{ id: 11, title: '热门手机', url: '#/product/categoryDetailList?id=11&showMode=0', subTitle: '热门' }] };
const router = { id: 20, entityType: 'productBrand', title: '路由器', url: '#/product/categoryDetailList?id=20&showMode=0', subTitle: '网络设备' };
const render = (selectedId = '') => mount(ProductCategoryBrowser, { props: { selectedId }, global: { stubs: { AppImage: true, DiscoveryEntityCard: { name: 'DiscoveryEntityCard', props: ['entity'], template: '<article>{{ entity.title }}</article>' } } } });

beforeEach(() => {
  api.getProductCategoryList.mockReset().mockResolvedValue({ data: [phone, router] });
  api.getDiscoveryPageData.mockReset().mockResolvedValue({ data: [{ id: 100, entityType: 'product', title: '分类产品' }], hasMore: false });
});

it('目录独立展示，默认选择首个子分类并保留服务端地址和上下文', async () => {
  const wrapper = render();
  await flushPromises();
  expect(wrapper.get('.category-directory').text()).toContain('热门手机');
  expect(wrapper.text()).not.toContain('暂无报价');
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith({ url: phone.secondCategoryRows[0].url, title: '热门手机', subTitle: '热门', page: 1, firstItem: '', lastItem: '' });
  const directoryButtons = wrapper.findAll('.category-directory button');
  await directoryButtons.find(button => button.text() === '路由器')!.trigger('click');
  await flushPromises();
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: router.url, title: '路由器', subTitle: '网络设备', page: 1 }));
  wrapper.unmount();
});

it('按入口 ID 选中子分类，返回的产品可以继续打开', async () => {
  const wrapper = render('11');
  await flushPromises();
  expect(wrapper.get('.category-children button').attributes('aria-pressed')).toBe('true');
  const product = { id: 100, entityType: 'product', title: '分类产品' };
  wrapper.findComponent({ name: 'DiscoveryEntityCard' }).vm.$emit('open', product);
  expect(wrapper.emitted('open')).toEqual([[product]]);
  wrapper.unmount();
});

it('快速切换分类时旧请求不覆盖新内容，空结果有明确提示', async () => {
  let completePhone!: (value: unknown) => void;
  api.getDiscoveryPageData.mockImplementation(({ title }) => title === '热门手机' ? new Promise(resolve => { completePhone = resolve; }) : Promise.resolve({ data: [], hasMore: false }));
  const wrapper = render();
  await flushPromises();
  await wrapper.findAll('.category-directory button').find(button => button.text() === '路由器')!.trigger('click');
  await flushPromises();
  completePhone({ data: [{ id: 100, title: '旧手机内容' }] });
  await flushPromises();
  expect(wrapper.get('.category-results').text()).toContain('暂无内容');
  expect(wrapper.text()).not.toContain('旧手机内容');
  wrapper.unmount();
});

it('评分排序在当前分类刷新，保留显示方式并沿用排序地址分页', async () => {
  const hot = { title: '热度', url: '/page?url=%2Fproduct%2FcategoryDetailList%3Fid%3D20%26sortField%3Dhot_num' };
  const rating = { title: '评分', url: '/page?url=%2Fproduct%2FcategoryDetailList%3Fid%3D20%26isSecondCategory%3D1%26sortField%3Dstar_average_score%26limitField%3Dstar_total_count-80' };
  api.getDiscoveryPageData.mockImplementation(async ({ url, page }) => ({ data: [...(url === router.url ? [{ id: 'brands', title: '品牌', entityTemplate: 'iconGridHorizonCard' }, { id: 'sort', entityTemplate: 'sortSelectCard', entities: [hot, rating] }] : []), { id: page, title: url === rating.url ? '评分产品' : '热度产品', entityType: 'product' }], hasMore: page === 1, firstItem: 'first', lastItem: 'last' }));
  const wrapper = render('20');
  await flushPromises();
  await wrapper.get('button[aria-label="列表视图"]').trigger('click');
  wrapper.findComponent({ name: 'DiscoveryEntityCard' }).vm.$emit('open', rating);
  await flushPromises();
  expect(wrapper.emitted('open')).toBeUndefined();
  expect(wrapper.get('.category-results h3').text()).toBe('路由器');
  expect(wrapper.get('button[aria-label="列表视图"]').attributes('aria-pressed')).toBe('true');
  expect(wrapper.text()).toContain('评分产品');
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: rating.url, title: '路由器', page: 1, firstItem: '', lastItem: '' }));
  expect(wrapper.text()).toContain('品牌');
  const sort = wrapper.findAllComponents({ name: 'DiscoveryEntityCard' }).find(card => card.props('entity').id === 'sort')!.props('entity');
  expect(sort.entities.map((item: { selected: number }) => item.selected)).toEqual([0, 1]);
  await wrapper.get('.load-more').trigger('click');
  await flushPromises();
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: rating.url, page: 2, firstItem: 'first', lastItem: 'last' }));
  wrapper.findAllComponents({ name: 'DiscoveryEntityCard' }).find(card => card.props('entity').id === 'sort')!.vm.$emit('open', hot);
  await flushPromises();
  expect(wrapper.text()).toContain('品牌');
  expect(wrapper.text()).toContain('热度产品');
  expect(wrapper.findAllComponents({ name: 'DiscoveryEntityCard' }).filter(card => card.props('entity').id === 'sort')).toHaveLength(1);
  expect(wrapper.get('button[aria-label="列表视图"]').attributes('aria-pressed')).toBe('true');
  wrapper.unmount();
});
