// Nâng cấp 4: dữ liệu trang Tiến bộ — hàm thuần và API chỉ trả dữ liệu của chính học sinh.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { topicAccuracy, fourWeekTrend, studyStreak, weeklyGoal, buildProgress, MIN_EVIDENCE } from '../shared/progress.mjs';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

const at = (iso) => Date.parse(iso);
const NOW = at('2026-10-25T12:00:00+07:00'); // Chủ nhật
const DAY = 86400000;
const ev = (daysAgo, score, topic = 'T12.XSDK', level = 2) => ({ topic, level, score, at: NOW - daysAgo * DAY });

test('Năng lực chuyên đề: bằng chứng gần đây nặng hơn bằng chứng cũ; mức khó nặng hơn', () => {
  const recentRight = [...[60, 60, 60].map((d) => ev(d, 0)), ev(0, 1), ev(0, 1)];
  const recentWrong = [...[60, 60, 60].map((d) => ev(d, 1)), ev(0, 0), ev(0, 0)];
  const a = topicAccuracy(recentRight, NOW)[0];
  const b = topicAccuracy(recentWrong, NOW)[0];
  assert.equal(a.value, 0.727); // (2 điểm gần đây) / (2 + 3 × 0,25)
  assert.equal(b.value, 0.273);
  assert.ok(a.value > 0.4, 'cao hơn trung bình thường (2/5)');
  // mức 3 nặng 2, mức 2 nặng 1,5, mức 1 nặng 1: (2 + 1,5) / (2 + 1 + 1,5 × 3) = 0,467
  const hard = topicAccuracy([ev(0, 1, 'T12.XSDK', 3), ev(0, 0, 'T12.XSDK', 1), ev(0, 1, 'T12.XSDK', 2), ev(0, 0, 'T12.XSDK', 2), ev(0, 0, 'T12.XSDK', 2)], NOW)[0];
  assert.equal(hard.n, 5);
  assert.equal(hard.value, 0.467);
});

test('Dưới 5 câu: cờ chưa đủ dữ liệu, không có giá trị hay nhận xét; đủ 5 thì có; bằng chứng quá 90 ngày bị bỏ', () => {
  assert.equal(MIN_EVIDENCE, 5);
  const four = topicAccuracy([ev(0, 1), ev(1, 1), ev(2, 0), ev(3, 1)], NOW)[0];
  assert.equal(four.insufficientData, true);
  assert.equal(four.value, null);
  assert.equal(four.band, null);
  assert.equal(four.n, 4);
  const five = topicAccuracy([ev(0, 1), ev(1, 1), ev(2, 0), ev(3, 1), ev(4, 1)], NOW)[0];
  assert.equal(five.insufficientData, false);
  assert.ok(five.value > 0.75 && five.band === 'strong');
  assert.deepEqual(topicAccuracy([ev(100, 1), ev(120, 0)], NOW), []);
  // chuyên đề đủ dữ liệu xếp trước chuyên đề chưa đủ; yếu nhất trước
  const mix = topicAccuracy([...Array(5).fill(0).map((_, i) => ev(i, 0, 'T12.XSDK')), ...Array(5).fill(0).map((_, i) => ev(i, 1, 'T12.TICHPHAN')), ev(0, 1, 'T12.NGUYENHAM')], NOW);
  assert.deepEqual(mix.map((t) => t.topic), ['T12.XSDK', 'T12.TICHPHAN', 'T12.NGUYENHAM']);
});

const act = (day, questions, correct) => ({ day, questions, correct });

test('Xu hướng 4 tuần: ranh giới cửa sổ, hướng lên/xuống/phẳng, thiếu dữ liệu thì không kết luận', () => {
  const up = fourWeekTrend([act('2026-09-28', 10, 5), act('2026-10-05', 10, 5), act('2026-10-12', 10, 8), act('2026-10-19', 10, 9)], NOW);
  assert.deepEqual(up.weeks.map((w) => [w.from, w.to]), [['2026-09-28', '2026-10-04'], ['2026-10-05', '2026-10-11'], ['2026-10-12', '2026-10-18'], ['2026-10-19', '2026-10-25']]);
  assert.deepEqual(up.weeks.map((w) => w.accuracy), [0.5, 0.5, 0.8, 0.9]);
  assert.equal(up.direction, 'up');
  assert.equal(up.delta, 0.35);
  assert.equal(up.insufficientData, false);
  // 18/10 thuộc tuần 3, 19/10 thuộc tuần 4
  const edge = fourWeekTrend([act('2026-10-18', 6, 6), act('2026-10-19', 7, 0)], NOW);
  assert.equal(edge.weeks[2].questions, 6);
  assert.equal(edge.weeks[3].questions, 7);
  assert.equal(fourWeekTrend([act('2026-09-28', 10, 9), act('2026-10-19', 10, 4)], NOW).direction, 'down');
  assert.equal(fourWeekTrend([act('2026-09-28', 10, 7), act('2026-10-19', 10, 7)], NOW).direction, 'flat');
  const few = fourWeekTrend([act('2026-10-20', 3, 3)], NOW);
  assert.equal(few.insufficientData, true);
  assert.equal(few.direction, null);
  assert.equal(few.delta, null);
  assert.ok(few.weeks.every((w) => w.insufficientData));
  assert.equal(fourWeekTrend([act('2026-09-01', 50, 50)], NOW).weeks.reduce((s, w) => s + w.questions, 0), 0, 'ngoài 28 ngày không tính');
});

test('Chuỗi ngày học: còn sống nếu hôm qua có học; đứt thì về 0; chuỗi dài nhất', () => {
  const days = ['2026-10-23', '2026-10-24', '2026-10-25'].map((d) => act(d, 4, 2));
  assert.deepEqual(studyStreak(days, NOW), { current: 3, longest: 3, activeToday: true });
  assert.deepEqual(studyStreak(days.slice(0, 2), NOW), { current: 2, longest: 2, activeToday: false });
  assert.deepEqual(studyStreak([act('2026-10-22', 4, 2)], NOW), { current: 0, longest: 1, activeToday: false });
  assert.equal(studyStreak([act('2026-10-01', 4, 2), act('2026-10-02', 4, 2), act('2026-10-03', 4, 2), act('2026-10-10', 1, 1), act('2026-10-25', 1, 0)], NOW).longest, 3);
  assert.equal(studyStreak([act('2026-10-25', 0, 0)], NOW).current, 0, 'ngày 0 câu không tính');
  // 00:30 sáng thứ Hai giờ VN = 17:30 UTC Chủ nhật: học tối Chủ nhật vẫn là "hôm qua"
  const monday = at('2026-10-25T17:30:00Z');
  assert.deepEqual(studyStreak([act('2026-10-25', 5, 5)], monday), { current: 1, longest: 1, activeToday: false });
});

test('Mục tiêu tuần: tuần bắt đầu thứ Hai giờ Việt Nam, 5 ngày × mục tiêu ngày', () => {
  const g = weeklyGoal([act('2026-10-18', 20, 10), act('2026-10-19', 10, 5), act('2026-10-25', 15, 9)], NOW, 10);
  assert.equal(g.weekStart, '2026-10-19');
  assert.equal(g.weekEnd, '2026-10-25');
  assert.equal(g.target, 50);
  assert.equal(g.done, 25, 'Chủ nhật 18/10 thuộc tuần trước');
  assert.equal(g.remaining, 25);
  assert.equal(g.activeDays, 2);
  assert.equal(g.met, false);
  assert.equal(weeklyGoal([act('2026-10-20', 50, 40)], NOW, 10).met, true);
  const monday = at('2026-10-25T17:30:00Z'); // 00:30 thứ Hai 26/10 giờ VN
  const m = weeklyGoal([act('2026-10-25', 30, 20)], monday, 10);
  assert.equal(m.weekStart, '2026-10-26');
  assert.equal(m.done, 0);
});

test('Không có dữ liệu: mọi phần đều báo chưa đủ dữ liệu, không lỗi', () => {
  const p = buildProgress({ evidence: [], activity: [], reviewDue: 0, nowMs: NOW, dayGoal: 10 });
  assert.equal(p.insufficientData, true);
  assert.deepEqual(p.topics, []);
  assert.equal(p.trend.insufficientData, true);
  assert.equal(p.streak.current, 0);
  assert.equal(p.weeklyGoal.done, 0);
  assert.equal(p.reviewDue, 0);
});

// ---------------- API ----------------
const clock = at('2026-10-19T08:00:00+07:00');
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
    return { status: res.status, data: await res.json() };
  };
  return {
    get: (p) => call('GET', p),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
      return r.data.user;
    },
  };
}

test('API: chỉ trả dữ liệu của chính học sinh; giáo viên và đường dẫn có mã học sinh không dùng được', async () => {
  const [a, b] = app.db.all("SELECT id, username FROM users WHERE role = 'student' AND class_id IS NOT NULL ORDER BY (SELECT COUNT(*) FROM evidence e WHERE e.student_id = users.id) DESC, id LIMIT 2");
  const ca = client();
  const cb = client();
  await ca.login(a.username);
  await cb.login(b.username);
  const pa = (await ca.get('/api/student/progress')).data;
  const pb = (await cb.get('/api/student/progress')).data;
  const expectN = (sid) => app.db.get('SELECT COUNT(*) n FROM evidence WHERE student_id = ? AND topic IS NOT NULL AND at > ?', sid, clock - 90 * DAY).n;
  assert.equal(pa.totalAnswered, expectN(a.id));
  assert.equal(pb.totalAnswered, expectN(b.id));
  assert.ok(pa.totalAnswered > 0 && pa.topics.some((t) => !t.insufficientData && t.value !== null), 'học sinh mẫu có dữ liệu đủ');
  assert.notDeepEqual(pa.topics, pb.topics);
  assert.equal(pa.today, '2026-10-19');
  assert.equal(pa.weeklyGoal.weekStart, '2026-10-19');
  assert.equal(pa.weeklyGoal.target, 50);
  assert.equal(pa.trend.weeks.length, 4);
  const due = app.db.get('SELECT COUNT(*) n FROM review_items WHERE student_id = ? AND due_day <= ?', a.id, '2026-10-19').n;
  assert.equal(pa.reviewDue, due);
  // không có đường nào lấy dữ liệu em khác
  assert.equal((await ca.get(`/api/student/progress?studentId=${b.id}`)).data.totalAnswered, pa.totalAnswered);
  assert.equal((await ca.get(`/api/student/${b.id}/progress`)).status, 404);
  const t = client();
  await t.login('gv.lan');
  assert.equal((await t.get('/api/student/progress')).status, 403);
});

test('API: học sinh mới dưới 5 câu → cờ chưa đủ dữ liệu, không có giá trị năng lực hay xu hướng', async () => {
  const s = app.db.get("SELECT id, username, school_id FROM users WHERE role = 'student' AND class_id IS NOT NULL ORDER BY id DESC LIMIT 1");
  app.db.run('DELETE FROM evidence WHERE student_id = ?', s.id);
  app.db.run('DELETE FROM activity WHERE student_id = ?', s.id);
  for (let i = 0; i < 3; i++) {
    app.db.run('INSERT INTO evidence (school_id, student_id, qid, topic, level, score, correct, at) VALUES (?,?,?,?,?,?,?,?)', s.school_id, s.id, i + 1, 'T12.XSDK', 2, i === 0 ? 0 : 1, i === 0 ? 0 : 1, clock - i * 1000);
  }
  app.db.run('INSERT INTO activity (student_id, day, questions, correct) VALUES (?,?,?,?)', s.id, '2026-10-19', 3, 2);
  const c = client();
  await c.login(s.username);
  const p = (await c.get('/api/student/progress')).data;
  assert.equal(p.insufficientData, true);
  assert.equal(p.totalAnswered, 3);
  assert.equal(p.topics.length, 1);
  assert.equal(p.topics[0].insufficientData, true);
  assert.equal(p.topics[0].value, null);
  assert.equal(p.topics[0].band, null);
  assert.equal(p.trend.insufficientData, true);
  assert.equal(p.trend.direction, null);
  assert.equal(p.streak.current, 1);
  assert.equal(p.weeklyGoal.done, 3);
  assert.equal(p.weeklyGoal.met, false);
});
