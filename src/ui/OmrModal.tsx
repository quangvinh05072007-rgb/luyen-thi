import { useState } from 'react';
import { api, post } from '../api';
import { Icon } from './kit';

export type OmrModalProps = {
  exam: any;
  onClose: () => void;
  onGraded?: (res: any) => void;
};

export function OmrModal({ exam, onClose, onGraded }: OmrModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields before finalizing score
  const [studentCode, setStudentCode] = useState('');
  const [variantCode, setVariantCode] = useState('');
  const [partI, setPartI] = useState<any[]>([]);
  const [partII, setPartII] = useState<any[]>([]);
  const [partIII, setPartIII] = useState<any[]>([]);

  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setScanResult(null);
    setGradeResult(null);
    setScanning(true);

    try {
      const buffer = await f.arrayBuffer();
      const res = await api<any>('POST', '/api/omr/scan', undefined, { raw: buffer });
      setScanResult(res);
      setStudentCode(res.studentCode || '');
      setVariantCode(res.examCode || '');
      setPartI(res.partI || []);
      setPartII(res.partII || []);
      setPartIII(res.partIII || []);
    } catch (err: any) {
      setError(err.message || 'Không thể quét phiếu. Vui lòng kiểm tra lại ảnh chụp.');
    } finally {
      setScanning(false);
    }
  };

  const handleGrade = async () => {
    if (!exam?.id) return;
    setGrading(true);
    setError(null);
    try {
      const res = await post<any>('/api/omr/grade', {
        examId: exam.id,
        variantCode: variantCode || undefined,
        studentCode,
        answers: {
          partI,
          partII,
          partIII,
        },
      });
      setGradeResult(res);
      if (onGraded) onGraded(res);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi chấm điểm.');
    } finally {
      setGrading(false);
    }
  };

  const updatePartI = (qIdx: number, selected: number | null) => {
    const next = [...partI];
    next[qIdx] = { ...next[qIdx], selected, label: selected !== null ? 'ABCD'[selected] : null, warning: null };
    setPartI(next);
  };

  const updatePartII = (qIdx: number, subIdx: number, val: boolean | null) => {
    const next = [...partII];
    const sub = [...(next[qIdx]?.selected || [null, null, null, null])];
    sub[subIdx] = val;
    next[qIdx] = { ...next[qIdx], selected: sub };
    setPartII(next);
  };

  const updatePartIII = (qIdx: number, value: string) => {
    const next = [...partIII];
    next[qIdx] = { ...next[qIdx], value: value.trim() || null };
    setPartIII(next);
  };

  const templateHref = `/api/omr/template?examId=${exam?.id ?? ''}`;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 1080, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="row between" style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="scan" /> Chấm phiếu trắc nghiệm trên giấy (OMR)
            </h2>
            <span className="tiny muted">{exam?.title ? `Đề: ${exam.title}` : 'Định dạng tốt nghiệp THPT 2025/2026'}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn sm ghost" href={templateHref} target="_blank" rel="noreferrer" title="Mở phiếu định dạng A4 để in cho học sinh">
              <Icon name="print" /> In phiếu A4 mẫu
            </a>
            <button className="btn sm plain" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div className="callout err mb" style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {!scanResult && (
            <div style={{ textAlign: 'center', padding: '40px 20px', border: '2px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc' }}>
              <div style={{ marginBottom: 12, color: '#3b82f6' }}>
                <Icon name="upload" />
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: 16 }}>Tải lên ảnh chụp phiếu trả lời của học sinh</h3>
              <p className="tiny muted" style={{ maxWidth: 440, margin: '0 auto 16px auto', lineHeight: 1.5 }}>
                Chụp thẳng phiếu thi hoặc dùng máy scan (khổ A4). Hệ thống tự động định vị 4 góc, cân chỉnh góc nhìn, nhận dạng số báo danh, mã đề và các ô tô.
              </p>
              <label className="btn primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="file" /> {scanning ? 'Đang nhận diện phiếu...' : 'Chọn ảnh phiếu (JPG / PNG)'}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={scanning} onChange={handleFileChange} />
              </label>
            </div>
          )}

          {scanResult && (
            <div className="grid-2" style={{ gap: 20, alignItems: 'flex-start' }}>
              
              {/* Left Column: Visual Annotated Image */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
                <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
                  <b className="small">Ảnh quét & Điểm nhận dạng:</b>
                  <label className="btn sm ghost" style={{ cursor: 'pointer', margin: 0 }}>
                    Đổi ảnh khác
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  </label>
                </div>
                {scanResult.annotatedImage ? (
                  <div style={{ maxHeight: 520, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 6, background: '#000', textAlign: 'center' }}>
                    <img src={scanResult.annotatedImage} alt="OMR Annotated" style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
                  </div>
                ) : (
                  <div className="tiny muted" style={{ padding: 20, textAlign: 'center' }}>Không có ảnh trực quan.</div>
                )}
                <div className="tiny muted" style={{ marginTop: 8, display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <span style={{ color: '#16a34a' }}>● Xanh lá: Ô nhận dạng sạch</span>
                  <span style={{ color: '#ea580c' }}>● Cam: Tô mờ</span>
                  <span style={{ color: '#dc2626' }}>● Đỏ: Tô nhiều ô / Bỏ trống</span>
                </div>
              </div>

              {/* Right Column: Reviewed answers & Correction */}
              <div className="stack" style={{ gap: 14 }}>
                <div className="row" style={{ gap: 12, background: '#eff6ff', padding: 10, borderRadius: 8, border: '1px solid #bfdbfe' }}>
                  <div style={{ flex: 1 }}>
                    <label className="tiny" style={{ fontWeight: 600, display: 'block', color: '#1e40af' }}>Số báo danh (SBD)</label>
                    <input className="input sm" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} placeholder="012345" style={{ background: '#fff' }} />
                  </div>
                  <div style={{ width: 110 }}>
                    <label className="tiny" style={{ fontWeight: 600, display: 'block', color: '#1e40af' }}>Mã đề thi</label>
                    <input className="input sm" value={variantCode} onChange={(e) => setVariantCode(e.target.value)} placeholder="101" style={{ background: '#fff' }} />
                  </div>
                </div>

                {/* Anomalies alert banner */}
                {(scanResult.summary?.warnings > 0 || scanResult.summary?.multiple > 0) && (
                  <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                    <b>⚠️ Cảnh báo bài làm:</b> Phát hiện {scanResult.summary.multiple || 0} câu tô nhiều đáp án, {scanResult.summary.warnings || 0} điểm cần kiểm tra. Vui lòng bấm chọn lại đáp án đúng trước khi chốt điểm.
                  </div>
                )}

                {/* Part I: 12 MCQ */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                  <b className="tiny" style={{ textTransform: 'uppercase', color: '#475569' }}>Phần I: 12 Câu trắc nghiệm</b>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, marginTop: 8 }}>
                    {partI.map((item, idx) => (
                      <div key={idx} style={{ padding: 6, borderRadius: 6, background: item.warning === 'multiple' ? '#fef2f2' : item.warning === 'faint' ? '#fffbeb' : '#f8fafc', border: `1px solid ${item.warning ? '#fca5a5' : '#e2e8f0'}` }}>
                        <div className="row between" style={{ marginBottom: 4 }}>
                          <span className="tiny" style={{ fontWeight: 600 }}>Câu {idx + 1}</span>
                          {item.warning && <span className="tiny" style={{ color: '#dc2626', fontWeight: 600 }}>{item.warning === 'multiple' ? 'Trùng' : 'Mờ'}</span>}
                        </div>
                        <div className="row" style={{ gap: 2 }}>
                          {[0, 1, 2, 3].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => updatePartI(idx, item.selected === opt ? null : opt)}
                              style={{
                                flex: 1,
                                padding: '2px 0',
                                fontSize: 11,
                                fontWeight: 'bold',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                background: item.selected === opt ? '#2563eb' : '#fff',
                                color: item.selected === opt ? '#fff' : '#1e293b',
                                cursor: 'pointer',
                              }}
                            >
                              {'ABCD'[opt]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Part II: 4 True/False */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                  <b className="tiny" style={{ textTransform: 'uppercase', color: '#475569' }}>Phần II: Đúng / Sai (4 câu)</b>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    {partII.map((item, qIdx) => (
                      <div key={qIdx} style={{ padding: 6, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <span className="tiny" style={{ fontWeight: 600 }}>Câu {qIdx + 1}:</span>
                        <div className="row" style={{ gap: 6, marginTop: 4 }}>
                          {['a', 'b', 'c', 'd'].map((sub, sIdx) => {
                            const val = item.selected?.[sIdx];
                            return (
                              <div key={sub} style={{ textAlign: 'center', flex: 1 }}>
                                <span className="tiny muted">{sub})</span>
                                <div className="row" style={{ gap: 2, marginTop: 2 }}>
                                  <button
                                    type="button"
                                    onClick={() => updatePartII(qIdx, sIdx, val === true ? null : true)}
                                    style={{
                                      flex: 1,
                                      padding: '2px 0',
                                      fontSize: 10,
                                      fontWeight: 'bold',
                                      borderRadius: 3,
                                      border: '1px solid #cbd5e1',
                                      background: val === true ? '#16a34a' : '#fff',
                                      color: val === true ? '#fff' : '#1e293b',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Đ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updatePartII(qIdx, sIdx, val === false ? null : false)}
                                    style={{
                                      flex: 1,
                                      padding: '2px 0',
                                      fontSize: 10,
                                      fontWeight: 'bold',
                                      borderRadius: 3,
                                      border: '1px solid #cbd5e1',
                                      background: val === false ? '#dc2626' : '#fff',
                                      color: val === false ? '#fff' : '#1e293b',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    S
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Part III: 6 Short */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                  <b className="tiny" style={{ textTransform: 'uppercase', color: '#475569' }}>Phần III: Trả lời ngắn (6 câu)</b>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                    {partIII.map((item, idx) => (
                      <div key={idx} style={{ padding: 4 }}>
                        <span className="tiny muted">Câu {idx + 1}:</span>
                        <input
                          className="input sm"
                          value={item.value ?? ''}
                          onChange={(e) => updatePartIII(idx, e.target.value)}
                          placeholder="—"
                          style={{ marginTop: 2 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Section */}
                <div className="row between" style={{ marginTop: 6, alignItems: 'center' }}>
                  <button
                    className="btn primary big"
                    disabled={grading}
                    onClick={handleGrade}
                    style={{ flex: 1 }}
                  >
                    {grading ? 'Đang chấm điểm…' : '✓ Chấm điểm phiếu này'}
                  </button>
                </div>

                {gradeResult && (
                  <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '2px solid #86efac', marginTop: 10 }}>
                    <div className="row between" style={{ alignItems: 'center' }}>
                      <div>
                        <span className="tiny muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>Điểm thi tốt nghiệp THPT</span>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#15803d' }}>
                          {gradeResult.grade?.score10 ?? '0'} / 10 <span style={{ fontSize: 14, fontWeight: 'normal', color: '#4b5563' }}>({gradeResult.grade?.points ?? 0}/{gradeResult.grade?.max ?? 0}đ)</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge green">SBD: {gradeResult.studentCode || 'Chưa rõ'}</span>
                        {gradeResult.variantCode && <span className="badge blue" style={{ marginLeft: 6 }}>Mã đề: {gradeResult.variantCode}</span>}
                      </div>
                    </div>

                    <div className="row" style={{ gap: 12, marginTop: 8, fontSize: 12, color: '#374151' }}>
                      <span>Phần I: <b>{gradeResult.grade?.byPart?.I?.points ?? 0}/{gradeResult.grade?.byPart?.I?.max ?? 3}</b></span>
                      <span>Phần II: <b>{gradeResult.grade?.byPart?.II?.points ?? 0}/{gradeResult.grade?.byPart?.II?.max ?? 4}</b></span>
                      <span>Phần III: <b>{gradeResult.grade?.byPart?.III?.points ?? 0}/{gradeResult.grade?.byPart?.III?.max ?? 3}</b></span>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
export default OmrModal;
