import {test} from 'node:test';
import assert from 'node:assert/strict';
import {segmentOcrPages, solutionAnswers} from '../server/pdf-ocr-layout.mjs';
import {makeVariant, imageOptions} from '../shared/generate.mjs';

const line = (text, y) => ({text, bbox:{x0:50,y0:y,x1:950,y1:y+20}});
const page = (number, lines) => ({number,width:1000,height:1400,lines});

test('scan segmentation retains page continuations and distinguishes parts and solutions', () => {
  const qs = segmentOcrPages([
    page(1,[line('PHẦN I. Trắc nghiệm',100),line('Câu 1. Chọn số',200),line('A. 1 B. 2 C. 3 D. 4',300),line('PHẦN II.',450),line('Cầu 1. Cho hình',550),line('a) Ý a b) Ý b c) Ý c',650),line('Trang 1/2',1350)]),
    page(2,[line('d) Ý tiếp theo',80),line('PHẦN IIL. Trả lời ngắn',200),line('Câu 1. Tính diện tích',300),line('HẾT',700),line('Trang 2/2',1350)]),
    page(3,[line('ĐÁP ÁN VÀ LỜI GIẢI THAM KHẢO',50),line('Câu 1. Chọn B.',200)]),
  ]);
  assert.deepEqual(qs.map(q=>[q.part,q.num]),[['I',1],['II',1],['III',1]]);
  assert.equal(qs[1].regions.length,2);
  assert.equal(qs[1].regions[1].page,2);
  assert.ok(qs[1].ocrText.includes('Ý tiếp theo'));
  assert.ok(qs[2].regions[0].bottom<700);
});

test('a missing OCR question marker fails rather than silently dropping questions', () => {
  assert.throws(()=>segmentOcrPages([page(1,[line('Câu 1. A',100),line('Câu 3. C',400)])]),/thiếu.*2/i);
  assert.throws(()=>segmentOcrPages([page(1,[line('Không đọc được câu hỏi',100)])]),/không.*câu/i);
});

test('top margin before the next page question is not attached as a blank continuation',()=>{
  const qs=segmentOcrPages([page(1,[line('Câu 1. A',100)]),page(2,[line('Câu 2. B',100)])]);
  assert.equal(qs[0].regions.length,1);
});

test('solution answer extraction maps parts and refuses conflicting conclusions', () => {
  const entries=solutionAnswers('PHẦN I\nCâu 1. Tính toán. Chọn D.\nCâu 2. Chọn A. Chọn B.\nPHẦN II\nCâu 1.\na) Đúng.\nb) Sai.\nc) Sai.\nd) Đúng.\nPHẦN III\nCâu 1. Kết quả.\nĐáp số: 12,5.');
  assert.deepEqual(entries.map(e=>[e.part,e.num,e.value]),[['I',1,3],['II',1,[true,false,false,true]],['III',1,'12,5']]);
});

test('image options retain printed A–D order across variants', () => {
  const q={stem:'[[img:12]]',type:'mcq',options:['A','B','C','D'].map(c=>`Phương án ${c} trong ảnh gốc.`)};
  assert.equal(imageOptions(q),true);
  for(let n=0;n<20;n++) assert.deepEqual(makeVariant([{qid:1,type:'mcq',fixedOptions:imageOptions(q)}],`scan-${n}`)[0].perm,[0,1,2,3]);
});
test('editable OCR still locks A–D while the printed source is included in the question',()=>{
  const q={type:'mcq',sourceStem:'[[img:12]]',stem:'Chữ đã nhận dạng $x^2$\n[[img:12]]',options:['1','2','3','4']};
  assert.equal(imageOptions(q),true);
  assert.equal(imageOptions({...q,stem:'Chữ đã nhận dạng $x^2$ [[img:99]]'}),false);
});
