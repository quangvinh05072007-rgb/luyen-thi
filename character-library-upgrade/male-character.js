/* Separate male artwork, sharing the same pose engine, palette and eye choices. */
var ANATOMY_LEN=deep(LEN),ANATOMY_PF=deep(PF);
function effectiveCharacterGender(st){return st.gender==='male'||st.gender==='female'?st.gender:st.templateKey==='child-boy'?'male':'female';}
function applyCharacterAnatomy(st){
  _rc.p=null;_rc.J=null;
  LEN=ANATOMY_LEN;PF=ANATOMY_PF;
  if(st.ageGroup==='child'){applyChildAnatomy(st);return;}
  if(isElderWoman(st)){applyElderWomanAnatomy(st);return;}
  if(st.gender!=='male')return;
  LEN=deep(ANATOMY_LEN);PF=deep(ANATOMY_PF);
  LEN.shW=64;LEN.hipW=29;LEN.spine=150;LEN.uarm=124;LEN.farm=102;
  PF.uTorso3=[[0,48,33],[.8,44,32],[1.7,57,36],[2.15,64,37],[2.45,36,27],[3,23,21]];
  PF.neck=[[0,22,20],[1,20,18]];
  if(st.bodyShape==='rounded')PF.uTorso3=[[0,55,40],[.8,67,47],[1.3,69,48],[1.7,65,43],[2.15,64,37],[2.45,36,27],[3,23,21]];
  if(st.bodyShape==='athletic'){
    LEN.shW=70;PF.uTorso3=[[0,48,34],[.8,46,33],[1.7,64,39],[2.15,70,39],[2.45,38,28],[3,24,22]];
    PF.armSkin=PF.armSkin.map(function(w){return [w[0],w[1]*1.15,w[2]*1.13];});
  }
}
function characterPelvisProfile(){return ACT.ageGroup==='child'?[[0,34,25],[1,40,29],[2,42,29]]:isElderWoman(ACT)?[[0,43,31],[1,49,34],[2,50,34]]:ACT.gender==='male'?[[0,40,29],[1,46,32],[2,47,32]]:[[0,42,30],[1,56,35],[2,58,34]];}
function malePath(d,fill,sw,extra){return '<path d="'+d+'" fill="'+fill+'" stroke="'+OUT+'" stroke-width="'+(sw||2.6)+'" stroke-linejoin="round" stroke-linecap="round"'+(extra||'')+'/>';}
function maleFaceFront(){
  var upper='M-63 -39 C-63 -77 -38 -97 0 -97 C38 -97 63 -77 63 -39 ';
  var lower={
    round:'L68 14 Q71 51 48 72 Q26 91 0 91 Q-26 91 -48 72 Q-71 51 -68 14Z',
    long:'L60 14 L53 58 Q39 84 16 96 Q0 101 -16 96 Q-39 84 -53 58 L-60 14Z',
    oval:'L60 14 Q57 57 36 77 Q0 99 -36 77 Q-57 57 -60 14Z',
    heart:'L65 13 Q63 43 38 63 L13 87 Q0 98 -13 87 L-38 63 Q-63 43 -65 13Z',
    square:'L64 17 L62 53 Q60 70 43 79 L22 88 Q0 92 -22 88 L-43 79 Q-60 70 -62 53 L-64 17Z'
  };
  return malePath(upper+(lower[ACT.faceShape]||lower.square),SKIN,3.2);
}
function maleFaceProfile(){
  var chin=ACT.faceShape==='long'?'Q-65 88 -43 99 Q2 94 43 49':ACT.faceShape==='round'?'Q-68 82 -43 91 Q5 99 43 49':ACT.faceShape==='heart'?'Q-62 84 -46 92 Q3 84 43 49':'L-59 77 Q-50 89 -31 89 L3 76 Q31 63 43 49';
  return malePath('M-48 -78 Q-64 -59 -61 -26 L-57 -5 Q-57 9 -67 17 L-81 25 Q-87 31 -74 35 L-66 37 L-66 44 Q-76 48 -67 53 L-65 61 '+chin+' Q68 24 67 -32 Q66 -77 28 -94 Q-17 -108 -48 -78Z',SKIN,3.2);
}
function maleEye(cx,cy,profile){
  var id='me'+(++UID),w=profile?11:14,h=profile?8:8,st=ACT;
  var d='M-'+w+' 0 Q0 -'+(h+3)+' '+w+' -1 Q0 '+(h+2)+' -'+w+' 0Z';
  if(BLINK>.5||st.eyeStyle==='happy')return '<g class="male-eye" data-edit-part="eyes" transform="translate('+cx+' '+cy+')"><path d="M-'+w+' 1 Q0 8 '+w+' 0" fill="none" stroke="'+OUT+'" stroke-width="2.8" stroke-linecap="round"/></g>';
  var en=kEyeNew(st,{w:w,h:h,irx:profile?6:7,iry:8,cx:0}),inner=en?'<rect x="-18" y="-15" width="36" height="30" fill="'+en.base+'"/>'+en.art:'<rect x="-18" y="-15" width="36" height="30" fill="#f6f2f2"/><ellipse rx="'+(profile?6:7)+'" ry="8" fill="'+st.eye+'" stroke="'+kshade(st.eye,-.4)+'" stroke-width="1.6"/><ellipse rx="3" ry="5" fill="'+OUT+'"/><circle cx="-2" cy="-3" r="2" fill="#fff"/>';
  return '<g class="male-eye" data-edit-part="eyes" transform="translate('+cx+' '+cy+')"><defs><clipPath id="'+id+'"><path d="'+d+'"/></clipPath></defs><g clip-path="url(#'+id+')">'+inner+'</g><path d="'+d+'" fill="none" stroke="'+OUT+'" stroke-width="2.2"/><path d="M-'+w+' 0 Q0 -'+(h+3)+' '+w+' -1" fill="none" stroke="'+OUT+'" stroke-width="3" stroke-linecap="round"/></g>';
}
function maleMouth(profile){
  var e=ACT.expr||'smile',col='#7a3a45',d;
  if(profile){d={neutral:'M-69 48 l16 0',sad:'M-70 51 Q-62 46 -54 50',shy:'M-70 48 Q-62 53 -55 49',grin:'M-70 46 Q-62 64 -49 47 Q-62 51 -70 46Z',creepy:'M-70 46 Q-62 64 -49 47 Q-62 51 -70 46Z'}[e]||'M-70 48 Q-62 54 -53 47';}
  else d={neutral:'M-13 57 L13 57',sad:'M-14 61 Q0 52 14 61',shy:'M-12 56 Q0 63 12 56',grin:'M-20 52 Q0 82 20 52 Q0 61 -20 52Z',creepy:'M-20 52 Q0 82 20 52 Q0 61 -20 52Z'}[e]||'M-15 55 Q0 66 15 55';
  return '<g data-edit-part="expr"><path d="'+d+'" fill="'+(['grin','creepy'].indexOf(e)>=0?'#2a0a10':'none')+'" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round"/></g>';
}
function maleFacialDetails(profile){
  var st=ACT,wrinkles=st.faceDetail==='wrinkles'||(st.faceDetail||'auto')==='auto'&&st.ageGroup==='elder',g='',col=kshade(SKIN,-.3);
  if(wrinkles){var paths=profile?['M-52 -25 Q-37 -31 -23 -25','M-50 -18 Q-37 -22 -27 -18','M-26 15 l9 4 M-27 22 l8 5','M-60 38 Q-53 43 -54 56','M-48 71 Q-29 78 -13 66']:['M-27 -27 Q0 -34 27 -27','M-23 -20 Q0 -25 23 -20','M-45 13 l-8 3 M-43 21 l-8 5 M45 13 l8 3 M43 21 l8 5','M-17 35 Q-26 45 -22 60 M17 35 Q26 45 22 60','M-15 76 Q0 82 15 76'];g+='<g class="age-lines" fill="none" stroke="'+col+'" stroke-width="1.8" stroke-linecap="round" opacity=".75">'+paths.map(function(d){return '<path d="'+d+'"/>';}).join('')+'</g>';}
  if(st.faceDetail==='freckles'){var dots=profile?[[-34,29],[-25,26],[-31,35],[-20,33]]:[[-39,29],[-31,26],[-23,29],[-35,35],[39,29],[31,26],[23,29],[35,35]];g+='<g class="character-freckles" fill="'+col+'">'+dots.map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.5"/>';}).join('')+'</g>';}
  return '<g data-edit-part="identity">'+g+'</g>';
}
function maleBeard(profile){
  var type=ACT.facialHair||'none';if(type==='none')return '';
  var col=ACT.hair,d='',g='';
  if(type==='moustache'||type==='full')d=profile?'M-68 37 Q-59 34 -48 42 L-44 49 Q-56 45 -67 46Z':'M-23 46 Q-12 37 0 43 Q12 37 23 46 Q12 53 0 46 Q-12 53 -23 46Z';
  if(d)g+=malePath(d,col,1.6);
  if(type==='short'||type==='full'){d=profile?(type==='full'?'M-48 32 Q-28 31 -21 14 L2 9 L-8 71 Q-21 105 -45 110 Q-66 89 -68 62 Q-57 66 -49 57Z':'M-64 63 Q-43 80 -13 54 L-17 76 Q-41 100 -59 83Z'):(type==='full'?'M-57 24 Q-51 52 -31 51 Q0 76 31 51 Q51 52 57 24 L58 59 Q43 97 0 110 Q-43 97 -58 59Z':'M-50 49 Q-29 70 0 72 Q29 70 50 49 L45 72 Q0 104 -45 72Z');g+=malePath(d,col,1.8);}
  if(type==='stubble'){var pts=profile?[[-59,61],[-55,67],[-48,73],[-39,76],[-29,72],[-19,66],[-9,58]]:[[-45,51],[-40,60],[-30,70],[-18,76],[-6,80],[6,80],[18,76],[30,70],[40,60],[45,51]];g+=pts.map(function(p){return '<path d="M'+p[0]+' '+p[1]+' l1 -4" stroke="'+col+'" stroke-width="1.7" stroke-linecap="round"/>';}).join('');}
  return '<g class="male-beard" data-edit-part="identity">'+g+'</g>';
}
function legacyMaleHair(style,profile,back){
  var col=ACT.hair,hl=kshade(col,.3),g='',bald=style==='balding'||style==='shaved';
  if(style==='shaved')return '';
  if(back){g=malePath(bald?'M-61 -42 Q-72 -5 -60 29 Q-49 62 0 72 Q49 62 60 29 Q72 -5 61 -42 L49 -21 Q40 16 0 20 Q-40 16 -49 -21Z':'M-65 -31 Q-69 -98 0 -103 Q69 -98 65 -31 L59 42 Q35 76 0 77 Q-35 76 -59 42Z',col,3);}
  else if(profile){
    var d=bald?'M43 -70 Q72 -62 69 -17 L61 30 Q47 48 34 41 L30 -6 Q44 -19 43 -70Z':style==='sidepart'?'M-60 -35 Q-77 -77 -36 -103 Q1 -122 43 -94 Q80 -73 71 -22 L61 32 L46 37 L40 -7 Q50 -22 33 -24 L21 -54 Q-6 -77 -48 -44Z':style==='crew'?'M-60 -33 L-57 -65 Q-30 -103 15 -101 Q73 -94 70 -29 L60 30 L45 35 L41 -12 Q54 -29 33 -29 L23 -57 Q-15 -72 -60 -33Z':'M-61 -30 Q-70 -70 -35 -95 Q10 -114 47 -91 Q81 -63 69 -17 L60 31 L45 35 L40 -10 Q51 -27 34 -26 L21 -49 L-11 -59 L-39 -38Z';g=malePath(d,col,3);
    if(!bald)g+='<path d="M-39 -67 Q8 -97 46 -65 M48 -56 Q65 -36 53 -10" stroke="'+hl+'" stroke-width="2.8" fill="none" opacity=".5"/>';
  }else{
    var d=bald?'M-62 -49 Q-74 -16 -61 23 L-51 23 L-52 -25Z M62 -49 Q74 -16 61 23 L51 23 L52 -25Z':style==='sidepart'?'M-64 6 Q-77 -42 -59 -74 Q-20 -119 31 -102 Q78 -89 68 -32 L60 9 L49 -24 Q1 -78 -51 -21 L-56 7Z':style==='crew'?'M-64 6 L-66 -48 Q-58 -101 0 -104 Q58 -101 66 -48 L64 6 L54 6 L51 -40 Q0 -56 -51 -40 L-54 6Z':'M-64 6 Q-75 -46 -54 -77 Q0 -121 54 -77 Q75 -46 64 6 L54 6 L51 -31 L36 -45 L24 -36 L9 -49 L-3 -39 L-24 -46 L-51 -26 L-55 6Z';g=malePath(d,col,3);
    if(style==='sidepart')g+='<path d="M17 -91 Q-14 -84 -43 -45 M23 -89 Q38 -64 53 -40" fill="none" stroke="'+hl+'" stroke-width="3" opacity=".6"/>';
    if(bald)g+='<path d="M-12 -91 Q0 -96 12 -91 M-7 -87 Q0 -90 8 -87" fill="none" stroke="'+hl+'" stroke-width="2"/>';
  }
  return '<g data-edit-part="hairStyle">'+g+'</g>';
}
function maleHeadArt(theta){
  var t=((theta+540)%360)-180,a=Math.abs(t),back=a>=135,profile=a>45&&!back,st=ACT,style=st.hairStyle||'shortcrop',g='';
  if(back)g=malePath('M-62 -40 Q-64 -96 0 -98 Q64 -96 62 -40 L57 33 Q32 77 0 79 Q-32 77 -57 33Z',SKIN,3)+maleHair(style,false,true);
  else if(profile){
    g=maleFaceProfile();g+=maleEye(-43,8,true);
    g+='<path d="M-57 -8 Q-42 -17 -26 -10" stroke="'+st.hair+'" stroke-width="5" fill="none" stroke-linecap="round"/>';
    g+=maleFacialDetails(true)+maleMouth(true)+maleBeard(true);
    g+=malePath('M35 1 C52 -10 61 7 53 24 Q44 40 35 28Z',SKIN,2.8)+'<path d="M42 7 q12 -1 3 16" fill="none" stroke="'+SKINSH+'" stroke-width="2"/>';
    g+=maleHair(style,true,false);
    if(t<0)g='<g transform="scale(-1 1)">'+g+'</g>';
  }else{
    [-1,1].forEach(function(s){g+='<ellipse cx="'+s*63+'" cy="12" rx="10" ry="17" fill="'+SKIN+'" stroke="'+OUT+'" stroke-width="2.8"/>';});
    g+=maleFaceFront()+maleEye(-28,9,false)+maleEye(28,9,false);
    var sad=st.expr==='sad';g+='<path d="M-44 '+(sad?-5:-10)+' Q-28 '+(sad?-9:-18)+' -13 '+(sad?-16:-12)+' M13 '+(sad?-16:-12)+' Q28 '+(sad?-9:-18)+' 44 '+(sad?-5:-10)+'" fill="none" stroke="'+st.hair+'" stroke-width="5" stroke-linecap="round"/>';
    g+='<path d="M-3 17 L-9 36 Q0 42 9 36 M-9 40 Q0 44 9 40" fill="none" stroke="'+SKINSH+'" stroke-width="2.2" stroke-linecap="round"/>';
    if(st.blush||st.expr==='shy')g+='<g fill="#e8757f" opacity=".23"><ellipse cx="-39" cy="31" rx="11" ry="5"/><ellipse cx="39" cy="31" rx="11" ry="5"/></g>';
    g+=maleFacialDetails(false)+maleMouth(false)+maleBeard(false)+maleHair(style,false,false);
  }
  return '<g data-male-head="'+(back?'back':profile?'profile':'front')+'" data-face-shape="'+(st.faceShape||'square')+'">'+g+'</g>';
}
