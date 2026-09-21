import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, PRESETS, evaluate, addressOf, csv, firmware, ROW_PINS, SENSE_PINS, SWITCH_PINS } from '../site/logic.js';
import { patternSVG } from '../site/pattern.js';
import { materials, checklistHTML } from '../site/build.js';

test('half-adder exhaustively equals integer addition, not just snapshots', () => {
  const m = compile(PRESETS.adder.code);
  for (const r of m.rows) assert.equal(r.values[0] + 2 * r.values[1], r.bits[0] + r.bits[1]);
  assert.equal(m.ones, 3);
});
test('full-adder exhaustively matches arithmetic', () => {
  for (const r of compile(PRESETS.fulladder.code).rows) assert.equal(r.values[0] + 2 * r.values[1], r.bits.reduce((a, b) => a + b, 0));
});
test('majority, selector, alarm match independent truth conditions for every address', () => {
  for (const r of compile(PRESETS.majority.code).rows) assert.equal(r.values[0], Number(r.bits.filter(Boolean).length >= 2));
  for (const r of compile(PRESETS.selector.code).rows) assert.equal(r.values[0], r.bits[r.bits[0] ? 2 : 1]);
  for (const r of compile(PRESETS.alarm.code).rows) {
    assert.equal(r.values[0], Number(!!r.bits[0] && !!r.bits[1] && !r.bits[2]));
    assert.equal(r.values[1], Number(!!r.bits[0] && !r.bits[2]));
  }
});
test('precedence, case, comments, symbols, and parentheses', () => {
  const m = compile('INPUT A, B, C # first = most significant\nx = !a | b & c ^ 1\ny = NOT (A OR b) AND TRUE\nz = 0');
  for (const r of m.rows) {
    const [a, b, c] = r.bits;
    assert.equal(r.values[0], (1 - a) | ((b & c) ^ 1));
    assert.equal(r.values[1], Number(!(a || b)));
    assert.equal(r.values[2], 0);
    assert.equal(addressOf(r.bits), r.address);
  }
});
test('one-input, four-output, zero-one extremes', () => {
  const m = compile('INPUT a\no = 0\np = 1\nq = a\nr = NOT a');
  assert.equal(m.rows.length, 2); assert.equal(m.outputs.length, 4); assert.equal(m.ones, 4);
  assert.equal(compile('INPUT a\nz = 0').ones, 0);
});
test('bad, malicious, ambiguous and oversized programs fail closed', () => {
  for (const input of ['', 'a = 1', 'INPUT a,b,c,d\nx = a', 'INPUT a,a\nx = a', 'INPUT and\nx = 1', 'INPUT a,\nx = a', 'INPUT a\na = 1', 'INPUT a\nx = a\nx = a', 'INPUT a\nx = a\ny = x', 'INPUT a\nx = (a', 'INPUT a\nx = a)', 'INPUT a\nx = a b', 'INPUT a\nx = a && a', 'INPUT a\nx = eval(1)', 'INPUT a\nx = document.cookie', 'INPUT a\nx = 2', 'INPUT a\nx = ', 'INPUT a\nx = <script>', 'INPUT a\nx=1\ny=1\nz=1\np=1\nq=1', 'INPUT a\nx = ' + 'NOT '.repeat(257) + 'a', 'x'.repeat(2401), null]) {
    assert.throws(() => compile(input), Error, JSON.stringify(input));
  }
});
test('deterministic randomized expression tests against independent Boolean calculations', () => {
  let seed = 42; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  function make(depth) {
    if (!depth || rnd() < .25) { const i = Math.floor(rnd() * 3); return { text: 'abc'[i], calc: v => v[i] }; }
    const a = make(depth - 1);
    if (rnd() < .25) return { text: `NOT (${a.text})`, calc: v => 1 - a.calc(v) };
    const b = make(depth - 1), op = Math.floor(rnd() * 3), name = ['AND','OR','XOR'][op];
    return { text: `(${a.text} ${name} ${b.text})`, calc: v => op === 0 ? Number(Boolean(a.calc(v) && b.calc(v))) : op === 1 ? Number(Boolean(a.calc(v) || b.calc(v))) : Number(a.calc(v) !== b.calc(v)) };
  }
  for (let i = 0; i < 100; i++) { const x = make(4); const m = compile(`INPUT a,b,c\nx = ${x.text}`); m.rows.forEach(r => assert.equal(r.values[0], x.calc(r.bits), x.text)); }
});
test('exports and bills of materials preserve row, bit and diode counts', () => {
  for (const p of Object.values(PRESETS)) {
    const m = compile(p.code);
    assert.equal(csv(m).trim().split('\n').length, m.rows.length + 1);
    assert.equal((checklistHTML(m, 'circuit').match(/<li>/g) || []).length, m.rows.length * m.outputs.length);
    assert.equal(materials(m, 'circuit')[1][0], m.ones);
    assert.equal((patternSVG(m, -1, 'circuit').match(/1 · diode/g) || []).length, m.ones);
    assert.ok(firmware(m).includes('pinMode(rowPins[address], INPUT)'));
    assert.ok(!firmware(m).includes(p.code));
  }
});
test('hardware pin allocation has no collisions at maximum size', () => {
  const pins = [...ROW_PINS, ...SWITCH_PINS, ...SENSE_PINS];
  assert.equal(new Set(pins).size, pins.length);
  assert.equal(pins.length, 15);
});
