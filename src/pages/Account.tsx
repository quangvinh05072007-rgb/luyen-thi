import { FormEvent, useState } from 'react';
import { post } from '../api';
import { useApp } from '../ui/kit';

export function Account({ onLogout }: { onLogout: () => void }) {
  const { user, meta, toast } = useApp();
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await post('/api/me/password', { oldPassword, newPassword });
      setOld('');
      setNew('');
      toast('Đã đổi mật khẩu.');
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <div className="stack">
      <h1>Tài khoản</h1>
      <div className="card">
        <div className="strong">{user.displayName}</div>
        <div className="muted small">
          {user.username} · {{ admin: 'Quản lý trường', teacher: 'Giáo viên', student: 'Học sinh' }[user.role]}
          {user.class ? ` · Lớp ${user.class.name}` : ''} · {user.school.name}
        </div>
        <button className="btn mt" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
      <form className="card stack" onSubmit={save}>
        <h2>Đổi mật khẩu</h2>
        <div className="field">
          <label>Mật khẩu hiện tại</label>
          <input className="input" type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="field">
          <label>Mật khẩu mới (ít nhất 6 ký tự)</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" />
        </div>
        {error && <div className="alert error">{error}</div>}
        <div>
          <button className="btn primary" disabled={!oldPassword || newPassword.length < 6}>
            Đổi mật khẩu
          </button>
        </div>
      </form>
      {user.role !== 'student' && (
        <div className="card">
          <h2>Trợ lý AI</h2>
          {meta.aiEnabled ? <div className="alert ok">AI đang bật. Nội dung AI tạo luôn ở trạng thái nháp, cần giáo viên duyệt.</div> : <div className="alert warn">{meta.aiHint}</div>}
        </div>
      )}
      <div className="card">
        <h2>Quyền riêng tư</h2>
        <p className="small muted">
          SmartExam chỉ lưu tên hiển thị và tên đăng nhập của học sinh — không lưu email, số điện thoại hay ngày sinh. Học sinh chỉ xem được bài của mình; giáo viên chỉ xem lớp mình dạy; mọi lần xem hồ sơ học sinh được ghi nhật ký.
        </p>
      </div>
    </div>
  );
}
