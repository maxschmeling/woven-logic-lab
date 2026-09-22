// Teaching ISA: 16-bit words (4-bit opcode + 12-bit operand), NOT AGC machine code.
export const OP = { LOAD:1, CONST:2, NOT:3, AND:4, OR:5, XOR:6, STORE:7, OUT:8, HALT:15 };
export const wordBits = value => Array.from({length:16},(_,i)=>(value >>> (15-i)) & 1);
export function programROM(model) {
  const words=[], listing=[];
  const emit=(op,arg=0,label='')=>{words.push((OP[op]<<12)|arg);listing.push(`${op}${label ? ' '+label : ''}`);};
  const names=[...model.inputs,...model.definitions.map(d=>d.name)];
  function visit(node) {
    if ('input' in node) emit('LOAD',node.input,names[node.input]);
    else if ('value' in node) emit('CONST',Number(node.value),String(Number(node.value)));
    else {visit(node.a);if(node.b)visit(node.b);emit(node.op);}
  }
  for(const def of model.definitions) {
    visit(def.ast);emit('STORE',def.index,def.name);
    const out=model.outputs.indexOf(def);
    if(out>=0){emit('LOAD',def.index,def.name);emit('OUT',out,def.name);}
  }
  emit('HALT');
  return {words,listing,inputs:Array.from({length:16},(_,i)=>`a${15-i}`),rows:words.map((w,address)=>({address,values:wordBits(w),bits:wordBits(address)})),outputs:Array.from({length:16},(_,i)=>({name:`b${15-i}`}))};
}
export function executeROM(words, inputs) {
  const signals=[...inputs],stack=[],outputs=[],trace=[];
  for(let pc=0;pc<words.length;pc++) {
    const word=words[pc],op=word>>>12,arg=word&4095;trace.push(pc);
    if(op===OP.HALT)return {outputs,trace};
    if(op===OP.LOAD) {if(signals[arg]===undefined)throw Error('Uninitialized signal');stack.push(signals[arg]);}
    else if(op===OP.CONST)stack.push(arg&1);
    else if(op===OP.STORE || op===OP.OUT){if(!stack.length)throw Error('Empty stack');(op===OP.STORE?signals:outputs)[arg]=stack.pop();}
    else {
      if(stack.length<(op===OP.NOT?1:2))throw Error('Empty stack');
      const b=stack.pop();if(op===OP.NOT)stack.push(1-b);
      else {const a=stack.pop();if(op===OP.AND)stack.push(a&b);else if(op===OP.OR)stack.push(a|b);else if(op===OP.XOR)stack.push(a^b);else throw Error('Unknown instruction');}
    }
  }
  throw Error('Missing HALT');
}
// Fold consecutive word cores into a compact grid; each bit wire visits every core.
export function moduleLayout(rows, bitCount) {
  const columns=Math.ceil(Math.sqrt(rows.length)),lines=Math.ceil(rows.length/columns);
  const cores=rows.map((row,i)=>({address:row.address,values:row.values,x:((Math.floor(i/columns)%2 ? columns-1-i%columns:i%columns)-(columns-1)/2)*3.4,z:(Math.floor(i/columns)-(lines-1)/2)*3.5}));
  const wires=Array.from({length:bitCount},(_,bit)=>{
    const oy=((bit%4)-1.5)*.105,oz=(Math.floor(bit/4)-1.5)*.105;
    const points=[],crossings=[];
    cores.forEach((core,i)=>{
      const direction=Math.floor(i/columns)%2?-1:1;
      if(i && i%columns===0){const prior=cores[i-1],edge=prior.x-direction*1.65;points.push([edge,1.15+oy,prior.z+oz],[edge,1.15+oy,core.z+oz]);}
      const y=core.values[bit]?1.15+oy:2.4+oy;
      points.push([core.x-direction*1.2,1.15+oy,core.z+oz],[core.x-direction*.65,y,core.z+oz],[core.x,y,core.z+oz],[core.x+direction*.65,y,core.z+oz],[core.x+direction*1.2,1.15+oy,core.z+oz]);
      crossings.push({address:core.address,bit,value:core.values[bit],point:[core.x,y,core.z+oz]});
    });
    return {bit,points,crossings};
  });
  return {cores,wires,width:Math.max(9,columns*3.4+2),depth:Math.max(9,lines*3.5+3)};
}
