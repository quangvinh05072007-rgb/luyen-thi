// Máy chủ API SmartExam AI. createApp(config) trả về hàm xử lý yêu cầu http, dùng cho cả chạy thật và test.
import fs from 'node:fs';
import path from 'node:path';
import { openDb, toQuestion } from './db.mjs';
import { hashPassword, verifyPassword, newToken, tempPassword, LoginLimiter, parseCookies } from './security.mjs';
import { importFile, importText } from './importers.mjs';
import { makeAi } from './ai.mjs';
import { gradeAttempt, gradeQuestion } from '../shared/grading.mjs';
import { generateExam, makeVariant, toOriginalResponse, OFFICIAL_BLUEPRINT } from '../shared/generate.mjs';
import { diagnoseAttempt, diagnoseItem, computeMastery, recommend, updateReview, selectPractice } from '../shared/diagnose.mjs';
import { examToDocx } from '../shared/exportExam.mjs';
import { TOPICS, TOPIC_BY_CODE, LEVELS, SOURCES, SOURCE_HINT, ERROR_TYPES, QUESTION_TYPES } from '../shared/topics.mjs';
import { CSV_TEMPLATE } from '../shared/sheet.mjs';

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

function dayKey(ms) {
  const d = new Date(ms + 7 * 3600 * 1000); // giờ Việt Nam
  return d.toISOString().slice(0, 10);
}

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
  function audit(user, action, detail, ip) {
    db.run('INSERT INTO audit_log (school_id, user_id, action, detail, ip, at) VALUES (?,?,?,?,?,?)', user?.school_id ?? null, user?.id ?? null, action, detail ? String(detail).slice(0, 500) : null, ip ?? null, now());
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
    const next = updateReview(cur ? { box: cur.box, due_at: cur.due_at, lapses: cur.lapses } : null, g.correct, t);
    if (next) {
      db.run(
        'INSERT INTO review_items (student_id, qid, school_id, box, due_at, lapses) VALUES (?,?,?,?,?,?) ON CONFLICT(student_id, qid) DO UPDATE SET box = excluded.box, due_at = excluded.due_at, lapses = excluded.lapses',
        att.student_id,
        q.id,
        att.school_id,
        next.box,
        next.due_at,
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
    const due = db.get('SELECT COUNT(*) n FROM review_items WHERE student_id = ? AND due_at <= ?', studentId, now()).n;
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
    routes.push({ method, re, keys, roles, handler });
  };

  // ---- phiên ----
  route('POST', '/api/login', null, ({ body, ip, setCookie }) => {
    const username = String(body.username ?? '').trim().toLowerCase();
    const key = `${username}|${ip}`;
    if (limiter.blocked(key, now())) fail(429, 'Sai mật khẩu quá nhiều lần. Đợi 10 phút rồi thử lại.');
    const u = db.get('SELECT * FROM users WHERE username = ? AND active = 1', username);
    if (!u || !verifyPassword(body.password ?? '', u.pass_hash)) {
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
    const rows = db.all(`SELECT * FROM questions WHERE ${where.join(' AND ')} ORDER BY status = 'draft' DESC, updated_at DESC LIMIT 500`, ...p).map(toQuestion);
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
      `INSERT INTO questions (school_id, type, stem, options_json, answer_json, explanation, topic, level, source, status, distractors_json, origin, parent_id, tag_confidence, created_by, approved_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    if (merged.status === 'approved') {
      const errs = validateQuestion(merged);
      if (errs.length) fail(400, `Câu đã duyệt phải hợp lệ: ${errs.join(' ')}`);
    }
    db.run(
      'UPDATE questions SET type = ?, stem = ?, options_json = ?, answer_json = ?, explanation = ?, topic = ?, level = ?, distractors_json = ?, tag_confidence = 1, updated_at = ? WHERE id = ?',
      merged.type,
      merged.stem,
      JSON.stringify(merged.options ?? []),
      JSON.stringify(merged.answer ?? null),
      merged.explanation ?? '',
      merged.topic,
      Number(merged.level),
      JSON.stringify(merged.distractors ?? {}),
      now(),
      q.id,
    );
    audit(user, 'question_edit', `#${q.id}`, ip);
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
    for (const id of ids) db.run("UPDATE questions SET status = 'archived', updated_at = ? WHERE id = ? AND school_id = ?", now(), id, user.school_id);
    audit(user, 'question_archive', ids.map((x) => `#${x}`).join(' '), ip);
    return { ok: true };
  });

  // ---- nhập đề ----
  route('POST', '/api/import', STAFF, async ({ user, raw, query, body, ip }) => {
    let res;
    if (query.filename) res = await importFile(String(query.filename), raw, ai);
    else if (typeof body?.text === 'string') res = importText(body.text);
    else fail(400, 'Gửi file hoặc dán văn bản đề.');
    audit(user, 'import_parse', `${query.filename ?? 'văn bản dán'}: ${res.questions.length} câu`, ip);
    return res;
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
  route('POST', '/api/ai/explain', STAFF, async ({ user, body, ip }) => {
    const q = toQuestion(db.get('SELECT * FROM questions WHERE id = ? AND school_id = ?', body.id, user.school_id));
    if (!q) fail(404, 'Không tìm thấy câu hỏi.');
    const explanation = await ai.explain(q);
    const id = insertQuestion(user, { ...q, explanation }, 'ai_modified', 'draft', { parent_id: q.id, origin: `AI viết lời giải cho câu #${q.id}` });
    audit(user, 'ai_explain', `#${q.id} → #${id}`, ip);
    return { id };
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
    const nVar = Math.min(8, Math.max(1, Number(body.variants) || 4));
    const variants = Array.from({ length: nVar }, (_, i) => ({ code: String(101 + i), seed: `${now()}-${i}` }));
    const norm = items.map((x) => ({ qid: Number(x.qid), type: qmap[x.qid].type, topic: qmap[x.qid].topic, level: qmap[x.qid].level }));
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
  route('GET', '/api/exams/:id/docx', STAFF, async ({ user, params, query, ip }) => {
    const e = db.get('SELECT * FROM exams WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!e) fail(404, 'Không tìm thấy đề.');
    const school = db.get('SELECT name FROM schools WHERE id = ?', user.school_id);
    const variants = e.variants.map((v) => ({ code: v.code, layout: makeVariant(e.items, `${e.id}-${v.seed}`) }));
    const buf = await examToDocx({ title: e.title, school: school.name, durationMin: e.duration_min }, variants, e.snapshot, { withSolutions: query.solutions === '1' });
    audit(user, 'exam_export_docx', `#${e.id}`, ip);
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
    const ids = db.tx(() =>
      classIds.map((c) =>
        Number(
          db.run(
            'INSERT INTO assignments (school_id, exam_id, class_id, mode, title, open_at, close_at, duration_min, show_result, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
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
          ).lastInsertRowid,
        ),
      ),
    );
    audit(user, 'assignment_create', `đề #${exam.id} → lớp ${classIds.join(',')}`, ip);
    return { ids };
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
    const students = db.all("SELECT id, display_name FROM users WHERE class_id = ? AND role = 'student' AND active = 1 ORDER BY display_name", a.class_id);
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
    audit(user, 'late_accept', `bài làm #${att.id}`, ip);
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
       FROM assignments a LEFT JOIN attempts t ON t.assignment_id = a.id AND t.student_id = ? WHERE a.class_id = ? ORDER BY a.close_at ASC`,
      user.id,
      user.class_id ?? -1,
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
  route('POST', '/api/attempts/start', ['student'], ({ user, body, ip }) => {
    const a = db.get('SELECT * FROM assignments WHERE id = ? AND school_id = ?', body.assignmentId, user.school_id);
    if (!a || a.class_id !== user.class_id) fail(404, 'Không tìm thấy bài được giao.');
    const existing = db.get('SELECT * FROM attempts WHERE assignment_id = ? AND student_id = ?', a.id, user.id);
    if (existing) return attemptView(finalizeIfExpired(existing));
    const t = now();
    if (t < a.open_at) fail(400, 'Bài chưa mở. Quay lại đúng giờ mở bài.');
    if (t > a.close_at) fail(400, 'Bài đã đóng. Hỏi giáo viên nếu cần làm bù.');
    const exam = db.get('SELECT * FROM exams WHERE id = ?', a.exam_id);
    const layout = makeVariant(exam.items, `${a.id}-${user.id}-${exam.id}`);
    const deadline = a.mode === 'exam' ? Math.min(t + a.duration_min * 60000, a.close_at) : a.close_at;
    const r = db.run(
      'INSERT INTO attempts (school_id, assignment_id, student_id, kind, title, layout_json, started_at, deadline_at, client_id) VALUES (?,?,?,?,?,?,?,?,?)',
      user.school_id,
      a.id,
      user.id,
      'assignment',
      a.title,
      JSON.stringify(layout),
      t,
      deadline,
      String(body.clientId ?? '').slice(0, 40) || null,
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

  // ---- luyện tập thích ứng ----
  route('POST', '/api/practice/start', ['student'], ({ user, body, ip }) => {
    const mode = body.mode ?? 'weak';
    const count = Math.min(20, Math.max(3, Number(body.count) || 8));
    const pool = db.all("SELECT id, type, topic, level, status FROM questions WHERE school_id = ? AND status = 'approved'", user.school_id);
    const mastery = studentMastery(user.id);
    const hist = {};
    for (const e of db.all('SELECT qid, correct, at FROM evidence WHERE student_id = ? ORDER BY at', user.id)) hist[e.qid] = { lastCorrect: !!e.correct, lastAt: e.at };
    const dueRows = db.all('SELECT qid FROM review_items WHERE student_id = ? AND due_at <= ?', user.id, now());
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
  route('POST', '/api/admin/users/:id/reset-password', ['admin'], ({ user, params, ip }) => {
    const u = db.get('SELECT id, username FROM users WHERE id = ? AND school_id = ?', params.id, user.school_id);
    if (!u) fail(404, 'Không tìm thấy người dùng.');
    const pw = tempPassword();
    db.run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(pw), u.id);
    db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
    audit(user, 'password_reset', u.username, ip);
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
  route('GET', '/api/admin/audit', ['admin'], ({ user, query }) => ({
    entries: db.all(
      'SELECT l.id, l.action, l.detail, l.ip, l.at, u.display_name, u.role FROM audit_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.school_id = ? ORDER BY l.id DESC LIMIT ?',
      user.school_id,
      Math.min(500, Number(query.limit) || 200),
    ),
  }));

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
      if (r.roles && !r.roles.includes(user.role)) fail(403, 'Bạn không có quyền làm việc này.');
      let raw = null;
      let body = {};
      if (req.method !== 'GET') {
        raw = await readBody(req, url.pathname === '/api/import' ? 25e6 : 3e6);
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
        res.writeHead(200, { ...headers, 'content-type': f.type, 'content-disposition': `attachment; filename="${f.name}"`, 'cache-control': 'no-store' });
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
