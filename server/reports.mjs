import { buildXlsx } from '../shared/xlsxWrite.mjs';
import { addDays, daysBetween, startOfDayMs, vnDay } from '../shared/spaced.mjs';

const STAFF = ['admin', 'teacher'];
const EXPLANATION = 'Kỳ tính theo ngày Việt Nam, gồm bài giao đã mở có ngày mở, hạn đóng hoặc bài nộp trong kỳ. Bài mở từ kỳ trước vẫn được tính khi học sinh nộp trong kỳ này. Tỷ lệ tham gia = số học sinh có ít nhất một bài nộp trong kỳ / số học sinh đang hoạt động được giao các bài liên quan (không đếm lặp, có xét nhóm đích). Điểm trung bình lấy mỗi bài nộp trong kỳ có điểm và đã công bố làm một mẫu; bài đang làm và kết quả chưa công bố không tính điểm. Danh sách lớp/học sinh theo phân công hiện tại.';
const schema = `
CREATE TABLE IF NOT EXISTS report_schedules (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, owner_id INTEGER NOT NULL,
  cadence TEXT NOT NULL CHECK(cadence IN ('weekly','monthly')), class_ids_json TEXT NOT NULL,
  next_day TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS report_snapshots (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, owner_id INTEGER NOT NULL,
  schedule_id INTEGER, from_day TEXT NOT NULL, to_day TEXT NOT NULL,
  class_ids_json TEXT NOT NULL, report_json TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(schedule_id, from_day, to_day)
);
CREATE INDEX IF NOT EXISTS report_owner ON report_snapshots(school_id, owner_id, created_at);
`;

function monthStart(day) { return `${day.slice(0,7)}-01`; }
function nextMonth(day) {
  const date = new Date(`${monthStart(day)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0,10);
}
function nextBoundary(day, cadence) {
  if (cadence === 'monthly') return nextMonth(day);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, weekday === 0 ? 1 : 8 - weekday);
}
function completedPeriod(boundary, cadence) {
  const to = addDays(boundary,-1);
  return { from: cadence === 'weekly' ? addDays(boundary,-7) : monthStart(to), to };
}

/** Catch up at most 24 periods per schedule per run; the cursor persists across restarts. */
export function materializeDueReports({ db, now, teacherClassIds, buildReport, saveGraceMs = 30000 }) {
  const today = vnDay(now());
  let generated = 0;
  for (const schedule of db.all('SELECT * FROM report_schedules WHERE active=1 AND next_day <= ? ORDER BY id',today)) {
    const owner = db.get('SELECT * FROM users WHERE id=? AND school_id=? AND active=1',schedule.owner_id,schedule.school_id);
    const allowed = owner && STAFF.includes(owner.role) ? teacherClassIds(owner) : [];
    if (!owner || !schedule.class_ids.length || schedule.class_ids.some((id) => !allowed.includes(id))) {
      db.run('UPDATE report_schedules SET active=0 WHERE id=?',schedule.id);
      continue;
    }
    let boundary = schedule.next_day;
    for (let n=0; boundary <= today && n<24; n++) {
      // Don't freeze an immutable report while a previous-day exam can still
      // receive its final autosave inside the network grace window.
      const pending = db.get(`SELECT 1 pending FROM attempts t JOIN assignments a ON a.id=t.assignment_id
        WHERE t.school_id=? AND a.school_id=? AND a.class_id IN (${schedule.class_ids.map(()=>'?').join(',')})
        AND t.status='in_progress' AND t.deadline_at<? AND t.deadline_at>=? LIMIT 1`,
        schedule.school_id,schedule.school_id,...schedule.class_ids,startOfDayMs(boundary),now()-saveGraceMs);
      if(pending) break;
      const {from,to} = completedPeriod(boundary,schedule.cadence);
      const report = buildReport(owner,{from,to,classIds:schedule.class_ids});
      const next = schedule.cadence === 'weekly' ? addDays(boundary,7) : nextMonth(boundary);
      db.tx(() => {
        const inserted = db.run('INSERT OR IGNORE INTO report_snapshots(school_id,owner_id,schedule_id,from_day,to_day,class_ids_json,report_json,created_at) VALUES (?,?,?,?,?,?,?,?)',schedule.school_id,owner.id,schedule.id,from,to,JSON.stringify(schedule.class_ids),JSON.stringify(report),now());
        generated += Number(inserted.changes);
        db.run('UPDATE report_schedules SET next_day=? WHERE id=?',next,schedule.id);
      });
      boundary = next;
    }
  }
  return { generated };
}

/** Register staff-only reports on the existing application router. */
export function registerReports({ route, db, now, fail, audit, teacherClassIds, sweepExpired, saveGraceMs = 30000 }) {
  db.raw.exec(schema);
  function classesFor(user, selection) {
    const allowed = teacherClassIds(user);
    let ids = selection;
    if (typeof ids === 'string') {
      if (!/^\d+(,\d+)*$/.test(ids)) fail(400,'Danh sách lớp không hợp lệ.');
      ids = ids.split(',').map(Number);
    }
    if (ids == null) ids = allowed;
    if (!Array.isArray(ids) || ids.some((id) => !Number.isSafeInteger(id) || id<=0)) fail(400,'Danh sách lớp không hợp lệ.');
    ids = [...new Set(ids)].sort((a,b) => a-b);
    if (ids.some((id) => !allowed.includes(id))) fail(403,'Bạn không phụ trách lớp trong báo cáo này.');
    return ids;
  }
  function dates(from,to) {
    for (const day of [from,to]) {
      if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day<'2000-01-01' || day>'2100-12-31' || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)!==day) fail(400,'Chọn ngày hợp lệ theo dạng năm-tháng-ngày (2000–2100).');
    }
    const length = daysBetween(from,to)+1;
    if (length<=0 || length>366) fail(400,'Khoảng báo cáo phải từ 1 đến 366 ngày.');
    return { from,to,length,start:startOfDayMs(from),end:startOfDayMs(addDays(to,1)) };
  }
  function aggregate(user, ids, range, generatedAt) {
    const classRows = ids.length ? db.all(`SELECT id,name FROM classes WHERE school_id=? AND id IN (${ids.map(()=>'?').join(',')}) ORDER BY id`,user.school_id,...ids) : [];
    const rows = classRows.map((cls) => {
      const students = db.all("SELECT id FROM users WHERE school_id=? AND class_id=? AND role='student' AND active=1",user.school_id,cls.id);
      const roster = new Set(students.map((s)=>s.id));
      const assignments = db.all(`SELECT a.* FROM assignments a WHERE a.school_id=? AND a.class_id=? AND a.open_at<? AND
        (a.open_at>=? OR (a.close_at>=? AND a.close_at<?) OR EXISTS (SELECT 1 FROM attempts t WHERE t.assignment_id=a.id AND t.school_id=a.school_id AND t.status IN ('submitted','auto_submitted') AND t.submitted_at>=? AND t.submitted_at<?))`,user.school_id,cls.id,range.end,range.start,range.start,range.end,range.start,range.end);
      const eligible = new Set(), participants = new Set();
      let submissions = 0, scoreSamples = 0, totalScore = 0;
      for (const assignment of assignments) {
        const targets = new Set(Array.isArray(assignment.target) ? assignment.target.filter((id)=>roster.has(id)) : roster);
        for (const id of targets) eligible.add(id);
        const attempts = db.all("SELECT student_id,submitted_at,score10,status FROM attempts WHERE school_id=? AND assignment_id=? AND kind='assignment' AND status IN ('submitted','auto_submitted') AND submitted_at>=? AND submitted_at<?",user.school_id,assignment.id,range.start,range.end);
        // The DB also enforces one attempt per student/assignment; distinct guards legacy imports.
        const seen = new Set();
        for (const att of attempts) {
          if (!targets.has(att.student_id) || seen.has(att.student_id)) continue;
          seen.add(att.student_id); participants.add(att.student_id); submissions++;
          if ((assignment.show_result==='after_submit' || generatedAt>assignment.close_at) && Number.isFinite(att.score10)) { scoreSamples++; totalScore+=att.score10; }
        }
      }
      return { classId:cls.id,className:cls.name,students:roster.size,assignments:assignments.length,eligibleStudents:eligible.size,participants:participants.size,participation:eligible.size?participants.size/eligible.size:null,submissions,scoreSamples,averageScore:scoreSamples?totalScore/scoreSamples:null };
    });
    const summary = { students:0,assignments:0,eligibleStudents:0,participants:0,submissions:0,scoreSamples:0,participation:null,averageScore:null };
    let sum = 0;
    for (const row of rows) {
      for (const key of ['students','assignments','eligibleStudents','participants','submissions','scoreSamples']) summary[key]+=row[key];
      sum+=(row.averageScore??0)*row.scoreSamples;
    }
    summary.participation=summary.eligibleStudents?summary.participants/summary.eligibleStudents:null;
    summary.averageScore=summary.scoreSamples?sum/summary.scoreSamples:null;
    return { summary,classes:rows };
  }
  function buildReport(user, input) {
    const range = dates(input.from,input.to);
    const ids = classesFor(user,input.classIds);
    // Expired work is finalized by the same code as the teacher class/assignment pages.
    if (ids.length && sweepExpired) sweepExpired(`AND school_id = ? AND assignment_id IN (SELECT id FROM assignments WHERE school_id=? AND class_id IN (${ids.map(()=>'?').join(',')}))`,user.school_id,user.school_id,...ids);
    const generatedAt = now();
    const current = aggregate(user,ids,range,generatedAt);
    // The comparison may precede the earliest selectable date (e.g. Jan 1, 2000).
    const priorFrom=addDays(range.from,-range.length), priorTo=addDays(range.from,-1);
    const priorRange = {from:priorFrom,to:priorTo,start:startOfDayMs(priorFrom),end:range.start};
    const previous = { from:priorRange.from,to:priorRange.to,...aggregate(user,ids,priorRange,generatedAt) };
    const difference = Object.fromEntries(['averageScore','participation','participants','submissions'].map((key) => [key,current.summary[key]===null || previous.summary[key]===null ? null : current.summary[key]-previous.summary[key]]));
    return { from:range.from,to:range.to,classIds:ids,generatedAt,explanation:EXPLANATION,...current,previous,difference };
  }
  const materialize = () => materializeDueReports({db,now,teacherClassIds,buildReport,saveGraceMs});
  function owned(user,table,id) {
    const row = db.get(`SELECT * FROM ${table} WHERE id=? AND school_id=? AND owner_id=?`,String(id),user.school_id,user.id);
    if (!row) fail(404,'Không tìm thấy báo cáo hoặc lịch của bạn.');
    return row;
  }
  function visible(user,row) {
    const allowed = teacherClassIds(user);
    return row.class_ids.every((id)=>allowed.includes(id));
  }
  function savedReport(user,id) {
    const row = owned(user,'report_snapshots',id);
    if (!visible(user,row)) fail(403,'Bạn không còn phụ trách lớp trong báo cáo này.');
    return row;
  }
  async function excel(report) {
    const columns = ['Lớp','Bài giao','HS được giao','HS tham gia','Tỷ lệ tham gia','Bài nộp','Mẫu điểm','Điểm TB'].map((header)=>({header,width:20}));
    const row = (r) => [r.className??'Tổng',r.assignments,r.eligibleStudents,r.participants,r.participation,r.submissions,r.scoreSamples,r.averageScore];
    return { __file: { name:`bao-cao-${report.from}-${report.to}.xlsx`,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',data:await buildXlsx([
      {name:'Tổng quan',rows:[['Từ ngày',report.from],['Đến ngày',report.to],['Múi giờ','Asia/Ho_Chi_Minh'],['Cách tính',report.explanation],['Kỳ trước từ',report.previous.from],['Kỳ trước đến',report.previous.to],['Điểm TB kỳ trước',report.previous.summary.averageScore],['Chênh điểm TB',report.difference.averageScore],['Chênh tỷ lệ tham gia',report.difference.participation]]},
      {name:'So sánh lớp',columns,rows:[row(report.summary),...report.classes.map(row)]},
      {name:'Kỳ trước',columns,rows:[row(report.previous.summary),...report.previous.classes.map(row)]},
    ]) } };
  }
  route('GET','/api/reports/period',STAFF,({user,query})=>buildReport(user,query));
  route('GET','/api/reports/period/export.xlsx',STAFF,async ({user,query,ip})=>{
    const report=buildReport(user,query); audit(user,'report_export',`${report.from}–${report.to}`,ip); return excel(report);
  });
  route('POST','/api/reports/snapshots',STAFF,({user,body,ip})=>{
    const report=buildReport(user,body);
    const id=Number(db.run('INSERT INTO report_snapshots(school_id,owner_id,from_day,to_day,class_ids_json,report_json,created_at) VALUES (?,?,?,?,?,?,?)',user.school_id,user.id,report.from,report.to,JSON.stringify(report.classIds),JSON.stringify(report),now()).lastInsertRowid);
    audit(user,'report_save',`report:${id}`,ip); return {id,report};
  });
  route('GET','/api/reports/snapshots',STAFF,({user})=>{
    materialize();
    return {snapshots:db.all('SELECT * FROM report_snapshots WHERE school_id=? AND owner_id=? ORDER BY to_day DESC,id DESC LIMIT 100',user.school_id,user.id).filter((r)=>visible(user,r)).map((r)=>({id:r.id,from:r.from_day,to:r.to_day,createdAt:r.created_at,scheduleId:r.schedule_id,classIds:r.class_ids,summary:r.report.summary}))};
  });
  route('GET','/api/reports/snapshots/:id',STAFF,({user,params})=>{ const row=savedReport(user,params.id); return {id:row.id,report:row.report}; });
  route('GET','/api/reports/snapshots/:id/export.xlsx',STAFF,async ({user,params,ip})=>{ const row=savedReport(user,params.id); audit(user,'report_export',`report:${row.id}`,ip); return excel(row.report); });
  route('GET','/api/reports/schedules',STAFF,({user})=>{
    materialize();
    return {schedules:db.all('SELECT * FROM report_schedules WHERE school_id=? AND owner_id=? ORDER BY id DESC',user.school_id,user.id).map((s)=>({id:s.id,cadence:s.cadence,classIds:s.class_ids,nextDay:s.next_day,active:!!s.active}))};
  });
  route('POST','/api/reports/schedules',STAFF,({user,body,ip})=>{
    if (!['weekly','monthly'].includes(body.cadence)) fail(400,'Chọn lịch tuần hoặc tháng.');
    const ids=classesFor(user,body.classIds);
    if (!ids.length) fail(400,'Chọn ít nhất một lớp cho lịch báo cáo.');
    const scope=JSON.stringify(ids);
    const existing=db.get('SELECT id FROM report_schedules WHERE school_id=? AND owner_id=? AND cadence=? AND class_ids_json=? AND active=1',user.school_id,user.id,body.cadence,scope);
    if (existing) return {id:existing.id};
    const id=Number(db.run('INSERT INTO report_schedules(school_id,owner_id,cadence,class_ids_json,next_day,created_at) VALUES (?,?,?,?,?,?)',user.school_id,user.id,body.cadence,scope,nextBoundary(vnDay(now()),body.cadence),now()).lastInsertRowid);
    audit(user,'report_schedule',`schedule:${id}`,ip); return {id};
  });
  route('DELETE','/api/reports/schedules/:id',STAFF,({user,params,ip})=>{
    const row=owned(user,'report_schedules',params.id);
    db.run('UPDATE report_schedules SET active=0 WHERE id=?',row.id); audit(user,'report_schedule_stop',`schedule:${row.id}`,ip); return {ok:true};
  });
  materialize();
  return {materializeDueReports:materialize};
}
