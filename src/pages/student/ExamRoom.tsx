// Phòng thi / luyện tập. Đáng tin cậy: lưu ngay vào máy (localStorage) mỗi lần chọn, đồng bộ lên máy chủ khi có mạng,
// đồng hồ theo giờ máy chủ, nộp bài thử lại tới khi thành công; hết giờ máy chủ tự chốt bằng bản lưu cuối.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, get, post } from '../../api';
import { ErrorBox, go, Loading, Modal, useApp, Mascot } from '../../ui/kit';
import { isAnswered, Item, QuestionView, Review } from '../../ui/Question';

type Attempt = {
  id: number;
  kind: 'assignment' | 'practice';
  title: string;
  status: string;
  deadlineAt: number | null;
  serverNow: number;
  version: number;
  responses: Record<string, any>;
  times: Record<string, number>;
  checked: Record<string, any>;
  items: Item[];
};

function clientId() {
  try {
    let id = localStorage.getItem('se-client');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('se-client', id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}
const LS = (id: number) => `se-attempt-${id}`;
function readLocal(id: number) {
  try {
    return JSON.parse(localStorage.getItem(LS(id)) ?? 'null');
  } catch {
    return null;
  }
}
function writeLocal(id: number, v: unknown) {
  try {
    localStorage.setItem(LS(id), JSON.stringify(v));
  } catch {
    /* bộ nhớ đầy: vẫn còn bản trên máy chủ */
  }
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function ExamRoom({ attemptId }: { attemptId: number }) {
  const { toast } = useApp();
  const [att, setAtt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cur, setCur] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checks, setChecks] = useState<Record<string, Review & { points?: number }>>({});
  const [checking, setChecking] = useState(false);

  const offset = useRef(0); // giờ máy chủ - giờ máy
  const version = useRef(0);
  const serverVersion = useRef(0);
  const times = useRef<Record<string, number>>({});
  const events = useRef<{ type: string; at: number }[]>([]);
  const enterAt = useRef(Date.now());
  const saveTimer = useRef<number | null>(null);
  const finished = useRef(false);
  const respRef = useRef<Record<string, any>>({});
  const cid = useMemo(clientId, []);

  // ---- tải bài ----
  useEffect(() => {
    get<Attempt>(`/api/attempts/${attemptId}`)
      .then((a) => {
        if (a.status !== 'in_progress') {
          finished.current = true;
          go(`/ket-qua/${a.id}`);
          return;
        }
        offset.current = a.serverNow - Date.now();
        const local = readLocal(a.id);
        let resp = a.responses ?? {};
        version.current = a.version;
        serverVersion.current = a.version;
        times.current = { ...(a.times ?? {}) };
        if (local && local.version > a.version) {
          resp = local.responses;
          version.current = local.version;
          times.current = local.times ?? times.current;
          setSaveState('offline');
        }
        setResponses(resp);
        respRef.current = resp;
        setFlags(local?.flags ?? {});
        const ch: Record<string, Review> = {};
        for (const [qid, c] of Object.entries(a.checked ?? {})) ch[qid] = { ...(c as any) };
        setChecks(ch);
        setAtt(a);
      })
      .catch((e) => setError(e.message));
  }, [attemptId]);

  // ---- đồng bộ ----
  const flush = useCallback(async () => {
    if (!att || finished.current) return;
    if (version.current <= serverVersion.current && !events.current.length) return;
    setSaveState('saving');
    const sending = events.current.splice(0);
    const v = version.current;
    try {
      const r = await api('PUT', `/api/attempts/${att.id}/save`, { responses: respRef.current, times: times.current, version: v, events: sending, clientId: cid }, { timeoutMs: 15000 });
      offset.current = r.serverNow - Date.now();
      if (r.closed) {
        finished.current = true;
        toast(r.late ? 'Đã hết giờ. Bài được chốt bằng bản lưu đúng hạn; phần làm khi mất mạng được gửi để giáo viên xem xét.' : 'Đã hết giờ. Bài được chốt bằng bản lưu cuối.');
        go(`/ket-qua/${att.id}`);
        return;
      }
      serverVersion.current = Math.max(serverVersion.current, r.version);
      setSaveState(version.current > serverVersion.current ? 'saving' : 'saved');
      setSavedAt(Date.now());
    } catch {
      events.current.unshift(...sending);
      setSaveState('offline');
    }
  }, [att, cid, responses, toast]);

  const scheduleSave = useCallback(
    (delay = 1200) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flush, delay);
    },
    [flush],
  );

  // thử lại khi mất mạng; gửi ngay khi có mạng
  useEffect(() => {
    if (!att) return;
    const retry = window.setInterval(() => {
      if (version.current > serverVersion.current || events.current.length) flush();
    }, 8000);
    const online = () => {
      events.current.push({ type: 'online', at: Date.now() + offset.current });
      flush();
    };
    const offline = () => {
      events.current.push({ type: 'offline', at: Date.now() + offset.current });
      setSaveState('offline');
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      clearInterval(retry);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [att, flush]);

  // tín hiệu chống gian lận (chỉ bài thi): rời tab, dán chữ
  useEffect(() => {
    if (!att || att.kind !== 'assignment') return;
    const vis = () => {
      if (document.visibilityState === 'hidden') {
        events.current.push({ type: 'hidden', at: Date.now() + offset.current });
        flush();
      }
    };
    const paste = () => events.current.push({ type: 'paste', at: Date.now() + offset.current });
    document.addEventListener('visibilitychange', vis);
    document.addEventListener('paste', paste);
    const before = (e: BeforeUnloadEvent) => {
      if (version.current > serverVersion.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', before);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      document.removeEventListener('paste', paste);
      window.removeEventListener('beforeunload', before);
    };
  }, [att, flush]);

  // đồng hồ
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // thời gian làm từng câu
  const trackTime = useCallback(() => {
    if (!att) return;
    const it = att.items[cur];
    if (!it) return;
    const sec = (Date.now() - enterAt.current) / 1000;
    if (sec > 0 && sec < 3600) times.current[it.qid] = Math.round((times.current[it.qid] ?? 0) + sec);
    enterAt.current = Date.now();
  }, [att, cur]);

  const goTo = (i: number) => {
    trackTime();
    setCur(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setAnswer = (qid: number, v: any) => {
    if (!att) return;
    trackTime();
    const next = { ...respRef.current, [qid]: v };
    respRef.current = next;
    setResponses(next);
    version.current += 1;
    writeLocal(att.id, { responses: next, times: times.current, version: version.current, flags });
    setSaveState('saving');
    scheduleSave();
  };

  const toggleFlag = (qid: number) => {
    const f = { ...flags, [qid]: !flags[qid] };
    setFlags(f);
    if (att) writeLocal(att.id, { ...(readLocal(att.id) ?? { responses, version: version.current }), flags: f });
  };

  const submit = useCallback(
    async (auto = false) => {
      if (!att || finished.current) return;
      trackTime();
      setSubmitting(true);
      const body = { responses: respRef.current, times: times.current, version: Math.max(version.current, serverVersion.current + 1), events: events.current.splice(0), clientId: cid };
      const url = att.kind === 'practice' ? `/api/practice/${att.id}/finish` : `/api/attempts/${att.id}/submit`;
      for (let i = 0; i < 6; i++) {
        try {
          await post(url, body);
          finished.current = true;
          try {
            localStorage.removeItem(LS(att.id));
          } catch {
            /* bỏ qua */
          }
          go(`/ket-qua/${att.id}`);
          return;
        } catch (e: any) {
          if (e.status && e.status !== 0 && e.status < 500) {
            setError(e.message);
            break;
          }
          setSaveState('offline');
          toast(auto ? 'Hết giờ — đang nộp bài, chờ có mạng…' : 'Mất mạng — đang thử nộp lại. Bài làm vẫn lưu trên máy.');
          await new Promise((r) => setTimeout(r, 3000 + i * 2000));
        }
      }
      setSubmitting(false);
    },
    [att, cid, responses, toast, trackTime],
  );

  const remaining = att?.deadlineAt ? att.deadlineAt - (now + offset.current) : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && att?.kind === 'assignment' && !finished.current && !submitting) submit(true);
  }, [remaining, att, submit, submitting]);

  const check = async () => {
    if (!att) return;
    const it = att.items[cur];
    trackTime();
    setChecking(true);
    try {
      const r = await post(`/api/practice/${att.id}/check`, { qid: it.qid, response: responses[it.qid], seconds: times.current[it.qid] });
      setChecks((c) => ({ ...c, [it.qid]: { correctAnswer: r.correctAnswer, explanation: r.explanation, source: r.source, grade: { points: r.points, max: r.max, correct: r.correct, parts: r.parts }, diagnosis: r.diagnosis } }));
    } catch (e: any) {
      toast(e.message);
    } finally {
      setChecking(false);
    }
  };

  if (error) return <ErrorBox error={error} />;
  if (!att) return <Loading text="Đang mở bài…" />;
  const it = att.items[cur];
  const answered = att.items.filter((x) => isAnswered(x.type, responses[x.qid])).length;
  const isPractice = att.kind === 'practice';
  const checkInfo = checks[it.qid];
  const review: Review | null = checkInfo ? { ...checkInfo } : null;
  const unanswered = att.items.length - answered;

  return (
    <div>
      <div className="exam-top">
        <button className="btn ghost sm" onClick={() => go('/')} aria-label="Thoát">
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.title}</div>
          <div className="tiny muted">
            Đã làm {answered}/{att.items.length}
          </div>
        </div>
        <span className={`save-chip ${saveState === 'offline' ? 'off' : saveState === 'saving' ? 'busy' : ''}`} role="status">
          {saveState === 'offline' ? 'Mất mạng · đã lưu trên máy' : saveState === 'saving' ? 'Đang lưu…' : savedAt ? `Đã lưu ${new Date(savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Đã lưu'}
        </span>
        {remaining !== null && !isPractice && <span className={`timer ${remaining < 5 * 60000 ? 'low' : ''}`}>{fmtClock(remaining)}</span>}
      </div>

      <div className="exam-layout">
        <div className="card">
          <QuestionView item={it} response={responses[it.qid]} onChange={review ? undefined : (v) => setAnswer(it.qid, v)} review={review} />
          <div className="hr" />
          <div className="row between">
            <button className="btn" disabled={cur === 0} onClick={() => goTo(cur - 1)}>
              ← Câu trước
            </button>
            {!isPractice && (
              <button className="btn ghost sm" onClick={() => toggleFlag(it.qid)}>
                {flags[it.qid] ? '★ Bỏ đánh dấu' : '☆ Xem lại sau'}
              </button>
            )}
            {isPractice && !review ? (
              <button className="btn primary" disabled={!isAnswered(it.type, responses[it.qid]) || checking} onClick={check}>
                {checking ? 'Đang chấm…' : 'Kiểm tra'}
              </button>
            ) : cur < att.items.length - 1 ? (
              <button className="btn primary" onClick={() => goTo(cur + 1)}>
                Câu tiếp →
              </button>
            ) : (
              <button className="btn primary" onClick={() => setConfirm(true)}>
                {isPractice ? 'Kết thúc' : 'Nộp bài'}
              </button>
            )}
          </div>
        </div>
        <div className="exam-side card">
          <h3>Danh sách câu</h3>
          {(['mcq', 'tf', 'short'] as const).map((type) => {
            const list = att.items.map((x, i) => ({ x, i })).filter(({ x }) => x.type === type);
            if (!list.length) return null;
            return (
              <div key={type} className="mb">
                <div className="tiny muted mb">{{ mcq: 'Phần I', tf: 'Phần II', short: 'Phần III' }[type]}</div>
                <div className="palette">
                  {list.map(({ x, i }) => {
                    const c = checks[x.qid];
                    const st = c ? (c.grade?.correct ? 'right' : (c.grade?.points ?? 0) > 0 ? 'half' : 'wrong') : isAnswered(x.type, responses[x.qid]) ? 'done' : '';
                    return (
                      <button key={x.qid} className={`${st} ${i === cur ? 'cur' : ''} ${flags[x.qid] ? 'flag' : ''}`} onClick={() => goTo(i)} aria-label={`Câu ${x.no}`}>
                        {x.no}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button className="btn primary block mt" onClick={() => setConfirm(true)} disabled={submitting}>
            {isPractice ? 'Kết thúc luyện tập' : 'Nộp bài'}
          </button>
          {!isPractice && <p className="tiny muted mt">Bài tự lưu sau mỗi lần chọn. Mất mạng vẫn làm tiếp được; có mạng lại sẽ tự gửi. Hết giờ, máy chủ tự nộp bản lưu cuối.</p>}
        </div>
      </div>

      {confirm && (
        <Modal title={isPractice ? 'Kết thúc luyện tập?' : 'Nộp bài?'} onClose={() => setConfirm(false)}>
          <div className="hero mb">
            <Mascot size={64} mood="think" />
            <div>
              {unanswered > 0 ? (
                <p>
                  Em còn <b>{unanswered}</b> câu chưa làm. {isPractice ? 'Câu chưa làm sẽ không tính.' : 'Câu bỏ trống được 0 điểm.'}
                </p>
              ) : (
                <p>Em đã làm hết {att.items.length} câu.</p>
              )}
              {Object.values(flags).some(Boolean) && <p className="small muted">Có câu em đánh dấu xem lại.</p>}
            </div>
          </div>
          <div className="row between">
            <button className="btn" onClick={() => setConfirm(false)}>
              Làm tiếp
            </button>
            <button className="btn primary" disabled={submitting} onClick={() => submit(false)}>
              {submitting ? 'Đang nộp…' : isPractice ? 'Kết thúc' : 'Nộp bài'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
