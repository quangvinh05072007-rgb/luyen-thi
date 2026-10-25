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

  return (
    <div className="stack">
      <div className="row between mb" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Chào {user.displayName}</h1>
          <p className="small muted">Hệ thống quản lý kiểm tra, đề thi và đánh giá học sinh</p>
        </div>
        <div className="row">
          <a className="btn primary" href="#/ra-de"><Icon name="plus" /> Tạo đề thi mới</a>
          <a className="btn" href="#/nhap-de"><Icon name="upload" /> Nhập Word</a>
        </div>
      </div>

      {/* Lưới chức năng chính kiểu Azota */}
      <div className="azota-grid">
        <a className="azota-tile" href="#/lop-hoc">
          <div className="azota-tile-icon blue"><Icon name="class" /></div>
          <div>
            <div className="azota-tile-title">Lớp học & Học sinh</div>
            <div className="azota-tile-desc">{data.classes.length} lớp · {totalStudents} học sinh</div>
          </div>
        </a>
        <a className="azota-tile" href="#/thu-vien">
          <div className="azota-tile-icon purple"><Icon name="exam" /></div>
          <div>
            <div className="azota-tile-title">Đề thi trực tuyến</div>
            <div className="azota-tile-desc">Kho đề thi, giao đề & phân phối</div>
          </div>
        </a>
        <a className="azota-tile" href="#/ngan-hang">
          <div className="azota-tile-icon teal"><Icon name="bank" /></div>
          <div>
            <div className="azota-tile-title">Ngân hàng câu hỏi</div>
            <div className="azota-tile-desc">{data.counts?.approved ?? 0} câu đã duyệt · {data.drafts.length} nháp</div>
          </div>
        </a>
        <a className="azota-tile" href="#/ra-de">
          <div className="azota-tile-icon cyan"><Icon name="edit" /></div>
          <div>
            <div className="azota-tile-title">Tạo đề ma trận</div>
            <div className="azota-tile-desc">Sinh đề chuẩn tốt nghiệp THPT</div>
          </div>
        </a>
        <a className="azota-tile" href="#/nhap-de">
          <div className="azota-tile-icon rose"><Icon name="import" /></div>
          <div>
            <div className="azota-tile-title">Nhập từ Word/PDF</div>
            <div className="azota-tile-desc">Tự nhận diện công thức Toán & đáp án</div>
          </div>
        </a>
        <a className="azota-tile" href="#/lop-hoc">
          <div className="azota-tile-icon orange"><Icon name="chart" /></div>
          <div>
            <div className="azota-tile-title">Kết quả & Báo cáo</div>
            <div className="azota-tile-desc">{running.length} bài thi đang mở</div>
          </div>
        </a>
      </div>

      {/* Việc nên làm */}
      {actions.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2 style={{ margin: 0 }}>Việc nên làm tuần này</h2>
            <span className="badge amber">Khuyến nghị AI</span>
          </div>
          {actions.slice(0, 3).map((a: any, i: number) => (
            <a key={i} className="list-item" href={`#/lop/${a.cls.id}/ket-qua?view=analysis`} style={{ color: 'inherit' }}>
              <span className="badge blue">{a.cls.name}</span>
              <div className="grow small">{a.text}</div>
              <span className="small" style={{ color: 'var(--primary)', fontWeight: 600 }}>Xem phân tích →</span>
            </a>
          ))}
        </div>
      )}

      {/* Grid lớp học & bài đang mở */}
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Lớp của tôi</h2>
            <a href="#/lop-hoc" className="small">Xem tất cả ({data.classes.length})</a>
          </div>
          {data.details.map((d: any) => {
            const weak = d.classMastery.filter((m: any) => m.band === 'weak').slice(0, 2);
            return (
              <a key={d.class.id} className="list-item" href={`#/lop/${d.class.id}`} style={{ color: 'inherit' }}>
                <div className="grow">
                  <div className="strong" style={{ color: '#111827' }}>Lớp {d.class.name}</div>
                  <div className="tiny muted">
                    {d.students.length} học sinh · {weak.length ? `Yếu: ${weak.map((m: any) => m.name).join('; ')}` : 'Năng lực đồng đều'}
                  </div>
                </div>
                <span className="badge blue">Vào lớp →</span>
              </a>
            );
          })}
          {data.classes.length === 0 && <p className="muted small">Bạn chưa phụ trách lớp nào. Nhờ quản lý trường gán lớp.</p>}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Bài đang mở</h2>
            <span className="badge green">{running.length} bài</span>
          </div>
          {running.length === 0 && <p className="muted small">Không có bài nào đang mở.</p>}
          {running.map((a: any) => (
            <a key={a.id} className="list-item" href={`#/lop/${a.class_id}/ket-qua/${a.id}`} style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="small strong">{a.title}</div>
                <div className="tiny muted">
                  Lớp {a.class_name} · {a.submitted}/{a.students} đã nộp · đóng {fmtDateTime(a.close_at)}
                </div>
              </div>
              <span className="badge green">Đang mở</span>
            </a>
          ))}
          <h3 className="mt" style={{ fontSize: 14 }}>Đã đóng gần đây</h3>
          {recent.map((a: any) => (
            <a key={a.id} className="list-item" href={`#/lop/${a.class_id}/ket-qua/${a.id}`} style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="small strong">{a.title}</div>
                <div className="tiny muted">
                  Lớp {a.class_name} · {a.submitted}/{a.students} bài
                </div>
              </div>
              <b style={{ color: scoreColor(a.avg) }}>{fmtScore(a.avg)} đ</b>
            </a>
          ))}
        </div>
      </div>

      {data.drafts.length > 0 && (
        <div className="card row between">
          <div>
            <div className="strong">{data.drafts.length} câu nháp chờ duyệt</div>
            <div className="small muted">Duyệt câu hỏi để bổ sung vào kho đề dùng chung.</div>
          </div>
          <a className="btn primary sm" href="#/ngan-hang">
            Duyệt ngay
          </a>
        </div>
      )}
    </div>
  );
}
