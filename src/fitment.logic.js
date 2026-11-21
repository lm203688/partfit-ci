// PartFit 匹配内核（纯函数，无 IO、无 RN 依赖）：与 tools/match.py 同一套规则
// 规则来源：docs/机型覆盖长尾方案.md L0–L3

const CONFIDENCE = {
  confirmed: 'confirmed',
  likely: 'likely',
  check: 'check',
  candidate: 'candidate',
  unknown: 'unknown',
  ambiguous: 'ambiguous',
};

/** 归一：全角转半角、大写、仅保留字母数字。'RF28K9070SR/AA' -> 'RF28K9070SRAA' */
export function normalize(input) {
  if (input == null) return '';
  const s = String(input)
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .toUpperCase();
  return s.replace(/[^A-Z0-9]/g, '');
}

/** 去掉区域/颜色后缀（/AA、/AC、/** 等）后的主型号 */
export function normalizeBase(input) {
  if (input == null) return '';
  const s = String(input).toUpperCase().split(/[/\\]/)[0];
  return normalize(s);
}

function flatten(dataset) {
  if (dataset.__flat) return dataset.__flat;
  const partsById = {};
  for (const p of dataset.parts) partsById[p.id] = p;
  const rows = [];
  for (const f of dataset.fitments) {
    const p = partsById[f.part_id];
    for (const v of f.selector.values) {
      rows.push({
        fitment_id: f.id,
        part_id: f.part_id,
        kind: f.selector.type,
        value_raw: v,
        norm_full: normalize(v),
        norm_base: normalizeBase(v),
        fit_grade: f.grade,
        source_url: f.source_url,
        note: f.note || null,
        conflict: f.conflict || null,
        part_no: p ? p.part_no : '',
        brand: p ? p.brand : '',
        title: p ? p.title : '',
        spec: p ? p.spec : '',
        interval_months: p ? p.interval_months : null,
        category: f.category,
      });
    }
  }
  dataset.__flat = rows;
  return rows;
}

function pack(row, confidence, matchedLen) {
  return {
    partId: row.part_id,
    partNo: row.part_no,
    brand: row.brand,
    title: row.title,
    spec: row.spec,
    intervalMonths: row.interval_months,
    category: row.category,
    kind: row.kind,
    valueRaw: row.value_raw,
    matchedPrefixLen: matchedLen,
    confidence,
    evidenceGrade: row.fit_grade,
    sourceUrl: row.source_url,
    note: row.note,
    conflict: row.conflict,
  };
}

/**
 * 三级匹配：精确 → 前缀（按具体度排序）→ 同族模糊候选；未命中也要给下一步。
 * 返回 { status, confidence, hits, hint }
 */
export function matchModel(dataset, model) {
  const full = normalize(model);
  const base = normalizeBase(model);
  const rows = flatten(dataset);
  const out = { input: model, norm: base, status: 'unknown', confidence: CONFIDENCE.unknown, hits: [], hint: null };

  if (!base) {
    out.hint = 'Enter or scan a model number';
    return out;
  }

  const exact = rows.filter((r) => r.norm_full === full || r.norm_base === base);
  if (exact.length) {
    const hits = exact.map((r) => pack(r, CONFIDENCE.confirmed, base.length));
    const parts = new Set(hits.map((h) => h.partId));
    out.hits = hits;
    if (parts.size > 1) {
      out.status = 'matched_variants';
      out.confidence = CONFIDENCE.confirmed;
      out.hint = 'This appliance takes more than one filter option — pick the one you need.';
    } else {
      out.status = 'matched';
      out.confidence = CONFIDENCE.confirmed;
    }
    return out;
  }

  const pref = rows
    .filter((r) => r.kind === 'prefix' && r.norm_base.length >= 4 && base.startsWith(r.norm_base))
    .sort((a, b) => b.norm_base.length - a.norm_base.length);
  if (pref.length) {
    const bestLen = pref[0].norm_base.length;
    const best = pref.filter((r) => r.norm_base.length === bestLen);
    const parts = new Set(best.map((r) => r.part_id));
    const conf = bestLen >= 5 ? CONFIDENCE.likely : CONFIDENCE.check;
    out.hits = best.map((r) => pack(r, conf, bestLen));
    out.status = parts.size > 1 ? 'ambiguous' : 'matched_by_prefix';
    out.confidence = parts.size > 1 ? CONFIDENCE.ambiguous : conf;
    out.hint =
      parts.size > 1
        ? 'This series maps to more than one filter — check the label inside the appliance.'
        : 'Matched by the manufacturer series rule. Confirm against the label inside your appliance.';
    return out;
  }

  // 模糊候选：只给“你要找的是不是”，绝不硬猜成适配
  const candidates = rows
    .filter((r) => r.kind === 'exact' && r.norm_base.length >= 6)
    .map((r) => r.norm_base);
  const near = closest(base, candidates, 3);
  if (near.length) {
    const seen = {};
    out.hits = near
      .map((n) => rows.find((r) => r.norm_base === n && r.kind === 'exact'))
      .filter((r) => r && !seen[r.part_id] && (seen[r.part_id] = 1))
      .map((r) => ({
        partId: r.part_id,
        partNo: r.part_no,
        brand: r.brand,
        title: r.title,
        valueRaw: r.value_raw,
        confidence: CONFIDENCE.candidate,
      }));
    out.status = 'suggestion';
    out.confidence = CONFIDENCE.candidate;
    out.hint = 'No exact hit. These are close matches — or scan the label on your old filter instead.';
    return out;
  }

  out.hint = 'Not in the library yet. Scan the label on your old filter, or send us the model so we can add it.';
  return out;
}

/** 最长公共前缀打分，取前 n 个（阈值 0.72 同 Python 版思路） */
export function closest(input, pool, n = 3) {
  const scored = [];
  for (const p of pool) {
    const score = commonPrefix(input, p) / Math.max(input.length, p.length);
    if (score >= 0.72) scored.push([p, score]);
  }
  scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const uniq = [];
  for (const [p] of scored) if (!uniq.includes(p)) uniq.push(p);
  return uniq.slice(0, n);
}

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/** 反查：旧滤芯上的料号 → 部件（覆盖长尾的主入口） */
export function lookupPart(dataset, text) {
  const n = normalize(text);
  if (!n) return [];
  return dataset.parts
    .filter((p) => {
      const pn = normalize(p.part_no);
      return pn === n || (pn.length >= 4 && (pn.includes(n) || n.includes(pn)));
    })
    .map((p) => ({
      partId: p.id,
      partNo: p.part_no,
      brand: p.brand,
      title: p.title,
      spec: p.spec,
      intervalMonths: p.interval_months,
      category: p.category,
    }));
}

/** 不知道型号时的品牌→系列族入口 */
export function families(dataset, brand) {
  const rows = flatten(dataset).filter((r) => r.brand.toLowerCase().includes(String(brand).toLowerCase()));
  const fam = {};
  for (const r of rows) {
    const key = r.norm_base.length >= 6 ? r.norm_base.slice(0, 6) : r.norm_base;
    if (key.length < 3) continue;
    const f = fam[key] || (fam[key] = { family: key, examples: [], parts: [] });
    if (!f.examples.includes(r.value_raw) && f.examples.length < 3) f.examples.push(r.value_raw);
    if (!f.parts.includes(r.part_no)) f.parts.push(r.part_no);
  }
  return Object.values(fam)
    .map((f) => ({ ...f, selectorCount: f.parts.length }))
    .sort((a, b) => b.examples.length - a.examples.length);
}

/** 反查的下一步：这个部件装在哪些机型上（L1 杠杆），按证据等级排序 */
export function adaptersFor(dataset, partId) {
  const rows = flatten(dataset)
    .filter((r) => r.part_id === partId)
    .map((r) => ({ model: r.value_raw, grade: r.fit_grade, sourceUrl: r.source_url, note: r.note }));
  const seen = new Set();
  const uniq = [];
  for (const r of rows) {
    const key = normalize(r.model);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(r);
  }
  const rank = { explicit: 0, rule: 1, part_only: 2 };
  uniq.sort((a, b) => (rank[a.grade] ?? 3) - (rank[b.grade] ?? 3));
  return uniq;
}

export function partById(dataset, id) {
  return dataset.parts.find((p) => p.id === id) || null;
}

export function evidenceFor(dataset, partId) {
  const p = partById(dataset, partId);
  return p ? p.evidence : [];
}

export { CONFIDENCE };
