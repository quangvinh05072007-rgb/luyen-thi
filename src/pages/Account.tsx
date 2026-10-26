import { FormEvent, useState } from 'react';
import { post } from '../api';
import { PageHeading, Icon, useApp } from '../ui/kit';
import { ReviewSettings } from '../ui/ReviewSettings';

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
    <div className="stack account-page">
      <PageHeading title="Tài khoản" description="Thông tin cá nhân và bảo mật." icon="user" />
      {user.role === 'admin' && <ReviewSettings />}
      <section className="card account-profile">
        <div className="row" style={{ gap: 16 }}>
          <span className="page-intro-icon"><Icon name="user" /></span>
          <div><h2>{user.displayName}</h2><p className="small muted">{user.username} · {{ admin: 'Quản lý trường', teacher: 'Giáo viên', student: 'Học sinh' }[user.role]}{user.class ? ` · Lớp ${user.class.name}` : ''}</p><p className="small muted">{user.school.name}</p></div>
        </div>
        <button className="btn" onClick={onLogout}><Icon name="out" />Đăng xuất</button>
      </section>
      <div className="account-layout">
        <form className="card stack" onSubmit={save}>
          <div><h2>Đổi mật khẩu</h2><p className="small muted">Cập nhật mật khẩu để bảo vệ tài khoản của bạn.</p></div>
          <label className="field" htmlFor="account-current-password">Mật khẩu hiện tại<input id="account-current-password" className="input" type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></label>
          <label className="field" htmlFor="account-new-password">Mật khẩu mới (ít nhất 6 ký tự)<input id="account-new-password" className="input" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" /></label>
          {error && <div className="alert error">{error}</div>}
          <div><button className="btn primary" disabled={!oldPassword || newPassword.length < 6}>Đổi mật khẩu</button></div>
        </form>
        <aside className="stack">
          {user.role !== 'student' && <section className="card"><h2>Trợ lý AI</h2>{meta.aiEnabled ? <div className="alert ok">AI đang bật. Nội dung AI tạo luôn ở trạng thái nháp, cần giáo viên duyệt.</div> : <div className="alert warn">{meta.aiHint}</div>}</section>}
          <section className="card"><h2>Quyền riêng tư</h2><p className="small muted">SmartExam chỉ lưu tên hiển thị và tên đăng nhập của học sinh — không lưu email, số điện thoại hay ngày sinh. Học sinh chỉ xem được bài của mình; giáo viên chỉ xem lớp mình dạy; mọi lần xem hồ sơ học sinh được ghi nhật ký.</p></section>
        </aside>
      </div>
    </div>
  );
}
