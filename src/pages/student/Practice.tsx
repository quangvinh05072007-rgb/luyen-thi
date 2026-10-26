import { matchesSearch } from '../../../shared/search.mjs';
import { useState } from 'react';
import { get, post } from '../../api';
import { ErrorBox, fmtScore, go, Icon, Loading, useApp, useAsync } from '../../ui/kit';

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
  'Toán': { icon: 'book', bg: 'var(--primary-soft)', color: 'var(--primary)', tagBg: 'var(--primary-soft)', tagColor: 'var(--primary)' },
  'Vật lí': { icon: 'book', bg: 'var(--primary-soft)', color: 'var(--primary)', tagBg: 'var(--primary-soft)', tagColor: 'var(--primary)' },
  'Hóa học': { icon: 'book', bg: 'var(--primary-soft)', color: 'var(--primary)', tagBg: 'var(--primary-soft)', tagColor: 'var(--primary)' },
  'Tiếng Anh': { icon: 'book', bg: 'var(--primary-soft)', color: 'var(--primary)', tagBg: 'var(--primary-soft)', tagColor: 'var(--primary)' },
  'Sinh học': { icon: 'book', bg: 'var(--primary-soft)', color: 'var(--primary)', tagBg: 'var(--primary-soft)', tagColor: 'var(--primary)' },
  'Lịch sử': { icon: 'book', bg: 'var(--primary-soft)', color: 'var(--primary)', tagBg: 'var(--primary-soft)', tagColor: 'var(--primary)' },
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
    const matchSearch = !search.trim() || matchesSearch(e.title, search);
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
      toast(err.message || 'Chưa đủ dữ liệu để tạo bài luyện điểm yếu.');
      setAiBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <header className="page-intro practice-intro">
        <div className="row between" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 16 }}>
            <span className="page-intro-icon"><Icon name="exam" /></span>
            <div>
              <div className="row"><h1>Luyện đề</h1><span className="badge blue">{totalCount} đề thi</span></div>
              <p className="page-intro-description">Đã hoàn thành: <strong>{completedCount}/{totalCount} đề</strong> · Cấu trúc 3 phần.</p>
            </div>
          </div>
          <button type="button" className="btn primary" disabled={aiBusy} onClick={startAdaptiveAI}>
            <Icon name="practice" />{aiBusy ? 'Đang tạo…' : 'Luyện điểm yếu'}
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="card flat row between wrap" style={{ padding: '12px 18px', gap: 14, alignItems: 'center' }}>
        <div className="filter-pills" style={{ flexWrap: 'wrap', gap: 6 }}>
          {subjects.map((subj) => {
            const isAll = subj === 'all';
            const label = isAll ? 'Tất cả' : subj;
            const isActive = selectedSubject === subj;
            return (
              <button
                type="button"
                key={subj}
                className={`filter-pill ${isActive ? 'active' : ''}`}

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
            aria-label="Tìm tên đề thi" placeholder="Tìm tên đề thi…"
            style={{ borderRadius: 20, padding: '7px 14px' }}
          />
        </div>
      </div>

      {/* Exam Cards List */}
      {filteredExams.length === 0 ? (
        <div className="card empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <span className="empty-icon"><Icon name="search" /></span>
          <div style={{ fontWeight: 600, color: '#374151', fontSize: 16 }}>Không tìm thấy đề thi phù hợp</div>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Thử chọn môn học khác hoặc xóa bộ lọc tìm kiếm.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {filteredExams.map((exam) => {
            const cfg = SUBJECT_CONFIG[exam.subject] || {
              icon: 'book',
              bg: '#f0f0f0',
              color: '#595959',
              tagBg: '#fafafa',
              tagColor: '#595959',
            };
            const isStarting = startingId === exam.id;

            return (
              <div
                key={exam.id}
                className="task-widget practice-exam-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 9,
                  border: '1px solid #e5e7eb',
                  background: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Subject Avatar Circle */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: cfg.bg,
                    color: cfg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  <Icon name={cfg.icon} />
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
                        <Icon name="check" /> Đã nộp: {exam.score10 !== null ? `${fmtScore(exam.score10)}đ` : 'Đã làm'}
                      </span>
                    )}
                  </div>

                  <h3
                    style={{
                      margin: '0 0 6px',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#111827',
                      lineHeight: 1.35,
                    }}
                  >
                    {exam.title}
                  </h3>

                  <div className="row tiny muted" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span><Icon name="clock" /> {exam.durationMin} phút</span>
                    <span><Icon name="exam" /> {exam.questionCount} câu</span>
                    <span><Icon name="book" /> Tự luyện</span>
                    {exam.author && <span><Icon name="user" /> {exam.author}</span>}
                  </div>
                </div>

                {/* Action Button */}
                <div className="row" style={{ gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {exam.completed && exam.attemptId && (
                    <a
                      className="btn sm"
                      href={`#/ket-qua/${exam.attemptId}`}

                    >
                      Xem bài làm
                    </a>
                  )}

                  <button
                    type="button"
                    className="btn primary"
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
