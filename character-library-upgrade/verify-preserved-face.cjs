const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const source=await browser.newPage();await source.goto('file:///C:/Users/LEGION/Downloads/nhanvat_nu_v2.html');
 const profile=await source.evaluate(()=>PROF_LINE);await source.close();
 const page=await browser.newPage();await page.goto('file:///'+path.join(__dirname,'Kho nhan vat 2 - Rig nu v2.html').replaceAll('\\','/'));
 const result=await page.evaluate(profile=>{
  const st={pose:'stand',acc:'none',hairStyle:'long',expr:'smile',eyeStyle:'normal'};
  return {front:CharacterStudioV2.sample(st,{view:'front'}).svg.includes('M130 140 C130 100 155 80 190 80'),side:CharacterStudioV2.sample(st,{view:'side'}).svg.includes(profile),right:CharacterStudioV2.sample(st,{view:'right'}).svg.includes(profile),noNewFace:!CharacterStudioV2.sample(st,{view:'front'}).svg.includes('data-appearance-head')};
 },profile);
 assert.deepEqual(result,{front:true,side:true,right:true,noNewFace:true});console.log('PASS: original front/profile face outlines restored; experimental face removed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
