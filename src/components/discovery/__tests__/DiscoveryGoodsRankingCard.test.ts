import { shallowMount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DiscoveryGoodsRankingCard from '../DiscoveryGoodsRankingCard.vue';
import DiscoveryEntityCard from '../DiscoveryEntityCard.vue';
import { resolveDiscoveryRoute } from '../../../utils/discovery';
import { getRankingProduct } from '../../../utils/goodsRanking';

describe('好物榜官方列表', () => {
  const entity = {
    id: 123, entityType: 'feed', feedType: 'goodsList', title: '鼠标榜', dateline: 1662076800,
    goodsListInfo: { id: 999, item_num: 45, is_open_vote: 1, vote_num: 1267 },
    goodsListItem: [
      { product_goods_title: '第一名', product_goods_logo: 'one.jpg', price: '175.50' },
      { extra_entities: [{ title: '第二名', cover: 'two.jpg', price: '100.00' }] },
      { product_goods_title: '第三名' }, { product_goods_title: '第四名' },
    ],
  };
  it('兼容商品与推荐动态，保持服务器前三名顺序，不补造价格', async () => {
    const w = shallowMount(DiscoveryGoodsRankingCard, { props: { entity } });
    expect(w.findAll('.ranking-product-copy > span').map(e => e.text())).toEqual(['第一名', '第二名', '第三名']);
    expect(w.findAll('small').map(e => e.text())).toEqual(['¥175.50', '¥100.00']);
    expect(w.find('footer').text()).toContain('45个好物 · 1267人投票');
    await w.find('header button').trigger('click');
    expect(w.emitted('open')?.[0]).toEqual([entity]);
    expect(resolveDiscoveryRoute(entity)?.target).toBe('/goods/ranking/123');
    expect(getRankingProduct(entity.goodsListItem[1]).cover).toBe('two.jpg');
  });
  it('榜单优先于普通动态，推荐横幅使用整幅展示', () => {
    const w = shallowMount(DiscoveryEntityCard, { props: { entity } });
    expect(w.findComponent(DiscoveryGoodsRankingCard).exists()).toBe(true);
    expect(w.find('feed-card-stub').exists()).toBe(false);
    const banner = shallowMount(DiscoveryEntityCard, { props: { entity: { entityTemplate: 'imageScrollCard', entities: [entity] } } });
    expect(banner.find('.discovery-ranking-banners').exists()).toBe(true);
    expect(banner.findComponent(DiscoveryGoodsRankingCard).props('featured')).toBe(true);
  });
  it('好物榜的图文横幅链接没有榜单字段时，仍铺满并保留导航', async () => {
    const child = { id: 456, title: '400元内鼠标选什么', pic: 'banner.jpg', url: '/feed/456', description: '介绍' };
    const w = shallowMount(DiscoveryEntityCard, { props: { rankingContext: true, entity: { entityTemplate: 'imageTextScrollCard', entities: [child] } } });
    const banner = w.findComponent(DiscoveryGoodsRankingCard);
    expect(banner.props('featured')).toBe(true);
    expect(w.find('.discovery-group-items').exists()).toBe(false);
    banner.vm.$emit('open', child);
    expect(w.emitted('open')?.[0]).toEqual([child]);
    await w.setProps({ rankingContext: false });
    expect(w.find('.discovery-group-items').exists()).toBe(true);
    w.unmount();
  });
  it('实际接口的 iconListCard + goodsList 使用横幅，iconLinkGridCard 保持分类网格', () => {
    const child = { entityType: 'goodsList', entityTemplate: 'goodsList', id: 58495334, cover: 'banner.jpeg', title: '大学生开学，400元内鼠标选什么？', url: '/feed/58495334', item_num: 28, is_open_vote: 1, vote_num: 252 };
    const w = shallowMount(DiscoveryEntityCard, { props: { rankingContext: true, entity: { entityType: 'card', entityTemplate: 'iconListCard', entities: [child] } } });
    expect(w.find('.discovery-ranking-banners').exists()).toBe(true);
    expect(w.findComponent(DiscoveryGoodsRankingCard).props('featured')).toBe(true);
    expect(w.find('.discovery-group-items').exists()).toBe(false);
    expect(resolveDiscoveryRoute(child)?.target).toBe('/goods/ranking/58495334');
    const banner = shallowMount(DiscoveryGoodsRankingCard, { props: { entity: child, featured: true } });
    expect(banner.find('.ranking-featured-stats').text()).toBe('28个好物 · 252人投票');
    expect(banner.find('app-image-stub').attributes('src')).toBe('banner.jpeg');
    const icons = shallowMount(DiscoveryEntityCard, { props: { rankingContext: true, entity: { entityTemplate: 'iconLinkGridCard', entities: [{ entityType: 'iconLink', title: '手机', pic: 'phone.png' }] } } });
    expect(icons.find('.discovery-icon-grid').exists()).toBe(true);
    expect(icons.find('.discovery-ranking-banners').exists()).toBe(false);
  });
});
