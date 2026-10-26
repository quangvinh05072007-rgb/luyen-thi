import { matchesSearch } from '../../../shared/search.mjs';
import { useEffect, useState } from 'react';
import { get } from '../../api';
import { ErrorBox, Icon, Loading, Modal, useApp, useAsync, useRoute } from '../../ui/kit';
import { ClassView } from './ClassView';
import { Assignments, Report } from './Report';
import { Appeals } from './Appeals';
import { PeriodicReports } from './PeriodicReports';

type ClassTab = 'students' | 'work' | 'results' | 'settings';


export function ClassWorkspace({ id, tab = 'students', assignmentId }: { id: number; tab?: ClassTab; assignmentId?: number }) {
  const { user, toast } = useApp();
  const { query } = useRoute();
  const { data, error, loading, reload } = useAsync(() => get(`/api/classes/${id}`), [id]);
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'streak' | 'xp'>('all');
  const [studentViewMode, setStudentViewMode] = useState<'grid' | 'table'>('table');
  const initialView = query.get('view');
  const [resultTab, setResultTab] = useState(initialView && ['scores', 'analysis', 'period', 'appeals'].includes(initialView) ? initialView : 'scores');

  useEffect(() => {
    const v = query.get('view');
    if (v && ['scores', 'analysis', 'period', 'appeals'].includes(v)) {
      setResultTab(v);
    }
  }, [query.get('view')]);

  if (loading) return <Loading text="Đang mở lớp…" />;
  if (error || !data) return <ErrorBox error={error ?? 'Không mở được lớp.'} onRetry={reload} />;

  const base = `/lop/${id}`;
  const tabs: [ClassTab, string, string, string][] = [
    ['students', 'Danh sách học sinh', base, 'class'],
    ['work', 'Bài tập, đề thi', `${base}/bai-giao`, 'exam'],
    ['results', 'Bảng điểm & báo cáo', `${base}/ket-qua`, 'report'],
    ['settings', 'Cài đặt lớp', `${base}/cai-dat`, 'gear'],
  ];

  const now = Date.now();
  const activeAssignments = (data.assignments || []).filter((a: any) => a.open_at <= now && a.close_at >= now);
  const studentsWithStreak = (data.students || []).filter((s: any) => s.streak > 0).length;
  const studentsWithXp = (data.students || []).filter((s: any) => s.xp > 0).length;

  const filteredStudents = data.students.filter((s: any) => {
    const matchSearch = matchesSearch(`${s.display_name} ${s.username}`, search);
    if (!matchSearch) return false;
    if (studentFilter === 'streak') return s.streak > 0;
    if (studentFilter === 'xp') return s.xp > 0;
    return true;
  });

  const copyClassCode = async () => {
    try {
      await navigator.clipboard.writeText(data.class.code);
      toast(`Đã sao chép mã lớp ${data.class.code}`);
    } catch { toast('Chưa sao chép được. Bạn có thể chọn và chép mã lớp trực tiếp.'); }
  };

  return (
    <div className="class-workspace">
      <aside className="class-section-nav">
        <nav aria-label="Các mục trong lớp">{tabs.map(([value, label, path, icon]) => <a key={value} href={`#${path}`} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></a>)}</nav>
        <div className="class-nav-summary"><span>{data.students.length} học sinh</span><span>{data.assignments.length} bài đã giao</span>{activeAssignments.length > 0 && <span className="class-nav-live">{activeAssignments.length} bài thi đang mở</span>}</div>
      </aside>
      <section className="class-content-panel" aria-label={`Quản lý lớp ${data.class.name}`}>
        <header className="class-panel-heading"><div><h1>{data.class.name}</h1><button type="button" className="class-code-shortcut" onClick={() => setShowInvite(true)} aria-label="Xem mã tham gia lớp" title="Mã tham gia lớp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6zM12 3v3m0 6h6m3 0v3M3 12h6m3 3v6"/></svg></button><span className="class-grade-label">Khối {data.class.grade}</span></div><a className="btn directory-icon-button" href={`#${base}/cai-dat`} aria-label="Cài đặt lớp" title="Cài đặt lớp"><Icon name="gear" /></a></header>
        <div className="class-access-bar"><span>Mã tham gia lớp: <strong>{data.class.code}</strong></span><button type="button" className="btn sm" onClick={() => setShowInvite(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3M9 14l6 3"/></svg>Chia sẻ mã</button></div>
      {/* Tab 1: Students Roster */}
      {tab === 'students' && (
        <div className="stack" style={{ gap: 14 }}>
          {data.students.length > 0 && <div className="class-roster-toolbar">
            <input type="search" className="input" placeholder="Tìm họ tên hoặc tên đăng nhập" aria-label="Tìm học sinh" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="select" aria-label="Lọc học sinh" value={studentFilter} onChange={e => setStudentFilter(e.target.value as 'all' | 'streak' | 'xp')}><option value="all">Tất cả ({data.students.length})</option><option value="streak">Có chuỗi ({studentsWithStreak})</option><option value="xp">Có XP ({studentsWithXp})</option></select>
            <div className="seg" role="group" aria-label="Cách hiển thị học sinh"><button type="button" aria-pressed={studentViewMode === 'grid'} className={studentViewMode === 'grid' ? 'on' : ''} onClick={() => setStudentViewMode('grid')}>Lưới</button><button type="button" aria-pressed={studentViewMode === 'table'} className={studentViewMode === 'table' ? 'on' : ''} onClick={() => setStudentViewMode('table')}>Bảng</button></div>
            <button type="button" className="btn class-soft-button" onClick={() => setShowInvite(true)}><Icon name="plus" />Mời học sinh</button>
          </div>}
          {/* Student Grid / Table */}
          {filteredStudents.length === 0 ? (
            <div className="class-roster-empty">
              <svg width="90" height="88" viewBox="0 0 90 88" fill="none" aria-hidden="true"><path d="M20 42h50l10 25v18H10V67l10-25Z" fill="#f5f8ff" stroke="#2d62f0" strokeWidth="2"/><path d="M23 48h44l6 18H56c0 7-5 11-11 11s-11-4-11-11H17l6-18Z" fill="#e7efff"/><path d="M10 66h24c0 7 5 11 11 11s11-4 11-11h24M45 14v15M22 18l10 12m36-12L58 30" stroke="#6791ff" strokeWidth="2" strokeLinecap="round"/></svg>
              <h2>{data.students.length ? 'Không có học sinh khớp với tìm kiếm' : 'Chưa có dữ liệu học sinh'}</h2>
              {data.students.length ? <button type="button" className="btn" onClick={() => {setSearch('');setStudentFilter('all');}}>Xóa bộ lọc</button> : <>
                <p>Chia sẻ mã lớp để học sinh tự tham gia.</p>
                <div className="row"><button type="button" className="btn class-soft-button" onClick={() => setShowInvite(true)}><Icon name="plus" />Mời học sinh bằng mã lớp</button>{user.role === 'admin' && <a className="btn class-soft-button" href="#/nguoi-dung"><Icon name="file" />Thêm hoặc nhập danh sách học sinh</a>}</div>
              </>}
            </div>
          ) : studentViewMode === 'grid' ? (
            <div className="student-compact-grid">
              {filteredStudents.map((s: any) => {
                const initial = s.display_name.trim().split(/\s+/).slice(-1)[0].slice(0, 1);
                const bg = 'var(--primary-soft)';

                return (
                  <a
                    key={s.id}
                    className="student-compact-card"
                    href={`#/hoc-sinh/${s.id}`}
                    title={`Xem hồ sơ của ${s.display_name}`}
                  >
                    <div className="student-avatar-circle" style={{ background: bg }}>
                      {initial}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.display_name}
                      </div>
                      <div className="tiny muted" style={{ fontSize: 11 }}>
                        {s.username}
                      </div>
                      <div className="row" style={{ gap: 6, marginTop: 4, alignItems: 'center' }}>
                        {s.streak > 0 && (
                          <span className="tiny" style={{ color: '#d97706', fontWeight: 700 }}>
                            <Icon name="flame" /> {s.streak}
                          </span>
                        )}
                        <span className="tiny" style={{ color: '#4f46e5', fontWeight: 600 }}>
                          <Icon name="practice" /> {s.xp || 0} XP
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="roster-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>STT</th>
                    <th>Học sinh</th>
                    <th>Tên đăng nhập</th>
                    <th>Chuỗi ngày</th>
                    <th>Điểm kinh nghiệm</th>
                    <th>Hoạt động</th>
                    <th style={{ textAlign: 'right' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s: any, idx: number) => {
                    const initial = s.display_name.trim().split(/\s+/).slice(-1)[0].slice(0, 1);
                    const bg = 'var(--primary-soft)';

                    return (
                      <tr key={s.id}>
                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                        <td>
                          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                            <div
                              className="student-avatar-circle"
                              style={{ width: 28, height: 28, fontSize: 11, background: bg }}
                            >
                              {initial}
                            </div>
                            <strong style={{ color: '#0f172a' }}>{s.display_name}</strong>
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: 12 }}>{s.username}</code>
                        </td>
                        <td>
                          {s.streak > 0 ? (
                            <span style={{ color: '#d97706', fontWeight: 700 }}><Icon name="flame" /> {s.streak} ngày</span>
                          ) : (
                            <span className="tiny muted">—</span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: '#4f46e5', fontWeight: 700 }}><Icon name="practice" /> {s.xp || 0} XP</span>
                        </td>
                        <td className="tiny muted">{s.last_active_day || 'Chưa vào hôm nay'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <a className="btn sm ghost" href={`#/hoc-sinh/${s.id}`}>
                            Xem hồ sơ →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Assignments */}
      {tab === 'work' && <Assignments classId={id} results={false} />}

      {/* Tab 3: Results & Reports */}
      {tab === 'results' &&
        (assignmentId ? (
          <Report id={assignmentId} classId={id} />
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            <div className="seg" aria-label="Loại kết quả">
              {[
                ['scores', 'Bảng điểm'],
                ['analysis', 'Phân tích'],
                ['period', 'Báo cáo'],
                ['appeals', 'Khiếu nại'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={resultTab === value ? 'on' : ''}
                  aria-pressed={resultTab === value}
                  onClick={() => setResultTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {resultTab === 'scores' && <Assignments classId={id} />}
            {resultTab === 'analysis' && <ClassView id={id} embedded />}
            {resultTab === 'period' && <PeriodicReports classId={id} />}
            {resultTab === 'appeals' && <Appeals classId={id} />}
          </div>
        ))}

      {/* Tab 4: Class Settings */}
      {tab === 'settings' && (
        <section className="card stack" style={{ gap: 16 }}>
          <div className="card-head">
            <h2>Thông tin lớp học</h2>
          </div>
          <div className="stat-widget-grid">
            <div className="stat-widget">
              <div className="stat-widget-info">
                <span className="stat-widget-label">Tên lớp</span>
                <span className="stat-widget-num" style={{ fontSize: 20 }}>
                  {data.class.name}
                </span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-info">
                <span className="stat-widget-label">Khối</span>
                <span className="stat-widget-num" style={{ fontSize: 20 }}>
                  Khối {data.class.grade}
                </span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-info">
                <span className="stat-widget-label">Mã tham gia lớp</span>
                <span className="stat-widget-num" style={{ fontSize: 18, color: '#1677ff' }}>
                  {data.class.code}
                </span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-info">
                <span className="stat-widget-label">Sĩ số</span>
                <span className="stat-widget-num" style={{ fontSize: 20 }}>
                  {data.students.length} học sinh
                </span>
              </div>
            </div>
          </div>
          {user.role === 'admin' ? (
            <div>
              <a className="btn primary" href="#/nguoi-dung">
                Quản lý tài khoản và phân công
              </a>
            </div>
          ) : (
            <div className="row small muted">
              <span>
                Học sinh có thể dùng mã <strong>{data.class.code}</strong> để tự tham gia lớp. Phân công lớp do quản trị viên quản lý.
              </span>
            </div>
          )}
        </section>
      )}
      </section>
      {showInvite && <Modal title={`Mời học sinh vào lớp ${data.class.name}`} onClose={() => setShowInvite(false)}><div className="stack"><p className="small muted">Học sinh mở SmartExam, vào Lớp học và nhập mã dưới đây để tham gia lớp.</p><label className="field"><span>Mã tham gia lớp</span><input className="input class-invite-code" value={data.class.code ?? ''} readOnly onFocus={e => e.target.select()} /></label><div className="row end"><button type="button" className="btn" onClick={() => setShowInvite(false)}>Đóng</button><button type="button" className="btn primary" onClick={copyClassCode}><Icon name="file" />Sao chép mã</button></div>{user.role === 'admin' && <a className="small" href="#/nguoi-dung">Thêm tài khoản hoặc nhập danh sách học sinh</a>}</div></Modal>}
    </div>
  );
}
