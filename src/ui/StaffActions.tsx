import { FormEvent, useState } from 'react';
import { post } from '../api';
import { ErrorBox, Modal, useApp } from './kit';

type Action = 'reopen' | 'score' | 'extend';
export function AttemptActions({ attemptId, status, onDone }: { attemptId: number; status: string; onDone: () => void }) {
  const { toast } = useApp();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [value, setValue] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const labels = { reopen: 'Mở lại lượt thi', score: 'Điều chỉnh điểm', extend: 'Gia hạn lượt thi' };
  const open = (a: Action) => { setAction(a); setReason(''); setValue(a === 'score' ? '' : '15'); setError(''); };
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!action) return; setBusy(true); setError('');
    try { await post(`/api/attempts/${attemptId}/${action}`, { reason, ...(action === 'score' ? {score10:Number(value)} : {minutes:Number(value)}) }); toast('Đã lưu thay đổi và ghi nhật ký.'); setAction(null); onDone(); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="row" onClick={e => e.stopPropagation()}>
    {status === 'in_progress' ? <button className="btn sm" onClick={() => open('extend')}>Gia hạn</button> : <><button className="btn sm" onClick={() => open('reopen')}>Mở lại</button><button className="btn sm" onClick={() => open('score')}>Sửa điểm</button></>}
    {action && <Modal title={labels[action]} onClose={() => { if (!busy) setAction(null); }}><form className="stack" onSubmit={save}>
      <p className="small muted">{action === 'reopen' ? 'Bài sẽ được mở lại để học sinh làm tiếp. Kết quả cũ được thay thế khi em nộp lại.' : action === 'score' ? 'Điều chỉnh điểm tổng trên thang 10. Đáp án và điểm từng câu giữ nguyên.' : 'Cộng thêm thời gian cho lượt thi đang làm.'}</p>
      <label className="field">{action === 'score' ? 'Điểm mới (0–10)' : 'Số phút thêm'}<input className="input" type="number" required min={action === 'score' ? 0 : action === 'reopen' ? 5 : 1} max={action === 'score' ? 10 : action === 'reopen' ? 180 : 120} step={action === 'score' ? '.01' : '1'} value={value} onChange={e => setValue(e.target.value)} /></label>
      <label className="field">Lý do (ít nhất 5 ký tự)<textarea className="input" required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <ErrorBox error={error} />}
      <button className="btn primary" disabled={busy || reason.trim().length < 5}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
    </form></Modal>}
  </div>;
}

export function AssignmentExtension({ id, onDone }: { id: number; onDone: () => void }) {
  const { toast } = useApp();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [reason, setReason] = useState(''), [minutes, setMinutes] = useState(30), [error, setError] = useState('');
  return <><button className="btn sm" onClick={() => setOpen(true)}>Lùi giờ đóng bài</button>{open && <Modal title="Lùi giờ đóng cho cả lớp" onClose={() => { if (!busy) setOpen(false); }}><form className="stack" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); try { await post(`/api/assignments/${id}/extend`, {minutes, reason}); toast('Đã lùi giờ đóng bài.'); setOpen(false); onDone(); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }}><label className="field">Số phút lùi thêm<input className="input" type="number" min={1} max={20160} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><label className="field">Lý do<textarea className="input" required minLength={5} value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <ErrorBox error={error} />}<button className="btn primary" disabled={busy || reason.trim().length < 5}>{busy ? 'Đang lưu…' : 'Lưu giờ đóng mới'}</button></form></Modal>}</>;
}
