// 到期推算内核（纯函数，无 IO）：按耗材周期月数滚动，四档状态
const MS_PER_DAY = 86400000;

export function parseDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
  return { y, mo, d };
}

export function formatDate({ y, mo, d }) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 加月，月末收敛（1/31 + 1 月 = 2/28 或 2/29） */
export function addMonths(dateStr, months) {
  const p = parseDate(dateStr);
  if (!p || !Number.isInteger(months)) return null;
  const total = p.y * 12 + (p.mo - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  return formatDate({ y: ny, mo: nm, d: Math.min(p.d, lastDay) });
}

export function daysBetween(fromStr, toStr) {
  const a = parseDate(fromStr), b = parseDate(toStr);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(a.y, a.mo - 1, a.d)) / MS_PER_DAY);
}

export function todayStr(now = new Date()) {
  return formatDate({ y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate() });
}

export const STATUS = { OVERDUE: 'overdue', URGENT: 'urgent', DUE: 'due', OK: 'ok', UNKNOWN: 'unknown' };

/**
 * appliance: { lastReplacedAt, intervalMonths }；today: 'YYYY-MM-DD'
 * 未记录过更换 → 立刻待办（不返回负数）
 */
export function computeDue(appliance, today) {
  const interval = appliance.intervalMonths || appliance.interval_months;
  const last = appliance.lastReplacedAt || appliance.last_replaced_at;
  if (!last) {
    return { status: STATUS.DUE, daysLeft: null, nextDueDate: today, reason: 'never_replaced' };
  }
  const nextDueDate = addMonths(last, interval);
  const daysLeft = nextDueDate == null ? null : daysBetween(today, nextDueDate);
  let status = STATUS.OK;
  if (daysLeft == null) status = STATUS.UNKNOWN;
  else if (daysLeft < 0) status = STATUS.OVERDUE;
  else if (daysLeft <= 14) status = STATUS.URGENT;
  else if (daysLeft <= 30) status = STATUS.DUE;
  return { status, daysLeft, nextDueDate, reason: 'computed' };
}

const ORDER = { overdue: 3, urgent: 2, due: 1, ok: 0, unknown: 0 };

/** 整机状态 = 最差的那一项 */
export function worstStatus(items) {
  let worst = STATUS.OK;
  for (const it of items || []) {
    const s = typeof it === 'string' ? it : it.status;
    if (ORDER[s] > ORDER[worst]) worst = s;
  }
  return worst;
}

export function formatRemaining(daysLeft) {
  if (daysLeft == null) return 'Not scheduled';
  if (daysLeft < 0) return `${Math.abs(daysLeft)} days overdue`;
  if (daysLeft === 0) return 'Due today';
  if (daysLeft <= 60) return `${daysLeft} days left`;
  return `${Math.round(daysLeft / 30)} months left`;
}

export function statusLabel(status) {
  return {
    overdue: 'Overdue',
    urgent: 'Due soon',
    due: 'Coming up',
    ok: 'On track',
    unknown: 'Unknown',
  }[status] || 'On track';
}
