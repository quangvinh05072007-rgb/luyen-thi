import { useState } from 'react';
import { get, post, put } from '../../api';
import { Bar, ErrorBox, fmtDateTime, fmtScore, Loading, Modal, pct, scoreColor, useApp, useAsync } from '../../ui/kit';

export function AdminHome() {
  const { meta } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/admin/overview'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const bankBy = (status: string) => data.bank.filter((b: any) => b.status === status).reduce((s: number, b: any) => s + b.n, 0);
  return (
    <div className="stack">
      <h1>Chất lượng toàn trường</h1>
      <p className="small muted">Số liệu 90 ngày gần nhất, từ các bài kiểm tra và bài tập giáo viên giao.</p>
      <div className="grid-3">
        {data.grades.map((g: any) => (
          <div key={g.grade} className="card stat">
            <span className="k">Khối {g.grade}</span>
            <span className="v" style={{ color: scoreColor(g.avg) }}>{fmtScore(g.avg)}</span>
            <span className="k">
              {g.classes} lớp · {g.students} học sinh · {g.n} bài nộp
            </span>
          </div>
        ))}
      </div>
      <div className="card table-wrap">
        <h2>Theo lớp</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Lớp</th>
              <th>Giáo viên</th>
              <th>Sĩ số</th>
              <th>Bài giao</th>
              <th>Tham gia</th>
              <th className="right">Điểm TB</th>
            </tr>
          </thead>
          <tbody>
            {data.classes.map((c: any) => (
              <tr key={c.id} className="click" onClick={() => (location.hash = `/lop/${c.id}`)}>
                <td className="strong">{c.name}</td>
                <td>{c.teacher ?? <span className="muted">Chưa gán</span>}</td>
                <td>{c.students}</td>
                <td>{c.assignments}</td>
                <td style={{ minWidth: 120 }}>
                  {c.participation === null ? '—' : (
                    <>
                      <Bar value={c.participation} /> <span className="tiny">{pct(c.participation)}</span>
                    </>
                  )}
                </td>
                <td className="right strong" style={{ color: scoreColor(c.avg) }}>
                  {fmtScore(c.avg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid-2">
        <div className="card table-wrap">
          <h2>Theo giáo viên</h2>
          <table className="t">
            <thead>
              <tr>
                <th>Giáo viên</th>
                <th>Lớp</th>
                <th>Đề</th>
                <th>Câu đã duyệt</th>
                <th className="right">TB lớp</th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="small">{t.classes.join(', ') || '—'}</td>
                  <td>{t.exams}</td>
                  <td>{t.approved}</td>
                  <td className="right strong" style={{ color: scoreColor(t.avg) }}>
                    {fmtScore(t.avg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">Điểm trung bình lớp phản ánh cả đầu vào học sinh; dùng để hỗ trợ, không dùng riêng để xếp loại giáo viên.</p>
        </div>
        <div className="card">
          <h2>Chuyên đề yếu toàn trường</h2>
          {data.weakTopics.length === 0 && <p className="muted small">Chưa có dữ liệu.</p>}
          {data.weakTopics.map((m: any) => (
            <div key={m.topic} className="mb">
              <div className="row between small">
                <span>{m.name}</span>
                <span className="muted">{pct(m.value)}</span>
              </div>
              <Bar value={m.value} />
            </div>
          ))}
          <h3 className="mt">Ngân hàng câu hỏi</h3>
          <p className="small">
            {bankBy('approved')} câu đã duyệt · {bankBy('draft')} câu nháp
          </p>
          <div className="row">
            {Object.entries(meta.sources).map(([k, v]) => {
              const n = data.bank.filter((b: any) => b.source === k).reduce((s: number, b: any) => s + b.n, 0);
              return n ? (
                <span key={k} className={`source ${k}`}>
                  {v}: {n}
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Users() {
  const { toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/admin/users'), []);
  const [form, setForm] = useState<any | null>(null);
  const [classForm, setClassForm] = useState<any | null>(null);
  const [secret, setSecret] = useState<{ who: string; pw: string } | null>(null);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const createUser = async () => {
    try {
      const r = await post('/api/admin/users', form);
      setSecret({ who: form.username, pw: r.tempPassword });
      setForm(null);
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const createClass = async () => {
    try {
      await post('/api/admin/classes', classForm);
      setClassForm(null);
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const reset = async (u: any) => {
    if (!confirm(`Đặt lại mật khẩu cho ${u.display_name}?`)) return;
    const r = await post(`/api/admin/users/${u.id}/reset-password`);
    setSecret({ who: u.username, pw: r.tempPassword });
  };
  const assignTeacher = async (classId: number, teacherId: string) => {
    await put(`/api/admin/classes/${classId}`, { teacherId: teacherId ? Number(teacherId) : null });
    reload();
  };
  const teachers = data.users.filter((u: any) => u.role === 'teacher');
  const ROLE: Record<string, string> = { admin: 'Quản lý', teacher: 'Giáo viên', student: 'Học sinh' };
  return (
    <div className="stack">
      <div className="row between">
        <h1>Người dùng và lớp</h1>
        <div className="row">
          <button className="btn" onClick={() => setClassForm({ name: '', grade: 12, teacherId: '' })}>
            Thêm lớp
          </button>
          <button className="btn primary" onClick={() => setForm({ role: 'student', username: '', displayName: '', classId: data.classes[0]?.id ?? '' })}>
            Thêm người dùng
          </button>
        </div>
      </div>
      <div className="alert info small">Để bảo vệ học sinh dưới 18 tuổi, hệ thống chỉ lưu tên hiển thị và tên đăng nhập. Không nhập email, số điện thoại hay ngày sinh của học sinh.</div>
      <div className="card table-wrap">
        <h2>Lớp</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Lớp</th>
              <th>Khối</th>
              <th>Giáo viên phụ trách</th>
            </tr>
          </thead>
          <tbody>
            {data.classes.map((c: any) => (
              <tr key={c.id}>
                <td className="strong">{c.name}</td>
                <td>{c.grade}</td>
                <td>
                  <select className="input" style={{ maxWidth: 260 }} value={c.teacher_id ?? ''} onChange={(e) => assignTeacher(c.id, e.target.value)} aria-label={`Giáo viên lớp ${c.name}`}>
                    <option value="">— Chưa gán —</option>
                    {teachers.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card table-wrap">
        <h2>Người dùng ({data.users.length})</h2>
        <table className="t">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Đăng nhập</th>
              <th>Vai trò</th>
              <th>Lớp</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.users.map((u: any) => (
              <tr key={u.id}>
                <td>{u.display_name}</td>
                <td className="small">{u.username}</td>
                <td>
                  <span className="badge">{ROLE[u.role]}</span>
                </td>
                <td>{u.class_name ?? ''}</td>
                <td className="right">
                  <button className="btn sm" onClick={() => reset(u)}>
                    Đặt lại mật khẩu
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title="Thêm người dùng" onClose={() => setForm(null)}>
          <div className="stack">
            <div className="field">
              <label>Vai trò</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="student">Học sinh</option>
                <option value="teacher">Giáo viên</option>
                <option value="admin">Quản lý</option>
              </select>
            </div>
            <div className="field">
              <label>Tên hiển thị</label>
              <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="field">
              <label>Tên đăng nhập (chữ không dấu, số, dấu chấm)</label>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
            </div>
            {form.role === 'student' && (
              <div className="field">
                <label>Lớp</label>
                <select className="input" value={form.classId} onChange={(e) => setForm({ ...form, classId: Number(e.target.value) })}>
                  {data.classes.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button className="btn primary" onClick={createUser}>
              Tạo tài khoản
            </button>
          </div>
        </Modal>
      )}
      {classForm && (
        <Modal title="Thêm lớp" onClose={() => setClassForm(null)}>
          <div className="stack">
            <div className="field">
              <label>Tên lớp</label>
              <input className="input" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} placeholder="VD: 12A3" />
            </div>
            <div className="field">
              <label>Khối</label>
              <select className="input" value={classForm.grade} onChange={(e) => setClassForm({ ...classForm, grade: Number(e.target.value) })}>
                {[10, 11, 12].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Giáo viên phụ trách</label>
              <select className="input" value={classForm.teacherId} onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}>
                <option value="">— Chưa gán —</option>
                {teachers.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn primary" onClick={createClass}>
              Tạo lớp
            </button>
          </div>
        </Modal>
      )}
      {secret && (
        <Modal title="Mật khẩu tạm" onClose={() => setSecret(null)}>
          <p>
            Tài khoản <b>{secret.who}</b>, mật khẩu tạm: <span className="kbd" style={{ fontSize: 18 }}>{secret.pw}</span>
          </p>
          <p className="small muted">Mật khẩu chỉ hiện một lần. Ghi lại và đưa trực tiếp cho người dùng; nhắc họ đổi mật khẩu ở trang Tài khoản.</p>
          <button className="btn primary" onClick={() => setSecret(null)}>
            Đã ghi lại
          </button>
        </Modal>
      )}
    </div>
  );
}

const ACTION: Record<string, string> = {
  login: 'Đăng nhập', logout: 'Đăng xuất', password_change: 'Đổi mật khẩu', password_reset: 'Đặt lại mật khẩu', question_create: 'Tạo câu hỏi', question_edit: 'Sửa câu hỏi', question_approve: 'Duyệt câu hỏi', question_archive: 'Ẩn câu hỏi', import_parse: 'Đọc file đề', import_save: 'Lưu câu nhập', ai_similar: 'AI tạo câu tương tự', ai_explain: 'AI viết lời giải', exam_create: 'Tạo đề', exam_export_docx: 'Xuất Word', assignment_create: 'Giao đề', report_view: 'Xem báo cáo', attempt_view: 'Xem bài làm học sinh', student_profile_view: 'Xem hồ sơ học sinh', late_accept: 'Nhận bản gửi muộn', attempt_start: 'Bắt đầu làm bài', attempt_submit: 'Nộp bài', practice_start: 'Bắt đầu luyện tập', user_create: 'Tạo tài khoản', class_create: 'Tạo lớp', class_assign_teacher: 'Gán giáo viên', seed: 'Tạo dữ liệu mẫu',
};

export function Audit() {
  const { data, error, loading, reload } = useAsync(() => get('/api/admin/audit?limit=300'), []);
  const [filter, setFilter] = useState('');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const list = data.entries.filter((e: any) => !filter || e.action === filter);
  return (
    <div className="stack">
      <div className="row between">
        <h1>Nhật ký thao tác</h1>
        <select className="input" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Lọc thao tác">
          <option value="">Mọi thao tác</option>
          {Object.entries(ACTION).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="card table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Lúc</th>
              <th>Người</th>
              <th>Thao tác</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e: any) => (
              <tr key={e.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.at)}</td>
                <td className="small">{e.display_name ?? 'Hệ thống'}</td>
                <td>
                  <span className="badge">{ACTION[e.action] ?? e.action}</span>
                </td>
                <td className="small muted">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
