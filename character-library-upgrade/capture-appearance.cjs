const path=require('node:path');const {chromium}=require('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const page=await browser.newPage({viewport:{width:1480,height:1000}});await page.goto('file:///'+path.join(__dirname,'Kho nhan vat 2 - Rig nu v2.html').replaceAll('\\','/'));
 const data=await page.evaluate(()=>{
  const variants=[['long','Xoã dài','normal','smile','none'],['pixie','Tóc tém','heart','sad','cat'],['hime','Hime','cat','neutral','ribbon'],['twin','Hai đuôi','glow','grin','flowers'],['bun','Búi cổ trang','sparkle','shy','none'],['highbun','Búi cao','normal','neutral','flowers']];
  return variants.map(v=>({name:v[1]+' / '+v[2],cells:['front','side','right','back'].map(view=>CharacterStudioV2.sample({pose:'stand',hairStyle:v[0],eyeStyle:v[2],expr:v[3],acc:v[4],hair:'#302430',eye:'#5e8d78',c3:'#b75370',circles:false,blush:false},{view}).svg)}));
 });
 const sheet=await browser.newPage({viewport:{width:1040,height:1650}});
 await sheet.setContent('<html><meta charset="utf-8"><style>body{margin:24px;font:14px system-ui;background:#eeedf2;color:#24212b}h1{font-size:22px}section{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}article{background:white;border-radius:12px;overflow:hidden;text-align:center}svg{display:block;width:100%;height:240px}p{margin:8px}h2{font-size:14px;margin:24px 0 10px}</style><h1>Cùng một nhân vật ở bốn góc nhìn</h1><section>'+['Trước','Nghiêng trái','Nghiêng phải','Sau'].map(v=>'<b>'+v+'</b>').join('')+'</section>'+data.map(row=>'<h2>'+row.name+'</h2><section>'+row.cells.map(svg=>'<article><svg viewBox="-150 -155 300 405">'+svg+'</svg></article>').join('')+'</section>').join('')+'</html>');
 await sheet.screenshot({path:path.join(__dirname,'appearance-turnaround.png'),fullPage:true});await sheet.close();
 await page.locator('#playTg').click();await page.locator('[data-sec="hands"]').click();await page.screenshot({path:path.join(__dirname,'preview-hands-editor.png')});
 await page.locator('[data-tab="1"]').click();await page.screenshot({path:path.join(__dirname,'preview-colors-editor.png')});
 console.log('Captured appearance consistency and editing controls');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
