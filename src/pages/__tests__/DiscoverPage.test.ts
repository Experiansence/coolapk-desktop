import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ getDiscoveryConfig: vi.fn(), getDiscoveryPageData: vi.fn(), push: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('../../components/discovery/DiscoveryEntityCard.vue', () => ({ default: {
  props: ['entity', 'inlineSelectors'], emits: ['filter', 'open'],
  template: '<div class="entity" :data-id="entity.id"><span>{{ entity.title }}</span><button v-for="child in entity.entities || []" :key="child.id" :class="{ selected: child.selected }" @click="$emit(\'filter\', child)">{{ child.title }}</button></div>',
} }));
vi.mock('../../components/feed/FeedTabs.vue', () => ({ default: { template: '<div />' } }));
import DiscoverPage from '../DiscoverPage.vue';
import DiscoveryEntityCard from '../../components/discovery/DiscoveryEntityCard.vue';

const Pager = { props: ['tabs'], template: '<div><slot v-for="tab in tabs" :key="tab.key" :tab="tab" /></div>' };
const ErrorStub = { props: ['title', 'message'], emits: ['retry'], template: '<div class="error"><span>{{ title }}</span><button @click="$emit(\'retry\')">重试</button></div>' };
function headers() {
  return [
    { id: 1, title: '热门专区', entityTemplate: 'iconMiniGridCard' },
    { id: 2, title: '横幅', entityTemplate: 'imageCarouselCard' },
    { id: 3, entityTemplate: 'selectorLinkCard', entities: [
      { id: 20, title: '热议', url: '/feed/list?type=hot', entityType: 'feed', selected: true },
      { id: 21, title: '兴趣爱好', url: '/feed/list?type=hobby', entityType: 'feed', selected: false },
      { id: 22, title: '情感', url: '/feed/list?type=emotion', entityType: 'feed', selected: false },
    ] },
  ];
}
async function render() {
  const w = mount(DiscoverPage, { global: { stubs: { DiscoveryPager: Pager, DiscoverySkeleton: true, ErrorState: ErrorStub, LoadingState: true } } });
  await flushPromises(); return w;
}
function hasHeader(w: ReturnType<typeof mount>) {
  expect(w.findAll('.entity').slice(0, 3).map(e => e.attributes('data-id'))).toEqual(['1', '2', '3']);
}
describe('发现分类只刷新下方动态', () => {
  beforeEach(() => {
    api.push.mockReset();
    api.getDiscoveryConfig.mockReset().mockResolvedValue({ data: [{ id: 20131, title: '发现', entities: [{ title: '生活', page_name: 'V11_FIND_LIFE', url: 'V11_FIND_LIFE' }] }] });
    api.getDiscoveryPageData.mockReset().mockResolvedValueOnce({ data: [...headers(), { id: 10, entityType: 'feed', title: '旧动态' }], hasMore: false });
  });
  it('筛选只返回动态时，保留顶部 DOM 和选中状态，且不跳转页面', async () => {
    const w = await render();
    const original = w.find('[data-id="3"]').element;
    let resolve!: (value: unknown) => void;
    api.getDiscoveryPageData.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await w.findAll('button')[1].trigger('click');
    hasHeader(w);
    expect(w.text()).not.toContain('旧动态');
    expect(w.find('button.selected').text()).toBe('兴趣爱好');
    expect(api.push).not.toHaveBeenCalled();
    expect(api.getDiscoveryPageData.mock.calls[1][0]).toMatchObject({ url: '/feed/list?type=hobby', page: 1, lastItem: '', pageContext: '' });
    resolve({ data: [{ id: 11, entityType: 'feed', title: '兴趣爱好动态' }], hasMore: true, lastItem: '11', pageContext: 'hobby-context' });
    await flushPromises();
    hasHeader(w);
    expect(w.find('[data-id="3"]').element).toBe(original);
    expect(w.text()).toContain('兴趣爱好动态');
    api.getDiscoveryPageData.mockResolvedValueOnce({ data: [{ id: 12, entityType: 'feed', title: '下一页动态' }], hasMore: false });
    await w.find('.discover-scroll-container').trigger('scroll'); await flushPromises();
    expect(api.getDiscoveryPageData.mock.calls[2][0]).toMatchObject({ url: '/feed/list?type=hobby', page: 2, lastItem: '11', pageContext: 'hobby-context' });
    expect(w.text()).toContain('兴趣爱好动态'); expect(w.text()).toContain('下一页动态');
    w.unmount();
  });
  it('失败时保留分类栏并允许原分类重试', async () => {
    const w = await render();
    api.getDiscoveryPageData.mockRejectedValueOnce(new Error('网络中断'));
    await w.findAll('button')[1].trigger('click'); await flushPromises();
    hasHeader(w); expect(w.find('.error').exists()).toBe(true);
    api.getDiscoveryPageData.mockResolvedValueOnce({ data: [{ id: 11, title: '重试动态', entityType: 'feed' }], hasMore: false });
    await w.find('.error button').trigger('click'); await flushPromises();
    hasHeader(w); expect(w.text()).toContain('重试动态');
    expect(api.getDiscoveryPageData.mock.calls[2][0].url).toBe('/feed/list?type=hobby');
    w.unmount();
  });
  it('连续切换分类时，较慢的旧响应不覆盖新分类，也不重复顶部卡片', async () => {
    const w = await render();
    let oldResolve!: (value: unknown) => void;
    api.getDiscoveryPageData.mockImplementationOnce(() => new Promise(r => { oldResolve = r; }));
    await w.findAll('button')[1].trigger('click');
    api.getDiscoveryPageData.mockResolvedValueOnce({ data: [...headers(), { id: 12, title: '情感动态', entityType: 'feed' }], hasMore: false });
    await w.findAll('button')[2].trigger('click'); await flushPromises();
    oldResolve({ data: [{ id: 11, title: '过期兴趣动态', entityType: 'feed' }], hasMore: false }); await flushPromises();
    expect(w.text()).toContain('情感动态'); expect(w.text()).not.toContain('过期兴趣动态');
    expect(w.find('button.selected').text()).toBe('情感');
    expect(w.findAll('[data-id="1"]')).toHaveLength(1);
    expect(api.push).not.toHaveBeenCalled();
    w.unmount();
  });
});

describe('二手频道自动加载 flex 信息流', () => {
  beforeEach(() => {
    api.getDiscoveryConfig.mockReset().mockResolvedValue({ data: [{ id: 20131, title: '发现', entities: [{ title: '二手', page_name: 'V11_DISCOVERY_SECOND_HAND', url: 'V11_DISCOVERY_SECOND_HAND' }] }] });
    api.getDiscoveryPageData.mockReset().mockResolvedValueOnce({ data: [
      { entityTemplate: 'configCard', extraData: JSON.stringify({ flexList: '1', url: '#/feed/ershouList?dataListType=staggered' }) },
      { id: 1, title: '分类入口', entityTemplate: 'imageSquareScrollCard' },
    ], hasMore: false });
  });
  it('不足 20 条的二手页继续分页，空页才停止加载', async () => {
    api.getDiscoveryPageData.mockResolvedValueOnce({ data: [{ id: 10, title: '第一页商品', entityType: 'feed', feedType: 'ershou' }], pageContext: 'context-1' });
    const w = await render();
    try {
      expect(w.find('.no-more').exists()).toBe(false);
      api.getDiscoveryPageData.mockResolvedValueOnce({ data: [{ id: 11, title: '第二页商品', entityType: 'feed', feedType: 'ershou' }] });
      await w.find('.discover-scroll-container').trigger('scroll'); await flushPromises();
      expect(api.getDiscoveryPageData.mock.calls[2][0]).toMatchObject({ page: 2, lastItem: '10', pageContext: 'context-1' });
      expect(w.text()).toContain('第二页商品');
      expect(w.find('.no-more').exists()).toBe(false);
      api.getDiscoveryPageData.mockResolvedValueOnce({ data: [] });
      await w.find('.discover-scroll-container').trigger('scroll'); await flushPromises();
      expect(w.find('.no-more').exists()).toBe(true);
      const count = api.getDiscoveryPageData.mock.calls.length;
      await w.find('.discover-scroll-container').trigger('scroll'); await flushPromises();
      expect(api.getDiscoveryPageData).toHaveBeenCalledTimes(count);
    } finally { w.unmount(); }
  });
  it('先加载头部，再自动请求商品，下一页使用商品游标且不重复头部', async () => {
    api.getDiscoveryPageData.mockResolvedValueOnce({ data: [{ id: 10, title: '小米平板5', entityType: 'feed', feedType: 'ershou' }], hasMore: true, lastItem: '10', pageContext: 'feed-context' });
    const w = await render();
    expect(w.text()).toContain('分类入口'); expect(w.text()).toContain('小米平板5');
    expect(api.getDiscoveryPageData.mock.calls[1][0]).toMatchObject({ url: '#/feed/ershouList?dataListType=staggered', page: 1, firstItem: '', lastItem: '' });
    api.getDiscoveryPageData.mockResolvedValueOnce({ data: [{ id: 11, title: 'iPhone', entityType: 'feed', feedType: 'ershou' }], hasMore: false });
    await w.find('.discover-scroll-container').trigger('scroll'); await flushPromises();
    expect(api.getDiscoveryPageData.mock.calls[2][0]).toMatchObject({ url: '#/feed/ershouList?dataListType=staggered', page: 2, lastItem: '10', pageContext: 'feed-context' });
    expect(w.findAll('[data-id="1"]')).toHaveLength(1); expect(w.text()).toContain('iPhone'); w.unmount();
  });
  it('点击二手分类打开独立分类商品页，而不是普通列表页面', async () => {
    api.getDiscoveryPageData.mockResolvedValueOnce({ data:[], hasMore:false });
    api.push.mockReset();
    const w = await render();
    w.findComponent(DiscoveryEntityCard).vm.$emit('open',{entityType:'mainErshouType',id:100,url:'#/feed/ershouList?ershouType=100&dataListType=staggered'});
    await flushPromises();
    expect(api.push).toHaveBeenCalledWith('/secondhand/list?ershouType=100&dataListType=staggered');
    w.unmount();
  });
  it('商品请求失败仍保留入口，重试直接加载商品流', async () => {
    api.getDiscoveryPageData.mockRejectedValueOnce(new Error('网络中断'));
    const w = await render();
    expect(w.text()).toContain('分类入口'); expect(w.find('.error').exists()).toBe(true);
    api.getDiscoveryPageData.mockResolvedValueOnce({ data: [{ id: 10, title: '商品' }], hasMore: false });
    await w.find('.error button').trigger('click'); await flushPromises();
    expect(api.getDiscoveryPageData.mock.calls[2][0]).toMatchObject({ url: '#/feed/ershouList?dataListType=staggered', page: 1 });
    expect(w.text()).toContain('商品'); expect(w.findAll('[data-id="1"]')).toHaveLength(1); w.unmount();
  });
});


it('好物榜入口打开独立榜单详情路由', async () => {
  api.getDiscoveryConfig.mockReset().mockResolvedValue({ data: [{ id: 20131, title: '发现', entities: [{ title: '好物榜', page_name: 'V11_FIND_GOOD_GOODS_HOME', url: 'V11_FIND_GOOD_GOODS_HOME' }] }] });
  api.getDiscoveryPageData.mockReset().mockResolvedValue({ data: [{ id: 123, feedType: 'goodsList', entityType: 'feed', title: '鼠标榜' }], hasMore: false });
  api.push.mockReset();
  const w = await render();
  const vm = w.findComponent(DiscoveryEntityCard);
  vm.vm.$emit('open', { id: 123, feedType: 'goodsList', entityType: 'feed' });
  await flushPromises();
  expect(api.push).toHaveBeenCalledWith('/goods/ranking/123');
  expect(w.find('.discover-content').classes()).not.toContain('has-goods-grid');
  w.unmount();
});
