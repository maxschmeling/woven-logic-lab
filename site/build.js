import { ROW_PINS, SENSE_PINS, SWITCH_PINS } from './logic.js';
import { escapeHTML as e, circuitDetail } from './pattern.js';
export function materials(model, mode) {
  const cells = model.rows.length * model.outputs.length;
  return mode === 'yarn' ? [
    ['1', 'A4/letter-size cardboard sheet or stiff craft board'],
    [cells, 'Plastic or wooden rings, 8–12 mm openings (not beads with tiny holes)'],
    [model.rows.length, 'Yarn lengths, about 40–60 cm each; two contrasting colors help'],
    ['1', 'Blunt yarn needle; scissors and tape or nonconductive glue'],
    ['1', 'Printed pattern and a pen for row labels']
  ] : [
    ['1', 'Arduino UNO R3 (5 V ATmega328P) + USB data cable; computer with Arduino IDE'],
    [model.ones, '1N4148 through-hole signal diodes, one per stored 1 (a few spare)'],
    [model.rows.length, '330 Ω, ¼ W series resistors, one per row'],
    [model.inputs.length, 'SPST on/off switches, or jumper wires to GND'],
    ['2–3 m', '24–26 AWG insulated tinned-copper hookup wire; contrasting row/column colors'],
    ['1', 'Nonconductive perforated board about 15 × 20 cm; holes spaced about 20 mm'],
    ['1 set', 'Breadboard, jumpers, wire stripper, soldering iron, solder, heat-shrink, multimeter'],
    ['1', 'Nonconductive lacing cord to secure wires; leave solder joints off the board surface']
  ];
}
export function materialHTML(m, mode) { return `<ul>${materials(m, mode).map(([q, s]) => `<li><span class="qty">${q}</span><span>${s}</span></li>`).join('')}</ul>`; }
function pinTable(m) {
  const lines = [
    ...m.rows.map(r => [`Row ${r.address}: ${r.bits.join('')}`, `D${ROW_PINS[r.address]} via 330 Ω resistor`]),
    ...m.outputs.map((o, i) => [`Column: ${o.name}`, `${SENSE_PINS[i]} (sense INPUT_PULLUP)`]),
    ...m.inputs.map((n, i) => [`Switch: ${n}`, `D${SWITCH_PINS[i]} ↔ switch ↔ GND`])
  ];
  return `<div class="table-scroll"><table class="pin-map"><caption>Exact pin map for this pattern</caption><thead><tr><th>Connection</th><th>UNO R3 pin</th></tr></thead><tbody>${lines.map(([a, b]) => `<tr><td>${e(a)}</td><td>${e(b)}</td></tr>`).join('')}</tbody></table></div>`;
}
export function guideHTML(m, mode) {
  if (mode === 'yarn') return `<h3>Your first woven logic board</h3><p>This is a <b>human-operated lookup machine</b>, not an electronic computer. Yarn stores the answers; you select the input row and read the crossings. Plan 30–60 minutes for a small design; larger patterns take longer.</p><ol>
<li><b>Print, label, lay out.</b>Print the build packet. On cardboard, mark ${m.rows.length} horizontal rows and ${m.outputs.length} columns spaced about 25 mm apart. Label the rows with their input bits and the columns ${m.outputs.map(o => e(o.name)).join(', ')}. All input labels run left-to-right in the declared order: <code>${m.inputs.join(', ')}</code>. The leftmost input is the most significant bit.</li>
<li><b>Fix the rings in place.</b>Attach one ring at each intersection: ${m.rows.length * m.outputs.length} total. Tape or tie only the edge so the hole remains accessible. You can instead punch two small holes on either side of each printed circle and stitch a through-route beneath its center.</li>
<li><b>Weave one row at a time.</b>Use a separate yarn length for each row. A <b>1</b> goes through the ring’s opening; a <b>0</b> goes around its outside. The diagram’s curved detour means “around,” not a second bit. Tie off the ends. Do not join neighboring rows.</li>
<li><b>Read the program.</b>Set the input switches in the app. Find that exact bit pattern on your board, then follow only that row from left to right. Through = 1; around = 0. Each column gives a separate output. For the half-adder, the binary number is <code>carry,sum</code>, even though the columns display sum first.</li>
<li><b>Check every row.</b>Use the printed checklist and compare each crossing with the truth table. Trade boards with someone: can they read every answer without seeing your original equations? Reweaving one bit changes the program.</li>
</ol><p class="small muted">No special ferrite, magnets, batteries, or conductive yarn needed. Rings and yarn are visual storage, not a substitute for Apollo’s magnetic readout.</p>`;
  return `<h3>A physically programmed diode ROM</h3><div class="notice"><b>Educational reference design—not bench-validated hardware.</b> The logic and firmware are tested in software. Verify the circuit on a breadboard before weaving or soldering the full board. It is not a security, safety, or control system.</div><p>The woven wires and diodes hold all ${m.rows.length * m.outputs.length} answer bits. The Arduino only turns the input switches into a row address and reads the output columns. No truth table is hidden in the firmware.</p><ol>
<li><b>Prototype one bit first, with USB unplugged.</b>Use row D2 through a 330 Ω resistor. Connect a 1N4148’s <em>striped cathode</em> to the row wire and its unstriped anode to sense A0. The diagram below shows the whole one-bit path. Keep the diode stripe toward the row, never toward the sense column.</li>
<li><b>Upload and prove the one-bit read.</b>Download the reader sketch and open it in Arduino IDE (allow the IDE to create its sketch folder). Choose Arduino UNO and its port; upload via USB. Open Serial Monitor at <b>9600 baud</b>. With switches open, the first row is selected. The prototype diode should make the first output read 1; remove it with power disconnected and that output should read 0. This is a wiring test, not yet your completed program. Other columns remain 0. Unplug USB again before assembly.</li>
<li><b>Weave the row wires.</b>Use insulated wire, not bare conductive thread. Lace ${m.rows.length} separate row wires through the nonconductive board and label row 0 through ${m.rows.length - 1}. Add ${m.outputs.length} perpendicular column wires. Secure with nonconductive cord. Crossings stay insulated: <b>touching insulation is not an electrical connection.</b> Use the working-circuit pattern, not the yarn ring drawing.</li>
<li><b>Program each 1 with a diode.</b>At each 1 in the checklist, expose a short connection point on that row and column, then solder one diode between them: <b>anode to column; striped cathode to row</b>. Insulate exposed leads after inspection. At every 0, add nothing and keep the crossing insulated. Never replace a diode with a direct jumper: it can create false bits through other rows. Total: <b>${m.ones} diodes</b>. No ring or ferrite is required for this circuit.</li>
<li><b>Connect the reader and switches.</b>Each row has its own 330 Ω resistor between board wire and the assigned row pin. Connect columns directly to their sense pins. Each input switch connects its assigned input pin to Arduino GND when closed; open = 0, closed = 1. Follow the generated pin map exactly. No row, column, or switch gets a direct 5 V connection. Leave unused pins unconnected.</li>
<li><b>Inspect, then power from USB only.</b>Check diode bands, resistor values, insulated crossings, and solder bridges. With power off, use diode-test mode between each column (red probe) and row (black probe): a stored 1 should show a forward drop, while a 0 should be open; reverse probes should be open. Disconnect the Arduino while checking the passive board. Do not use mains wiring or an external supply.</li>
<li><b>Read and verify all combinations.</b>Open Serial Monitor at 9600. For each input combination, wait for the switches to settle, then match the printed row address and outputs to the truth table. The code selects one row LOW, leaves other rows high-impedance, and uses weak pull-ups on columns. A diode pulls a column LOW, interpreted as logical 1; no diode leaves it HIGH, interpreted as 0. Remove or add one diode with power off and see the answer change without re-uploading.</li>
</ol>${circuitDetail}${pinTable(m)}<p class="small muted">Use the stated 5 V UNO R3, short wires (under about 30 cm per board run), and no extra LED loads on sense lines. The weak pull-ups limit current; row resistors provide additional protection. This is a slow demonstration reader, not timing-critical logic. Solder on a heat-resistant surface with ventilation; get experienced help if soldering is new to you.</p>`;
}
export function troubleshootingHTML(mode) {
  return mode === 'yarn' ? `<ul><li><b>Wrong row?</b> Read input names in declaration order; leftmost is the most significant bit. 01 and 10 are different rows.</li><li><b>Wrong output?</b> Follow a single row, not a whole column. Only the crossing of that row and column counts.</li><li><b>Adding bits?</b> Sum is the ones digit, carry is the twos digit. Sum 0 and carry 1 represents 2.</li><li><b>Something changed in the editor?</b> Click “Weave this logic” again; printouts remain snapshots of their compiled design.</li></ul>` : `<ul><li><b>Every output is 0:</b> check the selected row, row resistor and wire continuity, and diode direction. Cathode stripe goes to the row.</li><li><b>Unexpected 1s:</b> check bare-wire crossings or solder bridges. Inactive row pins must be INPUT without pull-ups, not OUTPUT HIGH or LOW. Do not connect two rows together.</li><li><b>Wrong row:</b> switches use INPUT_PULLUP. Closed to GND means 1; floating/open means 0. The first declared input is the most significant bit.</li><li><b>Flickering results:</b> shorten wires, inspect joints, wait for switch bounce to settle, and remove any LEDs or other loads from sense pins.</li><li><b>No serial output:</b> check board/port selection, a data-capable USB cable, and 9600 baud.</li><li><b>Before rewiring:</b> disconnect USB. If anything warms up, disconnect immediately and inspect for shorts.</li></ul>`;
}
export function checklistHTML(m, mode) {
  return `<ul class="print-checks">${m.rows.flatMap(r => r.values.map((v, c) => `<li>□ R${r.address} [${r.bits.join('')}] → ${e(m.outputs[c].name)}: ${v} · ${mode === 'yarn' ? v ? 'THROUGH' : 'AROUND' : v ? 'DIODE, stripe to row' : 'NO CONNECTION'}</li>`)).join('')}</ul>`;
}
