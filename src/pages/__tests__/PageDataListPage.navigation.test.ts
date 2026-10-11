import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { expect, it, vi } from 'vitest';
import PageDataListPage from '../PageDataListPage.vue';

const api = vi.hoisted(() => ({ getProductCategoryList: vi.fn(), getDiscoveryPageData: vi.fn(), getBoardFeeds: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));

it('退出全部后不切换缓存实例的渲染器，返回保留分类和滚动位置', async () => {
  api.getProductCategoryList.mockResolvedValue({ data: [
    { id: 0, title: '热门', url: 'HOT' },
    { id: 1012, title: '路由器', url: 'ROUTERS' },
  ] });
  api.getDiscoveryPageData.mockImplementation(async ({ url }) => ({ data: [{ id: url, title: `${url} 内容` }], hasMore: false }));
  api.getBoardFeeds.mockResolvedValue({ data: [] });
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/digital', component: { template: '<div class="digital-home">数码首页</div>' } },
    { path: '/page', component: PageDataListPage },
  ] });
  const host = defineComponent({ template: '<router-view v-slot="{ Component, route }"><keep-alive><component :is="Component" :key="route.fullPath" /></keep-alive></router-view>' });
  await router.push('/digital');
  const wrapper = mount(host, { global: { plugins: [router, createPinia()], stubs: { AppImage: true, DiscoveryEntityCard: { props: ['entity'], template: '<article>{{ entity.title }}</article>' } } } });
  try {
    await router.push({ path: '/page', query: { url: '/product/categoryList', title: '全部', renderer: 'discovery' } });
    await flushPromises();
    await wrapper.findAll('.category-directory button')[1]!.trigger('click');
    await flushPromises();
    const directory = wrapper.get('.category-directory').element;
    const results = wrapper.get('.category-results').element as HTMLElement;
    results.scrollTop = 180;
    router.back();
    await flushPromises();
    expect(wrapper.text()).toBe('数码首页');
    expect(api.getBoardFeeds).not.toHaveBeenCalled();

    // A second /page instance must not reconfigure the cached category instance.
    await router.push({ path: '/page', query: { url: 'BRAND', title: '小米', renderer: 'discovery' } });
    await flushPromises();
    expect(wrapper.text()).toContain('BRAND 内容');
    await router.push({ path: '/page', query: { url: '/product/categoryList', title: '全部', renderer: 'discovery' } });
    await flushPromises();
    expect(wrapper.get('.category-directory').element).toBe(directory);
    expect(wrapper.get('.category-results h3').text()).toBe('路由器');
    expect((wrapper.get('.category-results').element as HTMLElement).scrollTop).toBe(180);
    expect(wrapper.text()).not.toContain('酷安内容');
    expect(api.getProductCategoryList).toHaveBeenCalledTimes(1);
    expect(api.getDiscoveryPageData.mock.calls.map(([options]) => options.url)).toEqual(['HOT', 'ROUTERS', 'BRAND']);
  } finally { wrapper.unmount(); }
});
