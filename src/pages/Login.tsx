import { FormEvent, useEffect, useState } from 'react';
import { get, post } from '../api';
import { Icon, Mascot, User } from '../ui/kit';

const LABELS = {student:'Học sinh',teacher:'Giáo viên',admin:'Quản lý trường'};
const DEMO = [
  {u:'hs.an.nm',role:'student',who:'Nguyễn Minh An — 12A1'},
  {u:'gv.lan',role:'teacher',who:'Cô Nguyễn Thị Lan — dạy 12A1'},
  {u:'quanly',role:'admin',who:'Ban giám hiệu trường mẫu'},
];

export function Login({onLogin}:{onLogin:(u:User)=>void}) {
  const [role,setRole]=useState<User['role']|null>(null);
  const [username,setU]=useState(''),[password,setP]=useState('');
  const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[sample,setSample]=useState(false);
  useEffect(()=>{get('/api/demo').then(r=>setSample(r.sample)).catch(()=>{});},[]);
  const choose=(next:User['role']|null)=>{setRole(next);setError(null);setU('');setP('');};
  const submit=async(e?:FormEvent,u=username,p=password)=>{
    e?.preventDefault();if(!role)return;setBusy(true);setError(null);
    try{const r=await post('/api/login',{username:u,password:p,role});onLogin(r.user);}
    catch(err:any){setError(err.message);}finally{setBusy(false);}
  };
  return <div className="login-wrap"><div className={`login-card ${role?'':'role-picker'}`}>
    <div className="center mb"><Mascot size={80} mood="cheer"/><h1>SmartExam AI</h1><p className="muted">Học đúng phần còn yếu. Theo sát tiến bộ từng em.</p></div>
    {!role ? <>
      <h2 className="center">Bạn là học sinh hay giáo viên?</h2>
      <div className="role-options">
        <button className="role-option" onClick={()=>choose('student')}><span className="role-symbol"><Icon name="book"/></span><strong>Tôi là học sinh</strong><span>Vào lớp, làm bài và luyện tập</span></button>
        <button className="role-option" onClick={()=>choose('teacher')}><span className="role-symbol"><Icon name="class"/></span><strong>Tôi là giáo viên</strong><span>Quản lý lớp, tạo đề và xem kết quả</span></button>
      </div>
      <div className="row role-secondary"><a href="#/phu-huynh">Phụ huynh</a><button className="btn ghost sm" onClick={()=>choose('admin')}>Quản lý trường</button></div>
    </> : <>
      <form className="card stack" onSubmit={submit}>
        <div className="row between"><h2 style={{margin:0}}>Đăng nhập {LABELS[role].toLocaleLowerCase('vi')}</h2><button className="btn ghost sm" type="button" disabled={busy} onClick={()=>choose(null)}>Đổi vai trò</button></div>
        <label className="field">Tên đăng nhập<input className="input" autoComplete="username" value={username} onChange={e=>setU(e.target.value)} autoFocus required/></label>
        <label className="field">Mật khẩu<input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setP(e.target.value)} required/></label>
        {error&&<div className="alert error" role="alert">{error}</div>}
        <button className="btn primary big block" disabled={busy||!username||!password}>{busy?'Đang đăng nhập…':'Đăng nhập'}</button>
      </form>
      {sample&&<div className="card flat mt demo-accounts"><div className="row between mb"><h3 style={{margin:0}}>Dùng thử {LABELS[role].toLocaleLowerCase('vi')}</h3><span className="badge amber">Dữ liệu mẫu</span></div><p className="small muted">Mật khẩu mẫu: <span className="kbd">demo1234</span></p>{DEMO.filter(d=>d.role===role).map(d=><button key={d.u} className="btn block" disabled={busy} onClick={()=>submit(undefined,d.u,'demo1234')}>{d.who}</button>)}</div>}
    </>}
  </div></div>;
}
