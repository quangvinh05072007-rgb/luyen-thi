import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {importText} from './importers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const mathPython=path.join(root,'data/ocr-runtime',process.platform==='win32'?'Scripts/python.exe':'bin/python');
export function mathOcrAvailable(){return fs.existsSync(mathPython)&&fs.existsSync(path.join(root,'data/ocr-runtime/marker-ready.json'));}
export function runLocalPython(script,args,{signal,timeoutMs=240000,env={}}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(mathPython,[path.join(root,'tools',script),...args],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,...env}});
    let output='',errors='',settled=false;
    const stop=()=>{child.kill();finish(Object.assign(new Error('Đã hủy tác vụ.'),{status:409}));};
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{child.kill();finish(Object.assign(new Error('Nhận dạng vượt quá thời gian cho phép. Hãy thử vùng ảnh nhỏ hơn.'),{status:408}));},timeoutMs);
    child.stdout.on('data',b=>{output=(output+b).slice(-10000);});child.stderr.on('data',b=>{errors=(errors+b).slice(-8000);});
    child.on('error',e=>finish(e));child.on('close',code=>code===0?finish(null,output):finish(Object.assign(new Error(`Bộ nhận dạng cục bộ chưa xử lý được hình này. ${errors.split('\n').filter(Boolean).at(-1)??''}`),{status:422})));
    signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
  });
}
export function markerResult(pages,type,sourceStem) {
  let text=pages.map(p=>String(p.text??'')).join('\n').replace(/\*\*/g,'');
  const part={mcq:'I',tf:'II',short:'III'}[type];
  const result=importText(`PHẦN ${part}\n${text}`);
  for(const q of result.questions){q.sourceStem=sourceStem;q.stem=`${q.stem}\n${sourceStem}`;q.answer=null;q.fromAi=true;q.warnings=[...(q.warnings??[]),'Công thức do Marker nhận dạng; kiểm tra ảnh gốc, hình vẽ và đáp án trước khi dùng.'];}
  result.warnings.push('Marker có thể bỏ sót hình hoặc nhận sai ký hiệu. Ảnh gốc được giữ để đối chiếu; bản này chưa được duyệt.');
  return {...result,info:{...result.info,engine:'Marker 1.10.1 · cục bộ',mathOcr:true},recognizedText:text};
}
export async function recognizeMathImages(input,meta,options) {
  if(!mathOcrAvailable())throw Object.assign(new Error('Marker chưa sẵn sàng. Cần cài và kiểm tra runtime OCR nâng cao.'),{status:503});
  const tempRoot=os.tmpdir(),dir=fs.mkdtempSync(path.join(tempRoot,'smartexam-marker-'));
  try {
    const pictures=JSON.parse(Buffer.from(input).toString());const pages=[];
    for(let i=0;i<pictures.length;i++) {
      options.signal?.throwIfAborted();options.onProgress({page:i,pages:pictures.length,stage:'math'});
      const file=path.join(dir,`page-${i}.png`),out=path.join(dir,`result-${i}.json`);
      fs.writeFileSync(file,Buffer.from(pictures[i].data,'base64'));
      await runLocalPython('marker_extract.py',[file,out],{signal:options.signal,timeoutMs:300000,env:{HF_HUB_OFFLINE:'1'}});
      const page=JSON.parse(fs.readFileSync(out,'utf8'));
      // Source scan remains canonical for diagrams; extracted-image placeholders
      // are explicit rather than silently pointing to missing local files.
      page.text=String(page.text).replace(/!\[[^\]]*\]\([^)]+\)/g,'[Hình: đối chiếu ảnh gốc]');pages.push(page);
      options.onProgress({page:i+1,pages:pictures.length,stage:'math'});
    }
    return markerResult(pages,meta.type,meta.sourceStem);
  } finally {
    if(path.dirname(path.resolve(dir))===path.resolve(tempRoot)&&path.basename(dir).startsWith('smartexam-marker-'))fs.rmSync(dir,{recursive:true,force:true});
  }
}
