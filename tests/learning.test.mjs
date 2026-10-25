// Giai đoạn 3: lời giải do AI viết chỉ là nháp (giáo viên duyệt, đối chiếu đáp án), và từ kết quả giao phiếu luyện cho nhóm yếu.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { answerFromSolution, parseAnswerLine } from '../shared/parse.mjs';
import { readXlsx } from '../shared/sheet.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

const clock = Date.parse('2026-10-19T08:00:00+07:00');
let aiNext = 'Bước 1. …\nĐáp án: B';
const fakeAi = { enabled: true, model: 'fake-ai', explain: async () => aiNext };
let server;
let url;
let app;
let lan;
let minh;
let khac;
before(async () => {
  app = createApp({ dbFile: ':memory:', clock: () => clock, aiImpl: fakeAi });
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
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
    },
  };
}
const audits = (action) => app.db.all('SELECT * FROM audit_log WHERE action = ? ORDER BY id', action);

test('Đọc kết luận đáp án từ lời giải AI viết', () => {
  assert.equal(answerFromSolution('mcq', 'Bước 1…\nĐáp án: C'), 2);
  assert.equal(answerFromSolution('mcq', 'Đáp án: A\nGhi chú\n**Đáp án:** D'), 3, 'lấy dòng cuối');
  assert.equal(answerFromSolution('mcq', 'Chọn B nên đúng'), null, 'không có dòng đáp án → không đoán');
  assert.deepEqual(answerFromSolution('tf', 'Đáp án: ĐSĐS'), [true, false, true, false]);
  assert.equal(answerFromSolution('short', 'Đáp án: 1,5'), '1,5');
  assert.equal(parseAnswerLine('mcq', 'Chọn B.'), 1);
  assert.equal(parseAnswerLine('mcq', 'không rõ'), null);
});

let qid;
test('AI viết lời giải: chỉ là nháp riêng, đối chiếu đáp án, học sinh không thấy nháp', async () => {
  const mk = await lan.post('/api/questions', { type: 'mcq', stem: 'Tính $1+1$.', options: ['1', '2', '3', '4'], answer: 1, topic: 'T10.MENHDE', level: 1, explanation: 'Lời giải cũ của giáo viên.' });
  qid = mk.data.id;
  await lan.post('/api/questions/approve', { ids: [qid] });
  const before = app.db.get('SELECT COUNT(*) n FROM questions').n;
  aiNext = 'Bước 1. Cộng hai số.\nBước 2. $1+1=2$.\nĐáp án: B';
  const r = await lan.post('/api/ai/explain', { id: qid });
  assert.equal(r.status, 200);
  assert.equal(r.data.check.matches, true);
  assert.equal(r.data.check.aiAnswer, 1);
  assert.equal(app.db.get('SELECT COUNT(*) n FROM questions').n, before, 'không tạo câu mới');
  const row = app.db.get('SELECT explanation, explanation_draft FROM questions WHERE id = ?', qid);
  assert.equal(row.explanation, 'Lời giải cũ của giáo viên.', 'lời giải chính thức chưa đổi');
  assert.match(row.explanation_draft, /Bước 2/);
  const listed = (await lan.get('/api/questions')).data.questions.find((q) => q.id === qid);
  assert.match(listed.explanationDraft, /Bước 1/);
  assert.equal(listed.draftCheck.matches, true);

  // học sinh làm câu này rồi xem kết quả: không có nháp ở bất kỳ đâu trong phản hồi
  const exam = (await lan.post('/api/exams', { title: 'Nháp', items: [{ qid }], durationMin: 10, variants: 1, seed: 'x' })).data.id;
  const cls = (await lan.get('/api/classes')).data.classes[0];
  const asg = (await lan.post('/api/assignments', { examId: exam, classId: cls.id, mode: 'homework', openAt: clock - 1000, closeAt: clock + 86400000 })).data.ids[0];
  const stu = app.db.get("SELECT username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", cls.id);
  const s = client();
  await s.login(stu.username);
  const att = (await s.post('/api/attempts/start', { assignmentId: asg })).data;
  assert.ok(!JSON.stringify(att).includes('Bước 1'));
  const done = await s.post(`/api/attempts/${att.id}/submit`, { responses: { [qid]: 0 }, version: 1 });
  const dump = JSON.stringify(done.data) + JSON.stringify((await s.get(`/api/attempts/${att.id}/result`)).data);
  assert.ok(!dump.includes('Bước 1') && !dump.includes('explanationDraft') && !dump.includes('draftCheck'), 'học sinh không nhận lời giải nháp');
  assert.match(dump, /Lời giải cũ của giáo viên/, 'học sinh thấy lời giải đã duyệt');
  assert.equal((await s.post('/api/ai/explain', { id: qid })).status, 403);
});

test('Duyệt lời giải nháp: thay lời giải, lưu phiên bản cũ, ghi nhật ký; bỏ nháp; người trường khác bị chặn', async () => {
  assert.equal((await khac.post('/api/ai/explain', { id: qid })).status, 404);
  assert.equal((await khac.post(`/api/questions/${qid}/draft/approve`, {})).status, 403);
  assert.equal(audits('explanation_approve').filter((a) => a.outcome === 'denied').length, 1);
  const ok = await lan.post(`/api/questions/${qid}/draft/approve`, { text: 'Bước 1. Cộng hai số.\nBước 2. $1+1=2$.\nVậy chọn B.' });
  assert.equal(ok.status, 200);
  const row = app.db.get('SELECT explanation, explanation_draft, draft_check_json FROM questions WHERE id = ?', qid);
  assert.match(row.explanation, /Vậy chọn B/);
  assert.equal(row.explanation_draft, null);
  assert.equal(row.draft_check, null);
  const a = audits('explanation_approve').filter((x) => x.outcome === 'ok');
  assert.equal(a.length, 1);
  assert.equal(a[0].old.explanation, 'Lời giải cũ của giáo viên.');
  assert.match(a[0].detail, /đã sửa tay/);
  const versions = (await lan.get(`/api/questions/${qid}/versions`)).data.versions;
  assert.equal(versions[0].snapshot.explanation, 'Lời giải cũ của giáo viên.');
  assert.equal((await lan.post(`/api/questions/${qid}/draft/approve`, {})).status, 400, 'hết nháp');

  aiNext = 'Đáp án: B';
  await lan.post('/api/ai/explain', { id: qid });
  assert.equal((await lan.post(`/api/questions/${qid}/draft/reject`)).status, 200);
  assert.equal(app.db.get('SELECT explanation_draft FROM questions WHERE id = ?', qid).explanation_draft, null);
  assert.equal(audits('explanation_reject').length, 1);
});

test('AI tự giải ra đáp án KHÁC đáp án đã duyệt: cảnh báo, không duyệt được nếu chưa xác nhận', async () => {
  aiNext = 'Bước 1. Tính nhầm.\nĐáp án: C';
  const r = await lan.post('/api/ai/explain', { id: qid });
  assert.equal(r.data.check.matches, false);
  assert.equal(r.data.check.aiAnswer, 2);
  assert.match(audits('ai_explain').at(-1).detail, /đáp án khác/);
  const blocked = await lan.post(`/api/questions/${qid}/draft/approve`, {});
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.mismatch, true);
  assert.equal(app.db.get('SELECT explanation_draft IS NOT NULL ok FROM questions WHERE id = ?', qid).ok, 1, 'nháp còn nguyên');
  assert.equal((await lan.post(`/api/questions/${qid}/draft/approve`, { confirmMismatch: true })).status, 200);
  assert.ok(audits('explanation_approve').some((x) => /xác nhận dù AI ra đáp án khác/.test(x.reason ?? '')));
  // không có dòng "Đáp án" → không kết luận được, không chặn
  aiNext = 'Chỉ có lời giải, quên kết luận.';
  const none = await lan.post('/api/ai/explain', { id: qid });
  assert.equal(none.data.check.matches, null);
});

test('Nhóm yếu theo chuyên đề: chỉ lớp mình dạy; giao phiếu luyện đúng nhóm, đúng học sinh mới thấy', async () => {
  const cls = (await lan.get('/api/classes')).data.classes[0];
  assert.equal((await minh.get(`/api/classes/${cls.id}/weak-groups`)).status, 404);
  assert.equal((await khac.get(`/api/classes/${cls.id}/weak-groups`)).status, 404);
  const groups = (await lan.get(`/api/classes/${cls.id}/weak-groups`)).data.groups;
  assert.ok(groups.length > 0);
  const g = groups.find((x) => x.topic === 'T12.XSDK') ?? groups[0];
  assert.ok(g.students.length >= 2);
  assert.ok(g.students.every((s) => s.value < 0.5 && s.n >= 3));
  assert.deepEqual(g.students.map((s) => s.value), [...g.students.map((s) => s.value)].sort((a, b) => a - b));

  assert.equal((await lan.post(`/api/classes/${cls.id}/practice-assignment`, { topic: 'KHONG-CO' })).status, 400);
  assert.equal((await lan.post(`/api/classes/${cls.id}/practice-assignment`, { topic: g.topic, studentIds: [999999] })).status, 400);
  const denyMinh = audits('practice_assign').filter((a) => a.outcome === 'denied').length;
  assert.equal((await minh.post(`/api/classes/${cls.id}/practice-assignment`, { topic: g.topic })).status, 403);
  assert.equal((await khac.post(`/api/classes/${cls.id}/practice-assignment`, { topic: g.topic })).status, 403);
  assert.equal(audits('practice_assign').filter((a) => a.outcome === 'denied').length, denyMinh + 2);

  const r = await lan.post(`/api/classes/${cls.id}/practice-assignment`, { topic: g.topic, count: 8 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.students, g.students.length);
  assert.ok(r.data.items >= 3);
  const asg = app.db.get('SELECT * FROM assignments WHERE id = ?', r.data.assignmentId);
  assert.deepEqual([...asg.target].sort(), g.students.map((s) => s.id).sort());
  assert.equal(asg.mode, 'homework');
  const exam = app.db.get('SELECT items_json FROM exams WHERE id = ?', r.data.examId);
  assert.ok(exam.items.every((it) => it.topic === g.topic));
  assert.equal(audits('practice_assign').filter((a) => a.outcome === 'ok').length, 1);

  // em trong nhóm thấy và làm được; em ngoài nhóm không thấy và không vào được
  const inUser = app.db.get('SELECT username FROM users WHERE id = ?', g.students[0].id);
  const outUser = app.db
    .all("SELECT id, username FROM users WHERE class_id = ? AND role = 'student'", cls.id)
    .find((u) => !g.students.some((s) => s.id === u.id));
  const sIn = client();
  const sOut = client();
  await sIn.login(inUser.username);
  await sOut.login(outUser.username);
  assert.ok((await sIn.get('/api/student/home')).data.assignments.some((a) => a.id === r.data.assignmentId && a.state === 'open'));
  assert.ok(!(await sOut.get('/api/student/home')).data.assignments.some((a) => a.id === r.data.assignmentId));
  assert.equal((await sOut.post('/api/attempts/start', { assignmentId: r.data.assignmentId })).status, 404);
  assert.equal((await sIn.post('/api/attempts/start', { assignmentId: r.data.assignmentId })).status, 200);

  // báo cáo, bảng điểm và mã đề chỉ gồm đúng các em được giao
  const rep = (await lan.get(`/api/assignments/${r.data.assignmentId}/report`)).data;
  assert.equal(rep.rows.length, g.students.length);
  const xlsx = await readXlsx((await lan.get(`/api/assignments/${r.data.assignmentId}/export.xlsx`)).data);
  assert.equal(xlsx.length, 1 + g.students.length);
  const vs = (await lan.get(`/api/assignments/${r.data.assignmentId}/variants`)).data;
  assert.equal(vs.students.length, g.students.length);

  // chọn tay học sinh (không theo nhóm yếu)
  const manual = await lan.post(`/api/classes/${cls.id}/practice-assignment`, { topic: g.topic, studentIds: [outUser.id], count: 5, title: 'Phiếu riêng' });
  assert.equal(manual.status, 200);
  assert.equal(manual.data.students, 1);
  assert.ok((await sOut.get('/api/student/home')).data.assignments.some((a) => a.id === manual.data.assignmentId && a.title === 'Phiếu riêng'));
});

test('Chuyên đề không ai yếu và chưa có câu duyệt: báo rõ, không tạo bài rỗng', async () => {
  const cls = (await lan.get('/api/classes')).data.classes[0];
  const before = app.db.get('SELECT COUNT(*) n FROM assignments').n;
  const none = await lan.post(`/api/classes/${cls.id}/practice-assignment`, { topic: 'T10.BPT2AN' });
  assert.equal(none.status, 400);
  assert.match(none.data.error, /yếu|Chưa/);
  const empty = await lan.post(`/api/classes/${cls.id}/practice-assignment`, { topic: 'T10.BPT2AN', studentIds: [app.db.get("SELECT id FROM users WHERE class_id = ? AND role = 'student'", cls.id).id] });
  assert.equal(empty.status, 400);
  assert.match(empty.data.error, /chưa có câu đã duyệt/i);
  assert.equal(app.db.get('SELECT COUNT(*) n FROM assignments').n, before);
});
