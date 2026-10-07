import type { DiscoveryEntity } from '../types/discovery';

export function isGoodsRankingEntity(entity: DiscoveryEntity): boolean {
  const feedType = String(entity.feedType || entity.feed_type || '').toLowerCase();
  return feedType === 'goodslist' || String(entity.entityType || '').toLowerCase() === 'goodslist' || (!feedType && !!entity.goodsListInfo);
}

// Official cards accept both GoodsListItem and recommendation Feed entries.
export function getRankingProduct(item: any) {
  const goods = item.extra_entities?.[0] || item.extraEntities?.[0] || item;
  return {
    title: String(goods.product_goods_title || goods.productGoodsTitle || goods.title || ''),
    cover: String(goods.product_goods_cover || goods.product_goods_logo || goods.productGoodsLogo || goods.cover || goods.logo || ''),
    price: goods.price ?? goods.goods_price ?? '',
  };
}

export function getRankingDate(entity: DiscoveryEntity): string {
  const seconds = Number(entity.dateline);
  if (!seconds || !Number.isFinite(seconds)) return '';
  const date = new Date(seconds * 1000);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
