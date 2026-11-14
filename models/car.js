import * as THREE from '../vendor/three.module.js';

const TAU = 2 * Math.PI;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function material(color, metalness = 0.38, roughness = 0.38, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function mesh(parent, geometry, finish, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, finish);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, finish, size, position) {
  return mesh(parent, new THREE.BoxGeometry(...size), finish, position);
}

function cylinder(parent, finish, radius, length, position, axis = Z) {
  const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, length, 32), finish, position);
  object.quaternion.setFromUnitVectors(Y, axis);
  return object;
}

function torus(parent, finish, radius, tube, position, axis = Z) {
  const object = mesh(parent, new THREE.TorusGeometry(radius, tube, 12, 56), finish, position);
  object.quaternion.setFromUnitVectors(Z, axis);
  return object;
}

function bar(parent, finish, thickness) {
  return cylinder(parent, finish, thickness, 1, [0, 0, 0], Y);
}

function placeBar(object, from, to) {
  object.position.copy(from).lerp(to, 0.5);
  const direction = new THREE.Vector3().subVectors(to, from);
  object.scale.y = direction.length();
  object.quaternion.setFromUnitVectors(Y, direction.normalize());
}

function pill(parent, finish, radius, start, end) {
  const object = bar(parent, finish, radius);
  placeBar(object, new THREE.Vector3(...start), new THREE.Vector3(...end));
  return object;
}

function skin(parent, finish, vertices, depth, bevel) {
  const shape = new THREE.Shape();
  vertices.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return mesh(parent, new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSegments: 3, bevelSize: bevel, bevelThickness: bevel,
  }), finish);
}

function gearwheel(parent, blue, steel) {
  const rotor = new THREE.Group();
  parent.add(rotor);
  const outline = new THREE.Shape();
  const turns = 30;
  const radii = [0.45, 0.45, 0.52, 0.52, 0.45];
  const fractions = [0, 0.14, 0.31, 0.66, 0.84];
  for (let tooth = 0; tooth < turns; tooth++) {
    for (let edge = 0; edge < fractions.length; edge++) {
      const angle = TAU * (tooth + fractions[edge]) / turns;
      const point = [Math.cos(angle) * radii[edge], Math.sin(angle) * radii[edge]];
      if (tooth === 0 && edge === 0) outline.moveTo(...point);
      else outline.lineTo(...point);
    }
  }
  outline.closePath();
  for (let index = 0; index < 5; index++) {
    const angle = TAU * index / 5;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(angle) * 0.263, Math.sin(angle) * 0.263, 0.067, 0, TAU, true);
    outline.holes.push(hole);
  }
  const wheel = mesh(rotor, new THREE.ExtrudeGeometry(outline, {
    depth: 0.20, bevelEnabled: true, bevelSize: 0.011, bevelThickness: 0.011, bevelSegments: 2,
  }), blue, [0, 0, -0.1]);
  wheel.geometry.computeBoundingSphere();
  torus(rotor, blue, 0.367, 0.022, [0, 0, 0.116]);
  cylinder(rotor, steel, 0.111, 0.36, [0, 0, 0.009]);
  return rotor;
}

function addGearTrain(group, blue, steel, housing, centre) {
  const wheel = gearwheel(group, blue, steel);
  wheel.position.copy(centre);
  cylinder(wheel, steel, 0.055, 0.48, [0, 0, 0.25]);
  const worm = new THREE.Group();
  worm.position.copy(centre).add(new THREE.Vector3(-0.02, -0.594, 0));
  group.add(worm);
  cylinder(worm, blue, 0.101, 0.97, [0, 0, 0], X);
  const ridge = [];
  for (let index = 0; index <= 140; index++) {
    const t = index / 140;
    const angle = t * TAU * 5.7;
    ridge.push(new THREE.Vector3(-0.48 + 0.96 * t, 0.131 * Math.cos(angle), 0.131 * Math.sin(angle)));
  }
  const path = new THREE.CatmullRomCurve3(ridge);
  mesh(worm, new THREE.TubeGeometry(path, 144, 0.026, 8, false), blue);
  cylinder(group, housing, 0.222, 0.67, [centre.x - 0.84, worm.position.y, centre.z], X);
  for (const dx of [-1.13, -0.58]) {
    cylinder(group, steel, 0.228, 0.047, [centre.x + dx, worm.position.y, centre.z], X);
  }
  cylinder(group, steel, 0.064, 0.25, [centre.x - 0.55, worm.position.y, centre.z], X);
  return (angle) => {
    wheel.rotation.z = angle;
    worm.rotation.x = -angle * 30;
  };
}

function addCarBody(root, enamel, dark, steel, glass) {
  const body = new THREE.Group();
  root.add(body);
  const lower = box(body, dark, [5.21, 0.21, 3.92], [0, 0.44, -0.04]);
  lower.castShadow = false;
  const side = [
    [-2.07, 0.69], [-1.94, 1.31], [-1.48, 1.6], [-0.58, 1.6],
    [0.79, 1.67], [1.39, 1.48], [2.52, 1.12], [2.64, 0.63],
    [2.22, 0.58], [-1.97, 0.58],
  ];
  for (const sign of [-1, 1]) {
    const panel = skin(body, enamel, side, 0.31, 0.08);
    panel.position.x = sign * 2.41 + 0.155;
    panel.rotation.y = -Math.PI / 2;
    for (const axle of [-1.32, 1.87]) {
      const wheelCenter = [sign * 2.52, 0.68, axle];
      cylinder(body, dark, 0.65, 0.42, wheelCenter, X);
      torus(body, dark, 0.53, 0.107, [sign * 2.72, 0.68, axle], X);
      cylinder(body, steel, 0.35, 0.043, [sign * 2.75, 0.68, axle], X);
      torus(body, dark, 0.29, 0.024, [sign * 2.778, 0.68, axle], X);
      for (let index = 0; index < 5; index++) {
        const angle = TAU * index / 5;
        cylinder(body, dark, 0.041, 0.022,
          [sign * 2.781, 0.68 + Math.cos(angle) * 0.15, axle + Math.sin(angle) * 0.15], X);
      }
    }
    box(body, steel, [0.13, 0.065, 0.25], [sign * 2.6, 1.4, -0.63]);
  }
  box(body, enamel, [4.98, 0.54, 0.39], [0, 0.89, 2.42]);
  box(body, dark, [2.45, 0.33, 0.08], [0, 0.91, 2.65]);
  for (let index = 0; index < 4; index++) {
    box(body, steel, [2.05, 0.018, 0.014], [0, 0.81 + index * 0.051, 2.697]);
  }
  box(body, steel, [5.05, 0.11, 0.24], [0, 0.56, 2.55]);
  const lamp = material(0xffe4b1, 0.10, 0.22, { emissive: 0xffc67a, emissiveIntensity: 0.11 });
  for (const sign of [-1, 1]) {
    box(body, dark, [0.88, 0.35, 0.17], [sign * 1.87, 0.98, 2.548]);
    box(body, lamp, [0.74, 0.18, 0.14], [sign * 1.87, 1.015, 2.594]);
  }
  box(body, enamel, [4.89, 0.81, 0.41], [0, 0.96, -1.99]);

  const hood = box(body, enamel, [4.78, 0.15, 1.44], [0, 0.76, 1.77]);
  hood.rotation.x = -0.19;
  for (const sign of [-1, 1]) {
    const trim = box(body, steel, [0.033, 0.025, 1.16], [sign * 1.91, 0.86, 1.8]);
    trim.rotation.x = -0.19;
  }

  const canopy = new THREE.Group();
  canopy.position.set(0, 2.30, 0.72);
  canopy.rotation.x = -0.53;
  root.add(canopy);
  const bottomLeft = [-2.46, -0.05, -0.03];
  const bottomRight = [2.46, -0.05, -0.03];
  const topLeft = [-1.93, 1.91, -0.03];
  const topRight = [1.93, 1.91, -0.03];
  const panel = skin(canopy, glass, [bottomLeft, bottomRight, topRight, topLeft], 0.027, 0);
  panel.castShadow = false;
  panel.receiveShadow = false;
  for (const [from, to] of [
    [bottomLeft, topLeft], [topLeft, topRight], [topRight, bottomRight], [bottomRight, bottomLeft],
  ]) pill(canopy, enamel, 0.088, from, to);
  pill(canopy, steel, 0.026, [-2.45, 0.022, 0.017], [2.45, 0.022, 0.017]);
  pill(canopy, steel, 0.024, [-1.91, 1.86, 0.011], [1.91, 1.86, 0.011]);
  const roof = box(body, enamel, [3.99, 0.18, 1.14], [0, 3.947, -0.85]);
  roof.rotation.x = 0.026;
  for (const sign of [-1, 1]) {
    pill(body, enamel, 0.085, [sign * 1.91, 3.92, -1.40], [sign * 2.43, 1.64, -1.9]);
  }
  box(body, dark, [1.29, 0.60, 0.31], [-1.08, 1.58, -0.68]);
  box(body, dark, [1.24, 0.60, 0.31], [1.15, 1.58, -0.68]);
  box(body, dark, [4.44, 0.13, 0.15], [0, 1.46, 0.80]);
  for (const x of [-0.71, 0.86]) {
    box(body, steel, [0.19, 0.60, 0.11], [x, 1.82, 0.82]);
    cylinder(body, dark, 0.109, 0.076, [x, 2.28, 0.84]);
  }
  return { body, canopy };
}

function addLinkage(group, amber, dark, steel, centre) {
  const leftX = -0.71;
  const rightX = 0.86;
  const pivotY = 2.32;
  const linkageZ = centre.z + 0.49;
  const left = new THREE.Vector3(leftX, pivotY, linkageZ);
  const right = new THREE.Vector3(rightX, pivotY, linkageZ);
  const output = centre.clone();
  output.z = linkageZ;
  const crankPin = new THREE.Vector3();
  const leftPin = new THREE.Vector3();
  const rightPin = new THREE.Vector3();
  const pivotOffset = new THREE.Vector3(right.x - left.x, 0, 0);
  const crank = bar(group, amber, 0.091);
  const driveRod = bar(group, amber, 0.060);
  const tieRod = bar(group, amber, 0.058);
  const arms = [bar(group, amber, 0.075), bar(group, amber, 0.075)];
  const joints = [leftPin, rightPin, crankPin].map(() => cylinder(group, steel, 0.086, 0.19, [0, 0, 0]));
  cylinder(group, steel, 0.111, 0.18, output.toArray());
  const wipers = [left, right].map((pivot, index) => {
    cylinder(group, amber, 0.07, 0.66, [pivot.x, pivot.y, linkageZ - 0.33]);
    const slope = new THREE.Group();
    slope.position.set(pivot.x, 2.31, 0.79);
    slope.rotation.x = -0.53;
    group.add(slope);
    const blade = new THREE.Group();
    slope.add(blade);
    const length = index === 0 ? 1.34 : 1.15;
    pill(blade, dark, 0.052, [0, 0, 0], [length - 0.23, 0.028, 0]);
    pill(blade, steel, 0.021, [0.2, 0.012, 0.045], [length - 0.20, 0.03, 0.045]);
    const squeegee = box(blade, dark, [index === 0 ? 0.89 : 0.80, 0.089, 0.067], [length, 0.065, 0]);
    squeegee.rotation.z = 0.07;
    cylinder(blade, amber, 0.097, 0.09, [0, 0, 0]);
    return blade;
  });
  const crankRadius = 0.33;
  const rockerRadius = 0.45;
  const rodLength = 1.55;
  return (angle) => {
    crankPin.set(output.x + Math.cos(angle) * crankRadius,
      output.y + Math.sin(angle) * crankRadius, linkageZ);
    const dx = crankPin.x - left.x;
    const dy = crankPin.y - left.y;
    const distance = Math.hypot(dx, dy);
    const parallel = (distance ** 2 + rockerRadius ** 2 - rodLength ** 2) / (2 * distance);
    const across = Math.sqrt(Math.max(0, rockerRadius ** 2 - parallel ** 2));
    leftPin.set(left.x + (parallel * dx - across * dy) / distance,
      left.y + (parallel * dy + across * dx) / distance, linkageZ);
    rightPin.copy(leftPin).add(pivotOffset);
    placeBar(crank, output, crankPin);
    placeBar(driveRod, crankPin, leftPin);
    placeBar(tieRod, leftPin, rightPin);
    placeBar(arms[0], left, leftPin);
    placeBar(arms[1], right, rightPin);
    [leftPin, rightPin, crankPin].forEach((point, index) => joints[index].position.copy(point));
    const swing = Math.atan2(leftPin.y - left.y, leftPin.x - left.x);
    wipers[0].rotation.z = swing - 0.062;
    wipers[1].rotation.z = swing - 0.062;
  };
}

function addParkingCam(group, violet, steel, dark, centre) {
  const cam = new THREE.Group();
  cam.position.copy(centre).add(new THREE.Vector3(0, 0, 0.23));
  group.add(cam);
  const baseRadius = 0.234;
  const lift = 0.18;
  const halfWidth = 0.66;
  const profile = (angle) => {
    const distance = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    return baseRadius + lift * (1 - THREE.MathUtils.smoothstep(distance, 0.22, halfWidth));
  };
  const profilePoints = [];
  for (let index = 0; index < 100; index++) {
    const angle = TAU * index / 100;
    const radius = profile(angle);
    profilePoints.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  skin(cam, violet, profilePoints, 0.106, 0.016);
  cylinder(cam, steel, 0.07, 0.135, [0, 0, 0.056]);
  const switchBase = new THREE.Vector3(centre.x + 0.59, centre.y, centre.z + 0.285);
  box(group, dark, [0.35, 0.38, 0.20], switchBase.toArray());
  box(group, violet, [0.34, 0.27, 0.034], [switchBase.x + 0.047, switchBase.y, switchBase.z + 0.109]);
  box(group, steel, [0.06, 0.047, 0.05],
    [switchBase.x + 0.22, switchBase.y - 0.079, switchBase.z + 0.024]);
  box(group, steel, [0.06, 0.047, 0.05],
    [switchBase.x + 0.22, switchBase.y + 0.079, switchBase.z + 0.024]);
  const follower = cylinder(group, steel, 0.067, 0.091, [0, 0, 0]);
  const tip = new THREE.Vector3();
  const switchRod = bar(group, steel, 0.032);
  const indicatorFinish = material(0x8d6ba5, 0.08, 0.3, { emissive: 0xc898fe });
  cylinder(group, indicatorFinish, 0.052, 0.024,
    [switchBase.x + 0.052, switchBase.y + 0.012, switchBase.z + 0.137]);
  const parkAngle = -34 * Math.PI / 180;
  return (angle) => {
    cam.rotation.z = angle - parkAngle;
    const radius = profile(-cam.rotation.z);
    tip.set(centre.x + radius + 0.065, centre.y, switchBase.z);
    follower.position.copy(tip);
    placeBar(switchRod, tip, switchBase);
    indicatorFinish.emissiveIntensity = THREE.MathUtils.smoothstep(radius, 0.34, 0.40) * 1.6;
  };
}

function makeAnchor(group, position) {
  const anchor = new THREE.Object3D();
  anchor.position.set(...position);
  group.add(anchor);
  return anchor;
}

function guide(root, color, label) {
  const start = label.position.clone();
  const end = start.clone();
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mesh = new THREE.Line(geometry, new THREE.LineDashedMaterial({
    color, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.54, depthWrite: false,
  }));
  mesh.frustumCulled = false;
  root.add(mesh);
  return (amount) => {
    mesh.visible = amount > 0.14;
    if (mesh.visible) {
      end.copy(start).add(label.parent.position);
      geometry.attributes.position.setXYZ(1, end.x, end.y, end.z);
      geometry.attributes.position.needsUpdate = true;
      mesh.computeLineDistances();
    }
  };
}

export function createCar() {
  const root = new THREE.Group();
  const colors = { gears: 0x3873e6, linkage: 0xef9a37, cam: 0x9c63e9 };
  const steel = material(0xa8b9be, 0.47, 0.31);
  const enamel = material(0x236d70, 0.26, 0.34);
  const dark = material(0x182c36, 0.13, 0.65);
  const glass = material(0x91c9cf, 0.05, 0.31, {
    transparent: true, opacity: 0.33, depthWrite: false, side: THREE.DoubleSide,
  });
  const { body, canopy } = addCarBody(root, enamel, dark, steel, glass);
  const centre = new THREE.Vector3(0.75, 1.70, 1.20);
  const groups = {};
  const finishes = {};
  for (const [part, color] of Object.entries(colors)) {
    groups[part] = new THREE.Group();
    finishes[part] = material(color, 0.20, 0.33);
    root.add(groups[part]);
  }
  const moveGears = addGearTrain(groups.gears, finishes.gears, steel, dark, centre);
  const moveLinkage = addLinkage(groups.linkage, finishes.linkage, dark, steel, centre);
  const moveCam = addParkingCam(groups.cam, finishes.cam, steel, dark, centre);
  const labels = {
    gears: makeAnchor(groups.gears, [0.38, 1.39, 1.3]),
    linkage: makeAnchor(groups.linkage, [-0.71, 2.32, 1.76]),
    cam: makeAnchor(groups.cam, [0.91, 1.78, 1.55]),
  };
  const guides = Object.keys(labels).map((part) => guide(root, colors[part], labels[part]));
  let lastFocus;
  function update(turn, explode = 0, focus = null) {
    const angle = (turn - 34 / 360) * TAU;
    moveGears(angle);
    moveLinkage(angle);
    moveCam(angle);
    body.position.set(0, 0, -0.73 * explode);
    canopy.position.set(0, 2.30 + 0.24 * explode, 0.72 - 0.9 * explode);
    groups.gears.position.set(-1.14 * explode, -0.09 * explode, 0.87 * explode);
    groups.linkage.position.set(-0.20 * explode, 0.60 * explode, 0.23 * explode);
    groups.cam.position.set(1.06 * explode, 0.10 * explode, 0.95 * explode);
    guides.forEach((move) => move(explode));
    if (focus !== lastFocus) {
      for (const [part, finish] of Object.entries(finishes)) {
        const muted = focus && focus !== part;
        finish.color.setHex(colors[part]).multiplyScalar(muted ? 0.38 : 1);
        finish.emissive.setHex(colors[part]);
        finish.emissiveIntensity = focus === part ? 0.26 : 0.035;
      }
      lastFocus = focus;
    }
  }
  update(0);
  return {
    root, update, labels,
    camera: [3.7, 5.23, 10.25],
    target: [0, 1.79, 0.34],
    explodedCamera: [3.3, 5.85, 10.6],
    explodedTarget: [0, 2.08, 0.52],
  };
}
