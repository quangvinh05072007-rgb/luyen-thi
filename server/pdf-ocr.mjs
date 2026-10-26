// Local OCR: no document leaves this machine. Original crops remain canonical.
import path from 'node:path';
import {createRequire} from 'node:module';
import {createCanvas} from '@napi-rs/canvas';
import {createWorker, PSM} from 'tesseract.js';
import {classifyQuestion} from '../shared/classify.mjs';
import {applyAnswerEntries} from '../shared/parse.mjs';
import {segmentOcrPages, solutionAnswers, isSolutionHeading} from './pdf-ocr-layout.mjs';

const require=createRequire(import.meta.url);
let active=false;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

/** Serializes expensive OCR jobs and always releases native/worker resources. */
export async function ocrScannedPdf(buf, pageTexts, {onProgress=()=>{},signal}={}) {
  if(active) throw fail('Đang OCR một đề khác. Hãy chờ đề đó hoàn tất rồi thử lại.',429);
  active=true;
  let worker,doc;
  const started=Date.now();
  const timeout=async (promise,ms) => {
    let timer;
    try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('OCR mất quá nhiều thời gian. Hãy chia PDF thành các phần nhỏ hơn.',408)),ms);})]);}
    finally {clearTimeout(timer);}
  };
  try {
    let end=pageTexts.findIndex(text=>isSolutionHeading(text));
    if(end<0) end=pageTexts.length;
    if(!end) throw fail('PDF bắt đầu bằng lời giải. Hãy chọn file có các trang đề trước phần đáp án.');
    if(end>20) throw fail('OCR hỗ trợ tối đa 20 trang đề mỗi lần. Hãy chia file PDF thành các phần nhỏ hơn.');
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
    doc=await pdfjs.getDocument({data:new Uint8Array(buf),isEvalSupported:false,verbosity:0}).promise;
    worker=await createWorker('vie',1,{cacheMethod:'none',langPath:path.join(path.dirname(require.resolve('@tesseract.js-data/vie')),'4.0.0_best_int'),errorHandler:()=>{}});
    await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1'});
    const pages=[];
    for(let n=1;n<=end;n++) {
      signal?.throwIfAborted();
      if(Date.now()-started>240000) throw fail('OCR mất quá nhiều thời gian. Hãy chia PDF thành các phần nhỏ hơn.',408);
      onProgress({page:n,pages:end});
      const page=await doc.getPage(n);
      const base=page.getViewport({scale:1});
      const scale=Math.min(3,2600/Math.max(base.width,base.height),Math.sqrt(5e6/(base.width*base.height)));
      const viewport=page.getViewport({scale});
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await timeout(page.render({canvasContext:canvas.getContext('2d'),viewport}).promise,30000);
      const {data}=await timeout(worker.recognize(canvas.toBuffer('image/png'),{}, {text:true,blocks:true}),45000);
      signal?.throwIfAborted();
      const lines=(data.blocks ?? []).flatMap(b=>b.paragraphs.flatMap(p=>p.lines));
      if(!lines.length) throw fail(`OCR không đọc được trang ${n}. Hãy dùng bản scan rõ hơn.`);
      pages.push({number:n,width:canvas.width,height:canvas.height,canvas,lines,confidence:data.confidence});
      onProgress({page:n,pages:end,stage:'ocr'});
      page.cleanup();
    }
    const questions=segmentOcrPages(pages);
    const images=[];
    for(const q of questions) {
      const classification=classifyQuestion({type:q.type,stem:q.ocrText,options:[]});
      Object.assign(q,{topic:classification.topic,level:classification.level,tagConfidence:classification.confidence,answer:null,answerCands:[],answerSources:[],explanation:'',warnings:['Nội dung chính là ảnh gốc, giữ nguyên công thức và hình vẽ. Chữ OCR chỉ để tham khảo; đối chiếu trước khi duyệt.']});
      q.stem=q.regions.map(region=>{
        const page=pages.find(p=>p.number===region.page);
        const left=Math.max(0,region.left), top=Math.max(0,Math.floor(region.top));
        const width=Math.min(page.width-left,Math.ceil(region.right-left));
        const height=Math.min(page.height-top,Math.ceil(region.bottom-top));
        const crop=createCanvas(width,height);
        crop.getContext('2d').drawImage(page.canvas,left,top,width,height,0,0,width,height);
        const key=`ocr${images.length+1}`;
        images.push({key,mime:'image/png',data:crop.toBuffer('image/png'),cx:Math.round(width*3500),cy:Math.round(height*3500)});
        return `[[img:${key}]]`;
      }).join('\n');
      q.options=q.type==='mcq' ? [...'ABCD'].map(c=>`Phương án ${c} trong ảnh gốc.`) : q.type==='tf' ? [...'abcd'].map(c=>`Mệnh đề ${c}) trong ảnh gốc.`) : [];
      q.ocrText=q.ocrText.trim();
      q.scanPages=[...new Set(q.regions.map(r=>r.page))];
      delete q.regions;
    }
    const entries=solutionAnswers(pageTexts.slice(end).join('\n'));
    applyAnswerEntries(questions,entries,'file');
    for(const q of questions) if(q.answer===null) q.warnings.push('Chưa đọc được đáp án chắc chắn. Hãy chọn đáp án trước khi duyệt.');
    return {questions,images,warnings:['Đề scan đã được OCR cục bộ. Hình và công thức giữ nguyên trong ảnh từng câu; chưa chuyển thành công thức LaTeX có thể sửa.',`Đã đối chiếu ${questions.filter(q=>q.answer!==null).length}/${questions.length} đáp án rõ ràng từ phần lời giải. Khi lưu, các câu ở trạng thái nháp để bạn duyệt.`],info:{ocr:true,ocrPages:end,engine:'Tesseract tiếng Việt (cục bộ)',imageQuestions:true,answerCount:questions.filter(q=>q.answer!==null).length}};
  } finally {
    try {await worker?.terminate();} finally {try {await doc?.destroy();} finally {active=false;}}
  }
}
