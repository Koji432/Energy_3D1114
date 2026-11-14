import * as THREE from '../vendor/three.module.js';
const TAU = Math.PI * 2;
export const bicycleGears = [34,21,14];

export function createBicycle() {
  const root = new THREE.Group();
  const mat = (color,metalness=.25) => new THREE.MeshStandardMaterial({color,metalness,roughness:.38});
  const teal=mat(0x28867e), steel=mat(0xb5c3cf,.65), rubber=mat(0x19252d,.05), blue=mat(0x3873e6), amber=mat(0xef9a37);
  function mesh(parent,geometry,material,x=0,y=0,z=0) {
    const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);parent.add(part);return part;
  }
  function bar(parent,a,b,r,material) {
    const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b);
    const part=mesh(parent,new THREE.CylinderGeometry(r,r,start.distanceTo(end),16),material);
    part.position.copy(start).lerp(end,.5);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return part;
  }
  function disc(parent,r,depth,material,x=0,y=0,z=0) {
    const part=mesh(parent,new THREE.CylinderGeometry(r,r,depth,48),material,x,y,z);part.rotation.x=Math.PI/2;return part;
  }
  function ring(parent,r,width,material,x=0,y=0,z=0) {return mesh(parent,new THREE.TorusGeometry(r,width,10,72),material,x,y,z);}
  const wheels=[-2.35,2.35].map(x=>{
    const wheel=new THREE.Group();wheel.position.set(x,1.24,0);root.add(wheel);
    ring(wheel,1.13,.10,rubber);ring(wheel,1.055,.027,steel);
    disc(wheel,.14,.38,steel);
    for(let i=0;i<24;i++){
      const a=i*TAU/24;bar(wheel,[0,0,i%2?.12:-.12],[1.05*Math.cos(a),1.05*Math.sin(a),0],.012,steel);
    }
    mesh(wheel,new THREE.BoxGeometry(.09,.24,.04),amber,.78,.32,.02);
    return wheel;
  });
  const crankPoint=[-.25,.88,.24], rear=[-2.35,1.24,0], seat=[-.78,2.75,0], head=[1.60,2.7,0];
  const bottom=[-.25,.88,0];
  for(const [a,b] of [[bottom,seat],[seat,head],[head,bottom],[rear,seat],[rear,bottom]])bar(root,a,b,.075,teal);
  bar(root,[1.60,2.70,0],[1.82,2.25,0],.10,teal);
  for(const z of [-.13,.13])bar(root,[1.82,2.25,z],[2.35,1.24,z],.055,steel);
  bar(root,seat,[-.90,3.05,0],.05,steel);
  mesh(root,new THREE.BoxGeometry(.74,.13,.34),rubber,-.92,3.07,0);
  bar(root,head,[1.42,3.06,0],.05,steel);
  bar(root,[1.42,3.06,-.45],[1.42,3.06,.45],.045,steel);
  for(const z of [-.45,.45])bar(root,[1.42,3.06,z],[1.18,3.09,z],.07,rubber);
  const crank=new THREE.Group();crank.position.set(...crankPoint);root.add(crank);
  disc(crank,.11,.18,steel);
  for(const sign of [-1,1]) {
    bar(crank,[0,0,sign*.08],[sign*.60,0,sign*.08],.055,amber);
    const pedal=mesh(crank,new THREE.BoxGeometry(.24,.11,.30),rubber,sign*.60,0,sign*.18);
    pedal.userData.counterRotate=true;
  }
  function gear(parent,r,teeth,z) {
    const g=new THREE.Group();g.position.z=z;parent.add(g);
    disc(g,r-.028,.05,blue);
    for(let i=0;i<teeth;i++) {
      const a=i*TAU/teeth;
      const tooth=mesh(g,new THREE.BoxGeometry(.05,.055,.065),blue,r*Math.cos(a),r*Math.sin(a),0);tooth.rotation.z=a;
    }
    disc(g,.075,.075,steel);
    for(let i=0;i<5;i++) {
      const a=i*TAU/5;disc(g,r*.14,.056,rubber,r*.58*Math.cos(a),r*.58*Math.sin(a),.001);
    }
    g.traverse(part => { if (part.material === blue) part.userData.sprocket = true; });
    return g;
  }
  gear(crank,.50,42,0);
  const cassette=new THREE.Group();cassette.position.set(-2.35,1.24,.27);root.add(cassette);
  const rearGears=bicycleGears.map((teeth,i)=>gear(cassette,teeth/42*.50,teeth,i*.075));
  const derailleur=new THREE.Group();derailleur.position.set(-2.33,.63,.27);root.add(derailleur);
  bar(derailleur,[0,0,0],[.29,-.36,0],.04,steel);disc(derailleur,.11,.08,blue,.29,-.36,0);
  const chainMaterial=mat(0x596875,.65);
  const links=Array.from({length:90},()=>mesh(root,new THREE.BoxGeometry(.075,.035,.055),chainMaterial));
  let ratio=42/bicycleGears[0], lastTurn=0, wheelTurn=0, path, pathLength;
  function setGear(index) {
    ratio=42/bicycleGears[index];
    const circles=[{x:-.25,y:.88,z:.24,r:.52},{x:-2.35,y:1.24,z:.27+index*.075,r:bicycleGears[index]/42*.50+.02}];
    const pts=[];
    for(let i=0;i<180;i++){
      const a=i*TAU/180,dx=Math.cos(a),dy=Math.sin(a);
      const c=circles.reduce((best,c)=>c.x*dx+c.y*dy+c.r>best.x*dx+best.y*dy+best.r?c:best);
      pts.push(new THREE.Vector3(c.x+c.r*dx,c.y+c.r*dy,c.z));
    }
    pts.push(pts[0].clone());path=new THREE.CurvePath();
    for(let i=1;i<pts.length;i++)path.add(new THREE.LineCurve3(pts[i-1],pts[i]));
    pathLength=path.getLength();
    rearGears.forEach((g,i)=>g.traverse(part=>{
      if(part.userData.sprocket) part.material=i===index ? blue : steel;
    }));
  }
  setGear(0);
  return {
    root, camera:[1.6,3.8,11.6], target:[0,1.64,0],drivePoint:crankPoint,
    get dragResistance(){return ratio/(42/34);},
    get ratio(){return ratio;},
    setGear,
    reset(){lastTurn=0;wheelTurn=0;},
    update(turn) {
      wheelTurn+=(turn-lastTurn)*ratio;lastTurn=turn;
      const angle=-turn*TAU;
      crank.rotation.z=angle;
      crank.children.forEach(p=>{if(p.userData.counterRotate)p.rotation.z=-angle;});
      wheels.forEach(w=>{w.rotation.z=-wheelTurn*TAU;});
      cassette.rotation.z=-wheelTurn*TAU;
      links.forEach((link,i)=>{
        const t=((i/links.length-turn*TAU*.52/pathLength)%1+1)%1;
        link.position.copy(path.getPointAt(t));
        const tangent=path.getTangentAt(t);link.rotation.z=Math.atan2(tangent.y,tangent.x);
      });
    },
  };
}
