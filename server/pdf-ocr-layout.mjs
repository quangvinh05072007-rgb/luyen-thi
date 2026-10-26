import {parseAnswerLine} from '../shared/parse.mjs';

export const plain = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
export const isSolutionHeading = text => /(?:dap an.*loi giai|huong dan giai|loi giai chi tiet)/.test(plain(text).slice(0,500));

/** Page coordinates refer to the rendered original, never reconstructed OCR math. */
export function segmentOcrPages(pages) {
  const questions=[];
  let current=null, part='I';
  const last={};
  for(const page of pages) {
    const lines=[...page.lines].sort((a,b)=>a.bbox.y0-b.bbox.y0 || a.bbox.x0-b.bbox.x0);
    if(isSolutionHeading(lines.slice(0,3).map(l=>l.text).join('\n'))) break;
    const footer=lines.find(l=>/^(?:t?trang)\s+\d/.test(plain(l.text)) && l.bbox.y0>page.height*.8);
    const bottom=footer ? footer.bbox.y0-18 : page.height*.95;
    let cursor=Math.max(0,(lines[0]?.bbox.y0 ?? page.height*.04)-22);
    const append = end => {
      const textLines=lines.filter(l=>l.bbox.y0>=cursor && l.bbox.y0<end);
      if(current && end-cursor>15 && (textLines.length || end-cursor>page.height*.02)) {
        current.regions.push({page:page.number,top:Math.max(0,cursor),bottom:Math.min(bottom,end),left:Math.floor(page.width*.04),right:Math.ceil(page.width*.97)});
        current.ocrText += textLines.map(l=>l.text.trim()).join('\n')+'\n';
      }
    };
    for(const line of lines) {
      if(line.bbox.y0>=bottom) continue;
      const text=plain(line.text);
      const pm=text.match(/^phan\s+([i1l]{1,3}|[123])\b/);
      const qm=text.match(/^cau\s*(\d{1,2})\s*[.:)]/);
      if(pm) {
        append(line.bbox.y0-12);
        const token=pm[1].replace(/[l1]/g,'i');
        part=({'2':'II','3':'III',i:'I',ii:'II',iii:'III'})[token] ?? 'I';
        current=null;
        cursor=line.bbox.y1+8;
      } else if(qm && line.bbox.x0<page.width*.3) {
        append(line.bbox.y0-4);
        const num=Number(qm[1]);
        if(last[part] && num!==last[part]+1) throw Object.assign(new Error(`OCR có thể thiếu câu ${last[part]+1} ở phần ${part}. Chưa nhập để tránh mất câu; hãy dùng bản scan rõ hơn.`),{status:400});
        last[part]=num;
        current={part,num,type:({I:'mcq',II:'tf',III:'short'})[part],regions:[],ocrText:''};
        questions.push(current);
        cursor=Math.max(0,line.bbox.y0-4);
      } else if(text.length<30 && /^(?:[-—.\s]*)het(?:[-—.\s]*)$/.test(text)) {
        append(line.bbox.y0-16); current=null;
      }
    }
    append(bottom);
  }
  if(!questions.length) throw Object.assign(new Error('OCR không nhận ra câu hỏi. Hãy dùng bản scan rõ hơn, mỗi câu bắt đầu bằng Câu 1., Câu 2.…'),{status:400});
  return questions;
}

/** Only explicit conclusions are used; never solve or guess answers from OCR. */
export function solutionAnswers(text) {
  let part='I', current=null;
  const blocks=[];
  for(const line of String(text).split('\n')) {
    const pm=plain(line).match(/^phan\s+(iii|ii|i)\b/);
    if(pm) {part=pm[1].toUpperCase();current=null;continue;}
    const qm=plain(line).match(/^cau\s*(\d+)\s*[.:]/);
    if(qm) { current={part,num:Number(qm[1]),text:line};blocks.push(current); }
    else if(current) current.text+='\n'+line;
  }
  const entries=[];
  for(const q of blocks) {
    if(q.part==='I') {
      const letters=[...q.text.matchAll(/Chọn\s+(?:đáp\s+án\s+)?([A-D])\b/gu)].map(m=>m[1]);
      if(letters.length && new Set(letters).size===1) entries.push({part:q.part,num:q.num,kind:'mcq',value:'ABCD'.indexOf(letters[0])});
    } else if(q.part==='II') {
      const statements=[...q.text.matchAll(/(?:^|\n)\s*([a-d])\)\s*([\s\S]*?)(?=(?:\n\s*[a-d]\))|$)/gu)];
      const values=statements.map(m=>[...new Set([...m[2].matchAll(/(?:^|\s)(Đúng|Sai)\s*[.。](?=\s|$)/gu)].map(x=>x[1]))]);
      if(statements.length===4 && statements.map(m=>m[1]).join('')==='abcd' && values.every(v=>v.length===1)) entries.push({part:q.part,num:q.num,kind:'tf',value:values.map(v=>v[0]==='Đúng')});
    } else {
      const answers=[...q.text.matchAll(/^(?:Đáp[ \t]*(?:án|số)|Kết[ \t]*quả)[ \t]*[:.][ \t]*([^\n]+)/gimu)].map(m=>parseAnswerLine('short',m[1])).filter(v=>v!==null);
      if(answers.length && new Set(answers).size===1) entries.push({part:q.part,num:q.num,kind:'short',value:answers[0]});
    }
  }
  return entries;
}
