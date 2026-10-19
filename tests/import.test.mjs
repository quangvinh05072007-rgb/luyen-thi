import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExamText } from '../shared/parse.mjs';
import { rowsToQuestions, parseCsv, CSV_TEMPLATE } from '../shared/sheet.mjs';

const EXAM = `SỞ GIÁO DỤC VÀ ĐÀO TẠO
ĐỀ KIỂM TRA
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.
Câu 1. Hàm số $y=x^3-3x$ đạt cực đại tại điểm
A. $x=-1$.   B. $x=1$.   C. $x=0$.   D. $x=2$.
Câu 2: Nghiệm của phương trình $2^x=8$ là
A. 2
*B. 3
C. 4
D. 8
Lời giải: $2^x=2^3$. Chọn B.
Câu 3. Điểm A. Cho tam giác ABC có cạnh BC. Tính diện tích tam giác ABC biết AB = 3.
A. 6 B. 4,5 C. 9 D. 3
Đáp án: B
PHẦN II. Câu trắc nghiệm đúng sai.
Câu 1. Cho hàm số $y=\\log_2 x$.
a) Tập xác định là $(0;+\\infty)$.
b) Hàm số nghịch biến.
c) $\\log_2 8 = 3$.
d) Đồ thị đi qua $(1;0)$.
Đáp án: Đ S Đ Đ
PHẦN III. Câu trắc nghiệm trả lời ngắn.
Câu 1. Tính $\\int_0^2 2x\\,dx$.
Câu 2. Tính $\\log_2 32$.
Đáp án: 5
BẢNG ĐÁP ÁN
Câu | 1 | 2 | 3
Đáp án | A | B | B
PHẦN III
Câu 1: 4`;

test('Tách đề theo phần, đáp án đánh dấu, dòng Đáp án, bảng đáp án cuối đề', () => {
  const r = parseExamText(EXAM);
  assert.equal(r.questions.length, 6);
  const [q1, q2, q3, t1, s1, s2] = r.questions;
  assert.equal(q1.type, 'mcq');
  assert.equal(q1.stem, 'Hàm số $y=x^3-3x$ đạt cực đại tại điểm');
  assert.deepEqual(q1.options, ['$x=-1$.', '$x=1$.', '$x=0$.', '$x=2$.']);
  assert.equal(q1.answer, 0, 'từ bảng đáp án hai hàng');
  assert.equal(q2.answer, 1, 'dấu * trước phương án');
  assert.match(q2.explanation, /2\^x=2\^3/);
  assert.equal(q3.answer, 1);
  assert.match(q3.stem, /^Điểm A\. Cho tam giác ABC/, '"A." trong đề bài không bị coi là phương án');
  assert.deepEqual(q3.options, ['6', '4,5', '9', '3']);
  assert.equal(t1.type, 'tf');
  assert.equal(t1.part, 'II');
  assert.deepEqual(t1.answer, [true, false, true, true]);
  assert.equal(t1.options[2], '$\\log_2 8 = 3$.');
  assert.equal(s1.type, 'short');
  assert.equal(s1.answer, '4', 'đáp án Phần III trong bảng theo phần');
  assert.equal(s2.answer, '5');
  assert.ok(r.questions.every((q) => q.warnings.length === 0), JSON.stringify(r.questions.map((q) => q.warnings)));
});

test('Không có tiêu đề phần: tự nhận loại câu; báo thiếu đáp án', () => {
  const r = parseExamText(`Câu 1. Đề A
A. 1 B. 2 C. 3 D. 4
Câu 2. Cho mệnh đề.
a) Ý một
b) Ý hai
c) Ý ba
d) Ý bốn
Câu 3. Tính 1+1.
Đáp án: 2`);
  assert.deepEqual(r.questions.map((q) => q.type), ['mcq', 'tf', 'short']);
  assert.ok(r.questions[0].warnings.some((w) => w.includes('Chưa có đáp án')));
  assert.equal(r.questions[2].answer, '2');
});

test('Đánh dấu [[OK]] (gạch chân/tô đỏ trong Word) chọn đáp án', () => {
  const r = parseExamText('Câu 1. Chọn số chẵn\nA. 1\nB. 3\n[[OK]]C. 4\nD. 5\nCâu 2. Đề\nA. x B. [[OK]]y C. z D. t');
  assert.equal(r.questions[0].answer, 2);
  assert.equal(r.questions[1].answer, 1);
  assert.equal(r.questions[1].options[1], 'y');
});

test('Văn bản không có câu → cảnh báo hướng dẫn', () => {
  const r = parseExamText('Xin chào');
  assert.equal(r.questions.length, 0);
  assert.match(r.warnings[0], /Câu 1\./);
});

test('Excel/CSV theo mẫu: đọc đúng ba loại câu', () => {
  const r = rowsToQuestions(parseCsv(CSV_TEMPLATE));
  assert.equal(r.questions.length, 3);
  const [a, b, c] = r.questions;
  assert.equal(a.type, 'mcq');
  assert.equal(a.answer, 0);
  assert.equal(a.topic, 'T11.DAOHAM');
  assert.equal(a.level, 1);
  assert.equal(b.type, 'tf');
  assert.deepEqual(b.answer, [true, false, true, true]);
  assert.equal(c.type, 'short');
  assert.equal(c.answer, '1');
  assert.ok(r.questions.every((q) => !q.warnings.length));
});
