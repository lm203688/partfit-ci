import { requireNativeModule } from 'expo';

type PartfitSharedModule = {
  setWidgetData: (part: string, title: string, days: number) => boolean;
  clearWidgetData: () => boolean;
  indexItems: (json: string) => boolean;
  clearIndex: () => boolean;
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

/** 把本机电器注册到系统聚焦索引（Core Spotlight）。非 iOS / 无原生模块时静默失败。 */
export function indexSearchableItems(
  items: { id: string; title: string; description: string; keywords: string[] }[]
): boolean {
  try {
    return mod ? mod.indexItems(JSON.stringify(items)) : false;
  } catch (e) {
    return false;
  }
}

export function clearSearchableItems(): boolean {
  try {
    return mod ? mod.clearIndex() : false;
  } catch (e) {
    return false;
  }
}
