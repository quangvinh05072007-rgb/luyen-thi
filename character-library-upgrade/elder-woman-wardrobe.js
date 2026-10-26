function configureElderWomanOutfit(o,st){
 if(!isElderWomanOutfit(st.outfit))return;
 var id=st.outfit,t=o.top,c1=st.c1,c2=st.c2,c3=st.c3;
 t.kind=id;t.col=c1;t.sh=kshade(c1,-.18);t.navy=kshade(c1,-.2);t.flow=0;t.tassel=false;t.hemDrop=55;t.sleeveEnd=2;t.cuff=[1.85,2];t.sleeve=[[0,27,24],[.5,25,23],[1,22,20],[2,18,17]];
 o.bottom={kind:'pants',col:c2,sh:kshade(c2,-.2),leg:[[0,41,36],[1,33,29],[2,31,27]]};o.socks=null;o.shoes={col:'#4b3d37',sh:'#2b2527',sole:kshade(c3,-.2)};
 if(id==='ew_cardigan')t.hemDrop=68;
 if(id==='ew_baba'){t.hemDrop=97;t.cuff=null;t.navy=c1;}
 if(id==='ew_vest'){t.hemDrop=47;t.sleeveCol=c2;t.sleeveSh=kshade(c2,-.16);t.navy=kshade(c2,-.15);o.bottom.col=kshade(c1,-.27);o.bottom.sh=kshade(c1,-.43);}
 if(id==='ew_longcoat'){t.hemDrop=143;t.cuff=null;t.sleeve=[[0,31,27],[1,26,23],[2,21,19]];o.shoes.col='#42363a';}
 if(id==='ew_flora'){t.hemDrop=66;t.sleeveEnd=1.35;t.cuff=[1.22,1.35];t.navy=c1;}
 if(id==='ew_tunic'){t.hemDrop=101;t.cuff=null;t.sleeve=[[0,27,24],[1,24,22],[2,22,20]];o.bottom.leg=[[0,43,38],[1,36,32],[2,34,30]];o.shoes.col='#6a5143';}
 if(id==='ew_shawl'){t.col=c2;t.sh=kshade(c2,-.18);t.navy=kshade(c2,-.24);t.hemDrop=53;o.bottom.col=kshade(c1,-.25);o.bottom.sh=kshade(c1,-.41);}
 if(id==='ew_skirt'){t.hemDrop=44;t.navy=kshade(c1,-.25);o.bottom={kind:'skirt',col:c2,sh:kshade(c2,-.2),trim:kshade(c2,-.25),sashCol:kshade(c2,-.22),sashY:146,sashW:5,short:false,midDrop:300,hem:.84,hemR:68,flow:.25,noTail:true,folds:[-.7,-.35,0,.35,.7]};}
}
function renderElderWomanWardrobe(J,phi,items){
 var st=ACT,id=st.outfit;if(!isElderWomanOutfit(id))return false;
 var front=Math.cos(phi*D2R)>=0,sg=front?1:-1,c1=st.c1,c2=st.c2,c3=st.c3,g='';
 function p(x,y,z){return proj(add(J.chest,mv(J.Rs,[x,y,(z==null?(y<0?19:32):z)*sg])),phi);}
 function poly(points,color){return poly2(points.map(function(q){return p(q[0],q[1],q[2]);}),color,{sw:2});}
 function line(points,color,w){return '<path d="M'+points.map(function(q){var v=p(q[0],q[1],q[2]);return f1(v[0])+' '+f1(v[1]);}).join('L')+'" fill="none" stroke="'+color+'" stroke-width="'+(w||2)+'" stroke-linecap="round" stroke-linejoin="round"/>';}
 function buttons(x,y,n,step){for(var i=0;i<n;i++){var v=p(x,y+i*step);g+='<circle cx="'+v[0]+'" cy="'+v[1]+'" r="3.1" fill="'+c3+'" stroke="'+kshade(c3,-.25)+'" stroke-width=".8"/>';}}
 function pocket(x,y,w,h){g+=poly([[x,y],[x+w,y],[x+w,y+h-4],[x+w/2,y+h],[x,y+h-4]],kshade(c1,-.08))+line([[x,y+3],[x+w,y+3]],kshade(c1,-.27),1.5);}
 function flower(x,y,size){var center=p(x,y,28);for(var i=0;i<5;i++){var a=i*Math.PI*2/5,v=p(x+Math.cos(a)*size*.55,y+Math.sin(a)*size*.55,28);g+='<ellipse cx="'+v[0]+'" cy="'+v[1]+'" rx="'+(Math.max(.25,Math.abs(Math.cos(phi*D2R)))*size*.42)+'" ry="'+size*.5+'" fill="'+c3+'" opacity=".75"/>';}g+='<circle cx="'+center[0]+'" cy="'+center[1]+'" r="'+size*.22+'" fill="'+c2+'"/>';}
 function knit(y,w,col){g+=line([[-w,y],[w,y]],kshade(col,-.23),7);for(var x=-w+3;x<w;x+=5)g+=line([[x,y-3],[x,y+3]],kshade(col,.15),1.1);}
 if(front){
  if(id==='ew_cardigan'){
   g+=poly([[-18,-15],[18,-15],[17,156],[-17,156]],c2)+line([[-23,-11],[-17,26],[-16,157]],kshade(c1,.2),3)+line([[23,-11],[17,26],[16,157]],kshade(c1,.2),3);buttons(14,44,5,24);pocket(-47,117,25,27);pocket(22,117,25,27);
  }else if(id==='ew_baba'){
   g+=line([[-18,-15],[-15,-3],[15,-3],[18,-15]],c3,3)+line([[0,-2],[0,191]],kshade(c1,-.25),1.8);buttons(0,16,7,25);pocket(-46,130,29,36);pocket(17,130,29,36);
  }else if(id==='ew_vest'){
   g+=poly([[-23,-16],[23,-16],[0,50]],c2)+poly([[-23,-16],[-2,8],[-13,23],[-34,-1]],kshade(c2,.14))+poly([[23,-16],[2,8],[13,23],[34,-1]],kshade(c2,.14));
   g+=line([[-27,-10],[0,54],[27,-10]],kshade(c1,-.24),5)+line([[0,57],[0,139]],kshade(c1,.14),2);buttons(0,69,4,21);knit(147,47,c1);flower(-28,92,7);
  }else if(id==='ew_longcoat'){
   g+=poly([[-20,-16],[20,-16],[18,117],[-18,117]],c2)+poly([[-37,-12],[-15,3],[-5,38],[-27,77],[-46,8]],kshade(c1,.13))+poly([[37,-12],[15,3],[5,38],[27,77],[46,8]],kshade(c1,.13));buttons(10,93,5,29);pocket(-50,150,28,35);pocket(22,150,28,35);g+=line([[0,229],[0,269]],kshade(c1,-.27),1.8);
  }else if(id==='ew_flora'){
   g+=line([[-19,-13],[-13,1],[13,1],[19,-13]],kshade(c1,-.25),4);for(var y=30;y<=138;y+=36)for(var x=-30;x<=30;x+=30)flower(x,y,7);
  }else if(id==='ew_tunic'){
   g+=line([[-19,-17],[-19,-3],[19,-3],[19,-17]],c3,4)+line([[12,0],[12,59]],kshade(c1,-.25),1.5);buttons(12,11,3,18);
   g+=line([[-46,171],[-46,200]],c3,2.3)+line([[46,171],[46,200]],c3,2.3);flower(-28,66,9);flower(-15,85,6);
  }else if(id==='ew_shawl'){
   g+=poly([[-47,-10],[-19,-18],[0,12],[-17,74],[-25,147],[-47,130]],c1)+poly([[47,-10],[19,-18],[0,12],[17,74],[25,147],[47,130]],c1);
   [-1,1].forEach(function(s){g+=line([[s*36,5],[s*11,39],[s*30,128]],kshade(c1,.25),2);for(var x=29;x<=46;x+=4)g+=line([[s*x,132],[s*(x-2),146]],c1,2.5);});buttons(0,16,1,1);
  }else if(id==='ew_skirt'){
   g+=line([[-24,-14],[-16,2],[16,2],[24,-14]],kshade(c1,-.23),6);for(var x=-35;x<=35;x+=9)g+=line([[x,32],[x,132]],kshade(c1,.17),1.4);knit(142,47,c1);
  }
 }else{
  if(id==='ew_flora')for(var y=30;y<=138;y+=36)for(var x=-30;x<=30;x+=30)flower(x,y,7);
  if(id==='ew_longcoat'||id==='ew_baba')g+=line([[0,5],[0,id==='ew_longcoat'?269:195]],kshade(c1,-.23),1.6);
  if(id==='ew_shawl')g+=poly([[-49,-8],[49,-8],[57,50],[0,140],[-57,50]],c1)+line([[-43,14],[0,120],[43,14]],kshade(c1,.24),2);
  if(id==='ew_vest'||id==='ew_skirt')knit(id==='ew_vest'?147:142,47,c1);
 }
 items.push({id:'outfitElderWoman',d:id==='ew_shawl'?4.2:3.8,svg:'<g data-elder-woman-outfit="'+id+'">'+g+'</g>'});return true;
}
