import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDb} from '../server/db.mjs';
import {ImportJobs} from '../server/import-jobs.mjs';

const user={id:7,school_id:1,role:'teacher'};
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('job did not settle');};
test('durable jobs recover, report progress, isolate owners and retry failures',async()=>{
 const db=openDb(':memory:');let calls=0;
 const jobs=new ImportJobs(db,async(job,{onProgress})=>{onProgress({page:1,pages:2});if(++calls===1)throw new Error('thử lỗi');return {questions:[{stem:Buffer.from(job.input).toString()}]};});
 const id=jobs.add(user,'mau.txt',Buffer.from('Câu mẫu'));
 await until(()=>jobs.get(user,id).state==='failed');
 assert.throws(()=>jobs.get({...user,id:8},id),/Không tìm thấy/);
 assert.throws(()=>jobs.get({...user,school_id:2,role:'admin'},id),/Không tìm thấy/);
 jobs.retry(user,id);await until(()=>jobs.get(user,id).state==='completed');
 assert.equal(jobs.get(user,id).result.questions[0].stem,'Câu mẫu');
 assert.equal(jobs.get(user,id).attempts,2);assert.equal(jobs.list(user)[0].progress.page,1);
 await jobs.close();db.close();
});
test('cancelled work cannot publish a result and interrupted work resumes after restart',async()=>{
 const db=openDb(':memory:');let release;
 const jobs=new ImportJobs(db,async()=>new Promise(r=>{release=r;}));
 const id=jobs.add(user,'mau.pdf',Buffer.from('pdf'));
 await until(()=>release);jobs.cancel(user,id);release({questions:[{stem:'not saved'}]});await jobs.close();
 assert.equal(jobs.get(user,id).state,'cancelled');assert.equal(jobs.get(user,id).result,null);
 db.run("UPDATE import_jobs SET state='running' WHERE id=?",id);
 const restored=new ImportJobs(db,async()=>({questions:[{stem:'khôi phục'}]}));
 await until(()=>restored.get(user,id).state==='completed');
 assert.equal(restored.get(user,id).result.questions[0].stem,'khôi phục');
 await restored.close();db.close();
});
