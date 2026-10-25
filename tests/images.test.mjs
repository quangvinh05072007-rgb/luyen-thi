// Giai đoạn 1.1: nhập hình và bảng từ Word, hiển thị qua API, xuất lại ra Word, nhập lại.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { createApp } from '../server/app.mjs';
import { seedSample, SAMPLE_PASSWORD } from '../server/seed.mjs';
import { importFile } from '../server/importers.mjs';
import { readDocx, sniffImage, richBlocks, buildDocx, DocxImages, paragraph } from '../shared/docx.mjs';

const fixture = fs.readFileSync(new URL('./fixtures/de-co-hinh-bang.docx', import.meta.url));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

let server;
let url;
let app;
before(async () => {
  app = createApp({ dbFile: ':memory:', aiImpl: { enabled: false } });
  seedSample(app);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function client() {
  let cookie = '';
  const call = async (method, p, body, raw) => {
    const headers = cookie ? { cookie } : {};
    let payload;
    if (raw) {
      headers['x-smartexam'] = '1';
      headers['content-type'] = 'application/octet-stream';
      payload = raw;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(url + p, { method, headers, body: payload });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const type = res.headers.get('content-type') ?? '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, type, headers: res.headers };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b = {}) => call('PUT', p, b),
    raw: (p, buf) => call('POST', p, undefined, buf),
    async login(u) {
      const r = await call('POST', '/api/login', { username: u, password: SAMPLE_PASSWORD });
      assert.equal(r.status, 200);
    },
  };
}

test('Nhận dạng hình theo nội dung, không theo đuôi file; EMF/SVG bị loại', () => {
  assert.equal(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/png');
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImage(Buffer.from('GIF89a....')), 'image/gif');
  assert.equal(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImage(Buffer.from([1, 0, 0, 0, 0x6c, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x45, 0x4d, 0x46])), null);
});

test('Đọc Word thật có hình, bảng biến thiên, hình vẽ khối: hình PNG nguyên vẹn, bảng thành dòng |…|, bảng đáp án giữ cách cũ', async () => {
  const r = await readDocx(fixture);
  assert.equal(r.images.length, 1);
  assert.equal(r.images[0].mime, 'image/png');
  assert.deepEqual([...r.images[0].data.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.match(r.text, /\[\[img:img1\]\]/);
  assert.match(r.text, /\| x \| -∞ \| 1 \| \+∞ \|\n\| y' \| \+ \| 0 \| - \|/);
  assert.match(r.text, /Câu \| 1 \| 2 \| 3\nĐáp án \| A \| B \| C/);
  assert.equal(r.stats.unreadableImages, 1, 'hình vẽ khối của Word chưa đọc được → báo rõ');
  const q = await importFile('de.docx', fixture, null);
  assert.equal(q.questions.length, 3);
  assert.deepEqual(q.questions.map((x) => x.answer), [0, 1, 2], 'bảng đáp án cuối đề vẫn đọc được');
  assert.ok(q.warnings.some((w) => /Đã nhập 1 hình/.test(w)));
  assert.ok(q.warnings.some((w) => /chưa nhập được/.test(w)));
});

let teacher;
let imgId;
let examId;
let qids;
test('API: nhập file → hình lưu vào CSDL trường, câu hỏi trỏ đúng mã hình; nhập lại cùng file dùng lại hình', async () => {
  teacher = client();
  await teacher.login('gv.lan');
  const r = await teacher.raw('/api/import?filename=de.docx', fixture);
  assert.equal(r.status, 200);
  assert.equal(r.data.images, undefined, 'không gửi dữ liệu hình về trình duyệt');
  const stem = r.data.questions[0].stem;
  const m = stem.match(/\[\[img:(\d+)\]\]/);
  assert.ok(m, stem);
  imgId = Number(m[1]);
  assert.equal(app.db.get('SELECT COUNT(*) n FROM images').n, 1);
  const again = await teacher.raw('/api/import?filename=de.docx', fixture);
  assert.equal(again.data.questions[0].stem.match(/\[\[img:(\d+)\]\]/)[1], String(imgId), 'cùng nội dung → cùng một hình');
  assert.equal(app.db.get('SELECT COUNT(*) n FROM images').n, 1);

  const qs = r.data.questions.map((q, i) => ({ ...q, topic: 'T11.DAOHAM', level: 1, answer: i }));
  const saved = await teacher.post('/api/import/save', { questions: qs, origin: 'de.docx' });
  qids = saved.data.ids;
  assert.equal((await teacher.post('/api/questions/approve', { ids: qids })).data.approved.length, 3);
  const exam = await teacher.post('/api/exams', { title: 'Có hình', items: qids.map((qid) => ({ qid })), durationMin: 30, variants: 2, seed: 'h' });
  examId = exam.data.id;
  assert.ok(examId);
});

test('API hình: cùng trường xem được (kể cả học sinh), đúng loại nội dung, không tải xuống, trường khác và người chưa đăng nhập bị chặn', async () => {
  const res = await teacher.get(`/api/images/${imgId}`);
  assert.equal(res.status, 200);
  assert.equal(res.type, 'image/png');
  assert.equal(res.headers.get('content-disposition'), 'inline');
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(sha(res.data), sha(Buffer.from(app.db.get('SELECT data FROM images WHERE id = ?', imgId).data)));
  const stu = client();
  await stu.login('hs.an.nm');
  assert.equal((await stu.get(`/api/images/${imgId}`)).status, 200);
  const other = client();
  await other.login('gv.khac');
  assert.equal((await other.get(`/api/images/${imgId}`)).status, 404);
  assert.equal((await client().get(`/api/images/${imgId}`)).status, 401);
  assert.equal((await teacher.get('/api/images/99999')).status, 404);
});

test('Xuất Word: hình và bảng nằm trong file, mở được, và nhập lại ra đúng hình và bảng', async () => {
  const res = await teacher.get(`/api/exams/${examId}/docx`);
  assert.equal(res.status, 200);
  const zip = await JSZip.loadAsync(res.data);
  const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/') && !zip.files[f].dir);
  assert.equal(media.length, 1, 'hình dùng ở nhiều mã đề chỉ nhúng một lần');
  const orig = Buffer.from(app.db.get('SELECT data FROM images WHERE id = ?', imgId).data);
  assert.equal(sha(Buffer.from(await zip.file(media[0]).async('uint8array'))), sha(orig));
  const doc = await zip.file('word/document.xml').async('string');
  assert.equal((doc.match(/<w:drawing>/g) ?? []).length, 2, 'một hình × 2 mã đề');
  assert.match(doc, /<w:tbl>/);
  assert.match(await zip.file('[Content_Types].xml').async('string'), /Extension="png"/);
  assert.match(await zip.file('word/_rels/document.xml.rels').async('string'), /rIdImg1/);

  // nhập lại chính file vừa xuất
  const back = await readDocx(res.data);
  assert.equal(back.images.length, 1);
  assert.equal(sha(Buffer.from(back.images[0].data)), sha(orig));
  assert.match(back.text, /\| x \| -∞ \| 1 \| \+∞ \|/);
  assert.match(back.text, /\| y\s*' \| \+ \| 0 \| - \|/);
  assert.match(back.text, /Câu \d\. Đồ thị hàm số/);
  fs.mkdirSync(new URL('../tmp-out/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('../tmp-out/xuat-co-hinh.docx', import.meta.url), res.data);
});

test('Hình bị xóa khỏi CSDL → Word ghi [hình] thay vì lỗi; hình quá lớn bị bỏ qua khi nhập', async () => {
  const images = new DocxImages(() => null);
  const xml = paragraph('Xem [[img:42]] nhé', { images });
  assert.match(xml, /\[hình\]/);
  const blocks = richBlocks('Dòng 1\n| a | b |\n| 1 | 2 |\nDòng 2', { prefix: [{ text: 'Câu 1. ', bold: true }] });
  assert.equal(blocks.length, 4, 'đoạn, bảng, đoạn đệm, đoạn');
  assert.match(blocks[1], /<w:tbl>/);
  const docxBuf = await buildDocx(blocks);
  assert.ok(docxBuf.length > 500);

  const zip = await JSZip.loadAsync(fixture);
  const media = Object.keys(zip.files).find((f) => f.startsWith('word/media/') && !zip.files[f].dir);
  zip.file(media, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.alloc(6 * 1024 * 1024)]));
  const big = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const r = await readDocx(big);
  assert.equal(r.images.length, 0);
  assert.equal(r.stats.skippedImages, 1);
  assert.doesNotMatch(r.text, /\[\[img:/);
});
