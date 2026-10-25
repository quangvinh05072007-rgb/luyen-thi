// Nhập câu hỏi từ Excel (.xlsx) hoặc CSV theo mẫu cột:
// Loại | Nội dung | A | B | C | D | Đáp án | Chủ đề | Mức độ | Lời giải
// Loại: TN (trắc nghiệm), DS (đúng/sai: A–D là 4 ý, đáp án "ĐSĐS"), TLN (trả lời ngắn).
import JSZip from 'jszip';
import { assertSafeZip } from './docx.mjs';
import { parseXml, child, children, findAll, textOf } from './xml.mjs';
import { TOPICS } from './topics.mjs';

export const SHEET_HEADERS = ['Loại', 'Nội dung', 'A', 'B', 'C', 'D', 'Đáp án', 'Chủ đề', 'Mức độ', 'Lời giải'];

export const CSV_TEMPLATE =
  '﻿' +
  [
    SHEET_HEADERS.join(','),
    'TN,"Đạo hàm của hàm số $y=x^3$ là",$3x^2$,$x^2$,$3x$,$x^3$,A,T11.DAOHAM,1,"$(x^n)\'=nx^{n-1}$"',
    'DS,"Cho hàm số $y=x^2-4x+3$.",Hàm số có đỉnh $I(2;-1)$,Hàm số đồng biến trên $(-\\infty;2)$,Đồ thị cắt trục tung tại $(0;3)$,Phương trình $y=0$ có hai nghiệm phân biệt,ĐSĐĐ,T10.HAMBAC2,2,',
    'TLN,"Tính $\\int_0^1 2x\\,dx$.",,,,,1,T12.NGUYENHAM,1,"$\\int_0^1 2x\\,dx = x^2\\big|_0^1 = 1$"',
  ].join('\r\n');

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  // Dấu phân cách lấy theo dòng tiêu đề (dấu ; còn dùng trong tọa độ nên không đoán theo từng ô).
  const head = s.split(/\r?\n/)[0];
  const delim = [',', ';', '\t'].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Đọc trang tính đầu tiên của .xlsx → mảng hàng. */
export async function readXlsx(data) {
  const zip = await JSZip.loadAsync(data);
  assertSafeZip(zip);
  const shared = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) {
    const root = parseXml(await ss.async('string'));
    for (const si of findAll(root, 'si')) shared.push(findAll(si, 't').map(textOf).join(''));
  }
  const sheetFile = zip.file('xl/worksheets/sheet1.xml') ?? zip.file(/xl\/worksheets\/sheet\d+\.xml/)[0];
  if (!sheetFile) throw new Error('Không thấy trang tính trong file Excel.');
  const root = parseXml(await sheetFile.async('string'));
  const rows = [];
  for (const r of findAll(root, 'row')) {
    const row = [];
    for (const c of children(r, 'c')) {
      const idx = colIndex(c.attrs.r ?? 'A1');
      const t = c.attrs.t;
      let v = '';
      if (t === 's') v = shared[Number(textOf(child(c, 'v')))] ?? '';
      else if (t === 'inlineStr') v = findAll(c, 't').map(textOf).join('');
      else v = textOf(child(c, 'v'));
      row[idx] = v;
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const TYPE_ALIASES = { tn: 'mcq', 'trắc nghiệm': 'mcq', mcq: 'mcq', ds: 'tf', 'đs': 'tf', 'đúng/sai': 'tf', 'đúng sai': 'tf', tf: 'tf', tln: 'short', 'trả lời ngắn': 'short', short: 'short' };

function findTopic(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const byCode = TOPICS.find((t) => t.code.toLowerCase() === s.toLowerCase());
  if (byCode) return byCode.code;
  const byName = TOPICS.find((t) => t.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(t.name.toLowerCase()));
  return byName?.code ?? null;
}

/** Hàng → câu hỏi nháp. Trả về { questions, warnings } (cùng dạng với parseExamText). */
export function rowsToQuestions(rows) {
  const warnings = [];
  if (!rows.length) return { questions: [], warnings: ['File trống.'] };
  let start = 0;
  const head = rows[0].map((h) => String(h).trim().toLowerCase());
  const col = Object.fromEntries(SHEET_HEADERS.map((h, i) => [h, head.indexOf(h.toLowerCase()) >= 0 ? head.indexOf(h.toLowerCase()) : i]));
  if (head.includes('nội dung') || head.includes('loại')) start = 1;
  const questions = [];
  rows.slice(start).forEach((r, k) => {
    const get = (h) => String(r[col[h]] ?? '').trim();
    const lineNo = k + start + 1;
    const type = TYPE_ALIASES[get('Loại').toLowerCase()] ?? (get('A') ? 'mcq' : 'short');
    const q = { num: lineNo, part: null, type, stem: get('Nội dung'), options: [], answer: null, explanation: get('Lời giải'), warnings: [] };
    const ans = get('Đáp án');
    if (type === 'mcq' || type === 'tf') q.options = ['A', 'B', 'C', 'D'].map(get);
    if (type === 'mcq') {
      const i = 'ABCD'.indexOf(ans.toUpperCase());
      if (i >= 0) q.answer = i;
    } else if (type === 'tf') {
      const v = ans.toUpperCase().replace(/[^ĐSTF]/g, '');
      if (v.length === 4) q.answer = [...v].map((c) => c === 'Đ' || c === 'T');
    } else if (ans) q.answer = ans;
    const topic = findTopic(get('Chủ đề'));
    if (topic) q.topic = topic;
    const lv = Number(get('Mức độ'));
    if ([1, 2, 3].includes(lv)) q.level = lv;
    if (!q.stem) q.warnings.push(`Dòng ${lineNo}: thiếu nội dung.`);
    if (q.answer === null) q.warnings.push(`Dòng ${lineNo}: thiếu hoặc sai đáp án.`);
    questions.push(q);
  });
  return { questions, warnings };
}
