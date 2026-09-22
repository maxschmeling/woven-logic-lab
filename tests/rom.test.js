import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, PRESETS } from '../site/logic.js';
import { programROM, executeROM, moduleLayout } from '../site/rom.js';
import { CatmullRomCurve3, Vector3 } from 'three';
test('compiled instruction ROM executes every preset for every input combination',()=>{
  for(const preset of Object.values(PRESETS)){
    const model=compile(preset.code),rom=programROM(model);
    for(const row of model.rows)assert.deepEqual(executeROM(rom.words,row.bits).outputs,row.values,preset.name+' '+row.address);
    for(const [i,row] of rom.rows.entries()) assert.equal(parseInt(row.values.join(''),2),rom.words[i]);
  }
});
test('physical through and bypass paths have correct ring-plane clearances',()=>{
  // Verify smooth rendered paths, not only route labels/control-point metadata.
  for(const pattern of [0,1,2,3]){
    const rows=Array.from({length:16},(_,address)=>({address,values:Array.from({length:16},(_,bit)=>pattern===0?0:pattern===1?1:(address+bit)%2)}));
    const layout=moduleLayout(rows,16);
    assert.equal(new Set(layout.cores.map(c=>c.x)).size,4);
    assert.equal(new Set(layout.cores.map(c=>c.z)).size,4);
    for(const wire of layout.wires){
      const curve=new CatmullRomCurve3(wire.points.map(p=>new Vector3(...p)),false,'centripetal');
      const samples=curve.getPoints(12000);
      for(const core of layout.cores){
        const crossing=samples.filter(p=>Math.abs(p.x-core.x)<.03 && Math.abs(p.z-core.z)<.3);
        assert.ok(crossing.length);
        for(const p of crossing){
          const distance=Math.hypot(p.y-1.15,p.z-core.z);
          assert.ok(core.values[wire.bit]?distance<.5:distance>.86,`address ${core.address} bit ${wire.bit}: ${distance}`);
        }
      }
    }
  }
});
test('stored instruction changes affect execution independently from original equations',()=>{
  const rom=programROM(compile('INPUT a\nx = a XOR 1'));
  assert.deepEqual(executeROM(rom.words,[0]).outputs,[1]);
  rom.words[1]=0x2000;
  assert.deepEqual(executeROM(rom.words,[0]).outputs,[0]);
});
