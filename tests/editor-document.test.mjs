import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textToDocument,documentToText} from '../shared/editor-document.mjs';

test('visual editing round trips Vietnamese, math, source images, tables and blank lines',()=>{
  for(const text of ['Đạo hàm $\\frac{x^2}{2}$ là gì?\n\n[[img:12]]','| x | $y$ |\n| 1 | 2 |','Tính $$\\int_0^1\nx^2 dx$$ rồi kết luận.','<img src=x onerror=alert(1)> & \\text{a}']) {
    assert.equal(documentToText(textToDocument(text)),text);
  }
});
test('math edits preserve LaTeX and only internal image references are accepted',()=>{
  const doc=textToDocument('$x$ [[img:8]]');
  doc.content[0].content[0].attrs.latex='\\sqrt{x+1}';
  assert.equal(documentToText(doc),'$\\sqrt{x+1}$ [[img:8]]');
  assert.equal(documentToText(textToDocument('[[img:https://evil.test/x]]')),'[[img:https://evil.test/x]]');
});
