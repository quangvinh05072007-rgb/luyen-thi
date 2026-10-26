import { filterExamCatalog } from '../../../shared/exam-catalog.mjs';
import { useState } from 'react';
import { download, get, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { Comments } from '../../ui/Comments';
import { OmrModal } from '../../ui/OmrModal';
import { PageHeading, shareUrl, ErrorBox, fmtDate, go, LevelBadge, Icon, Loading, topicName, useApp, useAsync, useRoute } from '../../ui/kit';

export function Exams() {
  const { query } = useRoute();
  const requestedClass = query.get('classId');
  const suffix = requestedClass && /^\d+$/.test(requestedClass) ? `?classId=${requestedClass}` : '';
  const [scope, setScope] = useState('all');
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [omrExam, setOmrExam] = useState<any>(null);
  const { meta } = useApp();
  const { data, error, loading, reload } = useAsync(() => get('/api/exams'), []);
  const allExams = data?.exams ?? [];
  const exams = filterExamCatalog(allExams,{scope,search,dept});
  const myCount = allExams.filter((e: any) => e.mine).length;
  const sharedCount = allExams.filter((e: any) => e.visibility === 'school').length;

  return (
    <div className="stack">
      <div className="row between">
        <PageHeading title="Kho đề" description="Đề đã lưu để giao cho lớp, luyện tập hoặc xuất Word." icon="exam" />
        <div className="row">{meta.omrAvailable && (<button className="btn ghost" type="button" onClick={() => setOmrExam(allExams[0] || { id: 0, title: 'Phiếu trắc nghiệm' })}><Icon name="scan" /> Chấm phiếu giấy (OMR)</button>)}<a className="btn" href={`#/nhap-de${suffix}`}><Icon name="upload" />Nhập đề từ file</a><a className="btn primary" href={`#/ra-de${suffix}`}><Icon name="plus" />Tạo đề mới</a></div>
      </div>

      <div className="catalog-summary">
        <div className="stat-widget">
          <div className="stat-widget-icon blue">
            <Icon name="exam" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{allExams.length}</span>
            <span className="stat-widget-label">Tổng số đề thi</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon green">
            <Icon name="user" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{myCount}</span>
            <span className="stat-widget-label">Đề của bạn</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon purple">
            <Icon name="school" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{sharedCount}</span>
            <span className="stat-widget-label">Dùng chung trường</span>
          </div>
        </div>
      </div>

      <div className="card flat stack" style={{ padding: '12px 16px', gap: 10 }}>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="seg" aria-label="Phạm vi đề thi">
            {[
              ['all', 'Tất cả'],
              ['mine', 'Của tôi'],
              ['shared', 'Dùng chung'],
              ['hot', 'Dùng nhiều'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={scope === value ? 'on' : ''}
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8, flex: '1 1 300px', maxWidth: 440 }}>
            <input
              className="input grow"
              type="search"
              aria-label="Tìm trong kho đề" placeholder="Tìm tên đề hoặc giáo viên…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {data && (
              <select className="input" aria-label="Tổ chuyên môn" value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Tất cả tổ</option>
                {[...new Set<string>((data?.exams ?? []).map((e: any) => e.dept).filter(Boolean))].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {!loading && data && exams.length === 0 && (
        <div className="card empty">Chưa có đề khớp bộ lọc.</div>
      )}

      {data && exams.length > 0 && (
        <div className="exam-widget-grid">
          {exams.map((e: any) => {
            const totalQ = (e.counts?.mcq ?? 0) + (e.counts?.tf ?? 0) + (e.counts?.short ?? 0);
            const dept = e.dept || 'Toán';
            const icon = dept === 'Vật lí' ? 'practice' : dept === 'Hóa học' ? 'bank' : dept === 'Sinh học' ? 'book' : dept === 'Tiếng Anh' ? 'book' : 'edit';
            const tagBg = 'var(--primary-soft)';
            const tagColor = 'var(--primary)';

            return (
              <div
                key={e.id}
                className="exam-widget-card"
                style={{
                  borderRadius: 9,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 16,
                }}
              >
                <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: tagBg,
                        color: tagColor,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={icon} />
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: tagColor,
                        background: tagBg,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {dept}
                    </span>
                  </div>

                  <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                    {e.mine && (
                      <span className="badge green" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                        Của bạn
                      </span>
                    )}
                    {e.visibility === 'school' ? (
                      <span className="badge blue" style={{ fontSize: 10, padding: '2px 6px' }}>
                        Dùng chung
                      </span>
                    ) : (
                      <span className="badge" style={{ fontSize: 10, padding: '2px 6px' }}>
                        Riêng tư
                      </span>
                    )}
                  </div>
                </div>

                <h3
                  style={{
                    margin: '2px 0',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#0f172a',
                    lineHeight: 1.4,
                  }}
                >
                  {e.title}
                </h3>

                <div className="exam-widget-meta" style={{ marginTop: 'auto', paddingTop: 2 }}>
                  <span className="exam-widget-chip"><Icon name="clock" /> {e.durationMin} phút</span>
                  <span className="exam-widget-chip"><Icon name="exam" /> {totalQ} câu</span>
                  <span className="exam-widget-chip"><Icon name="user" /> {e.author}</span>
                  {e.uses ? <span className="exam-widget-chip"><Icon name="refresh" /> {e.uses} lượt</span> : null}
                </div>

                <div
                  className="row"
                  style={{
                    gap: 8,
                    marginTop: 4,
                    paddingTop: 8,
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <a
                    className="btn primary sm grow"
                    href={`#/de-thi/${e.id}${suffix}`}
                    style={{ fontWeight: 700, textAlign: 'center' }}
                  >
                    <Icon name="plane" /> Giao bài cho lớp
                  </a>
                  <a
                    className="btn sm ghost"
                    href={`#/de-thi/${e.id}${suffix}`}
                    style={{ fontSize: 12 }}
                  >
                    Chi tiết →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {omrExam && <OmrModal exam={omrExam} onClose={() => setOmrExam(null)} onGraded={() => reload()} />}
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
  const [showOmr, setShowOmr] = useState(false);
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
      <details className="card exam-sharing">
        <summary><span><Icon name="school" />Chia sẻ & đánh giá</span><span className={`badge ${exam.visibility === 'school' ? 'blue' : ''}`}>{exam.visibility === 'school' ? 'Đang dùng chung' : 'Đề riêng tư'}</span></summary>
        <div className="stack mt">
        <p className="small muted">{exam.author} · {exam.ratingCount ? `${exam.ratingAvg}/5 từ ${exam.ratingCount} đánh giá` : 'Chưa có đánh giá'}</p>
        {(exam.mine || user.role === 'admin') && <>
          <label className="field">Tổ chuyên môn<input className="input" maxLength={80} value={deptDraft ?? exam.dept ?? ''} onChange={e => setDeptDraft(e.target.value)} placeholder="Ví dụ: Tổ Toán" /></label>
          <div className="row">{[['private', 'Lưu riêng tư'], ['school', 'Chia sẻ với trường']].map(([visibility, label]) => <button key={visibility} disabled={sharing} className={`btn ${visibility === 'school' ? 'primary' : ''}`} onClick={async () => {
            setSharing(true); try { await post(`/api/exams/${id}/share`, { visibility, dept: deptDraft ?? exam.dept ?? '' }); toast('Đã lưu chia sẻ đề.'); reload(); } catch (e: any) { toast(e.message); } finally { setSharing(false); }
          }}>{label}</button>)}</div>
          <p className="tiny muted">Đề dùng chung cho phép giáo viên trong trường xem, xuất, nhân bản và giao cho lớp mình.</p>
        </>}
        {!exam.mine && exam.visibility === 'school' && <div className="row"><label className="field">Đánh giá của bạn<select className="input" value={rating ?? exam.myRating ?? ''} onChange={e => setRating(Number(e.target.value))}><option value="" disabled>Chọn số sao</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}/5 sao</option>)}</select></label><button className="btn" disabled={sharing || !(rating ?? exam.myRating)} onClick={async () => { setSharing(true); try { await post(`/api/exams/${id}/rate`, { stars: rating ?? exam.myRating }); toast('Đã lưu đánh giá.'); reload(); } catch (e: any) { toast(e.message); } finally { setSharing(false); } }}>Lưu đánh giá</button></div>}
        </div>
      </details>
      <div className="card stack">
        <div className="row between"><h2>Giao bài cho lớp</h2><span className="tiny muted">Chọn lớp, lịch làm bài và cách công bố điểm</span></div>
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
        <p className="tiny muted">Học sinh đăng nhập tại <b>{shareUrl(meta)}</b>, mở <b>Lớp học → Làm bài</b>. Bài kiểm tra có thời gian được tự nộp khi hết giờ.</p>
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
        <p className="small muted">Các mã đề kèm bảng đáp án. Công thức LaTeX xuất thành Equation có thể sửa; hình và công thức trong câu scan giữ dạng ảnh gốc.</p>
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
      <div className="card">
        <div className="card-head">
          <h2>Thi trên giấy & Chấm phiếu (OMR)</h2>
        </div>
        <p className="small muted">In phiếu trả lời trắc nghiệm chuẩn A4 theo định dạng 2025 có 4 điểm định vị. Quét và chấm bài tự động bằng camera hoặc máy scan.</p>
        <div className="row">
          <a className="btn" href={`/api/omr/template?examId=${id}`} target="_blank" rel="noreferrer">
            <Icon name="print" /> In phiếu trả lời A4
          </a>
          {meta.omrAvailable && (
            <button className="btn primary" type="button" onClick={() => setShowOmr(true)}>
              <Icon name="scan" /> Quét & Chấm phiếu thi
            </button>
          )}
        </div>
      </div>
      {showOmr && <OmrModal exam={data} onClose={() => setShowOmr(false)} onGraded={() => toast('Đã chấm xong phiếu!')} />}
      <div className="card"><Comments kind="exam" id={id} /></div>
      <div className="card">
        <h2>Nội dung đề</h2>
        <p className="tiny muted">Câu hỏi gốc trước khi trộn mã đề. Mở từng câu để kiểm tra phương án và đáp án.</p>
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
                <details className="exam-preview-options">
                  <summary>Phương án & đáp án</summary>
                  {q.type !== 'short' && <div className="grid-2 small mt">{q.options.map((option: string,k: number)=><div key={k}><b>{q.type==='mcq'?'ABCD'[k]+'.':'abcd'[k]+')'}</b> <MathText text={option}/></div>)}</div>}
                  <div className="small mt"><b>Đáp án: </b>{q.type==='mcq'?'ABCD'[q.answer]:q.type==='tf'?q.answer.map((v: boolean,k: number)=>`${'abcd'[k]}) ${v?'Đúng':'Sai'}`).join(' · '):String(q.answer ?? '—')}</div>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
