// Máy chủ API SmartExam AI. createApp(config) trả về hàm xử lý yêu cầu http, dùng cho cả chạy thật và test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, toQuestion } from './db.mjs';
import { hashPassword, verifyPassword, verifyPasswordAsync, newToken, tempPassword, LoginLimiter, parseCookies } from './security.mjs';
import { importFile, importText, answerFileToText, answerEntriesFromText, tagDrafts } from './importers.mjs';
import { applyAnswerEntries, answerFromSolution, sameAnswer } from '../shared/parse.mjs';
import { makeAi } from './ai.mjs';
import { gradeAttempt, gradeQuestion } from '../shared/grading.mjs';
import { vnDay, scheduleReview, startOfDayMs, isDue, overdueDays } from '../shared/spaced.mjs';
import { buildProgress } from '../shared/progress.mjs';
import crypto from 'node:crypto';
import { buildXlsx } from '../shared/xlsxWrite.mjs';
import { hashSeed } from '../shared/rng.mjs';
import { generateExam, apportion, makeVariant, makeVariants, variantLayout, assignVariants, toOriginalResponse, OFFICIAL_BLUEPRINT } from '../shared/generate.mjs';
import { diagnoseAttempt, diagnoseItem, computeMastery, recommend, selectPractice } from '../shared/diagnose.mjs';
import { examToDocx, crossAnswerKey } from '../shared/exportExam.mjs';
import { TOPICS, TOPIC_BY_CODE, LEVELS, SOURCES, SOURCE_HINT, ERROR_TYPES, QUESTION_TYPES } from '../shared/topics.mjs';
import { CSV_TEMPLATE, SHEET_HEADERS } from '../shared/sheet.mjs';
import { seedSample } from './seed.mjs';
import { SAMPLE_QUESTIONS } from './seedQuestions.mjs';

export const SAVE_GRACE_MS = 30 * 1000; // ân hạn mạng sau giờ nộp
export const LATE_WINDOW_MS = 15 * 60 * 1000; // nhận bản đồng bộ muộn (mất mạng) để giáo viên quyết định
const SESSION_MS = 12 * 3600 * 1000;
const DAY_GOAL = 10;

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const fail = (status, message, extra) => {
  throw new HttpError(status, message, extra);
};

const DUMMY_HASH = hashPassword('khong-co-tai-khoan');
const dayKey = vnDay; // ngày lịch giờ Việt Nam

/** Kiểm tra câu hỏi đủ điều kiện duyệt. Trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateQuestion(q) {
  const errs = [];
  if (!QUESTION_TYPES[q.type]) errs.push('Loại câu không hợp lệ.');
  if (!String(q.stem ?? '').trim()) errs.push('Thiếu đề bài.');
  if (!TOPIC_BY_CODE[q.topic]) errs.push('Chưa chọn chuyên đề.');
  if (![1, 2, 3].includes(Number(q.level))) errs.push('Chưa chọn mức độ.');
  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !String(o ?? '').trim())) errs.push('Cần đủ 4 phương án A–D.');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errs.push('Chưa chọn đáp án đúng.');
  } else if (q.type === 'tf') {
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !String(o ?? '').trim())) errs.push('Cần đủ 4 ý a)–d).');
    if (!Array.isArray(q.answer) || q.answer.length !== 4 || q.answer.some((x) => typeof x !== 'boolean')) errs.push('Chọn Đúng/Sai cho cả 4 ý.');
  } else if (q.type === 'short') {
    if (!String(q.answer ?? '').trim()) errs.push('Chưa nhập đáp án.');
  }
  return errs;
}

export function createApp(config = {}) {
  const db = openDb(config.dbFile ?? ':memory:');
  let clockFn = config.clock ?? (() => Date.now());
  const now = () => clockFn();
  const ai = config.aiImpl ?? makeAi(config);
  const limiter = new LoginLimiter();
  const distDir = config.distDir;

  // ---------------- tiện ích ----------------
  /** Ghi nhật ký (chỉ thêm). extra: { target, old, new, reason, outcome: 'ok' | 'denied' }. */
  function audit(user, action, detail, ip, extra = {}) {
    const js = (v) => (v === undefined ? null : JSON.stringify(v));
    db.run(
      'INSERT INTO audit_log (school_id, user_id, action, detail, ip, at, target, old_json, new_json, reason, outcome) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      user?.school_id ?? null,
      user?.id ?? null,
      action,
      detail ? String(detail).slice(0, 500) : null,
      ip ?? null,
      now(),
      extra.target ?? null,
      js(extra.old),
      js(extra.new),
      extra.reason ? String(extra.reason).slice(0, 500) : null,
      extra.outcome ?? 'ok',
    );
  }

  /** Từ chối thao tác nhạy cảm: ghi nhận lần thử rồi trả 403. */
  function deny(user, action, target, why, ip) {
    audit(user, action, why, ip, { target, outcome: 'denied' });
    fail(403, `Bạn không có quyền làm việc này. ${why}`);
  }

  /** Lý do bắt buộc cho thao tác nhạy cảm. */
  function needReason(body) {
    const r = String(body?.reason ?? '').trim();
    if (r.length < 5) fail(400, 'Phải nhập lý do (ít nhất 5 ký tự).');
    return r;
  }

  const VERSION_FIELDS = ['type', 'stem', 'options', 'answer', 'explanation', 'topic', 'level', 'status', 'distractors', 'group_id'];
  const questionSnapshot = (row) => Object.fromEntries(VERSION_FIELDS.map((k) => [k, row[k] ?? null]));
  /** Lưu trạng thái TRƯỚC khi sửa, để xem lịch sử và khôi phục. */
  function recordVersion(row, user, reason) {
    const n = (db.get('SELECT MAX(version) v FROM question_versions WHERE qid = ?', row.id)?.v ?? 0) + 1;
    db.run('INSERT INTO question_versions (school_id, qid, version, snapshot_json, changed_by, reason, at) VALUES (?,?,?,?,?,?,?)', row.school_id, row.id, n, JSON.stringify(questionSnapshot(row)), user?.id ?? null, reason ? String(reason).slice(0, 300) : null, now());
    return n;
  }
  function writeQuestionFields(id, f) {
    db.run(
      'UPDATE questions SET type = ?, stem = ?, options_json = ?, answer_json = ?, explanation = ?, topic = ?, level = ?, status = ?, distractors_json = ?, group_id = ?, updated_at = ? WHERE id = ?',
      f.type,
      f.stem,
      JSON.stringify(f.options ?? []),
      JSON.stringify(f.answer ?? null),
      f.explanation ?? '',
      f.topic,
      Number(f.level),
      f.status,
      JSON.stringify(f.distractors ?? {}),
      f.group_id ?? null,
      now(),
      id,
    );
  }

  function questionUsed(schoolId, qid) {
    if (db.get('SELECT 1 x FROM evidence WHERE school_id = ? AND qid = ? LIMIT 1', schoolId, qid)) return true;
    return db.all('SELECT items_json FROM exams WHERE school_id = ?', schoolId).some((e) => e.items.some((x) => x.qid === qid));
  }

  /** Bài làm thuộc lớp mình phụ trách (admin: cả trường). Sai quyền → ghi nhận và 403. */
  function staffAttempt(user, id, action, ip) {
    const att = db.get('SELECT * FROM attempts WHERE id = ?', id);
    if (!att) fail(404, 'Không tìm thấy bài làm.');
    const target = `attempt:${att.id}`;
    if (att.school_id !== user.school_id) deny(user, action, target, 'Bài làm không thuộc trường của bạn.', ip);
    const asg = att.assignment_id ? db.get('SELECT * FROM assignments WHERE id = ?', att.assignment_id) : null;
    if (!asg) fail(400, 'Chỉ bài được giao mới thao tác được.');
    if (!teacherClassIds(user).includes(asg.class_id)) deny(user, action, target, 'Bạn không phụ trách lớp này.', ip);
    return { att, asg };
  }


  function publicUser(u) {
    if (!u) return null;
    const cls = u.class_id ? db.get('SELECT id, name, grade FROM classes WHERE id = ?', u.class_id) : null;
    const school = db.get('SELECT id, name, sample FROM schools WHERE id = ?', u.school_id);
    return { id: u.id, role: u.role, username: u.username, displayName: u.display_name, class: cls, school, xp: u.xp, streak: u.streak };
  }

  function questionsMap(schoolId, ids) {
    if (!ids.length) return {};
    const rows = db.all(`SELECT * FROM questions WHERE school_id = ? AND id IN (${ids.map(() => '?').join(',')})`, schoolId, ...ids);
    return Object.fromEntries(rows.map((r) => [r.id, toQuestion(r)]));
  }

  /** Học sinh được giao bài (bài giao cho cả lớp thì target = null). */
  const targeted = (a, students) => (Array.isArray(a.target) ? students.filter((s) => a.target.includes(s.id)) : students);

  function teacherClassIds(user) {
    if (user.role === 'admin') return db.all('SELECT id FROM classes WHERE school_id = ?', user.school_id).map((c) => c.id);
    return db.all('SELECT id FROM classes WHERE school_id = ? AND teacher_id = ?', user.school_id, user.id).map((c) => c.id);
  }

  function canSeeStudent(user, studentId) {
    if (user.role === 'student') return user.id === studentId;
    const s = db.get("SELECT * FROM users WHERE id = ? AND role = 'student' AND school_id = ?", studentId, user.school_id);
    if (!s) return false;
    return user.role === 'admin' || teacherClassIds(user).includes(s.class_id);
  }

  // ---------------- câu hỏi trong bài làm ----------------
  function attemptQuestions(att) {
    if (att.assignment_id) {
      const asg = db.get('SELECT exam_id FROM assignments WHERE id = ?', att.assignment_id);
      const exam = db.get('SELECT snapshot_json FROM exams WHERE id = ?', asg.exam_id);
      return exam.snapshot;
    }
    return questionsMap(att.school_id, att.layout.map((x) => x.qid));
  }

  function publicItem(it, q, i, partIndex) {
    const options = q.type === 'mcq' ? (it.perm ?? [0, 1, 2, 3]).map((k) => q.options[k]) : q.type === 'tf' ? q.options : [];
    return { qid: it.qid, type: q.type, stem: q.stem, options, no: partIndex, topic: q.topic, level: q.level };
  }

  function originalResponses(att, responses) {
    const out = {};
    for (const it of att.layout) out[it.qid] = toOriginalResponse(it, responses?.[it.qid]);
    return out;
  }

  function resultVisible(att) {
    if (att.kind === 'practice') return att.status !== 'in_progress';
    if (att.status === 'in_progress') return false;
    const asg = db.get('SELECT show_result, close_at FROM assignments WHERE id = ?', att.assignment_id);
    return asg.show_result === 'after_submit' || now() > asg.close_at;
  }

  function attemptView(att) {
    const qmap = attemptQuestions(att);
    const counters = { mcq: 0, tf: 0, short: 0 };
    const items = att.layout.map((it, i) => publicItem(it, qmap[it.qid], i, ++counters[it.type]));
    const view = {
      id: att.id,
      kind: att.kind,
      title: att.title,
      status: att.status,
      startedAt: att.started_at,
      deadlineAt: att.deadline_at,
      submittedAt: att.submitted_at,
      serverNow: now(),
      version: att.version,
      responses: att.responses,
      times: att.times,
      checked: att.checked,
      items,
      resultVisible: resultVisible(att),
    };
    if (view.resultVisible) view.result = resultDetail(att, qmap);
    return view;
  }

  function resultDetail(att, qmap) {
    const byQ = Object.fromEntries((att.result?.items ?? []).map((x) => [x.qid, x]));
    const diag = Object.fromEntries((att.diagnosis?.items ?? []).map((x) => [x.qid, x]));
    return {
      score10: att.score10,
      points: att.points,
      max: att.max_points,
      byPart: att.result?.byPart,
      errorCount: att.diagnosis?.errorCount,
      topics: att.diagnosis?.topics,
      dominantError: att.diagnosis?.dominantError,
      late: att.late ? { at: att.late.at, accepted: !!att.late.accepted } : null,
      items: att.layout.map((it) => {
        const q = qmap[it.qid];
        const correctDisplayed = q.type === 'mcq' ? (it.perm ?? [0, 1, 2, 3]).indexOf(q.answer) : q.answer;
        return { qid: it.qid, correctAnswer: correctDisplayed, explanation: q.explanation, source: q.source, grade: byQ[it.qid] ?? null, diagnosis: diag[it.qid] ?? null };
      }),
    };
  }

  // ---------------- chấm và ghi bằng chứng học tập ----------------
  function bumpActivity(studentId, nQuestions, nCorrect, xp) {
    const t = now();
    const day = dayKey(t);
    db.run(
      'INSERT INTO activity (student_id, day, questions, correct) VALUES (?,?,?,?) ON CONFLICT(student_id, day) DO UPDATE SET questions = questions + excluded.questions, correct = correct + excluded.correct',
      studentId,
      day,
      nQuestions,
      nCorrect,
    );
    const u = db.get('SELECT last_active_day, streak FROM users WHERE id = ?', studentId);
    let streak = u.streak;
    if (u.last_active_day !== day) {
      const yesterday = dayKey(t - 86400000);
      streak = u.last_active_day === yesterday ? streak + 1 : 1;
    }
    db.run('UPDATE users SET xp = xp + ?, streak = ?, last_active_day = ? WHERE id = ?', xp, streak, day, studentId);
  }

  function recordEvidence(att, q, response, seconds) {
    const g = gradeQuestion(q, response);
    const d = diagnoseItem(q, response, seconds);
    const t = now();
    db.run(
      'INSERT INTO evidence (school_id, student_id, qid, topic, level, score, correct, error_type, attempt_id, at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      att.school_id,
      att.student_id,
      q.id,
      q.topic,
      q.level,
      g.points / g.max,
      g.correct ? 1 : 0,
      d?.errors?.[0]?.type ?? (d?.kind === 'blank' ? 'blank' : null),
      att.id,
      t,
    );
    const cur = db.get('SELECT * FROM review_items WHERE student_id = ? AND qid = ?', att.student_id, q.id);
    const prev = cur ? { box: cur.box, due_day: cur.due_day ?? vnDay(cur.due_at), last_day: cur.last_day, lapses: cur.lapses } : null;
    const { state: next, action } = scheduleReview(prev, g.correct, t);
    if (action === 'skip' || action === 'early' || action === 'none') {
      // giữ nguyên lịch
    } else if (next) {
      db.run(
        'INSERT INTO review_items (student_id, qid, school_id, box, due_at, due_day, last_day, lapses) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(student_id, qid) DO UPDATE SET box = excluded.box, due_at = excluded.due_at, due_day = excluded.due_day, last_day = excluded.last_day, lapses = excluded.lapses',
        att.student_id,
        q.id,
        att.school_id,
        next.box,
        startOfDayMs(next.due_day),
        next.due_day,
        next.last_day,
        next.lapses,
      );
    } else if (cur) db.run('DELETE FROM review_items WHERE student_id = ? AND qid = ?', att.student_id, q.id);
    return { g, d };
  }

  /** Chốt bài: chấm, chẩn đoán, ghi bằng chứng. Gọi trong giao dịch. Bỏ qua câu đã "kiểm tra" khi luyện tập. */
  function finalize(att, responses, times, status) {
    const qmap = attemptQuestions(att);
    const qs = att.layout.map((it) => qmap[it.qid]);
    const orig = originalResponses(att, responses);
    const grade = gradeAttempt(qs, orig);
    const diag = diagnoseAttempt(qs, orig, times);
    const t = now();
    db.run(
      `UPDATE attempts SET status = ?, submitted_at = ?, responses_json = ?, times_json = ?, score10 = ?, points = ?, max_points = ?, result_json = ?, diagnosis_json = ? WHERE id = ?`,
      status,
      t,
      JSON.stringify(responses ?? {}),
      JSON.stringify(times ?? {}),
      grade.score10,
      grade.points,
      grade.max,
      JSON.stringify(grade),
      JSON.stringify(diag),
      att.id,
    );
    let n = 0;
    let nc = 0;
    for (const q of qs) {
      if (att.checked?.[q.id]) continue;
      const answered = gradeQuestion(q, orig[q.id]).answered;
      if (!answered && att.kind === 'practice') continue;
      const { g } = recordEvidence(att, q, orig[q.id], times?.[q.id]);
      n++;
      if (g.correct) nc++;
    }
    bumpActivity(att.student_id, n, nc, att.kind === 'assignment' ? 50 + nc * 5 : nc * 10 + n * 2);
    return getAttempt(att.id);
  }

  function getAttempt(id) {
    return db.get('SELECT * FROM attempts WHERE id = ?', id);
  }

  /** Bài hết giờ mà chưa nộp → chốt bằng bản lưu cuối. */
  function finalizeIfExpired(att) {
    if (att && att.status === 'in_progress' && att.deadline_at && now() > att.deadline_at + SAVE_GRACE_MS) {
      return db.tx(() => finalize(att, att.responses, att.times, 'auto_submitted'));
    }
    return att;
  }

  function sweepExpired(where, ...params) {
    const rows = db.all(`SELECT * FROM attempts WHERE status = 'in_progress' AND deadline_at IS NOT NULL AND deadline_at < ? ${where}`, now() - SAVE_GRACE_MS, ...params);
    for (const a of rows) finalizeIfExpired(a);
  }

  function ownAttempt(user, id) {
    const att = db.get('SELECT * FROM attempts WHERE id = ? AND school_id = ?', id, user.school_id);
    if (!att || att.student_id !== user.id) fail(404, 'Không tìm thấy bài làm.');
    return att;
  }

  function mergeEvents(att, body, clientId) {
    const ev = Array.isArray(att.events) ? att.events.slice() : [];
    for (const e of Array.isArray(body.events) ? body.events.slice(0, 50) : []) {
      if (['hidden', 'blur', 'fullscreen_exit', 'paste', 'offline', 'online'].includes(e?.type)) ev.push({ type: e.type, at: Number(e.at) || now() });
    }
    if (clientId && att.client_id && clientId !== att.client_id && !ev.some((e) => e.type === 'second_device' && e.client === clientId)) {
      ev.push({ type: 'second_device', at: now(), client: String(clientId).slice(0, 40) });
    }
    return ev.slice(-500);
  }

  // ---------------- năng lực học sinh ----------------
  function studentMastery(studentId) {
    const ev = db.all('SELECT topic, level, score, at FROM evidence WHERE student_id = ? AND topic IS NOT NULL', studentId);
    return computeMastery(ev, now());
  }

  function studentErrorCount(studentId, sinceMs = 60 * 86400000) {
    const rows = db.all('SELECT error_type, COUNT(*) n FROM evidence WHERE student_id = ? AND correct = 0 AND error_type IS NOT NULL AND at > ? GROUP BY error_type', studentId, now() - sinceMs);
    const out = { concept: 0, formula: 0, transform: 0, careless: 0, blank: 0 };
    for (const r of rows) out[r.error_type] = r.n;
    return out;
  }

  function studentProfile(studentId) {
    const u = db.get('SELECT * FROM users WHERE id = ?', studentId);
    const mastery = studentMastery(studentId);
    const errorCount = studentErrorCount(studentId);
    const { blank, ...errs } = errorCount;
    const attempts = db
      .all(
        `SELECT a.id, a.kind, a.title, a.status, a.score10, a.submitted_at, a.started_at, s.mode FROM attempts a LEFT JOIN assignments s ON s.id = a.assignment_id
         WHERE a.student_id = ? ORDER BY a.started_at DESC LIMIT 30`,
        studentId,
      )
      .map((a) => ({ ...a, score10: a.status === 'in_progress' ? null : a.score10 }));
    const due = db.get('SELECT COUNT(*) n FROM review_items WHERE student_id = ? AND due_day <= ?', studentId, dayKey(now())).n;
    const reviewTotal = db.get('SELECT COUNT(*) n FROM review_items WHERE student_id = ?', studentId).n;
    const days = db.all('SELECT day, questions, correct FROM activity WHERE student_id = ? ORDER BY day DESC LIMIT 28', studentId);
    return {
      student: publicUser(u),
      mastery: Object.values(mastery).sort((a, b) => a.value - b.value),
      errorCount,
      blankCount: blank,
      recommendations: recommend(mastery, errs),
      attempts,
      review: { due, total: reviewTotal },
      days,
    };
  }

  // ---------------- định tuyến ----------------
  const routes = [];
  const route = (method, pattern, roles, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    routes.push({ method, pattern, re, keys, roles, handler });
  };

  // ---- phiên ----
  route('POST', '/api/login', null, async ({ body, ip, setCookie }) => {
    const username = String(body.username ?? '').trim().toLowerCase();
    const key = `${username}|${ip}`;
    if (limiter.blocked(key, now())) fail(429, 'Sai mật khẩu quá nhiều lần. Đợi 10 phút rồi thử lại.');
    const u = db.get('SELECT * FROM users WHERE username = ? AND active = 1', username);
    // Luôn băm một lần dù không có tài khoản: không lộ tên đăng nhập nào tồn tại qua thời gian trả lời.
    const okPw = u ? await verifyPasswordAsync(body.password ?? '', u.pass_hash) : (await verifyPasswordAsync(body.password ?? '', DUMMY_HASH), false);
    if (!okPw) {
      limiter.fail(key, now());
      fail(401, 'Sai tên đăng nhập hoặc mật khẩu.');
    }
    limiter.reset(key);
    const token = newToken();
    db.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)', token, u.id, now(), now() + SESSION_MS);
    setCookie(`se_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`);
    audit(u, 'login', null, ip);
    return { user: publicUser(u) };
  });
  route('POST', '/api/logout', ['admin', 'teacher', 'student'], ({ user, token, setCookie, ip }) => {
    db.run('DELETE FROM sessions WHERE token = ?', token);
    setCookie('se_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    audit(user, 'logout', null, ip);
    return { ok: true };
  });
  route('GET', '/api/me', ['admin', 'teacher', 'student'], ({ user }) => ({ user: publicUser(user) }));
  route('POST', '/api/me/password', ['admin', 'teacher', 'student'], ({ user, body, ip }) => {
    if (!verifyPassword(body.oldPassword ?? '', user.pass_hash)) fail(400, 'Mật khẩu cũ không đúng.');
    if (String(body.newPassword ?? '').length < 6) fail(400, 'Mật khẩu mới cần ít nhất 6 ký tự.');
    db.run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(body.newPassword), user.id);
    audit(user, 'password_change', null, ip);
    return { ok: true };
  });
  route('GET', '/api/meta', null, () => ({
    topics: TOPICS.map(({ code, grade, name }) => ({ code, grade, name })),
    levels: LEVELS,
    sources: SOURCES,
    sourceHints: SOURCE_HINT,
    errorTypes: ERROR_TYPES,
    types: QUESTION_TYPES,
    officialBlueprint: OFFICIAL_BLUEPRINT,
    aiEnabled: ai.enabled,
    lanIps: Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address),
    aiHint: ai.enabled ? null : 'Chưa cấu hình khóa AI. Thêm ANTHROPIC_API_KEY vào config.local.json rồi khởi động lại.',
    serverNow: now(),
  }));

  // ---- ngân hàng câu hỏi (giáo viên, quản lý) ----
  const STAFF = ['admin', 'teacher'];
  route('GET', '/api/questions', STAFF, ({ user, query }) => {
    const where = ['school_id = ?'];
    const p = [user.school_id];
    if (query.status && query.status !== 'all') (where.push('status = ?'), p.push(query.status));
    else where.push("status != 'archived'");
    if (query.type) (where.push('type = ?'), p.push(query.type));
    if (query.topic) (where.push('topic = ?'), p.push(query.topic));
    if (query.source) (where.push('source = ?'), p.push(query.source));
    if (query.level) (where.push('level = ?'), p.push(Number(query.level)));
    if (query.q) (where.push('stem LIKE ?'), p.push(`%${query.q}%`));
    const rows = db.all(`SELECT * FROM questions WHERE ${where.join(' AND ')} ORDER BY status = 'draft' DESC, updated_at DESC LIMIT 500`, ...p).map((r) => ({ ...toQuestion(r), explanationDraft: r.explanation_draft ?? null, draftCheck: r.draft_check ?? null }));
    const usage = db.all('SELECT qid, COUNT(*) n, AVG(score) p FROM evidence WHERE school_id = ? GROUP BY qid', user.school_id);
    const um = Object.fromEntries(usage.map((u) => [u.qid, u]));
    const counts = db.all("SELECT status, COUNT(*) n FROM questions WHERE school_id = ? AND status != 'archived' GROUP BY status", user.school_id);
    return {
      questions: rows.map((q) => ({ ...q, stats: um[q.id] ? { n: um[q.id].n, p: Math.round(um[q.id].p * 100) / 100 } : null, problems: validateQuestion(q) })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    };
  });

  function insertQuestion(user, q, source, status = 'draft', extra = {}) {
    const t = now();
    const r = db.run(
      `INSERT INTO questions (school_id, type, stem, options_json, answer_json, explanation, topic, level, source, status, distractors_json, origin, parent_id, tag_confidence, created_by, approved_by, created_at, updated_at, group_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      user.school_id,
      q.type,
      String(q.stem ?? ''),
      JSON.stringify(q.options ?? []),
      JSON.stringify(q.answer ?? null),
      String(q.explanation ?? ''),
      q.topic ?? null,
      Number(q.level) || 2,
      source,
      status,
      JSON.stringify(q.distractors ?? {}),
      extra.origin ?? null,
      extra.parent_id ?? null,
      q.tagConfidence ?? null,
      user.id,
      status === 'approved' ? user.id : null,
      t,
      t,
      q.group_id ? String(q.group_id).slice(0, 40) : null,
    );
    return Number(r.lastInsertRowid);
  }

  route('POST', '/api/questions', STAFF, ({ user, body, ip }) => {
    if (!QUESTION_TYPES[body.type]) fail(400, 'Chọn loại câu: trắc nghiệm, đúng/sai hoặc trả lời ngắn.');
    const id = insertQuestion(user, body, 'teacher', 'draft');
    audit(user, 'question_create', `#${id}`, ip);
    return { id };
  });
  route('PUT', '/api/questions/:id', STAFF, ({ user, params, body, ip }) => {
    const q = db.get('SELECT * FROM questions WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!q) fail(404, 'Không tìm thấy câu hỏi.');
    const merged = { ...toQuestion(q), ...body };
    const answerChanged = JSON.stringify(merged.answer ?? null) !== JSON.stringify(toQuestion(q).answer ?? null);
    const sensitive = answerChanged && questionUsed(user.school_id, q.id);
    let reason = null;
    if (sensitive) {
      if (user.role !== 'admin' && q.created_by !== user.id) deny(user, 'question_answer_change', `question:${q.id}`, 'Chỉ người tạo câu hoặc quản lý mới đổi đáp án câu đã dùng.', ip);
      reason = needReason(body);
    }
    if (merged.status === 'approved') {
      const errs = validateQuestion(merged);
      if (errs.length) fail(400, `Câu đã duyệt phải hợp lệ: ${errs.join(' ')}`);
    }
    recordVersion(q, user, reason ?? body.versionNote ?? 'Sửa câu hỏi');
    db.run(
      'UPDATE questions SET type = ?, stem = ?, options_json = ?, answer_json = ?, explanation = ?, topic = ?, level = ?, distractors_json = ?, group_id = ?, tag_confidence = 1, updated_at = ? WHERE id = ?',
      merged.type,
      merged.stem,
      JSON.stringify(merged.options ?? []),
      JSON.stringify(merged.answer ?? null),
      merged.explanation ?? '',
      merged.topic,
      Number(merged.level),
      JSON.stringify(merged.distractors ?? {}),
      merged.group_id ? String(merged.group_id).slice(0, 40) : null,
      now(),
      q.id,
    );
    if (sensitive) audit(user, 'question_answer_change', `#${q.id}`, ip, { target: `question:${q.id}`, old: { answer: toQuestion(q).answer }, new: { answer: merged.answer }, reason });
    else audit(user, 'question_edit', `#${q.id}`, ip, { target: `question:${q.id}` });
    return { question: toQuestion(db.get('SELECT * FROM questions WHERE id = ?', q.id)) };
  });
  route('POST', '/api/questions/approve', STAFF, ({ user, body, ip }) => {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number);
    const approved = [];
    const rejected = [];
    db.tx(() => {
      for (const id of ids) {
        const q = db.get('SELECT * FROM questions WHERE id = ? AND school_id = ?', id, user.school_id);
        if (!q) continue;
        const errs = validateQuestion(toQuestion(q));
        if (errs.length) rejected.push({ id, errors: errs });
        else {
          db.run("UPDATE questions SET status = 'approved', approved_by = ?, updated_at = ? WHERE id = ?", user.id, now(), id);
          approved.push(id);
        }
      }
    });
    if (approved.length) audit(user, 'question_approve', approved.map((x) => `#${x}`).join(' '), ip);
    return { approved, rejected };
  });
  route('POST', '/api/questions/archive', STAFF, ({ user, body, ip }) => {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number);
    const rows = ids.map((id) => db.get('SELECT id, status, created_by FROM questions WHERE id = ? AND school_id = ?', id, user.school_id)).filter(Boolean);
    const foreign = rows.filter((q) => user.role !== 'admin' && q.created_by !== user.id);
    if (foreign.length) deny(user, 'question_archive', foreign.map((q) => `question:${q.id}`).join(','), 'Chỉ người tạo câu hoặc quản lý mới ẩn được câu này.', ip);
    for (const q of rows) db.run("UPDATE questions SET status = 'archived', updated_at = ? WHERE id = ?", now(), q.id);
    audit(user, 'question_archive', ids.map((x) => `#${x}`).join(' '), ip, { target: rows.map((q) => `question:${q.id}`).join(','), old: rows.map((q) => ({ id: q.id, status: q.status })), new: { status: 'archived' } });
    return { ok: true };
  });

  // ---- nhập đề ----
  route('POST', '/api/import', STAFF, async ({ user, raw, query, body, ip }) => {
    let res;
    if (query.filename) res = await importFile(String(query.filename), raw, ai);
    else if (typeof body?.text === 'string') res = importText(body.text);
    else fail(400, 'Gửi file hoặc dán văn bản đề.');
    // Hình trong file được lưu vào CSDL của trường; trong câu hỏi thay khóa tạm bằng mã hình thật.
    const idMap = {};
    for (const im of res.images ?? []) idMap[im.key] = saveImage(user, im);
    const fix = (t) => (typeof t === 'string' ? t.replace(/\[\[img:(\w+)\]\]/g, (m, k) => (idMap[k] !== undefined ? `[[img:${idMap[k]}]]` : '[hình]')) : t);
    for (const q of res.questions) {
      q.stem = fix(q.stem);
      q.options = (q.options ?? []).map(fix);
      q.explanation = fix(q.explanation);
    }
    delete res.images;
    audit(user, 'import_parse', `${query.filename ?? 'văn bản dán'}: ${res.questions.length} câu${Object.keys(idMap).length ? `, ${Object.keys(idMap).length} hình` : ''}`, ip);
    return res;
  });
  function saveImage(user, im) {
    const buf = Buffer.from(im.data);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const hit = db.get('SELECT id FROM images WHERE school_id = ? AND sha = ?', user.school_id, sha);
    if (hit) return hit.id;
    return Number(db.run('INSERT INTO images (school_id, sha, mime, data, cx, cy, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)', user.school_id, sha, im.mime, buf, im.cx ?? 0, im.cy ?? 0, user.id, now()).lastInsertRowid);
  }
  function imageResolver(schoolId) {
    return (id) => {
      const r = db.get('SELECT mime, data, cx, cy FROM images WHERE id = ? AND school_id = ?', id, schoolId);
      return r ? { mime: r.mime, data: Buffer.from(r.data), cx: r.cx || 3000000, cy: r.cy || 2000000 } : null;
    };
  }
  route('GET', '/api/images/:id', ['admin', 'teacher', 'student'], ({ user, params }) => {
    const r = db.get('SELECT mime, data FROM images WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!r) fail(404, 'Không tìm thấy hình.');
    return { __file: { name: `hinh-${params.id}`, type: r.mime, data: Buffer.from(r.data), inline: true } };
  });
  // File đáp án rời: đọc thành bảng đáp án, rồi đối chiếu với các câu đang duyệt.
  route('POST', '/api/import/answers', STAFF, async ({ user, raw, query, body, ip }) => {
    let text;
    if (query.filename) text = await answerFileToText(String(query.filename), raw);
    else if (typeof body?.text === 'string') text = body.text;
    else fail(400, 'Gửi file đáp án hoặc dán bảng đáp án.');
    const entries = answerEntriesFromText(text);
    if (!entries.length) fail(400, 'Không đọc được đáp án nào. Mỗi dòng cần dạng "1. A", "Câu 2: C" hoặc bảng Câu | Đáp án.');
    audit(user, 'import_answers', `${query.filename ?? 'văn bản dán'}: ${entries.length} đáp án`, ip);
    return { entries, count: entries.length };
  });
  route('POST', '/api/import/apply-key', STAFF, ({ user, body, ip }) => {
    const qs = Array.isArray(body.questions) ? body.questions : [];
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!qs.length || !entries.length) fail(400, 'Cần có câu hỏi và bảng đáp án.');
    const { applied, unmatched } = applyAnswerEntries(qs, entries, 'file');
    const out = tagDrafts(qs.map(({ suspicion, ...q }) => q), body.kind ?? null);
    audit(user, 'import_apply_key', `${applied}/${entries.length} đáp án khớp, ${out.filter((q) => q.answerConflict).length} câu mâu thuẫn`, ip);
    return { questions: out, applied, unmatched, conflicts: out.filter((q) => q.answerConflict).length };
  });
  route('POST', '/api/import/save', STAFF, ({ user, body, ip }) => {
    const qs = Array.isArray(body.questions) ? body.questions : [];
    if (!qs.length) fail(400, 'Không có câu nào để lưu.');
    const ids = db.tx(() => qs.map((q) => insertQuestion(user, q, q.fromAi ? 'ai_modified' : 'imported', 'draft', { origin: String(body.origin ?? '').slice(0, 200) })));
    audit(user, 'import_save', `${ids.length} câu từ ${body.origin ?? 'văn bản'}`, ip);
    return { ids };
  });
  route('GET', '/api/import/template.csv', STAFF, () => ({ __file: { name: 'mau-nhap-cau-hoi.csv', type: 'text/csv; charset=utf-8', data: Buffer.from(CSV_TEMPLATE, 'utf8') } }));

  // ---- AI ----
  route('POST', '/api/ai/similar', STAFF, async ({ user, body, ip }) => {
    const q = toQuestion(db.get('SELECT * FROM questions WHERE id = ? AND school_id = ?', body.id, user.school_id));
    if (!q) fail(404, 'Không tìm thấy câu gốc.');
    const gen = await ai.similarQuestion(q);
    const id = insertQuestion(user, { ...gen, type: gen.type ?? q.type, topic: q.topic, level: q.level }, 'ai_generated', 'draft', { parent_id: q.id, origin: `AI từ câu #${q.id}` });
    audit(user, 'ai_similar', `#${q.id} → #${id}`, ip);
    return { id };
  });
  // AI chỉ viết NHÁP lời giải: nằm riêng, học sinh không thấy, giáo viên phải duyệt. AI tự giải độc lập
  // và kết luận đáp án nào thì so với đáp án đã duyệt — lệch thì cảnh báo, không cho duyệt nếu không xác nhận.
  route('POST', '/api/ai/explain', STAFF, async ({ user, body, ip }) => {
    const row = db.get('SELECT * FROM questions WHERE id = ? AND school_id = ?', body.id, user.school_id);
    if (!row) fail(404, 'Không tìm thấy câu hỏi.');
    const q = toQuestion(row);
    const draft = await ai.explain(q);
    const aiAnswer = answerFromSolution(q.type, draft);
    const matches = aiAnswer === null || q.answer === null || q.answer === undefined ? null : sameAnswer(q.type, q.answer, aiAnswer);
    const check = { aiAnswer, matches, at: now(), model: ai.model ?? null };
    db.run('UPDATE questions SET explanation_draft = ?, draft_check_json = ? WHERE id = ?', draft, JSON.stringify(check), q.id);
    audit(user, 'ai_explain', `#${q.id}${matches === false ? ' — AI ra đáp án khác đáp án đã duyệt' : ''}`, ip, { target: `question:${q.id}`, new: { check } });
    return { draft, check };
  });
  route('POST', '/api/questions/:id/draft/approve', STAFF, ({ user, params, body, ip }) => {
    const row = db.get('SELECT * FROM questions WHERE id = ?', params.id);
    if (!row) fail(404, 'Không tìm thấy câu hỏi.');
    const target = `question:${row.id}`;
    if (row.school_id !== user.school_id) deny(user, 'explanation_approve', target, 'Câu hỏi không thuộc trường của bạn.', ip);
    if (!row.explanation_draft) fail(400, 'Câu này không có lời giải nháp.');
    if (row.draft_check?.matches === false && body.confirmMismatch !== true) {
      fail(409, 'AI tự giải ra đáp án khác đáp án đã duyệt của câu này. Kiểm tra lại đáp án hoặc lời giải, rồi xác nhận nếu vẫn muốn dùng.', { mismatch: true, aiAnswer: row.draft_check.aiAnswer });
    }
    const text = body.text !== undefined ? String(body.text).trim() : row.explanation_draft;
    if (!text) fail(400, 'Lời giải trống.');
    recordVersion(row, user, 'Duyệt lời giải do AI viết');
    db.run('UPDATE questions SET explanation = ?, explanation_draft = NULL, draft_check_json = NULL, updated_at = ? WHERE id = ?', text, now(), row.id);
    audit(user, 'explanation_approve', `#${row.id}${body.text !== undefined ? ' (đã sửa tay)' : ''}`, ip, { target, old: { explanation: row.explanation }, new: { explanation: text }, reason: row.draft_check?.matches === false ? 'Giáo viên xác nhận dù AI ra đáp án khác' : undefined });
    return { ok: true };
  });
  route('POST', '/api/questions/:id/draft/reject', STAFF, ({ user, params, ip }) => {
    const row = db.get('SELECT * FROM questions WHERE id = ?', params.id);
    if (!row) fail(404, 'Không tìm thấy câu hỏi.');
    const target = `question:${row.id}`;
    if (row.school_id !== user.school_id) deny(user, 'explanation_reject', target, 'Câu hỏi không thuộc trường của bạn.', ip);
    db.run('UPDATE questions SET explanation_draft = NULL, draft_check_json = NULL WHERE id = ?', row.id);
    audit(user, 'explanation_reject', `#${row.id}`, ip, { target });
    return { ok: true };
  });

  // ---- đề thi ----
  route('POST', '/api/exams/generate', STAFF, ({ user, body }) => {
    const pool = db.all("SELECT id, type, topic, level, status FROM questions WHERE school_id = ? AND status = 'approved'", user.school_id);
    const recent = db.all('SELECT items_json FROM exams WHERE school_id = ? ORDER BY created_at DESC LIMIT 5', user.school_id).flatMap((e) => e.items.map((x) => x.qid));
    const bp = { ...OFFICIAL_BLUEPRINT, ...body, avoidIds: recent, seed: body.seed ?? `${user.id}-${now()}` };
    const res = generateExam(pool, bp);
    const qmap = questionsMap(user.school_id, res.items.map((x) => x.qid));
    return { ...res, blueprint: bp, questions: qmap, poolSize: pool.length };
  });
  // ---- lịch sử phiên bản câu hỏi ----
  route('GET', '/api/questions/:id/versions', STAFF, ({ user, params }) => {
    const q = db.get('SELECT id FROM questions WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!q) fail(404, 'Không tìm thấy câu hỏi.');
    const rows = db.all('SELECT v.version, v.snapshot_json, v.reason, v.at, u.display_name FROM question_versions v LEFT JOIN users u ON u.id = v.changed_by WHERE v.qid = ? ORDER BY v.version DESC', q.id);
    return { versions: rows.map((r) => ({ version: r.version, at: r.at, by: r.display_name, reason: r.reason, snapshot: r.snapshot })) };
  });
  route('POST', '/api/questions/:id/restore', STAFF, ({ user, params, body, ip }) => {
    const q = db.get('SELECT * FROM questions WHERE id = ?', params.id);
    if (!q) fail(404, 'Không tìm thấy câu hỏi.');
    const target = `question:${q.id}`;
    if (q.school_id !== user.school_id) deny(user, 'question_restore', target, 'Câu hỏi không thuộc trường của bạn.', ip);
    const v = db.get('SELECT * FROM question_versions WHERE qid = ? AND version = ?', q.id, Number(body.version));
    if (!v) fail(404, 'Không có phiên bản này.');
    const snap = v.snapshot;
    const answerChanged = JSON.stringify(snap.answer ?? null) !== JSON.stringify(q.answer ?? null);
    const sensitive = answerChanged && questionUsed(user.school_id, q.id);
    let reason = body.reason ? String(body.reason).trim() : null;
    if (sensitive) {
      if (user.role !== 'admin' && q.created_by !== user.id) deny(user, 'question_answer_change', target, 'Chỉ người tạo câu hoặc quản lý mới đổi đáp án câu đã dùng.', ip);
      reason = needReason(body);
    }
    db.tx(() => {
      recordVersion(q, user, `Trước khi khôi phục phiên bản ${v.version}`);
      writeQuestionFields(q.id, snap);
    });
    audit(user, sensitive ? 'question_answer_change' : 'question_restore', `#${q.id} ← phiên bản ${v.version}`, ip, { target, old: questionSnapshot(q), new: snap, reason });
    return { ok: true };
  });

  // ---- thao tác hàng loạt (có hoàn tác) ----
  const BULK_ACTIONS = ['set_topic', 'set_level', 'archive', 'unarchive'];
  route('POST', '/api/questions/bulk', STAFF, ({ user, body, ip }) => {
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))];
    if (!ids.length) fail(400, 'Chọn ít nhất một câu.');
    if (ids.length > 500) fail(400, 'Mỗi lần tối đa 500 câu.');
    if (!BULK_ACTIONS.includes(body.action)) fail(400, 'Thao tác không hợp lệ.');
    if (body.action === 'set_topic' && !TOPIC_BY_CODE[body.value]) fail(400, 'Chuyên đề không hợp lệ.');
    if (body.action === 'set_level' && ![1, 2, 3].includes(Number(body.value))) fail(400, 'Mức độ phải là 1, 2 hoặc 3.');
    const rows = ids.map((id) => db.get('SELECT * FROM questions WHERE id = ? AND school_id = ?', id, user.school_id)).filter(Boolean);
    if (rows.length !== ids.length) fail(404, 'Có câu không thuộc ngân hàng của trường.');
    const foreign = rows.filter((q) => user.role !== 'admin' && q.created_by !== user.id);
    if (foreign.length) deny(user, `bulk_${body.action}`, foreign.map((q) => `question:${q.id}`).join(','), 'Chỉ người tạo câu hoặc quản lý mới sửa hàng loạt được câu này.', ip);
    const before = [];
    db.tx(() => {
      for (const q of rows) {
        const next = { ...questionSnapshot(q) };
        if (body.action === 'set_topic') next.topic = body.value;
        else if (body.action === 'set_level') next.level = Number(body.value);
        else if (body.action === 'archive') next.status = 'archived';
        else if (body.action === 'unarchive') next.status = q.status === 'archived' ? 'draft' : q.status; // phải duyệt lại sau khi khôi phục
        if (JSON.stringify(next) === JSON.stringify(questionSnapshot(q))) continue;
        recordVersion(q, user, `Hàng loạt: ${body.action}`);
        writeQuestionFields(q.id, next);
        before.push({ id: q.id, snapshot: questionSnapshot(q), ver: db.get('SELECT MAX(version) v FROM question_versions WHERE qid = ?', q.id).v });
      }
    });
    const batchId = Number(db.run('INSERT INTO bulk_ops (school_id, user_id, action, value, before_json, at) VALUES (?,?,?,?,?,?)', user.school_id, user.id, body.action, body.value === undefined ? null : String(body.value), JSON.stringify(before), now()).lastInsertRowid);
    audit(user, `bulk_${body.action}`, `${before.length}/${ids.length} câu`, ip, { target: `bulk:${batchId}`, new: { action: body.action, value: body.value ?? null, ids: before.map((b) => b.id) } });
    return { batchId, changed: before.length, unchanged: ids.length - before.length };
  });
  route('POST', '/api/questions/bulk/:id/undo', STAFF, ({ user, params, ip }) => {
    const op = db.get('SELECT * FROM bulk_ops WHERE id = ?', params.id);
    if (!op) fail(404, 'Không tìm thấy thao tác.');
    const target = `bulk:${op.id}`;
    if (op.school_id !== user.school_id) deny(user, 'bulk_undo', target, 'Thao tác không thuộc trường của bạn.', ip);
    if (op.user_id !== user.id && user.role !== 'admin') deny(user, 'bulk_undo', target, 'Chỉ người thực hiện hoặc quản lý mới hoàn tác được.', ip);
    if (op.undone_at) fail(400, 'Thao tác này đã được hoàn tác.');
    let restored = 0;
    const skipped = [];
    db.tx(() => {
      for (const b of op.before) {
        const cur = db.get('SELECT * FROM questions WHERE id = ?', b.id);
        if (!cur || (db.get('SELECT MAX(version) v FROM question_versions WHERE qid = ?', b.id).v ?? 0) !== b.ver) {
          skipped.push(b.id); // câu đã bị sửa tiếp sau thao tác hàng loạt: không ghi đè
          continue;
        }
        recordVersion(cur, user, `Hoàn tác thao tác hàng loạt #${op.id}`);
        writeQuestionFields(b.id, b.snapshot);
        restored++;
      }
      db.run('UPDATE bulk_ops SET undone_at = ? WHERE id = ?', now(), op.id);
    });
    audit(user, 'bulk_undo', `thao tác #${op.id}: khôi phục ${restored}, bỏ qua ${skipped.length}`, ip, { target, new: { restored, skipped } });
    return { restored, skipped };
  });

  // ---- mẫu ma trận đề ----
  const cleanBlueprint = (bp) => {
    const counts = {};
    for (const t of ['mcq', 'tf', 'short']) counts[t] = Math.max(0, Math.min(100, Math.floor(Number(bp?.counts?.[t]) || 0)));
    if (!counts.mcq && !counts.tf && !counts.short) fail(400, 'Mẫu cần có ít nhất một câu.');
    const levels = {};
    for (const l of [1, 2, 3]) levels[l] = Math.max(0, Math.min(100, Number(bp?.levels?.[l]) || 0));
    if (levels[1] + levels[2] + levels[3] <= 0) fail(400, 'Tỉ lệ mức độ không được bằng 0.');
    const topics = (Array.isArray(bp?.topics) ? bp.topics : []).filter((t) => TOPIC_BY_CODE[t]);
    return { counts, levels, topics, durationMin: Math.max(5, Math.min(300, Math.floor(Number(bp?.durationMin) || 90))) };
  };
  route('GET', '/api/blueprints', STAFF, ({ user }) => ({
    blueprints: db
      .all('SELECT b.id, b.name, b.blueprint_json, b.shared, b.owner_id, b.created_at, u.display_name owner FROM blueprint_templates b JOIN users u ON u.id = b.owner_id WHERE b.school_id = ? AND (b.shared = 1 OR b.owner_id = ?) ORDER BY b.created_at DESC', user.school_id, user.id)
      .map((b) => ({ id: b.id, name: b.name, blueprint: b.blueprint, shared: !!b.shared, owner: b.owner, mine: b.owner_id === user.id })),
  }));
  route('POST', '/api/blueprints', STAFF, ({ user, body, ip }) => {
    const name = String(body.name ?? '').trim().slice(0, 80);
    if (!name) fail(400, 'Đặt tên cho mẫu.');
    const blueprint = cleanBlueprint(body.blueprint);
    const id = Number(db.run('INSERT INTO blueprint_templates (school_id, owner_id, name, blueprint_json, shared, created_at) VALUES (?,?,?,?,?,?)', user.school_id, user.id, name, JSON.stringify(blueprint), body.shared ? 1 : 0, now()).lastInsertRowid);
    audit(user, 'blueprint_create', name, ip, { target: `blueprint:${id}` });
    return { id };
  });
  route('DELETE', '/api/blueprints/:id', STAFF, ({ user, params, ip }) => {
    const b = db.get('SELECT * FROM blueprint_templates WHERE id = ?', params.id);
    if (!b) fail(404, 'Không tìm thấy mẫu.');
    const target = `blueprint:${b.id}`;
    if (b.school_id !== user.school_id) deny(user, 'blueprint_delete', target, 'Mẫu không thuộc trường của bạn.', ip);
    if (b.owner_id !== user.id && user.role !== 'admin') deny(user, 'blueprint_delete', target, 'Chỉ người tạo mẫu hoặc quản lý mới xóa được.', ip);
    db.run('DELETE FROM blueprint_templates WHERE id = ?', b.id);
    audit(user, 'blueprint_delete', b.name, ip, { target, old: b.blueprint });
    return { ok: true };
  });

  // ---- nhân bản đề ----
  route('POST', '/api/exams/:id/clone', STAFF, ({ user, params, body, ip }) => {
    const e = db.get('SELECT * FROM exams WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!e) fail(404, 'Không tìm thấy đề.');
    // Câu còn dùng được thì lấy bản mới nhất; câu đã bị lưu trữ giữ nguyên bản đã chụp để đề không đổi.
    const fresh = questionsMap(user.school_id, e.items.map((x) => x.qid));
    const snapshot = {};
    for (const it of e.items) snapshot[it.qid] = fresh[it.qid] && fresh[it.qid].status === 'approved' ? fresh[it.qid] : e.snapshot[it.qid];
    const items = e.items.map((x) => ({ ...x, group: snapshot[x.qid]?.group_id ?? x.group ?? null }));
    const variants = makeVariants(items, e.variants.length, `${user.id}-${now()}`);
    const title = String(body.title ?? '').trim() || `${e.title} (bản sao)`;
    const id = Number(
      db
        .run('INSERT INTO exams (school_id, title, blueprint_json, items_json, duration_min, variants_json, snapshot_json, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)', user.school_id, title, JSON.stringify(e.blueprint ?? {}), JSON.stringify(items), e.duration_min, JSON.stringify(variants), JSON.stringify(snapshot), user.id, now())
        .lastInsertRowid,
    );
    audit(user, 'exam_clone', `#${e.id} → #${id}`, ip, { target: `exam:${id}`, old: { from: e.id } });
    return { id };
  });

  route('POST', '/api/exams', STAFF, ({ user, body, ip }) => {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) fail(400, 'Đề chưa có câu nào.');
    if (!String(body.title ?? '').trim()) fail(400, 'Đặt tên đề.');
    const qmap = questionsMap(user.school_id, items.map((x) => Number(x.qid)));
    for (const it of items) {
      const q = qmap[it.qid];
      if (!q) fail(400, `Câu #${it.qid} không có trong ngân hàng của trường.`);
      if (q.status !== 'approved') fail(400, `Câu #${it.qid} chưa được duyệt. Chỉ câu đã duyệt mới vào đề.`);
    }
    const norm = items.map((x) => ({ qid: Number(x.qid), type: qmap[x.qid].type, topic: qmap[x.qid].topic, level: qmap[x.qid].level, group: qmap[x.qid].group_id ?? null }));
    const variants = makeVariants(norm, Number(body.variants) || 4, body.seed ?? `${user.id}-${now()}`);
    const r = db.run(
      'INSERT INTO exams (school_id, title, blueprint_json, items_json, duration_min, variants_json, snapshot_json, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      user.school_id,
      String(body.title).trim(),
      JSON.stringify(body.blueprint ?? {}),
      JSON.stringify(norm),
      Math.max(5, Number(body.durationMin) || 90),
      JSON.stringify(variants),
      JSON.stringify(qmap),
      user.id,
      now(),
    );
    audit(user, 'exam_create', `#${r.lastInsertRowid} ${body.title}`, ip);
    return { id: Number(r.lastInsertRowid) };
  });
  route('GET', '/api/exams', STAFF, ({ user }) => {
    const rows = db.all('SELECT e.id, e.title, e.items_json, e.duration_min, e.created_at, u.display_name author FROM exams e JOIN users u ON u.id = e.created_by WHERE e.school_id = ? ORDER BY e.created_at DESC', user.school_id);
    return {
      exams: rows.map((e) => ({ id: e.id, title: e.title, durationMin: e.duration_min, createdAt: e.created_at, author: e.author, counts: { mcq: e.items.filter((x) => x.type === 'mcq').length, tf: e.items.filter((x) => x.type === 'tf').length, short: e.items.filter((x) => x.type === 'short').length } })),
    };
  });
  route('GET', '/api/exams/:id', STAFF, ({ user, params }) => {
    const e = db.get('SELECT * FROM exams WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!e) fail(404, 'Không tìm thấy đề.');
    return { exam: { id: e.id, title: e.title, durationMin: e.duration_min, items: e.items, variants: e.variants.map((v) => v.code), blueprint: e.blueprint }, questions: e.snapshot };
  });
  route('GET', '/api/exams/:id/answer-key', STAFF, ({ user, params }) => {
    const e = db.get('SELECT * FROM exams WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!e) fail(404, 'Không tìm thấy đề.');
    return crossAnswerKey(e.items, e.variants.map((v) => ({ code: v.code, layout: variantLayout(e.id, e.items, v) })), e.snapshot);
  });
  route('GET', '/api/exams/:id/docx', STAFF, async ({ user, params, query, ip }) => {
    const e = db.get('SELECT * FROM exams WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!e) fail(404, 'Không tìm thấy đề.');
    const school = db.get('SELECT name FROM schools WHERE id = ?', user.school_id);
    const variants = e.variants.map((v) => ({ code: v.code, layout: variantLayout(e.id, e.items, v) }));
    const buf = await examToDocx({ title: e.title, school: school.name, durationMin: e.duration_min }, variants, e.snapshot, { withSolutions: query.solutions === '1', baseItems: e.items, imageResolver: imageResolver(user.school_id) });
    audit(user, 'exam_export_docx', `#${e.id}`, ip, { target: `exam:${e.id}` });
    const safe = e.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w-]+/g, '-').slice(0, 60);
    return { __file: { name: `${safe || 'de-thi'}.docx`, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: buf } };
  });

  // ---- lớp, giao đề, báo cáo ----
  route('GET', '/api/classes', STAFF, ({ user }) => {
    const ids = teacherClassIds(user);
    if (!ids.length) return { classes: [] };
    const rows = db.all(
      `SELECT c.id, c.name, c.grade, u.display_name teacher, (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id AND s.role = 'student' AND s.active = 1) students
       FROM classes c LEFT JOIN users u ON u.id = c.teacher_id WHERE c.id IN (${ids.map(() => '?').join(',')}) ORDER BY c.grade DESC, c.name`,
      ...ids,
    );
    return { classes: rows };
  });
  // ---- từ kết quả đến hành động: nhóm yếu → phiếu luyện ----
  function classWeakGroups(cid, minN = 3) {
    const students = db.all("SELECT id, display_name FROM users WHERE class_id = ? AND role = 'student' AND active = 1 ORDER BY display_name", cid);
    const ev = db.all('SELECT e.student_id, e.topic, e.level, e.score, e.at FROM evidence e JOIN users u ON u.id = e.student_id WHERE u.class_id = ? AND e.topic IS NOT NULL', cid);
    const byStudent = {};
    for (const e of ev) (byStudent[e.student_id] ??= []).push(e);
    const groups = {};
    for (const s of students) {
      for (const m of Object.values(computeMastery(byStudent[s.id] ?? [], now()))) {
        if (m.n >= minN && m.value < 0.5) (groups[m.topic] ??= []).push({ id: s.id, name: s.display_name, value: m.value, n: m.n });
      }
    }
    return Object.entries(groups)
      .map(([topic, list]) => ({ topic, name: TOPIC_BY_CODE[topic]?.name ?? topic, students: list.sort((x, y) => x.value - y.value) }))
      .sort((x, y) => y.students.length - x.students.length || x.topic.localeCompare(y.topic));
  }
  route('GET', '/api/classes/:id/weak-groups', STAFF, ({ user, params }) => {
    const cid = Number(params.id);
    if (!teacherClassIds(user).includes(cid)) fail(404, 'Không tìm thấy lớp.');
    return { groups: classWeakGroups(cid) };
  });
  route('POST', '/api/classes/:id/practice-assignment', STAFF, ({ user, params, body, ip }) => {
    const cid = Number(params.id);
    const target = `class:${cid}`;
    const cls = db.get('SELECT * FROM classes WHERE id = ?', cid);
    if (!cls) fail(404, 'Không tìm thấy lớp.');
    if (cls.school_id !== user.school_id) deny(user, 'practice_assign', target, 'Lớp không thuộc trường của bạn.', ip);
    if (!teacherClassIds(user).includes(cid)) deny(user, 'practice_assign', target, 'Bạn không phụ trách lớp này.', ip);
    const topic = String(body.topic ?? '');
    if (!TOPIC_BY_CODE[topic]) fail(400, 'Chọn chuyên đề.');
    const classStudents = db.all("SELECT id FROM users WHERE class_id = ? AND role = 'student' AND active = 1", cid).map((r) => r.id);
    let ids;
    if (Array.isArray(body.studentIds) && body.studentIds.length) {
      ids = [...new Set(body.studentIds.map(Number))];
      if (ids.some((id) => !classStudents.includes(id))) fail(400, 'Có học sinh không thuộc lớp này.');
    } else {
      ids = (classWeakGroups(cid).find((g) => g.topic === topic)?.students ?? []).map((s) => s.id);
    }
    if (!ids.length) fail(400, 'Chưa có học sinh nào yếu chuyên đề này (cần ít nhất 3 câu đã làm). Chọn học sinh thủ công.');
    const count = Math.min(30, Math.max(3, Math.floor(Number(body.count) || 10)));
    const pool = db.all("SELECT id, type, topic, level, status FROM questions WHERE school_id = ? AND status = 'approved' AND topic = ?", user.school_id, topic);
    if (!pool.length) fail(400, 'Ngân hàng chưa có câu đã duyệt cho chuyên đề này.');
    const avail = { mcq: 0, tf: 0, short: 0 };
    for (const q of pool) avail[q.type]++;
    const want = apportion(count, { mcq: avail.mcq ? 6 : 0, tf: avail.tf ? 1.5 : 0, short: avail.short ? 2.5 : 0 });
    const counts = Object.fromEntries(Object.keys(avail).map((t) => [t, Math.min(avail[t], want[t] ?? 0)]));
    // Ưu tiên câu các em này chưa làm
    const done = db.all(`SELECT DISTINCT qid FROM evidence WHERE student_id IN (${ids.map(() => '?').join(',')})`, ...ids).map((r) => r.qid);
    const res = generateExam(pool, { counts, levels: { 1: 40, 2: 40, 3: 20 }, topics: [topic], avoidIds: done, seed: `${user.id}-${now()}` });
    if (!res.items.length) fail(400, 'Không chọn được câu nào cho phiếu luyện.');
    const qmap = questionsMap(user.school_id, res.items.map((x) => x.qid));
    const items = res.items.map((x) => ({ qid: x.qid, type: x.type, topic: x.topic, level: x.level, group: qmap[x.qid].group_id ?? null }));
    const title = String(body.title ?? '').trim() || `Phiếu luyện: ${TOPIC_BY_CODE[topic].name}`;
    const variants = makeVariants(items, 1, `${user.id}-${now()}`);
    const closeAt = now() + Math.min(30, Math.max(1, Number(body.days) || 7)) * 86400000;
    const out = db.tx(() => {
      const examId = Number(
        db
          .run('INSERT INTO exams (school_id, title, blueprint_json, items_json, duration_min, variants_json, snapshot_json, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)', user.school_id, title, JSON.stringify({ counts, topic }), JSON.stringify(items), 45, JSON.stringify(variants), JSON.stringify(qmap), user.id, now())
          .lastInsertRowid,
      );
      const assignmentId = Number(
        db
          .run(
            'INSERT INTO assignments (school_id, exam_id, class_id, mode, title, open_at, close_at, duration_min, show_result, created_by, created_at, variant_mode, variant_map_json, target_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            user.school_id,
            examId,
            cid,
            'homework',
            title,
            now(),
            closeAt,
            45,
            'after_submit',
            user.id,
            now(),
            'random',
            JSON.stringify(Object.fromEntries(ids.map((id) => [id, variants[0].code]))),
            JSON.stringify(ids),
          )
          .lastInsertRowid,
      );
      return { examId, assignmentId };
    });
    audit(user, 'practice_assign', `${ids.length} học sinh, ${items.length} câu, ${TOPIC_BY_CODE[topic].name}`, ip, { target: `assignment:${out.assignmentId}`, new: { topic, students: ids, items: items.length } });
    return { ...out, students: ids.length, items: items.length, warnings: res.warnings, shortages: res.shortages };
  });

  route('GET', '/api/classes/:id', STAFF, ({ user, params }) => {
    const id = Number(params.id);
    if (!teacherClassIds(user).includes(id)) fail(403, 'Bạn không phụ trách lớp này.');
    sweepExpired('AND assignment_id IN (SELECT id FROM assignments WHERE class_id = ?)', id);
    const cls = db.get('SELECT id, name, grade FROM classes WHERE id = ?', id);
    const students = db.all("SELECT id, display_name, username, xp, streak, last_active_day FROM users WHERE class_id = ? AND role = 'student' AND active = 1 ORDER BY display_name", id);
    const heat = {};
    const ev = db.all(`SELECT e.student_id, e.topic, e.level, e.score, e.at FROM evidence e JOIN users u ON u.id = e.student_id WHERE u.class_id = ? AND e.topic IS NOT NULL`, id);
    const byStudent = {};
    for (const e of ev) (byStudent[e.student_id] ??= []).push(e);
    const classEv = ev;
    for (const s of students) heat[s.id] = computeMastery(byStudent[s.id] ?? [], now());
    const classMastery = Object.values(computeMastery(classEv, now())).sort((a, b) => a.value - b.value);
    const errors = db.all(`SELECT e.error_type, COUNT(*) n FROM evidence e JOIN users u ON u.id = e.student_id WHERE u.class_id = ? AND e.correct = 0 AND e.error_type IS NOT NULL GROUP BY e.error_type`, id);
    const assignments = db.all('SELECT a.id, a.title, a.mode, a.open_at, a.close_at, (SELECT COUNT(*) FROM attempts t WHERE t.assignment_id = a.id AND t.status != ?) submitted, (SELECT AVG(score10) FROM attempts t WHERE t.assignment_id = a.id AND t.status != ?) avg FROM assignments a WHERE a.class_id = ? ORDER BY a.open_at DESC', 'in_progress', 'in_progress', id);
    const actions = [];
    for (const m of classMastery.filter((m) => m.band === 'weak' && m.n >= 6).slice(0, 3)) actions.push({ kind: 'reteach', topic: m.topic, text: `Dạy lại chuyên đề "${m.name}" cho cả lớp — năng lực chung ${Math.round(m.value * 100)}%.` });
    const lowStudents = students.filter((s) => {
      const vals = Object.values(heat[s.id]);
      return vals.length >= 2 && vals.filter((v) => v.band === 'weak').length >= Math.ceil(vals.length / 2);
    });
    if (lowStudents.length) actions.push({ kind: 'tutor', students: lowStudents.map((s) => s.id), text: `Kèm riêng ${lowStudents.length} em yếu ở hơn nửa số chuyên đề: ${lowStudents.map((s) => s.display_name).join(', ')}.` });
    return { class: cls, students, heat, classMastery, errors: Object.fromEntries(errors.map((e) => [e.error_type, e.n])), assignments, actions };
  });
  route('POST', '/api/assignments', STAFF, ({ user, body, ip }) => {
    const exam = db.get('SELECT * FROM exams WHERE id = ? AND school_id = ?', body.examId, user.school_id);
    if (!exam) fail(400, 'Chọn đề để giao.');
    const classIds = (Array.isArray(body.classIds) ? body.classIds : [body.classId]).map(Number).filter(Boolean);
    if (!classIds.length) fail(400, 'Chọn ít nhất một lớp.');
    const mine = teacherClassIds(user);
    for (const c of classIds) if (!mine.includes(c)) fail(403, 'Bạn chỉ giao đề cho lớp mình phụ trách.');
    const mode = body.mode === 'homework' ? 'homework' : 'exam';
    const openAt = Number(body.openAt) || now();
    const closeAt = Number(body.closeAt) || openAt + 7 * 86400000;
    if (closeAt <= openAt) fail(400, 'Giờ đóng phải sau giờ mở.');
    const duration = Math.max(5, Number(body.durationMin) || exam.duration_min);
    const codes = exam.variants.map((v) => v.code);
    const variantMode = body.variantMode === 'list' ? 'list' : 'random';
    const list = variantMode === 'list' && body.variantList && typeof body.variantList === 'object' ? body.variantList : {};
    const plans = classIds.map((c) => {
      const studentIds = db.all("SELECT id FROM users WHERE class_id = ? AND school_id = ? AND role = 'student' AND active = 1 ORDER BY id", c, user.school_id).map((r) => r.id);
      const own = Object.fromEntries(Object.entries(list).filter(([sid]) => studentIds.includes(Number(sid))));
      const res = assignVariants({ studentIds, codes, mode: variantMode, seed: `${exam.id}-${c}-${body.variantSeed ?? now()}`, list: own });
      if (res.errors.length) fail(400, res.errors.join(' '));
      return res.map;
    });
    const covered = new Set(plans.flatMap((m) => Object.keys(m)));
    for (const sid of Object.keys(list)) if (!covered.has(String(sid))) fail(400, `Học sinh #${sid} không thuộc lớp được giao.`);
    const ids = db.tx(() =>
      classIds.map((c, i) =>
        Number(
          db.run(
            'INSERT INTO assignments (school_id, exam_id, class_id, mode, title, open_at, close_at, duration_min, show_result, created_by, created_at, variant_mode, variant_map_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            user.school_id,
            exam.id,
            c,
            mode,
            String(body.title || exam.title),
            openAt,
            closeAt,
            duration,
            body.showResult === 'after_close' ? 'after_close' : 'after_submit',
            user.id,
            now(),
            variantMode,
            JSON.stringify(plans[i]),
          ).lastInsertRowid,
        ),
      ),
    );
    audit(user, 'assignment_create', `đề #${exam.id} → lớp ${classIds.join(',')}`, ip);
    return { ids };
  });
  route('GET', '/api/assignments/:id/variants', STAFF, ({ user, params }) => {
    const a = db.get('SELECT * FROM assignments WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!a || !teacherClassIds(user).includes(a.class_id)) fail(404, 'Không tìm thấy bài giao.');
    const students = targeted(a, db.all("SELECT id, display_name FROM users WHERE class_id = ? AND role = 'student' AND active = 1 ORDER BY display_name", a.class_id));
    return { mode: a.variant_mode, students: students.map((s) => ({ id: s.id, name: s.display_name, code: a.variant_map?.[s.id] ?? null })) };
  });
  route('GET', '/api/assignments', STAFF, ({ user }) => {
    const ids = teacherClassIds(user);
    if (!ids.length) return { assignments: [] };
    sweepExpired(`AND assignment_id IN (SELECT id FROM assignments WHERE class_id IN (${ids.map(() => '?').join(',')}))`, ...ids);
    const rows = db.all(
      `SELECT a.*, c.name class_name, (SELECT COUNT(*) FROM users s WHERE s.class_id = a.class_id AND s.role='student' AND s.active = 1) students,
       (SELECT COUNT(*) FROM attempts t WHERE t.assignment_id = a.id AND t.status != 'in_progress') submitted,
       (SELECT COUNT(*) FROM attempts t WHERE t.assignment_id = a.id AND t.status = 'in_progress') doing,
       (SELECT AVG(score10) FROM attempts t WHERE t.assignment_id = a.id AND t.status != 'in_progress') avg
       FROM assignments a JOIN classes c ON c.id = a.class_id WHERE a.class_id IN (${ids.map(() => '?').join(',')}) ORDER BY a.open_at DESC`,
      ...ids,
    );
    return { assignments: rows };
  });
  route('GET', '/api/assignments/:id/report', STAFF, ({ user, params, ip }) => {
    const a = db.get('SELECT a.*, c.name class_name FROM assignments a JOIN classes c ON c.id = a.class_id WHERE a.id = ? AND a.school_id = ?', params.id, user.school_id);
    if (!a || !teacherClassIds(user).includes(a.class_id)) fail(404, 'Không tìm thấy bài giao.');
    sweepExpired('AND assignment_id = ?', a.id);
    const exam = db.get('SELECT * FROM exams WHERE id = ?', a.exam_id);
    const students = targeted(a, db.all("SELECT id, display_name FROM users WHERE class_id = ? AND role = 'student' AND active = 1 ORDER BY display_name", a.class_id));
    const atts = db.all('SELECT * FROM attempts WHERE assignment_id = ?', a.id);
    const byStudent = Object.fromEntries(atts.map((t) => [t.student_id, t]));
    const done = atts.filter((t) => t.status !== 'in_progress');
    const qmap = exam.snapshot;
    // Phân tích câu hỏi: tỉ lệ điểm, độ phân biệt (27% trên – 27% dưới), phương án bị chọn.
    const sorted = done.slice().sort((x, y) => y.score10 - x.score10);
    const k = Math.max(1, Math.round(sorted.length * 0.27));
    const upper = sorted.slice(0, k);
    const lower = sorted.slice(-k);
    const itemScore = (t, qid) => {
      const it = t.result?.items?.find((x) => x.qid === qid);
      return it ? it.points / it.max : 0;
    };
    const items = exam.items.map((it) => {
      const q = qmap[it.qid];
      const p = done.length ? done.reduce((s, t) => s + itemScore(t, it.qid), 0) / done.length : null;
      const disc = sorted.length >= 4 ? upper.reduce((s, t) => s + itemScore(t, it.qid), 0) / k - lower.reduce((s, t) => s + itemScore(t, it.qid), 0) / k : null;
      let choices = null;
      if (q.type === 'mcq') {
        choices = [0, 0, 0, 0, 0];
        for (const t of done) {
          const layoutItem = t.layout.find((x) => x.qid === it.qid);
          const r = toOriginalResponse(layoutItem, t.responses?.[it.qid]);
          if (Number.isInteger(r)) choices[r]++;
          else choices[4]++;
        }
      }
      const flags = [];
      if (p !== null && done.length >= 5 && p < 0.2) flags.push('Quá khó hoặc sai đáp án — kiểm tra lại');
      if (p !== null && done.length >= 5 && p > 0.95) flags.push('Quá dễ');
      if (disc !== null && disc < 0) flags.push('Độ phân biệt âm — học sinh giỏi sai nhiều hơn, nghi đáp án sai');
      if (choices && done.length >= 5) {
        const top = choices.slice(0, 4).map((n, i) => ({ n, i })).sort((x, y) => y.n - x.n)[0];
        if (top.i !== q.answer && top.n > choices[q.answer]) flags.push(`Phương án ${'ABCD'[top.i]} (gốc) được chọn nhiều hơn đáp án`);
      }
      return { qid: it.qid, type: q.type, topic: q.topic, level: q.level, stem: q.stem, options: q.options, answer: q.answer, p, disc, choices, flags };
    });
    const errorCount = { concept: 0, formula: 0, transform: 0, careless: 0 };
    for (const t of done) for (const [kk, v] of Object.entries(t.diagnosis?.errorCount ?? {})) errorCount[kk] = (errorCount[kk] ?? 0) + v;
    const topicAgg = {};
    for (const t of done)
      for (const tp of t.diagnosis?.topics ?? []) {
        const x = (topicAgg[tp.topic] ??= { topic: tp.topic, name: tp.name, points: 0, max: 0 });
        x.points += tp.points;
        x.max += tp.max;
      }
    const hist = Array(11).fill(0);
    for (const t of done) hist[Math.min(10, Math.floor(t.score10))]++;
    audit(user, 'report_view', `bài giao #${a.id}`, ip);
    return {
      assignment: { id: a.id, title: a.title, mode: a.mode, className: a.class_name, openAt: a.open_at, closeAt: a.close_at, durationMin: a.duration_min, examId: a.exam_id },
      summary: {
        students: students.length,
        submitted: done.length,
        doing: atts.length - done.length,
        avg: done.length ? Math.round((done.reduce((s, t) => s + t.score10, 0) / done.length) * 100) / 100 : null,
        hist,
      },
      rows: students.map((s) => {
        const t = byStudent[s.id];
        const ev = t?.events ?? [];
        return {
          studentId: s.id,
          name: s.display_name,
          status: t ? t.status : 'not_started',
          score10: t && t.status !== 'in_progress' ? t.score10 : null,
          byPart: t?.result?.byPart ?? null,
          dominantError: t?.diagnosis?.dominantError ?? null,
          attemptId: t?.id ?? null,
          signals: {
            hidden: ev.filter((e) => e.type === 'hidden' || e.type === 'blur').length,
            fullscreenExit: ev.filter((e) => e.type === 'fullscreen_exit').length,
            paste: ev.filter((e) => e.type === 'paste').length,
            secondDevice: ev.filter((e) => e.type === 'second_device').length,
            offline: ev.filter((e) => e.type === 'offline').length,
          },
          late: t?.late ? { at: t.late.at, accepted: !!t.late.accepted } : null,
        };
      }),
      items,
      errorCount,
      topics: Object.values(topicAgg).map((x) => ({ ...x, ratio: x.max ? x.points / x.max : 0 })).sort((x, y) => x.ratio - y.ratio),
    };
  });
  route('DELETE', '/api/questions/:id', STAFF, ({ user, params, body, ip }) => {
    const q = db.get('SELECT * FROM questions WHERE id = ?', params.id);
    if (!q) fail(404, 'Không tìm thấy câu hỏi.');
    const target = `question:${q.id}`;
    if (q.school_id !== user.school_id) deny(user, 'question_delete', target, 'Câu hỏi không thuộc trường của bạn.', ip);
    if (user.role !== 'admin' && q.created_by !== user.id) deny(user, 'question_delete', target, 'Chỉ người tạo câu hoặc quản lý mới xóa được câu này.', ip);
    const reason = needReason(body);
    // Xóa mềm: câu chuyển sang "lưu trữ", đề đã giao và lịch sử làm bài giữ nguyên.
    db.run("UPDATE questions SET status = 'archived', updated_at = ? WHERE id = ?", now(), q.id);
    audit(user, 'question_delete', `#${q.id}`, ip, { target, old: { status: q.status, stem: String(q.stem).slice(0, 120) }, new: { status: 'archived' }, reason });
    return { ok: true };
  });
  route('POST', '/api/attempts/:id/reopen', STAFF, ({ user, params, body, ip }) => {
    const { att } = staffAttempt(user, params.id, 'attempt_reopen', ip);
    const reason = needReason(body);
    if (att.status === 'in_progress') fail(400, 'Bài đang làm, không cần mở lại.');
    const minutes = Math.min(180, Math.max(5, Number(body.minutes) || 15));
    const deadline = now() + minutes * 60000;
    db.tx(() => {
      db.run('DELETE FROM evidence WHERE attempt_id = ?', att.id);
      db.run("UPDATE attempts SET status = 'in_progress', submitted_at = NULL, score10 = NULL, points = NULL, max_points = NULL, result_json = NULL, diagnosis_json = NULL, late_json = NULL, deadline_at = ? WHERE id = ?", deadline, att.id);
    });
    audit(user, 'attempt_reopen', `bài làm #${att.id}`, ip, { target: `attempt:${att.id}`, old: { status: att.status, score10: att.score10, deadline_at: att.deadline_at }, new: { status: 'in_progress', deadline_at: deadline }, reason });
    return { ok: true, deadlineAt: deadline };
  });
  route('POST', '/api/attempts/:id/score', STAFF, ({ user, params, body, ip }) => {
    const { att } = staffAttempt(user, params.id, 'score_edit', ip);
    const reason = needReason(body);
    if (att.status === 'in_progress') fail(400, 'Bài chưa nộp, chưa sửa điểm được.');
    const score = Number(body.score10);
    if (body.score10 === undefined || body.score10 === null || body.score10 === '' || !Number.isFinite(score) || score < 0 || score > 10) fail(400, 'Điểm phải từ 0 đến 10.');
    const score10 = Math.round(score * 100) / 100;
    const points = Math.round((score10 / 10) * (att.max_points ?? 0) * 100) / 100;
    db.run('UPDATE attempts SET score10 = ?, points = ? WHERE id = ?', score10, points, att.id);
    audit(user, 'score_edit', `bài làm #${att.id}`, ip, { target: `attempt:${att.id}`, old: { score10: att.score10, points: att.points }, new: { score10, points }, reason });
    return { ok: true, score10 };
  });
  route('POST', '/api/attempts/:id/extend', STAFF, ({ user, params, body, ip }) => {
    const { att } = staffAttempt(user, params.id, 'attempt_extend', ip);
    if (att.status !== 'in_progress') fail(400, 'Chỉ gia hạn được bài đang làm. Với bài đã nộp hãy mở lại.');
    if (!Number(body.minutes)) fail(400, 'Nhập số phút gia hạn.');
    const minutes = Math.min(120, Math.max(1, Number(body.minutes)));
    const deadline = (att.deadline_at ?? now()) + minutes * 60000;
    db.run('UPDATE attempts SET deadline_at = ? WHERE id = ?', deadline, att.id);
    audit(user, 'attempt_extend', `bài làm #${att.id} +${minutes} phút`, ip, { target: `attempt:${att.id}`, old: { deadline_at: att.deadline_at }, new: { deadline_at: deadline }, reason: body.reason });
    return { ok: true, deadlineAt: deadline };
  });
  route('POST', '/api/assignments/:id/extend', STAFF, ({ user, params, body, ip }) => {
    const a = db.get('SELECT * FROM assignments WHERE id = ?', params.id);
    if (!a) fail(404, 'Không tìm thấy bài giao.');
    const target = `assignment:${a.id}`;
    if (a.school_id !== user.school_id) deny(user, 'assignment_extend', target, 'Bài giao không thuộc trường của bạn.', ip);
    if (!teacherClassIds(user).includes(a.class_id)) deny(user, 'assignment_extend', target, 'Bạn không phụ trách lớp này.', ip);
    const closeAt = Number(body.closeAt) || a.close_at + Math.min(14 * 1440, Math.max(0, Number(body.minutes) || 0)) * 60000;
    if (closeAt <= a.close_at) fail(400, 'Giờ đóng mới phải sau giờ đóng hiện tại.');
    db.tx(() => {
      db.run('UPDATE assignments SET close_at = ? WHERE id = ?', closeAt, a.id);
      db.run("UPDATE attempts SET deadline_at = ? WHERE assignment_id = ? AND status = 'in_progress' AND deadline_at = ?", closeAt, a.id, a.close_at);
    });
    audit(user, 'assignment_extend', `bài giao #${a.id}`, ip, { target, old: { close_at: a.close_at }, new: { close_at: closeAt }, reason: body.reason });
    return { ok: true, closeAt };
  });
  // Bảng điểm một bài giao (dùng chung cho CSV và Excel).
  const STATUS_VI = { in_progress: 'Đang làm', submitted: 'Đã nộp', auto_submitted: 'Tự nộp khi hết giờ' };
  function exportableAssignment(user, id, ip) {
    const a = db.get('SELECT * FROM assignments WHERE id = ?', id);
    if (!a) fail(404, 'Không tìm thấy bài giao.');
    const target = `assignment:${a.id}`;
    if (a.school_id !== user.school_id) deny(user, 'data_export', target, 'Bài giao không thuộc trường của bạn.', ip);
    if (!teacherClassIds(user).includes(a.class_id)) deny(user, 'data_export', target, 'Bạn không phụ trách lớp này.', ip);
    sweepExpired('AND assignment_id = ?', a.id);
    const cls = db.get('SELECT name FROM classes WHERE id = ?', a.class_id);
    const rows = targeted(a, db.all("SELECT u.id, u.display_name, u.username, t.variant_code, t.status, t.score10, t.submitted_at FROM users u LEFT JOIN attempts t ON t.student_id = u.id AND t.assignment_id = ? WHERE u.class_id = ? AND u.role = 'student' AND u.active = 1 ORDER BY u.display_name", a.id, a.class_id));
    const table = rows.map((r) => {
      const done = r.status && r.status !== 'in_progress';
      return [r.display_name, r.username, r.variant_code ?? '', STATUS_VI[r.status] ?? 'Chưa làm', done ? r.score10 : '', done && r.submitted_at ? fmtVn(r.submitted_at) : ''];
    });
    return { a, cls, target, table };
  }
  const fmtVn = (ms) => new Date(ms + 7 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  const SCORE_HEAD = ['Họ tên', 'Tên đăng nhập', 'Mã đề', 'Trạng thái', 'Điểm', 'Nộp lúc'];
  route('GET', '/api/assignments/:id/export.csv', STAFF, ({ user, params, ip }) => {
    const { a, table, target } = exportableAssignment(user, params.id, ip);
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [SCORE_HEAD.join(','), ...table.map((r) => r.map(cell).join(','))].join('\r\n');
    audit(user, 'data_export', `điểm bài giao #${a.id} (CSV): ${table.length} dòng`, ip, { target });
    return { __file: { name: `diem-bai-giao-${a.id}.csv`, type: 'text/csv; charset=utf-8', data: Buffer.from(csv, 'utf8') } };
  });
  route('GET', '/api/assignments/:id/export.xlsx', STAFF, async ({ user, params, ip }) => {
    const { a, cls, table, target } = exportableAssignment(user, params.id, ip);
    const data = await buildXlsx([{ name: `Điểm ${cls.name}`, columns: SCORE_HEAD.map((h, i) => ({ header: h, width: [26, 18, 8, 20, 8, 17][i] })), rows: table }]);
    audit(user, 'data_export', `điểm bài giao #${a.id} (Excel): ${table.length} dòng`, ip, { target });
    return { __file: { name: `diem-bai-giao-${a.id}.xlsx`, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data } };
  });
  // Xuất ngân hàng câu hỏi đúng định dạng mẫu nhập (xuất ra rồi nhập lại được).
  route('GET', '/api/questions/export.xlsx', STAFF, async ({ user, query, ip }) => {
    const where = ['school_id = ?', "status != 'archived'"];
    const p = [user.school_id];
    if (query.status && query.status !== 'all') (where.push('status = ?'), p.push(query.status));
    if (query.topic) (where.push('topic = ?'), p.push(query.topic));
    if (query.type) (where.push('type = ?'), p.push(query.type));
    const qs = db.all(`SELECT * FROM questions WHERE ${where.join(' AND ')} ORDER BY id LIMIT 5000`, ...p).map(toQuestion);
    const kind = { mcq: 'TN', tf: 'DS', short: 'TLN' };
    const rows = qs.map((q) => [kind[q.type], q.stem, ...(q.type === 'short' ? ['', '', '', ''] : q.options), q.type === 'mcq' ? 'ABCD'[q.answer] : q.type === 'tf' ? q.answer.map((x) => (x ? 'Đ' : 'S')).join('') : String(q.answer ?? ''), q.topic ?? '', q.level, q.explanation ?? '']);
    const data = await buildXlsx([{ name: 'Câu hỏi', columns: SHEET_HEADERS.map((h, i) => ({ header: h, width: [8, 60, 24, 24, 24, 24, 10, 16, 8, 50][i] })), rows }]);
    audit(user, 'data_export', `ngân hàng câu hỏi (Excel): ${rows.length} câu`, ip, { target: 'questions' });
    return { __file: { name: 'ngan-hang-cau-hoi.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data } };
  });
  route('POST', '/api/attempts/:id/accept-late', STAFF, ({ user, params, ip }) => {
    const att = db.get('SELECT * FROM attempts WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!att || !att.late || att.late.accepted) fail(400, 'Bài này không có bản đồng bộ muộn chờ duyệt.');
    const asg = db.get('SELECT class_id FROM assignments WHERE id = ?', att.assignment_id);
    if (!teacherClassIds(user).includes(asg.class_id)) fail(403, 'Bạn không phụ trách lớp này.');
    db.tx(() => {
      db.run('DELETE FROM evidence WHERE attempt_id = ?', att.id);
      finalize({ ...att, checked: {} }, att.late.responses, att.late.times, att.status);
      db.run('UPDATE attempts SET late_json = ? WHERE id = ?', JSON.stringify({ ...att.late, accepted: true, acceptedBy: user.id }), att.id);
    });
    audit(user, 'late_accept', `bài làm #${att.id}`, ip, { target: `attempt:${att.id}`, old: { score10: att.score10 }, new: { score10: db.get('SELECT score10 FROM attempts WHERE id = ?', att.id).score10 } });
    return { ok: true };
  });
  route('GET', '/api/teacher/attempts/:id', STAFF, ({ user, params, ip }) => {
    const att = db.get('SELECT * FROM attempts WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!att || !canSeeStudent(user, att.student_id)) fail(404, 'Không tìm thấy bài làm.');
    audit(user, 'attempt_view', `bài làm #${att.id}`, ip);
    const view = attemptView(att);
    if (att.status !== 'in_progress') view.result = resultDetail(att, attemptQuestions(att));
    view.events = att.events;
    view.student = db.get('SELECT display_name FROM users WHERE id = ?', att.student_id).display_name;
    return view;
  });
  route('GET', '/api/students/:id/profile', ['admin', 'teacher', 'student'], ({ user, params, ip }) => {
    const id = Number(params.id);
    if (!canSeeStudent(user, id)) fail(404, 'Không tìm thấy học sinh.');
    if (user.role !== 'student') audit(user, 'student_profile_view', `học sinh #${id}`, ip);
    return studentProfile(id);
  });

  // ---- học sinh ----
  route('GET', '/api/student/home', ['student'], ({ user }) => {
    sweepExpired('AND student_id = ?', user.id);
    const t = now();
    const asg = db.all(
      `SELECT a.id, a.title, a.mode, a.open_at, a.close_at, a.duration_min, a.show_result, t.id attempt_id, t.status, t.score10, t.deadline_at
       FROM assignments a LEFT JOIN attempts t ON t.assignment_id = a.id AND t.student_id = ? WHERE a.class_id = ? AND (a.target_json IS NULL OR EXISTS (SELECT 1 FROM json_each(a.target_json) j WHERE j.value = ?)) ORDER BY a.close_at ASC`,
      user.id,
      user.class_id ?? -1,
      user.id,
    );
    const items = asg.map((a) => ({
      ...a,
      score10: a.status && a.status !== 'in_progress' && (a.show_result === 'after_submit' || t > a.close_at) ? a.score10 : null,
      state: a.status && a.status !== 'in_progress' ? 'done' : a.status === 'in_progress' ? 'doing' : t < a.open_at ? 'upcoming' : t > a.close_at ? 'missed' : 'open',
    }));
    const profile = studentProfile(user.id);
    const today = db.get('SELECT questions, correct FROM activity WHERE student_id = ? AND day = ?', user.id, dayKey(t)) ?? { questions: 0, correct: 0 };
    const fresh = db.get('SELECT xp, streak, last_active_day FROM users WHERE id = ?', user.id);
    const streakAlive = fresh.last_active_day === dayKey(t) || fresh.last_active_day === dayKey(t - 86400000);
    return {
      assignments: items,
      practiceInProgress: db.get("SELECT id, title FROM attempts WHERE student_id = ? AND kind = 'practice' AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1", user.id) ?? null,
      today: { ...today, goal: DAY_GOAL },
      xp: fresh.xp,
      streak: streakAlive ? fresh.streak : 0,
      mastery: profile.mastery,
      recommendations: profile.recommendations,
      errorCount: profile.errorCount,
      review: profile.review,
      days: profile.days,
    };
  });
  // Chỉ dữ liệu của chính học sinh đang đăng nhập (không nhận mã học sinh từ đường dẫn).
  route('GET', '/api/student/progress', ['student'], ({ user }) => {
    const t = now();
    const evidence = db.all('SELECT topic, level, score, at FROM evidence WHERE student_id = ? AND topic IS NOT NULL AND at > ?', user.id, t - 90 * 86400000);
    const activity = db.all('SELECT day, questions, correct FROM activity WHERE student_id = ? AND day >= ?', user.id, dayKey(t - 120 * 86400000));
    const reviewDue = db.get('SELECT COUNT(*) n FROM review_items WHERE student_id = ? AND due_day <= ?', user.id, dayKey(t)).n;
    return buildProgress({ evidence, activity, reviewDue, nowMs: t, dayGoal: DAY_GOAL });
  });
  route('POST', '/api/attempts/start', ['student'], ({ user, body, ip }) => {
    const a = db.get('SELECT * FROM assignments WHERE id = ? AND school_id = ?', body.assignmentId, user.school_id);
    if (!a || a.class_id !== user.class_id || (Array.isArray(a.target) && !a.target.includes(user.id))) fail(404, 'Không tìm thấy bài được giao.');
    const existing = db.get('SELECT * FROM attempts WHERE assignment_id = ? AND student_id = ?', a.id, user.id);
    if (existing) return attemptView(finalizeIfExpired(existing));
    const t = now();
    if (t < a.open_at) fail(400, 'Bài chưa mở. Quay lại đúng giờ mở bài.');
    if (t > a.close_at) fail(400, 'Bài đã đóng. Hỏi giáo viên nếu cần làm bù.');
    const exam = db.get('SELECT * FROM exams WHERE id = ?', a.exam_id);
    // Mã đề: theo bảng chia của bài giao; em vào lớp sau khi giao thì chia theo băm cố định.
    const codes = exam.variants.map((v) => v.code);
    let code = a.variant_map?.[user.id];
    if (!codes.includes(code)) code = codes[hashSeed(`${a.id}-${user.id}`) % codes.length];
    const variant = exam.variants.find((v) => v.code === code);
    const layout = variantLayout(exam.id, exam.items, variant);
    const deadline = a.mode === 'exam' ? Math.min(t + a.duration_min * 60000, a.close_at) : a.close_at;
    const r = db.run(
      'INSERT INTO attempts (school_id, assignment_id, student_id, kind, title, layout_json, started_at, deadline_at, client_id, variant_code) VALUES (?,?,?,?,?,?,?,?,?,?)',
      user.school_id,
      a.id,
      user.id,
      'assignment',
      a.title,
      JSON.stringify(layout),
      t,
      deadline,
      String(body.clientId ?? '').slice(0, 40) || null,
      code,
    );
    audit(user, 'attempt_start', `bài giao #${a.id}`, ip);
    return attemptView(getAttempt(Number(r.lastInsertRowid)));
  });
  route('GET', '/api/attempts/:id', ['student'], ({ user, params }) => attemptView(finalizeIfExpired(ownAttempt(user, params.id))));
  route('PUT', '/api/attempts/:id/save', ['student'], ({ user, params, body }) => {
    const att = ownAttempt(user, params.id);
    const t = now();
    if (att.status !== 'in_progress') return { closed: true, status: att.status, serverNow: t, version: att.version };
    const version = Number(body.version) || 0;
    const events = mergeEvents(att, body, body.clientId);
    if (att.deadline_at && t > att.deadline_at + SAVE_GRACE_MS) {
      if (t <= att.deadline_at + LATE_WINDOW_MS && version > att.version) {
        db.tx(() => {
          db.run('UPDATE attempts SET late_json = ?, events_json = ? WHERE id = ?', JSON.stringify({ responses: body.responses ?? {}, times: body.times ?? {}, at: t, version }), JSON.stringify(events), att.id);
          finalize({ ...att, events }, att.responses, att.times, 'auto_submitted');
        });
        return { closed: true, late: true, status: 'auto_submitted', serverNow: t };
      }
      finalizeIfExpired(att);
      return { closed: true, status: 'auto_submitted', serverNow: t };
    }
    if (version > att.version) {
      db.run('UPDATE attempts SET responses_json = ?, times_json = ?, version = ?, saved_at = ?, events_json = ? WHERE id = ?', JSON.stringify(body.responses ?? {}), JSON.stringify(body.times ?? {}), version, t, JSON.stringify(events), att.id);
    } else {
      db.run('UPDATE attempts SET events_json = ? WHERE id = ?', JSON.stringify(events), att.id);
    }
    return { ok: true, version: Math.max(version, att.version), serverNow: t, deadlineAt: att.deadline_at };
  });
  route('POST', '/api/attempts/:id/submit', ['student'], ({ user, params, body, ip }) => {
    const att = ownAttempt(user, params.id);
    const t = now();
    if (att.status !== 'in_progress') return attemptView(att); // nộp lặp lại: trả kết quả cũ
    const version = Number(body.version) || 0;
    const inTime = !att.deadline_at || t <= att.deadline_at + SAVE_GRACE_MS;
    const useBody = inTime && version >= att.version && body.responses;
    const events = mergeEvents(att, body, body.clientId);
    db.run('UPDATE attempts SET events_json = ? WHERE id = ?', JSON.stringify(events), att.id);
    const done = db.tx(() => {
      if (!inTime && body.responses && version > att.version && t <= att.deadline_at + LATE_WINDOW_MS) {
        db.run('UPDATE attempts SET late_json = ? WHERE id = ?', JSON.stringify({ responses: body.responses, times: body.times ?? {}, at: t, version }), att.id);
      }
      return finalize({ ...att, events }, useBody ? body.responses : att.responses, useBody ? body.times ?? {} : att.times, inTime ? 'submitted' : 'auto_submitted');
    });
    audit(user, 'attempt_submit', `bài làm #${att.id}${inTime ? '' : ' (quá giờ, chốt bằng bản lưu)'}`, ip);
    return attemptView(done);
  });
  route('GET', '/api/attempts/:id/result', ['student'], ({ user, params }) => {
    const att = finalizeIfExpired(ownAttempt(user, params.id));
    const v = attemptView(att);
    if (!v.resultVisible) fail(403, 'Giáo viên cho xem kết quả sau khi đóng bài.');
    return v;
  });

  // ---- ôn giãn cách (sổ lỗi sai) ----
  route('GET', '/api/student/review/due', ['student'], ({ user }) => {
    const t = now();
    const rows = db.all('SELECT r.qid, r.box, r.due_day, r.lapses, q.topic, q.level FROM review_items r JOIN questions q ON q.id = r.qid WHERE r.student_id = ? AND r.due_day <= ? ORDER BY r.due_day, r.qid', user.id, dayKey(t));
    const total = db.get('SELECT COUNT(*) n FROM review_items WHERE student_id = ?', user.id).n;
    return {
      today: dayKey(t),
      count: rows.length,
      total,
      items: rows.map((r) => ({ qid: r.qid, topic: r.topic, level: r.level, box: r.box + 1, boxes: 5, dueDay: r.due_day, overdueDays: overdueDays({ due_day: r.due_day }, t), lapses: r.lapses })),
    };
  });
  route('GET', '/api/teacher/review-stats', STAFF, ({ user, query }) => {
    const t = now();
    const today = dayKey(t);
    let classIds = teacherClassIds(user);
    if (query.classId) classIds = classIds.filter((c) => c === Number(query.classId));
    const classes = classIds.map((cid) => {
      const c = db.get('SELECT id, name FROM classes WHERE id = ?', cid);
      const students = db.all("SELECT id, display_name FROM users WHERE class_id = ? AND school_id = ? AND role = 'student' AND active = 1 ORDER BY display_name", cid, user.school_id).map((s) => {
        const rows = db.all('SELECT due_day FROM review_items WHERE student_id = ?', s.id);
        const due = rows.filter((r) => isDue(r, t));
        const overdue = rows.filter((r) => r.due_day < today);
        return { id: s.id, name: s.display_name, total: rows.length, due: due.length, overdue: overdue.length, maxOverdueDays: Math.max(0, ...rows.map((r) => overdueDays(r, t))) };
      });
      return { id: c.id, name: c.name, students, studentsWithOverdue: students.filter((s) => s.overdue > 0).length, totalOverdue: students.reduce((n, s) => n + s.overdue, 0), totalDue: students.reduce((n, s) => n + s.due, 0) };
    });
    return { today, classes };
  });

  // ---- luyện tập thích ứng ----
  route('POST', '/api/practice/start', ['student'], ({ user, body, ip }) => {
    const mode = body.mode ?? 'weak';
    const count = Math.min(20, Math.max(3, Number(body.count) || 8));
    const pool = db.all("SELECT id, type, topic, level, status FROM questions WHERE school_id = ? AND status = 'approved'", user.school_id);
    const mastery = studentMastery(user.id);
    const hist = {};
    for (const e of db.all('SELECT qid, correct, at FROM evidence WHERE student_id = ? ORDER BY at', user.id)) hist[e.qid] = { lastCorrect: !!e.correct, lastAt: e.at };
    const dueRows = db.all('SELECT qid FROM review_items WHERE student_id = ? AND due_day <= ?', user.id, dayKey(now()));
    const due = new Set(dueRows.map((r) => r.qid));
    let topics;
    let title;
    if (mode === 'review') {
      if (!due.size) fail(400, 'Chưa có câu nào đến hạn ôn. Quay lại sau nhé.');
      const dueQs = pool.filter((q) => due.has(q.id));
      topics = [...new Set(dueQs.map((q) => q.topic))];
      title = 'Ôn lại câu từng sai';
    } else if (mode === 'topic') {
      topics = (Array.isArray(body.topics) ? body.topics : []).filter((t) => TOPIC_BY_CODE[t]);
      if (!topics.length) fail(400, 'Chọn ít nhất một chuyên đề.');
      title = topics.length === 1 ? `Luyện: ${TOPIC_BY_CODE[topics[0]].name}` : `Luyện ${topics.length} chuyên đề`;
    } else {
      const recs = recommend(mastery, {}, 2);
      topics = recs.map((r) => r.topic);
      if (!topics.length) {
        // Chưa có dữ liệu: lấy chuyên đề có nhiều câu nhất của khối.
        const grade = db.get('SELECT grade FROM classes WHERE id = ?', user.class_id)?.grade ?? 12;
        const cnt = {};
        for (const q of pool) if (TOPIC_BY_CODE[q.topic]?.grade === grade) cnt[q.topic] = (cnt[q.topic] ?? 0) + 1;
        topics = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
      }
      title = 'Luyện chuyên đề cần cải thiện';
    }
    let picked = selectPractice({ pool, topics, mastery, history: hist, due, count, seed: `${user.id}-${now()}`, now: now() });
    if (mode === 'review') picked = pool.filter((q) => due.has(q.id)).slice(0, count);
    if (!picked.length) fail(400, 'Ngân hàng chưa có câu đã duyệt cho chuyên đề này. Báo giáo viên bổ sung.');
    const layout = makeVariant(picked.map((q) => ({ qid: q.id, type: q.type })), `p-${user.id}-${now()}`);
    const r = db.run('INSERT INTO attempts (school_id, student_id, kind, title, layout_json, started_at) VALUES (?,?,?,?,?,?)', user.school_id, user.id, 'practice', title, JSON.stringify(layout), now());
    audit(user, 'practice_start', `${mode}: ${topics.join(',')}`, ip);
    return attemptView(getAttempt(Number(r.lastInsertRowid)));
  });
  route('POST', '/api/practice/:id/check', ['student'], ({ user, params, body }) => {
    const att = ownAttempt(user, params.id);
    if (att.kind !== 'practice') fail(400, 'Chỉ bài luyện tập mới xem đáp án từng câu.');
    if (att.status !== 'in_progress') fail(400, 'Bài luyện đã kết thúc.');
    const qid = Number(body.qid);
    const it = att.layout.find((x) => x.qid === qid);
    if (!it) fail(400, 'Câu không thuộc bài này.');
    const q = attemptQuestions(att)[qid];
    let checked = att.checked ?? {};
    if (!checked[qid]) {
      const resp = toOriginalResponse(it, body.response);
      const res = db.tx(() => {
        const { g, d } = recordEvidence(att, q, resp, Number(body.seconds) || undefined);
        bumpActivity(user.id, 1, g.correct ? 1 : 0, g.correct ? 10 : 2);
        return { g, d };
      });
      checked = { ...checked, [qid]: { points: res.g.points, max: res.g.max, correct: res.g.correct, parts: res.g.parts ?? null, diagnosis: res.d } };
      const responses = { ...att.responses, [qid]: body.response };
      db.run('UPDATE attempts SET checked_json = ?, responses_json = ? WHERE id = ?', JSON.stringify(checked), JSON.stringify(responses), att.id);
    }
    const correctAnswer = q.type === 'mcq' ? (it.perm ?? [0, 1, 2, 3]).indexOf(q.answer) : q.answer;
    return { ...checked[qid], correctAnswer, explanation: q.explanation, source: q.source };
  });
  route('POST', '/api/practice/:id/finish', ['student'], ({ user, params, body }) => {
    const att = ownAttempt(user, params.id);
    if (att.kind !== 'practice') fail(400, 'Không phải bài luyện tập.');
    if (att.status !== 'in_progress') return attemptView(att);
    const done = db.tx(() => finalize(att, { ...att.responses, ...(body.responses ?? {}) }, body.times ?? att.times, 'submitted'));
    return attemptView(done);
  });

  // ---- quản lý trường ----
  route('GET', '/api/admin/overview', ['admin'], ({ user }) => {
    const sid = user.school_id;
    sweepExpired('AND school_id = ?', sid);
    const since = now() - 90 * 86400000;
    const classes = db.all(
      `SELECT c.id, c.name, c.grade, u.display_name teacher, c.teacher_id,
        (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id AND s.role = 'student' AND s.active = 1) students,
        (SELECT COUNT(*) FROM assignments a WHERE a.class_id = c.id AND a.open_at > ?) assignments,
        (SELECT COUNT(*) FROM attempts t JOIN assignments a ON a.id = t.assignment_id WHERE a.class_id = c.id AND t.status != 'in_progress' AND a.open_at > ?) submitted,
        (SELECT AVG(t.score10) FROM attempts t JOIN assignments a ON a.id = t.assignment_id WHERE a.class_id = c.id AND t.status != 'in_progress' AND a.open_at > ?) avg
       FROM classes c LEFT JOIN users u ON u.id = c.teacher_id WHERE c.school_id = ? ORDER BY c.grade DESC, c.name`,
      since,
      since,
      since,
      sid,
    ).map((c) => ({ ...c, participation: c.students && c.assignments ? c.submitted / (c.students * c.assignments) : null }));
    const grades = {};
    for (const c of classes) {
      const g = (grades[c.grade] ??= { grade: c.grade, classes: 0, students: 0, sum: 0, n: 0 });
      g.classes++;
      g.students += c.students;
      if (c.avg !== null) {
        g.sum += c.avg * c.submitted;
        g.n += c.submitted;
      }
    }
    const teachers = db.all(
      `SELECT u.id, u.display_name name,
        (SELECT COUNT(*) FROM questions q WHERE q.approved_by = u.id) approved,
        (SELECT COUNT(*) FROM exams e WHERE e.created_by = u.id) exams,
        (SELECT COUNT(*) FROM assignments a WHERE a.created_by = u.id) assignments
       FROM users u WHERE u.school_id = ? AND u.role = 'teacher' AND u.active = 1 ORDER BY u.display_name`,
      sid,
    ).map((t) => {
      const cs = classes.filter((c) => c.teacher_id === t.id && c.avg !== null);
      const n = cs.reduce((s, c) => s + c.submitted, 0);
      return { ...t, classes: classes.filter((c) => c.teacher_id === t.id).map((c) => c.name), avg: n ? cs.reduce((s, c) => s + c.avg * c.submitted, 0) / n : null };
    });
    const bank = db.all("SELECT source, status, COUNT(*) n FROM questions WHERE school_id = ? AND status != 'archived' GROUP BY source, status", sid);
    const weakTopics = Object.values(
      computeMastery(db.all('SELECT topic, level, score, at FROM evidence WHERE school_id = ? AND topic IS NOT NULL AND at > ?', sid, since), now()),
    ).sort((a, b) => a.value - b.value).slice(0, 5);
    return { classes, grades: Object.values(grades).sort((a, b) => b.grade - a.grade).map((g) => ({ ...g, avg: g.n ? g.sum / g.n : null })), teachers, bank, weakTopics };
  });
  route('GET', '/api/admin/users', ['admin'], ({ user }) => ({
    users: db.all('SELECT u.id, u.role, u.username, u.display_name, u.class_id, c.name class_name, u.active, u.created_at FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.school_id = ? ORDER BY u.role, c.name, u.display_name', user.school_id),
    classes: db.all('SELECT c.id, c.name, c.grade, c.teacher_id, u.display_name teacher FROM classes c LEFT JOIN users u ON u.id = c.teacher_id WHERE c.school_id = ? ORDER BY c.grade DESC, c.name', user.school_id),
  }));
  route('POST', '/api/admin/users', ['admin'], ({ user, body, ip }) => {
    const role = body.role;
    if (!['teacher', 'student', 'admin'].includes(role)) fail(400, 'Chọn vai trò.');
    const displayName = String(body.displayName ?? '').trim();
    if (!displayName) fail(400, 'Nhập tên hiển thị.');
    const username = String(body.username ?? '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) fail(400, 'Tên đăng nhập 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch.');
    if (db.get('SELECT id FROM users WHERE username = ?', username)) fail(400, 'Tên đăng nhập đã có người dùng. Chọn tên khác.');
    let classId = null;
    if (role === 'student') {
      classId = Number(body.classId);
      if (!db.get('SELECT id FROM classes WHERE id = ? AND school_id = ?', classId, user.school_id)) fail(400, 'Chọn lớp cho học sinh.');
    }
    const pw = tempPassword();
    const r = db.run('INSERT INTO users (school_id, role, username, display_name, pass_hash, class_id, created_at) VALUES (?,?,?,?,?,?,?)', user.school_id, role, username, displayName, hashPassword(pw), classId, now());
    audit(user, 'user_create', `${role} ${username}`, ip);
    return { id: Number(r.lastInsertRowid), tempPassword: pw };
  });
  route('POST', '/api/admin/users/:id/reset-password', ['admin'], ({ user, params, body, ip }) => {
    const u = db.get('SELECT id, username FROM users WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!u) fail(404, 'Không tìm thấy người dùng.');
    const pw = tempPassword();
    db.run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(pw), u.id);
    db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
    audit(user, 'password_reset', u.username, ip, { target: `user:${u.id}`, reason: body?.reason });
    return { tempPassword: pw };
  });
  route('POST', '/api/admin/classes', ['admin'], ({ user, body, ip }) => {
    const name = String(body.name ?? '').trim();
    const grade = Number(body.grade);
    if (!name || ![10, 11, 12].includes(grade)) fail(400, 'Nhập tên lớp và chọn khối 10, 11 hoặc 12.');
    let teacherId = body.teacherId ? Number(body.teacherId) : null;
    if (teacherId && !db.get("SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'teacher'", teacherId, user.school_id)) fail(400, 'Giáo viên không thuộc trường.');
    const r = db.run('INSERT INTO classes (school_id, name, grade, teacher_id) VALUES (?,?,?,?)', user.school_id, name, grade, teacherId);
    audit(user, 'class_create', name, ip);
    return { id: Number(r.lastInsertRowid) };
  });
  route('PUT', '/api/admin/classes/:id', ['admin'], ({ user, params, body, ip }) => {
    const c = db.get('SELECT * FROM classes WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!c) fail(404, 'Không tìm thấy lớp.');
    const teacherId = body.teacherId ? Number(body.teacherId) : null;
    if (teacherId && !db.get("SELECT id FROM users WHERE id = ? AND school_id = ? AND role = 'teacher'", teacherId, user.school_id)) fail(400, 'Giáo viên không thuộc trường.');
    db.run('UPDATE classes SET teacher_id = ? WHERE id = ?', teacherId, c.id);
    audit(user, 'class_assign_teacher', `${c.name} → #${teacherId}`, ip);
    return { ok: true };
  });
  route('GET', '/api/admin/audit', ['admin'], ({ user, query }) => {
    const where = ['l.school_id = ?'];
    const p = [user.school_id];
    if (query.action) (where.push('l.action = ?'), p.push(query.action));
    if (query.outcome) (where.push('l.outcome = ?'), p.push(query.outcome));
    if (query.beforeId) (where.push('l.id < ?'), p.push(Number(query.beforeId)));
    return {
      entries: db.all(
        `SELECT l.id, l.action, l.detail, l.ip, l.at, l.target, l.old_json, l.new_json, l.reason, l.outcome, l.user_id, u.display_name, u.role FROM audit_log l LEFT JOIN users u ON u.id = l.user_id WHERE ${where.join(' AND ')} ORDER BY l.id DESC LIMIT ?`,
        ...p,
        Math.min(500, Number(query.limit) || 200),
      ),
    };
  });

  // ---- nhập học sinh hàng loạt ----
  function makeUsername(name, prefix) {
    const parts = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    const base = `${prefix}.${parts.length ? parts[parts.length - 1] + (parts.length > 1 ? '.' + parts.slice(0, -1).map((p) => p[0]).join('') : '') : 'user'}`.slice(0, 28);
    let u = base;
    for (let i = 2; db.get('SELECT id FROM users WHERE username = ?', u); i++) u = `${base}${i}`;
    return u;
  }
  route('POST', '/api/admin/users/bulk', ['admin'], ({ user, body, ip }) => {
    // rows: [{ name, className, role? }] — lớp chưa có thì tạo, khối lấy từ tên lớp (10/11/12).
    const rows = (Array.isArray(body.rows) ? body.rows : []).map((r) => ({ name: String(r.name ?? '').trim(), className: String(r.className ?? '').trim().toUpperCase(), role: r.role === 'teacher' ? 'teacher' : 'student' })).filter((r) => r.name);
    if (!rows.length) fail(400, 'Danh sách trống. Dán mỗi dòng một tên, có thể kèm lớp sau dấu phẩy hoặc tab.');
    if (rows.length > 2000) fail(400, 'Mỗi lần nhập tối đa 2000 người.');
    for (const r of rows) {
      if (r.role === 'student' && !r.className && !body.classId) fail(400, `Chưa có lớp cho "${r.name}". Chọn lớp chung hoặc ghi lớp sau tên.`);
      if (r.className && !/^(10|11|12)/.test(r.className)) fail(400, `Lớp "${r.className}" phải bắt đầu bằng khối 10, 11 hoặc 12 (ví dụ 12A1).`);
    }
    const created = db.tx(() =>
      rows.map((r) => {
        let classId = null;
        let className = null;
        if (r.role === 'student') {
          if (r.className) {
            let c = db.get('SELECT id, name FROM classes WHERE school_id = ? AND upper(name) = ?', user.school_id, r.className);
            if (!c) c = { id: Number(db.run('INSERT INTO classes (school_id, name, grade) VALUES (?,?,?)', user.school_id, r.className, Number(r.className.slice(0, 2))).lastInsertRowid), name: r.className };
            classId = c.id;
            className = c.name;
          } else {
            const c = db.get('SELECT id, name FROM classes WHERE id = ? AND school_id = ?', Number(body.classId), user.school_id);
            if (!c) fail(400, 'Lớp đã chọn không thuộc trường.');
            classId = c.id;
            className = c.name;
          }
        }
        const username = makeUsername(r.name, r.role === 'teacher' ? 'gv' : 'hs');
        const pw = tempPassword();
        db.run('INSERT INTO users (school_id, role, username, display_name, pass_hash, class_id, created_at) VALUES (?,?,?,?,?,?,?)', user.school_id, r.role, username, r.name, hashPassword(pw), classId, now());
        return { name: r.name, role: r.role, className, username, tempPassword: pw };
      }),
    );
    audit(user, 'user_bulk_create', `${created.length} tài khoản`, ip);
    return { created };
  });

  // ---- sao lưu ----
  function backupNow(reason = 'auto') {
    if (!config.backupDir) throw new HttpError(400, 'Chưa cấu hình thư mục sao lưu.');
    fs.mkdirSync(config.backupDir, { recursive: true });
    const stamp = new Date(now() + 7 * 3600000).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
    const file = path.join(config.backupDir, `smartexam-${stamp}-${reason}.db`);
    if (fs.existsSync(file)) fs.rmSync(file);
    db.raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const all = fs.readdirSync(config.backupDir).filter((f) => /^smartexam-.*\.db$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - (config.keepBackups ?? 14)))) fs.rmSync(path.join(config.backupDir, old));
    return file;
  }
  route('GET', '/api/admin/backups', ['admin'], () => {
    if (!config.backupDir || !fs.existsSync(config.backupDir)) return { backups: [], dir: config.backupDir ?? null };
    return {
      dir: config.backupDir,
      backups: fs
        .readdirSync(config.backupDir)
        .filter((f) => /^smartexam-.*\.db$/.test(f))
        .sort()
        .reverse()
        .map((f) => ({ name: f, size: fs.statSync(path.join(config.backupDir, f)).size, at: fs.statSync(path.join(config.backupDir, f)).mtimeMs })),
    };
  });
  route('POST', '/api/admin/backups', ['admin'], ({ user, ip }) => {
    const file = backupNow('tay');
    audit(user, 'backup', path.basename(file), ip);
    return { name: path.basename(file) };
  });

  // ---- thiết lập lần đầu ----
  // Trang đăng nhập chỉ hiện tài khoản mẫu khi máy đang chạy trường mẫu.
  route('GET', '/api/demo', null, () => ({ sample: !!db.get("SELECT id FROM users WHERE username = 'hs.an.nm' AND school_id IN (SELECT id FROM schools WHERE sample = 1)") }));
  route('GET', '/api/setup', null, () => ({ needsSetup: !db.get('SELECT id FROM schools LIMIT 1') }));
  route('POST', '/api/setup', null, ({ body, ip, setCookie }) => {
    if (db.get('SELECT id FROM schools LIMIT 1')) fail(409, 'Trường đã được thiết lập. Đăng nhập bằng tài khoản quản lý.');
    let adminId;
    if (body.mode === 'sample') {
      seedSample({ db, now, internals: { finalize, getAttempt, withClock: (fn, b) => { const prev = clockFn; clockFn = fn; try { return b(); } finally { clockFn = prev; } } } });
      adminId = db.get("SELECT id FROM users WHERE username = 'quanly'").id;
    } else {
      const schoolName = String(body.schoolName ?? '').trim();
      const adminName = String(body.adminName ?? '').trim();
      const username = String(body.username ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!schoolName || !adminName) fail(400, 'Nhập tên trường và tên người quản lý.');
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) fail(400, 'Tên đăng nhập 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch.');
      if (password.length < 8) fail(400, 'Mật khẩu quản lý cần ít nhất 8 ký tự.');
      adminId = db.tx(() => {
        const school = Number(db.run('INSERT INTO schools (name, sample) VALUES (?, 0)', schoolName).lastInsertRowid);
        const id = Number(db.run('INSERT INTO users (school_id, role, username, display_name, pass_hash, created_at) VALUES (?,?,?,?,?,?)', school, 'admin', username, adminName, hashPassword(password), now()).lastInsertRowid);
        if (body.withSampleBank) {
          const t = now();
          for (const q of SAMPLE_QUESTIONS) {
            db.run(
              `INSERT INTO questions (school_id, type, stem, options_json, answer_json, explanation, topic, level, source, status, distractors_json, origin, created_by, approved_by, created_at, updated_at, sample, tag_confidence)
               VALUES (?,?,?,?,?,?,?,?, 'teacher', 'approved', ?, 'Ngân hàng mẫu SmartExam', ?, ?, ?, ?, 1, 1)`,
              school, q.type, q.stem, JSON.stringify(q.options), JSON.stringify(q.answer), q.explanation, q.topic, q.level, JSON.stringify(q.distractors ?? {}), id, id, t, t,
            );
          }
        }
        return id;
      });
    }
    const u = db.get('SELECT * FROM users WHERE id = ?', adminId);
    const token = newToken();
    db.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)', token, u.id, now(), now() + SESSION_MS);
    setCookie(`se_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`);
    audit(u, 'setup', body.mode === 'sample' ? 'Trường mẫu' : 'Trường thật', ip);
    return { user: publicUser(u) };
  });

  // ---------------- xử lý http ----------------
  function authUser(cookies) {
    const token = cookies.se_session;
    if (!token) return { token: null, user: null };
    const s = db.get('SELECT * FROM sessions WHERE token = ?', token);
    if (!s || s.expires_at < now()) return { token, user: null };
    const user = db.get('SELECT * FROM users WHERE id = ? AND active = 1', s.user_id);
    return { token, user };
  }

  async function readBody(req, limit) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > limit) throw new HttpError(413, `File quá lớn (tối đa ${Math.round(limit / 1e6)} MB).`);
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  }

  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };

  function serveStatic(req, res, pathname) {
    if (!distDir) return false;
    let file = path.join(distDir, decodeURIComponent(pathname));
    if (!file.startsWith(distDir)) return false;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
    if (!fs.existsSync(file)) return false;
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const headers = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' };
    if (!url.pathname.startsWith('/api/')) {
      if (serveStatic(req, res, url.pathname)) return;
      res.writeHead(404, headers);
      res.end('Not found');
      return;
    }
    const send = (status, obj) => {
      res.writeHead(status, { ...headers, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(obj));
    };
    try {
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) fail(404, 'Không có API này.');
      // Chống CSRF: yêu cầu ghi phải là JSON hoặc có header riêng (form từ trang khác không đặt được).
      if (req.method !== 'GET' && !(req.headers['content-type'] ?? '').includes('application/json') && !req.headers['x-smartexam']) fail(400, 'Yêu cầu không hợp lệ.');
      const m = url.pathname.match(r.re);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const cookies = parseCookies(req.headers.cookie);
      const { token, user } = authUser(cookies);
      if (r.roles && !user) fail(401, 'Phiên đăng nhập đã hết. Đăng nhập lại.');
      if (r.roles && !r.roles.includes(user.role)) {
        audit(user, 'denied', `${req.method} ${r.pattern}`, req.socket?.remoteAddress, { target: url.pathname, outcome: 'denied' });
        fail(403, 'Bạn không có quyền làm việc này.');
      }
      let raw = null;
      let body = {};
      if (req.method !== 'GET') {
        raw = await readBody(req, url.pathname === '/api/import' || url.pathname === '/api/import/answers' ? 25e6 : 3e6);
        if ((req.headers['content-type'] ?? '').includes('application/json') && raw.length) {
          try {
            body = JSON.parse(raw.toString('utf8'));
          } catch {
            fail(400, 'Dữ liệu gửi lên không phải JSON hợp lệ.');
          }
        }
      }
      const cookieOut = [];
      const result = await r.handler({
        user,
        token,
        params,
        query: Object.fromEntries(url.searchParams),
        body,
        raw,
        ip: req.socket?.remoteAddress,
        setCookie: (c) => cookieOut.push(c),
      });
      if (cookieOut.length) res.setHeader('set-cookie', cookieOut);
      if (result?.__file) {
        const f = result.__file;
        res.writeHead(200, f.inline ? { ...headers, 'content-type': f.type, 'content-disposition': 'inline', 'cache-control': 'private, max-age=86400', 'content-security-policy': "default-src 'none'; sandbox" } : { ...headers, 'content-type': f.type, 'content-disposition': `attachment; filename="${f.name}"`, 'cache-control': 'no-store' });
        res.end(f.data);
        return;
      }
      send(200, result ?? {});
    } catch (e) {
      const status = e.status ?? 500;
      if (!e.status) console.error(e);
      send(status, { error: status >= 500 && !(e instanceof HttpError) && !e.status ? 'Lỗi máy chủ. Thử lại; nếu vẫn lỗi, báo quản trị kèm giờ xảy ra.' : e.message, ...(e.extra ?? {}) });
    }
  }

  return {
    handle,
    db,
    ai,
    now,
    backupNow,
    internals: {
      finalize,
      getAttempt,
      makeVariant,
      withClock(fn, body) {
        const prev = clockFn;
        clockFn = fn;
        try {
          return body();
        } finally {
          clockFn = prev;
        }
      },
    },
  };
}
