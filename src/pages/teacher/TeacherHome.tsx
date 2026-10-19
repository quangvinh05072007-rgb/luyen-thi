import { get } from '../../api';
import { ErrorBox, fmtDateTime, fmtScore, Loading, Mascot, scoreColor, useApp, useAsync } from '../../ui/kit';

export function TeacherHome() {
  const { user } = useApp();
  const { data: loaded, error, loading, reload } = useAsync(
    async () => {
      const [classes, assignments, drafts] = await Promise.all([get('/api/classes'), get('/api/assignments'), get('/api/questions?status=draft')]);
      const details = await Promise.all(classes.classes.map((c: any) => get(`/api/classes/${c.id}`)));
      return { classes: classes.classes, assignments: assignments.assignments, drafts: drafts.questions, counts: drafts.counts, details };
    },
    [],
  );
  if (loading) return <Loading />;
  if (error || !loaded) return <ErrorBox error={error ?? 'Không tải được dữ liệu.'} onRetry={reload} />;
  const data = loaded;
  const now = Date.now();
  const running = data.assignments.filter((a: any) => a.open_at <= now && a.close_at >= now);
  const recent = data.assignments.filter((a: any) => a.close_at < now).slice(0, 5);
  const actions = data.details.flatMap((d: any) => d.actions.map((a: any) => ({ ...a, cls: d.class })));
  return (
    <div className="stack">
      <div className="card hero">
        <Mascot size={70} />
        <div style={{ flex: 1 }}>
          <h1>Chào {user.displayName}</h1>
          <p className="small muted">
            {data.drafts.length > 0 ? `${data.drafts.length} câu nháp chờ duyệt · ` : ''}
            {running.length} bài đang mở · {data.counts.approved ?? 0} câu đã duyệt trong ngân hàng
          </p>
        </div>
        <a className="btn primary big" href="#/ra-de">
          Ra đề mới
        </a>
      </div>

      {actions.length > 0 && (
        <div className="card">
          <h2>Việc nên làm tuần này</h2>
          {actions.map((a: any, i: number) => (
            <a key={i} className="list-item" href={`#/lop/${a.cls.id}`} style={{ color: 'inherit' }}>
              <span className="badge blue">{a.cls.name}</span>
              <div className="grow small">{a.text}</div>
            </a>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h2>Lớp của tôi</h2>
          {data.details.map((d: any) => {
            const weak = d.classMastery.filter((m: any) => m.band === 'weak').slice(0, 2);
            return (
              <a key={d.class.id} className="list-item" href={`#/lop/${d.class.id}`} style={{ color: 'inherit' }}>
                <div className="grow">
                  <div className="strong">Lớp {d.class.name}</div>
                  <div className="tiny muted">
                    {d.students.length} học sinh · {weak.length ? `Yếu: ${weak.map((m: any) => m.name).join('; ')}` : 'Chưa thấy chuyên đề yếu chung'}
                  </div>
                </div>
                <span className="small">Xem →</span>
              </a>
            );
          })}
          {data.classes.length === 0 && <p className="muted small">Bạn chưa phụ trách lớp nào. Nhờ quản lý trường gán lớp.</p>}
        </div>
        <div className="card">
          <h2>Bài đang mở</h2>
          {running.length === 0 && <p className="muted small">Không có bài nào đang mở.</p>}
          {running.map((a: any) => (
            <a key={a.id} className="list-item" href={`#/bai-giao/${a.id}`} style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="small strong">{a.title}</div>
                <div className="tiny muted">
                  Lớp {a.class_name} · {a.submitted}/{a.students} đã nộp · {a.doing} đang làm · đóng {fmtDateTime(a.close_at)}
                </div>
              </div>
            </a>
          ))}
          <h3 className="mt">Đã đóng gần đây</h3>
          {recent.map((a: any) => (
            <a key={a.id} className="list-item" href={`#/bai-giao/${a.id}`} style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="small strong">{a.title}</div>
                <div className="tiny muted">
                  Lớp {a.class_name} · {a.submitted}/{a.students} bài
                </div>
              </div>
              <b style={{ color: scoreColor(a.avg) }}>{fmtScore(a.avg)}</b>
            </a>
          ))}
        </div>
      </div>
      {data.drafts.length > 0 && (
        <div className="card row between">
          <div>
            <div className="strong">{data.drafts.length} câu nháp chờ duyệt</div>
            <div className="small muted">Câu chưa duyệt không đến tay học sinh.</div>
          </div>
          <a className="btn" href="#/ngan-hang">
            Duyệt câu
          </a>
        </div>
      )}
    </div>
  );
}
