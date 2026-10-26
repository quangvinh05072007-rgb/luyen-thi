var CHARACTER_AGES=[['adult','Người lớn'],['teen','Thiếu niên'],['child','Trẻ em'],['elder','Cao tuổi']];
var CHARACTER_GENDERS=[['female','Nữ'],['male','Nam']];
var CHARACTER_BEARDS=[['none','Không râu'],['stubble','Râu lún phún'],['moustache','Ria mép'],['short','Râu ngắn'],['full','Râu dài']];
var CHARACTER_FACES=[['original','Mặt gốc'],['round','Tròn'],['oval','Trái xoan'],['long','Dài'],['square','Vuông'],['heart','Trái tim']];
var CHARACTER_BODIES=[['regular','Cân đối'],['slender','Mảnh'],['petite','Nhỏ nhắn'],['tall','Cao'],['rounded','Đầy đặn'],['broad','Vai rộng'],['athletic','Chắc người'],['stooped','Hơi còng']];
var CHARACTER_DETAILS=[['auto','Theo độ tuổi'],['none','Da trơn'],['freckles','Tàn nhang'],['wrinkles','Nếp nhăn']];
TABS[0][2].unshift({id:'identity',t:'Độ tuổi & hình dáng',list:[]});
var summaryBeforeTypes=summary;
summary=function(sec){if(sec.id==='identity')return appearanceLabel(CHARACTER_GENDERS,RIG.gender(S))+' · '+appearanceLabel(CHARACTER_AGES,S.ageGroup||'adult');return summaryBeforeTypes(sec);};
function secBody(sec){
 if(sec.id==='hairStyle'||sec.id==='outfit'){
  var kind=sec.id==='hairStyle'?'hair':'outfits',options=RIG.choices(S,kind,sec.list.map(function(x){return [x.k,x.n];})),male=RIG.gender(S)==='male',list;
  if(male||S.ageGroup==='child'||S.ageGroup==='elder'){
   if(S.ageGroup==='elder')options=options.slice().sort(function(a,b){var older=function(x){return sec.id==='outfit'?x[0].indexOf('m_elder_')===0:['comb_over','sparsecrew','balding','shaved'].indexOf(x[0])>=0;};return Number(older(b))-Number(older(a));});
   list=options.map(function(x){return {k:x[0],n:x[1]};});
   if(!list.some(function(x){return x.k===S[sec.id];}))list=sec.list.filter(function(x){return x.k===S[sec.id];}).concat(list);
  }else list=options.map(function(x){return {k:x[0],n:x[1]};});
  sec=Object.assign({},sec,{list:list});
 }
 if(sec.id!=='identity')return beforeTypesSecBody(sec);
 var fields=[['gender','Giới tính',CHARACTER_GENDERS,RIG.gender(S)],['ageGroup','Độ tuổi',CHARACTER_AGES,'adult'],['faceShape','Khuôn mặt',CHARACTER_FACES,'original'],['bodyShape','Vóc dáng',CHARACTER_BODIES,'regular'],['faceDetail','Nét da',CHARACTER_DETAILS,'auto']];
 if(S.ageGroup==='child'){fields[3][2]=[['regular','Cân đối'],['petite','Nhỏ nhắn'],['rounded','Mũm mĩm'],['tall','Cao hơn'],['slender','Mảnh']];fields[4][2]=CHARACTER_DETAILS.filter(function(x){return x[0]!=='wrinkles';});}
 if(S.ageGroup==='elder'&&RIG.gender(S)==='female'){
  fields[3][2]=[['regular','Vừa người'],['slender','Mảnh'],['petite','Thấp nhỏ'],['tall','Cao'],['rounded','Đầy đặn'],['broad','Vai ngang'],['athletic','Chắc người'],['stooped','Thấp người']];
  fields.push(['elderPosture','Dáng lưng',[['upright','Thẳng tự nhiên'],['relaxed','Hơi khom'],['stooped','Khom rõ']],S.bodyShape==='stooped'?'stooped':'relaxed']);
 }
 if(RIG.gender(S)==='male'&&S.ageGroup!=='child')fields.push(['facialHair','Kiểu râu',CHARACTER_BEARDS,'none']);
 return '<div class="character-identity">'+fields.map(function(f){return '<label class="appearance-select-label" style="margin-bottom:13px">'+f[1]+'<select data-identity-key="'+f[0]+'" aria-label="'+f[1]+'">'+f[2].map(function(o){return '<option value="'+o[0]+'"'+((S[f[0]]||f[3])===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>';}).join('')+'<button type="button" class="appearance-reset" data-reset-identity>Đặt lại hình dáng gốc</button></div>';
}
function camBox(n){return RIG.frameBox(S,legacyCamBox(n),n);}
function appearanceViewBox(st,sec){
 var box=VBS[sec.vb].split(' ').map(Number);
 if(sec.vb!=='outfit')return RIG.frameBox(st,box,'face').join(' ');
 var m=RIG.morphology(st),framed=RIG.frameBox(st,box,'bust'),cx=framed[0]+framed[2]/2,cy=framed[1]+framed[3]/2;
 return [cx-box[2]*m.bodyX/2,cy-box[3]*m.bodyY/2,box[2]*m.bodyX,box[3]*m.bodyY].join(' ');
}
function syncCharacterWardrobe(){
 var hair=RIG.choices(S,'hair',HAIRS),outfit=RIG.choices(S,'outfits',OUTFITS),male=RIG.gender(S)==='male',child=S.ageGroup==='child',special=child||S.ageGroup==='elder'&&!male;
 if(!hair.some(function(x){return x[0]===S.hairStyle;}))S.hairStyle=special?hair[0][0]:male?(S.ageGroup==='elder'?'comb_over':'shortcrop'):'long';
 if(!outfit.some(function(x){return x[0]===S.outfit;}))S.outfit=special?outfit[0][0]:male?(S.ageGroup==='elder'?'m_elder_vest':'m_polo'):'casual';
 if(child){S.facialHair='none';if(['athletic','broad','stooped'].indexOf(S.bodyShape)>=0)S.bodyShape='regular';if(S.faceDetail==='wrinkles')S.faceDetail='auto';}
}
$('edit').addEventListener('change',function(e){
 if(!e.target.hasAttribute('data-identity-key'))return;var key=e.target.dataset.identityKey;S[key]=e.target.value;
 if(['gender','ageGroup'].indexOf(key)>=0)syncCharacterWardrobe();
 if(key==='elderPosture'&&S.pose==='g_custom'){
  if(!S.rig)S.rig=RIG.pose(S,0);
  var preset=RIG.pose(Object.assign({},S,{pose:'stand'}),0);['lum','thor','neck'].forEach(function(k){S.rig[k][0]=preset[k][0];});
 }
 change();
});
$('edit').addEventListener('click',function(e){if(!e.target.closest('[data-reset-identity]'))return;S.ageGroup='adult';S.faceShape='original';S.bodyShape='regular';S.faceDetail='auto';S.facialHair='none';syncCharacterWardrobe();change();});
