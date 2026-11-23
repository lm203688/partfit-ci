import { requireNativeModule } from 'expo';

type PartfitSharedModule = {
  setWidgetData: (part: string, title: string, days: number) => boolean;
  clearWidgetData: () => boolean;
};

let mod: PartfitSharedModule | null = null;
try {
  mod = requireNativeModule<PartfitSharedModule>('PartfitShared');
} catch (e) {
  mod = null;
}

/** 把"下一个要换的滤芯"写入 App Group，供 WidgetKit 读取。非 iOS / 无原生模块时静默失败。 */
export function setWidgetData(part: string, title: string, days: number): boolean {
  try {
    return mod ? mod.setWidgetData(part, title, days) : false;
  } catch (e) {
    return false;
  }
}

export function clearWidgetData(): boolean {
  try {
    return mod ? mod.clearWidgetData() : false;
  } catch (e) {
    return false;
  }
}
