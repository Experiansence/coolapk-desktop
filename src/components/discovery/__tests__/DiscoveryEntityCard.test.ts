import { shallowMount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DiscoveryEntityCard from '../DiscoveryEntityCard.vue';

describe('官方发现卡片模板', () => {
  it('二手商品使用专用卡片，分类保持横向图片入口和原始导航', async () => {
    const feed = shallowMount(DiscoveryEntityCard, { props: { entity: { id:12, entityType:'feed', entityTemplate:'feedErshou', feedType:'ershou', ershou_info:{product_price:660} } } });
    expect(feed.findComponent({ name:'DiscoverySecondHandCard' }).exists()).toBe(true);
    expect(feed.findComponent({ name:'FeedCard' }).exists()).toBe(false);
    const child = { title:'手机', logo:'phone.png', url:'#/feed/ershouList?ershouType=100' };
    const category = shallowMount(DiscoveryEntityCard, { props: { entity: { entityTemplate:'imageSquareScrollCard', entities:[child] } } });
    await category.find('.discovery-square-links button').trigger('click');
    expect(category.emitted('open')).toEqual([[child]]);
  });
  it('发现页分类筛选在页内刷新，其他列表仍使用原有入口导航', async () => {
    const child = { title: '兴趣爱好', url: '#/feed/hotList' };
    const w = shallowMount(DiscoveryEntityCard, { props: { inlineSelectors: true, entity: { entityTemplate: 'selectorLinkCard', entities: [child] } } });
    await w.find('.discovery-pill-btn').trigger('click');
    expect(w.emitted('filter')?.at(-1)).toEqual([child]);
    expect(w.emitted('open')).toBeUndefined();
    await w.setProps({ inlineSelectors: false });
    await w.find('.discovery-pill-btn').trigger('click');
    expect(w.emitted('open')?.at(-1)).toEqual([child]);
    w.unmount();
  });
  it('热门专区按顺序显示小图标入口，并保留原始实体导航', async () => {
    const children = [{ id: 1, entityType: 'topic', title: '户外兴趣小组', logo: 'outdoor.png', url: '/t/户外兴趣小组', follownum: 3113 }, { id: 2, entityType: 'topic', title: '运动健身', url: '/t/运动健身' }, { id: 3, entityType: 'topic', title: '骑行', url: '/t/骑行' }];
    const entity = { entityTemplate: 'iconMiniGridCard', title: '热门专区', subTitle: '更多', url: '#/topic/tagList', entities: children };
    const w = shallowMount(DiscoveryEntityCard, { props: { entity } });
    expect(w.findAll('.discovery-mini-name').map(item => item.text())).toEqual(['户外兴趣小组', '运动健身', '骑行']);
    expect(w.findAll('.topic-card')).toHaveLength(0);
    expect(w.text()).not.toContain('3113');
    await w.findAll('.discovery-mini-grid-item')[1].trigger('click');
    expect(w.emitted('open')?.at(-1)).toEqual([children[1]]);
    await w.find('header button').trigger('click');
    expect(w.emitted('open')?.at(-1)).toEqual([entity]);
    w.unmount();
  });
  it('点击轮播打开当前横幅，翻页按钮不触发导航', async () => {
    const entities = [{ title: '第一张', pic: 'one.png', url: '/t/one' }, { title: '第二张', pic: 'two.png', url: '/t/two' }];
    const w = shallowMount(DiscoveryEntityCard, { props: { entity: { entityTemplate: 'imageCarouselCard', entities } } });
    await w.find('.carousel-control.next').trigger('click');
    expect(w.emitted('open')).toBeUndefined();
    await w.find('.carousel-viewport').trigger('click');
    expect(w.emitted('open')?.at(-1)).toEqual([entities[1]]);
    w.unmount();
  });
});
