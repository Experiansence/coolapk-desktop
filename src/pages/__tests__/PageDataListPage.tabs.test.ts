import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { beforeEach, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({ getDiscoveryPageData: vi.fn(), push: vi.fn(), query: { url: 'V14_JINRIREMEN', title: '今日热门', renderer: 'discovery' } }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('vue-router', async (importOriginal) => ({ ...await importOriginal<typeof import('vue-router')>(), useRoute: () => ({ query: api.query }), useRouter: () => ({ push: api.push }) }));
import PageDataListPage from '../PageDataListPage.vue';
beforeEach(() => {
  api.query.url = 'V14_JINRIREMEN';
  api.query.title = '今日热门';
  api.getDiscoveryPageData.mockReset();
  api.push.mockReset();
});

it('品牌页评分仅替换当前列表，保留标签且不创建新页面', async () => {
  api.query.url = 'BRAND';
  api.query.title = '小米';
  const rating = { title: '评分', url: '/page?url=%2Fproduct%2FseriesList%3Fid%3D1016%26category_id%3D1012%26isSecondCategory%3D1%26sortField%3Dstar_average_score' };
  api.getDiscoveryPageData.mockImplementation(async ({ url }) => url === 'BRAND'
    ? { data: [{ entityTemplate: 'iconTabLinkGridCard', entities: [{ title: '全部', url: 'ALL' }] }] }
    : { data: [...(url === 'ALL' ? [{ id: 'brand', title: '品牌', entityTemplate: 'iconGridHorizonCard' }, { id: 'sort', entityTemplate: 'sortSelectCard', entities: [rating] }] : []), { id: 5457, entityType: 'product', title: url === 'ALL' ? '原产品' : '评分产品' }], hasMore: false });
  const wrapper = mount(PageDataListPage, { global: { plugins: [createPinia()], stubs: { AppImage: true, FeedSkeleton: true, DiscoveryEntityCard: { name: 'DiscoveryEntityCard', props: ['entity'], template: '<article>{{ entity.title }}</article>' } } } });
  await flushPromises();
  wrapper.findComponent({ name: 'DiscoveryEntityCard' }).vm.$emit('open', rating);
  await flushPromises();
  expect(api.push).not.toHaveBeenCalled();
  expect(wrapper.get('.dynamic-tabs button.active').text()).toBe('全部');
  expect(wrapper.text()).toContain('评分产品');
  expect(wrapper.text()).toContain('品牌');
  expect(wrapper.findAllComponents({ name: 'DiscoveryEntityCard' }).some(card => card.props('entity').id === 'sort')).toBe(true);
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/product/seriesList?id=1016&category_id=1012&isSecondCategory=1&sortField=star_average_score', title: '全部', page: 1, firstItem: '', lastItem: '' }));
  wrapper.unmount();
});
it('榜单标签自动请求首项，切换分类重置分页并加载对应产品', async () => {
  api.getDiscoveryPageData.mockImplementation(async ({ url }: { url: string }) => url === 'V14_JINRIREMEN'
    ? { data: [{ entityType: 'card', entityTemplate: 'iconTabLinkGridCard', entities: [{ title: '今日热议', url: '#/product/hotProductList?hotType=day' }, { title: '热议新机', url: '#/product/unreleasedProductList' }] }] }
    : { data: [{ entityType: 'product', id: 1, title: url.includes('unreleased') ? '新机' : '热门手机', hot_num_txt: '10万' }] });
  const wrapper = mount(PageDataListPage, { global: { plugins: [createPinia()], stubs: { AppImage: true, DiscoveryEntityCard: true, FeedSkeleton: true } } });
  await flushPromises();
  expect(wrapper.findAll('.dynamic-tabs button')).toHaveLength(2);
  expect(wrapper.find('.ranking-copy').text()).toContain('热门手机');
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: '#/product/hotProductList?hotType=day', page: 1 }));
  await wrapper.findAll('.dynamic-tabs button')[1]!.trigger('click');
  await flushPromises();
  expect(wrapper.find('.ranking-copy').text()).toContain('新机');
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: '#/product/unreleasedProductList', page: 1, firstItem: '', lastItem: '' }));
});

it('品牌页标签使用自身标题副标题，跟随 flexList 地址加载产品并保留分页上下文', async () => {
  api.query.url = 'BRAND_XIAOMI';
  api.query.title = '小米';
  const routerUrl = '/product/categoryDetailList?brand=1&category=router';
  api.getDiscoveryPageData.mockImplementation(async ({ url, page }: { url: string; page: number }) => {
    if (url === 'BRAND_XIAOMI') return { data: [{ entityType: 'card', entityTemplate: 'iconTabLinkGridCard', extraData: JSON.stringify({ selectedTab: 1 }), entities: [
      { title: '全部', url: 'BRAND_ALL' },
      { title: '路由器', subTitle: '小米路由器', url: `#/page?url=${encodeURIComponent('ROUTER_CONFIG')}` },
    ] }] };
    if (url === 'ROUTER_CONFIG') return { data: [{ entityType: 'card', entityTemplate: 'configCard', extraData: { flexList: 1, url: routerUrl } }] };
    return { data: [{ id: page, entityType: 'product', title: `小米路由器 ${page}` }], hasMore: page === 1, firstItem: 'first-router', lastItem: 'last-router', pageContext: 'router-context' };
  });
  const wrapper = mount(PageDataListPage, { global: { plugins: [createPinia()], stubs: { AppImage: true, DiscoveryEntityCard: { props: ['entity'], template: '<article class="test-product">{{ entity.title }}</article>' }, FeedSkeleton: true } } });
  await flushPromises();
  expect(wrapper.get('.dynamic-tabs button.active').text()).toBe('路由器');
  expect(wrapper.get('.test-product').text()).toBe('小米路由器 1');
  expect(wrapper.find('.ranking-number').exists()).toBe(false);
  expect(api.getDiscoveryPageData).toHaveBeenCalledWith(expect.objectContaining({ url: 'ROUTER_CONFIG', title: '路由器', subTitle: '小米路由器' }));
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: routerUrl, title: '路由器', subTitle: '小米路由器', page: 1 }));
  await wrapper.get('.page-container').trigger('scroll');
  await flushPromises();
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: routerUrl, page: 2, firstItem: 'first-router', lastItem: 'last-router', pageContext: 'router-context' }));
  await wrapper.findAll('.dynamic-tabs button')[0]!.trigger('click');
  await flushPromises();
  expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url: 'BRAND_ALL', title: '全部', page: 1, firstItem: '', lastItem: '' }));
  wrapper.unmount();
});

it('配置内容加载失败或地址循环时显示错误，不误报为空数据', async () => {
  api.query.url = 'ROUTER_CONFIG';
  api.getDiscoveryPageData.mockResolvedValue({ data: [{ entityTemplate: 'configCard', extraData: { flexList: 1, url: 'ROUTER_CONFIG' } }] });
  const wrapper = mount(PageDataListPage, { global: { plugins: [createPinia()], stubs: { FeedSkeleton: true } } });
  await flushPromises();
  expect(wrapper.text()).toContain('分类内容地址循环');
  expect(wrapper.text()).not.toContain('暂无内容');
  expect(api.getDiscoveryPageData).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
