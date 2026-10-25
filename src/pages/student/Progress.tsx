import { get } from '../../api';
import { Bar, ErrorBox, Loading, pct, useApp, useAsync } from '../../ui/kit';
import { ProfileView } from '../teacher/ClassView';

const BAND: Record<string, string> = { weak: 'Cần củng cố', ok: 'Khá', strong: 'Vững' };
const DIRECTION: Record<string, string> = { up: 'Đang tiến bộ', down: 'Đang giảm', flat: 'Giữ ổn định' };

const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

function ProgressNumbers({ p }: { p: any }) {
  const g = p.weeklyGoal;
  return (
    <>
      <div className="stat-widget-grid">
        <div className="stat-widget">
          <div className="stat-widget-icon orange">
            <span style={{ fontSize: 20 }}>🔥</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{p.streak.current}</span>
            <span className="stat-widget-label">
              Chuỗi ngày (dài nhất {p.streak.longest})
            </span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon red" style={{ background: '#fff1f0', color: '#ff4d4f' }}>
            <span style={{ fontSize: 20 }}>📑</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{p.reviewDue}</span>
            <span className="stat-widget-label">Câu đến hạn ôn</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon blue">
            <span style={{ fontSize: 20 }}>🎯</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">
              {g.done}/{g.target}
            </span>
            <span className="stat-widget-label">
              Mục tiêu tuần {g.met ? '· Đạt' : `· Còn ${g.remaining}`}
            </span>
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="widget-card">
          <div className="widget-head">
            <h2 className="widget-title">
              <span>📊</span> Năng lực theo chuyên đề
            </h2>
          </div>
          {p.topics.length === 0 && <p className="muted small">Chưa có dữ liệu.</p>}
          {p.topics.map((t: any) => (
            <div key={t.topic} className="mb">
              <div className="row between small">
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span className="muted">
                  {t.insufficientData ? `Cần thêm dữ liệu (${t.n}/${p.minEvidence})` : `${pct(t.value)} · ${BAND[t.band]}`}
                </span>
              </div>
              {!t.insufficientData && <Bar value={t.value} />}
            </div>
          ))}
        </div>
        <div className="widget-card">
          <div className="widget-head">
            <h2 className="widget-title">
              <span>📈</span> Xu hướng học tập 4 tuần
            </h2>
          </div>
          {p.trend.weeks.map((w: any) => (
            <div key={w.from} className="mb">
              <div className="row between small">
                <span>
                  {dm(w.from)}–{dm(w.to)}
                </span>
                <span className="muted">{w.insufficientData ? `Chưa đủ dữ liệu` : `${pct(w.accuracy)} đúng · ${w.questions} câu`}</span>
              </div>
              {!w.insufficientData && <Bar value={w.accuracy} />}
            </div>
          ))}
          <p className="small strong" style={{ marginTop: 12 }}>
            {p.trend.insufficientData ? 'Chưa đủ dữ liệu nhận xét.' : `${DIRECTION[p.trend.direction]} (${p.trend.delta >= 0 ? '+' : ''}${Math.round(p.trend.delta * 100)} điểm %)`}
          </p>
        </div>
      </div>
    </>
  );
}

export function Progress() {
  const { user } = useApp();
  const profile = useAsync(() => get(`/api/students/${user.id}/profile`), [user.id]);
  const progress = useAsync(() => get('/api/student/progress'), [user.id]);
  if (profile.loading || progress.loading) return <Loading />;
  if (profile.error) return <ErrorBox error={profile.error} onRetry={profile.reload} />;
  if (progress.error) return <ErrorBox error={progress.error} onRetry={progress.reload} />;
  return (
    <div className="stack">
      <h1>Tiến bộ của em</h1>
      {progress.data.insufficientData && (
        <div className="card">
          <p className="small">Chưa đủ dữ liệu: em mới làm {progress.data.totalAnswered} câu. Làm ít nhất {progress.data.minEvidence} câu để thấy nhận xét về năng lực.</p>
        </div>
      )}
      <ProgressNumbers p={progress.data} />
      <ProfileView data={profile.data} self />
    </div>
  );
}
