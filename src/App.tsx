import { useCallback, useEffect, useState } from 'react';
import { get, post, setUnauthorizedHandler } from './api';
import { AppCtx, AzotaLogo, Icon, Loading, Meta, User, useRoute, go, ErrorBox, Modal } from './ui/kit';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Account } from './pages/Account';
import { TeacherHome } from './pages/teacher/TeacherHome';
import { Bank } from './pages/teacher/Bank';
import { ImportPage } from './pages/teacher/Import';
import { ExamBuilder } from './pages/teacher/ExamBuilder';
import { ExamDetail } from './pages/teacher/Exams';
import { Report } from './pages/teacher/Report';
import { StudentProfilePage, TeacherAttemptView } from './pages/teacher/ClassView';
import { Classes } from './pages/teacher/Classes';
import { StudentHome } from './pages/student/StudentHome';
import { StudentClass } from './pages/student/StudentClass';
import { SelfStudy } from './pages/student/SelfStudy';
import { ExamRoom } from './pages/student/ExamRoom';
import { ResultPage } from './pages/student/Result';
import { PracticeHub } from './pages/student/Practice';
import { AdminHome, Users, Audit } from './pages/admin/Admin';
import { PeriodicReports } from './pages/teacher/PeriodicReports';
import { Family } from './pages/Family';
import { InstallApp } from './ui/InstallApp';
import { ClassWorkspace } from './pages/teacher/ClassWorkspace';
import { Library } from './pages/teacher/Library';
import { StudentResults } from './pages/student/StudentResults';

type Nav = { path: string; label: string; icon: string };
const NAV: Record<User['role'], Nav[]> = {
  teacher: [
    { path: '/', label: 'Tổng quan', icon: 'home' },
    { path: '/lop-hoc', label: 'Lớp học', icon: 'class' },
    { path: '/thu-vien', label: 'Đề & câu hỏi', icon: 'exam' },
  ],
  admin: [
    { path: '/', label: 'Toàn trường', icon: 'school' },
    { path: '/lop-hoc', label: 'Lớp học', icon: 'class' },
    { path: '/thu-vien', label: 'Đề & câu hỏi', icon: 'exam' },
  ],
  student: [
    { path: '/', label: 'Hôm nay', icon: 'home' },
    { path: '/lop-hoc', label: 'Lớp học', icon: 'class' },
    { path: '/luyen-tap', label: 'Tự luyện đề', icon: 'exam' },
    { path: '/tu-hoc', label: 'Tự học', icon: 'book' },
    { path: '/ket-qua', label: 'Radar năng lực', icon: 'report' },
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
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [path]);

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

  if (path === '/phu-huynh') return <><Family /><InstallApp /></>;
  if (bootError) return <div className="main"><ErrorBox error={bootError} onRetry={() => location.reload()} /></div>;
  if (!meta || user === undefined || needsSetup === null) return <Loading text="Đang mở SmartExam…" />;
  if (!user && needsSetup) return <Setup onDone={(u) => { setNeedsSetup(false); setUser(u); go('/'); }} />;
  if (!user) return <><Login onLogin={(u) => { setUser(u); go('/'); }} /><InstallApp /></>;

  const logout = async () => {
    await post('/api/logout').catch(() => {});
    setUser(null);
    go('/');
  };

  const routes: [string, (p: string[]) => JSX.Element][] =
    user.role === 'student'
      ? [
          ['/', () => <StudentHome />],
          ['/lop-hoc', () => <StudentClass />],
          ['/luyen-tap', () => <PracticeHub />],
          ['/tu-hoc', () => <SelfStudy />],
          ['/thi/:id', ([id]) => <ExamRoom key={id} attemptId={Number(id)} />],
          ['/ket-qua/:id', ([id]) => <ResultPage key={id} attemptId={Number(id)} />],
          ['/ket-qua', () => <StudentResults key="results" />],
          ['/tien-bo', () => <StudentResults key="progress" initial="progress" />],
          ['/khieu-nai', () => <StudentResults key="appeals" initial="appeals" />],
          ['/tai-khoan', () => <Account onLogout={logout} />],
        ]
      : [
          ['/', () => (user.role === 'admin' ? <AdminHome /> : <TeacherHome />)],
          ['/thu-vien', () => <Library />],
          ['/ngan-hang', () => <Library><Bank /></Library>],
          ['/nhap-de', () => <Library><ImportPage /></Library>],
          ['/ra-de', () => <Library><ExamBuilder /></Library>],
          ['/de-thi', () => <Library />],
          ['/de-thi/:id', ([id]) => <Library><ExamDetail key={id} id={Number(id)} /></Library>],
          ['/bai-giao', () => <Classes />],
          ['/khieu-nai', () => <Classes />],
          ['/bao-cao', () => user.role === 'admin' ? <PeriodicReports /> : <Classes />],
          ['/lop-hoc', () => <Classes />],
          ['/bai-giao/:id', ([id]) => <Report key={id} id={Number(id)} />],
          ['/lop/:id', ([id]) => <ClassWorkspace key={id} id={Number(id)} />],
          ['/lop/:id/bai-giao', ([id]) => <ClassWorkspace key={id} id={Number(id)} tab="work" />],
          ['/lop/:id/ket-qua', ([id]) => <ClassWorkspace key={id} id={Number(id)} tab="results" />],
          ['/lop/:id/ket-qua/:assignmentId', ([id,aid]) => <ClassWorkspace key={id} id={Number(id)} tab="results" assignmentId={Number(aid)} />],
          ['/lop/:id/cai-dat', ([id]) => <ClassWorkspace key={id} id={Number(id)} tab="settings" />],
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
  const mobileNav = nav.length > 5 ? nav.slice(0, 4) : nav;
  const moreNav = nav.length > 5 ? [...nav.slice(4), {path:'/tai-khoan',label:'Tài khoản',icon:'user'}] : [];
  const isActive = (p: string) => p === '/lop-hoc' ? path === p || ['/lop/','/hoc-sinh/','/bai-giao','/bai-lam/','/khieu-nai'].some(prefix=>path.startsWith(prefix)) : p === '/thu-vien' ? ['/thu-vien','/de-thi','/ngan-hang','/nhap-de','/ra-de'].some(prefix=>path.startsWith(prefix)) : p === '/ket-qua' ? ['/ket-qua','/tien-bo','/khieu-nai'].some(prefix=>path.startsWith(prefix)) : p === '/' ? path === '/' : path.startsWith(p);

  return (
    <AppCtx.Provider value={{ meta, user, refreshUser, toast }}>
      <div className="app">
        <a href="#main-content" className="skip-link" onClick={e => {e.preventDefault();document.getElementById('main-content')?.focus();}}>Đến nội dung chính</a>
        {!inExam && (
          <aside className="sidebar">
            <a className="brand" href="#/">
              <AzotaLogo size={34} />
              <div className="brand-text">
                <span className="brand-name">SmartExam</span>
                <span className="brand-tag">azota style</span>
              </div>
            </a>
            {nav.map((n) => (
              <a key={n.path} href={`#${n.path}`} aria-current={isActive(n.path) ? 'page' : undefined} className={`nav ${isActive(n.path) ? 'active' : ''}`}>
                <Icon name={n.icon} /> {n.label}
              </a>
            ))}
            <div className="spacer" />
            <div className="who">
              <div className="strong" style={{ color: 'var(--ink)' }}>{user.displayName}</div>
              <div>{user.school.name}</div>
            </div>
          </aside>
        )}
        <main className="main" id="main-content" tabIndex={-1}>
          {!inExam && (
            <div className="topbar">
              <a className="brand" href="#/">
                <AzotaLogo size={32} />
                <div className="brand-text">
                  <span className="brand-name">SmartExam</span>
                </div>
              </a>
              <div className="grow" />
              <span className="workspace-label small muted">{{admin:'Quản lý trường',teacher:'Không gian giáo viên',student:'Không gian học tập'}[user.role]}</span>
              <details className="account-menu" onKeyDown={e=>{if(e.key==='Escape')e.currentTarget.open=false;}}><summary><Icon name="user"/><span>{user.displayName}</span></summary><div className="account-options" onClick={e=>{(e.currentTarget.parentElement as HTMLDetailsElement).open=false;}}><a href="#/tai-khoan">Tài khoản</a>{user.role==='admin'&&<><a href="#/nguoi-dung">Người dùng & phân công</a><a href="#/nhat-ky">Nhật ký</a><a href="#/bao-cao">Báo cáo toàn trường</a></>}<button onClick={logout}>Đăng xuất</button></div></details>
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
            {mobileNav.map((n) => (
              <a key={n.path} href={`#${n.path}`} aria-current={isActive(n.path) ? 'page' : undefined} className={isActive(n.path) ? 'active' : ''}>
                <Icon name={n.icon} />
                {n.label}
              </a>
            ))}
            {moreNav.length > 0 && <button className={moreNav.some(n => isActive(n.path)) ? 'active' : ''} aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Icon name="user" />Thêm</button>}
          </nav>
        )}
        {navOpen && <Modal title="Các mục khác" onClose={() => setNavOpen(false)}><nav className="stack">{moreNav.map(n => <a className="btn" key={n.path} href={`#${n.path}`} onClick={() => setNavOpen(false)}><Icon name={n.icon} />{n.label}</a>)}</nav></Modal>}
        {!inExam && <InstallApp />}
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}
