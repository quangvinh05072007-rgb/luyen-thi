import { useEffect, useState } from 'react';
import { get } from '../../api';
import { ErrorBox, Icon, Loading, useApp, useAsync, useRoute } from '../../ui/kit';
import { ClassView } from './ClassView';
import { Assignments, Report } from './Report';
import { Appeals } from './Appeals';
import { PeriodicReports } from './PeriodicReports';

type ClassTab = 'students' | 'work' | 'results' | 'settings';

const AVATAR_COLORS = [
  'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
  'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
  'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
  'linear-gradient(135deg, #eb2f96 0%, #c41d7f 100%)',
  'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
  'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
];

function getAvatarBg(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ClassWorkspace({ id, tab = 'students', assignmentId }: { id: number; tab?: ClassTab; assignmentId?: number }) {
  const { user, toast } = useApp();
  const { query } = useRoute();
  const { data, error, loading, reload } = useAsync(() => get(`/api/classes/${id}`), [id]);
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'streak' | 'xp'>('all');
  const [studentViewMode, setStudentViewMode] = useState<'grid' | 'table'>('grid');
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
    ['students', `👥 Học sinh (${data.students.length})`, base, 'class'],
    ['work', `📝 Bài đã giao (${data.assignments.length})`, `${base}/bai-giao`, 'exam'],
    ['results', '📊 Kết quả & Báo cáo', `${base}/ket-qua`, 'report'],
    ['settings', '⚙️ Cài đặt lớp', `${base}/cai-dat`, 'gear'],
  ];

  const now = Date.now();
  const activeAssignments = (data.assignments || []).filter((a: any) => a.open_at <= now && a.close_at >= now);
  const studentsWithStreak = (data.students || []).filter((s: any) => s.streak > 0).length;
  const studentsWithXp = (data.students || []).filter((s: any) => s.xp > 0).length;

  const filteredStudents = data.students.filter((s: any) => {
    const matchSearch = `${s.display_name} ${s.username}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    if (!matchSearch) return false;
    if (studentFilter === 'streak') return s.streak > 0;
    if (studentFilter === 'xp') return s.xp > 0;
    return true;
  });

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Breadcrumb & Header */}
      <div>
        <a className="small muted" href="#/lop-hoc" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          ← Danh sách lớp học
        </a>
        <header className="row between wrap" style={{ gap: 14, alignItems: 'center' }}>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Lớp {data.class.name}</h1>
              <span
                className="badge"
                style={{
                  background: data.class.grade === 12 ? '#e6f4ff' : data.class.grade === 11 ? '#f9f0ff' : '#e6fffb',
                  color: data.class.grade === 12 ? '#0958d9' : data.class.grade === 11 ? '#531dab' : '#08979c',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                Khối {data.class.grade}
              </span>

              {data.class.code && (
                <div
                  className="row"
                  style={{
                    background: '#f8fafc',
                    border: '1px dashed #94a3b8',
                    padding: '3px 10px',
                    borderRadius: 20,
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="tiny muted">Mã lớp:</span>
                  <strong style={{ color: '#1677ff', letterSpacing: '0.6px', fontSize: 13 }}>{data.class.code}</strong>
                  <button
                    type="button"
                    className="btn sm"
                    style={{ padding: '1px 6px', height: 'auto', fontSize: 11 }}
                    onClick={() => {
                      navigator.clipboard?.writeText(data.class.code);
                      toast(`Đã chép mã lớp ${data.class.code}`);
                    }}
                  >
                    Sao chép
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <a className="btn primary" href={`#/thu-vien?classId=${id}`}>
              + Giao bài cho lớp
            </a>
          </div>
        </header>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="stat-widget-grid">
        <div className="stat-widget">
          <div className="stat-widget-icon blue">
            <Icon name="class" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{data.students.length}</span>
            <span className="stat-widget-label">Học sinh trong lớp</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon orange">
            <Icon name="exam" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{data.assignments.length}</span>
            <span className="stat-widget-label">
              {activeAssignments.length > 0 ? `⚡ ${activeAssignments.length} bài đang mở` : 'Bài tập đã giao'}
            </span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon green">
            <Icon name="check" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{studentsWithStreak}</span>
            <span className="stat-widget-label">Học sinh giữ chuỗi học</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="section-tabs" aria-label="Các mục trong lớp">
        {tabs.map(([value, label, path]) => (
          <a
            key={value}
            href={`#${path}`}
            aria-current={tab === value ? 'page' : undefined}
            className={tab === value ? 'active' : ''}
            style={{ fontWeight: 600 }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Tab 1: Students Roster */}
      {tab === 'students' && (
        <div className="stack" style={{ gap: 14 }}>
          {/* Controls toolbar */}
          <div className="card flat row between wrap" style={{ padding: '10px 14px', gap: 12, alignItems: 'center' }}>
            <div className="filter-pills" style={{ flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={`filter-pill ${studentFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStudentFilter('all')}
              >
                Tất cả ({data.students.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${studentFilter === 'streak' ? 'active' : ''}`}
                onClick={() => setStudentFilter('streak')}
              >
                🔥 Có chuỗi ({studentsWithStreak})
              </button>
              <button
                type="button"
                className={`filter-pill ${studentFilter === 'xp' ? 'active' : ''}`}
                onClick={() => setStudentFilter('xp')}
              >
                ⚡ Có XP ({studentsWithXp})
              </button>
            </div>

            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 200 }}>
                <input
                  type="search"
                  className="input"
                  placeholder="🔍 Tìm họ tên hoặc username…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ height: 34, borderRadius: 20, padding: '4px 12px', fontSize: 13 }}
                />
              </div>

              <div className="row" style={{ background: '#f1f5f9', padding: 2, borderRadius: 6, gap: 2 }}>
                <button
                  type="button"
                  className={`btn sm ${studentViewMode === 'grid' ? 'primary' : 'ghost'}`}
                  style={{ padding: '3px 8px', height: 28, fontSize: 11, borderRadius: 4 }}
                  onClick={() => setStudentViewMode('grid')}
                  title="Xem dạng lưới thẻ học sinh"
                >
                  🔲 Lưới
                </button>
                <button
                  type="button"
                  className={`btn sm ${studentViewMode === 'table' ? 'primary' : 'ghost'}`}
                  style={{ padding: '3px 8px', height: 28, fontSize: 11, borderRadius: 4 }}
                  onClick={() => setStudentViewMode('table')}
                  title="Xem dạng bảng điểm danh"
                >
                  📄 Bảng
                </button>
              </div>
            </div>
          </div>

          {/* Student Grid / Table */}
          {filteredStudents.length === 0 ? (
            <div className="card empty" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 6 }}>🔍</span>
              <div style={{ fontWeight: 600, color: '#374151' }}>
                {data.students.length ? 'Không có học sinh khớp với tìm kiếm.' : 'Lớp chưa có học sinh nào.'}
              </div>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                Chia sẻ mã lớp <strong>{data.class.code}</strong> để học sinh tự nhập mã vào lớp.
              </p>
            </div>
          ) : studentViewMode === 'grid' ? (
            <div className="student-compact-grid">
              {filteredStudents.map((s: any) => {
                const initial = s.display_name.trim().split(/\s+/).slice(-1)[0].slice(0, 1);
                const bg = getAvatarBg(s.display_name);

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
                            🔥 {s.streak}
                          </span>
                        )}
                        <span className="tiny" style={{ color: '#4f46e5', fontWeight: 600 }}>
                          ⚡ {s.xp || 0} XP
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
                    const bg = getAvatarBg(s.display_name);

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
                            <span style={{ color: '#d97706', fontWeight: 700 }}>🔥 {s.streak} ngày</span>
                          ) : (
                            <span className="tiny muted">—</span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: '#4f46e5', fontWeight: 700 }}>⚡ {s.xp || 0} XP</span>
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
    </div>
  );
}
