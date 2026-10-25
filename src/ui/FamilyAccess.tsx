import { useEffect, useState } from 'react';
import { get, post } from '../api';
import { fmtDate } from './kit';

type Access = { active: boolean; createdAt: number | null; expiresAt: number | null };
export function FamilyAccess({ studentId }: { studentId: number }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(90);
  const endpoint = `/api/students/${studentId}/family-access`;
  useEffect(() => {
    let live = true;
    setCode(''); setAccess(null); setError(''); setNotice('');
    get<Access>(endpoint).then((data) => { if (live) setAccess(data); }).catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [endpoint]);
  async function issue() {
    setBusy(true); setError(''); setNotice(''); setCode('');
    try {
      const result = await post<{ code: string; expiresAt: number }>(endpoint, { expiresInDays: days });
      setCode(result.code); setAccess({ active: true, createdAt: Date.now(), expiresAt: result.expiresAt });
    } catch (err) { setError(err instanceof Error ? err.message : 'Không cấp được mã.'); }
    finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true); setError(''); setNotice('');
    try { await post(`${endpoint}/revoke`); setCode(''); setAccess((previous) => previous ? { ...previous, active: false } : null); setNotice('Đã thu hồi mã và toàn bộ phiên phụ huynh.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không thu hồi được mã.'); }
    finally { setBusy(false); }
  }
  async function copy() {
    const link = `${location.origin}${location.pathname}#/phu-huynh`;
    try { await navigator.clipboard.writeText(`Cổng phụ huynh SmartExam: ${link}\nMã liên kết: ${code}\nGiữ kín mã. Hết hạn: ${access?.expiresAt ? fmtDate(access.expiresAt) : ''}`); setNotice('Đã sao chép đường dẫn và mã. Gửi riêng cho phụ huynh của học sinh này.'); }
    catch { setNotice('Trình duyệt chưa cho phép sao chép. Hãy chọn mã bên dưới và sao chép thủ công cùng đường dẫn cổng phụ huynh.'); }
  }
  return <section className="card mb" aria-label="Liên kết phụ huynh">
    <h2>Liên kết phụ huynh</h2><p>Phụ huynh dùng mã riêng để xem điểm đã công bố, tình hình nộp bài và gợi ý học tập của học sinh này.</p>
    {error && <p className="notice red" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {!access && !error ? <p role="status">Đang kiểm tra mã liên kết…</p> : <>
      <p>{access?.active ? <>Mã đang hoạt động · Hết hạn {access.expiresAt ? fmtDate(access.expiresAt) : ''}</> : 'Chưa có mã đang hoạt động.'}</p>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>Thời hạn mã<select value={days} onChange={(event) => setDays(Number(event.target.value))} disabled={busy} style={{ display: 'block', marginTop: 6 }}><option value={30}>30 ngày</option><option value={90}>90 ngày</option><option value={180}>180 ngày</option><option value={365}>365 ngày</option></select></label>
        <button className="btn primary" disabled={busy} onClick={() => void issue()}>{busy ? 'Đang xử lý…' : access?.active ? 'Đổi mã liên kết' : 'Cấp mã liên kết'}</button>
        {access?.active && <button className="btn danger" disabled={busy} onClick={() => void revoke()}>Thu hồi quyền xem</button>}
      </div><p className="muted">Đổi hoặc thu hồi mã sẽ đăng xuất ngay mọi phiên phụ huynh đang dùng mã cũ.</p>
    </>}
    {code && <div className="notice" style={{ marginTop: 16 }}>
      <strong>Mã chỉ hiển thị trong lần cấp này. Sao chép trước khi rời trang.</strong>
      <p><code style={{ fontSize: 'clamp(14px, 2.5vw, 20px)', overflowWrap: 'anywhere', userSelect: 'all' }}>{code}</code></p>
      <p>Đường dẫn: <a href="#/phu-huynh">{location.origin}{location.pathname}#/phu-huynh</a></p>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}><button className="btn secondary" onClick={() => void copy()}>Sao chép mã và đường dẫn</button><button className="btn ghost" onClick={() => setCode('')}>Đã lưu, ẩn mã</button></div>
      <p className="muted">Gửi riêng cho đúng phụ huynh. Bất kỳ ai có mã đều có thể xem dữ liệu của học sinh này trong thời hạn mã.</p>
    </div>}
  </section>;
}
