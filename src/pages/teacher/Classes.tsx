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

export function Classes() {
  const { user, toast } = useApp();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const { data, error, loading, reload } = useAsync(
    () => get<{ classes: ClassRow[] }>(`/api/classes${scope === 'all' ? '?scope=all' : ''}`),
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
      `${c.name} ${c.teacher ?? ''} ${c.code ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
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

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Top Header & Fast Actions */}
      <div className="row between wrap" style={{ gap: 14, alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Quản lý Lớp học</h1>
          <p className="tiny muted" style={{ margin: '4px 0 0' }}>
            Tổ chức lớp theo khối, cấp mã tham gia cho học sinh và theo dõi bài thi.
          </p>
        </div>

        <div className="row" style={{ gap: 10 }}>
          {/* Scope Selector: Lớp của tôi / Toàn trường */}
          <div
            className="row"
            style={{
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 10,
              gap: 2,
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              className={`btn sm ${scope === 'mine' ? 'primary' : 'ghost'}`}
              style={{ padding: '6px 14px', height: 34, fontSize: 13, borderRadius: 8, fontWeight: 600 }}
              onClick={() => setScope('mine')}
            >
              👤 Lớp của tôi
            </button>
            <button
              type="button"
              className={`btn sm ${scope === 'all' ? 'primary' : 'ghost'}`}
              style={{ padding: '6px 14px', height: 34, fontSize: 13, borderRadius: 8, fontWeight: 600 }}
              onClick={() => setScope('all')}
            >
              🏫 Toàn trường
            </button>
          </div>

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
              Hệ thống sẽ tự động cấp một <strong>Mã tham gia lớp</strong> duy nhất (VD: {newName.trim().slice(0, 4).toUpperCase() || '12A1'}-XXXX) để học sinh tự nhập mã vào lớp.
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
          {/* Quick Summary KPI Widgets */}
          <div className="stat-widget-grid">
            <div className="stat-widget">
              <div className="stat-widget-icon blue">
                <Icon name="class" />
              </div>
              <div className="stat-widget-info">
                <span className="stat-widget-num">{classes.length}</span>
                <span className="stat-widget-label">
                  {scope === 'mine' ? 'Lớp bạn phụ trách' : 'Tổng số lớp trường'}
                </span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <Icon name="book" />
              </div>
              <div className="stat-widget-info">
                <span className="stat-widget-num">{totalStudents}</span>
                <span className="stat-widget-label">Tổng học sinh</span>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-icon orange">
                <Icon name="clock" />
              </div>
              <div className="stat-widget-info">
                <span className="stat-widget-num">{totalActiveExams}</span>
                <span className="stat-widget-label">Bài thi đang mở</span>
              </div>
            </div>
          </div>

          {/* Grade Tabs & Search/View Controls */}
          <div
            className="card flat row between wrap"
            style={{ padding: '12px 18px', gap: 12, alignItems: 'center' }}
          >
            {/* Grade Tabs */}
            <div className="filter-pills" style={{ flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={`filter-pill ${selectedGrade === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedGrade('all')}
              >
                ✨ Tất cả ({gradeCounts.all})
              </button>
              <button
                type="button"
                className={`filter-pill ${selectedGrade === '12' ? 'active' : ''}`}
                onClick={() => setSelectedGrade('12')}
              >
                🎓 Khối 12 ({gradeCounts[12]})
              </button>
              <button
                type="button"
                className={`filter-pill ${selectedGrade === '11' ? 'active' : ''}`}
                onClick={() => setSelectedGrade('11')}
              >
                📘 Khối 11 ({gradeCounts[11]})
              </button>
              <button
                type="button"
                className={`filter-pill ${selectedGrade === '10' ? 'active' : ''}`}
                onClick={() => setSelectedGrade('10')}
              >
                📗 Khối 10 ({gradeCounts[10]})
              </button>
            </div>

            {/* Search & View Switcher */}
            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 220 }}>
                <input
                  className="input"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="🔍 Tìm tên lớp, mã, GV…"
                  style={{ height: 38, borderRadius: 20, padding: '6px 14px' }}
                />
              </div>

              {/* View Toggle */}
              <div
                className="row"
                style={{
                  background: '#f1f5f9',
                  padding: 3,
                  borderRadius: 8,
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  className={`btn sm ${viewMode === 'grid' ? 'primary' : 'ghost'}`}
                  style={{
                    padding: '4px 10px',
                    height: 32,
                    fontSize: 12,
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                  onClick={() => setViewMode('grid')}
                  title="Xem dạng thẻ lưới"
                >
                  🔲 Thẻ
                </button>
                <button
                  type="button"
                  className={`btn sm ${viewMode === 'table' ? 'primary' : 'ghost'}`}
                  style={{
                    padding: '4px 10px',
                    height: 32,
                    fontSize: 12,
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                  onClick={() => setViewMode('table')}
                  title="Xem dạng bảng tổng hợp"
                >
                  📄 Bảng
                </button>
              </div>
            </div>
          </div>

          {/* Classes Display */}
          {filtered.length === 0 ? (
            <div className="card empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>🔍</span>
              <div style={{ fontWeight: 600, color: '#374151', fontSize: 16 }}>Không tìm thấy lớp học phù hợp</div>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                {scope === 'mine' ? (
                  <span>
                    Bạn đang lọc theo <strong>Lớp của tôi</strong>. Bấm nút{' '}
                    <button
                      type="button"
                      className="btn sm"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => setScope('all')}
                    >
                      🏫 Toàn trường
                    </button>{' '}
                    để xem tất cả lớp học trong trường.
                  </span>
                ) : (
                  'Thử chọn khối khác hoặc xóa từ khóa tìm kiếm.'
                )}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* Modern Card Grid */
            <div className="class-tile-grid">
              {filtered.map((c) => {
                const gradeClass =
                  c.grade === 12
                    ? 'class-modern-header grade-12'
                    : c.grade === 11
                    ? 'class-modern-header grade-11'
                    : 'class-modern-header grade-10';

                return (
                  <div key={c.id} className="class-modern-card">
                    {/* Header Banner with Grade Theme */}
                    <div className={gradeClass}>
                      <div>
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 20 }}>
                            {c.grade === 12 ? '🎓' : c.grade === 11 ? '📘' : '📗'}
                          </span>
                          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                            Lớp {c.name}
                          </h2>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4, color: '#ffffff' }}>
                          Khối {c.grade} · Niên khóa 2025–2026
                        </div>
                      </div>

                      <span
                        style={{
                          background: 'rgba(255, 255, 255, 0.22)',
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          backdropFilter: 'blur(6px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        👥 {c.students} hs
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="class-modern-body">
                      {/* Teacher Row */}
                      <div className="row between" style={{ fontSize: 13, alignItems: 'center' }}>
                        <span className="tiny muted">Phụ trách:</span>
                        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                          <strong style={{ color: '#1e293b' }}>{c.teacher ?? 'Chưa gán GV'}</strong>
                          {c.mine && (
                            <span
                              style={{
                                background: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              Lớp của bạn
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Join Code Chip */}
                      {c.code && (
                        <div
                          className="row between"
                          style={{
                            background: '#f8fafc',
                            border: '1px dashed #cbd5e1',
                            borderRadius: 8,
                            padding: '7px 12px',
                            alignItems: 'center',
                          }}
                        >
                          <span className="tiny muted">Mã lớp:</span>
                          <strong style={{ color: '#1677ff', letterSpacing: '0.8px', fontSize: 13 }}>
                            {c.code}
                          </strong>
                          <button
                            type="button"
                            className="btn sm"
                            style={{ padding: '2px 8px', height: 'auto', fontSize: 11 }}
                            onClick={() => {
                              navigator.clipboard?.writeText(c.code!);
                              toast(`Đã sao chép mã lớp ${c.code}`);
                            }}
                          >
                            Sao chép
                          </button>
                        </div>
                      )}

                      {/* Status / Active Exam indicator */}
                      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                        {c.active_assignments && c.active_assignments > 0 ? (
                          <div
                            className="row"
                            style={{
                              gap: 6,
                              alignItems: 'center',
                              background: '#fff7e6',
                              border: '1px solid #ffd591',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontSize: 12,
                              color: '#d46b08',
                              fontWeight: 600,
                            }}
                          >
                            <span className="live-dot" style={{ width: 8, height: 8 }} />
                            <span>{c.active_assignments} bài thi đang mở</span>
                          </div>
                        ) : (
                          <div className="tiny muted" style={{ fontSize: 12 }}>
                            📝 {c.total_assignments ?? 0} bài tập & đề thi đã giao
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="class-modern-actions">
                      <a className="btn primary sm grow" href={`#/lop/${c.id}`}>
                        Vào lớp →
                      </a>
                      <a
                        className="btn sm"
                        href={`#/thu-vien?classId=${c.id}`}
                        title="Giao bài cho lớp"
                      >
                        ⚡ Giao đề
                      </a>
                      <a
                        className="btn sm"
                        href={`#/lop/${c.id}/ket-qua`}
                        title="Bảng điểm lớp"
                      >
                        📊 Điểm
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Add Class Placeholder Card (Keeps grid balanced) */}
              <div
                className="class-add-placeholder"
                onClick={() => setShowCreate(true)}
                title="Bấm để tạo thêm lớp mới"
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  ➕
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Tạo lớp học mới</div>
                <div className="tiny muted" style={{ maxWidth: 200 }}>
                  Thêm lớp mới, cấp mã tham gia và ra đề kiểm tra cho học sinh
                </div>
              </div>
            </div>
          ) : (
            /* Modern Table View for bulk management */
            <div style={{ overflowX: 'auto' }}>
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>Lớp học</th>
                    <th>Khối</th>
                    <th>Mã tham gia</th>
                    <th>Sĩ số</th>
                    <th>Giáo viên phụ trách</th>
                    <th>Bài thi</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>Lớp {c.name}</strong>
                          {c.mine && (
                            <span
                              style={{
                                background: '#f0fdf4',
                                color: '#166534',
                                padding: '1px 5px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              Của bạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              c.grade === 12 ? '#e6f4ff' : c.grade === 11 ? '#f9f0ff' : '#e6fffb',
                            color:
                              c.grade === 12 ? '#0958d9' : c.grade === 11 ? '#531dab' : '#08979c',
                            fontWeight: 700,
                          }}
                        >
                          Khối {c.grade}
                        </span>
                      </td>
                      <td>
                        {c.code ? (
                          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                            <code style={{ fontWeight: 700, color: '#1677ff' }}>{c.code}</code>
                            <button
                              type="button"
                              className="btn sm"
                              style={{ padding: '1px 6px', height: 'auto', fontSize: 11 }}
                              onClick={() => {
                                navigator.clipboard?.writeText(c.code!);
                                toast(`Đã chép mã ${c.code}`);
                              }}
                            >
                              📋
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <strong>{c.students}</strong> học sinh
                      </td>
                      <td style={{ color: '#475569' }}>{c.teacher ?? 'Chưa gán'}</td>
                      <td>
                        {c.active_assignments && c.active_assignments > 0 ? (
                          <span className="badge amber">⚡ {c.active_assignments} đang mở</span>
                        ) : (
                          <span className="tiny muted">{c.total_assignments ?? 0} bài</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row end" style={{ gap: 6 }}>
                          <a className="btn primary sm" href={`#/lop/${c.id}`}>
                            Vào lớp
                          </a>
                          <a className="btn sm" href={`#/thu-vien?classId=${c.id}`}>
                            Giao đề
                          </a>
                          <a className="btn sm" href={`#/lop/${c.id}/ket-qua`}>
                            Điểm
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
