import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let app, server, base, studentId, clock = Date.parse('2026-10-25T10:00:00+07:00');
const DAY = 86400000;
function client() {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    async call(method, path, body, headers = {}) {
      const res = await fetch(base + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return { status: res.status, data: await res.json(), setCookie };
    },
    async login(username) {
      assert.equal((await this.call('POST', '/api/login', { username, password: SAMPLE_PASSWORD })).status, 200);
      return this;
    },
  };
}
let teacher, admin, otherTeacher, otherSchool, student;
before(async () => {
  app = createApp({ dbFile: ':memory:', clock: () => clock, aiImpl: { enabled: false } });
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  studentId = app.db.get("SELECT id FROM users WHERE username='hs.an.nm'").id;
  [teacher, admin, otherTeacher, otherSchool, student] = await Promise.all(['gv.lan', 'quanly', 'gv.minh', 'gv.khac', 'hs.an.nm'].map((u) => client().login(u)));
});
after(() => { server?.close(); app?.db.close(); });
async function issue(staff = teacher, body = {}) {
  const r = await staff.call('POST', `/api/students/${studentId}/family-access`, body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
async function familyLogin(code) {
  const family = client();
  const r = await family.call('POST', '/api/family/login', { code });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { family, response: r };
}

test('parent dashboard finalizes expired work and respects an individual extended deadline', async () => {
  const { family } = await familyLogin((await issue()).code);
  const asg = app.db.get('SELECT * FROM assignments WHERE class_id=(SELECT class_id FROM users WHERE id=?) ORDER BY id DESC LIMIT 1',studentId);
  const started = await student.call('POST','/api/attempts/start',{assignmentId:asg.id});
  assert.equal(started.status,200,JSON.stringify(started.data));
  const attId=started.data.id;
  app.db.run("UPDATE assignments SET close_at=?, show_result='after_submit' WHERE id=?",clock-60000,asg.id);
  app.db.run('UPDATE attempts SET deadline_at=? WHERE id=?',clock+60000,attId);
  let result=await family.call('GET','/api/family/dashboard');
  assert.equal(result.data.participation.find(a=>a.id===asg.id).state,'pending');
  app.db.run('UPDATE attempts SET deadline_at=? WHERE id=?',clock-60000,attId);
  result=await family.call('GET','/api/family/dashboard');
  assert.equal(result.status,200);
  assert.equal(result.data.participation.find(a=>a.id===asg.id).state,'completed');
  assert.ok(result.data.grades.some(a=>a.id===attId));
});

test('family access only class teacher or same-school admin may issue, inspect or revoke', async () => {
  for (const forbidden of [otherTeacher, otherSchool, student]) {
    assert.equal((await forbidden.call('GET', `/api/students/${studentId}/family-access`)).status, 403);
    assert.equal((await forbidden.call('POST', `/api/students/${studentId}/family-access`, {})).status, 403);
    assert.equal((await forbidden.call('POST', `/api/students/${studentId}/family-access/revoke`, {})).status, 403);
  }
  assert.equal((await client().call('POST', `/api/students/${studentId}/family-access`, {})).status, 401);
  assert.ok((await issue(admin)).code);
});

test('issued code is shown once, hashes stay at rest and family cookie cannot authenticate student routes', async () => {
  const issued = await issue();
  assert.match(issued.code, /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){5}$/);
  const status = await teacher.call('GET', `/api/students/${studentId}/family-access`);
  assert.equal(status.data.active, true);
  assert.equal(status.data.code, undefined);
  const { family, response } = await familyLogin(issued.code.toLowerCase().replaceAll('-', ' '));
  assert.match(response.setCookie, /se_family_session=/);
  assert.match(response.setCookie, /HttpOnly/);
  assert.match(response.setCookie, /SameSite=Strict/);
  assert.equal((await family.call('GET', '/api/student/home')).status, 401);
  const access = app.db.get('SELECT * FROM family_access WHERE student_id = ?', studentId);
  const session = app.db.get('SELECT * FROM family_sessions WHERE student_id = ?', studentId);
  assert.ok(!JSON.stringify(access).includes(issued.code.replaceAll('-', '')));
  assert.ok(!JSON.stringify(session).includes(family.cookie.split('=')[1]));
  assert.ok(!JSON.stringify(app.db.all("SELECT * FROM audit_log WHERE action LIKE 'family_%'")).includes(issued.code));
});

test('family dashboard exposes only released completed results, own participation and safe topic suggestions', async () => {
  const issued = await issue();
  const { family } = await familyLogin(issued.code);
  const att = app.db.get("SELECT t.* FROM attempts t JOIN assignments a ON a.id=t.assignment_id WHERE t.student_id=? AND t.status <> 'in_progress' LIMIT 1", studentId);
  assert.ok(att);
  app.db.run("UPDATE assignments SET show_result='after_close', close_at=? WHERE id=?", clock + DAY, att.assignment_id);
  app.db.run("UPDATE attempts SET title='SECRET_UNRELEASED', score10=9.876 WHERE id=?", att.id);
  app.db.run("INSERT INTO evidence(school_id,student_id,qid,topic,level,score,correct,attempt_id,at) VALUES(?,?,?,?,?,?,?,?,?)", att.school_id, studentId, 999999, 'SECRET_TOPIC', 1, 1, 1, att.id, clock);
  const result = await family.call('GET', '/api/family/dashboard?studentId=99999');
  assert.equal(result.status, 200);
  assert.equal(result.data.student.id, studentId);
  assert.equal(result.data.student.username, undefined);
  assert.ok(!result.data.grades.some((a) => a.id === att.id));
  const raw = JSON.stringify(result.data);
  for (const secret of ['SECRET_UNRELEASED', 'SECRET_TOPIC', '9.876', 'answer', 'explanation', 'responses', 'pass_hash', 'hs.an.nm']) assert.ok(!raw.includes(secret), secret);
  assert.ok(result.data.participation.every((a) => a.studentId === undefined));
  app.db.run('UPDATE assignments SET close_at=? WHERE id=?', clock - 1, att.assignment_id);
  const released = await family.call('GET', '/api/family/dashboard');
  assert.ok(released.data.grades.some((a) => a.id === att.id && a.score10 === 9.876));
});

test('rotating and revoking code immediately invalidate old code and all old family sessions', async () => {
  const old = await issue();
  const { family: first } = await familyLogin(old.code);
  const replacement = await issue();
  assert.equal((await first.call('GET', '/api/family/dashboard')).status, 401);
  assert.equal((await client().call('POST', '/api/family/login', { code: old.code })).status, 401);
  const { family: second } = await familyLogin(replacement.code);
  assert.equal((await teacher.call('POST', `/api/students/${studentId}/family-access/revoke`, {})).status, 200);
  assert.equal((await second.call('GET', '/api/family/dashboard')).status, 401);
  assert.equal((await client().call('POST', '/api/family/login', { code: replacement.code })).status, 401);
});

test('family logout clears its cookie and invalidates the session', async () => {
  const { family } = await familyLogin((await issue()).code);
  const tokenCookie = family.cookie;
  const result = await family.call('POST', '/api/family/logout', {});
  assert.equal(result.status, 200);
  assert.match(result.setCookie, /Max-Age=0/);
  assert.equal((await client().call('GET', '/api/family/dashboard', undefined, { cookie: tokenCookie })).status, 401);
});

test('expired code, expired family session and inactive student cannot read the dashboard', async () => {
  const code = await issue(teacher, { expiresInDays: 1 });
  const { family } = await familyLogin(code.code);
  clock += 13 * 3600000;
  assert.equal((await family.call('GET', '/api/family/dashboard')).status, 401);
  clock += DAY;
  assert.equal((await client().call('POST', '/api/family/login', { code: code.code })).status, 401);
  await teacher.login('gv.lan');
  const fresh = await issue();
  const { family: inactive } = await familyLogin(fresh.code);
  app.db.run('UPDATE users SET active=0 WHERE id=?', studentId);
  assert.equal((await inactive.call('GET', '/api/family/dashboard')).status, 401);
  assert.equal((await client().call('POST', '/api/family/login', { code: fresh.code })).status, 401);
  app.db.run('UPDATE users SET active=1 WHERE id=?', studentId);
});

test('family mutation rejects cross-site form requests without JSON content type', async () => {
  const code = await issue();
  const response = await fetch(base + '/api/family/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `code=${code.code}` });
  assert.equal(response.status, 400);
  const { family } = await familyLogin(code.code);
  const logout = await fetch(base + '/api/family/logout', { method: 'POST', headers: { cookie: family.cookie, 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(logout.status, 400);
  assert.equal((await family.call('GET', '/api/family/dashboard')).status, 200);
});

test('guessing different invalid codes is limited per IP even with valid code on next try', async () => {
  clock += 11 * 60000;
  const valid = await issue();
  const anonymous = client();
  for (let i = 0; i < 5; i++) assert.equal((await anonymous.call('POST', '/api/family/login', { code: `INVALID-${i}` })).status, 401);
  assert.equal((await anonymous.call('POST', '/api/family/login', { code: valid.code })).status, 429);
  clock += 11 * 60000;
  assert.equal((await anonymous.call('POST', '/api/family/login', { code: valid.code })).status, 200);
});

