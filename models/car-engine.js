import * as THREE from '../vendor/three.module.js';
import { createPrintedEngine, dimensions } from './printed-engine.js?v=20261116-2';
import { createCarBody } from './car-body.js?v=20261116-2';

// The printed kit is the main teaching model. Its placement in the transparent
// engine bay is a correspondence illustration, not a production engine design.
export async function createCarEngine() {
  const root=new THREE.Group();
  const engine=await createPrintedEngine();
  root.add(engine.root);
  const {root:car,wheels}=createCarBody({cutaway:true});
  root.add(car);
  const blue=new THREE.MeshStandardMaterial({color:0x3873e6,metalness:.4,roughness:.3});
  const amber=new THREE.MeshStandardMaterial({color:0xef9a37,metalness:.4,roughness:.3});
  const box=(parent,size,material,at)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
    mesh.position.set(...at);parent.add(mesh);return mesh;
  };
  const shaft=(from,to,r,material)=>{
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),16),material);
    mesh.position.copy(a).lerp(b,.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());
    car.add(mesh);return mesh;
  };
  const axleZ=1.48;
  const axleY=.42;
  const inputY=axleY+.24;
  function gear(radius,teeth,x,y,z) {
    const wheel=new THREE.Group();wheel.position.set(x,y,z);car.add(wheel);
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(radius-.014,radius-.014,.06,40),blue);
    disc.rotation.z=Math.PI/2;wheel.add(disc);
    for(let i=0;i<teeth;i++) {
      const a=i*Math.PI*2/teeth;
      const tooth=box(wheel,[.065,.029,.022],blue,[0,radius*Math.cos(a),radius*Math.sin(a)]);
      tooth.rotation.x=a;
    }
    return wheel;
  }
  const input=gear(.08,12,.95,inputY,axleZ);
  const middleA=gear(.08,12,.95,inputY,axleZ+.16);
  const middleB=gear(.08,12,.81,inputY,axleZ+.16);
  const output=gear(.16,24,.81,axleY,axleZ+.16);
  input.name='drive-input';output.name='drive-output';
  shaft([.27,inputY,axleZ],[1.02,inputY,axleZ],.032,amber);
  shaft([.74,inputY,axleZ+.16],[1.02,inputY,axleZ+.16],.03,amber);
  shaft([-1.03,axleY,axleZ+.16],[1.03,axleY,axleZ+.16],.035,amber);
  for(const side of [-1,1])shaft([side*1.03,axleY,axleZ+.16],[side*1.26,axleY,axleZ],.035,amber);
  const axleStripe=box(car,[2.0,.018,.018],blue,[0,axleY+.036,axleZ+.16]);
  wheels.filter(wheel=>wheel.name==='front-wheel').forEach(wheel=>{
    const marker=box(wheel,[.34,.06,.06],blue,[0,.30,0]);marker.name='driven-wheel-marker';
  });
  const roadSurface=new THREE.MeshStandardMaterial({color:0xb2c2ce,roughness:.9});
  const marks=Array.from({length:12},(_,i)=>box(car,[.10,.01,.45],roadSurface,[i%2?1.80:-1.80,.006,0]));

  const mountedScale=.0068;
  const source=new THREE.Vector3(0,inputY-dimensions.crankHeight*mountedScale,axleZ);
  const destination=new THREE.Vector3(-2.45,0,1.0);
  const lineGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
  const line=new THREE.Line(lineGeometry,new THREE.LineDashedMaterial({color:0x3873e6,dashSize:.12,gapSize:.1,transparent:true,opacity:.5,depthTest:false}));
  line.frustumCulled=false;root.add(line);
  const pulseMaterial=new THREE.MeshBasicMaterial({color:0xf4ad49,depthTest:false});
  const pulses=Array.from({length:7},()=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),pulseMaterial);root.add(mesh);return mesh;
  });
  const wheelPulses=[-1,1].flatMap(side=>Array.from({length:3},(_,index)=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),pulseMaterial);car.add(mesh);return {mesh,side,index};
  }));
  const from=new THREE.Vector3(),to=new THREE.Vector3();

  function update(turn,spread=0,focus=null,extraction=1) {
    const amount=THREE.MathUtils.smoothstep(extraction,0,1);
    engine.root.scale.setScalar(THREE.MathUtils.lerp(mountedScale,.035,amount));
    engine.root.rotation.y=(1-amount)*Math.PI/2;
    engine.root.position.copy(source).lerp(destination,amount);
    engine.root.position.y+=Math.sin(Math.PI*amount)*.8;
    car.position.set(3.55*amount,0,-1.65*amount);
    engine.update(turn,spread*amount,focus==='linkage'?'linkage':null);
    const angle=turn*Math.PI*2;
    input.rotation.x=angle;
    middleA.rotation.x=-angle+Math.PI/12;
    middleB.rotation.x=middleA.rotation.x;
    output.rotation.x=angle/2;
    wheels.forEach(wheel=>{wheel.rotation.x=angle/2;});
    axleStripe.position.y=axleY+.036*Math.cos(angle/2);
    axleStripe.position.z=axleZ+.16+.036*Math.sin(angle/2);
    axleStripe.rotation.x=angle/2;
    marks.forEach((mark,i)=>{mark.position.z=2.8-((Math.floor(i/2)+turn*Math.PI*.405)%6+6)%6;});
    blue.emissive.setHex(0x17418f);blue.emissiveIntensity=focus==='gears'?.5:0;
    root.updateMatrixWorld(true);
    from.set(0,dimensions.crankHeight,dimensions.boreDepth+44.7);
    engine.root.localToWorld(from);
    input.getWorldPosition(to);
    line.visible=amount>.04&&spread<.04;
    const positions=lineGeometry.attributes.position;
    positions.setXYZ(0,...from);positions.setXYZ(1,...to);positions.needsUpdate=true;line.computeLineDistances();
    pulses.forEach((pulse,i)=>{
      pulse.visible=line.visible;
      pulse.position.copy(from).lerp(to,((turn*.7+i/7)%1+1)%1);
    });
    wheelPulses.forEach(({mesh,side,index})=>{
      const travel=((turn*.7+index/3)%1+1)%1;
      mesh.visible=spread<.04;
      mesh.position.set(side*1.26*travel,axleY,axleZ+.16*(1-travel));
    });
  }
  update(0,0,null,1);
  return {root,update,camera:[6.7,4.4,8.3],target:[0,1.0,.3],
    detailCamera:[6.2,5.3,10.3],detailTarget:[0,2.7,.1],
    explodedCamera:[16,11,24],explodedTarget:[.5,3,.7]};
}
