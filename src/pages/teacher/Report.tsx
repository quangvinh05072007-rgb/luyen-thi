import { useState } from 'react';
import { download, get, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { AssignmentExtension, AttemptActions } from '../../ui/StaffActions';
import { Icon, Bar, ErrorBox, ErrorTypeBadge, fmtDateTime, fmtScore, Loading, pct, scoreColor, topicName, useApp, useAsync } from '../../ui/kit';

export function Assignments({ classId, results = true }: { classId?: number; results?: boolean }) {
  const { data, error, loading, reload } = useAsync(() => get(`/api/assignments${classId ? `?classId=${classId}` : ''}`), [classId]);
  const now = Date.now();
  return (
    <div className="stack">
      <div className="row between">
        <h2>{results ? 'Điểm các bài đã giao' : 'Bài đã giao cho lớp'}</h2>
        <a className="btn primary" href={classId ? `#/thu-vien?classId=${classId}` : '#/thu-vien'}>
          Giao đề
        </a>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && data.assignments.length === 0 && <div className="card empty">Chưa giao bài nào. Vào Đề thi để giao.</div>}
      {data && data.assignments.length > 0 && (
        <div className="card table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Bài</th>
                <th>Lớp</th>
                <th>Trạng thái</th>
                <th>Đã nộp</th>
                {results && <th className="right">TB</th>}
              </tr>
            </thead>
            <tbody>
              {data.assignments.map((a: any) => (
                <tr key={a.id} className="click" onClick={() => (location.hash = classId ? `/lop/${classId}/ket-qua/${a.id}` : `/lop/${a.class_id}/ket-qua/${a.id}`)}>
                  <td>
                    <a href={`#/lop/${classId ?? a.class_id}/ket-qua/${a.id}`}>{a.title}</a>
                    <div className="tiny muted">{a.mode === 'exam' ? `Thi ${a.duration_min} phút` : 'Bài tập'}</div>
                  </td>
                  <td>{a.class_name}</td>
                  <td className="small">{now < a.open_at ? `Mở ${fmtDateTime(a.open_at)}` : now > a.close_at ? 'Đã đóng' : `Đang mở · đóng ${fmtDateTime(a.close_at)}`}</td>
                  <td>
                    {a.submitted}/{a.students}
                    {a.doing ? <span className="tiny muted"> · {a.doing} đang làm</span> : null}
                  </td>
                  {results && <td className="right strong" style={{ color: scoreColor(a.avg) }}>
                    {fmtScore(a.avg)}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const STATUS: Record<string, string> = { not_started: 'Chưa làm', in_progress: 'Đang làm', submitted: 'Đã nộp', auto_submitted: 'Tự nộp khi hết giờ' };

export function Report({ id, classId }: { id: number; classId?: number }) {
  const { meta, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get(`/api/assignments/${id}/report`), [id]);
  const [tab, setTab] = useState<'students' | 'items' | 'topics'>('students');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (classId && data.assignment.classId !== classId) return <ErrorBox error="Bài này không thuộc lớp đang mở. Hãy chọn bài trong danh sách của lớp." />;
  const s = data.summary;
  const maxH = Math.max(1, ...s.hist);
  const errTotal = Object.values(data.errorCount as Record<string, number>).reduce((a, b) => a + b, 0);
  const acceptLate = async (attemptId: number) => {
    if (!confirm('Chấp nhận phần bài làm gửi muộn (do mất mạng) và chấm lại?')) return;
    try {
      await post(`/api/attempts/${attemptId}/accept-late`);
      toast('Đã chấm lại theo bản gửi muộn.');
      reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const flagged = data.items.filter((i: any) => i.flags.length);
  return (
    <div className="stack">
      <div>
        <a className="small" href={`#/lop/${data.assignment.classId}/ket-qua`}>Về kết quả lớp {data.assignment.className}</a>
        <h2>{data.assignment.title}</h2>
        <div className="small muted">
          Lớp {data.assignment.className} · {data.assignment.mode === 'exam' ? `thi ${data.assignment.durationMin} phút` : 'bài tập'} · đóng {fmtDateTime(data.assignment.closeAt)}
        </div>
        <div className="row mt">
          <AssignmentExtension id={id} onDone={reload} />
          <button className="btn sm" onClick={() => download(`/api/assignments/${id}/export.xlsx`, `diem-bai-giao-${id}.xlsx`).catch((e) => toast(e.message))}>
            Xuất bảng điểm Excel
          </button>
          <button className="btn ghost sm" onClick={() => download(`/api/assignments/${id}/export.csv`, `diem-bai-giao-${id}.csv`).catch((e) => toast(e.message))}>
            CSV
          </button>
        </div>
      </div>
      <div className="stat-widget-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="stat-widget">
          <div className="stat-widget-icon blue">
            <Icon name="chart" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num" style={{ color: scoreColor(s.avg) }}>{fmtScore(s.avg)}</span>
            <span className="stat-widget-label">Điểm trung bình</span>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon green">
            <Icon name="exam" />
          </div>
          <div className="stat-widget-info">
            <span className="stat-widget-num">{s.submitted}/{s.students}</span>
            <span className="stat-widget-label">Đã nộp{s.doing ? ` · ${s.doing} đang làm` : ''}</span>
          </div>
        </div>
        <div className="widget-card" style={{ padding: 14 }}>
          <div className="widget-title" style={{ fontSize: 13, marginBottom: 8 }}>Phổ điểm</div>
          <div className="hist">
            {s.hist.map((n: number, i: number) => (
              <div key={i} style={{ height: `${(n / maxH) * 100}%`, background: i < 5 ? 'var(--bad)' : i < 7 ? 'var(--accent)' : 'var(--good)' }} title={`${i} điểm: ${n} em`} />
            ))}
          </div>
          <div className="hist-labels">
            {s.hist.map((_: number, i: number) => (
              <span key={i}>{i}</span>
            ))}
          </div>
        </div>
        <div className="widget-card" style={{ padding: 14 }}>
          <div className="widget-title" style={{ fontSize: 13, marginBottom: 8 }}>Kiểu lỗi phổ biến</div>
          {Object.entries(data.errorCount as Record<string, number>)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, n]) => (
              <div key={k} className="row between tiny" style={{ marginBottom: 4 }}>
                <ErrorTypeBadge type={k} />
                <span>{errTotal ? pct(n / errTotal) : '—'}</span>
              </div>
            ))}
        </div>
      </div>
      {flagged.length > 0 && (
        <div className="alert warn small">
          {flagged.length} câu có dấu hiệu bất thường (quá khó, quá dễ hoặc nghi sai đáp án). Xem thẻ "Phân tích câu hỏi".
        </div>
      )}
      <div className="seg">
        <button className={tab === 'students' ? 'on' : ''} onClick={() => setTab('students')}>
          Học sinh
        </button>
        <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>
          Phân tích câu hỏi
        </button>
        <button className={tab === 'topics' ? 'on' : ''} onClick={() => setTab('topics')}>
          Chuyên đề
        </button>
      </div>
      {tab === 'students' && (
        <div className="card table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Học sinh</th>
                <th>Trạng thái</th>
                <th className="right">Điểm</th>
                <th>I / II / III</th>
                <th>Lỗi chính</th>
                <th>Tín hiệu</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: any) => {
                const sig = [r.signals.hidden && `rời tab ${r.signals.hidden}`, r.signals.secondDevice && 'máy khác', r.signals.paste && `dán ${r.signals.paste}`, r.signals.offline && `mất mạng ${r.signals.offline}`].filter(Boolean);
                return (
                  <tr key={r.studentId} className={r.attemptId && r.score10 !== null ? 'click' : ''} onClick={() => r.attemptId && r.score10 !== null && (location.hash = `/bai-lam/${r.attemptId}`)}>
                    <td>
                      <a href={`#/hoc-sinh/${r.studentId}`} onClick={(e) => e.stopPropagation()}>
                        {r.name}
                      </a>
                    </td>
                    <td className="small">{STATUS[r.status]}</td>
                    <td className="right strong" style={{ color: scoreColor(r.score10) }}>
                      {fmtScore(r.score10)}
                    </td>
                    <td className="small muted">{r.byPart ? `${fmtScore(r.byPart.I.points)} / ${fmtScore(r.byPart.II.points)} / ${fmtScore(r.byPart.III.points)}` : ''}</td>
                    <td>{r.dominantError && <ErrorTypeBadge type={r.dominantError} />}</td>
                    <td className="tiny">
                      {sig.length ? <span className="badge amber">{sig.join(' · ')}</span> : <span className="muted">—</span>}
                      {r.late && !r.late.accepted && (
                        <button
                          className="btn sm"
                          style={{ marginLeft: 6 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptLate(r.attemptId);
                          }}
                        >
                          Nhận bản gửi muộn
                        </button>
                      )}
                      {r.late?.accepted && <span className="badge">Đã nhận bản muộn</span>}
                    </td>
                    <td>{r.attemptId && <AttemptActions attemptId={r.attemptId} status={r.status} onDone={reload} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="tiny muted mt">Tín hiệu (rời tab, mở trên máy khác, dán chữ, mất mạng) chỉ để giáo viên xem xét, không tự kết luận gian lận. Bấm một dòng để xem bài làm.</p>
        </div>
      )}
      {tab === 'items' && (
        <div className="stack">
          {data.items.map((it: any, i: number) => (
            <div key={it.qid} className="card flat">
              <div className="row mb" style={{ gap: 6 }}>
                <b>Câu {i + 1}</b>
                <span className="tiny muted">{topicName(meta, it.topic)}</span>
                <span style={{ flex: 1 }} />
                <span className="small">
                  Tỉ lệ điểm <b>{pct(it.p)}</b>
                </span>
                <span className="small" title="Độ phân biệt: nhóm 27% điểm cao trừ nhóm 27% điểm thấp. Trên 0,3 là tốt.">
                  Phân biệt <b>{it.disc === null ? '—' : it.disc.toFixed(2)}</b>
                </span>
              </div>
              <MathText as="div" className="small" text={it.stem} />
              {it.choices && (
                <div className="grid-4 mt" style={{ gap: 6 }}>
                  {it.options.map((o: string, k: number) => {
                    const n = it.choices[k];
                    const tot = it.choices.reduce((a: number, b: number) => a + b, 0) || 1;
                    return (
                      <div key={k} className="small">
                        <div className="row between">
                          <span style={{ color: k === it.answer ? 'var(--good)' : undefined, fontWeight: k === it.answer ? 700 : 400 }}>
                            {'ABCD'[k]}. <MathText text={o} />
                          </span>
                          <span className="muted">{n}</span>
                        </div>
                        <Bar value={n / tot} color={k === it.answer ? 'var(--good)' : 'var(--ink-3)'} />
                      </div>
                    );
                  })}
                </div>
              )}
              {it.choices && <div className="tiny muted mt">Phương án theo đề gốc (trước khi đảo). Bỏ trống: {it.choices[4]}.</div>}
              {it.flags.map((f: string, k: number) => (
                <div key={k} className="alert warn small mt">
                  {f}
                </div>
              ))}
              {it.type === 'mcq' && it.flags.length > 0 && (
                <button
                  className="btn sm mt"
                  onClick={async () => {
                    const letter = prompt('Đáp án ĐÚNG của câu này theo đề gốc là phương án nào? (A, B, C hoặc D)\nHệ thống sẽ sửa đáp án trong đề và chấm lại mọi bài đã nộp.');
                    const idx = 'ABCD'.indexOf(String(letter ?? '').trim().toUpperCase());
                    if (idx < 0) return;
                    const reason = prompt('Lý do sửa đáp án (bắt buộc, được ghi vào nhật ký):');
                    if (!reason) return;
                    try {
                      const r = await post(`/api/exams/${data.assignment.examId}/fix-answer`, { qid: it.qid, answer: idx, reason });
                      toast(`Đã chấm lại ${r.regraded} bài, ${r.changed} bài đổi điểm.`);
                      reload();
                    } catch (e: any) {
                      toast(e.message);
                    }
                  }}
                >
                  Sửa đáp án đề và chấm lại
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === 'topics' && (
        <div className="card">
          <h2>Cả lớp theo chuyên đề</h2>
          {data.topics.map((t: any) => (
            <div key={t.topic} className="mb">
              <div className="row between small">
                <span>{t.name}</span>
                <b>{pct(t.ratio)}</b>
              </div>
              <Bar value={t.ratio} />
            </div>
          ))}
          {data.topics.filter((t: any) => t.ratio < 0.5).length > 0 && (
            <div className="alert info small mt">
              Nên dạy lại: {data.topics.filter((t: any) => t.ratio < 0.5).map((t: any) => t.name).join('; ')}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
