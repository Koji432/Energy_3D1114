import * as THREE from '../vendor/three.module.js';
const TAU = Math.PI * 2;
export const bicycleGears = [34, 21, 14];
const clamp = THREE.MathUtils.clamp;

export function createBicycle() {
  const root = new THREE.Group();
  const mat = (color, metalness = .25) => new THREE.MeshStandardMaterial({ color, metalness, roughness: .38 });
  const teal = mat(0x28867e), steel = mat(0xb5c3cf, .65), rubber = mat(0x19252d, .05);
  const blue = mat(0x3873e6), amber = mat(0xef9a37), skin = mat(0xdba685, .02);
  const jersey = mat(0x8981c5, .02), shorts = mat(0x374257, .02), shoes = mat(0xf4eee5, .02);
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z); parent.add(part); return part;
  }
  function positionBar(part, start, end) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    part.position.copy(a).lerp(b, .5);
    part.scale.y = a.distanceTo(b);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  }
  function bar(parent, a, b, r, material) {
    const part = mesh(parent, new THREE.CylinderGeometry(r, r, 1, 16), material);
    positionBar(part, a, b); return part;
  }
  function disc(parent, r, depth, material, x = 0, y = 0, z = 0) {
    const part = mesh(parent, new THREE.CylinderGeometry(r, r, depth, 48), material, x, y, z);
    part.rotation.x = Math.PI / 2; return part;
  }
  function ring(parent, r, width, material, x = 0, y = 0, z = 0) {
    return mesh(parent, new THREE.TorusGeometry(r, width, 10, 72), material, x, y, z);
  }
  const wheels = [-2.35, 2.35].map(x => {
    const wheel = new THREE.Group(); wheel.position.set(x, 1.24, 0); root.add(wheel);
    ring(wheel, 1.13, .10, rubber); ring(wheel, 1.055, .027, steel);
    disc(wheel, .14, .38, steel);
    for (let i = 0; i < 24; i++) {
      const a = i * TAU / 24;
      bar(wheel, [0, 0, i % 2 ? .12 : -.12], [1.05 * Math.cos(a), 1.05 * Math.sin(a), 0], .012, steel);
    }
    mesh(wheel, new THREE.BoxGeometry(.09, .24, .04), amber, .78, .32, .02);
    return wheel;
  });
  const crankPoint = [-.25, .88, .24], rear = [-2.35, 1.24, 0], seat = [-.78, 2.75, 0], head = [1.60, 2.7, 0];
  const bottom = [-.25, .88, 0];
  for (const [a, b] of [[bottom, seat], [seat, head], [head, bottom], [rear, seat], [rear, bottom]]) bar(root, a, b, .075, teal);
  bar(root, [1.60, 2.70, 0], [1.82, 2.25, 0], .10, teal);
  for (const z of [-.13, .13]) bar(root, [1.82, 2.25, z], [2.35, 1.24, z], .055, steel);
  bar(root, seat, [-.90, 3.05, 0], .05, steel);
  mesh(root, new THREE.BoxGeometry(.74, .13, .34), rubber, -.92, 3.07, 0);
  bar(root, head, [1.42, 3.06, 0], .05, steel);
  bar(root, [1.42, 3.06, -.45], [1.42, 3.06, .45], .045, steel);
  for (const z of [-.45, .45]) bar(root, [1.42, 3.06, z], [1.18, 3.09, z], .07, rubber);
  const crank = new THREE.Group(); crank.position.set(...crankPoint); root.add(crank);
  disc(crank, .11, .18, steel);
  for (const sign of [-1, 1]) {
    const z = sign > 0 ? .25 : -.56;
    bar(crank, [0, 0, z], [sign * .60, 0, z], .055, amber);
    const pedal = mesh(crank, new THREE.BoxGeometry(.24, .11, .26), rubber, sign * .60, 0, z);
    pedal.userData.counterRotate = true;
  }
  function gear(parent, r, teeth, z) {
    const g = new THREE.Group(); g.position.z = z; parent.add(g);
    disc(g, r - .028, .05, blue);
    for (let i = 0; i < teeth; i++) {
      const a = i * TAU / teeth;
      const tooth = mesh(g, new THREE.BoxGeometry(.05, .055, .065), blue, r * Math.cos(a), r * Math.sin(a), 0);
      tooth.rotation.z = a;
    }
    disc(g, .075, .075, steel);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5;
      disc(g, r * .14, .056, rubber, r * .58 * Math.cos(a), r * .58 * Math.sin(a), .001);
    }
    g.traverse(part => { if (part.material === blue) part.userData.sprocket = true; });
    return g;
  }
  gear(crank, .50, 42, 0);
  const cassette = new THREE.Group(); cassette.position.set(-2.35, 1.24, .27); root.add(cassette);
  const sprocketMaterials = bicycleGears.map(() => steel.clone());
  const rearGears = bicycleGears.map((teeth, i) => {
    const g = gear(cassette, teeth / 42 * .50, teeth, i * .105);
    g.traverse(part => { if (part.userData.sprocket) part.material = sprocketMaterials[i]; });
    return g;
  });
  const derailleur = new THREE.Group(); root.add(derailleur);
  const cage = bar(derailleur, [0, 0, 0], [.22, -.35, 0], .035, steel);
  const guidePulley = gear(derailleur, .105, 10, 0);
  const tensionPulley = gear(derailleur, .105, 10, 0);
  const chainMaterial = mat(0x6a7a87, .65);
  const links = Array.from({ length: 100 }, () => mesh(root, new THREE.BoxGeometry(.070, .035, .055), chainMaterial));
  const chainMarkers = [0, 25, 50, 75];
  for (const i of chainMarkers) links[i].material = amber;

  // A rider's feet stay attached to the pedals; the knees solve two fixed-length bones.
  const rider = new THREE.Group(); root.add(rider);
  const torso = bar(rider, [-.8, 3.12, 0], [.2, 3.94, 0], .245, jersey);
  const pelvis = mesh(rider, new THREE.SphereGeometry(.27, 24, 16), shorts, -.8, 3.12, 0);
  pelvis.scale.set(1.1, .7, 1.1);
  const neck = bar(rider, [.2, 3.94, 0], [.45, 4.25, 0], .10, skin);
  const riderHead = new THREE.Group(); rider.add(riderHead);
  const face = mesh(riderHead, new THREE.SphereGeometry(.235, 24, 16), skin);
  face.scale.set(.88, 1.12, .94);
  mesh(riderHead, new THREE.SphereGeometry(.06, 16, 12), skin, .205, -.015, 0);
  mesh(riderHead, new THREE.SphereGeometry(.265, 24, 16, 0, TAU, 0, Math.PI / 2), teal, 0, .02, 0);
  const limbs = [-1, 1].map(sign => {
    const z = sign > 0 ? .49 : -.32;
    return {
      sign, z,
      thigh: bar(rider, [0, 0, 0], [0, 1, 0], .135, shorts),
      shin: bar(rider, [0, 0, 0], [0, 1, 0], .095, skin),
      shoe: mesh(rider, new THREE.BoxGeometry(.38, .15, .20), shoes),
      upperArm: bar(rider, [0, 0, 0], [0, 1, 0], .10, jersey),
      forearm: bar(rider, [0, 0, 0], [0, 1, 0], .075, skin),
    };
  });
  const road = mesh(root, new THREE.BoxGeometry(20, .055, 2.7), mat(0x8b9ba9, .02), 0, -.04, 0);
  road.name = 'moving-road';
  const roadMarks = Array.from({ length: 11 }, (_, i) => {
    const part = mesh(root, new THREE.BoxGeometry(.80, .012, .13), shoes, i * 2 - 10, -.003, 1.04);
    return part;
  });

  let selected = 0, gearPosition = 0, shiftFrom = 0, shiftDistance = 0, changing = false;
  let lastTurn = 0, wheelTurn = 0, chainTravel = 0, ratio = 42 / 34, inspectionWeight = 0, inspectionHold = 0;
  let inspectionEnabled = true;
  let path, pathLength, previousPosition = -1;
  function teethAt(position) {
    const lo = Math.floor(position), hi = Math.min(2, lo + 1);
    return THREE.MathUtils.lerp(bicycleGears[lo], bicycleGears[hi], position - lo);
  }
  function chainPath() {
    const rearRadius = teethAt(gearPosition) / 42 * .50 + .02;
    const rearZ = .27 + gearPosition * .105;
    const lowerY = .32 + (rearRadius - .18) * .5;
    derailleur.position.set(-2.34, .70, rearZ);
    tensionPulley.position.set(.24, lowerY - .70, 0);
    positionBar(cage, [0, 0, 0], [.24, lowerY - .70, 0]);
    const circles = [
      { x: -.25, y: .88, z: .24, r: .52 },
      { x: -2.35, y: 1.24, z: rearZ, r: rearRadius },
      { x: -2.10, y: lowerY, z: rearZ, r: .125 },
    ];
    const pts = [];
    for (let i = 0; i < 200; i++) {
      const a = i * TAU / 200, dx = Math.cos(a), dy = Math.sin(a);
      const c = circles.reduce((best, item) => item.x * dx + item.y * dy + item.r > best.x * dx + best.y * dy + best.r ? item : best);
      pts.push(new THREE.Vector3(c.x + c.r * dx, c.y + c.r * dy, c.z));
    }
    pts.push(pts[0].clone()); path = new THREE.CurvePath();
    for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
    pathLength = path.getLength(); previousPosition = gearPosition;
  }
  function setGear(index, animate = true) {
    if (!Number.isInteger(index) || index < 0 || index > 2 || (index === selected && animate)) return;
    selected = index; shiftFrom = gearPosition; shiftDistance = 0;
    inspectionEnabled = true;
    changing = animate && Math.abs(gearPosition - index) > .001;
    if (!changing) { gearPosition = index; ratio = 42 / teethAt(gearPosition); }
    inspectionHold = changing ? 1 : 0;
  }
  return {
    root, camera: [1.3, 3.9, 10.8], target: [0, 2.25, 0], drivePoint: crankPoint, fitAspect: 1.16,
    get dragResistance() { return ratio / (42 / 34); },
    get ratio() { return ratio; },
    get targetRatio() { return 42 / bicycleGears[selected]; },
    get shifting() { return changing; },
    get inspection() { return { weight: inspectionWeight, camera: [-.5, 2.6, 5.5], target: [-1.35, 1.05, .25] }; },
    setGear,
    cancelInspection() { inspectionEnabled = false; inspectionWeight = 0; inspectionHold = 0; },
    reset() { lastTurn = 0; wheelTurn = 0; chainTravel = 0; changing = false; gearPosition = selected; inspectionHold = 0; inspectionWeight = 0; ratio = 42 / teethAt(gearPosition); },
    update(turn, _spread = 0, _focus = null, _extraction = 0, delta = 0) {
      const advance = turn - lastTurn;
      if (changing) {
        shiftDistance += Math.abs(advance);
        const phase = clamp(shiftDistance / .65, 0, 1);
        gearPosition = THREE.MathUtils.lerp(shiftFrom, selected, THREE.MathUtils.smoothstep(phase, .1, .9));
        if (phase >= 1) { changing = false; gearPosition = selected; inspectionHold = .55; }
      } else inspectionHold = Math.max(0, inspectionHold - delta);
      inspectionWeight = THREE.MathUtils.damp(inspectionWeight, Number(inspectionEnabled && (changing || inspectionHold > 0)), 5, delta);
      const nextRatio = 42 / teethAt(gearPosition);
      wheelTurn += advance * (ratio + nextRatio) / 2;
      ratio = nextRatio; lastTurn = turn; chainTravel += advance * TAU * .52;
      if (Math.abs(previousPosition - gearPosition) > .00001) chainPath();
      const angle = -turn * TAU;
      crank.rotation.z = angle;
      crank.children.forEach(part => { if (part.userData.counterRotate) part.rotation.z = -angle; });
      wheels.forEach(wheel => { wheel.rotation.z = -wheelTurn * TAU; });
      cassette.rotation.z = -wheelTurn * TAU;
      guidePulley.rotation.z = tensionPulley.rotation.z = -chainTravel / .105;
      sprocketMaterials.forEach((material, i) => {
        const active = Math.max(0, 1 - Math.abs(gearPosition - i));
        material.color.copy(steel.color).lerp(blue.color, active);
        material.emissive.copy(blue.color).multiplyScalar(changing && selected === i ? .14 : 0);
      });
      links.forEach((link, i) => {
        const t = ((i / links.length - chainTravel / pathLength) % 1 + 1) % 1;
        link.position.copy(path.getPointAt(t));
        const tangent = path.getTangentAt(t);
        link.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent.normalize());
      });
      const effort = ratio / (42 / 34) - 1;
      const sway = Math.sin(angle * 2) * .035 * effort;
      const hip = [-.80, 3.13 + Math.abs(sway), 0];
      const shoulder = [.20 + .13 * effort + sway, 3.95 - .10 * effort, Math.sin(angle) * .035 * effort];
      positionBar(torso, hip, shoulder); pelvis.position.set(...hip);
      const headPosition = [shoulder[0] + .26, shoulder[1] + .32, shoulder[2]];
      positionBar(neck, shoulder, headPosition); riderHead.position.set(...headPosition);
      for (const limb of limbs) {
        const phase = angle + (limb.sign < 0 ? Math.PI : 0);
        const foot = [-.25 + .60 * Math.cos(phase), .88 + .60 * Math.sin(phase), limb.z];
        const h = [hip[0], hip[1], limb.z];
        const dx = foot[0] - h[0], dy = foot[1] - h[1], distance = Math.hypot(dx, dy);
        const upper = 1.48, lower = 1.48;
        const along = (upper ** 2 - lower ** 2 + distance ** 2) / (2 * distance);
        const bend = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
        const knee = [h[0] + along * dx / distance - bend * dy / distance, h[1] + along * dy / distance + bend * dx / distance, limb.z];
        positionBar(limb.thigh, h, knee); positionBar(limb.shin, knee, foot);
        limb.shoe.position.set(foot[0] + .08, foot[1] + .10, limb.z);
        const armStart = [shoulder[0], shoulder[1], limb.sign * .23];
        const hand = [1.23, 3.09, limb.sign * .45];
        const elbow = [(armStart[0] + hand[0]) / 2 + .03, (armStart[1] + hand[1]) / 2 - .19, limb.sign * .38];
        positionBar(limb.upperArm, armStart, elbow); positionBar(limb.forearm, elbow, hand);
      }
      const roadTravel = wheelTurn * TAU * 1.13;
      roadMarks.forEach((mark, i) => { mark.position.x = ((i * 2 - roadTravel) % 22 + 22) % 22 - 11; });
    },
  };
}
