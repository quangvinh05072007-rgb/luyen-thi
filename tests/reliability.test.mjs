// Giai đoạn 0: kiểm thử thật — PDF/Excel/Word do Microsoft tạo, nhiều người thi cùng lúc, sao lưu và khôi phục.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { importFile } from '../server/importers.mjs';
import { assertSafeZip } from '../shared/docx.mjs';
import { shortMatches } from '../shared/grading.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';
import { restoreBackup, verifyBackup } from '../server/restore.mjs';
import { openDb } from '../server/db.mjs';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url));

test('PDF thật xuất từ Word: chữ tiếng Việt liền mạch, tách đúng 2 câu, không dính tiêu đề phần', async () => {
  const r = await importFile('de.pdf', fx('de-xuat-tu-word.pdf'), null);
  assert.equal(r.questions.length, 2);
  const [q1, q2] = r.questions;
  assert.equal(q1.type, 'mcq');
  assert.match(q1.stem, /Giá trị của biểu thức/);
  assert.deepEqual(q1.options, ['2', '2,5', '3', '1,5']);
  assert.equal(q2.type, 'short');
  assert.match(q2.stem, /Tính tích phân ∫ 3x dx/);
  assert.equal(q2.answer, '1');
  assert.ok(r.questions.every((q) => !/PH\s*Ầ\s*N/.test(JSON.stringify(q))), 'tiêu đề phần không dính vào phương án');
  assert.ok(r.warnings.some((w) => /PDF/.test(w)), 'có cảnh báo công thức PDF');
  assert.equal(r.info.pages, 1);
});

test('Excel thật (do Microsoft Excel lưu): 5 câu, ô số, dấu phẩy, công thức LaTeX, đáp án chữ và số', async () => {
  const r = await importFile('mau.xlsx', fx('mau-excel-that.xlsx'), null);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.questions.length, 5);
  const [tn, ds, tln, num, comma] = r.questions;
  assert.equal(tn.type, 'mcq');
  assert.equal(tn.answer, 0);
  assert.equal(tn.topic, 'T11.DAOHAM');
  assert.equal(tn.level, 1);
  assert.equal(tn.options[0], '$3x^2$');
  assert.match(tn.explanation, /nx\^\{n-1\}/);
  assert.equal(ds.type, 'tf');
  assert.deepEqual(ds.answer, [true, false, true, true]);
  assert.equal(tln.answer, '1', 'ô số 1 không thành "1.0"');
  assert.equal(num.answer, '1.5');
  assert.ok(shortMatches(num.answer, '1,5') && shortMatches(num.answer, '3/2'), 'học sinh gõ 1,5 hoặc 3/2 đều nhận');
  assert.equal(comma.options[0], '$1,5$');
});

test('Word thật vẫn nhập đúng sau khi thêm giới hạn file nén', async () => {
  const r = await importFile('de.docx', fx('de-soan-bang-word.docx'), null);
  assert.equal(r.questions.length, 2);
});

test('File nén quá lớn sau giải nén bị từ chối trước khi đọc (chống zip bomb)', async () => {
  const zip = new JSZip();
  zip.file('word/document.xml', '0'.repeat(3_000_000));
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  assert.ok(buf.length < 100_000, `nén còn ${buf.length} byte`);
  const loaded = await JSZip.loadAsync(buf);
  assert.throws(() => assertSafeZip(loaded, 1_000_000), /quá lớn/);
  assert.doesNotThrow(() => assertSafeZip(loaded, 10_000_000));
});

// ---------------- nhiều người thi cùng lúc ----------------
// Tối đa 100 kết nối cùng lúc: hàng đợi kết nối của Windows bản thường nhỏ (~200); học sinh thật vào rải ra vài giây.
const inWaves = async (items, fn, size = 100) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
};
const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];

test('300 học sinh cùng bắt đầu, lưu, nộp (kể cả nộp lặp song song): không mất bài, không trùng bài, điểm đúng', { timeout: 120000 }, async () => {
  let clock = Date.parse('2026-10-19T08:00:00+07:00');
  const app = createApp({ dbFile: ':memory:', clock: () => clock, aiImpl: { enabled: false } });
  seedSample(app);
  const server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, '127.0.0.1', 1024, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const lat = [];
  const call = async (cookie, method, p, body) => {
    const t0 = performance.now();
    const res = await fetch(base + p, { method, headers: { cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json();
    lat.push(performance.now() - t0);
    return { status: res.status, data };
  };
  try {
    const school = app.db.get('SELECT id FROM schools LIMIT 1').id;
    const teacher = app.db.get("SELECT id FROM users WHERE username = 'gv.lan'");
    const cid = Number(app.db.run('INSERT INTO classes (school_id, name, grade, teacher_id) VALUES (?,?,?,?)', school, 'TAI-300', 12, teacher.id).lastInsertRowid);
    const N = 300;
    const tokens = [];
    app.db.tx(() => {
      for (let i = 0; i < N; i++) {
        const uid = Number(app.db.run("INSERT INTO users (school_id, role, username, display_name, pass_hash, class_id, created_at) VALUES (?,?,?,?,?,?,?)", school, 'student', `tai.${i}`, `Học sinh tải ${i}`, 'x', cid, clock).lastInsertRowid);
        const token = `tok-${i}-${Math.random().toString(36).slice(2)}`;
        app.db.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)', token, uid, clock, clock + 86400000);
        tokens.push({ uid, cookie: `se_session=${token}` });
      }
    });
    // giáo viên tạo đề và giao
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'gv.lan', password: SAMPLE_PASSWORD }) });
    const tcookie = login.headers.get('set-cookie').split(';')[0];
    const g = await call(tcookie, 'POST', '/api/exams/generate', { counts: { mcq: 12, tf: 4, short: 6 }, seed: 'load' });
    const exam = (await call(tcookie, 'POST', '/api/exams', { title: 'Tải', items: g.data.items, durationMin: 60, variants: 4, seed: 'load' })).data.id;
    const asg = (await call(tcookie, 'POST', '/api/assignments', { examId: exam, classId: cid, mode: 'exam', openAt: clock - 1000, closeAt: clock + 86400000, durationMin: 60 })).data.ids[0];
    const snap = app.db.get('SELECT snapshot_json FROM exams WHERE id = ?', exam).snapshot;
    lat.length = 0;

    const t0 = performance.now();
    const started = await inWaves(tokens, (t) => call(t.cookie, 'POST', '/api/attempts/start', { assignmentId: asg, clientId: `m-${t.uid}` }));
    assert.ok(started.every((r) => r.status === 200), 'mọi em bắt đầu được');
    const ids = started.map((r) => r.data.id);
    assert.equal(new Set(ids).size, N);

    const answersFor = (i) => {
      const layout = app.db.get('SELECT layout_json FROM attempts WHERE id = ?', ids[i]).layout;
      const out = {};
      for (const it of layout) {
        const q = snap[it.qid];
        const right = q.type === 'mcq' ? it.perm.indexOf(q.answer) : q.answer;
        out[it.qid] = i % 5 === 0 && q.type === 'mcq' ? (right + 1) % 4 : right; // 1/5 số em chọn sai Phần I
      }
      return out;
    };
    const all = tokens.map((_, i) => answersFor(i));
    const saved = await inWaves(tokens.map((t, i) => [t, i]), ([t, i]) => call(t.cookie, 'PUT', `/api/attempts/${ids[i]}/save`, { responses: all[i], version: 2, clientId: `m-${t.uid}` }));
    assert.ok(saved.every((r) => r.status === 200 && r.data.ok === true));

    // 1/3 số em bấm nộp hai lần song song
    const submits = [];
    tokens.forEach((t, i) => {
      submits.push(() => call(t.cookie, 'POST', `/api/attempts/${ids[i]}/submit`, { responses: all[i], version: 3 }));
      if (i % 3 === 0) submits.push(() => call(t.cookie, 'POST', `/api/attempts/${ids[i]}/submit`, { responses: all[i], version: 3 }));
    });
    const done = await inWaves(submits, (f) => f());
    const total = performance.now() - t0;
    assert.ok(done.every((r) => r.status === 200));

    const rows = app.db.all('SELECT id, student_id, status, score10 FROM attempts WHERE assignment_id = ?', asg);
    assert.equal(rows.length, N, 'đúng 300 bài, không trùng');
    assert.ok(rows.every((r) => r.status === 'submitted'));
    const wrong = rows.filter((r) => r.score10 < 10).length;
    assert.equal(wrong, N / 5, 'đúng 60 em có lỗi, còn lại 10 điểm');
    for (const r of rows.filter((x) => x.score10 === 10)) assert.equal(app.db.get('SELECT COUNT(*) n FROM evidence WHERE attempt_id = ?', r.id).n, 22);
    assert.equal(app.db.get('SELECT COUNT(*) n FROM evidence WHERE attempt_id IN (SELECT id FROM attempts WHERE assignment_id = ?)', asg).n, N * 22, 'nộp lặp không ghi bằng chứng hai lần');

    const p50 = Math.round(pct(lat, 0.5));
    const p95 = Math.round(pct(lat, 0.95));
    console.log(`[tải] ${N} học sinh, ${lat.length} yêu cầu, tổng ${Math.round(total)} ms, p50 ${p50} ms, p95 ${p95} ms, lớn nhất ${Math.round(Math.max(...lat))} ms`);
    assert.ok(p95 < 15000, `p95 ${p95} ms quá chậm`);
  } finally {
    server.close();
  }
});

test('100 học sinh đăng nhập cùng lúc không làm treo máy chủ (băm mật khẩu chạy nền)', { timeout: 120000 }, async () => {
  const app = createApp({ dbFile: ':memory:', aiImpl: { enabled: false } });
  seedSample(app);
  const server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = (i) => fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: i % 2 ? 'hs.an.nm' : 'khong.co', password: 'sai-mat-khau' }) }).then((r) => r.status);
    const pings = [];
    const storm = Promise.all(Array.from({ length: 100 }, (_, i) => login(i)));
    for (let k = 0; k < 8; k++) {
      const t0 = performance.now();
      await fetch(`${base}/api/setup`).then((r) => r.json());
      pings.push(performance.now() - t0);
      await new Promise((r) => setTimeout(r, 20));
    }
    const statuses = await storm;
    assert.ok(statuses.every((s) => s === 401 || s === 429), `trạng thái: ${[...new Set(statuses)]}`);
    const worst = Math.round(Math.max(...pings));
    console.log(`[đăng nhập] 100 yêu cầu song song, trang khác phản hồi chậm nhất ${worst} ms`);
    assert.ok(worst < 1500, `máy chủ bị treo ${worst} ms`);
  } finally {
    server.close();
  }
});

// ---------------- sao lưu và khôi phục ----------------
test('Sao lưu rồi khôi phục: dữ liệu quay về đúng, bản đang dùng được giữ lại, bản hỏng bị từ chối', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'se-bk-'));
  const dbFile = path.join(dir, 'data', 'smartexam.db');
  const backupDir = path.join(dir, 'backups');
  const app = createApp({ dbFile, backupDir, keepBackups: 3, aiImpl: { enabled: false } });
  seedSample(app);
  const users0 = app.db.get('SELECT COUNT(*) n FROM users').n;
  const att0 = app.db.get('SELECT COUNT(*) n FROM attempts').n;
  const backup = app.backupNow('thu');
  assert.equal(verifyBackup(backup), users0);

  // thảm họa: mất dữ liệu sau khi sao lưu
  app.db.run('DELETE FROM attempts');
  app.db.run("DELETE FROM users WHERE role = 'student'");
  assert.ok(app.db.get('SELECT COUNT(*) n FROM users').n < users0);
  app.db.close();

  // bản hỏng bị từ chối và không đụng tới CSDL đang dùng
  const bad = path.join(dir, 'hong.db');
  fs.writeFileSync(bad, Buffer.concat([fs.readFileSync(backup).subarray(0, 4096), Buffer.alloc(8192, 7)]));
  assert.throws(() => restoreBackup(bad, dbFile), /sao lưu|đọc được/);
  assert.throws(() => restoreBackup(path.join(dir, 'khong-co.db'), dbFile), /Không thấy/);
  assert.ok(fs.existsSync(dbFile));

  const r = restoreBackup(backup, dbFile, Date.parse('2026-10-25T10:00:00Z'));
  assert.equal(r.users, users0);
  assert.match(r.kept, /truoc-khoi-phuc-20261025-17/);
  assert.ok(fs.existsSync(r.kept), 'bản đang dùng được giữ lại');

  const db = openDb(dbFile);
  assert.equal(db.get('SELECT COUNT(*) n FROM users').n, users0);
  assert.equal(db.get('SELECT COUNT(*) n FROM attempts').n, att0);
  assert.equal(db.get('PRAGMA integrity_check').integrity_check, 'ok');
  db.close();
  // máy chủ khởi động lại được với bản khôi phục
  const again = createApp({ dbFile, aiImpl: { enabled: false } });
  assert.equal(again.db.get('SELECT COUNT(*) n FROM users').n, users0);
  again.db.close();
});

test('Giữ tối đa N bản sao lưu gần nhất', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'se-keep-'));
  let t = Date.parse('2026-10-19T08:00:00+07:00');
  const app = createApp({ dbFile: ':memory:', backupDir: dir, keepBackups: 3, clock: () => t, aiImpl: { enabled: false } });
  seedSample(app);
  for (let i = 0; i < 6; i++) {
    t += 3600000;
    app.backupNow('auto');
  }
  const files = fs.readdirSync(dir).sort();
  assert.equal(files.length, 3);
  assert.match(files.at(-1), /20261019-1400/);
});
