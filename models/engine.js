import * as THREE from '../vendor/three.module.js';

const TAU = Math.PI * 2;
const Y = new THREE.Vector3(0, 1, 0);
const surface = (color, metalness = .45, roughness = .33) => new THREE.MeshStandardMaterial({ color, metalness, roughness });

function add(parent, geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function group(parent, position = [0, 0, 0]) {
  const result = new THREE.Group();
  result.position.set(...position);
  parent.add(result);
  return result;
}
function box(parent, size, finish, position) {
  return add(parent, new THREE.BoxGeometry(...size), finish, position);
}
function cylinder(parent, radius, length, finish, position, axis = 'y', segments = 48) {
  const result = add(parent, new THREE.CylinderGeometry(radius, radius, length, segments), finish, position);
  if (axis === 'x') result.rotation.z = -Math.PI / 2;
  if (axis === 'z') result.rotation.x = Math.PI / 2;
  return result;
}
function rod(parent, radius, finish) {
  return cylinder(parent, radius, 1, finish, [0, 0, 0]);
}
function connect(part, start, end) {
  part.position.copy(start).lerp(end, .5);
  part.scale.y = start.distanceTo(end);
  part.quaternion.setFromUnitVectors(Y, end.clone().sub(start).normalize());
}
function tube(parent, points, radius, finish) {
  return add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 40, radius, 10), finish);
}
function ring(parent, radius, thickness, finish, position, axis = 'y') {
  const part = add(parent, new THREE.TorusGeometry(radius, thickness, 10, 56), finish, position);
  if (axis === 'y') part.rotation.x = Math.PI / 2;
  if (axis === 'x') part.rotation.y = Math.PI / 2;
  return part;
}
function sprocket(parent, radius, teeth, finish, steel, position) {
  const wheel = group(parent, position);
  cylinder(wheel, radius - .055, .16, finish, [0, 0, 0], 'x');
  for (let i = 0; i < teeth; i++) {
    const a = i * TAU / teeth;
    const tooth = box(wheel, [.17, .11, .09], finish, [0, radius * Math.cos(a), radius * Math.sin(a)]);
    tooth.rotation.x = a;
  }
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    cylinder(wheel, radius * .17, .175, steel, [0, radius * .56 * Math.cos(a), radius * .56 * Math.sin(a)], 'x');
  }
  cylinder(wheel, .16, .26, steel, [0, 0, 0], 'x');
  return wheel;
}

// The chain wraps the convex envelope of three pitch circles. Line segments
// between selected circle arcs are the external tangents.
function chainTrack(circles) {
  const points = [];
  for (let i = 0; i < 360; i++) {
    const a = i * TAU / 360;
    const dy = Math.cos(a);
    const dz = Math.sin(a);
    const circle = circles.reduce((best, c) =>
      c.y * dy + c.z * dz + c.radius > best.y * dy + best.z * dz + best.radius ? c : best);
    points.push(new THREE.Vector3(0, circle.y + circle.radius * dy, circle.z + circle.radius * dz));
  }
  points.push(points[0].clone());
  const path = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
  return path;
}

export function createEngine() {
  const root = new THREE.Group();
  const silver = surface(0xbac3cc, .65, .3);
  const cast = surface(0x6c7883, .55, .46);
  const graphite = surface(0x29333d, .44, .4);
  const dark = surface(0x151c23, .1, .66);
  const blue = surface(0x3873e6, .42, .3);
  const amber = surface(0xef9a37, .42, .31);
  const violet = surface(0x9c63e9, .42, .3);
  const steel = surface(0x87939f, .72, .26);
  const ceramic = surface(0xf1f3eb, .09, .37);
  const intakeColor = new THREE.Color(0x5fd4ed);
  const fireColor = new THREE.Color(0xff9c29);
  const exhaustColor = new THREE.Color(0x9fabb6);
  const clear = new THREE.MeshPhysicalMaterial({ color: 0xb5d1df, metalness: .08, roughness: .17,
    transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide });
  const housing = group(root);
  const timing = group(root);
  const lower = group(root);
  const upper = group(root);
  const head = group(housing);
  const crankY = 1.10;
  const camY = 5.18;
  const throwRadius = .48;
  const rodLength = 2.03;
  const bores = [-2.13, -.71, .71, 2.13];
  const phases = [0, Math.PI, Math.PI, 0];
  // Firing order 1-3-4-2. Each cylinder completes a cycle in two crank turns.
  const cycleOffsets = [0, Math.PI, 3 * Math.PI, 2 * Math.PI];

  box(housing, [6.1, .35, 1.8], graphite, [0, .31, 0]);
  box(housing, [5.65, .22, 1.48], cast, [0, .11, 0]);
  for (let i = 0; i < 12; i++) box(housing, [.11, .12, 1.61], graphite, [-2.7 + i * .49, .18, 0]);
  for (const z of [-.95, .95]) {
    box(housing, [6.1, .15, .16], silver, [0, .59, z]);
    box(housing, [6.1, .18, .17], silver, [0, 2.23, z]);
    box(head, [6.1, .18, .20], silver, [0, 4.15, z]);
    for (let i = 0; i < 10; i++) cylinder(housing, .062, .10, steel, [-2.77 + i * .615, .71, z], 'y', 6);
  }
  // Cutaway front face and translucent bores expose the crank and piston train.
  box(housing, [6.05, 1.55, .13], cast, [0, 1.43, -.92]);
  box(housing, [6.05, 1.45, .045], clear, [0, 3.03, .96]);
  for (const x of [-3.02, 3.02]) {
    box(housing, [.17, 3.25, 1.85], clear, [x, 2.23, 0]);
    box(housing, [.20, .23, 1.85], cast, [x, 2.19, 0]);
    box(head, [.20, .2, 1.85], cast, [x, 4.15, 0]);
  }
  for (const x of [-2.85, -1.42, 0, 1.42, 2.85]) {
    cylinder(housing, .24, .18, silver, [x, crankY, 0], 'x');
    box(housing, [.16, .44, .50], cast, [x, .85, 0]);
  }

  const crank = group(lower, [0, crankY, 0]);
  crank.name = 'crankshaft';
  cylinder(crank, .15, 6.65, amber, [0, 0, 0], 'x');
  const cylinders = [];
  const valves = [];
  const camshafts = [-.62, .62].map(z => {
    const shaft = group(upper, [0, camY, z]);
    shaft.name = z < 0 ? 'intake-camshaft' : 'exhaust-camshaft';
    cylinder(shaft, .105, 6.58, violet, [0, 0, 0], 'x');
    // An off-axis stripe makes shaft rotation visible even between the lobes.
    box(shaft, [6.25, .028, .035], ceramic, [0, .11, 0]);
    return shaft;
  });

  const profile = [];
  const lobeShape = new THREE.Shape();
  for (let i = 0; i <= 100; i++) {
    const a = i * TAU / 100;
    const r = .225 + .23 * Math.max(0, Math.cos(a)) ** 4;
    const y = r * Math.cos(a);
    const z = r * Math.sin(a);
    profile.push([y, z]);
    if (i === 0) lobeShape.moveTo(y, z); else lobeShape.lineTo(y, z);
  }
  const lobeGeometry = new THREE.ExtrudeGeometry(lobeShape, { depth: .17, bevelEnabled: true,
    bevelThickness: .012, bevelSize: .012, bevelSegments: 2, steps: 1 });
  // Shape x/y become engine y/z, extrusion z becomes engine x.
  lobeGeometry.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, -.085, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  const springCurve = new THREE.CatmullRomCurve3(Array.from({ length: 97 }, (_, i) => {
    const t = i / 96;
    return new THREE.Vector3(.13 * Math.cos(8 * TAU * t), t, .13 * Math.sin(8 * TAU * t));
  }));
  const springGeometry = new THREE.TubeGeometry(springCurve, 96, .019, 6);

  bores.forEach((x, i) => {
    const phase = phases[i];
    for (const dx of [-.31, .31]) {
      const weight = group(crank, [x + dx, 0, 0]);
      weight.rotation.x = phase;
      box(weight, [.13, .62, .38], amber, [0, .23, 0]);
      cylinder(weight, .34, .14, steel, [0, -.20, 0], 'x');
    }
    cylinder(crank, .14, .67, steel,
      [x, throwRadius * Math.cos(phase), throwRadius * Math.sin(phase)], 'x');
    const piston = group(lower, [x, 0, 0]);
    piston.name = `piston-${i + 1}`;
    cylinder(piston, .49, .61, silver, [0, .11, 0]);
    cylinder(piston, .45, .016, graphite, [0, .422, 0]);
    for (const y of [.25, .32, .39]) ring(piston, .486, .016, steel, [0, y, 0]);
    cylinder(piston, .12, 1.03, steel, [0, -.04, 0], 'x');
    const connection = rod(lower, .105, amber);
    const bigEnd = cylinder(lower, .22, .25, amber, [x, 0, 0], 'x');
    cylinder(piston, .19, .23, amber, [0, -.04, 0], 'x');
    const bore = add(housing, new THREE.CylinderGeometry(.525, .525, 1.67, 48, 1, true), clear, [x, 3.33, 0]);
    ring(housing, .535, .037, silver, [x, 4.15, 0]);
    ring(housing, .535, .028, cast, [x, 2.50, 0]);
    // The gas occupies only the space above the piston, expanding with the
    // power stroke rather than flashing as an unrelated fixed cylinder.
    const combustion = add(lower, new THREE.CylinderGeometry(.455, .455, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0xffaa41, transparent: true, opacity: 0, depthWrite: false }), [x, 3.99, 0]);
    combustion.userData.dynamicOpacity = true;
    const spark = add(head, new THREE.SphereGeometry(.10, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff1a9, transparent: true, opacity: 0, depthWrite: false }), [x, 4.09, 0]);
    const loadGlow = add(lower, new THREE.SphereGeometry(.10, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdf86, transparent: true, opacity: .85, depthWrite: false }));
    const flows = [-1, 1].map(sign => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x + .15, 3.77, sign * 1.37),
        new THREE.Vector3(x, 4.04, sign * .90),
        new THREE.Vector3(x, 4.05, sign * .30),
        new THREE.Vector3(x, 3.92, sign * .15),
      ]);
      const material = new THREE.MeshBasicMaterial({ color: sign < 0 ? intakeColor : exhaustColor, transparent: true, opacity: .9, depthWrite: false });
      return { curve, particles: Array.from({ length: 4 }, () => add(head, new THREE.SphereGeometry(.055, 8, 6), material)) };
    });
    cylinders.push({ piston, connection, bigEnd, x, phase, combustion, bore, spark, loadGlow, flows });

    for (const [side, z] of [-.62, .62].entries()) {
      const lobe = group(camshafts[side], [x, 0, 0]);
      add(lobe, lobeGeometry, violet);
      const desired = (side === 0 ? Math.PI / 2 : 7 * Math.PI / 2) / 2;
      lobe.rotation.x = Math.PI - desired + cycleOffsets[i] / 2;
      const sign = Math.sign(z);
      const valveZ = sign * .30;
      const valve = group(upper, [x, 0, valveZ]);
      const rocker = group(upper, [x, 4.90, sign * 1.02]);
      box(rocker, [.14, .09, .79], amber, [0, 0, -sign * .38]);
      cylinder(rocker, .075, .18, steel, [0, 0, 0], 'x');
      cylinder(rocker, .075, .18, steel, [0, .055, -sign * .40], 'x');
      cylinder(valve, .053, .77, steel, [0, -.39, 0]);
      cylinder(valve, .19, .045, silver, [0, -.79, 0]);
      cylinder(valve, .18, .075, graphite, [0, -.015, 0]);
      cylinder(valve, .17, .045, silver, [0, -.13, 0]);
      const spring = add(upper, springGeometry, steel, [x, 4.20, valveZ]);
      cylinder(head, .16, .10, cast, [x, 4.20, valveZ]);
      valves.push({ valve, spring, lobe, rocker, sign, cylinder: i, side });
      // Port runners lead from the cylinder head to the manifolds.
      tube(head, [[x, 4.05, z], [x, 4.03, z * 1.9], [x + .15, 3.77, z * 2.2]], .13, side ? steel : graphite);
    }
    // Spark plug and insulated coil boot.
    cylinder(head, .075, .30, ceramic, [x, 4.55, 0]);
    cylinder(head, .095, .13, steel, [x, 4.36, 0], 'y', 6);
    box(head, [.34, .19, .28], graphite, [x, 4.78, 0]);
  });
  for (const shaftZ of [-.62, .62]) {
    for (const x of [-2.85, -1.42, 0, 1.42, 2.85]) {
      cylinder(head, .18, .16, silver, [x, camY, shaftZ], 'x');
      for (const z of [shaftZ - .22, shaftZ + .22]) cylinder(head, .045, .13, steel, [x, 5.29, z], 'y', 6);
    }
  }
  tube(head, [[-2.8, 3.76, -1.37], [0, 3.73, -1.49], [2.8, 3.76, -1.37]], .20, graphite);
  tube(head, [[-2.8, 3.76, 1.37], [0, 3.60, 1.52], [2.8, 3.76, 1.37]], .18, steel);
  const cover = box(head, [6.15, .12, 1.9], clear, [0, 5.53, 0]);
  for (let i = 0; i < 8; i++) box(head, [.15, .035, 1.75], cast, [-2.9 + i * .83, 5.60, 0]);

  const gearX = -3.38;
  const pitch = .30;
  const small = sprocket(timing, pitch, 20, blue, graphite, [gearX, crankY, 0]);
  small.name = 'crank-timing-sprocket';
  const big = [-.62, .62].map(z => sprocket(timing, pitch * 2, 40, blue, graphite, [gearX, camY, z]));
  for (const z of [-.62, .62]) cylinder(upper, .085, .50, violet, [-3.2, camY, z], 'x');
  const track = chainTrack([{ y: crankY, z: 0, radius: pitch + .06 },
    { y: camY, z: -.62, radius: pitch * 2 + .06 }, { y: camY, z: .62, radius: pitch * 2 + .06 }]);
  const trackLength = track.getLength();
  const chainLinks = [];
  const linkCount = Math.round(trackLength / .15);
  for (let i = 0; i < linkCount; i++) {
    const link = group(timing);
    box(link, [.12, .15, .06], blue, [0, 0, 0]);
    cylinder(link, .042, .19, silver, [0, 0, 0], 'x', 10);
    chainLinks.push(link);
  }
  const flywheel = group(lower, [3.43, crankY, 0]);
  flywheel.name = 'output-flywheel';
  cylinder(flywheel, .78, .18, steel, [0, 0, 0], 'x');
  cylinder(flywheel, .58, .21, graphite, [0, 0, 0], 'x');
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    cylinder(flywheel, .045, .25, silver, [0, .46 * Math.cos(a), .46 * Math.sin(a)], 'x', 6);
    const spoke = box(flywheel, [.24, .40, .07], amber, [0, .36 * Math.cos(a), .36 * Math.sin(a)]);
    spoke.rotation.x = a;
  }
  const accessory = group(housing, [3.05, 2.0, -1.1]);
  cylinder(accessory, .37, .64, silver, [0, 0, 0], 'x');
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    box(accessory, [.61, .035, .07], graphite, [0, .34 * Math.cos(a), .34 * Math.sin(a)]);
  }

  const sets = { gears: timing, linkage: lower, cam: upper };
  // Clone individual materials once so focus tinting cannot leak between models.
  for (const object of Object.values(sets)) object.traverse(part => {
    if (!part.material) return;
    part.material = part.material.clone();
    part.userData.baseOpacity = part.material.opacity;
    part.userData.baseTransparent = part.material.transparent;
    part.userData.baseDepthWrite = part.material.depthWrite;
  });
  let lastFocus;
  const labels = { gears: group(timing, [gearX, 4.6, 1.4]),
    linkage: group(lower, [.71, 2.0, .45]), cam: group(upper, [1.6, camY, .62]) };
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const cycle = Array(4).fill(0);
  const activeLift = Array.from({ length: 4 }, () => [0, 0]);
  return {
    root, labels, camera: [-8.6, 6.8, 10.2], target: [0, 2.85, 0],
    explodedCamera: [-13.5, 10.8, 16.6], explodedTarget: [0, 3.0, 0],
    update(turn, explode = 0, focus = null) {
      const angle = turn * TAU;
      crank.rotation.x = angle;
      flywheel.rotation.x = angle;
      small.rotation.x = angle;
      big.forEach(wheel => { wheel.rotation.x = angle / 2; });
      camshafts.forEach(shaft => { shaft.rotation.x = angle / 2; });
      cylinders.forEach((part, i) => {
        const a = angle + part.phase;
        const pinY = crankY + throwRadius * Math.cos(a);
        const pinZ = throwRadius * Math.sin(a);
        const pistonY = pinY + Math.sqrt(rodLength ** 2 - pinZ ** 2);
        part.piston.position.y = pistonY + .04;
        start.set(part.x, pinY, pinZ);
        end.set(part.x, pistonY, 0);
        connect(part.connection, start, end);
        part.bigEnd.position.set(part.x, pinY, pinZ);
        cycle[i] = ((angle + cycleOffsets[i]) % (2 * TAU) + 2 * TAU) % (2 * TAU);
        const stroke = Math.floor(cycle[i] / Math.PI);
        const progress = cycle[i] / Math.PI - stroke;
        const power = stroke === 2 ? Math.sin(progress * Math.PI) : 0;
        const ignition = Math.max(0, 1 - Math.abs(cycle[i] - TAU - .07) / .18);
        const crown = pistonY + .462;
        const chamberHeight = Math.max(.018, 4.10 - crown);
        part.combustion.position.y = crown + chamberHeight / 2;
        part.combustion.scale.y = chamberHeight;
        part.combustion.material.color.copy(stroke < 2 ? intakeColor : stroke === 2 ? fireColor : exhaustColor);
        part.combustion.material.opacity = explode > .1 ? 0 : stroke === 2 ? .25 + .35 * (1 - progress) : .13;
        part.spark.material.opacity = ignition;
        part.spark.scale.setScalar(.7 + ignition * 1.5);
        part.connection.material.emissive.setHex(0xa4490a);
        part.connection.material.emissiveIntensity = power * .9;
        part.bigEnd.material.emissive.setHex(0xa4490a);
        part.bigEnd.material.emissiveIntensity = power * .9;
        part.loadGlow.visible = stroke === 2 && explode < .1;
        part.loadGlow.position.copy(end).lerp(start, progress);
        part.loadGlow.scale.setScalar(.7 + power * .65);
      });
      valves.forEach(({ valve, spring, lobe, rocker, sign, cylinder: cylinderIndex, side }) => {
        const a = angle / 2 + lobe.rotation.x;
        let lowest = Infinity;
        for (const [y, z] of profile) lowest = Math.min(lowest, y * Math.cos(a) - z * Math.sin(a));
        const lift = Math.max(0, -lowest - .225);
        activeLift[cylinderIndex][side] = lift;
        rocker.rotation.x = -sign * Math.asin(Math.min(.95, lift / .40));
        valve.position.y = 4.90 - lift * .72 / .40;
        spring.scale.y = Math.max(.10, valve.position.y - .17 - 4.20);
        lobe.children[0].material.emissive.setHex(0x7131af);
        lobe.children[0].material.emissiveIntensity = lift * 3;
        rocker.children[0].material.emissive.setHex(0xa4490a);
        rocker.children[0].material.emissiveIntensity = lift * 2;
      });
      cylinders.forEach((part, i) => part.flows.forEach((flow, side) => {
        const open = activeLift[i][side] > .012 && explode < .1;
        flow.particles.forEach((particle, j) => {
          particle.visible = open;
          const travel = ((cycle[i] * 1.5 + j / flow.particles.length) % 1 + 1) % 1;
          particle.position.copy(flow.curve.getPoint(side === 0 ? travel : 1 - travel));
        });
      }));
      for (const [i, link] of chainLinks.entries()) {
        const progress = ((i / linkCount + angle * (pitch + .06) / trackLength) % 1 + 1) % 1;
        const point = track.getPointAt(progress);
        const tangent = track.getTangentAt(progress);
        link.position.set(gearX, point.y, point.z);
        link.rotation.x = Math.atan2(tangent.z, tangent.y);
        // Permanent lighter links can be followed from crank to both cams.
        link.children[0].material.emissive.setHex(0x719fff);
        link.children[0].material.emissiveIntensity = i % 11 < 2 ? .8 : 0;
      }
      timing.position.x = -2.0 * explode;
      lower.position.y = -.2 * explode;
      lower.position.z = 1.6 * explode;
      upper.position.y = 1.65 * explode;
      housing.position.z = -1.35 * explode;
      head.position.y = .7 * explode;
      cover.material.opacity = .11;
      if (focus !== lastFocus) {
        for (const [name, object] of Object.entries(sets)) object.traverse(part => {
          if (!part.material) return;
          const dim = focus && name !== focus;
          part.material.transparent = !!dim || part.userData.baseTransparent;
          if (!part.userData.dynamicOpacity) part.material.opacity = dim ? .46 : part.userData.baseOpacity;
          part.material.depthWrite = !dim && part.userData.baseDepthWrite;
        });
        lastFocus = focus;
      }
    },
  };
}
