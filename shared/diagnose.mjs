// Chẩn đoán lỗi sai, ước lượng năng lực theo chuyên đề, gợi ý học tiếp, sổ lỗi sai giãn cách.
import { gradeQuestion, parseNumber, acceptedShortAnswers, normalizeShort } from './grading.mjs';
import { ERROR_TYPES, TOPIC_BY_CODE, LEVELS } from './topics.mjs';
import { makeRng, shuffle } from './rng.mjs';

// Thời gian gợi ý (giây) cho mỗi loại câu theo mức độ — dùng để nhận ra làm "quá nhanh".
const EXPECTED_SEC = { mcq: [0, 60, 90, 150], tf: [0, 120, 180, 240], short: [0, 120, 180, 300] };

function defaultErrorForLevel(level) {
  return Number(level) <= 1 ? 'concept' : Number(level) === 2 ? 'formula' : 'transform';
}

/** Lệch dấu hoặc lệch lũy thừa của 10 so với đáp án đúng → bất cẩn. */
function carelessNumeric(answer, response) {
  const r = parseNumber(response);
  if (Number.isNaN(r)) return null;
  for (const a of acceptedShortAnswers(answer)) {
    const an = parseNumber(a);
    if (Number.isNaN(an) || an === 0) continue;
    if (Math.abs(r + an) < 1e-9 * Math.max(1, Math.abs(an))) return 'Sai dấu so với đáp án đúng';
    const ratio = r / an;
    for (const k of [10, 100, 1000, 0.1, 0.01, 0.001]) {
      if (Math.abs(ratio - k) < 1e-9 * k) return 'Lệch lũy thừa của 10 (nhầm đơn vị hoặc dấu phẩy)';
    }
    const dec = (x) => (String(x).split('.')[1] ?? '').length;
    if (Math.abs(r - an) > 0 && dec(an) > 0 && Math.abs(r - an) <= 0.5 * Math.pow(10, -dec(an) + 1) && dec(r) !== dec(an)) {
      return 'Làm tròn sai so với yêu cầu đề';
    }
  }
  return null;
}

/**
 * Chẩn đoán một câu đã chấm.
 * q: câu hỏi (có distractors tùy chọn), response: không gian gốc, seconds: thời gian làm (có thể undefined)
 * Trả về null nếu đúng hoàn toàn; ngược lại { qid, topic, level, kind: 'blank'|'error', errors: [{type, note}] }
 */
export function diagnoseItem(q, response, seconds) {
  const g = gradeQuestion(q, response);
  if (g.correct) return null;
  const base = { qid: q.id, topic: q.topic, level: q.level, type: q.type };
  if (!g.answered) return { ...base, kind: 'blank', errors: [], note: 'Bỏ trống' };
  const errors = [];
  const tooFast = Number.isFinite(seconds) && seconds > 0 && seconds < 0.2 * (EXPECTED_SEC[q.type]?.[q.level] ?? 90);
  const d = q.distractors ?? {};
  if (q.type === 'mcq') {
    const tag = d[response] ?? d[String(response)];
    if (tag?.error) errors.push({ type: tag.error, note: tag.note || ERROR_TYPES[tag.error].hint });
    else errors.push({ type: tooFast ? 'careless' : defaultErrorForLevel(q.level), note: tooFast ? `Làm trong ${Math.round(seconds)} giây, quá nhanh so với độ khó` : 'Chọn phương án nhiễu' });
  } else if (q.type === 'tf') {
    g.parts.forEach((ok, i) => {
      if (ok || typeof response?.[i] !== 'boolean') return;
      const tag = d[`s${i}`];
      errors.push({ type: tag?.error ?? defaultErrorForLevel(q.level), note: tag?.note || `Ý ${'abcd'[i]}) sai` , statement: i });
    });
  } else if (q.type === 'short') {
    const known = (Array.isArray(d.wrong) ? d.wrong : []).find((w) => normalizeShort(w.value) === normalizeShort(response) || parseNumber(w.value) === parseNumber(response));
    const careless = carelessNumeric(q.answer, response);
    if (known) errors.push({ type: known.error, note: known.note || ERROR_TYPES[known.error].hint });
    else if (careless) errors.push({ type: 'careless', note: careless });
    else errors.push({ type: tooFast ? 'careless' : defaultErrorForLevel(q.level), note: tooFast ? 'Làm quá nhanh' : 'Kết quả sai' });
  }
  return { ...base, kind: 'error', errors, points: g.points, max: g.max };
}

/** Chẩn đoán cả bài: danh sách câu sai + thống kê kiểu lỗi + chuyên đề. */
export function diagnoseAttempt(questions, responses, times = {}) {
  const items = [];
  const errorCount = { concept: 0, formula: 0, transform: 0, careless: 0 };
  const topicStats = {};
  let blank = 0;
  for (const q of questions) {
    const g = gradeQuestion(q, responses?.[q.id]);
    const ts = (topicStats[q.topic] ??= { topic: q.topic, points: 0, max: 0, wrong: 0, total: 0 });
    ts.points += g.points;
    ts.max += g.max;
    ts.total++;
    const di = diagnoseItem(q, responses?.[q.id], times?.[q.id]);
    if (!di) continue;
    ts.wrong++;
    items.push(di);
    if (di.kind === 'blank') blank++;
    for (const e of di.errors) errorCount[e.type] = (errorCount[e.type] ?? 0) + 1;
  }
  const topics = Object.values(topicStats)
    .map((t) => ({ ...t, ratio: t.max ? t.points / t.max : 0, name: TOPIC_BY_CODE[t.topic]?.name ?? t.topic }))
    .sort((a, b) => a.ratio - b.ratio);
  const dominant = Object.entries(errorCount).sort((a, b) => b[1] - a[1])[0];
  return {
    items,
    errorCount,
    blank,
    topics,
    dominantError: dominant && dominant[1] > 0 ? dominant[0] : null,
  };
}

/**
 * Năng lực theo chuyên đề từ lịch sử. evidence: [{topic, level, score (0..1), at (ms)}]
 * Trung bình có trọng số (mức độ cao nặng hơn, bằng chứng cũ nhẹ dần — chu kỳ bán rã 30 ngày),
 * kèm tiên nghiệm 0,5 với trọng số 2 để ít dữ liệu không cho kết luận cực đoan.
 */
export function computeMastery(evidence, now = Date.now()) {
  const acc = {};
  for (const e of evidence) {
    const w = (1 + 0.5 * (Number(e.level) - 1)) * Math.pow(0.5, Math.max(0, now - e.at) / (30 * 86400000));
    const a = (acc[e.topic] ??= { w: 0, s: 0, n: 0, last: 0 });
    a.w += w;
    a.s += w * e.score;
    a.n++;
    a.last = Math.max(a.last, e.at);
  }
  const PRIOR_W = 2;
  const out = {};
  for (const [topic, a] of Object.entries(acc)) {
    const value = (a.s + 0.5 * PRIOR_W) / (a.w + PRIOR_W);
    out[topic] = {
      topic,
      name: TOPIC_BY_CODE[topic]?.name ?? topic,
      value: Math.round(value * 1000) / 1000,
      n: a.n,
      confident: a.n >= 4,
      band: value < 0.5 ? 'weak' : value < 0.75 ? 'ok' : 'strong',
      last: a.last,
    };
  }
  return out;
}

export function targetLevel(masteryValue) {
  if (masteryValue === undefined) return 1;
  if (masteryValue < 0.45) return 1;
  if (masteryValue < 0.7) return 2;
  return 3;
}

/** Gợi ý hành động học tiếp từ năng lực + kiểu lỗi trội. */
export function recommend(mastery, errorCount = {}, max = 3) {
  const weak = Object.values(mastery)
    .filter((m) => m.band !== 'strong')
    .sort((a, b) => a.value - b.value || b.n - a.n)
    .slice(0, max);
  const dominant = Object.entries(errorCount).sort((a, b) => b[1] - a[1])[0];
  return weak.map((m) => {
    const lv = targetLevel(m.value);
    const tip = dominant && dominant[1] > 0 ? ERROR_TYPES[dominant[0]].action : null;
    return {
      topic: m.topic,
      name: m.name,
      level: lv,
      count: 8,
      mastery: m.value,
      reason: `Năng lực ${Math.round(m.value * 100)}% sau ${m.n} câu. Luyện 8 câu mức ${LEVELS[lv]}.`,
      tip,
    };
  });
}

// ---- Sổ lỗi sai: lặp lại giãn cách (1, 3, 7, 14, 30 ngày) ----
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];

/** Cập nhật mục ôn tập sau một lần làm câu đó. item: {box, due_at} | null. Trả về null nếu đã thuộc. */
export function updateReview(item, correct, now = Date.now()) {
  if (!correct) return { box: 0, due_at: now + REVIEW_INTERVAL_DAYS[0] * 86400000, lapses: (item?.lapses ?? 0) + 1 };
  if (!item) return null;
  const box = item.box + 1;
  if (box >= REVIEW_INTERVAL_DAYS.length) return null;
  return { box, due_at: now + REVIEW_INTERVAL_DAYS[box] * 86400000, lapses: item.lapses ?? 0 };
}

/**
 * Chọn câu luyện tập thích ứng.
 * pool: câu đã duyệt; topics: chuyên đề cần luyện; mastery: kết quả computeMastery;
 * history: { [qid]: { lastCorrect: bool, lastAt: ms } }; due: Set qid đến hạn ôn; count; seed.
 * Ưu tiên: câu đến hạn ôn → câu chưa làm đúng mức → câu chưa làm mức lân cận → câu làm sai từ lâu. Tránh câu vừa làm đúng trong 3 ngày.
 */
export function selectPractice({ pool, topics, mastery = {}, history = {}, due = new Set(), count = 8, seed = 'practice', now = Date.now() }) {
  const rng = makeRng(seed);
  const topicSet = new Set(topics);
  const cands = shuffle(pool.filter((q) => q.status === 'approved' && topicSet.has(q.topic)), rng);
  const scored = cands.map((q, i) => {
    const h = history[q.id];
    const lv = targetLevel(mastery[q.topic]?.value);
    let s = 0;
    if (due.has(q.id)) s += 100;
    if (!h) s += 40;
    else if (!h.lastCorrect) s += 30;
    else if (now - h.lastAt < 3 * 86400000) s -= 100;
    s -= 15 * Math.abs(Number(q.level) - lv);
    return { q, s, i };
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  // Xen kẽ chuyên đề để không dồn một chuyên đề.
  const byTopic = {};
  for (const x of scored) (byTopic[x.q.topic] ??= []).push(x.q);
  const out = [];
  const keys = topics.filter((t) => byTopic[t]);
  while (out.length < count && keys.some((k) => byTopic[k].length)) {
    for (const k of keys) {
      if (out.length >= count) break;
      const q = byTopic[k].shift();
      if (q) out.push(q);
    }
  }
  return out;
}
