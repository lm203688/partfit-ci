// 本地到期通知：到期前 14 / 3 / 0 天各一次，全部本地调度，不联网。
import * as Notifications from 'expo-notifications';
import { computeDue, todayStr, STATUS } from './due';

const DAY = 86400000;
const isDemo = process.env.EXPO_PUBLIC_DEMO === '1';
const PROVISIONAL = 3;

export async function permissionInfo() {
  try {
    const cur = await Notifications.getPermissionsAsync();
    return { granted: !!cur.granted, status: cur && cur.ios ? cur.ios.status : null };
  } catch (e) {
    return { granted: false, status: null };
  }
}

function allowed(info) {
  return !!info && (info.granted || (isDemo && info.status === PROVISIONAL));
}

export async function ensurePermission() {
  try {
    if (allowed(await permissionInfo())) return true;
    const req = isDemo
      ? await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true, allowProvisional: true },
        })
      : await Notifications.requestPermissionsAsync();
    if (req && req.granted) return true;
    return isDemo && !!req && !!req.ios && req.ios.status === PROVISIONAL;
  } catch (e) {
    return false;
  }
}

let LAST = { items: 0, withDue: 0, scheduled: 0, errors: [] };
export function lastSchedule() {
  return LAST;
}

/** 重建全部提醒；返回排入条数。sound 固定 'default'（VehicleVault 踩过的坑） */
export async function rescheduleAll(appliances, opts = {}) {
  const ok = opts.requestPermission === false ? allowed(await permissionInfo()) : await ensurePermission();
  LAST = { items: appliances ? appliances.length : 0, withDue: 0, scheduled: 0, errors: [] };
  if (!ok) {
    LAST.errors.push('permission-denied');
    return 0;
  }
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  } catch (e) {
    // 清理失败不阻塞重排
  }

  const today = todayStr();
  let count = 0;
  for (const a of appliances || []) {
    const due = computeDue(a, today);
    LAST.withDue += 1;
    if (due.status === STATUS.OK || !due.nextDueDate) continue;
    const at = new Date(due.nextDueDate + 'T09:00:00');
    for (const offset of [14, 3, 0]) {
      const when = new Date(at.getTime() - offset * DAY);
      if (when.getTime() <= Date.now() + 60 * 1000) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: offset === 0 ? `Change ${a.nickname} filter` : `${a.nickname} filter due in ${offset} days`,
            body: `${a.part_no || 'Filter'} · every ${a.interval_months} months`,
            sound: 'default',
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
        });
        count += 1;
      } catch (e) {
        LAST.errors.push(String(e && e.message ? e.message : e).slice(0, 120));
      }
    }
  }
  LAST.scheduled = count;
  return count;
}

export async function hasPermission() {
  return allowed(await permissionInfo());
}

export async function countScheduled() {
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch (e) {
    return 0;
  }
}
