import { FormEvent, useEffect, useState } from 'react';
import { get, post } from '../api';
import { AzotaLogo, Icon, User } from '../ui/kit';

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
    <div className="center mb" style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <AzotaLogo size={54}/>
      <h1 style={{marginTop:10,marginBottom:2,fontSize:26}}>SmartExam</h1>
      <p className="tiny muted">Nền tảng thi & kiểm tra trực tuyến</p>
    </div>
    {!role ? <>
      <div className="role-options">
        <button className="role-option" onClick={()=>choose('student')}>
          <span className="role-symbol student"><Icon name="book"/></span>
          <strong>Học sinh</strong>
          <span>Vào thi & luyện tập</span>
        </button>
        <button className="role-option" onClick={()=>choose('teacher')}>
          <span className="role-symbol teacher"><Icon name="class"/></span>
          <strong>Giáo viên</strong>
          <span>Quản lý lớp & tạo đề</span>
        </button>
      </div>
      <div className="row role-secondary">
        <a href="#/phu-huynh" className="small" style={{fontWeight:600}}>Tra cứu phụ huynh</a>
        <button className="btn ghost sm" onClick={()=>choose('admin')}>Quản lý trường</button>
      </div>
    </> : <>
      <form className="card stack" onSubmit={submit}>
        <div className="row between">
          <h2 style={{margin:0,fontSize:17}}>Đăng nhập {LABELS[role]}</h2>
          <button className="btn ghost sm" type="button" disabled={busy} onClick={()=>choose(null)}>Đổi vai trò</button>
        </div>
        <label className="field">Tên đăng nhập<input className="input" autoComplete="username" value={username} onChange={e=>setU(e.target.value)} autoFocus required placeholder="Tên đăng nhập"/></label>
        <label className="field">Mật khẩu<input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setP(e.target.value)} required placeholder="Mật khẩu"/></label>
        {error&&<div className="alert error" role="alert">{error}</div>}
        <button className="btn primary big block" disabled={busy||!username||!password}>{busy?'Đang đăng nhập…':'Đăng nhập'}</button>
      </form>
      {sample&&<div className="card flat mt demo-accounts"><div className="row between mb"><h3 style={{margin:0,fontSize:14}}>Tài khoản dùng thử ({LABELS[role]})</h3><span className="badge amber">Mẫu</span></div><p className="tiny muted">Mật khẩu: <span className="kbd">demo1234</span></p>{DEMO.filter(d=>d.role===role).map(d=><button key={d.u} className="btn block" disabled={busy} onClick={()=>submit(undefined,d.u,'demo1234')}>{d.who}</button>)}</div>}
    </>}
  </div></div>;
}
