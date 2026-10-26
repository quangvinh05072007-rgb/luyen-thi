import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterExamCatalog} from '../shared/exam-catalog.mjs';
const exams=[{id:1,title:'Đề đạo hàm',author:'Cô Lan',mine:true,visibility:'private',dept:'Toán',hot:1,createdAt:30},{id:2,title:'Bài tập hình học',author:'Thầy Minh',mine:false,visibility:'school',dept:'Toán',hot:10,createdAt:20},{id:3,title:'Đề vật lí',author:'Cô Lan',mine:true,visibility:'school',dept:'Vật lí',hot:5,createdAt:10}];
test('catalog scopes do not change totals or mutate the accessible source catalog',()=>{
  assert.deepEqual(filterExamCatalog(exams,{scope:'mine'}).map(e=>e.id),[1,3]);
  assert.deepEqual(filterExamCatalog(exams,{scope:'shared'}).map(e=>e.id),[2,3]);
  assert.deepEqual(filterExamCatalog(exams,{scope:'hot'}).map(e=>e.id),[2,3]);
  assert.deepEqual(exams.map(e=>e.id),[1,2,3]);
});
test('catalog combines Vietnamese search, subject and scope filters',()=>{
  assert.deepEqual(filterExamCatalog(exams,{scope:'mine',search:'dao ham',dept:'Toán'}).map(e=>e.id),[1]);
  assert.deepEqual(filterExamCatalog(exams,{scope:'shared',search:'dao ham'}),[]);
});
