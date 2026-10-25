import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let app, server, base;
before(async () => {
  app = createApp();
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  app.db.close();
});

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json(), cookie: sc };
  };
}

test('Giáo viên tạo lớp có mã tham gia; Học sinh dùng mã tham gia lớp và xem bài', async () => {
  const teacher = client();
  const tLogin = await teacher('POST', '/api/login', { username: 'gv.lan', password: SAMPLE_PASSWORD });
  assert.equal(tLogin.status, 200);

  // 1. Tạo lớp mới
  const created = await teacher('POST', '/api/classes', { name: '10A3', grade: 10 });
  assert.equal(created.status, 200);
  assert.equal(created.data.name, '10A3');
  assert.ok(created.data.code && created.data.code.startsWith('10A3-'));

  // 2. Học sinh đăng nhập
  const student = client();
  const sLogin = await student('POST', '/api/login', { username: 'hs.an.nm', password: SAMPLE_PASSWORD });
  assert.equal(sLogin.status, 200);

  // Học sinh rời lớp hiện tại (nếu có)
  const leave = await student('POST', '/api/student/class/leave');
  assert.equal(leave.status, 200);

  // Học sinh kiểm tra lớp khi chưa vào lớp
  const noClass = await student('GET', '/api/student/class');
  assert.equal(noClass.status, 200);
  assert.equal(noClass.data.class, null);

  // Nhập sai mã
  const badJoin = await student('POST', '/api/student/class/join', { code: 'MA-KHONG-TON-TAI' });
  assert.equal(badJoin.status, 404);

  // Tham gia lớp vừa tạo bằng mã
  const join = await student('POST', '/api/student/class/join', { code: created.data.code.toLowerCase() });
  assert.equal(join.status, 200);
  assert.equal(join.data.ok, true);
  assert.equal(join.data.class.id, created.data.id);

  // Kiểm tra thông tin lớp đã vào
  const myClass = await student('GET', '/api/student/class');
  assert.equal(myClass.status, 200);
  assert.equal(myClass.data.class.id, created.data.id);
  assert.equal(myClass.data.class.code, created.data.code);
});

test('Học sinh xem danh mục tự luyện đề các môn và bắt đầu luyện đề', async () => {
  const student = client();
  const sLogin = await student('POST', '/api/login', { username: 'hs.chau.tb', password: SAMPLE_PASSWORD });
  assert.equal(sLogin.status, 200);

  const cat = await student('GET', '/api/student/practice-exams');
  assert.equal(cat.status, 200);
  assert.ok(cat.data.exams.length >= 4);

  // Có các môn đa dạng (Toán, Vật lí, Hóa học...)
  const subjects = cat.data.exams.map((e) => e.subject);
  assert.ok(subjects.includes('Toán'));

  const firstExam = cat.data.exams[0];
  const start = await student('POST', '/api/student/practice-exams/start', { examId: firstExam.id });
  assert.equal(start.status, 200);
  assert.equal(start.data.kind, 'practice');
  assert.equal(start.data.title, firstExam.title);
  assert.ok(start.data.items.length > 0);
});
