// Nhập đề từ file: Word, PDF (có lớp chữ), Excel/CSV, văn bản; ảnh cần AI.
import { readDocx } from '../shared/docx.mjs';
import { parseExamText } from '../shared/parse.mjs';
import { readXlsx, parseCsv, rowsToQuestions } from '../shared/sheet.mjs';
import { classifyQuestion } from '../shared/classify.mjs';

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
      rows.get(y).push({ x: it.transform[4], s: it.str });
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => lines.push(items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()));
  }
  return { text: lines.join('\n'), pages: doc.numPages };
}

/** Gắn chuyên đề/mức độ cho câu chưa có, giữ lại độ tin cậy để giáo viên xem. */
export function tagDrafts(questions) {
  return questions.map((q) => {
    const c = classifyQuestion(q);
    return {
      ...q,
      topic: q.topic ?? c.topic,
      level: q.level ?? c.level,
      tagConfidence: q.topic ? 1 : c.confidence,
      topicAlternatives: c.alternatives,
    };
  });
}

/**
 * Nhập một file. ai: đối tượng AI (có thể null). Trả về { questions, warnings, info }.
 */
export async function importFile(name, buf, ai) {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  const info = { file: name, kind: ext };
  let parsed;
  if (ext === 'docx') {
    const { text, stats } = await readDocx(buf);
    Object.assign(info, stats);
    parsed = parseExamText(text);
    if (stats.images) parsed.warnings.push(`File có ${stats.images} hình — bản này chưa nhập hình, câu có hình được đánh dấu [hình] để giáo viên bổ sung.`);
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
  return { questions: tagDrafts(parsed.questions), warnings: parsed.warnings, info };
}

export function importText(text) {
  const parsed = parseExamText(text);
  return { questions: tagDrafts(parsed.questions), warnings: parsed.warnings, info: { kind: 'text' } };
}
