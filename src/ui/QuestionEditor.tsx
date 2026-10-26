// Sửa một câu hỏi (dùng ở Ngân hàng và Nhập đề). Có xem trước công thức.
import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { MathText } from './MathText';
import { useApp } from './kit';
import { post } from '../api';
const RichField=lazy(()=>import('./RichField'));
const MathOcrReview=lazy(()=>import('./MathOcrReview'));

export type Draft = { id?: number; type: 'mcq' | 'tf' | 'short'; stem: string; options: string[]; answer: any; explanation: string; topic: string | null; level: number; distractors?: any; group_id?: string | null; ocrText?: string; sourceStem?: string };

export function QuestionEditor({ q, onChange }: { q: Draft; onChange: (q: Draft) => void }) {
  const { meta } = useApp();
  const uid = useId();
  const [mathOcr,setMathOcr]=useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [showDups, setShowDups] = useState(false);
  const [testExpr, setTestExpr] = useState('');
  const [testResult, setTestResult] = useState<{ equivalent?: boolean; error?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showMathTest, setShowMathTest] = useState(false);

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

  useEffect(() => {
    const rawStem = (q.stem || '').replace(/\[\[img:[^\]]+\]\]/g, '').trim();
    if (rawStem.length < 20) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await post<{ duplicates: any[] }>('/api/questions/check-duplicate', {
          stem: q.stem,
          currentId: q.id,
        });
        setDuplicates(res.duplicates || []);
      } catch {
        // bỏ qua nếu lỗi mạng hoặc không có quyền
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [q.stem, q.id]);

  const handleTestVerify = async () => {
    if (!testExpr.trim() || !q.answer) return;
    setVerifying(true);
    setTestResult(null);
    try {
      const res = await post<{ equivalent: boolean; error?: string }>('/api/math/verify', {
        expr1: String(q.answer).split(';')[0].trim(),
        expr2: testExpr.trim(),
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ equivalent: false, error: e.message || 'Lỗi kiểm tra' });
    } finally {
      setVerifying(false);
    }
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
        {duplicates.length > 0 && (
          <div className="callout warning" style={{ padding: '8px 12px', fontSize: 13, marginTop: 8, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: showDups ? 6 : 0 }}>
              <span style={{ color: '#92400e', fontWeight: 600 }}>⚠️ Phát hiện {duplicates.length} câu tương tự trong ngân hàng ({Math.round(duplicates[0].score * 100)}% trùng)</span>
              <button type="button" className="btn sm plain" onClick={() => setShowDups(!showDups)}>
                {showDups ? 'Ẩn' : 'Xem câu trùng'}
              </button>
            </div>
            {showDups && (
              <div className="stack" style={{ gap: 6, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                {duplicates.map((d: any) => (
                  <div key={d.id} style={{ borderTop: '1px dashed #fcd34d', paddingTop: 4 }}>
                    <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 2 }}>
                      <span className="badge sm" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Câu #{d.id} · {Math.round(d.score * 100)}%</span>
                      <span className="tiny muted">{d.reason}</span>
                    </div>
                    <div className="tiny" style={{ color: '#4b5563', lineHeight: 1.4 }}>
                      <MathText text={d.stem.length > 130 ? d.stem.slice(0, 130) + '…' : d.stem} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input className="input" style={{ maxWidth: 260 }} value={q.answer ?? ''} onChange={(e) => set({ answer: e.target.value })} placeholder="VD: 1/2; 0.5" />
            {meta.mathVerifyAvailable && (
              <button type="button" className="btn sm" onClick={() => setShowMathTest(!showMathTest)}>
                {showMathTest ? 'Đóng kiểm tra' : 'Kiểm tra tương đương (SymPy)'}
              </button>
            )}
          </div>
          {showMathTest && (
            <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }}>
              <p className="tiny muted" style={{ margin: '0 0 6px 0' }}>Nhập thử cách viết khác của học sinh (phân số, căn, biểu thức tương đương):</p>
              <div className="row" style={{ gap: 8 }}>
                <input className="input sm" value={testExpr} onChange={(e) => setTestExpr(e.target.value)} placeholder="VD: \frac{1}{2} hoặc 0,5" style={{ maxWidth: 220 }} />
                <button type="button" className="btn sm primary" disabled={verifying || !testExpr.trim()} onClick={handleTestVerify}>
                  {verifying ? 'Đang tính…' : 'Thử nghiệm'}
                </button>
              </div>
              {testResult && (
                <p className="tiny" style={{ marginTop: 6, fontWeight: 600, color: testResult.equivalent ? '#15803d' : '#b91c1c' }}>
                  {testResult.equivalent ? '✓ Khớp tương đương toán học với đáp án!' : '✗ Không khớp tương đương với đáp án.'}
                  {testResult.error && ` (${testResult.error})`}
                </p>
              )}
            </div>
          )}
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
