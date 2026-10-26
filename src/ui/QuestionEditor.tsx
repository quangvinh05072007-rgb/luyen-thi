// Sửa một câu hỏi (dùng ở Ngân hàng và Nhập đề). Có xem trước công thức.
import { lazy, Suspense, useId, useState } from 'react';
import { MathText } from './MathText';
import { useApp } from './kit';
const RichField=lazy(()=>import('./RichField'));
const MathOcrReview=lazy(()=>import('./MathOcrReview'));

export type Draft = { type: 'mcq' | 'tf' | 'short'; stem: string; options: string[]; answer: any; explanation: string; topic: string | null; level: number; distractors?: any; group_id?: string | null; ocrText?: string; sourceStem?: string };

export function QuestionEditor({ q, onChange }: { q: Draft; onChange: (q: Draft) => void }) {
  const { meta } = useApp();
  const uid = useId();
  const [mathOcr,setMathOcr]=useState(false);
  const original=q.sourceStem || (q.ocrText&&q.stem.includes('[[img:')?q.stem:'');
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
    <div className={`question-editor ${original?'has-source':''}`}>
      {original&&<aside className="question-source"><h3>Ảnh gốc đối chiếu</h3><MathText as="div" text={original}/><p className="tiny muted">Giữ nguyên hình và công thức gốc để kiểm tra nội dung sau khi sửa.</p>{q.stem===original&&q.ocrText&&<button className="btn sm" type="button" onClick={()=>set({sourceStem:original,stem:q.ocrText??''})}>Soạn lại từ chữ OCR</button>}{meta.mathOcrAvailable&&<button className="btn sm mt" type="button" onClick={()=>setMathOcr(true)}>Nhận dạng công thức · thử nghiệm</button>}<p className="tiny muted">Chữ OCR có thể sai ký hiệu Toán. Hãy kiểm tra từng công thức.</p></aside>}
    <div className="stack question-edit-content">
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
      <label className="field">Nhóm câu dùng chung dữ kiện (nếu có)<input className="input" maxLength={40} value={q.group_id ?? ''} onChange={e => set({group_id:e.target.value || null})} placeholder="Các câu cùng nhóm sẽ nằm liền nhau khi đảo đề" /></label>
      <div className="field">
        <label>Đề bài</label>
        <Suspense fallback={<span className="tiny muted">Đang mở trình soạn…</span>}><RichField label="Đề bài" value={q.stem} onChange={stem=>set({stem,...(original?{sourceStem:original}:{})})}/></Suspense>
      </div>
      {(q.ocrText || /^\s*(\[\[img:\d+\]\]\s*)+$/.test(q.stem)) && <label className="field">Chữ OCR tham khảo (có thể sai ký hiệu Toán; ảnh gốc ở trên được giữ nguyên)<textarea className="input" value={q.ocrText ?? ''} onChange={e=>set({ocrText:e.target.value})} /></label>}
      {q.type === 'mcq' &&
        opts.map((o, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
            <label className="check" title="Đáp án đúng" style={{ paddingTop: 10 }}>
              <input type="radio" name={`ans-${uid}`} checked={q.answer === i} onChange={() => set({ answer: i })} />
              <b>{'ABCD'[i]}</b>
            </label>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Suspense fallback={<span className="tiny muted">Đang mở trình soạn…</span>}><RichField compact label={`Phương án ${'ABCD'[i]}`} value={o} onChange={v=>setOpt(i,v)}/></Suspense>
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
            <div className="grow"><Suspense fallback={<span className="tiny muted">Đang mở trình soạn…</span>}><RichField compact label={`Ý ${'abcd'[i]}`} value={o} onChange={v=>setOpt(i,v)}/></Suspense></div>
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
        </div>
      )}
      <div className="field">
        <label>Lời giải</label>
        <Suspense fallback={<span className="tiny muted">Đang mở trình soạn…</span>}><RichField label="Lời giải" value={q.explanation} onChange={explanation=>set({explanation})}/></Suspense>
      </div>
    </div>
    {mathOcr&&<Suspense fallback={<p className="tiny muted">Đang mở nhận dạng…</p>}><MathOcrReview type={q.type} sourceStem={original} onClose={()=>setMathOcr(false)} onApply={candidate=>set({sourceStem:original,stem:candidate.stem,options:candidate.options,answer:q.type==='tf'?[null,null,null,null]:null})}/></Suspense>}
    </div>
  );
}
