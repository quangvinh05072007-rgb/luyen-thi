// Tách câu hỏi từ văn bản đề (dán trực tiếp, hoặc chữ lấy ra từ Word/PDF).
// Hiểu: "PHẦN I/II/III", "Câu 1.", phương án "A. … D." (cùng dòng hoặc nhiều dòng), ý "a) … d)",
// đáp án đánh dấu "*" hoặc [[OK]] (gạch chân/tô đỏ trong Word), dòng "Đáp án: …", "Lời giải: …", bảng đáp án cuối đề.

import { normalizeShort, parseNumber } from './grading.mjs';

export const OK_MARK = '[[OK]]';

const PART_RE = /^\s*PH[ẦẦAÂ]N\s+(III|II|I|3|2|1)\b[.:\s-]*(.*)$/iu;
const Q_RE = /^\s*(?:Câu|CÂU|Bài|BÀI)\s*(\d+)\s*[.:)]?\s*(.*)$/u;
const KEY_HEADER_RE = /^\s*(?:BẢNG\s+)?(?:ĐÁP\s*ÁN|DAP\s*AN)(?:\s+(?:VÀ\s+)?(?:THAM\s+KHẢO|ĐỀ\s+THI|CHI\s+TIẾT))?\s*[.:]?\s*$/iu;
const ANSWER_LINE_RE = /^\s*(?:Đáp\s*án|ĐA|Đáp\s*số|Kết\s*quả|Trả\s*lời)\s*[:.]\s*(.+)$/imu;
const EXPLAIN_RE = /^\s*(?:Lời\s*giải|Hướng\s*dẫn(?:\s*giải)?|Giải(?:\s*thích)?)\s*[:.]?/imu;

const PART_TYPE = { I: 'mcq', 1: 'mcq', II: 'tf', 2: 'tf', III: 'short', 3: 'short' };
const PART_NAME = { 1: 'I', 2: 'II', 3: 'III', I: 'I', II: 'II', III: 'III' };

function clean(s) {
  return s.replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function hasOk(s) {
  return s.includes(OK_MARK);
}

function stripOk(s) {
  return s.split(OK_MARK).join('');
}

/** Tìm chuỗi nhãn liên tiếp (A,B,C,D hoặc a,b,c,d) trong khối; trả về vị trí các nhãn hoặc null. */
function findLabelSequence(text, letters, re) {
  const ms = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text))) {
    ms.push({ letter: m[3], star: m[2] === '*', ok: hasOk(m[1] + m[2]), index: m.index + m[1].length, end: m.index + m[0].length });
  }
  for (let s = ms.length - 1; s >= 0; s--) {
    if (ms[s].letter !== letters[0]) continue;
    const seq = [ms[s]];
    let k = s + 1;
    for (let li = 1; li < letters.length; li++) {
      while (k < ms.length && ms[k].letter !== letters[li]) k++;
      if (k >= ms.length) break;
      seq.push(ms[k]);
      k++;
    }
    if (seq.length === letters.length) return seq;
  }
  return null;
}

function splitByLabels(text, seq) {
  const stem = text.slice(0, seq[0].index);
  const parts = seq.map((m, i) => text.slice(m.end, i + 1 < seq.length ? seq[i + 1].index : undefined));
  // Dấu đánh dấu đáp án có thể nằm ngay trước nhãn (cuối phần trước) — xem tag.ok khi tìm.
  return { stem, parts };
}

function parseTfTokens(s) {
  // Dạng viết liền "ĐSĐS" (rất hay gặp trong đáp án): từng chữ là một ý.
  const compact = s.replace(/[\s,;.\-–]/g, '');
  if (/^[ĐSđs]{4}$/u.test(compact)) return [...compact.toUpperCase()].map((c) => c === 'Đ');
  const t = s.replace(/\b[a-d]\s*[).:-]\s*/giu, ' ');
  const tokens = [...t.matchAll(/(Đúng|Sai|ĐÚNG|SAI|Đ|S|T|F|true|false)(?![\p{L}])/giu)].map((m) => m[1].toLowerCase());
  const vals = tokens.map((x) => x === 'đúng' || x === 'đ' || x === 't' || x === 'true');
  return vals.length >= 4 ? vals.slice(0, 4) : null;
}

function parseKeyValue(raw) {
  const v = raw.trim();
  if (/^[A-D]$/i.test(v)) return { kind: 'mcq', value: 'ABCD'.indexOf(v.toUpperCase()) };
  const tf = parseTfTokens(v);
  if (tf && /^[\sĐSđsa-d).:-]+$|đúng|sai/iu.test(v)) return { kind: 'tf', value: tf };
  if (/^[-−+]?\d+(?:[.,]\d+)?(?:\/\d+)?$/.test(v.replace(/\s/g, ''))) return { kind: 'short', value: v.replace(/\s/g, '').replace('−', '-') };
  return { kind: 'text', value: v };
}

/** Đọc bảng đáp án cuối đề. */
export function parseAnswerKey(lines) {
  const entries = [];
  let part = null;
  const cells = (l) => l.split(/\s*\|\s*|\s+/).filter(Boolean).filter((c) => !/^(Câu|Đáp|án|ĐA)$/iu.test(c));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Bảng hai hàng: "Câu | 1 | 2 | 3" rồi "Đáp án | A | C | B"
    const nums = cells(line);
    if (nums.length >= 2 && nums.every((c) => /^\d+$/.test(c)) && i + 1 < lines.length) {
      const vals = cells(lines[i + 1]);
      if (vals.length === nums.length) {
        nums.forEach((n, k) => {
          const kv = parseKeyValue(vals[k]);
          if (kv.kind !== 'text') entries.push({ num: Number(n), part, ...kv });
        });
        i++;
        continue;
      }
    }
    const pm = line.match(PART_RE);
    if (pm) {
      part = PART_NAME[pm[1].toUpperCase()];
      continue;
    }
    // Bảng dọc (Excel/Word): mỗi dòng "1 | A" hoặc "| 1 | A |"
    const two = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (two.length === 2 && /^\d+$/.test(two[0])) {
      const kv = parseKeyValue(two[1]);
      if (kv.kind !== 'text') {
        entries.push({ num: Number(two[0]), part, ...kv });
        continue;
      }
    }
    // "Câu 13: ĐSĐS", "1.A 2.B", "1-A", "Câu 17: 1,5"
    const re = /(?:Câu\s*)?(\d+)\s*[.:\-)]?\s*((?:[a-d]\s*\)\s*(?:Đúng|Sai|Đ|S)\s*[,;]?\s*){4}|[ĐS]{4}(?![\p{L}\d])|[A-D](?![\p{L}\d])|[-−]?\d+(?:,\d+)?(?![\p{L}\d.]))/giu;
    let m;
    while ((m = re.exec(line))) {
      const kv = parseKeyValue(m[2]);
      if (kv.kind !== 'text') entries.push({ num: Number(m[1]), part, ...kv });
    }
  }
  return entries;
}

function parseBlock(block) {
  const warnings = [];
  let text = block.lines.join('\n');
  let explanation = '';
  const ex = text.match(EXPLAIN_RE);
  if (ex) {
    explanation = text.slice(ex.index + ex[0].length);
    text = text.slice(0, ex.index);
  }
  let answerRaw = null;
  const al = text.match(ANSWER_LINE_RE) ?? explanation.match(ANSWER_LINE_RE);
  if (al) {
    answerRaw = al[1].trim();
    if (text.match(ANSWER_LINE_RE)) text = text.replace(ANSWER_LINE_RE, '');
    else explanation = explanation.replace(ANSWER_LINE_RE, '');
  }
  const mcqSeq = findLabelSequence(text, ['A', 'B', 'C', 'D'], /(^|\s|\[\[OK\]\])(\*?)([A-D])\s*[.)]\s*/g);
  const tfSeq = findLabelSequence(text, ['a', 'b', 'c', 'd'], /(^|\s|\[\[OK\]\])(\*?)([a-d])\s*\)\s*/g);

  let type = block.sectionType;
  if (!type) type = mcqSeq ? 'mcq' : tfSeq ? 'tf' : 'short';
  if (type === 'mcq' && !mcqSeq && tfSeq) type = 'tf';
  if (type === 'tf' && !tfSeq && mcqSeq) type = 'mcq';

  const q = { num: block.num, part: block.part, type, stem: '', options: [], answer: null, explanation: clean(stripOk(explanation)), warnings, answerCands: [], raw: block.lines.join('\n') };

  if (type === 'mcq' || type === 'tf') {
    const seq = type === 'mcq' ? mcqSeq : tfSeq;
    if (!seq) {
      q.stem = clean(stripOk(text));
      warnings.push(type === 'mcq' ? 'Không tìm thấy đủ 4 phương án A, B, C, D.' : 'Không tìm thấy đủ 4 ý a), b), c), d).');
      q.options = ['', '', '', ''];
    } else {
      const { stem, parts } = splitByLabels(text, seq);
      q.stem = clean(stripOk(stem));
      const okFlags = parts.map((p, i) => seq[i].star || seq[i].ok || p.trimStart().startsWith(OK_MARK));
      q.options = parts.map((p) => clean(stripOk(p)));
      if (type === 'mcq') {
        const marked = okFlags.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
        if (marked.length === 1) {
          q.answer = marked[0];
          q.answerCands.push({ src: 'mark', value: marked[0] });
        } else if (marked.length > 1) warnings.push('Có nhiều phương án được đánh dấu đúng.');
      } else if (okFlags.some(Boolean)) {
        q.answer = okFlags;
        q.answerCands.push({ src: 'mark', value: okFlags });
      }
    }
  } else {
    q.stem = clean(stripOk(text));
  }

  if (answerRaw !== null) {
    const kv = parseKeyValue(answerRaw.replace(/^Chọn\s*/i, ''));
    let fromLine = null;
    if (type === 'mcq' && kv.kind === 'mcq') fromLine = kv.value;
    else if (type === 'tf') fromLine = parseTfTokens(answerRaw);
    else if (type === 'short') fromLine = kv.kind === 'short' ? kv.value : answerRaw;
    if (fromLine !== null) {
      q.answer = fromLine;
      q.answerCands.push({ src: 'line', value: fromLine });
    }
  }
  if (type === 'mcq') {
    const chon = (explanation || '').match(/\bChọn\s+(?:đáp\s+án\s+)?([A-D])\b/u);
    if (chon) {
      q.answerCands.push({ src: 'explain', value: 'ABCD'.indexOf(chon[1]) });
      if (q.answer === null) q.answer = 'ABCD'.indexOf(chon[1]);
    }
  }
  if (!q.stem) warnings.push('Đề bài trống.');
  return q;
}

const SRC_LABEL = { mark: 'dấu gạch chân/tô màu/*', line: 'dòng "Đáp án"', explain: 'lời giải "Chọn …"', key: 'bảng đáp án', file: 'file đáp án riêng', manual: 'bạn đã chọn tay' };

function showAnswer(type, v) {
  if (type === 'mcq') return 'ABCD'[v] ?? String(v);
  if (type === 'tf') return Array.isArray(v) ? v.map((x) => (x ? 'Đ' : 'S')).join('') : String(v);
  return String(v);
}

export function sameAnswer(type, a, b) {
  if (type === 'tf') return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  if (type === 'short') {
    const [x, y] = [parseNumber(a), parseNumber(b)];
    return Number.isNaN(x) || Number.isNaN(y) ? normalizeShort(a) === normalizeShort(b) : Math.abs(x - y) < 1e-9;
  }
  return a === b;
}

/**
 * Đối chiếu mọi nguồn đáp án của từng câu (answerCands). Các nguồn khớp nhau → lấy; mâu thuẫn → KHÔNG đoán:
 * để trống đáp án, ghi answerConflict và cảnh báo để giáo viên chọn. answerSources = các nguồn đồng ý.
 */
export function resolveAnswers(questions) {
  for (const q of questions) {
    const cands = q.answerCands ?? [];
    delete q.answerConflict;
    q.answerSources = [];
    if (!cands.length) continue;
    const groups = [];
    for (const c of cands) {
      const g = groups.find((x) => sameAnswer(q.type, x.value, c.value));
      if (g) g.srcs.push(c.src);
      else groups.push({ value: c.value, srcs: [c.src] });
    }
    q.warnings = (q.warnings ?? []).filter((w) => !w.startsWith('Đáp án mâu thuẫn'));
    if (groups.length === 1) {
      q.answer = groups[0].value;
      q.answerSources = groups[0].srcs;
    } else {
      q.answer = null;
      q.answerConflict = groups.map((g) => ({ srcs: g.srcs, value: g.value, label: showAnswer(q.type, g.value) }));
      q.warnings.push(`Đáp án mâu thuẫn giữa các nguồn: ${q.answerConflict.map((g) => `${g.srcs.map((s) => SRC_LABEL[s] ?? s).join(' + ')} → ${g.label}`).join('; ')}. Hãy kiểm tra và chọn đáp án đúng.`);
    }
  }
  return questions;
}

/**
 * Thêm đáp án từ bảng/file đáp án vào ứng viên của từng câu rồi đối chiếu.
 * entries: [{num, part, kind: 'mcq'|'tf'|'short', value}]. Trả { applied, unmatched }.
 */
export function applyAnswerEntries(questions, entries, src = 'key') {
  const compatible = (q, e) => q.type === e.kind || (q.type === 'short' && e.kind !== 'mcq' && e.kind !== 'tf');
  let applied = 0;
  const unmatched = [];
  for (const e of entries) {
    const target = questions.find((q) => q.num === e.num && e.part && q.part === e.part && compatible(q, e)) ?? questions.find((q) => q.num === e.num && !e.part && compatible(q, e)) ?? (e.part ? questions.find((q) => q.num === e.num && !q.part && compatible(q, e)) : null);
    if (!target) {
      unmatched.push(e);
      continue;
    }
    if (target.answer !== null && !target.answerCands?.length) (target.answerCands ??= []).push({ src: 'manual', value: target.answer });
    (target.answerCands ??= []).push({ src, value: target.type === 'short' ? String(e.value) : e.value });
    applied++;
  }
  resolveAnswers(questions);
  return { applied, unmatched };
}

/** Đọc văn bản của file đáp án riêng (không cần dòng tiêu đề "Đáp án"). */
export function parseAnswerFileText(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim());
  return parseAnswerKey(lines.filter(Boolean));
}

/**
 * Tách văn bản đề thành danh sách câu.
 * Trả về { questions: [{num, part, type, stem, options, answer, explanation, warnings}], keyEntries, warnings }
 */
export function parseExamText(input) {
  const lines = String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trimEnd());
  const blocks = [];
  let sectionType = null;
  let part = null;
  let cur = null;
  let keyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (KEY_HEADER_RE.test(line)) {
      keyStart = i + 1;
      break;
    }
    const pm = line.match(PART_RE);
    if (pm && !Q_RE.test(line)) {
      part = PART_NAME[pm[1].toUpperCase()];
      sectionType = PART_TYPE[pm[1].toUpperCase()];
      cur = null;
      continue;
    }
    const qm = line.match(Q_RE);
    if (qm) {
      cur = { num: Number(qm[1]), part, sectionType, lines: [qm[2]] };
      blocks.push(cur);
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  const questions = blocks.map(parseBlock);
  const keyEntries = keyStart >= 0 ? parseAnswerKey(lines.slice(keyStart)) : [];
  const warnings = [];
  applyAnswerEntries(questions, keyEntries, 'key');
  resolveAnswers(questions);
  for (const q of questions) {
    if (q.answer === null && !q.answerConflict) q.warnings.push('Chưa có đáp án — hãy chọn đáp án trước khi duyệt.');
    if (q.type === 'tf' && Array.isArray(q.answer) && q.answer.length !== 4) q.warnings.push('Đáp án Đúng/Sai phải đủ 4 ý.');
  }
  if (!questions.length) warnings.push('Không tìm thấy câu nào. Mỗi câu cần bắt đầu bằng "Câu 1.", "Câu 2." …');
  return { questions, keyEntries, warnings };
}


/** Đổi một đoạn "đáp án" (chữ) về đúng dạng của loại câu; không hiểu được → null. */
export function parseAnswerLine(type, raw) {
  const text = String(raw ?? '').replace(/\$/g, '').replace(/^\s*(?:là|bằng)\s+/i, '').trim();
  if (!text) return null;
  const kv = parseKeyValue(text.replace(/^Chọn\s*/i, '').replace(/[.。]\s*$/, ''));
  if (type === 'mcq') return kv.kind === 'mcq' ? kv.value : null;
  if (type === 'tf') return parseTfTokens(text);
  if (type === 'short') return kv.kind === 'short' ? kv.value : null;
  return null;
}

/** Đáp án mà lời giải (do AI viết) kết luận: dòng "Đáp án: …" cuối cùng. */
export function answerFromSolution(type, solution) {
  const all = [...String(solution ?? '').matchAll(/^\s*(?:\*\*)?Đáp\s*án\s*(?:\*\*)?\s*[:.]\s*(?:\*\*)?\s*(.+)$/gimu)];
  if (!all.length) return null;
  return parseAnswerLine(type, all[all.length - 1][1]);
}
