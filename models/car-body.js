import * as THREE from '../vendor/three.module.js';

// One symmetric body shell and coplanar glass panels, shared by both lessons.
// X is the axle direction, Y is up, and the nose points along +Z.
export function createCarBody({ cutaway = false } = {}) {
  const root = new THREE.Group();
  root.name = 'car-body';
  const paint = new THREE.MeshPhysicalMaterial({color:0xb9cbd4,metalness:.32,roughness:.3,clearcoat:.75});
  const glass = new THREE.MeshPhysicalMaterial({color:0x354e61,metalness:.25,roughness:.18,clearcoat:1});
  const trim = new THREE.MeshStandardMaterial({color:0x23313e,roughness:.55});
  const rubber = new THREE.MeshStandardMaterial({color:0x20262c,roughness:.8});
  const alloy = new THREE.MeshStandardMaterial({color:0xbbc8d3,metalness:.8,roughness:.28});
  const lamp = new THREE.MeshStandardMaterial({color:0xeaf7ff,emissive:0xa9d9ff,emissiveIntensity:.3});
  const tail = new THREE.MeshStandardMaterial({color:0xb83d4b,roughness:.28});
  const add = (parent, geometry, material, at=[0,0,0]) => {
    const mesh = new THREE.Mesh(geometry,material);
    mesh.position.set(...at);parent.add(mesh);return mesh;
  };
  const box = (parent,size,material,at) => add(parent,new THREE.BoxGeometry(...size),material,at);
  function panel(parent, points, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
    const finish=material.clone();finish.side=THREE.DoubleSide;
    return add(parent,geometry,finish);
  }
  function bar(a,b,r,material) {
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
    const mesh=add(root,new THREE.CylinderGeometry(r,r,from.distanceTo(to),12),material);
    mesh.position.copy(from).lerp(to,.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());
    return mesh;
  }
  const shape=new THREE.Shape();
  shape.moveTo(-2.32,.37);shape.lineTo(-2.35,.72);shape.quadraticCurveTo(-2.28,.91,-2.06,.96);
  shape.lineTo(-.80,.98);shape.lineTo(.81,.96);shape.lineTo(2.10,.83);
  shape.quadraticCurveTo(2.35,.80,2.38,.60);shape.lineTo(2.29,.37);
  shape.lineTo(1.48+.46,.37);shape.lineTo(1.48+.46,.42);
  shape.absarc(1.48,.42,.46,0,Math.PI,false);
  shape.lineTo(1.48-.46,.37);shape.lineTo(-1.48+.46,.37);shape.lineTo(-1.48+.46,.42);
  shape.absarc(-1.48,.42,.46,0,Math.PI,false);
  shape.lineTo(-1.48-.46,.37);shape.closePath();
  const bodyGeometry=new THREE.ExtrudeGeometry(shape,{depth:2.48,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,curveSegments:32});
  bodyGeometry.translate(0,0,-1.24);
  const body=add(root,bodyGeometry,paint);
  body.rotation.y=-Math.PI/2;
  body.name='symmetric-body-shell';
  if(cutaway) {paint.transparent=true;paint.opacity=.22;paint.depthWrite=false;}
  box(root,[1.82,.16,3.85],trim,[0,.29,0]);

  const wheels=[];
  for(const side of [-1,1]) {
    for(const z of [-1.48,1.48]) {
      const wheel=new THREE.Group();wheel.position.set(side*1.26,.42,z);root.add(wheel);wheels.push(wheel);
      wheel.name=z>0?'front-wheel':'rear-wheel';
      const tire=add(wheel,new THREE.CylinderGeometry(.39,.39,.25,56),rubber);
      tire.rotation.z=Math.PI/2;
      for(const x of [-.09,.09]) {
        const edge=add(wheel,new THREE.TorusGeometry(.32,.085,12,56),rubber,[x,0,0]);edge.rotation.y=Math.PI/2;
      }
      const hub=add(wheel,new THREE.CylinderGeometry(.27,.27,.27,48),alloy);hub.rotation.z=Math.PI/2;
      const face=add(wheel,new THREE.CylinderGeometry(.235,.235,.012,48),trim,[side*.143,0,0]);face.rotation.z=Math.PI/2;
      for(let i=0;i<5;i++) {
        const a=i*Math.PI*2/5;
        const spoke=box(wheel,[.022,.21,.042],alloy,[side*.154,.12*Math.cos(a),.12*Math.sin(a)]);
        spoke.rotation.x=a;
      }
      const cap=add(wheel,new THREE.CylinderGeometry(.065,.065,.025,24),alloy,[side*.169,0,0]);cap.rotation.z=Math.PI/2;
    }
    // All side-glass vertices lie on the same plane as their surrounding pillars.
    const xAt=y=>1.24-(y-.96)*(.25/.966);
    panel(root,[[side*xAt(1.04),1.04,.63],[side*xAt(1.86),1.86,.08],
      [side*xAt(1.86),1.86,-.54],[side*xAt(1.04),1.04,-.54]],glass);
    panel(root,[[side*xAt(1.04),1.04,-.64],[side*xAt(1.86),1.86,-.64],
      [side*xAt(1.86),1.86,-1.05],[side*xAt(1.04),1.04,-1.80]],glass);
    bar([side*1.24,.96,.81],[side*.99,1.926,.15],.042,paint);
    bar([side*.99,1.926,.15],[side*.99,1.926,-1.11],.038,paint);
    bar([side*.99,1.926,-1.11],[side*1.24,.96,-1.91],.05,paint);
    bar([side*1.24,.96,-.59],[side*1.002,1.88,-.59],.04,trim);
    bar([side*1.265,.97,-1.93],[side*1.265,.97,.81],.018,alloy);
    box(root,[.035,.047,.25],alloy,[side*1.282,.87,-.34]);
    box(root,[.035,.047,.25],alloy,[side*1.282,.87,-1.15]);
    bar([side*1.24,1.10,.58],[side*1.43,1.15,.52],.027,trim);
    const mirror=add(root,new THREE.SphereGeometry(1,20,12),paint,[side*1.45,1.15,.51]);mirror.scale.set(.15,.07,.105);
    box(root,[.73,.115,.035],trim,[side*.79,.68,2.390]);
    box(root,[.64,.06,.045],lamp,[side*.79,.68,2.412]);
    box(root,[.52,.10,.045],tail,[side*.89,.75,-2.374]);
  }
  // A gently rounded, level roof replaces the old intersecting lofts.
  const roofShape=new THREE.Shape();
  roofShape.moveTo(-.98,-1.10);roofShape.lineTo(.98,-1.10);roofShape.lineTo(.98,.15);roofShape.lineTo(-.98,.15);roofShape.closePath();
  const roofGeometry=new THREE.ExtrudeGeometry(roofShape,{depth:.055,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:4});
  const roof=add(root,roofGeometry,paint,[0,1.926,0]);roof.rotation.x=Math.PI/2;
  panel(root,[[-.99,1.926,-1.11],[.99,1.926,-1.11],[1.24,.96,-1.91],[-1.24,.96,-1.91]],glass);
  box(root,[1.52,.17,.055],trim,[0,.49,2.352]);
  for(const y of [.445,.50,.555])box(root,[1.43,.014,.012],alloy,[0,y,2.388]);

  const windscreen=new THREE.Group();windscreen.position.set(0,.96,.81);windscreen.rotation.x=-.60;root.add(windscreen);
  const windowShape=(outline,depth,material,z)=>{
    const s=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));
    return add(windscreen,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.013,bevelThickness:.008,bevelSegments:2}),material,[0,0,z]);
  };
  windowShape([[-1.24,0],[1.24,0],[.99,1.17],[-.99,1.17]],.02,trim,0);
  windowShape([[-1.18,.055],[1.18,.055],[.943,1.115],[-.943,1.115]],.012,glass,.027);
  return {root,windscreen,wheels,paint};
}
