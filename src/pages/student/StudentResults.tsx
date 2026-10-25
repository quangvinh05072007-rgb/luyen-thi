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
  const rows = data.assignments.filter((a: any) => a.state === 'done');
  return (
    <section className="card">
      <div className="card-head">
        <h2>Kết quả của em</h2>
      </div>
      {rows.length === 0 && <p className="muted">Em chưa nộp bài nào. Các bài đã hoàn thành sẽ xuất hiện ở đây.</p>}
      {rows.map((a: any) => (
        <div key={a.id} className="list-item">
          <div className="grow">
            <strong>{a.title}</strong>
            <p className="tiny muted">{a.score10 === null ? 'Đã nộp · Chờ công bố kết quả' : `${fmtScore(a.score10)}/10 điểm`}</p>
          </div>
          {a.score10 !== null && (
            <a className="btn sm" href={`#/ket-qua/${a.attempt_id}`}>
              Xem bài
            </a>
          )}
        </div>
      ))}
    </section>
  );
}
