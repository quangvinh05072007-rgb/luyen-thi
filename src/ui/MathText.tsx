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

export function mathToHtml(text: string) {
  const s = String(text ?? '');
  let out = '';
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out += escapeHtml(s.slice(last, m.index));
    out += renderMath((m[1] ?? m[2]).trim(), !!m[1]);
    last = m.index + m[0].length;
  }
  out += escapeHtml(s.slice(last));
  return out;
}

export const MathText = memo(function MathText({ text, className, as = 'span' }: { text: string; className?: string; as?: 'span' | 'div' }) {
  const html = useMemo(() => mathToHtml(text), [text]);
  const Tag = as as any;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
