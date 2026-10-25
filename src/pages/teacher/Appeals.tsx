import { get, post } from '../../api';
import { ErrorBox, fmtDateTime, fmtScore, Loading, useApp, useAsync } from '../../ui/kit';

const STATUS: Record<string, string> = { open: 'Chờ xử lý', accepted: 'Đã chấp nhận', rejected: 'Đã từ chối' };

export function Appeals() {
  const { toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/appeals'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const resolve = async (a: any, decision: 'accept' | 'reject') => {
    const note = prompt(decision === 'accept' ? 'Ghi chú trả lời học sinh (bắt buộc):' : 'Lý do từ chối, trả lời học sinh (bắt buộc):');
    if (!note) return;
    const body: any = { decision, note };
    if (decision === 'accept') {
      if (a.qid && confirm('Cho điểm tối đa câu bị khiếu nại? Bấm Hủy để nhập điểm mới cả bài.')) body.creditQuestion = true;
      else {
        const v = prompt(`Điểm mới của cả bài (0–10), hiện là ${fmtScore(a.score10)}:`);
        if (v === null) return;
        body.newScore10 = Number(String(v).replace(',', '.'));
      }
    }
    try {
      await post(`/api/appeals/${a.id}/resolve`, body);
      toast('Đã trả lời khiếu nại.');
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  return (
    <div className="stack">
      <div>
        <h1>Khiếu nại điểm</h1>
        <p className="muted small">Học sinh gửi khi xem kết quả. Mọi quyết định và điểm trước/sau đều được ghi vào nhật ký.</p>
      </div>
      {data.appeals.length === 0 && <div className="card empty">Chưa có khiếu nại nào.</div>}
      {data.appeals.map((a: any) => (
        <div key={a.id} className="card flat">
          <div className="row between">
            <div>
              <div className="strong">
                {a.student} · lớp {a.className} · {a.title}
              </div>
              <div className="tiny muted">
                {fmtDateTime(a.createdAt)} · điểm hiện tại {fmtScore(a.score10)}
                {a.qid ? ` · câu #${a.qid}` : ''}
              </div>
            </div>
            <span className={`badge ${a.status === 'open' ? 'amber' : a.status === 'accepted' ? 'green' : ''}`}>{STATUS[a.status]}</span>
          </div>
          <p className="small mt">{a.reason}</p>
          {a.note && <p className="small muted">Trả lời: {a.note}</p>}
          <div className="row mt">
            <a className="btn ghost sm" href={`#/bai-lam/${a.attemptId}`}>
              Xem bài làm
            </a>
            {a.status === 'open' && (
              <>
                <button className="btn good sm" onClick={() => resolve(a, 'accept')}>
                  Chấp nhận
                </button>
                <button className="btn danger sm" onClick={() => resolve(a, 'reject')}>
                  Từ chối
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
