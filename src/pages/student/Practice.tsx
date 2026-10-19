import { useState } from 'react';
import { get, post } from '../../api';
import { Bar, ErrorBox, go, Loading, Mascot, useApp, useAsync } from '../../ui/kit';

export function PracticeHub() {
  const { meta, user, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/student/home'), []);
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const start = async (body: any) => {
    setBusy(true);
    try {
      const a = await post('/api/practice/start', body);
      go(`/thi/${a.id}`);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };
  const mastery = Object.fromEntries(data.mastery.map((m: any) => [m.topic, m]));
  const grade = user.class?.grade ?? 12;
  const topics = meta.topics.filter((t) => t.grade <= grade).sort((a, b) => b.grade - a.grade);
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  return (
    <div className="stack">
      <div className="card hero">
        <Mascot size={72} mood="think" />
        <div style={{ flex: 1 }}>
          <h1>Luyện tập</h1>
          <p className="small muted">Mỗi câu được chấm ngay, có lời giải và cho biết em sai kiểu gì. Câu sai tự vào Sổ lỗi sai.</p>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Luyện thông minh</h2>
          <p className="small muted">SmartExam chọn chuyên đề em yếu nhất, đúng mức độ vừa sức, ưu tiên câu em từng sai.</p>
          <button className="btn primary big block" disabled={busy} onClick={() => start({ mode: 'weak', count })}>
            Luyện {count} câu phần yếu
          </button>
        </div>
        <div className="card">
          <h2>Sổ lỗi sai</h2>
          <p className="small muted">
            {data.review.total} câu trong sổ, {data.review.due} câu đến hạn ôn hôm nay.
          </p>
          <button className="btn big block" disabled={busy || data.review.due === 0} onClick={() => start({ mode: 'review', count: 10 })}>
            {data.review.due ? `Ôn ${Math.min(10, data.review.due)} câu đến hạn` : 'Chưa có câu đến hạn'}
          </button>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>Tự chọn chuyên đề</h2>
          <select className="input" style={{ width: 'auto' }} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Số câu">
            {[5, 8, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n} câu
              </option>
            ))}
          </select>
        </div>
        <div className="stack">
          {topics.map((t) => {
            const m = mastery[t.code];
            return (
              <label key={t.code} className="list-item check" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={picked.includes(t.code)} onChange={() => toggle(t.code)} />
                <div className="grow">
                  <div className="small strong">
                    {t.name} <span className="tiny muted">· lớp {t.grade}</span>
                  </div>
                  {m ? <Bar value={m.value} /> : <div className="tiny muted">Chưa làm câu nào</div>}
                </div>
                {m && <span className="tiny muted">{Math.round(m.value * 100)}%</span>}
              </label>
            );
          })}
        </div>
        <button className="btn primary block mt" disabled={busy || !picked.length} onClick={() => start({ mode: 'topic', topics: picked, count })}>
          {picked.length ? `Luyện ${count} câu (${picked.length} chuyên đề)` : 'Chọn ít nhất một chuyên đề'}
        </button>
      </div>
    </div>
  );
}
