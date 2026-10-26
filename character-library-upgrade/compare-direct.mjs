import fs from 'node:fs';
function replace(s,a,b){if(!s.includes(a))throw Error('Missing compare/direct marker: '+a.slice(0,100));return s.replace(a,b);}
export function enhanceCompareDirect(html){
 html=replace(html,'function renderMid(){','function baseRenderMid(){');
 html=replace(html,'function renderStage(){','function baseRenderStage(){');
 // UpgradeAppearance already renamed the older fallback; this is the final editor.
 const code=fs.readFileSync(new URL('./compare-direct.js',import.meta.url),'utf8');
 const start=html.lastIndexOf('  function secBody(sec){');if(start<0)throw Error('Missing appearance section renderer');
 html=html.slice(0,start)+html.slice(start).replace('  function secBody(sec){','  function appearanceSecBody(sec){');
 html=replace(html,"  TABS.push(['Khớp','sliders',[]]);",code+"\n  TABS.push(['Khớp','sliders',[]]);");
 html=replace(html,'</head>',`<style>
 #stage svg[data-stage-root]{position:absolute;inset:0;width:100%;height:100%}#stage [data-edit-part]{cursor:pointer}
 .compare-rail{position:absolute;inset:0;overflow:hidden}.compare-swipe-hint{display:none;pointer-events:none}
 .compare-toggle{position:absolute;top:12px;right:56px;z-index:4;display:flex;align-items:center;gap:5px;height:36px;padding:0 9px;border-radius:10px;background:var(--surf);color:var(--mut);font:inherit;font-size:11px;box-shadow:0 2px 8px #0002}.compare-toggle .i{width:16px;height:16px;position:static}.compare-toggle[aria-pressed=true]{background:var(--soft);color:var(--accent)}
 .direct-edit-links{border-top:1px solid var(--line);padding-top:12px}.direct-edit-links>b{font-size:12px;font-weight:600}.direct-edit-links>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.direct-edit-links button{padding:8px;border:1px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:var(--surf);text-align:left}.direct-edit-links button:hover{background:var(--soft);color:var(--accent)}
 .direct-color.sws{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px;margin-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--mut)}.direct-color input{width:40px;height:30px;border:1px solid var(--line);border-radius:7px;padding:2px;background:var(--surf)}
 @media(max-width:759px){.compare-toggle{top:10px;right:52px;height:32px;padding:0 7px;font-size:10px}.compare-toggle .i{width:14px;height:14px}.compare-rail{overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;overscroll-behavior-x:contain}.compare-rail svg[data-stage-root]{width:300%!important;max-width:none}.compare-swipe-hint{display:block;position:absolute;left:50%;bottom:10px;transform:translateX(-50%);padding:4px 8px;background:var(--surf);color:var(--mut);border-radius:6px;font:inherit;font-size:10px;white-space:nowrap}}
 </style></head>`);
 return html;
}
