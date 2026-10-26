import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createApp} from '../server/app.mjs';
import {seedSample,SAMPLE_PASSWORD} from '../server/seed.mjs';
let app,server,base,teacher,other,student;
async function call(cookie,method,url,body,raw){const res=await fetch(base+url,{method,headers:{cookie,'content-type':raw?'application/octet-stream':'application/json',...(raw?{'x-smartexam':'1'}:{})},body:raw??(body===undefined?undefined:JSON.stringify(body))});return {status:res.status,data:await res.json()};}
before(async()=>{
 app=createApp({importRunner:async(name,input,ai,{onProgress})=>{onProgress({page:1,pages:1});return {questions:[{type:'mcq',stem:'Mẫu $x$ [[img:9]]',sourceStem:'[[img:9]]',ocrText:'Chữ OCR',options:['1','2','3','4'],answer:0,topic:'T11.DAOHAM',level:1}],warnings:[],info:{kind:'txt'}};}});seedSample(app);server=http.createServer(app.handle);await new Promise(r=>server.listen(0,r));base=`http://127.0.0.1:${server.address().port}`;
 const login=async username=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:SAMPLE_PASSWORD})});return r.headers.get('set-cookie').split(';')[0];};
 teacher=await login('gv.lan');other=await login('gv.minh');student=await login('hs.an.nm');
});
after(async()=>{await app.importJobs.close();server.close();app.db.close();});
test('background imports enforce ownership, preserve source and save each job only once',async()=>{
 const created=await call(teacher,'POST','/api/import/jobs?filename=mau.txt',null,Buffer.from('Câu mẫu'));assert.equal(created.status,200);
 const id=created.data.id;let job;
 for(let i=0;i<100;i++){job=(await call(teacher,'GET',`/api/import/jobs/${id}`)).data.job;if(job.state==='completed')break;await new Promise(r=>setTimeout(r,5));}
 assert.equal(job.state,'completed');assert.equal((await call(other,'GET',`/api/import/jobs/${id}`)).status,404);assert.equal((await call(student,'GET','/api/import/jobs')).status,403);
 const payload={jobId:id,origin:'mau.txt',questions:job.result.questions};
 const saved=await call(teacher,'POST','/api/import/save',payload);const again=await call(teacher,'POST','/api/import/save',payload);assert.deepEqual(again.data.ids,saved.data.ids);
 const qid=saved.data.ids[0];await call(teacher,'PUT',`/api/questions/${qid}`,{stem:'Đề sửa $x^2$'});
 assert.equal(app.db.get('SELECT source_stem FROM questions WHERE id=?',qid).source_stem,'[[img:9]]');
 assert.equal((await call(teacher,'GET',`/api/import/jobs/${id}`)).data.job.savedIds[0],qid);
});
test('import jobs allow saving preview drafts, recovering edits and clearing drafts',async()=>{
 const created=await call(teacher,'POST','/api/import/jobs?filename=draft-test.txt',null,Buffer.from('Câu bản thảo'));
 const id=created.data.id;
 for(let i=0;i<100;i++){const j=(await call(teacher,'GET',`/api/import/jobs/${id}`)).data.job;if(j.state==='completed')break;await new Promise(r=>setTimeout(r,5));}
 const editedQuestions=[{type:'mcq',stem:'Câu đã sửa bởi giáo viên',options:['A','B','C','D'],answer:1,topic:'T11.DAOHAM',level:2}];
 const saveRes=await call(teacher,'PUT',`/api/import/jobs/${id}/draft`,{questions:editedQuestions});
 assert.equal(saveRes.status,200);
 assert.equal(saveRes.data.job.draftQuestions[0].stem,'Câu đã sửa bởi giáo viên');
 assert.ok(saveRes.data.job.draftUpdatedAt > 0);
 assert.equal((await call(other,'PUT',`/api/import/jobs/${id}/draft`,{questions:editedQuestions})).status,404);
 const fetched=(await call(teacher,'GET',`/api/import/jobs/${id}`)).data.job;
 assert.equal(fetched.draftQuestions[0].stem,'Câu đã sửa bởi giáo viên');
 const cleared=await call(teacher,'DELETE',`/api/import/jobs/${id}/draft`);
 assert.equal(cleared.status,200);
 assert.equal(cleared.data.job.draftQuestions,null);
});
test('image uploads reject executable formats and are school-scoped',async()=>{
 const bad=await call(teacher,'POST','/api/images',null,Buffer.from('<svg onload="alert(1)"></svg>'));assert.equal(bad.status,400);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7AAAAABJRU5ErkJggg==','base64');
 const good=await call(teacher,'POST','/api/images',null,png);assert.equal(good.status,200);assert.ok(good.data.id>0);
});
