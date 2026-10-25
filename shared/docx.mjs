// Đọc và ghi file Word (.docx). Công thức đọc từ Equation (OMML) thành $LaTeX$; khi ghi, $LaTeX$ thành Equation thật.
import JSZip from 'jszip';
import { parseXml, child, children, textOf, escapeXml } from './xml.mjs';
import { ommlToLatex, latexToOmml } from './omml.mjs';
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
          else if (rc.name === 'w:drawing' || rc.name === 'w:pict' || rc.name === 'w:object') {
            const ole = JSON.stringify(rc).includes('Equation');
            if (ole) stats.oleEquations++;
            else stats.images++;
            t += ole ? ' [công thức MathType chưa đọc được] ' : ' [hình] ';
          }
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
  return out.replace(/[ \t]+/g, ' ').replace(/\$\s+\$/g, '').trim();
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
        } else lines.push(cells.join(' | '));
      }
    } else if (c.name === 'w:sdt' || c.name === 'w:sdtContent' || c.name === 'w:customXml') blockText(c, stats, lines);
  }
}

/** Đọc .docx → { text, stats: { equations, images, oleEquations } } */
/** Chặn file nén "bom": tổng dung lượng sau giải nén quá lớn sẽ làm hết bộ nhớ máy chủ. */
export function assertSafeZip(zip, maxBytes = 150e6) {
  let total = 0;
  for (const f of Object.values(zip.files)) total += f._data?.uncompressedSize ?? 0;
  if (total > maxBytes) throw Object.assign(new Error('File nén quá lớn sau khi giải nén — có thể là file hỏng hoặc không an toàn.'), { status: 400 });
}

export async function readDocx(data) {
  const zip = await JSZip.loadAsync(data);
  assertSafeZip(zip);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('File không phải Word .docx hợp lệ (thiếu word/document.xml).');
  const xml = await file.async('string');
  const root = parseXml(xml);
  const body = child(child(root, 'w:document'), 'w:body');
  const stats = { equations: 0, images: 0, oleEquations: 0 };
  const lines = [];
  blockText(body, stats, lines);
  return { text: lines.join('\n'), stats };
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
    for (const seg of splitMath(line)) {
      if (seg.math !== undefined) runs += latexToOmml(seg.math);
      else runs += wRun(seg.text, opts);
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

export function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Ghép các khối XML (paragraph/table/pageBreak) thành file .docx. type: 'nodebuffer' | 'blob' | 'uint8array' */
export async function buildDocx(blocks, type = 'nodebuffer') {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  );
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
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
