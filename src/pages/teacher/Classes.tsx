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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortDescending, setSortDescending] = useState(false);
  const [groupByGrade, setGroupByGrade] = useState(true);
  const [showCodes, setShowCodes] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [search, setSearch] = useState('');
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

  const sortedClasses = [...filtered].sort((a, b) => (sortDescending ? -1 : 1) * a.name.localeCompare(b.name, 'vi', { numeric: true }));
  const groups = groupByGrade
    ? [12, 11, 10].map(grade => ({ key: String(grade), label: `Khối ${grade}`, classes: sortedClasses.filter(c => c.grade === grade) })).filter(group => group.classes.length)
    : [{ key: 'all', label: 'Tất cả', classes: sortedClasses }];
  const allCollapsed = groups.length > 0 && groups.every(group => collapsedGroups.has(group.key));
  const toggleGroup = (key: string) => setCollapsedGroups(current => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className="class-directory">
      <header className="directory-heading">
        <div><h1>Danh sách lớp</h1><p role="status" title={`${totalStudents} học sinh · ${totalActiveExams} bài thi đang mở`}>{loading ? 'Đang tải…' : `${filtered.length} lớp`}</p></div>
        <div className="directory-heading-actions">
          <button type="button" className="btn primary" onClick={() => setShowCreate(true)}><Icon name="plus" />Thêm</button>
          <button type="button" className={`btn${filtersOpen ? ' is-selected' : ''}`} onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen} aria-controls="directory-filters"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4-2v-5Z" /></svg>Bộ lọc{selectedGrade !== 'all' && <span className="directory-filter-dot" />}</button>
          <details className="directory-settings" onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.open = false; }}>
            <summary className="btn directory-icon-button" aria-label="Tùy chọn hiển thị lớp" title="Tùy chọn hiển thị"><Icon name="gear" /></summary>
            <div className="directory-settings-panel"><strong>Hiển thị danh sách</strong><label className="check"><input type="checkbox" checked={groupByGrade} onChange={e => {setGroupByGrade(e.target.checked);setCollapsedGroups(new Set());}} />Nhóm lớp theo khối</label><label className="check"><input type="checkbox" checked={showCodes} onChange={e => setShowCodes(e.target.checked)} />Hiện mã tham gia</label>{user.role === 'admin' && <a href="#/nguoi-dung">Quản lý tài khoản và phân công</a>}</div>
          </details>
        </div>
      </header>
      <div className="directory-searchbar">
        <label className="directory-search"><input type="search" aria-label="Tìm lớp học" placeholder="Tìm kiếm theo tên lớp, mã hoặc giáo viên" value={search} onChange={e => setSearch(e.target.value)} /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg></label>
        <button type="button" className="btn directory-sort" onClick={() => setSortDescending(value => !value)} aria-label={sortDescending ? 'Sắp xếp tên lớp tăng dần' : 'Sắp xếp tên lớp giảm dần'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 4v16m-4-4 4 4 4-4M17 20V4m-4 4 4-4 4 4" /></svg>Sắp xếp theo tên<span className="directory-sort-direction">{sortDescending ? 'Z–A' : 'A–Z'}</span></button>
        <button type="button" className="btn directory-icon-button" aria-label={allCollapsed ? 'Mở tất cả nhóm lớp' : 'Thu gọn tất cả nhóm lớp'} onClick={() => setCollapsedGroups(allCollapsed ? new Set() : new Set(groups.map(group => group.key)))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={allCollapsed ? 'm8 8 4 4 4-4m-8 6 4 4 4-4' : 'm8 9 4-4 4 4m-8 6 4 4 4-4'} /></svg></button>
      </div>
      {filtersOpen && <section className="directory-filters" id="directory-filters" aria-label="Bộ lọc lớp học">
        <div><span>Phạm vi</span><div className="seg"><button type="button" aria-pressed={scope === 'mine'} className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>Lớp của tôi{data?.myCount !== undefined ? ` (${data.myCount})` : ''}</button><button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Toàn trường{data?.totalAllCount !== undefined ? ` (${data.totalAllCount})` : ''}</button></div></div>
        <label className="field"><span>Khối lớp</span><select className="select" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}><option value="all">Tất cả ({gradeCounts.all})</option>{([12, 11, 10] as const).map(grade => <option key={grade} value={grade}>Khối {grade} ({gradeCounts[grade]})</option>)}</select></label>
        <button type="button" className="btn ghost" onClick={() => {setSelectedGrade('all');setSearch('');}}>Xóa bộ lọc</button>
      </section>}
      {loading && <Loading text="Đang tải lớp học…" />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && filtered.length === 0 && <div className="directory-empty"><Icon name="class" /><h2>{classes.length ? 'Không tìm thấy lớp phù hợp' : 'Chưa có lớp học'}</h2><p>{classes.length ? 'Thử từ khóa khác hoặc thay đổi bộ lọc.' : 'Tạo lớp mới và chia sẻ mã tham gia với học sinh.'}</p><div className="row">{classes.length > 0 && <button type="button" className="btn" onClick={() => {setSearch('');setSelectedGrade('all');}}>Xóa bộ lọc</button>}{scope === 'mine' && <button type="button" className="btn" onClick={() => setScope('all')}>Xem toàn trường</button>}<button type="button" className="btn primary" onClick={() => setShowCreate(true)}><Icon name="plus" />Thêm lớp</button></div></div>}
      {data && filtered.length > 0 && <div className="directory-groups">{groups.map(group => <section key={group.key} className="directory-group">
        <button type="button" className="directory-group-toggle" onClick={() => toggleGroup(group.key)} aria-expanded={!collapsedGroups.has(group.key)} aria-controls={`class-group-${group.key}`}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={collapsedGroups.has(group.key) ? 'm7 4 6 6-6 6' : 'm4 7 6 6 6-6'} /></svg>{group.label} ({group.classes.length} lớp)</button>
        <div id={`class-group-${group.key}`} className="directory-class-grid" hidden={collapsedGroups.has(group.key)}>{group.classes.map(c => <article key={c.id} className="directory-class-card">
          <a className="directory-class-open" href={`#/lop/${c.id}`} aria-label={`Vào lớp ${c.name}`}><h2>{c.name}</h2><div className="directory-class-meta"><span>Sĩ số: {c.students}</span><span>Khối {c.grade}</span></div>{showCodes && c.code && <p className="directory-visible-code">Mã: {c.code}</p>}</a>
          <details className="directory-class-menu" onKeyDown={e => {if(e.key === 'Escape') e.currentTarget.open = false;}} onBlur={e => {if(!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.open = false;}}><summary aria-label={`Thao tác lớp ${c.name}`} title={`Thao tác lớp ${c.name}`}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></summary><div className="directory-class-menu-panel"><p>{c.teacher ?? 'Chưa phân công giáo viên'}{(c.active_assignments ?? 0) > 0 && <span>{c.active_assignments} bài thi đang mở</span>}</p><a href={`#/lop/${c.id}`}><Icon name="class" />Vào lớp</a><a href={`#/thu-vien?classId=${c.id}`}><Icon name="exam" />Giao đề</a><a href={`#/lop/${c.id}/ket-qua`}><Icon name="chart" />Bảng điểm</a>{c.code && <button type="button" onClick={() => copyCode(c.code!)}><Icon name="file" />Sao chép mã lớp</button>}<a href={`#/lop/${c.id}/cai-dat`}><Icon name="gear" />Cài đặt lớp</a></div></details>
        </article>)}</div>
      </section>)}</div>}
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
