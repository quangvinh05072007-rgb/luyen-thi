// Đổi công thức LaTeX ↔ OMML (Office Math Markup, dạng Equation của Word).
// Hỗ trợ tập con thường gặp trong đề Toán THPT: phân số, căn, mũ, chỉ số, ngoặc, tích phân, tổng,
// giới hạn, vectơ, gạch trên, ma trận, hệ (cases), chữ Hy Lạp, ký hiệu tập hợp và quan hệ.
import { escapeXml, textOf, child, children } from './xml.mjs';

export const SYMBOLS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
  phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '⋅', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠',
  approx: '≈', equiv: '≡', sim: '∼', in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩',
  setminus: '∖', emptyset: '∅', varnothing: '∅', infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', leftrightarrow: '↔', iff: '⇔', implies: '⇒', forall: '∀', exists: '∃',
  perp: '⊥', parallel: '∥', angle: '∠', triangle: '△', circ: '∘', degree: '°', prime: '′', ldots: '…', cdots: '⋯', dots: '…',
  partial: '∂', nabla: '∇', neg: '¬', land: '∧', lor: '∨', mid: '|', vert: '|', lbrace: '{', rbrace: '}',
  langle: '⟨', rangle: '⟩', star: '⋆', ast: '∗', bullet: '•', backslash: '\\',
};

const SYMBOL_BACK = Object.fromEntries(
  Object.entries(SYMBOLS)
    .filter(([k]) => !['leq', 'geq', 'neq', 'varepsilon', 'varnothing', 'iff', 'implies', 'rightarrow', 'vert', 'dots', 'lbrace', 'rbrace', 'mid'].includes(k))
    .map(([k, v]) => [v, k]),
);

const FUNCS = ['sin', 'cos', 'tan', 'cot', 'tg', 'cotg', 'ln', 'log', 'exp', 'max', 'min', 'arcsin', 'arccos', 'arctan', 'sup', 'inf', 'det', 'deg', 'gcd'];
const NARY = { int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: '∑', prod: '∏', bigcup: '⋃', bigcap: '⋂' };
const ACCENTS = { vec: '⃗', overrightarrow: '⃗', hat: '̂', widehat: '̂', tilde: '̃', widetilde: '̃', dot: '̇', ddot: '̈' };
const BB = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };
const SPACES = { ',': ' ', ';': ' ', ':': ' ', '!': '', quad: ' ', qquad: '  ', ' ': ' ' };

// ---------------- LaTeX → cây ----------------
function tokenize(s) {
  const out = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === '\\') {
      if (s[i + 1] === '\\') {
        out.push({ k: 'row' });
        i += 2;
        continue;
      }
      const m = s.slice(i + 1).match(/^[a-zA-Z]+/);
      if (m) {
        out.push({ k: 'cmd', v: m[0] });
        i += 1 + m[0].length;
      } else {
        out.push({ k: 'cmd', v: s[i + 1] ?? '' });
        i += 2;
      }
      continue;
    }
    if (c === '{' || c === '}' || c === '^' || c === '_' || c === '&') out.push({ k: c });
    else if (/\s/.test(c)) out.push({ k: 'sp' });
    else out.push({ k: 'ch', v: c });
    i++;
  }
  return out;
}

class Parser {
  constructor(src) {
    this.t = tokenize(src);
    this.i = 0;
  }
  peek() {
    return this.t[this.i];
  }
  next() {
    return this.t[this.i++];
  }
  skipSp() {
    while (this.peek()?.k === 'sp') this.i++;
  }
  // Đọc dãy đến khi gặp dấu kết thúc. stop: hàm nhận token.
  seq(stop) {
    const items = [];
    for (;;) {
      const tk = this.peek();
      if (!tk || stop(tk)) break;
      if (tk.k === 'sp') {
        this.i++;
        continue;
      }
      if (tk.k === '^' || tk.k === '_') {
        this.i++;
        const arg = this.arg();
        const base = items.pop() ?? { t: 'run', text: '' };
        if (base.t === 'scripts' && !base[tk.k === '^' ? 'sup' : 'sub']) {
          base[tk.k === '^' ? 'sup' : 'sub'] = arg;
          items.push(base);
        } else if (base.t === 'nary' && !base[tk.k === '^' ? 'sup' : 'sub']) {
          base[tk.k === '^' ? 'sup' : 'sub'] = arg;
          items.push(base);
        } else if (base.t === 'lim' && tk.k === '_') {
          base.sub = arg;
          items.push(base);
        } else {
          items.push({ t: 'scripts', base, [tk.k === '^' ? 'sup' : 'sub']: arg });
        }
        continue;
      }
      const atom = this.atom(stop);
      if (atom) items.push(atom);
    }
    // n-ary: phần sau là thân.
    const idx = items.findIndex((x) => x.t === 'nary' && !x.body);
    if (idx >= 0) {
      const body = items.splice(idx + 1);
      items[idx].body = { t: 'seq', items: body };
    }
    return { t: 'seq', items };
  }
  group() {
    this.skipSp();
    if (this.peek()?.k === '{') {
      this.i++;
      const s = this.seq((tk) => tk.k === '}');
      this.i++;
      return s;
    }
    return null;
  }
  arg() {
    this.skipSp();
    const g = this.group();
    if (g) return g;
    const tk = this.peek();
    if (!tk) return { t: 'seq', items: [] };
    return { t: 'seq', items: [this.atom(() => false)].filter(Boolean) };
  }
  rawGroup() {
    this.skipSp();
    if (this.peek()?.k !== '{') return '';
    this.i++;
    let depth = 1;
    let s = '';
    while (this.peek()) {
      const tk = this.next();
      if (tk.k === '{') depth++;
      if (tk.k === '}' && --depth === 0) break;
      s += tk.k === 'ch' ? tk.v : tk.k === 'sp' ? ' ' : tk.k === 'cmd' ? '\\' + tk.v : tk.k === 'row' ? '\\\\' : tk.k;
    }
    return s;
  }
  delimChar() {
    this.skipSp();
    const tk = this.next();
    if (!tk) return '';
    if (tk.k === 'ch') return tk.v === '.' ? '' : tk.v;
    if (tk.k === 'cmd') return { '{': '{', '}': '}', '|': '‖', langle: '⟨', rangle: '⟩', lbrace: '{', rbrace: '}', vert: '|', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉' }[tk.v] ?? '';
    return '';
  }
  env(name) {
    const rows = [[[]]];
    for (;;) {
      const tk = this.peek();
      if (!tk) break;
      if (tk.k === 'cmd' && tk.v === 'end') {
        this.i++;
        this.rawGroup();
        break;
      }
      if (tk.k === 'row') {
        this.i++;
        rows.push([[]]);
        continue;
      }
      if (tk.k === '&') {
        this.i++;
        rows[rows.length - 1].push([]);
        continue;
      }
      const s = this.seq((t) => t.k === 'row' || t.k === '&' || (t.k === 'cmd' && t.v === 'end'));
      rows[rows.length - 1][rows[rows.length - 1].length - 1].push(...s.items);
    }
    const cleaned = rows.filter((r) => r.some((c) => c.length)).map((r) => r.map((c) => ({ t: 'seq', items: c })));
    if (name === 'cases') return { t: 'cases', rows: cleaned };
    const br = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], vmatrix: ['|', '|'], matrix: null, array: null }[name];
    const m = { t: 'matrix', rows: cleaned };
    return br ? { t: 'delim', open: br[0], close: br[1], body: { t: 'seq', items: [m] } } : m;
  }
  atom(stop) {
    const tk = this.next();
    if (tk.k === '{') {
      const s = this.seq((t) => t.k === '}');
      this.i++;
      return s;
    }
    if (tk.k === 'ch') return { t: 'run', text: tk.v === '-' ? '−' : tk.v === "'" ? '′' : tk.v };
    if (tk.k === '}' || tk.k === '&' || tk.k === 'row') return null;
    if (tk.k !== 'cmd') return null;
    const c = tk.v;
    if (c === 'frac' || c === 'dfrac' || c === 'tfrac') return { t: 'frac', num: this.arg(), den: this.arg() };
    if (c === 'sqrt') {
      this.skipSp();
      let deg = null;
      if (this.peek()?.k === 'ch' && this.peek().v === '[') {
        this.i++;
        deg = this.seq((t) => t.k === 'ch' && t.v === ']');
        this.i++;
      }
      return { t: 'sqrt', deg, body: this.arg() };
    }
    if (c === 'left') {
      const open = this.delimChar();
      const body = this.seq((t) => t.k === 'cmd' && t.v === 'right');
      this.i++;
      const close = this.delimChar();
      return { t: 'delim', open, close, body };
    }
    if (c === 'right') return null;
    if (c === 'begin') return this.env(this.rawGroup().trim());
    if (NARY[c]) return { t: 'nary', chr: NARY[c] };
    if (c === 'lim') return { t: 'lim' };
    if (FUNCS.includes(c)) return { t: 'run', text: c, plain: true };
    if (ACCENTS[c]) return { t: 'acc', chr: ACCENTS[c], body: this.arg() };
    if (c === 'overline' || c === 'bar') return { t: 'bar', body: this.arg() };
    if (c === 'text' || c === 'mathrm' || c === 'textrm' || c === 'operatorname' || c === 'textbf') return { t: 'run', text: this.rawGroup(), plain: true, text_: c === 'text' };
    if (c === 'mathbb') {
      const g = this.rawGroup();
      return { t: 'run', text: g.split('').map((x) => BB[x] ?? x).join('') };
    }
    if (c === 'mathbf' || c === 'boldsymbol' || c === 'mathit') return this.arg();
    if (['displaystyle', 'limits', 'nolimits', 'textstyle', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr'].includes(c)) return null;
    if (c in SPACES) return SPACES[c] ? { t: 'run', text: SPACES[c] } : null;
    if (SYMBOLS[c]) return { t: 'run', text: SYMBOLS[c] };
    if ('{}%$#_|'.includes(c)) return { t: 'run', text: c === '|' ? '‖' : c };
    return { t: 'run', text: c, plain: true };
  }
}

export function parseLatex(src) {
  const p = new Parser(String(src ?? ''));
  return p.seq(() => false);
}

// ---------------- cây → OMML ----------------
const RPR = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>';

function mRun(text, plain, normal) {
  if (text === '') return '';
  const sty = normal ? '<m:rPr><m:nor/></m:rPr>' : plain ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : '';
  return `<m:r>${sty}${RPR}<m:t xml:space="preserve">${escapeXml(text)}</m:t></m:r>`;
}

function seqXml(node) {
  if (!node) return '';
  if (node.t !== 'seq') return nodeXml(node);
  let out = '';
  let buf = '';
  let bufPlain = null;
  const flush = () => {
    if (buf) out += mRun(buf, bufPlain);
    buf = '';
    bufPlain = null;
  };
  for (const it of node.items) {
    if (it.t === 'run' && !it.text_) {
      const plain = !!it.plain || /^[0-9.,−+=()<>[\]/|!:;′°×⋅÷±≤≥≠≈∈∉⊂⊆∪∩→⇒⇔∞…%]+$/.test(it.text);
      if (bufPlain !== null && plain !== bufPlain) flush();
      buf += it.text;
      bufPlain = plain;
    } else {
      flush();
      out += nodeXml(it);
    }
  }
  flush();
  return out;
}

const e = (x) => `<m:e>${seqXml(x)}</m:e>`;

function nodeXml(n) {
  switch (n.t) {
    case 'seq':
      return seqXml(n);
    case 'run':
      return mRun(n.text, n.plain, n.text_);
    case 'frac':
      return `<m:f><m:num>${seqXml(n.num)}</m:num><m:den>${seqXml(n.den)}</m:den></m:f>`;
    case 'sqrt':
      return n.deg
        ? `<m:rad><m:deg>${seqXml(n.deg)}</m:deg>${e(n.body)}</m:rad>`
        : `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>${e(n.body)}</m:rad>`;
    case 'scripts':
      if (n.sub && n.sup) return `<m:sSubSup>${e(n.base)}<m:sub>${seqXml(n.sub)}</m:sub><m:sup>${seqXml(n.sup)}</m:sup></m:sSubSup>`;
      if (n.sup) return `<m:sSup>${e(n.base)}<m:sup>${seqXml(n.sup)}</m:sup></m:sSup>`;
      return `<m:sSub>${e(n.base)}<m:sub>${seqXml(n.sub)}</m:sub></m:sSub>`;
    case 'delim':
      return `<m:d><m:dPr><m:begChr m:val="${escapeXml(n.open)}"/><m:endChr m:val="${escapeXml(n.close)}"/></m:dPr>${e(n.body)}</m:d>`;
    case 'nary': {
      const pr = `<m:naryPr><m:chr m:val="${n.chr}"/><m:limLoc m:val="${n.chr === '∫' || n.chr === '∬' || n.chr === '∮' ? 'subSup' : 'undOvr'}"/>${n.sub ? '' : '<m:subHide m:val="1"/>'}${n.sup ? '' : '<m:supHide m:val="1"/>'}</m:naryPr>`;
      return `<m:nary>${pr}<m:sub>${seqXml(n.sub)}</m:sub><m:sup>${seqXml(n.sup)}</m:sup>${e(n.body)}</m:nary>`;
    }
    case 'lim':
      return n.sub ? `<m:limLow><m:e>${mRun('lim', true)}</m:e><m:lim>${seqXml(n.sub)}</m:lim></m:limLow>` : mRun('lim', true);
    case 'acc':
      return `<m:acc><m:accPr><m:chr m:val="${n.chr}"/></m:accPr>${e(n.body)}</m:acc>`;
    case 'bar':
      return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>${e(n.body)}</m:bar>`;
    case 'matrix':
      return `<m:m>${n.rows.map((r) => `<m:mr>${r.map((c) => e(c)).join('')}</m:mr>`).join('')}</m:m>`;
    case 'cases':
      return `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:eqArr>${n.rows
        .map((r) => `<m:e>${r.map((c) => seqXml(c)).join(mRun(' ', true))}</m:e>`)
        .join('')}</m:eqArr></m:e></m:d>`;
    default:
      return '';
  }
}

/** LaTeX → <m:oMath>…</m:oMath> */
export function latexToOmml(latex) {
  return `<m:oMath>${seqXml(parseLatex(latex))}</m:oMath>`;
}

// ---------------- OMML → LaTeX (khi nhập file Word) ----------------
function wrap(s) {
  const t = s.trim();
  return t.length === 1 ? t : `{${t}}`;
}

function runToLatex(text) {
  let out = '';
  for (const ch of text) {
    if (SYMBOL_BACK[ch]) out += `\\${SYMBOL_BACK[ch]} `;
    else if (ch === '−') out += '-';
    else if (ch === '′') out += "'";
    else if (ch === 'ℝ') out += '\\mathbb{R}';
    else if (ch === 'ℕ') out += '\\mathbb{N}';
    else if (ch === 'ℤ') out += '\\mathbb{Z}';
    else if (ch === 'ℚ') out += '\\mathbb{Q}';
    else if (ch === '{' || ch === '}') out += '\\' + ch;
    else out += ch;
  }
  const t = out.trim();
  if (FUNCS.includes(t)) return `\\${t} `;
  return out.replace(/\b(sin|cos|tan|cot|ln|log)\b/g, '\\$1 ');
}

function propVal(node, prName, key, dflt) {
  const pr = child(node, prName);
  const k = pr && child(pr, key);
  if (!k) return dflt;
  return k.attrs['m:val'] ?? dflt;
}

export function ommlToLatex(node) {
  if (!node) return '';
  if (node.text !== undefined) return '';
  const kids = (name) => children(node, name).map(ommlToLatex);
  const one = (name) => ommlToLatex(child(node, name));
  switch (node.name) {
    case 'm:r':
      return runToLatex(textOf(child(node, 'm:t')) || children(node, 'm:t').map(textOf).join(''));
    case 'm:f': {
      const type = propVal(node, 'm:fPr', 'm:type', 'bar');
      if (type === 'lin') return `${wrap(one('m:num'))}/${wrap(one('m:den'))}`;
      if (type === 'noBar') return `\\binom{${one('m:num')}}{${one('m:den')}}`;
      return `\\frac{${one('m:num')}}{${one('m:den')}}`;
    }
    case 'm:rad': {
      const hide = propVal(node, 'm:radPr', 'm:degHide', '0');
      const deg = one('m:deg').trim();
      return hide === '1' || hide === 'on' || !deg ? `\\sqrt{${one('m:e')}}` : `\\sqrt[${deg}]{${one('m:e')}}`;
    }
    case 'm:sSup':
      return `${wrap(one('m:e'))}^${wrap(one('m:sup'))}`;
    case 'm:sSub':
      return `${wrap(one('m:e'))}_${wrap(one('m:sub'))}`;
    case 'm:sSubSup':
      return `${wrap(one('m:e'))}_${wrap(one('m:sub'))}^${wrap(one('m:sup'))}`;
    case 'm:d': {
      const beg = propVal(node, 'm:dPr', 'm:begChr', '(');
      const end = propVal(node, 'm:dPr', 'm:endChr', ')');
      const sep = propVal(node, 'm:dPr', 'm:sepChr', '|');
      const es = children(node, 'm:e');
      if (beg === '{' && end === '' && es.length === 1 && child(es[0], 'm:eqArr')) {
        const rows = children(child(es[0], 'm:eqArr'), 'm:e').map(ommlToLatex);
        return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
      }
      const L = { '{': '\\{', '}': '\\}', '': '.', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle' };
      return `\\left${L[beg] ?? beg} ${es.map(ommlToLatex).join(sep === '|' ? ' \\mid ' : sep)} \\right${L[end] ?? end}`;
    }
    case 'm:nary': {
      const chr = propVal(node, 'm:naryPr', 'm:chr', '∫');
      const cmd = Object.entries(NARY).find(([, v]) => v === chr)?.[0] ?? 'int';
      const sub = one('m:sub').trim();
      const sup = one('m:sup').trim();
      return `\\${cmd}${sub ? `_${wrap(sub)}` : ''}${sup ? `^${wrap(sup)}` : ''} ${one('m:e')}`;
    }
    case 'm:func':
      return `${one('m:fName').trim()} ${one('m:e')}`;
    case 'm:limLow': {
      const base = one('m:e').trim();
      return `${base === 'lim' ? '\\lim' : base}_${wrap(one('m:lim'))}`;
    }
    case 'm:limUpp':
      return `${one('m:e')}^${wrap(one('m:lim'))}`;
    case 'm:acc': {
      const chr = propVal(node, 'm:accPr', 'm:chr', '̂');
      const body = one('m:e');
      if (chr === '⃗' || chr === '→' || chr === '⃗') return body.trim().length > 1 ? `\\overrightarrow{${body}}` : `\\vec{${body}}`;
      if (chr === '̄' || chr === '¯') return `\\bar{${body}}`;
      if (chr === '̃') return `\\tilde{${body}}`;
      return body.trim().length > 1 ? `\\widehat{${body}}` : `\\hat{${body}}`;
    }
    case 'm:groupChr': {
      const chr = propVal(node, 'm:groupChrPr', 'm:chr', '⏟');
      const body = one('m:e');
      return chr === '→' || chr === '⃗' ? `\\overrightarrow{${body}}` : body;
    }
    case 'm:bar':
      return `\\overline{${one('m:e')}}`;
    case 'm:m':
      return `\\begin{matrix} ${children(node, 'm:mr')
        .map((r) => children(r, 'm:e').map(ommlToLatex).join(' & '))
        .join(' \\\\ ')} \\end{matrix}`;
    case 'm:eqArr':
      return kids('m:e').join(' \\\\ ');
    default:
      if (node.name?.endsWith('Pr') || node.name === 'w:rPr') return '';
      return node.children.map(ommlToLatex).join('');
  }
}
