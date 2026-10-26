import { useState } from 'react';
import { get, post } from '../../api';
import { ErrorBox, fmtDateTime, fmtScore, go, Icon, Loading, Modal, useApp, useAsync } from '../../ui/kit';

type ClassData = {
  class: {
    id: number;
    name: string;
    grade: number;
    code: string;
    teacher: string | null;
    students: number;
  } | null;
  assignments: {
    id: number;
    title: string;
    mode: 'exam' | 'homework';
    open_at: number;
    close_at: number;
    duration_min: number;
    show_result: string;
    attempt_id: number | null;
    status: string | null;
    score10: number | null;
    deadline_at: number | null;
    state: 'done' | 'doing' | 'upcoming' | 'missed' | 'open';
  }[];
};

export function StudentClass() {
  const { user, refreshUser, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => get<ClassData>('/api/student/class'), []);
  const [filterMode, setFilterMode] = useState<'all' | 'exam' | 'homework'>('all');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchCode, setSwitchCode] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (loading) return <Loading text="Đang tải thông tin lớp học…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const handleJoin = async (codeToJoin: string) => {
    const code = codeToJoin.trim().toUpperCase();
    if (!code) {
      setJoinError('Vui lòng nhập mã lớp học.');
      return;
    }
    setBusy(true);
    setJoinError(null);
    try {
      const res = await post<{ ok: boolean; class: any; user: any }>('/api/student/class/join', { code });
      refreshUser();
      toast(`Đã tham gia lớp ${res.class.name}!`);
      setShowSwitchModal(false);
      setSwitchCode('');
      setJoinCode('');
      reload();
    } catch (err: any) {
      setJoinError(err.message || 'Mã lớp không hợp lệ.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      await post<{ ok: boolean; user: any }>('/api/student/class/leave');
      refreshUser();
      toast('Đã rời lớp học.');
      setConfirmLeave(false);
      reload();
    } catch (err: any) {
      toast(err.message || 'Không thể rời lớp.');
    } finally {
      setBusy(false);
    }
  };

  const startExam = async (assignmentId: number) => {
    setBusy(true);
    try {
      const att = await post<any>('/api/attempts/start', { assignmentId });
      go(`/thi/${att.id}`);
    } catch (err: any) {
      toast(err.message || 'Không thể bắt đầu bài làm.');
      setBusy(false);
    }
  };

  // Case 1: Student not in any class
  if (!data?.class) {
    return (
      <div className="stack" style={{ maxWidth: 580, margin: '20px auto' }}>
        <div className="card shadow" style={{ padding: 20, textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#e6f4ff',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              margin: '0 auto 16px',
            }}
          >
            <Icon name="school" />
          </div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Tham gia lớp học</h1>
          <p className="muted" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
            Nhập <strong>Mã tham gia lớp</strong> do giáo viên bộ môn hoặc giáo viên chủ nhiệm cung cấp để nhận bài tập, đề kiểm tra và theo dõi tiến độ cùng cả lớp.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin(joinCode);
            }}
            className="stack"
            style={{ gap: 14 }}
          >
            {joinError && <div className="card warn small">{joinError}</div>}
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  height: 40,
                }}
                placeholder="Nhập mã giáo viên cung cấp"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                autoFocus
                disabled={busy}
              />
              <button
                type="submit"
                className="btn primary"
                style={{ height: 40, padding: '0 14px', fontSize: 13 }}
                disabled={busy || !joinCode.trim()}
              >
                {busy ? 'Đang vào…' : 'Vào lớp →'}
              </button>
            </div>
            <div className="tiny muted">
              Mã tham gia do giáo viên cung cấp. Bạn có thể sao chép và dán mã vào đây.
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Case 2: Student enrolled in class
  const cls = data.class;
  const assignments = data.assignments || [];
  const filteredAssignments = assignments.filter((a) => {
    if (filterMode === 'exam') return a.mode === 'exam';
    if (filterMode === 'homework') return a.mode === 'homework';
    return true;
  });

  const examCount = assignments.filter((a) => a.mode === 'exam').length;
  const homeworkCount = assignments.filter((a) => a.mode === 'homework').length;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <header className="page-intro">
        <div className="row between" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 16 }}>
            <span className="page-intro-icon"><Icon name="class" /></span>
            <div>
              <div className="row"><h1>Lớp {cls.name}</h1><span className="badge blue">Khối {cls.grade}</span><span className="badge">{cls.students} học sinh</span></div>
              <p className="page-intro-description">Giáo viên phụ trách: <strong>{cls.teacher ?? 'Thầy/Cô bộ môn'}</strong></p>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="row page-code"><span className="tiny muted">Mã lớp</span><strong>{cls.code}</strong><button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(cls.code); toast(`Đã chép mã lớp ${cls.code}`); }}>Sao chép</button></div>
            <button type="button" className="btn sm" onClick={() => setShowSwitchModal(true)}>Đổi lớp</button>
            <button type="button" className="btn sm danger" onClick={() => setConfirmLeave(true)}>Rời lớp</button>
          </div>
        </div>
      </header>

      {/* Switch Class Modal */}
      {showSwitchModal && (
        <Modal title="Đổi sang lớp học khác" onClose={() => setShowSwitchModal(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin(switchCode);
            }}
            className="stack"
            style={{ gap: 14 }}
          >
            {joinError && <div className="card warn small">{joinError}</div>}
            <p className="small muted">
              Bạn đang ở lớp <strong>{cls.name}</strong>. Khi nhập mã mới, bạn sẽ chuyển sang lớp mới và nhận bài tập của lớp đó.
            </p>
            <label className="field">
              <span>Mã tham gia lớp mới</span>
              <input
                className="input"
                style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}
                placeholder="Nhập mã lớp mới"
                value={switchCode}
                onChange={(e) => setSwitchCode(e.target.value.toUpperCase())}
                autoFocus
                disabled={busy}
              />
            </label>
            <div className="row end" style={{ gap: 8, marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setShowSwitchModal(false)} disabled={busy}>
                Hủy
              </button>
              <button type="submit" className="btn primary" disabled={busy || !switchCode.trim()}>
                {busy ? 'Đang chuyển…' : 'Chuyển lớp ngay'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Leave Modal */}
      {confirmLeave && (
        <Modal title="Xác nhận rời lớp" onClose={() => setConfirmLeave(false)}>
          <div className="stack" style={{ gap: 14 }}>
            <p>
              Bạn có chắc chắn muốn rời lớp <strong>{cls.name}</strong> không? Bạn có thể tham gia lại bất cứ lúc nào bằng mã lớp.
            </p>
            <div className="row end" style={{ gap: 8, marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setConfirmLeave(false)} disabled={busy}>
                Hủy
              </button>
              <button type="button" className="btn danger" onClick={handleLeave} disabled={busy}>
                {busy ? 'Đang rời…' : 'Xác nhận rời lớp'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Class Assignments Section */}
      <div className="widget-card stack" style={{ gap: 16 }}>
        <div className="row between wrap" style={{ gap: 12, alignItems: 'center' }}>
          <div className="widget-head" style={{ margin: 0 }}>
            <h2 className="widget-title">
              <span>📋</span> Danh sách bài tập & Đề kiểm tra của lớp
            </h2>
            <span className="badge">{assignments.length} bài</span>
          </div>

          <div className="filter-pills">
            <button
              type="button"
              className={`filter-pill ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              Tất cả ({assignments.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterMode === 'exam' ? 'active' : ''}`}
              onClick={() => setFilterMode('exam')}
            >
              Đề thi ({examCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterMode === 'homework' ? 'active' : ''}`}
              onClick={() => setFilterMode('homework')}
            >
              Bài tập ({homeworkCount})
            </button>
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="card empty" style={{ padding: '36px 20px', textAlign: 'center' }}>
            <span className="empty-icon"><Icon name="check" /></span>
            <div style={{ fontWeight: 600, color: '#374151' }}>Hiện chưa có bài giao nào cho lớp</div>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              Khi giáo viên giao đề thi hoặc bài tập về nhà, bài sẽ xuất hiện ngay tại đây.
            </p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {filteredAssignments.map((a) => {
              const isExam = a.mode === 'exam';
              return (
                <div
                  key={a.id}
                  className="task-widget"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: isExam ? '#fff1f0' : '#e6f4ff',
                      color: isExam ? '#cf1322' : '#0958d9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={isExam ? "exam" : "book"} />
                  </div>

                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          background: isExam ? '#fff2e8' : '#f0f5ff',
                          color: isExam ? '#d4380d' : '#1d39c4',
                          border: `1px solid ${isExam ? '#ffd591' : '#adc6ff'}`,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {isExam ? 'Kiểm tra' : 'Bài tập về nhà'}
                      </span>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                        {a.title}
                      </h3>
                    </div>

                    <div className="row tiny muted" style={{ gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      <span><Icon name="clock" /> Thời gian: {a.duration_min} phút</span>
                      <span><Icon name="clock" /> Hạn nộp: {fmtDateTime(a.close_at)}</span>
                    </div>
                  </div>

                  <div className="row" style={{ gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    {a.state === 'done' ? (
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span
                          className="badge green"
                          style={{ fontSize: 13, padding: '4px 10px', fontWeight: 700 }}
                        >
                          {a.score10 !== null ? `Điểm: ${fmtScore(a.score10)}` : 'Đã nộp'}
                        </span>
                        {a.attempt_id && (
                          <a className="btn sm primary" href={`#/ket-qua/${a.attempt_id}`}>
                            Xem bài làm →
                          </a>
                        )}
                      </div>
                    ) : a.state === 'doing' ? (
                      <a
                        className="btn sm"
                        style={{ background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }}
                        href={`#/thi/${a.attempt_id}`}
                      >
                        Làm tiếp ⏳
                      </a>
                    ) : a.state === 'open' ? (
                      <button
                        type="button"
                        className="btn sm primary"
                        disabled={busy}
                        onClick={() => startExam(a.id)}
                      >
                        Làm bài ngay →
                      </button>
                    ) : a.state === 'upcoming' ? (
                      <span className="badge" style={{ background: '#f5f5f5', color: '#8c8c8c' }}>
                        Chưa mở
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#fff1f0', color: '#cf1322' }}>
                        Hết hạn
                      </span>
                    )}
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
