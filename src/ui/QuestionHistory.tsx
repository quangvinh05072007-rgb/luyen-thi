import { useState } from 'react';
import { get, post } from '../api';
import { MathText } from './MathText';
import { ErrorBox, fmtDateTime, Loading, useApp, useAsync } from './kit';

export function QuestionHistory({ id, onRestored }: { id: number; onRestored: () => void }) {
  const { toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get(`/api/questions/${id}/versions`), [id]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const restore = async (version: number) => {
    if (!confirm(`Khôi phục phiên bản ${version}? Nội dung hiện tại được lưu vào lịch sử; đề đã giao giữ nguyên.`)) return;
    setBusy(true);
    try { await post(`/api/questions/${id}/restore`, { version, reason }); toast('Đã khôi phục phiên bản.'); reload(); onRestored(); }
    catch (e: any) { toast(e.message); } finally { setBusy(false); }
  };
  return <section className="stack">
    <h3>Lịch sử câu hỏi</h3>
    {loading && <Loading />}{error && <ErrorBox error={error} onRetry={reload} />}
    {data?.versions.length === 0 && <p className="small muted">Chưa có phiên bản cũ. Khi sửa câu hỏi, nội dung trước đó sẽ được lưu ở đây.</p>}
    {!!data?.versions.length && <label className="field">Lý do khôi phục (ít nhất 5 ký tự)<input className="input" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} /></label>}
    {data?.versions.map((v: any) => <details key={v.version} className="version-item">
      <summary>Phiên bản {v.version} · {fmtDateTime(v.at)}<span className="tiny muted"> · {v.by}</span></summary>
      <p className="tiny muted mt">{v.reason}</p>
      <MathText as="div" text={v.snapshot.stem ?? ''} />
      <div className="small muted mt">Đáp án: {v.snapshot.type === 'mcq' ? 'ABCD'[v.snapshot.answer] : Array.isArray(v.snapshot.answer) ? v.snapshot.answer.map((a: boolean) => a ? 'Đ' : 'S').join(', ') : String(v.snapshot.answer ?? '—')}</div>
      <MathText as="div" className="small mt" text={v.snapshot.explanation ?? ''} />
      <button className="btn sm mt" disabled={busy || reason.trim().length < 5} onClick={() => restore(v.version)}>Khôi phục phiên bản này</button>
    </details>)}
  </section>;
}
