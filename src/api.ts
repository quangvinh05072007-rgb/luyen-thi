// Gọi API máy chủ. Lỗi trả về luôn có câu tiếng Việt nói cách sửa.
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T = any>(method: string, path: string, body?: unknown, opts: { raw?: Blob | ArrayBuffer; timeoutMs?: number } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (opts.raw) {
    payload = opts.raw as BodyInit;
    headers['content-type'] = 'application/octet-stream';
    headers['x-smartexam'] = '1';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  } else if (method !== 'GET') {
    headers['content-type'] = 'application/json';
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60000);
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin', signal: ctrl.signal });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', null);
  } finally {
    clearTimeout(timer);
  }
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/login' && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, data?.error ?? `Lỗi ${res.status}`, data);
  }
  return data as T;
}

export const get = <T = any>(p: string) => api<T>('GET', p);
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const put = <T = any>(p: string, b?: unknown) => api<T>('PUT', p, b ?? {});

/** Tải file (Word, CSV) qua trình duyệt. */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new ApiError(res.status, d?.error ?? 'Không tải được file.', d);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const name = cd.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
