import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { PRESETS } from '../site/logic.js';
const external = process.env.TEST_URL;
const server = external ? null : spawn('python3', ['-m','http.server','8097','--bind','127.0.0.1','--directory','site'], { stdio:'ignore' });
const url = external || 'http://127.0.0.1:8097';
const delay = ms => new Promise(r => setTimeout(r,ms));
let browser;
mkdirSync('test-results', { recursive:true });
try {
  for(let i=0;i<40;i++){try{if((await fetch(url)).ok)break;}catch{} if(i===39)throw new Error('Server did not start');await delay(100);}
  browser = await chromium.launch({ headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ viewport:{width:1440,height:1000},acceptDownloads:true });
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400 && r.url().startsWith(url)) errors.push(`HTTP ${r.status()} ${r.url()}`);});
  await page.goto(url);
  await page.locator('#compile-status').filter({hasText:'Woven.'}).waitFor();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[], 'initial accessibility audit');
  assert.equal(await page.locator('#switches button').count(),2);
  await page.locator('#switches button').nth(0).click();
  assert.match(await page.locator('#read-explanation').innerText(), /row 2.*sum = 1, carry = 0/);
  await page.locator('#switches button').nth(1).click();
  assert.match(await page.locator('#read-explanation').innerText(), /row 3.*sum = 0, carry = 1/);
  await page.locator('#preset').selectOption('fulladder');
  assert.equal(await page.locator('#switches button').count(),3);
  assert.match(await page.locator('#dimensions').innerText(),/8 ROWS/);
  await page.locator('#circuit-view').click();
  assert.equal(await page.locator('#firmware').isVisible(),true);
  assert.match(await page.locator('#materials').innerText(), /330 Ω/);
  assert.match(await page.locator('#build-guide').innerText(), /D9 via 330 Ω/);
  const circuitA11y = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(circuitA11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[], 'circuit accessibility audit');
  // Invalid input preserves the last good pattern and makes its staleness explicit.
  await page.locator('#source').fill('INPUT a\nx = <script>'); await page.locator('#compile').click();
  assert.equal(await page.locator('#stale').isVisible(),true);
  assert.match(await page.locator('#compile-status').innerText(),/Unexpected character/);
  assert.match(await page.locator('#dimensions').innerText(),/8 ROWS/);
  await page.locator('#source').fill('INPUT a,b,c\nw = a\nx = b\ny = c\nz = a OR b OR c'); await page.locator('#compile').click();
  assert.equal(await page.locator('#stale').isVisible(),false);
  for (const [selector, expected] of [['#svg-download','<svg'], ['#csv','address,a,b,c,w,x,y,z'], ['#firmware','const byte rowCount = 8;'], ['#save','"version": 1']]) {
    const [download] = await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]);
    const content = readFileSync(await download.path(),'utf8');
    assert.ok(content.includes(expected), selector);
  }
  await page.reload();
  assert.match(await page.locator('#dimensions').innerText(),/8 ROWS × 4 OUTPUTS/);
  assert.equal(await page.locator('#circuit-view').getAttribute('aria-pressed'),'true');
  // Bad imports must not replace the compiled project.
  await page.locator('#open-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"source":"evil"}')});
  assert.match(await page.locator('#toast').innerText(),/Could not open/);
  assert.match(await page.locator('#dimensions').innerText(),/8 ROWS × 4 OUTPUTS/);
  await page.locator('#open-file').setInputFiles({name:'good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,source:PRESETS.adder.code,view:'yarn'}))});
  assert.match(await page.locator('#dimensions').innerText(),/4 ROWS × 2 OUTPUTS/);
  // Print event builds the complete packet. PDF validates print layout separately from screen.
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert.match(await page.locator('.print-only').last().innerText(),/Assembly checklist/);
  await page.pdf({path:'test-results/yarn-build-packet.pdf',format:'Letter',printBackground:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await page.locator('#circuit-view').click();
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  await page.pdf({path:'test-results/circuit-build-packet.pdf',format:'Letter',printBackground:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await page.locator('#yarn-view').click();
  await page.locator('#toast').evaluate(el=>el.classList.remove('visible'));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  for(const width of [390, 320]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth), `page overflows at ${width}px`);
    await page.locator('#switches button').first().click();
    if(width===390){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/mobile.png',fullPage:true});}
  }
  assert.deepEqual(errors,[]);
  // Corrupt storage should recover; blocked storage should not prevent startup.
  await page.evaluate(()=>localStorage.setItem('woven-logic-lab-v1','bad-json')); await page.reload();
  assert.match(await page.locator('#compile-status').innerText(),/Woven/);
  const privateContext=await browser.newContext();
  await privateContext.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}}));
  const privatePage=await privateContext.newPage(); await privatePage.goto(url);
  await privatePage.locator('#compile-status').filter({hasText:'Woven'}).waitFor();
  await privateContext.close();
  console.log(`Browser checks passed: ${url} — simulator, parser errors, mode switching, exports, imports, persistence, print packets, mobile widths, and storage fallback.`);
} finally { if(browser)await browser.close();server?.kill(); }
