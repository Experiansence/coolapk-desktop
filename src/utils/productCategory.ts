import type { DiscoveryEntity } from '../types/discovery';

/** APK ProductCategoryListActivity searches parent IDs and secondCategoryRows IDs. */
export function findProductCategory(categories: DiscoveryEntity[], id: string) {
  for (const parent of categories) {
    const children: DiscoveryEntity[] = Array.isArray(parent.secondCategoryRows) ? parent.secondCategoryRows : [];
    if (String(parent.id ?? parent.entityId) === id) return { parent, category: children[0] || parent };
    const child = children.find(item => String(item.id ?? item.entityId) === id);
    if (child) return { parent, category: child };
  }
  return undefined;
}
