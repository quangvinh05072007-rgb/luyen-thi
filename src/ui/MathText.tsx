// Hiển thị văn bản có công thức $…$ / $$…$$ bằng KaTeX.
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { memo, useMemo } from 'react';

const cache = new Map<string, string>();

function renderMath(src: string, display: boolean) {
  const key = (display ? 'D' : 'I') + src;
  const hit = cache.get(key);
  if (hit) return hit;
  let html: string;
  try {
    html = katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html' });
  } catch {
    html = `<code>${src.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)}</code>`;
  }
  if (cache.size > 3000) cache.clear();
  cache.set(key, html);
  return html;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string).replace(/\n/g, '<br/>');
}

const IMG_STYLE = 'max-width:100%;height:auto;vertical-align:middle;margin:2px 0';

function inlineHtml(s: string) {
  let out = '';
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\[\[img:(\d+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out += escapeHtml(s.slice(last, m.index));
    if (m[3] !== undefined) out += `<img src="/api/images/${m[3]}" alt="Hình minh họa" style="${IMG_STYLE}" />`;
    else out += renderMath((m[1] ?? m[2]).trim(), !!m[1]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(s.slice(last));
}

const PIPE_ROW = /^\|.*\|\s*$/;

/** Văn bản có công thức, hình [[img:N]] và bảng (dòng "| a | b |") → HTML. */
export function mathToHtml(text: string) {
  const lines = String(text ?? '').split('\n');
  let out = '';
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) out += inlineHtml(buf.join('\n'));
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    if (PIPE_ROW.test(lines[i].trim())) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && PIPE_ROW.test(lines[i].trim())) {
        rows.push(lines[i].trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').split(/\s*\|\s*/));
        i++;
      }
      i--;
      out += '<table style="border-collapse:collapse;margin:6px 0">' + rows.map((r) => '<tr>' + r.map((c) => `<td style="border:1px solid #999;padding:3px 10px;text-align:center">${inlineHtml(c)}</td>`).join('') + '</tr>').join('') + '</table>';
    } else buf.push(lines[i]);
  }
  flush();
  return out;
}

export const MathText = memo(function MathText({ text, className, as = 'span' }: { text: string; className?: string; as?: 'span' | 'div' }) {
  const html = useMemo(() => mathToHtml(text), [text]);
  const Tag = as as any;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
