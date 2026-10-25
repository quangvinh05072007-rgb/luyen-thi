import { useState } from 'react';
import { get, post } from '../../api';
import { ErrorBox, Icon, Loading, Modal, useApp, useAsync } from '../../ui/kit';

type ClassRow = { id: number; name: string; grade: number; teacher: string | null; students: number; code?: string };

export function Classes() {
  const { user, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get<{ classes: ClassRow[] }>('/api/classes'), []);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState(12);
  const [busy, setBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const classes = data?.classes ?? [];
  const filtered = classes.filter(
    (c) =>
      (!grade || c.grade === Number(grade)) &&
      `${c.name} ${c.teacher ?? ''} ${c.code ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
  );
  const totalStudents = classes.reduce((sum, c) => sum + c.students, 0);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateErr('Vui lòng nhập tên lớp.');
      return;
    }
    setBusy(true);
    setCreateErr(null);
    try {
      const res = await post<{ id: number; name: string; grade: number; code: string }>('/api/classes', {
        name: newName.trim(),
        grade: newGrade,
      });
      toast(`Đã tạo lớp ${res.name} (Mã: ${res.code})`);
      setShowCreate(false);
      setNewName('');
      reload();
    } catch (err: any) {
      setCreateErr(err.message || 'Không thể tạo lớp học');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Lớp học</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" /> Tạo lớp mới
          </button>
          {user.role === 'admin' && (
            <a className="btn" href="#/nguoi-dung">
              <Icon name="user" /> Quản lý tài khoản
            </a>
          )}
        </div>
      </div>

      {showCreate && (
        <Modal title="Tạo lớp học mới" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateClass} className="stack" style={{ gap: 14 }}>
            {createErr && <div className="card warn small">{createErr}</div>}
            <label className="field">
              <span>Tên lớp</span>
              <input
                className="input"
                placeholder="VD: 12A1, 11B2, 10C3…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                required
              />
            </label>
            <label className="field">
              <span>Khối lớp</span>
              <select
                className="select"
                value={newGrade}
                onChange={(e) => setNewGrade(Number(e.target.value))}
              >
                <option value={10}>Khối 10</option>
                <option value={11}>Khối 11</option>
                <option value={12}>Khối 12</option>
              </select>
            </label>
            <p className="tiny muted">
              Hệ thống sẽ tự động tạo một <strong>Mã tham gia lớp</strong> duy nhất (VD: {newName.trim().slice(0, 4).toUpperCase() || '12A1'}-XXXX) để học sinh tự nhập mã vào lớp.
            </p>
            <div className="row end" style={{ gap: 8, marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setShowCreate(false)} disabled={busy}>
                Hủy
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Đang tạo…' : 'Tạo lớp ngay'}
              </button>
            </div>
          </form>
        </Modal>
      )}

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
                placeholder="Tìm tên lớp, mã lớp hoặc giáo viên…"
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

                    {c.code && (
                      <div
                        className="row between"
                        style={{
                          padding: '6px 10px',
                          background: '#f0f5ff',
                          border: '1px dashed #adc6ff',
                          borderRadius: 6,
                          fontSize: 12,
                          alignItems: 'center',
                          margin: '4px 0',
                        }}
                      >
                        <span style={{ color: '#1d39c4' }}>
                          Mã lớp: <strong>{c.code}</strong>
                        </span>
                        <button
                          type="button"
                          className="btn sm"
                          style={{ padding: '2px 8px', height: 'auto', fontSize: 11 }}
                          onClick={() => {
                            navigator.clipboard?.writeText(c.code!);
                            toast(`Đã sao chép mã ${c.code}`);
                          }}
                        >
                          📋 Sao chép
                        </button>
                      </div>
                    )}

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
              <p>Bấm vào nút "Tạo lớp mới" ở trên để tạo lớp và nhận mã tham gia cho học sinh.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
