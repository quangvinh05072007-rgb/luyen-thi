const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const req=createRequire('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json'),sharp=req('sharp');
const html=fs.readFileSync(path.join(__dirname,'Kho nhan vat 2 - Rig nu v2.html'),'utf8'),start=html.indexOf('function createCharacterRig(){'),end=html.indexOf('\nvar RIG = createCharacterRig();',start);
const rig=new Function(html.slice(start,end)+';return createCharacterRig();')();
const ctx={PRESETS:[{s:{}},{s:{}},{s:{}}],Object,Date,cf:s=>s};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'character-types-presets.js'),'utf8'),ctx);
async function sheet(name,presets){
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="'+presets.length*610+'" viewBox="0 0 900 '+presets.length*610+'"><rect width="100%" height="100%" fill="#f3f1ef"/>';
 presets.forEach((p,row)=>['front','side','back'].forEach((view,col)=>{
 const result=rig.render(p.s,{view});
 svg+='<svg x="'+col*300+'" y="'+row*610+'" width="300" height="610" viewBox="0 0 380 790"><rect x="6" y="6" width="368" height="748" rx="16" fill="#dfe5ee"/><svg width="380" height="740" viewBox="'+rig.frameBox(p.s,[0,0,380,740],'full').join(' ')+'"><g transform="translate(190 70) scale(.77)">'+result.svg+'</g></svg><text x="190" y="780" text-anchor="middle" font-family="Arial" font-size="19" fill="#25212b">'+p.n+' · '+view+'</text></svg>';
 }));svg+='</svg>';fs.writeFileSync(path.join(__dirname,name+'.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,name+'.png'));console.log(name+'.png');
}
(async()=>{const presets=ctx.PRESETS.slice(3);await sheet('new-elder-turnaround',presets.slice(0,3));await sheet('new-child-turnaround',presets.slice(3,6));await sheet('new-body-turnaround',presets.slice(6,8));await sheet('new-men-turnaround',presets.slice(8,12));await sheet('new-grandpa-turnaround',presets.slice(12));})().catch(e=>{console.error(e);process.exitCode=1;});
