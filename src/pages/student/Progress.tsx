import { useState } from 'react';
import { get, post } from '../../api';
import { Bar, ErrorBox, go, Loading, pct, useApp, useAsync } from '../../ui/kit';
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
  const { user, toast } = useApp();
  const profile = useAsync(() => get(`/api/students/${user.id}/profile`), [user.id]);
  const progress = useAsync(() => get('/api/student/progress'), [user.id]);
  const [busy, setBusy] = useState(false);

  if (profile.loading || progress.loading) return <Loading />;
  if (profile.error) return <ErrorBox error={profile.error} onRetry={profile.reload} />;
  if (progress.error) return <ErrorBox error={progress.error} onRetry={progress.reload} />;

  const startReview = async () => {
    setBusy(true);
    try {
      const a = await post<any>('/api/practice/start', { mode: 'review', count: 10 });
      go(`/thi/${a.id}`);
    } catch (err: any) {
      toast(err.message || 'Không thể bắt đầu ôn lại.');
      setBusy(false);
    }
  };

  const startWeakRemediation = async () => {
    setBusy(true);
    try {
      const a = await post<any>('/api/practice/start', { mode: 'weak', count: 8 });
      go(`/thi/${a.id}`);
    } catch (err: any) {
      toast(err.message || 'Không thể bắt đầu củng cố phần yếu.');
      setBusy(false);
    }
  };

  const dueCount = progress.data.reviewDue || profile.data.review?.due || 0;
  const totalReview = profile.data.review?.total || 0;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row between wrap" style={{ gap: 12, alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Radar năng lực & Sổ lỗi sai</h1>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Theo dõi năng lực từng chuyên đề, các lỗi sai hay gặp và ôn tập ngắt quãng thông minh.
          </p>
        </div>
      </div>

      {/* Action Widgets: Sổ lỗi sai + Khắc phục chuyên đề yếu */}
      <div className="grid-2">
        <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #ffd591', background: '#fffbe6' }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="badge" style={{ marginBottom: 4, background: '#fff1f0', color: '#cf1322', fontWeight: 700 }}>
                Lặp lại ngắt quãng (Spaced Repetition)
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: 17, color: '#873800' }}>Sổ lỗi sai</h2>
            </div>
            <span style={{ fontSize: 28 }}>🔁</span>
          </div>
          <div className="row tiny muted">
            <span>{dueCount} câu cần ôn tập hôm nay · {totalReview} câu đã lưu trong sổ</span>
          </div>
          <button
            type="button"
            className="btn block"
            style={{
              marginTop: 'auto',
              background: dueCount > 0 ? '#fa8c16' : '#d9d9d9',
              color: dueCount > 0 ? '#fff' : '#595959',
              borderColor: dueCount > 0 ? '#fa8c16' : '#d9d9d9',
              fontWeight: 700,
            }}
            disabled={busy || dueCount === 0}
            onClick={startReview}
          >
            {dueCount > 0 ? `Ôn ngay ${Math.min(10, dueCount)} câu đến hạn →` : 'Chưa có câu nào đến hạn hôm nay'}
          </button>
        </div>

        <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #bae0ff', background: '#f0f7ff' }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="badge blue" style={{ marginBottom: 4, fontWeight: 700 }}>
                Đề xuất củng cố AI
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: 17, color: '#002c8c' }}>Khắc phục phần còn yếu</h2>
            </div>
            <span style={{ fontSize: 28 }}>🎯</span>
          </div>
          <div className="row tiny muted">
            <span>AI tự động phát hiện chuyên đề bạn hay sai để sinh bài luyện 8 câu củng cố</span>
          </div>
          <button
            type="button"
            className="btn primary block"
            style={{ marginTop: 'auto', fontWeight: 700 }}
            disabled={busy}
            onClick={startWeakRemediation}
          >
            Luyện củng cố 8 câu yếu ngay →
          </button>
        </div>
      </div>

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
