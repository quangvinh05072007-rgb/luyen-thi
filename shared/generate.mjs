// Sinh đề theo ma trận (số câu từng phần, chuyên đề, tỉ lệ mức độ) và đảo mã đề.
import { makeRng, shuffle } from './rng.mjs';
import { LEVELS, QUESTION_TYPES } from './topics.mjs';

export function imageOptions(q) {
  if(q?.type!=='mcq'||!/\[\[img:/.test(q.stem??''))return false;
  if([...String(q.sourceStem??'').matchAll(/\[\[img:\d+\]\]/g)].some(m=>q.stem.includes(m[0])))return true;
  return q.options?.length===4 && q.options.every((o,i)=>o===`Phương án ${'ABCD'[i]} trong ảnh gốc.`);
}

export const OFFICIAL_BLUEPRINT = {
  counts: { mcq: 12, tf: 4, short: 6 },
  levels: { 1: 40, 2: 30, 3: 30 },
  topics: [],
  durationMin: 90,
};

/** Chia n thành các phần theo trọng số (phương pháp phần dư lớn nhất). */
export function apportion(n, weights) {
  const keys = Object.keys(weights);
  const total = keys.reduce((s, k) => s + Math.max(0, Number(weights[k]) || 0), 0);
  if (n <= 0 || total === 0) return Object.fromEntries(keys.map((k) => [k, 0]));
  const raw = keys.map((k) => ({ k, v: (n * Math.max(0, Number(weights[k]) || 0)) / total }));
  const out = Object.fromEntries(raw.map(({ k, v }) => [k, Math.floor(v)]));
  let left = n - raw.reduce((s, { v }) => s + Math.floor(v), 0);
  raw
    .map(({ k, v }) => ({ k, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r || keys.indexOf(a.k) - keys.indexOf(b.k))
    .forEach(({ k }) => {
      if (left > 0) {
        out[k]++;
        left--;
      }
    });
  return out;
}

/**
 * pool: câu hỏi [{id, type, topic, level, status}]
 * blueprint: { counts, levels, topics (rỗng = mọi chuyên đề), avoidIds?, seed }
 * Trả về { items: [{qid, type}], shortages, warnings, matrix }
 */
export function generateExam(pool, blueprint) {
  const bp = { ...OFFICIAL_BLUEPRINT, ...blueprint };
  const rng = makeRng(bp.seed ?? 'smartexam');
  const avoid = new Set(bp.avoidIds ?? []);
  const topicFilter = bp.topics && bp.topics.length ? new Set(bp.topics) : null;
  const items = [];
  const shortages = [];
  const warnings = [];

  for (const type of ['mcq', 'tf', 'short']) {
    const n = Number(bp.counts?.[type] ?? 0);
    if (n <= 0) continue;
    const cands = shuffle(
      pool.filter((q) => q.type === type && q.status === 'approved' && (!topicFilter || topicFilter.has(q.topic))),
      rng,
    );
    const topics = [...new Set(cands.map((q) => q.topic))];
    if (topicFilter) {
      for (const t of topicFilter) {
        if (!topics.includes(t)) warnings.push(`${QUESTION_TYPES[type]}: chưa có câu đã duyệt cho chuyên đề ${t}.`);
      }
    }
    const levelTarget = apportion(n, bp.levels ?? OFFICIAL_BLUEPRINT.levels);
    const topicQuota = apportion(n, Object.fromEntries(topics.map((t) => [t, 1])));
    const topicCount = Object.fromEntries(topics.map((t) => [t, 0]));
    const taken = new Set();

    const pick = (filter) => {
      let best = null;
      let bestKey = null;
      cands.forEach((q, order) => {
        if (taken.has(q.id) || !filter(q)) return;
        const key = [avoid.has(q.id) ? 1 : 0, topicCount[q.topic] / Math.max(1, topicQuota[q.topic]), order];
        if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
          best = q;
          bestKey = key;
        }
      });
      if (best) {
        taken.add(best.id);
        topicCount[best.topic]++;
        items.push({ qid: best.id, type, topic: best.topic, level: best.level, ...(imageOptions(best) ? {fixedOptions:true} : {}) });
      }
      return best;
    };

    let missingByLevel = 0;
    for (const lv of ['3', '2', '1']) {
      const want = levelTarget[lv] ?? 0;
      let got = 0;
      for (let i = 0; i < want; i++) if (pick((q) => String(q.level) === lv)) got++;
      if (got < want) {
        missingByLevel += want - got;
        warnings.push(`${QUESTION_TYPES[type]}: cần ${want} câu mức ${LEVELS[lv]}, ngân hàng chỉ có ${got}. Đã lấy câu mức khác bù vào nếu còn.`);
      }
    }
    let filled = 0;
    for (let i = 0; i < missingByLevel; i++) if (pick(() => true)) filled++;
    const have = items.filter((x) => x.type === type).length;
    if (have < n) {
      shortages.push({ type, need: n, got: have, message: `${QUESTION_TYPES[type]}: cần ${n} câu, ngân hàng chỉ có ${have} câu đã duyệt phù hợp. Hãy nhập thêm hoặc duyệt thêm câu.` });
    }
    const reused = items.filter((x) => x.type === type && avoid.has(x.qid)).length;
    if (reused) warnings.push(`${QUESTION_TYPES[type]}: ${reused} câu đã dùng gần đây vì không còn câu mới.`);
  }

  const matrix = {};
  for (const it of items) {
    matrix[it.topic] ??= { 1: 0, 2: 0, 3: 0, total: 0 };
    matrix[it.topic][it.level]++;
    matrix[it.topic].total++;
  }
  return { items, shortages, warnings, matrix };
}

/**
 * Tạo mã đề: đảo thứ tự câu trong từng phần, đảo phương án câu trắc nghiệm.
 * Các câu cùng `group` (chùm dữ kiện) và cùng phần luôn đi liền nhau, giữ thứ tự gốc trong chùm.
 * items: [{qid, type, group?}] → [{qid, type, perm}] — perm[vị trí hiển thị] = chỉ số phương án gốc.
 */
export function makeVariant(items, seed) {
  const rng = makeRng(seed);
  const out = [];
  for (const type of ['mcq', 'tf', 'short']) {
    const units = [];
    const byGroup = new Map();
    for (const it of items.filter((x) => x.type === type)) {
      if (it.group != null && it.group !== '' && byGroup.has(it.group)) byGroup.get(it.group).push(it);
      else {
        const unit = [it];
        units.push(unit);
        if (it.group != null && it.group !== '') byGroup.set(it.group, unit);
      }
    }
    for (const unit of shuffle(units, rng)) {
      for (const it of unit) out.push({ qid: it.qid, type, perm: type === 'mcq' ? (it.fixedOptions ? [0,1,2,3] : shuffle([0, 1, 2, 3], rng)) : null });
    }
  }
  return out;
}

export const MAX_VARIANTS = 8;
export const FIRST_VARIANT_CODE = 101;

/** Sinh n mã đề (1..8) từ một đề gốc; cùng baseSeed → cùng kết quả. Trả [{code, seed, layout}]. */
export function makeVariants(items, n, baseSeed) {
  const count = Math.min(MAX_VARIANTS, Math.max(1, Math.floor(Number(n)) || 1));
  return Array.from({ length: count }, (_, i) => {
    const seed = `${baseSeed}-${i}`;
    return { code: String(FIRST_VARIANT_CODE + i), seed, layout: makeVariant(items, seed) };
  });
}

/** Bố cục của một mã đề; đề cũ chưa lưu layout thì sinh lại từ seed như trước đây. */
export function variantLayout(examId, items, variant) {
  return variant.layout ?? makeVariant(items, `${examId}-${variant.seed}`);
}

/**
 * Chia mã đề cho học sinh. mode 'random': chia đều, thứ tự xáo theo seed (tái lập được).
 * mode 'list': list = { [studentId]: code }; em không có trong danh sách được chia ngẫu nhiên đều phần còn lại.
 * Trả { map: { [studentId]: code }, errors: [] }.
 */
export function assignVariants({ studentIds, codes, mode = 'random', seed = 'assign', list = {} }) {
  const errors = [];
  const map = {};
  let rest = studentIds.slice();
  if (mode === 'list') {
    for (const [sid, code] of Object.entries(list ?? {})) {
      if (!studentIds.map(String).includes(String(sid))) errors.push(`Học sinh #${sid} không thuộc lớp.`);
      else if (!codes.includes(String(code))) errors.push(`Mã đề ${code} không có trong đề.`);
      else map[sid] = String(code);
    }
    rest = studentIds.filter((id) => map[id] == null);
  }
  const rng = makeRng(`${seed}-assign`);
  const order = shuffle(codes, rng);
  shuffle(rest, rng).forEach((id, i) => {
    map[id] = order[i % order.length];
  });
  return { map, errors };
}

/** Đổi câu trả lời hiển thị (theo mã đề) về không gian phương án gốc. */
export function toOriginalResponse(layoutItem, displayed) {
  if (layoutItem.type === 'mcq' && layoutItem.perm && Number.isInteger(displayed)) return layoutItem.perm[displayed];
  return displayed;
}

/** Chữ cái đáp án đúng theo mã đề (để in bảng đáp án). */
export function displayedAnswer(layoutItem, question) {
  if (question.type === 'mcq') {
    const d = layoutItem.perm ? layoutItem.perm.indexOf(question.answer) : question.answer;
    return 'ABCD'[d];
  }
  if (question.type === 'tf') return question.answer.map((x) => (x ? 'Đ' : 'S')).join('');
  return String(question.answer).split(';')[0];
}
