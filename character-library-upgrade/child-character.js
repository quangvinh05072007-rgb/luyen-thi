/* Child anatomy and artwork. Adult character artwork is unchanged. */
var CHILD_HAIR_BOY=[['cb_crop','Mái ngắn gọn'],['cb_bowl','Đầu nấm'],['cb_side','Mái lệch'],['cb_spike','Tóc dựng nhẹ'],['cb_curls','Xoăn bông'],['cb_tousled','Tóc rối tự nhiên']];
var CHILD_HAIR_GIRL=[['cg_bob','Bob mái bằng'],['cg_pigtails','Hai chùm ngắn'],['cg_braids','Hai bím tóc'],['cg_buns','Búi đôi'],['cg_pony','Đuôi ngựa nhỏ'],['cg_waves','Xoăn ngang vai']];
var CHILD_OUTFIT_BOY=[['kb_tee_shorts','Áo thun + soóc'],['kb_polo','Polo bé trai'],['kb_dungarees','Quần yếm bé trai'],['kb_hoodie','Hoodie trẻ em'],['kb_sport','Thể thao bé trai'],['kb_school','Đồng phục bé trai']];
var CHILD_OUTFIT_GIRL=[['kg_pinafore','Váy yếm sơ mi'],['kg_sundress','Váy xoè bé gái'],['kg_tee_skirt','Áo thun + chân váy'],['kg_overalls','Quần yếm bé gái'],['kg_cardigan','Cardigan + váy'],['kg_school','Đồng phục bé gái']];
function childCatalog(gender){return {hair:deep(gender==='male'?CHILD_HAIR_BOY:gender==='female'?CHILD_HAIR_GIRL:CHILD_HAIR_BOY.concat(CHILD_HAIR_GIRL)),outfits:deep(gender==='male'?CHILD_OUTFIT_BOY:gender==='female'?CHILD_OUTFIT_GIRL:CHILD_OUTFIT_BOY.concat(CHILD_OUTFIT_GIRL))};}
function characterChoices(st,kind,all){
  if(st.ageGroup==='child')return childCatalog(effectiveCharacterGender(st))[kind];
  if(isElderWoman(st))return elderWomenCatalog()[kind];
  if(effectiveCharacterGender(st)==='male')return maleWardrobeCatalog()[kind];
  var excluded=maleWardrobeCatalog()[kind].concat(childCatalog('all')[kind],elderWomenCatalog()[kind]);
  return all.filter(function(x){return !excluded.some(function(e){return e[0]===x[0];});});
}
function isChildOutfit(id){return CHILD_OUTFIT_BOY.concat(CHILD_OUTFIT_GIRL).some(function(x){return x[0]===id;});}
function applyChildAnatomy(st){
  LEN=deep(ANATOMY_LEN);PF=deep(ANATOMY_PF);
  LEN.thigh=145;LEN.shin=128;LEN.uarm=90;LEN.farm=78;LEN.hand=38;LEN.shW=41;LEN.hipW=26;LEN.spine=118;LEN.neck=16;
  PF.uTorso3=[[0,42,29],[.8,41,29],[1.7,43,29],[2.15,46,29],[2.45,27,21],[3,15,14]];
  PF.neck=[[0,14,13],[1,12,11]];PF.armSkin=[[0,18,16],[1,13,12],[2,9,8]];
  PF.legSkin=[[0,27,24],[.5,26,23],[1,20,18],[1.35,21,19],[2,13,12],[3,12,11]];
  if(st.bodyShape==='rounded')PF.uTorso3=[[0,45,33],[.8,49,36],[1.7,47,32],[2.15,46,29],[2.45,27,21],[3,15,14]];
}
function anatomyHeadOffset(st){return st.ageGroup==='child'?109:isElderWoman(st)?30:0;}
function effectiveChildHair(st){
 var list=childCatalog(effectiveCharacterGender(st)).hair;if(list.some(function(x){return x[0]===st.hairStyle;}))return st.hairStyle;
 if(effectiveCharacterGender(st)==='male')return ({messy:'cb_tousled',curlyshort:'cb_curls',sidepart:'cb_side'})[st.hairStyle]||'cb_crop';
 return ({twin:'cg_pigtails',braid:'cg_braids',bun:'cg_buns',highbun:'cg_buns',ponytail:'cg_pony',wavy:'cg_waves'})[st.hairStyle]||'cg_bob';
}
function childHairArt(st,profile,back,layer){
 var style=effectiveChildHair(st),girl=style.indexOf('cg_')===0,col=st.hair,hl=kshade(col,.3),g='',d='',swing=clamp((SEC.o[0]||0)*.12,-5,5);
 if(layer==='rear'){
  if(style==='cg_pigtails'||style==='cg_braids'){
   (profile?[1]:[-1,1]).forEach(function(k){var x=profile?65:k*65,y=style==='cg_braids'?5:-25;
    var tail=style==='cg_braids'?'M-9 0 Q-15 30 -9 63 L-3 98 L6 98 L13 63 Q16 30 9 0Z':'M-8 0 Q-36 2 -32 43 Q-26 71 -9 93 Q13 74 17 41 Q23 10 8 0Z';
    g+='<g transform="translate('+x+' '+y+') rotate('+(profile?-16:k*-24+swing)+')">'+malePath(tail,col,2.6);
    if(style==='cg_braids')for(var i=4;i<83;i+=14)g+='<path d="M-10 '+i+' l20 10 l-19 11" fill="none" stroke="'+hl+'" stroke-width="2"/>';
    g+='<ellipse cy="'+(style==='cg_braids'?88:5)+'" rx="10" ry="5" fill="'+st.c3+'" stroke="'+OUT+'" stroke-width="1.7"/></g>';
   });
  }
  if(style==='cg_buns')(profile?[1]:[-1,1]).forEach(function(k){g+='<circle cx="'+(profile?65:k*65)+'" cy="-67" r="23" fill="'+col+'" stroke="'+OUT+'" stroke-width="2.8"/>';});
  var pony=style==='cg_pony'?'<g data-child-pony="true" transform="rotate('+swing+' '+(profile?66:0)+' -48)">'+malePath(profile?'M61 -53 Q111 -66 107 -15 Q105 28 84 76 Q58 44 66 7 Q79 -16 61 -53Z':'M-12 -52 Q38 -69 46 -22 Q58 18 33 86 Q4 63 1 24 Q15 -10 -12 -52Z',col,2.8)+'</g>':'';
  if(!back)g+=pony;
  if(girl){d=profile?(style==='cg_waves'?'M-54 -44 Q-49 -100 14 -100 Q78 -100 78 -33 Q91 -14 79 10 Q94 39 77 57 Q92 85 58 92 L30 72 L-9 68Z':'M-58 -37 Q-61 -101 9 -102 Q80 -97 76 -29 L70 49 Q63 75 26 77 L-43 66Z'):(style==='cg_waves'?'M-65 -30 Q-71 -104 0 -105 Q71 -104 65 -30 Q84 -12 72 9 Q91 32 77 50 Q93 77 66 90 L44 78 Q0 95 -44 78 L-67 90 Q-93 76 -77 51 Q-93 29 -74 9 Q-86 -12 -65 -30Z':'M-65 -28 Q-72 -105 0 -104 Q72 -105 65 -28 L69 48 Q60 80 0 80 Q-60 80 -69 48Z');g+=malePath(d,col,3);}
  else if(back){d=style==='cb_curls'?'M-65 -25 Q-82 -39 -67 -52 Q-76 -75 -55 -81 Q-57 -102 -33 -103 Q-18 -119 0 -106 Q18 -121 36 -105 Q59 -109 63 -86 Q85 -80 73 -61 Q85 -43 66 -26 L57 34 Q31 68 0 69 Q-31 68 -57 34Z':style==='cb_spike'?'M-65 -22 L-68 -60 L-48 -58 L-46 -91 L-26 -83 L-9 -113 L10 -92 L29 -104 L37 -85 L61 -85 L67 -26 L57 34 Q31 68 0 69 Q-31 68 -57 34Z':'M-65 -23 Q-69 -100 0 -103 Q69 -100 65 -23 L57 34 Q31 68 0 69 Q-31 68 -57 34Z';g+=malePath(d,col,3);}
  if(back&&girl)g+='<path d="M0 -98 Q-7 -32 0 53" stroke="'+hl+'" stroke-width="2" opacity=".45" fill="none"/>';
  if(back&&pony)g+=pony+'<ellipse cy="-49" rx="12" ry="5" fill="'+st.c3+'" stroke="'+OUT+'" stroke-width="1.8"/>';
 }else if(!back){
  var fronts={
   cb_crop:'M-63 6 L-66 -40 Q-60 -102 0 -103 Q60 -102 66 -40 L63 6 L54 6 L50 -25 L31 -22 L13 -34 L-4 -23 L-24 -35 L-49 -23 L-54 6Z',
   cb_bowl:'M-63 13 Q-80 -45 -46 -85 Q0 -115 46 -85 Q80 -45 63 13 L51 13 L48 -16 L31 -17 L16 -21 L0 -18 L-16 -21 L-31 -17 L-48 -16 L-51 13Z',
   cb_side:'M-64 7 Q-75 -46 -50 -84 Q-16 -114 31 -99 Q75 -80 65 -30 L60 8 L50 7 L47 -24 Q17 -60 -25 -30 L-48 -13 L-53 8Z',
   cb_spike:'M-64 7 L-69 -33 L-67 -61 L-48 -58 L-46 -91 L-26 -83 L-9 -113 L10 -92 L29 -104 L37 -85 L61 -85 L68 -30 L63 7 L53 7 L48 -26 L28 -19 L8 -34 L-9 -23 L-30 -34 L-49 -22 L-54 7Z',
   cb_curls:'M-64 8 L-68 -23 Q-82 -34 -71 -50 Q-80 -73 -58 -78 Q-61 -102 -36 -103 Q-18 -122 0 -107 Q17 -122 35 -105 Q59 -109 63 -85 Q83 -79 73 -59 Q87 -43 69 -27 L63 8 L53 8 L49 -24 Q33 -12 18 -26 Q1 -12 -15 -27 Q-35 -17 -49 -25 L-54 8Z',
   cb_tousled:'M-64 7 L-66 -31 Q-72 -53 -61 -68 Q-70 -88 -43 -88 Q-36 -108 -16 -98 Q1 -115 18 -101 Q43 -108 49 -87 Q74 -84 68 -61 L65 -28 L63 7 L53 7 L49 -23 Q34 -17 23 -28 Q11 -13 -3 -26 Q-17 -16 -29 -29 L-49 -21 L-54 7Z',
   cg_bob:'M-65 18 Q-79 -46 -47 -88 Q0 -112 47 -88 Q79 -46 65 18 L57 48 L51 -14 L35 -15 L17 -20 L0 -16 L-17 -20 L-35 -15 L-51 -14 L-57 48Z'
  };
  if(profile){
   d=style==='cb_curls'?'M-57 -24 Q-76 -33 -67 -53 Q-76 -72 -53 -84 Q-48 -108 -24 -103 Q-4 -122 18 -107 Q44 -112 54 -88 Q78 -84 71 -57 Q82 -41 69 -23 L58 25 L45 29 L39 -13 Q51 -28 32 -24 L18 -45 Q0 -23 -17 -34 L-38 -21Z':style==='cb_bowl'?'M-59 -14 Q-75 -62 -37 -94 Q9 -116 50 -86 Q75 -58 68 -17 L58 26 L44 29 L39 -11 Q50 -26 33 -24 L23 -26 L-5 -22 L-35 -18Z':style==='cb_spike'||style==='cb_tousled'?'M-59 -24 L-68 -53 L-58 -57 L-62 -83 L-39 -81 L-25 -108 L-7 -95 L10 -112 L27 -94 L49 -97 L55 -78 L72 -67 L67 -17 L57 27 L45 29 L39 -12 Q51 -28 32 -24 L20 -43 L-4 -30 L-23 -41 L-41 -24Z':girl?'M-58 -22 Q-71 -65 -33 -96 Q16 -117 53 -82 Q77 -58 68 -15 L59 29 L46 29 L41 -11 Q54 -28 32 -25 L22 -30 L7 -21 L-8 -31 L-26 -22 L-44 -27Z':'M-59 -24 Q-70 -66 -31 -96 Q14 -114 51 -83 Q77 -59 68 -17 L58 27 L45 29 L39 -12 Q51 -28 32 -24 L21 -46 L-9 -39 L-35 -24Z';
   if(style==='cb_tousled')d='M-59 -24 Q-71 -49 -60 -67 Q-67 -88 -43 -89 Q-28 -111 -8 -99 Q13 -115 31 -100 Q53 -103 57 -83 Q77 -79 69 -55 L67 -17 L57 27 L45 29 L39 -12 Q51 -28 32 -24 L20 -43 Q3 -31 -10 -39 Q-28 -25 -41 -31Z';
   if(style==='cb_side')d='M-59 -21 Q-74 -64 -32 -98 Q14 -115 50 -84 Q77 -59 68 -17 L58 27 L45 29 L39 -12 Q51 -28 32 -24 L19 -48 Q-9 -66 -41 -26Z';
   if(girl)d=style==='cg_bob'?'M-58 -17 Q-72 -64 -35 -95 Q14 -115 54 -81 Q77 -56 68 -14 L61 38 L53 41 L49 -3 Q52 -22 36 -22 L25 -24 L7 -20 L-8 -23 L-25 -20 L-43 -23Z':'M-58 -22 Q-72 -65 -33 -96 Q16 -117 53 -82 Q77 -58 68 -15 L60 37 L52 41 L48 -7 Q51 -23 35 -22 L24 -44 Q-6 -67 -36 -29 L-48 -17Z';
  }else d=fronts[style]||'M-64 7 Q-77 -47 -48 -87 Q-20 -111 0 -96 Q20 -111 48 -87 Q77 -47 64 7 L53 8 L49 -25 Q18 -65 0 -54 Q-18 -65 -49 -25 L-53 8Z';
  g+=malePath(d,col,2.8);
  if(style==='cb_side'||girl&&style!=='cg_bob')g+='<path d="M'+(profile?'-30 -75 Q8 -100 43 -64':'-36 -73 Q0 -98 36 -73')+'" fill="none" stroke="'+hl+'" stroke-width="2.8" opacity=".5"/>';
 }
 return '<g data-edit-part="hairStyle" data-child-hair="'+style+'">'+g+'</g>';
}
function childEye(x,y,profile){
 var st=ACT,id='ce'+(++UID),w=profile?13:16,h=profile?12:12,g='',en=kEyeNew(st,{w:w,h:h,irx:profile?8:9,iry:11,cx:0});
 if(BLINK>.5||st.eyeStyle==='happy')g='<path d="M-'+w+' 0 Q0 11 '+w+' 0" fill="none" stroke="'+OUT+'" stroke-width="2.6" stroke-linecap="round"/>';
 else {var inner=en?'<rect x="-20" y="-16" width="40" height="32" fill="'+en.base+'"/>'+en.art:'<rect x="-20" y="-16" width="40" height="32" fill="#f9f5f1"/><ellipse rx="'+(profile?8:9)+'" ry="11" fill="'+st.eye+'" stroke="'+kshade(st.eye,-.4)+'" stroke-width="1.5"/><ellipse rx="3.6" ry="6" fill="'+OUT+'"/><ellipse cx="-3" cy="-4" rx="2.6" ry="3.2" fill="#fff"/><circle cx="4" cy="5" r="1.4" fill="#fff"/>';g='<defs><clipPath id="'+id+'"><ellipse rx="'+w+'" ry="'+h+'"/></clipPath></defs><g clip-path="url(#'+id+')">'+inner+'</g><ellipse rx="'+w+'" ry="'+h+'" fill="none" stroke="'+OUT+'" stroke-width="2.2"/><path d="M-'+w+' 0 Q-'+w+' -'+(h+3)+' 0 -'+h+' Q'+w+' -'+(h+3)+' '+w+' 0" fill="none" stroke="'+OUT+'" stroke-width="2.5"/>';}
 return '<g class="child-eye" data-edit-part="eyes" transform="translate('+x+' '+y+')">'+g+'</g>';
}
function childMouth(profile){
 var e=ACT.expr||'smile',filled=['grin','creepy'].indexOf(e)>=0;
 var d=profile?({neutral:'M-61 45 l13 0',sad:'M-61 48 Q-55 43 -49 47',shy:'M-62 45 Q-58 49 -55 45 Q-51 49 -48 45',grin:'M-63 43 Q-55 58 -46 43 Q-55 47 -63 43Z',creepy:'M-64 42 Q-54 62 -44 41 Q-55 48 -64 42Z'}[e]||'M-62 44 Q-55 50 -48 43'):({neutral:'M-10 43 L10 43',sad:'M-11 47 Q0 40 11 47',shy:'M-10 43 Q-5 48 0 43 Q5 48 10 43',grin:'M-16 38 Q0 63 16 38 Q0 47 -16 38Z',creepy:'M-19 37 Q0 67 19 37 Q0 48 -19 37Z'}[e]||'M-12 40 Q0 51 12 40');
 return '<g data-edit-part="expr"><path d="'+d+'" fill="'+(filled?(e==='creepy'?'#4a1019':'#2a0a10'):'none')+'" stroke="'+(filled?OUT:'#7a3a45')+'" stroke-width="2.3" stroke-linecap="round"/></g>';
}
function childBrow(profile){
 var e=ACT.expr||'smile',d=profile?({neutral:'M-50 -17 Q-36 -20 -23 -17',sad:'M-50 -12 Q-36 -17 -23 -26',shy:'M-50 -13 Q-36 -21 -23 -16',grin:'M-50 -18 Q-36 -31 -23 -18',creepy:'M-51 -24 L-23 -13'}[e]||'M-50 -15 Q-36 -23 -23 -16'):({neutral:'M-42 -18 Q-27 -21 -13 -18 M13 -18 Q27 -21 42 -18',sad:'M-42 -14 Q-27 -18 -13 -27 M13 -27 Q27 -18 42 -14',shy:'M-42 -13 Q-27 -21 -13 -17 M13 -17 Q27 -21 42 -13',grin:'M-42 -19 Q-27 -32 -13 -19 M13 -19 Q27 -32 42 -19',creepy:'M-42 -25 L-13 -15 M13 -15 L42 -25'}[e]||'M-42 -17 Q-27 -25 -13 -18 M13 -18 Q27 -25 42 -17');
 return '<path data-edit-part="expr" d="'+d+'" fill="none" stroke="'+kshade(ACT.hair,.05)+'" stroke-width="2.8" stroke-linecap="round"/>';
}
function childHeadArt(theta){
 var st=ACT,t=((theta+540)%360)-180,a=Math.abs(t),back=a>=135,profile=a>45&&!back,g=childHairArt(st,profile,back,'rear');
 if(back)return '<g data-child-head="back">'+g+'</g>';
 if(profile){
  g+=malePath('M-48 -73 Q-61 -49 -56 -18 L-53 -4 Q-53 9 -64 17 L-73 25 Q-76 30 -67 32 L-58 33 Q-65 41 -61 45 Q-68 49 -60 53 L-56 60 Q-44 75 -24 73 Q15 67 44 36 Q69 13 62 -36 Q60 -82 23 -94 Q-20 -106 -48 -73Z',SKIN,3);
  g+=childEye(-37,5,true)+childBrow(true);
  if(st.blush||st.expr==='shy')g+='<ellipse cx="-26" cy="29" rx="11" ry="6" fill="#ed8f8d" opacity=".3"/>';
  g+=childMouth(true)+malePath('M33 1 Q55 -10 53 13 Q49 31 36 25Z',SKIN,2.5);
 }else{
  [-1,1].forEach(function(k){g+='<ellipse cx="'+k*60+'" cy="9" rx="10" ry="15" fill="'+SKIN+'" stroke="'+OUT+'" stroke-width="2.5"/>';});
  var round=st.faceShape==='round'||st.faceShape==='original',chin=round?'Q0 83 -36 67':st.faceShape==='heart'?'Q0 88 -34 65':'Q0 80 -35 65';
  g+=malePath('M-61 -28 C-66 -73 -37 -96 0 -97 C37 -96 66 -73 61 -28 L62 12 Q64 48 '+(round?'36 67':'35 65')+' '+chin+' Q-64 48 -62 12Z',SKIN,3);
  g+=childEye(-27,5,false)+childEye(27,5,false)+childBrow(false)+'<path d="M-3 23 q3 4 7 0" fill="none" stroke="'+SKINSH+'" stroke-width="2" stroke-linecap="round"/>';
  if(st.blush||st.expr==='shy')g+='<g fill="#ed8f8d" opacity=".3"><ellipse cx="-40" cy="28" rx="11" ry="6"/><ellipse cx="40" cy="28" rx="11" ry="6"/></g>';
  g+=childMouth(false);
 }
 if(st.faceDetail==='freckles'){var dots=profile?[[-28,27],[-21,31],[-32,34]]:[[-37,26],[-29,30],[-42,33],[37,26],[29,30],[42,33]];g+='<g fill="'+kshade(SKIN,-.28)+'">'+dots.map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.5"/>';}).join('')+'</g>';}
 g+=childHairArt(st,profile,false,'front');if(profile&&t<0)g='<g transform="scale(-1 1)">'+g+'</g>';
 return '<g data-child-head="'+(profile?'profile':'front')+'">'+g+'</g>';
}
