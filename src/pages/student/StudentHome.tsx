import { useState } from 'react';
import { get, post } from '../../api';
import { Bar, ErrorBox, fmtDateTime, fmtScore, go, Icon, Loading, Mascot, scoreColor, useApp, useAsync } from '../../ui/kit';

export function StudentHome() {
  const { user, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/student/home'), []);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? 'Không tải được dữ liệu.'} onRetry={reload} />;

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

  const goalPct = Math.min(1, data.today.questions / data.today.goal);

  return (
    <div className="stack">
      {/* Widget 1: Profile & Daily Status Header */}
      <div className="widget-card row between" style={{ alignItems: 'center' }}>
        <div className="row" style={{ gap: 14 }}>
          <Mascot size={52} mood={goalPct >= 1 ? 'cheer' : 'happy'} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Chào {user.displayName.split(' ').slice(-1)[0]}!</h1>
            <div className="row tiny muted" style={{ marginTop: 2, gap: 8 }}>
              <span>Lớp {user.class?.name ?? 'học sinh'}</span>
              <span>·</span>
              <span>{user.school.name}</span>
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className="streak">🔥 {data.streak} ngày</span>
          <span className="badge blue" style={{ fontSize: 13, padding: '4px 10px' }}>⚡ {data.xp} XP</span>
          <div style={{ minWidth: 120 }}>
            <div className="row between tiny muted mb" style={{ marginBottom: 3 }}>
              <span>Mục tiêu ngày</span>
              <b>{data.today.questions}/{data.today.goal} câu</b>
            </div>
            <div className="bar" style={{ height: 6 }}>
              <span style={{ width: `${goalPct * 100}%`, background: goalPct >= 1 ? 'var(--good)' : 'var(--primary)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Widget 2: Nhiệm vụ chính (Hero Mission Widget) */}
      {next ? (
        <div className="student-mission-widget">
          <div>
            <div className="student-mission-badge">
              <Icon name="clock" /> {next.mode === 'exam' ? 'Bài kiểm tra tính giờ' : 'Bài tập về nhà'}
            </div>
            <div className="student-mission-title">{next.title}</div>
            <div className="tiny muted">
              {next.mode === 'exam' ? `⏱️ Thời gian: ${next.duration_min} phút · ` : ''}Hạn chót: <b>{fmtDateTime(next.close_at)}</b>
            </div>
          </div>
          <button className="btn primary big" disabled={busy} onClick={() => (next.attempt_id ? go(`/thi/${next.attempt_id}`) : start(next.id))}>
            {next.state === 'doing' ? 'Làm tiếp bài →' : 'Vào làm bài ngay →'}
          </button>
        </div>
      ) : data.practiceInProgress ? (
        <div className="student-mission-widget">
          <div>
            <div className="student-mission-badge"><Icon name="practice" /> Bài luyện đang dở</div>
            <div className="student-mission-title">{data.practiceInProgress.title}</div>
            <div className="tiny muted">Tiếp tục hoàn thành các câu hỏi còn lại</div>
          </div>
          <button className="btn primary big" onClick={() => go(`/thi/${data.practiceInProgress.id}`)}>
            Làm tiếp →
          </button>
        </div>
      ) : (
        <div className="student-mission-widget" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="student-mission-badge" style={{ color: 'var(--good)' }}>✓ Đã hoàn tất bài giao</div>
            <div className="student-mission-title" style={{ fontSize: 17 }}>Hiện không có bài tập nào cần nộp</div>
            <div className="tiny muted">Tự luyện 8 câu thích ứng để củng cố chuyên đề còn yếu</div>
          </div>
          <button className="btn primary" disabled={busy} onClick={() => practice({ mode: 'weak', count: 8 })}>
            <Icon name="practice" /> Luyện tập thích ứng
          </button>
        </div>
      )}

      {/* Widget 3: Grid 2 cột (Adaptive + Assignments) */}
      <div className="grid-2">
        <div className="stack">
          {/* Widget Sổ lỗi sai */}
          <div className="widget-card">
            <div className="widget-head">
              <h2 className="widget-title"><Icon name="star" /> Sổ lỗi sai</h2>
              <span className={`badge ${data.review.due > 0 ? 'amber' : 'green'}`}>
                {data.review.due > 0 ? `${data.review.due} câu đến hạn` : 'Đã sạch'}
              </span>
            </div>
            {data.review.due > 0 ? (
              <div className="row between" style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 10, padding: '12px 14px' }}>
                <div>
                  <div className="strong" style={{ color: '#d46b08', fontSize: 14 }}>{data.review.due} câu cần ôn tập</div>
                  <div className="tiny muted">Ôn ngắt quãng giúp ghi nhớ sâu</div>
                </div>
                <button className="btn primary sm" disabled={busy} onClick={() => practice({ mode: 'review', count: 10 })}>
                  Ôn lại ngay
                </button>
              </div>
            ) : (
              <p className="tiny muted center" style={{ padding: '10px 0' }}>Không có câu sai nào đến hạn ôn tập hôm nay.</p>
            )}
          </div>

          {/* Widget Cần cải thiện */}
          <div className="widget-card">
            <div className="widget-head">
              <h2 className="widget-title"><Icon name="chart" /> Chuyên đề cần cải thiện</h2>
              <a href="#/tien-bo" className="small">Tất cả →</a>
            </div>
            {data.recommendations.length === 0 ? (
              <p className="tiny muted center" style={{ padding: '10px 0' }}>Chưa có dữ liệu chuyên đề yếu.</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {data.recommendations.slice(0, 3).map((r: any) => (
                  <div key={r.topic} className="row between" style={{ borderBottom: '1px solid var(--line-subtle)', paddingBottom: 8 }}>
                    <div className="grow">
                      <div className="strong small" style={{ marginBottom: 2 }}>{r.name}</div>
                      <Bar value={r.mastery} />
                      <div className="tiny muted" style={{ marginTop: 2 }}>Năng lực: {Math.round(r.mastery * 100)}%</div>
                    </div>
                    <button className="btn sm" disabled={busy} onClick={() => practice({ mode: 'topic', topics: [r.topic], count: 8 })}>
                      Luyện
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cột 2: Danh sách bài được giao */}
        <div className="widget-card">
          <div className="widget-head">
            <h2 className="widget-title"><Icon name="exam" /> Bài tập & Đề thi</h2>
            <a href="#/ket-qua" className="small">Xem kết quả →</a>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {[...open.slice(1), ...upcoming].map((a: any) => (
              <div key={a.id} className="task-widget">
                <div className="grow">
                  <div className="task-widget-title">{a.title}</div>
                  <div className="task-widget-sub">
                    {a.state === 'upcoming' ? `Mở lúc ${fmtDateTime(a.open_at)}` : `Hạn ${fmtDateTime(a.close_at)}`}
                  </div>
                </div>
                {a.state !== 'upcoming' && (
                  <button className="btn sm primary" disabled={busy} onClick={() => (a.attempt_id ? go(`/thi/${a.attempt_id}`) : start(a.id))}>
                    {a.state === 'doing' ? 'Làm tiếp' : 'Làm bài'}
                  </button>
                )}
              </div>
            ))}
            {done.map((a: any) => (
              <a key={a.id} className="task-widget" href={`#/ket-qua/${a.attempt_id}`}>
                <div className="grow">
                  <div className="task-widget-title">{a.title}</div>
                  <div className="task-widget-sub">Đã hoàn thành</div>
                </div>
                <span className="badge" style={{ fontSize: 13, fontWeight: 700, color: scoreColor(a.score10) }}>
                  {a.score10 === null ? 'Chờ công bố' : `${fmtScore(a.score10)} đ`}
                </span>
              </a>
            ))}
            {data.assignments.length === 0 && <p className="tiny muted center" style={{ padding: '16px 0' }}>Chưa có bài nào được giao.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
