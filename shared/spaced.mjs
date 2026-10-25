// Lịch ôn giãn cách cho sổ lỗi sai — hàm thuần, ngày tính theo giờ Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè).
export const INTERVAL_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 86400000;
const VN_OFFSET_MS = 7 * 3600 * 1000;

/** Ngày lịch Việt Nam 'YYYY-MM-DD' của một thời điểm (ms). */
export function vnDay(ms) {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Cộng/trừ n ngày lịch vào 'YYYY-MM-DD'. */
export function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 0 giờ ngày đó theo giờ Việt Nam, tính bằng ms. */
export function startOfDayMs(day) {
  return Date.parse(`${day}T00:00:00Z`) - VN_OFFSET_MS;
}

export function daysBetween(fromDay, toDay) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS);
}

/**
 * Lập lịch sau một lần làm câu.
 * state: { box, due_day, last_day, lapses } | null (chưa có trong sổ lỗi sai); correct: boolean; nowMs.
 * Trả { state, action }:
 *  - 'add'      câu sai lần đầu → vào sổ, bậc 1 (ôn sau 1 ngày)
 *  - 'reset'    sai khi đã trong sổ → về bậc đầu, lapses + 1
 *  - 'promote'  đúng → lên bậc, hẹn theo bậc mới
 *  - 'graduate' đúng ở bậc cuối → ra khỏi sổ (state = null)
 *  - 'skip'     đã tính một lần trong ngày này → giữ nguyên, không ôn hai lần một câu mỗi ngày
 *  - 'early'    đúng nhưng chưa đến hạn → không lên bậc (tránh lên bậc bằng cách làm lại mỗi ngày)
 *  - 'none'     đúng mà chưa từng nằm trong sổ → không làm gì
 */
export function scheduleReview(state, correct, nowMs) {
  const today = vnDay(nowMs);
  if (state && state.last_day === today) return { state, action: 'skip' };
  if (!correct) {
    return {
      state: { box: 0, due_day: addDays(today, INTERVAL_DAYS[0]), last_day: today, lapses: (state?.lapses ?? 0) + 1 },
      action: state ? 'reset' : 'add',
    };
  }
  if (!state) return { state: null, action: 'none' };
  if (state.due_day > today) return { state, action: 'early' };
  const box = state.box + 1;
  if (box >= INTERVAL_DAYS.length) return { state: null, action: 'graduate' };
  return { state: { box, due_day: addDays(today, INTERVAL_DAYS[box]), last_day: today, lapses: state.lapses ?? 0 }, action: 'promote' };
}

/** Đến hạn ôn hôm nay (kể cả quá hạn)? */
export function isDue(state, nowMs) {
  return !!state && state.due_day <= vnDay(nowMs);
}

/** Số ngày quá hạn (0 nếu chưa quá hạn hoặc mới đến hạn hôm nay). */
export function overdueDays(state, nowMs) {
  if (!state) return 0;
  return Math.max(0, daysBetween(state.due_day, vnDay(nowMs)));
}
