import { useState } from 'react';
import { get, post, put } from '../../api';
import { PageHeading, shareUrl, Bar, ErrorBox, fmtDateTime, fmtScore, Loading, Modal, pct, scoreColor, useApp, useAsync } from '../../ui/kit';

export function AdminHome() {
  const { meta } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/admin/overview'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const bankBy = (status: string) => data.bank.filter((b: any) => b.status === status).reduce((s: number, b: any) => s + b.n, 0);
  return (
    <div className="stack">
      <PageHeading title="Chất lượng toàn trường" icon="school" description="Số liệu 90 ngày gần nhất, từ các bài kiểm tra và bài tập giáo viên giao." />

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
  const { toast, meta } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/admin/users'), []);
  const [form, setForm] = useState<any | null>(null);
  const [classForm, setClassForm] = useState<any | null>(null);
  const [secret, setSecret] = useState<{ who: string; pw: string } | null>(null);
  const [bulk, setBulk] = useState<{ text: string; classId: string; role: string } | null>(null);
  const [created, setCreated] = useState<any[] | null>(null);
  const backups = useAsync(() => get('/api/admin/backups'), []);
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
  const bulkRows = (bulk?.text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(/\t|,|;/).map((x) => x.trim()))
    .filter((c) => c[0] && !/^(họ|ho|tên|ten|stt)\b/i.test(c[0]))
    .map((c) => (/^\d+$/.test(c[0]) ? c.slice(1) : c))
    .map((c) => ({ name: c[0], className: c[1] ?? '', role: bulk?.role }));
  const runBulk = async () => {
    try {
      const r = await post('/api/admin/users/bulk', { rows: bulkRows, classId: bulk?.classId || undefined });
      setCreated(r.created);
      setBulk(null);
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const downloadCsv = () => {
    const csv = '﻿Họ tên,Lớp,Tên đăng nhập,Mật khẩu tạm\r\n' + created!.map((c) => [c.name, c.className ?? '', c.username, c.tempPassword].join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'tai-khoan-moi.csv';
    a.click();
  };
  const backupNow = async () => {
    try {
      await post('/api/admin/backups');
      toast('Đã sao lưu.');
      backups.reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const teachers = data.users.filter((u: any) => u.role === 'teacher');
  const ROLE: Record<string, string> = { admin: 'Quản lý', teacher: 'Giáo viên', student: 'Học sinh' };
  return (
    <div className="stack">
      <div className="row between">
        <PageHeading title="Người dùng và lớp" icon="class" description="Quản lý tài khoản, phân công giáo viên và danh sách lớp học." />
        <div className="row">
          <button className="btn" onClick={() => setClassForm({ name: '', grade: 12, teacherId: '' })}>
            Thêm lớp
          </button>
          <button className="btn" onClick={() => setForm({ role: 'student', username: '', displayName: '', classId: data.classes[0]?.id ?? '' })}>
            Thêm một người
          </button>
          <button className="btn primary" onClick={() => setBulk({ text: '', classId: '', role: 'student' })}>
            Nhập danh sách
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
      <div className="card">
        <div className="card-head">
          <h2>Sao lưu dữ liệu</h2>
          <button className="btn sm" onClick={backupNow}>
            Sao lưu ngay
          </button>
        </div>
        <p className="small muted">Máy tự sao lưu khi khởi động và mỗi 6 giờ, giữ 14 bản gần nhất trong thư mục <span className="kbd">{backups.data?.dir ?? 'data/backups'}</span>. Chép thư mục này ra ổ khác định kỳ. Khôi phục: tắt máy chủ, chép bản sao lưu đè lên <span className="kbd">data/smartexam.db</span>.</p>
        {(backups.data?.backups ?? []).slice(0, 5).map((b: any) => (
          <div key={b.name} className="row between small">
            <span>{b.name}</span>
            <span className="muted">
              {fmtDateTime(b.at)} · {Math.round(b.size / 1024)} KB
            </span>
          </div>
        ))}
      </div>
      {bulk && (
        <Modal title="Nhập danh sách tài khoản" onClose={() => setBulk(null)}>
          <div className="stack">
            <p className="small muted">Dán từ Excel: mỗi dòng một người. Cột 1 là họ tên, cột 2 (không bắt buộc) là lớp, ví dụ <span className="kbd">Nguyễn Văn A, 12A1</span>. Lớp chưa có sẽ được tạo. Tên đăng nhập và mật khẩu tạm sinh tự động.</p>
            <div className="row">
              <div className="seg">
                <button className={bulk.role === 'student' ? 'on' : ''} onClick={() => setBulk({ ...bulk, role: 'student' })}>
                  Học sinh
                </button>
                <button className={bulk.role === 'teacher' ? 'on' : ''} onClick={() => setBulk({ ...bulk, role: 'teacher' })}>
                  Giáo viên
                </button>
              </div>
              {bulk.role === 'student' && (
                <select className="input" style={{ width: 'auto' }} value={bulk.classId} onChange={(e) => setBulk({ ...bulk, classId: e.target.value })} aria-label="Lớp chung">
                  <option value="">Lớp ghi ở cột 2</option>
                  {data.classes.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      Tất cả vào lớp {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <textarea className="input" style={{ minHeight: 220 }} value={bulk.text} onChange={(e) => setBulk({ ...bulk, text: e.target.value })} placeholder={'Nguyễn Văn An\t12A1\nTrần Thị Bình\t12A1'} />
            <div className="small muted">Đọc được {bulkRows.length} người.</div>
            <button className="btn primary" disabled={!bulkRows.length} onClick={runBulk}>
              Tạo {bulkRows.length} tài khoản
            </button>
          </div>
        </Modal>
      )}
      {created && (
        <Modal title={`Đã tạo ${created.length} tài khoản`} onClose={() => setCreated(null)}>
          <p className="small muted no-print">Mật khẩu tạm chỉ hiện lần này. In phiếu hoặc tải file rồi phát cho từng người; nhắc đổi mật khẩu ở trang Tài khoản.</p>
          <div className="row mb no-print">
            <button className="btn primary" onClick={() => window.print()}>
              In phiếu
            </button>
            <button className="btn" onClick={downloadCsv}>
              Tải file CSV
            </button>
          </div>
          <div className="print-area slips">
            {created.map((c) => (
              <div key={c.username} className="slip">
                <div className="strong">{c.name}</div>
                <div className="tiny">{c.className ? `Lớp ${c.className}` : c.role === 'teacher' ? 'Giáo viên' : ''}</div>
                <div className="small">
                  Đăng nhập: <b>{c.username}</b>
                </div>
                <div className="small">
                  Mật khẩu: <b className="kbd">{c.tempPassword}</b>
                </div>
                <div className="tiny muted">Địa chỉ: {shareUrl(meta)}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
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
  login: 'Đăng nhập', logout: 'Đăng xuất', password_change: 'Đổi mật khẩu', password_reset: 'Đặt lại mật khẩu', question_create: 'Tạo câu hỏi', question_edit: 'Sửa câu hỏi', question_approve: 'Duyệt câu hỏi', question_archive: 'Ẩn câu hỏi', question_delete: 'Xóa câu hỏi', question_answer_change: 'Đổi đáp án câu đã dùng', attempt_reopen: 'Mở lại lượt thi', score_edit: 'Sửa điểm', attempt_extend: 'Gia hạn bài làm', assignment_extend: 'Gia hạn bài giao', data_export: 'Xuất dữ liệu', denied: 'Bị từ chối', appeal_create: 'Học sinh khiếu nại điểm', appeal_resolve: 'Xử lý khiếu nại', exam_answer_fix: 'Sửa đáp án đề + chấm lại', explanation_approve: 'Duyệt lời giải AI', explanation_reject: 'Bỏ lời giải AI', practice_assign: 'Giao phiếu luyện cho nhóm', question_restore: 'Khôi phục phiên bản câu hỏi', bulk_set_topic: 'Đổi chuyên đề hàng loạt', bulk_set_level: 'Đổi mức độ hàng loạt', bulk_archive: 'Ẩn câu hàng loạt', bulk_unarchive: 'Khôi phục câu hàng loạt', bulk_undo: 'Hoàn tác thao tác hàng loạt', blueprint_create: 'Lưu mẫu ma trận', blueprint_delete: 'Xóa mẫu ma trận', exam_clone: 'Nhân bản đề', import_answers: 'Nạp file đáp án', import_apply_key: 'Đối chiếu đáp án', import_parse: 'Đọc file đề', import_save: 'Lưu câu nhập', ai_similar: 'AI tạo câu tương tự', ai_explain: 'AI viết lời giải', exam_create: 'Tạo đề', exam_export_docx: 'Xuất Word', assignment_create: 'Giao đề', report_view: 'Xem báo cáo', attempt_view: 'Xem bài làm học sinh', student_profile_view: 'Xem hồ sơ học sinh', late_accept: 'Nhận bản gửi muộn', attempt_start: 'Bắt đầu làm bài', attempt_submit: 'Nộp bài', practice_start: 'Bắt đầu luyện tập', user_create: 'Tạo tài khoản', class_create: 'Tạo lớp', class_assign_teacher: 'Gán giáo viên', seed: 'Tạo dữ liệu mẫu',
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
        <PageHeading title="Nhật ký thao tác" icon="log" description="Theo dõi các thay đổi và hoạt động trong trường." />
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
