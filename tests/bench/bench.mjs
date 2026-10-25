// Bộ đo độ chính xác nhập đề.
// Nguồn chuẩn: 64 câu mẫu của SmartExam (đáp án đã kiểm tay) được "in" ra nhiều kiểu trình bày thường gặp,
// nhập lại bằng đúng bộ nhập thật rồi so với bản gốc. Ngoài ra, mọi cặp (file, *.expected.json) đặt trong
// tests/bench/real/ (đề thật của trường) cũng được chạy cùng cách.
//
// Hai con số quan trọng nhất:
//  - "đáp án sai": máy trả đáp án khác bản chuẩn (giáo viên dễ tin) — phải bằng 0;
//  - "lỗi âm thầm": câu nhập sai (đề, phương án hoặc đáp án) mà độ đáng ngờ vẫn ở mức thấp — màn hình duyệt không cảnh báo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_QUESTIONS } from '../../server/seedQuestions.mjs';
import { importText, importFile } from '../../server/importers.mjs';
import { buildDocx, paragraph, table } from '../../shared/docx.mjs';
import { latexToOmml, ommlToLatex } from '../../shared/omml.mjs';
import { parseXml, child } from '../../shared/xml.mjs';
import { parseNumber } from '../../shared/grading.mjs';
import { makeRng } from '../../shared/rng.mjs';
import { classifyQuestion } from '../../shared/classify.mjs';
import { HELDOUT } from './heldout.mjs';

const PARTS = [
  ['mcq', 'PHẦN I'],
  ['tf', 'PHẦN II'],
  ['short', 'PHẦN III'],
];
const gold = SAMPLE_QUESTIONS.map((q, i) => ({ ...q, id: i + 1 }));
const byPart = (t) => gold.filter((q) => q.type === t);
const letters = 'ABCD';
const tfLetters = 'abcd';
const showTf = (a) => a.map((x) => (x ? 'Đ' : 'S')).join('');

// ---------------- các kiểu trình bày ----------------
function textStyle({ marks, optionLines, keyTable, answerLine, label = 'Câu {n}.', optLabel = '{L}.' }) {
  const out = [];
  const key = { mcq: [], tf: [], short: [] };
  for (const [type, title] of PARTS) {
    out.push(title);
    byPart(type).forEach((q, i) => {
      const n = i + 1;
      out.push(`${label.replace('{n}', n)} ${q.stem}`);
      if (type === 'mcq') {
        const opts = q.options.map((o, k) => `${marks && q.answer === k ? '*' : ''}${optLabel.replace('{L}', letters[k])} ${o}`);
        if (optionLines) out.push(...opts);
        else out.push(opts.join('   '));
        key.mcq.push(letters[q.answer]);
        if (answerLine) out.push(`Đáp án: ${letters[q.answer]}`);
      } else if (type === 'tf') {
        q.options.forEach((o, k) => out.push(`${marks && q.answer[k] ? '*' : ''}${tfLetters[k]}) ${o}`));
        key.tf.push(showTf(q.answer));
        if (answerLine) out.push(`Đáp án: ${showTf(q.answer)}`);
      } else {
        key.short.push(String(q.answer));
        if (answerLine) out.push(`Đáp án: ${q.answer}`);
      }
    });
  }
  if (keyTable) {
    out.push('ĐÁP ÁN');
    out.push('PHẦN I', `Câu | ${key.mcq.map((_, i) => i + 1).join(' | ')}`, `Đáp án | ${key.mcq.join(' | ')}`);
    out.push('PHẦN II', ...key.tf.map((v, i) => `Câu ${i + 1}: ${v}`));
    out.push('PHẦN III', ...key.short.map((v, i) => `Câu ${i + 1}: ${v}`));
  }
  return out.join('\n');
}

function noisyText(seed) {
  const rng = makeRng(seed);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const out = [];
  const key = { mcq: [], tf: [], short: [] };
  for (const [type, title] of PARTS) {
    out.push(pick([title, title.toLowerCase().replace('phần', 'Phần'), `${title}.`, `${title}:`]));
    byPart(type).forEach((q, i) => {
      const n = i + 1;
      if (rng() < 0.3) out.push('');
      out.push(`${pick(['Câu', 'Câu', 'CÂU', 'Bài'])} ${n}${pick(['.', '.', ':', ')'])}  ${q.stem}${pick(['', ' ', '  '])}`);
      const mark = rng() < 0.5;
      if (type === 'mcq') {
        const lab = pick(['{L}.', '{L}.', '{L})']);
        const opts = q.options.map((o, k) => `${mark && q.answer === k ? pick(['*', '*', '[[OK]]']) : ''}${lab.replace('{L}', letters[k])} ${o}`);
        if (rng() < 0.5) out.push(...opts);
        else out.push(opts.join(pick([' ', '   ', '\t'])));
        key.mcq.push(letters[q.answer]);
        if (!mark && rng() < 0.4) out.push(pick(['Đáp án', 'Đáp án', 'ĐA']) + `: ${letters[q.answer]}`);
      } else if (type === 'tf') {
        q.options.forEach((o, k) => out.push(`${mark && q.answer[k] ? '*' : ''}${tfLetters[k]}) ${o}`));
        key.tf.push(showTf(q.answer));
      } else {
        key.short.push(String(q.answer));
        if (rng() < 0.5) out.push(`Đáp án: ${q.answer}`);
      }
    });
  }
  out.push(pick(['ĐÁP ÁN', 'BẢNG ĐÁP ÁN', 'Đáp án']));
  out.push('PHẦN I', ...key.mcq.map((v, i) => `${i + 1}.${v}`).reduce((rows, c, i) => (i % 6 ? ((rows[rows.length - 1] += ` ${c}`), rows) : [...rows, c]), []));
  out.push('PHẦN II', ...key.tf.map((v, i) => `Câu ${i + 1}: ${v}`));
  out.push('PHẦN III', ...key.short.map((v, i) => `Câu ${i + 1}: ${v}`));
  return out.join('\n');
}

const RED = 'FF0000';
async function wordDoc({ redMarks, keyTable }) {
  const blocks = [];
  const key = { mcq: [], tf: [], short: [] };
  for (const [type, title] of PARTS) {
    blocks.push(paragraph(title, { bold: true }));
    byPart(type).forEach((q, i) => {
      blocks.push(paragraph(q.stem, { prefix: [{ text: `Câu ${i + 1}. `, bold: true }] }));
      if (type === 'mcq') {
        q.options.forEach((o, k) => blocks.push(paragraph(o, { prefix: [{ text: `${letters[k]}. `, bold: true }], color: redMarks && q.answer === k ? RED : undefined })));
        key.mcq.push(letters[q.answer]);
      } else if (type === 'tf') {
        q.options.forEach((o, k) => blocks.push(paragraph(o, { prefix: [{ text: `${tfLetters[k]}) `, bold: true }], color: redMarks && q.answer[k] ? RED : undefined })));
        key.tf.push(showTf(q.answer));
        if (!keyTable) blocks.push(paragraph(`Đáp án: ${showTf(q.answer)}`));
      } else {
        key.short.push(String(q.answer));
        if (!keyTable) blocks.push(paragraph(`Đáp án: ${q.answer}`));
      }
    });
  }
  if (keyTable) {
    blocks.push(paragraph('ĐÁP ÁN', { bold: true }));
    blocks.push(paragraph('PHẦN I'));
    blocks.push(table([['Câu', ...key.mcq.map((_, i) => String(i + 1))], ['Đáp án', ...key.mcq]]));
    blocks.push(paragraph('PHẦN II'));
    key.tf.forEach((v, i) => blocks.push(paragraph(`Câu ${i + 1}: ${v}`)));
    blocks.push(paragraph('PHẦN III'));
    key.short.forEach((v, i) => blocks.push(paragraph(`Câu ${i + 1}: ${v}`)));
  }
  return buildDocx(blocks);
}

function csvDoc() {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = ['Loại,Nội dung,A,B,C,D,Đáp án,Chủ đề,Mức độ,Lời giải'];
  for (const [type] of PARTS) {
    for (const q of byPart(type)) {
      const ans = type === 'mcq' ? letters[q.answer] : type === 'tf' ? showTf(q.answer) : q.answer;
      rows.push([{ mcq: 'TN', tf: 'DS', short: 'TLN' }[type], q.stem, ...(type === 'short' ? ['', '', '', ''] : q.options), ans, '', '', q.explanation].map(cell).join(','));
    }
  }
  return Buffer.from('﻿' + rows.join('\r\n'), 'utf8');
}

export const FORMATS = [
  { id: 'text-dau-sao', name: 'Văn bản, đáp án đánh dấu *', kind: 'text', make: () => textStyle({ marks: true, optionLines: true, answerLine: true }) },
  { id: 'text-dong-dap-an', name: 'Văn bản, dòng "Đáp án: …" dưới từng câu', kind: 'text', make: () => textStyle({ optionLines: true, answerLine: true }) },
  { id: 'text-bang-dap-an', name: 'Văn bản, chỉ có bảng đáp án cuối đề', kind: 'text', make: () => textStyle({ optionLines: true, keyTable: true }) },
  { id: 'text-cung-dong', name: 'Văn bản, 4 phương án cùng một dòng + bảng đáp án', kind: 'text', make: () => textStyle({ optionLines: false, keyTable: true }) },
  { id: 'text-ba-nguon', name: 'Văn bản, đủ ba nguồn đáp án (* + dòng + bảng)', kind: 'text', make: () => textStyle({ marks: true, optionLines: true, answerLine: true, keyTable: true }) },
  { id: 'text-nhieu-1', name: 'Văn bản lộn xộn (nhiễu ngẫu nhiên, hạt 1)', kind: 'text', make: () => noisyText('nhieu-1') },
  { id: 'text-nhieu-2', name: 'Văn bản lộn xộn (nhiễu ngẫu nhiên, hạt 2)', kind: 'text', make: () => noisyText('nhieu-2') },
  { id: 'text-nhieu-3', name: 'Văn bản lộn xộn (nhiễu ngẫu nhiên, hạt 3)', kind: 'text', make: () => noisyText('nhieu-3') },
  { id: 'word-mau-do', name: 'Word, đáp án tô màu đỏ (công thức Equation)', kind: 'docx', math: true, make: () => wordDoc({ redMarks: true }) },
  { id: 'word-bang-dap-an', name: 'Word, bảng đáp án cuối đề (công thức Equation)', kind: 'docx', math: true, make: () => wordDoc({ keyTable: true }) },
  { id: 'csv', name: 'CSV/Excel theo mẫu', kind: 'csv', make: () => csvDoc(), hasTopic: true },
];

// ---------------- so sánh ----------------
const ws = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
function roundtrip(latex) {
  const o = child(parseXml(latexToOmml(latex)), 'm:oMath');
  return ws(ommlToLatex(o));
}
// So sánh "cùng nội dung": khoảng trắng trong công thức và \\, \\; không phải khác biệt thật.
const canon = (s, viaOmml) =>
  ws(s)
    .replace(/\$([^$]+)\$/g, (m, f) => `$${(viaOmml ? roundtrip(f) : f).replace(/\\[,;!]/g, '').replace(/\s+/g, '')}$`)
    .replace(/\$ ([.,;:!?)])/g, '$$$1');
const sameOpts = (a, b, viaOmml) => a.length === b.length && a.every((x, i) => canon(x, viaOmml) === canon(b[i], viaOmml));
function sameAnswer(type, g, a) {
  if (a === null || a === undefined) return null;
  if (type === 'tf') return Array.isArray(a) && a.length === 4 && g.every((x, i) => x === a[i]);
  if (type === 'short') {
    const [x, y] = [parseNumber(g), parseNumber(a)];
    return Number.isNaN(x) || Number.isNaN(y) ? ws(g) === ws(a) : Math.abs(x - y) < 1e-9;
  }
  return g === a;
}

async function importFormat(f) {
  const data = await f.make();
  if (f.kind === 'text') return importText(data);
  return importFile(`bench.${f.kind}`, data, null);
}

/** So kết quả nhập với bản chuẩn: trả số liệu từng kiểu trình bày. */
export function score(f, res, expected = gold) {
  const viaOmml = !!f.math;
  const m = { id: f.id, name: f.name, n: expected.length, found: res.questions.length, typeOk: 0, stemOk: 0, optsOk: 0, answerRight: 0, answerMissing: 0, answerConflict: 0, answerWrong: 0, answerWrongMulti: 0, errors: 0, flagged: 0, silent: 0, topicN: 0, topicOk: 0, topicConfidentWrong: 0, topicNone: 0, silentList: [], wrongList: [] };
  expected.forEach((g, i) => {
    const q = res.questions[i];
    if (!q) {
      m.errors++;
      m.flagged++; // câu bị mất: số câu tìm thấy khác bản chuẩn, đã thể hiện ở found/n
      return;
    }
    const typeOk = q.type === g.type;
    const stemOk = canon(q.stem, viaOmml) === canon(g.stem, viaOmml);
    const optsOk = g.type === 'short' || sameOpts(q.options ?? [], g.options, viaOmml);
    const ans = sameAnswer(g.type, g.answer, q.answer);
    typeOk && m.typeOk++;
    stemOk && m.stemOk++;
    optsOk && m.optsOk++;
    if (ans === true) m.answerRight++;
    else if (ans === null) q.answerConflict ? m.answerConflict++ : m.answerMissing++;
    else {
      m.answerWrong++;
      if ((q.answerSources?.length ?? 0) >= 2) m.answerWrongMulti++;
      m.wrongList.push(`${f.id} #${i + 1}`);
    }
    const bad = !typeOk || !stemOk || !optsOk || ans === false || ans === null;
    if (bad) {
      m.errors++;
      if (q.suspicion?.level !== 'low') m.flagged++;
      else if (ans !== null) {
        m.silent++;
        m.silentList.push(`${f.id} #${i + 1}: ${!stemOk ? 'đề ' : ''}${!optsOk ? 'phương án ' : ''}${ans === false ? 'đáp án' : ''}`.trim());
      }
    }
    if (!f.hasTopic) {
      m.topicN++;
      if (q.topic == null) m.topicNone++;
      else if (q.topic === g.topic) m.topicOk++;
      else if ((q.tagConfidence ?? 0) >= 0.7) m.topicConfidentWrong++;
    }
  });
  return m;
}

export async function runBenchmark({ withReal = true } = {}) {
  const results = [];
  for (const f of FORMATS) results.push(score(f, await importFormat(f)));
  if (withReal) {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'real');
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir).filter((x) => /\.(docx|pdf|xlsx|csv|txt)$/i.test(x))) {
        const exp = path.join(dir, file.replace(/\.[^.]+$/, '.expected.json'));
        if (!fs.existsSync(exp)) continue;
        const expected = JSON.parse(fs.readFileSync(exp, 'utf8'));
        const res = await importFile(file, fs.readFileSync(path.join(dir, file)), null);
        results.push(score({ id: `thật:${file}`, name: `Đề thật: ${file}`, math: /\.docx$/i.test(file), hasTopic: false }, res, expected));
      }
    }
  }
  return results;
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—');

export function report(results) {
  const lines = ['| Kiểu trình bày | Câu | Tìm thấy | Loại đúng | Đề đúng | Phương án đúng | Đáp án đúng | Đáp án thiếu | Mâu thuẫn (để trống) | **Đáp án sai** | Câu có lỗi | Được cảnh báo | **Lỗi âm thầm** |', '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|'];
  const sum = (k) => results.reduce((s, r) => s + r[k], 0);
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.n} | ${r.found} | ${pct(r.typeOk, r.n)} | ${pct(r.stemOk, r.n)} | ${pct(r.optsOk, r.n)} | ${pct(r.answerRight, r.n)} | ${r.answerMissing} | ${r.answerConflict} | **${r.answerWrong}** | ${r.errors} | ${r.flagged} | **${r.silent}** |`);
  }
  const N = sum('n');
  lines.push(`| **Tổng** | ${N} | ${sum('found')} | ${pct(sum('typeOk'), N)} | ${pct(sum('stemOk'), N)} | ${pct(sum('optsOk'), N)} | ${pct(sum('answerRight'), N)} | ${sum('answerMissing')} | ${sum('answerConflict')} | **${sum('answerWrong')}** | ${sum('errors')} | ${sum('flagged')} | **${sum('silent')}** |`);
  const tn = sum('topicN');
  lines.push('', `Chuyên đề (các kiểu không có cột chuyên đề, ${tn} câu): đoán đúng ${pct(sum('topicOk'), tn)}, không đoán được ${pct(sum('topicNone'), tn)}, **tin cậy ≥ 0,7 mà sai ${sum('topicConfidentWrong')} câu (${pct(sum('topicConfidentWrong'), tn)})**.`);
  return lines.join('\n');
}

/** Đo bộ đoán chuyên đề trên bộ câu để dành (không dùng để chỉnh bộ phân loại). */
export function heldoutScore() {
  const m = { n: HELDOUT.length, ok: 0, none: 0, confidentWrong: 0, wrong: [] };
  HELDOUT.forEach((q, i) => {
    const c = classifyQuestion(q);
    if (c.topic === q.topic) m.ok++;
    else {
      if (c.topic == null) m.none++;
      else if (c.confidence >= 0.7) m.confidentWrong++;
      m.wrong.push(`#${i + 1} ${q.topic} → ${c.topic ?? 'không đoán được'} (${c.confidence})`);
    }
  });
  return m;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = await runBenchmark();
  console.log(report(results));
  const h = heldoutScore();
  console.log(`Bộ để dành (${h.n} câu): đoán đúng ${pct(h.ok, h.n)}, không đoán được ${h.none}, tin cậy ≥ 0,7 mà sai ${h.confidentWrong}. Sai: ${h.wrong.join('; ')}`);
  for (const r of results) {
    if (r.silentList.length) console.log(`Lỗi âm thầm [${r.id}]: ${r.silentList.join('; ')}`);
    if (r.wrongList.length) console.log(`Đáp án sai [${r.id}]: ${r.wrongList.join('; ')}`);
  }
}
