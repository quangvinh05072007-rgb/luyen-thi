const error=(status,message)=>Object.assign(new Error(message),{status});
const parseJson=v=>typeof v==='string'?JSON.parse(v):v;
const publicJob=row=>({
  id:row.id,name:row.name,state:row.state,progress:row.progress??row.progress_json??{},error:row.error,
  attempts:row.attempts,createdAt:row.created_at,updatedAt:row.updated_at,
  result:row.result??(row.result_json?parseJson(row.result_json):null),
  savedIds:row.saved_ids??(row.saved_ids_json?parseJson(row.saved_ids_json):null),
  draftQuestions:row.draft??(row.draft_json?parseJson(row.draft_json):null),
  draftUpdatedAt:row.draft_updated_at??null,
});

/** Single local worker with durable inputs/results. No document is sent elsewhere. */
export class ImportJobs {
  constructor(db,runner) {
    this.db=db;this.runner=runner;this.closed=false;this.active=null;
    db.raw.exec(`CREATE TABLE IF NOT EXISTS import_jobs (
      id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,input BLOB NOT NULL,state TEXT NOT NULL DEFAULT 'queued',
      progress_json TEXT NOT NULL DEFAULT '{}',result_json TEXT,saved_ids_json TEXT,meta_json TEXT NOT NULL DEFAULT '{}',error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
      draft_json TEXT,draft_updated_at INTEGER
    );CREATE INDEX IF NOT EXISTS import_job_owner ON import_jobs(school_id,owner_id,created_at);`);
    const cols = db.all('PRAGMA table_info(import_jobs)');
    if(!cols.some(c=>c.name==='meta_json'))db.raw.exec("ALTER TABLE import_jobs ADD COLUMN meta_json TEXT NOT NULL DEFAULT '{}'");
    if(!cols.some(c=>c.name==='draft_json'))db.raw.exec("ALTER TABLE import_jobs ADD COLUMN draft_json TEXT");
    if(!cols.some(c=>c.name==='draft_updated_at'))db.raw.exec("ALTER TABLE import_jobs ADD COLUMN draft_updated_at INTEGER");
    db.run("UPDATE import_jobs SET state='queued',error=NULL WHERE state='running'");
    if(db.get("SELECT id FROM import_jobs WHERE state='queued' LIMIT 1"))this.schedule();
  }
  schedule(){if(!this.closed&&!this.scheduled)this.scheduled=setImmediate(()=>{this.scheduled=null;this.pump();});}
  add(user,name,input,meta={}) {
    if(!input?.length||input.length>25*1024*1024)throw error(400,'Mỗi file cần có dữ liệu và không quá 25 MB.');
    const pending=this.db.get("SELECT COUNT(*) n FROM import_jobs WHERE school_id=? AND owner_id=? AND state IN ('queued','running')",user.school_id,user.id).n;
    if(pending>=10)throw error(429,'Bạn đang có 10 file chờ xử lý. Hãy chờ hoàn tất hoặc hủy bớt.');
    const t=Date.now();const id=Number(this.db.run('INSERT INTO import_jobs(school_id,owner_id,name,input,meta_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',user.school_id,user.id,String(name).slice(0,200),Buffer.from(input),JSON.stringify(meta),t,t).lastInsertRowid);
    this.schedule();return id;
  }
  row(user,id) {
    const row=this.db.get('SELECT * FROM import_jobs WHERE id=? AND school_id=?',Number(id),user.school_id);
    if(!row||(row.owner_id!==user.id&&user.role!=='admin'))throw error(404,'Không tìm thấy tác vụ nhập đề.');
    return row;
  }
  get(user,id){return publicJob(this.row(user,id));}
  list(user){return this.db.all(`SELECT id,name,state,progress_json,saved_ids_json,draft_json,draft_updated_at,error,attempts,created_at,updated_at FROM import_jobs WHERE school_id=? ${user.role==='admin'?'':'AND owner_id=?'} ORDER BY id DESC LIMIT 50`,...[user.school_id,...(user.role==='admin'?[]:[user.id])]).map(publicJob);}
  saveDraft(user,id,questions) {
    const row=this.row(user,id);
    if(!Array.isArray(questions))throw error(400,'Dữ liệu bản nháp phải là danh sách câu hỏi.');
    const t=Date.now();
    this.db.run('UPDATE import_jobs SET draft_json=?, draft_updated_at=?, updated_at=? WHERE id=?', JSON.stringify(questions), t, t, row.id);
    return this.get(user,id);
  }
  clearDraft(user,id) {
    const row=this.row(user,id);
    const t=Date.now();
    this.db.run('UPDATE import_jobs SET draft_json=NULL, draft_updated_at=NULL, updated_at=? WHERE id=?', t, row.id);
    return this.get(user,id);
  }
  cancel(user,id) {
    const row=this.row(user,id);if(!['queued','running'].includes(row.state))throw error(409,'Tác vụ đã kết thúc.');
    this.db.run("UPDATE import_jobs SET state='cancelled',updated_at=? WHERE id=?",Date.now(),row.id);
    if(this.active?.id===row.id)this.active.controller.abort();return this.get(user,id);
  }
  retry(user,id) {
    const row=this.row(user,id);if(!['failed','cancelled'].includes(row.state))throw error(409,'Chỉ thử lại tác vụ lỗi hoặc đã hủy.');
    this.db.run("UPDATE import_jobs SET state='queued',error=NULL,result_json=NULL,progress_json='{}',updated_at=? WHERE id=?",Date.now(),row.id);this.schedule();return this.get(user,id);
  }
  async pump() {
    if(this.closed||this.active)return;
    const row=this.db.get("SELECT * FROM import_jobs WHERE state='queued' ORDER BY id LIMIT 1");if(!row)return;
    const controller=new AbortController();const attempts=row.attempts+1;
    const current=()=>!this.closed&&this.db.get('SELECT state,attempts FROM import_jobs WHERE id=?',row.id);
    this.db.run("UPDATE import_jobs SET state='running',attempts=?,updated_at=? WHERE id=?",attempts,Date.now(),row.id);
    const run=async()=>{
      try {
        const result=await this.runner(row,{signal:controller.signal,onProgress:progress=>{
          const state=current();if(state?.state==='running'&&state.attempts===attempts)this.db.run('UPDATE import_jobs SET progress_json=?,updated_at=? WHERE id=?',JSON.stringify(progress),Date.now(),row.id);
        }});
        const state=current();if(state?.state==='running'&&state.attempts===attempts&&!controller.signal.aborted)this.db.run("UPDATE import_jobs SET state='completed',result_json=?,error=NULL,updated_at=? WHERE id=?",JSON.stringify(result),Date.now(),row.id);
      }catch(e){const state=current();if(state?.state==='running'&&state.attempts===attempts)this.db.run("UPDATE import_jobs SET state='failed',error=?,updated_at=? WHERE id=?",String(e.message??e).slice(0,1500),Date.now(),row.id);}
      finally{this.active=null;this.schedule();}
    };
    // Set the lease before running callbacks; cancellation always sees the owner.
    this.active={id:row.id,controller,promise:null};this.active.promise=run();
  }
  async close(){this.closed=true;if(this.scheduled)clearImmediate(this.scheduled);this.active?.controller.abort();await this.active?.promise;}
}
