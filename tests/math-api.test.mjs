import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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
    if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }
    const res = await fetch(base + path, { method, headers, body: payload });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
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

test('API /api/meta trả về mathVerifyAvailable boolean', async () => {
  const c = client();
  const res = await c.get('/api/meta');
  assert.equal(res.status, 200);
  assert.equal(typeof res.data.mathVerifyAvailable, 'boolean');
});

test('API /api/math/verify kiểm tra tương đương toán học', async () => {
  const c = client();
  const meta = await c.get('/api/meta');
  if (!meta.data.mathVerifyAvailable) return;

  const res = await c.post('/api/math/verify', {
    expr1: '\\frac{1}{2}',
    expr2: '0.5',
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.equivalent, true);

  const resDiff = await c.post('/api/math/verify', {
    expr1: 'x + 1',
    expr2: 'x + 2',
  });
  assert.equal(resDiff.status, 200);
  assert.equal(resDiff.data.equivalent, false);
});

test('API /api/math/validate kiểm tra tính hợp lệ biểu thức', async () => {
  const c = client();
  const meta = await c.get('/api/meta');
  if (!meta.data.mathVerifyAvailable) return;

  const resValid = await c.post('/api/math/validate', {
    expr: 'x^2 + 2x + 1',
  });
  assert.equal(resValid.status, 200);
  assert.equal(resValid.data.valid, true);
});

test('API /api/questions/check-duplicate phát hiện câu trùng trong trường', async () => {
  const c = client();
  await c.login('gv.lan');

  // Insert a question
  const createRes = await c.post('/api/questions', {
    type: 'mcq',
    stem: 'Cho hàm số $y = f(x)$ có bảng biến thiên như sau. Tìm giá trị cực đại của hàm số.',
    options: ['1', '2', '3', '4'],
    answer: 0,
    topic: 'ham-so',
    level: 1,
  });
  assert.equal(createRes.status, 200);

  // Check duplicate with similar stem
  const checkRes = await c.post('/api/questions/check-duplicate', {
    stem: 'Cho hàm số $y = f(x)$ có bảng biến thiên như sau. Giá trị cực đại của hàm số đã cho bằng bao nhiêu?',
  });

  assert.equal(checkRes.status, 200);
  assert.ok(Array.isArray(checkRes.data.duplicates));
  assert.ok(checkRes.data.duplicates.length >= 1, 'Phải tìm thấy câu tương tự');
  assert.ok(checkRes.data.duplicates[0].score >= 0.65);
});
