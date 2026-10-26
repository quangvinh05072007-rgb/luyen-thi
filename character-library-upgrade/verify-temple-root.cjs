const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'Kho nhan vat 2 - Rig nu v2.html'),'utf8');
const start=html.indexOf('function createCharacterRig(){'),end=html.indexOf('\nvar RIG = createCharacterRig();',start);
const source=html.slice(start,end).replace('return {render:render,pose:poseFor,','return {inspectTemple:profileTempleLock,render:render,pose:poseFor,');
const rig=new Function(source+';return createCharacterRig();')();
const st={outfit:'uniform',hairStyle:'long',skin:'#f3e3d8',hair:'#c8a15a',eye:'#a2373f',eyeStyle:'normal',expr:'grin',acc:'none',c1:'#8e1b1f',c2:'#f4f4f8',c3:'#d9a441',pose:'stand',blush:true,circles:false};
rig.render(st,{view:'side'});
for(const style of ['long','bun','highbun','pixie','bob','hime']){
 const svg=rig.inspectTemple({...st,hairStyle:style}),root=svg.match(/d="M[-.\d]+ ([-.\d]+)/);
 assert.ok(root&&Number(root[1])<=-30,'Chân lọn tóc phải nối lên mái, không bắt đầu rời cạnh tai: '+style);
}
for(const view of ['front','side','right','back'])for(const pose of rig.poses){
 const r=rig.render({...st,pose:pose[0]},{view,time:.5});assert.ok(!/NaN|Infinity|undefined/.test(r.svg));
 if(view==='front'&&pose[0]==='stand')assert.ok(r.svg.includes('M130 140 C130 100 155 80 190 80'));
}
console.log('PASS: temple lock joins the fringe; source face and pose rendering remain valid');
