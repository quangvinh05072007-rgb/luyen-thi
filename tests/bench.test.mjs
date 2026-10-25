// Giai đoạn 1.3: ngưỡng chặn lùi cho độ chính xác nhập đề (xem docs/do-chinh-xac.md, chạy `npm run bench`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBenchmark, heldoutScore, FORMATS } from './bench/bench.mjs';

test('Đo 11 kiểu trình bày × 64 câu: không đáp án sai, không lỗi âm thầm, đề/phương án/đáp án đúng gần như tuyệt đối', async () => {
  const results = await runBenchmark({ withReal: false });
  assert.equal(results.length, FORMATS.length);
  const sum = (k) => results.reduce((s, r) => s + r[k], 0);
  const N = sum('n');
  assert.equal(N, 11 * 64);
  assert.equal(sum('found'), N, 'tìm đủ số câu ở mọi kiểu');
  assert.equal(sum('answerWrong'), 0, 'KHÔNG được trả đáp án sai mà không cảnh báo');
  assert.equal(sum('silent'), 0, 'KHÔNG được có câu nhập sai mà độ đáng ngờ vẫn thấp');
  assert.equal(sum('typeOk'), N);
  assert.ok(sum('stemOk') / N >= 0.99, `đề đúng ${sum('stemOk')}/${N}`);
  assert.ok(sum('optsOk') / N >= 0.99, `phương án đúng ${sum('optsOk')}/${N}`);
  assert.ok(sum('answerRight') / N >= 0.99, `đáp án đúng ${sum('answerRight')}/${N}`);
  for (const r of results) assert.equal(r.answerWrong, 0, r.id);
  // bộ chuyên đề trên chính bộ mẫu (đã dùng để chỉnh): chỉ chặn lùi
  const tn = sum('topicN');
  assert.ok(sum('topicOk') / tn >= 0.95, `chuyên đề đúng ${sum('topicOk')}/${tn}`);
  assert.equal(sum('topicConfidentWrong'), 0, 'chuyên đề tin cậy cao mà sai trên bộ mẫu');
});

test('Bộ câu để dành (không dùng để chỉnh): ngưỡng chặn lùi cho độ chính xác ngoài mẫu', () => {
  const h = heldoutScore();
  assert.equal(h.n, 42);
  assert.ok(h.ok / h.n >= 0.88, `đoán đúng ${h.ok}/${h.n}: ${h.wrong.join('; ')}`);
  assert.ok(h.confidentWrong <= 2, `tin cậy cao mà sai ${h.confidentWrong}: ${h.wrong.join('; ')}`);
  assert.ok(h.none <= 5, `không đoán được ${h.none}`);
});

test('Nhiễu: đáp án mâu thuẫn được phát hiện thay vì chọn bừa', async () => {
  const { importText } = await import('../server/importers.mjs');
  const text = ['PHẦN I', 'Câu 1. Tính $1+1$.', 'A. 1', '*B. 2', 'C. 3', 'D. 4', 'Câu 2. Tính $2+2$.', 'A. 4', 'B. 5', 'C. 6', 'D. 7', 'ĐÁP ÁN', 'Câu | 1 | 2', 'Đáp án | C | A'].join('\n');
  const q = importText(text).questions[0];
  assert.equal(q.answer, null);
  assert.equal(q.suspicion.level, 'high');
});
