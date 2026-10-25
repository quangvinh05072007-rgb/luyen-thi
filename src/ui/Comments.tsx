import { FormEvent, useState } from 'react';
import { get, post } from '../api';
import { ErrorBox, fmtDateTime, Loading, useAsync } from './kit';

export function Comments({ kind, id }: { kind: 'question' | 'exam'; id: number }) {
  const url = `/api/${kind}s/${id}/comments`;
  const { data, error, loading, reload } = useAsync(() => get(url), [url]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendError, setError] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await post(url, { body }); setBody(''); reload(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="stack" aria-label="Trao đổi chuyên môn">
    <h3>Trao đổi chuyên môn</h3>
    <p className="small muted">Giáo viên trong trường cùng góp ý. Bình luận được lưu trong lịch sử trao đổi.</p>
    {loading && <Loading />}{error && <ErrorBox error={error} onRetry={reload} />}
    {data?.comments.length === 0 && <p className="small muted">Chưa có góp ý. Bạn có thể mở đầu cuộc trao đổi.</p>}
    {data?.comments.map((c: any) => <article key={c.id} className="comment">
      <div className="row between"><b>{c.author}{c.mine ? ' (bạn)' : ''}</b><time className="tiny muted">{fmtDateTime(c.at)}</time></div>
      <p className="small preserve-lines">{c.body}</p>
    </article>)}
    <form onSubmit={send} className="stack">
      <label className="field">Góp ý của bạn<textarea className="input" value={body} maxLength={1000} rows={3} onChange={e => setBody(e.target.value)} required /></label>
      {sendError && <ErrorBox error={sendError} />}
      <div><button className="btn primary" disabled={busy || !body.trim()}>{busy ? 'Đang gửi…' : 'Gửi góp ý'}</button></div>
    </form>
  </section>;
}
