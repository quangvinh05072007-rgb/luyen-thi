/* This code is appended inside createCharacterRig, after the unmodified rig math. */
var ACT = null, cur = poseAt('stand', 0), livePose = null, liveKey = '', blendFrom = null, blend = 1;
var SE = SEC, ST = {}, lastTime = 0;
var STATIC_SEC = deep(SEC), STATIC_SK = deep(SK);
var SOURCE_OUTFITS = deep(OUTFITS);
GH.fist={shape:'fist'};GH.point={shape:'point'};GH.peace={shape:'peace'};
var ALIASES = {g_relax:'idle',g_cover:'cover',g_wave:'wave',g_clasp:'clasp',g_reach:'reach',g_heart:'heart',g_hips:'hips',g_think:'think',g_cheer:'cheer',g_salute:'salute',g_hug:'cross',relax:'idle',point:'pointF'};
LIB.push(
  {id:'run',n:'Chạy',P:{root:{pitch:10},thor:[8,0,0],L:{el:[80,0]},R:{el:[80,0]}},anim:function(t,N){var s=Math.sin(t*9),c=Math.cos(t*9);N.L.hip[0]=48*s;N.R.hip[0]=-48*s;N.L.kn[0]=28+70*Math.max(0,c);N.R.kn[0]=28+70*Math.max(0,-c);N.L.sh[0]=-42*s;N.R.sh[0]=42*s;N.L.an[0]=-14*c;N.R.an[0]=14*c;N.thor[2]=7*s;return 4*Math.abs(c);}},
  {id:'cover',n:'Che miệng',P:{neck:[6,4,-4],R:{sh:[50,0,0],el:[135,0]},L:{sh:[0,-6,0],el:[12,0]}}},
  {id:'heart',n:'Tay đặt tim',P:{neck:[4,-5,0],R:{sh:[35,-8,55],el:[105,0]},L:{sh:[0,-6,0],el:[12,0]}}},
  {id:'reach',n:'Đưa tay',P:{L:{sh:[38,6,0],el:[8,0]},R:{sh:[38,6,0],el:[8,0]}}},
  {id:'salute',n:'Chào',P:{neck:[0,2,0],R:{sh:[25,65,-65],el:[125,0]},L:{sh:[0,-6,0],el:[12,0]}}}
);
HANDS.cover={R:'cv'};HANDS.heart={R:'cv'};HANDS.salute={R:'cl'};HANDS.reach={L:'rc',R:'rc'};

function makeOutfit(st) {
  var id=st.outfit, base=id==='uniform'?'sailor':(id==='casual'?'casual':(id==='uam'?'uam':(id==='sailor'?'sailor':'hanfu')));
  var o=deep(SOURCE_OUTFITS[base]), c1=st.c1, c2=st.c2, c3=st.c3;
  o.skin=st.skin;o.skinSh=kshade(st.skin,-.14);o.hair=st.hair;o.eye=st.eye;
  o.crown=st.acc==='flowers'&&id==='uam';o.circles=!!st.circles;o.blush=!!st.blush;
  var t=o.top,b=o.bottom;
  if(id==='hanfu_v2'){t.col=c2;t.sh=kshade(c2,-.18);t.red=c1;t.navy=c3;b.col=c1;b.sh=kshade(c1,-.24);b.trim=c3;}
  else if(id==='hanfu'||id==='uam'){t.col=c1;t.sh=kshade(c1,-.22);t.red=c3;t.navy=c2;t.inner=c2;b.col=c1;b.sh=kshade(c1,-.24);b.trim=c2;b.sashCol=c3;b.sashY=74;b.tail=96;t.flow=.9;b.flow=1;}
  else if(id==='uniform'||id==='sailor'){t.col=c2;t.sh=kshade(c2,-.15);t.navy=c1;t.red=c3;b.col=c1;b.sh=kshade(c1,-.22);if(id==='uniform'){o.bottom={kind:'skirt',col:c1,sh:kshade(c1,-.22),trim:c1,sashCol:c1,sashY:74,sashW:5,flow:.35,hem:-.45,hemR:68,short:true,noTail:true,folds:[-.8,-.55,-.25,0,.25,.55,.8]};}}
  else if(id==='casual'){t.col=c1;t.sh=kshade(c1,-.18);t.navy=c3;b.col=c2;b.sh=kshade(c2,-.22);}
  else {
    t.kind=id;t.col=c1;t.sh=kshade(c1,-.2);t.navy=c2;t.red=c3;t.inner=c2;t.tassel=false;t.flow=id==='ghost'?.8:.15;t.hemDrop=36;
    t.sleeve=[[0,27,25],[1,21,20],[2,19,18]];t.sleeveEnd=2;t.cuff=[1.84,2];
    o.shoes={col:id==='aodai'?c2:'#34303d',sh:'#24212c',sole:c3};o.socks=null;
    if(id==='aodai'){
      t.sleeve=[[0,25,23],[1,18,17],[2,15,14]];t.cuff=null;
      b={kind:'pants',col:c2,sh:kshade(c2,-.18),leg:[[0,38,33],[1,31,28],[2,30,26]]};o.panels=true;
    } else if(id==='dress'||id==='ghost'){
      t.sleeveEnd=id==='dress'?.52:1.96;t.sleeve=id==='dress'?[[0,27,25],[.52,31,27]]:[[0,28,26],[1,35,30],[2,48,38]];
      t.cuff=id==='dress'?null:[1.84,1.96];
      b={kind:'skirt',col:c1,sh:kshade(c1,-.23),trim:c3,sashCol:c3,sashY:74,sashW:7,flow:id==='ghost'?1:.55,hem:id==='dress'?.08:1.08,hemR:id==='dress'?76:66,short:id==='dress',folds:[-.7,-.35,0,.35,.7],noTail:true};
    } else {
      t.hemDrop=id==='hoodie'?64:50;
      t.sleeve=[[0,30,27],[1,26,23],[2,22,20]];
      b={kind:'pants',col:c2,sh:kshade(c2,-.22),leg:[[0,37,32],[1,29,25],[2,23,21]]};
    }
    o.bottom=b;
  }
  configureMaleOutfit(o,st);
  configureChildOutfit(o,st);
  configureElderWomanOutfit(o,st);
  if(st.bottomColor){o.bottom.col=st.bottomColor;o.bottom.sh=kshade(st.bottomColor,-.22);}
  if(st.shoesColor){o.shoes.col=st.shoesColor;o.shoes.sh=kshade(st.shoesColor,-.25);}
  if(st.socksStyle==='none')o.socks=null;
  else if(st.socksStyle==='ankle'||st.socksStyle==='knee')o.socks={col:st.socksColor||'#f4f4f7',sh:kshade(st.socksColor||'#f4f4f7',-.15),from:st.socksStyle==='ankle'?1.76:1.12,prof:deep(SOURCE_OUTFITS.sailor.socks.prof)};
  if(o.socks&&st.socksColor){o.socks.col=st.socksColor;o.socks.sh=kshade(st.socksColor,-.15);}
  var sleeve=st.sleeveStyle;
  if(sleeve&&sleeve!=='auto'){
    t.flow=sleeve==='wide'?.9:0;
    t.sleeveEnd={none:.015,short:.55,half:1.28,long:2,wide:1.96}[sleeve]||2;
    t.sleeve=sleeve==='wide'?[[0,28,26],[1,38,33],[2,56,45]]:[[0,27,25],[1,21,19],[2,18,17]];
    t.cuff=sleeve==='none'?null:[Math.max(0,t.sleeveEnd-.14),t.sleeveEnd];
  }
  return o;
}

/* Every hair style uses the same moving head/chest anchors and secondary spring. */
function renderHair(J,phi,items) {
  if(ACT.ageGroup==='child'||isElderWoman(ACT))return;
  var st=ACT,style=st.hairStyle||'long',c=Math.cos(phi*D2R),s=Math.sin(phi*D2R),so=SEC.o,col=st.hair,sh=kshade(col,-.24),hl=kshade(col,.33);
  if(isMaleHair(style))return;
  var hw=MORPH.headX/MORPH.width,hy=MORPH.headY/MORPH.bodyY;
  function local(v){return add(J.head,mv(J.Rh,MORPH.identity?v:[v[0]*hw,v[1]*hy,v[2]*hw]));}
  function strand(id,pts,widths,depth){if(!MORPH.identity)widths=widths.map(function(w){return [w[0],w[1]*hw,w[2]*hw];});items.push({id:id,d:depth,svg:tube(pts,widths,{phi:phi,fill:col,shade:sh,caps:'rr',pass:3,lines:[-.45,0,.45],lineCol:hl})});}
  function tail(id,x,y,z,len,width,depth,wave){
    var a=local([x,y,z]),m=add(local([x+(wave||0),y+len*.5,z-3]),mul(so,.45)),e=add(local([x-(wave||0)*.4,y+len,z+8]),so);
    strand(id,[a,m,e],[[0,width*.8,width*.5],[1,width,width*.55],[2,4,4]],depth);
    return [a,m,e];
  }
  var d=c<-.3?8:1;
  if(['long','hime','wavy'].indexOf(style)>=0){
    if(style==='wavy')[-1,0,1].forEach(function(k){tail('hairB'+k,k*36,22,-40,290,34,d,k===0?16:k*24);});
    else {var h0=local([0,8,-26]),m=add(add(J.chest,mv(J.Rs,[0,-16,-30])),mul(so,.5)),e=add(add(J.chest,mv(J.Rs,[0,126,-30])),so);strand('hairB',[h0,m,e],PF.hair,d);}
    [-1,1].forEach(function(k){if(c<-.2||Math.abs(c)<.3)return;var len=style==='hime'?115:185;tail('lock'+k,k*64,6,-8,len,style==='hime'?14:11,5,style==='wavy'?k*12:0);});
  } else if(style==='twin')[-1,1].forEach(function(k){tail('hairB'+k,k*77,-12,-18,255,29,d,k*13);var q=proj(local([k*77,-12,-18]),phi);items.push({id:'tie'+k,d:d+.1,svg:'<circle cx="'+f1(q[0])+'" cy="'+f1(q[1])+'" r="11" fill="'+st.c3+'" stroke="'+OUT+'" stroke-width="2.5"/>'});});
  else if(style==='ponytail')tail('hairB',48,-42,-69,300,35,d,35);
  else if(style==='braid'){
    var pts=tail('hairB',73,42,-28,255,20,c>0?5:d,7),g='';
    for(var i=0;i<11;i++){var u=i/11,a=add(mul(pts[0],1-u),mul(pts[2],u)),q=proj(a,phi);g+='<path d="M'+f1(q[0]-16)+' '+f1(q[1])+' l32 17 l-28 15" fill="none" stroke="'+hl+'" stroke-width="3.3" stroke-linecap="round"/>';}
    items.push({id:'braidPattern',d:(c>0?5:d)+.01,svg:g});
  } else if(style==='bob')tail('hairB',0,10,-27,108,76,d,0);
  else if(style==='pixie')tail('hairB',0,-5,-27,58,65,d,0);
  else {
    var high=style==='highbun',p=local([0,high?-125:-100,high?-6:-50]),q=proj(p,phi);
    var bun='<ellipse rx="'+(high?31:40)+'" ry="'+(high?31:35)+'" fill="'+col+'" stroke="'+OUT+'" stroke-width="3"/><path d="M-24 0 q24 -25 48 0" fill="none" stroke="'+hl+'" stroke-width="3"/>';
    items.push({id:'hairB',d:d,svg:MORPH.identity?'<ellipse cx="'+f1(q[0])+'" cy="'+f1(q[1])+'" rx="'+(high?31:40)+'" ry="'+(high?31:35)+'" fill="'+col+'" stroke="'+OUT+'" stroke-width="3"/><path d="M'+f1(q[0]-24)+' '+f1(q[1])+' q24 -25 48 0" fill="none" stroke="'+hl+'" stroke-width="3"/>':'<g transform="translate('+q[0]+' '+q[1]+') scale('+hw+' '+hy+')">'+bun+'</g>'});
    if(!high)[-1,1].forEach(function(k){tail('lock'+k,k*61,20,0,75,8,5,0);var b=proj(local([k*56,-75,-28]),phi);items.push({id:'bun'+k,d:d,svg:'<ellipse cx="'+f1(b[0])+'" cy="'+f1(b[1])+'" rx="27" ry="25" fill="'+col+'" stroke="'+OUT+'" stroke-width="3"/>'});});
  }
}

function outfitDetails(J,phi,items,T,B) {
  if(renderElderWomanWardrobe(J,phi,items))return;
  if(renderChildWardrobe(J,phi,items))return;
  if(renderMaleWardrobe(J,phi,items,T,B))return;
  var st=ACT,c=Math.cos(phi*D2R);
  function loc(x,y,z){return proj(add(J.chest,mv(J.Rs,[x,y,z])),phi);}
  function line(points,color,w){return '<path d="M'+points.map(function(p){return f1(p[0])+' '+f1(p[1]);}).join('L')+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';}
  var g='',id=st.outfit,z=c>=0?36:-35;
  if(id==='aodai'){
    var top=loc(0,78,z),a=proj(add(J.pel,mv(J.Rp,[-49,8,z])),phi),b=proj(add(J.pel,mv(J.Rp,[49,8,z])),phi);
    [-1,1].forEach(function(k){var ankle=add(J['an'+(k>0?'L':'R')],mv(J.Rp,[k*12,-24,z])),end=proj(add(ankle,mul(SK.hem[k>0?'L':'R'].o,.65)),phi),mid=proj(add(J['kn'+(k>0?'L':'R')],mv(J.Rp,[k*28,0,z])),phi);g+=poly2(smooth([top,k<0?a:b,[mid[0]+k*21,mid[1]],[end[0]+k*25,end[1]],end,[top[0]+k*3,mid[1]]],1),st.c1);});
    items.push({id:'aodaiPanels',d:c>=0?3.7:2.5,svg:g});g='';
    g+=line([loc(-15,-22,z),loc(-15,5,z),loc(15,5,z),loc(15,-22,z)],st.c3,5);
    if(c>0)g+=line([loc(16,8,z),loc(30,34,z),loc(42,74,z)],st.c3,2.4);
  } else if(id==='hoodie'){
    g+=poly2(smooth([loc(-29,-17,-30),loc(-53,8,-45),loc(-37,52,-48),loc(37,52,-48),loc(53,8,-45),loc(29,-17,-30)],2),kshade(st.c1,-.15));
    if(c>0){[-1,1].forEach(function(k){g+=line([loc(k*20,4,37),loc(k*16,76,38)],st.c2,3);});g+=poly2(smooth([loc(-30,82,34),loc(30,82,34),loc(36,118,34),loc(-36,118,34)],1),kshade(st.c1,-.12));}
  } else if(id==='cardigan'&&c>0){
    g+=poly2([loc(-13,-12,z),loc(13,-12,z),loc(14,124,z),loc(-14,124,z)],st.c2);
    g+=line([loc(0,4,z+1),loc(0,124,z+1)],st.c3,3);
    [40,65,90,114].forEach(function(y){var p=loc(7,y,z+2);g+='<circle cx="'+f1(p[0])+'" cy="'+f1(p[1])+'" r="3.2" fill="'+st.c3+'"/>';});
  } else if(id==='sweater'){
    for(var k=-4;k<=4;k++)g+=line([loc(k*10,22,z),loc(k*9,112,z)],kshade(st.c1,.18),1.3);
    g+=line([loc(-44,121,z),loc(44,121,z)],st.c3,9);
  } else if(id==='dress'&&c>0){g+=poly2([loc(-25,-16,z),loc(0,12,z),loc(25,-16,z)],st.c2);}
  else if((id==='shirt'||id==='jacket')&&c>0){
    g+=poly2([loc(-26,-17,z),loc(-4,15,z),loc(-14,32,z),loc(-37,-2,z)],st.c2)+poly2([loc(26,-17,z),loc(4,15,z),loc(14,32,z),loc(37,-2,z)],st.c2);
    if(id==='jacket'){g+=poly2([loc(-15,3,z),loc(15,3,z),loc(23,112,z),loc(-23,112,z)],st.c2);g+=poly2([loc(-35,-6,z+1),loc(-6,25,z+1),loc(-24,65,z+1),loc(-44,10,z+1)],st.c1)+poly2([loc(35,-6,z+1),loc(6,25,z+1),loc(24,65,z+1),loc(44,10,z+1)],st.c1);}
    else {g+=line([loc(0,17,z),loc(0,122,z)],st.c3,2);g+=line([loc(19,42,z),loc(43,42,z),loc(42,65,z),loc(20,65,z),loc(19,42,z)],kshade(st.c1,-.2),1.8);}
    [38,61,84,107].forEach(function(y){var p=loc(id==='jacket'?9:0,y,z+2);g+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2.5" fill="'+st.c3+'"/>';});
  }
  if(g)items.push({id:'outfitDetails',d:3.8,svg:g});
}

function kEyeNew(st,o){
  if(['black','glow','blank'].indexOf(st.eyeStyle)<0)return nativeEyeNew(st,o);
  var art=st.eyeStyle==='blank'?'':('<ellipse rx="'+o.irx+'" ry="'+o.iry+'" fill="'+(st.eyeStyle==='black'?'#090910':st.eye)+'"/>'+(st.eyeStyle==='glow'?'<ellipse rx="'+(o.irx*.48)+'" ry="'+(o.iry*.65)+'" fill="#fff"/>':''));
  return {base:st.eyeStyle==='black'?'#090910':'#f9fafc',art:art};
}

function headSel(theta,O){
  var t=((theta+540)%360)-180,a=Math.abs(t),st=ACT,style=st.hairStyle,g=st.ageGroup==='child'?childHeadArt(theta):isElderWoman(st)?elderWomanHeadArt(theta):st.gender==='male'?maleHeadArt(theta):nativeHeadSel(theta,O),extras='',front=a<=45;
  var accessory=st.accessoryColor||st.c3,accessoryLight=st.accessoryColor?kshade(st.accessoryColor,.55):st.c2;
  if(st.accessoryColor&&O.crown)g=g.replace(/#9fb8d4/g,accessory).replace(/#e9eef5/g,accessoryLight);
  function p(d,fill){return '<path d="'+d+'" fill="'+fill+'" stroke="'+OUT+'" stroke-width="3" stroke-linejoin="round"/>';}
  if(front&&st.gender!=='male'&&st.ageGroup!=='child'&&!isElderWoman(st)){
    if(style==='hime'||style==='bob')extras+=p('M-73 -40 Q0 -94 73 -40 L67 -8 L51 -8 L42 -19 L28 -8 L12 -8 L0 -16 L-14 -8 L-28 -8 L-41 -19 L-52 -8 L-67 -8Z',st.hair);
    if(style==='pixie')extras+=p('M-72 -36 Q-20 -112 66 -54 L43 -16 L28 -36 L8 -7 L-8 -27 L-31 -10 L-38 -36 L-62 -9Z',st.hair);
    if(style==='wavy')extras+=p('M-72 -28 Q-72 -78 -20 -83 Q3 -59 -15 -30 Q-25 -18 -33 -10 Q-13 -43 -20 -46 Q-41 -18 -72 -28Z',st.hair);
    if(st.hairCover)extras+=p('M-58 -42 Q-12 -75 23 -48 L39 55 Q-9 27 -35 4Z',st.hair);
    if(st.crack)extras+='<path d="M23 12 l-9 14 l10 12 l-6 15 l10 18 M24 38 l14 -2" fill="none" stroke="#65535d" stroke-width="2.4"/>';
  }
  var hairExtras=extras;extras='';
  var ca=Math.max(.25,Math.abs(Math.cos(t*D2R))),sx=front?1:ca,offset=front?0:-12*Math.sin(t*D2R);
  if(st.acc==='cat')extras+=p('M-64 -62 L-64 -116 L-19 -84Z M19 -84 L64 -116 L64 -62Z',st.hair)+p('M-57 -77 L-57 -102 L-34 -85Z M34 -85 L57 -102 L57 -77Z',accessory);
  else if(st.acc==='horns')extras+=p('M-60 -60 Q-88 -92 -58 -124 Q-67 -91 -33 -80Z M60 -60 Q88 -92 58 -124 Q67 -91 33 -80Z',accessory);
  else if(st.acc==='ribbon')extras+='<g transform="translate('+f1(offset-50*sx)+' -66)">'+p('M0 0 L-28 -20 L-30 17Z M0 0 L28 -20 L30 17Z',accessory)+'<circle r="7" fill="'+accessory+'" stroke="'+OUT+'" stroke-width="2.5"/></g>';
  else if(st.acc==='flowers'&&!O.crown){for(var i=0;i<4;i++){var x=46*sx+offset+(i%2)*12,y=-67+i*13;extras+='<g transform="translate('+f1(x)+' '+y+')">';for(var k=0;k<5;k++)extras+='<ellipse cy="-6" rx="4" ry="6" transform="rotate('+k*72+')" fill="'+(i%2?accessoryLight:accessory)+'" stroke="'+OUT+'" stroke-width="1"/>';extras+='<circle r="3" fill="#d9b875"/></g>';}}
  else if(st.acc==='veil')extras+='<path d="M-75 -60 Q0 -115 75 -60 L112 262 Q0 286 -112 262Z" fill="'+(st.accessoryColor||st.c2)+'" fill-opacity=".23" stroke="'+accessory+'" stroke-width="2.4"/>';
  if(st.acc==='glasses')extras+=characterGlasses(theta);
  return morphologyHead(g+'<g data-edit-part="hairStyle">'+hairExtras+'</g><g data-edit-part="acc">'+extras+'</g>');
}

function basePoseFor(st,t){
  var id=ALIASES[st.pose]||st.pose||'stand';
  if(id==='g_custom'&&st.rig)return deep(st.rig);
  if(id==='g_custom'&&st.cust){var n=poseAt('idle',0);['L','R'].forEach(function(k){var a=st.cust[k];if(!a||!a.W)return;var sx=k==='L'?146:234,sg=k==='L'?-1:1,ex=a.E[0]-sx,ey=a.E[1]-212,wx=a.W[0]-a.E[0],wy=a.W[1]-a.E[1];n[k].sh[1]=Math.atan2(ex*sg,ey)/D2R-10;n[k].el[0]=Math.abs(Math.atan2(ex*wy-ey*wx,ex*wx+ey*wy)/D2R);n[k].sh[2]=0;n[k].hand=a.h||'rl';});n.neck[1]=st.cust.tilt||0;return n;}
  return poseAt(id,t);
}
function poseFor(st,t){
  var p=basePoseFor(st,t);
  if(st.pose!=='g_custom'){
    if(isElderWoman(st))elderWomanPosture(p,st);
    else if(st.bodyShape==='stooped'){p.thor[0]+=10;p.lum[0]+=5;p.neck[0]-=8;}
  }
  if(st.armPose&&st.armPose!=='auto'){var arms=poseAt(st.armPose,t);['L','R'].forEach(function(k){['sh','el','wr','hand'].forEach(function(key){p[k][key]=Array.isArray(arms[k][key])?arms[k][key].slice():arms[k][key];});});}
  if(st.handL&&st.handL!=='auto')p.L.hand=st.handL;
  if(st.handR&&st.handR!=='auto')p.R.hand=st.handR;
  return p;
}

function render(st,opts){
  var gender=effectiveCharacterGender(st);if(st.gender!==gender)st=Object.assign({},st,{gender:gender});
  opts=opts||{};ACT=st;applyCharacterAnatomy(st);var live=!!opts.live,t=opts.time||0,dt=opts.dt||0,key=st.pose+JSON.stringify(st.pose==='g_custom'?(st.rig||st.cust):null),target=poseFor(st,t);
  var sec=SEC,sk=SK,order=ORDER;
  if(live){
    if(liveKey!==key){blendFrom=livePose?deep(livePose):deep(target);blend=livePose&&opts.play&&!opts.skeleton?0:1;liveKey=key;ST={};}
    blend=Math.min(1,blend+dt/.65);cur=blend<1?lerpS(blendFrom,target,blend):target;livePose=deep(cur);stepSec(dt);BLINK=opts.play&&t%3.7<.12?1:0;
  } else {SEC=deep(STATIC_SEC);SK=deep(STATIC_SK);ORDER={};cur=target;BLINK=0;}
  OUTFITS.active=makeOutfit(st);OUTFIT='active';KH.expr=st.expr||'smile';KH.eyeStyle=st.eyeStyle||'normal';HL=kshade(st.hair,.3);HD=kshade(st.hair,-.18);
  var phi=opts.view==='side'?90:opts.view==='right'?-90:opts.view==='back'?180:0;
  MORPH=characterMorphology(st);MORPH.width=morphologyWidth(MORPH,phi);MORPH.identity=MORPH.width===1&&MORPH.bodyY===1&&MORPH.headX===1&&MORPH.headY===1;
  var r=renderView(cur,phi),g=r.svg;
  if(opts.skeleton)g+=overlay(r.J,phi);
  if(opts.noShadow)g=g.replace(/^<ellipse[^>]*\/>/,'');
  g=morphologyFigure(g);
  SEC=sec;SK=sk;ORDER=order;lastTime=t;
  return {svg:g,pose:deep(cur),joints:morphologyJoints(r.J),phi:phi};
}

return {render:render,pose:poseFor,catalog:maleWardrobeCatalog,elderWomenCatalog:elderWomenCatalog,childrenCatalog:childCatalog,choices:characterChoices,gender:effectiveCharacterGender,morphology:characterMorphology,frameBox:characterFrameBox,exportBox:characterExportBox,resolve:function(id){return ALIASES[id]||id;},poses:LIB.map(function(p){return [p.id,p.n];}),colors:function(st){var o=makeOutfit(st);return {bottomColor:o.bottom.col,shoesColor:o.shoes.col,socksColor:o.socks?o.socks.col:'#f4f4f7',accessoryColor:st.accessoryColor||st.c3,hasSocks:!!o.socks};},handPreview:function(type,skin){var saved=[SKIN,SKINSH];SKIN=skin;SKINSH=kshade(skin,-.14);var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -8 60 62" aria-hidden="true">'+gHand(GH[type]||GH.rl)+'</svg>';SKIN=saved[0];SKINSH=saved[1];return svg;},factorySource:function(){return createCharacterRig.toString();}};
