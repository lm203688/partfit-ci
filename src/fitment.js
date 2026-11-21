// RN 侧入口：把打包进 assets 的适配库接到纯函数内核上
import data from '../assets/data/fitment.json';
import {
  matchModel,
  lookupPart,
  families,
  partById,
  evidenceFor,
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
export function conflictFor(partId) {
  return (DATASET.conflicts || []).find((c) => c.part_id === partId) || null;
}
export function categories() {
  return DATASET.categories || [];
}
export { normalize, normalizeBase, CONFIDENCE };
