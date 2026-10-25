// Ghi file Excel (.xlsx) thật, không cần thư viện nặng: chữ tiếng Việt (UTF-8), số là số, hàng tiêu đề in đậm và cố định.
import JSZip from 'jszip';
import { escapeXml } from './xml.mjs';

function colName(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Chuỗi bắt đầu bằng = + - @ có thể bị Excel hiểu là công thức khi mở: thêm dấu ' phía trước chuỗi chữ (không đụng tới số).
const safeText = (v) => (/^[=+\-@]/.test(v) && !/^[+-]?\d+([.,]\d+)?$/.test(v) ? `'${v}` : v);

function sheetXml(sheet) {
  const widths = (sheet.columns ?? []).map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join('');
  const rows = [];
  const all = sheet.columns ? [sheet.columns.map((c) => c.header), ...sheet.rows] : sheet.rows;
  all.forEach((row, r) => {
    const cells = row
      .map((v, c) => {
        const ref = `${colName(c)}${r + 1}`;
        const style = sheet.columns && r === 0 ? ' s="1"' : '';
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
        if (typeof v === 'boolean') return `<c r="${ref}"${style} t="b"><v>${v ? 1 : 0}</v></c>`;
        return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(safeText(String(v)))}</t></is></c>`;
      })
      .join('');
    rows.push(`<row r="${r + 1}">${cells}</row>`);
  });
  const pane = sheet.columns ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${widths ? `<cols>${widths}</cols>` : ''}<sheetData>${rows.join('')}</sheetData></worksheet>`;
}

/** sheets: [{ name, columns?: [{header, width}], rows: [[ô, ô…]] }] → Buffer .xlsx */
export async function buildXlsx(sheets) {
  const zip = new JSZip();
  const names = sheets.map((s, i) => (String(s.name ?? `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Sheet${i + 1}`));
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  );
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>');
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
