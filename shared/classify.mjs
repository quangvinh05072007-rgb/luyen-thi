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

// Luật theo ngữ cảnh: những dấu hiệu rõ ràng mà từ khóa đơn lẻ không bắt được. [chuyên đề, trọng số, điều kiện trên chữ thường]
const has = (t, ...ks) => ks.some((k) => t.includes(k));
const TRIPLE = /\(\s*[-\d.,{}]+\s*;\s*[-\d.,{}]+\s*;\s*[-\d.,{}]+\s*\)/;
const CONTEXT_RULES = [
  // mẫu số liệu ghép nhóm: lớp 12 (độ phân tán) hay lớp 11 (xu thế trung tâm); không phải thống kê lớp 10
  ['T12.PHANTAN', 7, (t) => has(t, 'ghép nhóm') && has(t, 'khoảng biến thiên', 'khoảng tứ phân vị', 'phương sai', 'độ lệch chuẩn')],
  ['T11.GHEPNHOM', 7, (t) => has(t, 'ghép nhóm') && !has(t, 'khoảng biến thiên', 'khoảng tứ phân vị', 'phương sai', 'độ lệch chuẩn')],
  ['T12.PHANTAN', 7, (t) => /nhóm \$?\[\d+;\s*\d+\)/.test(t) && has(t, 'khoảng biến thiên', 'khoảng tứ phân vị', 'phương sai', 'độ lệch chuẩn')],
  // xác suất có điều kiện / toàn phần
  ['T12.XSDK', 6, (t) => has(t, 'không hoàn lại', 'xét nghiệm', 'chọn ngẫu nhiên một hộp', 'chọn ngẫu nhiên một túi') || (has(t, 'xác suất') && has(t, ', biết ', 'biết rằng', 'biết bi', 'biết sản phẩm')) || /p\s*\(\s*[a-z]\s*(\||\\mid)\s*[a-z]\s*\)/.test(t)],
  // tích phân/nguyên hàm khi nói diện tích hình phẳng
  ['T12.NGUYENHAM', 6, (t) => has(t, 'diện tích hình phẳng', 'giới hạn bởi đồ thị', 'khối tròn xoay')],
  // tọa độ trong không gian
  ['T12.OXYZ', 6, (t) => TRIPLE.test(t) && has(t, 'mặt phẳng', 'mặt cầu', 'đường thẳng', 'khoảng cách', 'phương trình')],
  ['T12.VECTOKG', 7, (t) => has(t, 'oxyz') && has(t, '\\vec', 'vectơ', 'véc tơ') && !has(t, 'mặt phẳng', 'mặt cầu', 'đường thẳng', 'phương trình')],
  // hàm mũ, lôgarit
  ['T11.MULOG', 7, (t) => (/y\s*=\s*(\\log|\\ln|[a-z0-9]\^\{?x)/.test(t) || /\d\^\{?[a-z][-+\d]*\}?\s*=/.test(t) || has(t, 'lãi kép', 'lãi suất')) && !has(t, 'đạo hàm', 'tiếp tuyến')],
  // đạo hàm của hàm có ln/log/sin…: vẫn là đạo hàm
  ['T11.DAOHAM', 8, (t) => /đạo hàm của|tính đạo hàm|y'\s*=|f'\s*\(/.test(t)],
  ['T11.DAOHAM', 6, (t) => has(t, 'tiếp tuyến') && !has(t, 'đường tròn', 'elip', 'mặt cầu')],
  // hình học không gian: vuông góc, khối chóp, hình lập phương
  ['T11.VUONGGOC', 6, (t) => has(t, '\\perp(', '\\perp (', 'vuông góc với mặt phẳng', 'hình lập phương', 'hình hộp chữ nhật', 'khối chóp') || (has(t, 'hình chóp') && has(t, 'góc giữa', 'khoảng cách', 'thể tích'))],
  // bài toán thực tế tối ưu → khảo sát hàm số
  ['T12.KHAOSAT', 4, (t) => has(t, 'lớn nhất', 'nhỏ nhất', 'tối ưu') && has(t, 'chi phí', 'lợi nhuận', 'doanh thu', 'diện tích', 'thể tích', 'người ta', 'cửa hàng', 'khung', 'bể', 'x$')],
  ['T12.KHAOSAT', 4, (t) => has(t, 'chi phí sản xuất', 'cần sản xuất bao nhiêu')],
];

export function classifyTopic(text) {
  const t = norm(text);
  const tPlain = stripDiacritics(t);
  const scores = {};
  for (const topic of TOPICS) {
    let s = 0;
    for (const kw of topic.keywords) {
      const k = norm(kw);
      // So khớp không dấu chỉ với từ khóa dài: "mốt" không được trùng "một".
      const hit = k.startsWith('\\') || /[^a-z0-9 ]/.test(stripDiacritics(k)) || k.length < 8 ? t.includes(k) : t.includes(k) || tPlain.includes(stripDiacritics(k));
      if (hit) s += k.length >= 10 ? 2 : 1;
    }
    for (const kw of STRONG[topic.code] ?? []) if (t.includes(kw)) s += 5;
    for (const [code, w, test] of CONTEXT_RULES) if (code === topic.code && test(t)) s += w;
    if (s > 0) scores[topic.code] = s;
  }
  // Oxyz là trường hợp riêng của "đường thẳng/mặt phẳng": không cho Oxy (lớp 10) thắng.
  if (scores['T12.OXYZ'] && scores['T10.TOADOOXY']) scores['T10.TOADOOXY'] -= 3;
  if ((t.includes('ghép nhóm') || /nhóm \$?\[\d+;\s*\d+\)/.test(t)) && scores['T10.THONGKE']) scores['T10.THONGKE'] -= 8;
  if (scores['T12.OXYZ'] && scores['T12.VECTOKG'] >= scores['T12.OXYZ']) scores['T12.OXYZ'] -= 3;
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
    scores: Object.fromEntries(ranked.slice(0, 4)),
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
