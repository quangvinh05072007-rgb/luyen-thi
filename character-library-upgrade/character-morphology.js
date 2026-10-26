/* Optional morphology. The original figure takes the exact old render path. */
var MORPH=null;
function characterMorphology(st){
  var ages={adult:[1,1,1],teen:[.92,.88,.96],child:[.82,.76,1.03],elder:[.99,.91,.98]};
  var bodies={regular:[1,1,1],slender:[.85,1,.88],petite:[.91,.9,.93],tall:[.97,1.06,.98],rounded:[1.2,.98,1.23],broad:[1.17,1,1.08],athletic:[1.04,1.03,1.06],stooped:[.96,.88,1.04]};
  var faces={original:[1,1],round:[1.08,.98],oval:[.96,1.02],long:[.94,1.1],square:[1.04,1],heart:[1.02,1]};
  var a=ages[st.ageGroup]||ages.adult,b=bodies[st.bodyShape]||bodies.regular,f=faces[st.faceShape]||faces.original;
  return {bodyX:a[0]*b[0],bodyY:a[1]*b[1],bodyZ:a[0]*b[2],headX:a[2]*f[0],headY:a[2]*f[1]};
}
function morphologyWidth(m,phi){return Math.hypot(m.bodyX*Math.cos(phi*D2R),m.bodyZ*Math.sin(phi*D2R));}
function morphologyHead(svg){
  if(!MORPH||MORPH.identity)return svg;
  return '<g data-character-head="'+(ACT.faceShape||'original')+'" transform="scale('+MORPH.headX/MORPH.width+' '+MORPH.headY/MORPH.bodyY+')">'+svg+'</g>';
}
function morphologyFigure(svg){
  if(MORPH.identity)return svg;
  return '<g data-character-body="'+(ACT.bodyShape||'regular')+'" transform="translate(0 800) scale('+MORPH.width+' '+MORPH.bodyY+') translate(0 -800)">'+svg+'</g>';
}
function morphologyJoints(J){
  if(MORPH.identity)return J;
  var r={};Object.keys(J).forEach(function(k){var v=J[k];if(Array.isArray(v)&&v.length===3&&typeof v[0]==='number'){r[k]=/^(fw|dn)/.test(k)?nrm([v[0]*MORPH.bodyX,v[1]*MORPH.bodyY,v[2]*MORPH.bodyZ]):[v[0]*MORPH.bodyX,800+(v[1]-800)*MORPH.bodyY,v[2]*MORPH.bodyZ];}else r[k]=v;});return r;
}
function characterFrameBox(st,box,mode){
  var m=characterMorphology(st);
  if(mode==='full'){var extra=Math.max(0,m.bodyY-1)*750;return extra?[box[0],box[1]-extra,box[2],box[3]+extra]:box.slice();}
  if(m.bodyX===1&&m.bodyY===1&&m.headX===1&&m.headY===1)return box.slice();
  var cx=190+(box[0]+box[2]/2-190)*m.bodyX,cy=686+(box[1]+box[3]/2-686)*m.bodyY+.77*anatomyHeadOffset(st)*m.bodyY;
  var sx=m.headX,sy=mode==='bust'?(m.headY+m.bodyY)/2:m.headY;
  return [cx-box[2]*sx/2,cy-box[3]*sy/2,box[2]*sx,box[3]*sy];
}
function characterExportBox(st){
  var m=characterMorphology(st),tallHair=effectiveCharacterGender(st)==='male'&&st.hairStyle==='quiff';if(!tallHair&&m.bodyX===1&&m.bodyY===1&&m.bodyZ===1&&m.headX===1&&m.headY===1)return [-235,-60,470,920];
  var top=Math.min(-60,800+(75+anatomyHeadOffset(st)-800)*m.bodyY-175*m.headY),width=470*Math.max(1,m.bodyX,m.bodyZ,m.headX);
  return [-width/2,top,width,860-top];
}
function characterFrontContour(original){
  return ({
    round:'M130 140 C130 100 155 80 190 80 C225 80 250 100 250 140 C255 176 243 200 218 211 Q190 226 162 211 C137 200 125 176 130 140Z',
    oval:'M130 140 C130 100 155 80 190 80 C225 80 250 100 250 140 C249 170 234 198 211 211 Q190 223 169 211 C146 198 131 170 130 140Z',
    long:'M130 140 C130 100 155 80 190 80 C225 80 250 100 250 140 C250 177 238 204 214 215 Q190 230 166 215 C142 204 130 177 130 140Z',
    square:'M130 140 C130 100 155 80 190 80 C225 80 250 100 250 140 L247 181 Q246 201 227 211 Q190 218 153 211 Q134 201 133 181Z',
    heart:'M130 140 C130 100 155 80 190 80 C225 80 250 100 250 140 C251 165 238 181 222 194 L202 214 Q190 226 178 214 L158 194 C142 181 129 165 130 140Z'
  })[ACT.faceShape]||original;
}
function characterProfileContour(original){
  var start=original.indexOf('C148.6 271.9');if(start<0)return original;
  var jaws={
    round:'C147 282 153 298 174 299 C204 299 236 281 254 264 Q264 255 265.3 244.8',
    oval:'C149 282 154 294 171 295 C199 292 238 274 255 258 Q263 251 265.3 244.8',
    long:'C149 287 151 302 170 305 C201 301 238 279 255 261 Q264 252 265.3 244.8',
    square:'L149 285 Q149 295 163 296 L200 295 Q226 287 249 268 Q264 254 265.3 244.8',
    heart:'C151 280 157 292 169 294 Q185 294 204 283 Q243 270 258 253 Q264 248 265.3 244.8'
  };
  return jaws[ACT.faceShape]?original.slice(0,start)+jaws[ACT.faceShape]:original;
}
function characterFaceDetails(view){
  var details=ACT.faceDetail||'auto',wrinkles=details==='wrinkles'||details==='auto'&&ACT.ageGroup==='elder',freckles=details==='freckles';
  if(!wrinkles&&!freckles)return '';
  var g='',col=kshade(SKIN,-.28);
  if(wrinkles){
    var paths=view==='front'?['M171 116 Q190 111 209 116','M176 121 Q190 118 204 121','M139 156 l-5 3 M140 162 l-5 4 M241 156 l5 3 M240 162 l5 4','M174 178 Q168 188 173 196 M206 178 Q212 188 207 196','M178 205 Q190 210 202 205']:['M149 139 Q166 133 185 138','M153 145 Q167 141 182 144','M191 181 l9 2 M191 188 l8 5','M149 227 Q156 234 153 242','M159 273 Q178 278 195 271'];
    g='<g class="age-lines" fill="none" stroke="'+col+'" stroke-width="1.8" stroke-linecap="round" opacity=".72">'+paths.map(function(d){return '<path d="'+d+'"/>';}).join('')+'</g>';
  }
  if(freckles){var dots=view==='front'?[[148,176],[155,173],[162,177],[151,181],[232,176],[225,173],[218,177],[229,181],[183,177],[197,177]]:[[177,208],[184,204],[190,209],[181,214],[193,216]];g+='<g class="character-freckles" fill="'+col+'" opacity=".65">'+dots.map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.7"/>';}).join('')+'</g>';}
  return '<g data-edit-part="identity">'+g+'</g>';
}
function characterGlasses(theta){
  var t=((theta+540)%360)-180,a=Math.abs(t),stroke=ACT.accessoryColor||ACT.c3;
  if(a>=135)return '';
  var g=a<=45?'<rect x="-54" y="-8" width="46" height="31" rx="12"/><rect x="8" y="-8" width="46" height="31" rx="12"/><path d="M-8 2 Q0 -3 8 2 M-54 1 L-67 -5 M54 1 L67 -5"/>':'<g'+(t<0?' transform="scale(-1 1)"':'')+'><path d="M-65 -10 Q-49 -15 -32 -8 L-31 17 Q-46 25 -59 17Z M-32 -6 L37 -1 M-65 -7 L-72 -4"/></g>';
  return '<g class="character-glasses" fill="none" stroke="'+stroke+'" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round">'+g+'</g>';
}
