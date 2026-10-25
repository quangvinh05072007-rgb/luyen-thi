import { useState } from 'react';
import { download, get, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { shareUrl, ErrorBox, fmtDate, go, LevelBadge, Loading, topicName, useApp, useAsync } from '../../ui/kit';

export function Exams() {
  const { data, error, loading, reload } = useAsync(() => get('/api/exams'), []);
  return (
    <div className="stack">
      <div className="row between">
        <h1>Đề thi</h1>
        <a className="btn primary" href="#/ra-de">
          Ra đề mới
        </a>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && data.exams.length === 0 && <div className="card empty">Chưa có đề nào. Bấm "Ra đề mới" để tạo đề đầu tiên.</div>}
      {data && (
        <div className="card">
          {data.exams.map((e: any) => (
            <a key={e.id} className="list-item" href={`#/de-thi/${e.id}`} style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="strong">{e.title}</div>
                <div className="tiny muted">
                  {e.counts.mcq} TN · {e.counts.tf} Đ/S · {e.counts.short} TLN · {e.durationMin} phút · {e.author} · {fmtDate(e.createdAt)}
                </div>
              </div>
              <span className="small">Giao / Xuất →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const toLocal = (ms: number) => {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function ExamDetail({ id }: { id: number }) {
  const { meta, toast } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const [e, c] = await Promise.all([get(`/api/exams/${id}`), get('/api/classes')]);
    return { ...e, classes: c.classes };
  }, [id]);
  const [classIds, setClassIds] = useState<number[]>([]);
  const [mode, setMode] = useState<'exam' | 'homework'>('exam');
  const [openAt, setOpenAt] = useState(toLocal(Date.now()));
  const [closeAt, setCloseAt] = useState(toLocal(Date.now() + 7 * 86400000));
  const [duration, setDuration] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<'after_submit' | 'after_close'>('after_submit');
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const exam = data.exam;
  const assign = async () => {
    setBusy(true);
    try {
      await post('/api/assignments', { examId: id, classIds, mode, openAt: new Date(openAt).getTime(), closeAt: new Date(closeAt).getTime(), durationMin: duration ?? exam.durationMin, showResult });
      toast(`Đã giao đề cho ${classIds.length} lớp.`);
      go('/bai-giao');
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };
  const exportDocx = (solutions: boolean) => download(`/api/exams/${id}/docx${solutions ? '?solutions=1' : ''}`, 'de-thi.docx').catch((e) => toast(e.message));
  return (
    <div className="stack">
      <div>
        <h1>{exam.title}</h1>
        <div className="small muted">
          {exam.items.length} câu · {exam.durationMin} phút · mã đề {exam.variants.join(', ')}
        </div>
      </div>
      <div className="card stack">
        <h2>Giao đề</h2>
        <div className="field">
          <label>Lớp</label>
          <div className="row">
            {data.classes.map((c: any) => (
              <label key={c.id} className="check badge" style={{ padding: '6px 12px', fontSize: 14 }}>
                <input type="checkbox" checked={classIds.includes(c.id)} onChange={() => setClassIds((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
                {c.name} ({c.students})
              </label>
            ))}
            {data.classes.length === 0 && <span className="small muted">Bạn chưa phụ trách lớp nào.</span>}
          </div>
        </div>
        <div className="seg">
          <button className={mode === 'exam' ? 'on' : ''} onClick={() => setMode('exam')}>
            Thi online (tính giờ)
          </button>
          <button className={mode === 'homework' ? 'on' : ''} onClick={() => setMode('homework')}>
            Bài tập về nhà
          </button>
        </div>
        <div className="grid-3">
          <div className="field">
            <label>Mở lúc</label>
            <input className="input" type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
          </div>
          <div className="field">
            <label>Đóng lúc</label>
            <input className="input" type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
          </div>
          {mode === 'exam' && (
            <div className="field">
              <label>Thời gian làm (phút)</label>
              <input className="input" type="number" min={5} value={duration ?? exam.durationMin} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          )}
        </div>
        <div className="field">
          <label>Học sinh xem điểm và lời giải</label>
          <select className="input" value={showResult} onChange={(e) => setShowResult(e.target.value as any)}>
            <option value="after_submit">Ngay sau khi nộp</option>
            <option value="after_close">Sau khi đóng bài (chống lộ đáp án)</option>
          </select>
        </div>
        <p className="tiny muted">Mỗi học sinh nhận thứ tự câu và phương án riêng. Đồng hồ do máy chủ giữ; hết giờ máy chủ tự nộp bản lưu cuối. Học sinh vào địa chỉ <b>{shareUrl(meta)}</b> (cùng mạng với máy này).</p>
        <div>
          <button className="btn primary big" disabled={busy || !classIds.length} onClick={assign}>
            Giao cho {classIds.length || '…'} lớp
          </button>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>Xuất Word</h2>
        </div>
        <p className="small muted">Mọi mã đề kèm bảng đáp án; công thức là Equation thật của Word (sửa được), không phải ảnh.</p>
        <div className="row">
          <button className="btn" onClick={() => exportDocx(false)}>
            Tải đề + đáp án (.docx)
          </button>
          <button className="btn" onClick={() => exportDocx(true)}>
            Tải kèm lời giải
          </button>
          <button
            className="btn ghost"
            onClick={() =>
              post(`/api/exams/${id}/clone`, {})
                .then((r) => {
                  toast('Đã nhân bản đề.');
                  go(`/de-thi/${r.id}`);
                })
                .catch((e) => toast(e.message))
            }
          >
            Nhân bản đề
          </button>
        </div>
      </div>
      <div className="card">
        <h2>Nội dung đề</h2>
        {exam.items.map((it: any, i: number) => {
          const q = data.questions[it.qid];
          return (
            <div key={it.qid} className="list-item" style={{ alignItems: 'flex-start' }}>
              <b className="small">{i + 1}.</b>
              <div className="grow">
                <MathText as="div" className="small" text={q.stem} />
                <div className="row tiny" style={{ gap: 6 }}>
                  <LevelBadge level={q.level} />
                  <span className="muted">{topicName(meta, q.topic)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
