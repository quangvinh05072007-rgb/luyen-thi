import { get } from '../../api';
import { ErrorBox, fmtDateTime, Loading, useAsync } from '../../ui/kit';

export function MyAppeals() {
  const {data,error,loading,reload} = useAsync(() => get('/api/student/appeals'), []);
  return <div className="stack"><h1>Khiếu nại của em</h1><p className="small muted">Em gửi khiếu nại từ từng câu trong trang kết quả. Giáo viên trả lời sẽ hiện tại đây.</p>{loading && <Loading />}{error && <ErrorBox error={error} onRetry={reload} />}
    {data?.appeals.length === 0 && <div className="card empty">Em chưa có khiếu nại nào. Nếu thấy điểm chưa đúng, mở kết quả bài làm để gửi lý do.</div>}
    {data?.appeals.map((a: any) => <article className="card stack" key={a.id}><div className="row between"><a href={`#/ket-qua/${a.attemptId}`} className="strong">{a.title}</a><span className={`badge ${a.status === 'open' ? 'amber' : a.status === 'accepted' ? 'green' : 'red'}`}>{{open:'Đang chờ',accepted:'Đã chấp nhận',rejected:'Không chấp nhận'}[a.status as string]}</span></div><p className="small preserve-lines">{a.reason}</p><time className="tiny muted">Gửi {fmtDateTime(a.createdAt)}</time>{a.note && <div className="explain"><b className="small">Giáo viên trả lời</b><p className="small preserve-lines">{a.note}</p><time className="tiny muted">{fmtDateTime(a.resolvedAt)}</time></div>}</article>)}
  </div>;
}
