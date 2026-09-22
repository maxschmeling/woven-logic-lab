import { ADVANCED_PRESETS } from './examples.js';
// A bounded Boolean language. Never executes JavaScript.
export const LIMITS = { inputs: 12, outputs: 16, intermediates: 64, length: 24000, tokens: 256 };
const reserved = new Set(['INPUT', 'AND', 'OR', 'XOR', 'NOT', 'TRUE', 'FALSE', 'LET']);
const identifier = /^[a-z][a-z0-9_]{0,15}$/i;
export const ROW_PINS = [2, 3, 4, 5, 6, 7, 8, 9];
export const SENSE_PINS = ['A0', 'A1', 'A2', 'A3'];
export const SWITCH_PINS = [10, 11, 12];
export const PRESETS = {
  adder: { name: 'Add two bits', detail: 'A tiny calculator: 1 + 1 = 10.', code: 'INPUT a, b\n\nsum = a XOR b\ncarry = a AND b' },
  majority: { name: 'Two out of three', detail: 'Light the result when at least two switches are on.', code: 'INPUT a, b, c\n\nresult = (a AND b) OR (a AND c) OR (b AND c)' },
  fulladder: { name: 'Add with carry', detail: 'A full adder, the building block of larger calculators.', code: 'INPUT a, b, carry_in\n\nsum = a XOR b XOR carry_in\ncarry_out = (a AND b) OR (carry_in AND (a XOR b))' },
  selector: { name: 'Choose a signal', detail: 'A multiplexer: select = 0 picks left; 1 picks right.', code: 'INPUT select, left, right\n\nchosen = (NOT select AND left) OR (select AND right)' },
  alarm: { name: 'Door alert', detail: 'An educational alert: armed and open, unless bypassed.', code: 'INPUT armed, open, bypass\n\nalert = armed AND open AND NOT bypass\nready = armed AND NOT bypass' },
  ...ADVANCED_PRESETS
};
function nameValid(name) { return identifier.test(name) && !reserved.has(name.toUpperCase()); }
function tokenize(expr) {
  const tokens = []; let p = 0;
  while (p < expr.length) {
    if (/\s/.test(expr[p])) { p++; continue; }
    const m = expr.slice(p).match(/^(?:[a-z][a-z0-9_]*|[01]|[()!&|^])/i);
    if (!m) throw new Error(`Unexpected character “${expr[p]}”. Use Boolean operators, not JavaScript.`);
    tokens.push(m[0]); p += m[0].length;
    if (tokens.length > LIMITS.tokens) throw new Error('Expression is too long. Keep each output under 256 tokens.');
  }
  return tokens;
}
function expression(expr, inputs) {
  const t = tokenize(expr); let at = 0;
  const match = (...ops) => at < t.length && ops.includes(t[at].toUpperCase());
  function atom() {
    if (match('NOT', '!')) { at++; return { op: 'NOT', a: atom() }; }
    if (match('(')) { at++; const node = or(); if (!match(')')) throw new Error('Missing closing parenthesis.'); at++; return node; }
    const token = t[at++];
    if (token === undefined) throw new Error('Expected an input, 0, 1, or a parenthesized expression.');
    if (['0', '1', 'TRUE', 'FALSE'].includes(token.toUpperCase())) return { value: ['1', 'TRUE'].includes(token.toUpperCase()) };
    const index = inputs.indexOf(token.toLowerCase());
    if (index < 0) throw new Error(`Unknown signal “${token}”. Declare inputs first; reference only earlier LET signals or outputs.`);
    return { input: index };
  }
  function and() { let n = atom(); while (match('AND', '&')) { at++; n = { op: 'AND', a: n, b: atom() }; } return n; }
  function xor() { let n = and(); while (match('XOR', '^')) { at++; n = { op: 'XOR', a: n, b: and() }; } return n; }
  function or() { let n = xor(); while (match('OR', '|')) { at++; n = { op: 'OR', a: n, b: xor() }; } return n; }
  const node = or(); if (at !== t.length) throw new Error(`Unexpected token “${t[at]}”. Put an operator between values.`); return node;
}
export function evaluate(node, values) {
  if ('value' in node) return Number(node.value);
  if ('input' in node) return Number(Boolean(values[node.input]));
  const a = evaluate(node.a, values);
  if (node.op === 'NOT') return 1 - a;
  const b = evaluate(node.b, values);
  return node.op === 'AND' ? a & b : node.op === 'OR' ? a | b : a ^ b;
}
export function compile(source) {
  if (typeof source !== 'string' || source.length > LIMITS.length) throw new Error('Program must be text under 24,000 characters.');
  const lines = source.split(/\r?\n/).map((s, i) => ({ text: s.replace(/#.*/, '').trim(), line: i + 1 })).filter(l => l.text);
  if (!lines.length || !/^INPUT\s+/i.test(lines[0].text)) throw new Error('Start with INPUT a, b (one to twelve input names).');
  const inputs = lines[0].text.replace(/^INPUT\s+/i, '').split(',').map(x => x.trim().toLowerCase());
  if (inputs.length < 1 || inputs.length > LIMITS.inputs) throw new Error('Use 1–12 inputs. Twelve inputs need 4,096 woven rows.');
  if (inputs.some(n => !nameValid(n)) || new Set(inputs).size !== inputs.length) throw new Error('Input names must be unique, start with a letter, and contain at most 16 letters, digits, or underscores. Operator names are reserved.');
  if (lines.length < 2 || lines.length > LIMITS.outputs + LIMITS.intermediates + 1) throw new Error('Define 1–16 outputs and up to 64 LET signals.');
  const outputs = [], definitions = [], names = [...inputs];
  let intermediateCount = 0;
  for (const line of lines.slice(1)) {
    try {
      const m = line.text.match(/^(LET\s+)?([a-z][a-z0-9_]*)\s*=\s*(.*)$/i);
      if (!m) throw new Error('Use name = expression for each output.');
      const name = m[2].toLowerCase();
      const internal = Boolean(m[1]);
      if (!nameValid(name) || names.includes(name)) throw new Error('Output names must be valid, unique, and different from input names.');
      const def = { name, expression: m[3], ast: expression(m[3], names), index: names.length };
      definitions.push(def); names.push(name);
      if (internal) intermediateCount++; else outputs.push(def);
      if (intermediateCount > LIMITS.intermediates || outputs.length > LIMITS.outputs) throw new Error('Use at most 64 LET signals and 16 outputs.');
    } catch (error) { throw new Error(`Line ${line.line}: ${error.message}`); }
  }
  if (!outputs.length) throw new Error('Define at least one output without LET.');
  const rows = Array.from({ length: 2 ** inputs.length }, (_, address) => {
    const bits = inputs.map((_, i) => (address >> (inputs.length - 1 - i)) & 1);
    const signals = [...bits];
    for (const def of definitions) signals.push(evaluate(def.ast, signals));
    return { address, bits, values: outputs.map(o => signals[o.index]) };
  });
  return { source, inputs, outputs, definitions, rows, ones: rows.reduce((n, r) => n + r.values.reduce((a, b) => a + b, 0), 0) };
}
export function addressOf(bits) { return bits.reduce((n, b) => (n << 1) | Number(Boolean(b)), 0); }
export function csv(model) {
  return ['address,' + [...model.inputs, ...model.outputs.map(o => o.name)].join(','), ...model.rows.map(r => [r.address, ...r.bits, ...r.values].join(','))].join('\n') + '\n';
}
export function starterCompatible(m) { return m.inputs.length <= 3 && m.outputs.length <= 4; }
export function firmware(m) {
  if (!starterCompatible(m)) throw new Error('The UNO starter reader supports up to 3 inputs and 4 outputs. Larger designs need a different addressing and sensing circuit.');
  return `// Woven Logic Lab — Arduino UNO R3 reader (not an Apollo emulator).
// USB 5V only. Switch CLOSED to GND = logical 1.
// Sense column -> diode ANODE; diode striped CATHODE -> row wire.
// Put a 330 ohm series resistor between each row wire and its row pin.
// No Boolean equations or truth-table values are stored in this sketch.
// The physical diode connections determine the result. Not bench-validated.
const byte inputCount = ${m.inputs.length};
const byte rowCount = ${m.rows.length};
const byte outputCount = ${m.outputs.length};
const byte rowPins[rowCount] = {${ROW_PINS.slice(0, m.rows.length).join(', ')}};
const byte switchPins[inputCount] = {${SWITCH_PINS.slice(0, m.inputs.length).join(', ')}};
const byte sensePins[outputCount] = {${SENSE_PINS.slice(0, m.outputs.length).join(', ')}};
// Inputs (most significant first): ${m.inputs.join(', ')}
// Outputs (left to right): ${m.outputs.map(o => o.name).join(', ')}
void setup() {
  Serial.begin(9600);
  for (byte r = 0; r < rowCount; r++) {
    pinMode(rowPins[r], INPUT);  // inactive rows float: never drive HIGH
    digitalWrite(rowPins[r], LOW);  // disable their pull-ups
  }
  for (byte i = 0; i < inputCount; i++) pinMode(switchPins[i], INPUT_PULLUP);
  for (byte c = 0; c < outputCount; c++) pinMode(sensePins[c], INPUT_PULLUP);
}
void loop() {
  byte address = 0;
  for (byte i = 0; i < inputCount; i++) {
    address = (address << 1) | (digitalRead(switchPins[i]) == LOW);
  }
  digitalWrite(rowPins[address], LOW);
  pinMode(rowPins[address], OUTPUT);
  delayMicroseconds(1000);
  Serial.print("row "); Serial.print(address); Serial.print(" -> ");
  for (byte c = 0; c < outputCount; c++) {
    Serial.print(digitalRead(sensePins[c]) == LOW ? '1' : '0');
    if (c + 1 < outputCount) Serial.print(' ');
  }
  Serial.println();
  pinMode(rowPins[address], INPUT);
  digitalWrite(rowPins[address], LOW);
  delay(150);  // wait for settled switches; not suitable for fast changing signals
}
`;
}
