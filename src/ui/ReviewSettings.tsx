import { useState } from 'react';
import { get, put } from '../api';
import { ErrorBox, Loading, useApp, useAsync } from './kit';

export function ReviewSettings() {
  const { toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/admin/settings'), []);
  const [busy, setBusy] = useState(false);
  const save = async (reviewPolicy: string) => {
    setBusy(true);
    try { await put('/api/admin/settings', { reviewPolicy }); toast('Đã cập nhật chính sách duyệt.'); reload(); }
    catch (e: any) { toast(e.message); }
    finally { setBusy(false); }
  };
  return <section className="card stack">
    <h2>Duyệt câu hỏi</h2>
    <p className="small muted">Áp dụng cho các lần duyệt mới. Câu đã duyệt được giữ lại; khi sửa nội dung, chính sách hai người yêu cầu duyệt lại.</p>
    {loading && <Loading />}{error && <ErrorBox error={error} onRetry={reload} />}
    {data && <label className="field">Chính sách của trường<select className="input" value={data.reviewPolicy} disabled={busy} onChange={e => save(e.target.value)}>
      <option value="single">Một giáo viên duyệt</option><option value="double">Hai người khác nhau duyệt</option>
    </select></label>}
    <p className="tiny muted">Với hai người duyệt, ít nhất một người phải khác tác giả. Câu đang chờ lượt duyệt thứ hai chưa được đưa vào đề.</p>
  </section>;
}
