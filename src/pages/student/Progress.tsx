import { useState } from 'react';
import { get, post } from '../../api';
import { Bar, ErrorBox, go, Icon, PageHeading, Loading, pct, useApp, useAsync } from '../../ui/kit';
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
            <Icon name="flame" />
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
            <Icon name="exam" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{p.reviewDue}</span>
            <span className="stat-widget-label">Câu đến hạn ôn</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon blue">
            <Icon name="target" />
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
              <Icon name="chart" /> Năng lực theo chuyên đề
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
              <Icon name="report" /> Xu hướng học tập 4 tuần
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
    <div className="stack" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 12, alignItems: 'center' }}>
        <PageHeading title="Tiến bộ & câu cần ôn" description="Theo dõi năng lực và ôn lại câu sai." icon="chart" />
      </div>

      {/* Action Widgets: Câu cần ôn + Khắc phục chuyên đề yếu */}
      <div className="grid-2">
        <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--line)', background: '#fff' }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="badge" style={{ marginBottom: 4, background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 700 }}>
                Ôn tập theo lịch
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: 17, color: 'var(--ink)' }}>Câu cần ôn</h2>
            </div>
            <span className="page-intro-icon"><Icon name="clock" /></span>
          </div>
          <div className="row tiny muted">
            <span>{dueCount} câu cần ôn tập hôm nay · {totalReview} câu đã lưu trong sổ</span>
          </div>
          <button
            type="button"
            className="btn block"
            style={{
              marginTop: 'auto',
              background: dueCount > 0 ? 'var(--primary)' : 'var(--surface-3)',
              color: dueCount > 0 ? '#fff' : '#595959',
              borderColor: dueCount > 0 ? 'var(--primary)' : 'var(--line)',
              fontWeight: 700,
            }}
            disabled={busy || dueCount === 0}
            onClick={startReview}
          >
            {dueCount > 0 ? `Ôn ngay ${Math.min(10, dueCount)} câu đến hạn →` : 'Chưa có câu nào đến hạn hôm nay'}
          </button>
        </div>

        <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--line)', background: '#fff' }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="badge blue" style={{ marginBottom: 4, fontWeight: 700 }}>
                Luyện theo kết quả
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: 17, color: 'var(--ink)' }}>Khắc phục phần còn yếu</h2>
            </div>
            <span className="page-intro-icon"><Icon name="practice" /></span>
          </div>
          <div className="row tiny muted">
            <span>Chọn 8 câu từ chuyên đề bạn còn yếu để luyện lại.</span>
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
