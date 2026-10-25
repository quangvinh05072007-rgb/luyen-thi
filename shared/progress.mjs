// Dữ liệu trang Tiến bộ của học sinh — hàm thuần (nhận dữ liệu và thời điểm, không đọc đồng hồ/CSDL).
import { TOPIC_BY_CODE } from './topics.mjs';
import { vnDay, addDays, daysBetween } from './spaced.mjs';

export const MIN_EVIDENCE = 5; // dưới số câu này: chưa đủ dữ liệu, không đưa ra kết luận
export const HALF_LIFE_DAYS = 30;
export const LOOKBACK_DAYS = 90;
export const WEEK_GOAL_DAYS = 5; // mục tiêu tuần = 5 ngày × mục tiêu ngày
const DAY_MS = 86400000;

const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

/**
 * Năng lực theo chuyên đề: tỉ lệ đúng gần đây có trọng số theo thời gian (bán rã 30 ngày) và theo mức độ.
 * evidence: [{topic, level, score (0..1), at}]. Không dùng tiên nghiệm: ít dữ liệu thì không kết luận.
 */
export function topicAccuracy(evidence, nowMs) {
  const acc = {};
  for (const e of evidence) {
    if (!e.topic || nowMs - e.at > LOOKBACK_DAYS * DAY_MS || e.at > nowMs) continue;
    const w = (1 + 0.5 * (Number(e.level) - 1)) * Math.pow(0.5, (nowMs - e.at) / (HALF_LIFE_DAYS * DAY_MS));
    const a = (acc[e.topic] ??= { w: 0, s: 0, n: 0, last: 0 });
    a.w += w;
    a.s += w * e.score;
    a.n++;
    a.last = Math.max(a.last, e.at);
  }
  return Object.entries(acc)
    .map(([topic, a]) => {
      const enough = a.n >= MIN_EVIDENCE;
      const value = enough ? round(a.s / a.w) : null;
      return {
        topic,
        name: TOPIC_BY_CODE[topic]?.name ?? topic,
        n: a.n,
        insufficientData: !enough,
        value,
        band: value === null ? null : value < 0.5 ? 'weak' : value < 0.75 ? 'ok' : 'strong',
        last: a.last,
      };
    })
    .sort((x, y) => (x.value === null) - (y.value === null) || (x.value ?? 0) - (y.value ?? 0) || x.topic.localeCompare(y.topic));
}

/** 4 cửa sổ 7 ngày liền nhau tính đến hôm nay (cũ → mới) và hướng thay đổi nếu đủ dữ liệu. */
export function fourWeekTrend(activity, nowMs) {
  const today = vnDay(nowMs);
  const weeks = [0, 1, 2, 3].map((i) => {
    const to = addDays(today, -7 * (3 - i));
    const from = addDays(to, -6);
    const days = activity.filter((d) => d.day >= from && d.day <= to);
    const questions = days.reduce((s, d) => s + d.questions, 0);
    const correct = days.reduce((s, d) => s + d.correct, 0);
    const enough = questions >= MIN_EVIDENCE;
    return { from, to, questions, correct, accuracy: enough ? round(correct / questions) : null, insufficientData: !enough };
  });
  const half = (ws) => {
    const q = ws.reduce((s, w) => s + w.questions, 0);
    return q >= MIN_EVIDENCE ? ws.reduce((s, w) => s + w.correct, 0) / q : null;
  };
  const first = half(weeks.slice(0, 2));
  const last = half(weeks.slice(2));
  const insufficientData = first === null || last === null;
  const delta = insufficientData ? null : round(last - first);
  const direction = insufficientData ? null : delta >= 0.05 ? 'up' : delta <= -0.05 ? 'down' : 'flat';
  return { weeks, insufficientData, delta, direction };
}

/** Chuỗi ngày học: số ngày liên tiếp có làm câu, tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa học). */
export function studyStreak(activity, nowMs) {
  const active = new Set(activity.filter((d) => d.questions > 0).map((d) => d.day));
  const today = vnDay(nowMs);
  let cursor = active.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && daysBetween(sorted[i - 1], d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return { current, longest, activeToday: active.has(today) };
}

/** Mục tiêu tuần (thứ Hai → Chủ nhật, giờ Việt Nam): số câu đã làm so với 5 ngày × mục tiêu ngày. */
export function weeklyGoal(activity, nowMs, dayGoal) {
  const today = vnDay(nowMs);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Chủ nhật
  const weekStart = addDays(today, -((dow + 6) % 7));
  const days = activity.filter((d) => d.day >= weekStart && d.day <= today);
  const done = days.reduce((s, d) => s + d.questions, 0);
  const target = dayGoal * WEEK_GOAL_DAYS;
  return { weekStart, weekEnd: addDays(weekStart, 6), target, done, remaining: Math.max(0, target - done), activeDays: days.filter((d) => d.questions > 0).length, met: done >= target };
}

/** Gộp thành dữ liệu trang Tiến bộ. */
export function buildProgress({ evidence, activity, reviewDue, nowMs, dayGoal }) {
  const topics = topicAccuracy(evidence, nowMs);
  const total = topics.reduce((s, t) => s + t.n, 0);
  return {
    today: vnDay(nowMs),
    topics,
    totalAnswered: total,
    insufficientData: total < MIN_EVIDENCE,
    minEvidence: MIN_EVIDENCE,
    trend: fourWeekTrend(activity, nowMs),
    streak: studyStreak(activity, nowMs),
    reviewDue,
    weeklyGoal: weeklyGoal(activity, nowMs, dayGoal),
  };
}
