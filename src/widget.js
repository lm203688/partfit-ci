import {
  setWidgetData,
  clearWidgetData,
  liveActivityEnabled,
  startFilterActivity,
  endFilterActivity,
} from '../modules/partfit-shared';

// 只有临期（含逾期）才值得占锁屏。
export const LIVE_ACTIVITY_WINDOW_DAYS = 7;
import { pickWidgetTarget, widgetPayload } from './widget.pick';

/** 主屏拿到电器列表后调用；失败静默（非 iOS 或未链接原生模块时）。 */
export function syncWidget(rows) {
  const payload = widgetPayload(pickWidgetTarget(rows));
  if (!payload) {
    clearWidgetData();
    endFilterActivity();
    return false;
  }
  const ok = setWidgetData(payload.part, payload.title, payload.days);
  syncFilterActivity(payload);
  return ok;
}

/** 锁屏实时活动：days 为负数表示逾期。 */
export async function syncFilterActivity(payload) {
  try {
    if (!liveActivityEnabled()) return false;
    if (!(payload.days <= LIVE_ACTIVITY_WINDOW_DAYS)) {
      await endFilterActivity();
      return false;
    }
    const detail =
      payload.days < 0
        ? `${-payload.days} days overdue`
        : payload.days === 0
        ? 'Due today'
        : `Due in ${payload.days} days`;
    return await startFilterActivity(payload.part, payload.title, detail, payload.days);
  } catch (e) {
    return false;
  }
}
