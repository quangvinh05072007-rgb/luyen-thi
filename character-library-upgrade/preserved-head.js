/* Keep the source face outlines and profile drawing. Only feature choices vary. */
function profileTempleLock(st){
  var style=st.hairStyle||'long',width={bun:5.5,highbun:5,pixie:5,bob:9,hime:10}[style]||10.5;
  var end={bun:65,highbun:58,pixie:20,bob:77,hime:99}[style]||108,x=27,bend=style==='wavy'?8:style==='bun'||style==='highbun'?4:2;
  var root=style==='pixie'?-35:-44;
  var d='M'+f1(x-width)+' '+root+' C'+f1(x-width-1)+' -10 '+f1(x-width)+' 24 '+f1(x-width+bend)+' '+f1(end*.65)+' C'+f1(x-width*.45+bend)+' '+f1(end-9)+' '+f1(x+bend-2)+' '+f1(end-1)+' '+f1(x+bend+1)+' '+end+' C'+f1(x+width+bend)+' '+f1(end*.76)+' '+f1(x+width)+' '+f1(end*.35)+' '+f1(x+width)+' -6 C'+f1(x+width+1)+' -20 '+f1(x+width+1)+' '+(root+10)+' '+f1(x+width)+' '+root;
  return '<g class="profile-temple-lock" data-edit-part="hairStyle" transform="translate(0 -24)"><path d="'+d+'Z" fill="'+HAIRC+'" stroke="none"/><path d="'+d+'" fill="none" stroke="'+OUT+'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M'+f1(x-width*.25)+' '+(root+8)+' C'+f1(x-width*.4)+' '+f1(end*.3)+' '+f1(x+bend)+' '+f1(end*.7)+' '+f1(x+bend)+' '+f1(end-12)+'" fill="none" stroke="'+kshade(HAIRC,.3)+'" stroke-width="1.1" opacity=".35" stroke-linecap="round"/></g>';
}
function profileHairStrands(w,x){
  var id='scalp'+(++UID),d='M'+f1(x-w)+' 8 C'+f1(x-w)+' -62 '+f1(x-w*.55)+' -100 '+f1(x)+' -100 C'+f1(x+w*.55)+' -100 '+f1(x+w)+' -62 '+f1(x+w)+' 8 L'+f1(x+w)+' 90 L'+f1(x-w)+' 90Z';
  return '<defs><clipPath id="'+id+'"><path d="'+d+'"/></clipPath></defs><g class="profile-hair-strands" clip-path="url(#'+id+')" fill="none" stroke="'+kshade(HAIRC,.28)+'" stroke-width="1.3" opacity=".28" stroke-linecap="round"><path d="M-34 -80 C-18 -99 6 -102 31 -90"/><path d="M-44 -65 C-27 -94 8 -100 44 -78"/><path d="M-48 -49 C-30 -82 10 -92 54 -64"/></g>';
}
function profileEyeMarkup(st,ec,white){
  var en=kEyeNew(st,{w:17,h:13,irx:11,iry:11,cx:1}),closed=BLINK>.5||st.eyeStyle==='happy';
  var inner=en?en.art:'<circle cx="1" cy="1" r="11" fill="'+st.eye+'"/><circle cx="1" cy="1" r="11" fill="none" stroke="'+kshade(st.eye,-.45)+'" stroke-width="2"/><circle cx="1" cy="1" r="4.6" fill="'+OUT+'"/><circle cx="-3" cy="-4" r="3.2" fill="#fff"/><circle cx="5" cy="4" r="1.6" fill="#fff" opacity=".8"/>';
  var base=en?en.base:'#f6f2f2';
  var g='<defs><clipPath id="'+ec+'p"><path d="'+white+'"/></clipPath></defs><g data-edit-part="eyes" transform="translate(19 14) scale(.92)"><path d="'+white+'" fill="'+base+'"/><g clip-path="url(#'+ec+'p)"><g transform="translate(166 175) scale(1.18 1.59)">'+inner+'</g><path d="M142 156 L190 156 L190 164 Q166 158 142 166Z" fill="#000" opacity=".2"/></g>';
  g+='<path d="M142 167 Q156 152 186 159 Q192 159 198 152" stroke="'+OUT+'" stroke-width="5.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M186 159 L194 149" stroke="'+OUT+'" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M148 192 Q166 200 184 190" stroke="'+OUT+'" stroke-width="1.9" fill="none" opacity=".55" stroke-linecap="round"/>';
  var brow={smile:'M148 146 Q166 140 190 143',neutral:'M148 146 Q166 144 190 146',shy:'M148 148 Q166 142 190 145',sad:'M148 151 Q166 143 190 137',creepy:'M148 144 Q166 131 190 141',grin:'M148 142 Q166 131 190 141'}[st.expr]||'M148 146 Q166 140 190 143';
  g+='<path d="'+brow+'" stroke="'+kshade(HAIRC,.08)+'" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
  if(closed)g+='<path d="M142 160 Q157 150 188 158 L190 192 Q168 202 146 192Z" fill="'+SKIN+'"/><path d="M144 '+(st.eyeStyle==='happy'?178:170)+' Q166 '+(st.eyeStyle==='happy'?154:184)+' 192 164" stroke="'+OUT+'" stroke-width="5" fill="none" stroke-linecap="round"/>';
  return g+'</g>';
}
function profileMouth(expr){
  var d={smile:'M139 247 Q151 253 166 244',neutral:'M140 247 L166 247',sad:'M139 251 Q151 240 166 250',shy:'M139 247 Q145 253 152 247 Q158 253 166 247',grin:'M135 241 Q151 272 171 239 Q151 251 135 241Z',creepy:'M139 243 Q151 266 168 241 Q152 253 139 243Z'}[expr]||'M139 247 Q151 253 166 244';
  return '<path d="'+d+'" stroke="'+(expr==='grin'||expr==='creepy'?OUT:'#7a3a45')+'" stroke-width="2.8" fill="'+(expr==='grin'?'#2a0a10':expr==='creepy'?'#4a1019':'none')+'" stroke-linecap="round" stroke-linejoin="round"/>';
}
function gHand(h){
  if(!h.shape)return nativeRigHand(h);
  var palm='<path d="M-8 -4L8 -4L10 9Q14 17 8 25Q0 29 -9 23L-11 9Z" fill="'+SKIN+'" stroke="'+OUT+'" stroke-width="2.6" stroke-linejoin="round"/>';
  if(h.shape==='point')palm+=gfin([[-6,19],[-7,33],[-8,47]],6.2,4.2);
  if(h.shape==='peace')palm+=gfin([[-5,19],[-11,34],[-15,46]],6.2,4.2)+gfin([[0,18],[5,35],[9,48]],6.2,4.2);
  palm+='<path d="M-8 9Q-5 6 -2 10 M-2 9Q1 6 4 10 M4 10Q7 7 9 12" fill="none" stroke="'+SKINSH+'" stroke-width="1.5" stroke-linecap="round"/>';
  return palm+'<path d="M7 10Q15 12 11 20L2 18Q-2 15 2 12Z" fill="'+SKIN+'" stroke="'+OUT+'" stroke-width="2.2" stroke-linejoin="round"/>';
}
