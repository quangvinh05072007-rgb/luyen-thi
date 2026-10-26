import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
function replace(s,a,b){if(!s.includes(a))throw Error('Missing compact UI marker: '+a.slice(0,100));return s.replace(a,b);}
export function simplifyPreview(html){
 const ui=fs.readFileSync(fileURLToPath(new URL('./preview-ui.js',import.meta.url)),'utf8');
 const start=html.indexOf('  function renderMid() {'),end=html.indexOf('  function paintHead()',start);
 if(start<0||end<0)throw Error('Missing preview functions');
 html=html.slice(0,start)+ui+'\n'+html.slice(end);
 // The later legacy declaration would override the new preview renderer.
 const stage=html.indexOf('  function renderStage() {'),stageEnd=html.indexOf('  function paintUndo()',stage);
 if(stage<0||stageEnd<0)throw Error('Missing legacy stage renderer');
 html=html.slice(0,stage)+html.slice(stageEnd);
 html=replace(html,'function secBody(sec) {','function baseSecBody(sec) {');
 html=replace(html,"$('edit').innerHTML = h; $('edscroll').scrollTop = keepY;","$('edit').innerHTML = h; mountEditExtras(); $('edscroll').scrollTop = keepY;");
 html=replace(html,'AUTO = true, PREVIEW','AUTO = false, PREVIEW');
 html=replace(html,"var s0 = TABS[TAB][2][0];","var s0 = TABS[TAB][2][0] || {id:'motion'};");
 html=replace(html,"  $('edit').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'qk') applyDesc(false); });",'');
 html=replace(html,'  loadCur(); renderAll(); requestAnimationFrame(frame);',"  TABS.push(['Khớp','sliders',[]]);\n  loadCur(); renderAll(); requestAnimationFrame(frame);");
 html=replace(html,'</head>',`<style>
 .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
 .mid{padding:12px;gap:10px;overflow:hidden}.mid .stage{flex:1 1 0;min-height:0}
 .preview-controls{display:flex;align-items:center;gap:8px;flex:none;min-width:0;padding-top:2px}
 .preview-controls .vw{margin:0;flex:none;border-radius:10px}.preview-controls .vw button{padding:7px 12px;min-height:44px;font-size:13px;border-radius:8px}
 .motion-field{flex:1;min-width:0}.motion-field select{width:100%;min-width:0;height:46px;border:1px solid var(--line);border-radius:10px;background:var(--surf);font-size:13px;padding:0 28px 0 12px;text-overflow:ellipsis;cursor:pointer}
 .preview-play{display:grid;place-items:center;width:46px;height:46px;flex:none;border-radius:10px;color:var(--accent);background:var(--soft)}.preview-play:hover{background:var(--line)}.preview-play:disabled{opacity:.45;cursor:default}
 .preview-tools{position:absolute;top:12px;right:12px;z-index:4;font-size:13px;color:var(--fg)}
 .preview-tools>summary{display:grid;place-items:center;list-style:none;width:36px;height:36px;border-radius:10px;background:var(--surf);box-shadow:0 2px 8px #0002;cursor:pointer}.preview-tools>summary::-webkit-details-marker{display:none}
 .preview-tools .i{width:18px;height:18px;position:static}.preview-tools-panel{position:absolute;right:0;top:44px;width:268px;max-width:calc(100vw - 64px);max-height:calc(100dvh - 190px);overflow-y:auto;padding:14px;background:var(--surf);border:1px solid var(--line);box-shadow:0 8px 28px #0003;border-radius:14px;display:flex;flex-direction:column;gap:12px}
 .preview-tools-panel .seg{border-radius:9px}.preview-tools-panel .seg button{font-size:12px;padding:6px 8px;border-radius:7px;min-height:36px;flex:1}.tool-option{text-align:left;font-size:13px;padding:8px;border-radius:8px}.tool-option:hover,.tool-option[aria-pressed=true]{background:var(--soft);color:var(--accent)}
 .preview-zoom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px}.preview-zoom .zv{min-width:56px;height:36px;font-size:13px}
 .expression-mood{display:flex;flex-direction:column;gap:14px;padding:18px 0 4px;border-top:1px solid var(--line);margin-top:14px;font-size:12px}.expression-mood>span:first-child{display:flex;justify-content:space-between}.mood-labels{display:flex;justify-content:space-between;color:var(--mut)}
 .motion-editor{padding:16px 14px}.motion-editor-head{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:16px}.motion-editor-head p{margin:4px 0 0;font-size:12px;color:var(--mut)}
 .motion-editor .rig-fields{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}.motion-editor .rigp label{font-size:11px;max-width:100%}.motion-editor .rig-fields input{max-width:100%;width:100%}.motion-editor .rigp{gap:12px}
 .description-panel{margin:12px 14px 18px;border-top:1px solid var(--line);padding-top:14px;font-size:13px}.description-panel>summary{cursor:pointer;color:var(--mut);padding-block:4px}
 #edit #qbar{display:flex;flex-wrap:wrap;gap:8px;padding:12px 0 0;margin:0;box-shadow:none;border-radius:0;background:none}#edit #qbar>svg{display:none}#edit #qk{flex:1 0 100%;width:100%;border:1px solid var(--line);border-radius:9px;padding:10px;font-size:13px}#edit #qbar .qread{display:block;flex-basis:100%;max-width:none;white-space:normal;font-size:12px}#edit #qbar .btn{min-height:36px}
 .edit .tabs{margin-inline:10px}.edit .tabs button{padding:10px 7px;font-size:12px;gap:5px;white-space:nowrap;flex:1;justify-content:center}.edit .tabs .i{display:none}
 @media(max-width:759px){.mid{padding:10px;gap:10px}.preview-controls{gap:6px}.preview-controls .vw{padding:2px}.preview-controls .vw button{padding:6px 8px;font-size:12px}.motion-field select{padding-left:8px;padding-right:20px;font-size:12px}.preview-play{width:44px;height:46px}.preview-tools{top:10px;right:10px}.preview-tools>summary{width:32px;height:32px}.preview-tools-panel{max-height:calc(100dvh - 190px);overflow-y:auto}.app[data-view=prev] #qbar{display:none}}
 @media(max-height:500px){.app{gap:6px;padding-block:6px}.mid{padding:8px;gap:6px}.preview-controls .vw button{min-height:36px}.motion-field select,.preview-play{height:40px}.preview-tools-panel{max-height:calc(100dvh - 140px)}}
 </style></head>`);
 return html;
}
