import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markerResult} from '../server/math-ocr.mjs';
test('advanced OCR keeps a source reference and never treats inferred answers as reviewed',()=>{
 const result=markerResult([{text:'Câu 2. Đạo hàm của $x^2$ là\nA. $2x$\nB. $x$\nC. 2\nD. 0\nĐáp án: A'}],'mcq','[[img:12]]');
 assert.equal(result.questions.length,1);assert.match(result.questions[0].stem,/\$x\^2\$/);
 assert.equal(result.questions[0].sourceStem,'[[img:12]]');assert.equal(result.questions[0].answer,null);
 assert.equal(result.info.mathOcr,true);assert.ok(result.warnings.some(w=>w.includes('bỏ sót hình')));
});
