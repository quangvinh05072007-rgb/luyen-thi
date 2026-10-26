/* Older women have their own proportions, age features and scalp silhouettes. */
var ELDER_WOMAN_HAIR=[['eh_lowbun','Búi thấp sau gáy'],['eh_highbun','Búi gọn'],['eh_shortwaves','Uốn sóng ngắn'],['eh_curly','Uốn xoăn nhỏ'],['eh_bob','Bob ngắn'],['eh_swept','Chải lệch sau tai'],['eh_thinbun','Tóc thưa búi sau'],['eh_silvercrop','Tém mềm']];
var ELDER_WOMAN_OUTFITS=[['ew_cardigan','Cardigan + quần vải'],['ew_baba','Áo bà ba + quần suông'],['ew_vest','Ghi lê len + sơ mi'],['ew_longcoat','Áo khoác dáng dài'],['ew_flora','Áo hoa tay lửng'],['ew_tunic','Áo cổ đứng + quần lụa'],['ew_shawl','Khăn choàng + áo len'],['ew_skirt','Áo len + váy dài']];
function isElderWoman(st){return st.ageGroup==='elder'&&effectiveCharacterGender(st)==='female';}
function elderWomenCatalog(){return {hair:deep(ELDER_WOMAN_HAIR),outfits:deep(ELDER_WOMAN_OUTFITS)};}
function isElderWomanOutfit(id){return ELDER_WOMAN_OUTFITS.some(function(x){return x[0]===id;});}
function applyElderWomanAnatomy(st){
 LEN=deep(ANATOMY_LEN);PF=deep(ANATOMY_PF);
 LEN.thigh=176;LEN.shin=156;LEN.spine=138;LEN.neck=16;LEN.shW=47;LEN.hipW=32;LEN.uarm=116;LEN.farm=94;LEN.hand=48;
 PF.uTorso3=[[0,48,34],[.8,47,34],[1.7,47,32],[2.15,48,30],[2.45,30,23],[3,16,15]];
 PF.neck=[[0,15,14],[1,13,12]];PF.armSkin=[[0,21,19],[1,14,13],[2,9.5,9]];
 if(st.bodyShape==='rounded')PF.uTorso3=[[0,53,38],[.8,57,41],[1.7,53,36],[2.15,49,31],[2.45,30,23],[3,16,15]];
}
function elderWomanPosture(p,st){
 var posture=st.elderPosture||(st.bodyShape==='stooped'?'stooped':'relaxed'),d=posture==='upright'?[0,0,0]:posture==='stooped'?[13,5,-8]:[6,2,-4];
 p.thor[0]+=d[0];p.lum[0]+=d[1];p.neck[0]+=d[2];return p;
}
function effectiveElderWomanHair(st){if(ELDER_WOMAN_HAIR.some(function(x){return x[0]===st.hairStyle;}))return st.hairStyle;return ({bun:'eh_lowbun',highbun:'eh_highbun',bob:'eh_bob',pixie:'eh_silvercrop',wavy:'eh_shortwaves'})[st.hairStyle]||'eh_swept';}
function elderWomanHair(st,profile,back,layer){
 var style=effectiveElderWomanHair(st),col=st.hair,hl=kshade(col,-.18),g='',bun=style==='eh_lowbun'||style==='eh_thinbun'||style==='eh_highbun',high=style==='eh_highbun';
 function bunArt(){var x=profile?(high?39:64):0,y=high?-109:profile?44:49,r=high?25:28;return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+r+'" ry="'+(r-3)+'" fill="'+col+'" stroke="'+OUT+'" stroke-width="2.7"/><path d="M'+(x-r*.6)+' '+y+' Q'+x+' '+(y-r*.65)+' '+(x+r*.6)+' '+y+'" fill="none" stroke="'+hl+'" stroke-width="1.7"/>';}
 if(layer==='rear'){
  if(bun&&!back)g+=bunArt();
  if(back){
   var d=style==='eh_bob'?'M-64 -32 Q-66 -99 0 -101 Q66 -99 64 -32 L64 44 Q41 75 0 76 Q-41 75 -64 44Z':style==='eh_curly'?'M-64 -27 Q-78 -35 -68 -48 Q-79 -63 -64 -74 Q-69 -91 -48 -96 Q-40 -112 -23 -103 Q-7 -119 8 -105 Q25 -116 38 -102 Q59 -108 64 -87 Q82 -84 73 -65 Q88 -54 75 -38 Q87 -24 72 -11 L65 35 Q64 54 49 57 Q40 77 23 69 Q0 83 -22 69 Q-42 77 -50 58 Q-67 56 -64 36Z':style==='eh_shortwaves'?'M-65 -29 Q-78 -46 -62 -62 Q-69 -85 -46 -91 Q-28 -115 -4 -103 Q17 -117 39 -98 Q65 -102 67 -77 Q85 -64 71 -45 Q83 -28 67 -13 L63 40 Q47 68 27 65 Q0 81 -27 65 Q-47 68 -63 40Z':'M-63 -28 Q-66 -97 0 -100 Q66 -97 63 -28 L58 31 Q32 65 0 67 Q-32 65 -58 31Z';
   g+=malePath(d,col,2.8);
   if(style==='eh_curly')for(var y=-68;y<=44;y+=27)for(var x=-39;x<=39;x+=26)g+='<path d="M'+x+' '+y+' q-5 -7 2 -9 q10 -1 7 7 q-2 5 -7 2" fill="none" stroke="'+hl+'" stroke-width="1.3" opacity=".65"/>';
   g+='<path d="M-37 -71 Q-4 -98 35 -73 M-41 -54 Q-5 -84 41 -55" fill="none" stroke="'+hl+'" stroke-width="1.7" opacity=".55"/>';
   if(bun)g+=bunArt();
  }
 }else if(!back){
  var frontPaths={
   eh_lowbun:'M-63 9 Q-74 -41 -53 -74 Q-22 -108 0 -94 Q22 -108 53 -74 Q74 -41 63 9 L54 9 L48 -34 Q16 -65 0 -56 Q-16 -65 -48 -34 L-54 9Z',
   eh_highbun:'M-63 9 Q-72 -44 -50 -78 Q0 -114 50 -78 Q72 -44 63 9 L53 9 L48 -38 Q0 -70 -48 -38 L-53 9Z',
   eh_shortwaves:'M-64 12 Q-76 -5 -66 -24 Q-81 -44 -65 -61 Q-69 -83 -45 -90 Q-28 -113 -5 -101 Q17 -117 39 -97 Q65 -100 67 -76 Q82 -63 71 -45 Q82 -26 67 -10 L62 19 L51 17 L48 -32 Q33 -23 20 -39 Q1 -26 -13 -42 Q-31 -29 -48 -36 L-52 16Z',
   eh_curly:'M-63 13 Q-77 -2 -68 -17 Q-81 -32 -70 -45 Q-80 -62 -65 -73 Q-67 -92 -48 -95 Q-40 -111 -24 -103 Q-12 -117 2 -107 Q16 -120 29 -106 Q48 -111 55 -95 Q75 -95 73 -76 Q88 -65 77 -50 Q87 -34 73 -21 L63 13 L52 13 L47 -36 Q25 -25 11 -40 Q-9 -27 -24 -41 Q-37 -32 -48 -38 L-53 13Z',
   eh_bob:'M-63 16 Q-77 -43 -50 -79 Q-13 -114 32 -98 Q77 -75 67 -25 L62 39 L53 48 L48 -25 Q20 -65 -21 -36 L-49 -20 L-54 47Z',
   eh_swept:'M-63 8 Q-73 -41 -50 -79 Q-12 -112 35 -95 Q78 -69 66 -23 L60 13 L52 12 L47 -32 Q12 -70 -32 -37 L-51 -23 L-54 8Z',
   eh_thinbun:'M-62 8 Q-67 -45 -44 -76 Q0 -104 44 -76 Q67 -45 62 8 L53 8 L47 -38 Q0 -68 -47 -38 L-53 8Z',
   eh_silvercrop:'M-62 11 Q-72 -17 -66 -45 Q-66 -98 -11 -102 Q44 -109 63 -68 L65 -18 L59 13 L50 11 L46 -25 L32 -20 L17 -36 L3 -27 L-14 -40 L-32 -27 L-47 -33 L-53 11Z'
  };
  var profilePaths={
   eh_lowbun:'M-59 -31 Q-70 -67 -35 -96 Q11 -112 51 -81 Q76 -52 66 -16 L56 27 L45 29 L40 -10 Q51 -28 32 -25 L19 -51 Q-9 -65 -45 -29Z',
   eh_highbun:'M-58 -31 Q-67 -70 -31 -98 Q16 -114 54 -77 Q74 -47 65 -16 L55 27 L44 29 L39 -10 Q51 -28 32 -25 L20 -49 Q-8 -65 -43 -30Z',
   eh_shortwaves:'M-59 -28 Q-72 -40 -63 -58 Q-72 -78 -48 -87 Q-34 -111 -10 -101 Q14 -117 34 -95 Q59 -100 63 -77 Q83 -68 71 -47 Q85 -29 70 -14 L59 30 L45 29 L40 -10 Q53 -28 32 -25 L18 -43 Q1 -30 -15 -43 L-37 -29Z',
   eh_curly:'M-59 -28 Q-74 -39 -65 -56 Q-73 -73 -53 -83 Q-54 -101 -32 -102 Q-16 -119 1 -107 Q22 -120 36 -102 Q60 -107 64 -86 Q83 -83 75 -65 Q89 -51 76 -35 Q87 -20 71 -9 L60 29 L45 31 L40 -12 Q53 -28 32 -25 L18 -43 Q-1 -30 -15 -43 L-39 -29Z',
   eh_bob:'M-59 -26 Q-74 -66 -35 -98 Q13 -115 53 -80 Q78 -53 69 -13 L63 56 Q48 74 32 68 L34 30 L40 -7 Q53 -25 32 -24 L20 -43 Q-6 -65 -43 -27Z',
   eh_swept:'M-59 -28 Q-70 -68 -30 -99 Q17 -115 54 -79 Q77 -51 67 -17 L56 27 L45 29 L40 -10 Q53 -28 32 -25 L20 -49 Q-9 -65 -43 -28Z',
   eh_thinbun:'M-57 -33 Q-64 -72 -26 -96 Q20 -109 53 -73 Q72 -46 63 -15 L54 25 L44 28 L39 -10 Q51 -28 32 -25 L21 -50 Q-9 -64 -43 -31Z',
   eh_silvercrop:'M-58 -28 Q-73 -60 -44 -86 Q-8 -115 33 -97 Q70 -82 67 -44 L61 -10 L54 23 L44 26 L39 -11 Q51 -28 32 -25 L21 -43 L3 -35 L-13 -48 L-38 -30Z'
  };
  g+=malePath(profile?profilePaths[style]:frontPaths[style],col,2.8);
  if(style==='eh_curly'){
   for(var i=0;i<5;i++){var x=-44+i*22,y=-76-15*Math.sqrt(Math.max(0,1-(x/60)*(x/60)));g+='<path d="M'+(profile?x+9:x)+' '+y+' q-5 -7 2 -9 q10 -1 7 7 q-2 5 -7 2" fill="none" stroke="'+hl+'" stroke-width="1.4" opacity=".7"/>';}
  }else if(style==='eh_shortwaves')g+='<path d="M-32 -74 Q-18 -91 -4 -77 Q13 -94 29 -77 M-37 -60 Q-20 -74 -5 -62" fill="none" stroke="'+hl+'" stroke-width="1.9" opacity=".65"/>';
  else g+='<path d="M-37 -72 Q0 -100 37 -72 M-41 -58 Q0 -87 41 -58" fill="none" stroke="'+hl+'" stroke-width="1.7" opacity=".6"/>';
  if(style==='eh_thinbun')g+='<path d="M0 -94 Q-4 -73 -1 -59" fill="none" stroke="'+SKIN+'" stroke-width="6" stroke-linecap="round"/>';
 }
 return '<g data-edit-part="hairStyle" data-elder-woman-hair="'+style+'">'+g+'</g>';
}
function elderWomanEye(x,y,profile){
 var st=ACT,id='we'+(++UID),w=profile?12:15,d='M-'+w+' 0 Q0 -12 '+w+' -1 Q0 9 -'+w+' 0Z',en=kEyeNew(st,{w:w,h:8,irx:7,iry:8,cx:0}),g='';
 if(BLINK>.5||st.eyeStyle==='happy')g='<path d="M-'+w+' 0 Q0 7 '+w+' 0" fill="none" stroke="'+OUT+'" stroke-width="2.6" stroke-linecap="round"/>';
 else {var inner=en?'<rect x="-20" y="-16" width="40" height="32" fill="'+en.base+'"/>'+en.art:'<rect x="-20" y="-16" width="40" height="32" fill="#f8f4ef"/><ellipse rx="7" ry="8" fill="'+st.eye+'" stroke="'+kshade(st.eye,-.4)+'" stroke-width="1.5"/><ellipse rx="3" ry="5" fill="'+OUT+'"/><circle cx="-2" cy="-3" r="2" fill="#fff"/>';g='<defs><clipPath id="'+id+'"><path d="'+d+'"/></clipPath></defs><g clip-path="url(#'+id+')">'+inner+'</g><path d="'+d+'" fill="none" stroke="'+OUT+'" stroke-width="2.1"/><path d="M-'+w+' 0 Q0 -12 '+w+' -1 M-'+w+' 0 l-3 -3" fill="none" stroke="'+OUT+'" stroke-width="2.7" stroke-linecap="round"/>';}
 g+='<path d="M-'+(w-2)+' 11 Q0 16 '+(w-2)+' 10" fill="none" stroke="'+SKINSH+'" stroke-width="1.5" opacity=".75"/>';
 return '<g class="elder-woman-eye" data-edit-part="eyes" transform="translate('+x+' '+y+')">'+g+'</g>';
}
function elderWomanBrow(profile){
 var e=ACT.expr||'smile',d=profile?({neutral:'M-51 -16 Q-36 -19 -24 -16',sad:'M-51 -11 Q-36 -16 -24 -24',shy:'M-51 -12 Q-36 -20 -24 -16',grin:'M-51 -18 Q-36 -30 -24 -18',creepy:'M-51 -25 L-24 -14'}[e]||'M-51 -16 Q-36 -23 -24 -17'):({neutral:'M-43 -16 Q-28 -19 -14 -16 M14 -16 Q28 -19 43 -16',sad:'M-43 -12 Q-28 -17 -14 -25 M14 -25 Q28 -17 43 -12',shy:'M-43 -11 Q-28 -20 -14 -15 M14 -15 Q28 -20 43 -11',grin:'M-43 -18 Q-28 -30 -14 -18 M14 -18 Q28 -30 43 -18',creepy:'M-43 -25 L-14 -14 M14 -14 L43 -25'}[e]||'M-43 -16 Q-28 -24 -14 -17 M14 -17 Q28 -24 43 -16');
 return '<path data-edit-part="expr" d="'+d+'" fill="none" stroke="'+kshade(ACT.hair,-.35)+'" stroke-width="2.8" stroke-linecap="round"/>';
}
function elderWomanMouth(profile){
 var e=ACT.expr||'smile',filled=['grin','creepy'].indexOf(e)>=0,d=profile?({neutral:'M-65 50 L-49 50',sad:'M-65 53 Q-57 46 -49 52',shy:'M-65 50 Q-61 54 -57 50 Q-53 54 -49 50',grin:'M-67 47 Q-57 65 -46 46 Q-57 53 -67 47Z',creepy:'M-69 46 Q-56 69 -44 45 Q-57 54 -69 46Z'}[e]||'M-65 49 Q-57 56 -49 48'):({neutral:'M-12 54 L12 54',sad:'M-13 58 Q0 49 13 58',shy:'M-11 53 Q-5 58 0 53 Q5 58 11 53',grin:'M-18 49 Q0 75 18 49 Q0 58 -18 49Z',creepy:'M-21 47 Q0 80 21 47 Q0 59 -21 47Z'}[e]||'M-13 52 Q0 62 13 52');
 return '<g data-edit-part="expr"><path d="'+d+'" fill="'+(filled?(e==='creepy'?'#4a1019':'#2a0a10'):'none')+'" stroke="'+(filled?OUT:'#7a3a45')+'" stroke-width="2.3" stroke-linecap="round"/></g>';
}
function elderWomanAgeLines(profile){
 var mode=ACT.faceDetail||'auto';if(mode==='none')return '';
 var col=kshade(SKIN,-.29),g='';
 if(mode==='auto'||mode==='wrinkles'){
  var paths=profile?['M-48 -33 Q-32 -39 -16 -33','M-45 -26 Q-32 -29 -20 -25','M-21 15 l9 3 M-22 22 l8 5','M-57 35 Q-49 43 -52 56','M-49 68 Q-31 77 -13 68']:['M-27 -35 Q0 -42 27 -35','M-23 -28 Q0 -33 23 -28','M-45 15 l-8 3 M-44 23 l-8 5 M45 15 l8 3 M44 23 l8 5','M-17 34 Q-28 45 -23 61 M17 34 Q28 45 23 61','M-17 69 Q0 76 17 69','M-10 78 Q0 82 10 78'];
  g='<g class="age-lines" fill="none" stroke="'+col+'" stroke-width="1.7" opacity=".72" stroke-linecap="round">'+paths.map(function(d){return '<path d="'+d+'"/>';}).join('')+'</g>';
 }
 if(mode==='freckles'){var dots=profile?[[-28,29],[-21,34],[-32,36]]:[[-37,30],[-30,35],[-42,37],[37,30],[30,35],[42,37]];g+='<g fill="'+col+'">'+dots.map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.5"/>';}).join('')+'</g>';}
 return '<g data-edit-part="identity">'+g+'</g>';
}
function elderWomanHeadArt(theta){
 var st=ACT,t=((theta+540)%360)-180,a=Math.abs(t),back=a>=135,profile=a>45&&!back,g=elderWomanHair(st,profile,back,'rear');
 if(back)return '<g data-elder-woman-head="back">'+g+'</g>';
 if(profile){
  var chin=st.faceShape==='long'?'Q-59 90 -36 96 Q5 87 44 43':st.faceShape==='round'?'Q-62 83 -38 89 Q4 92 44 43':'Q-58 85 -35 89 Q5 85 44 43';
  g+=malePath('M-48 -75 Q-65 -51 -59 -24 L-55 -5 Q-55 10 -66 18 L-77 26 Q-82 31 -71 35 L-63 37 L-63 44 Q-72 49 -64 54 L-62 63 '+chin+' Q68 18 64 -32 Q64 -78 26 -94 Q-17 -108 -48 -75Z',SKIN,3);
  g+=elderWomanEye(-39,9,true)+elderWomanBrow(true)+elderWomanAgeLines(true)+elderWomanMouth(true);
  g+=malePath('M35 2 Q55 -9 53 14 Q47 32 36 26Z',SKIN,2.5)+'<path d="M42 8 q11 -1 3 14" fill="none" stroke="'+SKINSH+'" stroke-width="1.8"/>';
  if(st.blush||st.expr==='shy')g+='<ellipse cx="-27" cy="31" rx="10" ry="5" fill="#e8757f" opacity=".2"/>';
 }else{
  [-1,1].forEach(function(k){g+='<ellipse cx="'+k*62+'" cy="12" rx="9" ry="16" fill="'+SKIN+'" stroke="'+OUT+'" stroke-width="2.5"/>';});
  var lower=st.faceShape==='round'?'L65 15 Q68 51 45 69 Q46 79 28 85 Q0 98 -28 85 Q-46 79 -45 69 Q-68 51 -65 15Z':st.faceShape==='long'?'L59 15 Q59 55 39 74 Q38 86 20 93 Q0 102 -20 93 Q-38 86 -39 74 Q-59 55 -59 15Z':'L62 15 Q63 52 42 70 Q42 82 23 87 Q0 96 -23 87 Q-42 82 -42 70 Q-63 52 -62 15Z';
  g+=malePath('M-62 -37 C-64 -76 -36 -96 0 -97 C36 -96 64 -76 62 -37 '+lower,SKIN,3);
  g+=elderWomanEye(-28,9,false)+elderWomanEye(28,9,false)+elderWomanBrow(false)+'<path d="M-3 23 l-5 13 q8 5 15 0" fill="none" stroke="'+SKINSH+'" stroke-width="1.9" stroke-linecap="round"/>'+elderWomanAgeLines(false)+elderWomanMouth(false);
  if(st.blush||st.expr==='shy')g+='<g fill="#e8757f" opacity=".2"><ellipse cx="-39" cy="33" rx="10" ry="5"/><ellipse cx="39" cy="33" rx="10" ry="5"/></g>';
 }
 g+=elderWomanHair(st,profile,false,'front');if(profile&&t<0)g='<g transform="scale(-1 1)">'+g+'</g>';
 return '<g data-elder-woman-head="'+(profile?'profile':'front')+'">'+g+'</g>';
}
