import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createApp} from '../server/app.mjs';
import {seedSample,SAMPLE_PASSWORD} from '../server/seed.mjs';
let app,server,base;
before(async()=>{app=createApp();seedSample(app);server=http.createServer(app.handle);await new Promise(r=>server.listen(0,r));base=`http://127.0.0.1:${server.address().port}`;});
after(()=>{server.close();app.db.close();});
function client(){let cookie='';return async(method,path,body)=>{const res=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const sc=res.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return {status:res.status,data:await res.json(),cookie:sc};};}
test('a correct password with the wrong chosen role never creates a session',async()=>{
  const call=client();
  const wrong=await call('POST','/api/login',{username:'gv.lan',password:SAMPLE_PASSWORD,role:'student'});
  assert.equal(wrong.status,403);assert.equal(wrong.cookie,null);
  assert.equal((await call('GET','/api/me')).status,401);
  assert.equal((await call('POST','/api/login',{username:'gv.lan',password:SAMPLE_PASSWORD,role:'teacher'})).status,200);
  const student=client();assert.equal((await student('POST','/api/login',{username:'hs.an.nm',password:SAMPLE_PASSWORD,role:'teacher'})).status,403);
});
test('class assignments and appeals are filtered on the server and reject unassigned classes',async()=>{
  const call=client();await call('POST','/api/login',{username:'quanly',password:SAMPLE_PASSWORD});
  const classes=(await call('GET','/api/classes')).data.classes;assert.ok(classes.length>=2);
  const cid=classes[0].id;
  const assignments=await call('GET',`/api/assignments?classId=${cid}`);
  assert.equal(assignments.status,200);assert.ok(assignments.data.assignments.every(a=>a.class_id===cid));
  const done=assignments.data.assignments.find(a=>a.submitted>0);
  assert.ok(done);
  const report=(await call('GET',`/api/assignments/${done.id}/report`)).data;
  assert.equal(report.assignment.classId,cid);
  const attemptId=report.rows.find(row=>row.attemptId)?.attemptId;assert.ok(attemptId);
  const attempt=(await call('GET',`/api/teacher/attempts/${attemptId}`)).data;
  assert.equal(attempt.classId,cid);assert.equal(attempt.assignmentId,done.id);
  const appeals=await call('GET',`/api/appeals?classId=${cid}`);assert.equal(appeals.status,200);
  const teacher=client();await teacher('POST','/api/login',{username:'gv.lan',password:SAMPLE_PASSWORD});
  const own=(await teacher('GET','/api/classes')).data.classes.map(c=>c.id);
  const other=classes.find(c=>!own.includes(c.id));assert.ok(other);
  for(const path of ['/api/assignments','/api/appeals']){
    assert.equal((await teacher('GET',`${path}?classId=${other.id}`)).status,403);
    assert.equal((await teacher('GET',`${path}?classId=bogus`)).status,400);
  }
});
