import { useCallback, useEffect, useState } from 'react';
import { get, post, setUnauthorizedHandler } from './api';
import { AppCtx, Icon, Loading, Meta, User, useRoute, go, ErrorBox } from './ui/kit';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Account } from './pages/Account';
import { TeacherHome } from './pages/teacher/TeacherHome';
import { Bank } from './pages/teacher/Bank';
import { ImportPage } from './pages/teacher/Import';
import { ExamBuilder } from './pages/teacher/ExamBuilder';
import { Exams, ExamDetail } from './pages/teacher/Exams';
import { Assignments, Report } from './pages/teacher/Report';
import { ClassView, StudentProfilePage, TeacherAttemptView } from './pages/teacher/ClassView';
import { StudentHome } from './pages/student/StudentHome';
import { ExamRoom } from './pages/student/ExamRoom';
import { ResultPage } from './pages/student/Result';
import { PracticeHub } from './pages/student/Practice';
import { Progress } from './pages/student/Progress';
import { AdminHome, Users, Audit } from './pages/admin/Admin';
import { Appeals } from './pages/teacher/Appeals';

type Nav = { path: string; label: string; icon: string };
const NAV: Record<User['role'], Nav[]> = {
  teacher: [
    { path: '/', label: 'Tổng quan', icon: 'home' },
    { path: '/ngan-hang', label: 'Ngân hàng', icon: 'bank' },
    { path: '/nhap-de', label: 'Nhập đề', icon: 'import' },
    { path: '/de-thi', label: 'Đề thi', icon: 'exam' },
    { path: '/bai-giao', label: 'Kết quả', icon: 'report' },
    { path: '/khieu-nai', label: 'Khiếu nại', icon: 'log' },
  ],
  admin: [
    { path: '/', label: 'Toàn trường', icon: 'school' },
    { path: '/nguoi-dung', label: 'Người dùng', icon: 'user' },
    { path: '/ngan-hang', label: 'Ngân hàng', icon: 'bank' },
    { path: '/de-thi', label: 'Đề thi', icon: 'exam' },
    { path: '/nhat-ky', label: 'Nhật ký', icon: 'log' },
  ],
  student: [
    { path: '/', label: 'Hôm nay', icon: 'home' },
    { path: '/luyen-tap', label: 'Luyện tập', icon: 'practice' },
    { path: '/tien-bo', label: 'Tiến bộ', icon: 'report' },
    { path: '/tai-khoan', label: 'Tài khoản', icon: 'user' },
  ],
};

function match(pattern: string, path: string) {
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$');
  const m = path.match(re);
  return m ? m.slice(1) : null;
}

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [toastMsg, setToast] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const { path } = useRoute();

  const refreshUser = useCallback(() => {
    get('/api/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    get('/api/meta').then(setMeta).catch((e) => setBootError(e.message));
    get('/api/setup').then((r) => setNeedsSetup(r.needsSetup)).catch(() => setNeedsSetup(false));
    refreshUser();
  }, [refreshUser]);
  const toast = useCallback((s: string) => {
    setToast(s);
    setTimeout(() => setToast((t) => (t === s ? null : t)), 3500);
  }, []);

  if (bootError) return <div className="main"><ErrorBox error={bootError} onRetry={() => location.reload()} /></div>;
  if (!meta || user === undefined || needsSetup === null) return <Loading text="Đang mở SmartExam…" />;
  if (!user && needsSetup) return <Setup onDone={(u) => { setNeedsSetup(false); setUser(u); go('/'); }} />;
  if (!user) return <Login onLogin={(u) => { setUser(u); go('/'); }} />;

  const logout = async () => {
    await post('/api/logout').catch(() => {});
    setUser(null);
    go('/');
  };

  const routes: [string, (p: string[]) => JSX.Element][] =
    user.role === 'student'
      ? [
          ['/', () => <StudentHome />],
          ['/thi/:id', ([id]) => <ExamRoom key={id} attemptId={Number(id)} />],
          ['/ket-qua/:id', ([id]) => <ResultPage key={id} attemptId={Number(id)} />],
          ['/luyen-tap', () => <PracticeHub />],
          ['/tien-bo', () => <Progress />],
          ['/tai-khoan', () => <Account onLogout={logout} />],
        ]
      : [
          ['/', () => (user.role === 'admin' ? <AdminHome /> : <TeacherHome />)],
          ['/ngan-hang', () => <Bank />],
          ['/nhap-de', () => <ImportPage />],
          ['/ra-de', () => <ExamBuilder />],
          ['/de-thi', () => <Exams />],
          ['/de-thi/:id', ([id]) => <ExamDetail key={id} id={Number(id)} />],
          ['/bai-giao', () => <Assignments />],
          ['/khieu-nai', () => <Appeals />],
          ['/bai-giao/:id', ([id]) => <Report key={id} id={Number(id)} />],
          ['/lop/:id', ([id]) => <ClassView key={id} id={Number(id)} />],
          ['/hoc-sinh/:id', ([id]) => <StudentProfilePage key={id} id={Number(id)} />],
          ['/bai-lam/:id', ([id]) => <TeacherAttemptView key={id} id={Number(id)} />],
          ['/nguoi-dung', () => <Users />],
          ['/nhat-ky', () => <Audit />],
          ['/tai-khoan', () => <Account onLogout={logout} />],
        ];
  let page: JSX.Element | null = null;
  for (const [pat, render] of routes) {
    const m = match(pat, path);
    if (m) {
      page = render(m);
      break;
    }
  }
  const nav = NAV[user.role];
  const inExam = path.startsWith('/thi/');
  const isActive = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));

  return (
    <AppCtx.Provider value={{ meta, user, refreshUser, toast }}>
      <div className="app">
        {!inExam && (
          <aside className="sidebar">
            <a className="brand" href="#/">
              <span className="brand-logo">π</span> SmartExam AI
            </a>
            {nav.map((n) => (
              <a key={n.path} href={`#${n.path}`} className={`nav ${isActive(n.path) ? 'active' : ''}`}>
                <Icon name={n.icon} /> {n.label}
              </a>
            ))}
            <div className="spacer" />
            {user.role !== 'student' && (
              <a href="#/tai-khoan" className={`nav ${isActive('/tai-khoan') ? 'active' : ''}`}>
                <Icon name="user" /> Tài khoản
              </a>
            )}
            <div className="who">
              <div className="strong" style={{ color: 'var(--ink)' }}>{user.displayName}</div>
              <div>{user.school.name}</div>
              <button className="btn ghost sm mt" onClick={logout}>
                <Icon name="out" /> Đăng xuất
              </button>
            </div>
          </aside>
        )}
        <main className="main">
          {!inExam && (
            <div className="topbar">
              <a className="brand" href="#/">
                <span className="brand-logo">π</span> SmartExam
              </a>
              <div className="grow" />
            </div>
          )}
          {user.school.sample ? <div className="sample-banner">Bạn đang dùng <b>trường mẫu</b>: tài khoản, câu hỏi và các bài thi cũ ghi "(mô phỏng)" là dữ liệu mẫu để chạy thử.</div> : null}
          {page ?? (
            <div className="card empty">
              <h2>Không có trang này</h2>
              <a className="btn" href="#/">Về trang chính</a>
            </div>
          )}
        </main>
        {!inExam && (
          <nav className="tabbar">
            {nav.map((n) => (
              <a key={n.path} href={`#${n.path}`} className={isActive(n.path) ? 'active' : ''}>
                <Icon name={n.icon} />
                {n.label}
              </a>
            ))}
          </nav>
        )}
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}
