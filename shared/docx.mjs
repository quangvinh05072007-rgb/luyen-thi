// Đọc và ghi file Word (.docx). Công thức đọc từ Equation (OMML) thành $LaTeX$; khi ghi, $LaTeX$ thành Equation thật.
import JSZip from 'jszip';
import { parseXml, child, children, textOf, escapeXml, findAll } from './xml.mjs';
import { ommlToLatex, latexToOmml, drainUnknownOmml } from './omml.mjs';
import { OK_MARK } from './parse.mjs';

function isMarkedRun(r) {
  const pr = child(r, 'w:rPr');
  if (!pr) return false;
  const u = child(pr, 'w:u');
  if (u && u.attrs['w:val'] !== 'none') return true;
  if (child(pr, 'w:highlight') && child(pr, 'w:highlight').attrs['w:val'] !== 'none') return true;
  const shd = child(pr, 'w:shd');
  if (shd && shd.attrs['w:fill'] && !/^(auto|FFFFFF)$/i.test(shd.attrs['w:fill'])) return true;
  const c = child(pr, 'w:color')?.attrs['w:val'];
  if (c && /^[0-9a-f]{6}$/i.test(c)) {
    const [r1, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
    if (r1 > 0xb0 && g < 0x60 && b < 0x60) return true;
  }
  return false;
}

/** Hình trong run → dấu [[img:khóa]]; công thức MathType (OLE) và hình không đọc được → dấu báo. */
function drawingToken(node, stats) {
  const inner = node.name === 'mc:AlternateContent' ? (child(node, 'mc:Choice') ?? node) : node;
  if (JSON.stringify(inner).includes('Equation.DSMT') || JSON.stringify(inner).includes('"Equation')) {
    stats.oleEquations++;
    return ' [công thức MathType chưa đọc được] ';
  }
  stats.images++;
  const blip = findAll(inner, 'a:blip')[0];
  const rid = blip?.attrs['r:embed'] ?? findAll(inner, 'v:imagedata')[0]?.attrs['r:id'];
  if (!rid) {
    stats.unreadableImages++;
    return ' [hình] ';
  }
  const ext = findAll(inner, 'wp:extent')[0];
  const key = `img${stats.imageRefs.length + 1}`;
  const prev = stats.imageRefs.find((r) => r.rid === rid);
  if (prev) return ` [[img:${prev.key}]] `;
  stats.imageRefs.push({ key, rid, cx: Number(ext?.attrs.cx) || 0, cy: Number(ext?.attrs.cy) || 0 });
  return ` [[img:${key}]] `;
}

const OPTION_CELL_RE = /^\*?(?:\[\[OK\]\])?\s*[A-D]\s*[.)]/;
const KEY_CELL_RE = /^(?:Câu|Đáp|ĐA)\b/iu;

function paragraphText(p, stats) {
  let out = '';
  let prevMarked = false;
  const walk = (node) => {
    for (const c of node.children ?? []) {
      if (c.name === 'w:r') {
        const marked = isMarkedRun(c);
        let t = '';
        for (const rc of c.children) {
          if (rc.name === 'w:t') t += textOf(rc);
          else if (rc.name === 'w:tab') t += ' ';
          else if (rc.name === 'w:br' || rc.name === 'w:cr') t += '\n';
          else if (['w:drawing', 'w:pict', 'w:object', 'mc:AlternateContent'].includes(rc.name)) t += drawingToken(rc, stats);
        }
        if (marked && t.trim() && !prevMarked) out += OK_MARK;
        if (t.trim()) prevMarked = marked;
        out += t;
      } else if (c.name === 'm:oMath') {
        out += ` $${ommlToLatex(c).replace(/\s+/g, ' ').trim()}$ `;
        stats.equations++;
      } else if (c.name === 'm:oMathPara') {
        for (const m of children(c, 'm:oMath')) {
          out += ` $${ommlToLatex(m).replace(/\s+/g, ' ').trim()}$ `;
          stats.equations++;
        }
      } else if (['w:hyperlink', 'w:ins', 'w:smartTag', 'w:sdt', 'w:sdtContent', 'w:fldSimple'].includes(c.name)) {
        walk(c);
      }
    }
  };
  walk(p);
  out = out.replace(/[ \t]+/g, ' ').replace(/\$\s+\$/g, '');
  // Công thức chèn dấu cách hai bên; bỏ dấu cách thừa trước dấu câu/sau ngoặc mở để câu đọc tự nhiên.
  return out.replace(/\$ ([.,;:!?)/\]])/g, '$$$1').replace(/([([\[]) \$/g, '$1$$').trim();
}

function blockText(node, stats, lines) {
  for (const c of node.children ?? []) {
    if (c.name === 'w:p') lines.push(paragraphText(c, stats));
    else if (c.name === 'w:tbl') {
      for (const tr of children(c, 'w:tr')) {
        const cells = children(tr, 'w:tc').map((tc) => {
          const inner = [];
          blockText(tc, stats, inner);
          return inner.filter(Boolean).join(' ');
        });
        // Bảng 1 cột (hay dùng để đóng khung đề) → giữ từng dòng; nhiều cột → nối bằng " | ".
        if (cells.length === 1) {
          const inner = [];
          blockText(children(tr, 'w:tc')[0], stats, inner);
          lines.push(...inner);
        } else if (KEY_CELL_RE.test(cells[0]) || cells.every((c) => OPTION_CELL_RE.test(c))) {
          lines.push(cells.join(' | ')); // bảng đáp án / phương án xếp theo cột: giữ cách đọc cũ
        } else lines.push(`| ${cells.join(' | ')} |`); // bảng dữ liệu (bảng biến thiên, bảng tần số…)
      }
    } else if (c.name === 'w:sdt' || c.name === 'w:sdtContent' || c.name === 'w:customXml') blockText(c, stats, lines);
  }
}

/** Chặn file nén "bom": tổng dung lượng sau giải nén quá lớn sẽ làm hết bộ nhớ máy chủ. */
export function assertSafeZip(zip, maxBytes = 150e6) {
  let total = 0;
  for (const f of Object.values(zip.files)) total += f._data?.uncompressedSize ?? 0;
  if (total > maxBytes) throw Object.assign(new Error('File nén quá lớn sau khi giải nén — có thể là file hỏng hoặc không an toàn.'), { status: 400 });
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_FILE = 60;

/** Nhận dạng định dạng hình theo nội dung (không tin đuôi file). Chỉ nhận loại trình duyệt hiển thị an toàn. */
export function sniffImage(b) {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

async function readRels(zip) {
  const f = zip.file('word/_rels/document.xml.rels');
  const map = {};
  if (!f) return map;
  for (const r of findAll(parseXml(await f.async('string')), 'Relationship')) map[r.attrs.Id] = r.attrs.Target;
  return map;
}

/**
 * Đọc .docx → { text, stats: { equations, images, oleEquations, ... }, images: [{key, mime, data, cx, cy}] }
 * Hình được thay bằng dấu [[img:khóa]] trong văn bản; hình không dùng được (EMF/WMF, quá lớn, biểu đồ Word) thành [hình].
 */
export async function readDocx(data) {
  const zip = await JSZip.loadAsync(data);
  assertSafeZip(zip);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('File không phải Word .docx hợp lệ (thiếu word/document.xml).');
  const xml = await file.async('string');
  const root = parseXml(xml);
  const body = child(child(root, 'w:document'), 'w:body');
  const stats = { equations: 0, images: 0, oleEquations: 0, unreadableImages: 0, skippedImages: 0, imageRefs: [] };
  const lines = [];
  drainUnknownOmml();
  blockText(body, stats, lines);
  stats.unknownMath = drainUnknownOmml();
  let text = lines.join('\n');
  const rels = await readRels(zip);
  const images = [];
  for (const ref of stats.imageRefs) {
    const target = rels[ref.rid];
    let bytes = null;
    if (target && images.length < MAX_IMAGES_PER_FILE) {
      const path = target.startsWith('/') ? target.slice(1) : `word/${target}`.replace(/word\/\.\.\//, '');
      const f = zip.file(path);
      if (f) bytes = await f.async('uint8array');
    }
    const mime = bytes && bytes.length <= MAX_IMAGE_BYTES ? sniffImage(bytes) : null;
    if (!mime) {
      stats.skippedImages++;
      text = text.split(`[[img:${ref.key}]]`).join('[hình]');
      continue;
    }
    images.push({ key: ref.key, mime, data: bytes, cx: ref.cx || 3000000, cy: ref.cy || 2000000 });
  }
  const { imageRefs, ...clean } = stats;
  return { text: text.replace(/[ \t]+\n/g, '\n'), stats: { ...clean, importedImages: images.length }, images };
}

// ---------------- Ghi .docx ----------------

/** Tách chuỗi có $…$ thành đoạn chữ và đoạn công thức. */
export function splitMath(s) {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ math: (m[1] ?? m[2]).trim(), display: !!m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

function wRun(text, { bold, italic, size, color } = {}) {
  if (!text) return '';
  const pr = [bold ? '<w:b/>' : '', italic ? '<w:i/>' : '', color ? `<w:color w:val="${color}"/>` : '', size ? `<w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/>` : ''].join('');
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Một đoạn văn: text có thể chứa $LaTeX$ và "\n" (xuống dòng mềm).
 * opts: { bold, italic, size, align: 'center'|'left'|'both', spaceAfter, indent, color, prefix: [{text,bold}] }
 */
export function paragraph(text, opts = {}) {
  const ppr = `<w:pPr>${opts.keepNext ? '<w:keepNext/>' : ''}<w:spacing w:after="${opts.spaceAfter ?? 80}" w:line="300" w:lineRule="auto"/>${opts.indent ? `<w:ind w:left="${opts.indent}"/>` : ''}${opts.align ? `<w:jc w:val="${opts.align}"/>` : ''}</w:pPr>`;
  let runs = '';
  for (const p of opts.prefix ?? []) runs += wRun(p.text, { ...opts, ...p });
  const lines = String(text ?? '').split('\n');
  lines.forEach((line, li) => {
    if (li > 0) runs += '<w:r><w:br/></w:r>';
    for (const part of line.split(/(\[\[img:\d+\]\])/)) {
      const im = part.match(IMG_TOKEN);
      if (im) {
        runs += opts.images?.drawing(Number(im[1])) ?? wRun('[hình]', opts);
        continue;
      }
      for (const seg of splitMath(part)) {
        if (seg.math !== undefined) runs += latexToOmml(seg.math);
        else runs += wRun(seg.text, opts);
      }
    }
  });
  return `<w:p>${ppr}${runs}</w:p>`;
}

/** Bảng đơn giản: rows = [[ô, ô, …]], ô là chuỗi (có thể có $LaTeX$). */
export function table(rows, { header = true } = {}) {
  const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('') + '</w:tblBorders>';
  const tr = rows
    .map((r, ri) => `<w:tr>${r.map((c) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraph(String(c), { bold: header && ri === 0, align: 'center', spaceAfter: 0 })}</w:tc>`).join('')}</w:tr>`)
    .join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/>${border}</w:tblPr>${tr}</w:tbl>`;
}

/** Kho hình cho một file Word đang ghi: resolve(id) → { data, mime, cx, cy } hoặc null. */
export class DocxImages {
  constructor(resolve) {
    this.resolve = resolve;
    this.items = [];
    this.byId = new Map();
  }

  /** Mã XML của hình có mã id (rỗng nếu không còn hình). */
  drawing(id) {
    let it = this.byId.get(id);
    if (!it) {
      const im = this.resolve(id);
      if (!im) return null;
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/webp': 'webp' }[im.mime];
      if (!ext) return null;
      it = { n: this.items.length + 1, ext, ...im };
      this.items.push(it);
      this.byId.set(id, it);
    }
    const MAX = 4500000; // ≈ 12,5 cm
    const scale = it.cx > MAX ? MAX / it.cx : 1;
    const cx = Math.round(it.cx * scale);
    const cy = Math.round(it.cy * scale);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${it.n}" name="Hình ${it.n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${it.n}" name="hinh${it.n}.${it.ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${it.n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
}

const IMG_TOKEN = /\[\[img:(\d+)\]\]/;
const PIPE_ROW = /^\|.*\|\s*$/;

/**
 * Văn bản giàu nội dung → các khối Word: đoạn chữ ($LaTeX$, [[img:N]]) và bảng (các dòng "| a | b |" liên tiếp).
 * opts như paragraph(); prefix chỉ gắn vào đoạn chữ đầu tiên.
 */
export function richBlocks(text, opts = {}) {
  const lines = String(text ?? '').split('\n');
  const groups = [];
  for (const line of lines) {
    const isRow = PIPE_ROW.test(line.trim());
    const last = groups[groups.length - 1];
    if (last && last.table === isRow) last.lines.push(line);
    else groups.push({ table: isRow, lines: [line] });
  }
  const out = [];
  let first = true;
  for (const g of groups) {
    if (g.table) {
      const rows = g.lines.map((l) => l.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').split(/\s*\|\s*/));
      if (first && opts.prefix) out.push(paragraph('', { ...opts, keepNext: true }));
      out.push(table(rows, { header: false }));
      out.push(paragraph('', { spaceAfter: 40 }));
    } else {
      out.push(paragraph(g.lines.join('\n'), first ? opts : { ...opts, prefix: undefined }));
    }
    first = false;
  }
  return out;
}

export function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

const NS = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Ghép các khối XML (paragraph/table/pageBreak) thành file .docx. type: 'nodebuffer' | 'blob' | 'uint8array' */
export async function buildDocx(blocks, type = 'nodebuffer', images = null) {
  const zip = new JSZip();
  const items = images?.items ?? [];
  const imageTypes = [...new Set(items.map((i) => i.ext))].map((e) => `<Default Extension="${e}" ContentType="image/${e}"/>`).join('');
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageTypes}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
  );
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const imageRels = items.map((i) => `<Relationship Id="rIdImg${i.n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/hinh${i.n}.${i.ext}"/>`).join('');
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${imageRels}</Relationships>`);
  for (const i of items) zip.file(`word/media/hinh${i.n}.${i.ext}`, i.data);
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${blocks.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({ type, compression: 'DEFLATE' });
}
