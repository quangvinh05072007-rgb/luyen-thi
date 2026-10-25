// Bộ thành phần giao diện dùng chung.
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';

// ---------- định tuyến theo hash (#/duong-dan) ----------
export function useRoute() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [path, qs] = hash.split('?');
  return { path, query: new URLSearchParams(qs ?? '') };
}
export function go(path: string) {
  location.hash = path;
  window.scrollTo(0, 0);
}

// ---------- dữ liệu chung ----------
export type Meta = {
  topics: { code: string; grade: number; name: string }[];
  levels: Record<string, string>;
  sources: Record<string, string>;
  sourceHints: Record<string, string>;
  errorTypes: Record<string, { label: string; hint: string; action: string }>;
  types: Record<string, string>;
  aiEnabled: boolean;
  lanIps: string[];
  aiHint: string | null;
};
export type User = { id: number; role: 'admin' | 'teacher' | 'student'; username: string; displayName: string; class: { id: number; name: string; grade: number } | null; school: { id: number; name: string; sample: number }; xp: number; streak: number };
export const AppCtx = createContext<{ meta: Meta; user: User; refreshUser: () => void; toast: (s: string) => void }>(null as any);
export const useApp = () => useContext(AppCtx);

/** Địa chỉ để máy khác trong mạng mở được (thay localhost bằng IP mạng LAN). */
export function shareUrl(meta: Meta) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return local && meta.lanIps?.length ? `${location.protocol}//${meta.lanIps[0]}${location.port ? ':' + location.port : ''}` : location.origin;
}

export function topicName(meta: Meta, code: string | null | undefined) {
  return meta.topics.find((t) => t.code === code)?.name ?? 'Chưa gắn chuyên đề';
}

// ---------- tải dữ liệu ----------
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const generation = useRef(0);
  const run = useCallback(() => {
    const request = ++generation.current;
    set((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive.current && request === generation.current && set({ data, error: null, loading: false }))
      .catch((e: ApiError) => alive.current && request === generation.current && set({ data: null, error: e.message, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [run]);
  return { ...state, reload: run, setData: (d: T) => set({ data: d, error: null, loading: false }) };
}

export function Loading({ text = 'Đang tải…' }: { text?: string }) {
  return (
    <div className="loading">
      <div className="spinner" /> {text}
    </div>
  );
}
export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="alert error row between">
      <span>{error}</span>
      {onRetry && (
        <button className="btn sm" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
    (container.current?.querySelector<HTMLElement>(selector) ?? container.current)?.focus();
    const k = (e: KeyboardEvent) => {
      if(e.key === 'Escape') { e.preventDefault(); close.current(); }
      if(e.key === 'Tab') {
        const nodes = [...(container.current?.querySelectorAll<HTMLElement>(selector) ?? [])].filter(n => n.getClientRects().length);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if(!first) { e.preventDefault(); return; }
        if(e.shiftKey && (document.activeElement === first || !container.current?.contains(document.activeElement))) {e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
      }
    };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); if(previous?.isConnected) previous.focus(); };
  }, []);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={container} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="row between mb">
            <h2 style={{ margin: 0 }}>{title}</h2>
            <button className="btn ghost sm" onClick={onClose} aria-label="Đóng">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const { meta } = useApp();
  return (
    <span className={`source ${source}`} title={meta.sourceHints[source]}>
      {meta.sources[source] ?? source}
    </span>
  );
}
export function LevelBadge({ level }: { level: number }) {
  const cls = level === 1 ? 'green' : level === 2 ? 'blue' : 'violet';
  return <span className={`badge ${cls}`}>{['', 'Biết', 'Hiểu', 'Vận dụng'][level] ?? '?'}</span>;
}
export function TypeBadge({ type }: { type: string }) {
  return <span className="badge">{{ mcq: 'Trắc nghiệm', tf: 'Đúng/Sai', short: 'Trả lời ngắn' }[type] ?? type}</span>;
}
export function ErrorTypeBadge({ type }: { type: string }) {
  const { meta } = useApp();
  const color = { concept: 'violet', formula: 'blue', transform: 'amber', careless: 'red' }[type] ?? '';
  return (
    <span className={`badge ${color}`} title={meta.errorTypes[type]?.hint}>
      {meta.errorTypes[type]?.label ?? (type === 'blank' ? 'Bỏ trống' : type)}
    </span>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const c = color ?? (v < 0.5 ? 'var(--bad)' : v < 0.75 ? 'var(--accent)' : 'var(--good)');
  return (
    <div className="bar">
      <span style={{ width: `${v * 100}%`, background: c }} />
    </div>
  );
}

export function Ring({ value, label, size = 74, color = 'var(--primary)' }: { value: number; label: string; size?: number; color?: string }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary-soft)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} />
      </svg>
      <div className="lbl">{label}</div>
    </div>
  );
}

export const fmtScore = (x: number | null | undefined) => (x === null || x === undefined ? '—' : (Math.round(x * 100) / 100).toLocaleString('vi-VN'));
export const fmtDateTime = (ms: number) => new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
export const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

export function scoreColor(s: number | null | undefined) {
  if (s === null || s === undefined) return 'var(--ink-3)';
  return s < 5 ? 'var(--bad)' : s < 7 ? 'var(--warn)' : 'var(--good)';
}

// ---------- mascot gốc: "Cú Pi" — chú cú tròn, bụng có chữ π ----------
export function Mascot({ size = 72, mood = 'happy' }: { size?: number; mood?: 'happy' | 'think' | 'cheer' }) {
  return (
    <svg className="mascot mascot-float" width={size} height={size} viewBox="0 0 120 120" aria-label="Cú Pi">
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity="0.08" />
      <path d="M28 46 L22 22 L44 36 Z" fill="#2238b8" />
      <path d="M92 46 L98 22 L76 36 Z" fill="#2238b8" />
      <ellipse cx="60" cy="68" rx="38" ry="42" fill="#3049d8" />
      <ellipse cx="60" cy="80" rx="25" ry="26" fill="#eaeefe" />
      <text x="60" y="94" textAnchor="middle" fontFamily="Georgia, serif" fontSize="30" fontWeight="700" fill="#3049d8">
        π
      </text>
      <circle cx="44" cy="52" r="14" fill="#fff" />
      <circle cx="76" cy="52" r="14" fill="#fff" />
      {mood === 'cheer' ? (
        <>
          <path d="M37 54 Q44 46 51 54" stroke="#18203a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M69 54 Q76 46 83 54" stroke="#18203a" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={mood === 'think' ? 48 : 45} cy={mood === 'think' ? 49 : 53} r="6" fill="#18203a" />
          <circle cx={mood === 'think' ? 80 : 77} cy={mood === 'think' ? 49 : 53} r="6" fill="#18203a" />
          <circle cx={mood === 'think' ? 50 : 47} cy={mood === 'think' ? 47 : 51} r="2" fill="#fff" />
          <circle cx={mood === 'think' ? 82 : 79} cy={mood === 'think' ? 47 : 51} r="2" fill="#fff" />
        </>
      )}
      <path d="M55 63 L65 63 L60 71 Z" fill="#f5a524" />
      <path d="M22 70 Q14 86 28 98" stroke="#2238b8" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M98 70 Q106 86 92 98" stroke="#2238b8" strokeWidth="8" fill="none" strokeLinecap="round" />
      <rect x="40" y="16" width="40" height="8" rx="2" fill="#18203a" />
      <path d="M60 8 L86 18 L60 26 L34 18 Z" fill="#18203a" />
      <path d="M84 19 L84 30" stroke="#f5a524" strokeWidth="2" />
      <circle cx="84" cy="31" r="3" fill="#f5a524" />
    </svg>
  );
}

// ---------- biểu tượng ----------
const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  bank: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h16v3H4z',
  import: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3',
  exam: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  class: 'M16 11a4 4 0 1 0-8 0M3 21a9 9 0 0 1 18 0M12 7a4 4 0 1 1 0 8',
  report: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  practice: 'M13 2L4 14h7l-1 8 9-12h-7z',
  book: 'M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  log: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  school: 'M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5',
  out: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  plane: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  check: 'M20 6L9 17l-5-5',
  cross: 'M18 6L6 18M6 6l12 12',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trophy: 'M6 9H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M18 9h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3M6 3h12v7a6 6 0 0 1-12 0V3zM9 21h6M12 16v5',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  plus: 'M12 5v14M5 12h14',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
};

export function AzotaLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="9" fill="url(#azotaGrad)" />
      <path d="M8 27L28 9L19 28L15 20L8 27Z" fill="#ffffff" />
      <path d="M19 28L15 20L28 9L19 28Z" fill="#e6f4ff" opacity="0.9" />
      <path d="M28 9L15 20L17 12L28 9Z" fill="#ff7a45" opacity="0.95" />
      <defs>
        <linearGradient id="azotaGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1677ff" />
          <stop offset="1" stopColor="#0958d9" />
        </linearGradient>
      </defs>
    </svg>
  );
}
export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.home} />
    </svg>
  );
}
