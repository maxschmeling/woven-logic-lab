import { compile, PRESETS, addressOf, csv, firmware } from './logic.js';
import { patternSVG, escapeHTML as e } from './pattern.js';
import { materialHTML, guideHTML, troubleshootingHTML, checklistHTML } from './build.js';

const $ = id => document.getElementById(id);
const STORAGE = 'woven-logic-lab-v1';
let model, bits = [], view = 'yarn', build = 'yarn', toastTimeout;
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
  $('source').value = PRESETS[id].code; $('preset-detail').textContent = PRESETS[id].detail;
  runCompile();
}
function syncDirty() { $('stale').hidden = !model || $('source').value === model.source; }
function runCompile() {
  try {
    const next = compile($('source').value);
    bits = next.inputs.map((name, i) => model?.inputs[i] === name ? bits[i] || 0 : 0);
    model = next;
    $('compile-status').className = '';
    $('compile-status').textContent = `✓ Woven. ${model.rows.length} rows, ${model.outputs.length} outputs, ${model.ones} stored 1s.`;
    renderSwitches(); render(); renderBuild(); saveLocal(); syncDirty();
  } catch (err) {
    $('compile-status').className = 'error'; $('compile-status').textContent = err.message;
    syncDirty(); saveLocal();
  }
}
function renderSwitches() {
  $('switches').replaceChildren();
  model.inputs.forEach((name, i) => {
    const b = document.createElement('button'); b.className = 'bit-switch'; b.dataset.index = i;
    b.addEventListener('click', () => { bits[i] = 1 - bits[i]; render(); });
    $('switches').append(b);
  });
}
function tableHTML(selected = -1) {
  return `<table><caption>Inputs are ordered most-significant bit first. One row for every combination.</caption><thead><tr><th scope="col">Row</th>${model.inputs.map(n => `<th scope="col">${e(n)}</th>`).join('')}${model.outputs.map(o => `<th scope="col">${e(o.name)}</th>`).join('')}</tr></thead><tbody>${model.rows.map(r => `<tr${r.address === selected ? ' class="active"' : ''}><th scope="row">${r.address}</th>${r.bits.map(b => `<td>${b}</td>`).join('')}${r.values.map(v => `<td class="output-cell">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function render() {
  const row = model.rows[addressOf(bits)];
  $('dimensions').textContent = `${model.rows.length} ROWS × ${model.outputs.length} OUTPUTS`;
  $('pattern').innerHTML = patternSVG(model, row.address, view);
  $('legend').innerHTML = view === 'yarn' ? '<span><b>—◉—</b> THROUGH = 1</span><span>⌒ AROUND = 0</span>' : '<span><b>1</b> DIODE · STRIPE TO ROW</span><span><b>0</b> INSULATED CROSSING</span>';
  [...$('switches').children].forEach((b, i) => { b.setAttribute('aria-pressed', String(Boolean(bits[i]))); b.setAttribute('aria-label', `${model.inputs[i]}: ${bits[i]}. Toggle input.`); b.innerHTML = `${e(model.inputs[i])}<i>${bits[i]}</i>`; });
  $('outputs').innerHTML = model.outputs.map((o, i) => `<span class="output"><span class="bulb ${row.values[i] ? 'lit' : ''}" aria-hidden="true"></span>${e(o.name)} <b>${row.values[i]}</b></span>`).join('');
  $('read-explanation').textContent = `Inputs ${bits.join('')} select row ${row.address}. Read it left to right: ${model.outputs.map((o, i) => `${o.name} = ${row.values[i]}`).join(', ')}.`;
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
  $('firmware').hidden = build !== 'circuit';
}
function setMode(mode) { view = mode; build = mode; render(); renderBuild(); saveLocal(); }
function preparePrint() {
  document.querySelectorAll('.print-only').forEach(n => n.remove());
  const heading = document.createElement('section'); heading.className = 'print-only print-heading';
  heading.innerHTML = `<p>WOVEN LOGIC LAB / BUILD PACKET</p><h1>${build === 'yarn' ? 'The yarn computer' : 'The wired memory'}</h1><p>${model.rows.length} rows × ${model.outputs.length} outputs · ${model.ones} stored ones · input order: ${model.inputs.join(', ')}</p><p>${build === 'yarn' ? 'Human-readable model. Through a ring = 1; around = 0. Rings are not magnetic memory.' : 'Diode ROM, not magnetic core rope. Stripe → row; anode → column. Insulated crossings. Educational design, not bench-validated.'}</p><pre>${e(model.source)}</pre>`;
  $('workbench').prepend(heading);
  // Printing always uses the build mode, not an unrelated visualization state.
  $('pattern').innerHTML = patternSVG(model, -1, build);
  const packet = document.createElement('section'); packet.className = 'print-only';
  packet.innerHTML = `<div class="print-page"><h2>Truth table & materials</h2>${tableHTML()}<h3>What you need</h3>${materialHTML(model, build)}</div><div class="print-page">${guideHTML(model, build)}</div><div class="print-page"><h2>Assembly checklist</h2><p>Mark each cell only after checking its physical connection against the table.</p>${checklistHTML(model, build)}<h3>Troubleshooting</h3>${troubleshootingHTML(build)}<p>Reader code and references: https://maxschmeling.github.io/woven-logic-lab/</p></div>`;
  $('workbench').append(packet);
}
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', () => { document.querySelectorAll('.print-only').forEach(n => n.remove()); render(); });
$('print').addEventListener('click', () => window.print());
$('source').addEventListener('input', () => { $('preset').value = 'custom'; $('preset-detail').textContent = 'Your own little logic machine.'; syncDirty(); saveLocal(); });
$('source').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); runCompile(); } });
$('compile').addEventListener('click', runCompile);
$('preset').innerHTML = Object.entries(PRESETS).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('') + '<option value="custom">Custom program</option>';
$('preset').addEventListener('change', () => selectPreset($('preset').value));
$('yarn-view').addEventListener('click', () => setMode('yarn')); $('circuit-view').addEventListener('click', () => setMode('circuit'));
$('choose-yarn').addEventListener('click', () => setMode('yarn')); $('choose-circuit').addEventListener('click', () => setMode('circuit'));
$('scan').addEventListener('click', () => { bits = [...model.rows[(addressOf(bits) + 1) % model.rows.length].bits]; render(); });
$('svg-download').addEventListener('click', () => download(`woven-${view}-pattern.svg`, patternSVG(model, -1, view), 'image/svg+xml'));
$('csv').addEventListener('click', () => download('woven-truth-table.csv', csv(model), 'text/csv'));
$('firmware').addEventListener('click', () => download('woven_reader.ino', firmware(model), 'text/plain'));
$('save').addEventListener('click', () => { download('woven-project.json', JSON.stringify({ version: 1, source: $('source').value, view, build }, null, 2), 'application/json'); toast('Project saved, including any uncompiled edits.'); });
$('open-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 20000) throw new Error('Project file is too large (20 KB maximum).');
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

// Always start from a valid model, then try saved content without risking startup.
$('source').value = PRESETS.adder.code;
let saved = null;
try { const raw = localStorage.getItem(STORAGE); if (raw) saved = JSON.parse(raw); } catch { /* ignore corrupt storage */ }
selectPreset('adder');
if (saved?.version === 1 && typeof saved.source === 'string' && saved.source.length <= 2400) {
  $('source').value = saved.source;
  view = saved.view === 'circuit' ? 'circuit' : 'yarn'; build = view;
  $('preset').value = Object.keys(PRESETS).find(k => PRESETS[k].code === saved.source) || 'custom';
  $('preset-detail').textContent = 'Restored from this browser.';
  runCompile(); syncDirty();
}
