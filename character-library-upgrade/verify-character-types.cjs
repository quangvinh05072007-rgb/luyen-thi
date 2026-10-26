const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const dir=__dirname,html=fs.readFileSync(path.join(dir,'Kho nhan vat 2 - Rig nu v2.html'),'utf8');
const start=html.indexOf('function createCharacterRig(){'),end=html.indexOf('\nvar RIG = createCharacterRig();',start);
const source=html.slice(start,end),factory=()=>new Function(source+';return createCharacterRig();')();
const base={outfit:'casual',hairStyle:'bob',skin:'#f3e3d8',hair:'#26212b',eye:'#805337',eyeStyle:'normal',expr:'smile',acc:'none',c1:'#778a77',c2:'#ece7d9',c3:'#b57968',pose:'stand',blush:true};
const views=['front','side','right','back'];
function snapshots(){const rig=factory();return ['long','bob','bun'].flatMap(h=>views.map(view=>rig.render({...base,hairStyle:h},{view}).svg));}
const baseline=path.join(dir,'character-types-baseline.json');
if(process.argv.includes('--baseline')){fs.writeFileSync(baseline,JSON.stringify(snapshots()));console.log('Saved default renderer baseline');process.exit();}
assert.deepEqual(snapshots(),JSON.parse(fs.readFileSync(baseline,'utf8')),'Default artwork changed');
const rig=factory();
assert.equal(typeof rig.morphology,'function','New morphology model is missing');
const adult=rig.morphology(base),child=rig.morphology({...base,ageGroup:'child'});
assert.ok(child.bodyY<adult.bodyY*.8,'Child body must be substantially shorter');
assert.ok(child.headY/child.bodyY>adult.headY/adult.bodyY*1.2,'Child must have a larger head-to-body ratio');
assert.deepEqual(rig.exportBox(base),[-235,-60,470,920]);
assert.ok(rig.exportBox({...base,bodyShape:'tall'})[1]<-120,'Tall characters need extra export headroom');
const sandbox={PRESETS:[{s:base},{s:base},{s:base}],Object,Date,JSON,RIG:rig,cf:s=>({...base,...s})};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(dir,'character-types-presets.js'),'utf8'),sandbox);
const added=sandbox.PRESETS.filter(p=>p.s.templateKey);
assert.equal(added.length,15);assert.equal(new Set(added.map(p=>p.s.templateKey)).size,15);
const original={id:'keep',name:'Tôi đã sửa',s:{...base,hair:'#aa1111'},tags:['Riêng'],t:1};
const db={items:[structuredClone(original)],cur:'keep',prefs:{theme:'old'}};
assert.equal(sandbox.migrateCharacterTypes(db),true);assert.equal(db.items.length,16);assert.deepEqual(db.items[0],original);assert.equal(db.cur,'keep');
assert.equal(sandbox.migrateCharacterTypes(db),false);assert.equal(db.items.length,16);
db.items.pop();sandbox.migrateCharacterTypes(db);assert.equal(db.items.length,15,'Deleted templates must stay deleted');
const fresh={items:added.map((p,i)=>({id:'f'+i,s:p.s})),cur:'f0',prefs:{}};sandbox.migrateCharacterTypes(fresh);assert.equal(fresh.items.length,15,'Fresh databases must not duplicate templates');
let count=0;
for(const preset of added){for(const view of views){for(const [pose] of rig.poses){for(const time of [0,.37]){
 const r=rig.render({...preset.s,pose},{view,time});assert.ok(r.svg.length>1000);assert.ok(!/NaN|Infinity|undefined/.test(r.svg),preset.n+' '+view+' '+pose);count++;
}}}}
for(const faceShape of ['original','round','oval','long','square','heart'])for(const view of views){const r=rig.render({...base,faceShape},{view});assert.ok(!/NaN|Infinity/.test(r.svg));}
for(const ageGroup of ['adult','teen','child','elder'])for(const bodyShape of ['regular','slender','petite','tall','rounded','broad'])for(const faceShape of ['original','round','oval','long','square','heart'])for(const view of views){
 for(const pose of ['stand','walk','wave']){const r=rig.render({...base,ageGroup,bodyShape,faceShape,pose},{view,time:.6});assert.ok(!/NaN|Infinity|undefined/.test(r.svg));assert.ok(Math.abs(Math.hypot(...r.joints.fwL)-1)<1e-6);count++;}
}
assert.match(rig.render({...base,ageGroup:'elder'},{view:'front'}).svg,/age-lines/);
assert.match(rig.render({...base,ageGroup:'elder'},{view:'side'}).svg,/age-lines/);
assert.doesNotMatch(rig.render({...base,ageGroup:'elder'},{view:'back'}).svg,/age-lines/);
assert.match(rig.render({...base,acc:'glasses'},{view:'side'}).svg,/character-glasses/);
assert.notEqual(rig.render({...base,faceShape:'square'},{view:'side'}).svg,rig.render(base,{view:'side'}).svg);
const events={},editor={TABS:[['Tạo hình','user',[]]],summary:()=> 'old summary',appearanceLabel:(list,key)=>(list.find(x=>x[0]===key)||list[0])[1],S:{...base},beforeTypesSecBody:sec=>'old '+sec.id,$:()=>({addEventListener:(type,fn)=>{events[type]=fn;}}),RIG:rig,HAIRS:[['bob','Bob']],OUTFITS:[['casual','Casual']],legacyCamBox:()=>[0,0,380,740],change:()=>{editor.changed=(editor.changed||0)+1;}};
vm.createContext(editor);vm.runInContext(fs.readFileSync(path.join(dir,'character-types-editor.js'),'utf8'),editor);
assert.equal(editor.TABS[0][2][0].id,'identity');assert.equal(editor.secBody({id:'eyes'}),'old eyes');assert.equal((editor.secBody({id:'identity'}).match(/<select /g)||[]).length,5);
events.change({target:{hasAttribute:k=>k==='data-identity-key',dataset:{identityKey:'ageGroup'},value:'child'}});assert.equal(editor.S.ageGroup,'child');assert.equal(editor.changed,1);
events.click({target:{closest:()=>true}});assert.equal(editor.S.ageGroup,'adult');assert.equal(editor.S.faceShape,'original');assert.equal(editor.changed,2);
console.log('PASS default SVG unchanged; 15 templates; non-destructive/idempotent migration; '+count+' pose/view/age renders; facial details/glasses; export framing; editor control handlers');
