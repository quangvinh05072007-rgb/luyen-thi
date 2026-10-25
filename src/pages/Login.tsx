import { FormEvent, useEffect, useState } from 'react';
import { get, post } from '../api';
import { Mascot, User } from '../ui/kit';

const DEMO = [
  { u: 'hs.an.nm', label: 'Học sinh', who: 'Nguyễn Minh An — 12A1' },
  { u: 'gv.lan', label: 'Giáo viên', who: 'Cô Nguyễn Thị Lan — dạy 12A1' },
  { u: 'quanly', label: 'Quản lý', who: 'Ban giám hiệu trường mẫu' },
];

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(false);
  useEffect(() => {
    get('/api/demo').then((r) => setSample(r.sample)).catch(() => {});
  }, []);

  const submit = async (e?: FormEvent, u = username, p = password) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post('/api/login', { username: u, password: p });
      onLogin(r.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="center mb">
          <Mascot size={96} mood="cheer" />
          <h1 style={{ marginTop: 8 }}>SmartExam AI</h1>
          <p className="muted">Kiểm tra, chẩn đoán và luyện Toán THPT theo năng lực từng em.</p>
        </div>
        <form className="card stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="u">Tên đăng nhập</label>
            <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="p">Mật khẩu</label>
            <input id="p" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} />
          </div>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary big block" disabled={busy || !username || !password}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <a className="btn ghost block mt" href="#/phu-huynh">Dành cho phụ huynh</a>
        {sample && <div className="card flat mt demo-accounts">
          <div className="row between mb">
            <h3 style={{ margin: 0 }}>Tài khoản mẫu</h3>
            <span className="badge amber">Dữ liệu mẫu</span>
          </div>
          <p className="small muted">Mật khẩu chung: <span className="kbd">demo1234</span>. Bấm để vào nhanh.</p>
          <div className="stack">
            {DEMO.map((d) => (
              <button key={d.u} className="btn block" style={{ justifyContent: 'flex-start' }} disabled={busy} onClick={() => submit(undefined, d.u, 'demo1234')}>
                <span className="badge blue">{d.label}</span>
                <span className="small">{d.who}</span>
              </button>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
}
