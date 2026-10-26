// Manual real-document regression; uses a separate DB and never edits the live school.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.mjs';
import {seedSample} from '../server/seed.mjs';
const file=process.argv[2];if(!file)throw new Error('Usage: node tools/verify-import.mjs /path/to/exam.pdf');
const dir=fs.mkdtempSync(path.resolve('tmp-out/import-regression-'));
const dbFile=path.join(dir,'check.db');let app=createApp({dbFile});seedSample(app);
const user=app.db.get("SELECT * FROM users WHERE username='gv.lan'");
const started=Date.now(),id=app.importJobs.add(user,path.basename(file),fs.readFileSync(file));
let last='';
try {
 for(;;){
  const job=app.importJobs.get(user,id),state=JSON.stringify([job.state,job.progress]);
  if(state!==last){console.log(state);last=state;}
  if(job.state==='failed')throw new Error(job.error);
  if(job.state==='completed'){
   assert.ok(job.result.questions.length);
   const counts=Object.fromEntries(['mcq','tf','short'].map(t=>[t,job.result.questions.filter(q=>q.type===t).length]));
   const count=job.result.questions.length;
   assert.ok(job.result.questions.every(q=>!q.ocrText||q.sourceStem?.includes('[[img:')));
   await app.importJobs.close();app.db.close();app=createApp({dbFile});
   assert.equal(app.importJobs.get(user,id).result.questions.length,count);
   console.log(JSON.stringify({questions:count,counts,seconds:Math.round((Date.now()-started)/1000),reopened:true}));break;
  }
  if(Date.now()-started>360000)throw new Error('Import exceeded 6 minutes.');
  await new Promise(r=>setTimeout(r,300));
 }
}finally{await app.importJobs.close();app.db.close();}
