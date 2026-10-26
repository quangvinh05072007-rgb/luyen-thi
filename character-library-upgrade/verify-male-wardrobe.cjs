const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=__dirname,html=fs.readFileSync(path.join(dir,'Kho nhan vat 2 - Rig nu v2.html'),'utf8'),a=html.indexOf('function createCharacterRig(){'),b=html.indexOf('\nvar RIG = createCharacterRig();',a),rig=new Function(html.slice(a,b)+';return createCharacterRig();')();
assert.equal(typeof rig.catalog,'function','Dedicated male wardrobe catalog is missing');
const catalog=rig.catalog();assert.equal(catalog.outfits.length,10);assert.equal(catalog.hair.length,15);
const st={gender:'male',outfit:'m_polo',hairStyle:'undercut',pose:'stand',skin:'#ddb99d',hair:'#3e3330',eye:'#70523c',eyeStyle:'normal',expr:'smile',acc:'none',c1:'#667d79',c2:'#ded7c7',c3:'#a47d50'};
assert.ok(rig.exportBox({...st,hairStyle:'quiff'})[1]<=-85,'Tall quiff needs export headroom');
let count=0;const signatures=new Set();
for(const [outfit] of catalog.outfits){for(const view of ['front','side','right','back'])for(const [pose] of rig.poses){const r=rig.render({...st,outfit,pose},{view,time:.41});assert.ok(!/NaN|Infinity|undefined/.test(r.svg),outfit+' '+view+' '+pose);assert.match(r.svg,/data-male-outfit/);count++;}signatures.add(rig.render({...st,outfit}).svg.replace(/m[ef]\d+/g,'id').replace(/data-male-outfit=\"[^\"]*\"/g,'outfit'));}
assert.equal(signatures.size,10,'Each outfit needs distinct drawn construction');
for(const [hairStyle] of catalog.hair)for(const view of ['front','side','right','back']){const r=rig.render({...st,hairStyle},{view});assert.ok(!/NaN|Infinity|undefined/.test(r.svg));if(['shortcrop','sidepart','crew','balding','shaved'].indexOf(hairStyle)<0)assert.match(r.svg,/data-male-hair/);count++;}
const ctx={PRESETS:[{s:st},{s:st},{s:st}],Object,Date,JSON,RIG:rig,cf:s=>s};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(dir,'character-types-presets.js'),'utf8'),ctx);
const orig={id:'keep',name:'Tên riêng',tags:['Đã sửa'],s:{...st,templateKey:'man-broad',hairStyle:'crew',outfit:'casual',skin:'#bb8866',c1:'#aabbcc'},t:1};
const edited={id:'edited',name:'Đồ riêng',s:{...st,templateKey:'grandpa-kind',outfit:'m_work',hairStyle:'messy'},tags:[],t:2};
const db={items:[structuredClone(orig),structuredClone(edited)],cur:'keep',prefs:{characterTypesV1:true,characterTypesV2:true}};
ctx.migrateCharacterTypes(db);assert.equal(db.items.length,2);assert.equal(db.items[0].s.outfit,'m_bomber');assert.equal(db.items[0].s.hairStyle,'undercut');assert.equal(db.items[0].s.c1,'#aabbcc');assert.equal(db.items[0].name,'Tên riêng');assert.deepEqual(db.items[1],edited);assert.equal(db.cur,'keep');assert.equal(ctx.migrateCharacterTypes(db),false);
const events={},editor={TABS:[['A','user',[]]],summary:()=>'',appearanceLabel:(l,k)=>(l.find(x=>x[0]===k)||l[0])[1],S:{...st},beforeTypesSecBody:s=>s.list.map(x=>x.k).join(','),$:()=>({addEventListener:(t,fn)=>events[t]=fn}),RIG:rig,legacyCamBox:()=>[0,0,380,740],change:()=>{},OUTFITS:catalog.outfits,HAIRS:catalog.hair,VBS:{hair:'90 20 200 168',outfit:'0 200 380 507'}};vm.createContext(editor);vm.runInContext(fs.readFileSync(path.join(dir,'character-types-editor.js'),'utf8'),editor);
const sec={id:'outfit',list:[{k:'dress',n:'Váy'},{k:'m_polo',n:'Polo'}]};assert.doesNotMatch(editor.secBody(sec),/(^|,)dress(,|$)/);assert.match(editor.secBody(sec),/m_elder_vest/);
editor.S.gender='female';editor.S.outfit='dress';assert.doesNotMatch(editor.secBody(sec),/m_polo/);
const child={...st,ageGroup:'child'},box=editor.appearanceViewBox(child,{vb:'hair'}).split(' ').map(Number),headY=70+.77*rig.render(child).joints.head[1];assert.ok(headY>box[1]&&headY<box[1]+box[3],'Child hair thumbnail must follow the head');
console.log('PASS 10 male outfits, 15 male hairstyles; '+count+' view/motion renders; dedicated options; non-destructive one-time wardrobe migration');
