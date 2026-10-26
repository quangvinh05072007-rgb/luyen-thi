import {useEffect,useState} from 'react';
import {get,post} from '../api';
import {MathText} from './MathText';
import {Modal} from './kit';
export default function MathOcrReview({type,sourceStem,onClose,onApply}:{type:string;sourceStem:string;onClose:()=>void;onApply:(q:any)=>void}) {
 const [job,setJob]=useState<any>(null);const [error,setError]=useState('');
 useEffect(()=>{let live=true;let timer:ReturnType<typeof setInterval>|undefined;
   const load=async(id:number)=>{try{const r=await get(`/api/import/jobs/${id}`);if(live)setJob(r.job);}catch(e:any){if(live)setError(e.message);}};
   post('/api/math-ocr',{type,imageIds:[...sourceStem.matchAll(/\[\[img:(\d+)\]\]/g)].map(m=>Number(m[1]))}).then(r=>{if(!live)return;void load(r.id);timer=setInterval(()=>load(r.id),2000);}).catch(e=>{if(live)setError(e.message);});
   return()=>{live=false;if(timer)clearInterval(timer);};
 },[]);
 const result=job?.result;const q=result?.questions?.length===1?result.questions[0]:null;
 const canApply=q&&q.type===type&&(type==='short'||q.options?.length===4);
 return <Modal title="Nhận dạng công thức · thử nghiệm" onClose={onClose}>
 <div className="stack"><p className="tiny muted">Xử lý cục bộ bằng Marker. Máy này dùng CPU, có thể mất vài phút mỗi câu. Có thể đóng cửa sổ rồi xem tác vụ trong Nhập đề.</p>
 {error&&<div className="alert error small">{error}</div>}
 {!job&&!error&&<p className="small">Đang tạo tác vụ…</p>}
 {job&&['queued','running'].includes(job.state)&&<div className="row between"><span className="small" role="status">{job.state==='queued'?'Đang chờ xử lý…':`Đang nhận dạng ảnh ${Math.min((job.progress.page??0)+1,job.progress.pages??1)}/${job.progress.pages??1}…`}</span><button type="button" className="btn sm" onClick={async()=>{try{setJob((await post(`/api/import/jobs/${job.id}/cancel`)).job);}catch(e:any){setError(e.message);}}}>Hủy tác vụ</button></div>}
 {job&&['failed','cancelled'].includes(job.state)&&<div className="alert warn small">{job.error??'Tác vụ đã hủy.'}</div>}
 {result&&<><div className="alert warn small">Đối chiếu từng công thức và đáp án. Mô hình có thể bỏ sót hình; khi chèn, app giữ cả ảnh gốc trong câu hỏi.</div><div className="math-ocr-preview"><MathText as="div" text={result.recognizedText??q?.stem??''}/></div>{!canApply&&<p className="small muted">Chưa tách đủ nội dung và phương án của một câu. Giữ ảnh gốc và sửa thủ công trong trình soạn.</p>}<button type="button" className="btn primary" disabled={!canApply} onClick={()=>{onApply(q);onClose();}}>Chèn chữ, giữ ảnh gốc</button></>}
 </div></Modal>;
}
