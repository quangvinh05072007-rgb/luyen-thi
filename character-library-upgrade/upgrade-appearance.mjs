import fs from 'node:fs';
function replace(s,a,b){if(!s.includes(a))throw Error('Missing appearance UI marker '+a);return s.replace(a,b);}
export function upgradeAppearance(html){
 html=replace(html,'function summary(sec) {','function baseSummary(sec) {');
 html=replace(html,'function secBody(sec){','function standardSecBody(sec){');
 html=replace(html,'function mountEditExtras(){','function mountStandardEditExtras(){');
 const code=fs.readFileSync(new URL('./appearance-editor.js',import.meta.url),'utf8');
 html=replace(html,"  TABS.push(['Khớp','sliders',[]]);",code+"\n  TABS.push(['Khớp','sliders',[]]);");
 html=replace(html,'</head>',`<style>
 .appearance-select-label{display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--mut)}.appearance-select-label select{width:100%;padding:9px 10px;background:var(--surf);border:1px solid var(--line);border-radius:8px;font-size:13px;color:var(--fg)}.appearance-link{display:flex;align-items:center;gap:7px;width:100%;padding:10px 0;font-size:11px;color:var(--mut)}.appearance-link .i{width:14px;height:14px}.appearance-link[aria-pressed=true]{color:var(--accent)}
 .hand-editor-group{margin-top:14px}.hand-editor-group>b{font-size:12px;font-weight:600}.hand-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}.hand-options button{border:1px solid var(--line);border-radius:9px;padding:6px 4px;background:var(--surf);font-size:10px;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}.hand-options svg{width:35px;height:40px}.hand-options span{line-height:1.3;text-align:center}.hand-options button[aria-pressed=true]{border-color:var(--accent);background:var(--soft);color:var(--accent)}
 .appearance-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.appearance-choice-grid button{font-size:12px;padding:12px 7px;border-radius:9px;background:var(--surf);border:1px solid var(--line)}.appearance-choice-grid button[aria-pressed=true]{color:var(--accent);border-color:var(--accent);background:var(--soft)}.appearance-reset{font-size:11px;color:var(--accent);padding:12px 0 0}.fringe-control{padding-top:14px;margin-top:14px;border-top:1px solid var(--line)}
 .appearance-colors{padding:14px}.appearance-colors>p{font-size:12px;line-height:1.7;color:var(--mut);margin:0 0 16px}.color-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.color-field{display:flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:10px;padding:9px 7px;background:var(--surf)}.color-field .sws{display:flex;align-items:center;gap:7px;flex:1;min-width:0;margin:0;padding:0;font-size:11px;color:var(--fg)}.color-field input[type=color]{width:29px;height:29px;padding:0;border:0;background:none;flex:none;cursor:pointer}.color-field input::-webkit-color-swatch-wrapper{padding:0}.color-field input::-webkit-color-swatch{border:1px solid #00000018;border-radius:7px}.color-field button{display:grid;place-items:center;width:20px;height:28px;flex:none;color:var(--mut)}.color-field .i{width:12px;height:12px}
 .color-field{flex-wrap:wrap}.color-field input:disabled{opacity:.4;cursor:not-allowed}.color-field .color-availability{width:100%;height:auto;text-align:left;display:block;font-size:9px;color:var(--accent);padding:2px 0}
 @media(pointer:coarse){.appearance-choice-grid button{min-height:44px}.appearance-select-label select{min-height:44px}.color-field{min-height:54px}}
 </style></head>`);
 return html;
}
