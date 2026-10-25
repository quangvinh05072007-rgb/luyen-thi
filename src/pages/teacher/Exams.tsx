import { useState } from 'react';
import { download, get, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { Comments } from '../../ui/Comments';
import { shareUrl, ErrorBox, fmtDate, go, LevelBadge, Loading, topicName, useApp, useAsync, useRoute } from '../../ui/kit';

export function Exams() {
  const {query}=useRoute();
  const requestedClass=query.get('classId');
  const suffix=requestedClass&&/^\d+$/.test(requestedClass)?`?classId=${requestedClass}`:'';
  const [scope, setScope] = useState('all');
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const { data, error, loading, reload } = useAsync(() => get(`/api/exams?scope=${scope}`), [scope]);
  const exams = (data?.exams ?? []).filter((e: any) => (!dept || e.dept === dept) && `${e.title} ${e.author}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return (
    <div className="stack">
      <div className="row between">
        <h1>Đề thi</h1>
        <a className="btn primary" href={`#/ra-de${suffix}`}>
          Ra đề mới
        </a>
      </div>
      <p className="muted">Đề của bạn và kho đề giáo viên trong trường cùng xây dựng.</p>
      <div className="card flat stack">
        <div className="seg" aria-label="Phạm vi đề thi">
          {[['all', 'Tất cả'], ['mine', 'Của tôi'], ['shared', 'Dùng chung'], ['hot', 'Được dùng nhiều']].map(([value, label]) => <button key={value} className={scope === value ? 'on' : ''} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>)}
        </div>
        <div className="row"><label className="field grow">Tìm đề<input className="input" type="search" placeholder="Tên đề hoặc giáo viên" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <label className="field">Tổ chuyên môn<select className="input" value={dept} onChange={e => setDept(e.target.value)}><option value="">Tất cả tổ</option>{[...new Set<string>((data?.exams ?? []).map((e: any) => e.dept).filter(Boolean))].map(d => <option key={d}>{d}</option>)}</select></label></div>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {!loading && data && exams.length === 0 && <div className="card empty">Chưa có đề khớp bộ lọc. Đổi phạm vi tìm hoặc tạo đề mới.</div>}
      {data && (
        <div className="card">
          {exams.map((e: any) => (
            <a key={e.id} className="list-item" href={`#/de-thi/${e.id}${suffix}`} style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="strong">{e.title}</div>
                <div className="row tiny"><span className={`badge ${e.visibility === 'school' ? 'blue' : ''}`}>{e.visibility === 'school' ? 'Dùng chung' : 'Riêng tư'}</span>{e.mine && <span className="badge">Của bạn</span>}{e.dept && <span>{e.dept}</span>}<span>{e.ratingCount ? `${e.ratingAvg}/5 (${e.ratingCount} đánh giá)` : 'Chưa có đánh giá'} · {e.uses} lượt dùng</span></div>
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
  const {query}=useRoute();
  const requestedClass=Number(query.get('classId'));
  const classSuffix=Number.isSafeInteger(requestedClass)&&requestedClass>0?`?classId=${requestedClass}`:'';
  const { meta, user, toast } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const [e, c] = await Promise.all([get(`/api/exams/${id}`), get('/api/classes')]);
    return { ...e, classes: c.classes };
  }, [id]);
  const [classIds, setClassIds] = useState<number[]>(Number.isSafeInteger(requestedClass)&&requestedClass>0?[requestedClass]:[]);
  const [mode, setMode] = useState<'exam' | 'homework'>('exam');
  const [openAt, setOpenAt] = useState(toLocal(Date.now()));
  const [closeAt, setCloseAt] = useState(toLocal(Date.now() + 7 * 86400000));
  const [duration, setDuration] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<'after_submit' | 'after_close'>('after_submit');
  const [busy, setBusy] = useState(false);
  const [variantMode, setVariantMode] = useState('per_student');
  const [sharing, setSharing] = useState(false);
  const [deptDraft, setDeptDraft] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [variantList, setVariantList] = useState<Record<string,string>>({});
  const roster = useAsync(async () => variantMode === 'list' ? (await Promise.all(classIds.map(c => get(`/api/classes/${c}`)))).flatMap(r => r.students) : [], [variantMode,classIds.join(',')]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const exam = data.exam;
  const selectedClasses=classIds.filter(cid=>data.classes.some((c:any)=>c.id===cid));
  const assign = async () => {
    setBusy(true);
    try {
      const list = Object.fromEntries((roster.data ?? []).filter((s: any) => variantList[s.id]).map((s: any) => [s.id,variantList[s.id]]));
      await post('/api/assignments', { examId: id, classIds:selectedClasses, mode, variantMode, variantList:variantMode === 'list' ? list : undefined, openAt: new Date(openAt).getTime(), closeAt: new Date(closeAt).getTime(), durationMin: duration ?? exam.durationMin, showResult });
      toast(`Đã giao đề cho ${selectedClasses.length} lớp.`);
      go(selectedClasses.length===1?`/lop/${selectedClasses[0]}/bai-giao`:'/lop-hoc');
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };
  const exportDocx = (solutions: boolean) => download(`/api/exams/${id}/docx${solutions ? '?solutions=1' : ''}`, 'de-thi.docx').catch((e) => toast(e.message));
  return (
    <div className="stack">
      <div>
        <a className="small" href={`#/thu-vien${classSuffix}`}>Về kho đề</a>
        <h1>{exam.title}</h1>
        <div className="small muted">
          {exam.items.length} câu · {exam.durationMin} phút · mã đề {exam.variants.join(', ')}
        </div>
      </div>
      <section className="card stack">
        <div className="row between"><h2>Chia sẻ trong trường</h2><span className={`badge ${exam.visibility === 'school' ? 'blue' : ''}`}>{exam.visibility === 'school' ? 'Đang dùng chung' : 'Đề riêng tư'}</span></div>
        <p className="small muted">{exam.author} · {exam.ratingCount ? `${exam.ratingAvg}/5 từ ${exam.ratingCount} đánh giá` : 'Chưa có đánh giá'}</p>
        {(exam.mine || user.role === 'admin') && <>
          <label className="field">Tổ chuyên môn<input className="input" maxLength={80} value={deptDraft ?? exam.dept ?? ''} onChange={e => setDeptDraft(e.target.value)} placeholder="Ví dụ: Tổ Toán" /></label>
          <div className="row">{[['private', 'Lưu riêng tư'], ['school', 'Chia sẻ với trường']].map(([visibility, label]) => <button key={visibility} disabled={sharing} className={`btn ${visibility === 'school' ? 'primary' : ''}`} onClick={async () => {
            setSharing(true); try { await post(`/api/exams/${id}/share`, { visibility, dept: deptDraft ?? exam.dept ?? '' }); toast('Đã lưu chia sẻ đề.'); reload(); } catch (e: any) { toast(e.message); } finally { setSharing(false); }
          }}>{label}</button>)}</div>
          <p className="tiny muted">Đề dùng chung cho phép giáo viên trong trường xem, xuất, nhân bản và giao cho lớp mình.</p>
        </>}
        {!exam.mine && exam.visibility === 'school' && <div className="row"><label className="field">Đánh giá của bạn<select className="input" value={rating ?? exam.myRating ?? ''} onChange={e => setRating(Number(e.target.value))}><option value="" disabled>Chọn số sao</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}/5 sao</option>)}</select></label><button className="btn" disabled={sharing || !(rating ?? exam.myRating)} onClick={async () => { setSharing(true); try { await post(`/api/exams/${id}/rate`, { stars: rating ?? exam.myRating }); toast('Đã lưu đánh giá.'); reload(); } catch (e: any) { toast(e.message); } finally { setSharing(false); } }}>Lưu đánh giá</button></div>}
      </section>
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
          <label htmlFor="assign-open">Mở lúc</label>
            <input id="assign-open" className="input" type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="assign-close">Đóng lúc</label>
            <input id="assign-close" className="input" type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
          </div>
          {mode === 'exam' && (
            <div className="field">
              <label htmlFor="assign-duration">Thời gian làm (phút)</label>
              <input id="assign-duration" className="input" type="number" min={5} value={duration ?? exam.durationMin} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="assign-variants">Chia mã đề</label><select id="assign-variants" className="input" value={variantMode} onChange={e => setVariantMode(e.target.value)}><option value="per_student">Mỗi học sinh một thứ tự riêng</option><option value="random">Chia ngẫu nhiên, đều các mã đã tạo</option><option value="list">Chỉ định mã cho từng học sinh</option></select>
        </div>
        {variantMode === 'list' && <div className="stack"><p className="tiny muted">Chọn lớp trước. Những em để tự chia sẽ được phân đều vào các mã còn lại.</p>{roster.loading && <Loading />}{roster.error && <ErrorBox error={roster.error} onRetry={roster.reload} />}{roster.data?.map((s: any) => <label className="row between small" key={s.id}>{s.name ?? s.display_name}<select className="input" style={{width:'auto'}} value={variantList[s.id] ?? ''} onChange={e => setVariantList({...variantList,[s.id]:e.target.value})}><option value="">Tự chia</option>{exam.variants.map((c: string) => <option key={c}>{c}</option>)}</select></label>)}</div>}
        <div className="field">
          <label htmlFor="assign-results">Học sinh xem điểm và lời giải</label>
          <select id="assign-results" className="input" value={showResult} onChange={(e) => setShowResult(e.target.value as any)}>
            <option value="after_submit">Ngay sau khi nộp</option>
            <option value="after_close">Sau khi đóng bài (chống lộ đáp án)</option>
          </select>
        </div>
        <p className="tiny muted">Đồng hồ do máy chủ giữ; hết giờ máy chủ tự nộp bản lưu cuối. Học sinh vào địa chỉ <b>{shareUrl(meta)}</b> (cùng mạng với máy này).</p>
        <div>
          <button className="btn primary big" disabled={busy || !selectedClasses.length || (variantMode === 'list' && (roster.loading || !!roster.error))} onClick={assign}>
            Giao cho {selectedClasses.length || '…'} lớp
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
                  go(`/de-thi/${r.id}${classSuffix}`);
                })
                .catch((e) => toast(e.message))
            }
          >
            Nhân bản đề
          </button>
        </div>
      </div>
      <div className="card"><Comments kind="exam" id={id} /></div>
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
