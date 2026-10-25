import { get } from '../../api';
import { ErrorBox, fmtScore, Loading, useAsync } from '../../ui/kit';
import { Progress } from './Progress';
import { MyAppeals } from './MyAppeals';

const TABS: [string, string, string][] = [
  ['results', 'Kết quả', '/ket-qua'],
  ['progress', 'Tiến bộ', '/tien-bo'],
  ['appeals', 'Khiếu nại', '/khieu-nai'],
];

export function StudentResults({ initial = 'results' }: { initial?: string }) {
  return (
    <div className="stack">
      <nav className="section-tabs" aria-label="Kết quả và tiến bộ">
        {TABS.map(([value, label, href]) => (
          <a
            key={value}
            href={`#${href}`}
            className={initial === value ? 'active' : ''}
            aria-current={initial === value ? 'page' : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      {initial === 'results' ? <ResultsList /> : initial === 'progress' ? <Progress /> : <MyAppeals />}
    </div>
  );
}

function ResultsList() {
  const { data, error, loading, reload } = useAsync(() => get('/api/student/home'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const rows = (data?.assignments ?? []).filter((a: any) => a.state === 'done');
  const scores = rows.filter((a: any) => a.score10 !== null).map((a: any) => a.score10);
  const avg = scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '—';
  const max = scores.length ? Math.max(...scores).toFixed(1) : '—';

  return (
    <div className="stack">
      <div className="stat-widget-grid">
        <div className="stat-widget">
          <div className="stat-widget-icon green">
            <span style={{ fontSize: 20 }}>✅</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{rows.length}</span>
            <span className="stat-widget-label">Bài đã hoàn thành</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon blue">
            <span style={{ fontSize: 20 }}>📊</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{avg}</span>
            <span className="stat-widget-label">Điểm trung bình</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon orange">
            <span style={{ fontSize: 20 }}>🏆</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{max}</span>
            <span className="stat-widget-label">Điểm cao nhất</span>
          </div>
        </div>
      </div>

      <div className="widget-card">
        <div className="widget-head">
          <h2 className="widget-title">
            <span>📋</span> Danh sách bài đã làm
          </h2>
          <span className="badge">{rows.length} bài</span>
        </div>

        {rows.length === 0 ? (
          <div className="card empty">Chưa có bài thi nào đã hoàn thành.</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {rows.map((a: any) => {
              const score = a.score10;
              const badgeClass =
                score === null
                  ? 'pending'
                  : score >= 8
                  ? 'high'
                  : score >= 6.5
                  ? 'med'
                  : score >= 5
                  ? 'avg'
                  : 'low';

              return (
                <div key={a.id} className="result-widget-card">
                  <div className="row" style={{ gap: 14, alignItems: 'center' }}>
                    <div className={`result-score-badge ${badgeClass}`}>
                      {score !== null ? fmtScore(score) : 'Chờ'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                        {a.title}
                      </div>
                      <div className="tiny muted" style={{ marginTop: 2 }}>
                        {a.mode === 'exam' ? 'Bài thi' : 'Bài tập'} · {a.subject || 'Toán học'} ·{' '}
                        {score === null ? 'Đang chấm / chờ công bố' : `${fmtScore(score)} / 10 điểm`}
                      </div>
                    </div>
                  </div>
                  {score !== null ? (
                    <a className="btn sm primary" href={`#/ket-qua/${a.attempt_id}`}>
                      Xem bài làm →
                    </a>
                  ) : (
                    <span className="badge amber">Đã nộp</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
