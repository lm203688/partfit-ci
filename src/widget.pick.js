// 纯函数：挑出"最该关注"的一台电器（供小组件与测试共用，无原生依赖）
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

/** 期望写进小组件的字段（型号为空时返回 null，表示应清空小组件） */
export function widgetPayload(row) {
  if (!row) return null;
  const part = row.part_no || row.partNo || '';
  if (!part) return null;
  const title = row.nickname || [row.brand, row.model].filter(Boolean).join(' ');
  const days = row.due && row.due.daysLeft != null ? row.due.daysLeft : 0;
  return { part, title: title || '', days };
}
