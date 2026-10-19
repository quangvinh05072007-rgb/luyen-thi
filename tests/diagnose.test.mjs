import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseItem, diagnoseAttempt, computeMastery, recommend, updateReview, selectPractice, REVIEW_INTERVAL_DAYS } from '../shared/diagnose.mjs';
import { classifyTopic, classifyLevel } from '../shared/classify.mjs';

const mcq = { id: 1, type: 'mcq', topic: 'T12.XSDK', level: 2, options: ['', '', '', ''], answer: 0, distractors: { 2: { error: 'concept', note: 'Nhầm P(A|B) với P(B|A)' } } };
const sh = { id: 2, type: 'short', topic: 'T12.NGUYENHAM', level: 2, answer: '1,33', distractors: { wrong: [{ value: '4', error: 'formula', note: 'Chỉ tính một tích phân' }] } };

test('Câu đúng không có chẩn đoán; bỏ trống ghi riêng', () => {
  assert.equal(diagnoseItem(mcq, 0), null);
  assert.equal(diagnoseItem(mcq, null).kind, 'blank');
});

test('Phương án nhiễu có gắn nhãn → đúng kiểu lỗi và ghi chú', () => {
  const d = diagnoseItem(mcq, 2);
  assert.equal(d.errors[0].type, 'concept');
  assert.match(d.errors[0].note, /P\(A\|B\)/);
});

test('Không có nhãn: suy theo mức độ; làm quá nhanh → bất cẩn', () => {
  assert.equal(diagnoseItem(mcq, 1).errors[0].type, 'formula');
  assert.equal(diagnoseItem({ ...mcq, level: 1 }, 1).errors[0].type, 'concept');
  assert.equal(diagnoseItem({ ...mcq, level: 3 }, 1).errors[0].type, 'transform');
  assert.equal(diagnoseItem(mcq, 1, 5).errors[0].type, 'careless');
});

test('Trả lời ngắn: sai dấu, lệch 10 lần, làm tròn sai → bất cẩn; đáp án sai đã biết → lỗi đã gắn', () => {
  assert.equal(diagnoseItem(sh, '-1,33').errors[0].type, 'careless');
  assert.equal(diagnoseItem(sh, '13,3').errors[0].type, 'careless');
  assert.equal(diagnoseItem(sh, '1,3').errors[0].note, 'Làm tròn sai so với yêu cầu đề');
  assert.equal(diagnoseItem(sh, '4').errors[0].type, 'formula');
  assert.equal(diagnoseItem(sh, '2,9').errors[0].type, 'formula'); // mức 2, không có quy tắc khác
});

test('Đúng/sai: mỗi ý sai là một lỗi', () => {
  const q = { id: 3, type: 'tf', topic: 'T12.OXYZ', level: 2, answer: [true, true, true, false], distractors: { s3: { error: 'concept', note: 'x' } } };
  const d = diagnoseItem(q, [true, false, true, true]);
  assert.equal(d.errors.length, 2);
  assert.deepEqual(d.errors.map((e) => e.type).sort(), ['concept', 'formula']);
});

test('Chẩn đoán cả bài: đếm kiểu lỗi, xếp chuyên đề yếu nhất trước', () => {
  const r = diagnoseAttempt([mcq, sh], { 1: 2, 2: '1,33' });
  assert.equal(r.errorCount.concept, 1);
  assert.equal(r.topics[0].topic, 'T12.XSDK');
  assert.equal(r.dominantError, 'concept');
});

test('Năng lực: tiên nghiệm 0,5; nhiều câu sai → yếu; bằng chứng cũ nhẹ hơn', () => {
  const now = Date.now();
  const m = computeMastery(
    [
      ...Array(6).fill({ topic: 'A', level: 2, score: 0, at: now }),
      ...Array(6).fill({ topic: 'B', level: 2, score: 1, at: now }),
      { topic: 'C', level: 1, score: 1, at: now },
    ],
    now,
  );
  assert.equal(m.A.band, 'weak');
  assert.equal(m.B.band, 'strong');
  assert.ok(m.C.value > 0.5 && m.C.value < 0.75, 'một câu chưa đủ kết luận vững');
  assert.equal(m.C.confident, false);
  const oldBad = computeMastery([...Array(5).fill({ topic: 'A', level: 2, score: 0, at: now - 120 * 86400000 }), ...Array(3).fill({ topic: 'A', level: 2, score: 1, at: now })], now);
  assert.ok(oldBad.A.value > 0.6, 'lỗi cũ 4 tháng không kéo năng lực hiện tại xuống nhiều');
  const rec = recommend(m, { formula: 3 });
  assert.equal(rec[0].topic, 'A');
  assert.equal(rec[0].level, 1);
  assert.match(rec[0].tip, /công thức/);
});

test('Sổ lỗi sai: sai → ôn sau 1 ngày; đúng → giãn 3, 7, 14, 30 ngày rồi rời sổ', () => {
  const t = 0;
  let it = updateReview(null, false, t);
  assert.equal(it.due_at, 86400000);
  assert.equal(updateReview(null, true, t), null);
  for (let i = 1; i < REVIEW_INTERVAL_DAYS.length; i++) {
    it = updateReview(it, true, t);
    assert.equal(it.due_at, REVIEW_INTERVAL_DAYS[i] * 86400000);
  }
  assert.equal(updateReview(it, true, t), null);
  assert.equal(updateReview(it, false, t).box, 0);
});

test('Luyện tập thích ứng: ưu tiên câu đến hạn ôn, tránh câu vừa làm đúng, xen kẽ chuyên đề', () => {
  const now = 10 * 86400000;
  const pool = [];
  for (let i = 1; i <= 10; i++) pool.push({ id: i, topic: i <= 5 ? 'A' : 'B', level: (i % 3) + 1, status: 'approved' });
  pool.push({ id: 99, topic: 'A', level: 1, status: 'draft' });
  const picked = selectPractice({
    pool,
    topics: ['A', 'B'],
    mastery: { A: { value: 0.3 }, B: { value: 0.6 } },
    history: { 2: { lastCorrect: true, lastAt: now - 3600000 } },
    due: new Set([4]),
    count: 6,
    seed: 's',
    now,
  });
  assert.equal(picked.length, 6);
  assert.equal(picked[0].id, 4);
  assert.ok(!picked.some((q) => q.id === 99), 'không lấy câu nháp');
  assert.ok(!picked.slice(0, 5).some((q) => q.id === 2), 'câu vừa làm đúng xếp sau cùng');
  assert.notEqual(picked[0].topic, picked[1].topic);
});

test('Phân loại chuyên đề và mức độ', () => {
  assert.equal(classifyTopic('Tính tích phân $\\int_0^1 x^2 dx$').topic, 'T12.NGUYENHAM');
  assert.equal(classifyTopic('Trong không gian Oxyz, cho mặt phẳng (P): x+y+z=0. Vectơ pháp tuyến').topic, 'T12.OXYZ');
  assert.equal(classifyTopic('Hàm số $y=x^3-3x$ đồng biến trên khoảng nào?').topic, 'T12.KHAOSAT');
  assert.equal(classifyTopic('Tính xác suất có điều kiện P(A|B)').topic, 'T12.XSDK');
  assert.equal(classifyTopic('Giải phương trình $\\log_2 x = 3$').topic, 'T11.MULOG');
  assert.equal(classifyTopic('Học sinh lớp 12 có bao nhiêu cách chọn').topic, 'T10.TOHOP', '"học sinh" không bị nhầm thành sin');
  assert.equal(classifyTopic('Hôm nay trời đẹp').topic, null);
  assert.equal(classifyLevel('Một công ty muốn tối thiểu chi phí sản xuất…').level, 3);
  assert.equal(classifyLevel('Tập xác định của hàm số $y=\\ln x$ là').level, 1);
});
