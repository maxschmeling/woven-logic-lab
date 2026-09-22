import * as T from 'three';
import { moduleLayout } from '../site/rom.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Simplified shared-core rope module, not Apollo construction CAD.
// All geometry is procedural; the current truth-table bank determines every wire route.
export function createLoom(host, onProgress, onFailure) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor('#171f1d');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Interactive 3D memory sculpture. Drag to orbit. Use the labeled view and timeline controls for keyboard access.');
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, .04);
  scene.environment = env.texture; room.dispose(); pmrem.dispose();
  const camera = new T.PerspectiveCamera(34, 1, .1, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .09;
  controls.enablePan = false; controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI * .49;
  controls.enableZoom = false; // Page scrolling remains page scrolling; explicit zoom buttons below.
  const ambient = new T.HemisphereLight('#def5ed', '#52402c', 1.4); scene.add(ambient);
  const key = new T.DirectionalLight('#fff0d4', 3.0); key.position.set(-12, 30, 12);
  key.castShadow = true; key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -30;
  key.shadow.camera.right = key.shadow.camera.top = 30;
  key.shadow.normalBias = .035; scene.add(key);
  const rim = new T.DirectionalLight('#a8d6d3', 1.8); rim.position.set(20,10,-20); scene.add(rim);
  const group = new T.Group(); scene.add(group);
  let wires = [], cores, corePositions = [], needle, rowCount = 0, extent = 12, selection, currentAddress;
  let progress = 1, playing = false, inView = true, needsRender = true, lastTime = 0, lost = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const copper = new T.MeshStandardMaterial({color:'#cc8853',metalness:.82,roughness:.28});
  const ceramic = new T.MeshStandardMaterial({color:'#313a39',metalness:.5,roughness:.34});
  const frame = new T.MeshStandardMaterial({color:'#293c36',metalness:.65,roughness:.31});
  const brass = new T.MeshStandardMaterial({color:'#ba9b65',metalness:.82,roughness:.32});
  const cotton = new T.MeshStandardMaterial({color:'#d7c9a9',metalness:.05,roughness:.92});
  const rubber = new T.MeshStandardMaterial({color:'#111a17',roughness:.83});
  const mats = [copper,ceramic,frame,brass,cotton,rubber];
  const wireMats = ['#de7845','#5ba9a2','#e7c984','#9ead9b'].map(color=>new T.MeshStandardMaterial({color,metalness:.4,roughness:.3}));
  // A seeded fine-grain canvas texture adds surface variation without any network assets.
  const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = 128;
  const ctx = textureCanvas.getContext('2d'); let seed=123;
  for(let y=0;y<128;y++) for(let x=0;x<128;x++) { seed=(Math.imul(seed,1664525)+1013904223)>>>0; const v=155+(seed%40); ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.fillRect(x,y,1,1); }
  const texture = new T.CanvasTexture(textureCanvas); texture.wrapS=texture.wrapT=T.RepeatWrapping; texture.repeat.set(14,14);
  const boardMat = new T.MeshStandardMaterial({color:'#ac9875',roughness:.8,metalness:.05,bumpMap:texture,bumpScale:.035}); mats.push(boardMat);
  function mesh(geometry, material, x=0,y=0,z=0) { const m=new T.Mesh(geometry,material); m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m; }
  const box=(x,y,z,mat,px=0,py=0,pz=0)=>mesh(new T.BoxGeometry(x,y,z),mat,px,py,pz);
  function tube(points, radius, material, segments=60) {
    const curve = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');
    return { mesh:mesh(new T.TubeGeometry(curve,segments,radius,6,false),material),curve,segments };
  }
  function clear() {
    for(const child of [...group.children]) { child.geometry?.dispose(); child.dispose?.(); if(child.userData.ownMaterial) {child.material.map?.dispose();child.material.dispose();} group.remove(child); }
    wires=[];corePositions=[];
  }
  function label(text,width,x,z) {
    const c=document.createElement('canvas');c.width=1024;c.height=128;const context=c.getContext('2d');
    context.fillStyle='#c9b995';context.fillRect(0,0,c.width,c.height);context.fillStyle='#283b34';context.font='bold 42px monospace';context.textAlign='center';context.fillText(text,512,82);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
    const plate=mesh(new T.PlaneGeometry(width,.65),new T.MeshStandardMaterial({map:tex,roughness:.7}),x,.06,z);
    plate.rotation.x=-Math.PI/2;plate.userData.ownMaterial=true;
  }
  function setModel(model, start=0, count=16) {
    clear(); const rows=model.rows.slice(start,start+count); rowCount=rows.length;
    const cols=model.outputs.length, layout=moduleLayout(rows,cols);
    const w=layout.width,d=layout.depth;
    rowCount=cols; // The timeline weaves sense wires, not word cores.
    host.dataset.words=JSON.stringify(rows.map(r=>r.values));
    host.dataset.routes=JSON.stringify(layout.wires.map(w=>w.crossings));
    extent=Math.max(w,d);group.position.y=0;
    box(w+.5,.38,d+.5,frame,0,-.43,0);box(w,.24,d,boardMat,0,-.15,0);
    for(const z of [-d/2,d/2]) box(w+.65,.52,.35,brass,0,-.12,z);
    for(const x of [-w/2,w/2]) box(.35,.52,d+.65,frame,x,-.12,0);
    for(const x of [-w/2+.6,w/2-.6]) for(const z of [-d/2+.6,d/2-.6]) {
      const bolt=mesh(new T.CylinderGeometry(.17,.17,.1,16),brass,x,.045,z);
      box(.2,.015,.035,rubber,x,.102,z);
      mesh(new T.CylinderGeometry(.32,.36,.4,16),rubber,x,-.78,z);
    }
    // One selected word core shares several sense wires (a simplified rope strand).
    // No decorative copper wraps: every colored path is an actual stored bit.
    cores=new T.InstancedMesh(new T.TorusGeometry(.68,.14,12,36),ceramic,rows.length);
    cores.castShadow=true;cores.receiveShadow=true;group.add(cores);
    const transform=new T.Object3D();
    layout.cores.forEach((core,i)=>{
      transform.position.set(core.x,1.15,core.z);transform.rotation.set(0,Math.PI/2,0);transform.updateMatrix();cores.setMatrixAt(i,transform.matrix);
      corePositions.push(core);
      box(.34,.42,1.5,cotton,core.x,.25,core.z);
      label(String(core.address).padStart(4,'0'),1.25,core.x,core.z+1.3);
    });
    for(const route of layout.wires) {
      const wire=tube(route.points,.038,wireMats[route.bit%wireMats.length],Math.max(120,rows.length*48));
      wire.crossings=route.crossings;wires.push(wire);
      const p=route.points[0];mesh(new T.CylinderGeometry(.09,.09,.65,10),brass,p[0]-.35,.4,p[2]);
    }
    // Connector block and laced frame complete the compact module silhouette.
    box(w-2,.6,.65,rubber,0,.2,-d/2+.7);
    for(let i=0;i<16;i++)box(.08,.3,.8,brass,(i-7.5)*(w-3)/16,.4,-d/2+.6);
    label(`ROPE / ${start}–${start+rows.length-1} / ${cols} BIT`,Math.min(w-2,13),0,d/2-.5);
    selection=mesh(new T.TorusGeometry(.91,.04,8,40),new T.MeshBasicMaterial({color:'#ffee92'}));
    selection.rotation.y=Math.PI/2;selection.userData.ownMaterial=true;
    select(currentAddress ?? start);
    needle=mesh(new T.CylinderGeometry(.038,.016,1.05,8),brass);needle.rotation.z=Math.PI/2;
    const floor=mesh(new T.PlaneGeometry(extent*8,extent*8),new T.ShadowMaterial({opacity:.3}),0,-1.01,0);floor.rotation.x=-Math.PI/2;floor.userData.ownMaterial=true;
    home();setProgress(progress);needsRender=true;
  }
  function select(address) {
    currentAddress=address;
    const core=corePositions.find(c=>c.address===address);
    if(selection){selection.visible=Boolean(core);if(core)selection.position.set(core.x,1.15,core.z);}
    host.dataset.selectedAddress=String(address);needsRender=true;
  }
  function focusBit(bit=-1) {
    wires.forEach((w,i)=>{w.mesh.material=wireMats[i%wireMats.length];w.mesh.visible=bit<0||bit===i;w.focused=bit<0||bit===i;});
    setProgress(progress);
  }
  function home(view='angle') {
    const size=extent*1.4; controls.target.set(0,.2,0);
    if(view==='top') camera.position.set(0,size*1.55,.001);
    else if(view==='detail') {const c=corePositions.find(c=>c.address===currentAddress)||corePositions[0];controls.target.set(c.x,1.15,c.z);camera.position.set(c.x-5,3,c.z+2);}
    else camera.position.set(-size*.8,size*.95,size*.95);
    controls.minDistance=view==='detail'?2:extent*.55;controls.maxDistance=extent*4;
    controls.update();needsRender=true;
  }
  function setProgress(value) {
    progress=T.MathUtils.clamp(value,0,1);
    const position=progress*rowCount;
    wires.forEach((wire,i)=>{const amount=T.MathUtils.clamp(position-i,0,1); const n=Math.floor(wire.mesh.geometry.index.count*amount/6)*6;wire.mesh.geometry.setDrawRange(0,n);wire.mesh.visible=n>0 && wire.focused!==false;});
    if(needle) {
      const active=Math.min(rowCount-1,Math.floor(position));const fraction=position-active;
      needle.visible=progress>0 && progress<1;
      if(wires[active]){const p=wires[active].curve.getPointAt(Math.min(1,fraction));needle.position.copy(p);needle.position.x+=.45;}
    }
    host.dataset.progress=String(progress);onProgress(progress,playing);needsRender=true;
  }
  function play(value=!playing) {playing=value&&!lost;lastTime=0;if(playing&&progress>=1)setProgress(0);onProgress(progress,playing);needsRender=true;}
  function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();needsRender=true;}
  const ro=new ResizeObserver(resize);ro.observe(host);
  const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;lastTime=0;needsRender=true;});observer.observe(host);
  controls.addEventListener('change',()=>{needsRender=true;});
  document.addEventListener('visibilitychange',()=>{lastTime=0;});
  reduced.addEventListener('change',()=>{if(reduced.matches)play(false);});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;play(false);onFailure('The 3D view lost its graphics context. Reload to restore it; the pattern and simulator still work.');});
  renderer.setAnimationLoop(time=>{
    if(!inView||document.hidden||lost){lastTime=0;return;}
    const dt=lastTime?Math.min((time-lastTime)/1000,.1):0;lastTime=time;
    if(playing){setProgress(progress+dt/Math.max(12,rowCount*1.2));if(progress>=1)play(false);}
    controls.update();
    if(needsRender){renderer.render(scene,camera);needsRender=false;host.dataset.ready='true';}
  });
  resize();
  return {setModel,setProgress,play,home,select,focusBit,zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).clampLength(controls.minDistance,controls.maxDistance).add(controls.target);controls.update();needsRender=true;},dispose(){renderer.setAnimationLoop(null);ro.disconnect();observer.disconnect();controls.dispose();clear();mats.concat(wireMats).forEach(m=>m.dispose());texture.dispose();env.dispose();renderer.dispose();canvas.remove();}};
}
