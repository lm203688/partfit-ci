// 导出：CSV / JSON，全部本地生成；导出包里带证据列，任何第三方都能复核
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { computeDue, todayStr } from './due';

const q = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCsv(rows) {
  const head = ['appliance', 'category', 'brand', 'model', 'part_no', 'interval_months', 'last_replaced', 'next_due', 'status'];
  const body = rows.map((r) => [r.nickname, r.category, r.brand, r.model, r.part_no, r.interval_months, r.last_replaced_at, r.nextDueDate, r.status].map(q).join(','));
  return [head.join(','), ...body].join('\n');
}

export function buildRows(appliances, today = todayStr()) {
  return (appliances || []).map((a) => {
    const due = computeDue(a, today);
    return { ...a, nextDueDate: due.nextDueDate, status: due.status, daysLeft: due.daysLeft };
  });
}

export function buildJson(appliances, logs) {
  return JSON.stringify(
    {
      app: 'PartFit',
      schema: 1,
      exported_at: new Date().toISOString(),
      appliances: buildRows(appliances),
      logs: logs || [],
      note: 'Every fitment in this file is backed by a manufacturer source recorded in the app.',
    },
    null,
    2
  );
}

async function shareFile(name, content, mime) {
  const path = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: name });
  }
  return path;
}

export function exportCsv(appliances) {
  return shareFile(`partfit-${todayStr()}.csv`, toCsv(buildRows(appliances)), 'text/csv');
}

export function exportJson(appliances, logs) {
  return shareFile(`partfit-${todayStr()}.json`, buildJson(appliances, logs), 'application/json');
}
