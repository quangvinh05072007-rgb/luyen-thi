// Xuất đề (mọi mã đề) và đáp án ra Word, công thức là Equation thật.
import { paragraph, table, pageBreak, buildDocx } from './docx.mjs';
import { displayedAnswer } from './generate.mjs';

const PART_ROMAN = { mcq: 'I', tf: 'II', short: 'III' };

/**
 * Bảng đáp án chéo: mỗi câu gốc (theo thứ tự đề gốc) → vị trí và đáp án ở từng mã đề.
 * items: đề gốc [{qid,type}], variants: [{code, layout}] → { codes, rows: [{qid, type, cells: {[code]: {part, no, answer}}}] }
 */
export function crossAnswerKey(items, variants, qById) {
  const pos = {};
  for (const v of variants) {
    const counter = {};
    pos[v.code] = {};
    for (const it of v.layout) {
      counter[it.type] = (counter[it.type] ?? 0) + 1;
      pos[v.code][it.qid] = { it, no: counter[it.type] };
    }
  }
  const rows = items.map((base) => ({
    qid: base.qid,
    type: base.type,
    cells: Object.fromEntries(variants.map((v) => {
      const { it, no } = pos[v.code][base.qid];
      return [v.code, { part: PART_ROMAN[base.type], no, answer: displayedAnswer(it, qById[base.qid]) }];
    })),
  }));
  return { codes: variants.map((v) => v.code), rows };
}

const PART_TITLE = {
  mcq: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu {n}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.',
  tf: 'PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu {n}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
  short: 'PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu {n}.',
};

/**
 * exam: { title, school, durationMin }, variants: [{ code, layout: [{qid,type,perm}] }], qById: { id: question }
 * opts: { withSolutions, baseItems } — baseItems (đề gốc) bật bảng đáp án chéo
 */
export function examBlocks(exam, variants, qById, opts = {}) {
  const baseItems = opts.baseItems;
  const blocks = [];
  variants.forEach((v, vi) => {
    if (vi > 0) blocks.push(pageBreak());
    blocks.push(paragraph(exam.school || '', { bold: true, align: 'center', spaceAfter: 0 }));
    blocks.push(paragraph(exam.title.toUpperCase(), { bold: true, align: 'center', size: 14, spaceAfter: 40 }));
    blocks.push(paragraph(`Thời gian làm bài: ${exam.durationMin} phút, không kể thời gian phát đề`, { italic: true, align: 'center', spaceAfter: 40 }));
    blocks.push(paragraph(`Mã đề ${v.code}`, { bold: true, align: 'center', spaceAfter: 200 }));
    for (const type of ['mcq', 'tf', 'short']) {
      const items = v.layout.filter((x) => x.type === type);
      if (!items.length) continue;
      blocks.push(paragraph(PART_TITLE[type].replace('{n}', items.length), { bold: true, spaceAfter: 120, keepNext: true }));
      items.forEach((it, i) => {
        const q = qById[it.qid];
        blocks.push(paragraph(q.stem, { prefix: [{ text: `Câu ${i + 1}. `, bold: true }], align: 'both', keepNext: true }));
        if (type === 'mcq') {
          const perm = it.perm ?? [0, 1, 2, 3];
          perm.forEach((orig, d) => blocks.push(paragraph(q.options[orig], { prefix: [{ text: `${'ABCD'[d]}. `, bold: true }], indent: 400, spaceAfter: 20 })));
        } else if (type === 'tf') {
          q.options.forEach((s, k) => blocks.push(paragraph(s, { prefix: [{ text: `${'abcd'[k]}) ` , bold: true }], indent: 400, spaceAfter: 20 })));
        }
        if (opts.withSolutions && q.explanation) {
          blocks.push(paragraph(q.explanation, { prefix: [{ text: 'Lời giải. ', bold: true, italic: true }], indent: 400, color: '1F4E79' }));
        }
      });
    }
    blocks.push(paragraph('----- HẾT -----', { align: 'center', bold: true }));
  });

  blocks.push(pageBreak());
  blocks.push(paragraph('ĐÁP ÁN', { bold: true, align: 'center', size: 14 }));
  for (const v of variants) {
    blocks.push(paragraph(`Mã đề ${v.code}`, { bold: true, spaceAfter: 60 }));
    for (const type of ['mcq', 'tf', 'short']) {
      const items = v.layout.filter((x) => x.type === type);
      if (!items.length) continue;
      const head = ['Câu', ...items.map((_, i) => String(i + 1))];
      const row = ['Đáp án', ...items.map((it) => displayedAnswer(it, qById[it.qid]))];
      blocks.push(paragraph({ mcq: 'Phần I', tf: 'Phần II', short: 'Phần III' }[type], { italic: true, spaceAfter: 20 }));
      blocks.push(table([head, row]));
      blocks.push(paragraph('', { spaceAfter: 60 }));
    }
  }
  if (baseItems?.length && variants.length > 1) {
    const key = crossAnswerKey(baseItems, variants, qById);
    blocks.push(pageBreak());
    blocks.push(paragraph('BẢNG ĐÁP ÁN CHÉO GIỮA CÁC MÃ ĐỀ', { bold: true, align: 'center', size: 14 }));
    blocks.push(paragraph('Mỗi ô: phần.số câu trong mã đề — đáp án.', { italic: true, spaceAfter: 60 }));
    const head = ['Câu gốc', ...key.codes.map((c) => `Mã ${c}`)];
    const body = key.rows.map((r, i) => [String(i + 1), ...key.codes.map((c) => `${r.cells[c].part}.${r.cells[c].no}: ${r.cells[c].answer}`)]);
    blocks.push(table([head, ...body]));
  }
  return blocks;
}

export function examToDocx(exam, variants, qById, opts = {}, type = 'nodebuffer') {
  return buildDocx(examBlocks(exam, variants, qById, opts), type);
}
