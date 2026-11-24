// 纯函数：把主屏 rows（已带 due）转成 Spotlight 条目（供索引与测试共用，无原生依赖）

/** 与 src/due.js 的 formatRemaining 同一口径，这里内联一份，保持本文件零依赖。 */
function remaining(daysLeft) {
  if (daysLeft == null) return 'Not scheduled';
  if (daysLeft < 0) return `${Math.abs(daysLeft)} days overdue`;
  if (daysLeft === 0) return 'Due today';
  if (daysLeft <= 60) return `${daysLeft} days left`;
  return `${Math.round(daysLeft / 30)} months left`;
}

/**
 * 只放用户自己能认出来的词（昵称 / 品牌 / 型号 / 滤芯型号 / 类别），
 * 不写内部字段，避免搜出一条看得懂却对不上的结果。
 */
export function spotlightPayload(rows) {
  const items = [];
  for (const r of rows || []) {
    if (!r || r.id == null) continue;
    const title = (r.nickname || [r.brand, r.model].filter(Boolean).join(' ') || 'Appliance').trim();
    const bits = [];
    const model = [r.brand, r.model].filter(Boolean).join(' ').trim();
    if (model) bits.push(model);
    if (r.part_no) bits.push(`Filter ${r.part_no}`);
    if (r.due) bits.push(remaining(r.due.daysLeft));
    const keywords = [title, r.brand, r.model, r.part_no, r.category, r.nickname, 'filter', 'partfit']
      .filter((x) => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim());
    items.push({
      id: `appliance:${r.id}`,
      title,
      description: bits.join(' · '),
      keywords: Array.from(new Set(keywords)),
    });
  }
  return items;
}
