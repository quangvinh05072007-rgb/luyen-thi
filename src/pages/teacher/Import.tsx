import { useRef, useState } from 'react';
import { api, download, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { go, LevelBadge, topicName, TypeBadge, useApp } from '../../ui/kit';
import { QuestionEditor } from '../../ui/QuestionEditor';

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
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ questions: any[]; warnings: string[]; info: any; origin: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [saved, setSaved] = useState<number[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const buf = await file.arrayBuffer();
      const r = await api('POST', `/api/import?filename=${encodeURIComponent(file.name)}`, undefined, { raw: buf, timeoutMs: 120000 });
      setResult({ ...r, origin: file.name });
      setOpen(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const parseText = async () => {
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
  const update = (i: number, q: any) => setResult((r) => r && { ...r, questions: r.questions.map((x, k) => (k === i ? { ...x, ...q, tagConfidence: 1 } : x)) });
  const remove = (i: number) => setResult((r) => r && { ...r, questions: r.questions.filter((_, k) => k !== i) });
  const save = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const r = await post('/api/import/save', { questions: result.questions, origin: result.origin });
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
    const r = await post('/api/questions/approve', { ids: saved });
    toast(`Đã duyệt ${r.approved.length} câu.${r.rejected.length ? ` ${r.rejected.length} câu cần sửa thêm ở Ngân hàng.` : ''}`);
    go('/ngan-hang');
  };

  const qs = result?.questions ?? [];
  const ready = qs.filter((q) => problems(q).length === 0).length;
  return (
    <div className="stack">
      <div>
        <h1>Nhập đề</h1>
        <p className="muted small">Không cần gõ lại: máy tách câu, phương án, đáp án, lời giải và đoán chuyên đề, mức độ. Bạn kiểm tra, sửa rồi lưu. Câu nhập vào mang nhãn Imported và ở trạng thái nháp.</p>
      </div>
      {!result && (
        <div className="card">
          <div className="seg mb">
            <button className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
              Tải file
            </button>
            <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>
              Dán văn bản
            </button>
          </div>
          {mode === 'file' ? (
            <div className="stack">
              <label
                className="card flat center"
                style={{ borderStyle: 'dashed', cursor: 'pointer', padding: 32 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) parseFile(f);
                }}
              >
                <input ref={fileRef} type="file" hidden accept=".docx,.pdf,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
                <div className="strong">{busy ? 'Đang đọc file…' : 'Kéo thả file vào đây hoặc bấm để chọn'}</div>
                <div className="small muted">Word .docx (đọc cả công thức Equation, đáp án gạch chân/tô đỏ), PDF có chữ, Excel .xlsx/.csv theo mẫu, .txt. Ảnh cần bật AI.</div>
              </label>
              <div className="row small">
                <button className="btn sm" onClick={() => download('/api/import/template.csv', 'mau-nhap-cau-hoi.csv').catch((e) => toast(e.message))}>
                  Tải file Excel/CSV mẫu
                </button>
                {!meta.aiEnabled && <span className="tiny muted">Nhập ảnh: {meta.aiHint}</span>}
              </div>
            </div>
          ) : (
            <div className="stack">
              <textarea className="input" style={{ minHeight: 260, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Dán đề vào đây. Mỗi câu bắt đầu bằng "Câu 1.", phương án "A. B. C. D.", ý đúng/sai "a) b) c) d)". Đánh dấu đáp án bằng * hoặc dòng "Đáp án: B".'} />
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
          <div className="card">
            <div className="row between">
              <div>
                <div className="strong">
                  {result.origin}: tách được {qs.length} câu
                </div>
                <div className="small muted">
                  {ready} câu đủ thông tin · {qs.length - ready} câu cần bổ sung
                  {result.info?.equations ? ` · đọc ${result.info.equations} công thức` : ''}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setResult(null);
                    setSaved(null);
                  }}
                >
                  Nhập file khác
                </button>
                {!saved ? (
                  <button className="btn primary" disabled={busy || !qs.length} onClick={save}>
                    Lưu {qs.length} câu vào ngân hàng
                  </button>
                ) : (
                  <button className="btn good" onClick={approveValid}>
                    Duyệt {ready} câu hợp lệ
                  </button>
                )}
              </div>
            </div>
            {result.warnings.map((w, i) => (
              <div key={i} className="alert warn small mt">
                {w}
              </div>
            ))}
            {saved && <div className="alert ok small mt">Đã lưu dạng nháp. Duyệt ngay các câu hợp lệ, hoặc vào Ngân hàng để sửa thêm.</div>}
          </div>
          <div className="stack">
            {qs.map((q, i) => {
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
                    <span style={{ flex: 1 }} />
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
                  {open === i ? (
                    <QuestionEditor q={q} onChange={(nq) => update(i, nq)} />
                  ) : (
                    <>
                      <MathText as="div" className="q-stem" text={q.stem} />
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
                      {q.warnings?.filter((w: string) => !w.startsWith('Chưa có đáp án')).map((w: string, k: number) => (
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
