import { useState } from 'react';
import { get, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { Bar, ErrorBox, ErrorTypeBadge, fmtScore, go, Loading, Mascot, pct, scoreColor, useApp, useAsync } from '../../ui/kit';
import { QuestionView } from '../../ui/Question';

export function AttemptReview({ data, showAll = false, onAppeal }: { data: any; showAll?: boolean; onAppeal?: (qid: number) => void }) {
  const [filter, setFilter] = useState<'wrong' | 'all'>(showAll ? 'all' : 'wrong');
  const r = data.result;
  const byQ = Object.fromEntries(r.items.map((x: any) => [x.qid, x]));
  const list = data.items.filter((it: any) => filter === 'all' || !byQ[it.qid]?.grade?.correct);
  return (
    <div className="card">
      <div className="card-head">
        <h2>Xem lại từng câu</h2>
        <div className="seg">
          <button className={filter === 'wrong' ? 'on' : ''} onClick={() => setFilter('wrong')}>
            Câu chưa đúng
          </button>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            Tất cả
          </button>
        </div>
      </div>
      {list.length === 0 && <div className="empty">Không có câu sai. Tuyệt vời!</div>}
      <div className="stack">
        {list.map((it: any) => {
          const x = byQ[it.qid];
          return (
            <div key={it.qid} className="card flat">
              <QuestionView item={it} response={data.responses?.[it.qid]} review={{ correctAnswer: x.correctAnswer, explanation: x.explanation, source: x.source, grade: x.grade, diagnosis: x.diagnosis }} />
              {onAppeal && (
                <div className="row mt">
                  <button className="btn ghost sm" onClick={() => onAppeal(it.qid)}>
                    Em muốn khiếu nại câu này
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResultSummary({ data }: { data: any }) {
  const { meta } = useApp();
  const r = data.result;
  const errs = Object.entries(r.errorCount ?? {}).filter(([, n]) => (n as number) > 0) as [string, number][];
  const maxErr = Math.max(1, ...errs.map(([, n]) => n));
  return (
    <div className="grid-2">
      <div className="card">
        <h2>Điểm từng phần</h2>
        {(['I', 'II', 'III'] as const).map((p) =>
          r.byPart?.[p]?.max ? (
            <div key={p} className="mb">
              <div className="row between small">
                <span>Phần {p}</span>
                <b>
                  {fmtScore(r.byPart[p].points)} / {fmtScore(r.byPart[p].max)}
                </b>
              </div>
              <Bar value={r.byPart[p].points / r.byPart[p].max} />
            </div>
          ) : null,
        )}
        <h3 className="mt">Theo chuyên đề</h3>
        {(r.topics ?? []).map((t: any) => (
          <div key={t.topic} className="mb">
            <div className="row between small">
              <span>{t.name}</span>
              <span className="muted">{pct(t.ratio)}</span>
            </div>
            <Bar value={t.ratio} />
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Em hay sai kiểu gì?</h2>
        {errs.length === 0 ? (
          <p className="muted">Không có lỗi sai nào được ghi nhận.</p>
        ) : (
          <div className="stack">
            {errs
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <div key={k}>
                  <div className="row between small">
                    <ErrorTypeBadge type={k} />
                    <b>{n} lỗi</b>
                  </div>
                  <div className="bar mt" style={{ marginTop: 4 }}>
                    <span style={{ width: `${(n / maxErr) * 100}%`, background: 'var(--violet)' }} />
                  </div>
                  <div className="tiny muted">{meta.errorTypes[k]?.hint}</div>
                </div>
              ))}
          </div>
        )}
        {r.dominantError && (
          <div className="alert info mt small">
            <b>Việc nên làm:</b> {meta.errorTypes[r.dominantError]?.action}.
          </div>
        )}
      </div>
    </div>
  );
}

export function ResultPage({ attemptId }: { attemptId: number }) {
  const { toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get(`/api/attempts/${attemptId}/result`), [attemptId]);
  const [starting, setStarting] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const r = data.result;
  const weak = (r.topics ?? []).filter((t: any) => t.ratio < 0.75).slice(0, 2).map((t: any) => t.topic);
  const practice = async () => {
    setStarting(true);
    try {
      const a = await post('/api/practice/start', weak.length ? { mode: 'topic', topics: weak, count: 8 } : { mode: 'weak', count: 8 });
      go(`/thi/${a.id}`);
    } catch (e: any) {
      toast(e.message);
      setStarting(false);
    }
  };
  const good = r.score10 >= 8;
  return (
    <div className="stack">
      <div className="card">
        <div className="hero">
          <Mascot size={80} mood={good ? 'cheer' : 'happy'} />
          <div style={{ flex: 1 }}>
            <div className="small muted">{data.title}</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: scoreColor(r.score10), lineHeight: 1.1 }}>
              {fmtScore(r.score10)}
              <span style={{ fontSize: 18, color: 'var(--ink-3)' }}> / 10</span>
            </div>
            <div className="small muted">
              {data.kind === 'practice' ? 'Bài luyện tập' : data.status === 'auto_submitted' ? 'Hết giờ — máy chủ đã tự nộp bản lưu cuối' : 'Đã nộp bài'}
            </div>
          </div>
        </div>
        {r.late && !r.late.accepted && <div className="alert warn mt small">Một phần bài làm lúc mất mạng được gửi sau giờ nộp. Giáo viên sẽ xem xét có tính hay không.</div>}
        <div className="hr" />
        <div className="row between">
          <div className="small">{weak.length ? <>Nên luyện thêm: {weak.length} chuyên đề yếu nhất trong bài này.</> : 'Giữ phong độ bằng bài luyện ngắn hôm nay.'}</div>
          <button className="btn primary big" onClick={practice} disabled={starting}>
            {starting ? 'Đang chọn câu…' : 'Luyện lại phần yếu'}
          </button>
        </div>
      </div>
      <ResultSummary data={data} />
      <AttemptReview
        data={data}
        onAppeal={
          data.kind === 'practice'
            ? undefined
            : async (qid) => {
                const reason = prompt('Em khiếu nại câu này vì lý do gì? (ít nhất 10 ký tự, nêu cụ thể)');
                if (!reason) return;
                try {
                  await post(`/api/attempts/${data.id}/appeals`, { qid, reason });
                  toast('Đã gửi khiếu nại. Giáo viên sẽ trả lời em.');
                } catch (e: any) {
                  toast(e.message);
                }
              }
        }
      />
      <div className="small muted center">
        <MathText text="Mỗi câu sai đã được thêm vào Sổ lỗi sai. Hệ thống nhắc ôn lại sau 1, 3, 7, 14 ngày." />
      </div>
    </div>
  );
}
