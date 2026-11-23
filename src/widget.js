import { setWidgetData, clearWidgetData } from '../modules/partfit-shared';

/**
 * 选择"最该关注"的一台电器推到小组件：
 * 到期越近越优先（逾期最先），同档位按天数升序；没有排期的排最后。
 * 返回是否写入了数据（便于测试）。
 */
export function pickWidgetTarget(rows) {
  const list = (rows || []).filter((r) => r && r.due);
  if (list.length === 0) return null;
  const rank = { overdue: 3, urgent: 2, due: 1, ok: 0, unknown: 0 };
  const sorted = [...list].sort((a, b) => {
    const d = (rank[b.due.status] || 0) - (rank[a.due.status] || 0);
    if (d !== 0) return d;
    const av = a.due.daysLeft == null ? Number.POSITIVE_INFINITY : a.due.daysLeft;
    const bv = b.due.daysLeft == null ? Number.POSITIVE_INFINITY : b.due.daysLeft;
    return av - bv;
  });
  return sorted[0];
}

/** 主屏拿到电器列表后调用；失败静默（非 iOS 或未链接原生模块时）。 */
export function syncWidget(rows) {
  const target = pickWidgetTarget(rows);
  if (!target) {
    clearWidgetData();
    return false;
  }
  const title = target.nickname || [target.brand, target.model].filter(Boolean).join(' ');
  const part = target.part_no || target.partNo || '';
  if (!part) {
    // 还不知道具体滤芯型号时，小组件退化为"待确认"，避免显示空型号
    clearWidgetData();
    return false;
  }
  const days = target.due.daysLeft == null ? 0 : target.due.daysLeft;
  return setWidgetData(part, title || '', days);
}
