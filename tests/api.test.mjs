// Luồng thật qua HTTP: nhập đề → duyệt → sinh đề → giao → thi (lưu, mất mạng, hết giờ) → chấm → chẩn đoán → luyện lại.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, SAVE_GRACE_MS } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let clock = Date.parse('2026-10-19T08:00:00+07:00');
let server;
let base;
let app;

before(async () => {
  app = createApp({ dbFile: ':memory:', clock: () => clock, aiImpl: { enabled: false } });
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function client() {
  let cookie = '';
  const call = async (method, path, body, extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    if (cookie) headers.cookie = cookie;
    let payload;
    if (body instanceof Buffer) {
      payload = body;
      headers['x-smartexam'] = '1';
      headers['content-type'] = 'application/octet-stream';
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }
    const res = await fetch(base + path, { method, headers, body: payload });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const type = res.headers.get('content-type') ?? '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, type };
  };
  return {
    call,
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b = {}) => call('PUT', p, b),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      return r.data.user;
    },
  };
}

const IMPORT_TEXT = `PHẦN I
Câu 1. Tính tích phân $\\int_0^1 3x^2\\,dx$.
A. 1   B. 3   C. 0   D. $\\frac{1}{3}$
Đáp án: A
Câu 2. Trong không gian Oxyz, mặt phẳng $x+2y-z=0$ có vectơ pháp tuyến là
A. $(1;2;-1)$ B. $(1;2;1)$ C. $(2;1;-1)$ D. $(1;-2;1)$
PHẦN III
Câu 1. Tính $\\log_2 16$.
Đáp án: 4`;

let teacher;
let student;
let examId;
let assignmentId;
let attempt;

test('Đăng nhập: sai mật khẩu báo lỗi; khóa sau 5 lần sai', async () => {
  const c = client();
  const bad = await c.post('/api/login', { username: 'gv.lan', password: 'sai' });
  assert.equal(bad.status, 401);
  for (let i = 0; i < 5; i++) await c.post('/api/login', { username: 'khong.co', password: 'sai' });
  const locked = await c.post('/api/login', { username: 'khong.co', password: SAMPLE_PASSWORD });
  assert.equal(locked.status, 429);
  const anon = await c.get('/api/questions');
  assert.equal(anon.status, 401);
});

test('Giáo viên nhập đề từ văn bản → nháp có nhãn Imported → sửa đáp án → duyệt', async () => {
  teacher = client();
  await teacher.login('gv.lan');
  const parsed = await teacher.post('/api/import', { text: IMPORT_TEXT });
  assert.equal(parsed.status, 200);
  const qs = parsed.data.questions;
  assert.equal(qs.length, 3);
  assert.equal(qs[0].topic, 'T12.NGUYENHAM', 'tự gắn chuyên đề');
  assert.equal(qs[1].topic, 'T12.OXYZ');
  assert.equal(qs[2].topic, 'T11.MULOG');
  assert.equal(qs[1].answer, null, 'câu 2 chưa có đáp án');
  const saved = await teacher.post('/api/import/save', { questions: qs, origin: 'de-thu.txt' });
  assert.equal(saved.data.ids.length, 3);
  const list = await teacher.get('/api/questions?status=draft');
  const drafts = list.data.questions.filter((q) => saved.data.ids.includes(q.id));
  assert.ok(drafts.every((q) => q.source === 'imported' && q.status === 'draft'));
  // câu thiếu đáp án không duyệt được
  const ap1 = await teacher.post('/api/questions/approve', { ids: saved.data.ids });
  assert.equal(ap1.data.approved.length, 2);
  assert.equal(ap1.data.rejected[0].id, saved.data.ids[1]);
  assert.match(ap1.data.rejected[0].errors.join(' '), /đáp án/);
  await teacher.put(`/api/questions/${saved.data.ids[1]}`, { answer: 0 });
  const ap2 = await teacher.post('/api/questions/approve', { ids: [saved.data.ids[1]] });
  assert.deepEqual(ap2.data.approved, [saved.data.ids[1]]);
});

test('Câu chưa duyệt không vào được đề', async () => {
  const draft = await teacher.post('/api/questions', { type: 'short', stem: 'Tính 1+1', answer: '2', topic: 'T10.MENHDE', level: 1 });
  const r = await teacher.post('/api/exams', { title: 'Đề lỗi', items: [{ qid: draft.data.id }] });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /chưa được duyệt/);
});

test('Sinh đề đúng cấu trúc, lưu đề, xuất Word có Equation', async () => {
  const g = await teacher.post('/api/exams/generate', { counts: { mcq: 12, tf: 4, short: 6 }, levels: { 1: 40, 2: 30, 3: 30 }, seed: 'test' });
  assert.equal(g.status, 200);
  assert.equal(g.data.items.length, 22);
  assert.deepEqual(g.data.shortages, []);
  const created = await teacher.post('/api/exams', { title: 'Đề kiểm tra test', items: g.data.items, durationMin: 60, variants: 2 });
  examId = created.data.id;
  const doc = await teacher.get(`/api/exams/${examId}/docx`);
  assert.equal(doc.status, 200);
  assert.match(doc.type, /wordprocessingml/);
  assert.equal(doc.data.slice(0, 2).toString(), 'PK');
});

test('Giao đề: chỉ cho lớp mình dạy; giao cho 12A1', async () => {
  const classes = (await teacher.get('/api/classes')).data.classes;
  assert.deepEqual(classes.map((c) => c.name), ['12A1']);
  const other = await teacher.post('/api/assignments', { examId, classId: 999 });
  assert.equal(other.status, 403);
  const r = await teacher.post('/api/assignments', { examId, classId: classes[0].id, mode: 'exam', openAt: clock - 1000, closeAt: clock + 86400000, durationMin: 60 });
  assignmentId = r.data.ids[0];
});

test('Học sinh: bắt đầu thi, đề không lộ đáp án, đồng hồ do máy chủ giữ', async () => {
  student = client();
  const me = await student.login('hs.an.nm');
  assert.equal(me.class.name, '12A1');
  const home = await student.get('/api/student/home');
  assert.ok(home.data.assignments.some((a) => a.id === assignmentId && a.state === 'open'));
  const r = await student.post('/api/attempts/start', { assignmentId, clientId: 'may-1' });
  assert.equal(r.status, 200);
  attempt = r.data;
  assert.equal(attempt.items.length, 22);
  assert.equal(attempt.deadlineAt, clock + 60 * 60000);
  const raw = JSON.stringify(attempt);
  assert.ok(!raw.includes('"answer"') && !raw.includes('explanation') && !raw.includes('distractors'), 'không gửi đáp án/lời giải cho học sinh khi đang thi');
  assert.equal(attempt.result, undefined);
  // Bắt đầu lại (tải lại trang) → cùng bài, không tạo bài mới
  const again = await student.post('/api/attempts/start', { assignmentId, clientId: 'may-1' });
  assert.equal(again.data.id, attempt.id);
});

test('Học sinh khác lớp / giáo viên khác trường không xem được', async () => {
  const s2 = client();
  await s2.login('hs.dang.nh'); // lớp 12A2
  const r = await s2.post('/api/attempts/start', { assignmentId });
  assert.equal(r.status, 404);
  const peek = await s2.get(`/api/attempts/${attempt.id}`);
  assert.equal(peek.status, 404);
  const prof = await s2.get(`/api/students/${(await student.get('/api/me')).data.user.id}/profile`);
  assert.equal(prof.status, 404);
  const t2 = client();
  await t2.login('gv.khac');
  const qs = await t2.get('/api/questions');
  assert.equal(qs.data.questions.length, 0, 'trường khác không thấy ngân hàng câu hỏi');
  const rep = await t2.get(`/api/assignments/${assignmentId}/report`);
  assert.equal(rep.status, 404);
  const stuApi = await student.get('/api/questions');
  assert.equal(stuApi.status, 403, 'học sinh không gọi được API giáo viên');
});

let answers;
test('Lưu tự động theo phiên bản; bản cũ đến muộn không ghi đè bản mới', async () => {
  // Làm đúng hết phần I bằng cách tra đáp án ở máy chủ (chỉ test mới làm được)
  const exam = app.db.get('SELECT snapshot_json FROM exams WHERE id = ?', examId).snapshot;
  const att = app.db.get('SELECT layout_json FROM attempts WHERE id = ?', attempt.id);
  answers = {};
  for (const it of att.layout) {
    const q = exam[it.qid];
    if (q.type === 'mcq') answers[it.qid] = it.perm.indexOf(q.answer);
    if (q.type === 'tf') answers[it.qid] = q.answer;
    if (q.type === 'short') answers[it.qid] = q.answer;
  }
  const v2 = await student.put(`/api/attempts/${attempt.id}/save`, { responses: answers, version: 2, clientId: 'may-1', events: [{ type: 'hidden', at: clock }] });
  assert.equal(v2.data.ok, true);
  const stale = await student.put(`/api/attempts/${attempt.id}/save`, { responses: {}, version: 1, clientId: 'may-1' });
  assert.equal(stale.data.version, 2);
  const view = await student.get(`/api/attempts/${attempt.id}`);
  assert.equal(Object.keys(view.data.responses).length, 22, 'bản cũ không xóa câu trả lời');
  // Mở trên máy thứ hai → ghi nhận tín hiệu
  await student.put(`/api/attempts/${attempt.id}/save`, { responses: answers, version: 3, clientId: 'may-2' });
});

test('Hết giờ khi mất mạng: máy chủ tự chốt bằng bản lưu cuối; bản đồng bộ muộn chờ giáo viên quyết', async () => {
  clock = attempt.deadlineAt + SAVE_GRACE_MS + 60000;
  const wrong = { ...answers };
  for (const k of Object.keys(wrong)) wrong[k] = typeof wrong[k] === 'number' ? (wrong[k] + 1) % 4 : wrong[k];
  const late = await student.put(`/api/attempts/${attempt.id}/save`, { responses: wrong, version: 9, clientId: 'may-1' });
  assert.equal(late.data.closed, true);
  assert.equal(late.data.late, true);
  const res = await student.get(`/api/attempts/${attempt.id}/result`);
  assert.equal(res.data.status, 'auto_submitted');
  assert.equal(res.data.result.score10, 10, 'chấm bằng bản lưu đúng hạn');
  assert.equal(res.data.result.late.accepted, false);
  // nộp lại sau khi đã chốt: không đổi kết quả, không tạo bài mới
  const dup = await student.post(`/api/attempts/${attempt.id}/submit`, { responses: {}, version: 99 });
  assert.equal(dup.data.result.score10, 10);
  const report = await teacher.get(`/api/assignments/${assignmentId}/report`);
  const row = report.data.rows.find((r) => r.attemptId === attempt.id);
  assert.equal(row.score10, 10);
  assert.equal(row.signals.hidden, 1);
  assert.equal(row.signals.secondDevice, 1);
  assert.ok(row.late && !row.late.accepted);
  // Giáo viên chấp nhận bản muộn → chấm lại
  const acc = await teacher.post(`/api/attempts/${attempt.id}/accept-late`);
  assert.equal(acc.status, 200);
  const after = await student.get(`/api/attempts/${attempt.id}/result`);
  assert.ok(after.data.result.score10 < 10);
  assert.equal(after.data.result.late.accepted, true);
});

test('Nộp đúng hạn có chẩn đoán lỗi; xem lại có đáp án và lời giải', async () => {
  clock += 1000;
  const s = client();
  await s.login('hs.chau.tb');
  const start = await s.post('/api/attempts/start', { assignmentId, clientId: 'x' });
  const responses = {};
  for (const it of start.data.items) if (it.type === 'mcq') responses[it.qid] = 0; // chọn A hết
  const sub = await s.post(`/api/attempts/${start.data.id}/submit`, { responses, times: {}, version: 1 });
  assert.equal(sub.data.status, 'submitted');
  const r = sub.data.result;
  assert.ok(r.score10 >= 0 && r.score10 <= 3);
  assert.equal(r.byPart.II.points, 0);
  assert.ok(r.items.every((x) => 'correctAnswer' in x && 'explanation' in x));
  const wrongItems = r.items.filter((x) => x.diagnosis);
  assert.ok(wrongItems.some((x) => x.diagnosis.kind === 'blank'));
  assert.ok(wrongItems.some((x) => x.diagnosis.kind === 'error' && x.diagnosis.errors.length));
  const prof = await s.get('/api/student/home');
  assert.ok(prof.data.mastery.length > 0);
  assert.ok(prof.data.recommendations.length > 0, 'có gợi ý học tiếp');
  assert.ok(prof.data.review.total > 0, 'câu sai vào sổ lỗi sai');
});

test('Luyện lại thích ứng: chọn chuyên đề yếu, chấm từng câu, cộng XP và chuỗi ngày', async () => {
  const s = client();
  await s.login('hs.chau.tb');
  const p = await s.post('/api/practice/start', { mode: 'weak', count: 5 });
  assert.equal(p.status, 200);
  assert.equal(p.data.kind, 'practice');
  assert.ok(p.data.items.length >= 3);
  const home0 = (await s.get('/api/student/home')).data;
  const recTopics = home0.recommendations.map((x) => x.topic);
  assert.ok(p.data.items.every((it) => recTopics.includes(it.topic)), 'câu luyện thuộc chuyên đề được gợi ý');
  const it = p.data.items[0];
  const resp = it.type === 'mcq' ? 0 : it.type === 'tf' ? [true, true, true, true] : '0';
  const chk = await s.post(`/api/practice/${p.data.id}/check`, { qid: it.qid, response: resp, seconds: 40 });
  assert.equal(chk.status, 200);
  assert.ok('correctAnswer' in chk.data && 'explanation' in chk.data);
  const again = await s.post(`/api/practice/${p.data.id}/check`, { qid: it.qid, response: resp });
  assert.deepEqual(again.data.points, chk.data.points, 'kiểm tra lại không ghi bằng chứng hai lần');
  const fin = await s.post(`/api/practice/${p.data.id}/finish`, {});
  assert.equal(fin.data.status, 'submitted');
  const home = (await s.get('/api/student/home')).data;
  assert.ok(home.xp > home0.xp - 1);
  assert.equal(home.streak, 1);
  assert.ok(home.today.questions >= 1);
});

test('Báo cáo lớp: phân tích câu hỏi, bản đồ nhiệt, gợi ý hành động; quản lý xem toàn trường và nhật ký', async () => {
  const rep = await teacher.get(`/api/assignments/${assignmentId}/report`);
  assert.equal(rep.data.summary.submitted, 2);
  assert.equal(rep.data.items.length, 22);
  assert.ok(rep.data.items.every((i) => i.p !== null));
  const cls = (await teacher.get('/api/classes')).data.classes[0];
  const detail = await teacher.get(`/api/classes/${cls.id}`);
  assert.ok(Object.keys(detail.data.heat).length >= 8);
  assert.ok(detail.data.classMastery.length > 0);
  const admin = client();
  await admin.login('quanly');
  const ov = await admin.get('/api/admin/overview');
  assert.ok(ov.data.classes.length === 3 && ov.data.teachers.length === 2);
  assert.ok(ov.data.grades.find((g) => g.grade === 12).avg > 0);
  const audit = await admin.get('/api/admin/audit');
  const actions = new Set(audit.data.entries.map((e) => e.action));
  for (const a of ['login', 'import_save', 'question_approve', 'exam_create', 'assignment_create', 'attempt_submit', 'late_accept', 'exam_export_docx']) assert.ok(actions.has(a), a);
  const tAdmin = await teacher.get('/api/admin/overview');
  assert.equal(tAdmin.status, 403);
  const created = await admin.post('/api/admin/users', { role: 'student', username: 'hs.moi', displayName: 'Học sinh mới', classId: cls.id });
  assert.equal(created.status, 200);
  const s = client();
  const login = await s.call('POST', '/api/login', { username: 'hs.moi', password: created.data.tempPassword });
  assert.equal(login.status, 200);
});

test('Chống CSRF: yêu cầu ghi không phải JSON bị từ chối', async () => {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=gv.lan&password=demo1234' });
  assert.equal(r.status, 400);
});

test('AI tắt: chức năng AI trả lời rõ cách bật, không giả kết quả', async () => {
  const meta = await teacher.get('/api/meta');
  assert.equal(meta.data.aiEnabled, false);
  const img = await teacher.call('POST', '/api/import?filename=de.png', Buffer.from([1, 2, 3]));
  assert.equal(img.status, 503);
  assert.match(img.data.error, /ANTHROPIC_API_KEY/);
});
