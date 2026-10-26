import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let server;
let base;
let app;

before(async () => {
  app = createApp({ dbFile: ':memory:', aiImpl: { enabled: false } });
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
      headers['content-type'] = 'application/octet-stream';
      headers['x-smartexam'] = '1';
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }
    const res = await fetch(base + path, { method, headers, body: payload });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const type = res.headers.get('content-type') ?? '';
    const data = type.includes('json') ? await res.json().catch(() => null) : await res.text();
    return { status: res.status, data, type };
  };
  return {
    call,
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    },
  };
}

test('API /api/omr/template trả về HTML phiếu in khổ A4 có điểm định vị', async () => {
  const c = client();
  const res = await c.get('/api/omr/template?schoolName=THPT%20Chuyen');
  assert.equal(res.status, 200);
  assert.ok(res.type.includes('text/html'));
  assert.ok(res.data.includes('marker tl'));
  assert.ok(res.data.includes('SỐ BÁO DANH'));
  assert.ok(res.data.includes('MÃ ĐỀ'));
  assert.ok(res.data.includes('Phần I: 12 Câu MCQ'));
});

test('API /api/omr/grade chấm điểm câu trả lời từ phiếu quét OMR', async () => {
  const c = client();
  await c.login('gv.lan');

  // Lấy danh sách đề thi
  const examsRes = await c.get('/api/exams');
  assert.equal(examsRes.status, 200);
  const exam = examsRes.data.exams[0];
  assert.ok(exam, 'Cần có đề thi mẫu trong hệ thống');

  // Chấm thử đáp án quét từ phiếu
  const gradeRes = await c.post('/api/omr/grade', {
    examId: exam.id,
    answers: {
      partI: [
        { q: 1, selected: 0, label: 'A' },
        { q: 2, selected: 1, label: 'B' },
      ],
      partII: [
        { q: 1, selected: [true, false, true, true] },
      ],
      partIII: [
        { q: 1, value: '1.5' },
      ],
    },
  });

  assert.equal(gradeRes.status, 200);
  assert.ok(gradeRes.data.grade, 'Phải có kết quả chấm điểm');
  assert.equal(typeof gradeRes.data.grade.points, 'number');
  assert.equal(typeof gradeRes.data.grade.score10, 'number');
});

test('API /api/omr/scan nhận diện ảnh phiếu trả lời có điểm định vị', async () => {
  const c = client();
  await c.login('gv.lan');

  const meta = await c.get('/api/meta');
  if (!meta.data.omrAvailable) return;

  const imageBuf = fs.readFileSync('tests/fixtures/sample_omr.png');
  const scanRes = await c.call('POST', '/api/omr/scan', imageBuf);

  assert.equal(scanRes.status, 200);
  assert.equal(scanRes.data.success, true);
  assert.ok(scanRes.data.studentCode.startsWith('1'), 'Phải đọc được chữ số đầu SBD');
  assert.equal(scanRes.data.partI[0].selected, 0, 'Câu 1 phải nhận dạng được A');
  assert.equal(scanRes.data.partI[0].label, 'A');
  assert.ok(scanRes.data.annotatedImage.startsWith('data:image/jpeg;base64,'));
});
