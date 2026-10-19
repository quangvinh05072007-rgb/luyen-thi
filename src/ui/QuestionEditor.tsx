// Sửa một câu hỏi (dùng ở Ngân hàng và Nhập đề). Có xem trước công thức.
import { useId } from 'react';
import { MathText } from './MathText';
import { useApp } from './kit';

export type Draft = { type: 'mcq' | 'tf' | 'short'; stem: string; options: string[]; answer: any; explanation: string; topic: string | null; level: number; distractors?: any };

export function QuestionEditor({ q, onChange }: { q: Draft; onChange: (q: Draft) => void }) {
  const { meta } = useApp();
  const uid = useId();
  const set = (patch: Partial<Draft>) => onChange({ ...q, ...patch });
  const setType = (type: Draft['type']) => {
    if (type === q.type) return;
    set({ type, options: type === 'short' ? [] : q.options.length === 4 ? q.options : ['', '', '', ''], answer: type === 'tf' ? [null, null, null, null] : null });
  };
  const opts = q.type === 'short' ? [] : q.options.length === 4 ? q.options : [...q.options, '', '', '', ''].slice(0, 4);
  const setOpt = (i: number, v: string) => set({ options: opts.map((o, k) => (k === i ? v : o)) });
  const errFor = (i: number) => q.distractors?.[i]?.error ?? '';
  const setErr = (i: number, error: string) => {
    const d = { ...(q.distractors ?? {}) };
    if (error) d[i] = { error, note: d[i]?.note ?? '' };
    else delete d[i];
    set({ distractors: d });
  };
  return (
    <div className="stack">
      <div className="row">
        <div className="seg">
          {(['mcq', 'tf', 'short'] as const).map((t) => (
            <button key={t} type="button" className={q.type === t ? 'on' : ''} onClick={() => setType(t)}>
              {meta.types[t]}
            </button>
          ))}
        </div>
        <select className="input" style={{ width: 'auto', flex: 1, minWidth: 200 }} value={q.topic ?? ''} onChange={(e) => set({ topic: e.target.value || null })} aria-label="Chuyên đề">
          <option value="">— Chọn chuyên đề —</option>
          {[12, 11, 10].map((g) => (
            <optgroup key={g} label={`Lớp ${g}`}>
              {meta.topics
                .filter((t) => t.grade === g)
                .map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={q.level} onChange={(e) => set({ level: Number(e.target.value) })} aria-label="Mức độ">
          {[1, 2, 3].map((l) => (
            <option key={l} value={l}>
              {meta.levels[l]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Đề bài (công thức viết trong $…$, ví dụ $\frac{'{1}{2}'}$)</label>
        <textarea className="input" value={q.stem} onChange={(e) => set({ stem: e.target.value })} />
        {q.stem.includes('$') && <MathText as="div" className="explain q-stem" text={q.stem} />}
      </div>
      {q.type === 'mcq' &&
        opts.map((o, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
            <label className="check" title="Đáp án đúng" style={{ paddingTop: 10 }}>
              <input type="radio" name={`ans-${uid}`} checked={q.answer === i} onChange={() => set({ answer: i })} />
              <b>{'ABCD'[i]}</b>
            </label>
            <div style={{ flex: 1, minWidth: 180 }}>
              <input className="input" value={o} onChange={(e) => setOpt(i, e.target.value)} aria-label={`Phương án ${'ABCD'[i]}`} />
              {o.includes('$') && <MathText className="tiny" text={o} />}
            </div>
            {q.answer !== i && (
              <select className="input" style={{ width: 'auto' }} value={errFor(i)} onChange={(e) => setErr(i, e.target.value)} aria-label="Kiểu lỗi nếu chọn phương án này" title="Học sinh chọn phương án này thường mắc lỗi gì?">
                <option value="">Lỗi: tự suy</option>
                {Object.entries(meta.errorTypes).map(([k, v]) => (
                  <option key={k} value={k}>
                    Lỗi: {v.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      {q.type === 'tf' &&
        opts.map((o, i) => (
          <div key={i} className="row">
            <b>{'abcd'[i]})</b>
            <input className="input" style={{ flex: 1, minWidth: 180 }} value={o} onChange={(e) => setOpt(i, e.target.value)} aria-label={`Ý ${'abcd'[i]}`} />
            <div className="tf-btns">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" className={Array.isArray(q.answer) && q.answer[i] === v ? (v ? 'on-t' : 'on-f') : ''} onClick={() => set({ answer: [0, 1, 2, 3].map((k) => (k === i ? v : Array.isArray(q.answer) ? q.answer[k] : null)) })}>
                  {v ? 'Đ' : 'S'}
                </button>
              ))}
            </div>
          </div>
        ))}
      {q.type === 'short' && (
        <div className="field">
          <label>Đáp án (nhiều đáp án được chấp nhận thì ngăn bằng dấu ;)</label>
          <input className="input" style={{ maxWidth: 240 }} value={q.answer ?? ''} onChange={(e) => set({ answer: e.target.value })} />
          {String(q.answer ?? '').split(';')[0].trim().length > 4 && <span className="tiny" style={{ color: 'var(--warn)' }}>Đề thi 2025 yêu cầu đáp số tối đa 4 ký tự.</span>}
        </div>
      )}
      <div className="field">
        <label>Lời giải</label>
        <textarea className="input" value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        {q.explanation.includes('$') && <MathText as="div" className="explain" text={q.explanation} />}
      </div>
    </div>
  );
}
