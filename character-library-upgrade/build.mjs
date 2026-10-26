import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {simplifyPreview} from './simplify-ui.mjs';
import {polishLibraryControls} from './polish-library-controls.mjs';
import {upgradeAppearance} from './upgrade-appearance.mjs';
import {enhanceCompareDirect} from './compare-direct.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const old=fs.readFileSync('C:/Users/LEGION/Downloads/Kho nhân vật 2.html','utf8').replaceAll('\r\n','\n');
const female=fs.readFileSync('C:/Users/LEGION/Downloads/nhanvat_nu_v2.html','utf8').replaceAll('\r\n','\n');
function mustReplace(s,a,b){if(!s.includes(a))throw new Error('Missing source marker: '+a.slice(0,100));return s.replace(a,b);}
function replaceBetween(s,a,b,value){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);if(i<0||j<0)throw Error('Missing block '+a);return s.slice(0,i)+value+s.slice(j);}
let rig=female.slice(female.indexOf('var D2R'),female.indexOf('var EXPR='));
rig=mustReplace(rig,'function headSel(theta, O) {','function nativeHeadSel(theta, O) {');
rig=mustReplace(rig,'function kEyeNew(st, o) {','function nativeEyeNew(st, o) {');
rig=mustReplace(rig,'function gHand(h) {','function nativeRigHand(h) {');
rig=mustReplace(rig,"items.map(function (i) { return i.svg; })","items.map(function (i) { return pickableItem(i); })");
rig=mustReplace(rig,"return '<g transform=\"translate(' + f1(w2[0])","return '<g data-edit-part=\"hands\" data-edit-side=\"' + k + '\" transform=\"translate(' + f1(w2[0])");
rig=mustReplace(rig,"s += P('M120 150 C110 52 160 34 190 34 C230 34 270 52 260 150Z', hair);","s += '<g data-edit-part=\"hairStyle\">' + P('M120 150 C110 52 160 34 190 34 C230 34 270 52 260 150Z', hair) + '</g>';");
rig=mustReplace(rig,'<g transform="translate(160 152)">','<g data-edit-part="eyes" transform="translate(160 152)">');
rig=mustReplace(rig,'  s += mouth;',"  s += '<g data-edit-part=\"expr\">' + mouth + '</g>';");
{
  const start=rig.indexOf('  /* mái + dải sáng (hairFront của Kho 2) */'),end=rig.indexOf('  /* kẹp hoa */',start);
  if(start<0||end<0)throw Error('Missing front hair pick block');
  rig=rig.slice(0,start)+"  s += '<g data-edit-part=\"hairStyle\">';\n"+rig.slice(start,end)+"  s += '</g>';\n"+rig.slice(end);
}
rig=mustReplace(rig,"g += '<path d=\"M' + f1(hs - hairW)","g += '<path data-edit-part=\"hairStyle\" d=\"M' + f1(hs - hairW)");
rig=rig.replaceAll("g += '<g clip-path=\"url(#' + id + ')\">'","g += '<g data-edit-part=\"hairStyle\" clip-path=\"url(#' + id + ')\">'");
rig=rig.replaceAll("g += '<g clip-path=\"url(#' + id + ')\"><path","g += '<g data-edit-part=\"hairStyle\" clip-path=\"url(#' + id + ')\"><path");
rig=mustReplace(rig,'if (!KH.crown) {','if (false) {');
rig=replaceBetween(rig,'      g += \'<defs><clipPath id="\' + ec + \'p"','      g += \'<path d="M127 224',"      g += profileEyeMarkup({skin:SKIN,eye:EYEC,eyeStyle:KH.eyeStyle,expr:KH.expr},ec,white);\n");
rig=mustReplace(rig,'<path d="M139 247 Q151 253 166 244" stroke="#7a3a45" stroke-width="2.8" fill="none" stroke-linecap="round"/>',"' + profileMouth(KH.expr) + '");
rig=mustReplace(rig,"      g += '<ellipse cx=\"176\" cy=\"216\"", "      if(KH.blush || KH.expr==='shy') g += '<ellipse cx=\"176\" cy=\"216\"");
rig=mustReplace(rig,'else if (fl.D > 4)','else if (false && fl.D > 4)');
rig=rig.replaceAll('    var lockP = function (sgn) {','    var lockP = function (sgn) {\n      if(side) return profileTempleLock(ACT);');
{
  const start=rig.indexOf('    for (i = 1; i < steps; i += 1) {'),end=rig.indexOf('    var hw2 = hairW',start);
  if(start<0||end<0)throw Error('Missing profile hair strand block');
  const original=rig.slice(start,end);
  rig=rig.slice(0,start)+'    if(side) g += profileHairStrands(hairW,hs); else {\n'+original+'    }\n'+rig.slice(end);
}
rig=replaceBetween(rig,'  // tóc dài sau lưng','  // tay\n','  renderHair(J, phi, items);\n  outfitDetails(J, phi, items, T, B);\n');
rig=mustReplace(rig,'[0, 330, 0]','[0, B.midDrop || (B.short ? 210 : 330), 0]');
rig=mustReplace(rig,'J.Rp), ring(add(add(J[\'kn\' + k],','J.Rp)).concat(B.short ? [] : ring(add(add(J[\'kn\' + k],');
rig=mustReplace(rig,'56, 44, J.Rp)); });','56, 44, J.Rp)); });'); // Closing structure remains balanced.
rig=mustReplace(rig,'if (c > .2) { var kc','if (c > .2 && !B.noTail) { var kc');
const oldFace='M130 140 C130 100 155 80 190 80 C225 80 250 100 250 140 C250 175 232 200 212 208 Q190 216 168 208 C148 200 130 175 130 140Z';
rig=mustReplace(rig,"P('"+oldFace+"', SKIN, 3.5)","P(characterFrontContour('"+oldFace+"'), SKIN, 3.5)");
rig=rig.replaceAll("PROF_LINE + '","characterProfileContour(PROF_LINE) + '");
rig=mustReplace(rig,'  /* mái + dải sáng (hairFront của Kho 2) */',"  s += characterFaceDetails('front');\n  /* mái + dải sáng (hairFront của Kho 2) */");
rig=mustReplace(rig,"      g += '<path d=\"' + characterProfileContour(PROF_LINE) + '\" fill=\"none\"", "      g += characterFaceDetails('side');\n      g += '<path d=\"' + characterProfileContour(PROF_LINE) + '\" fill=\"none\"");
rig=mustReplace(rig,'[[0, 42, 30], [1, 56, 35], [2, 58, 34]]','characterPelvisProfile()');
rig=mustReplace(rig,"g += tube(ch3, T.sleeve, { phi: phi, path: Qs, fill: T.col, shade: T.sh,", "g += tube(ch3, T.sleeve, { phi: phi, path: Qs, fill: T.sleeveCol || T.col, shade: T.sleeveSh || T.sh,");
rig=mustReplace(rig,'    g += crease(Q, 2, aw(kneeProf, 2), kneeCol, .8);','    g += malePantDetail(ext, Q, phi) + childPantDetail(ext, Q, phi);\n    g += crease(Q, 2, aw(kneeProf, 2), kneeCol, .8);');
rig=mustReplace(rig,'f1(sxk * 1.55)','f1(sxk * 1.55 * (ACT.ageGroup===\'child\'?.82:isElderWoman(ACT)?.94:1))');
rig=mustReplace(rig,'f1(sy * 1.5)','f1(sy * 1.5 * (ACT.ageGroup===\'child\'?.86:isElderWoman(ACT)?.94:1))');
const physics=female.slice(female.indexOf('function spring('),female.indexOf('function ground('));
const adapter=fs.readFileSync(path.join(dir,'rig-adapter.js'),'utf8');
const head=fs.readFileSync(path.join(dir,'preserved-head.js'),'utf8');
const picking=fs.readFileSync(path.join(dir,'rig-picking.js'),'utf8');
const morphology=fs.readFileSync(path.join(dir,'character-morphology.js'),'utf8');
const male=fs.readFileSync(path.join(dir,'male-character.js'),'utf8');
const maleWardrobe=fs.readFileSync(path.join(dir,'male-wardrobe.js'),'utf8');
const child=fs.readFileSync(path.join(dir,'child-character.js'),'utf8');
const childWardrobe=fs.readFileSync(path.join(dir,'child-wardrobe.js'),'utf8');
const elderWoman=fs.readFileSync(path.join(dir,'elder-woman.js'),'utf8');
const elderWomanWardrobe=fs.readFileSync(path.join(dir,'elder-woman-wardrobe.js'),'utf8');
const module='\nfunction createCharacterRig(){\n'+rig+'\n'+physics+'\n'+head+'\n'+picking+'\n'+morphology+'\n'+male+'\n'+maleWardrobe+'\n'+child+'\n'+childWardrobe+'\n'+elderWoman+'\n'+elderWomanWardrobe+'\n'+adapter+'\n}\nvar RIG = createCharacterRig();\nOUTFITS=OUTFITS.concat(RIG.catalog().outfits,RIG.childrenCatalog(\'all\').outfits,RIG.elderWomenCatalog().outfits);\nHAIRS=HAIRS.concat(RIG.catalog().hair.slice(5),RIG.childrenCatalog(\'all\').hair,RIG.elderWomenCatalog().hair);\n';
let html=old;
html=html.replace(/<link[^>]+https:\/\/fonts\.[^>]+>\n?/g,'');
html=mustReplace(html,'<html>','<html lang="vi">');
html=mustReplace(html,"['bun', 'Búi cao']","['highbun', 'Búi cao']");
html=mustReplace(html,"['ghost', 'Váy ma']];","['ghost', 'Váy ma'], ['sailor', 'Thuỷ thủ v2'], ['hanfu_v2', 'Hán phục v2'], ['uam', 'U ám v2'], ['casual', 'Áo thun + jean']];");
html=mustReplace(html,"['casual', 'Áo thun + jean']];","['casual', 'Áo thun + jean'], ['shirt', 'Sơ mi'], ['jacket', 'Áo khoác lịch sự']];");
html=mustReplace(html,"['pixie', 'Tóc tém']];","['pixie', 'Tóc tém'], ['shortcrop', 'Tóc ngắn'], ['sidepart', 'Rẽ ngôi'], ['crew', 'Đầu đinh'], ['balding', 'Tóc thưa hai bên'], ['shaved', 'Cạo sát']];");
html=mustReplace(html,"c.outfit = pickP(OUTFITS)[0]; c.hairStyle = pickP(HAIRS)[0];","var hairOptions=RIG.choices(S,'hair',HAIRS),outfitOptions=RIG.choices(S,'outfits',OUTFITS); c.outfit = pickP(outfitOptions)[0]; c.hairStyle = pickP(hairOptions)[0];");
html=mustReplace(html,'  var DEF = JSON.parse(JSON.stringify(PRESETS[0].s));',`  PRESETS.push(
    {n:'Thuỷ thủ v2',s:Object.assign({},PRESETS[2].s,{outfit:'sailor',hairStyle:'long',acc:'ribbon',c1:'#2b4585',c2:'#f8f9fd',c3:'#c8382f'})},
    {n:'Hán phục v2',s:Object.assign({},PRESETS[1].s,{outfit:'hanfu_v2',hairStyle:'bun',c1:'#a8322d',c2:'#f6ead8',c3:'#d9a441'})},
    {n:'U ám v2',s:Object.assign({},PRESETS[0].s,{outfit:'uam'})},
    {n:'Đời thường v2',s:Object.assign({},PRESETS[2].s,{outfit:'casual',hairStyle:'ponytail',acc:'none',c1:'#f2c14e',c2:'#4a73b8',c3:'#d9556b'})}
  );
  var DEF = JSON.parse(JSON.stringify(PRESETS[0].s));`);
html=mustReplace(html,'  /* ---------- tiện ích dùng chung cho kho ---------- */',module+'\n  /* ---------- tiện ích dùng chung cho kho ---------- */');
html=mustReplace(html,'  var DEF = JSON.parse(JSON.stringify(PRESETS[0].s));',fs.readFileSync(path.join(dir,'character-types-presets.js'),'utf8')+'\n  var DEF = JSON.parse(JSON.stringify(PRESETS[0].s));');
html=mustReplace(html,"['horns', 'Sừng quỷ']];","['horns', 'Sừng quỷ'], ['glasses', 'Kính mắt']];");
html=mustReplace(html,'  loadDB();',"  loadDB();\n  if(migrateCharacterTypes(DB)){try{localStorage.setItem(KEY,JSON.stringify(DB));}catch(e){}} ");
html=mustReplace(html,'function camBox(n) {','function legacyCamBox(n) {');
html=mustReplace(html,'charSvg(eff(t), { vb: VBS[sec.vb] })','charSvg(eff(t), { vb: appearanceViewBox(t,sec) })');
html=mustReplace(html,"var KEY = 'kho5.v1'","var KEY = 'kho2.rig-nu-v2.v1'");
html=mustReplace(html,'function load(o) { S = Object.assign(clone(DEFS), clone(o)); }','function load(o) { S = Object.assign(clone(DEFS), clone(o)); S.pose=RIG.resolve(S.pose); }');
html=mustReplace(html,"(S.pose === 'wave' ? 'g_wave' : (S.pose || 'stand'))","(S.pose || 'stand')");
html=mustReplace(html,"S.pose = b.dataset.pose; change({ nopanel: true });","if(b.dataset.pose==='g_custom'){rigInit();RIGED=true;}else{RIGED=false;} S.pose = b.dataset.pose; change({ nopanel: true });");
html=mustReplace(html,'JSON.parse(localStorage.getItem(KEY))',"JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('kho5.v1'))");
html=mustReplace(html,'  loadDB();','  loadDB();\n  if(!DB.prefs.posesV2 && Array.isArray(DB.prefs.poses)){DB.prefs.posesV2=DB.prefs.poses.map(function(x){return {id:x.id,n:x.n,rig:RIG.pose({pose:"g_custom",cust:x.c},0)};});}');
html=mustReplace(html,"var VIEW = 'front', PLAY = true","var VIEW = 'front', PLAY = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)");
html=mustReplace(html,"var POSES = [['stand', 'Đứng'], ['walk', 'Đi'], ['run', 'Chạy']].concat(GPOSES);","var POSES; // Assigned after the female rig is initialized.");
html=mustReplace(html,'var RIG = createCharacterRig();','var RIG = createCharacterRig();\nPOSES = RIG.poses.concat([["g_custom","Tự tạo"]]);\nvar RIGTIME=0, RIGDT=0, RIGLAST=0, RIGFRAME=null;');
html=mustReplace(html,'  function parts(st, uid, view) {','  function parts(st, uid, view) {\n    return {defs:"",bg:bgMarkup(st),fig:rigFigure(st,{view:view,time:0}).svg};\n');
const renderFns=`  function rigFigure(st,o) { return RIG.render(st,o||{}); }
  function charSvg(E,o) {
    o=o||{};
    var r=rigFigure(E,{view:o.view,time:o.live?RIGTIME:0,dt:o.live?RIGDT:0,live:!!o.live,play:PLAY,skeleton:!!o.skeleton});
    if(o.live)RIGFRAME=r;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(o.vb||'0 0 380 740')+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Nhân vật nữ v2">'+bgMarkup(E)+'<g class="fig" transform="translate(190 70) scale(.77)">'+r.svg+'</g></svg>';
  }
`;
html=replaceBetween(html,'  function charSvg(E, o) {','  var BGC =',renderFns);
const exportFns=`  function svgCode(st) {
    var r=rigFigure(st,{time:RIGTIME,view:VIEW,noShadow:true});
    var box=RIG.exportBox(st);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+box.join(' ')+'" width="'+box[2]+'" height="'+box[3]+'">'+r.svg+'</svg>';
  }
  function remotionCode(st) {
    var cfg=JSON.stringify(st).replace(/</g,'\\u003c');
    return '// @ts-nocheck\\nimport React from "react";\\nimport {useCurrentFrame,useVideoConfig} from "remotion";\\n\\n'+
      RIG.factorySource()+'\\nconst config = '+cfg+';\\nconst nativeBox=createCharacterRig().exportBox(config);\\n'+
      'export const Character = ({size=740,view="front"}) => {\\n'+
      '  const frame=useCurrentFrame(); const {fps}=useVideoConfig();\\n'+
      '  const result=React.useMemo(()=>{\\n'+
      '    const engine=createCharacterRig(); const time=frame/fps; let r;\\n'+
      '    const start=Math.max(0,time-1);\\n'+
      '    for(let t=start;t<time;t+=1/60) r=engine.render(config,{time:t,dt:1/60,live:true,play:true,view});\\n'+
      '    return engine.render(config,{time,dt:1/60,live:true,play:true,view,noShadow:true});\\n'+
      '  },[frame,fps,view]);\\n'+
      '  return <svg viewBox={nativeBox.join(" ")} width={size*nativeBox[2]/nativeBox[3]} height={size} dangerouslySetInnerHTML={{__html:result.svg}}/>;\\n};\\n';
  }
`;
html=replaceBetween(html,'  function svgCode(st) {','\n\n  /* ---------- tiện ích',exportFns+module); // Preserve a single module before utilities.
// The previous block replacement also included module initialization, so restore its extra declarations.
html=mustReplace(html,'var RIG = createCharacterRig();','var RIG = createCharacterRig();\nPOSES=RIG.poses.concat([["g_custom","Tự tạo"]]);\nvar RIGTIME=0,RIGDT=0,RIGLAST=0,RIGFRAME=null;');
html=mustReplace(html,"var CAMB = { full: [0, 0, 380, 740], bust: [60, 14, 260, 330], face: [95, 60, 190, 160] };","var CAMB = { full: [0, 0, 380, 740], bust: [78, 25, 224, 285], face: [111, 60, 158, 155] };");
html=mustReplace(html,"var VBS = { face: '95 60 190 160', eyes: '125 100 130 109', mouth: '150 165 80 67', hair: '90 20 200 168', outfit: '0 200 380 507', bg: '0 0 380 319' };","var VBS = { face: '111 60 158 155', eyes: '139 113 102 60', mouth: '155 151 70 48', hair: '92 20 196 220', outfit: '20 190 340 525', bg: '0 0 380 319' };");
html=mustReplace(html,'data-view="side" aria-pressed="false">Nghiêng</button>','data-view="side" aria-pressed="false">Nghiêng trái</button><button type="button" data-view="right" aria-pressed="false">Nghiêng phải</button>');
html=mustReplace(html,"b.disabled = p === 'stand' ? false : (VIEW === 'back' ? true : (g ? VIEW !== 'front' : false));","b.disabled = false;");
html=mustReplace(html,"pb.title = 'Đi, chạy: góc Trước và Nghiêng. Thả lỏng, che miệng, vẫy tay, chắp tay…: góc Trước'","pb.title = 'Mọi động tác dùng chung bộ khớp nữ v2, xem được ở tất cả góc nhìn'");
html=mustReplace(html,"view: VIEW, anim: PLAY && !RIGED","view: VIEW, anim: PLAY && !RIGED, live: true, skeleton: RIGED");
html=mustReplace(html,"rigOverlay(charSvg(eff(E),","(charSvg(eff(E),");
// Keep renderStage's existing balanced closing parentheses.
const editor=fs.readFileSync(path.join(dir,'rig-editor.js'),'utf8');
html=replaceBetween(html,'  /* ----- Khớp: lớp phủ kéo thả','  /* ----- tuỳ chỉnh ----- */',editor+'\n');
html=mustReplace(html,'title="Hiện các khớp để kéo tạo động tác"','title="Hiện bộ khớp nữ v2 và chỉnh các góc xoay"');
html=mustReplace(html,"var sv = document.querySelector('#stage svg'); if (!sv) return;","RIGDT=0;\n    if(PLAY && !RIGED && !document.hidden && ts-RIGLAST>1000/30){RIGDT=Math.min(.06,(ts-RIGLAST)/1000||dt);RIGLAST=ts;RIGTIME+=RIGDT;var current=$('stage');if(current){var previous=current.querySelector('svg');var next=charSvg(eff(PREVIEW||S),{vb:vbStr(),view:VIEW,live:true});if(previous)previous.outerHTML=next;}} else if(!PLAY||RIGED||document.hidden){RIGLAST=ts;}\n    var sv = document.querySelector('#stage svg'); if (!sv) return;");
const api=`
  window.CharacterStudioV2={
    config:function(){return clone(S);},
    set:function(p){Object.assign(S,p);change();},
    sample:function(config,o){return rigFigure(Object.assign(clone(DEFS),config),o);},
    exportSVG:exportSVG,exportTSX:exportTSX,
    verify:function(){
      var errors=[],count=0,styles={},hairs={},views=['front','side','right','back'];
      function check(c,v,p,t){try{var r=rigFigure(c,{view:v,time:t}),str=r.svg;count++;if(/NaN|Infinity|undefined/.test(str))throw Error('Số không hợp lệ');var doc=new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+str+'</svg>','image/svg+xml');if(doc.querySelector('parsererror'))throw Error('SVG không hợp lệ');var ids=Array.from(doc.querySelectorAll('[id]')).map(function(e){return e.id;});if(new Set(ids).size!==ids.length)throw Error('ID trùng trong SVG');return str;}catch(e){errors.push(c.outfit+'/'+c.hairStyle+'/'+v+'/'+p+': '+e.message);return '';}}
      OUTFITS.forEach(function(o){HAIRS.forEach(function(h){views.forEach(function(v){check(Object.assign(clone(DEFS),{outfit:o[0],hairStyle:h[0],pose:'walk'}),v,'walk',.6);});});styles[o[0]]=check(Object.assign(clone(DEFS),{outfit:o[0]}),'front','stand',0);});
      RIG.poses.forEach(function(p){OUTFITS.forEach(function(o){views.forEach(function(v){check(Object.assign(clone(DEFS),{outfit:o[0],pose:p[0]}),v,p[0],.4);});});});
      HAIRS.forEach(function(h){hairs[h[0]]=check(Object.assign(clone(DEFS),{hairStyle:h[0]}),'front','stand',0);});
      return {outfits:OUTFITS.length,hairs:HAIRS.length,poses:RIG.poses.length,rendered:count,errors:errors};
    }
  };
`;
html=mustReplace(html,'  loadCur(); renderAll(); requestAnimationFrame(frame);',api+'\n  loadCur(); renderAll(); requestAnimationFrame(frame);');
html=mustReplace(html,'</head>',`<style>
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #99baff;outline-offset:3px}
.fig,.blink{animation:none!important}.fig{transform-origin:0 0!important}
.ctrl{flex-wrap:wrap}.ctrl .pz{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));flex:1 0 100%;order:2;max-width:100%;max-height:132px;overflow-y:auto;border-radius:12px;gap:3px;padding:6px;scrollbar-width:thin}.ctrl .pz button{min-height:34px;text-align:left;overflow:hidden;text-overflow:ellipsis}
.rigp .rig-fields{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:8px;width:100%}
.rig-fields label{display:flex;flex-direction:column;gap:3px}.rig-fields input{width:100%}.rig-fields output{font-variant-numeric:tabular-nums}
.rigp .rh{flex-basis:100%}.rig-status{font-size:11px;color:var(--mut)}
@media(max-width:700px){.rigp .rig-fields{grid-template-columns:repeat(2,minmax(110px,1fr))}.ctrl .pz button{min-height:44px}.ctrl .pz{max-height:150px;overflow-y:auto}.mid{min-width:0}.ctrl .vw{flex-wrap:wrap}.ctrl .vw button{min-height:40px}}
</style></head>`);
html=simplifyPreview(html);
html=polishLibraryControls(html);
html=upgradeAppearance(html);
html=enhanceCompareDirect(html);
html=mustReplace(html,"  TABS.push(['Khớp','sliders',[]]);",fs.readFileSync(path.join(dir,'character-types-editor.js'),'utf8')+"\n  TABS.push(['Khớp','sliders',[]]);");
html=mustReplace(html,'function secBody(sec){','function beforeTypesSecBody(sec){');
html=mustReplace(html,"vb:'62 0 256 276'","vb:RIG.frameBox(E,[62,0,256,276],'portrait').join(' ')");
html=html.replaceAll('aria-label="Nhân vật nữ v2"','aria-label="Nhân vật"');
const out=path.join(dir,'Kho nhan vat 2 - Rig nu v2.html');
fs.writeFileSync(out,html,'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(js);
console.log(out+'\n'+fs.statSync(out).size+' bytes; script syntax valid');
