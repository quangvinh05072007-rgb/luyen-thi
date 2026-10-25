// Giai đoạn 2: Excel đúng tiếng Việt, lịch sử phiên bản, thao tác hàng loạt có hoàn tác, mẫu ma trận, nhân bản đề, giao hẹn giờ nhiều lớp.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildXlsx } from '../shared/xlsxWrite.mjs';
import { readXlsx } from '../shared/sheet.mjs';
import { importFile } from '../server/importers.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let lan;
let minh;
let khac;
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
    return { status: res.status, data, headers: res.headers };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b = {}) => call('PUT', p, b),
    del: (p, b = {}) => call('DELETE', p, b),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
    },
  };
}

const audits = (action) => app.db.all('SELECT * FROM audit_log WHERE action = ? ORDER BY id', action);


const mkQuestion = async (stem, answer = 0, extra = {}) => {
  const r = await lan.post('/api/questions', { type: 'mcq', stem, options: ['$1$', '$2$', '$3$', '$4$'], answer, topic: 'T11.DAOHAM', level: 1, explanation: 'Lời giải.', ...extra });
  assert.equal(r.status, 200);
  return r.data.id;
};

test('Ghi Excel: tiếng Việt đúng dấu, số là số, hàng tiêu đề, chuỗi giống công thức được vô hiệu', async () => {
  const buf = await buildXlsx([{ name: 'Điểm: lớp 12A1', columns: [{ header: 'Họ tên', width: 24 }, { header: 'Điểm', width: 8 }], rows: [['Nguyễn Thị Ánh', 8.75], ['=1+1', 10], ['Trần Văn Đức', ''], ['A & B <c>', 0]] }]);
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  const rows = await readXlsx(buf);
  assert.deepEqual(rows[0], ['Họ tên', 'Điểm']);
  assert.deepEqual(rows[1], ['Nguyễn Thị Ánh', '8.75']);
  assert.equal(rows[2][0], "'=1+1", 'không để Excel chạy công thức từ dữ liệu');
  assert.deepEqual(rows[4], ['A & B <c>', '0']);
});

test('Xuất Excel bảng điểm: đúng cột, tiếng Việt, chỉ giáo viên phụ trách; ghi nhật ký', async () => {
  const g = await lan.post('/api/exams/generate', { counts: { mcq: 4, tf: 0, short: 0 }, seed: 'ops' });
  const exam = (await lan.post('/api/exams', { title: 'Xuất điểm', items: g.data.items, durationMin: 30, variants: 2, seed: 'ops' })).data.id;
  const cls = (await lan.get('/api/classes')).data.classes[0];
  const asg = (await lan.post('/api/assignments', { examId: exam, classId: cls.id, mode: 'homework', openAt: clock - 1000, closeAt: clock + 86400000 })).data.ids[0];
  const stu = app.db.get("SELECT username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", cls.id);
  const s = client();
  await s.login(stu.username);
  const att = (await s.get('/api/student/home')).data;
  assert.ok(att.assignments.some((a) => a.id === asg));
  await s.post('/api/attempts/start', { assignmentId: asg });
  const x = await lan.get(`/api/assignments/${asg}/export.xlsx`);
  assert.equal(x.status, 200);
  assert.match(x.headers.get('content-type'), /spreadsheetml/);
  const rows = await readXlsx(x.data);
  assert.deepEqual(rows[0], ['Họ tên', 'Tên đăng nhập', 'Mã đề', 'Trạng thái', 'Điểm', 'Nộp lúc']);
  assert.equal(rows.length, 1 + app.db.get("SELECT COUNT(*) n FROM users WHERE class_id = ? AND role = 'student'", cls.id).n);
  assert.ok(rows.some((r) => r[3] === 'Đang làm'));
  assert.ok(rows.some((r) => r[3] === 'Chưa làm'));
  assert.ok(audits('data_export').some((a) => /Excel/.test(a.detail) && a.outcome === 'ok'));
  assert.equal((await minh.get(`/api/assignments/${asg}/export.xlsx`)).status, 403);
  assert.equal((await khac.get(`/api/assignments/${asg}/export.xlsx`)).status, 403);
  const csv = await lan.get(`/api/assignments/${asg}/export.csv`);
  assert.match(csv.data.toString('utf8'), /Đang làm/);
});

test('Xuất ngân hàng ra Excel đúng mẫu nhập: xuất rồi nhập lại ra đúng câu, đáp án, chuyên đề', async () => {
  const id1 = await mkQuestion('Xuất $x^2$ rồi nhập lại', 2);
  const tf = await lan.post('/api/questions', { type: 'tf', stem: 'Cho hàm số $y=x$.', options: ['Đồng biến', 'Nghịch biến', 'Qua gốc', 'Cắt $Oy$'], answer: [true, false, true, true], topic: 'T10.HAMBAC2', level: 2, explanation: '' });
  const sh = await lan.post('/api/questions', { type: 'short', stem: 'Tính $1{,}5\\cdot2$', answer: '3', topic: 'T10.HAMBAC2', level: 1, explanation: '' });
  assert.ok(id1 && tf.status === 200 && sh.status === 200);
  const res = await lan.get('/api/questions/export.xlsx?status=draft');
  assert.equal(res.status, 200);
  const back = await importFile('bank.xlsx', res.data, null);
  const q = back.questions.find((x) => x.stem === 'Xuất $x^2$ rồi nhập lại');
  assert.equal(q.answer, 2);
  assert.equal(q.topic, 'T11.DAOHAM');
  assert.deepEqual(q.options, ['$1$', '$2$', '$3$', '$4$']);
  assert.deepEqual(back.questions.find((x) => x.type === 'tf' && x.stem.startsWith('Cho hàm số $y=x$')).answer, [true, false, true, true]);
  assert.equal(back.questions.find((x) => x.type === 'short' && x.stem.startsWith('Tính $1{,}5')).answer, '3');
  assert.ok(audits('data_export').some((a) => a.target === 'questions'));
});

test('Lịch sử phiên bản: mỗi lần sửa lưu bản cũ; khôi phục được; đổi đáp án câu đã dùng cần lý do và đúng người', async () => {
  const id = await mkQuestion('Bản một', 0);
  await lan.put(`/api/questions/${id}`, { stem: 'Bản hai' });
  await lan.put(`/api/questions/${id}`, { stem: 'Bản ba', explanation: 'Mới' });
  const list = (await lan.get(`/api/questions/${id}/versions`)).data.versions;
  assert.deepEqual(list.map((v) => v.version), [2, 1]);
  assert.equal(list[1].snapshot.stem, 'Bản một');
  assert.equal(list[0].snapshot.stem, 'Bản hai');
  assert.equal(list[0].by, 'Cô Nguyễn Thị Lan');
  const r = await lan.post(`/api/questions/${id}/restore`, { version: 1 });
  assert.equal(r.status, 200);
  assert.equal(app.db.get('SELECT stem FROM questions WHERE id = ?', id).stem, 'Bản một');
  assert.equal((await lan.get(`/api/questions/${id}/versions`)).data.versions.length, 3, 'khôi phục cũng lưu lại bản trước đó');
  assert.equal((await lan.post(`/api/questions/${id}/restore`, { version: 99 })).status, 404);
  assert.equal((await khac.get(`/api/questions/${id}/versions`)).status, 404);
  assert.equal((await khac.post(`/api/questions/${id}/restore`, { version: 1 })).status, 403);
  assert.ok(audits('question_restore').length >= 1);

  // câu đã dùng trong đề: khôi phục lại đáp án cũ phải có lý do
  await lan.post('/api/questions/approve', { ids: [id] });
  const exam = (await lan.post('/api/exams', { title: 'Dùng câu', items: [{ qid: id }], durationMin: 10, variants: 1 })).data.id;
  assert.ok(exam);
  await lan.put(`/api/questions/${id}`, { answer: 3, reason: 'Sửa đáp án vì nhập nhầm' });
  const vs = (await lan.get(`/api/questions/${id}/versions`)).data.versions;
  const oldAnswerVersion = vs.find((v) => v.snapshot.answer === 0).version;
  assert.equal((await lan.post(`/api/questions/${id}/restore`, { version: oldAnswerVersion })).status, 400, 'đổi đáp án câu đã dùng thiếu lý do');
  assert.equal((await lan.post(`/api/questions/${id}/restore`, { version: oldAnswerVersion, reason: 'Đáp án cũ mới đúng' })).status, 200);
  assert.equal(app.db.get('SELECT answer_json FROM questions WHERE id = ?', id).answer, 0);
  assert.ok(audits('question_answer_change').some((a) => a.reason === 'Đáp án cũ mới đúng'));
});

test('Thao tác hàng loạt: đổi chuyên đề/mức độ/lưu trữ, mỗi câu có phiên bản, hoàn tác đúng, không ghi đè câu đã sửa tiếp', async () => {
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push(await mkQuestion(`Hàng loạt ${i}`, 1));
  assert.equal((await lan.post('/api/questions/bulk', { ids, action: 'set_topic', value: 'KHONG-CO' })).status, 400);
  assert.equal((await lan.post('/api/questions/bulk', { ids, action: 'set_level', value: 9 })).status, 400);
  assert.equal((await lan.post('/api/questions/bulk', { ids: [], action: 'archive' })).status, 400);
  assert.equal((await lan.post('/api/questions/bulk', { ids, action: 'xoa_het' })).status, 400);

  const r = await lan.post('/api/questions/bulk', { ids, action: 'set_topic', value: 'T12.NGUYENHAM' });
  assert.equal(r.status, 200);
  assert.equal(r.data.changed, 5);
  assert.ok(ids.every((id) => app.db.get('SELECT topic FROM questions WHERE id = ?', id).topic === 'T12.NGUYENHAM'));
  assert.ok(ids.every((id) => app.db.get('SELECT COUNT(*) n FROM question_versions WHERE qid = ?', id).n === 1));
  assert.equal(audits('bulk_set_topic').length, 1, 'một dòng nhật ký cho cả đợt');
  assert.deepEqual(audits('bulk_set_topic')[0].new.ids, ids);
  const again = await lan.post('/api/questions/bulk', { ids, action: 'set_topic', value: 'T12.NGUYENHAM' });
  assert.equal(again.data.changed, 0, 'không đổi gì thì không tạo phiên bản');

  // một câu được sửa tiếp trước khi hoàn tác
  await lan.put(`/api/questions/${ids[0]}`, { stem: 'Đã sửa sau đợt hàng loạt' });
  const undo = await lan.post(`/api/questions/bulk/${r.data.batchId}/undo`);
  assert.equal(undo.status, 200);
  assert.equal(undo.data.restored, 4);
  assert.deepEqual(undo.data.skipped, [ids[0]]);
  assert.ok(ids.slice(1).every((id) => app.db.get('SELECT topic FROM questions WHERE id = ?', id).topic === 'T11.DAOHAM'));
  assert.equal(app.db.get('SELECT stem FROM questions WHERE id = ?', ids[0]).stem, 'Đã sửa sau đợt hàng loạt');
  assert.equal((await lan.post(`/api/questions/bulk/${r.data.batchId}/undo`)).status, 400, 'chỉ hoàn tác một lần');

  // lưu trữ rồi khôi phục: câu quay về nháp, phải duyệt lại
  await lan.post('/api/questions/approve', { ids: ids.slice(1) });
  const arch = await lan.post('/api/questions/bulk', { ids: ids.slice(1), action: 'archive' });
  assert.ok(ids.slice(1).every((id) => app.db.get('SELECT status FROM questions WHERE id = ?', id).status === 'archived'));
  await lan.post('/api/questions/bulk', { ids: ids.slice(1), action: 'unarchive' });
  assert.ok(ids.slice(1).every((id) => app.db.get('SELECT status FROM questions WHERE id = ?', id).status === 'draft'));
  assert.equal((await lan.post(`/api/questions/bulk/${arch.data.batchId}/undo`)).data.restored, 0, 'câu đã đổi tiếp sau đó thì không hoàn tác chồng lên');
});

test('Hàng loạt: không sửa được câu của người khác; trường khác bị chặn; người khác không hoàn tác thay', async () => {
  const id = await mkQuestion('Của cô Lan', 0);
  const denied = audits('bulk_set_level').length;
  assert.equal((await minh.post('/api/questions/bulk', { ids: [id], action: 'set_level', value: 3 })).status, 403);
  assert.equal((await khac.post('/api/questions/bulk', { ids: [id], action: 'set_level', value: 3 })).status, 404);
  assert.equal(audits('bulk_set_level').length, denied + 1, 'lần thử bị từ chối vẫn được ghi');
  assert.equal(app.db.get('SELECT level FROM questions WHERE id = ?', id).level, 1);
  const r = await lan.post('/api/questions/bulk', { ids: [id], action: 'set_level', value: 3 });
  assert.equal((await minh.post(`/api/questions/bulk/${r.data.batchId}/undo`)).status, 403);
  assert.equal((await khac.post(`/api/questions/bulk/${r.data.batchId}/undo`)).status, 403);
  assert.equal(app.db.get('SELECT level FROM questions WHERE id = ?', id).level, 3);
});

test('Mẫu ma trận đề: lưu, dùng chung trong trường, kiểm tra hợp lệ, chỉ người tạo xóa', async () => {
  const bp = { counts: { mcq: 12, tf: 4, short: 6 }, levels: { 1: 40, 2: 30, 3: 30 }, topics: ['T12.NGUYENHAM', 'KHONG-CO'], durationMin: 90 };
  assert.equal((await lan.post('/api/blueprints', { name: '', blueprint: bp })).status, 400);
  assert.equal((await lan.post('/api/blueprints', { name: 'Rỗng', blueprint: { counts: {}, levels: { 1: 1 } } })).status, 400);
  assert.equal((await lan.post('/api/blueprints', { name: 'Không mức', blueprint: { counts: { mcq: 1 }, levels: {} } })).status, 400);
  const mine = (await lan.post('/api/blueprints', { name: 'Giữa kì 12', blueprint: bp })).data.id;
  const shared = (await lan.post('/api/blueprints', { name: 'Chuẩn tổ Toán', blueprint: bp, shared: true })).data.id;
  const listLan = (await lan.get('/api/blueprints')).data.blueprints;
  assert.deepEqual(listLan.map((b) => b.name).sort(), ['Chuẩn tổ Toán', 'Giữa kì 12']);
  assert.deepEqual(listLan[0].blueprint.topics, ['T12.NGUYENHAM'], 'bỏ chuyên đề không hợp lệ');
  const listMinh = (await minh.get('/api/blueprints')).data.blueprints;
  assert.deepEqual(listMinh.map((b) => b.name), ['Chuẩn tổ Toán'], 'chỉ thấy mẫu dùng chung');
  assert.deepEqual((await khac.get('/api/blueprints')).data.blueprints, []);
  assert.equal((await minh.del(`/api/blueprints/${shared}`)).status, 403);
  assert.equal((await khac.del(`/api/blueprints/${shared}`)).status, 403);
  assert.equal((await lan.del(`/api/blueprints/${mine}`)).status, 200);
  assert.equal((await lan.get('/api/blueprints')).data.blueprints.length, 1);
  // dùng mẫu để sinh đề
  const g = await lan.post('/api/exams/generate', { ...listLan.find((b) => b.id === shared).blueprint, counts: { mcq: 3, tf: 0, short: 0 }, seed: 'bp' });
  assert.equal(g.status, 200);
  assert.equal(g.data.items.length, 3);
});

test('Nhân bản đề: cùng câu, mã đề mới, câu đã lưu trữ giữ bản đã chụp; giao hẹn giờ cho nhiều lớp một lúc', async () => {
  const a = await mkQuestion('Câu nhân bản A', 0);
  const b = await mkQuestion('Câu nhân bản B', 1);
  await lan.post('/api/questions/approve', { ids: [a, b] });
  const orig = (await lan.post('/api/exams', { title: 'Đề gốc', items: [{ qid: a }, { qid: b }], durationMin: 20, variants: 3, seed: 'orig' })).data.id;
  await lan.post('/api/questions/archive', { ids: [b] });
  await lan.put(`/api/questions/${a}`, { stem: 'Câu nhân bản A (đã sửa)' });
  const c = await lan.post(`/api/exams/${orig}/clone`, { title: 'Đề sao' });
  assert.equal(c.status, 200);
  const o = app.db.get('SELECT * FROM exams WHERE id = ?', orig);
  const cl = app.db.get('SELECT * FROM exams WHERE id = ?', c.data.id);
  assert.equal(cl.title, 'Đề sao');
  assert.deepEqual(cl.items.map((x) => x.qid), o.items.map((x) => x.qid));
  assert.equal(cl.variants.length, 3);
  assert.notDeepEqual(cl.variants.map((v) => v.seed), o.variants.map((v) => v.seed));
  assert.equal(cl.snapshot[a].stem, 'Câu nhân bản A (đã sửa)', 'câu còn dùng lấy bản mới');
  assert.equal(cl.snapshot[b].stem, 'Câu nhân bản B', 'câu đã lưu trữ giữ bản đã chụp');
  assert.equal(o.snapshot[a].stem, 'Câu nhân bản A', 'đề gốc không đổi');
  assert.equal((await khac.post(`/api/exams/${orig}/clone`, {})).status, 404);
  assert.ok(audits('exam_clone').some((x) => x.target === `exam:${c.data.id}`));

  // giao hẹn giờ cho hai lớp cùng lúc
  const classes = (await lan.get('/api/classes')).data.classes;
  assert.equal(classes.length, 1, 'cô Lan chỉ dạy 12A1');
  const mk = await minh.get('/api/classes');
  const two = [...classes.map((x) => x.id)];
  const open = clock + 2 * 3600000;
  const r = await lan.post('/api/assignments', { examId: c.data.id, classIds: two, mode: 'exam', openAt: open, closeAt: open + 3600000, durationMin: 20 });
  assert.equal(r.status, 200);
  assert.equal(r.data.ids.length, two.length);
  const other = mk.data.classes[0].id;
  assert.equal((await lan.post('/api/assignments', { examId: c.data.id, classIds: [...two, other], openAt: open, closeAt: open + 3600000 })).status, 403, 'không giao cho lớp người khác dạy');
  const stu = app.db.get("SELECT username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", two[0]);
  const s = client();
  await s.login(stu.username);
  const early = await s.post('/api/attempts/start', { assignmentId: r.data.ids[0] });
  assert.equal(early.status, 400);
  assert.match(early.data.error, /chưa mở/);
  const home = (await s.get('/api/student/home')).data.assignments.find((x) => x.id === r.data.ids[0]);
  assert.equal(home.state, 'upcoming');
  clock = open + 60000;
  await s.login(stu.username);
  assert.equal((await s.post('/api/attempts/start', { assignmentId: r.data.ids[0] })).status, 200);
});
