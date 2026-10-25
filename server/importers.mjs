// Nhập đề từ file: Word, PDF (có lớp chữ), Excel/CSV, văn bản; ảnh cần AI.
import { readDocx } from '../shared/docx.mjs';
import { parseExamText, parseAnswerFileText } from '../shared/parse.mjs';
import { assessQuestion } from '../shared/review.mjs';
import { readXlsx, parseCsv, rowsToQuestions } from '../shared/sheet.mjs';
import { classifyQuestion } from '../shared/classify.mjs';

/** Nối các mảnh chữ trên một dòng: chỉ chèn dấu cách khi khoảng hở đủ lớn (PDF từ Word tách từng dấu tiếng Việt thành mảnh riêng). */
function joinRow(items) {
  let out = '';
  let prevEnd = null;
  for (const it of items) {
    if (prevEnd !== null && it.x - prevEnd > 0.18 * it.h && !/^\s/.test(it.s) && !/\s$/.test(out)) out += ' ';
    out += it.s;
    prevEnd = it.x + it.w;
  }
  return out.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export async function pdfToText(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map();
    for (const it of content.items) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], w: it.width ?? 0, h: Math.abs(it.transform[3]) || 10, s: it.str });
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => lines.push(joinRow(items.sort((a, b) => a.x - b.x))));
  }
  return { text: lines.join('\n'), pages: doc.numPages };
}

/** Gắn chuyên đề/mức độ cho câu chưa có, giữ lại độ tin cậy để giáo viên xem. */
export function tagDrafts(questions, kind = null) {
  return questions.map((q) => {
    const c = classifyQuestion(q);
    const tagged = {
      ...q,
      topic: q.topic ?? c.topic,
      level: q.level ?? c.level,
      tagConfidence: q.topic ? 1 : c.confidence,
      topicAlternatives: c.alternatives,
    };
    return { ...tagged, suspicion: assessQuestion(tagged, { kind }) };
  });
}

/** Chữ của file đáp án riêng (Word, PDF, Excel/CSV, txt) để đọc bảng đáp án. */
export async function answerFileToText(name, buf) {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  if (ext === 'docx') return (await readDocx(buf)).text;
  if (ext === 'pdf') return (await pdfToText(buf)).text;
  if (ext === 'xlsx') return (await readXlsx(buf)).map((r) => r.join(' | ')).join('\n');
  if (ext === 'csv') return parseCsv(buf.toString('utf8')).map((r) => r.join(' | ')).join('\n');
  if (ext === 'txt' || ext === 'md') return buf.toString('utf8');
  throw Object.assign(new Error(`File đáp án .${ext} chưa hỗ trợ. Dùng .docx, .pdf, .xlsx, .csv hoặc .txt.`), { status: 400 });
}

export function answerEntriesFromText(text) {
  return parseAnswerFileText(text);
}

/**
 * Nhập một file. ai: đối tượng AI (có thể null). Trả về { questions, warnings, info }.
 */
export async function importFile(name, buf, ai) {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  const info = { file: name, kind: ext };
  let parsed;
  if (ext === 'docx') {
    const { text, stats, images: pics } = await readDocx(buf);
    Object.assign(info, stats);
    parsed = parseExamText(text);
    parsed.images = pics;
    if (stats.importedImages) parsed.warnings.push(`Đã nhập ${stats.importedImages} hình vào câu hỏi. Kiểm tra hình nằm đúng câu.`);
    if (stats.skippedImages + stats.unreadableImages) parsed.warnings.push(`${stats.skippedImages + stats.unreadableImages} hình/biểu đồ chưa nhập được (định dạng EMF/WMF, biểu đồ hoặc hình vẽ của Word, hoặc quá lớn) — câu đó được đánh dấu [hình]; hãy chụp hình rồi bổ sung.`);
    if (stats.unknownMath?.length) parsed.warnings.push(`Công thức dùng cấu trúc chưa hỗ trợ (${stats.unknownMath.join(', ')}) — nội dung bên trong vẫn được đọc nhưng hình dạng có thể sai. Kiểm tra các câu có công thức.`);
    if (stats.oleEquations) parsed.warnings.push(`File có ${stats.oleEquations} công thức MathType (OLE) — chưa đọc được. Trong Word, dùng MathType → Convert Equations sang Office Math rồi nhập lại.`);
  } else if (ext === 'doc') {
    throw Object.assign(new Error('File .doc (Word 97–2003) chưa hỗ trợ. Mở bằng Word và lưu thành .docx rồi nhập lại.'), { status: 400 });
  } else if (ext === 'pdf') {
    const { text, pages } = await pdfToText(buf);
    info.pages = pages;
    if (text.replace(/\s/g, '').length < 20) {
      throw Object.assign(new Error('PDF không có lớp chữ (bản scan). Hãy chụp từng trang và nhập dạng ảnh (cần AI), hoặc dùng bản Word.'), { status: 400 });
    }
    parsed = parseExamText(text);
    parsed.warnings.push('PDF thường làm mất cấu trúc công thức. Hãy kiểm tra kỹ từng câu trước khi duyệt.');
  } else if (ext === 'xlsx') {
    parsed = rowsToQuestions(await readXlsx(buf));
  } else if (ext === 'csv') {
    parsed = rowsToQuestions(parseCsv(buf.toString('utf8')));
  } else if (ext === 'txt' || ext === 'md' || ext === 'tex') {
    parsed = parseExamText(buf.toString('utf8'));
  } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    if (!ai?.enabled) {
      throw Object.assign(new Error('Đọc đề từ ảnh cần AI. Thêm khóa ANTHROPIC_API_KEY vào config.local.json rồi khởi động lại, hoặc nhập bằng Word/PDF.'), { status: 503 });
    }
    const text = await ai.imageToText(buf, ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
    parsed = parseExamText(text);
    parsed.questions.forEach((q) => (q.fromAi = true));
    parsed.warnings.push('Chữ trong ảnh do AI đọc. Đối chiếu với ảnh gốc trước khi duyệt.');
    info.ai = true;
  } else {
    throw Object.assign(new Error(`Chưa hỗ trợ file .${ext}. Dùng .docx, .pdf, .xlsx, .csv, .txt hoặc ảnh.`), { status: 400 });
  }
  return { questions: tagDrafts(parsed.questions, ext), warnings: parsed.warnings, info, images: parsed.images ?? [] };
}

export function importText(text) {
  const parsed = parseExamText(text);
  return { questions: tagDrafts(parsed.questions), warnings: parsed.warnings, info: { kind: 'text' } };
}
