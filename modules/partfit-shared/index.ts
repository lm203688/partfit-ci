import { requireNativeModule } from 'expo';

type PartfitSharedModule = {
  setWidgetData: (part: string, title: string, days: number) => boolean;
  clearWidgetData: () => boolean;
  indexItems: (json: string) => boolean;
  clearIndex: () => boolean;
  liveActivityEnabled: () => boolean;
  startFilterActivity: (
    part: string,
    headline: string,
    detail: string,
    days: number
  ) => Promise<boolean>;
  endFilterActivity: () => Promise<boolean>;
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

export function liveActivityEnabled(): boolean {
  try {
    return mod ? !!mod.liveActivityEnabled() : false;
  } catch (e) {
    return false;
  }
}

/** 临期滤芯的锁屏倒计时，失败静默。 */
export async function startFilterActivity(
  part: string,
  headline: string,
  detail: string,
  days: number
): Promise<boolean> {
  try {
    return mod ? await mod.startFilterActivity(part, headline, detail, days) : false;
  } catch (e) {
    return false;
  }
}

export async function endFilterActivity(): Promise<boolean> {
  try {
    return mod ? await mod.endFilterActivity() : false;
  } catch (e) {
    return false;
  }
}
