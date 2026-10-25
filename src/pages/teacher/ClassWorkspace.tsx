import { useEffect, useState } from 'react';
import { get } from '../../api';
import { ErrorBox, Loading, useApp, useAsync, useRoute } from '../../ui/kit';
import { ClassView } from './ClassView';
import { Assignments, Report } from './Report';
import { Appeals } from './Appeals';
import { PeriodicReports } from './PeriodicReports';

type ClassTab = 'students' | 'work' | 'results' | 'settings';
export function ClassWorkspace({ id, tab = 'students', assignmentId }: { id: number; tab?: ClassTab; assignmentId?: number }) {
  const { user } = useApp();
  const { query } = useRoute();
  const { data, error, loading, reload } = useAsync(() => get(`/api/classes/${id}`), [id]);
  const [search, setSearch] = useState('');
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
  const tabs: [ClassTab, string, string][] = [
    ['students', 'Học sinh', base],
    ['work', 'Bài đã giao', `${base}/bai-giao`],
    ['results', 'Kết quả', `${base}/ket-qua`],
    ['settings', 'Cài đặt lớp', `${base}/cai-dat`],
  ];
  const students = data.students.filter((s: any) =>
    `${s.display_name} ${s.username}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  );
  return (
    <div className="stack">
      <div>
        <a className="small muted" href="#/lop-hoc" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          ← Danh sách lớp
        </a>
        <header className="row between wrap" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <h1 style={{ margin: 0 }}>Lớp {data.class.name}</h1>
            <span className="badge blue">Khối {data.class.grade}</span>
            <span className="badge">👥 {data.students.length} học sinh</span>
          </div>
          <a className="btn primary" href={`#/thu-vien?classId=${id}`}>
            + Giao bài cho lớp
          </a>
        </header>
      </div>

      <nav className="section-tabs" aria-label="Các mục trong lớp">
        {tabs.map(([value, label, path]) => (
          <a key={value} href={`#${path}`} aria-current={tab === value ? 'page' : undefined} className={tab === value ? 'active' : ''}>
            {label}
          </a>
        ))}
      </nav>

      {tab === 'students' && (
        <div className="stack">
          <div className="card flat row between" style={{ padding: '10px 14px', gap: 10, flexWrap: 'wrap' }}>
            <span className="small muted" style={{ fontWeight: 600 }}>
              Sĩ số: {students.length} / {data.students.length} học sinh
            </span>
            <div style={{ flex: '1 1 220px', maxWidth: 320 }}>
              <input
                type="search"
                className="input"
                placeholder="Tìm họ tên hoặc tên đăng nhập…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            {students.map((s: any) => (
              <a className="class-widget-card" key={s.id} href={`#/hoc-sinh/${s.id}`}>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <span className="student-avatar" aria-hidden="true">
                    {s.display_name.trim().split(/\s+/).slice(-1)[0].slice(0, 1)}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827' }}>{s.display_name}</div>
                    <div className="tiny muted">{s.username}</div>
                  </div>
                </div>
                <span className="btn sm ghost" style={{ pointerEvents: 'none' }}>
                  Hồ sơ →
                </span>
              </a>
            ))}
          </div>

          {students.length === 0 && (
            <div className="card empty">
              {data.students.length ? 'Không có học sinh khớp tìm kiếm.' : 'Lớp chưa có học sinh.'}
            </div>
          )}
        </div>
      )}
      {tab === 'work' && <Assignments classId={id} results={false} />}
      {tab === 'results' &&
        (assignmentId ? (
          <Report id={assignmentId} classId={id} />
        ) : (
          <>
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
          </>
        ))}
      {tab === 'settings' && (
        <section className="card stack">
          <div className="card-head">
            <h2>Thông tin lớp học</h2>
          </div>
          <div className="stat-widget-grid">
            <div className="stat-widget">
              <div className="stat-widget-info">
                <span className="stat-widget-label">Tên lớp</span>
                <span className="stat-widget-num" style={{ fontSize: 20 }}>{data.class.name}</span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-info">
                <span className="stat-widget-label">Khối</span>
                <span className="stat-widget-num" style={{ fontSize: 20 }}>Khối {data.class.grade}</span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-info">
                <span className="stat-widget-label">Sĩ số</span>
                <span className="stat-widget-num" style={{ fontSize: 20 }}>{data.students.length}</span>
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
              <span>Hồ sơ từng học sinh có mã liên kết phụ huynh. Phân công lớp do quản trị viên quản lý.</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
