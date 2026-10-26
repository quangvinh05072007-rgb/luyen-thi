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
    ['students', 'Học sinh', base, 'class'],
    ['work', 'Bài tập & Đề thi', `${base}/bai-giao`, 'exam'],
    ['results', 'Bảng điểm & Thống kê', `${base}/ket-qua`, 'report'],
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
    <div className="class-workspace-top">
      {/* Class Header Card */}
      <header className="class-header-card">
        <div className="class-header-left">
          <div className={`class-header-avatar k${data.class.grade}`}>
            K{data.class.grade}
          </div>
          <div className="class-header-info">
            <h1>Lớp {data.class.name}</h1>
            <div className="class-header-meta">
              <span>Khối {data.class.grade}</span>
              <span>·</span>
              <span>👥 <b>{data.students.length}</b> học sinh</span>
              <span>·</span>
              <span>
                Mã tham gia: <code style={{ fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '2px 6px', borderRadius: 4 }}>{data.class.code}</code>
              </span>
              <button
                type="button"
                className="btn sm ghost"
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => setShowInvite(true)}
              >
                Chia sẻ mã
              </button>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <a className="btn primary" href={`#/thu-vien?classId=${id}`}>
            <Icon name="plus" /> Giao đề cho lớp
          </a>
          <button type="button" className="btn ghost" onClick={() => setShowInvite(true)}>
            <Icon name="user" /> Mời học sinh
          </button>
        </div>
      </header>

      {/* Horizontal Top Tabs */}
      <nav className="class-top-tabs" aria-label="Các mục trong lớp">
        {tabs.map(([value, label, path, icon]) => (
          <a
            key={value}
            href={`#${path}`}
            className={`class-top-tab ${tab === value ? 'active' : ''}`}
            aria-current={tab === value ? 'page' : undefined}
          >
            <Icon name={icon} />
            <span>{label}</span>
            {value === 'students' && (
              <span className="badge sm blue" style={{ marginLeft: 4 }}>
                {data.students.length}
              </span>
            )}
            {value === 'work' && (
              <span className="badge sm blue" style={{ marginLeft: 4 }}>
                {data.assignments.length}
              </span>
            )}
            {value === 'work' && activeAssignments.length > 0 && (
              <span className="badge sm green" style={{ marginLeft: 4 }}>
                {activeAssignments.length} đang mở
              </span>
            )}
          </a>
        ))}
      </nav>

      {/* Main Workspace Body */}
      <div className="class-workspace-body">
        {/* Tab 1: Students Roster */}
        {tab === 'students' && (
          <div className="stack" style={{ gap: 14 }}>
            {data.students.length > 0 && (
              <div className="roster-toolbar">
                <div className="row" style={{ gap: 8, flex: 1, maxWidth: 480 }}>
                  <input
                    type="search"
                    className="input sm"
                    placeholder="Tìm họ tên hoặc tên đăng nhập…"
                    aria-label="Tìm học sinh"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select
                    className="select sm"
                    aria-label="Lọc học sinh"
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value as 'all' | 'streak' | 'xp')}
                    style={{ width: 'auto' }}
                  >
                    <option value="all">Tất cả ({data.students.length})</option>
                    <option value="streak">Có chuỗi ({studentsWithStreak})</option>
                    <option value="xp">Có XP ({studentsWithXp})</option>
                  </select>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <div className="seg" role="group" aria-label="Cách hiển thị học sinh">
                    <button
                      type="button"
                      aria-pressed={studentViewMode === 'table'}
                      className={studentViewMode === 'table' ? 'on' : ''}
                      onClick={() => setStudentViewMode('table')}
                    >
                      Bảng
                    </button>
                    <button
                      type="button"
                      aria-pressed={studentViewMode === 'grid'}
                      className={studentViewMode === 'grid' ? 'on' : ''}
                      onClick={() => setStudentViewMode('grid')}
                    >
                      Lưới
                    </button>
                  </div>
                  <button type="button" className="btn sm primary" onClick={() => setShowInvite(true)}>
                    <Icon name="plus" /> Mời học sinh
                  </button>
                </div>
              </div>
            )}

            {filteredStudents.length === 0 ? (
              <div className="class-roster-empty">
                <h2>{data.students.length ? 'Không có học sinh khớp với tìm kiếm' : 'Lớp chưa có học sinh nào'}</h2>
                {data.students.length ? (
                  <button type="button" className="btn" onClick={() => { setSearch(''); setStudentFilter('all'); }}>
                    Xóa bộ lọc
                  </button>
                ) : (
                  <>
                    <p className="tiny muted">Chia sẻ mã lớp để học sinh tự nhập mã vào lớp từ tài khoản của mình.</p>
                    <div className="row" style={{ justifyContent: 'center' }}>
                      <button type="button" className="btn primary" onClick={() => setShowInvite(true)}>
                        <Icon name="plus" /> Mời học sinh bằng mã lớp
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : studentViewMode === 'grid' ? (
              <div className="classes-card-grid">
                {filteredStudents.map((s: any) => {
                  const initial = s.display_name.trim().split(/\s+/).slice(-1)[0].slice(0, 1);
                  return (
                    <a
                      key={s.id}
                      className="card"
                      href={`#/hoc-sinh/${s.id}`}
                      style={{ padding: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <div className="workspace-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
                        {initial}
                      </div>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.display_name}
                        </div>
                        <div className="tiny muted">{s.username}</div>
                        <div className="row" style={{ gap: 8, marginTop: 4 }}>
                          {s.streak > 0 && <span className="tiny" style={{ color: '#d97706', fontWeight: 600 }}>🔥 {s.streak} ngày</span>}
                          <span className="tiny" style={{ color: '#2563eb', fontWeight: 600 }}>⚡ {s.xp || 0} XP</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="classes-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>STT</th>
                      <th>Học sinh</th>
                      <th>Tên đăng nhập</th>
                      <th>Chuỗi ngày</th>
                      <th>Điểm XP</th>
                      <th>Hoạt động gần nhất</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s: any, idx: number) => {
                      const initial = s.display_name.trim().split(/\s+/).slice(-1)[0].slice(0, 1);
                      return (
                        <tr key={s.id}>
                          <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                          <td>
                            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                              <div className="workspace-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                                {initial}
                              </div>
                              <strong style={{ color: '#0f172a' }}>{s.display_name}</strong>
                            </div>
                          </td>
                          <td>
                            <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                              {s.username}
                            </code>
                          </td>
                          <td>
                            {s.streak > 0 ? (
                              <span style={{ color: '#d97706', fontWeight: 700 }}>🔥 {s.streak} ngày</span>
                            ) : (
                              <span className="tiny muted">—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>⚡ {s.xp || 0} XP</span>
                          </td>
                          <td className="tiny muted">{s.last_active_day || 'Chưa hoạt động'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <a className="btn sm ghost" href={`#/hoc-sinh/${s.id}`} style={{ padding: '3px 8px', fontSize: 12 }}>
                              Hồ sơ học tập →
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

        {/* Tab 4: Settings */}
        {tab === 'settings' && (
          <section className="stack" style={{ gap: 16 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Thông tin lớp học</h2>
            <div className="dash-metrics-grid">
              <div className="metric-card">
                <div className="metric-info">
                  <span className="metric-lbl">Tên lớp</span>
                  <span className="metric-val">{data.class.name}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info">
                  <span className="metric-lbl">Khối</span>
                  <span className="metric-val">Khối {data.class.grade}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info">
                  <span className="metric-lbl">Mã tham gia lớp</span>
                  <span className="metric-val" style={{ color: '#2563eb' }}>{data.class.code}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info">
                  <span className="metric-lbl">Sĩ số</span>
                  <span className="metric-val">{data.students.length}</span>
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
              <p className="tiny muted">
                Học sinh dùng mã <strong>{data.class.code}</strong> để tự tham gia lớp từ ứng dụng.
              </p>
            )}
          </section>
        )}
      </div>

      {/* Modal mời học sinh */}
      {showInvite && (
        <Modal title={`Mời học sinh vào lớp ${data.class.name}`} onClose={() => setShowInvite(false)}>
          <div className="stack" style={{ gap: 16 }}>
            <p className="small muted">
              Học sinh đăng nhập vào SmartExam, mở mục <b>Lớp học</b> và nhập mã 6 ký tự dưới đây:
            </p>
            <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', border: '2px dashed #93c5fd', borderRadius: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af', letterSpacing: 3 }}>
                {data.class.code}
              </div>
              <div className="tiny muted" style={{ marginTop: 4 }}>Mã tham gia lớp {data.class.name}</div>
            </div>
            <div className="row end" style={{ gap: 8 }}>
              <button type="button" className="btn" onClick={() => setShowInvite(false)}>
                Đóng
              </button>
              <button type="button" className="btn primary" onClick={copyClassCode}>
                <Icon name="file" /> Sao chép mã lớp
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default ClassWorkspace;
