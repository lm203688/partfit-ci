// 截图/演示用种子数据：EXPO_PUBLIC_DEMO=1 时首次启动写入，日期相对“今天”生成，保证状态可见且可复现
import * as db from './db';
import { addMonths, todayStr } from './due';

export async function seedDemo() {
  const seeded = await db.getSetting('demo_seeded', '0');
  if (seeded === '1') return;
  const today = todayStr();

  const rows = [
    {
      nickname: 'Kitchen fridge',
      category: 'fridge_water',
      brand: 'Samsung',
      model: 'RF28K9070SR/AA',
      partId: 'samsung_haf_cin',
      partNo: 'DA29-00020B',
      intervalMonths: 6,
      lastReplacedAt: addMonths(today, -7),
      matchConfidence: 'confirmed',
    },
    {
      nickname: 'Whole-house humidifier',
      category: 'humidifier_panel',
      brand: 'AprilAire',
      model: '600M',
      partId: 'aprilaire_35',
      partNo: '35',
      intervalMonths: 12,
      lastReplacedAt: addMonths(today, -10),
      matchConfidence: 'confirmed',
    },
    {
      nickname: 'Bedroom air purifier',
      category: 'air_purifier',
      brand: 'Levoit',
      model: 'Core 300S',
      partId: 'levoit_core300_rf',
      partNo: 'Core 300-P-RF',
      intervalMonths: 8,
      lastReplacedAt: addMonths(today, -2),
      matchConfidence: 'confirmed',
    },
  ];

  for (const r of rows) await db.addAppliance(r);
  await db.addLog(1, { partNo: 'DA29-00020B', date: addMonths(today, -7), cost: 54.99, note: 'Replaced' });
  await db.setSetting('demo_seeded', '1');
}
