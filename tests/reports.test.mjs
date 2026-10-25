import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import JSZip from 'jszip';
import { createApp } from '../server/app.mjs';

const ms = (s) => Date.parse(s.includes('T') ? s : `${s}T00:00:00+07:00`);
async function fixture(t, initial = '2026-10-25T12:00:00+07:00') {
  let clock = ms(initial);
  const app = createApp({ clock: () => clock, aiImpl: { enabled: false } });
  const { db } = app;
  db.run("INSERT INTO schools(id,name) VALUES (1,'Trường 1'),(2,'Trường 2')");
  const users = [[1,1,'admin',null],[2,1,'teacher',null],[3,1,'teacher',null],[4,2,'teacher',null],[11,1,'student',1],[12,1,'student',1],[13,1,'student',1],[14,1,'student',2],[15,2,'student',3]];
  for (const [id, school, role, cls] of users) {
    db.run('INSERT INTO users(id,school_id,role,username,display_name,pass_hash,class_id,created_at) VALUES (?,?,?,?,?,?,?,?)', id, school, role, `u${id}`, `Người ${id}`, 'unused', cls, clock);
    db.run('INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES (?,?,?,?)', `token${id}`, id, clock, ms('2030-01-01'));
  }
  db.run("INSERT INTO classes(id,school_id,name,grade,teacher_id) VALUES (1,1,'12A1',12,2),(2,1,'12A2',12,3),(3,2,'12X',12,4)");
  db.run("INSERT INTO exams(id,school_id,title,blueprint_json,items_json,duration_min,variants_json,snapshot_json,created_by,created_at) VALUES (1,1,'Đề','{}','[]',60,'[]','{}',2,?)", clock);
  const assignment = (id, open, { classId = 1, school = 1, target = null, show = 'after_submit', close = '2026-10-24' } = {}) => db.run('INSERT INTO assignments(id,school_id,exam_id,class_id,mode,title,open_at,close_at,duration_min,show_result,created_by,created_at,target_json) VALUES (?,?,1,?,\'exam\',?,?,?,60,?,2,?,?)', id, school, classId, `Bài ${id}`, ms(open), ms(close), show, ms(open), target === null ? null : JSON.stringify(target));
  let nextAttempt = 1;
  const attempt = (assignmentId, student, submitted, score, { school = 1, status = 'submitted' } = {}) => db.run("INSERT INTO attempts(id,school_id,assignment_id,student_id,kind,layout_json,started_at,submitted_at,status,score10) VALUES (?,?,?,?,'assignment','[]',?,?,?,?)", nextAttempt++, school, assignmentId, student, ms('2026-10-19'), submitted === null ? null : ms(submitted), status, score);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(() => { db.close(); resolve(); })));
  const call = async (path, { user = 2, method = 'GET', body } = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { cookie: `se_session=token${user}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  return { app, db, call, assignment, attempt, setClock: (s) => { clock = ms(s); } };
}
const period = '/api/reports/period?from=2026-10-19&to=2026-10-25';

test('period uses inclusive Vietnam days, distinct targeted participants and published scored submissions', async (t) => {
  const f = await fixture(t);
  f.assignment(1, '2026-10-19', { target: [11,12] });
  f.assignment(2, '2026-10-25T23:59:59.999+07:00', { target: [11] });
  f.assignment(3, '2026-10-26', { target: [13] });
  f.assignment(4, '2026-10-20', { target: [11], show: 'after_close', close: '2026-10-30' });
  f.assignment(5, '2026-10-20', { target: [12] });
  f.assignment(6, '2026-10-12', { target: [11], close: '2026-10-18' });
  f.attempt(1,11,'2026-10-19T00:00:00+07:00',8);
  f.attempt(1,12,null,10,{status:'in_progress'});
  f.attempt(2,11,'2026-10-25T23:59:59.999+07:00',6);
  f.attempt(3,13,'2026-10-26',0);
  f.attempt(4,11,'2026-10-21',0);
  f.attempt(5,12,'2026-10-26',0);
  f.attempt(6,11,'2026-10-12',4);
  // A corrupted cross-school attempt must never enter a report.
  f.attempt(2,15,'2026-10-20',0,{school:2});
  const r = await f.call(period);
  assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.summary.assignments,4);
  assert.equal(r.data.summary.eligibleStudents,2);
  assert.equal(r.data.summary.participants,1);
  assert.equal(r.data.summary.participation,0.5);
  assert.equal(r.data.summary.submissions,3);
  assert.equal(r.data.summary.scoreSamples,2);
  assert.equal(r.data.summary.averageScore,7);
  assert.equal(r.data.previous.from,'2026-10-12');
  assert.equal(r.data.previous.to,'2026-10-18');
  assert.equal(r.data.previous.summary.averageScore,4);
  assert.equal(r.data.difference.averageScore,3);
});

test('teacher reports cannot include another class or school; admin compares only their school', async (t) => {
  const f = await fixture(t);
  f.assignment(1,'2026-10-19');
  f.assignment(2,'2026-10-19',{classId:2});
  f.assignment(3,'2026-10-19',{classId:3,school:2});
  assert.equal((await f.call(`${period}&classIds=2`)).status,403);
  assert.equal((await f.call(`${period}&classIds=3`,{user:1})).status,403);
  assert.equal((await f.call(period,{user:11})).status,403);
  assert.deepEqual((await f.call(period)).data.classes.map((c) => c.classId),[1]);
  assert.deepEqual((await f.call(period,{user:1})).data.classes.map((c) => c.classId),[1,2]);
  assert.deepEqual((await f.call(period,{user:4})).data.classes.map((c) => c.classId),[3]);
});

test('rejects invalid, reversed, excessive date ranges and malformed class filters', async (t) => {
  const f = await fixture(t);
  for (const query of ['from=2026-02-30&to=2026-03-01','from=2026-10-25&to=2026-10-19','from=2020-01-01&to=2026-10-25','from=2026-10-01','from=bad&to=bad']) {
    assert.equal((await f.call(`/api/reports/period?${query}`)).status,400,query);
  }
  assert.equal((await f.call(`${period}&classIds=1,NaN`)).status,400);
});

test('empty cohorts have no invented scores or participation and earliest valid date still compares prior period', async (t) => {
  const f = await fixture(t);
  f.assignment(1,'2026-10-19',{target:[]});
  f.attempt(1,11,'2026-10-20',10);
  const empty = await f.call(period);
  assert.equal(empty.status,200);
  assert.equal(empty.data.summary.eligibleStudents,0);
  assert.equal(empty.data.summary.participation,null);
  assert.equal(empty.data.summary.averageScore,null);
  assert.equal(empty.data.summary.submissions,0);
  const first = await f.call('/api/reports/period?from=2000-01-01&to=2000-01-01');
  assert.equal(first.status,200,JSON.stringify(first.data));
  assert.equal(first.data.previous.from,'1999-12-31');
});

test('publication is excluded at exact close time and included after close; inactive and untargeted students do not count', async (t) => {
  const f = await fixture(t,'2026-10-25T00:00:00+07:00');
  f.assignment(1,'2026-10-19',{target:[11,12],show:'after_close',close:'2026-10-25'});
  f.assignment(2,'2026-10-19',{target:[11]});
  f.attempt(1,11,'2026-10-20',8);
  f.attempt(1,12,'2026-10-20',0);
  f.attempt(2,13,'2026-10-20',0);
  f.db.run('UPDATE users SET active=0 WHERE id=12');
  let report = (await f.call(period)).data;
  assert.equal(report.summary.eligibleStudents,1);
  assert.equal(report.summary.participants,1);
  assert.equal(report.summary.scoreSamples,0);
  assert.equal(report.summary.averageScore,null);
  f.setClock('2026-10-25T00:00:00.001+07:00');
  report = (await f.call(period)).data;
  assert.equal(report.summary.scoreSamples,1);
  assert.equal(report.summary.averageScore,8);
});

test('saved reports are immutable, owner scoped and real Excel contains summary and class comparison', async (t) => {
  const f = await fixture(t);
  f.assignment(1,'2026-10-19'); f.attempt(1,11,'2026-10-20',8);
  const saved = await f.call('/api/reports/snapshots',{method:'POST',body:{from:'2026-10-19',to:'2026-10-25',classIds:[1]}});
  assert.equal(saved.status,200,JSON.stringify(saved.data));
  f.db.run('UPDATE attempts SET score10 = 1');
  const id = saved.data.id;
  assert.equal((await f.call(`/api/reports/snapshots/${id}`)).data.report.summary.averageScore,8);
  assert.equal((await f.call(`/api/reports/snapshots/${id}`,{user:3})).status,404);
  assert.equal((await f.call(`/api/reports/snapshots/${id}`,{user:4})).status,404);
  const xlsx = await f.call(`/api/reports/snapshots/${id}/export.xlsx`);
  assert.equal(xlsx.status,200);
  const zip = await JSZip.loadAsync(xlsx.data);
  const sheet = await zip.file('xl/worksheets/sheet2.xml').async('string');
  assert.match(sheet,/12A1/); assert.match(sheet,/<v>8<\/v>/);
  // Losing the class invalidates saved access as well.
  f.db.run('UPDATE classes SET teacher_id=3 WHERE id=1');
  assert.equal((await f.call(`/api/reports/snapshots/${id}`)).status,403);
  assert.equal((await f.call('/api/reports/snapshots')).data.snapshots.length,0);
});

test('weekly schedule fires at Monday Vietnam midnight, saves prior week once and can be removed', async (t) => {
  const f = await fixture(t,'2026-10-25T23:59:59.999+07:00');
  f.assignment(1,'2026-10-19'); f.attempt(1,11,'2026-10-20',8);
  const made = await f.call('/api/reports/schedules',{method:'POST',body:{cadence:'weekly',classIds:[1]}});
  assert.equal(made.status,200,JSON.stringify(made.data));
  assert.equal((await f.call('/api/reports/snapshots')).data.snapshots.length,0);
  f.setClock('2026-10-26T00:00:00+07:00');
  const list = (await f.call('/api/reports/snapshots')).data.snapshots;
  assert.equal(list.length,1); assert.equal(list[0].from,'2026-10-19'); assert.equal(list[0].to,'2026-10-25');
  assert.equal((await f.call('/api/reports/snapshots')).data.snapshots.length,1);
  assert.equal((await f.call(`/api/reports/schedules/${made.data.id}`,{method:'DELETE',user:3})).status,404);
  assert.equal((await f.call(`/api/reports/schedules/${made.data.id}`,{method:'DELETE'})).status,200);
  f.setClock('2026-11-03');
  assert.equal((await f.call('/api/reports/snapshots')).data.snapshots.length,1);
});

test('monthly schedule crosses year and leap month, rejects invalid cadence and rechecks class ownership', async (t) => {
  const f = await fixture(t,'2027-12-31T23:59:59+07:00');
  assert.equal((await f.call('/api/reports/schedules',{method:'POST',body:{cadence:'daily'}})).status,400);
  assert.equal((await f.call('/api/reports/schedules',{method:'POST',body:{cadence:'monthly',classIds:[2]}})).status,403);
  assert.equal((await f.call('/api/reports/schedules',{method:'POST',body:{cadence:'monthly',classIds:[1]}})).status,200);
  f.setClock('2028-01-01');
  let list = (await f.call('/api/reports/snapshots')).data.snapshots;
  assert.equal(list.length,1); assert.equal(list[0].from,'2027-12-01'); assert.equal(list[0].to,'2027-12-31');
  f.setClock('2028-03-01');
  list = (await f.call('/api/reports/snapshots')).data.snapshots;
  assert.equal(list.length,3); assert.equal(list[0].to,'2028-02-29');
  f.db.run('UPDATE classes SET teacher_id=3 WHERE id=1');
  f.setClock('2028-04-01');
  assert.equal((await f.call('/api/reports/snapshots')).data.snapshots.length,0);
  assert.equal(f.db.get('SELECT COUNT(*) n FROM report_snapshots').n,3,'no materialization after scope revoked');
});

test('expired exams retain the deadline submission day when finalized after midnight', async (t) => {
  const f = await fixture(t, '2026-10-26T00:01:00+07:00');
  f.assignment(1,'2026-10-25',{target:[11],close:'2026-10-25T23:59:55+07:00'});
  f.attempt(1,11,null,null,{status:'in_progress'});
  const deadline = ms('2026-10-25T23:59:55+07:00');
  f.db.run('UPDATE attempts SET deadline_at=?',deadline);
  const report = await f.call(period);
  assert.equal(report.status,200,JSON.stringify(report.data));
  assert.equal(f.db.get('SELECT submitted_at FROM attempts').submitted_at,deadline);
  assert.equal(report.data.summary.submissions,1);
});

test('an assignment opened last week still contributes when the student submits this week', async (t) => {
  const f = await fixture(t);
  f.assignment(1,'2026-10-18',{target:[11],close:'2026-10-20'});
  f.attempt(1,11,'2026-10-20',8);
  const report=(await f.call(period)).data;
  assert.equal(report.summary.submissions,1);
  assert.equal(report.summary.eligibleStudents,1);
  assert.equal(report.summary.averageScore,8);
});

test('scheduled snapshot waits for the save grace period of exams ending just before midnight', async (t) => {
  const f = await fixture(t,'2026-10-25T23:59:50+07:00');
  f.assignment(1,'2026-10-25',{target:[11],close:'2026-10-25T23:59:55+07:00'});
  f.attempt(1,11,null,null,{status:'in_progress'});
  f.db.run('UPDATE attempts SET deadline_at=?',ms('2026-10-25T23:59:55+07:00'));
  await f.call('/api/reports/schedules',{method:'POST',body:{cadence:'weekly',classIds:[1]}});
  f.setClock('2026-10-26T00:00:00+07:00');
  assert.equal((await f.call('/api/reports/snapshots')).data.snapshots.length,0);
  f.setClock('2026-10-26T00:01:00+07:00');
  const saved=(await f.call('/api/reports/snapshots')).data.snapshots;
  assert.equal(saved.length,1);
  assert.equal(saved[0].summary.submissions,1);
});
