const path=require('node:path');
const {chromium}=require('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1480,height:1000}});
  await page.goto('file:///'+path.join(__dirname,'Kho nhan vat 2 - Rig nu v2.html').replaceAll('\\','/'));
  await page.locator('#playTg').click();
  await page.locator('#motionTrigger').click();
  await page.screenshot({path:path.join(__dirname,'preview-motion-picker.png')});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#nav [data-v="lib"]').click();
  await page.screenshot({path:path.join(__dirname,'preview-library-mobile.png')});
  console.log('Captured library and motion picker');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
