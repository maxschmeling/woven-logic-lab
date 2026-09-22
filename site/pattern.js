export const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function patternSVG(model, selected = -1, mode = 'yarn', start = 0, count = model.rows.length) {
  const rows = model.rows.slice(start, start + count);
  const left = model.inputs.length > 6 ? 210 : 180, width = Math.max(500, left + 30 + model.outputs.length * 116), height = 110 + rows.length * 51;
  const xs = model.outputs.map((_, i) => left + i * 116);
  const text = (x, y, content, more = '') => `<text x="${x}" y="${y}" ${more}>${escapeHTML(content)}</text>`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="pattern-title pattern-desc"><title id="pattern-title">${mode === 'yarn' ? 'Yarn weaving' : 'Diode connection'} pattern</title><desc id="pattern-desc">Rows ${start}–${start + rows.length - 1} of ${model.rows.length}, by ${model.outputs.length} outputs. ${mode === 'yarn' ? 'Straight through a ring means one, curved above means zero. This is a human-readable model.' : 'A diode connects each one. Zero crossings stay insulated. Striped cathode connects to row; anode to column.'} A highlighted row shows the selected input.</desc><rect width="${width}" height="${height}" rx="8" fill="#f8f5ed"/><g font-family="ui-monospace,monospace" font-size="11" fill="#595e53">`;
  svg += text(18, 24, 'ROW / INPUTS');
  xs.forEach((x, c) => { svg += text(x, 24, model.outputs[c].name, 'text-anchor="middle" font-weight="bold"'); });
  if (mode === 'circuit') xs.forEach(x => { svg += `<path d="M${x + 27} 39V${height - 26}" stroke="#216d62" stroke-width="3"/>`; });
  rows.forEach((row, r) => {
    const y = 71 + r * 51, active = selected === row.address;
    if (active) svg += `<rect x="7" y="${y - 25}" width="${width - 14}" height="47" rx="5" fill="#dfeade"/>`;
    svg += text(18, y + 4, `${String(row.address).padStart(2, '0')} / ${row.bits.join('')}`, active ? 'font-weight="bold" fill="#1d5d54"' : '');
    const color = active ? '#af482c' : '#8d8374';
    if (mode === 'yarn') {
      xs.forEach((x) => { svg += `<circle cx="${x}" cy="${y}" r="14" fill="#ede6d7" stroke="#bcb09a" stroke-width="5"/>`; });
      let d = `M${left - 65} ${y}`;
      xs.forEach((x, c) => {
        d += row.values[c] ? ` H${x + 30}` : ` H${x - 30} C${x - 22} ${y} ${x - 27} ${y - 25} ${x} ${y - 25} C${x + 27} ${y - 25} ${x + 22} ${y} ${x + 30} ${y}`;
      });
      d += ` H${width - 30}`;
      svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
      xs.forEach((x, c) => { svg += text(x, y + 5, row.values[c], 'text-anchor="middle" font-size="10" font-weight="bold" fill="#292d28" stroke="#f8f5ed" stroke-width="3" paint-order="stroke"'); });
    } else {
      // Each column and row cross without contact. Only a shown diode joins them.
      svg += `<path d="M${left - 65} ${y}H${width - 22}" stroke="${color}" stroke-width="3"/>`;
      xs.forEach((x, c) => {
        svg += `<path d="M${x + 27} ${y - 25}V${y + 23}" stroke="#f8f5ed" stroke-width="8"/><path d="M${x + 27} ${y - 25}V${y + 23}" stroke="#216d62" stroke-width="3"/>`;
        if (row.values[c]) {
          svg += `<path d="M${x - 23} ${y}V${y - 15}H${x + 27}" fill="none" stroke="#595e53" stroke-width="2"/><rect x="${x - 15}" y="${y - 20}" width="25" height="10" rx="2" fill="#d99063" stroke="#7a523b"/><path d="M${x - 10} ${y - 20}v10" stroke="#292d28" stroke-width="3"/><circle cx="${x - 23}" cy="${y}" r="4" fill="${color}"/><circle cx="${x + 27}" cy="${y - 15}" r="4" fill="#216d62"/>`;
        }
        svg += text(x, y + 16, row.values[c] ? '1 · diode' : '0 · open', 'text-anchor="middle" font-size="9"');
      });
    }
  });
  svg += text(18, height - 12, mode === 'yarn' ? 'READ BY EYE · rings do not compute electrically' : 'STRIPE → ROW · insulated crossings · not to scale', 'font-size="9"');
  return svg + '</g></svg>';
}
export const circuitDetail = `<div class="wiring"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 205" role="img" aria-label="One bit wiring: sense pin with internal pull-up to diode anode, striped cathode to row wire through a 330 ohm resistor to selected row pin, driven LOW. Inactive row pins are high impedance.">
<g font-family="ui-monospace,monospace" font-size="11" fill="#292d28"><text x="10" y="22">ONE STORED BIT · current flows left → right when selected</text><text x="10" y="60">Sense pin</text><text x="10" y="76">A0–A3</text><path d="M40 85v30h110m90 0h95m70 0h120v-30" fill="none" stroke="#216d62" stroke-width="3"/><text x="10" y="148">INPUT_PULLUP</text><text x="10" y="165">internal 20–50k to 5V</text><rect x="150" y="98" width="90" height="34" rx="4" fill="#dc9a76" stroke="#805540"/><path d="M225 98v34" stroke="#292d28" stroke-width="6"/><text x="159" y="120">1N4148</text><text x="136" y="87">anode</text><text x="209" y="150">stripe = cathode</text><text x="267" y="100">row wire</text><rect x="335" y="102" width="70" height="26" fill="#f0dfbb" stroke="#927d55"/><text x="350" y="120">330Ω</text><text x="433" y="60">Row pin D2–D9</text><text x="433" y="76">OUTPUT LOW</text><text x="334" y="177">Other rows: INPUT, no pull-up</text><text x="10" y="198">ZERO: leave the diode out. Never directly join row and column.</text></g></svg></div>`;
