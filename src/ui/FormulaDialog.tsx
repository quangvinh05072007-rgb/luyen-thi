import {useEffect,useRef,useState} from 'react';
import {MathfieldElement} from 'mathlive';
import 'mathlive/fonts.css';
import {Modal} from './kit';

MathfieldElement.fontsDirectory=null;
MathfieldElement.soundsDirectory=null;

export default function FormulaDialog({value,onApply,onClose}:{value:string;onApply:(s:string)=>void;onClose:()=>void}) {
  const host=useRef<HTMLDivElement>(null);
  const field=useRef<MathfieldElement>();
  const [latex,setLatex]=useState(value);
  useEffect(()=>{
    const mf=new MathfieldElement();mf.value=value;mf.mathVirtualKeyboardPolicy='manual';
    mf.setAttribute('aria-label','Nhập công thức Toán');
    const input=()=>setLatex(mf.value);mf.addEventListener('input',input);
    host.current?.append(mf);field.current=mf;mf.focus();
    return ()=>{mf.removeEventListener('input',input);mf.remove();};
  },[]);
  return <Modal title="Công thức Toán" onClose={onClose}>
    <div className="stack formula-dialog">
      <div ref={host}/>
      <div className="row formula-presets">{[['Phân số','\\frac{#0}{#0}'],['Căn','\\sqrt{#0}'],['Lũy thừa','x^{#0}'],['Tích phân','\\int_{#0}^{#0} #0\\,dx']].map(([label,expr])=><button type="button" className="btn sm" key={label} onClick={()=>{field.current?.insert(expr);field.current?.focus();setLatex(field.current?.value??'');}}>{label}</button>)}</div>
      <label className="field">LaTeX<input className="input" value={latex} onChange={e=>{setLatex(e.target.value);if(field.current)field.current.value=e.target.value;}}/></label>
      <p className="tiny muted">Bấm biểu tượng bàn phím trong ô công thức để mở bàn phím Toán.</p>
      <div className="row between"><button className="btn" type="button" onClick={onClose}>Hủy</button><button className="btn primary" type="button" disabled={!latex.trim()} onClick={()=>{onApply(latex);onClose();}}>Chèn công thức</button></div>
    </div>
  </Modal>;
}
