import { useEffect, useRef, useState } from 'react';
import { get, post } from '../api';
import { Icon, useApp } from './kit';

const status: Record<string, string> = {
  queued: 'Đang chờ',
  running: 'Đang xử lý',
  completed: 'Sẵn sàng kiểm tra',
  failed: 'Có lỗi',
  cancelled: 'Đã hủy',
};

export default function ImportJobsPanel({
  refresh,
  onOpen,
}: {
  refresh: number;
  onOpen: (job: any) => void;
}) {
  const { toast } = useApp();
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    let live = true;
    let timer: any = null;

    const load = async () => {
      try {
        const r = await get('/api/import/jobs');
        if (!live) return;
        setJobs(r.jobs);
        setError('');
        const hasActive = r.jobs.some((j: any) => ['queued', 'running'].includes(j.state));
        activeRef.current = hasActive;
        const delay = hasActive ? 2000 : 8000;
        timer = setTimeout(load, delay);
      } catch (e: any) {
        if (!live) return;
        setError(e.message);
        timer = setTimeout(load, 10000);
      }
    };

    void load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  const action = async (id: number, kind: string) => {
    setBusy(id);
    try {
      await post(`/api/import/jobs/${id}/${kind}`);
      const r = await get('/api/import/jobs');
      setJobs(r.jobs);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!jobs.length && !error) return null;

  const displayList = showAll ? jobs : jobs.slice(0, 5);

  return (
    <section className="card import-jobs" aria-label="Tác vụ nhập đề">
      <div className="row between mb" style={{ alignItems: 'center' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            <Icon name="upload" /> Danh sách file đã nhập ({jobs.length})
          </h3>
          {activeRef.current && (
            <span className="live-indicator">
              <span className="live-dot" /> Đang xử lý nền
            </span>
          )}
        </div>
        <span className="tiny muted">Tiến độ chạy nền trên máy chủ, có thể rời trang bất kỳ lúc nào</span>
      </div>

      {error && <p className="tiny alert warn">{error}</p>}

      <div className="stack" style={{ gap: 8 }}>
        {displayList.map((job) => {
          const hasDraft = Boolean(job.draftQuestions?.length);
          return (
            <div className="import-job" key={job.id}>
              <div className="grow">
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <b className="small">{job.name}</b>
                  {hasDraft && !job.savedIds && (
                    <span className="badge blue" style={{ fontSize: 10 }}>
                      📝 Có bản nháp đang sửa
                    </span>
                  )}
                </div>
                <div className="tiny muted" role="status">
                  {job.savedIds ? 'Đã lưu vào ngân hàng' : status[job.state]}
                  {job.state === 'running' && job.progress.pages
                    ? ` · trang ${job.progress.page}/${job.progress.pages}`
                    : ''}
                </div>
                {job.state === 'running' && job.progress.pages && (
                  <progress max={job.progress.pages} value={job.progress.page} style={{ width: '100%', height: 6, marginTop: 4 }} />
                )}
                {job.error && <p className="tiny import-job-error">{job.error}</p>}
              </div>

              <div className="row">
                {job.state === 'completed' ? (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={async () => {
                      setBusy(job.id);
                      try {
                        onOpen((await get(`/api/import/jobs/${job.id}`)).job);
                      } catch (e: any) {
                        toast(e.message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy === job.id}
                  >
                    {job.savedIds ? 'Xem kết quả' : hasDraft ? 'Tiếp tục sửa' : 'Kiểm tra & Lưu'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy === job.id}
                    onClick={() => action(job.id, ['queued', 'running'].includes(job.state) ? 'cancel' : 'retry')}
                  >
                    {['queued', 'running'].includes(job.state) ? 'Hủy' : 'Thử lại'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {jobs.length > 5 && (
        <div className="row center mt" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setShowAll(!showAll)}
            style={{ fontSize: 12 }}
          >
            {showAll ? 'Thu gọn danh sách ▲' : `Xem thêm ${jobs.length - 5} file khác ▼`}
          </button>
        </div>
      )}
    </section>
  );
}
