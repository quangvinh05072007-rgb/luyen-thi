import { useState } from 'react';
import { api, get, post } from '../../api';
import { MathText } from '../../ui/MathText';
import { ErrorBox, go, LevelBadge, Modal, SourceBadge, topicName, useApp, useAsync, useRoute } from '../../ui/kit';

const PRESETS = {
  official: { label: 'Đề tốt nghiệp chuẩn', counts: { mcq: 12, tf: 4, short: 6 }, levels: { 1: 40, 2: 30, 3: 30 }, durationMin: 90 },
  test45: { label: 'Kiểm tra 45 phút', counts: { mcq: 8, tf: 2, short: 3 }, levels: { 1: 40, 2: 40, 3: 20 }, durationMin: 45 },
  quiz15: { label: 'Kiểm tra 15 phút', counts: { mcq: 4, tf: 1, short: 2 }, levels: { 1: 50, 2: 30, 3: 20 }, durationMin: 15 },
};
type Bp = { counts: Record<string, number>; levels: Record<string, number>; durationMin: number; topics: string[] };

export function ExamBuilder() {
  const {query}=useRoute();
  const { meta, toast } = useApp();
  const [preset, setPreset] = useState<keyof typeof PRESETS | 'custom'>('official');
  const [bp, setBp] = useState<Bp>({ ...PRESETS.official, topics: [] });
  const [title, setTitle] = useState('Đề luyện thi tốt nghiệp');
  const [variants, setVariants] = useState(4);
  const [gen, setGen] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [swap, setSwap] = useState<{ idx: number; options: any[] } | null>(null);
  const templates = useAsync(() => get('/api/blueprints'), []);
  const [templateName, setTemplateName] = useState('');
  const [templateShared, setTemplateShared] = useState(false);
  const saveTemplate = async () => {
    setBusy(true);
    try { await post('/api/blueprints', {name: templateName, blueprint:bp, shared:templateShared}); toast('Đã lưu mẫu ma trận.'); setTemplateName(''); templates.reload(); }
    catch(e: any) { toast(e.message); } finally {setBusy(false);}
  };

  const applyPreset = (k: keyof typeof PRESETS) => {
    setPreset(k);
    setBp({ ...PRESETS[k], topics: bp.topics });
  };
  const generate = async () => {
    setBusy(true);
    try {
      const r = await post('/api/exams/generate', { counts: bp.counts, levels: bp.levels, topics: bp.topics });
      setGen(r);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const openSwap = async (idx: number) => {
    const it = gen.items[idx];
    const all = await get(`/api/questions?status=approved&type=${it.type}`);
    const used = new Set(gen.items.map((x: any) => x.qid));
    const options = all.questions.filter((q: any) => !used.has(q.id)).sort((a: any, b: any) => Number(b.topic === it.topic) - Number(a.topic === it.topic) || Number(b.level === it.level) - Number(a.level === it.level));
    setSwap({ idx, options });
  };
  const doSwap = (q: any) => {
    if (!swap) return;
    const items = gen.items.map((x: any, i: number) => (i === swap.idx ? { qid: q.id, type: q.type, topic: q.topic, level: q.level } : x));
    const matrix: any = {};
    for (const it of items) {
      matrix[it.topic] ??= { 1: 0, 2: 0, 3: 0, total: 0 };
      matrix[it.topic][it.level]++;
      matrix[it.topic].total++;
    }
    setGen({ ...gen, items, matrix, questions: { ...gen.questions, [q.id]: q } });
    setSwap(null);
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await post('/api/exams', { title, items: gen.items, durationMin: bp.durationMin, variants, blueprint: bp });
      toast('Đã lưu đề. Giờ giao cho lớp hoặc xuất Word.');
      const cid=query.get('classId');
      go(`/de-thi/${r.id}${cid&&/^\d+$/.test(cid)?`?classId=${cid}`:''}`);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };
  const total = Object.values(bp.counts).reduce((a, b) => a + Number(b), 0);
  const lvTotal = Object.values(bp.levels).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="stack">
      <div>
        <h1>Ra đề</h1>
        <p className="small muted">Chọn cấu trúc, máy lấy câu đã duyệt theo ma trận chuyên đề × mức độ, tránh câu vừa dùng. Bạn xem, đổi từng câu, rồi lưu.</p>
      </div>
      <div className="card stack">
        <details className="template-panel"><summary className="strong">Mẫu ma trận của trường</summary><div className="stack mt">
          {templates.error && <ErrorBox error={templates.error} onRetry={templates.reload} />}
          {templates.data?.blueprints.length === 0 && <p className="small muted">Lưu cấu trúc bên dưới thành mẫu để ra đề nhanh lần sau.</p>}
          {templates.data?.blueprints.map((t: any) => <div className="row between" key={t.id}><div className="grow"><b className="small">{t.name}</b><div className="tiny muted">{t.owner} · {t.shared ? 'Dùng chung' : 'Riêng tư'}</div></div><button className="btn sm" disabled={busy} onClick={() => {setBp({...t.blueprint, durationMin:t.blueprint.durationMin ?? bp.durationMin,topics:t.blueprint.topics ?? []});setPreset('custom');setGen(null);toast('Đã dùng mẫu ma trận.');}}>Dùng mẫu</button>{t.mine && <button className="btn ghost sm" disabled={busy} onClick={async () => {if(!confirm(`Xóa mẫu “${t.name}”?`))return;setBusy(true);try {await api('DELETE',`/api/blueprints/${t.id}`);templates.reload();}catch(e:any){toast(e.message);}finally{setBusy(false);}}}>Xóa</button>}</div>)}
          <label className="field">Tên mẫu mới<input className="input" value={templateName} maxLength={100} onChange={e => setTemplateName(e.target.value)} placeholder="Ví dụ: Giữa kỳ 12 — 45 phút" /></label>
          <label className="check"><input type="checkbox" checked={templateShared} onChange={e => setTemplateShared(e.target.checked)} />Cho giáo viên trong trường dùng mẫu</label><div><button className="btn" disabled={busy || !templateName.trim()} onClick={saveTemplate}>Lưu cấu trúc hiện tại thành mẫu</button></div>
        </div></details>
        <div className="seg">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
            <button key={k} className={preset === k ? 'on' : ''} onClick={() => applyPreset(k)}>
              {PRESETS[k].label}
            </button>
          ))}
          <button className={preset === 'custom' ? 'on' : ''} onClick={() => setPreset('custom')}>
            Tùy chỉnh
          </button>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Tên đề</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>Thời gian (phút)</label>
              <input className="input" type="number" min={5} value={bp.durationMin} onChange={(e) => setBp({ ...bp, durationMin: Number(e.target.value) })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Số mã đề</label>
              <input className="input" type="number" min={1} max={8} value={variants} onChange={(e) => setVariants(Number(e.target.value))} />
            </div>
          </div>
        </div>
        {preset === 'custom' && (
          <div className="grid-2">
            <div className="row">
              {(['mcq', 'tf', 'short'] as const).map((t) => (
                <div key={t} className="field" style={{ flex: 1 }}>
                  <label>{meta.types[t]}</label>
                  <input className="input" type="number" min={0} max={40} value={bp.counts[t]} onChange={(e) => setBp({ ...bp, counts: { ...bp.counts, [t]: Number(e.target.value) } })} />
                </div>
              ))}
            </div>
            <div className="row">
              {[1, 2, 3].map((l) => (
                <div key={l} className="field" style={{ flex: 1 }}>
                  <label>% {meta.levels[l]}</label>
                  <input className="input" type="number" min={0} max={100} value={bp.levels[l]} onChange={(e) => setBp({ ...bp, levels: { ...bp.levels, [l]: Number(e.target.value) } })} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="small muted">
          {bp.counts.mcq} trắc nghiệm · {bp.counts.tf} đúng/sai · {bp.counts.short} trả lời ngắn ({total} câu) · mức độ {bp.levels[1]}/{bp.levels[2]}/{bp.levels[3]}
          {lvTotal !== 100 && <span style={{ color: 'var(--warn)' }}> — tổng tỉ lệ đang là {lvTotal}%, máy sẽ chia theo tỉ lệ tương đối</span>}
        </div>
        <details>
          <summary className="strong small" style={{ cursor: 'pointer' }}>
            Chuyên đề ({bp.topics.length ? `${bp.topics.length} đã chọn` : 'tất cả'})
          </summary>
          <div className="grid-2 mt" style={{ gap: 4 }}>
            {meta.topics.map((t) => (
              <label key={t.code} className="check small">
                <input type="checkbox" checked={bp.topics.includes(t.code)} onChange={() => setBp({ ...bp, topics: bp.topics.includes(t.code) ? bp.topics.filter((x) => x !== t.code) : [...bp.topics, t.code] })} />
                Lớp {t.grade}: {t.name}
              </label>
            ))}
          </div>
        </details>
        <div>
          <button className="btn primary big" disabled={busy || total === 0} onClick={generate}>
            {busy ? 'Đang sinh đề…' : gen ? 'Sinh lại' : 'Sinh đề'}
          </button>
        </div>
      </div>

      {gen && (
        <>
          {gen.shortages.map((s: any, i: number) => (
            <div key={i} className="alert error small">
              {s.message}
            </div>
          ))}
          {gen.warnings.map((w: string, i: number) => (
            <div key={i} className="alert warn small">
              {w}
            </div>
          ))}
          <div className="card">
            <h2>Ma trận đề</h2>
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>Chuyên đề</th>
                    {[1, 2, 3].map((l) => (
                      <th key={l} className="center">
                        {meta.levels[l]}
                      </th>
                    ))}
                    <th className="center">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(gen.matrix).map(([t, m]: any) => (
                    <tr key={t}>
                      <td>{topicName(meta, t)}</td>
                      {[1, 2, 3].map((l) => (
                        <td key={l} className="center">
                          {m[l] || ''}
                        </td>
                      ))}
                      <td className="center strong">{m.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Câu hỏi ({gen.items.length})</h2>
              <button className="btn primary" disabled={busy || !gen.items.length || !title.trim()} onClick={save}>
                Lưu đề
              </button>
            </div>
            {(['mcq', 'tf', 'short'] as const).map((type) => {
              const list = gen.items.map((it: any, idx: number) => ({ it, idx })).filter(({ it }: any) => it.type === type);
              if (!list.length) return null;
              return (
                <div key={type} className="mb">
                  <h3>{{ mcq: 'Phần I — Trắc nghiệm', tf: 'Phần II — Đúng/Sai', short: 'Phần III — Trả lời ngắn' }[type]}</h3>
                  {list.map(({ it, idx }: any, n: number) => {
                    const q = gen.questions[it.qid];
                    return (
                      <div key={it.qid} className="list-item" style={{ alignItems: 'flex-start' }}>
                        <b className="small">{n + 1}.</b>
                        <div className="grow">
                          <MathText as="div" className="small" text={q.stem} />
                          <div className="row tiny mt" style={{ gap: 6 }}>
                            <LevelBadge level={q.level} />
                            <span className="muted">{topicName(meta, q.topic)}</span>
                            <SourceBadge source={q.source} />
                          </div>
                        </div>
                        <button className="btn sm" onClick={() => openSwap(idx)}>
                          Đổi
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
      {swap && (
        <Modal title="Chọn câu thay thế" onClose={() => setSwap(null)}>
          <p className="small muted">Xếp ưu tiên cùng chuyên đề, cùng mức độ. Chỉ hiện câu đã duyệt chưa có trong đề.</p>
          {swap.options.length === 0 && <div className="empty">Không còn câu cùng loại. Nhập thêm câu vào ngân hàng.</div>}
          {swap.options.slice(0, 40).map((q) => (
            <div key={q.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <MathText as="div" className="small" text={q.stem} />
                <div className="row tiny" style={{ gap: 6 }}>
                  <LevelBadge level={q.level} />
                  <span className="muted">{topicName(meta, q.topic)}</span>
                </div>
              </div>
              <button className="btn sm primary" onClick={() => doSwap(q)}>
                Chọn
              </button>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
