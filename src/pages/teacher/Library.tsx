import { ReactNode } from 'react';
import { useRoute } from '../../ui/kit';
import { Exams } from './Exams';

export function Library({ children }: { children?: ReactNode }) {
  const {path,query}=useRoute();
  const classId=query.get('classId');
  const suffix=classId&&/^\d+$/.test(classId)?`?classId=${classId}`:'';
  const tabs=[['/thu-vien','Đề thi'],['/ngan-hang','Ngân hàng câu hỏi'],['/nhap-de','Nhập đề'],['/ra-de','Tạo đề']];
  return <div className="stack"><nav className="section-tabs" aria-label="Đề và câu hỏi">{tabs.map(([href,label])=>{
    const active=href==='/thu-vien'?(path==='/thu-vien'||path.startsWith('/de-thi')):path===href;
    return <a key={href} href={`#${href}${suffix}`} className={active?'active':''} aria-current={active?'page':undefined}>{label}</a>;
  })}</nav>{suffix&&<div className="row small"><span className="badge blue">Đang chọn đề để giao cho lớp</span><a href={`#/lop/${classId}/bai-giao`}>Về bài đã giao</a></div>}{children??<Exams/>}</div>;
}
