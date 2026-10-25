import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual component with controlled deferred HTTP responses. This small
// hook host makes the refresh/logout ordering deterministic without a browser.
function mountFamily() {
  const slots=[],effects=[],requests=[]; let cursor=0;
  const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={
    useState(initial) { const i=cursor++; if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial; return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}]; },
    useRef(initial) { const i=cursor++; if(!(i in slots))slots[i]={current:initial}; return slots[i]; },
    useCallback(fn,deps) { const i=cursor++; if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={fn,deps}; return slots[i].fn; },
    useEffect(fn,deps) { const i=cursor++; if(!slots[i]||!equal(slots[i].deps,deps)){ slots[i]?.cleanup?.(); slots[i]={deps}; effects.push(()=>{slots[i].cleanup=fn();}); } },
  };
  const jsx=(type,props)=>({type,props});
  const source=ts.transpileModule(fs.readFileSync(new URL('../src/pages/Family.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(source,{exports,require:(name)=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:{fmtDate:String,fmtDateTime:String,fmtScore:String},window:{setInterval:()=>1,clearInterval(){}},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve:(data,status=200)=>resolve({ok:status<400,status,json:async()=>data})}))});
  return {render(){cursor=0;const tree=exports.Family();effects.splice(0).forEach(fn=>fn());return tree;},requests};
}
function find(tree,text) {
  if(!tree||typeof tree!=='object')return null;
  if(tree.type==='button'&&tree.props.children===text)return tree;
  const children=Array.isArray(tree.props?.children)?tree.props.children:[tree.props?.children];
  for(const child of children.flat(Infinity)){const result=find(child,text);if(result)return result;}
  return null;
}
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
const dashboard={student:{id:1,name:'Học sinh A',className:'12A1'},grades:[],participation:[],topics:[],suggestions:[]};
test('a dashboard response arriving after family logout cannot show the previous student again',async()=>{
  const host=mountFamily();host.render();
  host.requests[0].resolve(dashboard);await flush();
  const page=host.render();
  find(page,'Cập nhật').props.onClick();
  find(page,'Đăng xuất').props.onClick();
  host.requests.find(r=>r.url.endsWith('/logout')).resolve({ok:true});await flush();
  assert.ok(find(host.render(),'Mở cổng phụ huynh'));
  host.requests[1].resolve(dashboard);await flush();
  assert.ok(find(host.render(),'Mở cổng phụ huynh'),'late private response must not restore the old dashboard');
});
