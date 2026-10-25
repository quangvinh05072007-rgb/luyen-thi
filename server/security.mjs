// Mật khẩu (scrypt), phiên, giới hạn đăng nhập sai.
import crypto from 'node:crypto';

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Bản không chặn luồng chính: băm mật khẩu chạy trong nhóm luồng của Node (nhiều học sinh đăng nhập cùng lúc không làm treo máy chủ). */
export function verifyPasswordAsync(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return Promise.resolve(false);
  const ref = Buffer.from(hash, 'base64');
  return new Promise((resolve) => {
    crypto.scrypt(String(pw), Buffer.from(salt, 'base64'), 32, { N: 16384, r: 8, p: 1 }, (err, h) => resolve(!err && h.length === ref.length && crypto.timingSafeEqual(h, ref)));
  });
}

export function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const h = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), 32, { N: 16384, r: 8, p: 1 });
  const ref = Buffer.from(hash, 'base64');
  return h.length === ref.length && crypto.timingSafeEqual(h, ref);
}

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** Mật khẩu tạm dễ đọc cho học sinh (không có ký tự dễ nhầm). */
export function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const b = crypto.randomBytes(8);
  for (const x of b) s += abc[x % abc.length];
  return s;
}

export class LoginLimiter {
  constructor(max = 5, windowMs = 10 * 60 * 1000) {
    this.max = max;
    this.windowMs = windowMs;
    this.fails = new Map();
  }
  blocked(key, now = Date.now()) {
    const f = (this.fails.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.fails.set(key, f);
    return f.length >= this.max;
  }
  fail(key, now = Date.now()) {
    const f = this.fails.get(key) ?? [];
    f.push(now);
    this.fails.set(key, f);
  }
  reset(key) {
    this.fails.delete(key);
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
