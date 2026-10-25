// Nâng cấp 2: ôn giãn cách — hàm thuần (không đồng hồ thật) và API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.mjs';
import { scheduleReview, vnDay, addDays, isDue, overdueDays, INTERVAL_DAYS } from '../shared/spaced.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

const at = (iso) => Date.parse(iso);

test('Bậc ôn 1-3-7-14-30 ngày; đúng thì lên bậc, hết bậc cuối thì ra khỏi sổ', () => {
  assert.deepEqual(INTERVAL_DAYS, [1, 3, 7, 14, 30]);
  let day = '2026-10-19';
  let r = scheduleReview(null, false, at(`${day}T09:00:00+07:00`));
  assert.equal(r.action, 'add');
  assert.deepEqual(r.state, { box: 0, due_day: '2026-10-20', last_day: day, lapses: 1 });
  const expected = [3, 7, 14, 30];
  for (let i = 0; i < expected.length; i++) {
    day = r.state.due_day;
    r = scheduleReview(r.state, true, at(`${day}T09:00:00+07:00`));
    assert.equal(r.action, 'promote');
    assert.equal(r.state.box, i + 1);
    assert.equal(r.state.due_day, addDays(day, expected[i]));
  }
  day = r.state.due_day;
  r = scheduleReview(r.state, true, at(`${day}T09:00:00+07:00`));
  assert.equal(r.action, 'graduate');
  assert.equal(r.state, null);
});

test('Làm sai thì về bậc đầu và tính lần sai; đúng khi chưa từng sai thì không vào sổ', () => {
  const s = { box: 3, due_day: '2026-10-20', last_day: '2026-10-06', lapses: 1 };
  const r = scheduleReview(s, false, at('2026-10-20T10:00:00+07:00'));
  assert.equal(r.action, 'reset');
  assert.deepEqual(r.state, { box: 0, due_day: '2026-10-21', last_day: '2026-10-20', lapses: 2 });
  assert.equal(scheduleReview(null, true, at('2026-10-20T10:00:00+07:00')).action, 'none');
});

test('Quá hạn: vẫn đến hạn, đếm số ngày quá hạn; làm đúng muộn thì hẹn tính từ hôm làm', () => {
  const s = { box: 1, due_day: '2026-10-10', last_day: '2026-10-07', lapses: 1 };
  const now = at('2026-10-15T08:00:00+07:00');
  assert.equal(isDue(s, now), true);
  assert.equal(overdueDays(s, now), 5);
  assert.equal(overdueDays(s, at('2026-10-10T23:59:00+07:00')), 0);
  assert.equal(isDue(s, at('2026-10-09T23:59:00+07:00')), false);
  const r = scheduleReview(s, true, now);
  assert.equal(r.state.due_day, '2026-10-22'); // bậc 3 = 7 ngày kể từ 15/10
});

test('Múi giờ Asia/Ho_Chi_Minh: ranh giới ngày là 17:00 UTC', () => {
  assert.equal(vnDay(at('2026-10-19T16:59:59Z')), '2026-10-19');
  assert.equal(vnDay(at('2026-10-19T17:00:00Z')), '2026-10-20');
  assert.equal(vnDay(at('2026-12-31T20:00:00Z')), '2027-01-01');
  assert.equal(addDays('2026-02-27', 3), '2026-03-02');
  const r = scheduleReview(null, false, at('2026-10-19T16:30:00Z')); // 23:30 giờ VN
  assert.equal(r.state.due_day, '2026-10-20');
  assert.equal(isDue(r.state, at('2026-10-19T17:00:00Z')), true);
  assert.equal(isDue(r.state, at('2026-10-19T16:59:00Z')), false);
});

test('Không ôn hai lần cùng một câu trong một ngày; đúng khi chưa đến hạn không lên bậc', () => {
  const first = scheduleReview(null, false, at('2026-10-19T08:00:00+07:00')).state;
  for (const correct of [true, false]) {
    const again = scheduleReview(first, correct, at('2026-10-19T20:00:00+07:00'));
    assert.equal(again.action, 'skip');
    assert.deepEqual(again.state, first);
  }
  const notDue = { box: 1, due_day: '2026-10-25', last_day: '2026-10-22', lapses: 1 };
  const e = scheduleReview(notDue, true, at('2026-10-23T09:00:00+07:00'));
  assert.equal(e.action, 'early');
  assert.deepEqual(e.state, notDue);
  assert.equal(scheduleReview(notDue, false, at('2026-10-23T09:00:00+07:00')).action, 'reset');
});

test('Di trú: mục ôn cũ (chỉ có due_at) được suy ra ngày đến hạn theo giờ Việt Nam', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rv-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec('CREATE TABLE review_items (student_id INTEGER NOT NULL, qid INTEGER NOT NULL, school_id INTEGER NOT NULL, box INTEGER NOT NULL, due_at INTEGER NOT NULL, lapses INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (student_id, qid))');
  old.prepare('INSERT INTO review_items VALUES (?,?,?,?,?,?)').run(1, 1, 1, 2, at('2026-10-19T17:30:00Z'), 1);
  old.prepare('INSERT INTO review_items VALUES (?,?,?,?,?,?)').run(1, 2, 1, 0, at('2026-10-19T16:30:00Z'), 1);
  old.close();
  for (let i = 0; i < 2; i++) {
    const db = openDb(file);
    assert.deepEqual(db.all('SELECT qid, box, due_day, last_day FROM review_items ORDER BY qid'), [
      { qid: 1, box: 2, due_day: '2026-10-20', last_day: null },
      { qid: 2, box: 0, due_day: '2026-10-19', last_day: null },
    ]);
    db.close();
  }
});

// ---------------- API ----------------
let clock = at('2026-10-19T08:00:00+07:00');
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
    return { status: res.status, data: await res.json() };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
      return r.data.user;
    },
  };
}

let ctx;
test('API: sai bài → đến hạn sau 1 ngày; quá hạn hiện cho giáo viên; học sinh/giáo viên khác trường bị chặn', async () => {
  const teacher = client();
  await teacher.login('gv.lan');
  const g = await teacher.post('/api/exams/generate', { counts: { mcq: 4, tf: 0, short: 0 }, seed: 'rv' });
  const exam = (await teacher.post('/api/exams', { title: 'Ôn', items: g.data.items, durationMin: 30, variants: 1, seed: 'rv' })).data.id;
  const cls = (await teacher.get('/api/classes')).data.classes[0];
  const asg = (await teacher.post('/api/assignments', { examId: exam, classId: cls.id, mode: 'homework', openAt: clock - 1000, closeAt: clock + 30 * 86400000 })).data.ids[0];
  const snap = app.db.get('SELECT snapshot_json FROM exams WHERE id = ?', exam).snapshot;
  const stu = app.db.get("SELECT id, username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", cls.id);
  app.db.run('DELETE FROM review_items WHERE student_id = ?', stu.id); // bỏ sổ lỗi sai do dữ liệu mẫu tạo sẵn
  const s = client();
  await s.login(stu.username);
  const att = (await s.post('/api/attempts/start', { assignmentId: asg })).data;
  const layout = app.db.get('SELECT layout_json FROM attempts WHERE id = ?', att.id).layout;
  const wrong = Object.fromEntries(layout.map((it) => [it.qid, (it.perm.indexOf(snap[it.qid].answer) + 1) % 4]));
  await s.post(`/api/attempts/${att.id}/submit`, { responses: wrong, version: 1 });
  ctx = { teacher, s, stu, cls, layout, snap, att };

  assert.equal((await s.get('/api/student/review/due')).data.count, 0, 'cùng ngày chưa đến hạn');
  const rows = app.db.all('SELECT * FROM review_items WHERE student_id = ?', stu.id);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.due_day === '2026-10-20' && r.box === 0));

  clock = at('2026-10-20T07:00:00+07:00');
  await s.login(stu.username); // phiên cũ hết hạn khi đồng hồ nhảy sang ngày sau
  await teacher.login('gv.lan');
  const due = (await s.get('/api/student/review/due')).data;
  assert.equal(due.count, 4);
  assert.equal(due.today, '2026-10-20');
  assert.equal(due.items[0].overdueDays, 0);
  const day2 = (await teacher.get('/api/teacher/review-stats')).data.classes[0].students.find((x) => x.id === stu.id);
  assert.equal(day2.overdue, 0);
  assert.equal(day2.due, 4);

  clock = at('2026-10-22T07:00:00+07:00');
  await s.login(stu.username);
  await teacher.login('gv.lan');
  const stats = (await teacher.get(`/api/teacher/review-stats?classId=${cls.id}`)).data;
  const row = stats.classes[0].students.find((x) => x.id === stu.id);
  assert.equal(row.overdue, 4);
  assert.equal(row.maxOverdueDays, 2);
  assert.ok(stats.classes[0].studentsWithOverdue >= 1 && stats.classes[0].totalOverdue >= 4);

  assert.equal((await s.get('/api/teacher/review-stats')).status, 403, 'học sinh không xem thống kê giáo viên');
  const other = client();
  await other.login('gv.khac');
  assert.deepEqual((await other.get('/api/teacher/review-stats')).data.classes, []);
  const peerRow = app.db.get("SELECT id, username FROM users WHERE role = 'student' AND id != ? AND class_id = ?", stu.id, cls.id);
  const peer = client();
  await peer.login(peerRow.username);
  const peerDue = (await peer.get('/api/student/review/due')).data;
  const own = app.db.all('SELECT qid FROM review_items WHERE student_id = ? AND due_day <= ?', peerRow.id, '2026-10-22').map((r) => r.qid).sort((x, y) => x - y);
  assert.deepEqual(peerDue.items.map((x) => x.qid).sort((x, y) => x - y), own, 'chỉ trả sổ của chính em đó');
});

test('API: làm đúng câu đến hạn → lên bậc 2 hẹn sau 3 ngày; làm lại cùng ngày không lên nữa', () => {
  const { stu, layout, snap, att } = ctx;
  const it = layout[0];
  const q = snap[it.qid];
  const row = app.db.get('SELECT * FROM attempts WHERE id = ?', att.id);
  const correct = { [q.id]: it.perm.indexOf(q.answer) };
  const finalizeOnce = () => app.db.tx(() => app.internals.finalize({ ...row, kind: 'practice', layout: [it], checked: {} }, correct, {}, 'submitted'));
  clock = at('2026-10-22T09:00:00+07:00');
  finalizeOnce();
  const r1 = app.db.get('SELECT * FROM review_items WHERE student_id = ? AND qid = ?', stu.id, q.id);
  assert.equal(r1.box, 1);
  assert.equal(r1.due_day, '2026-10-25');
  assert.equal(r1.last_day, '2026-10-22');
  clock = at('2026-10-22T21:00:00+07:00');
  finalizeOnce();
  assert.equal(app.db.get('SELECT box FROM review_items WHERE student_id = ? AND qid = ?', stu.id, q.id).box, 1, 'cùng ngày không ôn lần hai');
  clock = at('2026-10-24T09:00:00+07:00');
  finalizeOnce();
  assert.equal(app.db.get('SELECT box FROM review_items WHERE student_id = ? AND qid = ?', stu.id, q.id).box, 1, 'chưa đến hạn thì không lên bậc');
});
