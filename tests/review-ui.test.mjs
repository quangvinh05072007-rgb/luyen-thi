import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';

let app, server, base;
before(async () => {
  app = createApp(); seedSample(app);
  server = http.createServer(app.handle);
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); app.db.close(); });
async function client(username) {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: {cookie, 'content-type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, ...await res.json() };
  };
  await call('POST', '/api/login', {username, password: SAMPLE_PASSWORD});
  return call;
}
test('Giao diện nhận đủ metadata chia sẻ, đánh giá cá nhân và chính sách duyệt', async () => {
  const lan = await client('gv.lan'), minh = await client('gv.minh');
  const q = (await lan('GET','/api/questions?status=approved')).questions[0];
  const e = await lan('POST','/api/exams',{ title:'Đề kiểm tra metadata',items:[{qid:q.id}],variants:1,durationMin:15 });
  const detail = (await lan('GET',`/api/exams/${e.id}`)).exam;
  assert.equal(detail.mine, true);
  assert.equal(detail.visibility, 'private');
  await lan('POST',`/api/exams/${e.id}/share`,{visibility:'school',dept:'Tổ Toán'});
  await minh('POST',`/api/exams/${e.id}/rate`,{stars:4});
  const other = (await minh('GET',`/api/exams/${e.id}`)).exam;
  assert.equal(other.mine, false); assert.equal(other.myRating,4); assert.equal(other.ratingAvg,4); assert.equal(other.dept,'Tổ Toán');
  assert.equal((await lan('GET','/api/questions')).reviewPolicy,'single');
});
test('Duyệt hai người bị vô hiệu hóa khi sửa nhãn, khôi phục, sửa hàng loạt và hoàn tác', async () => {
  const admin = await client('quanly'), lan = await client('gv.lan'), minh = await client('gv.minh');
  await admin('PUT','/api/admin/settings',{reviewPolicy:'double'});
  const q = await lan('POST','/api/questions',{ type:'mcq',stem:'Câu duyệt lại',options:['1','2','3','4'],answer:0,topic:'T11.DAOHAM',level:1 });
  const approve = async () => { await lan('POST','/api/questions/approve',{ids:[q.id]}); await minh('POST','/api/questions/approve',{ids:[q.id]}); };
  const row = () => app.db.get('SELECT * FROM questions WHERE id = ?',q.id);
  await approve(); assert.equal(row().status,'approved');
  await lan('PUT',`/api/questions/${q.id}`,{level:2});
  assert.equal(row().status,'draft'); assert.equal(row().approvals,null);
  await approve();
  const bulk = await lan('POST','/api/questions/bulk',{ids:[q.id],action:'set_level',value:3});
  assert.equal(row().status,'draft'); assert.equal(row().approvals,null);
  await lan('POST',`/api/questions/bulk/${bulk.batchId}/undo`,{});
  assert.equal(row().status,'draft');
  await approve();
  await lan('POST',`/api/questions/${q.id}/restore`,{version:1});
  assert.equal(row().status,'draft'); assert.equal(row().approvals,null);
});
