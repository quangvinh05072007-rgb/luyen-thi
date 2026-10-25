// Chấm "độ đáng ngờ" của câu vừa nhập để màn hình duyệt xếp câu cần xem lên trước.
// Không sửa gì, chỉ gắn lý do để giáo viên biết nhìn vào đâu.

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

function unbalancedDollar(s) {
  const t = String(s ?? '').replace(/\\\$/g, '');
  return (t.match(/\$/g) ?? []).length % 2 === 1;
}

/**
 * q: câu sau khi tách + gắn nhãn (có tagConfidence, answerSources, answerConflict, warnings).
 * ctx: { kind } — loại file nguồn ('pdf' thường làm mất cấu trúc công thức).
 * Trả { score 0..100, level: 'high'|'medium'|'low', reasons: string[] }.
 */
export function assessQuestion(q, ctx = {}) {
  const reasons = [];
  let score = 0;
  const add = (w, text) => {
    score += w;
    reasons.push(text);
  };
  const parts = [q.stem, ...(q.options ?? []), q.explanation];
  const joined = parts.join('\n');

  if (!String(q.stem ?? '').trim()) add(80, 'Đề bài trống.');
  if (q.answerConflict) add(100, 'Đáp án mâu thuẫn giữa các nguồn.');
  else if (q.answer === null || q.answer === undefined || q.answer === '') add(60, 'Chưa có đáp án.');
  else if (q.answerSources?.length === 1 && q.answerSources[0] === 'mark') add(15, 'Đáp án chỉ dựa vào dấu gạch chân/màu, chưa được đối chiếu với nguồn khác.');

  if (q.type === 'mcq' || q.type === 'tf') {
    const opts = q.options ?? [];
    if (opts.length !== 4 || opts.some((o) => !String(o ?? '').trim())) add(60, q.type === 'mcq' ? 'Thiếu hoặc rỗng phương án A–D.' : 'Thiếu hoặc rỗng ý a)–d).');
    else if (new Set(opts.map(norm)).size < 4) add(40, 'Có hai phương án giống hệt nhau.');
    if (opts.some((o) => String(o).length > 300)) add(25, 'Có phương án rất dài — có thể dính phần của câu sau.');
  }
  if (/\[công thức MathType chưa đọc được\]/.test(joined)) add(70, 'Có công thức MathType (OLE) chưa đọc được.');
  if (/\[hình\]/.test(joined)) add(50, 'Có hình/biểu đồ chưa nhập được — cần bổ sung hình.');
  if (parts.some(unbalancedDollar)) add(40, 'Công thức $…$ bị mở mà không đóng.');
  if (/(^|\n)\s*(Câu|CÂU|Bài)\s*\d+\s*[.:]/.test(`${q.stem}\n${(q.options ?? []).join('\n')}`.replace(/^\s*(Câu|CÂU|Bài)\s*\d+\s*[.:]/, ''))) add(40, 'Trong nội dung có chữ "Câu …" — có thể hai câu bị gộp làm một.');
  if (q.topic == null) add(25, 'Chưa đoán được chuyên đề.');
  else if (typeof q.tagConfidence === 'number' && q.tagConfidence < 0.5) add(20, 'Chuyên đề đoán với độ tin cậy thấp.');
  else if (typeof q.tagConfidence === 'number' && q.tagConfidence < 0.7) add(10, 'Chuyên đề đoán với độ tin cậy vừa.');
  const bare = String(q.stem ?? '').replace(/\[\[img:\d+\]\]|\$[^$]*\$|\|/g, '').trim();
  if (bare.length < 12 && !/\[\[img:/.test(q.stem ?? '') && !(q.stem ?? '').includes('$')) add(20, 'Đề bài rất ngắn.');
  if (ctx.kind === 'pdf') add(15, 'Nhập từ PDF: công thức và phân số thường bị mất cấu trúc.');
  if (ctx.kind && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ctx.kind)) add(20, 'Chữ do AI đọc từ ảnh — đối chiếu với ảnh gốc.');

  score = Math.min(100, score);
  return { score, level: score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low', reasons };
}
