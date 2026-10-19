// Thiết lập trường thật lần đầu, nhập danh sách tài khoản hàng loạt, sao lưu.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';

let server;
let base;
let cookie = '';
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'se-backup-'));

before(async () => {
  const app = createApp({ dbFile: ':memory:', backupDir, aiImpl: { enabled: false } });
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fs.rmSync(backupDir, { recursive: true, force: true });
});

async function call(method, p, body) {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: res.status, data: await res.json() };
}

test('Máy mới: cần thiết lập; mật khẩu yếu bị từ chối; tạo trường thật kèm ngân hàng mẫu', async () => {
  assert.equal((await call('GET', '/api/setup')).data.needsSetup, true);
  const weak = await call('POST', '/api/setup', { mode: 'real', schoolName: 'THPT A', adminName: 'Cô B', username: 'quanly', password: '123' });
  assert.equal(weak.status, 400);
  const ok = await call('POST', '/api/setup', { mode: 'real', schoolName: 'THPT A', adminName: 'Cô B', username: 'quanly', password: 'matkhau123', withSampleBank: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'admin');
  assert.equal(ok.data.user.school.sample, 0);
  assert.equal((await call('GET', '/api/setup')).data.needsSetup, false);
  assert.equal((await call('GET', '/api/demo')).data.sample, false, 'trường thật không hiện tài khoản mẫu');
  const again = await call('POST', '/api/setup', { mode: 'sample' });
  assert.equal(again.status, 409, 'không thiết lập lại được khi đã có trường');
  const qs = await call('GET', '/api/questions?status=approved');
  assert.equal(qs.data.questions.length, 64);
});

test('Nhập danh sách: tạo lớp theo tên, tên đăng nhập không trùng, đăng nhập được bằng mật khẩu tạm', async () => {
  const bad = await call('POST', '/api/admin/users/bulk', { rows: [{ name: 'Lê An', className: 'A1' }] });
  assert.equal(bad.status, 400);
  const r = await call('POST', '/api/admin/users/bulk', {
    rows: [
      { name: 'Nguyễn Văn An', className: '12a1' },
      { name: 'Nguyễn Văn An', className: '12A1' },
      { name: 'Trần Thị Bình', className: '11B2' },
      { name: 'Phạm Giáo', role: 'teacher' },
    ],
  });
  assert.equal(r.status, 200);
  const c = r.data.created;
  assert.deepEqual(c.map((x) => x.username), ['hs.an.nv', 'hs.an.nv2', 'hs.binh.tt', 'gv.giao.p']);
  assert.deepEqual(c.map((x) => x.className), ['12A1', '12A1', '11B2', null]);
  const users = await call('GET', '/api/admin/users');
  assert.deepEqual(users.data.classes.map((x) => [x.name, x.grade]), [['12A1', 12], ['11B2', 11]]);
  const admin = cookie;
  cookie = '';
  const login = await call('POST', '/api/login', { username: 'hs.an.nv2', password: c[1].tempPassword });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.class.name, '12A1');
  cookie = admin;
});

test('Sao lưu: tạo file SQLite đọc được, liệt kê, chỉ quản lý được gọi', async () => {
  const r = await call('POST', '/api/admin/backups');
  assert.equal(r.status, 200);
  const list = await call('GET', '/api/admin/backups');
  assert.equal(list.data.backups.length, 1);
  const { DatabaseSync } = await import('node:sqlite');
  const b = new DatabaseSync(path.join(backupDir, r.data.name));
  assert.equal(b.prepare('SELECT COUNT(*) n FROM questions').get().n, 64);
  b.close();
  cookie = '';
  assert.equal((await call('POST', '/api/admin/backups')).status, 401);
});
