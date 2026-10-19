// Gắn nhãn tự động: chuyên đề + mức độ, bằng từ khóa có trọng số. Trả về độ tin cậy để giáo viên biết câu nào cần xem kỹ.
import { TOPICS } from './topics.mjs';

export function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ');
}

// Từ khóa mạnh: thắng ngay cả khi gặp từ khóa chung.
const STRONG = {
  'T12.XSDK': ['xác suất có điều kiện', 'bayes', 'xác suất toàn phần', 'p(a|b)', 'p(a\\mid b)', 'p\\left(a|b'],
  'T12.NGUYENHAM': ['nguyên hàm', 'tích phân', '\\int'],
  'T12.OXYZ': ['oxyz'],
  'T11.GIOIHAN': ['\\lim'],
  'T11.MULOG': ['\\log', 'lôgarit', 'logarit', '\\ln'],
  'T12.KHAOSAT': ['đồng biến', 'nghịch biến', 'cực trị', 'cực đại', 'cực tiểu', 'tiệm cận'],
  'T12.PHANTAN': ['khoảng tứ phân vị của mẫu số liệu ghép nhóm', 'độ lệch chuẩn của mẫu số liệu ghép nhóm', 'phương sai của mẫu số liệu ghép nhóm'],
};

export function classifyTopic(text) {
  const t = norm(text);
  const tPlain = stripDiacritics(t);
  const scores = {};
  for (const topic of TOPICS) {
    let s = 0;
    for (const kw of topic.keywords) {
      const k = norm(kw);
      const hit = k.startsWith('\\') || /[^a-z0-9 ]/.test(stripDiacritics(k)) ? t.includes(k) : t.includes(k) || tPlain.includes(stripDiacritics(k));
      if (hit) s += k.length >= 10 ? 2 : 1;
    }
    for (const kw of STRONG[topic.code] ?? []) if (t.includes(kw)) s += 5;
    if (s > 0) scores[topic.code] = s;
  }
  // Oxyz là trường hợp riêng của "đường thẳng/mặt phẳng": không cho Oxy (lớp 10) thắng.
  if (scores['T12.OXYZ'] && scores['T10.TOADOOXY']) scores['T10.TOADOOXY'] -= 3;
  if (scores['T12.KHAOSAT'] && scores['T11.DAOHAM']) scores['T11.DAOHAM'] -= 2;
  if (scores['T12.XSDK'] && scores['T11.XACSUAT']) scores['T11.XACSUAT'] -= 3;
  const ranked = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { topic: null, confidence: 0, alternatives: [] };
  const [best, second] = ranked;
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  const confidence = Math.min(0.95, (best[1] / total) * Math.min(1, best[1] / 4) + (second ? 0 : 0.15));
  return {
    topic: best[0],
    confidence: Math.round(confidence * 100) / 100,
    alternatives: ranked.slice(1, 3).map(([code]) => code),
  };
}

const LEVEL3 = ['thực tế', 'chi phí', 'lợi nhuận', 'doanh thu', 'tiết kiệm', 'tối thiểu', 'tối đa', 'lớn nhất có thể', 'nhỏ nhất có thể', 'bể nước', 'thùng', 'mét', 'km', 'triệu đồng', 'lãi suất', 'người ta', 'công ty', 'nhà máy', 'tối ưu', 'mô hình'];
const LEVEL1 = ['khẳng định nào sau đây đúng', 'mệnh đề nào sau đây đúng', 'công thức nào', 'tập xác định', 'định nghĩa', 'là bao nhiêu', 'bằng bao nhiêu', 'nào dưới đây', 'cho bảng biến thiên'];

export function classifyLevel(text) {
  const t = norm(text);
  let s3 = 0;
  let s1 = 0;
  for (const k of LEVEL3) if (t.includes(k)) s3++;
  for (const k of LEVEL1) if (t.includes(k)) s1++;
  const len = t.length;
  if (s3 >= 2 || (s3 >= 1 && len > 220)) return { level: 3, confidence: 0.6 };
  if (s1 >= 1 && len < 200 && s3 === 0) return { level: 1, confidence: 0.55 };
  if (len > 320) return { level: 3, confidence: 0.4 };
  return { level: 2, confidence: 0.4 };
}

export function classifyQuestion(q) {
  const text = [q.stem, ...(q.options ?? [])].join(' ');
  return { ...classifyTopic(text), ...(() => { const l = classifyLevel(q.stem ?? ''); return { level: l.level, levelConfidence: l.confidence }; })() };
}
