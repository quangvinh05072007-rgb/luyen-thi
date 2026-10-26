/* Dedicated male garment construction and scalp artwork. No UI palette changes. */
var MALE_HAIR_CATALOG=[['shortcrop','Tóc ngắn'],['sidepart','Rẽ ngôi'],['crew','Đầu đinh'],['balding','Tóc thưa hai bên'],['shaved','Cạo sát'],['undercut','Undercut'],['quiff','Vuốt phồng'],['slickback','Vuốt ngược'],['middlepart','Rẽ ngôi giữa'],['curlyshort','Xoăn ngắn'],['messy','Tóc rối'],['buzzfade','Đầu đinh fade'],['mullet','Mullet ngắn'],['comb_over','Tóc thưa chải lệch'],['sparsecrew','Tóc bạc thưa']];
var MALE_OUTFIT_CATALOG=[['m_polo','Polo + quần kaki'],['m_office','Sơ mi + cà vạt'],['m_suit','Vest hai mảnh'],['m_bomber','Áo khoác bomber'],['m_sport','Bộ thể thao'],['m_work','Áo túi hộp'],['m_elder_vest','Ghi lê len + sơ mi'],['m_elder_tunic','Áo bà ba nam'],['m_elder_knit','Áo len cổ V'],['m_elder_coat','Áo khoác dài']];
function maleWardrobeCatalog(){return {hair:deep(MALE_HAIR_CATALOG),outfits:deep(MALE_OUTFIT_CATALOG)};}
function wardrobeBlend(a,b,t){var x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16),r='';[16,8,0].forEach(function(shift){r+=Math.round(((x>>shift)&255)*(1-t)+((y>>shift)&255)*t).toString(16).padStart(2,'0');});return '#'+r;}
function isMaleHair(id){return MALE_HAIR_CATALOG.some(function(x){return x[0]===id;});}
function isMaleOutfit(id){return MALE_OUTFIT_CATALOG.some(function(x){return x[0]===id;});}
function configureMaleOutfit(o,st){
  if(!isMaleOutfit(st.outfit))return;
  var id=st.outfit,t=o.top,c1=st.c1,c2=st.c2,c3=st.c3;
  t.kind=id;t.col=c1;t.sh=kshade(c1,-.18);t.navy=c3;t.red=c3;t.flow=0;t.tassel=false;t.hemDrop=42;t.cuff=[1.84,2];t.sleeveEnd=2;
  t.sleeve=[[0,29,26],[.3,28,25],[1,23,21],[2,19,18]];
  o.bottom={kind:'pants',col:c2,sh:kshade(c2,-.22),leg:[[0,37,33],[1,28,26],[2,25,23]]};o.socks=null;
  o.shoes={col:'#493d35',sh:'#2c2526',sole:kshade(c3,-.22)};
  if(id==='m_polo'){t.sleeveEnd=.68;t.cuff=[.58,.68];t.hemDrop=40;o.bottom.leg=[[0,39,34],[1,30,27],[2,27,24]];}
  if(id==='m_office'){t.hemDrop=28;t.navy=kshade(c1,-.14);o.shoes.col='#302c2d';}
  if(id==='m_suit'){t.hemDrop=78;t.cuff=null;o.bottom.col=c1;o.bottom.sh=kshade(c1,-.23);o.bottom.leg=[[0,36,32],[1,28,25],[2,26,23]];o.shoes.col='#25262b';}
  if(id==='m_bomber'){t.hemDrop=54;t.sleeve=[[0,34,29],[.4,33,28],[1,28,24],[2,23,20]];t.navy=kshade(c1,-.28);t.cuff=[1.76,2];o.shoes.col='#e5e1d9';o.shoes.sh='#bbb8b2';}
  if(id==='m_sport'){t.hemDrop=48;t.navy=c3;t.cuff=[1.8,2];o.bottom.leg=[[0,36,32],[1,29,26],[2,20,19]];o.shoes.col='#eeece4';o.shoes.sh='#c4c1b9';}
  if(id==='m_work'){t.hemDrop=64;t.sleeveEnd=1.7;t.cuff=[1.54,1.7];t.navy=kshade(c1,-.12);o.bottom.leg=[[0,40,36],[1,32,29],[2,28,26]];o.shoes.col='#63513a';}
  if(id==='m_elder_vest'){t.hemDrop=46;t.sleeveCol=c2;t.sleeveSh=kshade(c2,-.16);t.navy=kshade(c2,-.13);o.bottom.col=kshade(c1,-.3);o.bottom.sh=kshade(c1,-.45);}
  if(id==='m_elder_tunic'){t.hemDrop=98;t.navy=c1;t.cuff=null;o.bottom.leg=[[0,42,37],[1,35,31],[2,32,29]];o.shoes.col='#4d4236';}
  if(id==='m_elder_knit'){t.hemDrop=50;t.navy=kshade(c1,-.22);t.cuff=[1.78,2];o.bottom.leg=[[0,39,35],[1,31,28],[2,28,26]];o.shoes.col='#554537';}
  if(id==='m_elder_coat'){t.hemDrop=155;t.sleeve=[[0,33,29],[1,27,24],[2,22,20]];t.cuff=null;o.shoes.col='#383332';}
}
function renderMaleWardrobe(J,phi,items,T,B){
  var st=ACT,id=st.outfit;if(!isMaleOutfit(id))return false;
  var c=Math.cos(phi*D2R),front=c>=0,sgn=front?1:-1,c1=st.c1,c2=st.c2,c3=st.c3,g='';
  function xyz(x,y,z){return add(J.chest,mv(J.Rs,[x,y,(z==null?(y<0?21:36):z)*sgn]));}
  function p(x,y,z){return proj(xyz(x,y,z),phi);}
  function polygon(points,color){return poly2(points.map(function(q){return p(q[0],q[1],q[2]);}),color,{sw:2});}
  function line(points,color,w){return '<path d="M'+points.map(function(q){var v=p(q[0],q[1],q[2]);return f1(v[0])+' '+f1(v[1]);}).join('L')+'" fill="none" stroke="'+color+'" stroke-width="'+(w||2)+'" stroke-linecap="round" stroke-linejoin="round"/>';}
  function buttons(y0,n,step,x,color){for(var i=0;i<n;i++){var q=p(x||0,y0+i*step);g+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="2.7" fill="'+(color||c3)+'"/>';}}
  function collar(color){g+=polygon([[-24,-18],[-4,9],[-15,28],[-37,-2]],color)+polygon([[24,-18],[4,9],[15,28],[37,-2]],color);}
  function pocket(x,y,w,h,flap){g+=polygon([[x,y],[x+w,y],[x+w,y+h-5],[x+w/2,y+h],[x,y+h-5]],kshade(c1,-.08));if(flap)g+=polygon([[x-1,y-2],[x+w+1,y-2],[x+w,y+10],[x+w/2,y+14],[x,y+10]],kshade(c1,.1));else g+=line([[x,y+3],[x+w,y+3]],kshade(c1,-.3),1.6);}
  function tie(){g+=polygon([[-8,4],[0,0],[8,4],[6,15],[-6,15]],c3)+polygon([[-5,14],[5,14],[12,91],[0,104],[-12,91]],c3);}
  function rib(y,width){g+=line([[-width,y],[width,y]],kshade(c1,-.25),8);for(var x=-width+3;x<width;x+=5)g+=line([[x,y-3],[x,y+3]],kshade(c1,.12),1);}
  if(front){
    if(id==='m_polo'){collar(kshade(c1,-.12));g+=polygon([[-7,7],[7,7],[7,55],[-7,55]],kshade(c1,-.08));buttons(21,3,13,0,c3);g+=line([[-47,127],[-47,139]],c3,2);}
    else if(id==='m_office'){collar(kshade(c1,.18));g+=line([[0,12],[0,147]],kshade(c1,-.2),1.8);tie();buttons(116,2,21,0,c3);pocket(23,45,25,29,false);}
    else if(id==='m_suit'){
      g+=polygon([[-24,-17],[24,-17],[21,139],[-21,139]],c2);tie();
      g+=polygon([[-38,-12],[-18,3],[-8,37],[-24,75],[-45,14],[-35,10]],kshade(c1,.13))+polygon([[38,-12],[18,3],[8,37],[24,75],[45,14],[35,10]],kshade(c1,.13));
      buttons(113,2,30,9,c3);g+=line([[-43,131],[-23,126]],kshade(c1,-.32),3)+line([[23,126],[43,131]],kshade(c1,-.32),3)+line([[26,45],[48,45]],c3,3);
    }else if(id==='m_bomber'){
      g+=line([[-23,-10],[-18,1],[18,1],[23,-10]],kshade(c1,-.28),9)+line([[0,3],[0,148]],c2,3)+line([[-47,102],[-26,126]],kshade(c1,-.3),4)+line([[47,102],[26,126]],kshade(c1,-.3),4);rib(150,48);
    }else if(id==='m_sport'){
      g+=line([[-22,-14],[-20,4],[20,4],[22,-14]],c3,7)+line([[0,3],[0,144]],c3,2.5);
      [-1,1].forEach(function(k){g+=line([[k*24,20],[k*46,29],[k*54,52]],c3,5)+line([[k*24,30],[k*43,38],[k*50,57]],c3,2);});
    }else if(id==='m_work'){collar(kshade(c1,.12));g+=line([[0,13],[0,155]],kshade(c1,-.3),2);buttons(27,5,28,0,c3);pocket(-49,44,33,40,true);pocket(16,44,33,40,true);}
    else if(id==='m_elder_vest'){
      g+=polygon([[-25,-18],[25,-18],[0,68]],c2);collar(kshade(c2,.12));g+=line([[-28,-10],[0,68],[28,-10]],kshade(c1,-.3),6);
      [-1,1].forEach(function(k){g+=line([[k*50,0],[k*43,32],[k*47,62]],kshade(c1,-.25),5);});
      for(var y=83;y<143;y+=20)for(var x=-30;x<=30;x+=20)g+=line([[x,y],[x+8,y+6],[x,y+12],[x-8,y+6],[x,y]],kshade(c1,.22),1.5);rib(149,48);
    }else if(id==='m_elder_tunic'){
      g+=line([[-20,-16],[-20,-4],[20,-4],[20,-16]],c3,4)+line([[0,-3],[0,180]],kshade(c1,-.3),2);buttons(13,7,24,0,c3);pocket(-48,121,32,35,false);pocket(16,121,32,35,false);
    }else if(id==='m_elder_knit'){
      g+=polygon([[-25,-19],[25,-19],[0,53]],c2)+line([[-28,-16],[0,57],[28,-16]],kshade(c1,-.27),7);
      for(var x=-36;x<=36;x+=9)g+=line([[x,72],[x,139]],kshade(c1,.15),1.6);rib(150,48);
    }else if(id==='m_elder_coat'){
      g+=polygon([[-21,-17],[21,-17],[17,113],[-17,113]],c2);
      g+=polygon([[-36,-17],[-10,20],[-5,42],[-26,90],[-49,6]],kshade(c1,.12))+polygon([[36,-17],[10,20],[5,42],[26,90],[49,6]],kshade(c1,.12));
      buttons(94,4,32,10,c3);g+=line([[0,195],[0,253]],kshade(c1,-.3),2.2);pocket(-51,142,29,34,false);pocket(22,142,29,34,false);
    }
  }else{
    if(id==='m_suit'||id==='m_elder_coat')g+=line([[0,3],[0,id==='m_suit'?176:254]],kshade(c1,-.24),1.7);
    if(id==='m_sport')g+=line([[-49,26],[0,44],[49,26]],c3,6)+line([[-49,36],[0,54],[49,36]],c3,2);
    if(id==='m_bomber'||id==='m_elder_knit'||id==='m_elder_vest')rib(id==='m_bomber'?150:149,48);
    if(id==='m_work')g+=line([[-52,25],[52,25]],kshade(c1,-.24),2.5);
  }
  items.push({id:'outfitDetailsMale',d:3.8,svg:'<g data-male-outfit="'+id+'">'+g+'</g>'});
  return true;
}
function malePantDetail(ext,Q,phi){return ACT.outfit==='m_sport'?tube(ext,[[0,2.2,2.2],[4,2.2,2.2]],{phi:phi,path:Q,fill:ACT.c3,k0:1.25,k1:2.94,caps:'ff',nostroke:true}):'';}
function maleHair(style,profile,back){
  if(['undercut','quiff','slickback','middlepart','curlyshort','messy','buzzfade','mullet','comb_over','sparsecrew'].indexOf(style)<0)return legacyMaleHair(style,profile,back);
  var col=ACT.hair,hl=kshade(col,.35),fade=wardrobeBlend(ACT.skin,col,.45),g='',d='';
  if(['undercut','buzzfade','quiff'].indexOf(style)>=0){var fid='mf'+(++UID);g='<defs><linearGradient id="'+fid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'"/><stop offset=".55" stop-color="'+fade+'"/><stop offset="1" stop-color="'+wardrobeBlend(ACT.skin,col,.22)+'"/></linearGradient></defs>';fade='url(#'+fid+')';}
  var backBase='M-65 -31 Q-69 -98 0 -103 Q69 -98 65 -31 L58 42 Q33 76 0 77 Q-33 76 -58 42Z';
  if(back){
    if(style==='comb_over'||style==='sparsecrew')g=malePath('M-60 -38 Q-70 -9 -59 28 Q-40 68 0 72 Q40 68 59 28 Q70 -9 60 -38 L48 -12 Q32 26 0 28 Q-32 26 -48 -12Z',col,2.7);
    else {
      d=style==='mullet'?'M-65 -31 Q-69 -98 0 -103 Q69 -98 65 -31 L74 68 L63 99 L44 91 L28 106 L10 96 L-10 108 L-30 97 L-48 104 L-66 92 L-74 68Z':style==='curlyshort'?'M-66 -30 Q-82 -39 -69 -54 Q-79 -73 -57 -78 Q-61 -100 -37 -100 Q-22 -119 -3 -106 Q15 -123 33 -105 Q57 -111 62 -89 Q84 -84 72 -62 Q88 -49 70 -33 L62 43 Q33 80 0 77 Q-33 80 -62 43Z':style==='messy'?'M-65 -31 L-78 -59 L-63 -64 L-72 -88 L-47 -83 L-47 -112 L-24 -98 L-8 -125 L9 -105 L31 -118 L42 -97 L67 -100 L61 -77 L78 -63 L65 -31 L58 42 Q33 76 0 77 Q-33 76 -58 42Z':style==='quiff'?'M-65 -31 Q-72 -76 -50 -110 Q-28 -142 -7 -129 Q22 -137 48 -109 Q74 -80 65 -31 L58 42 Q33 76 0 77 Q-33 76 -58 42Z':backBase;
      g+=malePath(d,col,3);
      if(['undercut','buzzfade','quiff'].indexOf(style)>=0)g+='<path d="M-64 -26 Q0 -6 64 -26 L58 42 Q33 76 0 77 Q-33 76 -58 42Z" fill="'+fade+'"/><path d="'+d+'" fill="none" stroke="'+OUT+'" stroke-width="3"/>';
      if(style==='middlepart')g+='<path d="M0 -99 Q-7 -17 0 66" stroke="'+hl+'" stroke-width="2" fill="none"/>';
    }
  }else if(profile){
    var profiles={
      undercut:'M-60 -37 Q-72 -71 -35 -103 Q14 -116 51 -87 Q80 -61 70 -18 L58 32 L44 35 L40 -13 L33 -45 Q-5 -66 -60 -37Z',
      quiff:'M-61 -38 Q-82 -87 -54 -122 Q-37 -141 -16 -121 Q18 -129 49 -95 Q79 -65 69 -18 L59 32 L44 34 L40 -13 Q52 -29 33 -28 L21 -57 Q-17 -76 -61 -38Z',
      slickback:'M-61 -36 Q-65 -82 -16 -110 Q38 -127 67 -79 L73 -31 L60 32 L45 34 L40 -15 Q52 -30 34 -28 L23 -57 Q-18 -72 -61 -36Z',
      middlepart:'M-64 -28 Q-76 -76 -34 -101 Q17 -121 53 -88 Q76 -60 68 -16 L58 32 L45 31 L39 -16 L17 -58 Q-9 -68 -34 -25 L-46 -12 L-48 -39Z',
      curlyshort:'M-64 -23 Q-78 -28 -72 -47 Q-84 -64 -63 -77 Q-68 -98 -41 -101 Q-29 -124 -6 -110 Q17 -126 33 -105 Q59 -112 63 -87 Q85 -83 72 -62 Q86 -47 72 -31 L60 31 L45 33 L40 -11 Q53 -29 32 -27 L20 -54 Q0 -37 -14 -48 Q-40 -24 -64 -23Z',
      messy:'M-64 -23 L-76 -48 L-66 -55 L-74 -81 L-50 -76 L-49 -108 L-27 -94 L-11 -123 L7 -104 L27 -116 L38 -97 L61 -96 L58 -76 L76 -63 L69 -20 L60 32 L45 33 L40 -12 Q51 -29 33 -28 L20 -49 L-6 -44 L-22 -56 L-42 -31Z',
      buzzfade:'M-59 -34 L-57 -65 Q-28 -103 18 -99 Q72 -89 69 -26 L59 31 L45 33 L40 -15 Q51 -28 33 -28 L23 -55 Q-12 -69 -59 -34Z',
      mullet:'M-61 -29 Q-72 -77 -32 -100 Q20 -114 55 -83 Q79 -57 68 -10 L79 74 L61 95 L46 87 L33 102 L29 45 L37 13 L36 -13 Q51 -29 31 -27 L19 -52 L-8 -49 L-32 -33Z',
      comb_over:'M44 -66 Q76 -59 69 -18 L61 31 L45 36 L35 -7 Q47 -24 44 -66Z',
      sparsecrew:'M45 -48 Q72 -43 69 -11 L61 31 L46 34 L39 -7 Q49 -20 45 -48Z'
    };g+=malePath(profiles[style],col,3);
    if(['undercut','buzzfade','quiff'].indexOf(style)>=0)g+=malePath('M42 -49 Q62 -42 69 -29 L60 30 L45 33 L40 -13Z',fade,1.3);
    if(style==='comb_over')g+='<path d="M40 -77 Q-6 -102 -49 -69 M38 -72 Q-2 -94 -48 -64 M34 -66 Q0 -85 -37 -61" fill="none" stroke="'+col+'" stroke-width="3" stroke-linecap="round"/>';
    else if(style==='sparsecrew')g+='<path d="M-41 -71 l-3 -10 M-26 -83 l-1 -10 M-9 -89 l2 -10 M9 -90 l3 -9 M25 -83 l4 -8" stroke="'+col+'" stroke-width="2.6" stroke-linecap="round"/>';
    else if(style==='slickback'||style==='middlepart')g+='<path d="M-44 -61 Q1 -106 51 -72 M-33 -58 Q8 -93 53 -61 M-18 -54 Q21 -77 54 -48" stroke="'+hl+'" stroke-width="2.3" opacity=".6" fill="none"/>';
  }else{
    var fronts={
      undercut:'M-63 6 L-67 -49 Q-64 -104 -12 -109 Q42 -116 65 -72 L66 -26 L56 7 L51 -36 Q8 -61 -49 -34 L-55 7Z',
      quiff:'M-63 6 Q-72 -43 -60 -76 Q-57 -116 -25 -132 Q-2 -141 14 -121 Q55 -123 66 -77 L65 -27 L55 7 L50 -35 Q8 -73 -50 -33 L-55 7Z',
      slickback:'M-64 6 L-68 -43 Q-65 -114 0 -114 Q65 -114 68 -43 L64 6 L53 6 L48 -39 Q0 -71 -48 -39 L-53 6Z',
      middlepart:'M-63 9 Q-76 -42 -54 -78 Q-25 -117 0 -97 Q25 -117 54 -78 Q76 -42 63 9 L51 9 L47 -28 L30 -9 Q6 -31 0 -72 Q-6 -31 -30 -9 L-47 -28 L-51 9Z',
      curlyshort:'M-65 6 L-69 -25 Q-86 -38 -73 -52 Q-84 -73 -61 -78 Q-65 -103 -39 -103 Q-21 -123 -2 -108 Q15 -126 35 -106 Q61 -111 64 -87 Q89 -79 75 -58 Q89 -43 70 -27 L64 6 L53 6 L49 -31 Q32 -21 20 -35 Q1 -21 -12 -35 Q-34 -24 -48 -31 L-54 6Z',
      messy:'M-63 6 L-69 -29 L-80 -54 L-64 -60 L-76 -86 L-49 -81 L-49 -111 L-25 -97 L-8 -124 L8 -105 L31 -117 L40 -95 L67 -99 L60 -75 L79 -61 L66 -28 L63 6 L53 6 L48 -31 L31 -22 L15 -41 L1 -27 L-18 -44 L-36 -23 L-50 -31 L-54 6Z',
      buzzfade:'M-64 6 L-65 -48 Q-57 -100 0 -104 Q57 -100 65 -48 L64 6 L53 6 L51 -39 Q0 -53 -51 -39 L-53 6Z',
      mullet:'M-63 -5 Q-73 -58 -48 -85 Q0 -119 48 -85 Q73 -58 63 -5 L70 55 L62 86 L51 77 L47 44 L48 -30 L33 -20 L17 -41 L2 -29 L-18 -44 L-48 -25 L-48 45 L-53 82 L-66 87 L-72 57Z',
      comb_over:'M-63 -43 Q-72 -12 -60 23 L-51 23 L-52 -28Z M63 -43 Q72 -12 60 23 L51 23 L52 -28Z',
      sparsecrew:'M-63 -32 Q-70 -5 -60 23 L-51 23 L-52 -21Z M63 -32 Q70 -5 60 23 L51 23 L52 -21Z'
    };g+=malePath(fronts[style],col,3);
    if(['undercut','buzzfade','quiff'].indexOf(style)>=0)g+=malePath('M-64 -29 L-52 -38 L-53 6 L-64 6Z M64 -29 L52 -38 L53 6 L64 6Z',fade,1.2);
    if(style==='comb_over')g+='<path d="M41 -81 Q-7 -106 -49 -70 M42 -75 Q-4 -97 -48 -64 M42 -68 Q6 -88 -34 -62" fill="none" stroke="'+col+'" stroke-width="3" stroke-linecap="round"/>';
    else if(style==='sparsecrew')g+='<path d="M-34 -83 l-3 -9 M-18 -91 l-1 -8 M0 -94 l1 -8 M18 -90 l3 -8 M33 -83 l3 -7" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round"/>';
    else if(style==='slickback')g+='<path d="M-44 -50 Q-43 -94 -24 -102 M-22 -56 Q-19 -98 -5 -106 M0 -58 Q3 -99 14 -103 M24 -54 Q25 -95 33 -97" stroke="'+hl+'" stroke-width="2" fill="none" opacity=".6"/>';
    else if(style==='middlepart')g+='<path d="M0 -96 L0 -72 M-7 -87 Q-35 -79 -42 -39 M7 -87 Q35 -79 42 -39" stroke="'+hl+'" stroke-width="2.5" opacity=".6" fill="none"/>';
  }
  return '<g data-edit-part="hairStyle" data-male-hair="'+style+'">'+g+'</g>';
}
