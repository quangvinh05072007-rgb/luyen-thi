import crypto from 'node:crypto';
import { computeMastery, recommend } from '../shared/diagnose.mjs';

const DAY = 86400000;
const SESSION_MS = 12 * 3600000;
const COOKIE = 'se_family_session';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const normalizeCode = (value) => String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
const completed = (status) => status === 'submitted' || status === 'auto_submitted';

/** Register the read-only family portal. Family sessions never authorize normal user routes. */
export function registerFamily({ route, db, now, fail, audit, teacherClassIds, sweepExpired }) {
  db.raw.exec(`
    CREATE TABLE IF NOT EXISTS family_access (
      student_id INTEGER PRIMARY KEY REFERENCES users(id), school_id INTEGER NOT NULL REFERENCES schools(id),
      code_hash TEXT NOT NULL UNIQUE, created_by INTEGER NOT NULL, created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS family_sessions (
      token_hash TEXT PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id),
      access_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS family_session_student ON family_sessions(student_id);
  `);
  const guesses = new Map();
  const staff = ['teacher', 'admin'];
  const cookie = (token, maxAge) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/family; Max-Age=${maxAge}`;
  function staffStudent(user, id, ip) {
    const student = db.get("SELECT * FROM users WHERE id=? AND role='student'", Number(id));
    if (!student || student.school_id !== user.school_id || !teacherClassIds(user).includes(student.class_id)) {
      audit(user, 'family_access_denied', 'Không được phép quản lý mã phụ huynh.', ip, { target: `student:${id}`, outcome: 'denied' });
      fail(403, 'Bạn không phụ trách học sinh này.');
    }
    if (!student.active) fail(400, 'Học sinh đã ngừng hoạt động.');
    return student;
  }
  function familyStudent(cookies = {}) {
    const token = cookies[COOKIE];
    if (!token || token.length > 200) fail(401, 'Phiên phụ huynh đã hết hạn. Vui lòng nhập lại mã liên kết.');
    const session = db.get('SELECT * FROM family_sessions WHERE token_hash=?', hash(token));
    const access = session && db.get('SELECT * FROM family_access WHERE student_id=?', session.student_id);
    const student = session && db.get("SELECT id, school_id, class_id, display_name, active FROM users WHERE id=? AND role='student'", session.student_id);
    if (!session || session.expires_at <= now() || !access || access.revoked_at !== null || access.expires_at <= now() || access.code_hash !== session.access_hash || !student?.active || student.school_id !== access.school_id) {
      if (session) db.run('DELETE FROM family_sessions WHERE token_hash=?', session.token_hash);
      fail(401, 'Phiên phụ huynh đã hết hạn hoặc mã đã được đổi. Liên hệ giáo viên để nhận mã mới.');
    }
    return student;
  }
  route('GET', '/api/students/:id/family-access', staff, ({ user, params, ip }) => {
    const student = staffStudent(user, params.id, ip);
    const access = db.get('SELECT created_at, expires_at, revoked_at FROM family_access WHERE student_id=?', student.id);
    return { active: !!access && access.revoked_at === null && access.expires_at > now(), createdAt: access?.created_at ?? null, expiresAt: access?.expires_at ?? null };
  });
  route('POST', '/api/students/:id/family-access', staff, ({ user, params, body, ip }) => {
    const student = staffStudent(user, params.id, ip);
    const days = Number(body.expiresInDays ?? 90);
    if (!Number.isInteger(days) || days < 1 || days > 365) fail(400, 'Thời hạn mã phải từ 1 đến 365 ngày.');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const raw = Array.from(crypto.randomBytes(24), (byte) => alphabet[byte & 31]).join('');
    const expiresAt = now() + days * DAY;
    db.tx(() => {
      db.run('DELETE FROM family_sessions WHERE student_id=?', student.id);
      db.run(`INSERT INTO family_access(student_id,school_id,code_hash,created_by,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?,NULL)
        ON CONFLICT(student_id) DO UPDATE SET school_id=excluded.school_id,code_hash=excluded.code_hash,created_by=excluded.created_by,created_at=excluded.created_at,expires_at=excluded.expires_at,revoked_at=NULL`, student.id, student.school_id, hash(raw), user.id, now(), expiresAt);
    });
    audit(user, 'family_access_issued', 'Đã cấp mã liên kết phụ huynh; mọi phiên cũ đã thu hồi.', ip, { target: `student:${student.id}` });
    return { code: raw.match(/.{4}/g).join('-'), expiresAt };
  });
  route('POST', '/api/students/:id/family-access/revoke', staff, ({ user, params, ip }) => {
    const student = staffStudent(user, params.id, ip);
    db.tx(() => {
      db.run('UPDATE family_access SET revoked_at=? WHERE student_id=?', now(), student.id);
      db.run('DELETE FROM family_sessions WHERE student_id=?', student.id);
    });
    audit(user, 'family_access_revoked', 'Đã thu hồi mã và phiên phụ huynh.', ip, { target: `student:${student.id}` });
    return { ok: true };
  });
  route('POST', '/api/family/login', null, ({ body, ip, setCookie }) => {
    const t = now();
    for (const [key, row] of guesses) if (row.until <= t) guesses.delete(key);
    const key = ip ?? 'unknown';
    const current = guesses.get(key);
    if ((current?.count ?? 0) >= 5 || (!current && guesses.size >= 10000)) fail(429, 'Nhập sai mã quá nhiều lần. Đợi 10 phút rồi thử lại.');
    const code = normalizeCode(body.code);
    const access = code.length === 24 ? db.get('SELECT f.* FROM family_access f JOIN users u ON u.id=f.student_id WHERE f.code_hash=? AND f.revoked_at IS NULL AND f.expires_at>? AND u.active=1 AND u.role=\'student\' AND u.school_id=f.school_id', hash(code), t) : null;
    if (!access) {
      guesses.set(key, { count: (current?.count ?? 0) + 1, until: current?.until ?? t + 10 * 60000 });
      fail(401, 'Mã liên kết không hợp lệ hoặc đã hết hạn. Liên hệ giáo viên để nhận mã mới.');
    }
    guesses.delete(key);
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Math.min(t + SESSION_MS, access.expires_at);
    db.tx(() => {
      db.run('DELETE FROM family_sessions WHERE expires_at<=?', t);
      db.run('INSERT INTO family_sessions(token_hash,student_id,access_hash,created_at,expires_at) VALUES(?,?,?,?,?)', hash(token), access.student_id, access.code_hash, t, expiresAt);
    });
    setCookie(cookie(token, Math.floor((expiresAt - t) / 1000)));
    return { ok: true, expiresAt };
  });
  route('POST', '/api/family/logout', null, ({ cookies = {}, setCookie }) => {
    if (cookies[COOKIE]) db.run('DELETE FROM family_sessions WHERE token_hash=?', hash(cookies[COOKIE]));
    setCookie(cookie('', 0));
    return { ok: true };
  });
  route('GET', '/api/family/dashboard', null, ({ cookies }) => {
    const student = familyStudent(cookies);
    sweepExpired('AND student_id = ? AND school_id = ?', student.id, student.school_id);
    const cls = db.get('SELECT name FROM classes WHERE id=? AND school_id=?', student.class_id, student.school_id);
    const rows = db.all(`SELECT a.id assignment_id,a.title,a.close_at,a.show_result,t.id,t.status,t.score10,t.submitted_at,t.deadline_at
      FROM assignments a LEFT JOIN attempts t ON t.assignment_id=a.id AND t.student_id=? AND t.school_id=a.school_id
      WHERE a.school_id=? AND a.class_id=? AND a.open_at<=?
        AND (a.target_json IS NULL OR EXISTS(SELECT 1 FROM json_each(a.target_json) j WHERE j.value=?))
      ORDER BY a.close_at DESC`, student.id, student.school_id, student.class_id, now(), student.id);
    const released = rows.filter((row) => completed(row.status) && row.submitted_at != null && (row.show_result === 'after_submit' || now() > row.close_at));
    const safeEvidence = db.all(`SELECT e.topic,e.level,e.score,e.at FROM evidence e JOIN attempts t ON t.id=e.attempt_id
      JOIN assignments a ON a.id=t.assignment_id WHERE e.student_id=? AND e.school_id=? AND t.student_id=e.student_id AND t.school_id=e.school_id
      AND a.school_id=e.school_id AND a.class_id=? AND a.open_at<=? AND t.status IN ('submitted','auto_submitted') AND t.submitted_at IS NOT NULL
      AND (a.target_json IS NULL OR EXISTS(SELECT 1 FROM json_each(a.target_json) j WHERE j.value=e.student_id))
      AND (a.show_result='after_submit' OR a.close_at<?)`, student.id, student.school_id, student.class_id, now(), now());
    const mastery = computeMastery(safeEvidence, now());
    return {
      student: { id: student.id, name: student.display_name, className: cls?.name ?? '' },
      grades: released.map((row) => ({ id: row.id, title: row.title, score10: row.score10, submittedAt: row.submitted_at })),
      participation: rows.map((row) => ({ id: row.assignment_id, title: row.title, closeAt: row.deadline_at ?? row.close_at, state: completed(row.status) ? 'completed' : (row.deadline_at ?? row.close_at) < now() && row.status !== 'in_progress' ? 'missed' : 'pending' })),
      topics: Object.values(mastery).map(({ topic, name, value, n, confident }) => ({ topic, name, value, n, confident })).sort((a, b) => a.value - b.value),
      suggestions: recommend(mastery).map(({ topic, name, reason, tip }) => ({ topic, name, reason, tip })),
      serverNow: now(),
    };
  });
}
