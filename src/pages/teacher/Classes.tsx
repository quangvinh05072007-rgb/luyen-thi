import { matchesSearch } from '../../../shared/search.mjs';
import { useState } from 'react';
import { get, post } from '../../api';
import { ErrorBox, Icon, Loading, Modal, useApp, useAsync } from '../../ui/kit';

type ClassRow = {
  id: number;
  name: string;
  grade: number;
  teacher: string | null;
  students: number;
  code?: string;
  active_assignments?: number;
  total_assignments?: number;
  mine?: boolean;
};

type ClassesResponse = {
  classes: ClassRow[];
  totalAllCount?: number;
  myCount?: number;
};

export function Classes() {
  const { user, toast } = useApp();
  const [scope, setScope] = useState<'mine' | 'all'>(user.role === 'admin' ? 'all' : 'mine');
  const { data, error, loading, reload } = useAsync(
    () => get<ClassesResponse>(`/api/classes${scope === 'all' ? '?scope=all' : ''}`),
    [scope]
  );

  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState(12);
  const [busy, setBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const classes = data?.classes ?? [];

  const gradeCounts = {
    all: classes.length,
    12: classes.filter((c) => c.grade === 12).length,
    11: classes.filter((c) => c.grade === 11).length,
    10: classes.filter((c) => c.grade === 10).length,
  };

  const filtered = classes.filter((c) => {
    const matchGrade = selectedGrade === 'all' || c.grade === Number(selectedGrade);
    const matchSearch =
      !search.trim() ||
      matchesSearch(`${c.name} ${c.teacher ?? ''} ${c.code ?? ''}`, search);
    return matchGrade && matchSearch;
  });

  const totalStudents = classes.reduce((sum, c) => sum + (c.students ?? 0), 0);
  const totalActiveExams = classes.reduce((sum, c) => sum + (c.active_assignments ?? 0), 0);

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

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast(`Đã sao chép mã lớp ${code}`);
    } catch {
      toast('Chưa sao chép được. Bạn có thể chọn và chép mã lớp trực tiếp.');
    }
  };

  const sortedClasses = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));

  return (
    <div className="class-directory">
      {/* Header */}
      <header className="directory-heading">
        <div>
          <h1>Quản lý Lớp học</h1>
          <p>
            {classes.length} lớp học · {totalStudents} học sinh
            {totalActiveExams > 0 ? ` · ${totalActiveExams} bài thi đang mở` : ''}
          </p>
        </div>
        <div className="directory-heading-actions">
          {user.role === 'admin' && (
            <div className="seg" style={{ marginRight: 6 }}>
              <button
                type="button"
                className={scope === 'mine' ? 'on' : ''}
                onClick={() => setScope('mine')}
              >
                Lớp của tôi
              </button>
              <button
                type="button"
                className={scope === 'all' ? 'on' : ''}
                onClick={() => setScope('all')}
              >
                Toàn trường ({data?.totalAllCount ?? classes.length})
              </button>
            </div>
          )}
          <button type="button" className="btn primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" /> Tạo lớp mới
          </button>
        </div>
      </header>

      {/* Unified Toolbar */}
      <div className="directory-toolbar">
        {/* Grade Pills */}
        <div className="grade-pills">
          <button
            type="button"
            className={`grade-pill ${selectedGrade === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedGrade('all')}
          >
            Tất cả ({gradeCounts.all})
          </button>
          {([12, 11, 10] as const).map((g) => (
            <button
              key={g}
              type="button"
              className={`grade-pill ${selectedGrade === String(g) ? 'active' : ''}`}
              onClick={() => setSelectedGrade(String(g))}
            >
              Khối {g} ({gradeCounts[g]})
            </button>
          ))}
        </div>

        {/* Search & View Mode */}
        <div className="directory-toolbar-right">
          <div className="directory-search-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              aria-label="Tìm kiếm lớp học"
              placeholder="Tìm tên lớp, mã, giáo viên…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Dạng lưới thẻ"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Lưới
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Dạng danh sách bảng"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Bảng
            </button>
          </div>
        </div>
      </div>

      {loading && <Loading text="Đang tải lớp học…" />}
      {error && <ErrorBox error={error} onRetry={reload} />}

      {/* Empty State */}
      {data && filtered.length === 0 && (
        <div className="card flat" style={{ padding: '48px 24px', textAlign: 'center', background: '#fff' }}>
          <div style={{ color: '#94a3b8', marginBottom: 12 }}>
            <Icon name="class" />
          </div>
          <h2 style={{ fontSize: 16, margin: '0 0 6px 0' }}>
            {classes.length ? 'Không tìm thấy lớp phù hợp' : 'Chưa có lớp học nào'}
          </h2>
          <p className="tiny muted" style={{ margin: '0 0 16px 0' }}>
            {classes.length ? 'Thử xóa từ khóa tìm kiếm hoặc chọn khối lớp khác.' : 'Bắt đầu bằng việc tạo lớp mới để giao đề và kiểm tra.'}
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            {classes.length > 0 && (
              <button type="button" className="btn" onClick={() => { setSearch(''); setSelectedGrade('all'); }}>
                Xóa bộ lọc
              </button>
            )}
            <button type="button" className="btn primary" onClick={() => setShowCreate(true)}>
              <Icon name="plus" /> Tạo lớp mới
            </button>
          </div>
        </div>
      )}

      {/* Grid View */}
      {data && filtered.length > 0 && viewMode === 'grid' && (
        <div className="classes-card-grid">
          {sortedClasses.map((c) => (
            <article key={c.id} className="class-card">
              <div className={`class-card-banner grade-${c.grade}`}>
                <span className="class-card-name">{c.name}</span>
                <span className="class-card-grade-badge">Khối {c.grade}</span>
              </div>

              <div className="class-card-body">
                <div className="class-card-stat">
                  <span>👥 Sĩ số: <b>{c.students} học sinh</b></span>
                  <span className="tiny muted">{c.teacher || 'Chưa phân công'}</span>
                </div>

                {c.code && (
                  <div className="class-card-code-row">
                    <span>Mã tham gia: <span className="class-card-code-val">{c.code}</span></span>
                    <button
                      type="button"
                      className="class-card-copy-btn"
                      onClick={() => copyCode(c.code!)}
                      title="Sao chép mã vào clipboard"
                    >
                      Chép mã
                    </button>
                  </div>
                )}

                {(c.active_assignments ?? 0) > 0 && (
                  <div className="class-active-exam-badge">
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    {c.active_assignments} bài thi đang mở
                  </div>
                )}
              </div>

              <div className="class-card-footer">
                <a className="btn primary sm" href={`#/lop/${c.id}`}>
                  Vào lớp →
                </a>
                <a className="btn sm ghost" href={`#/thu-vien?classId=${c.id}`}>
                  Giao đề
                </a>
                <a className="btn sm ghost" href={`#/lop/${c.id}/ket-qua`}>
                  Điểm
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Table View */}
      {data && filtered.length > 0 && viewMode === 'table' && (
        <div className="classes-table-card">
          <table className="classes-table">
            <thead>
              <tr>
                <th>Lớp học</th>
                <th>Khối</th>
                <th>Sĩ số</th>
                <th>Mã tham gia</th>
                <th>Giáo viên</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sortedClasses.map((c) => (
                <tr key={c.id}>
                  <td className="class-name-cell">
                    <a href={`#/lop/${c.id}`} style={{ color: '#1e40af', textDecoration: 'none' }}>
                      {c.name}
                    </a>
                  </td>
                  <td>
                    <span className={`badge sm ${c.grade === 12 ? 'blue' : c.grade === 11 ? 'green' : 'purple'}`}>
                      Khối {c.grade}
                    </span>
                  </td>
                  <td><b>{c.students}</b> em</td>
                  <td>
                    {c.code ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#1e40af', fontWeight: 600 }}>
                          {c.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode(c.code!)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 0, fontSize: 11 }}
                          title="Sao chép"
                        >
                          📋
                        </button>
                      </span>
                    ) : '—'}
                  </td>
                  <td className="tiny muted">{c.teacher || 'Chưa phân công'}</td>
                  <td>
                    {(c.active_assignments ?? 0) > 0 ? (
                      <span className="badge green sm">🟢 {c.active_assignments} bài mở</span>
                    ) : (
                      <span className="tiny muted">{c.total_assignments ?? 0} bài</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row end" style={{ gap: 4 }}>
                      <a className="btn sm" href={`#/lop/${c.id}`} style={{ padding: '3px 8px', fontSize: 11.5 }}>
                        Vào lớp
                      </a>
                      <a className="btn sm ghost" href={`#/thu-vien?classId=${c.id}`} style={{ padding: '3px 8px', fontSize: 11.5 }}>
                        Giao đề
                      </a>
                      <a className="btn sm ghost" href={`#/lop/${c.id}/ket-qua`} style={{ padding: '3px 8px', fontSize: 11.5 }}>
                        Bảng điểm
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal tạo lớp mới */}
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
              Hệ thống sẽ tự động cấp một <strong>Mã tham gia lớp</strong> duy nhất (VD:{' '}
              {newName.trim().slice(0, 4).toUpperCase() || '12A1'}-XXXX) để học sinh tự nhập mã vào lớp.
            </p>
            <div className="row end" style={{ gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowCreate(false)}
                disabled={busy}
              >
                Hủy
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Đang tạo…' : 'Tạo lớp ngay'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export default Classes;
