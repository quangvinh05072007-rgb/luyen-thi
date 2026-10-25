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
  const filtered = classes.filter(c => (!grade || c.grade === Number(grade)) && `${c.name} ${c.teacher ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  return <div className="stack">
    <div className="row between">
      <div><h1>Lớp học</h1><p className="small muted">{user.role === 'admin' ? 'Các lớp trong trường. Mở một lớp để xem học sinh, năng lực và bài đã giao.' : 'Các lớp bạn phụ trách. Mở lớp để xem học sinh, kết quả và giao phiếu luyện.'}</p></div>
      {user.role === 'admin' && <a className="btn" href="#/nguoi-dung">Quản lý lớp và tài khoản</a>}
    </div>
    {loading && <Loading text="Đang tải lớp học…" />}
    {error && <ErrorBox error={error} onRetry={reload} />}
    {data && <>
      <div className="row small muted"><span>{classes.length} lớp</span><span>{classes.reduce((sum,c) => sum + c.students,0)} học sinh</span></div>
      {classes.length > 0 ? <>
        <div className="card flat row">
          <label className="field grow">Tìm lớp<input className="input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên lớp hoặc giáo viên" /></label>
          <label className="field">Khối<select className="input" value={grade} onChange={e => setGrade(e.target.value)}><option value="">Tất cả khối</option>{[10,11,12].map(g => <option key={g} value={g}>Khối {g}</option>)}</select></label>
        </div>
        {filtered.length === 0 ? <div className="card empty">Không có lớp khớp bộ lọc. Thử đổi tên hoặc khối.</div> : <div className="grid-2">
          {filtered.map(c => <a className="card class-link" href={`#/lop/${c.id}`} key={c.id}>
            <div className="row between"><h2>Lớp {c.name}</h2><span className="badge blue">Khối {c.grade}</span></div>
            <p className="small muted">{c.students} học sinh · {c.teacher ?? 'Chưa gán giáo viên'}</p>
            <div className="row small mt"><Icon name="class" /><span>Xem học sinh và kết quả</span></div>
          </a>)}
        </div>}
      </> : <div className="card empty"><h2>Chưa có lớp học</h2><p>{user.role === 'admin' ? 'Vào Quản lý lớp và tài khoản để tạo lớp, thêm học sinh và gán giáo viên.' : 'Nhờ quản lý trường gán lớp phụ trách cho tài khoản của bạn.'}</p></div>}
    </>}
  </div>;
}
