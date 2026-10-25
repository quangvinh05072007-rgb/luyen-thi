import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { latexToOmml, ommlToLatex } from '../shared/omml.mjs';
import { parseXml, child } from '../shared/xml.mjs';
import { readDocx, buildDocx, paragraph } from '../shared/docx.mjs';
import { examToDocx } from '../shared/exportExam.mjs';
import { makeVariant } from '../shared/generate.mjs';
import { parseExamText } from '../shared/parse.mjs';
import { SAMPLE_QUESTIONS } from '../server/seedQuestions.mjs';

const NS = 'xmlns:m="x" xmlns:w="y"';
const toTree = (omml) => child(parseXml(`<r ${NS}>${omml}</r>`), 'r');
const roundtrip = (latex) => ommlToLatex(toTree(latexToOmml(latex))).replace(/\s+/g, '');

test('LaTeX → OMML: phân số, căn, mũ, chỉ số, tích phân, giới hạn, vectơ, hệ', () => {
  const f = latexToOmml('\\frac{a+1}{2}');
  assert.match(f, /<m:f><m:num>.*a.*<\/m:num><m:den>.*2.*<\/m:den><\/m:f>/);
  assert.match(latexToOmml('\\sqrt{x}'), /<m:rad><m:radPr><m:degHide m:val="1"\/><\/m:radPr><m:deg\/><m:e>/);
  assert.match(latexToOmml('\\sqrt[3]{x}'), /<m:deg>.*3.*<\/m:deg>/);
  assert.match(latexToOmml('x^2'), /<m:sSup><m:e>.*x.*<\/m:e><m:sup>.*2.*<\/m:sup><\/m:sSup>/);
  assert.match(latexToOmml('u_n'), /<m:sSub>/);
  const integral = latexToOmml('\\int_0^1 2x\\,dx');
  assert.match(integral, /<m:nary><m:naryPr><m:chr m:val="∫"\/>/);
  assert.match(integral, /<m:sub>.*0.*<\/m:sub><m:sup>.*1.*<\/m:sup><m:e>.*2.*x.*d.*x.*<\/m:e><\/m:nary>/);
  assert.match(latexToOmml('\\lim_{x\\to 0} f(x)'), /<m:limLow><m:e>.*lim.*<\/m:e><m:lim>.*→.*<\/m:lim><\/m:limLow>/);
  assert.match(latexToOmml('\\vec{u}'), /<m:acc><m:accPr><m:chr m:val="⃗"\/>/);
  assert.match(latexToOmml('\\begin{cases} x=1 \\\\ y=2 \\end{cases}'), /<m:eqArr><m:e>.*<\/m:e><m:e>.*<\/m:e><\/m:eqArr>/);
  assert.ok(!latexToOmml('x^2\\big|_0^1').includes('big'), 'lệnh cỡ ngoặc không in thành chữ');
  assert.match(latexToOmml('\\alpha \\le \\pi'), /α≤π|α.*≤.*π/);
  assert.match(latexToOmml('\\left( \\dfrac{1}{2} \\right)'), /<m:d><m:dPr><m:begChr m:val="\("\/><m:endChr m:val="\)"\/>/);
  // XML phải hợp lệ: đếm thẻ mở/đóng
  for (const s of SAMPLE_QUESTIONS.flatMap((q) => [q.stem, ...q.options, q.explanation]).flatMap((t) => [...t.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]))) {
    const x = latexToOmml(s);
    const open = (x.match(/<m:[a-zA-Z]+(?:\s[^>]*)?(?<!\/)>/g) ?? []).length;
    const close = (x.match(/<\/m:[a-zA-Z]+>/g) ?? []).length;
    assert.equal(open, close, `thẻ lệch ở: ${s}`);
  }
});

test('OMML → LaTeX: đi vòng giữ nghĩa', () => {
  assert.equal(roundtrip('\\frac{1}{2}'), '\\frac{1}{2}');
  assert.equal(roundtrip('x^{2}+1'), 'x^2+1');
  assert.equal(roundtrip('\\sqrt{x+1}'), '\\sqrt{x+1}');
  assert.equal(roundtrip('\\int_0^1 x dx'), '\\int_0^1xdx');
  assert.equal(roundtrip('\\vec{u}'), '\\vec{u}');
  assert.equal(roundtrip('\\overrightarrow{AB}'), '\\overrightarrow{AB}');
  assert.equal(roundtrip('a \\le b'), 'a\\leb');
  assert.equal(roundtrip('\\lim_{x\\to 1} x'), '\\lim_{x\\to1}x');
});

test('Word: ghi đề có công thức rồi đọc lại được đúng câu, đáp án, công thức', async () => {
  const qs = SAMPLE_QUESTIONS.slice(0, 3).map((q, i) => ({ ...q, id: i + 1 }));
  const qById = Object.fromEntries(qs.map((q) => [q.id, q]));
  const items = qs.map((q) => ({ qid: q.id, type: q.type }));
  const variants = [{ code: '101', layout: makeVariant(items, 'a') }];
  const buf = await examToDocx({ title: 'Đề thử', school: 'Trường mẫu', durationMin: 90 }, variants, qById, { withSolutions: false });
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /<m:oMath>/, 'có Equation thật');
  assert.ok(!xml.includes('$'), 'không còn ký hiệu $ thô');
  const { text, stats } = await readDocx(buf);
  assert.ok(stats.equations > 5);
  const parsed = parseExamText(text);
  assert.equal(parsed.questions.length, 3);
  const first = variants[0].layout[0];
  const q0 = qById[first.qid];
  assert.equal(parsed.questions[0].type, 'mcq');
  assert.equal(parsed.questions[0].stem.replace(/\s+/g, ''), q0.stem.replace(/\s+/g, '').replace('\\dfrac', '\\frac'));
  // Bảng đáp án ở cuối được hiểu lại theo mã đề
  assert.equal(parsed.questions[0].answer, first.perm.indexOf(q0.answer));
});

test('Word: đọc phương án gạch chân là đáp án', async () => {
  const p = (inner) => `<w:p>${inner}</w:p>`;
  const r = (t, u) => `<w:r>${u ? '<w:rPr><w:u w:val="single"/></w:rPr>' : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
  const zip = new JSZip();
  zip.file('word/document.xml', `<w:document xmlns:w="w" xmlns:m="m"><w:body>${p(r('Câu 1. Tính ') + '<m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f></m:oMath>' + r(' + 1'))}${p(r('A. 1'))}${p(r('B', true) + r('. 1,5'))}${p(r('C. 2'))}${p(r('D. 3'))}</w:body></w:document>`);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const { text } = await readDocx(buf);
  const q = parseExamText(text).questions[0];
  assert.match(q.stem, /\$\\frac\{1\}\{2\}\$/);
  assert.equal(q.answer, 1);
  assert.equal(q.options[1], '1,5');
});

test('Đoạn văn trộn chữ và công thức', async () => {
  const buf = await buildDocx([paragraph('Cho $x^2=4$, tìm $x$.')]);
  const { text } = await readDocx(buf);
  assert.equal(text.replace(/\s+/g, ' '), 'Cho $x^2=4$, tìm $x$.');
});

test('File đề soạn bằng Microsoft Word thật: đọc Equation, đáp án gạch chân, tiêu đề phần', async () => {
  const fs = await import('node:fs');
  const { importFile } = await import('../server/importers.mjs');
  const r = await importFile('de.docx', fs.readFileSync(new URL('./fixtures/de-soan-bang-word.docx', import.meta.url)), null);
  assert.equal(r.info.equations, 2);
  const [a, b] = r.questions;
  assert.equal(a.stem, 'Giá trị của biểu thức $\\frac{1}{2}+\\sqrt{4}$ bằng');
  assert.equal(a.answer, 1);
  assert.equal(b.type, 'short');
  assert.equal(b.answer, '1');
  assert.equal(b.topic, 'T12.NGUYENHAM');
});
