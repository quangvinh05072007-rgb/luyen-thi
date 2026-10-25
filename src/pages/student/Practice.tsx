import { useState } from 'react';
import { get, post } from '../../api';
import { ErrorBox, fmtScore, go, Loading, useApp, useAsync } from '../../ui/kit';

type PracticeExam = {
  id: number;
  title: string;
  subject: string;
  durationMin: number;
  questionCount: number;
  author: string | null;
  completed: boolean;
  score10: number | null;
  attemptId: number | null;
};

type PracticeResponse = {
  exams: PracticeExam[];
  totalCount: number;
  completedCount: number;
};

const SUBJECT_CONFIG: Record<string, { icon: string; bg: string; color: string; tagBg: string; tagColor: string }> = {
  'Toán': { icon: '📐', bg: '#e6f4ff', color: '#1677ff', tagBg: '#f0f5ff', tagColor: '#1d39c4' },
  'Vật lí': { icon: '⚡', bg: '#f9f0ff', color: '#722ed1', tagBg: '#f9f0ff', tagColor: '#531dab' },
  'Hóa học': { icon: '🧪', bg: '#e6fffb', color: '#13c2c2', tagBg: '#e6fffb', tagColor: '#08979c' },
  'Tiếng Anh': { icon: '🇬🇧', bg: '#fff0f6', color: '#eb2f96', tagBg: '#fff0f6', tagColor: '#c41d7f' },
  'Sinh học': { icon: '🧬', bg: '#f6ffed', color: '#52c41a', tagBg: '#f6ffed', tagColor: '#389e0d' },
  'Lịch sử': { icon: '🏛️', bg: '#fffbe6', color: '#faad14', tagBg: '#fffbe6', tagColor: '#d48806' },
};

export function PracticeHub() {
  const { toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get<PracticeResponse>('/api/student/practice-exams'), []);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [startingId, setStartingId] = useState<number | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  if (loading) return <Loading text="Đang tải danh mục đề luyện thi…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const exams = data?.exams ?? [];
  const completedCount = data?.completedCount ?? 0;
  const totalCount = data?.totalCount ?? exams.length;

  const subjects = ['all', ...Array.from(new Set(exams.map((e) => e.subject)))];

  const filteredExams = exams.filter((e) => {
    const matchSubject = selectedSubject === 'all' || e.subject === selectedSubject;
    const matchSearch = !search.trim() || e.title.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    return matchSubject && matchSearch;
  });

  const startExam = async (examId: number) => {
    setStartingId(examId);
    try {
      const att = await post<any>('/api/student/practice-exams/start', { examId });
      go(`/thi/${att.id}`);
    } catch (err: any) {
      toast(err.message || 'Không thể bắt đầu luyện đề.');
      setStartingId(null);
    }
  };

  const startAdaptiveAI = async () => {
    setAiBusy(true);
    try {
      const att = await post<any>('/api/practice/start', { mode: 'weak', count: 10 });
      go(`/thi/${att.id}`);
    } catch (err: any) {
      toast(err.message || 'Chưa đủ dữ liệu để khởi tạo luyện AI.');
      setAiBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Golden Banner Matching User Reference */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)',
          border: '1px solid #ffe58f',
          borderRadius: 16,
          padding: '20px 24px',
          boxShadow: '0 4px 16px rgba(250, 140, 22, 0.08)',
        }}
      >
        <div className="row between wrap" style={{ gap: 16, alignItems: 'center' }}>
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                background: '#ff7a45',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(255, 122, 69, 0.3)',
              }}
            >
              📖
            </div>
            <div>
              <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#873800' }}>
                  Tự Luyện Đề 2026
                </h1>
                <span
                  style={{
                    background: '#fff7e6',
                    border: '1px solid #ffd591',
                    color: '#d46b08',
                    padding: '3px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {totalCount} đề thi
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#ad4e00', fontWeight: 500 }}>
                Đã hoàn thành: <strong>{completedCount}/{totalCount} đề</strong> · Chuẩn ma trận 3 Phần (TN Nhiều Lựa Chọn · Đúng/Sai · Điền Số)
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #ff7a45 0%, #fa541c 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              padding: '10px 18px',
              borderRadius: 24,
              boxShadow: '0 4px 12px rgba(250, 84, 28, 0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            disabled={aiBusy}
            onClick={startAdaptiveAI}
          >
            {aiBusy ? 'Đang tạo…' : '✨ Luyện thích ứng AI'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card flat row between wrap" style={{ padding: '12px 18px', gap: 14, alignItems: 'center' }}>
        <div className="filter-pills" style={{ flexWrap: 'wrap', gap: 6 }}>
          {subjects.map((subj) => {
            const isAll = subj === 'all';
            const label = isAll ? '✨ Tất cả' : `${SUBJECT_CONFIG[subj]?.icon || '📚'} ${subj}`;
            const isActive = selectedSubject === subj;
            return (
              <button
                type="button"
                key={subj}
                className={`filter-pill ${isActive ? 'active' : ''}`}
                style={isActive ? { background: '#ff7a45', borderColor: '#ff7a45', color: '#fff' } : {}}
                onClick={() => setSelectedSubject(subj)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: '1 1 240px', maxWidth: 320 }}>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Tìm tên đề thi…"
            style={{ borderRadius: 20, padding: '7px 14px' }}
          />
        </div>
      </div>

      {/* Exam Cards List */}
      {filteredExams.length === 0 ? (
        <div className="card empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>🔍</span>
          <div style={{ fontWeight: 600, color: '#374151', fontSize: 16 }}>Không tìm thấy đề thi phù hợp</div>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Thử chọn môn học khác hoặc xóa bộ lọc tìm kiếm.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {filteredExams.map((exam) => {
            const cfg = SUBJECT_CONFIG[exam.subject] || {
              icon: '📚',
              bg: '#f0f0f0',
              color: '#595959',
              tagBg: '#fafafa',
              tagColor: '#595959',
            };
            const isStarting = startingId === exam.id;

            return (
              <div
                key={exam.id}
                className="task-widget"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  background: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Subject Avatar Circle */}
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    background: cfg.bg,
                    color: cfg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  {cfg.icon}
                </div>

                {/* Exam Info */}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <span
                      style={{
                        background: cfg.tagBg,
                        color: cfg.tagColor,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {exam.subject}
                    </span>
                    {exam.completed && (
                      <span
                        className="badge green"
                        style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px' }}
                      >
                        ✅ Đã nộp: {exam.score10 !== null ? `${fmtScore(exam.score10)}đ` : 'Đã làm'}
                      </span>
                    )}
                  </div>

                  <h3
                    style={{
                      margin: '0 0 6px',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#111827',
                      lineHeight: 1.35,
                    }}
                  >
                    {exam.title}
                  </h3>

                  <div className="row tiny muted" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>⏱️ {exam.durationMin} phút</span>
                    <span>📝 {exam.questionCount} câu</span>
                    <span>🎯 Chuẩn BGD 3 Phần</span>
                    {exam.author && <span>👤 Tác giả: {exam.author}</span>}
                  </div>
                </div>

                {/* Action Button */}
                <div className="row" style={{ gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {exam.completed && exam.attemptId && (
                    <a
                      className="btn sm"
                      href={`#/ket-qua/${exam.attemptId}`}
                      style={{ borderRadius: 20, padding: '6px 14px' }}
                    >
                      Xem bài làm
                    </a>
                  )}

                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: 'linear-gradient(135deg, #ff7a45 0%, #fa541c 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 24,
                      padding: '8px 20px',
                      fontWeight: 700,
                      fontSize: 13,
                      boxShadow: '0 3px 10px rgba(250, 84, 28, 0.25)',
                      cursor: 'pointer',
                    }}
                    disabled={isStarting}
                    onClick={() => startExam(exam.id)}
                  >
                    {isStarting ? 'Đang vào…' : exam.completed ? 'Luyện lại >' : 'Luyện ngay >'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
