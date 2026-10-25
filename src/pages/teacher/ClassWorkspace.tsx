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
      <header className="row between">
        <div>
          <a className="small" href="#/lop-hoc">
            Lớp học
          </a>
          <h1>Lớp {data.class.name}</h1>
          <p className="small muted">
            Khối {data.class.grade} · {data.students.length} học sinh
          </p>
        </div>
        <a className="btn primary" href={`#/thu-vien?classId=${id}`}>
          Giao bài
        </a>
      </header>
      <nav className="section-tabs" aria-label="Các mục trong lớp">
        {tabs.map(([value, label, path]) => (
          <a key={value} href={`#${path}`} aria-current={tab === value ? 'page' : undefined} className={tab === value ? 'active' : ''}>
            {label}
          </a>
        ))}
      </nav>
      {tab === 'students' && (
        <>
          <label className="field">
            Tìm học sinh
            <input
              type="search"
              className="input"
              placeholder="Họ tên hoặc tên đăng nhập"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="card">
            <div className="card-head">
              <h2>Danh sách học sinh</h2>
            </div>
            {students.map((s: any) => (
              <a className="list-item" key={s.id} href={`#/hoc-sinh/${s.id}`}>
                <span className="student-avatar" aria-hidden="true">
                  {s.display_name.trim().split(/\s+/).slice(-1)[0].slice(0, 1)}
                </span>
                <div className="grow">
                  <strong>{s.display_name}</strong>
                  <div className="tiny muted">{s.username}</div>
                </div>
                <span className="small">Hồ sơ</span>
              </a>
            ))}
            {students.length === 0 && (
              <p className="muted">
                {data.students.length ? 'Không có học sinh khớp tên tìm kiếm.' : 'Lớp chưa có học sinh. Quản lý trường có thể thêm ở mục tài khoản.'}
              </p>
            )}
          </div>
        </>
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
          <h2>Thông tin lớp</h2>
          <dl className="class-info">
            <dt>Tên lớp</dt>
            <dd>{data.class.name}</dd>
            <dt>Khối</dt>
            <dd>{data.class.grade}</dd>
            <dt>Học sinh đang hoạt động</dt>
            <dd>{data.students.length}</dd>
          </dl>
          <p className="small muted">
            {user.role === 'admin'
              ? 'Quản lý tài khoản học sinh và phân công giáo viên trong trang Người dùng.'
              : 'Danh sách học sinh và phân công lớp do quản lý trường cập nhật. Mở hồ sơ từng em để cấp mã liên kết phụ huynh.'}
          </p>
          {user.role === 'admin' && (
            <div>
              <a className="btn" href="#/nguoi-dung">
                Quản lý tài khoản và phân công
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
