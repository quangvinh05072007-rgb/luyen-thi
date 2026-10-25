import { FormEvent, useState } from 'react';
import { api, download, get, post } from '../../api';
import { Bar, ErrorBox, fmtDateTime, fmtScore, Loading, pct, useApp, useAsync } from '../../ui/kit';

type Metrics = { assignments: number; students: number; eligibleStudents: number; participants: number; participation: number | null; submissions: number; scoreSamples: number; averageScore: number | null };
type ClassMetrics = Metrics & { classId: number; className: string };
type Period = { from: string; to: string; classIds: number[]; generatedAt: number; explanation: string; summary: Metrics; classes: ClassMetrics[]; previous: { from: string; to: string; summary: Metrics; classes: ClassMetrics[] }; difference: { averageScore: number | null; participation: number | null; participants: number | null; submissions: number | null } };
type Schedule = { id: number; cadence: 'weekly' | 'monthly'; classIds: number[]; nextDay: string; active: boolean };
type Snapshot = { id: number; from: string; to: string; createdAt: number; scheduleId: number | null; classIds: number[]; summary: Metrics };
const day = (at: number) => new Date(at + 7 * 3600_000).toISOString().slice(0, 10);
const delta = (value: number | null, percentage = false) => value === null ? 'Chưa đủ dữ liệu so sánh' : `${value > 0 ? '+' : ''}${fmtScore(percentage ? value * 100 : value)} ${percentage ? 'điểm %' : 'điểm'} so với kỳ trước`;

export function PeriodicReports({ classId }: { classId?: number }) {
  const { user, toast } = useApp();
  const [from, setFrom] = useState(() => day(Date.now() - 6 * 86400_000));
  const [to, setTo] = useState(() => day(Date.now()));
  const [selected, setSelected] = useState<number[]>(classId ? [classId] : []);
  const [filter, setFilter] = useState(() => ({ from, to, classIds: classId ? [classId] : [] as number[], revision: 0 }));
  const [savedId, setSavedId] = useState<number | null>(null);
  const [cadence, setCadence] = useState<'weekly' | 'monthly'>('weekly');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const options = useAsync(async () => { const r = await get<{ classes: { id: number; name: string }[] }>('/api/classes'); return {classes:classId?r.classes.filter(c=>c.id===classId):r.classes}; }, [classId]);
  const history = useAsync(async () => {
    const [snapshots, schedules] = await Promise.all([get<{ snapshots: Snapshot[] }>('/api/reports/snapshots'), get<{ schedules: Schedule[] }>('/api/reports/schedules')]);
    return { snapshots: snapshots.snapshots.filter(s=>!classId||(s.classIds.length===1&&s.classIds[0]===classId)), schedules:schedules.schedules.filter(s=>!classId||(s.classIds.length===1&&s.classIds[0]===classId)) };
  }, [classId]);
  const result = useAsync(() => get<Period>(`/api/reports/period?${new URLSearchParams({ from: filter.from, to: filter.to, ...(filter.classIds.length ? { classIds: filter.classIds.join(',') } : {}) })}`), [filter]);
  const report = result.data;
  const names = (ids: number[]) => ids.map((id) => options.data?.classes.find((c) => c.id === id)?.name ?? `Lớp #${id}`).join(', ');
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setActionError('');
    try { await action(); } catch (e) { setActionError(e instanceof Error ? e.message : 'Thao tác chưa hoàn tất. Thử lại.'); } finally { setBusy(false); }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setSavedId(null); setActionError('');
    setFilter({ from, to, classIds: selected, revision: filter.revision + 1 });
  }
  async function exportReport() {
    if (!report) return;
    const query = new URLSearchParams({ from: report.from, to: report.to, ...(report.classIds.length ? { classIds: report.classIds.join(',') } : {}) });
    await download(savedId ? `/api/reports/snapshots/${savedId}/export.xlsx` : `/api/reports/period/export.xlsx?${query}`, 'bao-cao.xlsx');
  }
  return <div className="stack">
    <div>
      <h2>Báo cáo định kỳ{classId ? ' của lớp' : ''}</h2>
      <p className="muted">Theo dõi mức tham gia và kết quả {classId ? 'lớp đang mở' : user.role === 'admin' ? 'trong trường' : 'các lớp phụ trách'}, so sánh với kỳ trước có cùng số ngày.</p>
    </div>
    <form className="card stack" onSubmit={submit}>
      <div className="grid-2">
        <div className="field"><label htmlFor="report-from">Từ ngày (giờ Việt Nam)</label><input id="report-from" type="date" min="2000-01-01" max="2100-12-31" required value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="report-to">Đến hết ngày</label><input id="report-to" type="date" min={from} max="2100-12-31" required value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {options.loading && <Loading text="Đang tải danh sách lớp…" />}
      {options.error && <ErrorBox error={options.error} onRetry={options.reload} />}
      {!classId && options.data && <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Lớp so sánh · bỏ chọn để xem tất cả lớp được phép</legend>
        <div className="row" style={{ flexWrap: 'wrap' }}>{options.data.classes.map((c) => <label key={c.id} className="row" style={{ minHeight: 44, gap: 8, paddingRight: 16 }}>
          <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id))} />{c.name}
        </label>)}</div>
        {options.data.classes.length === 0 && <p className="muted small">Chưa có lớp được phân công. Nhờ quản lý trường gán lớp để lập báo cáo.</p>}
      </fieldset>}
      <div className="row"><button className="btn primary" type="submit" disabled={result.loading || busy}>Xem báo cáo</button><span className="small muted">Tối đa 366 ngày mỗi kỳ.</span></div>
    </form>
    {actionError && <ErrorBox error={actionError} />}
    {result.loading ? <Loading text="Đang tổng hợp báo cáo…" /> : result.error ? <ErrorBox error={result.error} onRetry={result.reload} /> : report && <>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>{report.from} — {report.to}</h2><p className="small muted">{savedId ? 'Bản đã lưu' : 'Dữ liệu hiện tại'} · kỳ trước: {report.previous.from} — {report.previous.to}</p></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy || !report.classIds.length} onClick={() => act(exportReport)}>Tải Excel</button>
          <button className="btn primary" disabled={busy || !!savedId || !report.classIds.length} onClick={() => act(async () => {
            const saved = await post<{ id: number; report: Period }>('/api/reports/snapshots', { from: report.from, to: report.to, classIds: report.classIds });
            result.setData(saved.report); setSavedId(saved.id); history.reload(); toast('Đã lưu bản báo cáo.');
          })}>{savedId ? 'Đã lưu báo cáo' : 'Lưu bản báo cáo'}</button>
        </div>
      </div>
      <div className="grid-3">
        <div className="card stat"><span className="k">Học sinh tham gia</span><strong className="v">{report.summary.participants}/{report.summary.eligibleStudents}</strong><span className="small muted">{pct(report.summary.participation)} học sinh được giao bài</span><span className="small">{delta(report.difference.participation, true)}</span></div>
        <div className="card stat"><span className="k">Điểm trung bình / 10</span><strong className="v">{fmtScore(report.summary.averageScore)}</strong><span className="small muted">{report.summary.scoreSamples} bài nộp đã công bố có điểm</span><span className="small">{delta(report.difference.averageScore)}</span></div>
        <div className="card stat"><span className="k">Bài đã nộp</span><strong className="v">{report.summary.submissions}</strong><span className="small muted">Trong {report.summary.assignments} bài giao liên quan tới kỳ</span><span className="small">Kỳ trước: {report.previous.summary.submissions} bài nộp</span></div>
      </div>
      <div className="card stack">
        <h2>So sánh lớp</h2>
        {!report.summary.assignments && <p className="muted">Không có bài giao liên quan trong khoảng ngày đã chọn. Đổi ngày để xem một kỳ khác.</p>}
        {report.classes.length > 0 && <div className="table-wrap"><table>
          <caption className="small muted" style={{ textAlign: 'left', marginBottom: 12 }}>Cùng cách tính cho mọi lớp. Dấu — nghĩa là chưa có mẫu.</caption>
          <thead><tr><th scope="col">Lớp</th><th scope="col">Bài giao</th><th scope="col">HS tham gia</th><th scope="col">Tỷ lệ</th><th scope="col">Bài nộp</th><th scope="col">Mẫu điểm</th><th scope="col">Điểm TB</th><th scope="col">Thay đổi điểm</th></tr></thead>
          <tbody>{report.classes.map((c) => {
            const before = report.previous.classes.find((p) => p.classId === c.classId)?.averageScore ?? null;
            return <tr key={c.classId}><th scope="row">{c.className}</th><td>{c.assignments}</td><td>{c.participants}/{c.eligibleStudents}</td><td><div style={{ minWidth: 70 }}>{pct(c.participation)}<Bar value={c.participation ?? 0} /></div></td><td>{c.submissions}</td><td>{c.scoreSamples}</td><td>{fmtScore(c.averageScore)}</td><td>{c.averageScore === null || before === null ? '—' : `${c.averageScore - before > 0 ? '+' : ''}${fmtScore(c.averageScore - before)}`}</td></tr>;
          })}</tbody>
        </table></div>}
        <details><summary className="small strong">Cách tính và phạm vi dữ liệu</summary><p className="small muted">{report.explanation}</p><p className="small muted">Tổng hợp lúc {fmtDateTime(report.generatedAt)}. Tỷ lệ tham gia trong Excel có giá trị từ 0 đến 1.</p></details>
      </div>
    </>}
    <div className="card stack">
      <h2>Lịch tự lưu báo cáo</h2>
      <p className="small muted">Lưu báo cáo trong ứng dụng vào 0 giờ thứ Hai hoặc ngày đầu tháng (giờ Việt Nam), cho tuần/tháng vừa kết thúc. Khi máy chủ mở lại, các kỳ đến hạn được tạo bù.</p>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="field"><label htmlFor="report-cadence">Chu kỳ</label><select id="report-cadence" value={cadence} onChange={(e) => setCadence(e.target.value as 'weekly' | 'monthly')}><option value="weekly">Hằng tuần</option><option value="monthly">Hằng tháng</option></select></div>
        <button className="btn primary" disabled={busy || !options.data?.classes.length} onClick={() => act(async () => {
          await post('/api/reports/schedules', { cadence, classIds: selected.length ? selected : options.data!.classes.map((c) => c.id) });
          history.reload(); toast('Đã lưu lịch báo cáo.');
        })}>Lưu lịch cho {selected.length ? `${selected.length} lớp đã chọn` : 'tất cả lớp'}</button>
      </div>
      {history.loading && <Loading />}
      {history.error && <ErrorBox error={history.error} onRetry={history.reload} />}
      {history.data?.schedules.map((s) => <div className="list-item" key={s.id} style={{ flexWrap: 'wrap' }}><div className="grow"><strong>{s.cadence === 'weekly' ? 'Hằng tuần' : 'Hằng tháng'} · {names(s.classIds)}</strong><div className="small muted">{s.active ? `Kỳ tiếp theo lưu ngày ${s.nextDay}` : 'Đã dừng · cần tạo lại nếu thay đổi phân công lớp'}</div></div>{s.active && <button className="btn ghost" disabled={busy} onClick={() => act(async () => { await api('DELETE', `/api/reports/schedules/${s.id}`); history.reload(); toast('Đã dừng lịch báo cáo.'); })}>Dừng lịch</button>}</div>)}
      {history.data?.schedules.length === 0 && <p className="small muted">Chưa có lịch báo cáo. Các lớp mới được phân công cần thêm vào một lịch mới.</p>}
    </div>
    <div className="card stack">
      <div className="row between"><h2>Báo cáo đã lưu</h2><button className="btn ghost" disabled={history.loading || busy} onClick={history.reload}>Làm mới</button></div>
      <p className="small muted">Mỗi bản giữ số liệu tại thời điểm tạo. Hiển thị tối đa 100 bản mới nhất bạn còn quyền xem.</p>
      {history.data?.snapshots.length === 0 && <p className="muted">Chưa có bản báo cáo đã lưu.</p>}
      {history.data?.snapshots.map((s) => <div className="list-item" key={s.id} style={{ flexWrap: 'wrap', gap: 12 }}><div className="grow"><strong>{s.from} — {s.to}</strong><div className="small muted">{names(s.classIds)} · {s.scheduleId ? 'Theo lịch' : 'Lưu thủ công'} · điểm TB {fmtScore(s.summary.averageScore)}</div></div><button className="btn" disabled={busy || result.loading} onClick={() => act(async () => { const saved = await get<{ report: Period }>(`/api/reports/snapshots/${s.id}`); result.setData(saved.report); setSavedId(s.id); toast('Đang xem bản báo cáo đã lưu.'); window.scrollTo({ top: 0, behavior: 'instant' }); })}>Xem bản lưu</button><button className="btn ghost" disabled={busy} onClick={() => act(() => download(`/api/reports/snapshots/${s.id}/export.xlsx`, 'bao-cao.xlsx'))}>Tải Excel</button></div>)}
    </div>
    {busy && <p className="small muted" role="status">Đang thực hiện…</p>}
  </div>;
}
