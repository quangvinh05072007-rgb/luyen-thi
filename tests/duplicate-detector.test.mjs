import { test } from 'node:test';
import assert from 'node:assert/strict';
import { similarityScore, findDuplicates } from '../shared/duplicate-detector.mjs';

test('duplicate detector identifies exact and near-duplicate math questions', () => {
  const q1 = 'Cho hàm số $y = f(x)$ có đạo hàm liên tục trên $\\mathbb{R}$. Tìm số điểm cực trị.';
  const q2 = 'Cho hàm số $y = f(x)$ có đạo hàm liên tục trên R. Tìm số điểm cực trị của hàm số.';
  const qDifferent = 'Trong không gian Oxyz, tìm phương trình mặt cầu tâm $I(1;2;3)$ bán kính $R = 4$.';

  const simHigh = similarityScore(q1, q2);
  const simLow = similarityScore(q1, qDifferent);

  assert.ok(simHigh > 0.75, `Expected high similarity, got ${simHigh}`);
  assert.ok(simLow < 0.30, `Expected low similarity, got ${simLow}`);

  const pool = [
    { id: 101, stem: q2, type: 'mcq', topic: 'T12.HAMSO' },
    { id: 102, stem: qDifferent, type: 'mcq', topic: 'T12.OXYZ' },
  ];

  const duplicates = findDuplicates(q1, pool, { threshold: 0.70 });
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].id, 101);
  assert.ok(duplicates[0].score > 0.75);
});
