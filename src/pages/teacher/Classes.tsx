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

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast(`Đã sao chép mã lớp ${code}`);
    } catch {
      toast('Chưa sao chép được. Bạn có thể chọn và chép mã lớp trực tiếp.');
    }
  };

  return (
    <div className="classes-page">
      <header className="classes-heading">
        <div><h1>Lớp học</h1><p>Quản lý lớp, kết nối học sinh.</p></div>
        <div className="classes-heading-actions">
          {user.role === 'admin' && <a className="classes-text-action" href="#/nguoi-dung">Quản lý tài khoản</a>}
          <button type="button" className="btn primary classes-create" onClick={() => setShowCreate(true)}><Icon name="plus" /> Tạo lớp mới</button>
        </div>
      </header>
      {data && <dl className="classes-summary" aria-label="Tổng quan lớp học">
        <div><dt>{scope === 'mine' ? 'lớp phụ trách' : 'lớp toàn trường'}</dt><dd>{classes.length}</dd></div>
        <div><dt>học sinh</dt><dd>{totalStudents}</dd></div>
        <div className={totalActiveExams > 0 ? 'has-active' : ''}><dt>bài thi đang mở</dt><dd>{totalActiveExams}</dd></div>
      </dl>}
      <div className="classes-navigation">
        <div className="classes-scope" role="group" aria-label="Phạm vi lớp học">
          <button type="button" aria-pressed={scope === 'mine'} className={scope === 'mine' ? 'is-active' : ''} onClick={() => setScope('mine')}>Lớp của tôi{data?.myCount !== undefined ? ` (${data.myCount})` : ''}</button>
          <button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>Toàn trường{data?.totalAllCount !== undefined ? ` (${data.totalAllCount})` : ''}</button>
        </div>
        <label className="classes-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input type="search" aria-label="Tìm lớp học" placeholder="Tìm tên lớp, mã hoặc giáo viên…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      <div className="classes-filterbar">
        <div className="classes-grades" role="group" aria-label="Lọc theo khối">
          {(['all', '12', '11', '10'] as const).map((grade) => <button key={grade} type="button" aria-pressed={selectedGrade === grade} className={selectedGrade === grade ? 'is-active' : ''} onClick={() => setSelectedGrade(grade)}>{grade === 'all' ? 'Tất cả' : `Khối ${grade}`} <span>{gradeCounts[grade]}</span></button>)}
        </div>
        {data && <span className="classes-result-count" role="status">{filtered.length} lớp học</span>}
      </div>
      {loading && <Loading text="Đang tải lớp học…" />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && (filtered.length === 0 ? (
        <div className="classes-empty">
          <Icon name="class" /><h2>{classes.length === 0 ? 'Chưa có lớp học' : 'Không tìm thấy lớp phù hợp'}</h2>
          <p>{classes.length === 0 ? 'Tạo lớp đầu tiên và chia sẻ mã tham gia với học sinh.' : 'Thử tìm bằng tên khác hoặc chọn lại khối lớp.'}</p>
          <div className="row">
            {(search || selectedGrade !== 'all') && <button type="button" className="classes-text-action" onClick={() => { setSearch(''); setSelectedGrade('all'); }}>Xóa bộ lọc</button>}
            {scope === 'mine' && <button type="button" className="classes-text-action" onClick={() => setScope('all')}>Xem toàn trường</button>}
            {classes.length === 0 && <button type="button" className="btn primary" onClick={() => setShowCreate(true)}>Tạo lớp mới</button>}
          </div>
        </div>
      ) : (
        <section className="classes-list" aria-label="Danh sách lớp học">
          {filtered.map((c) => <article key={c.id} className="class-list-row">
            <div className={`class-list-mark grade-${c.grade}`} aria-hidden="true">{c.grade}<span>Khối</span></div>
            <div className="class-list-identity">
              <h2><a href={`#/lop/${c.id}`}>Lớp {c.name}</a>{scope === 'all' && c.mine && <span className="class-list-mine">Của bạn</span>}</h2>
              <p>{c.teacher ?? 'Chưa phân công giáo viên'}</p>
              {c.code && <div className="class-list-code"><span>Mã tham gia</span><strong>{c.code}</strong><button type="button" onClick={() => copyCode(c.code!)} aria-label={`Sao chép mã lớp ${c.name}`} title="Sao chép mã tham gia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg></button></div>}
            </div>
            <div className="class-list-students"><Icon name="class" /><strong>{c.students}</strong><span>học sinh</span></div>
            <div className="class-list-activity">
              {(c.active_assignments ?? 0) > 0 ? <span className="class-list-live"><span />{c.active_assignments} bài thi đang mở</span> : <span className="class-list-idle">Chưa có bài thi đang mở</span>}
              <span>{c.total_assignments ?? 0} bài đã giao</span>
            </div>
            <div className="class-list-actions">
              <a className="class-list-enter" href={`#/lop/${c.id}`} aria-label={`Vào lớp ${c.name}`}>Vào lớp <span aria-hidden="true">↗</span></a>
              <div><a href={`#/thu-vien?classId=${c.id}`} aria-label={`Giao đề cho lớp ${c.name}`}>Giao đề</a><a href={`#/lop/${c.id}/ket-qua`} aria-label={`Xem điểm lớp ${c.name}`}>Bảng điểm</a></div>
            </div>
          </article>)}
        </section>
      ))}
      {data && filtered.length > 0 && <p className="classes-footnote"><Icon name="class" />Chia sẻ mã tham gia để học sinh tự vào lớp.</p>}
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

