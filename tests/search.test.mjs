import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch } from '../shared/search.mjs';

test('Vietnamese search supports accents, decomposed text, case and extra spaces', () => {
  assert.equal(matchesSearch('Đề luyện thi tốt nghiệp', '  DE   luyen '), true);
  assert.equal(matchesSearch('Nguyễn Thị Lan', 'nguyen thi lan'), true);
  assert.equal(matchesSearch('Nguyễn Thị Lan'.normalize('NFD'), 'NGUYỄN'), true);
  assert.equal(matchesSearch('12A1 — Cô Nguyễn Thị Lan', '12a1'), true);
  assert.equal(matchesSearch('Đề luyện thi', 'Vật lí'), false);
  assert.equal(matchesSearch('Đề luyện thi', '   '), true);
  assert.equal(matchesSearch(null, 'lan'), false);
});
