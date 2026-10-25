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
      <div className="stat-widget-grid">
        <div className="stat-widget">
          <div className="stat-widget-icon orange">
            <span style={{ fontSize: 20 }}>🔥</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{data.streak?.current ?? 0}</span>
            <span className="stat-widget-label">Ngày học liên tiếp</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon red" style={{ background: '#fff1f0', color: '#ff4d4f' }}>
            <span style={{ fontSize: 20 }}>📑</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{data.review.due}</span>
            <span className="stat-widget-label">Câu đến hạn ôn</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon blue">
            <span style={{ fontSize: 20 }}>📚</span>
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{data.review.total}</span>
            <span className="stat-widget-label">Tổng câu trong sổ lỗi</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="badge blue" style={{ marginBottom: 4 }}>Đề xuất AI</span>
              <h2 style={{ margin: '4px 0 0', fontSize: 17 }}>Luyện phần còn yếu</h2>
            </div>
            <span style={{ fontSize: 28 }}>🎯</span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="tiny muted">Số câu:</span>
            <div className="filter-pills">
              {[5, 8, 10, 15].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`filter-pill ${count === n ? 'active' : ''}`}
                  onClick={() => setCount(n)}
                >
                  {n} câu
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn primary block"
            style={{ marginTop: 'auto' }}
            disabled={busy}
            onClick={() => start({ mode: 'weak', count })}
          >
            Bắt đầu luyện {count} câu →
          </button>
        </div>

        <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <span className="badge" style={{ marginBottom: 4, background: '#fff1f0', color: '#cf1322' }}>
                Lặp lại ngắt quãng
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: 17 }}>Sổ lỗi sai</h2>
            </div>
            <span style={{ fontSize: 28 }}>🔁</span>
          </div>
          <div className="row tiny muted">
            <span>{data.review.due} câu cần ôn tập hôm nay · {data.review.total} câu đã lưu</span>
          </div>
          <button
            className="btn block"
            style={{ marginTop: 'auto', background: data.review.due > 0 ? '#fa8c16' : undefined, color: data.review.due > 0 ? '#fff' : undefined, borderColor: data.review.due > 0 ? '#fa8c16' : undefined }}
            disabled={busy || data.review.due === 0}
            onClick={() => start({ mode: 'review', count: 10 })}
          >
            {data.review.due ? `Ôn ngay ${Math.min(10, data.review.due)} câu đến hạn →` : 'Chưa có câu đến hạn hôm nay'}
          </button>
        </div>
      </div>

      <div className="widget-card stack">
        <div className="widget-head">
          <h2 className="widget-title">
            <span>📖</span> Tự chọn chuyên đề luyện tập
          </h2>
          <span className="badge">{picked.length} đã chọn</span>
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          {topics.map((t) => {
            const m = mastery[t.code];
            const isSelected = picked.includes(t.code);
            return (
              <div
                key={t.code}
                className="task-widget"
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--primary)' : undefined,
                  background: isSelected ? '#f0f7ff' : undefined,
                }}
                onClick={() => toggle(t.code)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(t.code)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row between" style={{ gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{t.name}</span>
                    <span className="tiny muted">Lớp {t.grade}</span>
                  </div>
                  {m ? (
                    <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <div style={{ flex: 1 }}>
                        <Bar value={m.value} />
                      </div>
                      <span className="tiny muted" style={{ fontWeight: 600 }}>{Math.round(m.value * 100)}%</span>
                    </div>
                  ) : (
                    <div className="tiny muted" style={{ marginTop: 4 }}>Chưa có dữ liệu</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button
          className="btn primary block mt"
          disabled={busy || !picked.length}
          onClick={() => start({ mode: 'topic', topics: picked, count })}
        >
          {picked.length ? `Luyện ${count} câu (${picked.length} chuyên đề đã chọn) →` : 'Chọn ít nhất một chuyên đề ở trên để bắt đầu'}
        </button>
      </div>
    </div>
  );
}
