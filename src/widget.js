import { setWidgetData, clearWidgetData } from '../modules/partfit-shared';
import { pickWidgetTarget, widgetPayload } from './widget.pick';

/** 主屏拿到电器列表后调用；失败静默（非 iOS 或未链接原生模块时）。 */
export function syncWidget(rows) {
  const payload = widgetPayload(pickWidgetTarget(rows));
  if (!payload) {
    clearWidgetData();
    return false;
  }
  return setWidgetData(payload.part, payload.title, payload.days);
}
