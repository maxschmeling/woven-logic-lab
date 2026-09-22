import { programROM, executeROM } from './rom.js';
import { compile, PRESETS, addressOf, csv, firmware, LIMITS, starterCompatible } from './logic.js';
import { patternSVG, escapeHTML as e } from './pattern.js';
import { materialHTML, guideHTML, troubleshootingHTML, checklistHTML } from './build.js';

const $ = id => document.getElementById(id);
const STORAGE = 'woven-logic-lab-v1';
let model, bits = [], view = 'yarn', build = 'yarn', toastTimeout;
const BANK_SIZE = 16;
let bank = 0, loom = null, loomModel = null, loomBank = -1;
let rom, memoryMode='table', instruction=0, compileTimer;
const bankStart = () => bank * BANK_SIZE;
const sectionModel = () => ({ ...model, rows: model.rows.slice(bankStart(), bankStart() + BANK_SIZE) });
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 4500); }
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function saveLocal() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ version: 1, source: $('source').value, view, build })); }
  catch { /* Private browsing or quota limits must not block the workshop. */ }
}
function selectPreset(id) {
  if (!PRESETS[id]) return;
  $('preset').value = id;
  $('source').value = PRESETS[id].code; $('preset-detail').textContent = PRESETS[id].detail;
  runCompile();
}
function syncDirty() { $('stale').hidden = !model || $('source').value === model.source; $('visual-stale').hidden=$('stale').hidden; }
function runCompile() {
  clearTimeout(compileTimer);
  try {
    const next = compile($('source').value);
    bits = next.inputs.map((name, i) => model?.inputs[i] === name ? bits[i] || 0 : 0);
    model = next; rom=programROM(model);instruction=0;loomModel=null; bank = Math.floor(addressOf(bits) / BANK_SIZE);
    $('compile-status').className = '';
    $('compile-status').textContent = `✓ Woven. ${model.rows.length} rows, ${model.outputs.length} outputs, ${model.ones} stored 1s.`;
    renderSwitches();
    $('bank-select').innerHTML = Array.from({length:Math.ceil(model.rows.length / BANK_SIZE)}, (_,i) => `<option value="${i}">${i+1} · rows ${i*BANK_SIZE}–${Math.min(model.rows.length-1,(i+1)*BANK_SIZE-1)}</option>`).join('');
    render(); renderBuild(); saveLocal(); syncDirty();
  } catch (err) {
    $('compile-status').className = 'error'; $('compile-status').textContent = err.message;
    syncDirty(); saveLocal();
  }
}
function renderSwitches() {
  $('switches').replaceChildren();
  model.inputs.forEach((name, i) => {
    const b = document.createElement('button'); b.className = 'bit-switch'; b.dataset.index = i;
    b.addEventListener('click', () => { bits[i] = 1 - bits[i]; bank = Math.floor(addressOf(bits) / BANK_SIZE); render(); });
    $('switches').append(b);
  });
}
function tableHTML(selected = -1) {
  return `<table><caption>Inputs are ordered most-significant bit first. Rows ${bankStart()}–${Math.min(model.rows.length - 1, bankStart() + BANK_SIZE - 1)} of ${model.rows.length}. Download CSV for the complete table.</caption><thead><tr><th scope="col">Row</th>${model.inputs.map(n => `<th scope="col">${e(n)}</th>`).join('')}${model.outputs.map(o => `<th scope="col">${e(o.name)}</th>`).join('')}</tr></thead><tbody>${sectionModel().rows.map(r => `<tr${r.address === selected ? ' class="active"' : ''}><th scope="row">${r.address}</th>${r.bits.map(b => `<td>${b}</td>`).join('')}${r.values.map(v => `<td class="output-cell">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function render() {
  const row = model.rows[addressOf(bits)];
  $('dimensions').textContent = `${model.rows.length} ROWS × ${model.outputs.length} OUTPUTS`;
  $('pattern').innerHTML = patternSVG(model, row.address, view, bankStart(), BANK_SIZE);
  $('pattern').querySelector('svg').style.minWidth = `${Math.max(400, model.outputs.length * 95 + 160)}px`;
  $('bank-select').value = String(bank);
  $('bank-prev').disabled = bank === 0; $('bank-next').disabled = (bank + 1) * BANK_SIZE >= model.rows.length;
  $('row-address').max = String(model.rows.length - 1); $('row-address').value = String(row.address);
  $('bank-summary').textContent = `Showing rows ${bankStart()}–${Math.min(model.rows.length-1, bankStart()+BANK_SIZE-1)} of ${model.rows.length.toLocaleString()}. 3D, SVG, table and print follow this section.`;
  updateSculpture();
  $('legend').innerHTML = view === 'yarn' ? '<span><b>—◉—</b> THROUGH = 1</span><span>⌒ AROUND = 0</span>' : '<span><b>1</b> DIODE · STRIPE TO ROW</span><span><b>0</b> INSULATED CROSSING</span>';
  [...$('switches').children].forEach((b, i) => { b.setAttribute('aria-pressed', String(Boolean(bits[i]))); b.setAttribute('aria-label', `${model.inputs[i]}: ${bits[i]}. Toggle input.`); b.innerHTML = `${e(model.inputs[i])}<i>${bits[i]}</i>`; });
  $('outputs').innerHTML = model.outputs.map((o, i) => `<span class="output"><span class="bulb ${row.values[i] ? 'lit' : ''}" aria-hidden="true"></span>${e(o.name)} <b>${row.values[i]}</b></span>`).join('');
  $('read-explanation').textContent = `Inputs ${bits.join('')} select row ${row.address}. Read it left to right: ${model.outputs.map((o, i) => `${o.name} = ${row.values[i]}`).join(', ')}.`;
  const example = Object.keys(PRESETS).find(id => PRESETS[id].code === model.source);
  let reading = '';
  if (example === 'adder4') reading = `${addressOf(row.bits.slice(0,4))} + ${addressOf(row.bits.slice(4))} = ${addressOf(row.values.slice(0,4)) + 16 * row.values[4]} · carry is the fifth bit.`;
  if (example === 'alu') reading = `A = ${addressOf(row.bits.slice(2,6))} · B = ${addressOf(row.bits.slice(6))} · ${['ADD','AND','XOR','OR'][addressOf(row.bits.slice(0,2))]} → ${addressOf(row.values.slice(0,4))} · carry ${row.values[4]} · zero ${row.values[5]}`;
  if (example === 'compare4') reading = `${addressOf(row.bits.slice(0,4))} ${row.values[0] ? '>' : row.values[1] ? '=' : '<'} ${addressOf(row.bits.slice(4))}`;
  if (example === 'display') reading = `${row.address < 10 ? 'Digit ' + row.address : 'Blank (not a decimal digit)'} · lit segments: ${model.outputs.filter((_,i)=>row.values[i]).map(o=>o.name.slice(4)).join(', ') || 'none'}`;
  if (example === 'mux8') reading = `Address ${row.bits.slice(0,3).join('')} selects d${addressOf(row.bits.slice(0,3))} → ${row.values[0]}`;
  $('example-reading').textContent = reading; $('example-reading').hidden = !reading;
  $('stats').textContent = `${model.rows.length * model.outputs.length} bits of storage · ${model.ones} ones · ${model.rows.length * model.outputs.length - model.ones} zeros`;
  $('truth-table').innerHTML = tableHTML(row.address);
  $('yarn-view').setAttribute('aria-pressed', String(view === 'yarn')); $('circuit-view').setAttribute('aria-pressed', String(view === 'circuit'));
}
function renderBuild() {
  $('choose-yarn').setAttribute('aria-pressed', String(build === 'yarn')); $('choose-circuit').setAttribute('aria-pressed', String(build === 'circuit'));
  $('choose-yarn').classList.toggle('selected', build === 'yarn'); $('choose-circuit').classList.toggle('selected', build === 'circuit');
  $('build-guide').innerHTML = guideHTML(model, build);
  $('materials').innerHTML = materialHTML(model, build);
  $('troubleshooting').innerHTML = troubleshootingHTML(build);
  $('firmware').hidden = build !== 'circuit' || !starterCompatible(model);
  $('print').textContent = model.rows.length > BANK_SIZE ? 'Print this section ↗' : 'Print build packet ↗';
}
function setMode(mode) { view = mode; build = mode; render(); renderBuild(); saveLocal(); }
function preparePrint() {
  document.querySelectorAll('.print-only').forEach(n => n.remove());
  const heading = document.createElement('section'); heading.className = 'print-only print-heading';
  heading.innerHTML = `<p>WOVEN LOGIC LAB / BUILD PACKET</p><h1>${build === 'yarn' ? 'The yarn computer' : 'The wired memory'}</h1><p>Section ${bank+1} · rows ${bankStart()}–${Math.min(model.rows.length-1,bankStart()+BANK_SIZE-1)} of ${model.rows.length} · ${model.outputs.length} outputs · input order: ${model.inputs.join(', ')}</p><p>${build === 'yarn' ? 'Human-readable model. Through a ring = 1; around = 0. Rings are not magnetic memory.' : starterCompatible(model) ? 'Diode ROM, not magnetic core rope. Stripe → row; anode → column. Insulated crossings. Educational design, not bench-validated.' : 'Large-memory bit layout only. No expanded electronic reader is provided; the UNO starter circuit does not support this size.'}</p><pre>${e(model.source)}</pre>`;
  $('workbench').prepend(heading);
  // Printing always uses the build mode, not an unrelated visualization state.
  $('pattern').innerHTML = patternSVG(model, -1, build, bankStart(), BANK_SIZE);
  const packet = document.createElement('section'); packet.className = 'print-only';
  packet.innerHTML = `<div class="print-page"><h2>Truth table & materials</h2>${tableHTML()}<h3>What you need</h3>${materialHTML(model, build)}</div><div class="print-page">${guideHTML(model, build)}</div><div class="print-page"><h2>Assembly checklist</h2><p>Mark each cell only after checking its physical connection against the table.</p>${checklistHTML(sectionModel(), build)}<h3>Troubleshooting</h3>${troubleshootingHTML(build)}<p>Reader code and references: https://maxschmeling.github.io/woven-logic-lab/</p></div>`;
  $('workbench').append(packet);
}
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', () => { document.querySelectorAll('.print-only').forEach(n => n.remove()); render(); });
$('print').addEventListener('click', () => window.print());
$('source').addEventListener('input', () => { $('preset').value = 'custom'; $('preset-detail').textContent = 'Your own little logic machine.'; syncDirty(); saveLocal(); compileTimer=setTimeout(runCompile,350); });
$('source').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); runCompile(); } });
$('compile').addEventListener('click', runCompile);
$('preset').innerHTML = Object.entries(PRESETS).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('') + '<option value="custom">Custom program</option>';
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => selectPreset(button.dataset.example)));
$('preset').addEventListener('change', () => selectPreset($('preset').value));
$('yarn-view').addEventListener('click', () => setMode('yarn')); $('circuit-view').addEventListener('click', () => setMode('circuit'));
$('choose-yarn').addEventListener('click', () => setMode('yarn')); $('choose-circuit').addEventListener('click', () => setMode('circuit'));
$('scan').addEventListener('click', () => { bits = [...model.rows[(addressOf(bits) + 1) % model.rows.length].bits]; bank = Math.floor(addressOf(bits) / BANK_SIZE); render(); });
$('svg-download').addEventListener('click', () => download(`woven-${view}-rows-${bankStart()}-${Math.min(model.rows.length-1,bankStart()+BANK_SIZE-1)}.svg`, patternSVG(model, -1, view, bankStart(), BANK_SIZE), 'image/svg+xml'));
$('csv').addEventListener('click', () => download('woven-truth-table.csv', csv(model), 'text/csv'));
$('firmware').addEventListener('click', () => download('woven_reader.ino', firmware(model), 'text/plain'));
$('save').addEventListener('click', () => { download('woven-project.json', JSON.stringify({ version: 1, source: $('source').value, view, build }, null, 2), 'application/json'); toast('Project saved, including any uncompiled edits.'); });
$('open-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 100000) throw new Error('Project file is too large (100 KB maximum).');
    const project = JSON.parse(await file.text());
    if (project.version !== 1) throw new Error('Unsupported project version. Expected version 1.');
    compile(project.source); // validate everything before replacing the current work
    $('source').value = project.source;
    view = project.view === 'circuit' ? 'circuit' : 'yarn'; build = view;
    $('preset').value = 'custom'; $('preset-detail').textContent = 'Opened from a project file.';
    runCompile(); toast('Project opened. Pattern rebuilt.');
  } catch (error) { toast(`Could not open project: ${error.message}`); }
  event.target.value = '';
});

function updateSculpture() {
  const program=memoryMode==='program', image=program?rom:model;
  const selected=program?instruction:addressOf(bits);
  const first=program?Math.floor(instruction/BANK_SIZE)*BANK_SIZE:bankStart();
  const last=Math.min(image.rows.length-1,first+BANK_SIZE-1),row=image.rows[selected];
  const changed=loomModel!==image||loomBank!==first;
  $('specimen-label').textContent=program?`INSTRUCTIONS ${first}–${last} / 16 BITS`:`ROWS ${first}–${last} / ${model.outputs.length} OUTPUTS`;
  $('fallback-pattern').innerHTML=patternSVG(image,selected,'yarn',first,BANK_SIZE);
  if(changed){
    $('wire-focus').innerHTML='<option value="-1">All data wires</option>'+image.outputs.map((o,i)=>`<option value="${i}">${e(o.name)}</option>`).join('');
    if(loom){loom.setModel(image,first,BANK_SIZE);loomModel=image;loomBank=first;loom.focusBit(-1);}
  }
  loom?.select(selected);
  const ones=image.outputs.filter((_,i)=>row.values[i]).map(o=>o.name).join(', ')||'none';
  $('memory-readout').textContent=`${program?'Instruction':'Input address'} ${selected}: ${row.values.join('')} · Through: ${ones}. Other wires bypass.`;
  $('bit-inspector').innerHTML=image.outputs.map((o,i)=>`<span>${e(o.name)}: ${row.values[i]?'1 · THROUGH':'0 · AROUND'}</span>`).join('');
  $('program-controls').hidden=!program;
  if(program){
    const result=executeROM(rom.words,bits);
    $('program-result').textContent=`${rom.words.length} stored words · ${rom.listing[instruction]} · CPU output for inputs ${bits.join('')}: ${result.outputs.join('')} · ${result.outputs.join('')===model.rows[addressOf(bits)].values.join('')?'matches lookup ROM':'MISMATCH'}`;
    $('rom-listing').textContent=rom.words.slice(first,last+1).map((word,i)=>`${first+i===instruction?'→':' '} ${String(first+i).padStart(4,'0')}  ${word.toString(16).padStart(4,'0').toUpperCase()}  ${rom.listing[first+i]}`).join('\n');
    $('instruction-prev').disabled=instruction===0;$('instruction-next').disabled=instruction===rom.words.length-1;
  }
}
$('memory-mode').addEventListener('change',event=>{memoryMode=event.target.value;loomModel=null;updateSculpture();});
$('wire-focus').addEventListener('change',event=>loom?.focusBit(Number(event.target.value)));
$('instruction-prev').addEventListener('click',()=>{instruction=Math.max(0,instruction-1);updateSculpture();});
$('instruction-next').addEventListener('click',()=>{instruction=Math.min(rom.words.length-1,instruction+1);updateSculpture();});
$('rom-download').addEventListener('click',()=>download('woven-program-rom.txt','# Woven Logic Lab teaching ISA — NOT AGC code\n# 16 bits: opcode[15:12], operand[11:0]. LOAD=1 CONST=2 NOT=3 AND=4 OR=5 XOR=6 STORE=7 OUT=8 HALT=F (hex).\n'+rom.words.map((w,i)=>`${i} ${w.toString(16).padStart(4,'0')} ${rom.listing[i]}`).join('\n'),'text/plain'));

function chooseBank(value) {
  bank = Math.max(0, Math.min(Math.ceil(model.rows.length / BANK_SIZE) - 1, value));
  bits = [...model.rows[bankStart()].bits]; render();
}
$('bank-prev').addEventListener('click', () => chooseBank(bank - 1));
$('bank-next').addEventListener('click', () => chooseBank(bank + 1));
$('bank-select').addEventListener('change', event => chooseBank(Number(event.target.value)));
function goRow() {
  const address = Number($('row-address').value);
  if (!Number.isInteger(address) || address < 0 || address >= model.rows.length) { toast(`Choose a row from 0 to ${model.rows.length - 1}.`); return; }
  bits = [...model.rows[address].bits]; bank = Math.floor(address / BANK_SIZE); render();
}
$('go-row').addEventListener('click', goRow);
$('row-address').addEventListener('keydown', event => { if (event.key === 'Enter') goRow(); });
function graphicsFailure(message) {
  $('graphics-status').textContent = message;
  $('memory-fallback').hidden = false;
  $('memory-view').querySelector('canvas')?.setAttribute('hidden', '');
  document.querySelectorAll('.stage-controls button, .stage-controls input, .stage-views button').forEach(el => { el.disabled = true; });
  document.querySelector('.stage-badge').textContent = '2D PREVIEW';
}
async function startSculpture() {
  try {
    const { createLoom } = await import('./loom3d.bundle.js');
    loom = createLoom($('memory-view'), (progress, playing) => {
      $('weave-time').value = String(Math.round(progress * 1000));
      $('weave-percent').textContent = `${Math.round(progress * 100)}%`;
      $('weave-play').textContent = playing ? 'Ⅱ Pause' : progress >= 1 ? '↶ Replay' : '▶ Weave';
      $('weave-play').setAttribute('aria-pressed', String(playing));
      const rows = memoryMode==='program'?16:model.outputs.length;
      $('weave-state').textContent = progress >= 1 ? `Section complete · ${rows} bit wires woven. Scrub back to see it take shape.` : `Weaving bit wire ${Math.min(rows-1, Math.floor(progress * rows)) + 1} · ${Math.floor(progress * rows)} of ${rows} threads complete.`;
    }, graphicsFailure);
    updateSculpture();
    $('memory-fallback').hidden = true;
    document.querySelectorAll('.stage-controls button, .stage-controls input, .stage-views button').forEach(el => { el.disabled = false; });
    loom.setProgress(1);
  } catch { graphicsFailure('3D is unavailable in this browser. Your live 2D pattern is shown instead; the workbench, simulation and downloads still work.'); }
}
$('weave-play').addEventListener('click', () => loom?.play());
$('weave-reset').addEventListener('click', () => { loom?.play(false); loom?.setProgress(0); });
$('weave-time').addEventListener('input', event => { const progress = Number(event.target.value) / 1000; loom?.play(false); loom?.setProgress(progress); });
for (const view of ['angle', 'top', 'detail']) $('view-' + view).addEventListener('click', () => loom?.home(view));
$('view-out').addEventListener('click', () => loom?.zoom(1.2));
$('view-in').addEventListener('click', () => loom?.zoom(1 / 1.2));

// Always start from a valid model, then try saved content without risking startup.
$('source').value = PRESETS.adder.code;
let saved = null;
try { const raw = localStorage.getItem(STORAGE); if (raw) saved = JSON.parse(raw); } catch { /* ignore corrupt storage */ }
selectPreset('adder');
if (saved?.version === 1 && typeof saved.source === 'string' && saved.source.length <= LIMITS.length) {
  $('source').value = saved.source;
  view = saved.view === 'circuit' ? 'circuit' : 'yarn'; build = view;
  $('preset').value = Object.keys(PRESETS).find(k => PRESETS[k].code === saved.source) || 'custom';
  $('preset-detail').textContent = 'Restored from this browser.';
  runCompile(); syncDirty();
}

startSculpture();
