import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateExam, makeVariant, toOriginalResponse, displayedAnswer, apportion, OFFICIAL_BLUEPRINT } from '../shared/generate.mjs';
import { SAMPLE_QUESTIONS } from '../server/seedQuestions.mjs';

const pool = SAMPLE_QUESTIONS.map((q, i) => ({ ...q, id: i + 1, status: 'approved' }));

test('Chia phần dư lớn nhất', () => {
  assert.deepEqual(apportion(12, { 1: 40, 2: 30, 3: 30 }), { 1: 5, 2: 4, 3: 3 });
  assert.deepEqual(apportion(4, { 1: 40, 2: 30, 3: 30 }), { 1: 2, 2: 1, 3: 1 });
  assert.equal(Object.values(apportion(6, { 1: 40, 2: 30, 3: 30 })).reduce((a, b) => a + b), 6);
  assert.deepEqual(apportion(0, { a: 1 }), { a: 0 });
});

test('Sinh đề đúng cấu trúc 2025: 12 trắc nghiệm, 4 đúng/sai, 6 trả lời ngắn, không trùng câu', () => {
  const r = generateExam(pool, { ...OFFICIAL_BLUEPRINT, seed: 'a' });
  const count = (t) => r.items.filter((x) => x.type === t).length;
  assert.equal(count('mcq'), 12);
  assert.equal(count('tf'), 4);
  assert.equal(count('short'), 6);
  assert.equal(new Set(r.items.map((x) => x.qid)).size, 22);
  assert.deepEqual(r.shortages, []);
  // mức độ đúng tỉ lệ 40/30/30 ở phần I (ngân hàng đủ câu)
  const lv = (t, l) => r.items.filter((x) => x.type === t && x.level === l).length;
  assert.deepEqual([lv('mcq', 1), lv('mcq', 2), lv('mcq', 3)], [5, 4, 3]);
  // ma trận cộng đủ 22
  assert.equal(Object.values(r.matrix).reduce((s, m) => s + m.total, 0), 22);
});

test('Cùng hạt giống → cùng đề; khác hạt giống → khác đề', () => {
  const a = generateExam(pool, { seed: 'x' }).items.map((x) => x.qid);
  const b = generateExam(pool, { seed: 'x' }).items.map((x) => x.qid);
  const c = generateExam(pool, { seed: 'y' }).items.map((x) => x.qid);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('Chỉ dùng câu đã duyệt và báo thiếu trung thực', () => {
  const mixed = pool.map((q, i) => ({ ...q, status: i % 2 ? 'draft' : 'approved' }));
  const r = generateExam(mixed, { counts: { mcq: 30, tf: 0, short: 0 }, seed: 's' });
  assert.ok(r.items.every((x) => mixed.find((q) => q.id === x.qid).status === 'approved'));
  assert.equal(r.shortages.length, 1);
  assert.match(r.shortages[0].message, /chỉ có \d+ câu đã duyệt/);
});

test('Lọc chuyên đề và cảnh báo chuyên đề không có câu', () => {
  const r = generateExam(pool, { counts: { mcq: 3, tf: 0, short: 0 }, topics: ['T12.XSDK', 'T10.MENHDE'], seed: 't' });
  assert.ok(r.items.every((x) => x.topic === 'T12.XSDK'));
  assert.ok(r.warnings.some((w) => w.includes('T10.MENHDE')));
});

test('Tránh câu vừa dùng khi còn câu khác', () => {
  const first = generateExam(pool, { counts: { mcq: 12, tf: 0, short: 0 }, seed: 'p' });
  const avoid = first.items.map((x) => x.qid);
  const second = generateExam(pool, { counts: { mcq: 12, tf: 0, short: 0 }, avoidIds: avoid, seed: 'q' });
  const overlap = second.items.filter((x) => avoid.includes(x.qid)).length;
  // ngân hàng có 38 câu trắc nghiệm → chỉ trùng khi thiếu câu mới cùng mức độ
  assert.ok(overlap <= 2, `trùng ${overlap} câu`);
});

test('Mã đề: đảo câu trong từng phần, đảo phương án, đổi về đáp án gốc đúng', () => {
  const items = generateExam(pool, { seed: 'v' }).items;
  const v1 = makeVariant(items, 'm1');
  const v2 = makeVariant(items, 'm2');
  assert.deepEqual(v1.map((x) => x.type), [...Array(12).fill('mcq'), ...Array(4).fill('tf'), ...Array(6).fill('short')]);
  assert.notDeepEqual(v1.map((x) => x.qid), v2.map((x) => x.qid));
  for (const it of v1.filter((x) => x.type === 'mcq')) {
    assert.deepEqual([...it.perm].sort(), [0, 1, 2, 3]);
    const q = pool.find((p) => p.id === it.qid);
    const shownCorrect = it.perm.indexOf(q.answer);
    assert.equal(toOriginalResponse(it, shownCorrect), q.answer);
    assert.equal(displayedAnswer(it, q), 'ABCD'[shownCorrect]);
  }
});
