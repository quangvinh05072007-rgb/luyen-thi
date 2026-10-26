import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importFile, pdfToText, answerFileToText } from '../server/importers.mjs';

// A scanned exam page followed by a searchable solution page, without private files.
function mixedPdf({ image = true, solution = true } = {}) {
  const stream = (s) => `<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /XObject << /Im1 7 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 8 0 R >> >> /Contents 6 0 R >>',
    stream(image ? 'q 600 0 0 800 0 0 cm /Im1 Do Q' : ''),
    stream(solution ? 'BT /F1 12 Tf 20 700 Td (DAP AN VA LOI GIAI THAM KHAO) Tj 0 -20 Td (Cau 1. Solution only, not the question.) Tj ET' : ''),
    '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\x80\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 9\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

test('mixed PDF identifies scanned pages and refuses to import only the solutions', async () => {
  const buf = mixedPdf();
  const text = await pdfToText(buf);
  assert.deepEqual(text.scannedPages, [1]);
  assert.match(text.text, /DAP AN/);
  await assert.rejects(importFile('mixed.pdf', buf, null), e => e.status === 400 && /scan/.test(e.message) && /1/.test(e.message));
  assert.match(await answerFileToText('answers.pdf', buf), /DAP AN/, 'separate answer files still read their text');
});

test('blank pages are not classified as scans; image-only PDFs are rejected clearly', async () => {
  assert.deepEqual((await pdfToText(mixedPdf({ image: false }))).scannedPages, []);
  await assert.rejects(importFile('scan.pdf', mixedPdf({ solution: false }), null), e => e.status === 400 && /scan/.test(e.message));
});
