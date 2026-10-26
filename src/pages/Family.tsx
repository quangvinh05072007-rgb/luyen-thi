import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { fmtDate, fmtDateTime, fmtScore } from '../ui/kit';

type Dashboard = {
  student: { id: number; name: string; className: string };
  grades: { id: number; title: string; score10: number | null; submittedAt: number }[];
  participation: { id: number; title: string; closeAt: number; state: 'completed' | 'pending' | 'missed' }[];
  topics: { topic: string; name: string; value: number; n: number; confident: boolean }[];
  suggestions: { topic: string; name: string; reason: string; tip: string | null }[];
};
class FamilyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
// This public portal intentionally does not invoke the normal account unauthorized handler.
async function familyRequest<T>(path: string, body?: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/family/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new FamilyError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); }
  const data = await res.json();
  if (!res.ok) throw new FamilyError(res.status, data.error ?? 'Không tải được thông tin. Vui lòng thử lại.');
  return data;
}

export function Family() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const blockRefresh = useRef(false);
  const refresh = useCallback(async (initial = false) => {
    if(blockRefresh.current) return;
    const request = ++generation.current;
    try { const data = await familyRequest<Dashboard>('dashboard'); if(request === generation.current && !blockRefresh.current) {setDashboard(data); setError('');} }
    catch (err) {
      if(request !== generation.current || blockRefresh.current) return;
      if (err instanceof FamilyError && err.status === 401) {
        setDashboard(null);
        if (!initial) setError(err.message);
      } else setError(err instanceof Error ? err.message : 'Không tải được thông tin.');
    } finally { if(request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(true); return () => {generation.current++;}; }, [refresh]);
  useEffect(() => {
    if (!dashboard) return;
    const timer = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(timer);
  }, [dashboard, refresh]);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); generation.current++; blockRefresh.current=true;
    try { await familyRequest('login', { code }); blockRefresh.current=false; setCode(''); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không đăng nhập được.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    generation.current++; blockRefresh.current=true;
    setBusy(true); setError(''); setDashboard(null); setCode('');
    try { await familyRequest('logout', {}); }
    catch (err) { setError(err instanceof Error ? err.message : 'Chưa đăng xuất được. Kiểm tra mạng và thử lại.'); }
    finally { setBusy(false); }
  }
  const counts = dashboard ? dashboard.participation.reduce((acc, row) => ({ ...acc, [row.state]: acc[row.state] + 1 }), { completed: 0, pending: 0, missed: 0 }) : null;
  return <main className="family-portal" style={{ margin: '0 auto', padding: 'clamp(14px, 2vw, 24px)' }}>
    <header className="row between mb" style={{ gap: 16, flexWrap: 'wrap' }}>
      <div><a href="#/" className="muted">SmartExam AI</a><h1 style={{ marginBottom: 4 }}>Đồng hành cùng con</h1><p className="muted">Cổng phụ huynh · Chỉ đọc</p></div>
      {dashboard && <button className="btn secondary" disabled={busy} onClick={() => void logout()}>{busy ? 'Đang xử lý…' : 'Đăng xuất'}</button>}
    </header>
    {error && <div className="notice red mb" role="alert">{error}</div>}
    {loading ? <p role="status">Đang kiểm tra phiên phụ huynh…</p> : !dashboard ? <section className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
      <h2>Xem tiến độ học tập</h2><p>Nhập mã liên kết giáo viên cấp riêng cho gia đình để xem kết quả đã công bố và tình hình nộp bài của con.</p>
      <form onSubmit={(event) => void login(event)}>
        <label htmlFor="family-code">Mã liên kết phụ huynh</label>
        <input id="family-code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={80} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" style={{ width: '100%', margin: '8px 0 16px', fontFamily: 'monospace' }} />
        <button className="btn primary" type="submit" disabled={busy || !code.trim()}>{busy ? 'Đang mở…' : 'Mở cổng phụ huynh'}</button>
      </form><p className="muted" style={{ marginTop: 20 }}>Giữ kín mã liên kết. Nếu mã hết hạn hoặc thất lạc, liên hệ giáo viên để được cấp mã mới.</p>
    </section> : <>
      <section className="card mb"><div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}><div><span className="badge blue">Học sinh</span><h2>{dashboard.student.name}</h2><p>Lớp {dashboard.student.className}</p></div><button className="btn secondary" onClick={() => void refresh()}>Cập nhật</button></div></section>
      <section className="card mb"><h2>Tình hình nộp bài</h2><p className="muted">Theo các bài được giao trên SmartExam; không phải điểm danh tại trường.</p>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}><span><strong>{counts?.completed}</strong> đã nộp</span><span><strong>{counts?.pending}</strong> đang chờ</span><span><strong>{counts?.missed}</strong> quá hạn chưa nộp</span></div>
        {dashboard.participation.length === 0 ? <p className="muted">Chưa có bài được giao.</p> : <div style={{ overflowX: 'auto' }}><table className="t" style={{ width: '100%', marginTop: 16 }}><thead><tr><th>Bài được giao</th><th>Hạn nộp</th><th>Trạng thái</th></tr></thead><tbody>{dashboard.participation.map((row) => <tr key={row.id}><td>{row.title}</td><td>{fmtDateTime(row.closeAt)}</td><td>{{ completed: 'Đã nộp', pending: 'Đang chờ', missed: 'Quá hạn chưa nộp' }[row.state]}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="card mb"><h2>Kết quả đã công bố</h2><p className="muted">Điểm chỉ xuất hiện sau khi con hoàn thành bài và giáo viên cho phép xem kết quả.</p>
        {dashboard.grades.length === 0 ? <p>Chưa có kết quả được công bố.</p> : <div style={{ overflowX: 'auto' }}><table className="t" style={{ width: '100%' }}><thead><tr><th>Bài kiểm tra</th><th>Ngày nộp</th><th>Điểm / 10</th></tr></thead><tbody>{dashboard.grades.map((grade) => <tr key={grade.id}><td>{grade.title}</td><td>{fmtDate(grade.submittedAt)}</td><td><strong>{fmtScore(grade.score10)}</strong></td></tr>)}</tbody></table></div>}
      </section>
      <section className="card mb"><h2>Gợi ý đồng hành</h2>{dashboard.suggestions.length === 0 ? <p className="muted">Chưa đủ dữ liệu từ bài đã công bố để đề xuất nội dung ôn tập.</p> : dashboard.suggestions.map((suggestion) => <div key={suggestion.topic} style={{ marginBottom: 20 }}><h3>{suggestion.name}</h3><p>{suggestion.reason}</p>{suggestion.tip && <p>{suggestion.tip}</p>}<p className="muted">Cùng con dành thời gian ôn tập đều đặn và trao đổi với giáo viên khi cần hỗ trợ.</p></div>)}</section>
      {dashboard.topics.length > 0 && <section className="card"><h2>Tiến độ theo chuyên đề</h2><p className="muted">Ước lượng từ các bài đã công bố; ít câu làm sẽ chưa phản ánh đầy đủ năng lực.</p>{dashboard.topics.map((topic) => <div key={topic.topic} style={{ margin: '16px 0' }}><div className="row between" style={{ gap: 12 }}><strong>{topic.name}</strong><span>{Math.round(topic.value * 100)}%</span></div><progress aria-label={topic.name} value={topic.value} max={1} style={{ width: '100%' }} /><small className="muted">{topic.n} câu{!topic.confident && ' · Dữ liệu còn ít'}</small></div>)}</section>}
    </>}
  </main>;
}
export default Family;
