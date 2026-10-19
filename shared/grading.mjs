// Chấm điểm theo cấu trúc đề tốt nghiệp THPT môn Toán từ 2025.
// Phần I: 0,25 điểm/câu. Phần II: theo số ý đúng 1→0,1; 2→0,25; 3→0,5; 4→1. Phần III: 0,5 điểm/câu.
// Mọi điểm tính bằng "phần nghìn" (số nguyên) để tránh lỗi số thực, đổi ra điểm ở bước cuối.

export const POINTS = {
  mcq: 250,
  tf: [0, 100, 250, 500, 1000],
  short: 500,
};

export function maxPoints(type) {
  if (type === 'mcq') return POINTS.mcq;
  if (type === 'tf') return POINTS.tf[4];
  if (type === 'short') return POINTS.short;
  throw new Error(`Loại câu không hợp lệ: ${type}`);
}

/** Chuẩn hóa câu trả lời ngắn: bỏ khoảng trắng, dấu trừ unicode, dấu phẩy thập phân → chấm. */
export function normalizeShort(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .toLowerCase();
}

/** Đổi chuỗi trả lời thành số; nhận "1.5", "-0.25", "3/4". Không phải số → NaN. */
export function parseNumber(s) {
  const t = normalizeShort(s);
  if (t === '') return NaN;
  if (/^[+-]?\d+(\.\d+)?$/.test(t) || /^[+-]?\.\d+$/.test(t)) return Number(t);
  const frac = t.match(/^([+-]?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  return NaN;
}

/** Danh sách đáp án được chấp nhận của câu trả lời ngắn (phân tách bằng ";"). */
export function acceptedShortAnswers(answer) {
  return String(answer ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function shortMatches(answer, response) {
  const r = normalizeShort(response);
  if (!r) return false;
  const rn = parseNumber(r);
  for (const a of acceptedShortAnswers(answer)) {
    const an = parseNumber(a);
    if (!Number.isNaN(an) && !Number.isNaN(rn)) {
      if (Math.abs(an - rn) <= 1e-9 * Math.max(1, Math.abs(an))) return true;
    } else if (normalizeShort(a) === r) {
      return true;
    }
  }
  return false;
}

/**
 * Chấm một câu. response ở không gian phương án GỐC:
 *  - mcq: số 0..3 hoặc null
 *  - tf: mảng 4 phần tử true/false/null
 *  - short: chuỗi
 * Trả về { points (phần nghìn), max, correct (đúng hoàn toàn), answered, parts? (tf: mảng đúng/sai từng ý) }
 */
export function gradeQuestion(q, response) {
  const max = maxPoints(q.type);
  if (q.type === 'mcq') {
    const answered = Number.isInteger(response) && response >= 0 && response < (q.options?.length ?? 4);
    const correct = answered && response === q.answer;
    return { points: correct ? max : 0, max, correct, answered };
  }
  if (q.type === 'tf') {
    const resp = Array.isArray(response) ? response : [];
    const parts = [0, 1, 2, 3].map((i) => typeof resp[i] === 'boolean' && resp[i] === Boolean(q.answer[i]));
    const answered = resp.some((x) => typeof x === 'boolean');
    const n = parts.filter(Boolean).length;
    return { points: POINTS.tf[n], max, correct: n === 4, answered, parts, nCorrect: n };
  }
  if (q.type === 'short') {
    const answered = normalizeShort(response) !== '';
    const correct = answered && shortMatches(q.answer, response);
    return { points: correct ? max : 0, max, correct, answered };
  }
  throw new Error(`Loại câu không hợp lệ: ${q.type}`);
}

/**
 * Chấm cả bài. questions: [{id, type, answer, ...}]; responses: { [qid]: response } (không gian gốc).
 * Đề đủ cấu trúc 12/4/6 có tổng tối đa 10 điểm; đề khác quy về thang 10 theo tỉ lệ.
 */
export function gradeAttempt(questions, responses) {
  const items = [];
  const byPart = { I: { points: 0, max: 0 }, II: { points: 0, max: 0 }, III: { points: 0, max: 0 } };
  const partOf = { mcq: 'I', tf: 'II', short: 'III' };
  let points = 0;
  let max = 0;
  for (const q of questions) {
    const r = gradeQuestion(q, responses?.[q.id]);
    items.push({ qid: q.id, ...r });
    points += r.points;
    max += r.max;
    const p = byPart[partOf[q.type]];
    p.points += r.points;
    p.max += r.max;
  }
  const raw = points / 1000;
  const score10 = max === 0 ? 0 : Math.round((points / max) * 10 * 100) / 100;
  return {
    items,
    points: raw,
    max: max / 1000,
    score10,
    byPart: Object.fromEntries(Object.entries(byPart).map(([k, v]) => [k, { points: v.points / 1000, max: v.max / 1000 }])),
  };
}

/** Định dạng điểm kiểu Việt Nam: 7,25 */
export function formatScore(x) {
  return (Math.round(x * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}
