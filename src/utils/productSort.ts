import type { DiscoveryEntity } from '../types/discovery';

// Sorting responses may contain products only. Keep the original page header
// through the sort controls, and replace only the content below those controls.
export function replaceSortedProducts(current: DiscoveryEntity[], incoming: DiscoveryEntity[], target: string): DiscoveryEntity[] {
  if (!target) return incoming;
  const isSort = (item: DiscoveryEntity) => String(item.entityTemplate).toLowerCase() === 'sortselectcard';
  const index = current.findIndex(isSort);
  if (index < 0) return markProductSort(incoming, target);
  const incomingIndex = incoming.findIndex(isSort);
  const products = incomingIndex < 0 ? incoming : incoming.slice(incomingIndex + 1);
  return [...markProductSort(current.slice(0, index + 1), target), ...products];
}

export function productSortTarget(items: DiscoveryEntity[], option: DiscoveryEntity): string {
  for (const item of items) {
    if (String(item.entityTemplate).toLowerCase() === 'sortselectcard'
      && item.entities?.some(child => child.url && child.url === option.url)) return String(option.url);
    const nested = item.entities ? productSortTarget(item.entities, option) : '';
    if (nested) return nested;
  }
  return '';
}

export function markProductSort(items: DiscoveryEntity[], target: string): DiscoveryEntity[] {
  if (!target) return items;
  const sortKey = (url: string) => {
    const outer = new URL(url.replace(/^#/, ''), 'https://www.coolapk.com');
    const inner = new URL(outer.searchParams.get('url') || url.replace(/^#/, ''), 'https://www.coolapk.com');
    return `${inner.searchParams.get('sortField')}|${inner.searchParams.get('limitField') || ''}`;
  };
  return items.map(item => {
    if (!item.entities) return item;
    if (String(item.entityTemplate).toLowerCase() === 'sortselectcard') {
      return { ...item, entities: item.entities.map(child => ({ ...child, selected: child.url && sortKey(child.url) === sortKey(target) ? 1 : 0 })) };
    }
    return { ...item, entities: markProductSort(item.entities, target) };
  });
}
