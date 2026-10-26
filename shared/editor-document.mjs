// Lossless bridge to the app's existing text / LaTeX / image / pipe-table format.
function inline(text) {
  const nodes=[];let last=0;
  const re=/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\[\[img:(\d+)\]\]/g;
  for(const m of text.matchAll(re)) {
    if(m.index>last) nodes.push({type:'text',text:text.slice(last,m.index)});
    nodes.push(m[3]?{type:'sourceImage',attrs:{id:Number(m[3])}}:{type:'inlineMath',attrs:{latex:m[1]??m[2],display:m[1]!==undefined}});
    last=m.index+m[0].length;
  }
  if(last<text.length) nodes.push({type:'text',text:text.slice(last)});
  return nodes;
}
export function textToDocument(value) {
  // Protect multiline display equations before splitting paragraphs.
  const equations=[];
  const text=String(value??'').replace(/\$\$[\s\S]+?\$\$/g,m=>`\u0000${equations.push(m)-1}\u0000`);
  const lines=text.split('\n');const content=[];
  const restore=s=>s.replace(/\u0000(\d+)\u0000/g,(_,n)=>equations[Number(n)]);
  for(let i=0;i<lines.length;i++) {
    if(/^\|.*\|\s*$/.test(lines[i])) {
      const rows=[];
      while(i<lines.length&&/^\|.*\|\s*$/.test(lines[i])) {
        rows.push({type:'tableRow',content:lines[i].replace(/^\|\s*|\s*\|\s*$/g,'').split(/\s*\|\s*/).map(s=>({type:'tableCell',content:[{type:'paragraph',content:inline(restore(s))}]}))});i++;
      }
      i--;content.push({type:'table',content:rows});
    } else content.push({type:'paragraph',content:inline(restore(lines[i]))});
  }
  return {type:'doc',content};
}
export function documentToText(node) {
  const children=(sep='')=>(node.content??[]).map(documentToText).join(sep);
  switch(node.type) {
    case 'text': return node.text??'';
    case 'inlineMath': return `${node.attrs?.display?'$$':'$'}${node.attrs?.latex??''}${node.attrs?.display?'$$':'$'}`;
    case 'sourceImage': return /^\d+$/.test(String(node.attrs?.id))?`[[img:${node.attrs.id}]]`:'';
    case 'hardBreak': return '\n';
    case 'doc': case 'table': return children('\n');
    case 'tableRow': return `| ${children(' | ')} |`;
    case 'tableCell': case 'tableHeader': return children(' ').replace(/\n/g,' ');
    default: return children();
  }
}
