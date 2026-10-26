import { useMemo, useState } from 'react';
import { download, get, post, put } from '../../api';
import { MathText } from '../../ui/MathText';
import { PageHeading, ErrorBox, LevelBadge, Loading, Modal, SourceBadge, topicName, TypeBadge, useApp, useAsync, useRoute } from '../../ui/kit';
import { Draft, QuestionEditor } from '../../ui/QuestionEditor';
import { Comments } from '../../ui/Comments';
import { QuestionHistory } from '../../ui/QuestionHistory';

export function QuestionCard({ q, selected, onSelect, onEdit, actions, onDraft }: { q: any; selected?: boolean; onSelect?: () => void; onEdit?: () => void; actions?: React.ReactNode; onDraft?: (action: 'approve' | 'reject', confirmMismatch?: boolean) => void }) {
  const { meta } = useApp();
  return (
    <div className="card flat" style={selected ? { borderColor: 'var(--primary)', background: 'var(--primary-soft)' } : undefined}>
      <div className="row mb" style={{ gap: 6 }}>
        {onSelect && <input type="checkbox" checked={!!selected} onChange={onSelect} aria-label={`Chọn câu #${q.id}`} />}
        <span className="tiny muted">#{q.id}</span>
        <SourceBadge source={q.source} />
        <TypeBadge type={q.type} />
        <LevelBadge level={q.level} />
        <span className={`badge ${q.status === 'approved' ? 'green' : 'amber'}`}>{q.status === 'approved' ? 'Đã duyệt' : 'Nháp'}</span>
        {q.status === 'draft' && q.approvals?.length > 0 && <span className="badge blue">{q.approvals.length}/2 người đã duyệt</span>}
        {q.sample ? <span className="badge">Mẫu</span> : null}
        <span className="tiny muted" style={{ flex: 1 }}>
          {topicName(meta, q.topic)}
        </span>
        {q.stats && (
          <span className="tiny muted" title="Số lượt làm và tỉ lệ điểm trung bình">
            {q.stats.n} lượt · {Math.round(q.stats.p * 100)}%
          </span>
        )}
      </div>
      <MathText as="div" className="q-stem" text={q.stem} />
      {q.type !== 'short' && (
        <div className="grid-2 mt" style={{ gap: 6 }}>
          {q.options.map((o: string, i: number) => {
            const ok = q.type === 'mcq' ? q.answer === i : Array.isArray(q.answer) ? q.answer[i] : null;
            return (
              <div key={i} className="small" style={{ color: q.type === 'mcq' && ok ? 'var(--good)' : undefined, fontWeight: q.type === 'mcq' && ok ? 700 : 400 }}>
                <b>{q.type === 'mcq' ? 'ABCD'[i] + '.' : 'abcd'[i] + ')'}</b> <MathText text={o} />
                {q.type === 'tf' && ok !== null && ok !== undefined && <span className={`badge ${ok ? 'green' : 'red'}`} style={{ marginLeft: 6 }}>{ok ? 'Đ' : 'S'}</span>}
              </div>
            );
          })}
        </div>
      )}
      {q.type === 'short' && <div className="small mt">Đáp án: <b>{String(q.answer ?? '—')}</b></div>}
      {q.problems?.length > 0 && <div className="alert warn small mt">Cần sửa trước khi duyệt: {q.problems.join(' ')}</div>}
      {q.explanationDraft && (
        <div className={`alert ${q.draftCheck?.matches === false ? 'error' : 'info'} small mt`}>
          <div className="strong">Lời giải nháp do AI viết — học sinh chưa thấy cho đến khi bạn duyệt</div>
          {q.draftCheck?.matches === false && <div>AI tự giải ra đáp án khác đáp án đã duyệt của câu này. Kiểm tra lại đáp án hoặc lời giải trước khi dùng.</div>}
          {q.draftCheck?.matches === true && <div>AI tự giải ra cùng đáp án với đáp án đã duyệt.</div>}
          <MathText as="div" text={q.explanationDraft} />
          {onDraft && (
            <div className="row mt">
              <button className="btn good sm" onClick={() => onDraft('approve', q.draftCheck?.matches === false)}>
                {q.draftCheck?.matches === false ? 'Vẫn dùng lời giải này' : 'Duyệt lời giải'}
              </button>
              <button className="btn ghost sm" onClick={() => onDraft('reject')}>
                Bỏ nháp
              </button>
            </div>
          )}
        </div>
      )}
      {(onEdit || actions) && (
        <div className="row mt">
          {onEdit && (
            <button className="btn sm" onClick={onEdit}>
              Sửa
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

export function Bank() {
  const {query}=useRoute();
  const requestedClass=query.get('classId');
  const classSuffix=requestedClass&&/^\d+$/.test(requestedClass)?`?classId=${requestedClass}`:'';
  const { meta, toast, user } = useApp();
  const [f, setF] = useState({ status: 'all', type: '', topic: '', source: '', level: '', q: '' });
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString(), [f]);
  const { data, error, loading, reload } = useAsync(() => get(`/api/questions?${qs}`), [qs]);
  const [sel, setSel] = useState<number[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [discussion, setDiscussion] = useState<number | null>(null);
  const [history, setHistory] = useState<number | null>(null);
  const [editReason, setEditReason] = useState('');

  const approve = async (ids: number[]) => {
    setBusy(true);
    try {
      const r = await post('/api/questions/approve', { ids });
      toast(`Đã duyệt ${r.approved.length} câu${r.pending?.length ? `, ${r.pending.length} câu chờ người thứ hai` : ''}${r.rejected.length ? `, ${r.rejected.length} câu còn thiếu thông tin` : ''}.`);
      setSel([]);
      reload();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const archive = async (ids: number[]) => {
    if (!confirm(`Ẩn ${ids.length} câu khỏi ngân hàng? Đề cũ đã dùng câu này vẫn giữ nguyên.`)) return;
    await post('/api/questions/archive', { ids });
    setSel([]);
    reload();
  };
  // Thao tác hàng loạt: đổi chuyên đề / mức độ cho các câu đã chọn; có nút Hoàn tác ngay sau đó.
  const [lastBulk, setLastBulk] = useState<number | null>(null);
  const bulk = async (action: 'set_topic' | 'set_level', value: string) => {
    if (!value) return;
    setBusy(true);
    try {
      const r = await post('/api/questions/bulk', { ids: sel, action, value });
      setLastBulk(r.batchId);
      toast(`Đã đổi ${r.changed} câu${r.unchanged ? ` (${r.unchanged} câu không đổi)` : ''}. Bấm Hoàn tác nếu nhầm.`);
      reload();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const undoBulk = async () => {
    if (!lastBulk) return;
    try {
      const r = await post(`/api/questions/bulk/${lastBulk}/undo`);
      toast(`Đã hoàn tác ${r.restored} câu${r.skipped.length ? `, bỏ qua ${r.skipped.length} câu đã sửa tiếp` : ''}.`);
      setLastBulk(null);
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const ai = async (kind: 'similar' | 'explain', id: number) => {
    setBusy(true);
    try {
      const r = await post(`/api/ai/${kind}`, { id });
      toast(kind === 'explain' ? 'AI đã viết lời giải nháp (ở dưới câu). Đọc kỹ rồi duyệt.' : `AI đã tạo câu nháp #${r.id}. Kiểm tra rồi duyệt.`);
      reload();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const draftAction = async (id: number, action: 'approve' | 'reject', confirmMismatch?: boolean) => {
    if (action === 'approve' && confirmMismatch && !confirm('AI giải ra đáp án khác đáp án đã duyệt. Bạn chắc chắn lời giải này đúng?')) return;
    try {
      await post(`/api/questions/${id}/draft/${action}`, action === 'approve' ? { confirmMismatch: !!confirmMismatch } : {});
      toast(action === 'approve' ? 'Đã duyệt lời giải.' : 'Đã bỏ lời giải nháp.');
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const saveEdit = async () => {
    try {
      await put(`/api/questions/${editing.id}`, { ...editing, reason: editReason, versionNote: editReason || undefined });
      setEditing(null);
      toast('Đã lưu câu hỏi.');
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const create = () => setEditing({ id: null, type: 'mcq', stem: '', options: ['', '', '', ''], answer: null, explanation: '', topic: null, level: 2 });
  const saveNew = async () => {
    try {
      await post('/api/questions', editing);
      setEditing(null);
      toast('Đã thêm câu nháp. Duyệt để dùng trong đề.');
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };

  const list: any[] = data?.questions ?? [];
  const drafts = list.filter((q) => q.status === 'draft');
  return (
    <div className="stack">
      <div className="row between">
        <PageHeading title="Ngân hàng câu hỏi" icon="bank" description={<>
            {data?.counts?.approved ?? 0} câu đã duyệt · {data?.counts?.draft ?? 0} câu nháp
          </>} />
        <div className="row">
          <button className="btn" onClick={create}>
            Thêm câu
          </button>
          <a className="btn primary" href={`#/nhap-de${classSuffix}`}>
            Nhập từ file
          </a>
        </div>
      </div>
      {data?.reviewPolicy === 'double' && <div className="alert info small">Trường đang duyệt hai người: câu nháp cần hai người khác nhau xác nhận. Sửa nội dung sẽ bắt đầu lại lượt duyệt.</div>}
      <div className="card flat">
        <div className="bank-filters">
          <input className="input" style={{ flex: 2, minWidth: 180 }} aria-label="Tìm trong đề bài" placeholder="Tìm trong đề bài…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <select className="input" style={{ flex: 1, minWidth: 130 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Trạng thái">
            <option value="all">Mọi trạng thái</option>
            <option value="draft">Nháp (chờ duyệt)</option>
            <option value="approved">Đã duyệt</option>
          </select>
          <select className="input" style={{ flex: 1, minWidth: 130 }} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="Loại câu">
            <option value="">Mọi loại câu</option>
            {Object.entries(meta.types).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="input" style={{ flex: 2, minWidth: 180 }} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} aria-label="Chuyên đề">
            <option value="">Mọi chuyên đề</option>
            {meta.topics.map((t) => (
              <option key={t.code} value={t.code}>
                Lớp {t.grade}: {t.name}
              </option>
            ))}
          </select>
          <select className="input" style={{ flex: 1, minWidth: 130 }} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} aria-label="Nguồn">
            <option value="">Mọi nguồn</option>
            {Object.entries(meta.sources).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="input" style={{ flex: 1, minWidth: 110 }} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} aria-label="Mức độ">
            <option value="">Mọi mức độ</option>
            {[1, 2, 3].map((l) => (
              <option key={l} value={l}>
                {meta.levels[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(sel.length > 0 || drafts.length > 0) && (
        <div className="row">
          {sel.length > 0 ? (
            <>
              <span className="small strong">Đã chọn {sel.length} câu</span>
              <button className="btn good sm" disabled={busy} onClick={() => approve(sel)}>
                Duyệt
              </button>
              <select className="input sm" value="" disabled={busy} onChange={(e) => bulk('set_topic', e.target.value)} aria-label="Đổi chuyên đề cho các câu đã chọn">
                <option value="">Đổi chuyên đề…</option>
                {meta.topics.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select className="input sm" value="" disabled={busy} onChange={(e) => bulk('set_level', e.target.value)} aria-label="Đổi mức độ cho các câu đã chọn">
                <option value="">Đổi mức độ…</option>
                {[1, 2, 3].map((l) => (
                  <option key={l} value={l}>
                    {meta.levels[l]}
                  </option>
                ))}
              </select>
              <button className="btn danger sm" onClick={() => archive(sel)}>
                Ẩn
              </button>
              <button className="btn ghost sm" onClick={() => setSel([])}>
                Bỏ chọn
              </button>
            </>
          ) : (
            <button className="btn good sm" disabled={busy} onClick={() => approve(drafts.map((q) => q.id))}>
              Duyệt tất cả {drafts.length} câu nháp hợp lệ
            </button>
          )}
        </div>
      )}
      <div className="row small">
        {lastBulk && (
          <button className="btn sm" onClick={undoBulk}>
            Hoàn tác thao tác hàng loạt vừa rồi
          </button>
        )}
        <button className="btn ghost sm" onClick={() => download(`/api/questions/export.xlsx?${qs}`, 'ngan-hang-cau-hoi.xlsx').catch((e) => toast(e.message))}>
          Xuất Excel
        </button>
      </div>
      {!meta.aiEnabled && <div className="tiny muted">AI đang tắt: {meta.aiHint}</div>}
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {!loading && list.length === 0 && <div className="card empty">Không có câu nào khớp bộ lọc.</div>}
      <div className="stack">
        {list.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            selected={sel.includes(q.id)}
            onSelect={() => setSel((s) => (s.includes(q.id) ? s.filter((x) => x !== q.id) : [...s, q.id]))}
            onDraft={(action, confirmMismatch) => draftAction(q.id, action, confirmMismatch)}
            onEdit={() => { setEditing({ ...q }); setEditReason(''); }}
            actions={
              <>
                <button className="btn ghost sm" onClick={() => setDiscussion(q.id)}>Góp ý</button>
                <button className="btn ghost sm" onClick={() => setHistory(q.id)}>Lịch sử</button>
                {q.status === 'draft' && (
                  <button className="btn good sm" disabled={busy || q.problems?.length > 0 || q.approvals?.includes(user.id)} onClick={() => approve([q.id])}>
                    {q.approvals?.length ? 'Duyệt lượt hai' : 'Duyệt'}
                  </button>
                )}
                <button className="btn sm" disabled={busy || !meta.aiEnabled} title={meta.aiEnabled ? 'AI tạo câu cùng dạng (nháp)' : meta.aiHint ?? ''} onClick={() => ai('similar', q.id)}>
                  AI: câu tương tự
                </button>
                <button className="btn sm" disabled={busy || !meta.aiEnabled} title={meta.aiEnabled ? 'AI viết lời giải (nháp)' : meta.aiHint ?? ''} onClick={() => ai('explain', q.id)}>
                  AI: lời giải
                </button>
              </>
            }
          />
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? `Sửa câu #${editing.id}` : 'Thêm câu hỏi'} onClose={() => setEditing(null)}>
          <QuestionEditor q={editing as Draft} onChange={(q) => setEditing({ ...editing, ...q })} />
          {editing.id && <label className="field mt">Lý do sửa / ghi chú phiên bản<input className="input" value={editReason} maxLength={300} onChange={e => setEditReason(e.target.value)} placeholder="Bắt buộc khi đổi đáp án câu đã dùng" /></label>}
          {editing.status === 'approved' && <p className="tiny muted mt">Câu đã duyệt: thay đổi áp dụng cho đề mới. Đề đã tạo giữ bản cũ.</p>}
          <div className="row between mt">
            <button className="btn" onClick={() => setEditing(null)}>
              Hủy
            </button>
            <button className="btn primary" onClick={editing.id ? saveEdit : saveNew}>
              Lưu
            </button>
          </div>
        </Modal>
      )}
      {discussion !== null && <Modal title={`Góp ý câu #${discussion}`} onClose={() => setDiscussion(null)}><Comments kind="question" id={discussion} /></Modal>}
      {history !== null && <Modal title={`Lịch sử câu #${history}`} onClose={() => setHistory(null)}><QuestionHistory id={history} onRestored={() => { setHistory(null); reload(); }} /></Modal>}
    </div>
  );
}
