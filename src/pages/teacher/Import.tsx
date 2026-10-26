import { useEffect, useMemo, useRef, useState } from 'react';
import { api, download, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { PageHeading, go, LevelBadge, topicName, TypeBadge, Icon, useApp, useRoute } from '../../ui/kit';
import { QuestionEditor } from '../../ui/QuestionEditor';
import ImportJobsPanel from '../../ui/ImportJobsPanel';

const SAMPLE = `PHẦN I
Câu 1. Đạo hàm của hàm số $y = x^4$ là
A. $4x^3$   B. $x^3$   C. $4x$   D. $x^4$
Đáp án: A
Câu 2. Trong không gian Oxyz, mặt cầu $(x-2)^2+y^2+(z+1)^2=4$ có bán kính bằng
A. 4
*B. 2
C. 16
D. $\\sqrt2$
PHẦN III
Câu 1. Tính $\\int_0^3 2x\\,dx$.
Đáp án: 9`;

function problems(q: any) {
  const p: string[] = [];
  if (!q.stem?.trim()) p.push('thiếu đề bài');
  if (!q.topic) p.push('chưa chọn chuyên đề');
  if (q.type === 'mcq' && !Number.isInteger(q.answer)) p.push('chưa chọn đáp án');
  if (q.type === 'mcq' && q.options.some((o: string) => !o?.trim())) p.push('thiếu phương án');
  if (q.type === 'tf' && (!Array.isArray(q.answer) || q.answer.some((x: any) => typeof x !== 'boolean'))) p.push('chưa đủ Đúng/Sai 4 ý');
  if (q.type === 'short' && !String(q.answer ?? '').trim()) p.push('chưa có đáp án');
  return p;
}

export function ImportPage() {
  const { meta, toast } = useApp();
  const { query } = useRoute();
  const classId=query.get('classId');
  const classSuffix=classId&&/^\d+$/.test(classId)?`?classId=${classId}`:'';
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [readingPdf, setReadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ questions: any[]; warnings: string[]; info: any; origin: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [saved, setSaved] = useState<number[] | null>(null);
  const [jobId,setJobId]=useState<number|null>(null);
  const [jobsRefresh,setJobsRefresh]=useState(0);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'dirty' | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [originalQuestions, setOriginalQuestions] = useState<any[] | null>(null);
  const saveTimerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [riskFirst, setRiskFirst] = useState(true);
  const [rawOpen, setRawOpen] = useState<Set<number>>(new Set());
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (draftStatus === 'dirty' || draftStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draftStatus]);

  const triggerDraftSave = (newQuestions: any[]) => {
    if (!jobId || saved) return;
    setDraftStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api('PUT', `/api/import/jobs/${jobId}/draft`, { questions: newQuestions });
        setDraftStatus('saved');
        setHasDraft(true);
      } catch {
        setDraftStatus('dirty');
      }
    }, 1200);
  };

  const revertToOriginal = async () => {
    if (!originalQuestions || !jobId) return;
    if (!confirm('Khôi phục lại danh sách câu hỏi gốc nhận diện ban đầu và xóa các chỉnh sửa nháp?')) return;
    try {
      await api('DELETE', `/api/import/jobs/${jobId}/draft`);
      setResult((cur: any) => cur && { ...cur, questions: originalQuestions });
      setHasDraft(false);
      setDraftStatus(null);
      toast('Đã khôi phục kết quả nhận diện gốc.');
    } catch (e: any) {
      toast(e.message);
    }
  };

  // Nạp file đáp án rời, đối chiếu với các câu đang duyệt; nguồn nào mâu thuẫn thì câu bị để trống và đánh dấu.
  const loadKey = async (file: File) => {
    if (!result) return;
    setBusy(true);
    setKeyMsg(null);
    try {
      const k = await api('POST', `/api/import/answers?filename=${encodeURIComponent(file.name)}`, undefined, { raw: await file.arrayBuffer(), timeoutMs: 120000 });
      const r = await post('/api/import/apply-key', { questions: result.questions, entries: k.entries, kind: result.info?.kind });
      setResult((cur) => cur && { ...cur, questions: r.questions });
      setKeyMsg(`Đã đối chiếu ${r.applied}/${k.count} đáp án từ ${file.name}.${r.conflicts ? ` ${r.conflicts} câu mâu thuẫn với nguồn khác — kiểm tra lại.` : ''}${r.unmatched.length ? ` ${r.unmatched.length} đáp án không khớp câu nào.` : ''}`);
    } catch (e: any) {
      setKeyMsg(e.message);
    } finally {
      setBusy(false);
      if (keyRef.current) keyRef.current.value = '';
    }
  };

  const parseFiles = async (files: File[]) => {
    if (busy) return;
    if(files.length>10){setError('Mỗi lần chọn tối đa 10 file.');return;}
    setBusy(true);
    setReadingPdf(false);
    setError(null);
    setSaved(null);
    try {
      let queued=0;
      for(const file of files) {
        await api('POST', `/api/import/jobs?filename=${encodeURIComponent(file.name)}`, undefined, { raw: await file.arrayBuffer() });queued++;
        setJobsRefresh(v=>v+1);
      }
      toast(`Đã đưa ${queued} file vào hàng đợi. Bạn có thể rời trang khi đang xử lý.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setReadingPdf(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const parseText = async () => {
    setJobId(null);
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const r = await post('/api/import', { text });
      setResult({ ...r, origin: 'Văn bản dán' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const update = (i: number, q: any) => {
    setResult((r) => {
      if (!r) return r;
      const nextQuestions = r.questions.map((x, k) => (k === i ? { ...x, ...q, tagConfidence: 1 } : x));
      triggerDraftSave(nextQuestions);
      return { ...r, questions: nextQuestions };
    });
  };
  const remove = (i: number) => {
    setResult((r) => {
      if (!r) return r;
      const nextQuestions = r.questions.filter((_, k) => k !== i);
      triggerDraftSave(nextQuestions);
      return { ...r, questions: nextQuestions };
    });
  };
  const save = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const r = await post('/api/import/save', { questions: result.questions, origin: result.origin,jobId });
      setSaved(r.ids);
      toast(`Đã lưu ${r.ids.length} câu vào ngân hàng ở trạng thái nháp.`);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const approveValid = async () => {
    if (!saved) return;
    setBusy(true);
    try {
      const ids=saved.filter((_,i)=>problems(result?.questions[i] ?? {}).length===0);
      const r = await post('/api/questions/approve', { ids });
      toast(`Đã duyệt ${r.approved.length} câu.${r.pending?.length ? ` ${r.pending.length} câu chờ người duyệt thứ hai.` : ''}${r.rejected.length ? ` ${r.rejected.length} câu cần sửa thêm ở Ngân hàng.` : ''}`);
      go(`/ngan-hang${classSuffix}`);
    } catch(e:any) {toast(e.message);} finally {setBusy(false);}
  };

  const qs = result?.questions ?? [];
  // Câu đáng ngờ xếp lên trước (giữ nguyên thứ tự trong cùng mức) để xem kỹ nhất những câu dễ sai.
  const order = useMemo(() => {
    const idx = qs.map((_, i) => i);
    if (riskFirst) idx.sort((a, b) => (qs[b].suspicion?.score ?? 0) - (qs[a].suspicion?.score ?? 0) || a - b);
    return idx;
  }, [qs, riskFirst]);
  const risky = qs.filter((q) => q.suspicion && q.suspicion.level !== 'low').length;
  const ready = qs.filter((q) => problems(q).length === 0).length;
  return (
    <div className="stack import-page">
      <PageHeading title="Nhập đề" icon="import" description="Tách câu hỏi từ file, kiểm tra và lưu vào ngân hàng." />
      <ol className="import-steps" aria-label="Quy trình nhập đề">
        {['Chọn nguồn đề','Kiểm tra câu hỏi','Lưu vào ngân hàng'].map((label,i)=>{
          const current=saved ? 2 : result ? 1 : 0;
          return <li key={label} className={i<current?'complete':i===current?'current':''} aria-current={i===current?'step':undefined}><span aria-hidden="true">{i<current?<Icon name="check"/>:i+1}</span>{label}</li>;
        })}
      </ol>
      <ImportJobsPanel
        refresh={jobsRefresh}
        onOpen={(job) => {
          const isDraft = Boolean(job.draftQuestions?.length);
          const questions = isDraft ? job.draftQuestions : (job.result?.questions ?? []);
          setOriginalQuestions(job.result?.questions ?? []);
          setHasDraft(isDraft);
          setResult({
            ...job.result,
            questions,
            origin: job.name,
          });
          setSaved(job.savedIds);
          setJobId(job.id);
          setOpen(null);
          setError(null);
          setDraftStatus(isDraft ? 'saved' : null);
        }}
      />
      {!result && (
        <div className="card">
          <div className="seg mb">
            <button className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
              Chọn file
            </button>
            <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>
              Dán văn bản
            </button>
          </div>
          {mode === 'file' ? (
            <div className="stack">
              <label
                className="import-dropzone"
                style={{ borderStyle: 'dashed', cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label="Chọn file đề thi"
                aria-disabled={busy}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    if (!busy) fileRef.current?.click();
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if(e.dataTransfer.files.length)parseFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <input ref={fileRef} type="file" multiple hidden disabled={busy} accept=".docx,.pdf,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp" onChange={(e) => e.target.files?.length && parseFiles(Array.from(e.target.files))} />
                <span className="page-intro-icon"><Icon name="upload" /></span><div className="strong" role="status">{busy ? 'Đang đưa file vào hàng đợi…' : 'Kéo thả file vào đây hoặc bấm để chọn'}</div>
                <div className="small muted">Word, PDF có chữ hoặc scan, Excel/CSV và văn bản. PDF scan tự OCR trên máy, giữ công thức và hình trong ảnh từng câu; có thể mất vài phút.</div>
              </label>
              <div className="row small">
                <button className="btn sm" onClick={() => download('/api/import/template.csv', 'mau-nhap-cau-hoi.csv').catch((e) => toast(e.message))}>
                  Tải file Excel/CSV mẫu
                </button>
                {!meta.aiEnabled && <span className="tiny muted">PDF scan được OCR trên máy. Ảnh JPG/PNG riêng lẻ cần bật AI trong phần Tài khoản.</span>}
              </div>
              <div className="import-next small"><Icon name="bank"/><span>Sau khi nhập, duyệt câu hỏi trong <a href={`#/ngan-hang${classSuffix}`}>Ngân hàng câu hỏi</a>, rồi <a href={`#/ra-de${classSuffix}`}>tạo đề để giao cho lớp</a>.</span></div>
            </div>
          ) : (
            <div className="stack">
              <textarea className="input" aria-label="Nội dung đề thi" style={{ minHeight: 190, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Dán đề vào đây. Mỗi câu bắt đầu bằng "Câu 1.", phương án "A. B. C. D.", ý đúng/sai "a) b) c) d)". Đánh dấu đáp án bằng * hoặc dòng "Đáp án: B".'} />
              <div className="row between">
                <button className="btn ghost sm" onClick={() => setText(SAMPLE)}>
                  Dùng đoạn mẫu
                </button>
                <button className="btn primary" disabled={busy || !text.trim()} onClick={parseText}>
                  {busy ? 'Đang tách câu…' : 'Tách câu'}
                </button>
              </div>
            </div>
          )}
          {error && <div className="alert error mt">{error}</div>}
        </div>
      )}

      {result && (
        <>
          <div className="card import-result-summary">
            <div className="row between">
              <div>
                <div className="strong">
                  {result.origin}: tách được {qs.length} câu
                </div>
                <div className="small muted">
                  {ready} câu đủ thông tin · {qs.length - ready} câu cần bổ sung
                  {result.info?.equations ? ` · đọc ${result.info.equations} công thức` : ''}
                  {result.info?.ocr ? ` · OCR ${result.info.ocrPages} trang · giữ ảnh gốc` : ''}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setResult(null);
                    setSaved(null);
                    setJobId(null);
                  }}
                >
                  Nhập đề khác
                </button>
                {!saved ? (
                  <button className="btn primary" disabled={busy || !qs.length} onClick={save}>
                    Lưu {qs.length} câu vào ngân hàng
                  </button>
                ) : (
                    <button className="btn good" disabled={busy || ready===0} onClick={approveValid}>
                    Duyệt {ready} câu hợp lệ
                  </button>
                )}
              </div>
            </div>
            <div className="row mt small" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="muted">{risky} câu cần xem kỹ</span>
              <label className="row" style={{ gap: 4 }}>
                <input type="checkbox" checked={riskFirst} onChange={(e) => setRiskFirst(e.target.checked)} /> Câu đáng ngờ lên trước
              </label>
              {jobId && !saved && (
                <div className="row" style={{ gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                  {draftStatus === 'saving' && <span className="tiny muted">💾 Đang lưu nháp…</span>}
                  {draftStatus === 'saved' && <span className="tiny text-success" style={{ color: '#16a34a', fontWeight: 600 }}>✓ Đã lưu nháp tự động</span>}
                  {draftStatus === 'dirty' && <span className="tiny text-warning" style={{ color: '#d97706' }}>⚠️ Chưa lưu được nháp</span>}
                  {hasDraft && (
                    <button type="button" className="btn ghost sm" onClick={revertToOriginal} style={{ fontSize: 11, padding: '2px 8px' }}>
                      ↺ Khôi phục bản gốc OCR
                    </button>
                  )}
                </div>
              )}
              {!saved && (
                <>
                  <input ref={keyRef} type="file" hidden accept=".docx,.pdf,.xlsx,.csv,.txt" onChange={(e) => e.target.files?.[0] && loadKey(e.target.files[0])} />
                  <button className="btn sm" disabled={busy} onClick={() => keyRef.current?.click()}>
                    Nạp file đáp án rời
                  </button>
                </>
              )}
            </div>
            {keyMsg && <div className="alert warn small mt">{keyMsg}</div>}
            {result.warnings.length>0 && <details className="import-notes"><summary>Thông tin nhận dạng ({result.warnings.length})</summary>{result.warnings.map((w, i) => (
              <div key={i} className="alert warn small mt">
                {w}
              </div>
            ))}</details>}
            {saved && <div className="alert ok small mt">Đã lưu {saved.length} câu nháp. <a href={`#/ngan-hang${classSuffix}`}>Mở ngân hàng để sửa và duyệt câu hỏi</a>. Câu đã duyệt có thể dùng để tạo đề.</div>}
          </div>
          <div className="stack">
            {order.map((i) => {
              const q = qs[i];
              const p = problems(q);
              const low = (q.tagConfidence ?? 1) < 0.5;
              return (
                <div key={i} className="card flat">
                  <div className="row mb" style={{ gap: 6 }}>
                    <span className="badge blue">
                      {q.part ? `Phần ${q.part} · ` : ''}Câu {q.num}
                    </span>
                    <TypeBadge type={q.type} />
                    <LevelBadge level={q.level} />
                    <span className={`badge ${low ? 'amber' : ''}`} title="Máy đoán chuyên đề; kiểm tra lại nếu độ tin cậy thấp">
                      {topicName(meta, q.topic)}
                      {low ? ' · cần xem' : ''}
                    </span>
                    {p.length > 0 && <span className="badge red">{p.join(', ')}</span>}
                    {q.suspicion && q.suspicion.level !== 'low' && (
                      <span className={`badge ${q.suspicion.level === 'high' ? 'red' : 'amber'}`} title={q.suspicion.reasons.join(' · ')}>
                        {q.suspicion.level === 'high' ? 'Cần xem kỹ' : 'Nên xem'}
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    {q.raw && (
                      <button
                        className="btn ghost sm"
                        onClick={() =>
                          setRawOpen((cur) => {
                            const n = new Set(cur);
                            n.has(i) ? n.delete(i) : n.add(i);
                            return n;
                          })
                        }
                      >
                        {rawOpen.has(i) ? 'Ẩn bản gốc' : 'So bản gốc'}
                      </button>
                    )}
                    {!saved && (
                      <>
                        <button className="btn sm" onClick={() => setOpen(open === i ? null : i)}>
                          {open === i ? 'Xong' : 'Sửa'}
                        </button>
                        <button className="btn ghost sm" onClick={() => remove(i)} aria-label="Bỏ câu này">
                          Bỏ
                        </button>
                      </>
                    )}
                  </div>
                  {q.suspicion && q.suspicion.level !== 'low' && <details className="import-question-notes" open={p.length>0}>
                    <summary>Lưu ý cần kiểm tra ({q.suspicion.reasons.length})</summary>
                    <ul className="tiny mb" style={{ margin: '0 0 6px', paddingLeft: 18, color: 'var(--warn)' }}>
                      {q.suspicion.reasons.map((r: string, k: number) => (
                        <li key={k}>{r}</li>
                      ))}
                    </ul>
                  </details>}
                  {rawOpen.has(i) && (
                    <div className="grid-2 mb" style={{ gap: 8 }}>
                      <div>
                        <div className="tiny muted">Bản gốc trong file</div>
                        <pre className="small" style={{ whiteSpace: 'pre-wrap', margin: 0, padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>{q.raw}</pre>
                      </div>
                      <div>
                        <div className="tiny muted">Máy đã tách thành</div>
                        <div className="small" style={{ padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
                          <MathText as="div" text={q.stem} />
                          {q.options?.filter(Boolean).map((o: string, k: number) => (
                            <div key={k}>
                              <b>{q.type === 'tf' ? 'abcd'[k] + ')' : 'ABCD'[k] + '.'}</b> <MathText text={o} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {open === i ? (
                    <QuestionEditor q={q} onChange={(nq) => update(i, nq)} />
                  ) : (
                    <>
                      {((q.sourceStem || q.stem.includes('[[img:')) && q.ocrText) ? (
                        <div className="side-by-side-ocr mb" style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                          <div className="row" style={{ background: 'var(--bg-subtle, #f8fafc)', padding: '6px 12px', borderBottom: '1px solid var(--line)', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                              <span className="tiny" style={{ fontWeight: 600 }}>Đối chiếu scan:</span>
                              <span className={`badge sm ${q.stem.includes('[[img:') ? 'blue' : 'green'}`}>
                                {q.stem.includes('[[img:') ? '🖼️ Đang hiển thị ảnh scan gốc' : '✏️ Đang hiển thị text OCR'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => {
                                if (q.stem.includes('[[img:')) {
                                  update(i, { ...q, sourceStem: q.sourceStem || q.stem, stem: q.ocrText });
                                } else {
                                  update(i, { ...q, stem: q.sourceStem || q.stem });
                                }
                              }}
                            >
                              {q.stem.includes('[[img:') ? 'Chuyển sang text OCR' : 'Khôi phục ảnh scan gốc'}
                            </button>
                          </div>
                          <div className="grid-2" style={{ gap: 0 }}>
                            <div style={{ padding: 10, borderRight: '1px solid var(--line)', background: '#fff' }}>
                              <div className="tiny muted mb">Ảnh quét gốc:</div>
                              <MathText as="div" className="q-stem" text={q.sourceStem || q.stem} />
                            </div>
                            <div style={{ padding: 10, background: '#fafbfc' }}>
                              <div className="tiny muted mb">Nội dung text OCR:</div>
                              <MathText as="div" className="q-stem" text={q.stem.includes('[[img:') ? q.ocrText : q.stem} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <MathText as="div" className="q-stem" text={q.stem} />
                      )}
                      {q.ocrText && !((q.sourceStem || q.stem.includes('[[img:')) && q.ocrText) && (
                        <details className="small muted mt"><summary>Chữ OCR tham khảo · Phần {q.part}, câu {q.num}{q.scanPages ? ` · trang ${q.scanPages.join(', ')}` : ''}</summary><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{q.ocrText}</pre></details>
                      )}
                      {q.type !== 'short' && (
                        <div className="grid-2 mt" style={{ gap: 4 }}>
                          {q.options.map((o: string, k: number) => (
                            <div key={k} className="small" style={q.type === 'mcq' && q.answer === k ? { color: 'var(--good)', fontWeight: 700 } : undefined}>
                              <b>{q.type === 'mcq' ? 'ABCD'[k] + '.' : 'abcd'[k] + ')'}</b> <MathText text={o} />
                              {q.type === 'tf' && Array.isArray(q.answer) && typeof q.answer[k] === 'boolean' && <span className={`badge ${q.answer[k] ? 'green' : 'red'}`} style={{ marginLeft: 6 }}>{q.answer[k] ? 'Đ' : 'S'}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.type === 'short' && <div className="small mt">Đáp án: <b>{q.answer ?? '—'}</b></div>}
                      {q.warnings?.filter((w: string) => !w.startsWith('Chưa có đáp án') && !w.startsWith('Nội dung chính là ảnh gốc')).map((w: string, k: number) => (
                        <div key={k} className="tiny" style={{ color: 'var(--warn)' }}>
                          {w}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
