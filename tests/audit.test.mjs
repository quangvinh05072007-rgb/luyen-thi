// Nâng cấp 3: nhật ký thao tác nhạy cảm và kiểm soát quyền ở API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let clock = Date.parse('2026-10-19T08:00:00+07:00');
let server;
let url;
let app;
before(async () => {
  app = createApp({ dbFile: ':memory:', clock: () => clock, aiImpl: { enabled: false } });
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function client() {
  let cookie = '';
  const call = async (method, p, body) => {
    const headers = cookie ? { cookie } : {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(url + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const data = (res.headers.get('content-type') ?? '').includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b = {}) => call('PUT', p, b),
    del: (p, b = {}) => call('DELETE', p, b),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
      return r.data.user;
    },
  };
}

const rows = (action, extra = '') => app.db.all(`SELECT * FROM audit_log WHERE action = ? ${extra} ORDER BY id`, action);
const userId = (username) => app.db.get('SELECT id FROM users WHERE username = ?', username).id;

let lan;
let minh;
let khac;
let admin;
let ctx;

test('Chuẩn bị: bài thi 12A1 có học sinh đã nộp', async () => {
  lan = client();
  minh = client();
  khac = client();
  admin = client();
  await lan.login('gv.lan');
  await minh.login('gv.minh');
  await khac.login('gv.khac');
  await admin.login('quanly');
  const g = await lan.post('/api/exams/generate', { counts: { mcq: 4, tf: 0, short: 0 }, seed: 'au' });
  const exam = (await lan.post('/api/exams', { title: 'Nhật ký', items: g.data.items, durationMin: 30, variants: 1, seed: 'au' })).data.id;
  const cls = (await lan.get('/api/classes')).data.classes[0];
  const asg = (await lan.post('/api/assignments', { examId: exam, classId: cls.id, mode: 'exam', openAt: clock - 1000, closeAt: clock + 86400000, durationMin: 30 })).data.ids[0];
  const stu = app.db.get("SELECT id, username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", cls.id);
  const s = client();
  await s.login(stu.username);
  const att = (await s.post('/api/attempts/start', { assignmentId: asg })).data;
  const layout = app.db.get('SELECT layout_json FROM attempts WHERE id = ?', att.id).layout;
  const snap = app.db.get('SELECT snapshot_json FROM exams WHERE id = ?', exam).snapshot;
  const answers = Object.fromEntries(layout.map((it) => [it.qid, it.perm.indexOf(snap[it.qid].answer)]));
  await s.post(`/api/attempts/${att.id}/submit`, { responses: answers, version: 1 });
  ctx = { exam, cls, asg, stu, s, att, snap };
  assert.equal(app.db.get('SELECT score10 FROM attempts WHERE id = ?', att.id).score10, 10);
});

test('Sửa điểm: bắt buộc lý do; ghi đúng một dòng với giá trị cũ/mới; người không phụ trách bị từ chối và bị ghi nhận', async () => {
  const { att } = ctx;
  const before1 = rows('score_edit').length;
  assert.equal((await lan.post(`/api/attempts/${att.id}/score`, { score10: 8 })).status, 400, 'thiếu lý do');
  assert.equal((await lan.post(`/api/attempts/${att.id}/score`, { score10: 8, reason: 'ab' })).status, 400, 'lý do quá ngắn');
  assert.equal((await lan.post(`/api/attempts/${att.id}/score`, { score10: 11, reason: 'Chấm nhầm câu 3' })).status, 400, 'điểm ngoài thang');
  assert.equal(rows('score_edit').length, before1, 'thao tác không hợp lệ không để lại dòng');

  const ok = await lan.post(`/api/attempts/${att.id}/score`, { score10: 8.5, reason: 'Chấm lại câu 3 theo đáp án mới' });
  assert.equal(ok.status, 200);
  const r = rows('score_edit');
  assert.equal(r.length, before1 + 1);
  const row = r.at(-1);
  assert.equal(row.user_id, userId('gv.lan'));
  assert.equal(row.target, `attempt:${att.id}`);
  assert.equal(row.reason, 'Chấm lại câu 3 theo đáp án mới');
  assert.equal(row.old.score10, 10);
  assert.equal(row.new.score10, 8.5);
  assert.equal(row.outcome, 'ok');
  assert.equal(row.at, clock);
  assert.equal(app.db.get('SELECT score10 FROM attempts WHERE id = ?', att.id).score10, 8.5);

  // giáo viên lớp khác (cùng trường), giáo viên trường khác, học sinh
  for (const who of [minh, khac]) {
    const n = rows('score_edit', "AND outcome = 'denied'").length;
    const d = await who.post(`/api/attempts/${att.id}/score`, { score10: 1, reason: 'Thử sửa điểm trái phép' });
    assert.equal(d.status, 403);
    assert.equal(rows('score_edit', "AND outcome = 'denied'").length, n + 1);
  }
  assert.equal(app.db.get('SELECT score10 FROM attempts WHERE id = ?', att.id).score10, 8.5, 'điểm không đổi');
  const denied = rows('score_edit', "AND outcome = 'denied'");
  assert.equal(denied.at(-2).user_id, userId('gv.minh'));
  assert.equal(denied.at(-1).school_id, app.db.get('SELECT school_id FROM users WHERE username = ?', 'gv.khac').school_id, 'ghi vào nhật ký của trường người thử');

  const nBefore = app.db.get("SELECT COUNT(*) n FROM audit_log WHERE action = 'denied'").n;
  assert.equal((await ctx.s.post(`/api/attempts/${att.id}/score`, { score10: 10, reason: 'Học sinh tự sửa điểm' })).status, 403);
  const roleDenied = app.db.all("SELECT * FROM audit_log WHERE action = 'denied' ORDER BY id");
  assert.equal(roleDenied.length, nBefore + 1);
  assert.equal(roleDenied.at(-1).user_id, ctx.stu.id);
  assert.equal(roleDenied.at(-1).outcome, 'denied');
  assert.equal(app.db.get('SELECT score10 FROM attempts WHERE id = ?', att.id).score10, 8.5);
});

test('Mở lại lượt thi: bắt buộc lý do, đúng một dòng, học sinh làm tiếp được; sai quyền bị từ chối', async () => {
  const { att } = ctx;
  assert.equal((await lan.post(`/api/attempts/${att.id}/reopen`, {})).status, 400);
  assert.equal(rows('attempt_reopen').length, 0);
  for (const who of [minh, khac]) assert.equal((await who.post(`/api/attempts/${att.id}/reopen`, { reason: 'Thử mở lại trái phép' })).status, 403);
  assert.equal(rows('attempt_reopen', "AND outcome = 'denied'").length, 2);
  assert.equal(app.db.get('SELECT status FROM attempts WHERE id = ?', att.id).status, 'submitted');

  const ok = await lan.post(`/api/attempts/${att.id}/reopen`, { reason: 'Em báo mất mạng khi nộp bài', minutes: 20 });
  assert.equal(ok.status, 200);
  const r = rows('attempt_reopen', "AND outcome = 'ok'");
  assert.equal(r.length, 1);
  assert.equal(r[0].reason, 'Em báo mất mạng khi nộp bài');
  assert.equal(r[0].old.status, 'submitted');
  assert.equal(r[0].new.status, 'in_progress');
  assert.equal(r[0].new.deadline_at, clock + 20 * 60000);
  const a = app.db.get('SELECT status, score10, deadline_at FROM attempts WHERE id = ?', att.id);
  assert.equal(a.status, 'in_progress');
  assert.equal(a.score10, null);
  // học sinh nộp lại được
  const v = await ctx.s.get(`/api/attempts/${att.id}`);
  assert.equal(v.data.status, 'in_progress');
  const again = await lan.post(`/api/attempts/${att.id}/reopen`, { reason: 'Mở lại lần hai khi đang làm' });
  assert.equal(again.status, 400, 'bài đang làm không mở lại được');
  assert.equal(rows('attempt_reopen', "AND outcome = 'ok'").length, 1);
});

test('Gia hạn bài giao và bài làm: một dòng mỗi thao tác, giá trị cũ/mới; sai quyền bị ghi nhận', async () => {
  const { asg, att } = ctx;
  const a0 = app.db.get('SELECT close_at FROM assignments WHERE id = ?', asg);
  assert.equal((await minh.post(`/api/assignments/${asg}/extend`, { minutes: 60 })).status, 403);
  assert.equal((await khac.post(`/api/assignments/${asg}/extend`, { minutes: 60 })).status, 403);
  assert.equal(rows('assignment_extend', "AND outcome = 'denied'").length, 2);
  assert.equal((await lan.post(`/api/assignments/${asg}/extend`, { minutes: 0 })).status, 400);
  assert.equal((await lan.post(`/api/assignments/${asg}/extend`, { minutes: 120, reason: 'Trường mất điện' })).status, 200);
  const r = rows('assignment_extend', "AND outcome = 'ok'");
  assert.equal(r.length, 1);
  assert.equal(r[0].old.close_at, a0.close_at);
  assert.equal(r[0].new.close_at, a0.close_at + 120 * 60000);

  const d0 = app.db.get('SELECT deadline_at FROM attempts WHERE id = ?', att.id).deadline_at;
  assert.equal((await lan.post(`/api/attempts/${att.id}/extend`, { minutes: 10 })).status, 200);
  const e = rows('attempt_extend', "AND outcome = 'ok'");
  assert.equal(e.length, 1);
  assert.equal(e[0].old.deadline_at, d0);
  assert.equal(e[0].new.deadline_at, d0 + 10 * 60000);
  assert.equal((await minh.post(`/api/attempts/${att.id}/extend`, { minutes: 10 })).status, 403);
  assert.equal(rows('attempt_extend', "AND outcome = 'denied'").length, 1);
});

test('Xóa câu: chỉ người tạo/quản lý, bắt buộc lý do, xóa mềm; đổi đáp án câu đã dùng cần lý do', async () => {
  const mk = await lan.post('/api/questions', { type: 'mcq', stem: 'Câu thử $1+1$ bằng?', options: ['1', '2', '3', '4'], answer: 1, topic: 'T10.MENHDE', level: 1, explanation: 'Cộng.' });
  const qid = mk.data.id;
  // không ai trừ người tạo/quản lý xóa được
  for (const who of [minh, khac]) assert.equal((await who.del(`/api/questions/${qid}`, { reason: 'Thử xóa câu của người khác' })).status, 403);
  assert.equal(rows('question_delete', "AND outcome = 'denied'").length, 2);
  assert.equal(app.db.get('SELECT status FROM questions WHERE id = ?', qid).status, 'draft');
  assert.equal((await lan.del(`/api/questions/${qid}`, {})).status, 400, 'thiếu lý do');
  assert.equal(rows('question_delete', "AND outcome = 'ok'").length, 0);
  assert.equal((await lan.del(`/api/questions/${qid}`, { reason: 'Câu trùng với câu đã có' })).status, 200);
  const d = rows('question_delete', "AND outcome = 'ok'");
  assert.equal(d.length, 1);
  assert.equal(d[0].new.status, 'archived');
  assert.equal(app.db.get('SELECT status FROM questions WHERE id = ?', qid).status, 'archived', 'xóa mềm, vẫn còn trong CSDL');

  // đổi đáp án câu đã dùng trong đề
  const used = ctx.snap && Object.keys(ctx.snap).map(Number)[0];
  const q = app.db.get('SELECT * FROM questions WHERE id = ?', used);
  const owner = app.db.get('SELECT username FROM users WHERE id = ?', q.created_by)?.username ?? 'quanly';
  const ownerClient = owner === 'gv.lan' ? lan : owner === 'gv.minh' ? minh : admin;
  const newAnswer = (q.answer + 1) % 4;
  const other = ownerClient === minh ? lan : minh;
  assert.equal((await other.put(`/api/questions/${used}`, { answer: newAnswer, reason: 'Thử đổi đáp án của người khác' })).status, 403);
  assert.equal(rows('question_answer_change', "AND outcome = 'denied'").length, 1);
  assert.equal((await ownerClient.put(`/api/questions/${used}`, { answer: newAnswer })).status, 400, 'thiếu lý do');
  assert.equal(rows('question_answer_change', "AND outcome = 'ok'").length, 0);
  const ok = await ownerClient.put(`/api/questions/${used}`, { answer: newAnswer, reason: 'Đáp án cũ nhập nhầm' });
  assert.equal(ok.status, 200);
  const c = rows('question_answer_change', "AND outcome = 'ok'");
  assert.equal(c.length, 1);
  assert.equal(c[0].old.answer, q.answer);
  assert.equal(c[0].new.answer, newAnswer);
  assert.equal(c[0].reason, 'Đáp án cũ nhập nhầm');
  // sửa đề bài (không đổi đáp án) chỉ là question_edit, không cần lý do
  const editsBefore = rows('question_edit').length;
  assert.equal((await ownerClient.put(`/api/questions/${used}`, { explanation: 'Lời giải mới' })).status, 200);
  assert.equal(rows('question_edit').length, editsBefore + 1);
  assert.equal(rows('question_answer_change', "AND outcome = 'ok'").length, 1);
});

test('Xuất dữ liệu: đúng một dòng; chỉ giáo viên phụ trách lớp; đặt lại mật khẩu chỉ quản lý', async () => {
  const { asg, stu } = ctx;
  const csv = await lan.get(`/api/assignments/${asg}/export.csv`);
  assert.equal(csv.status, 200);
  assert.match(csv.data.toString('utf8'), /Họ tên,Tên đăng nhập,Mã đề,Trạng thái,Điểm/);
  assert.equal(rows('data_export', "AND outcome = 'ok'").length, 1);
  assert.match(rows('data_export')[0].target, /^assignment:/);
  for (const who of [minh, khac]) assert.equal((await who.get(`/api/assignments/${asg}/export.csv`)).status, 403);
  assert.equal(rows('data_export', "AND outcome = 'denied'").length, 2);

  const n0 = rows('password_reset').length;
  const bad = await lan.post(`/api/admin/users/${stu.id}/reset-password`, {});
  assert.equal(bad.status, 403);
  assert.equal(rows('password_reset').length, n0, 'chưa đổi gì, không có dòng password_reset');
  const denied = app.db.all("SELECT * FROM audit_log WHERE action = 'denied' AND detail LIKE '%reset-password%'");
  assert.equal(denied.length, 1);
  assert.equal(denied[0].user_id, userId('gv.lan'));
  const ok = await admin.post(`/api/admin/users/${stu.id}/reset-password`, { reason: 'Em quên mật khẩu' });
  assert.equal(ok.status, 200);
  const r = rows('password_reset');
  assert.equal(r.length, n0 + 1);
  assert.equal(r.at(-1).target, `user:${stu.id}`);
  assert.equal(r.at(-1).reason, 'Em quên mật khẩu');
  assert.ok(!JSON.stringify(r.at(-1)).includes(ok.data.tempPassword), 'không ghi mật khẩu vào nhật ký');
});

test('Quản lý xem nhật ký của trường mình (kể cả lần bị từ chối), không thấy trường khác; giáo viên không xem được', async () => {
  const ad = (await admin.get('/api/admin/audit?limit=500')).data.entries;
  assert.ok(ad.some((e) => e.action === 'score_edit' && e.outcome === 'ok' && e.old?.score10 === 10 && e.new?.score10 === 8.5));
  assert.ok(ad.some((e) => e.outcome === 'denied'));
  const otherSchool = app.db.get('SELECT school_id FROM users WHERE username = ?', 'gv.khac').school_id;
  const mine = app.db.get('SELECT school_id FROM users WHERE username = ?', 'quanly').school_id;
  const ids = new Set(app.db.all('SELECT id FROM audit_log WHERE school_id = ?', mine).map((r) => r.id));
  assert.ok(ad.every((e) => ids.has(e.id)), 'chỉ dòng của trường mình');
  assert.ok(app.db.all('SELECT id FROM audit_log WHERE school_id = ?', otherSchool).length > 0);
  const only = (await admin.get('/api/admin/audit?outcome=denied')).data.entries;
  assert.ok(only.length > 0 && only.every((e) => e.outcome === 'denied'));
  assert.equal((await lan.get('/api/admin/audit')).status, 403);
});

test('Nhật ký chỉ thêm: không có API sửa/xóa, CSDL từ chối UPDATE/DELETE', async () => {
  const id = app.db.get('SELECT MIN(id) id FROM audit_log').id;
  const count = app.db.get('SELECT COUNT(*) n FROM audit_log').n;
  for (const [m, p] of [['PUT', `/api/admin/audit/${id}`], ['DELETE', `/api/admin/audit/${id}`], ['POST', '/api/admin/audit'], ['DELETE', '/api/admin/audit']]) {
    const r = await admin.post === undefined ? null : await (m === 'PUT' ? admin.put(p, { detail: 'x' }) : m === 'DELETE' ? admin.del(p) : admin.post(p, { detail: 'x' }));
    assert.equal(r.status, 404, `${m} ${p}`);
  }
  assert.throws(() => app.db.run("UPDATE audit_log SET detail = 'sửa' WHERE id = ?", id), /chỉ được thêm/i);
  assert.throws(() => app.db.run('DELETE FROM audit_log WHERE id = ?', id), /chỉ được thêm/i);
  assert.equal(app.db.get('SELECT COUNT(*) n FROM audit_log').n, count);
});

test('Di trú: nhật ký cũ thiếu cột được nâng cấp, dòng cũ còn nguyên, và bị khóa sửa/xóa', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'au-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec('CREATE TABLE audit_log (id INTEGER PRIMARY KEY, school_id INTEGER, user_id INTEGER, action TEXT NOT NULL, detail TEXT, ip TEXT, at INTEGER NOT NULL)');
  old.prepare('INSERT INTO audit_log (school_id, user_id, action, detail, at) VALUES (?,?,?,?,?)').run(1, 2, 'login', 'cũ', 5);
  old.close();
  for (let i = 0; i < 2; i++) {
    const db = openDb(file);
    const r = db.get('SELECT * FROM audit_log');
    assert.equal(r.detail, 'cũ');
    assert.equal(r.outcome, 'ok');
    assert.equal(r.reason, null);
    assert.throws(() => db.run('DELETE FROM audit_log'), /chỉ được thêm/i);
    db.close();
  }
});
