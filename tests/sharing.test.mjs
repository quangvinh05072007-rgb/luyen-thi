// Giai đoạn 6a: đề riêng/chung, nhân bản, xếp hạng "hot", bình luận, duyệt hai người.
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
let lan;
let minh;
let khac;
let admin;
before(async () => {
  app = createApp({ dbFile: ':memory:', clock: () => clock, aiImpl: { enabled: false } });
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
  [lan, minh, khac, admin] = [client(), client(), client(), client()];
  await lan.login('gv.lan');
  await minh.login('gv.minh');
  await khac.login('gv.khac');
  await admin.login('quanly');
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
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
    },
  };
}
const audits = (action) => app.db.all('SELECT * FROM audit_log WHERE action = ? ORDER BY id', action);
const mkQ = async (who, stem) => {
  const r = await who.post('/api/questions', { type: 'mcq', stem, options: ['$1$', '$2$', '$3$', '$4$'], answer: 0, topic: 'T11.DAOHAM', level: 1, explanation: 'x' });
  return r.data.id;
};
const mkExam = async (who, title, extra = {}) => {
  const q = await mkQ(who, `Câu cho ${title}`);
  await who.post('/api/questions/approve', { ids: [q] });
  return (await who.post('/api/exams', { title, items: [{ qid: q }], durationMin: 10, variants: 1, seed: title, ...extra })).data.id;
};

let examA;
test('Đề mới mặc định là riêng tư: người khác không thấy, không xuất, không nhân bản, không giao; quản lý xem được', async () => {
  examA = await mkExam(lan, 'Đề riêng của cô Lan');
  assert.equal(app.db.get('SELECT visibility FROM exams WHERE id = ?', examA).visibility, 'private');
  assert.ok(!(await minh.get('/api/exams')).data.exams.some((e) => e.id === examA));
  assert.equal((await minh.get(`/api/exams/${examA}`)).status, 404);
  assert.equal((await minh.get(`/api/exams/${examA}/docx`)).status, 404);
  assert.equal((await minh.get(`/api/exams/${examA}/answer-key`)).status, 404);
  assert.equal((await minh.post(`/api/exams/${examA}/clone`, {})).status, 404);
  const minhClass = (await minh.get('/api/classes')).data.classes[0].id;
  assert.equal((await minh.post('/api/assignments', { examId: examA, classId: minhClass, openAt: clock, closeAt: clock + 86400000 })).status, 400);
  assert.ok((await lan.get('/api/exams')).data.exams.some((e) => e.id === examA && e.mine));
  assert.ok((await admin.get('/api/exams')).data.exams.some((e) => e.id === examA), 'quản lý thấy đề riêng trong trường');
  assert.equal((await khac.get(`/api/exams/${examA}`)).status, 404);
});

test('Chia sẻ: chỉ người ra đề/quản lý; đề dùng chung ai trong trường cũng xem, xuất, nhân bản, giao cho lớp mình', async () => {
  assert.equal((await minh.post(`/api/exams/${examA}/share`, { visibility: 'school' })).status, 403);
  assert.equal((await khac.post(`/api/exams/${examA}/share`, { visibility: 'school' })).status, 403);
  assert.equal(audits('exam_share').filter((a) => a.outcome === 'denied').length, 2);
  const r = await lan.post(`/api/exams/${examA}/share`, { visibility: 'school', dept: 'Tổ Toán' });
  assert.equal(r.status, 200);
  const row = audits('exam_share').find((a) => a.outcome === 'ok');
  assert.equal(row.old.visibility, 'private');
  assert.equal(row.new.visibility, 'school');
  const seen = (await minh.get('/api/exams')).data.exams.find((e) => e.id === examA);
  assert.equal(seen.visibility, 'school');
  assert.equal(seen.dept, 'Tổ Toán');
  assert.equal(seen.mine, false);
  assert.equal((await minh.get(`/api/exams/${examA}/docx`)).status, 200);
  assert.equal((await khac.get(`/api/exams/${examA}`)).status, 404, 'trường khác vẫn không thấy');
  const minhClass = (await minh.get('/api/classes')).data.classes[0].id;
  assert.equal((await minh.post('/api/assignments', { examId: examA, classId: minhClass, openAt: clock, closeAt: clock + 86400000 })).status, 200);
  const clone = await minh.post(`/api/exams/${examA}/clone`, { title: 'Bản của thầy Minh' });
  assert.equal(clone.status, 200);
  const c = app.db.get('SELECT visibility, parent_id, created_by FROM exams WHERE id = ?', clone.data.id);
  assert.equal(c.visibility, 'private', 'bản sao mặc định riêng tư');
  assert.equal(c.parent_id, examA);
  assert.ok(!(await lan.get('/api/exams')).data.exams.some((e) => e.id === clone.data.id), 'cô Lan không thấy bản sao riêng của thầy Minh');
  const filtered = (await minh.get('/api/exams?dept=' + encodeURIComponent('Tổ Toán'))).data.exams;
  assert.ok(filtered.length >= 1 && filtered.every((e) => e.dept === 'Tổ Toán'));
});

test('Đánh giá và xếp hạng hot: không tự đánh giá, không đánh giá đề riêng; trung bình sao; hot theo lượt dùng và sao', async () => {
  const examB = await mkExam(lan, 'Đề B dùng chung', { visibility: 'school' });
  const examC = await mkExam(minh, 'Đề C dùng chung', { visibility: 'school', dept: 'Tổ Lý' });
  assert.equal((await lan.post(`/api/exams/${examB}/rate`, { stars: 5 })).status, 400, 'không tự đánh giá');
  const priv = await mkExam(lan, 'Đề riêng khác');
  assert.equal((await minh.post(`/api/exams/${priv}/rate`, { stars: 5 })).status, 404);
  assert.equal((await minh.post(`/api/exams/${examB}/rate`, { stars: 6 })).status, 400);
  assert.equal((await minh.post(`/api/exams/${examB}/rate`, { stars: 0 })).status, 400);
  assert.equal((await khac.post(`/api/exams/${examB}/rate`, { stars: 5 })).status, 404);
  const r1 = await minh.post(`/api/exams/${examB}/rate`, { stars: 3, comment: 'Tạm ổn' });
  assert.deepEqual(r1.data, { ratingAvg: 3, ratingCount: 1 });
  const r2 = await minh.post(`/api/exams/${examB}/rate`, { stars: 5 });
  assert.deepEqual(r2.data, { ratingAvg: 5, ratingCount: 1 }, 'đánh giá lại thì thay, không cộng dồn');
  await admin.post(`/api/exams/${examB}/rate`, { stars: 4 });
  assert.deepEqual((await lan.get('/api/exams')).data.exams.find((e) => e.id === examB).ratingAvg, 4.5);
  // lượt dùng: giao bài từ đề C hai lần
  const cls = (await minh.get('/api/classes')).data.classes[0].id;
  await minh.post('/api/assignments', { examId: examC, classId: cls, openAt: clock, closeAt: clock + 86400000 });
  await minh.post('/api/assignments', { examId: examC, classId: cls, openAt: clock, closeAt: clock + 2 * 86400000 });
  const hot = (await lan.get('/api/exams?scope=hot')).data.exams;
  assert.ok(hot.every((e) => e.visibility === 'school'), 'hot chỉ gồm đề dùng chung');
  assert.ok(!hot.some((e) => e.id === priv));
  const scores = hot.map((e) => e.hot);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'sắp xếp giảm dần theo hot');
  assert.ok(hot.find((e) => e.id === examC).uses >= 2);
  const mineOnly = (await minh.get('/api/exams?scope=mine')).data.exams;
  assert.ok(mineOnly.length > 0 && mineOnly.every((e) => e.mine));
});

test('Bình luận câu hỏi và đề: chỉ giáo viên trong trường, chỉ thêm', async () => {
  const q = await mkQ(lan, 'Câu để bình luận');
  assert.equal((await minh.post(`/api/questions/${q}/comments`, { body: '' })).status, 400);
  const c = await minh.post(`/api/questions/${q}/comments`, { body: 'Phương án C hơi giống B, nên đổi.' });
  assert.equal(c.status, 200);
  await lan.post(`/api/questions/${q}/comments`, { body: 'Cảm ơn thầy, em sửa.' });
  const list = (await lan.get(`/api/questions/${q}/comments`)).data.comments;
  assert.equal(list.length, 2);
  assert.equal(list[0].author, 'Thầy Trần Văn Minh');
  assert.equal(list[0].mine, false);
  assert.equal(list[1].mine, true);
  assert.equal((await khac.get(`/api/questions/${q}/comments`)).status, 404);
  assert.equal((await khac.post(`/api/questions/${q}/comments`, { body: 'lén' })).status, 404);
  const stu = client();
  await stu.login('hs.an.nm');
  assert.equal((await stu.get(`/api/questions/${q}/comments`)).status, 403);
  // bình luận trên đề: đề riêng của người khác không bình luận được
  const priv = await mkExam(lan, 'Đề riêng để bình luận');
  assert.equal((await minh.post(`/api/exams/${priv}/comments`, { body: 'xem thử' })).status, 404);
  assert.equal((await lan.post(`/api/exams/${priv}/comments`, { body: 'ghi chú của tôi' })).status, 200);
  assert.equal(audits('comment_add').length, 3);
});

test('Duyệt hai người: chính sách do quản lý đặt; một người duyệt chưa đủ; người thứ hai không phải tác giả mới hoàn tất; sửa nội dung phải duyệt lại', async () => {
  assert.equal((await lan.put('/api/admin/settings', { reviewPolicy: 'double' })).status, 403, 'giáo viên không đổi được chính sách');
  assert.equal(audits('denied').filter((a) => /settings/.test(a.detail ?? '')).length, 1);
  assert.equal((await admin.put('/api/admin/settings', { reviewPolicy: 'tuy-y' })).status, 400);
  assert.equal((await admin.put('/api/admin/settings', { reviewPolicy: 'double' })).data.reviewPolicy, 'double');
  const a = audits('settings_change');
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].old.reviewPolicy, a[0].new.reviewPolicy], ['single', 'double']);

  const q = await mkQ(lan, 'Câu cần hai người duyệt');
  const r1 = await lan.post('/api/questions/approve', { ids: [q] });
  assert.deepEqual(r1.data.approved, []);
  assert.equal(r1.data.pending[0].id, q);
  const r1b = await lan.post('/api/questions/approve', { ids: [q] });
  assert.deepEqual(r1b.data.approved, [], 'cùng một người duyệt hai lần vẫn chưa đủ');
  assert.equal(app.db.get('SELECT status FROM questions WHERE id = ?', q).status, 'draft');
  const listed = (await lan.get('/api/questions')).data.questions.find((x) => x.id === q);
  assert.equal(listed.approvals.length, 1);
  const r2 = await minh.post('/api/questions/approve', { ids: [q] });
  assert.deepEqual(r2.data.approved, [q]);
  assert.equal(app.db.get('SELECT status FROM questions WHERE id = ?', q).status, 'approved');
  assert.equal(audits('question_approve_first').length, 2);

  // Sửa lời giải cũng cần duyệt lại theo chính sách hai người.
  assert.equal((await lan.put(`/api/questions/${q}`, { explanation: 'Chỉ sửa lời giải' })).status, 200);
  assert.equal(app.db.get('SELECT status FROM questions WHERE id = ?', q).status, 'draft');
  await lan.post('/api/questions/approve', { ids: [q] });
  await minh.post('/api/questions/approve', { ids: [q] });
  assert.equal((await lan.put(`/api/questions/${q}`, { stem: 'Câu cần hai người duyệt (đã sửa đề)' })).status, 200);
  const after = app.db.get('SELECT status, approvals_json FROM questions WHERE id = ?', q);
  assert.equal(after.status, 'draft');
  assert.equal(after.approvals ?? null, null);

  // quản lý + tác giả cũng đủ (hai người khác nhau, có người không phải tác giả)
  await lan.post('/api/questions/approve', { ids: [q] });
  assert.deepEqual((await admin.post('/api/questions/approve', { ids: [q] })).data.approved, [q]);
  // câu thiếu thông tin vẫn bị từ chối như cũ
  const bad = (await lan.post('/api/questions', { type: 'mcq', stem: 'Thiếu phương án', options: ['', '', '', ''], answer: null, topic: 'T11.DAOHAM', level: 1 })).data.id;
  assert.equal((await minh.post('/api/questions/approve', { ids: [bad] })).data.rejected[0].id, bad);

  assert.equal((await admin.put('/api/admin/settings', { reviewPolicy: 'single' })).data.reviewPolicy, 'single');
  const q2 = await mkQ(lan, 'Câu một người duyệt');
  assert.deepEqual((await lan.post('/api/questions/approve', { ids: [q2] })).data.approved, [q2], 'trở lại chính sách một người');
});

test('Di trú: đề cũ (chưa có cột chia sẻ) mặc định dùng chung trong trường để không mất quyền xem', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sh-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec("CREATE TABLE schools (id INTEGER PRIMARY KEY, name TEXT NOT NULL, sample INTEGER NOT NULL DEFAULT 0); CREATE TABLE exams (id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, title TEXT NOT NULL, blueprint_json TEXT NOT NULL, items_json TEXT NOT NULL, duration_min INTEGER NOT NULL, variants_json TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_by INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE TABLE questions (id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, type TEXT NOT NULL, stem TEXT NOT NULL, topic TEXT, status TEXT, source TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
  old.exec("INSERT INTO schools (id, name) VALUES (1, 'Cũ'); INSERT INTO exams VALUES (1, 1, 'Đề cũ', '{}', '[]', 10, '[]', '{}', 2, 1);");
  old.close();
  for (let i = 0; i < 2; i++) {
    const db = openDb(file);
    assert.equal(db.get('SELECT visibility FROM exams').visibility, 'school');
    assert.equal(db.get('SELECT review_policy p FROM schools').p, 'single');
    db.close();
  }
});
