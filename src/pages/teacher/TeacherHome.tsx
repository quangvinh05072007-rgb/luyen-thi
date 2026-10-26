import { get } from '../../api';
import { ErrorBox, fmtDateTime, fmtScore, Icon, Loading, scoreColor, useApp, useAsync } from '../../ui/kit';

export function TeacherHome() {
  const { user } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const [classes, assignments, drafts] = await Promise.all([
      get('/api/classes'), get('/api/assignments'), get('/api/questions?status=draft'),
    ]);
    const details = await Promise.all(classes.classes.map((c: any) => get(`/api/classes/${c.id}`)));
    return { classes: classes.classes, assignments: assignments.assignments, drafts: drafts.questions, counts: drafts.counts, details };
  }, []);

  if (loading) return <Loading text="Đang tải trang tổng quan…" />;
  if (error || !data) return <ErrorBox error={error ?? 'Không tải được dữ liệu.'} onRetry={reload} />;

  const now = Date.now();
  const running = data.assignments.filter((a: any) => a.open_at <= now && a.close_at >= now);
  const recent = data.assignments.filter((a: any) => a.close_at < now).slice(0, 4);
  const actions = data.details.flatMap((d: any) => d.actions.map((a: any) => ({ ...a, cls: d.class })));
  const totalStudents = data.classes.reduce((sum: number, c: any) => sum + (c.students ?? 0), 0);
  const totalSubmissions = data.assignments.reduce((sum: number, a: any) => sum + (a.submitted ?? 0), 0);

  return (
    <div className="teacher-dashboard">
      {/* Hero Welcome Banner */}
      <section className="dash-hero">
        <div className="dash-hero-text">
          <h1>Xin chào, {user.displayName} 👋</h1>
          <p>
            Hôm nay bạn đang phụ trách <b>{data.classes.length} lớp</b> với <b>{totalStudents} học sinh</b>
            {running.length > 0 ? ` · Có ${running.length} bài thi đang mở làm bài.` : ' · Không có bài thi nào đang mở.'}
          </p>
        </div>
        <div className="dash-hero-actions">
          <a className="dash-hero-btn primary" href="#/ra-de">
            <Icon name="plus" /> Tạo đề mới
          </a>
          <a className="dash-hero-btn" href="#/nhap-de">
            <Icon name="upload" /> Nhập đề từ file
          </a>
          <a className="dash-hero-btn" href="#/lop-hoc">
            <Icon name="class" /> Quản lý lớp
          </a>
        </div>
      </section>

      {/* 4 Metric Cards */}
      <section className="dash-metrics-grid" aria-label="Thống kê tổng quan">
        <div className="metric-card">
          <div className="metric-icon-wrap blue">
            <Icon name="class" />
          </div>
          <div className="metric-info">
            <span className="metric-val">{data.classes.length}</span>
            <span className="metric-lbl">Lớp phụ trách</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap green">
            <Icon name="user" />
          </div>
          <div className="metric-info">
            <span className="metric-val">{totalStudents}</span>
            <span className="metric-lbl">Tổng số học sinh</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap purple">
            <Icon name="clock" />
          </div>
          <div className="metric-info">
            <span className="metric-val">{running.length}</span>
            <span className="metric-lbl">Bài thi đang mở</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap amber">
            <Icon name="book" />
          </div>
          <div className="metric-info">
            <span className="metric-val">{data.counts?.approved ?? 0}</span>
            <span className="metric-lbl">Câu hỏi ngân hàng</span>
          </div>
        </div>
      </section>

      {/* 2-Column Content Grid */}
      <section className="dash-content-grid">
        
        {/* Left Column: Exams & Assignments */}
        <div className="stack" style={{ gap: 20 }}>
          <div className="dash-section-card">
            <h2>
              <span>Bài thi đang diễn ra</span>
              <span className="badge blue">{running.length} bài</span>
            </h2>
            {running.length === 0 ? (
              <p className="tiny muted" style={{ padding: '12px 0', margin: 0 }}>
                Hiện không có bài kiểm tra hoặc bài tập nào đang mở. Bấm "Tạo đề" hoặc vào Lớp học để giao bài.
              </p>
            ) : (
              running.map((a: any) => {
                const percent = a.students ? Math.round((a.submitted / a.students) * 100) : 0;
                return (
                  <a key={a.id} className="dash-activity-item" href={`#/lop/${a.class_id}/ket-qua/${a.id}`}>
                    <div className="dash-activity-head">
                      <strong>{a.title}</strong>
                      <span className="badge green sm">Đang thi</span>
                    </div>
                    <div className="dash-activity-sub">
                      <span>Lớp {a.class_name} · Hạn chót: {fmtDateTime(a.close_at)}</span>
                      <b>{a.submitted}/{a.students} bài ({percent}%)</b>
                    </div>
                    <div className="dash-prog-bar">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </a>
                );
              })
            )}
          </div>

          <div className="dash-section-card">
            <h2>
              <span>Bài thi đã đóng gần đây</span>
              <span className="tiny muted">5 bài gần nhất</span>
            </h2>
            {recent.length === 0 ? (
              <p className="tiny muted" style={{ padding: '12px 0', margin: 0 }}>Chưa có bài thi nào kết thúc.</p>
            ) : (
              recent.map((a: any) => (
                <a key={a.id} className="dash-activity-item" href={`#/lop/${a.class_id}/ket-qua/${a.id}`}>
                  <div className="dash-activity-head">
                    <strong>{a.title}</strong>
                    <span style={{ fontWeight: 700, color: scoreColor(a.avg) }}>{fmtScore(a.avg)} điểm</span>
                  </div>
                  <div className="dash-activity-sub">
                    <span>Lớp {a.class_name} · {a.submitted}/{a.students} bài nộp</span>
                    <span className="tiny muted">Xem phân tích kết quả →</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Classes and Quick Actions */}
        <div className="stack" style={{ gap: 20 }}>
          <div className="dash-section-card">
            <h2>
              <span>Lớp học phụ trách</span>
              <a href="#/lop-hoc" className="tiny" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                Xem tất cả ({data.classes.length}) →
              </a>
            </h2>
            {data.classes.length === 0 ? (
              <p className="tiny muted">Chưa có lớp nào được tạo. Vào mục Lớp học để tạo lớp mới.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {data.classes.slice(0, 5).map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: c.grade === 12 ? '#dbeafe' : c.grade === 11 ? '#dcfce7' : '#f3e8ff', color: c.grade === 12 ? '#1e40af' : c.grade === 11 ? '#15803d' : '#7e22ce', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        K{c.grade}
                      </div>
                      <div>
                        <b style={{ fontSize: 14, color: '#0f172a' }}>{c.name}</b>
                        <div className="tiny muted">{c.students} học sinh {c.code ? `· Mã: ${c.code}` : ''}</div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <a className="btn sm" href={`#/lop/${c.id}`} style={{ padding: '4px 10px', fontSize: 12 }}>
                        Vào lớp
                      </a>
                      <a className="btn sm ghost" href={`#/lop/${c.id}/ket-qua`} style={{ padding: '4px 8px', fontSize: 12 }}>
                        Điểm
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pedagogy actions & Drafts */}
          {(actions.length > 0 || (data.drafts?.length ?? 0) > 0) && (
            <div className="dash-section-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
              <h2 style={{ color: '#92400e' }}>
                <span>💡 Gợi ý hành động</span>
              </h2>
              {actions.slice(0, 2).map((a: any, index: number) => (
                <a key={index} className="dash-activity-item" href={`#/lop/${a.cls.id}/ket-qua?view=analysis`} style={{ background: '#ffffff', borderColor: '#fde68a' }}>
                  <strong style={{ color: '#92400e' }}>Lớp {a.cls.name}</strong>
                  <span className="tiny" style={{ color: '#78350f' }}>{a.text}</span>
                </a>
              ))}
              {(data.drafts?.length ?? 0) > 0 && (
                <a className="dash-activity-item" href="#/ngan-hang" style={{ background: '#ffffff', borderColor: '#fde68a' }}>
                  <strong style={{ color: '#2563eb' }}>{data.drafts.length} câu hỏi nháp chờ duyệt</strong>
                  <span className="tiny muted">Duyệt câu hỏi để bổ sung vào kho đề dùng chung.</span>
                </a>
              )}
            </div>
          )}
        </div>

      </section>
    </div>
  );
}
