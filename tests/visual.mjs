import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
const external=process.env.TEST_URL;
const server=external?null:spawn('python3',['-m','http.server','8098','--bind','127.0.0.1','--directory','site'],{stdio:'ignore'});
const url=external||'http://127.0.0.1:8098';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
mkdirSync('test-results',{recursive:true});
try {
  for(let i=0;i<40;i++){try{if((await fetch(url)).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await expect(page.locator('#memory-view')).toHaveAttribute('data-ready','true',{timeout:30000});
  assert.equal(await page.locator('#memory-view').getAttribute('data-progress'),'1','reduced motion opens without autoplay');
  await page.locator('#weave-reset').click();
  await expect(page.locator('#weave-time')).toHaveValue('0');
  await page.locator('#weave-time').fill('500');
  await expect(page.locator('#weave-percent')).toHaveText('50%');
  await page.locator('#weave-play').click();
  await expect(page.locator('#weave-play')).toHaveAttribute('aria-pressed','true');
  await page.waitForFunction(()=>Number(document.querySelector('#weave-time').value)>500);
  await page.locator('#weave-play').click();
  await expect(page.locator('#weave-play')).toHaveAttribute('aria-pressed','false');
  await page.locator('#weave-time').fill('1000');
  await page.screenshot({path:'test-results/loom-desktop.png'});
  // Valid edits update geometry without the compile button; inputs move the read halo.
  await page.locator('#source').fill('INPUT a,b\nx = a XOR b\ny = a AND b');
  await expect(page.locator('#compile-status')).toContainText('4 rows, 2 outputs');
  await page.waitForFunction(()=>document.querySelector('#stale').hidden);
  assert.deepEqual(JSON.parse(await page.locator('#memory-view').getAttribute('data-words')),[[0,0],[1,0],[1,0],[0,1]]);
  await page.locator('#switches button').first().click();
  await expect(page.locator('#memory-view')).toHaveAttribute('data-selected-address','2');
  await expect(page.locator('#memory-readout')).toContainText('Through: x');
  await page.selectOption('#memory-mode','program');
  await expect(page.locator('#program-result')).toContainText('matches lookup ROM');
  await page.selectOption('#wire-focus','0');
  await page.locator('#view-detail').click();
  await page.locator('#instruction-next').click();
  await expect(page.locator('#memory-view')).toHaveAttribute('data-selected-address','1');
  const [romFile]=await Promise.all([page.waitForEvent('download'),page.locator('#rom-download').click()]);
  assert.match(readFileSync(await romFile.path(),'utf8'),/HALT/);
  await page.locator('#source').fill('INPUT a\nx =');
  await expect(page.locator('#visual-stale')).toBeVisible();
  await expect(page.locator('#compile-status')).toHaveClass('error');
  await page.selectOption('#preset','alu');
  await page.selectOption('#wire-focus','-1');
  await page.locator('#view-angle').click();
  await page.locator('#weave-time').fill('1000');
  await page.locator('.memory-stage').screenshot({path:'test-results/module-program.png'});
  const programA11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(programA11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  await page.selectOption('#memory-mode','table');
  // Every built-in design compiles; sections and camera controls remain usable.
  for(const preset of ['adder4','alu','compare4','display','mux8']) {
    await page.selectOption('#preset',preset);
    await expect(page.locator('#compile-status')).toContainText('Woven.');
    await page.locator('#circuit-view').click();
    assert.equal(await page.locator('#firmware').isVisible(),false);
    await expect(page.locator('#build-guide')).toContainText('outgrown');
  }
  await page.selectOption('#preset','adder4');
  await page.locator('#row-address').fill('255');await page.locator('#go-row').click();
  await expect(page.locator('#example-reading')).toContainText('15 + 15 = 30');
  await page.selectOption('#preset','alu');
  await page.locator('#row-address').fill('1023');await page.locator('#go-row').click();
  await expect(page.locator('#bank-select')).toHaveValue('63');
  await expect(page.locator('#read-explanation')).toContainText('r3 = 1, r2 = 1, r1 = 1, r0 = 1, carry_out = 0, zero = 0');
  await expect(page.locator('#specimen-label')).toHaveText('ROWS 1008–1023 / 6 OUTPUTS');
  assert.equal(await page.locator('#truth-table tbody tr').count(),16);
  await page.locator('#bank-prev').click();await expect(page.locator('#bank-select')).toHaveValue('62');
  await page.locator('#bank-next').click();await expect(page.locator('#bank-select')).toHaveValue('63');
  const [svg]=await Promise.all([page.waitForEvent('download'),page.locator('#svg-download').click()]);
  assert.match(svg.suggestedFilename(),/1008-1023/);
  assert.match(readFileSync(await svg.path(),'utf8'),/1023 \/ 1111111111/);
  const [csv]=await Promise.all([page.waitForEvent('download'),page.locator('#csv').click()]);
  assert.equal(readFileSync(await csv.path(),'utf8').trim().split('\n').length,1025);
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('.print-checks li').count(),96);
  await expect(page.locator('.print-heading')).toContainText('rows 1008–1023 of 1024');
  await page.pdf({path:'test-results/alu-last-section.pdf',format:'Letter',printBackground:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  const code='INPUT '+Array.from({length:12},(_,i)=>`i${i}`).join(',')+'\n'+Array.from({length:16},(_,i)=>`o${i}=i${i%12}`).join('\n');
  await page.locator('#source').fill(code);await page.locator('#compile').click();
  await expect(page.locator('#dimensions')).toHaveText('4096 ROWS × 16 OUTPUTS');
  await page.locator('#row-address').fill('4095');await page.locator('#go-row').click();
  await expect(page.locator('#bank-select')).toHaveValue('255');
  assert.equal(await page.locator('#switches button').count(),12);
  assert.equal(await page.locator('#outputs .output').count(),16);
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(a11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],'large-design accessibility');
  await page.reload();await expect(page.locator('#dimensions')).toHaveText('4096 ROWS × 16 OUTPUTS');
  await page.selectOption('#preset','alu');
  await page.locator('#bank-select').selectOption('21');
  await page.locator('#weave-time').fill('650');
  await page.locator('#view-angle').click();await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(500);await page.screenshot({path:'test-results/loom-alu.png'});
  for(const view of ['top','detail','out','in','angle']) await page.locator('#view-'+view).click();
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
    await page.locator('#weave-time').fill('250');
    await page.locator('#view-top').click();
    if(width===390){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/loom-mobile.png',fullPage:true});}
  }
  // A failed graphics module cannot disable the core workshop.
  const fallback=await context.newPage();
  await fallback.route('**/loom3d.bundle.js',route=>route.abort());
  await fallback.goto(url);await expect(fallback.locator('#graphics-status')).toContainText('3D is unavailable');
  await expect(fallback.locator('#compile-status')).toContainText('Woven.');
  await fallback.locator('#switches button').first().click();
  assert.deepEqual(errors,[]);
  console.log('3D timeline, cameras, reduced motion, advanced logic, maximum design, sections, exports, print, mobile and fallback passed: '+url);
} finally {await browser?.close();server?.kill();}
