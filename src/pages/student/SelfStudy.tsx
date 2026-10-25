import { useState } from 'react';
import { get, post } from '../../api';
import { Bar, ErrorBox, go, Loading, useApp, useAsync } from '../../ui/kit';

const SUBJECTS = [
  { id: 'math', name: 'Toán học', icon: '📐', dept: 'Toán' },
  { id: 'physics', name: 'Vật lí', icon: '⚡', dept: 'Vật lí' },
  { id: 'chemistry', name: 'Hóa học', icon: '🧪', dept: 'Hóa học' },
  { id: 'biology', name: 'Sinh học', icon: '🧬', dept: 'Sinh học' },
  { id: 'english', name: 'Tiếng Anh', icon: '🇬🇧', dept: 'Tiếng Anh' },
  { id: 'history', name: 'Lịch sử', icon: '🏛️', dept: 'Lịch sử' },
];

export function SelfStudy() {
  const { meta, user, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get<any>('/api/student/home'), []);
  const [selectedSubject, setSelectedSubject] = useState('math');
  const [selectedGrade, setSelectedGrade] = useState<number>(user.class?.grade ?? 12);
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading text="Đang tải dữ liệu tự học…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const mastery = Object.fromEntries((data?.mastery ?? []).map((m: any) => [m.topic, m]));

  // Filter topics from curriculum by grade
  const mathTopics = (meta?.topics ?? []).filter((t: any) => t.grade === selectedGrade);

  // Fallback / specialty topics for other subjects
  const otherTopicsBySubject: Record<string, { code: string; grade: number; name: string }[]> = {
    physics: [
      { code: 'LY12.KHI', grade: 12, name: 'Vật lí nhiệt và Khí lí tưởng' },
      { code: 'LY12.TU', grade: 12, name: 'Từ trường và Cảm ứng điện từ' },
      { code: 'LY12.HATNHAN', grade: 12, name: 'Vật lí hạt nhân và Năng lượng' },
      { code: 'LY11.DAODONG', grade: 11, name: 'Dao động điều hòa và Sóng cơ' },
      { code: 'LY11.DIENTRUONG', grade: 11, name: 'Điện trường và Dòng điện không đổi' },
      { code: 'LY10.DONGHOC', grade: 10, name: 'Động học và Động lực học chất điểm' },
      { code: 'LY10.NANGLUONG', grade: 10, name: 'Năng lượng, Công và Công suất' },
    ],
    chemistry: [
      { code: 'HOA12.ESTER', grade: 12, name: 'Este – Lipit và Chất giặt rửa' },
      { code: 'HOA12.CARBO', grade: 12, name: 'Cacbohiđrat (Glucose, Saccarozo, Tinh bột)' },
      { code: 'HOA12.AMIN', grade: 12, name: 'Amin, Amino Axit và Protein' },
      { code: 'HOA12.PIN', grade: 12, name: 'Pin điện và Điện phân' },
      { code: 'HOA11.CANDANG', grade: 11, name: 'Cân bằng hóa học và Sự điện li' },
      { code: 'HOA11.NITRO', grade: 11, name: 'Nitơ và Hợp chất của Nitơ' },
      { code: 'HOA10.NT', grade: 10, name: 'Cấu tạo nguyên tử và Bảng tuần hoàn' },
      { code: 'HOA10.OXH', grade: 10, name: 'Phản ứng Oxi hóa – Khử' },
    ],
    biology: [
      { code: 'SINH12.ADN', grade: 12, name: 'Cơ chế di truyền và Biến dị phân tử' },
      { code: 'SINH12.QLLK', grade: 12, name: 'Quy luật di truyền và Liên kết gen' },
      { code: 'SINH12.SINHTHAI', grade: 12, name: 'Hệ sinh thái và Sinh quyển' },
      { code: 'SINH11.CHUYENHOA', grade: 11, name: 'Chuyển hóa vật chất và Năng lượng ở sinh vật' },
      { code: 'SINH10.TEBAO', grade: 10, name: 'Sinh học tế bào và Vi sinh vật' },
    ],
    english: [
      { code: 'ENG12.TENSES', grade: 12, name: 'Ngữ pháp nâng cao: Đảo ngữ & Câu điều kiện' },
      { code: 'ENG12.READING', grade: 12, name: 'Kỹ năng đọc hiểu & Tìm ý chính bài đọc' },
      { code: 'ENG11.PHRASAL', grade: 11, name: 'Cụm động từ (Phrasal Verbs) & Thành ngữ' },
      { code: 'ENG10.VOCAB', grade: 10, name: 'Từ vựng cốt lõi & Ngữ âm (Trọng âm, Nguyên âm)' },
    ],
    history: [
      { code: 'SU12.VN45_75', grade: 12, name: 'Lịch sử Việt Nam giai đoạn 1945 – 1975' },
      { code: 'SU12.DOIMOI', grade: 12, name: 'Việt Nam thời kỳ Đổi mới và Hội nhập' },
      { code: 'SU11.TGHIENDAI', grade: 11, name: 'Lịch sử thế giới hiện đại giữa hai cuộc chiến tranh' },
      { code: 'SU10.VANMINH', grade: 10, name: 'Các nền văn minh cổ đại và trung đại' },
    ],
  };

  const availableTopics =
    selectedSubject === 'math'
      ? mathTopics
      : (otherTopicsBySubject[selectedSubject] || []).filter((t) => t.grade === selectedGrade);

  const toggle = (code: string) => {
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const startPractice = async (topicCodes: string[]) => {
    if (!topicCodes.length) {
      toast('Vui lòng chọn ít nhất một chuyên đề.');
      return;
    }
    setBusy(true);
    try {
      const a = await post<any>('/api/practice/start', {
        mode: 'topic',
        topics: topicCodes,
        count,
      });
      go(`/thi/${a.id}`);
    } catch (err: any) {
      toast(err.message || 'Không thể bắt đầu luyện tập chuyên đề này.');
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
          border: '1px solid #b7eb8f',
          padding: '20px 24px',
          borderRadius: 16,
        }}
      >
        <div className="row between wrap" style={{ gap: 16, alignItems: 'center' }}>
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                background: '#52c41a',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(82, 196, 26, 0.25)',
              }}
            >
              🌱
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#135200' }}>
                Tự Học Theo Chuyên Đề
              </h1>
              <div style={{ marginTop: 4, fontSize: 13, color: '#237804', fontWeight: 500 }}>
                Chủ động chọn môn học, khối lớp và củng cố từng chuyên đề kiến thức theo tốc độ riêng của bạn.
              </div>
            </div>
          </div>

          {picked.length > 0 && (
            <button
              type="button"
              className="btn primary"
              style={{
                background: '#389e0d',
                borderColor: '#389e0d',
                borderRadius: 20,
                padding: '8px 20px',
                fontWeight: 700,
              }}
              disabled={busy}
              onClick={() => startPractice(picked)}
            >
              {busy ? 'Đang tạo…' : `Học ${picked.length} chuyên đề đã chọn (${count} câu) →`}
            </button>
          )}
        </div>
      </div>

      {/* Selectors Bar: Subject + Grade + Count */}
      <div className="card flat stack" style={{ padding: '16px 20px', gap: 14 }}>
        {/* Subject pills */}
        <div className="row between wrap" style={{ gap: 10, alignItems: 'center' }}>
          <span className="small muted" style={{ fontWeight: 600, minWidth: 70 }}>
            Môn học:
          </span>
          <div className="filter-pills" style={{ flexWrap: 'wrap', gap: 6 }}>
            {SUBJECTS.map((s) => {
              const isActive = selectedSubject === s.id;
              return (
                <button
                  type="button"
                  key={s.id}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={isActive ? { background: '#52c41a', borderColor: '#52c41a', color: '#fff' } : {}}
                  onClick={() => {
                    setSelectedSubject(s.id);
                    setPicked([]);
                  }}
                >
                  {s.icon} {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade pills & Question count */}
        <div className="row between wrap" style={{ gap: 14, alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="small muted" style={{ fontWeight: 600, minWidth: 70 }}>
              Khối lớp:
            </span>
            <div className="filter-pills">
              {[10, 11, 12].map((g) => (
                <button
                  type="button"
                  key={g}
                  className={`filter-pill ${selectedGrade === g ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedGrade(g);
                    setPicked([]);
                  }}
                >
                  Khối {g}
                </button>
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span className="tiny muted">Số câu mỗi lần học:</span>
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
        </div>
      </div>

      {/* Topics Grid */}
      <div className="widget-card stack" style={{ gap: 16 }}>
        <div className="row between wrap" style={{ gap: 10, alignItems: 'center' }}>
          <div className="widget-head" style={{ margin: 0 }}>
            <h2 className="widget-title">
              <span>📚</span> Danh sách chuyên đề ({availableTopics.length})
            </h2>
            {picked.length > 0 && (
              <span className="badge green" style={{ fontWeight: 700 }}>
                Đã chọn {picked.length} chuyên đề
              </span>
            )}
          </div>

          <div className="row" style={{ gap: 8 }}>
            {picked.length > 0 && (
              <button
                type="button"
                className="btn sm"
                onClick={() => setPicked([])}
              >
                Bỏ chọn tất cả
              </button>
            )}
            <button
              type="button"
              className="btn sm primary"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              disabled={busy || picked.length === 0}
              onClick={() => startPractice(picked)}
            >
              {busy ? 'Đang chuẩn bị…' : `Bắt đầu học (${count} câu) →`}
            </button>
          </div>
        </div>

        {availableTopics.length === 0 ? (
          <div className="card empty" style={{ padding: '36px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>📖</span>
            <div style={{ fontWeight: 600, color: '#374151' }}>
              Chưa có danh sách chuyên đề cho môn và khối này
            </div>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              Bạn có thể chọn môn Toán học (Khối 10, 11, 12) với đầy đủ 100% chuyên đề chuẩn GDPT 2018.
            </p>
          </div>
        ) : (
          <div className="grid-2" style={{ gap: 12 }}>
            {availableTopics.map((topic) => {
              const m = mastery[topic.code];
              const isSelected = picked.includes(topic.code);
              const pctVal = m ? Math.round(m.value * 100) : null;
              const bandLabel =
                pctVal === null ? null : pctVal >= 75 ? 'Vững' : pctVal >= 50 ? 'Khá' : 'Cần củng cố';
              const bandBadgeColor =
                pctVal === null
                  ? undefined
                  : pctVal >= 75
                  ? '#f6ffed'
                  : pctVal >= 50
                  ? '#e6f4ff'
                  : '#fff1f0';
              const bandTextColor =
                pctVal === null
                  ? undefined
                  : pctVal >= 75
                  ? '#389e0d'
                  : pctVal >= 50
                  ? '#0958d9'
                  : '#cf1322';

              return (
                <div
                  key={topic.code}
                  className="task-widget"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderRadius: 12,
                    border: `1.5px solid ${isSelected ? '#52c41a' : '#e5e7eb'}`,
                    background: isSelected ? '#f6ffed' : '#ffffff',
                    cursor: 'pointer',
                    boxShadow: isSelected
                      ? '0 4px 12px rgba(82, 196, 26, 0.15)'
                      : '0 2px 6px rgba(0, 0, 0, 0.03)',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => toggle(topic.code)}
                >
                  <div>
                    <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(topic.code)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: '#52c41a', cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: '#111827',
                            lineHeight: 1.4,
                          }}
                        >
                          {topic.name}
                        </span>
                      </div>
                      <span className="badge" style={{ fontSize: 11, flexShrink: 0 }}>
                        Lớp {topic.grade}
                      </span>
                    </div>

                    {/* Mastery Level */}
                    <div style={{ marginTop: 10 }}>
                      {m ? (
                        <div className="stack" style={{ gap: 4 }}>
                          <div className="row between" style={{ fontSize: 12 }}>
                            <span className="tiny muted">Độ thành thạo:</span>
                            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                              <span
                                style={{
                                  background: bandBadgeColor,
                                  color: bandTextColor,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {bandLabel}
                              </span>
                              <strong style={{ color: '#1f2937' }}>{pctVal}%</strong>
                            </div>
                          </div>
                          <Bar value={m.value} />
                        </div>
                      ) : (
                        <div className="tiny muted">Chưa có bài làm đánh giá chuyên đề này</div>
                      )}
                    </div>
                  </div>

                  <div className="row end" style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
                    <button
                      type="button"
                      className="btn sm"
                      style={{
                        background: isSelected ? '#52c41a' : '#f0fdf4',
                        color: isSelected ? '#fff' : '#166534',
                        borderColor: '#bbf7d0',
                        fontWeight: 600,
                        padding: '4px 12px',
                        fontSize: 12,
                        borderRadius: 6,
                      }}
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        startPractice([topic.code]);
                      }}
                    >
                      Học chuyên đề →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
