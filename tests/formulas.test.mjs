// Giai đoạn 1.5: công thức. 33 công thức do Microsoft Word dựng (ma trận, hệ, tích phân, giới hạn, véc-tơ, tập số…)
// phải đọc thành LaTeX mà KaTeX hiển thị được; cấu trúc lạ và MathType OLE phải được báo rõ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import katex from 'katex';
import { readDocx } from '../shared/docx.mjs';
import { ommlToLatex, drainUnknownOmml } from '../shared/omml.mjs';
import { parseXml, child } from '../shared/xml.mjs';
import { importFile } from '../server/importers.mjs';

const wordFile = fs.readFileSync(new URL('./fixtures/cong-thuc-word.docx', import.meta.url));

test('33 công thức Word thật: đọc đủ, KaTeX hiển thị được hết, không có cấu trúc lạ', async () => {
  const r = await readDocx(wordFile);
  assert.equal(r.stats.equations, 33);
  assert.deepEqual(r.stats.unknownMath, []);
  const formulas = r.text.split('\n').filter((l) => l.startsWith('$') && l.endsWith('$')).map((l) => l.slice(1, -1));
  assert.equal(formulas.length, 33);
  const bad = [];
  for (const f of formulas) {
    try {
      katex.renderToString(f, { throwOnError: true, strict: 'ignore' });
    } catch (e) {
      bad.push(`${f} → ${e.message.slice(0, 70)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('Nội dung công thức đúng, không chỉ hiển thị được', async () => {
  const { text } = await readDocx(wordFile);
  const has = (re, msg) => assert.match(text, re, msg);
  has(/\\mathbb\{R\}/, 'ℝ');
  has(/\\mathbb\{N\}/, 'ℕ');
  has(/f'\\left\( x \\right\)=3x\^2/, 'đạo hàm f′(x)');
  has(/\\lfloor x \\right\\rfloor|\\left\\lfloor x \\right\\rfloor/, 'phần nguyên');
  has(/\\begin\{cases\} x\+y=1 \\\\ x-y=3 \\end\{cases\}/, 'hệ phương trình');
  has(/\\begin\{matrix\} a & b \\\\ c & d \\end\{matrix\}/, 'ma trận');
  has(/\\sqrt\[3\]\{x\+1\}/, 'căn bậc 3');
  has(/\\lim_\{x\\to 0\} \\frac\{\\sin x\}\{x\}/, 'giới hạn');
  has(/\\sum_\{k=1\}\^n/, 'tổng');
  has(/\\prod_\{i=1\}\^n/, 'tích');
  has(/\\int_0\^1 x\^2dx/, 'tích phân');
  has(/\\vec\{a\}/, 'véc-tơ');
  has(/\\binom\{n\}\{k\}/, 'tổ hợp');
  has(/\\left\| x-1 \\right\|/, 'giá trị tuyệt đối');
  has(/\\Delta/, 'Δ');
  assert.doesNotMatch(text, /[\u200b\u2061\u2062\u2063]/, 'không còn ký tự vô hình');
});

test('Cấu trúc OMML chưa hỗ trợ được ghi nhận (không âm thầm bỏ qua)', () => {
  drainUnknownOmml();
  const xml = '<m:oMath xmlns:m="m"><m:foo><m:e><m:r><m:t>x</m:t></m:r></m:e></m:foo><m:bar2><m:r><m:t>y</m:t></m:r></m:bar2></m:oMath>';
  const latex = ommlToLatex(child(parseXml(xml), 'm:oMath'));
  assert.equal(latex, 'xy', 'nội dung bên trong vẫn được đọc');
  assert.deepEqual(drainUnknownOmml().sort(), ['m:bar2', 'm:foo']);
  assert.deepEqual(drainUnknownOmml(), [], 'đọc xong thì xóa');
});

test('Thành phần hộp, tiền chỉ số, phủ ký hiệu đọc được', () => {
  const m = (inner) => ommlToLatex(child(parseXml(`<m:oMath>${inner}</m:oMath>`), 'm:oMath'));
  assert.equal(m('<m:borderBox><m:e><m:r><m:t>x</m:t></m:r></m:e></m:borderBox>'), '\\boxed{x}');
  assert.equal(m('<m:sPre><m:sub><m:r><m:t>a</m:t></m:r></m:sub><m:sup><m:r><m:t>b</m:t></m:r></m:sup><m:e><m:r><m:t>C</m:t></m:r></m:e></m:sPre>'), '{}_a^bC');
  assert.equal(m('<m:limUpp><m:e><m:r><m:t>x</m:t></m:r></m:e><m:lim><m:r><m:t>n</m:t></m:r></m:lim></m:limUpp>'), '\\overset{n}{x}');
  assert.equal(m('<m:sSup><m:e><m:r><m:t>f</m:t></m:r></m:e><m:sup><m:r><m:t>′′</m:t></m:r></m:sup></m:sSup>'), "f''");
});

async function docWith(bodyXml) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', `<w:document xmlns:w="w" xmlns:m="m" xmlns:v="v" xmlns:o="o"><w:body>${bodyXml}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('MathType OLE: báo rõ trong câu, trong cảnh báo và trong độ đáng ngờ', async () => {
  const buf = await docWith(
    '<w:p><w:r><w:t>Câu 1. Tính giá trị biểu thức</w:t></w:r><w:r><w:object><v:shape><v:imagedata r:id="rId9"/></v:shape><o:OLEObject ProgID="Equation.DSMT4"/></w:object></w:r></w:p>' +
      '<w:p><w:r><w:t>A. 1</w:t></w:r></w:p><w:p><w:r><w:t>B. 2</w:t></w:r></w:p><w:p><w:r><w:t>C. 3</w:t></w:r></w:p><w:p><w:r><w:t>D. 4</w:t></w:r></w:p>',
  );
  const r = await importFile('mathtype.docx', buf, null);
  assert.equal(r.info.oleEquations, 1);
  assert.match(r.questions[0].stem, /\[công thức MathType chưa đọc được\]/);
  assert.ok(r.warnings.some((w) => /MathType/.test(w) && /Convert Equations/.test(w)));
  assert.ok(r.questions[0].suspicion.reasons.some((x) => /MathType/.test(x)));
  assert.equal(r.questions[0].suspicion.level, 'high');
});

test('Cảnh báo cấu trúc lạ xuất hiện khi nhập file', async () => {
  const buf = await docWith('<w:p><w:r><w:t>Câu 1. Tính </w:t></w:r><m:oMath><m:zzz><m:e><m:r><m:t>x</m:t></m:r></m:e></m:zzz></m:oMath></w:p><w:p><w:r><w:t>A. 1</w:t></w:r></w:p><w:p><w:r><w:t>B. 2</w:t></w:r></w:p><w:p><w:r><w:t>C. 3</w:t></w:r></w:p><w:p><w:r><w:t>D. 4</w:t></w:r></w:p>');
  const r = await importFile('la.docx', buf, null);
  assert.ok(r.warnings.some((w) => /chưa hỗ trợ.*m:zzz/.test(w)), r.warnings.join('|'));
});
