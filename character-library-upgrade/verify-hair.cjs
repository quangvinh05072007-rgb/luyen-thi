const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const page=await browser.newPage();await page.goto('file:///'+path.join(__dirname,'Kho nhan vat 2 - Rig nu v2.html').replaceAll('\\','/'));
 const geometry=await page.evaluate(()=>{
  const values={};
  for(const style of ['long','bun','highbun','pixie','bob','hime'])for(const view of ['side','right']){
   const node=document.createElement('div');node.innerHTML='<svg xmlns="http://www.w3.org/2000/svg">'+CharacterStudioV2.sample({pose:'stand',hairStyle:style,acc:'flowers'},{view}).svg+'</svg>';document.body.appendChild(node);
   const lock=node.querySelector('.profile-temple-lock');if(!lock){node.remove();return null;}
   const b=lock.getBBox();values[style+'/'+view]={w:b.width,h:b.height};
   if(!node.querySelector('.profile-hair-strands')){node.remove();return null;}node.remove();
  }
  return values;
 });
 assert.ok(geometry,'Tóc mai và nét mái phải dùng hình vẽ theo kiểu tóc');
 for(const view of ['side','right']){
  assert.ok(geometry['bun/'+view].h<geometry['long/'+view].h*.8,'Tóc búi không có lọn tóc mai dài mặc định');
  assert.ok(geometry['highbun/'+view].w<geometry['long/'+view].w*.75,'Tóc mai búi cao phải thon');
  assert.ok(geometry['pixie/'+view].h<geometry['long/'+view].h*.4,'Tóc tém không kéo dài xuống cổ');
 }
 console.log('PASS: style-aware tapered profile locks and restrained scalp strands on both side views');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
