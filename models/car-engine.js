import * as THREE from '../vendor/three.module.js';
import { createEngine } from './engine.js?v=20261115-5';

export function createCarEngine() {
  const root = new THREE.Group();
  const car = new THREE.Group();
  root.add(car);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x426a81, metalness: .5, roughness: .25, clearcoat: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x17212a, roughness: .75 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8c6d0, metalness: .7, roughness: .3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x729cad, transparent: true, opacity: .25, depthWrite: false, roughness: .15 });
  const transparentHood = glass.clone();
  transparentHood.opacity = .09;
  const light = new THREE.MeshStandardMaterial({ color: 0xeaf4ff, emissive: 0x779dbb, emissiveIntensity: .45 });
  const driveBlue = new THREE.MeshStandardMaterial({ color: 0x3873e6, metalness: .45, roughness: .3 });
  const driveAmber = new THREE.MeshStandardMaterial({ color: 0xef9a37, metalness: .45, roughness: .3 });
  const wheels = [];
  function box(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }
  function rod(a,b,r,material) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r,r,start.distanceTo(end),16),material);
    mesh.position.copy(start).lerp(end,.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
    car.add(mesh); return mesh;
  }
  box(car, 3.0,.20,3.65,0,.57,-1.025,rubber);
  // The front floor is cut away so the engine output and drive shafts remain visible.
  box(car, 3.0,.06,2.05,0,.48,1.825,transparentHood);
  for(const sign of [-1,1]) {
    box(car,.22,.64,5.4,sign*1.48,.94,0,paint);
    box(car,.12,.09,4.9,sign*1.61,.65,0,metal);
    for(const z of [-1.85,1.72]) {
      const wheel = new THREE.Group(); wheel.position.set(sign*1.50,.60,z); car.add(wheel);
      wheels.push(wheel);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(.59,.59,.34,56),rubber);
      tire.rotation.z=Math.PI/2;wheel.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.36,48),metal);
      hub.rotation.z=Math.PI/2;wheel.add(hub);
      for(let i=0;i<5;i++) {
        const a=i*Math.PI*2/5;
        const spoke=box(wheel,.38,.09,.58,0,0,0,rubber);
        spoke.rotation.x=a;
      }
      if(z > 0) {
        const marker=box(wheel,.395,.08,.12,0,.45,0,driveBlue);
        marker.name='driven-wheel-marker';
      }
    }
    box(car,.63,.14,.08,sign*.98,1.10,2.8,light);
    rod([sign*1.40,1.25,.80],[sign*1.13,2.23,-.15],.055,paint);
    rod([sign*1.13,2.23,-.15],[sign*1.10,2.23,-1.3],.055,paint);
    rod([sign*1.1,2.23,-1.3],[sign*1.42,1.25,-2.10],.055,paint);
    box(car,.45,.14,.27,sign*1.65,1.45,.48,paint);
    const sideWindow=box(car,.025,.75,1.32,sign*1.25,1.72,-.70,glass);
    sideWindow.rotation.z=-sign*.17;
  }
  box(car,3.06,.47,.20,0,.91,2.80,paint);
  box(car,1.66,.24,.23,0,.87,2.82,rubber);
  for(let i=0;i<4;i++) box(car,1.55,.02,.025,0,.78+i*.06,2.95,metal);
  box(car,3.0,.45,.20,0,.92,-2.8,paint);
  box(car,2.8,.10,.78,0,1.25,-2.35,paint);
  box(car,2.30,.10,1.32,0,2.25,-.74,paint);
  const windshield=box(car,2.52,1.38,.035,0,1.75,.32,glass);
  windshield.rotation.x=-.68;
  const rearGlass=box(car,2.5,1.06,.035,0,1.76,-1.72,glass);
  rearGlass.rotation.x=.80;
  box(car,2.76,.06,1.87,0,1.53,1.75,transparentHood);
  for(const x of [-1.36,1.36]) rod([x,1.49,.80],[x,1.49,2.68],.035,metal);
  for(const z of [.80,2.68]) rod([-1.36,1.49,z],[1.36,1.49,z],.035,metal);
  for(const x of [-.65,.65]) {
    box(car,.65,.60,.16,x,1.27,-.74,rubber);
    box(car,.65,.12,.62,x,.98,-.45,rubber);
  }

  // Two gear meshes in separate axial planes represent a selected forward
  // ratio and the final drive. The intermediate gears share one shaft.
  // Both front half-shafts turn together in this straight-ahead example.
  function axleGear(radius, teeth, x, y, z) {
    const wheel=new THREE.Group();wheel.position.set(x,y,z);car.add(wheel);
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(radius-.018,radius-.018,.075,40),driveBlue);
    disc.rotation.z=Math.PI/2;wheel.add(disc);
    for(let i=0;i<teeth;i++) {
      const angle=i*Math.PI*2/teeth;
      const tooth=box(wheel,.08,.04,.027,0,radius*Math.cos(angle),radius*Math.sin(angle),driveBlue);
      tooth.rotation.x=angle;
    }
    return wheel;
  }
  const inputGear=axleGear(.09,12,1.02,.7245,1.72);
  const intermediateA=axleGear(.09,12,1.02,.7245,1.90);
  const intermediateB=axleGear(.09,12,.88,.7245,1.90);
  const outputGear=axleGear(.18,24,.88,.4545,1.90);
  rod([.63,.7245,1.72],[1.08,.7245,1.72],.038,driveAmber);
  rod([.80,.7245,1.90],[1.08,.7245,1.90],.035,driveAmber);
  rod([-1.15,.4545,1.90],[1.15,.4545,1.90],.045,driveAmber);
  for(const sign of [-1,1]) {
    rod([sign*1.15,.4545,1.90],[sign*1.50,.60,1.72],.045,driveAmber);
    const joint=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),metal);
    joint.position.set(sign*1.15,.4545,1.90);car.add(joint);
  }
  const axleMarker=box(car,2.25,.025,.025,0,.5025,1.90,driveBlue);

  // Passing road marks make the wheel rotation read as forward travel.
  const road = new THREE.Group();
  car.add(road);
  const roadSurface = new THREE.MeshStandardMaterial({ color: 0xaebfce, roughness: .9 });
  const marks = Array.from({length: 12}, (_, i) => {
    const mark = box(road,.11,.012,.52,i%2 ? 2.08 : -2.08,.012,0,roadSurface);
    return mark;
  });

  const engine = createEngine();
  root.add(engine.root);
  const source = new THREE.Vector3(0,.51,1.72);
  const destination = new THREE.Vector3(1.8,.15,3.25);
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([source,new THREE.Vector3()]);
  const line = new THREE.Line(lineGeometry, new THREE.LineDashedMaterial({color:0x3873e6,dashSize:.12,gapSize:.09,transparent:true,opacity:.5,depthTest:false}));
  line.frustumCulled=false;root.add(line);
  const flywheel = engine.root.getObjectByName('output-flywheel');
  const output = new THREE.Vector3();
  const input = new THREE.Vector3();
  const powerMaterial = new THREE.MeshBasicMaterial({color:0xf2aa43,transparent:true,opacity:.9,depthTest:false});
  const pulses = Array.from({length: 7}, () => {
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),powerMaterial);
    root.add(pulse);return pulse;
  });
  const axlePulses = [-1,1].map(sign => Array.from({length: 3}, () => {
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(.052,10,8),powerMaterial);
    car.add(pulse);return {pulse,sign};
  })).flat();
  return {
    root, camera: [-6.4,5.1,8.3], target: [0,1.05,.2],
    detailCamera: [-10,8,16], detailTarget: [-.1,2.7,1.6],
    explodedCamera: [-12,10.9,19], explodedTarget: [0,3.1,2.5],
    update(turn,explode=0,focus=null,extraction=0) {
      const amount = THREE.MathUtils.smoothstep(extraction,0,1);
      const scale = THREE.MathUtils.lerp(.195,1,amount);
      engine.root.scale.setScalar(scale);
      engine.root.position.copy(source).lerp(destination,amount);
      engine.root.position.y += Math.sin(Math.PI*amount)*1.3;
      car.position.set(-5.2*amount,0,-2.8*amount);
      paint.transparent=amount>.01;
      paint.opacity=1-amount*.5;
      paint.depthWrite=amount<.01;
      engine.update(turn,explode*amount,focus);
      inputGear.rotation.x=turn*Math.PI*2;
      intermediateA.rotation.x=-turn*Math.PI*2+Math.PI/12;
      intermediateB.rotation.x=intermediateA.rotation.x;
      outputGear.rotation.x=turn*Math.PI;
      wheels.forEach(wheel=>{wheel.rotation.x=turn*Math.PI;});
      marks.forEach((mark,i)=>{
        mark.position.z=3.1-((Math.floor(i/2)*1.1+turn*Math.PI*.59)%6.6+6.6)%6.6;
      });
      // The offset stripe travels around the axle, showing the same output
      // angle as the wheels rather than an unrelated free-spinning cylinder.
      axleMarker.position.y=.4545+.048*Math.cos(turn*Math.PI);
      axleMarker.position.z=1.90+.048*Math.sin(turn*Math.PI);
      axleMarker.rotation.x=turn*Math.PI;
      // The dashed callout links the enlarged engine to its location in the
      // car; moving highlights continue along the two driven half-shafts.
      root.updateMatrixWorld(true);
      flywheel.getWorldPosition(output);
      input.set(1.02,.7245,1.72).add(car.position);
      line.visible=amount>.025 && explode<.05;
      const positions=lineGeometry.attributes.position;
      positions.setXYZ(0,output.x,output.y,output.z);positions.setXYZ(1,input.x,input.y,input.z);positions.needsUpdate=true;
      line.computeLineDistances();
      pulses.forEach((pulse,i)=>{
        pulse.visible=line.visible;
        const travel=((turn*.7+i/pulses.length)%1+1)%1;
        pulse.position.copy(output).lerp(input,travel);
      });
      axlePulses.forEach(({pulse,sign},i)=>{
        pulse.visible=explode<.05;
        const travel=((turn*.7+(i%3)/3)%1+1)%1;
        pulse.position.set(sign*1.50*travel,.4545+.1455*travel,1.90-.18*travel);
      });
    },
  };
}
