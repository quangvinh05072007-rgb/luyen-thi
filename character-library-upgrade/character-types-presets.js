/* Shared templates for the library seed and one-time database upgrade. */
var CHARACTER_TYPES=[
 {key:'grandma-kind',n:'Bà ngoại hiền',s:{ageGroup:'elder',faceShape:'round',bodyShape:'rounded',hairStyle:'highbun',hair:'#c9c7c8',outfit:'cardigan',acc:'glasses',c1:'#795b70',c2:'#e9dfcd',c3:'#80694d',eye:'#76583d',blush:false}},
 {key:'grandma-slim',n:'Bà cụ tóc bạc',s:{ageGroup:'elder',faceShape:'long',bodyShape:'slender',hairStyle:'bun',hair:'#e0dcda',outfit:'aodai',acc:'none',c1:'#6c8177',c2:'#d4c9b3',c3:'#a99671',eye:'#514b43',skin:'#dbbfa8',blush:false}},
 {key:'grandma-bob',n:'Bà nội thanh lịch',s:{ageGroup:'elder',faceShape:'square',bodyShape:'petite',hairStyle:'bob',hair:'#aaa6af',outfit:'sweater',acc:'glasses',c1:'#9a6f58',c2:'#ede4d1',c3:'#544e5d',eye:'#765840',blush:false}},
 {key:'child-girl',n:'Bé gái tóc hai bên',s:{ageGroup:'child',faceShape:'round',bodyShape:'regular',hairStyle:'twin',hair:'#493127',outfit:'dress',acc:'ribbon',c1:'#cd7f91',c2:'#f6e4d5',c3:'#9b405c',eye:'#805337',blush:true}},
 {key:'child-boy',n:'Bé trai tinh nghịch',s:{gender:'male',ageGroup:'child',faceShape:'square',bodyShape:'regular',hairStyle:'shortcrop',hair:'#30292b',outfit:'casual',acc:'none',faceDetail:'freckles',c1:'#d4ac62',c2:'#537b9d',c3:'#a95b46',eye:'#6c5a43',blush:false}},
 {key:'child-school',n:'Bé gái đi học',s:{ageGroup:'child',faceShape:'heart',bodyShape:'petite',hairStyle:'bob',hair:'#27232c',outfit:'sailor',acc:'none',c1:'#ecede7',c2:'#355473',c3:'#ba5464',eye:'#514b43',blush:true}},
 {key:'adult-tall',n:'Cô gái dáng cao',s:{ageGroup:'adult',faceShape:'oval',bodyShape:'tall',hairStyle:'ponytail',hair:'#654537',outfit:'casual',acc:'none',c1:'#6b8d86',c2:'#405778',c3:'#d6ad70',eye:'#5a735a',skin:'#e1b698',blush:false}},
 {key:'adult-rounded',n:'Cô gái đầy đặn',s:{ageGroup:'adult',faceShape:'round',bodyShape:'rounded',hairStyle:'wavy',hair:'#322835',outfit:'dress',acc:'flowers',faceDetail:'freckles',c1:'#7a749e',c2:'#ede2d0',c3:'#b59b62',eye:'#71553c',blush:true}}
];
CHARACTER_TYPES.push(
 {batch:2,key:'man-broad',n:'Nam vai rộng',s:{gender:'male',ageGroup:'adult',faceShape:'square',bodyShape:'broad',hairStyle:'crew',facialHair:'none',hair:'#27262b',outfit:'casual',acc:'none',c1:'#617d75',c2:'#3c4c62',c3:'#b09a6d',eye:'#5d4938',skin:'#dbb18e',blush:false}},
 {batch:2,key:'man-tall',n:'Chàng trai cao gầy',s:{gender:'male',ageGroup:'adult',faceShape:'long',bodyShape:'tall',hairStyle:'sidepart',facialHair:'none',hair:'#493729',outfit:'shirt',acc:'glasses',c1:'#d9dcd6',c2:'#45536a',c3:'#5d5152',eye:'#64715c',skin:'#efd4b8',blush:false}},
 {batch:2,key:'man-athletic',n:'Nam thể thao',s:{gender:'male',ageGroup:'adult',faceShape:'square',bodyShape:'athletic',hairStyle:'shortcrop',facialHair:'stubble',hair:'#30272a',outfit:'casual',acc:'none',sleeveStyle:'short',c1:'#8b4548',c2:'#3c444d',c3:'#c49e67',eye:'#4d4235',skin:'#c99b76',blush:false}},
 {batch:2,key:'man-rounded',n:'Chú trung niên',s:{gender:'male',ageGroup:'adult',faceShape:'round',bodyShape:'rounded',hairStyle:'sidepart',facialHair:'moustache',hair:'#3f3532',outfit:'jacket',acc:'none',c1:'#58657b',c2:'#e9dfca',c3:'#a88b5d',eye:'#725942',skin:'#daba9e',blush:false}},
 {batch:2,key:'grandpa-beard',n:'Ông ngoại râu bạc',s:{gender:'male',ageGroup:'elder',faceShape:'long',bodyShape:'stooped',hairStyle:'balding',facialHair:'full',hair:'#ccc8bd',outfit:'sweater',acc:'none',c1:'#826b5f',c2:'#4a4b47',c3:'#b7a582',eye:'#675d50',skin:'#d3b299',blush:false}},
 {batch:2,key:'grandpa-kind',n:'Ông cụ phúc hậu',s:{gender:'male',ageGroup:'elder',faceShape:'round',bodyShape:'rounded',hairStyle:'balding',facialHair:'moustache',hair:'#bcbcc2',outfit:'cardigan',acc:'glasses',c1:'#68755e',c2:'#e6decd',c3:'#736657',eye:'#675b4d',skin:'#e0c4a6',blush:false}},
 {batch:2,key:'grandpa-square',n:'Ông cụ tóc bạc',s:{gender:'male',ageGroup:'elder',faceShape:'square',bodyShape:'petite',hairStyle:'crew',facialHair:'short',hair:'#c7c6c1',outfit:'shirt',acc:'none',c1:'#a8acb0',c2:'#53586b',c3:'#645e55',eye:'#6c6254',skin:'#d8bca2',blush:false}}
);
var MALE_WARDROBE_REVISIONS={
 'child-boy':{outfit:['casual','m_polo'],hairStyle:['shortcrop','messy']},
 'man-broad':{outfit:['casual','m_bomber'],hairStyle:['crew','undercut']},
 'man-tall':{outfit:['shirt','m_office'],hairStyle:['sidepart','quiff']},
 'man-athletic':{outfit:['casual','m_sport'],hairStyle:['shortcrop','buzzfade']},
 'man-rounded':{outfit:['jacket','m_polo'],hairStyle:['sidepart','middlepart']},
 'grandpa-beard':{outfit:['sweater','m_elder_tunic'],hairStyle:['balding','comb_over']},
 'grandpa-kind':{outfit:['cardigan','m_elder_vest'],hairStyle:['balding','sparsecrew']},
 'grandpa-square':{outfit:['shirt','m_elder_coat'],hairStyle:['crew','slickback']}
};
var CHILD_WARDROBE_REVISIONS={
 'child-boy':{gender:'male',outfit:[['casual','m_polo'],'kb_dungarees'],hairStyle:[['shortcrop','pixie','messy'],'cb_tousled']},
 'child-girl':{gender:'female',outfit:[['dress'],'kg_sundress'],hairStyle:[['twin'],'cg_pigtails']},
 'child-school':{gender:'female',outfit:[['sailor'],'kg_school'],hairStyle:[['bob'],'cg_braids']}
};
var ELDER_WOMAN_REVISIONS={
 'grandma-kind':{outfit:[['cardigan'],'ew_cardigan'],hairStyle:[['highbun'],'eh_lowbun'],posture:'relaxed'},
 'grandma-slim':{outfit:[['aodai'],'ew_baba'],hairStyle:[['bun'],'eh_thinbun'],posture:'stooped'},
 'grandma-bob':{outfit:[['sweater'],'ew_shawl'],hairStyle:[['bob'],'eh_shortwaves'],posture:'upright'}
};
CHARACTER_TYPES.forEach(function(p){
 var rev=MALE_WARDROBE_REVISIONS[p.key],childRev=CHILD_WARDROBE_REVISIONS[p.key],olderRev=ELDER_WOMAN_REVISIONS[p.key];
 if(rev)Object.keys(rev).forEach(function(k){p.s[k]=rev[k][1];});
 if(childRev)['outfit','hairStyle'].forEach(function(k){p.s[k]=childRev[k][1];});
 if(olderRev){['outfit','hairStyle'].forEach(function(k){p.s[k]=olderRev[k][1];});p.s.elderPosture=olderRev.posture;}
 PRESETS.push({n:p.n,s:Object.assign({},PRESETS[2].s,{pose:'stand',mood:0,expr:'smile',eyeStyle:'normal',circles:false,hairCover:false,crack:false,bg:'mist',skin:'#f3dcc7',faceDetail:'auto'},p.s,{templateKey:p.key})});
});
function migrateCharacterTypes(db){
 var changed=false;
 CHARACTER_TYPES.forEach(function(p){
  var flag=(p.batch||1)===2?'characterTypesV2':'characterTypesV1';if(db.prefs[flag])return;
  if(db.items.some(function(it){return it.s&&it.s.templateKey===p.key;}))return;
  var preset=PRESETS.filter(function(x){return x.s.templateKey===p.key;})[0];
  db.items.push({id:'type-v'+(p.batch||1)+'-'+p.key,name:p.n,tags:[],fav:false,s:cf(preset.s),t:Date.now()});
 });
 ['characterTypesV1','characterTypesV2'].forEach(function(k){if(!db.prefs[k])changed=true;db.prefs[k]=true;});
 if(!db.prefs.maleWardrobeV1){
  db.items.forEach(function(it){var rev=MALE_WARDROBE_REVISIONS[it.s.templateKey];if(!rev||RIG.gender(it.s)!=='male')return;Object.keys(rev).forEach(function(k){if(it.s[k]===rev[k][0])it.s[k]=rev[k][1];});});
  db.prefs.maleWardrobeV1=true;changed=true;
 }
 if(!db.prefs.childWardrobeV1){
  db.items.forEach(function(it){var rev=CHILD_WARDROBE_REVISIONS[it.s.templateKey];if(!rev||it.s.ageGroup!=='child'||RIG.gender(it.s)!==rev.gender)return;['outfit','hairStyle'].forEach(function(k){if(rev[k][0].indexOf(it.s[k])>=0)it.s[k]=rev[k][1];});});
  db.prefs.childWardrobeV1=true;changed=true;
 }
 if(!db.prefs.elderWomenWardrobeV1){
  db.items.forEach(function(it){var rev=ELDER_WOMAN_REVISIONS[it.s.templateKey];if(!rev||it.s.ageGroup!=='elder'||RIG.gender(it.s)!=='female')return;['outfit','hairStyle'].forEach(function(k){if(rev[k][0].indexOf(it.s[k])>=0)it.s[k]=rev[k][1];});if(!it.s.elderPosture&&it.s.bodyShape!=='stooped')it.s.elderPosture=rev.posture;});
  db.prefs.elderWomenWardrobeV1=true;changed=true;
 }
 return changed;
}
function characterCategory(st,name){
 var gender=RIG.gender(st);
 var age=st.ageGroup;
 if(['child','teen','adult','elder'].indexOf(age)<0){var n=String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');age=/nu sinh|hoc sinh/.test(n)?'teen':'adult';}
 return {gender:gender,age:age};
}
function characterGroupLabel(st,name){var c=characterCategory(st,name);return (c.gender==='male'?'Nam':'Nữ')+' '+({child:'Trẻ em',teen:'Thiếu niên',adult:'Người lớn',elder:'Cao tuổi'})[c.age];}
