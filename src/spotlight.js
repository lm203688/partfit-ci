import { indexSearchableItems, clearSearchableItems } from '../modules/partfit-shared';
import { spotlightPayload } from './spotlight.pick';

/** 主屏数据变化时刷新系统索引；没有电器就清空，非 iOS 静默失败。 */
export function syncSpotlight(rows) {
  const items = spotlightPayload(rows);
  if (items.length === 0) return clearSearchableItems();
  return indexSearchableItems(items);
}
