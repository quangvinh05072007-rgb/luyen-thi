import { useState } from 'react';
import { get, post } from '../../api';
import { Bar, ErrorBox, fmtDateTime, fmtScore, go, Loading, Mascot, Ring, scoreColor, useApp, useAsync } from '../../ui/kit';

export function StudentHome() {
  const { user, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/student/home'), []);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const open = data.assignments.filter((a: any) => a.state === 'open' || a.state === 'doing');
  const done = data.assignments.filter((a: any) => a.state === 'done');
  const upcoming = data.assignments.filter((a: any) => a.state === 'upcoming');
  const next = open[0];

  const start = async (assignmentId: number) => {
    setBusy(true);
    try {
      const a = await post('/api/attempts/start', { assignmentId });
      go(`/thi/${a.id}`);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };
  const practice = async (body: any) => {
    setBusy(true);
    try {
      const a = await post('/api/practice/start', body);
      go(`/thi/${a.id}`);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };

  const goalPct = data.today.questions / data.today.goal;
  return (
    <div className="stack">
      <div className="card">
        <div className="hero">
          <Mascot size={78} mood={goalPct >= 1 ? 'cheer' : 'happy'} />
          <div style={{ flex: 1 }}>
            <h1 style={{ marginBottom: 2 }}>Chào {user.displayName.split(' ').slice(-1)[0]}!</h1>
            <div className="row small">
              <span className="streak">🔥 {data.streak} ngày liên tiếp</span>
              <span className="badge blue">{data.xp} XP</span>
            </div>
          </div>
          <Ring value={goalPct} label={`${data.today.questions}/${data.today.goal}`} />
        </div>
        <p className="small muted mt">Mục tiêu hôm nay: làm {data.today.goal} câu. {goalPct >= 1 ? 'Em đã đạt mục tiêu!' : `Còn ${Math.max(0, data.today.goal - data.today.questions)} câu nữa.`}</p>
        <div className="hr" />
        {next ? (
          <div className="row between">
            <div>
              <div className="tiny muted">{next.mode === 'exam' ? 'Bài kiểm tra' : 'Bài tập về nhà'} · hạn {fmtDateTime(next.close_at)}</div>
              <div className="strong">{next.title}</div>
              <div className="tiny muted">{next.mode === 'exam' ? `${next.duration_min} phút, tính giờ từ lúc bắt đầu` : 'Làm trước hạn đóng'}</div>
            </div>
            <button className="btn primary big" disabled={busy} onClick={() => (next.attempt_id ? go(`/thi/${next.attempt_id}`) : start(next.id))}>
              {next.state === 'doing' ? 'Làm tiếp' : 'Bắt đầu làm'}
            </button>
          </div>
        ) : data.practiceInProgress ? (
          <div className="row between">
            <div>
              <div className="tiny muted">Bài luyện đang dở</div>
              <div className="strong">{data.practiceInProgress.title}</div>
            </div>
            <button className="btn primary big" onClick={() => go(`/thi/${data.practiceInProgress.id}`)}>
              Làm tiếp
            </button>
          </div>
        ) : (
          <div className="row between">
            <div>
              <div className="strong">Không có bài nào cần nộp.</div>
              <div className="small muted">Luyện 8 câu đúng phần em còn yếu.</div>
            </div>
            <button className="btn primary big" disabled={busy} onClick={() => practice({ mode: 'weak', count: 8 })}>
              Luyện ngay
            </button>
          </div>
        )}
      </div>

      {data.review.due > 0 && (
        <div className="card row between">
          <div>
            <div className="strong">Sổ lỗi sai: {data.review.due} câu đến hạn ôn</div>
            <div className="small muted">Ôn đúng lúc sắp quên giúp nhớ lâu hơn làm lại ngay.</div>
          </div>
          <button className="btn" disabled={busy} onClick={() => practice({ mode: 'review', count: 10 })}>
            Ôn lại
          </button>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Cần cải thiện</h2>
            <a href="#/tien-bo" className="small">
              Xem tất cả
            </a>
          </div>
          {data.recommendations.length === 0 ? (
            <p className="muted small">Chưa đủ dữ liệu. Làm một bài kiểm tra hoặc bài luyện để SmartExam biết em mạnh, yếu ở đâu.</p>
          ) : (
            data.recommendations.map((r: any) => (
              <div key={r.topic} className="list-item">
                <div className="grow">
                  <div className="strong small">{r.name}</div>
                  <Bar value={r.mastery} />
                  <div className="tiny muted">{r.reason}</div>
                </div>
                <button className="btn sm" disabled={busy} onClick={() => practice({ mode: 'topic', topics: [r.topic], count: 8 })}>
                  Luyện
                </button>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h2>Bài được giao</h2>
          {[...open.slice(1), ...upcoming].map((a: any) => (
            <div key={a.id} className="list-item">
              <div className="grow">
                <div className="strong small">{a.title}</div>
                <div className="tiny muted">{a.state === 'upcoming' ? `Mở lúc ${fmtDateTime(a.open_at)}` : `Hạn ${fmtDateTime(a.close_at)}`}</div>
              </div>
              {a.state !== 'upcoming' && (
                <button className="btn sm" disabled={busy} onClick={() => (a.attempt_id ? go(`/thi/${a.attempt_id}`) : start(a.id))}>
                  {a.state === 'doing' ? 'Làm tiếp' : 'Làm'}
                </button>
              )}
            </div>
          ))}
          {done.map((a: any) => (
            <a key={a.id} className="list-item" href={`#/ket-qua/${a.attempt_id}`} style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="strong small">{a.title}</div>
                <div className="tiny muted">Đã nộp</div>
              </div>
              <b style={{ color: scoreColor(a.score10) }}>{a.score10 === null ? 'Chờ công bố' : fmtScore(a.score10)}</b>
            </a>
          ))}
          {data.assignments.length === 0 && <p className="muted small">Chưa có bài nào được giao.</p>}
        </div>
      </div>
    </div>
  );
}
