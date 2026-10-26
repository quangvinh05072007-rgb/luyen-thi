import { FormEvent, useState } from 'react';
import { post } from '../api';
import { AzotaLogo, User } from '../ui/kit';

export function Setup({ onDone }: { onDone: (u: User) => void }) {
  const [schoolName, setSchool] = useState('');
  const [adminName, setAdmin] = useState('');
  const [username, setU] = useState('quanly');
  const [password, setP] = useState('');
  const [password2, setP2] = useState('');
  const [withSampleBank, setBank] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (body: any) => {
    setBusy(true);
    setError(null);
    try {
      const r = await post('/api/setup', body);
      onDone(r.user);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) return setError('Hai lần nhập mật khẩu không khớp.');
    run({ mode: 'real', schoolName, adminName, username, password, withSampleBank });
  };

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <div className="center mb">
          <AzotaLogo size={54} />
          <h1 style={{ marginTop: 8 }}>Chào mừng đến SmartExam AI</h1>
          <p className="muted">Thiết lập lần đầu. Chỉ làm một lần.</p>
        </div>
        <form className="card stack" onSubmit={submit}>
          <h2>Tạo trường của bạn</h2>
          <div className="field">
            <label>Tên trường</label>
            <input className="input" value={schoolName} onChange={(e) => setSchool(e.target.value)} placeholder="VD: Trường THPT Nguyễn Du" autoFocus />
          </div>
          <div className="field">
            <label>Tên người quản lý</label>
            <input className="input" value={adminName} onChange={(e) => setAdmin(e.target.value)} placeholder="VD: Thầy Lê Văn Hùng" />
          </div>
          <div className="field">
            <label>Tên đăng nhập quản lý</label>
            <input className="input" value={username} onChange={(e) => setU(e.target.value.toLowerCase())} autoComplete="username" />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Mật khẩu (ít nhất 8 ký tự)</label>
              <input className="input" type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="field">
              <label>Nhập lại mật khẩu</label>
              <input className="input" type="password" value={password2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <label className="check small">
            <input type="checkbox" checked={withSampleBank} onChange={(e) => setBank(e.target.checked)} />
            Thêm sẵn 64 câu hỏi mẫu (đã duyệt, gắn nhãn "Mẫu") để ra đề được ngay
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary big block" disabled={busy || !schoolName.trim() || !adminName.trim() || password.length < 8}>
            {busy ? 'Đang tạo…' : 'Tạo trường và vào trang quản lý'}
          </button>
          <p className="tiny muted">Sau đó: thêm giáo viên, dán danh sách học sinh ở trang Người dùng để tạo tài khoản hàng loạt.</p>
        </form>
        <div className="card flat mt row between">
          <div>
            <div className="strong small">Chỉ muốn xem thử?</div>
            <div className="tiny muted">Tạo trường mẫu có lớp, học sinh và bài thi mô phỏng. Muốn dùng thật sau này: chạy "npm run reset".</div>
          </div>
          <button className="btn" disabled={busy} onClick={() => run({ mode: 'sample' })}>
            Dùng trường mẫu
          </button>
        </div>
      </div>
    </div>
  );
}
