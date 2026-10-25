// Nâng cấp 1: nhiều mã đề — đảo có seed, chùm dữ kiện, ánh xạ đáp án, chia mã, đáp án chéo, di trú, qua HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateExam, makeVariant, makeVariants, assignVariants, variantLayout, toOriginalResponse, displayedAnswer, OFFICIAL_BLUEPRINT } from '../shared/generate.mjs';
import { gradeAttempt } from '../shared/grading.mjs';
import { crossAnswerKey, examToDocx } from '../shared/exportExam.mjs';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';
import { SAMPLE_QUESTIONS } from '../server/seedQuestions.mjs';

const pool = SAMPLE_QUESTIONS.map((q, i) => ({ ...q, id: i + 1, status: 'approved' }));
const qById = Object.fromEntries(pool.map((q) => [q.id, q]));
const base = generateExam(pool, { ...OFFICIAL_BLUEPRINT, seed: 'mdt' }).items;

test('Cùng seed ra cùng mã đề; khác seed ra khác; tối đa 8 mã; mã từ 101', () => {
  const a = makeVariants(base, 4, 's1');
  assert.deepEqual(a, makeVariants(base, 4, 's1'));
  assert.notDeepEqual(a.map((v) => v.layout), makeVariants(base, 4, 's2').map((v) => v.layout));
  assert.deepEqual(a.map((v) => v.code), ['101', '102', '103', '104']);
  assert.equal(makeVariants(base, 20, 'x').length, 8);
  assert.equal(makeVariants(base, 0, 'x').length, 1);
  assert.notDeepEqual(a[0].layout.map((x) => x.qid), a[1].layout.map((x) => x.qid));
  for (const v of a) assert.deepEqual(v.layout.map((x) => x.qid).sort((p, q) => p - q), base.map((x) => x.qid).sort((p, q) => p - q), 'mã nào cũng đủ câu, không trùng');
});

test('Chùm dữ kiện: các câu cùng nhóm luôn liền nhau, giữ thứ tự gốc; không nhóm thì như cũ', () => {
  const items = base.map((x) => ({ ...x }));
  const mcq = items.filter((x) => x.type === 'mcq');
  [mcq[0], mcq[5], mcq[9]].forEach((x) => (x.group = 'G1'));
  [mcq[2], mcq[3]].forEach((x) => (x.group = 'G2'));
  const g1 = [mcq[0].qid, mcq[5].qid, mcq[9].qid];
  for (let i = 0; i < 30; i++) {
    const ids = makeVariant(items, `g${i}`).map((x) => x.qid);
    const at = g1.map((q) => ids.indexOf(q));
    assert.deepEqual(at, [at[0], at[0] + 1, at[0] + 2]);
    assert.equal(ids.indexOf(mcq[3].qid), ids.indexOf(mcq[2].qid) + 1);
  }
  assert.deepEqual(makeVariant(base, 'k'), makeVariant(base.map((x) => ({ ...x, group: null })), 'k'));
});

test('Sau khi đảo đáp án đúng vẫn đúng; cùng lựa chọn ở mọi mã cho cùng điểm', () => {
  const variants = makeVariants(base, 8, 'chk');
  const qs = base.map((b) => qById[b.qid]);
  const intent = {};
  base.forEach((b, i) => {
    const q = qById[b.qid];
    if (q.type === 'mcq') intent[q.id] = i % 3 === 0 ? (q.answer + 1) % 4 : q.answer;
    else if (q.type === 'tf') intent[q.id] = i % 2 ? q.answer : q.answer.map((x, k) => (k === 0 ? !x : x));
    else intent[q.id] = i % 2 ? q.answer : '99999';
  });
  const expect = gradeAttempt(qs, intent);
  for (const v of variants) {
    const shown = {};
    for (const it of v.layout) {
      const q = qById[it.qid];
      shown[it.qid] = it.type === 'mcq' ? it.perm.indexOf(intent[q.id]) : intent[q.id];
      if (q.type === 'mcq') {
        const correctShown = it.perm.indexOf(q.answer);
        assert.equal(toOriginalResponse(it, correctShown), q.answer);
        assert.equal(displayedAnswer(it, q), 'ABCD'[correctShown]);
        assert.equal(q.options[it.perm[correctShown]], q.options[q.answer], 'nội dung đáp án đúng không đổi');
      }
    }
    const orig = Object.fromEntries(v.layout.map((it) => [it.qid, toOriginalResponse(it, shown[it.qid])]));
    const g = gradeAttempt(qs, orig);
    assert.equal(g.score10, expect.score10, `mã ${v.code}`);
    assert.equal(g.points, expect.points);
  }
});

test('Bảng đáp án chéo khớp vị trí và đáp án từng mã; có trong file Word', async () => {
  const variants = makeVariants(base, 4, 'x');
  const key = crossAnswerKey(base, variants, qById);
  assert.equal(key.rows.length, base.length);
  for (const v of variants) {
    const counter = {};
    for (const it of v.layout) {
      counter[it.type] = (counter[it.type] ?? 0) + 1;
      const cell = key.rows.find((r) => r.qid === it.qid).cells[v.code];
      assert.equal(cell.no, counter[it.type]);
      assert.equal(cell.answer, displayedAnswer(it, qById[it.qid]));
    }
  }
  const buf = await examToDocx({ title: 'Đề', school: 'T', durationMin: 90 }, variants, qById, { baseItems: base });
  const { default: JSZip } = await import('jszip');
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string');
  assert.match(xml, /BẢNG ĐÁP ÁN CHÉO/);
  assert.match(xml, /Mã 104/);
});

test('Chia mã đề: đều, tái lập theo seed, theo danh sách, báo lỗi mã/học sinh sai', () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const codes = ['101', '102', '103'];
  const a = assignVariants({ studentIds: ids, codes, seed: 'k' });
  assert.deepEqual(a, assignVariants({ studentIds: ids, codes, seed: 'k' }));
  const n = (c) => Object.values(a.map).filter((x) => x === c).length;
  assert.ok([n('101'), n('102'), n('103')].every((x) => x === 3 || x === 4));
  assert.equal(Object.keys(a.map).length, 10);
  assert.notDeepEqual(a.map, assignVariants({ studentIds: ids, codes, seed: 'other' }).map);
  const l = assignVariants({ studentIds: ids, codes, mode: 'list', list: { 1: '103', 2: '103' } });
  assert.equal(l.map[1], '103');
  assert.equal(l.map[2], '103');
  assert.equal(Object.keys(l.map).length, 10);
  assert.equal(assignVariants({ studentIds: ids, codes, mode: 'list', list: { 1: '999', 77: '101' } }).errors.length, 2);
});

test('Đề cũ chưa lưu layout vẫn xuất được như trước', () => {
  const legacy = { code: '101', seed: '123-0' };
  assert.deepEqual(variantLayout(5, base, legacy), makeVariant(base, '5-123-0'));
});

test('Di trú: CSDL cũ thiếu cột được thêm, dữ liệu giữ nguyên, chạy lại không lỗi', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE schools (id INTEGER PRIMARY KEY, name TEXT NOT NULL, sample INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE questions (id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, type TEXT NOT NULL, stem TEXT NOT NULL, options_json TEXT NOT NULL DEFAULT '[]', answer_json TEXT, explanation TEXT NOT NULL DEFAULT '', topic TEXT, level INTEGER NOT NULL DEFAULT 2, source TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', distractors_json TEXT NOT NULL DEFAULT '{}', origin TEXT, parent_id INTEGER, tag_confidence REAL, created_by INTEGER, approved_by INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, sample INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE assignments (id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, exam_id INTEGER NOT NULL, class_id INTEGER NOT NULL, mode TEXT NOT NULL, title TEXT NOT NULL, open_at INTEGER NOT NULL, close_at INTEGER NOT NULL, duration_min INTEGER NOT NULL, show_result TEXT NOT NULL DEFAULT 'after_submit', created_by INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, assignment_id INTEGER, student_id INTEGER NOT NULL, kind TEXT NOT NULL, title TEXT, layout_json TEXT NOT NULL, started_at INTEGER NOT NULL, deadline_at INTEGER, submitted_at INTEGER, responses_json TEXT NOT NULL DEFAULT '{}', times_json TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 0, saved_at INTEGER, late_json TEXT, status TEXT NOT NULL DEFAULT 'in_progress', score10 REAL, points REAL, max_points REAL, result_json TEXT, diagnosis_json TEXT, events_json TEXT NOT NULL DEFAULT '[]', client_id TEXT, checked_json TEXT NOT NULL DEFAULT '{}');
    INSERT INTO questions (school_id, type, stem, source, created_at, updated_at) VALUES (1, 'short', 'Cũ', 'teacher', 1, 1);
    INSERT INTO attempts (school_id, student_id, kind, layout_json, started_at) VALUES (1, 2, 'practice', '[]', 1);`);
  old.close();
  for (let i = 0; i < 2; i++) {
    const db = openDb(file);
    const cols = (t) => db.all(`PRAGMA table_info(${t})`).map((c) => c.name);
    assert.ok(cols('questions').includes('group_id'));
    assert.ok(cols('attempts').includes('variant_code'));
    assert.ok(cols('assignments').includes('variant_map_json') && cols('assignments').includes('variant_mode'));
    assert.equal(db.get('SELECT stem, group_id FROM questions').stem, 'Cũ');
    assert.equal(db.get('SELECT variant_code FROM attempts').variant_code, null);
    db.close();
  }
});

// ---------------- qua HTTP ----------------
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
      return r.data.user;
    },
  };
}

test('API: sinh 4 mã, giao chia đều, học sinh thi mã khác nhau vẫn cùng điểm; danh sách và đáp án chéo', async () => {
  const teacher = client();
  await teacher.login('gv.lan');
  const g = await teacher.post('/api/exams/generate', { counts: { mcq: 12, tf: 4, short: 6 }, seed: 'api-mdt' });
  const created = await teacher.post('/api/exams', { title: 'Nhiều mã', items: g.data.items, durationMin: 60, variants: 4, seed: 'fixed' });
  const examId = created.data.id;
  const stored = app.db.get('SELECT variants_json FROM exams WHERE id = ?', examId).variants;
  assert.deepEqual(stored.map((v) => v.code), ['101', '102', '103', '104']);
  assert.ok(stored.every((v) => v.layout.length === 22), 'layout từng mã được lưu bền');
  const again = await teacher.post('/api/exams', { title: 'Nhiều mã 2', items: g.data.items, durationMin: 60, variants: 4, seed: 'fixed' });
  assert.deepEqual(app.db.get('SELECT variants_json FROM exams WHERE id = ?', again.data.id).variants.map((v) => v.layout), stored.map((v) => v.layout));

  const key = await teacher.get(`/api/exams/${examId}/answer-key`);
  assert.equal(key.data.rows.length, 22);
  assert.equal(key.data.codes.length, 4);
  const docx = await teacher.get(`/api/exams/${examId}/docx`);
  assert.equal(docx.status, 200);

  const cls = (await teacher.get('/api/classes')).data.classes[0];
  const bad = await teacher.post('/api/assignments', { examId, classId: cls.id, openAt: clock - 1000, closeAt: clock + 86400000, variantMode: 'list', variantList: { 1: '999' } });
  assert.equal(bad.status, 400);

  const students = app.db.all("SELECT id, username FROM users WHERE class_id = ? AND role = 'student' ORDER BY id", cls.id);
  const a = await teacher.post('/api/assignments', { examId, classId: cls.id, mode: 'exam', openAt: clock - 1000, closeAt: clock + 86400000, durationMin: 60, variantMode: 'random', variantSeed: 's' });
  const asgId = a.data.ids[0];
  const snap = app.db.get('SELECT snapshot_json FROM exams WHERE id = ?', examId).snapshot;
  const scores = [];
  const codes = [];
  for (const s of students) {
    const c = client();
    await c.login(s.username);
    const att = (await c.post('/api/attempts/start', { assignmentId: asgId })).data;
    const row = app.db.get('SELECT variant_code, layout_json FROM attempts WHERE id = ?', att.id);
    codes.push(row.variant_code);
    assert.deepEqual(row.layout, stored.find((v) => v.code === row.variant_code).layout, 'bài làm dùng đúng bố cục của mã đề');
    const answers = {};
    for (const it of row.layout) {
      const q = snap[it.qid];
      answers[it.qid] = q.type === 'mcq' ? it.perm.indexOf(q.answer) : q.answer;
    }
    await c.post(`/api/attempts/${att.id}/submit`, { responses: answers, version: 1 });
    scores.push(app.db.get('SELECT score10 FROM attempts WHERE id = ?', att.id).score10);
  }
  assert.ok(scores.every((x) => x === 10), `điểm: ${scores}`);
  const dist = ['101', '102', '103', '104'].map((c) => codes.filter((x) => x === c).length);
  assert.deepEqual(dist, [2, 2, 2, 2], 'chia đều 8 em cho 4 mã');
  const view = await teacher.get(`/api/assignments/${asgId}/variants`);
  assert.deepEqual(view.data.students.map((s) => s.code).sort(), [...codes].sort());

  const l = await teacher.post('/api/assignments', { examId, classId: cls.id, mode: 'homework', openAt: clock - 1000, closeAt: clock + 86400000, variantMode: 'list', variantList: { [students[0].id]: '104', [students[1].id]: '102' } });
  const lv = await teacher.get(`/api/assignments/${l.data.ids[0]}/variants`);
  assert.equal(lv.data.students.find((s) => s.id === students[0].id).code, '104');
  assert.equal(lv.data.students.find((s) => s.id === students[1].id).code, '102');
  assert.ok(lv.data.students.every((s) => s.code));
  const other = client();
  await other.login('gv.khac');
  assert.equal((await other.get(`/api/assignments/${asgId}/variants`)).status, 404);
  assert.equal((await other.get(`/api/exams/${examId}/answer-key`)).status, 404);
});
