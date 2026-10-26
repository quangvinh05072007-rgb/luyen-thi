const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const file=fs.readFileSync(path.join(__dirname,'Kho nhan vat 2 - Rig nu v2.html'),'utf8');
const start=file.indexOf('function createCharacterRig(){'),end=file.indexOf('\nvar RIG = createCharacterRig();',start);
const rig=new Function(file.slice(start,end)+';return createCharacterRig();')();
const st={outfit:'uniform',hairStyle:'long',skin:'#f3e3d8',hair:'#c8a15a',eye:'#a2373f',eyeStyle:'normal',expr:'grin',acc:'none',c1:'#8e1b1f',c2:'#f4f4f8',c3:'#d9a441',pose:'stand',blush:true,circles:false};
const req=createRequire('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const label=process.argv[2]||'after',render=rig.render(st,{view:'side'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-170 -125 340 490" width="340" height="490"><rect x="-170" y="-125" width="340" height="490" fill="#dfe5ee"/>'+render.svg+'</svg>';
fs.writeFileSync(path.join(__dirname,'hair-blonde-'+label+'.svg'),svg);
try{const sharp=req('sharp');(async()=>{const target=path.join(__dirname,'hair-blonde-'+label+'.png');await sharp(Buffer.from(svg)).png().toFile(target);
 if(label==='after'&&fs.existsSync(path.join(__dirname,'hair-blonde-before.png'))){
  const before=await sharp(path.join(__dirname,'hair-blonde-before.png')).ensureAlpha().raw().toBuffer(),after=await sharp(target).ensureAlpha().raw().toBuffer();let x0=340,y0=490,x1=0,y1=0;
  for(let y=0;y<490;y++)for(let x=0;x<340;x++){let i=(y*340+x)*4;if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2]||before[i+3]!==after[i+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
  if(x0<180||x1>220||y1>320)throw Error('Thay đổi vượt ra ngoài lọn tóc trước tai: '+JSON.stringify({x0,y0,x1,y1}));
  console.log('PASS: pixel changes confined to temple lock',JSON.stringify({x0,y0,x1,y1}));
 }
 console.log('Rendered blonde hair '+label);
})().catch(e=>{console.error(e);process.exitCode=1;});}catch(e){console.log(e.message);process.exitCode=1;}
