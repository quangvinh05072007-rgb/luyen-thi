function configureChildOutfit(o,st){
 if(!isChildOutfit(st.outfit))return;
 var id=st.outfit,t=o.top,c1=st.c1,c2=st.c2,c3=st.c3,girl=id.indexOf('kg_')===0,skirt=girl&&id!=='kg_overalls';
 t.kind=id;t.col=c1;t.sh=kshade(c1,-.16);t.navy=c3;t.flow=0;t.tassel=false;t.hemDrop=28;t.sleeveEnd=.62;t.cuff=[.52,.62];t.sleeve=[[0,24,21],[.5,22,20],[1,17,15],[2,13,12]];
 o.bottom={kind:'shorts',len:.72,col:c2,sh:kshade(c2,-.2),leg:[[0,31,27],[.5,30,26],[1,29,25]]};
 if(skirt)o.bottom={kind:'skirt',col:id==='kg_sundress'?c1:c2,sh:kshade(id==='kg_sundress'?c1:c2,-.19),trim:c3,sashCol:c3,sashY:96,sashW:5,short:true,midDrop:98,hem:-.22,hemR:56,flow:.22,noTail:true,folds:[-.65,-.3,.3,.65]};
 o.socks=null;o.shoes={col:'#eeeae4',sh:'#c7c1ba',sole:c3};
 if(id==='kb_hoodie'){t.hemDrop=40;t.sleeveEnd=2;t.cuff=[1.8,2];o.bottom={kind:'pants',col:c2,sh:kshade(c2,-.2),leg:[[0,31,27],[1,24,22],[2,17,16]]};}
 if(id==='kb_dungarees'||id==='kg_overalls'){t.cuff=null;o.bottom.len=id==='kb_dungarees'?.79:.58;}
 if(id==='kg_sundress'){t.sleeveEnd=.015;t.cuff=null;o.bottom.hemR=64;o.bottom.midDrop=104;}
 if(id==='kg_pinafore'){o.bottom.hemR=58;t.sleeveCol=c1;}
 if(id==='kg_cardigan'){t.sleeveEnd=2;t.cuff=[1.8,2];o.bottom.hemR=57;}
 if(id==='kb_school'||id==='kg_school'){t.navy=kshade(c1,-.18);o.socks={col:'#f6f3ed',sh:'#d6d5d3',from:1.75,prof:[[1,21,19],[1.35,21,19],[2,14,13],[3,13,12]]};o.shoes.col='#3f3c4c';}
 if(id==='kb_sport')o.shoes.col=c3;
}
function renderChildWardrobe(J,phi,items){
 var st=ACT,id=st.outfit;if(!isChildOutfit(id))return false;
 var c=Math.cos(phi*D2R),front=c>=0,sg=front?1:-1,c1=st.c1,c2=st.c2,c3=st.c3,g='';
 function p(x,y,z){return proj(add(J.chest,mv(J.Rs,[x,y,(z==null?(y<0?16:29):z)*sg])),phi);}
 function poly(points,color){return poly2(points.map(function(q){return p(q[0],q[1],q[2]);}),color,{sw:1.8});}
 function line(points,color,w){return '<path d="M'+points.map(function(q){var v=p(q[0],q[1],q[2]);return f1(v[0])+' '+f1(v[1]);}).join('L')+'" stroke="'+color+'" stroke-width="'+(w||2)+'" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';}
 function button(x,y,col){var v=p(x,y);g+='<circle cx="'+v[0]+'" cy="'+v[1]+'" r="3" fill="'+(col||c3)+'"/>';}
 function collar(col){g+=poly([[-18,-13],[-2,8],[-12,22],[-28,-1]],col)+poly([[18,-13],[2,8],[12,22],[28,-1]],col);}
 function bow(y){g+=poly([[0,y],[-17,y-10],[-17,y+9]],c3)+poly([[0,y],[17,y-10],[17,y+9]],c3);button(0,y,c3);}
 function star(x,y,size){var pts=[];for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,r=i%2?size*.45:size;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}return poly(pts,c3);}
 function bib(skirt){
  if(front){g+=poly([[-27,22],[27,22],[33,113],[-33,113]],c2)+poly([[-24,-10],[-14,-7],[-14,30],[-26,30]],c2)+poly([[24,-10],[14,-7],[14,30],[26,30]],c2);button(-20,27);button(20,27);g+=poly([[-16,60],[16,60],[14,85],[0,92],[-14,85]],kshade(c2,.12));}
  else g+=line([[-25,-6],[22,111]],c2,11)+line([[25,-6],[-22,111]],c2,11);
  if(!skirt)g+=poly([[-43,106],[43,106],[43,149],[-43,149]],c2);
 }
 if(front){
  if(id==='kb_tee_shorts'){g+=line([[-18,-11],[-15,0],[15,0],[18,-11]],c3,5)+star(0,56,18);}
  if(id==='kb_polo'){collar(kshade(c1,-.12));g+=line([[0,8],[0,45]],c3,2);button(0,18);button(0,32);g+=star(27,52,8);}
  if(id==='kb_dungarees'||id==='kg_overalls')bib(false);
  if(id==='kb_school'){collar(kshade(c1,.12));g+=poly([[-5,8],[5,8],[8,54],[0,63],[-8,54]],c3)+line([[0,66],[0,131]],kshade(c1,-.2),1.6);button(0,93);button(0,117);}
  if(id==='kb_sport'){g+=line([[-18,-12],[-16,0],[16,0],[18,-12]],c3,5)+line([[-38,29],[38,29]],c3,5)+line([[-37,38],[37,38]],c3,2);g+=star(0,72,13);}
  if(id==='kb_hoodie'){g+=poly([[-22,74],[22,74],[33,108],[0,116],[-33,108]],kshade(c1,-.14))+line([[-18,-13],[-11,4],[11,4],[18,-13]],c2,6)+star(0,40,10);}
  if(id==='kg_pinafore'){bib(true);collar(kshade(c1,.2));}
  if(id==='kg_sundress'){collar(c2);bow(89);g+=star(0,43,11);}
  if(id==='kg_tee_skirt'){g+=line([[-18,-12],[-16,0],[16,0],[18,-12]],c3,4)+star(0,51,16);}
  if(id==='kg_cardigan'){g+=poly([[-16,-9],[16,-9],[15,91],[-15,91]],c2)+line([[0,14],[0,98]],c3,2);[26,49,72,95].forEach(function(y){button(0,y);});}
  if(id==='kg_school'){collar(c2);bow(20);g+=line([[0,34],[0,90]],kshade(c1,-.2),1.5);}
 }else{
  if(id==='kb_dungarees'||id==='kg_overalls')bib(false);
  if(id==='kg_pinafore')bib(true);
  if(id==='kb_hoodie')g+=poly([[-27,-13],[-37,12],[-23,48],[0,56],[23,48],[37,12],[27,-13]],kshade(c1,-.12));
  if(id==='kb_sport')g+=line([[-38,29],[38,29]],c3,5)+line([[-37,38],[37,38]],c3,2);
  if(id==='kg_school')g+=poly([[-31,-5],[31,-5],[29,36],[-29,36]],c2)+line([[-25,29],[25,29]],c3,2);
 }
 items.push({id:'outfitChild',d:3.8,svg:'<g data-child-outfit="'+id+'">'+g+'</g>'});return true;
}
function childPantDetail(ext,Q,phi){return ACT.outfit==='kb_sport'?tube(ext,[[0,2,2],[4,2,2]],{phi:phi,path:Q,fill:ACT.c3,k0:1.15,k1:1.65,caps:'ff',nostroke:true}):'';}
