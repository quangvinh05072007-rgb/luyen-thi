import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Node,mergeAttributes} from '@tiptap/core';
import {EditorContent,useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {InlineMath} from '@tiptap/extension-mathematics';
import {TableKit} from '@tiptap/extension-table';
import {textToDocument,documentToText} from '../../shared/editor-document.mjs';
import {api} from '../api';
import {Icon,useApp} from './kit';
const FormulaDialog=lazy(()=>import('./FormulaDialog'));

const SourceImage=Node.create({
  name:'sourceImage',group:'inline',inline:true,atom:true,
  addAttributes(){return {id:{default:null}};},
  parseHTML(){return [{tag:'img[data-source-image]',getAttrs:el=>({id:Number(el.getAttribute('data-source-image'))})}];},
  renderHTML({node,HTMLAttributes}){return ['img',mergeAttributes(HTMLAttributes,{'data-source-image':node.attrs.id,src:`/api/images/${Number(node.attrs.id)}`,alt:'Hình trong câu hỏi'})];},
});

export default function RichField({value,onChange,label,compact=false}:{value:string;onChange:(s:string)=>void;label:string;compact?:boolean}) {
  const {toast}=useApp();const change=useRef(onChange);change.current=onChange;
  const current=useRef(value);const upload=useRef<HTMLInputElement>(null);
  const [source,setSource]=useState(false);const [uploading,setUploading]=useState(false);
  const [formula,setFormula]=useState<{latex:string;pos?:number}|null>(null);
  const editor=useEditor({
    extensions:[StarterKit.configure({bold:false,italic:false,strike:false,code:false,codeBlock:false,heading:false,blockquote:false,bulletList:false,orderedList:false,listItem:false,horizontalRule:false,link:false,underline:false}),
      InlineMath.extend({addAttributes(){return {...this.parent?.(),display:{default:false}};}}).configure({katexOptions:{throwOnError:false,trust:false},onClick:(node,pos)=>setFormula({latex:node.attrs.latex,pos})}),SourceImage,TableKit],
    content:textToDocument(value),
    editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true'}},
    onUpdate:({editor})=>{const s=documentToText(editor.getJSON());current.current=s;change.current(s);},
    immediatelyRender:false,
  });
  useEffect(()=>{if(editor&&value!==current.current){current.current=value;editor.commands.setContent(textToDocument(value),{emitUpdate:false});}},[value,editor]);
  if(!editor)return <textarea className="input" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}/>;
  return <div className={`rich-field ${compact?'compact':''}`}>
    <div className="rich-toolbar" role="toolbar" aria-label={`Soạn ${label.toLowerCase()}`}>
      <button type="button" title="Chèn hoặc sửa công thức" onClick={()=>setFormula({latex:''})}>∑ <span>Công thức</span></button>
      {!compact&&<><button type="button" title="Chèn bảng 2 × 3" onClick={()=>editor.chain().focus().insertTable({rows:2,cols:3,withHeaderRow:false}).run()}><Icon name="table"/>Bảng</button><button type="button" disabled={uploading} onClick={()=>upload.current?.click()}><Icon name="upload"/>{uploading?'Đang tải…':'Hình'}</button></>}
      <span className="grow"/>
      <button type="button" aria-label="Hoàn tác trong trình soạn" disabled={!editor.can().undo()} onClick={()=>editor.chain().focus().undo().run()}>↶</button>
      <button type="button" aria-pressed={source} onClick={()=>setSource(!source)}>{source?'Trực quan':'LaTeX / chữ'}</button>
    </div>
    {source?<textarea className="input rich-source" aria-label={`${label} (LaTeX / chữ)`} value={value} onChange={e=>{current.current=e.target.value;onChange(e.target.value);editor.commands.setContent(textToDocument(e.target.value),{emitUpdate:false});}}/>:<EditorContent editor={editor}/>}
    {editor.isActive('table')&&!source&&<div className="rich-toolbar"><button type="button" onClick={()=>editor.chain().focus().addRowAfter().run()}>+ Hàng</button><button type="button" onClick={()=>editor.chain().focus().addColumnAfter().run()}>+ Cột</button><button type="button" onClick={()=>editor.chain().focus().deleteRow().run()}>Xóa hàng</button><button type="button" onClick={()=>editor.chain().focus().deleteColumn().run()}>Xóa cột</button><button type="button" onClick={()=>editor.chain().focus().deleteTable().run()}>Xóa bảng</button></div>}
    <input type="file" ref={upload} hidden accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);try{const r=await api('POST',`/api/images?filename=${encodeURIComponent(file.name)}`,undefined,{raw:await file.arrayBuffer()});editor.chain().focus().insertContent({type:'sourceImage',attrs:{id:r.id}}).run();}catch(e:any){toast(e.message);}finally{setUploading(false);if(upload.current)upload.current.value='';}}}/>
    {formula&&<Suspense fallback={<p className="tiny muted">Đang mở bàn phím Toán…</p>}><FormulaDialog value={formula.latex} onClose={()=>setFormula(null)} onApply={latex=>{if(formula.pos!==undefined)editor.chain().focus().updateInlineMath({pos:formula.pos,latex}).run();else editor.chain().focus().insertInlineMath({latex}).run();}}/></Suspense>}
  </div>;
}
