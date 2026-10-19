import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeQuestion, gradeAttempt, normalizeShort, parseNumber, shortMatches } from '../shared/grading.mjs';

const mcq = { id: 1, type: 'mcq', options: ['a', 'b', 'c', 'd'], answer: 2 };
const tf = { id: 2, type: 'tf', options: ['a', 'b', 'c', 'd'], answer: [true, false, true, true] };
const sh = { id: 3, type: 'short', answer: '-1,5' };

test('Phần I: đúng 0,25 điểm, sai/bỏ trống 0', () => {
  assert.equal(gradeQuestion(mcq, 2).points, 250);
  assert.equal(gradeQuestion(mcq, 1).points, 0);
  assert.equal(gradeQuestion(mcq, null).answered, false);
  assert.equal(gradeQuestion(mcq, 7).answered, false);
});

test('Phần II: thang 0 / 0,1 / 0,25 / 0,5 / 1 theo số ý đúng', () => {
  const cases = [
    [[false, true, false, false], 0, 0],
    [[true, true, false, false], 1, 100],
    [[true, false, false, false], 2, 250],
    [[true, false, true, false], 3, 500],
    [[true, false, true, true], 4, 1000],
  ];
  for (const [resp, n, pts] of cases) {
    const g = gradeQuestion(tf, resp);
    assert.equal(g.nCorrect, n, JSON.stringify(resp));
    assert.equal(g.points, pts, JSON.stringify(resp));
  }
  // ý bỏ trống không được tính là đúng
  assert.equal(gradeQuestion(tf, [true, null, true, true]).points, 500);
  assert.equal(gradeQuestion(tf, undefined).points, 0);
});

test('Phần III: chuẩn hóa dấu phẩy, dấu trừ unicode, khoảng trắng, phân số', () => {
  assert.equal(normalizeShort(' −1,5 '), '-1.5');
  assert.equal(parseNumber('3/4'), 0.75);
  assert.ok(Number.isNaN(parseNumber('abc')));
  for (const r of ['-1,5', '-1.5', '−1,50', ' -1.5', '-3/2']) assert.equal(gradeQuestion(sh, r).points, 500, r);
  for (const r of ['1,5', '-1,4', '', 'x']) assert.equal(gradeQuestion(sh, r).points, 0, r);
  assert.ok(shortMatches('2;-2', '-2'), 'nhiều đáp án được chấp nhận');
});

test('Đề đủ cấu trúc 12/4/6 làm đúng hết được 10 điểm, cộng đúng từng phần', () => {
  const qs = [];
  const resp = {};
  let id = 1;
  for (let i = 0; i < 12; i++) (qs.push({ id, type: 'mcq', answer: 0, options: ['', '', '', ''] }), (resp[id++] = 0));
  for (let i = 0; i < 4; i++) (qs.push({ id, type: 'tf', answer: [true, true, false, false] }), (resp[id++] = [true, true, false, false]));
  for (let i = 0; i < 6; i++) (qs.push({ id, type: 'short', answer: '2' }), (resp[id++] = '2'));
  const full = gradeAttempt(qs, resp);
  assert.equal(full.max, 10);
  assert.equal(full.points, 10);
  assert.equal(full.score10, 10);
  assert.deepEqual(full.byPart, { I: { points: 3, max: 3 }, II: { points: 4, max: 4 }, III: { points: 3, max: 3 } });
  // Sai 1 câu phần I, câu II.1 đúng 3 ý, câu II.2 đúng 1 ý, bỏ 1 câu phần III
  resp[1] = 1;
  resp[13] = [true, true, false, true];
  resp[14] = [true, false, true, true];
  delete resp[17];
  const g = gradeAttempt(qs, resp);
  // 3 - 0,25 + (4 - 0,5 - 0,9) + (3 - 0,5) = 2,75 + 2,6 + 2,5 = 7,85
  assert.equal(g.points, 7.85);
  assert.equal(g.score10, 7.85);
});

test('Đề rút gọn quy về thang 10 theo tỉ lệ', () => {
  const qs = [
    { id: 1, type: 'mcq', answer: 0, options: ['', '', '', ''] },
    { id: 2, type: 'short', answer: '1' },
  ];
  const g = gradeAttempt(qs, { 1: 0, 2: '0' });
  assert.equal(g.max, 0.75);
  assert.equal(g.score10, 3.33);
});
