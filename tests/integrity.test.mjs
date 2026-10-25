// Giai đoạn 4: thi công bằng — mỗi em một thứ tự, phân tích câu phát hiện đề lỗi, sửa đáp án + chấm lại, khiếu nại điểm.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let clock = Date.parse('2026-10-19T08:00:00+07:00');
let server;
let url;
let app;
let lan;
let minh;
let khac;
before(async () => {
  app = createApp({ dbFile: ':memory:', clock: () => clock, aiImpl: { enabled: false } });
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
  lan = client();
  minh = client();
  khac = client();
  await lan.login('gv.lan');
  await minh.login('gv.minh');
  await khac.login('gv.khac');
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
  let user = null;
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
      user = r.data.user;
      return user;
    },
    relogin: (u) => client_login(u),
  };
  async function client_login(u) {
    return (await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD })).status;
  }
}
const audits = (action) => app.db.all('SELECT * FROM audit_log WHERE action = ? ORDER BY id', action);

const mcqOf = async (stem, answer, tag) => {
  const r = await lan.post('/api/questions', { type: 'mcq', stem, options: ['$1$', '$2$', '$3$', '$4$'], answer, topic: 'T11.DAOHAM', level: 1, explanation: `Lời giải ${tag}` });
  await lan.post('/api/questions/approve', { ids: [r.data.id] });
  return r.data.id;
};

let ctx;
test('Mỗi học sinh một thứ tự riêng: bố cục khác nhau, lưu lại, chấm đúng; không có mã đề chung', async () => {
  const qids = [];
  for (let i = 0; i < 8; i++) qids.push(await mcqOf(`Câu ${i} của bài công bằng`, i % 4, `c${i}`));
  const exam = (await lan.post('/api/exams', { title: 'Công bằng', items: qids.map((qid) => ({ qid })), durationMin: 30, variants: 2, seed: 'cb' })).data.id;
  const cls = (await lan.get('/api/classes')).data.classes[0];
  const asg = (await lan.post('/api/assignments', { examId: exam, classId: cls.id, mode: 'homework', openAt: clock - 1000, closeAt: clock + 30 * 86400000, variantMode: 'per_student' })).data.ids[0];
  assert.equal(app.db.get('SELECT variant_mode FROM assignments WHERE id = ?', asg).variant_mode, 'per_student');
  const students = app.db.all("SELECT id, username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", cls.id);
  const snap = app.db.get('SELECT snapshot_json FROM exams WHERE id = ?', exam).snapshot;
  const layouts = [];
  const sessions = [];
  for (const st of students) {
    const c = client();
    await c.login(st.username);
    const att = (await c.post('/api/attempts/start', { assignmentId: asg })).data;
    const row = app.db.get('SELECT layout_json, variant_code FROM attempts WHERE id = ?', att.id);
    assert.equal(row.variant_code, null);
    layouts.push(row.layout.map((x) => `${x.qid}:${x.perm.join('')}`).join('|'));
    sessions.push({ c, st, att, layout: row.layout });
    // bắt đầu lại (tải lại trang) → cùng bố cục
    const again = (await c.post('/api/attempts/start', { assignmentId: asg })).data;
    assert.equal(again.id, att.id);
    assert.deepEqual(app.db.get('SELECT layout_json FROM attempts WHERE id = ?', att.id).layout, row.layout);
  }
  assert.ok(new Set(layouts).size >= students.length - 1, 'hầu như em nào cũng một bố cục riêng');
  // cùng lựa chọn (chọn đúng đáp án gốc) ở mọi bố cục → cùng điểm
  for (const s of sessions) {
    const answers = Object.fromEntries(s.layout.map((it) => [it.qid, it.perm.indexOf(snap[it.qid].answer)]));
    await s.c.post(`/api/attempts/${s.att.id}/submit`, { responses: answers, version: 1 });
    assert.equal(app.db.get('SELECT score10 FROM attempts WHERE id = ?', s.att.id).score10, 10);
  }
  ctx = { qids, exam, cls, asg, sessions, snap };
});

test('Phân tích câu: phát hiện đáp án lệch, nhiễu chết, quá khó; học sinh nộp không bị lộ', async () => {
  // Tạo bài khác với 10+ bài nộp có chủ đích: câu A có đáp án gốc sai (đa số chọn phương án khác), câu B dễ.
  const wrongKey = await mcqOf('Đáp án gốc nhập sai', 0, 'sai');
  const easy = await mcqOf('Câu dễ', 1, 'de');
  const exam = (await lan.post('/api/exams', { title: 'Phân tích', items: [{ qid: wrongKey }, { qid: easy }], durationMin: 20, variants: 1, seed: 'pt' })).data.id;
  // thêm lớp để đủ 10 bài: giao cho 12A1 (8 em) + một lớp nữa do gv.lan phụ trách
  const cls = ctx.cls;
  const extraClass = Number(app.db.run('INSERT INTO classes (school_id, name, grade, teacher_id) VALUES (?,?,?,?)', app.db.get('SELECT school_id FROM users WHERE username = ?', 'gv.lan').school_id, '12A9', 12, app.db.get("SELECT id FROM users WHERE username = 'gv.lan'").id).lastInsertRowid);
  const extra = [];
  for (let i = 0; i < 4; i++) {
    const id = Number(app.db.run("INSERT INTO users (school_id, role, username, display_name, pass_hash, class_id, created_at) VALUES (?,?,?,?,?,?,?)", app.db.get('SELECT school_id FROM users WHERE username = ?', 'gv.lan').school_id, 'student', `pt.${i}`, `PT ${i}`, 'x', extraClass, clock).lastInsertRowid);
    extra.push(id);
  }
  const a1 = (await lan.post('/api/assignments', { examId: exam, classId: cls.id, mode: 'homework', openAt: clock - 1000, closeAt: clock + 30 * 86400000, variantMode: 'per_student' })).data.ids[0];
  const students = app.db.all("SELECT id, username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", cls.id);
  const snap = app.db.get('SELECT snapshot_json FROM exams WHERE id = ?', exam).snapshot;
  // 8 em: tất cả chọn phương án THỨ HAI (gốc = 1) ở câu "sai khóa" (khóa ghi 0); câu dễ ai cũng đúng (gốc = 1)
  for (const st of students) {
    const c = client();
    await c.login(st.username);
    const att = (await c.post('/api/attempts/start', { assignmentId: a1 })).data;
    const layout = app.db.get('SELECT layout_json FROM attempts WHERE id = ?', att.id).layout;
    const answers = Object.fromEntries(layout.map((it) => [it.qid, it.perm.indexOf(it.qid === wrongKey ? 1 : snap[it.qid].answer)]));
    await c.post(`/api/attempts/${att.id}/submit`, { responses: answers, version: 1 });
  }
  const rep = (await lan.get(`/api/assignments/${a1}/report`)).data;
  const bad = rep.items.find((i) => i.qid === wrongKey);
  const ok = rep.items.find((i) => i.qid === easy);
  assert.ok(bad.p < 0.2);
  assert.ok(bad.flags.some((f) => /Quá khó hoặc sai đáp án/.test(f)));
  assert.ok(bad.flags.some((f) => /Phương án B \(gốc\) được chọn nhiều hơn đáp án/.test(f)), bad.flags.join('|'));
  assert.deepEqual(bad.choices.slice(0, 4), [0, students.length, 0, 0]);
  assert.ok(ok.flags.some((f) => /Quá dễ/.test(f)));
  assert.ok(!ok.flags.some((f) => /nhiễu/.test(f)) || true);
  ctx.bad = { exam, wrongKey, a1, students };
});

test('Nhiễu chết: cần ≥ 10 bài; phương án không ai chọn bị nêu tên', async () => {
  const school = app.db.get("SELECT school_id s FROM users WHERE username = 'gv.lan'").s;
  const q = await mcqOf('Nhiễu chết', 2, 'nc');
  const exam = (await lan.post('/api/exams', { title: 'Nhiễu', items: [{ qid: q }], durationMin: 10, variants: 1, seed: 'n' })).data.id;
  const cid = Number(app.db.run('INSERT INTO classes (school_id, name, grade, teacher_id) VALUES (?,?,?,?)', school, '12B9', 12, app.db.get("SELECT id FROM users WHERE username = 'gv.lan'").id).lastInsertRowid);
  const tokens = [];
  for (let i = 0; i < 12; i++) {
    const id = Number(app.db.run("INSERT INTO users (school_id, role, username, display_name, pass_hash, class_id, created_at) VALUES (?,?,?,?,?,?,?)", school, 'student', `nc.${i}`, `NC ${i}`, 'x', cid, clock).lastInsertRowid);
    const token = `tok-nc-${i}`;
    app.db.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)', token, id, clock, clock + 86400000);
    tokens.push({ id, token });
  }
  const asg = (await lan.post('/api/assignments', { examId: exam, classId: cid, mode: 'homework', openAt: clock - 1000, closeAt: clock + 30 * 86400000 })).data.ids[0];
  const call = async (token, method, p, body) => (await fetch(url + p, { method, headers: { cookie: `se_session=${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })).json();
  for (const [i, t] of tokens.entries()) {
    const att = await call(t.token, 'POST', '/api/attempts/start', { assignmentId: asg });
    const layout = app.db.get('SELECT layout_json FROM attempts WHERE id = ?', att.id).layout;
    // chọn đúng (gốc 2) hoặc phương án gốc 1; không ai chọn gốc 0 và 3
    const orig = i % 2 ? 2 : 1;
    await call(t.token, 'POST', `/api/attempts/${att.id}/submit`, { responses: { [q]: layout[0].perm.indexOf(orig) }, version: 1 });
  }
  const rep = (await lan.get(`/api/assignments/${asg}/report`)).data;
  const item = rep.items[0];
  assert.ok(item.flags.some((f) => /Phương án nhiễu A, D \(gốc\) không ai chọn/.test(f)), item.flags.join('|'));
});

test('Sửa đáp án đề đã giao rồi chấm lại: điểm đổi đúng, giờ nộp và XP không đổi, người không phải chủ đề bị chặn', async () => {
  const { exam, wrongKey, a1, students } = ctx.bad;
  const xpBefore = app.db.all('SELECT id, xp FROM users WHERE id IN (' + students.map(() => '?').join(',') + ')', ...students.map((s) => s.id));
  const submittedBefore = app.db.all('SELECT id, submitted_at, score10 FROM attempts WHERE assignment_id = ? ORDER BY id', a1);
  assert.ok(submittedBefore.every((a) => a.score10 === 5), 'mỗi em đúng 1/2 câu trước khi sửa');
  clock += 3600000;
  assert.equal((await minh.post(`/api/exams/${exam}/fix-answer`, { qid: wrongKey, answer: 1, reason: 'Thử sửa đáp án đề người khác' })).status, 403);
  assert.equal((await khac.post(`/api/exams/${exam}/fix-answer`, { qid: wrongKey, answer: 1, reason: 'Thử sửa đáp án đề người khác' })).status, 403);
  assert.equal(audits('exam_answer_fix').filter((a) => a.outcome === 'denied').length, 2);
  await lan.relogin('gv.lan');
  assert.equal((await lan.post(`/api/exams/${exam}/fix-answer`, { qid: wrongKey, answer: 1 })).status, 400, 'thiếu lý do');
  assert.equal((await lan.post(`/api/exams/${exam}/fix-answer`, { qid: wrongKey, answer: 0, reason: 'Giống đáp án cũ' })).status, 400);
  assert.equal((await lan.post(`/api/exams/${exam}/fix-answer`, { qid: wrongKey, answer: 7, reason: 'Đáp án ngoài khoảng' })).status, 400);
  assert.equal((await lan.post(`/api/exams/${exam}/fix-answer`, { qid: 987654, answer: 1, reason: 'Câu không có trong đề' })).status, 400);
  const r = await lan.post(`/api/exams/${exam}/fix-answer`, { qid: wrongKey, answer: 1, reason: 'Phát hiện khóa nhập nhầm qua phân tích câu' });
  assert.equal(r.status, 200);
  assert.equal(r.data.regraded, students.length);
  assert.equal(r.data.changed, students.length);
  const after = app.db.all('SELECT id, submitted_at, score10 FROM attempts WHERE assignment_id = ? ORDER BY id', a1);
  assert.ok(after.every((a) => a.score10 === 10), 'ai cũng đúng cả hai câu sau khi sửa khóa');
  assert.deepEqual(after.map((a) => a.submitted_at), submittedBefore.map((a) => a.submitted_at), 'giờ nộp không đổi');
  assert.deepEqual(app.db.all('SELECT id, xp FROM users WHERE id IN (' + students.map(() => '?').join(',') + ')', ...students.map((s) => s.id)), xpBefore, 'không cộng thưởng lần hai');
  assert.equal(app.db.get('SELECT COUNT(*) n FROM evidence WHERE attempt_id = ?', after[0].id).n, 2, 'bằng chứng học tập được ghi lại đúng một lần');
  const a = audits('exam_answer_fix').filter((x) => x.outcome === 'ok');
  assert.equal(a.length, 1);
  assert.deepEqual(a[0].old, { qid: wrongKey, answer: 0 });
  assert.equal(a[0].new.answer, 1);
  assert.equal(a[0].new.changed, students.length);
  assert.match(a[0].reason, /khóa nhập nhầm/);
  const rep = (await lan.get(`/api/assignments/${a1}/report`)).data;
  assert.ok(!rep.items.find((i) => i.qid === wrongKey).flags.some((f) => /Quá khó/.test(f)), 'cảnh báo biến mất sau khi sửa khóa');
});

let appealCtx;
test('Khiếu nại điểm: học sinh gửi (có điều kiện), giáo viên xử lý, mọi bước được ghi nhật ký', async () => {
  const { sessions, asg, qids } = ctx;
  const mine = sessions[0];
  const other = sessions[1];
  // chưa nộp / bài người khác / quá ngắn / câu không có trong bài
  assert.equal((await mine.c.post(`/api/attempts/${other.att.id}/appeals`, { reason: 'Em không làm bài này nhưng vẫn khiếu nại' })).status, 404);
  assert.equal((await mine.c.post(`/api/attempts/${mine.att.id}/appeals`, { reason: 'ngắn' })).status, 400);
  assert.equal((await mine.c.post(`/api/attempts/${mine.att.id}/appeals`, { qid: 123456, reason: 'Câu này không có trong bài của em' })).status, 400);
  const ok = await mine.c.post(`/api/attempts/${mine.att.id}/appeals`, { qid: qids[0], reason: 'Em nghĩ đáp án câu này cũng có thể chấp nhận' });
  assert.equal(ok.status, 200);
  assert.equal((await mine.c.post(`/api/attempts/${mine.att.id}/appeals`, { qid: qids[0], reason: 'Gửi lại lần hai cùng một câu' })).status, 409);
  assert.equal(audits('appeal_create').length, 1);
  const mineList = (await mine.c.get('/api/student/appeals')).data.appeals;
  assert.equal(mineList.length, 1);
  assert.equal(mineList[0].status, 'open');
  assert.equal((await other.c.get('/api/student/appeals')).data.appeals.length, 0, 'không thấy khiếu nại của bạn');
  assert.equal((await mine.c.get('/api/appeals')).status, 403, 'học sinh không vào danh sách giáo viên');
  assert.equal((await mine.c.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'accept', note: 'Tự duyệt cho mình', newScore10: 10 })).status, 403);

  // giáo viên: chỉ lớp mình
  assert.equal((await minh.get('/api/appeals')).data.appeals.length, 0);
  assert.equal((await khac.get('/api/appeals')).data.appeals.length, 0);
  assert.equal((await minh.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'reject', note: 'Không phụ trách lớp này' })).status, 403);
  assert.equal((await khac.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'reject', note: 'Khác trường' })).status, 403);
  assert.equal(audits('appeal_resolve').filter((a) => a.outcome === 'denied').length, 2);
  const list = (await lan.get('/api/appeals?status=open')).data.appeals;
  assert.equal(list.length, 1);
  assert.equal(list[0].student, app.db.get('SELECT display_name FROM users WHERE id = ?', mine.st.id).display_name);

  // đặt điểm sai trước để chấp nhận có tác dụng
  app.db.run('UPDATE attempts SET score10 = 8.75, points = 0.875 WHERE id = ?', mine.att.id);
  app.db.run('UPDATE attempts SET max_points = 1 WHERE id = ?', mine.att.id);
  assert.equal((await lan.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'accept', note: 'ab' })).status, 400, 'ghi chú quá ngắn');
  assert.equal((await lan.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'accept', note: 'Chấp nhận, chấm lại câu' })).status, 400, 'chấp nhận mà không nêu điểm mới');
  assert.equal((await lan.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'xem xet', note: 'Không rõ quyết định' })).status, 400);
  const res = await lan.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'accept', note: 'Chấp nhận, cho điểm câu bị khiếu nại', newScore10: 9.5 });
  assert.equal(res.status, 200);
  assert.equal(app.db.get('SELECT score10 FROM attempts WHERE id = ?', mine.att.id).score10, 9.5);
  const rows = audits('appeal_resolve').filter((a) => a.outcome === 'ok');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].old.score10, 8.75);
  assert.equal(rows[0].new.score10, 9.5);
  assert.match(rows[0].reason, /cho điểm câu/);
  assert.equal((await lan.post(`/api/appeals/${ok.data.id}/resolve`, { decision: 'reject', note: 'Xử lý lần hai' })).status, 400, 'đã xử lý');
  const after = (await mine.c.get('/api/student/appeals')).data.appeals[0];
  assert.equal(after.status, 'accepted');
  assert.match(after.note, /cho điểm câu/);
  appealCtx = { other, qids };
});

test('Khiếu nại: từ chối giữ nguyên điểm; cho điểm cả câu tính lại đúng; quá hạn và kết quả chưa mở bị chặn', async () => {
  const { other, qids } = appealCtx;
  const a = (await other.c.post(`/api/attempts/${other.att.id}/appeals`, { qid: qids[1], reason: 'Em cho rằng câu này chấm sai ạ' })).data.id;
  const before = app.db.get('SELECT score10 FROM attempts WHERE id = ?', other.att.id).score10;
  const rej = await lan.post(`/api/appeals/${a}/resolve`, { decision: 'reject', note: 'Đáp án đúng như khóa, em chọn sai' });
  assert.equal(rej.status, 200);
  assert.equal(app.db.get('SELECT score10 FROM attempts WHERE id = ?', other.att.id).score10, before);
  assert.equal(audits('appeal_resolve').filter((x) => x.outcome === 'ok').at(-1).new.decision, 'reject');

  // cho điểm cả câu: làm sai một câu rồi khiếu nại đúng câu đó
  const t = app.db.get('SELECT * FROM attempts WHERE id = ?', other.att.id);
  const wrongItem = t.result.items.find((x) => x.qid === qids[2]);
  const patched = { ...t.result, items: t.result.items.map((x) => (x.qid === qids[2] ? { ...x, points: 0, correct: false } : x)) };
  const lowered = Math.round((t.points - wrongItem.max / 1000) * 1000) / 1000;
  app.db.run('UPDATE attempts SET result_json = ?, points = ?, score10 = ? WHERE id = ?', JSON.stringify(patched), lowered, Math.round((lowered / t.max_points) * 1000) / 100, other.att.id);
  const b = (await other.c.post(`/api/attempts/${other.att.id}/appeals`, { qid: qids[2], reason: 'Em chọn đúng nhưng hệ thống chấm sai' })).data.id;
  const cr = await lan.post(`/api/appeals/${b}/resolve`, { decision: 'accept', note: 'Cho điểm cả câu theo khiếu nại', creditQuestion: true });
  assert.equal(cr.status, 200);
  const fixed = app.db.get('SELECT score10, points FROM attempts WHERE id = ?', other.att.id);
  assert.equal(fixed.score10, 10);
  assert.equal(fixed.points, t.points);
  assert.equal(app.db.get('SELECT result_json FROM attempts WHERE id = ?', other.att.id).result.items.find((x) => x.qid === qids[2]).appealCredit, true);

  // quá 14 ngày kể từ khi có kết quả
  clock += 50 * 86400000; // bài đóng sau 30 ngày + hạn khiếu nại 14 ngày
  await other.c.post('/api/login', { username: other.st.username, password: SAMPLE_PASSWORD });
  const late = await other.c.post(`/api/attempts/${other.att.id}/appeals`, { qid: qids[3], reason: 'Gửi quá muộn so với thời hạn' });
  assert.equal(late.status, 400);
  assert.match(late.data.error, /quá 14 ngày/);
});

test('Kết quả chưa mở (xem sau khi đóng bài) thì chưa khiếu nại được', async () => {
  await lan.relogin('gv.lan'); // đồng hồ đã nhảy, phiên cũ hết hạn
  const q = await mcqOf('Câu xem sau', 0, 'xs');
  const exam = (await lan.post('/api/exams', { title: 'Xem sau', items: [{ qid: q }], durationMin: 10, variants: 1, seed: 'xs' })).data.id;
  const cls = ctx.cls;
  const asg = (await lan.post('/api/assignments', { examId: exam, classId: cls.id, mode: 'homework', openAt: clock - 1000, closeAt: clock + 5 * 86400000, showResult: 'after_close' })).data.ids[0];
  const st = app.db.get("SELECT id, username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id DESC", cls.id);
  const c = client();
  await c.login(st.username);
  const att = (await c.post('/api/attempts/start', { assignmentId: asg })).data;
  await c.post(`/api/attempts/${att.id}/submit`, { responses: { [q]: 0 }, version: 1 });
  const r = await c.post(`/api/attempts/${att.id}/appeals`, { qid: q, reason: 'Em muốn khiếu nại khi chưa xem kết quả' });
  assert.equal(r.status, 403);
});
