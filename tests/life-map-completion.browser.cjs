const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path'),os=require('node:os');
const runtime=createRequire(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=runtime('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/verify-life-map',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/life-map.css?v=1.14.42"><main id="root" style="padding:16px"></main>'}));
  await page.goto('http://127.0.0.1:3001/verify-life-map');
  await page.evaluate(async()=>{
   const {renderLifeMap}=await import('/life-map.js?v=1.14.42');
   localStorage.setItem('seven-lives-map:completion-test',JSON.stringify({
    concerns:[{id:'finish-demo',parent:'home',title:'Finish proof',question:'Where are you with this?'},{id:'working-demo',parent:'home',title:'Working item'},{id:'parent-demo',parent:'home',title:'Completed parent'},{id:'child-demo',parent:'parent-demo',title:'Open child'}],
    answers:{'finish-demo':{status:'unstarted'},'working-demo':{status:'progress'},'parent-demo':{status:'done'},'child-demo':{status:'unstarted'}},links:{}
   }));
   const api={userKey:'completion-test',tasks:[],projects:[],people:[],goals:[],render:()=>renderLifeMap(document.querySelector('#root'),api)};
   api.render();
  });
  await page.locator('[data-panel="explore"]').click();
  await page.locator('[data-go="home"]').first().click();
  await page.locator('[data-go="finish-demo"]').click();
  await page.locator('[data-answer="done"]').click();
  await page.locator('[data-panel="map"]').click();
  const finished=page.locator('[data-node="topic:finish-demo"]');
  await finished.waitFor();
  assert.ok(await finished.locator('.lm-complete-check').isVisible());
  assert.match(await finished.locator('.lm-graph-label').getAttribute('aria-label'),/Completed/);
  await page.locator('#lm-hide-completed').check();
  assert.equal(await page.locator('[data-node="topic:finish-demo"]').count(),0);
  assert.equal(await page.locator('[data-node="topic:working-demo"]').count(),1);
  assert.equal(await page.locator('[data-node="topic:child-demo"]').count(),1);
  assert.match(await page.locator('[data-node="topic:parent-demo"]').innerText(),/Unfinished items below/);
  await page.locator('#lm-hide-completed').uncheck();
  assert.equal(await finished.count(),1);
  const color=await finished.evaluate(element=>getComputedStyle(element).backgroundColor);
  assert.notEqual(color,'rgb(255, 255, 255)');
  await page.screenshot({path:'/tmp/life-map-completion-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#lm-hide-completed').isVisible());
  const filters=await page.locator('.lm-map-filters').boundingBox();
  assert.ok(filters.x+filters.width<=390);
  await page.screenshot({path:'/tmp/life-map-completion-mobile.png'});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('seven-lives-map:completion-test')));
  assert.equal(saved.answers['finish-demo'].status,'done');
  assert.equal(saved.concerns.length,4);
  assert.deepEqual(errors,[]);
  console.log('Browser passed: mark taken care of, checkmark and tint, hide/show, unfinished descendant access, unchanged data, mobile filter fit.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
