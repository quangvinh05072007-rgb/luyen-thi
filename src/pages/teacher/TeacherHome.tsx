import { get } from '../../api';
import { ErrorBox, fmtDateTime, fmtScore, Icon, Loading, scoreColor, useApp, useAsync } from '../../ui/kit';

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
  const totalStudents = data.classes.reduce((sum: number, c: any) => sum + (c.students ?? 0), 0);
  const totalSubmissions = data.assignments.reduce((sum: number, a: any) => sum + (a.submitted ?? 0), 0);

  return (
    <div className="stack">
      {/* Top Header Widget */}
      <div className="row between mb" style={{ alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>
            <span className="gradient-text">Bảng điều khiển</span>
          </h1>
          <p className="tiny muted" style={{ margin: '2px 0 0' }}>Giáo viên: <b>{user.displayName}</b> · {user.school.name}</p>
        </div>
        <div className="row">
          <a className="btn primary sm" href="#/ra-de"><Icon name="plus" /> Tạo đề thi</a>
          <a className="btn sm" href="#/nhap-de"><Icon name="upload" /> Nhập Word</a>
        </div>
      </div>

      {/* Row 1: 4 Stat Widgets */}
      <div className="stat-widget-grid">
        <a className="stat-widget" href="#/lop-hoc">
          <div className="stat-widget-icon blue"><Icon name="class" /></div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{totalStudents}</span>
            <span className="stat-widget-label">{data.classes.length} lớp phụ trách</span>
          </div>
        </a>
        <a className="stat-widget" href="#/thu-vien">
          <div className="stat-widget-icon orange"><Icon name="exam" /></div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{running.length}</span>
            <span className="stat-widget-label">Bài thi đang mở</span>
          </div>
        </a>
        <div className="stat-widget">
          <div className="stat-widget-icon green"><Icon name="check" /></div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{totalSubmissions}</span>
            <span className="stat-widget-label">Lượt bài đã nộp</span>
          </div>
        </div>
        <a className="stat-widget" href="#/ngan-hang">
          <div className="stat-widget-icon purple"><Icon name="bank" /></div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{data.counts?.approved ?? 0}</span>
            <span className="stat-widget-label">Câu hỏi trong kho</span>
          </div>
        </a>
      </div>

      {/* Row 2: 6 Quick Launcher Widgets */}
      <div className="launcher-grid">
        <a className="launcher-widget" href="#/lop-hoc">
          <div className="launcher-icon blue"><Icon name="class" /></div>
          <span className="launcher-label">Lớp học</span>
          <span className="launcher-tag">{data.classes.length} lớp</span>
        </a>
        <a className="launcher-widget" href="#/thu-vien">
          <div className="launcher-icon purple"><Icon name="exam" /></div>
          <span className="launcher-label">Đề thi</span>
          <span className="launcher-tag">{data.assignments.length} bài</span>
        </a>
        <a className="launcher-widget" href="#/ngan-hang">
          <div className="launcher-icon teal"><Icon name="bank" /></div>
          <span className="launcher-label">Ngân hàng</span>
          <span className="launcher-tag">{data.counts?.approved ?? 0} câu</span>
        </a>
        <a className="launcher-widget" href="#/ra-de">
          <div className="launcher-icon cyan"><Icon name="edit" /></div>
          <span className="launcher-label">Tạo đề</span>
          <span className="launcher-tag">Ma trận</span>
        </a>
        <a className="launcher-widget" href="#/nhap-de">
          <div className="launcher-icon rose"><Icon name="import" /></div>
          <span className="launcher-label">Nhập Word</span>
          <span className="launcher-tag">Tự động</span>
        </a>
        <a className="launcher-widget" href="#/lop-hoc">
          <div className="launcher-icon orange"><Icon name="chart" /></div>
          <span className="launcher-label">Báo cáo</span>
          <span className="launcher-tag">Thống kê</span>
        </a>
      </div>

      {/* Row 3: Main 2-Column Widgets */}
      <div className="grid-2">
        {/* Cột 1: Bài thi & tiến độ nộp */}
        <div className="stack">
          <div className="widget-card">
            <div className="widget-head">
              <h2 className="widget-title"><Icon name="exam" /> Bài thi đang diễn ra</h2>
              {running.length > 0 ? (
                <span className="live-indicator">
                  <span className="live-dot" /> {running.length} đang mở
                </span>
              ) : (
                <span className="badge">{running.length} đang mở</span>
              )}
            </div>
            {running.length === 0 ? (
              <p className="tiny muted center" style={{ padding: '16px 0' }}>Không có bài thi nào đang mở.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {running.map((a: any) => {
                  const pctSubmitted = a.students ? Math.round((a.submitted / a.students) * 100) : 0;
                  return (
                    <a key={a.id} className="task-widget" href={`#/lop/${a.class_id}/ket-qua/${a.id}`}>
                      <div className="grow">
                        <div className="task-widget-title">
                          <span>{a.title}</span>
                          <span className="badge blue">{a.class_name}</span>
                        </div>
                        <div className="row between tiny muted mt" style={{ marginTop: 6, marginBottom: 4 }}>
                          <span>Tiến độ nộp: <b>{a.submitted}/{a.students}</b> ({pctSubmitted}%)</span>
                          <span>Đóng lúc {fmtDateTime(a.close_at)}</span>
                        </div>
                        <div className="bar">
                          <span style={{ width: `${pctSubmitted}%`, background: 'var(--primary)' }} />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div className="widget-card">
            <div className="widget-head">
              <h2 className="widget-title"><Icon name="check" /> Đã đóng gần đây</h2>
              <span className="badge gray">{recent.length} bài</span>
            </div>
            {recent.length === 0 ? (
              <p className="tiny muted center" style={{ padding: '16px 0' }}>Chưa có bài thi đã đóng.</p>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {recent.map((a: any) => (
                  <a key={a.id} className="task-widget" href={`#/lop/${a.class_id}/ket-qua/${a.id}`}>
                    <div className="grow">
                      <div className="task-widget-title">{a.title}</div>
                      <div className="task-widget-sub">Lớp {a.class_name} · {a.submitted}/{a.students} bài đã nộp</div>
                    </div>
                    <span className="badge" style={{ fontSize: 13, fontWeight: 700, color: scoreColor(a.avg) }}>
                      {fmtScore(a.avg)} đ
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cột 2: Lớp học & Nhắc việc */}
        <div className="stack">
          <div className="widget-card">
            <div className="widget-head">
              <h2 className="widget-title"><Icon name="class" /> Lớp phụ trách</h2>
              <a href="#/lop-hoc" className="small">Tất cả ({data.classes.length}) →</a>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {data.classes.map((c: any) => (
                <a key={c.id} className="class-widget-card" href={`#/lop/${c.id}`}>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="student-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{c.grade}</div>
                    <div>
                      <div className="strong" style={{ fontSize: 14 }}>Lớp {c.name}</div>
                      <div className="tiny muted">{c.students} học sinh · Khối {c.grade}</div>
                    </div>
                  </div>
                  <span className="badge blue">Vào lớp →</span>
                </a>
              ))}
              {data.classes.length === 0 && <p className="tiny muted center">Chưa có lớp nào được gán.</p>}
            </div>
          </div>

          {actions.length > 0 && (
            <div className="widget-card">
              <div className="widget-head">
                <h2 className="widget-title"><Icon name="star" /> Việc nên làm tuần này</h2>
                <span className="badge amber">Khuyến nghị</span>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {actions.slice(0, 3).map((a: any, i: number) => (
                  <a key={i} className="task-widget" href={`#/lop/${a.cls.id}/ket-qua?view=analysis`}>
                    <span className="badge blue" style={{ flexShrink: 0 }}>{a.cls.name}</span>
                    <span className="grow small" style={{ lineHeight: 1.35 }}>{a.text}</span>
                    <span className="small" style={{ color: 'var(--primary)', fontWeight: 700 }}>→</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.drafts.length > 0 && (
            <div className="widget-card row between" style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
              <div>
                <div className="strong" style={{ color: '#d46b08', fontSize: 14 }}>{data.drafts.length} câu nháp chờ duyệt</div>
                <div className="tiny muted">Bổ sung vào kho đề dùng chung</div>
              </div>
              <a className="btn primary sm" href="#/ngan-hang">Duyệt ngay</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
