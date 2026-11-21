// RN 侧入口：把打包进 assets 的适配库接到纯函数内核上
import data from '../assets/data/fitment.json';
import {
  matchModel,
  lookupPart,
  families,
  partById,
  evidenceFor,
  adaptersFor,
  normalize,
  normalizeBase,
  CONFIDENCE,
} from './fitment.logic';

export const DATASET = data;

export function match(model) {
  return matchModel(DATASET, model);
}
export function lookup(text) {
  return lookupPart(DATASET, text);
}
export function brandFamilies(brand) {
  return families(DATASET, brand);
}
export function getPart(id) {
  return partById(DATASET, id);
}
export function getEvidence(id) {
  return evidenceFor(DATASET, id);
}
export function adapters(id) {
  return adaptersFor(DATASET, id);
}
/** Flattened "what we checked" rows for the Sources screen. */
export function sources() {
  const rows = [];
  for (const p of DATASET.parts) {
    const fitments = DATASET.fitments.filter((f) => f.part_id === p.id);
    const fitGrade = fitments[0] ? fitments[0].grade : null;
    for (const e of p.evidence || []) {
      rows.push({
        partId: p.id,
        partNo: p.part_no,
        brand: p.brand,
        fitGrade,
        publisher: e.publisher,
        url: e.url,
        retrievedAt: e.retrieved_at,
        grade: e.grade,
        quote: e.quote,
      });
    }
  }
  return rows;
}
export function grades() {
  return DATASET.evidence_grades || {};
}
export function conflictFor(partId) {
  return (DATASET.conflicts || []).find((c) => c.part_id === partId) || null;
}
export function categories() {
  return DATASET.categories || [];
}
export { normalize, normalizeBase, CONFIDENCE };
