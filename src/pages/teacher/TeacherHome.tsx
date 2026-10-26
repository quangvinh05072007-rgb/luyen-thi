import { useState } from 'react';
import { get } from '../../api';
import { FeatureIcon } from '../../ui/FeatureIcon';
import { ErrorBox, fmtDateTime, fmtScore, Icon, Loading, scoreColor, useApp, useAsync } from '../../ui/kit';

export function TeacherHome() {
  const { user } = useApp();
  const [showActivity, setShowActivity] = useState(false);
  const { data, error, loading, reload } = useAsync(async () => {
    const [classes, assignments, drafts] = await Promise.all([
      get('/api/classes'), get('/api/assignments'), get('/api/questions?status=draft'),
    ]);
    const details = await Promise.all(classes.classes.map((c: any) => get(`/api/classes/${c.id}`)));
    return { classes: classes.classes, assignments: assignments.assignments, drafts: drafts.questions, counts: drafts.counts, details };
  }, []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? 'Không tải được dữ liệu.'} onRetry={reload} />;

  const now = Date.now();
  const running = data.assignments.filter((a: any) => a.open_at <= now && a.close_at >= now);
  const recent = data.assignments.filter((a: any) => a.close_at < now).slice(0, 5);
  const actions = data.details.flatMap((d: any) => d.actions.map((a: any) => ({ ...a, cls: d.class })));
  const totalStudents = data.classes.reduce((sum: number, c: any) => sum + (c.students ?? 0), 0);
  const totalSubmissions = data.assignments.reduce((sum: number, a: any) => sum + (a.submitted ?? 0), 0);

  return (
    <div className="teacher-start">
      <section className="start-welcome" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading">Chào mừng đến SmartExam <span aria-hidden="true">🎉</span></h1>
        <p>Tạo đề, giao bài và theo dõi kết quả học tập.{user.school.sample ? ' Bạn đang dùng trường mẫu.' : ''}</p>
      </section>

      <section className="start-shortcuts" aria-labelledby="start-heading">
        <h2 id="start-heading">Bắt đầu ngay</h2>
        <div className="start-grid">
          <a className="start-tile" href="#/ra-de"><span className="start-tile-icon"><FeatureIcon name="matrix" /></span><span>Tạo đề từ ngân hàng</span></a>
          <a className="start-tile" href="#/ngan-hang"><span className="start-tile-icon"><FeatureIcon name="bank" /></span><span>Ngân hàng câu hỏi</span></a>
          <a className="start-tile" href="#/nhap-de"><span className="start-tile-icon"><FeatureIcon name="import" /></span><span>Nhập đề từ file</span></a>
          <a className="start-tile" href="#/lop-hoc"><span className="start-tile-icon"><FeatureIcon name="class" /></span><span>Quản lý lớp học</span></a>
          <button type="button" className={`start-tile${showActivity ? ' is-open' : ''}`} aria-expanded={showActivity} aria-controls="teacher-activity" onClick={() => setShowActivity(value => !value)}><span className="start-tile-icon"><FeatureIcon name="bulb" /></span><span>Hoạt động lớp học</span></button>
        </div>
      </section>

      <section id="teacher-activity" className="start-activity" hidden={!showActivity} aria-labelledby="activity-heading">
        <div className="row between"><h2 id="activity-heading">Hoạt động lớp học</h2><button className="btn ghost sm" type="button" onClick={() => setShowActivity(false)}>Thu gọn</button></div>
        <dl className="start-activity-stats">
          <div><dt>Lớp phụ trách</dt><dd>{data.classes.length}</dd></div>
          <div><dt>Học sinh</dt><dd>{totalStudents}</dd></div>
          <div><dt>Bài thi đang mở</dt><dd>{running.length}</dd></div>
          <div><dt>Lượt bài đã nộp</dt><dd>{totalSubmissions}</dd></div>
          <div><dt>Câu hỏi trong kho</dt><dd>{data.counts?.approved ?? 0}</dd></div>
        </dl>
        <div className="start-activity-columns">
          <div>
            <section className="start-activity-section">
              <h3>Bài thi đang diễn ra</h3>
              {running.length === 0 ? <p className="small muted">Không có bài thi nào đang mở.</p> : running.map((a: any) => {
                const percent = a.students ? Math.round((a.submitted / a.students) * 100) : 0;
                return <a key={a.id} className="start-activity-row" href={`#/lop/${a.class_id}/ket-qua/${a.id}`}><strong>{a.title}</strong><span>Lớp {a.class_name} · {a.submitted}/{a.students} bài đã nộp ({percent}%)</span><span>Đóng lúc {fmtDateTime(a.close_at)}</span><span className="bar"><span style={{ width: `${percent}%` }} /></span></a>;
              })}
            </section>
            <section className="start-activity-section">
              <h3>Đã đóng gần đây</h3>
              {recent.length === 0 ? <p className="small muted">Chưa có bài thi đã đóng.</p> : recent.map((a: any) => <a key={a.id} className="start-activity-row" href={`#/lop/${a.class_id}/ket-qua/${a.id}`}><strong>{a.title}</strong><span>Lớp {a.class_name} · {a.submitted}/{a.students} bài đã nộp</span><b style={{ color: scoreColor(a.avg) }}>{fmtScore(a.avg)} điểm</b></a>)}
            </section>
          </div>
          <div>
            <section className="start-activity-section">
              <div className="row between"><h3>Lớp phụ trách</h3><a href="#/lop-hoc" className="small">Xem tất cả</a></div>
              {data.classes.map((c: any) => <a key={c.id} className="start-activity-row" href={`#/lop/${c.id}`}><strong>Lớp {c.name}</strong><span>{c.students} học sinh · Khối {c.grade}</span></a>)}
              {data.classes.length === 0 && <p className="small muted">Chưa có lớp nào được gán.</p>}
            </section>
            {actions.length > 0 && <section className="start-activity-section"><h3>Việc nên làm tuần này</h3>{actions.slice(0, 3).map((a: any, index: number) => <a key={index} className="start-activity-row" href={`#/lop/${a.cls.id}/ket-qua?view=analysis`}><strong>Lớp {a.cls.name}</strong><span>{a.text}</span></a>)}</section>}
            {data.drafts.length > 0 && <a className="start-activity-row" href="#/ngan-hang"><strong>{data.drafts.length} câu nháp chờ duyệt</strong><span>Duyệt câu hỏi để bổ sung vào kho đề.</span></a>}
          </div>
        </div>
      </section>
    </div>
  );
}
