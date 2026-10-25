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
      <div className="grid-3">
        <div className="card stat">
          <span className="v">{p.streak.current}</span>
          <span className="k">Ngày học liên tiếp (dài nhất {p.streak.longest}){p.streak.activeToday ? '' : ' · hôm nay chưa học'}</span>
        </div>
        <div className="card stat">
          <span className="v">{p.reviewDue}</span>
          <span className="k">Câu đến hạn ôn hôm nay</span>
        </div>
        <div className="card stat">
          <span className="v">
            {g.done}/{g.target}
          </span>
          <span className="k">Mục tiêu tuần ({dm(g.weekStart)}–{dm(g.weekEnd)}){g.met ? ' · đã đạt' : ` · còn ${g.remaining} câu`}</span>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Năng lực theo chuyên đề</h2>
          {p.topics.length === 0 && <p className="muted small">Chưa có dữ liệu. Làm vài câu để SmartExam hiểu em.</p>}
          {p.topics.map((t: any) => (
            <div key={t.topic} className="mb">
              <div className="row between small">
                <span>{t.name}</span>
                <span className="muted">
                  {t.insufficientData ? `Chưa đủ dữ liệu · ${t.n}/${p.minEvidence} câu` : `${pct(t.value)} · ${BAND[t.band]} · ${t.n} câu`}
                </span>
              </div>
              {!t.insufficientData && <Bar value={t.value} />}
            </div>
          ))}
          <p className="tiny muted">Tính từ kết quả gần đây; câu làm gần đây có trọng số lớn hơn.</p>
        </div>
        <div className="card">
          <h2>Xu hướng 4 tuần</h2>
          {p.trend.weeks.map((w: any) => (
            <div key={w.from} className="mb">
              <div className="row between small">
                <span>
                  {dm(w.from)}–{dm(w.to)}
                </span>
                <span className="muted">{w.insufficientData ? `Chưa đủ dữ liệu · ${w.questions} câu` : `${pct(w.accuracy)} đúng · ${w.questions} câu`}</span>
              </div>
              {!w.insufficientData && <Bar value={w.accuracy} />}
            </div>
          ))}
          <p className="small strong">{p.trend.insufficientData ? 'Chưa đủ dữ liệu để nhận xét xu hướng.' : `${DIRECTION[p.trend.direction]} (${p.trend.delta >= 0 ? '+' : ''}${Math.round(p.trend.delta * 100)} điểm %)`}</p>
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
