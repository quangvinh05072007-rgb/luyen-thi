// Giai đoạn 1.2 và 1.4: đáp án từ nhiều nguồn được đối chiếu, file đáp án rời, độ đáng ngờ để duyệt sau nhập.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { parseExamText, parseAnswerFileText, applyAnswerEntries } from '../shared/parse.mjs';
import { assessQuestion } from '../shared/review.mjs';
import { importFile, answerFileToText, tagDrafts } from '../server/importers.mjs';
import { buildDocx, paragraph, table } from '../shared/docx.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

const exam = (marks = {}) => `PHẦN I
Câu 1. Đạo hàm của $y=x^3$ là
A. $3x^2$
${marks[1] ?? ''}B. $x^2$
C. $3x$
D. $x^3$
Câu 2. Giá trị của $2+2$ bằng
A. 3
B. 4
C. 5
D. 6
PHẦN II
Câu 1. Xét các mệnh đề về hàm số $y=x$:
a) Đồng biến
b) Nghịch biến
c) Có đồ thị là đường thẳng
d) Cắt trục tung tại $(0;1)$
PHẦN III
Câu 1. Tính $\\frac{3}{2}$ (nhập dạng số thập phân).
Câu 2. Tính $1+1$.`;

test('Nhiều nguồn khớp nhau: đáp án được nhận và ghi rõ các nguồn đồng ý', () => {
  const text = `${exam({ 1: '*' }).replace('B. $x^2$', 'B. $x^2$\nĐáp án: B')}
ĐÁP ÁN
Câu | 1 | 2
Đáp án | B | B`;
  const q1 = parseExamText(text).questions[0];
  assert.equal(q1.answer, 1);
  assert.deepEqual([...q1.answerSources].sort(), ['key', 'line', 'mark'].sort());
  assert.equal(q1.answerConflict, undefined);
});

test('Nguồn mâu thuẫn: không đoán, để trống và nêu rõ từng nguồn nói gì', () => {
  const text = `${exam({ 1: '*' })}
ĐÁP ÁN
Câu | 1 | 2
Đáp án | C | B`;
  const { questions } = parseExamText(text);
  const q1 = questions[0];
  assert.equal(q1.answer, null, 'dấu * chọn B nhưng bảng đáp án ghi C → không tự chọn');
  assert.equal(q1.answerConflict.length, 2);
  assert.deepEqual(q1.answerConflict.map((g) => g.label).sort(), ['B', 'C']);
  assert.match(q1.warnings.join(' '), /mâu thuẫn.*dấu gạch chân.*B.*bảng đáp án.*C/);
  assert.ok(!q1.warnings.some((w) => /Chưa có đáp án/.test(w)), 'không báo chưa có đáp án khi đã báo mâu thuẫn');
  assert.equal(questions[1].answer, 1, 'câu không mâu thuẫn vẫn nhận bình thường');
  const s = assessQuestion(q1);
  assert.equal(s.level, 'high');
  assert.ok(s.reasons.some((r) => /mâu thuẫn/.test(r)));
});

test('Đúng/Sai và trả lời ngắn: so sánh theo giá trị (1,5 = 3/2 = 1.5)', () => {
  const ok = parseExamText(`${exam()}

ĐÁP ÁN
PHẦN II
Câu 1: ĐSĐS
PHẦN III
Câu 1: 1,5
Câu 2: 2`);
  const tf = ok.questions.find((q) => q.type === 'tf');
  assert.deepEqual(tf.answer, [true, false, true, false]);
  assert.equal(ok.questions.find((q) => q.type === 'short' && q.num === 1).answer, '1,5');

  const q = parseExamText(exam()).questions.find((x) => x.type === 'short' && x.num === 1);
  q.answerCands = [{ src: 'line', value: '1.5' }];
  q.answer = '1.5';
  const r = applyAnswerEntries([q], [{ num: 1, part: null, kind: 'short', value: '3/2' }], 'file');
  assert.equal(r.applied, 1);
  assert.equal(q.answerConflict, undefined, '1.5 và 3/2 là cùng một số');
  assert.equal(q.answer, '1.5');
  const bad = applyAnswerEntries([q], [{ num: 1, part: null, kind: 'short', value: '2' }], 'file');
  assert.equal(bad.applied, 1);
  assert.ok(q.answerConflict);
  assert.equal(q.answer, null);

  const tf2 = parseExamText(exam()).questions.find((x) => x.type === 'tf');
  tf2.answerCands = [{ src: 'mark', value: [true, true, true, true] }];
  tf2.answer = [true, true, true, true];
  applyAnswerEntries([tf2], [{ num: 1, part: 'II', kind: 'tf', value: [true, true, true, false] }], 'file');
  assert.ok(tf2.answerConflict, 'khác một ý cũng là mâu thuẫn');
});

test('File đáp án rời: đọc từ văn bản, CSV dọc, Word; số câu trùng giữa các phần được ghép đúng theo loại', async () => {
  const entries = parseAnswerFileText('Phần I\n1. B\n2. B\nPhần II\n1. ĐSĐS\nPhần III\n1: 1,5\n2: 2');
  assert.equal(entries.length, 5);
  const { questions } = parseExamText(exam());
  const r = applyAnswerEntries(questions, entries, 'file');
  assert.equal(r.applied, 5);
  assert.deepEqual(r.unmatched, []);
  assert.deepEqual(questions.map((q) => q.answer), [1, 1, [true, false, true, false], '1,5', '2']);
  assert.deepEqual(questions[0].answerSources, ['file']);

  const csv = await answerFileToText('dapan.csv', Buffer.from('Câu,Đáp án\n1,B\n2,D\n'));
  const vertical = parseAnswerFileText(csv);
  assert.deepEqual(vertical.map((e) => [e.num, e.value]), [[1, 1], [2, 3]]);

  const docx = await buildDocx([paragraph('ĐÁP ÁN', { bold: true }), table([['Câu', '1', '2'], ['Đáp án', 'C', 'A']])]);
  const fromDocx = parseAnswerFileText(await answerFileToText('dapan.docx', docx));
  assert.deepEqual(fromDocx.map((e) => [e.num, e.value]), [[1, 2], [2, 0]]);

  await assert.rejects(answerFileToText('dapan.exe', Buffer.from('x')), /chưa hỗ trợ/);
  assert.deepEqual(applyAnswerEntries([], [{ num: 9, part: null, kind: 'mcq', value: 0 }]).unmatched.length, 1);
});

test('Độ đáng ngờ: câu lỗi xếp lên trước, mỗi mức có lý do cụ thể', () => {
  const good = { type: 'mcq', stem: 'Đạo hàm của $y=x^3$ là gì trong các đáp án sau?', options: ['a', 'b', 'c', 'd'].map((x) => `$${x}x$`), answer: 1, answerSources: ['key', 'mark'], topic: 'T11.DAOHAM', tagConfidence: 1, explanation: '' };
  assert.equal(assessQuestion(good).level, 'low');
  const cases = {
    'Chưa có đáp án': { ...good, answer: null, answerSources: [] },
    'chỉ dựa vào dấu': { ...good, answerSources: ['mark'] },
    'Thiếu hoặc rỗng phương án': { ...good, options: ['a', 'b', '', 'd'] },
    'giống hệt': { ...good, options: ['x', 'x', 'y', 'z'] },
    'hình': { ...good, stem: 'Cho hình [hình] bên' },
    'MathType': { ...good, stem: 'Tính [công thức MathType chưa đọc được] bằng' },
    'không đóng': { ...good, stem: 'Tính $x^2 + bằng bao nhiêu nhỉ' },
    'gộp': { ...good, options: ['a', 'b', 'c', 'd\nCâu 5. Hàm số khác'] },
    'chuyên đề': { ...good, topic: null, tagConfidence: 0 },
    'rất ngắn': { ...good, stem: 'Tính' },
    'PDF': { ...good },
  };
  for (const [needle, q] of Object.entries(cases)) {
    const a = assessQuestion(q, needle === 'PDF' ? { kind: 'pdf' } : {});
    assert.ok(a.reasons.some((r) => r.includes(needle) || new RegExp(needle, 'i').test(r)), `${needle}: ${a.reasons}`);
    assert.ok(a.score > 0);
  }
  assert.equal(assessQuestion({ ...good, answer: null, answerSources: [], answerConflict: [{}, {}] }).level, 'high');
  const sorted = Object.values(cases).map((q) => assessQuestion(q).score);
  assert.ok(Math.max(...sorted) > assessQuestion(good).score);
});

test('Word thật: đáp án gạch chân chỉ một nguồn → đánh dấu cần đối chiếu; thêm bảng đáp án thì hết cảnh báo đó', async () => {
  const buf = fs.readFileSync(new URL('./fixtures/de-soan-bang-word.docx', import.meta.url));
  const r = await importFile('de.docx', buf, null);
  const q1 = r.questions[0];
  assert.equal(q1.answer, 1);
  assert.deepEqual(q1.answerSources, ['mark']);
  assert.ok(q1.suspicion.reasons.some((x) => /chỉ dựa vào dấu/.test(x)));
  assert.ok(q1.raw.includes('Giá trị của biểu thức'), 'giữ bản gốc để so sánh');
  applyAnswerEntries(r.questions, [{ num: 1, part: null, kind: 'mcq', value: 1 }], 'file');
  const again = tagDrafts(r.questions.map(({ suspicion, ...q }) => q), 'docx')[0];
  assert.deepEqual([...again.answerSources].sort(), ['file', 'mark']);
  assert.ok(!again.suspicion.reasons.some((x) => /chỉ dựa vào dấu/.test(x)));
});

// ---------------- API ----------------
let server;
let url;
let app;
before(async () => {
  app = createApp({ dbFile: ':memory:', aiImpl: { enabled: false } });
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function login(u) {
  const res = await fetch(`${url}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: SAMPLE_PASSWORD }) });
  const cookie = res.headers.get('set-cookie').split(';')[0];
  return async (path, body, raw) => {
    const headers = { cookie };
    if (raw) Object.assign(headers, { 'content-type': 'application/octet-stream', 'x-smartexam': '1' });
    else headers['content-type'] = 'application/json';
    const r = await fetch(url + path, { method: 'POST', headers, body: raw ?? JSON.stringify(body ?? {}) });
    return { status: r.status, data: await r.json() };
  };
}

test('API: nhập đề → nạp file đáp án rời → câu mâu thuẫn bị đánh dấu; học sinh không dùng được', async () => {
  const post = await login('gv.lan');
  const imp = await post('/api/import', { text: exam({ 1: '*' }) });
  assert.equal(imp.status, 200);
  assert.ok(imp.data.questions.every((q) => q.suspicion && Array.isArray(q.suspicion.reasons)));
  assert.equal(imp.data.questions[0].answer, 1);

  const ans = await post('/api/import/answers?filename=dapan.csv', undefined, Buffer.from('Phần,Câu,Đáp án\n,1,C\n,2,B\n'));
  assert.equal(ans.status, 200);
  assert.equal(ans.data.count, 2);
  const applied = await post('/api/import/apply-key', { questions: imp.data.questions, entries: ans.data.entries });
  assert.equal(applied.status, 200);
  assert.equal(applied.data.conflicts, 1);
  const q1 = applied.data.questions[0];
  assert.equal(q1.answer, null);
  assert.equal(q1.suspicion.level, 'high');
  assert.equal(applied.data.questions[1].answer, 1);

  const none = await post('/api/import/answers', { text: 'không có gì cả' });
  assert.equal(none.status, 400);
  const stu = await login('hs.an.nm');
  assert.equal((await stu('/api/import/answers', { text: '1. A' })).status, 403);
  assert.equal((await stu('/api/import/apply-key', {})).status, 403);
  assert.ok(app.db.get("SELECT COUNT(*) n FROM audit_log WHERE action = 'import_apply_key'").n >= 1);
});
