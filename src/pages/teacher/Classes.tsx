import { useState } from 'react';
import { get } from '../../api';
import { ErrorBox, Icon, Loading, useApp, useAsync } from '../../ui/kit';

type ClassRow = { id: number; name: string; grade: number; teacher: string | null; students: number };

export function Classes() {
  const { user } = useApp();
  const { data, error, loading, reload } = useAsync(() => get<{ classes: ClassRow[] }>('/api/classes'), []);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const classes = data?.classes ?? [];
  const filtered = classes.filter(
    (c) =>
      (!grade || c.grade === Number(grade)) &&
      `${c.name} ${c.teacher ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
  );
  const totalStudents = classes.reduce((sum, c) => sum + c.students, 0);

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1 style={{ margin: 0 }}>Lớp học</h1>
        </div>
        {user.role === 'admin' && (
          <a className="btn" href="#/nguoi-dung">
            <Icon name="gear" /> Quản lý lớp & tài khoản
          </a>
        )}
      </div>

      {loading && <Loading text="Đang tải lớp học…" />}
      {error && <ErrorBox error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="stat-widget-grid">
            <div className="stat-widget">
              <div className="stat-widget-icon blue">
                <Icon name="class" />
              </div>
              <div className="stat-widget-info">
                <span className="stat-widget-num">{classes.length}</span>
                <span className="stat-widget-label">Lớp học</span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <Icon name="book" />
              </div>
              <div className="stat-widget-info">
                <span className="stat-widget-num">{totalStudents}</span>
                <span className="stat-widget-label">Học sinh</span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-icon orange">
                <Icon name="flag" />
              </div>
              <div className="stat-widget-info">
                <span className="stat-widget-num">
                  {[...new Set(classes.map((c) => c.grade))].length}
                </span>
                <span className="stat-widget-label">Khối lớp</span>
              </div>
            </div>
          </div>

          <div className="card flat row between" style={{ padding: '12px 16px', gap: 12, flexWrap: 'wrap' }}>
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${!grade ? 'active' : ''}`}
                onClick={() => setGrade('')}
              >
                Tất cả khối
              </button>
              {[10, 11, 12].map((g) => (
                <button
                  type="button"
                  key={g}
                  className={`filter-pill ${grade === String(g) ? 'active' : ''}`}
                  onClick={() => setGrade(grade === String(g) ? '' : String(g))}
                >
                  Khối {g}
                </button>
              ))}
            </div>
            <div style={{ flex: '1 1 240px', maxWidth: 360 }}>
              <input
                className="input"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên lớp hoặc giáo viên…"
              />
            </div>
          </div>

          {classes.length > 0 ? (
            filtered.length === 0 ? (
              <div className="card empty">Không tìm thấy lớp học phù hợp.</div>
            ) : (
              <div className="class-tile-grid">
                {filtered.map((c) => (
                  <div className="class-tile-widget" key={c.id}>
                    <div className="class-tile-head">
                      <h2 className="class-tile-name">
                        <Icon name="class" /> Lớp {c.name}
                      </h2>
                      <span className="badge blue">Khối {c.grade}</span>
                    </div>
                    <div className="class-tile-chips">
                      <span className="class-tile-chip">
                        👥 {c.students} học sinh
                      </span>
                      <span className="class-tile-chip">
                        👤 {c.teacher ?? 'Chưa gán GV'}
                      </span>
                    </div>
                    <div className="class-tile-actions">
                      <a className="btn primary sm grow" href={`#/lop/${c.id}`}>
                        Vào lớp
                      </a>
                      <a className="btn sm" href={`#/thu-vien?classId=${c.id}`} title="Giao bài cho lớp">
                        Giao đề
                      </a>
                      <a className="btn sm" href={`#/lop/${c.id}/ket-qua`} title="Bảng điểm lớp">
                        Điểm
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="card empty">
              <h2>Chưa có lớp học</h2>
              <p>
                {user.role === 'admin'
                  ? 'Vào Quản lý lớp và tài khoản để tạo lớp mới.'
                  : 'Liên hệ quản lý trường để được phân công lớp.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
