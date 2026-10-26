import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import JSZip from 'jszip';
import {createApp} from '../server/app.mjs';
import {seedSample,SAMPLE_PASSWORD} from '../server/seed.mjs';

let app,server,base,cookie='';
before(async()=>{
  app=createApp();seedSample(app);server=http.createServer(app.handle);
  await new Promise(r=>server.listen(0,r));base=`http://127.0.0.1:${server.address().port}`;
  const res=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'gv.lan',password:SAMPLE_PASSWORD})});
  cookie=res.headers.get('set-cookie').split(';')[0];
});
after(()=>{server.close();app.db.close();});
async function call(method,url,body,raw) {
  const res=await fetch(base+url,{method,headers:{cookie,'content-type':raw?'application/octet-stream':'application/json',...(raw?{'x-smartexam':'1'}:{})},body:raw ?? (body===undefined?undefined:JSON.stringify(body))});
  assert.equal(res.status,200,await res.clone().text());
  return res;
}

test('scan originals, OCR text, edits and fixed option order survive save, versions, exam copy and Word export',async()=>{
  const original=await (await call('POST','/api/import?filename=images.docx',undefined,fs.readFileSync(new URL('./fixtures/de-co-hinh-bang.docx',import.meta.url)))).json();
  const token=original.questions.map(q=>q.stem).join('\n').match(/\[\[img:\d+\]\]/)?.[0];
  assert.ok(token,'source image stored via existing import API');
  const q={type:'mcq',stem:token,ocrText:'Câu 1. Từ khóa OCR riêng để tìm kiếm',options:[...'ABCD'].map(c=>`Phương án ${c} trong ảnh gốc.`),answer:3,topic:'T11.DAOHAM',level:1,explanation:''};
  const saved=await (await call('POST','/api/import/save',{origin:'scan.pdf',questions:[q]})).json();
  const id=saved.ids[0];
  let found=await (await call('GET','/api/questions?q='+encodeURIComponent('Từ khóa OCR riêng'))).json();
  assert.equal(found.questions[0].id,id);assert.equal(found.questions[0].ocrText,q.ocrText);
  await call('PUT',`/api/questions/${id}`,{ocrText:'Chữ OCR đã sửa'});
  found=await (await call('GET','/api/questions?q='+encodeURIComponent('Chữ OCR đã sửa'))).json();
  assert.equal(found.questions[0].id,id);
  await call('POST','/api/questions/approve',{ids:[id]});
  const exam=await (await call('POST','/api/exams',{title:'Scan giữ hình',items:[{qid:id}],variants:8,durationMin:15})).json();
  const row=app.db.get('SELECT * FROM exams WHERE id = ?',exam.id);
  assert.ok(row.variants.every(v=>v.layout[0].perm.join('')==='0123'));
  assert.equal(row.snapshot[id].stem,token);
  assert.equal(row.snapshot[id].ocrText,'Chữ OCR đã sửa');
  const copy=await (await call('POST',`/api/exams/${exam.id}/clone`,{})).json();
  assert.ok(app.db.get('SELECT * FROM exams WHERE id = ?',copy.id).variants.every(v=>v.layout[0].perm.join('')==='0123'));
  const docx=await call('GET',`/api/exams/${exam.id}/docx`);
  const zip=await JSZip.loadAsync(await docx.arrayBuffer());
  assert.ok(Object.keys(zip.files).some(n=>n.startsWith('word/media/')&&!zip.files[n].dir));
  const xml=await zip.file('word/document.xml').async('string');
  assert.match(xml,/drawing/);assert.doesNotMatch(xml,/\[\[img:/);
});
